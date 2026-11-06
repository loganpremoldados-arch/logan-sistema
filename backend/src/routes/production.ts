import { Router } from "express";
import { z } from "zod";
import { db } from "../db/client";
import {
  productionRecords, orderItems, orders, products, inventoryItems, inventoryMovements,
  productionCapacity,
} from "../db/schema";
import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";
import { newId } from "../lib/ids";
import { logAudit } from "../lib/audit";
import { AppError } from "../middleware/errorHandler";
import { calcOrderItem, round3 } from "../services/orderCalculations";

export const productionRouter = Router();
productionRouter.use(requireAuth);

const PRODUCTION_STAGES = [
  "AGUARDANDO_PRODUCAO", "EM_FABRICACAO", "FABRICACAO_CONCLUIDA", "EM_CURA", "EM_ACABAMENTO",
  "AGUARDANDO_INSPECAO", "APROVADO", "REPROVADO", "DISPONIVEL",
] as const;

// Fila de produção: itens de pedidos aprovados com saldo a produzir
productionRouter.get("/queue", async (_req, res) => {
  const rows = await db
    .select({
      item: orderItems, orderNumber: orders.number, orderPriority: orders.priority,
      expectedDeliveryDate: orders.expectedDeliveryDate, authorizationDate: orders.authorizationDate,
      productName: products.name, productCode: products.code,
    })
    .from(orderItems)
    .innerJoin(orders, eq(orders.id, orderItems.orderId))
    .leftJoin(products, eq(products.id, orderItems.productId))
    .where(and(eq(orders.commercialStatus, "APROVADO"), sql`${orderItems.quantityNeeded} > ${orderItems.quantityApproved}`));

  res.json(rows.map((r) => ({
    ...r,
    pendingToProduce: Number(r.item.quantityNeeded) - Number(r.item.quantityApproved),
  })));
});

productionRouter.get("/records", async (req, res) => {
  const from = req.query.from as string | undefined;
  const to = req.query.to as string | undefined;
  const conditions = [] as any[];
  if (from) conditions.push(gte(productionRecords.date, new Date(from)));
  if (to) conditions.push(lte(productionRecords.date, new Date(to)));

  const rows = await db
    .select({
      record: productionRecords, productName: products.name, productCode: products.code, orderNumber: orders.number,
    })
    .from(productionRecords)
    .leftJoin(products, eq(products.id, productionRecords.productId))
    .leftJoin(orders, eq(orders.id, productionRecords.orderId))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(productionRecords.date));
  res.json(rows);
});

const recordSchema = z.object({
  date: z.string().datetime(),
  orderId: z.string().optional().nullable(),
  orderItemId: z.string().optional().nullable(),
  productId: z.string().min(1),
  stage: z.enum(PRODUCTION_STAGES).optional(),
  quantityProduced: z.number().positive(),
  quantityApproved: z.number().min(0).optional(),
  quantityRejected: z.number().min(0).optional(),
  lossReason: z.string().optional().nullable(),
  shift: z.string().optional().nullable(),
  occurrences: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

productionRouter.post("/records", async (req, res) => {
  const data = recordSchema.parse(req.body);
  const approved = data.quantityApproved ?? data.quantityProduced;
  const rejected = data.quantityRejected ?? 0;
  if (round3(approved + rejected) > round3(data.quantityProduced) + 0.001) {
    throw new AppError("A soma de aprovado + rejeitado não pode superar a quantidade produzida.", 400);
  }

  const id = newId();
  await db.insert(productionRecords).values({
    id, date: new Date(data.date), orderId: data.orderId || null, orderItemId: data.orderItemId || null,
    productId: data.productId, stage: data.stage ?? "EM_FABRICACAO", quantityProduced: String(data.quantityProduced),
    quantityApproved: String(approved), quantityRejected: String(rejected), lossReason: data.lossReason || null,
    userId: req.user!.id, shift: data.shift || null, occurrences: data.occurrences || null, notes: data.notes || null,
  });

  // Atualiza o saldo do item do pedido, quando vinculado
  if (data.orderItemId) {
    const [item] = await db.select().from(orderItems).where(eq(orderItems.id, data.orderItemId));
    if (item) {
      const newApproved = round3(Number(item.quantityApproved) + approved);
      const newRejected = round3(Number(item.quantityRejected) + rejected);
      const newProduced = round3(Number(item.quantityProduced) + data.quantityProduced);
      const calc = calcOrderItem({
        quantityRequested: Number(item.quantityRequested), unitPrice: Number(item.unitPrice), discount: Number(item.discount),
        quantityReserved: Number(item.quantityReserved), quantityApproved: newApproved, quantityDelivered: Number(item.quantityDelivered),
      });
      await db.update(orderItems).set({
        quantityProduced: String(newProduced), quantityApproved: String(newApproved), quantityRejected: String(newRejected),
        quantityNeeded: String(calc.quantityNeeded),
        completedDate: calc.pendingToProduce <= 0 ? new Date() : null,
        updatedAt: new Date(),
      }).where(eq(orderItems.id, item.id));

      // disponibiliza para estoque/expedição o que foi aprovado
      if (approved > 0) {
        const [inv] = await db.select().from(inventoryItems).where(eq(inventoryItems.productId, item.productId));
        if (inv) {
          await db.update(inventoryItems).set({ physicalQty: String(round3(Number(inv.physicalQty) + approved)), updatedAt: new Date() }).where(eq(inventoryItems.productId, item.productId));
          await db.insert(inventoryMovements).values({ id: newId(), productId: item.productId, type: "ENTRADA_PRODUCAO", quantity: String(approved), reference: `Apontamento ${id}`, userId: req.user!.id });
        }
      }

      // se o pedido estava aguardando produção/fila e já tem algo pronto, evolui o status operacional
      const [order] = await db.select().from(orders).where(eq(orders.id, item.orderId));
      if (order && ["AGUARDANDO_LIBERACAO", "AGUARDANDO_PROGRAMACAO", "NA_FILA_PRODUCAO"].includes(order.operationalStatus)) {
        await db.update(orders).set({ operationalStatus: "EM_FABRICACAO", updatedAt: new Date() }).where(eq(orders.id, order.id));
      }
      if (order && calc.pendingToProduce <= 0) {
        const allItems = await db.select().from(orderItems).where(eq(orderItems.orderId, order.id));
        const allReady = allItems.every((i) => (i.id === item.id ? calc.pendingToProduce <= 0 : Number(i.quantityNeeded) <= Number(i.quantityApproved)));
        if (allReady) {
          await db.update(orders).set({ operationalStatus: "PRONTO_PARA_SEPARACAO", updatedAt: new Date() }).where(eq(orders.id, order.id));
        }
      }
    }
  } else if (approved > 0) {
    const [inv] = await db.select().from(inventoryItems).where(eq(inventoryItems.productId, data.productId));
    if (inv) {
      await db.update(inventoryItems).set({ physicalQty: String(round3(Number(inv.physicalQty) + approved)), updatedAt: new Date() }).where(eq(inventoryItems.productId, data.productId));
      await db.insert(inventoryMovements).values({ id: newId(), productId: data.productId, type: "ENTRADA_PRODUCAO", quantity: String(approved), reference: `Apontamento ${id}`, userId: req.user!.id });
    }
  }

  await logAudit({ entityType: "ProductionRecord", entityId: id, action: "CREATE", summary: `Apontamento de produção registrado (${data.quantityProduced} un.)`, userId: req.user!.id });
  const [created] = await db.select().from(productionRecords).where(eq(productionRecords.id, id));
  res.status(201).json(created);
});

// Comparativo planejado x realizado (simplificado: planejado = capacidade teórica * dias do período)
productionRouter.get("/comparativo", async (req, res) => {
  const from = new Date((req.query.from as string) ?? new Date(Date.now() - 30 * 86400000));
  const to = new Date((req.query.to as string) ?? new Date());

  const records = await db
    .select({ productId: productionRecords.productId, productName: products.name, approved: productionRecords.quantityApproved, rejected: productionRecords.quantityRejected, produced: productionRecords.quantityProduced })
    .from(productionRecords)
    .leftJoin(products, eq(products.id, productionRecords.productId))
    .where(and(gte(productionRecords.date, from), lte(productionRecords.date, to)));

  const byProduct = new Map<string, { productName: string; produzido: number; aprovado: number; rejeitado: number }>();
  for (const r of records) {
    const entry = byProduct.get(r.productId) ?? { productName: r.productName ?? "—", produzido: 0, aprovado: 0, rejeitado: 0 };
    entry.produzido += Number(r.produced);
    entry.aprovado += Number(r.approved);
    entry.rejeitado += Number(r.rejected);
    byProduct.set(r.productId, entry);
  }

  const caps = await db.select().from(productionCapacity);
  const days = Math.max(1, Math.ceil((to.getTime() - from.getTime()) / 86400000));
  const result = [...byProduct.entries()].map(([productId, v]) => {
    const cap = caps.find((c) => c.productId === productId);
    const dailyRate = Number(cap?.realDailyQty ?? cap?.theoreticalDailyQty ?? 0);
    const planejado = dailyRate * days;
    return {
      productId, productName: v.productName, planejado: Math.round(planejado),
      produzido: v.produzido, aprovado: v.aprovado, rejeitado: v.rejeitado,
      indiceDePerdas: v.produzido > 0 ? Math.round((v.rejeitado / v.produzido) * 10000) / 100 : 0,
      cumprimento: planejado > 0 ? Math.round((v.aprovado / planejado) * 10000) / 100 : null,
    };
  });
  res.json({ from, to, days, items: result });
});
