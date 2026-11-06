import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "../db/client";
import { users } from "../db/schema";
import { eq } from "drizzle-orm";
import { signToken, requireAuth } from "../middleware/auth";
import { AppError } from "../middleware/errorHandler";

export const authRouter = Router();

const loginSchema = z.object({
  email: z.string().email("informe um e-mail válido"),
  password: z.string().min(1, "informe a senha"),
});

authRouter.post("/login", async (req, res) => {
  const { email, password } = loginSchema.parse(req.body);
  const [user] = await db.select().from(users).where(eq(users.email, email.toLowerCase()));
  if (!user || !user.active) {
    throw new AppError("E-mail ou senha incorretos.", 401);
  }
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    throw new AppError("E-mail ou senha incorretos.", 401);
  }
  const token = signToken({ id: user.id, name: user.name, email: user.email, role: user.role });
  res.json({
    token,
    user: { id: user.id, name: user.name, email: user.email, role: user.role, mustResetPwd: user.mustResetPwd },
  });
});

authRouter.get("/me", requireAuth, async (req, res) => {
  res.json({ user: req.user });
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(6, "a nova senha deve ter ao menos 6 caracteres"),
});

authRouter.post("/change-password", requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);
  const [user] = await db.select().from(users).where(eq(users.id, req.user!.id));
  if (!user) throw new AppError("Usuário não encontrado.", 404);
  const ok = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!ok) throw new AppError("Senha atual incorreta.", 400);
  const passwordHash = await bcrypt.hash(newPassword, 10);
  await db.update(users).set({ passwordHash, mustResetPwd: false, updatedAt: new Date() }).where(eq(users.id, user.id));
  res.json({ ok: true });
});
