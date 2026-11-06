import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "../db/client";
import { users } from "../db/schema";
import { eq } from "drizzle-orm";
import { requireAuth, requireRole } from "../middleware/auth";
import { newId } from "../lib/ids";
import { logAudit } from "../lib/audit";
import { AppError } from "../middleware/errorHandler";

export const usersRouter = Router();
usersRouter.use(requireAuth, requireRole("ADMINISTRADOR"));

usersRouter.get("/", async (_req, res) => {
  const rows = await db.select({
    id: users.id, name: users.name, email: users.email, role: users.role, active: users.active,
    mustResetPwd: users.mustResetPwd, createdAt: users.createdAt,
  }).from(users);
  res.json(rows);
});

const createSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  role: z.enum(["ADMINISTRADOR", "GESTAO", "COMERCIAL", "PRODUCAO", "EXPEDICAO", "FINANCEIRO"]),
  password: z.string().min(6),
});

usersRouter.post("/", async (req, res) => {
  const data = createSchema.parse(req.body);
  const email = data.email.toLowerCase();
  const [dup] = await db.select().from(users).where(eq(users.email, email));
  if (dup) throw new AppError("Já existe um usuário com este e-mail.", 409);

  const passwordHash = await bcrypt.hash(data.password, 10);
  const id = newId();
  await db.insert(users).values({ id, name: data.name, email, role: data.role, passwordHash, mustResetPwd: true });
  await logAudit({ entityType: "User", entityId: id, action: "CREATE", summary: `Usuário ${data.name} (${data.role}) criado`, userId: req.user!.id });
  res.status(201).json({ id, name: data.name, email, role: data.role });
});

const updateSchema = z.object({
  name: z.string().min(2).optional(),
  role: z.enum(["ADMINISTRADOR", "GESTAO", "COMERCIAL", "PRODUCAO", "EXPEDICAO", "FINANCEIRO"]).optional(),
  active: z.boolean().optional(),
});

usersRouter.put("/:id", async (req, res) => {
  const data = updateSchema.parse(req.body);
  const [existing] = await db.select().from(users).where(eq(users.id, req.params.id));
  if (!existing) throw new AppError("Usuário não encontrado.", 404);
  await db.update(users).set({ ...data, updatedAt: new Date() }).where(eq(users.id, existing.id));
  await logAudit({ entityType: "User", entityId: existing.id, action: "UPDATE", summary: `Usuário ${existing.name} atualizado`, userId: req.user!.id });
  res.json({ ok: true });
});

usersRouter.post("/:id/reset-password", async (req, res) => {
  const data = z.object({ newPassword: z.string().min(6) }).parse(req.body);
  const [existing] = await db.select().from(users).where(eq(users.id, req.params.id));
  if (!existing) throw new AppError("Usuário não encontrado.", 404);
  const passwordHash = await bcrypt.hash(data.newPassword, 10);
  await db.update(users).set({ passwordHash, mustResetPwd: true, updatedAt: new Date() }).where(eq(users.id, existing.id));
  await logAudit({ entityType: "User", entityId: existing.id, action: "RESET_PASSWORD", summary: `Senha de ${existing.name} redefinida pelo administrador`, userId: req.user!.id });
  res.json({ ok: true });
});
