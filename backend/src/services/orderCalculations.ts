// ============================================================================
// Regras de cálculo do Pedido (seção 10.3 do briefing)
// ============================================================================
import { db } from "../db/client";
import { orderItems, orders, inventoryItems } from "../db/schema";
import { eq } from "drizzle-orm";

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

export interface ItemCalcInput {
  quantityRequested: number;
  unitPrice: number;
  discount: number;
  quantityReserved: number;
  quantityApproved: number;
  quantityDelivered: number;
}

export interface ItemCalcOutput {
  totalValue: number;
  quantityNeeded: number; // necessário produzir = solicitado - disponível (reservado cobre parte)
  pendingToProduce: number; // necessário produzir - aprovado
  pendingToDeliver: number; // solicitado - entregue
  percentProduced: number; // aprovado / necessário * 100 (100 se não precisa produzir)
  percentDelivered: number; // entregue / solicitado * 100
}

/**
 * Calcula os totais e saldos de um item de pedido.
 * "Necessário produzir" considera o quanto já está reservado do estoque:
 * se a reserva cobre o solicitado, a necessidade de produção é zero.
 */
export function calcOrderItem(input: ItemCalcInput): ItemCalcOutput {
  const totalValue = round2(input.quantityRequested * input.unitPrice - input.discount);
  const quantityNeeded = Math.max(round3(input.quantityRequested - input.quantityReserved), 0);
  const pendingToProduce = Math.max(round3(quantityNeeded - input.quantityApproved), 0);
  const pendingToDeliver = Math.max(round3(input.quantityRequested - input.quantityDelivered), 0);
  const percentProduced = quantityNeeded > 0
    ? round2((input.quantityApproved / quantityNeeded) * 100)
    : 100;
  const percentDelivered = input.quantityRequested > 0
    ? round2((input.quantityDelivered / input.quantityRequested) * 100)
    : 0;
  return { totalValue, quantityNeeded, pendingToProduce, pendingToDeliver, percentProduced, percentDelivered };
}

/** Recalcula e persiste os totais do pedido a partir dos itens atuais no banco. */
export async function recalcOrderTotals(orderId: string) {
  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, orderId));
  let gross = 0;
  let discount = 0;
  for (const it of items) {
    gross += Number(it.quantityRequested) * Number(it.unitPrice);
    discount += Number(it.discount);
  }
  const net = round2(gross - discount);
  await db
    .update(orders)
    .set({ grossValue: String(round2(gross)), discountValue: String(round2(discount)), netValue: String(net), updatedAt: new Date() })
    .where(eq(orders.id, orderId));
}

/**
 * Reserva estoque disponível para um item de pedido no momento da aprovação comercial.
 * Não permite reservar além do disponível, e nunca reserva a mesma quantidade física
 * para dois pedidos (a coluna reservedQty é incrementada atomicamente).
 */
export async function reserveAvailableStock(productId: string, desiredQty: number): Promise<number> {
  const [inv] = await db.select().from(inventoryItems).where(eq(inventoryItems.productId, productId));
  if (!inv) return 0;
  const available = Number(inv.physicalQty) - Number(inv.reservedQty) - Number(inv.inspectionQty) - Number(inv.rejectedQty);
  const toReserve = Math.max(0, Math.min(available, desiredQty));
  if (toReserve > 0) {
    await db
      .update(inventoryItems)
      .set({ reservedQty: String(round3(Number(inv.reservedQty) + toReserve)), updatedAt: new Date() })
      .where(eq(inventoryItems.productId, productId));
  }
  return toReserve;
}
