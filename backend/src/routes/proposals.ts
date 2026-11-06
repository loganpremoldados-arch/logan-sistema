import { Router } from "express";
import { z } from "zod";
import { db } from "../db/client";
import {
  proposals, proposalItems, proposalVersions, opportunities, customers, orders, orderItems,
  products, inventoryItems,
} from "../db/schema";
import { desc, eq } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";
import { newId } from "../lib/ids";
import { nextProposalNumber, nextOrderNumber } from "../lib/codes";
import { logAudit } from "../lib/audit";
import { AppError } from "../middleware/errorHandler";
import { calcOrderItem, recalcOrderTotals, reserveAvailableStock, round2 } from "../services/orderCalculations";

export const proposalsRouter = Router();
proposalsRouter.use(requireAuth);

const itemSchema = z.object({
  productId: z.string().optional().nullable(),
  description: z.string().min(1),
  unitCode: z.string().min(1),
  quantity: z.number().positive(),
  unitPrice: z.number().min(0),
  discount: z.number().min(0).optional(),
});

const proposalSchema = z.object({
  opportunityId: z.string().min(1),
  validUntil: z.string().datetime().optional().nullable(),
  paymentTerms: z.string().optional().nullable(),
  estimatedDays: z.number().int().optional().nullable(),
  freightValue: z.number().min(0).optional(),
  discountValue: z.number().min(0).optional(),
  notes: z.string().optional().nullable(),
  items: z.array(itemSchema).min(1, "a proposta precisa de ao menos um item"),
});

function itemTotal(i: { quantity: number; unitPrice: number; discount?: number }) {
  return round2(i.quantity * i.unitPrice - (i.discount ?? 0));
}

async function recalcProposalTotal(proposalId: string) {
  const items = await db.select().from(proposalItems).where(eq(proposalItems.proposalId, proposalId));
  const itemsTotal = items.reduce((acc, it) => acc + Number(it.totalValue), 0);
  const [proposal] = await db.select().from(proposals).where(eq(proposals.id, proposalId));
  const total = round2(itemsTotal + Number(proposal.freightValue) - Number(proposal.discountValue));
  await db.update(proposals).set({ totalValue: String(total), updatedAt: new Date() }).where(eq(proposals.id, proposalId));
}

proposalsRouter.get("/", async (req, res) => {
  const opportunityId = req.query.opportunityId as string | undefined;
  const rows = await db
    .select({
      proposal: proposals, customerName: customers.name, opportunityCode: opportunities.code,
    })
    .from(proposals)
    .leftJoin(customers, eq(customers.id, proposals.customerId))
    .leftJoin(opportunities, eq(opportunities.id, proposals.opportunityId))
    .where(opportunityId ? eq(proposals.opportunityId, opportunityId) : undefined)
    .orderBy(desc(proposals.createdAt));
  res.json(rows);
});

proposalsRouter.get("/:id", async (req, res) => {
  const [proposal] = await db.select().from(proposals).where(eq(proposals.id, req.params.id));
  if (!proposal) throw new AppError("Proposta não encontrada.", 404);
  const items = await db.select().from(proposalItems).where(eq(proposalItems.proposalId, proposal.id));
  const versions = await db.select().from(proposalVersions).where(eq(proposalVersions.proposalId, proposal.id)).orderBy(desc(proposalVersions.version));
  res.json({ proposal, items, versions });
});

proposalsRouter.post("/", async (req, res) => {
  const data = proposalSchema.parse(req.body);
  const [opp] = await db.select().from(opportunities).where(eq(opportunities.id, data.opportunityId));
  if (!opp) throw new AppError("Oportunidade não encontrada.", 400);

  const number = await nextProposalNumber();
  const id = newId();
  await db.insert(proposals).values({
    id, number, opportunityId: opp.id, customerId: opp.customerId, ownerId: req.user!.id,
    validUntil: data.validUntil ? new Date(data.validUntil) : null,
    paymentTerms: data.paymentTerms || null, estimatedDays: data.estimatedDays ?? null,
    freightValue: String(data.freightValue ?? 0), discountValue: String(data.discountValue ?? 0),
    notes: data.notes || null, status: "EM_ELABORACAO", currentVersion: 1,
  });

  for (const it of data.items) {
    await db.insert(proposalItems).values({
      id: newId(), proposalId: id, productId: it.productId || null, description: it.description,
      unitCode: it.unitCode, quantity: String(it.quantity), unitPrice: String(it.unitPrice),
      discount: String(it.discount ?? 0), totalValue: String(itemTotal(it)),
    });
  }
  await recalcProposalTotal(id);

  // move a oportunidade para a etapa de elaboração de proposta, se ainda não estiver mais avançada
  if (["NOVO_CONTATO", "QUALIFICACAO", "LEVANTAMENTO_NECESSIDADE"].includes(opp.stage)) {
    await db.update(opportunities).set({ stage: "ELABORACAO_ORCAMENTO", updatedAt: new Date() }).where(eq(opportunities.id, opp.id));
  }

  await logAudit({ entityType: "Proposal", entityId: id, action: "CREATE", summary: `Proposta ${number} criada para oportunidade ${opp.code}`, userId: req.user!.id });
  const [created] = await db.select().from(proposals).where(eq(proposals.id, id));
  res.status(201).json(created);
});

// Cria uma nova revisão (versão) da proposta preservando a anterior
proposalsRouter.post("/:id/revise", async (req, res) => {
  const data = z.object({ items: z.array(itemSchema).min(1), reason: z.string().optional().nullable() }).parse(req.body);
  const [proposal] = await db.select().from(proposals).where(eq(proposals.id, req.params.id));
  if (!proposal) throw new AppError("Proposta não encontrada.", 404);

  const currentItems = await db.select().from(proposalItems).where(eq(proposalItems.proposalId, proposal.id));
  await db.insert(proposalVersions).values({
    id: newId(), proposalId: proposal.id, version: proposal.currentVersion,
    snapshot: { proposal, items: currentItems },
  });

  await db.delete(proposalItems).where(eq(proposalItems.proposalId, proposal.id));
  for (const it of data.items) {
    await db.insert(proposalItems).values({
      id: newId(), proposalId: proposal.id, productId: it.productId || null, description: it.description,
      unitCode: it.unitCode, quantity: String(it.quantity), unitPrice: String(it.unitPrice),
      discount: String(it.discount ?? 0), totalValue: String(itemTotal(it)),
    });
  }
  await db.update(proposals).set({ currentVersion: proposal.currentVersion + 1, status: "REVISAO_SOLICITADA", updatedAt: new Date() }).where(eq(proposals.id, proposal.id));
  await recalcProposalTotal(proposal.id);

  await logAudit({ entityType: "Proposal", entityId: proposal.id, action: "REVISE", summary: `Proposta ${proposal.number} revisada (v${proposal.currentVersion} → v${proposal.currentVersion + 1}): ${data.reason ?? "sem motivo informado"}`, userId: req.user!.id });
  res.json({ ok: true, version: proposal.currentVersion + 1 });
});

const statusSchema = z.object({
  status: z.enum(["EM_ELABORACAO", "ENVIADA", "VISUALIZADA", "EM_NEGOCIACAO", "REVISAO_SOLICITADA", "APROVADA", "RECUSADA", "EXPIRADA", "CANCELADA"]),
});

proposalsRouter.post("/:id/status", async (req, res) => {
  const { status } = statusSchema.parse(req.body);
  const [proposal] = await db.select().from(proposals).where(eq(proposals.id, req.params.id));
  if (!proposal) throw new AppError("Proposta não encontrada.", 404);
  await db.update(proposals).set({ status, updatedAt: new Date() }).where(eq(proposals.id, proposal.id));

  if (status === "ENVIADA") {
    const [opp] = await db.select().from(opportunities).where(eq(opportunities.id, proposal.opportunityId));
    if (opp && !["FECHADA", "PERDIDA"].includes(opp.stage)) {
      await db.update(opportunities).set({ stage: "PROPOSTA_ENVIADA", updatedAt: new Date() }).where(eq(opportunities.id, opp.id));
    }
  }
  await logAudit({ entityType: "Proposal", entityId: proposal.id, action: "STATUS_CHANGE", summary: `Proposta ${proposal.number}: ${proposal.status} → ${status}`, userId: req.user!.id });
  res.json({ ok: true });
});

// Converte a proposta aprovada em um Pedido, preservando o vínculo oportunidade→proposta→pedido
proposalsRouter.post("/:id/convert-to-order", async (req, res) => {
  const data = z.object({
    agreedDeadlineDays: z.number().int().positive().optional().nullable(),
    paymentMethod: z.string().optional().nullable(),
    deliveryMode: z.enum(["RETIRADA", "ENTREGA"]).optional(),
    deliveryAddress: z.string().optional().nullable(),
  }).parse(req.body ?? {});

  const [proposal] = await db.select().from(proposals).where(eq(proposals.id, req.params.id));
  if (!proposal) throw new AppError("Proposta não encontrada.", 404);
  if (proposal.status !== "APROVADA") throw new AppError("Somente propostas aprovadas podem ser convertidas em pedido.", 400);

  const [existingOrder] = await db.select().from(orders).where(eq(orders.proposalId, proposal.id));
  if (existingOrder) throw new AppError(`Esta proposta já gerou o pedido ${existingOrder.number}.`, 409);

  const items = await db.select().from(proposalItems).where(eq(proposalItems.proposalId, proposal.id));
  const itemsWithoutProduct = items.filter((i) => !i.productId);
  if (itemsWithoutProduct.length) {
    throw new AppError("Todos os itens da proposta precisam estar vinculados a um produto cadastrado antes de gerar o pedido.", 400);
  }

  const number = await nextOrderNumber();
  const orderId = newId();
  const deadlineDays = data.agreedDeadlineDays ?? proposal.estimatedDays ?? null;
  const expectedDeliveryDate = deadlineDays ? new Date(Date.now() + deadlineDays * 86400000) : null;

  await db.insert(orders).values({
    id: orderId, number, customerId: proposal.customerId, opportunityId: proposal.opportunityId,
    proposalId: proposal.id, ownerId: proposal.ownerId, agreedDeadlineDays: deadlineDays,
    expectedDeliveryDate, paymentTerms: proposal.paymentTerms, paymentMethod: data.paymentMethod || null,
    deliveryMode: data.deliveryMode ?? "RETIRADA", deliveryAddress: data.deliveryAddress || null,
    freightValue: String(proposal.freightValue), commercialStatus: "AGUARDANDO_APROVACAO",
  });

  for (const it of items) {
    const itemId = newId();
    const calc = calcOrderItem({
      quantityRequested: Number(it.quantity), unitPrice: Number(it.unitPrice), discount: Number(it.discount),
      quantityReserved: 0, quantityApproved: 0, quantityDelivered: 0,
    });
    await db.insert(orderItems).values({
      id: itemId, orderId, productId: it.productId!, description: it.description, unitCode: it.unitCode,
      quantityRequested: it.quantity, unitPrice: it.unitPrice, discount: it.discount, totalValue: String(calc.totalValue),
      quantityNeeded: String(calc.quantityNeeded),
    });
  }
  await recalcOrderTotals(orderId);

  await db.update(opportunities).set({ stage: "FECHADA", closedAt: new Date(), updatedAt: new Date() }).where(eq(opportunities.id, proposal.opportunityId));
  await logAudit({ entityType: "Order", entityId: orderId, action: "CREATE", summary: `Pedido ${number} gerado a partir da proposta ${proposal.number}`, userId: req.user!.id });

  const [createdOrder] = await db.select().from(orders).where(eq(orders.id, orderId));
  res.status(201).json(createdOrder);
});
