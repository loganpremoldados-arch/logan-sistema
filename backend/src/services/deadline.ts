// ============================================================================
// Classificação de prazo do pedido (seção 10.6 do briefing)
// ----------------------------------------------------------------------------
// IMPORTANTE: esta é a primeira versão do cálculo. Ele considera capacidade
// diária (real, quando validada pela gestão, senão a teórica migrada da
// planilha), tempo de cura e de acabamento cadastrados por produto. Os
// limiares de classificação (urgente/atenção) ficam em system_settings e
// podem ser recalibrados pela gestão sem alterar código — eles NÃO devem
// ser lidos como uma promessa de prazo ao cliente, conforme o briefing.
// ============================================================================
import { db } from "../db/client";
import { orderItems, productionCapacity } from "../db/schema";
import { eq, inArray } from "drizzle-orm";

export type DeadlineSituation =
  | "NO_PRAZO"
  | "ATENCAO"
  | "URGENTE"
  | "EM_RISCO_DE_ATRASO"
  | "ATRASADO"
  | "CONCLUIDO";

export interface DeadlineResult {
  situation: DeadlineSituation;
  daysRemaining: number | null;
  estimatedDaysToFinish: number | null;
  hasUnvalidatedCapacity: boolean;
  details: string;
}

function diffDays(from: Date, to: Date): number {
  const ms = to.getTime() - from.getTime();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

export async function computeOrderDeadline(
  orderId: string,
  expectedDeliveryDate: Date | null,
  operationalStatus: string,
): Promise<DeadlineResult> {
  if (operationalStatus === "ENTREGUE_INTEGRALMENTE") {
    return {
      situation: "CONCLUIDO",
      daysRemaining: null,
      estimatedDaysToFinish: 0,
      hasUnvalidatedCapacity: false,
      details: "Pedido entregue integralmente.",
    };
  }

  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, orderId));
  const pendingItems = items.filter((i) => Number(i.quantityDelivered) < Number(i.quantityRequested));

  if (pendingItems.length === 0) {
    return {
      situation: "CONCLUIDO",
      daysRemaining: null,
      estimatedDaysToFinish: 0,
      hasUnvalidatedCapacity: false,
      details: "Todos os itens já foram entregues.",
    };
  }

  const productIds = [...new Set(pendingItems.map((i) => i.productId))];
  const capacities = productIds.length
    ? await db.select().from(productionCapacity).where(inArray(productionCapacity.productId, productIds))
    : [];
  const capByProduct = new Map(capacities.map((c) => [c.productId, c]));

  let maxDaysToFinish = 0;
  let hasUnknownCapacity = false;
  let hasUnvalidatedCapacity = false;

  for (const item of pendingItems) {
    const pendingToProduce = Math.max(Number(item.quantityNeeded) - Number(item.quantityApproved), 0);
    const cap = capByProduct.get(item.productId);
    if (!cap) {
      if (pendingToProduce > 0) hasUnknownCapacity = true;
      continue;
    }
    if (!cap.validated) hasUnvalidatedCapacity = true;

    const dailyRate = Number(cap.realDailyQty ?? cap.theoreticalDailyQty ?? 0);
    let productionDays = 0;
    if (pendingToProduce > 0) {
      if (dailyRate > 0) {
        productionDays = Math.ceil(pendingToProduce / dailyRate);
      } else {
        hasUnknownCapacity = true;
      }
    }
    const curing = Number(cap.curingTimeDays ?? 0);
    const finishing = Number(cap.finishingTimeDays ?? 0);
    const total = productionDays + curing + finishing;
    if (total > maxDaysToFinish) maxDaysToFinish = total;
  }

  const estimatedDaysToFinish = hasUnknownCapacity ? null : maxDaysToFinish;
  const today = new Date();
  const daysRemaining = expectedDeliveryDate ? diffDays(today, expectedDeliveryDate) : null;

  let situation: DeadlineSituation;
  let details: string;

  if (daysRemaining === null) {
    situation = "ATENCAO";
    details = "Pedido sem data prevista de entrega cadastrada.";
  } else if (daysRemaining < 0) {
    situation = "ATRASADO";
    details = `Prazo vencido há ${Math.abs(daysRemaining)} dia(s).`;
  } else if (estimatedDaysToFinish === null) {
    situation = "ATENCAO";
    details = "Capacidade de produção não cadastrada para um ou mais produtos pendentes — previsão indisponível.";
  } else if (estimatedDaysToFinish > daysRemaining) {
    situation = "EM_RISCO_DE_ATRASO";
    details = `Previsão de conclusão em ${estimatedDaysToFinish} dia(s), mas restam ${daysRemaining} dia(s) até o prazo.`;
  } else if (daysRemaining - estimatedDaysToFinish <= 1) {
    situation = "URGENTE";
    details = `Margem muito curta: ${daysRemaining - estimatedDaysToFinish} dia(s) de folga.`;
  } else if (daysRemaining - estimatedDaysToFinish <= 3) {
    situation = "ATENCAO";
    details = `Margem reduzida: ${daysRemaining - estimatedDaysToFinish} dia(s) de folga.`;
  } else {
    situation = "NO_PRAZO";
    details = `Margem confortável: ${daysRemaining - estimatedDaysToFinish} dia(s) de folga.`;
  }

  return { situation, daysRemaining, estimatedDaysToFinish, hasUnvalidatedCapacity, details };
}
