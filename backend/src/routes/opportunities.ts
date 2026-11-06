import { Router } from "express";
import { z } from "zod";
import { db } from "../db/client";
import {
  opportunities, opportunityStageEvents, commercialActivities, customers, salesChannels,
  lossReasons, users, products,
} from "../db/schema";
import { and, desc, eq, gte, isNull, lte, or, sql } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";
import { newId } from "../lib/ids";
import { nextOpportunityCode } from "../lib/codes";
import { logAudit } from "../lib/audit";
import { AppError } from "../middleware/errorHandler";

export const opportunitiesRouter = Router();
opportunitiesRouter.use(requireAuth);

const STAGES = [
  "NOVO_CONTATO", "QUALIFICACAO", "LEVANTAMENTO_NECESSIDADE", "ELABORACAO_ORCAMENTO",
  "PROPOSTA_ENVIADA", "EM_NEGOCIACAO", "AGUARDANDO_DECISAO", "FECHADA", "PERDIDA", "SUSPENSA",
] as const;

const opportunitySchema = z.object({
  customerId: z.string().min(1, "selecione um cliente"),
  contactName: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  whatsapp: z.string().optional().nullable(),
  email: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  channelId: z.string().optional().nullable(),
  ownerId: z.string().optional().nullable(),
  productId: z.string().optional().nullable(),
  productDescription: z.string().optional().nullable(),
  quantity: z.number().optional().nullable(),
  unitCode: z.string().optional().nullable(),
  estimatedValue: z.number().optional().nullable(),
  proposalValue: z.number().optional().nullable(),
  desiredDeadline: z.string().optional().nullable(),
  expectedCloseDate: z.string().datetime().optional().nullable(),
  probability: z.number().int().min(0).max(100).optional(),
  priority: z.enum(["BAIXA", "NORMAL", "ALTA", "URGENTE"]).optional(),
  nextAction: z.string().optional().nullable(),
  nextContactDate: z.string().datetime().optional().nullable(),
  notes: z.string().optional().nullable(),
});

// probabilidade sugerida por etapa (configurável futuramente via system_settings)
const DEFAULT_PROBABILITY: Record<string, number> = {
  NOVO_CONTATO: 10, QUALIFICACAO: 20, LEVANTAMENTO_NECESSIDADE: 30, ELABORACAO_ORCAMENTO: 40,
  PROPOSTA_ENVIADA: 50, EM_NEGOCIACAO: 65, AGUARDANDO_DECISAO: 75, FECHADA: 100, PERDIDA: 0, SUSPENSA: 15,
};

opportunitiesRouter.get("/", async (req, res) => {
  const stageFilter = req.query.stage as string | undefined;
  const openOnly = req.query.open === "1";
  const ownerId = req.query.ownerId as string | undefined;
  const conditions = [] as any[];
  if (stageFilter) conditions.push(eq(opportunities.stage, stageFilter as any));
  if (openOnly) conditions.push(sql`${opportunities.stage} NOT IN ('FECHADA','PERDIDA')`);
  if (ownerId) conditions.push(eq(opportunities.ownerId, ownerId));

  const rows = await db
    .select({
      opportunity: opportunities,
      customerName: customers.name,
      customerCode: customers.code,
      channelName: salesChannels.name,
      ownerName: users.name,
      productName: products.name,
    })
    .from(opportunities)
    .leftJoin(customers, eq(customers.id, opportunities.customerId))
    .leftJoin(salesChannels, eq(salesChannels.id, opportunities.channelId))
    .leftJoin(users, eq(users.id, opportunities.ownerId))
    .leftJoin(products, eq(products.id, opportunities.productId))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(opportunities.createdAt))
    .limit(1000);

  res.json(rows);
});

opportunitiesRouter.get("/followups", async (_req, res) => {
  const today = new Date();
  const todayEnd = new Date(today); todayEnd.setHours(23, 59, 59, 999);
  const in7 = new Date(today); in7.setDate(in7.getDate() + 7);
  const open = sql`${opportunities.stage} NOT IN ('FECHADA','PERDIDA')`;

  const overdue = await db.select().from(opportunities).where(and(open, lte(opportunities.nextContactDate, today)));
  const today_ = await db.select().from(opportunities).where(and(open, gte(opportunities.nextContactDate, new Date(today.setHours(0,0,0,0))), lte(opportunities.nextContactDate, todayEnd)));
  const next7 = await db.select().from(opportunities).where(and(open, gte(opportunities.nextContactDate, todayEnd), lte(opportunities.nextContactDate, in7)));
  const noNextAction = await db.select().from(opportunities).where(and(open, isNull(opportunities.nextContactDate)));
  const stalledStages = ["PROPOSTA_ENVIADA", "EM_NEGOCIACAO", "AGUARDANDO_DECISAO"];
  const noReturnProposals = await db.select().from(opportunities).where(and(sql`${opportunities.stage} IN ('PROPOSTA_ENVIADA')`, isNull(opportunities.nextContactDate)));

  res.json({ overdue, today: today_, next7, noNextAction, noReturnProposals });
});

opportunitiesRouter.get("/:id", async (req, res) => {
  const [opp] = await db.select().from(opportunities).where(eq(opportunities.id, req.params.id));
  if (!opp) throw new AppError("Oportunidade não encontrada.", 404);
  const activities = await db.select().from(commercialActivities).where(eq(commercialActivities.opportunityId, opp.id)).orderBy(desc(commercialActivities.occurredAt));
  const stageEvents = await db.select().from(opportunityStageEvents).where(eq(opportunityStageEvents.opportunityId, opp.id)).orderBy(desc(opportunityStageEvents.createdAt));
  res.json({ opportunity: opp, activities, stageEvents });
});

opportunitiesRouter.post("/", async (req, res) => {
  const data = opportunitySchema.parse(req.body);
  const [customer] = await db.select().from(customers).where(eq(customers.id, data.customerId));
  if (!customer) throw new AppError("Cliente informado não existe.", 400);

  const now = new Date();
  const code = await nextOpportunityCode(now);
  const id = newId();
  await db.insert(opportunities).values({
    id, code, entryDate: now, customerId: data.customerId,
    contactName: data.contactName || null, phone: data.phone || null, whatsapp: data.whatsapp || null,
    email: data.email || null, city: data.city || null, channelId: data.channelId || null,
    ownerId: data.ownerId || req.user!.id, productId: data.productId || null,
    productDescription: data.productDescription || null,
    quantity: data.quantity != null ? String(data.quantity) : null,
    unitCode: data.unitCode || null,
    estimatedValue: data.estimatedValue != null ? String(data.estimatedValue) : null,
    proposalValue: data.proposalValue != null ? String(data.proposalValue) : null,
    desiredDeadline: data.desiredDeadline || null,
    expectedCloseDate: data.expectedCloseDate ? new Date(data.expectedCloseDate) : null,
    probability: data.probability ?? DEFAULT_PROBABILITY.NOVO_CONTATO,
    priority: data.priority ?? "NORMAL",
    nextAction: data.nextAction || null,
    nextContactDate: data.nextContactDate ? new Date(data.nextContactDate) : null,
    notes: data.notes || null,
  });
  await db.insert(opportunityStageEvents).values({ id: newId(), opportunityId: id, toStage: "NOVO_CONTATO", changedBy: req.user!.id, note: "Oportunidade criada" });
  await logAudit({ entityType: "Opportunity", entityId: id, action: "CREATE", summary: `Oportunidade ${code} criada para ${customer.name}`, userId: req.user!.id });

  const [created] = await db.select().from(opportunities).where(eq(opportunities.id, id));
  res.status(201).json(created);
});

opportunitiesRouter.put("/:id", async (req, res) => {
  const data = opportunitySchema.partial().parse(req.body);
  const [existing] = await db.select().from(opportunities).where(eq(opportunities.id, req.params.id));
  if (!existing) throw new AppError("Oportunidade não encontrada.", 404);

  await db.update(opportunities).set({
    ...data,
    quantity: data.quantity != null ? String(data.quantity) : undefined,
    estimatedValue: data.estimatedValue != null ? String(data.estimatedValue) : undefined,
    proposalValue: data.proposalValue != null ? String(data.proposalValue) : undefined,
    expectedCloseDate: data.expectedCloseDate ? new Date(data.expectedCloseDate) : undefined,
    nextContactDate: data.nextContactDate ? new Date(data.nextContactDate) : undefined,
    updatedAt: new Date(),
  }).where(eq(opportunities.id, existing.id));

  await logAudit({ entityType: "Opportunity", entityId: existing.id, action: "UPDATE", summary: `Oportunidade ${existing.code} atualizada`, userId: req.user!.id });
  const [updated] = await db.select().from(opportunities).where(eq(opportunities.id, existing.id));
  res.json(updated);
});

const stageChangeSchema = z.object({
  stage: z.enum(STAGES),
  note: z.string().optional().nullable(),
  lossReasonId: z.string().optional().nullable(),
  lossJustification: z.string().optional().nullable(),
  probability: z.number().int().min(0).max(100).optional(),
});

opportunitiesRouter.post("/:id/stage", async (req, res) => {
  const data = stageChangeSchema.parse(req.body);
  const [existing] = await db.select().from(opportunities).where(eq(opportunities.id, req.params.id));
  if (!existing) throw new AppError("Oportunidade não encontrada.", 404);

  if (data.stage === "PERDIDA" && !data.lossReasonId) {
    throw new AppError("Para marcar como perdida é obrigatório informar o motivo da perda.", 400);
  }
  if (data.stage === "PERDIDA" && !data.lossJustification) {
    throw new AppError("Informe a justificativa ao marcar a oportunidade como perdida.", 400);
  }

  const closed = data.stage === "FECHADA" || data.stage === "PERDIDA";
  await db.update(opportunities).set({
    stage: data.stage,
    probability: data.probability ?? DEFAULT_PROBABILITY[data.stage],
    lossReasonId: data.stage === "PERDIDA" ? data.lossReasonId : existing.lossReasonId,
    lossJustification: data.stage === "PERDIDA" ? data.lossJustification : existing.lossJustification,
    closedAt: closed ? new Date() : null,
    updatedAt: new Date(),
  }).where(eq(opportunities.id, existing.id));

  await db.insert(opportunityStageEvents).values({
    id: newId(), opportunityId: existing.id, fromStage: existing.stage, toStage: data.stage,
    changedBy: req.user!.id, note: data.note || null,
  });
  await logAudit({
    entityType: "Opportunity", entityId: existing.id, action: "STAGE_CHANGE",
    summary: `Oportunidade ${existing.code}: ${existing.stage} → ${data.stage}`,
    changes: { stage: { de: existing.stage, para: data.stage } }, userId: req.user!.id,
  });

  const [updated] = await db.select().from(opportunities).where(eq(opportunities.id, existing.id));
  res.json(updated);
});

// ---- Atividades comerciais ----
const activitySchema = z.object({
  occurredAt: z.string().datetime().optional(),
  type: z.enum(["LIGACAO", "WHATSAPP", "EMAIL", "VISITA", "REUNIAO", "ENVIO_ORCAMENTO", "NEGOCIACAO", "RETORNO_CLIENTE", "OUTROS"]),
  channelUsed: z.string().optional().nullable(),
  description: z.string().min(1, "descreva o contato"),
  result: z.string().optional().nullable(),
  nextAction: z.string().optional().nullable(),
  nextContactAt: z.string().datetime().optional().nullable(),
});

opportunitiesRouter.post("/:id/activities", async (req, res) => {
  const data = activitySchema.parse(req.body);
  const [opp] = await db.select().from(opportunities).where(eq(opportunities.id, req.params.id));
  if (!opp) throw new AppError("Oportunidade não encontrada.", 404);

  const id = newId();
  await db.insert(commercialActivities).values({
    id, opportunityId: opp.id, occurredAt: data.occurredAt ? new Date(data.occurredAt) : new Date(),
    userId: req.user!.id, type: data.type, channelUsed: data.channelUsed || null,
    description: data.description, result: data.result || null, nextAction: data.nextAction || null,
    nextContactAt: data.nextContactAt ? new Date(data.nextContactAt) : null,
  });

  if (data.nextContactAt) {
    await db.update(opportunities).set({ nextContactDate: new Date(data.nextContactAt), nextAction: data.nextAction || opp.nextAction, updatedAt: new Date() }).where(eq(opportunities.id, opp.id));
  }
  await logAudit({ entityType: "Opportunity", entityId: opp.id, action: "ACTIVITY", summary: `Atividade registrada em ${opp.code}: ${data.type}`, userId: req.user!.id });

  const [created] = await db.select().from(commercialActivities).where(eq(commercialActivities.id, id));
  res.status(201).json(created);
});
