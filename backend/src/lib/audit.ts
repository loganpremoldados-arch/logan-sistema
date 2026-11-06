import { db } from "../db/client";
import { auditLogs } from "../db/schema";
import { newId } from "./ids";

export async function logAudit(params: {
  entityType: string;
  entityId: string;
  action: string;
  summary: string;
  changes?: Record<string, { de: unknown; para: unknown }>;
  userId?: string | null;
}) {
  await db.insert(auditLogs).values({
    id: newId(),
    entityType: params.entityType,
    entityId: params.entityId,
    action: params.action,
    summary: params.summary,
    changes: params.changes ?? null,
    userId: params.userId ?? null,
  });
}
