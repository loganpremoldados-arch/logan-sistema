// ============================================================================
// Backfill de estoque a partir de dados já migrados (produção e entregas).
//
// O script de migração (migrar-planilhas.ts) insere os registros históricos de
// produção e os pedidos diretamente no banco, sem passar pela mesma lógica de
// negócio usada no fluxo ao vivo (rotas de produção/pedidos), que é quem
// incrementa o estoque físico e as reservas. Resultado: os itens migrados
// ficavam com produção e entregas registradas, mas o módulo de Estoque
// mostrava tudo zerado — inconsistente com o que o próprio sistema já sabe.
//
// Este script aplica, uma única vez, as MESMAS regras do fluxo ao vivo sobre
// os dados já existentes no banco (não inventa nenhuma quantidade nova):
//   físico  = soma(produção aprovada)  − soma(quantidade entregue)
//   reservado = soma(quantidade reservada em pedidos ainda ativos e não
//               totalmente entregues)
// e registra os movimentos de estoque correspondentes (ENTRADA_PRODUCAO /
// SAIDA_ENTREGA) para manter o histórico rastreável.
//
// Idempotente: pode ser executado novamente após um reprocessamento da
// migração (zera e recalcula a partir do estado atual das tabelas).
// ============================================================================
import "dotenv/config";
import { db, pool } from "../db/client";
import { inventoryItems, inventoryMovements, orderItems, orders, productionRecords, products } from "../db/schema";
import { eq } from "drizzle-orm";
import { newId } from "../lib/ids";

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

async function main() {
  console.log("Iniciando backfill de estoque a partir de produção e entregas já registradas...");

  const allProducts = await db.select().from(products);
  const allProduction = await db.select().from(productionRecords);
  const allItems = await db.select().from(orderItems);
  const allOrders = await db.select().from(orders);
  const orderById = new Map(allOrders.map((o) => [o.id, o]));

  // Limpa movimentos gerados por uma execução anterior deste script (idempotência)
  await pool.query(`DELETE FROM inventory_movements WHERE reference LIKE 'Backfill migração%'`);

  let touched = 0;
  for (const product of allProducts) {
    const produced = allProduction
      .filter((r) => r.productId === product.id)
      .reduce((acc, r) => acc + Number(r.quantityApproved), 0);

    const itemsForProduct = allItems.filter((i) => i.productId === product.id);
    const delivered = itemsForProduct.reduce((acc, i) => acc + Number(i.quantityDelivered), 0);

    const reserved = itemsForProduct.reduce((acc, i) => {
      const order = orderById.get(i.orderId);
      if (!order) return acc;
      const active = !["CANCELADO", "ENCERRADO"].includes(order.commercialStatus);
      const pendingDelivery = Number(i.quantityDelivered) < Number(i.quantityRequested);
      if (active && pendingDelivery) return acc + Number(i.quantityReserved);
      return acc;
    }, 0);

    const physicalQty = Math.max(0, round3(produced - delivered));
    const reservedQty = Math.max(0, Math.min(physicalQty, round3(reserved)));

    if (produced === 0 && delivered === 0) continue; // nada a registrar para este produto

    await db
      .update(inventoryItems)
      .set({ physicalQty: String(physicalQty), reservedQty: String(reservedQty), updatedAt: new Date() })
      .where(eq(inventoryItems.productId, product.id));

    if (produced > 0) {
      await db.insert(inventoryMovements).values({
        id: newId(), productId: product.id, type: "ENTRADA_PRODUCAO", quantity: String(round3(produced)),
        reference: "Backfill migração — produção histórica aprovada",
        notes: `${allProduction.filter((r) => r.productId === product.id).length} apontamento(s) migrado(s) consolidado(s).`,
      });
    }
    if (delivered > 0) {
      await db.insert(inventoryMovements).values({
        id: newId(), productId: product.id, type: "SAIDA_ENTREGA", quantity: String(round3(delivered)),
        reference: "Backfill migração — entregas históricas registradas",
        notes: `${itemsForProduct.filter((i) => Number(i.quantityDelivered) > 0).length} item(ns) de pedido com entrega.`,
      });
    }
    touched++;
    console.log(`  ${product.code} (${product.name}): produzido=${produced} entregue=${delivered} -> físico=${physicalQty} reservado=${reservedQty}`);
  }

  console.log(`\nBackfill concluído. ${touched} produto(s) atualizados.`);
  await pool.end();
}

main().catch((err) => {
  console.error("Erro no backfill de estoque:", err);
  process.exit(1);
});
