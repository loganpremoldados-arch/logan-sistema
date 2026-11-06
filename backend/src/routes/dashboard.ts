import { Router } from "express";
import { db } from "../db/client";
import {
  opportunities, orders, orderItems, productionRecords, commercialActivities, proposals,
  inventoryItems, products, customers, salesChannels,
} from "../db/schema";
import { and, eq, gte, lte, sql } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";
import { computeOrderDeadline } from "../services/deadline";

const STAGE_LABELS: Record<string, string> = {
  NOVO_CONTATO: "Novo contato",
  QUALIFICACAO: "Qualificação",
  LEVANTAMENTO_NECESSIDADE: "Levantamento",
  ELABORACAO_ORCAMENTO: "Elaborando orçamento",
  PROPOSTA_ENVIADA: "Proposta enviada",
  EM_NEGOCIACAO: "Em negociação",
  AGUARDANDO_DECISAO: "Aguardando decisão",
  FECHADA: "Fechada (ganha)",
  PERDIDA: "Perdida",
  SUSPENSA: "Suspensa",
};
const FUNNEL_STAGES = [
  "NOVO_CONTATO", "QUALIFICACAO", "LEVANTAMENTO_NECESSIDADE", "ELABORACAO_ORCAMENTO",
  "PROPOSTA_ENVIADA", "EM_NEGOCIACAO", "AGUARDANDO_DECISAO", "FECHADA",
];
const OP_STATUS_LABELS: Record<string, string> = {
  AGUARDANDO_LIBERACAO: "Aguard. liberação",
  AGUARDANDO_PROGRAMACAO: "Aguard. programação",
  AGUARDANDO_MATERIA_PRIMA: "Aguard. matéria-prima",
  AGUARDANDO_FORMAS: "Aguard. formas",
  NA_FILA_PRODUCAO: "Na fila de produção",
  EM_FABRICACAO: "Em fabricação",
  EM_CURA: "Em cura",
  EM_ACABAMENTO: "Em acabamento",
  PRONTO_PARA_SEPARACAO: "Pronto p/ separação",
  EM_SEPARACAO: "Em separação",
  PARCIALMENTE_ENTREGUE: "Parcialmente entregue",
  ENTREGUE_INTEGRALMENTE: "Entregue integralmente",
};

function monthKey(d: Date) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; }
const MONTH_ABBR = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
function monthLabel(key: string) {
  const [y, m] = key.split("-").map(Number);
  return `${MONTH_ABBR[m - 1]}/${String(y).slice(2)}`;
}
function lastNMonthKeys(n: number): string[] {
  const now = new Date();
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) out.push(monthKey(new Date(now.getFullYear(), now.getMonth() - i, 1)));
  return out;
}

export const dashboardRouter = Router();
dashboardRouter.use(requireAuth);

function parsePeriod(req: any): { from: Date; to: Date } {
  const now = new Date();
  const to = req.query.to ? new Date(req.query.to) : now;
  const from = req.query.from ? new Date(req.query.from) : new Date(now.getFullYear(), now.getMonth(), 1);
  return { from, to };
}

dashboardRouter.get("/summary", async (req, res) => {
  const { from, to } = parsePeriod(req);

  const allOpportunities = await db.select().from(opportunities);
  const periodOpportunities = allOpportunities.filter((o) => o.entryDate >= from && o.entryDate <= to);
  const openOpportunities = allOpportunities.filter((o) => !["FECHADA", "PERDIDA"].includes(o.stage));
  const closedInPeriod = periodOpportunities.filter((o) => o.stage === "FECHADA");
  const lostInPeriod = periodOpportunities.filter((o) => o.stage === "PERDIDA");
  const decided = closedInPeriod.length + lostInPeriod.length;
  const conversionRate = decided > 0 ? Math.round((closedInPeriod.length / decided) * 10000) / 100 : null;
  const pipelineValue = openOpportunities.reduce((acc, o) => acc + Number(o.estimatedValue ?? 0), 0);
  const weightedPipeline = openOpportunities.reduce((acc, o) => acc + Number(o.estimatedValue ?? 0) * (o.probability / 100), 0);

  const allOrders = await db.select().from(orders);
  const activeOrders = allOrders.filter((o) => !["CANCELADO", "ENCERRADO"].includes(o.commercialStatus));
  const periodOrders = allOrders.filter((o) => o.closingDate >= from && o.closingDate <= to);
  const ordersWithDeadline = await Promise.all(activeOrders.map(async (o) => ({ o, d: await computeOrderDeadline(o.id, o.expectedDeliveryDate, o.operationalStatus) })));

  const salesValuePeriod = periodOrders.reduce((acc, o) => acc + Number(o.netValue), 0);
  const receivedPeriod = periodOrders.reduce((acc, o) => acc + Number(o.receivedValue), 0);

  const allItems = await db.select().from(orderItems);
  const plannedQty = allItems.reduce((acc, i) => acc + Number(i.quantityNeeded), 0);
  const producedQty = allItems.reduce((acc, i) => acc + Number(i.quantityApproved), 0);
  const pendingQty = Math.max(plannedQty - producedQty, 0);

  res.json({
    period: { from, to },
    comercial: {
      totalOpportunities: periodOpportunities.length,
      openOpportunities: openOpportunities.length,
      proposalsSent: allOpportunities.filter((o) => o.stage === "PROPOSTA_ENVIADA").length,
      negotiating: allOpportunities.filter((o) => ["EM_NEGOCIACAO", "AGUARDANDO_DECISAO"].includes(o.stage)).length,
      converted: closedInPeriod.length,
      conversionRate,
      pipelineValue: Math.round(pipelineValue * 100) / 100,
      weightedPipeline: Math.round(weightedPipeline * 100) / 100,
    },
    pedidos: {
      active: activeOrders.length,
      awaitingApproval: activeOrders.filter((o) => o.commercialStatus === "AGUARDANDO_APROVACAO").length,
      inProduction: activeOrders.filter((o) => o.operationalStatus === "EM_FABRICACAO").length,
      ready: activeOrders.filter((o) => o.operationalStatus === "PRONTO_PARA_SEPARACAO").length,
      partiallyDelivered: activeOrders.filter((o) => o.operationalStatus === "PARCIALMENTE_ENTREGUE").length,
      late: ordersWithDeadline.filter((x) => x.d.situation === "ATRASADO").length,
      atRisk: ordersWithDeadline.filter((x) => x.d.situation === "EM_RISCO_DE_ATRASO").length,
    },
    producao: {
      plannedQty: Math.round(plannedQty * 100) / 100,
      producedQty: Math.round(producedQty * 100) / 100,
      pendingQty: Math.round(pendingQty * 100) / 100,
      fulfillmentPct: plannedQty > 0 ? Math.round((producedQty / plannedQty) * 10000) / 100 : null,
    },
    financeiro: {
      soldValuePeriod: Math.round(salesValuePeriod * 100) / 100,
      receivedValuePeriod: Math.round(receivedPeriod * 100) / 100,
      receivableValue: Math.round((salesValuePeriod - receivedPeriod) * 100) / 100,
      overdueBalance: allOrders
        .filter((o) => o.financialStatus === "VENCIDO")
        .reduce((acc, o) => acc + (Number(o.netValue) - Number(o.receivedValue)), 0),
    },
  });
});

dashboardRouter.get("/attention", async (_req, res) => {
  const now = new Date();
  const allOpportunities = await db.select().from(opportunities);
  const open = allOpportunities.filter((o) => !["FECHADA", "PERDIDA"].includes(o.stage));

  const overdueFollowups = open.filter((o) => o.nextContactDate && o.nextContactDate < now);
  const proposalsNoReturn = open.filter((o) => o.stage === "PROPOSTA_ENVIADA" && (!o.nextContactDate || o.nextContactDate < now));

  const allOrders = await db.select().from(orders);
  const activeOrders = allOrders.filter((o) => !["CANCELADO", "ENCERRADO"].includes(o.commercialStatus));
  const withDeadline = await Promise.all(activeOrders.map(async (o) => ({ o, d: await computeOrderDeadline(o.id, o.expectedDeliveryDate, o.operationalStatus) })));
  const lateOrders = withDeadline.filter((x) => x.d.situation === "ATRASADO").map((x) => x.o);
  const atRiskOrders = withDeadline.filter((x) => x.d.situation === "EM_RISCO_DE_ATRASO").map((x) => x.o);
  const unscheduledOrders = activeOrders.filter((o) => o.operationalStatus === "AGUARDANDO_PROGRAMACAO" || (o.commercialStatus === "APROVADO" && o.operationalStatus === "AGUARDANDO_LIBERACAO"));
  const readyAwaitingPickup = activeOrders.filter((o) => o.operationalStatus === "PRONTO_PARA_SEPARACAO");

  const inv = await db
    .select({ productId: inventoryItems.productId, physicalQty: inventoryItems.physicalQty, minimumQty: inventoryItems.minimumQty, productName: products.name })
    .from(inventoryItems)
    .leftJoin(products, eq(products.id, inventoryItems.productId));
  const lowStock = inv.filter((i) => Number(i.minimumQty) > 0 && Number(i.physicalQty) < Number(i.minimumQty));

  const overdueFinancial = allOrders.filter((o) => o.financialStatus === "VENCIDO");

  const incompleteCustomers = await db.select().from(customers);
  const incomplete = incompleteCustomers.filter((c) => !c.document || !c.phone);

  res.json({
    overdueFollowups: overdueFollowups.map((o) => ({ id: o.id, type: "OPORTUNIDADE", label: `${o.code} — follow-up vencido`, link: `/comercial/oportunidades/${o.id}` })),
    proposalsNoReturn: proposalsNoReturn.map((o) => ({ id: o.id, type: "OPORTUNIDADE", label: `${o.code} — proposta sem retorno`, link: `/comercial/oportunidades/${o.id}` })),
    lateOrders: lateOrders.map((o) => ({ id: o.id, type: "PEDIDO", label: `Pedido ${o.number} — atrasado`, link: `/pedidos/${o.id}` })),
    atRiskOrders: atRiskOrders.map((o) => ({ id: o.id, type: "PEDIDO", label: `Pedido ${o.number} — risco de atraso`, link: `/pedidos/${o.id}` })),
    unscheduledOrders: unscheduledOrders.map((o) => ({ id: o.id, type: "PEDIDO", label: `Pedido ${o.number} — sem programação de produção`, link: `/pedidos/${o.id}` })),
    readyAwaitingPickup: readyAwaitingPickup.map((o) => ({ id: o.id, type: "PEDIDO", label: `Pedido ${o.number} — pronto aguardando retirada/entrega`, link: `/pedidos/${o.id}` })),
    lowStock: lowStock.map((i) => ({ id: i.productId, type: "ESTOQUE", label: `${i.productName} — estoque abaixo do mínimo`, link: `/estoque` })),
    overdueFinancial: overdueFinancial.map((o) => ({ id: o.id, type: "FINANCEIRO", label: `Pedido ${o.number} — pagamento vencido`, link: `/pedidos/${o.id}` })),
    incompleteRecords: incomplete.map((c) => ({ id: c.id, type: "CLIENTE", label: `${c.name} — cadastro incompleto`, link: `/clientes/${c.id}` })),
  });
});

dashboardRouter.get("/today", async (_req, res) => {
  const today = new Date();
  const start = new Date(today); start.setHours(0, 0, 0, 0);
  const end = new Date(today); end.setHours(23, 59, 59, 999);

  const todayRecords = await db.select().from(productionRecords).where(and(gte(productionRecords.date, start), lte(productionRecords.date, end)));
  const queueItems = await db
    .select({ item: orderItems })
    .from(orderItems)
    .where(sql`${orderItems.quantityNeeded} > ${orderItems.quantityApproved}`);
  const todayActivities = await db.select().from(commercialActivities).where(and(gte(commercialActivities.nextContactAt, start), lte(commercialActivities.nextContactAt, end)));
  const todayFollowups = await db.select().from(opportunities).where(and(gte(opportunities.nextContactDate, start), lte(opportunities.nextContactDate, end)));

  res.json({
    producedToday: todayRecords.reduce((acc, r) => acc + Number(r.quantityApproved), 0),
    expectedToday: queueItems.length,
    followupsToday: todayFollowups.length,
    activitiesToday: todayActivities.length,
  });
});

dashboardRouter.get("/charts", async (_req, res) => {
  const months = lastNMonthKeys(6);
  const monthRows = months.map((key) => ({ key, label: monthLabel(key) }));

  // Evolução de vendas (pedidos fechados por mês, valor líquido)
  const allOrders = await db.select().from(orders);
  const salesByMonth = monthRows.map(({ key, label }) => ({
    month: label,
    valor: Math.round(
      allOrders
        .filter((o) => monthKey(new Date(o.closingDate)) === key && !["CANCELADO"].includes(o.commercialStatus))
        .reduce((acc, o) => acc + Number(o.netValue), 0) * 100,
    ) / 100,
  }));

  // Evolução de oportunidades recebidas por mês
  const allOpportunities = await db.select().from(opportunities);
  const opportunitiesByMonth = monthRows.map(({ key, label }) => ({
    month: label,
    quantidade: allOpportunities.filter((o) => monthKey(new Date(o.entryDate)) === key).length,
  }));

  // Funil comercial — oportunidades abertas (ou fechadas no período) por etapa
  const funnelByStage = FUNNEL_STAGES.map((stage) => ({
    etapa: STAGE_LABELS[stage],
    quantidade: allOpportunities.filter((o) => o.stage === stage).length,
  }));

  // Pedidos por situação operacional (apenas pedidos ativos)
  const activeOrders = allOrders.filter((o) => !["CANCELADO", "ENCERRADO"].includes(o.commercialStatus));
  const statusCounts = new Map<string, number>();
  for (const o of activeOrders) statusCounts.set(o.operationalStatus, (statusCounts.get(o.operationalStatus) ?? 0) + 1);
  const ordersByStatus = Array.from(statusCounts.entries())
    .map(([status, quantidade]) => ({ situacao: OP_STATUS_LABELS[status] ?? status, quantidade }))
    .sort((a, b) => b.quantidade - a.quantidade);

  // Produção realizada por mês (quantidade aprovada apontada)
  const allItems = await db.select().from(orderItems);
  const allRecords = await db.select().from(productionRecords);
  const producedByMonth = monthRows.map(({ key, label }) => ({
    month: label,
    produzido: Math.round(
      allRecords.filter((r) => monthKey(new Date(r.date)) === key).reduce((acc, r) => acc + Number(r.quantityApproved), 0) * 100,
    ) / 100,
  }));
  // Planejado × Realizado (visão acumulada da carteira atual — não há data planejada por item para comparação mensal confiável)
  const totalNeeded = Math.round(allItems.reduce((acc, i) => acc + Number(i.quantityNeeded), 0) * 100) / 100;
  const totalApproved = Math.round(allItems.reduce((acc, i) => acc + Number(i.quantityApproved), 0) * 100) / 100;

  // Produção por produto (top 10, quantidade aprovada acumulada)
  const prodByProduct = new Map<string, number>();
  for (const r of allRecords) prodByProduct.set(r.productId, (prodByProduct.get(r.productId) ?? 0) + Number(r.quantityApproved));
  const allProducts = await db.select().from(products);
  const productNameById = new Map(allProducts.map((p) => [p.id, p.name]));
  const productionByProduct = Array.from(prodByProduct.entries())
    .map(([productId, quantidade]) => ({ produto: productNameById.get(productId) ?? "—", quantidade: Math.round(quantidade * 100) / 100 }))
    .filter((p) => p.quantidade > 0)
    .sort((a, b) => b.quantidade - a.quantidade)
    .slice(0, 10);

  // Vendas por canal (oportunidades fechadas, valor de proposta/estimado)
  const allChannels = await db.select().from(salesChannels);
  const channelNameById = new Map(allChannels.map((c) => [c.id, c.name]));
  const wonOpportunities = allOpportunities.filter((o) => o.stage === "FECHADA");
  const byChannel = new Map<string, number>();
  for (const o of wonOpportunities) {
    const name = o.channelId ? channelNameById.get(o.channelId) ?? "Não informado" : "Não informado";
    const value = Number(o.proposalValue ?? o.estimatedValue ?? 0);
    byChannel.set(name, (byChannel.get(name) ?? 0) + value);
  }
  const salesByChannel = Array.from(byChannel.entries())
    .map(([canal, valor]) => ({ canal, valor: Math.round(valor * 100) / 100 }))
    .sort((a, b) => b.valor - a.valor);

  res.json({
    salesByMonth,
    opportunitiesByMonth,
    funnelByStage,
    ordersByStatus,
    producedByMonth,
    plannedVsProducedTotals: { planejado: totalNeeded, produzido: totalApproved },
    productionByProduct,
    salesByChannel,
  });
});
