import { Router } from "express";
import { z } from "zod";
import { db } from "../db/client";
import { migrationIssues } from "../db/schema";
import { desc, eq } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";
import { logAudit } from "../lib/audit";
import { AppError } from "../middleware/errorHandler";

export const migrationRouter = Router();
migrationRouter.use(requireAuth);

migrationRouter.get("/issues", async (req, res) => {
  const status = req.query.status as string | undefined;
  const rows = await db
    .select()
    .from(migrationIssues)
    .where(status ? eq(migrationIssues.status, status as any) : undefined)
    .orderBy(desc(migrationIssues.createdAt));
  res.json(rows);
});

migrationRouter.get("/summary", async (_req, res) => {
  const all = await db.select().from(migrationIssues);
  const bySourceAndStatus: Record<string, Record<string, number>> = {};
  for (const i of all) {
    bySourceAndStatus[i.sourceFile] ??= {};
    bySourceAndStatus[i.sourceFile][i.status] = (bySourceAndStatus[i.sourceFile][i.status] ?? 0) + 1;
  }
  res.json({ total: all.length, pending: all.filter((i) => i.status === "PENDENTE").length, bySourceAndStatus });
});

const resolveSchema = z.object({
  status: z.enum(["APROVADO", "IGNORADO", "REPROCESSAR"]),
  resolutionNote: z.string().optional().nullable(),
});

migrationRouter.post("/issues/:id/resolve", async (req, res) => {
  const data = resolveSchema.parse(req.body);
  const [issue] = await db.select().from(migrationIssues).where(eq(migrationIssues.id, req.params.id));
  if (!issue) throw new AppError("Registro de validação não encontrado.", 404);

  await db.update(migrationIssues).set({
    status: data.status, resolvedById: req.user!.id, resolvedAt: new Date(), resolutionNote: data.resolutionNote || null,
  }).where(eq(migrationIssues.id, issue.id));

  await logAudit({
    entityType: "MigrationIssue", entityId: issue.id, action: "RESOLVE",
    summary: `Pendência de migração (${issue.issueType}) marcada como ${data.status}`,
    userId: req.user!.id,
  });
  res.json({ ok: true });
});
