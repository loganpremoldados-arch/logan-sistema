import { Router } from "express";
import { z } from "zod";
import { db } from "../db/client";
import { customers, customerContacts, opportunities, proposals, orders, orderItems } from "../db/schema";
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";
import { newId } from "../lib/ids";
import { nextCustomerCode } from "../lib/codes";
import { logAudit } from "../lib/audit";
import { AppError } from "../middleware/errorHandler";

export const customersRouter = Router();
customersRouter.use(requireAuth);

const profileEnum = z.enum([
  "CONSUMIDOR_FINAL", "CONSTRUTORA", "REVENDEDOR", "ENGENHEIRO", "ARQUITETO",
  "PROFISSIONAL_CONSTRUCAO", "ORGAO_PUBLICO", "OUTROS",
]);

const customerSchema = z.object({
  name: z.string().min(2, "informe o nome ou razão social"),
  tradeName: z.string().optional().nullable(),
  document: z.string().optional().nullable(),
  stateRegistration: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  whatsapp: z.string().optional().nullable(),
  email: z.string().email().optional().nullable().or(z.literal("")),
  address: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  state: z.string().optional().nullable(),
  zipCode: z.string().optional().nullable(),
  profile: profileEnum.optional(),
  notes: z.string().optional().nullable(),
  ownerId: z.string().optional().nullable(),
});

function onlyDigits(s?: string | null) {
  return s ? s.replace(/\D/g, "") : null;
}

customersRouter.get("/", async (req, res) => {
  const search = (req.query.q as string) || "";
  const where = search
    ? or(
        ilike(customers.name, `%${search}%`),
        ilike(customers.code, `%${search}%`),
        ilike(customers.document, `%${search}%`),
        ilike(customers.phone, `%${search}%`),
      )
    : undefined;
  const rows = await db.select().from(customers).where(where).orderBy(desc(customers.createdAt)).limit(500);
  res.json(rows);
});

customersRouter.get("/:id", async (req, res) => {
  const [customer] = await db.select().from(customers).where(eq(customers.id, req.params.id));
  if (!customer) throw new AppError("Cliente não encontrado.", 404);
  const contacts = await db.select().from(customerContacts).where(eq(customerContacts.customerId, customer.id));
  const custOpportunities = await db.select().from(opportunities).where(eq(opportunities.customerId, customer.id)).orderBy(desc(opportunities.createdAt));
  const custProposals = await db.select().from(proposals).where(eq(proposals.customerId, customer.id)).orderBy(desc(proposals.createdAt));
  const custOrders = await db.select().from(orders).where(eq(orders.customerId, customer.id)).orderBy(desc(orders.createdAt));

  const totalSold = custOrders.reduce((acc, o) => acc + Number(o.netValue), 0);
  const totalReceived = custOrders.reduce((acc, o) => acc + Number(o.receivedValue), 0);
  const ticketMedio = custOrders.length ? totalSold / custOrders.length : 0;
  const lastOrder = custOrders[0]?.closingDate ?? null;

  res.json({
    customer,
    contacts,
    opportunities: custOpportunities,
    proposals: custProposals,
    orders: custOrders,
    indicators: {
      totalSold,
      totalReceived,
      balanceDue: totalSold - totalReceived,
      ordersCount: custOrders.length,
      ticketMedio,
      lastOrderDate: lastOrder,
      openOpportunities: custOpportunities.filter((o) => !["FECHADA", "PERDIDA"].includes(o.stage)).length,
      lostProposals: custProposals.filter((p) => p.status === "RECUSADA").length,
    },
  });
});

customersRouter.post("/", async (req, res) => {
  const data = customerSchema.parse(req.body);
  const document = onlyDigits(data.document);

  if (document) {
    const [dup] = await db.select().from(customers).where(eq(customers.document, document));
    if (dup) {
      throw new AppError(`Já existe um cliente cadastrado com este CPF/CNPJ: ${dup.name} (${dup.code}).`, 409);
    }
  }
  // alerta de possível duplicidade por nome semelhante (não bloqueia, apenas retorna aviso)
  const similar = await db.select().from(customers).where(ilike(customers.name, `%${data.name.trim()}%`));

  const code = await nextCustomerCode();
  const id = newId();
  await db.insert(customers).values({
    id,
    code,
    name: data.name.trim(),
    tradeName: data.tradeName || null,
    document,
    stateRegistration: data.stateRegistration || null,
    phone: data.phone || null,
    whatsapp: data.whatsapp || null,
    email: data.email || null,
    address: data.address || null,
    city: data.city || null,
    state: data.state || null,
    zipCode: data.zipCode || null,
    profile: data.profile ?? "OUTROS",
    notes: data.notes || null,
    ownerId: data.ownerId || req.user!.id,
  });
  await logAudit({ entityType: "Customer", entityId: id, action: "CREATE", summary: `Cliente ${code} criado: ${data.name}`, userId: req.user!.id });

  const [created] = await db.select().from(customers).where(eq(customers.id, id));
  res.status(201).json({ customer: created, possibleDuplicates: similar.filter((s) => s.id !== id).map((s) => ({ id: s.id, name: s.name, code: s.code })) });
});

customersRouter.put("/:id", async (req, res) => {
  const data = customerSchema.partial().parse(req.body);
  const [existing] = await db.select().from(customers).where(eq(customers.id, req.params.id));
  if (!existing) throw new AppError("Cliente não encontrado.", 404);

  const document = data.document !== undefined ? onlyDigits(data.document) : undefined;
  if (document) {
    const [dup] = await db.select().from(customers).where(and(eq(customers.document, document), sql`${customers.id} != ${existing.id}`));
    if (dup) throw new AppError(`CPF/CNPJ já pertence a outro cliente: ${dup.name} (${dup.code}).`, 409);
  }

  const changes: Record<string, { de: unknown; para: unknown }> = {};
  for (const key of Object.keys(data) as (keyof typeof data)[]) {
    const newVal = key === "document" ? document : (data as any)[key];
    const oldVal = (existing as any)[key];
    if (newVal !== undefined && newVal !== oldVal) changes[key] = { de: oldVal, para: newVal };
  }

  await db
    .update(customers)
    .set({ ...data, document: document ?? existing.document, updatedAt: new Date() })
    .where(eq(customers.id, existing.id));

  if (Object.keys(changes).length) {
    await logAudit({ entityType: "Customer", entityId: existing.id, action: "UPDATE", summary: `Cliente ${existing.code} atualizado`, changes, userId: req.user!.id });
  }
  const [updated] = await db.select().from(customers).where(eq(customers.id, existing.id));
  res.json(updated);
});

// Contatos
const contactSchema = z.object({
  name: z.string().min(2),
  role: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  whatsapp: z.string().optional().nullable(),
  email: z.string().optional().nullable(),
  isPrimary: z.boolean().optional(),
});

customersRouter.post("/:id/contacts", async (req, res) => {
  const data = contactSchema.parse(req.body);
  const [customer] = await db.select().from(customers).where(eq(customers.id, req.params.id));
  if (!customer) throw new AppError("Cliente não encontrado.", 404);
  const id = newId();
  await db.insert(customerContacts).values({ id, customerId: customer.id, ...data, role: data.role || null, phone: data.phone || null, whatsapp: data.whatsapp || null, email: data.email || null });
  const [created] = await db.select().from(customerContacts).where(eq(customerContacts.id, id));
  res.status(201).json(created);
});
