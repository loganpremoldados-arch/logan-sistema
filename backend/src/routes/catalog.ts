import { Router } from "express";
import { z } from "zod";
import { db } from "../db/client";
import {
  products, productCategories, productUnits, salesChannels, lossReasons,
  productionCapacity, inventoryItems,
} from "../db/schema";
import { eq } from "drizzle-orm";
import { requireAuth, requireRole } from "../middleware/auth";
import { newId } from "../lib/ids";
import { AppError } from "../middleware/errorHandler";

export const catalogRouter = Router();
catalogRouter.use(requireAuth);

// ---- Unidades ----
catalogRouter.get("/units", async (_req, res) => {
  res.json(await db.select().from(productUnits));
});
catalogRouter.post("/units", requireRole("ADMINISTRADOR", "GESTAO"), async (req, res) => {
  const schema = z.object({ code: z.string().min(1), description: z.string().min(1) });
  const data = schema.parse(req.body);
  await db.insert(productUnits).values({ code: data.code.toUpperCase(), description: data.description });
  res.status(201).json({ ok: true });
});

// ---- Categorias ----
catalogRouter.get("/categories", async (_req, res) => {
  res.json(await db.select().from(productCategories));
});
catalogRouter.post("/categories", requireRole("ADMINISTRADOR", "GESTAO"), async (req, res) => {
  const schema = z.object({ name: z.string().min(1) });
  const data = schema.parse(req.body);
  const id = newId();
  await db.insert(productCategories).values({ id, name: data.name });
  res.status(201).json({ id, name: data.name });
});

// ---- Canais de venda ----
catalogRouter.get("/channels", async (_req, res) => {
  res.json(await db.select().from(salesChannels));
});
catalogRouter.post("/channels", requireRole("ADMINISTRADOR", "GESTAO", "COMERCIAL"), async (req, res) => {
  const schema = z.object({ name: z.string().min(1) });
  const data = schema.parse(req.body);
  const id = newId();
  await db.insert(salesChannels).values({ id, name: data.name });
  res.status(201).json({ id, name: data.name });
});

// ---- Motivos de perda ----
catalogRouter.get("/loss-reasons", async (_req, res) => {
  res.json(await db.select().from(lossReasons));
});
catalogRouter.post("/loss-reasons", requireRole("ADMINISTRADOR", "GESTAO", "COMERCIAL"), async (req, res) => {
  const schema = z.object({ name: z.string().min(1) });
  const data = schema.parse(req.body);
  const id = newId();
  await db.insert(lossReasons).values({ id, name: data.name });
  res.status(201).json({ id, name: data.name });
});

// ---- Produtos ----
const productSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional().nullable(),
  categoryId: z.string().optional().nullable(),
  unitCode: z.string().min(1),
  defaultPrice: z.number().optional().nullable(),
});

catalogRouter.get("/products", async (_req, res) => {
  const rows = await db
    .select({
      id: products.id, code: products.code, name: products.name, description: products.description,
      categoryId: products.categoryId, unitCode: products.unitCode, active: products.active,
      defaultPrice: products.defaultPrice,
    })
    .from(products);
  res.json(rows);
});

catalogRouter.post("/products", requireRole("ADMINISTRADOR", "GESTAO"), async (req, res) => {
  const data = productSchema.parse(req.body);
  const [dup] = await db.select().from(products).where(eq(products.code, data.code));
  if (dup) throw new AppError(`Já existe um produto com o código ${data.code}.`, 409);
  const id = newId();
  await db.insert(products).values({
    id, code: data.code, name: data.name, description: data.description || null,
    categoryId: data.categoryId || null, unitCode: data.unitCode,
    defaultPrice: data.defaultPrice != null ? String(data.defaultPrice) : null,
  });
  await db.insert(inventoryItems).values({ productId: id });
  res.status(201).json({ id });
});

catalogRouter.put("/products/:id", requireRole("ADMINISTRADOR", "GESTAO"), async (req, res) => {
  const data = productSchema.partial().parse(req.body);
  await db.update(products).set({
    ...data,
    defaultPrice: data.defaultPrice != null ? String(data.defaultPrice) : undefined,
    updatedAt: new Date(),
  }).where(eq(products.id, req.params.id));
  res.json({ ok: true });
});

// ---- Capacidade produtiva ----
const capacitySchema = z.object({
  productId: z.string().min(1),
  theoreticalDailyQty: z.number().positive(),
  realDailyQty: z.number().positive().optional().nullable(),
  moldsAvailable: z.number().int().optional().nullable(),
  moldCycleDays: z.number().optional().nullable(),
  manufactureTimeDays: z.number().optional().nullable(),
  curingTimeDays: z.number().optional().nullable(),
  finishingTimeDays: z.number().optional().nullable(),
  effectiveDaysPerWeek: z.number().int().min(1).max(7).optional(),
  defaultLeadTimeDays: z.number().int().optional().nullable(),
  restrictions: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  validated: z.boolean().optional(),
});

catalogRouter.get("/capacity", async (_req, res) => {
  const rows = await db
    .select({
      id: productionCapacity.id, productId: productionCapacity.productId,
      theoreticalDailyQty: productionCapacity.theoreticalDailyQty, realDailyQty: productionCapacity.realDailyQty,
      moldsAvailable: productionCapacity.moldsAvailable, moldCycleDays: productionCapacity.moldCycleDays,
      manufactureTimeDays: productionCapacity.manufactureTimeDays, curingTimeDays: productionCapacity.curingTimeDays,
      finishingTimeDays: productionCapacity.finishingTimeDays, effectiveDaysPerWeek: productionCapacity.effectiveDaysPerWeek,
      defaultLeadTimeDays: productionCapacity.defaultLeadTimeDays, restrictions: productionCapacity.restrictions,
      notes: productionCapacity.notes, validated: productionCapacity.validated,
      productName: products.name, productCode: products.code, unitCode: products.unitCode,
    })
    .from(productionCapacity)
    .leftJoin(products, eq(products.id, productionCapacity.productId));
  res.json(rows);
});

catalogRouter.post("/capacity", requireRole("ADMINISTRADOR", "GESTAO", "PRODUCAO"), async (req, res) => {
  const data = capacitySchema.parse(req.body);
  const [existing] = await db.select().from(productionCapacity).where(eq(productionCapacity.productId, data.productId));
  const values = {
    theoreticalDailyQty: String(data.theoreticalDailyQty),
    realDailyQty: data.realDailyQty != null ? String(data.realDailyQty) : null,
    moldsAvailable: data.moldsAvailable ?? null,
    moldCycleDays: data.moldCycleDays != null ? String(data.moldCycleDays) : null,
    manufactureTimeDays: data.manufactureTimeDays != null ? String(data.manufactureTimeDays) : null,
    curingTimeDays: data.curingTimeDays != null ? String(data.curingTimeDays) : null,
    finishingTimeDays: data.finishingTimeDays != null ? String(data.finishingTimeDays) : null,
    effectiveDaysPerWeek: data.effectiveDaysPerWeek ?? 6,
    defaultLeadTimeDays: data.defaultLeadTimeDays ?? null,
    restrictions: data.restrictions || null,
    notes: data.notes || null,
    validated: data.validated ?? false,
    updatedAt: new Date(),
  };
  if (existing) {
    await db.update(productionCapacity).set(values).where(eq(productionCapacity.productId, data.productId));
  } else {
    await db.insert(productionCapacity).values({ id: newId(), productId: data.productId, ...values });
  }
  res.status(201).json({ ok: true });
});

// ---- Estoque (consulta simples) ----
catalogRouter.get("/inventory", async (_req, res) => {
  const rows = await db
    .select({
      productId: inventoryItems.productId, physicalQty: inventoryItems.physicalQty,
      reservedQty: inventoryItems.reservedQty, inspectionQty: inventoryItems.inspectionQty,
      rejectedQty: inventoryItems.rejectedQty, minimumQty: inventoryItems.minimumQty,
      productName: products.name, productCode: products.code, unitCode: products.unitCode,
    })
    .from(inventoryItems)
    .leftJoin(products, eq(products.id, inventoryItems.productId));
  res.json(rows.map((r) => ({
    ...r,
    availableQty: Number(r.physicalQty) - Number(r.reservedQty) - Number(r.inspectionQty) - Number(r.rejectedQty),
  })));
});
