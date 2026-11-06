import { db } from "../db/client";
import { customers, opportunities, proposals, orders } from "../db/schema";
import { sql } from "drizzle-orm";

/** Gera o próximo código sequencial no formato PREFIXO-0001, olhando o maior já existente. */
async function nextSequential(table: "customers" | "proposals" | "orders", prefix: string, pad = 4): Promise<string> {
  let max = 0;
  if (table === "customers") {
    const rows = await db.select({ code: customers.code }).from(customers);
    for (const r of rows) {
      const n = parseInt(r.code.replace(prefix + "-", ""), 10);
      if (!isNaN(n) && n > max) max = n;
    }
  } else if (table === "proposals") {
    const rows = await db.select({ code: proposals.number }).from(proposals);
    for (const r of rows) {
      const n = parseInt(r.code?.replace(prefix + "-", "") ?? "", 10);
      if (!isNaN(n) && n > max) max = n;
    }
  } else if (table === "orders") {
    const rows = await db.select({ code: orders.number }).from(orders);
    for (const r of rows) {
      const n = parseInt(r.code?.replace(prefix + "-", "") ?? "", 10);
      if (!isNaN(n) && n > max) max = n;
    }
  }
  return `${prefix}-${String(max + 1).padStart(pad, "0")}`;
}

export async function nextCustomerCode(): Promise<string> {
  return nextSequential("customers", "CLI");
}

export async function nextProposalNumber(): Promise<string> {
  return nextSequential("proposals", "PRO");
}

export async function nextOrderNumber(): Promise<string> {
  return nextSequential("orders", "P");
}

/** Código de oportunidade: AAAAMMDD-NNN (reinicia a sequência por dia, como na planilha original). */
export async function nextOpportunityCode(date: Date): Promise<string> {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const datePrefix = `${y}${m}${d}`;
  const rows = await db
    .select({ code: opportunities.code })
    .from(opportunities)
    .where(sql`${opportunities.code} LIKE ${datePrefix + "-%"}`);
  let max = 0;
  for (const r of rows) {
    const n = parseInt(r.code.split("-")[1] ?? "", 10);
    if (!isNaN(n) && n > max) max = n;
  }
  return `${datePrefix}-${String(max + 1).padStart(3, "0")}`;
}
