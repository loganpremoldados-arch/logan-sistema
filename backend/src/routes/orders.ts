import { Router } from "express";
import { z } from "zod";
import { db } from "../db/client";
import {
  orders, orderItems, orderStatusEvents, customers, products, productionRecords,
  inventoryItems,
} from "../db/schema";
import { and, desc, eq, sql } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";
import { newId } from "../lib/ids";
import { nextOrderNumber } from "../lib/codes";
import { logAudit } from "../lib/audit";
import { AppError } from "../middleware/errorHandler";
import { calcOrderItem, recalcOrderTotals, reserveAvailableStock, round2, round3 } from "../services/orderCalculations";
import { computeOrderDeadline } from "../services/deadline";

export const ordersRouter = Router();
ordersRouter.use(requireAuth);

const itemInputSchema = z.object({
  productId: z.string().min(1),
  description: z.string().optional().nullable(),
  unitCode: z.string().min(1),
  quantityRequested: z.number().positive(),
  unitPrice: z.number().min(0),
  discount: z.number().min(0).optional(),
});

const orderSchema = z.object({
  customerId: z.string().min(1),
  opportunityId: z.string().optional().nullable(),
  closingDate: z.string().datetime().optional(),
  authorizationDate: z.string().datetime().optional().nullable(),
  agreedDeadlineDays: z.number().int().positive().optional().nullable(),
  expectedDeliveryDate: z.string().datetime().optional().nullable(),
  priority: z.enum(["BAIXA", "NORMAL", "ALTA", "URGENTE"]).optional(),
  paymentTerms: z.string().optional().nullable(),
  paymentMethod: z.string().optional().nullable(),
  deliveryMode: z.enum(["RETIRADA", "ENTREGA"]).optional(),
  freightValue: z.number().min(0).optional(),
  deliveryAddress: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  items: z.array(itemInputSchema).min(1, "o pedido precisa de ao menos um item"),
});

async function withDeadline(order: typeof orders.$inferSelect) {
  const deadline = await computeOrderDeadline(order.id, order.expectedDeliveryDate, order.operationalStatus);
  return { ...order, deadline };
}

ordersRouter.get("/", async (req, res) => {
  const commercialStatus = req.query.commercialStatus as string | undefined;
  const operationalStatus = req.query.operationalStatus as string | undefined;
  const conditions = [] as any[];
  if (commercialStatus) conditions.push(eq(orders.commercialStatus, commercialStatus as any));
  if (operationalStatus) conditions.push(eq(orders.operationalStatus, operationalStatus as any));

  const rows = await db
    .select({ order: orders, customerName: customers.name, customerCode: customers.code })
    .from(orders)
    .leftJoin(customers, eq(customers.id, orders.customerId))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(orders.createdAt))
    .limit(1000);

  const withDeadlines = await Promise.all(
    rows.map(async (r) => ({ ...r, deadline: await computeOrderDeadline(r.order.id, r.order.expectedDeliveryDate, r.order.operationalStatus) })),
  );
  res.json(withDeadlines);
});

ordersRouter.get("/:id", async (req, res) => {
  const [order] = await db.select().from(orders).where(eq(orders.id, req.params.id));
  if (!order) throw new AppError("Pedido não encontrado.", 404);
  const items = await db
    .select({ item: orderItems, productName: products.name, productCode: products.code })
    .from(orderItems)
    .leftJoin(products, eq(products.id, orderItems.productId))
    .where(eq(orderItems.orderId, order.id));
  const statusEvents = await db.select().from(orderStatusEvents).where(eq(orderStatusEvents.orderId, order.id)).orderBy(desc(orderStatusEvents.createdAt));
  const production = await db.select().from(productionRecords).where(eq(productionRecords.orderId, order.id)).orderBy(desc(productionRecords.date));
  const [customer] = await db.select().from(customers).where(eq(customers.id, order.customerId));
  const deadline = await computeOrderDeadline(order.id, order.expectedDeliveryDate, order.operationalStatus);

  res.json({ order, customer, items, statusEvents, production, deadline });
});

ordersRouter.post("/", async (req, res) => {
  const data = orderSchema.parse(req.body);
  const [customer] = await db.select().from(customers).where(eq(customers.id, data.customerId));
  if (!customer) throw new AppError("Cliente informado não existe.", 400);

  const number = await nextOrderNumber();
  const orderId = newId();
  await db.insert(orders).values({
    id: orderId, number, customerId: data.customerId, opportunityId: data.opportunityId || null,
    closingDate: data.closingDate ? new Date(data.closingDate) : new Date(),
    authorizationDate: data.authorizationDate ? new Date(data.authorizationDate) : null,
    ownerId: req.user!.id, agreedDeadlineDays: data.agreedDeadlineDays ?? null,
    expectedDeliveryDate: data.expectedDeliveryDate ? new Date(data.expectedDeliveryDate) : null,
    priority: data.priority ?? "NORMAL", paymentTerms: data.paymentTerms || null,
    paymentMethod: data.paymentMethod || null, deliveryMode: data.deliveryMode ?? "RETIRADA",
    freightValue: String(data.freightValue ?? 0), deliveryAddress: data.deliveryAddress || null,
    notes: data.notes || null,
  });

  for (const it of data.items) {
    const calc = calcOrderItem({
      quantityRequested: it.quantityRequested, unitPrice: it.unitPrice, discount: it.discount ?? 0,
      quantityReserved: 0, quantityApproved: 0, quantityDelivered: 0,
    });
    await db.insert(orderItems).values({
      id: newId(), orderId, productId: it.productId, description: it.description || null, unitCode: it.unitCode,
      quantityRequested: String(it.quantityRequested), unitPrice: String(it.unitPrice), discount: String(it.discount ?? 0),
      totalValue: String(calc.totalValue), quantityNeeded: String(calc.quantityNeeded),
    });
  }
  await recalcOrderTotals(orderId);
  await logAudit({ entityType: "Order", entityId: orderId, action: "CREATE", summary: `Pedido ${number} criado para ${customer.name}`, userId: req.user!.id });

  const [created] = await db.select().from(orders).where(eq(orders.id, orderId));
  res.status(201).json(await withDeadline(created));
});

/**
 * Confirma/aprova o pedido: reserva o estoque disponível de cada item e calcula
 * a necessidade real de produção (solicitado - reservado), conforme seção 18
 * (regras 5, 6 e 7 do briefing).
 */
ordersRouter.post("/:id/confirm", async (req, res) => {
  const [order] = await db.select().from(orders).where(eq(orders.id, req.params.id));
  if (!order) throw new AppError("Pedido não encontrado.", 404);
  if (order.commercialStatus === "APROVADO") throw new AppError("Este pedido já está aprovado.", 400);

  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, order.id));
  for (const item of items) {
    const reserved = await reserveAvailableStock(item.productId, Number(item.quantityRequested));
    const calc = calcOrderItem({
      quantityRequested: Number(item.quantityRequested), unitPrice: Number(item.unitPrice), discount: Number(item.discount),
      quantityReserved: reserved, quantityApproved: Number(item.quantityApproved), quantityDelivered: Number(item.quantityDelivered),
    });
    await db.update(orderItems).set({
      quantityReserved: String(reserved), quantityNeeded: String(calc.quantityNeeded), updatedAt: new Date(),
    }).where(eq(orderItems.id, item.id));
  }

  const anyNeedsProduction = (await db.select().from(orderItems).where(eq(orderItems.orderId, order.id))).some((i) => Number(i.quantityNeeded) > 0);

  await db.update(orders).set({
    commercialStatus: "APROVADO",
    operationalStatus: anyNeedsProduction ? "NA_FILA_PRODUCAO" : "PRONTO_PARA_SEPARACAO",
    authorizationDate: order.authorizationDate ?? new Date(),
    updatedAt: new Date(),
  }).where(eq(orders.id, order.id));

  await db.insert(orderStatusEvents).values({ id: newId(), orderId: order.id, dimension: "COMERCIAL", fromStatus: order.commercialStatus, toStatus: "APROVADO", changedBy: req.user!.id });
  await logAudit({ entityType: "Order", entityId: order.id, action: "CONFIRM", summary: `Pedido ${order.number} aprovado — estoque reservado e necessidade de produção calculada`, userId: req.user!.id });

  const [updated] = await db.select().from(orders).where(eq(orders.id, order.id));
  res.json(await withDeadline(updated));
});

const statusSchema = z.object({
  dimension: z.enum(["COMERCIAL", "FINANCEIRO", "OPERACIONAL"]),
  status: z.string().min(1),
  note: z.string().optional().nullable(),
});

ordersRouter.post("/:id/status", async (req, res) => {
  const data = statusSchema.parse(req.body);
  const [order] = await db.select().from(orders).where(eq(orders.id, req.params.id));
  if (!order) throw new AppError("Pedido não encontrado.", 404);

  const field = data.dimension === "COMERCIAL" ? "commercialStatus" : data.dimension === "FINANCEIRO" ? "financialStatus" : "operationalStatus";
  const from = (order as any)[field];
  await db.update(orders).set({ [field]: data.status, updatedAt: new Date() } as any).where(eq(orders.id, order.id));
  await db.insert(orderStatusEvents).values({ id: newId(), orderId: order.id, dimension: data.dimension, fromStatus: from, toStatus: data.status, changedBy: req.user!.id, note: data.note || null });
  await logAudit({ entityType: "Order", entityId: order.id, action: "STATUS_CHANGE", summary: `Pedido ${order.number} (${data.dimension}): ${from} → ${data.status}`, userId: req.user!.id });

  const [updated] = await db.select().from(orders).where(eq(orders.id, order.id));
  res.json(await withDeadline(updated));
});

// Registrar entrega (parcial ou integral) de um item do pedido
const deliverySchema = z.object({ orderItemId: z.string().min(1), quantity: z.number().positive() });

ordersRouter.post("/:id/deliver-item", async (req, res) => {
  const data = deliverySchema.parse(req.body);
  const [item] = await db.select().from(orderItems).where(eq(orderItems.id, data.orderItemId));
  if (!item || item.orderId !== req.params.id) throw new AppError("Item do pedido não encontrado.", 404);

  const newDelivered = round3(Number(item.quantityDelivered) + data.quantity);
  if (newDelivered > Number(item.quantityRequested)) {
    throw new AppError(`Quantidade entregue (${newDelivered}) não pode superar a quantidade solicitada (${item.quantityRequested}).`, 400);
  }
  const calc = calcOrderItem({
    quantityRequested: Number(item.quantityRequested), unitPrice: Number(item.unitPrice), discount: Number(item.discount),
    quantityReserved: Number(item.quantityReserved), quantityApproved: Number(item.quantityApproved), quantityDelivered: newDelivered,
  });
  await db.update(orderItems).set({ quantityDelivered: String(newDelivered), updatedAt: new Date() }).where(eq(orderItems.id, item.id));

  // baixa no estoque físico e na reserva
  const [inv] = await db.select().from(inventoryItems).where(eq(inventoryItems.productId, item.productId));
  if (inv) {
    await db.update(inventoryItems).set({
      physicalQty: String(round3(Number(inv.physicalQty) - data.quantity)),
      reservedQty: String(Math.max(0, round3(Number(inv.reservedQty) - data.quantity))),
      updatedAt: new Date(),
    }).where(eq(inventoryItems.productId, item.productId));
  }

  const order = (await db.select().from(orders).where(eq(orders.id, req.params.id)))[0];
  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, order.id));
  const allDelivered = items.every((i) => (i.id === item.id ? newDelivered : Number(i.quantityDelivered)) >= Number(i.quantityRequested));
  const someDelivered = items.some((i) => (i.id === item.id ? newDelivered : Number(i.quantityDelivered)) > 0);

  const newOperationalStatus = allDelivered ? "ENTREGUE_INTEGRALMENTE" : someDelivered ? "PARCIALMENTE_ENTREGUE" : order.operationalStatus;
  if (newOperationalStatus !== order.operationalStatus) {
    await db.update(orders).set({ operationalStatus: newOperationalStatus, updatedAt: new Date() }).where(eq(orders.id, order.id));
    await db.insert(orderStatusEvents).values({ id: newId(), orderId: order.id, dimension: "OPERACIONAL", fromStatus: order.operationalStatus, toStatus: newOperationalStatus, changedBy: req.user!.id });
  }
  if (allDelivered && order.commercialStatus === "APROVADO") {
    await db.update(orders).set({ commercialStatus: "ENCERRADO", updatedAt: new Date() }).where(eq(orders.id, order.id));
  }

  await logAudit({ entityType: "Order", entityId: order.id, action: "DELIVER", summary: `Pedido ${order.number}: entregue ${data.quantity} do item ${item.id}`, userId: req.user!.id });

  const [updated] = await db.select().from(orders).where(eq(orders.id, order.id));
  res.json(await withDeadline(updated));
});
