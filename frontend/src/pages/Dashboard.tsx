import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useFetch } from "../lib/useApi";
import { StatCard } from "../components/StatCard";
import { formatBRL, formatQty } from "../lib/format";
import { SimpleBarChart, TrendLineChart, TwoSeriesBarChart, CategoricalBarChart, COLORS } from "../components/Charts";

interface Summary {
  period: { from: string; to: string };
  comercial: Record<string, number | null>;
  pedidos: Record<string, number>;
  producao: Record<string, number | null>;
  financeiro: Record<string, number>;
}
interface AttentionItem { id: string; type: string; label: string; link: string }
interface Attention {
  overdueFollowups: AttentionItem[]; proposalsNoReturn: AttentionItem[]; lateOrders: AttentionItem[];
  atRiskOrders: AttentionItem[]; unscheduledOrders: AttentionItem[]; readyAwaitingPickup: AttentionItem[];
  lowStock: AttentionItem[]; overdueFinancial: AttentionItem[]; incompleteRecords: AttentionItem[];
}
interface Today { producedToday: number; expectedToday: number; followupsToday: number; activitiesToday: number }
interface Charts {
  salesByMonth: { month: string; valor: number }[];
  opportunitiesByMonth: { month: string; quantidade: number }[];
  funnelByStage: { etapa: string; quantidade: number }[];
  ordersByStatus: { situacao: string; quantidade: number }[];
  producedByMonth: { month: string; produzido: number }[];
  plannedVsProducedTotals: { planejado: number; produzido: number };
  productionByProduct: { produto: string; quantidade: number }[];
  salesByChannel: { canal: string; valor: number }[];
}

const PERIODS = [
  { key: "hoje", label: "Hoje" },
  { key: "semana", label: "Esta semana" },
  { key: "mes", label: "Este mês" },
  { key: "mes_anterior", label: "Mês anterior" },
  { key: "30d", label: "Últimos 30 dias" },
  { key: "90d", label: "Últimos 90 dias" },
  { key: "ano", label: "Este ano" },
];

function rangeFor(key: string): { from: Date; to: Date } {
  const now = new Date();
  const to = new Date(now);
  let from = new Date(now);
  if (key === "hoje") from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  else if (key === "semana") { from = new Date(now); from.setDate(now.getDate() - now.getDay()); }
  else if (key === "mes") from = new Date(now.getFullYear(), now.getMonth(), 1);
  else if (key === "mes_anterior") {
    from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return { from, to: new Date(now.getFullYear(), now.getMonth(), 0) };
  } else if (key === "30d") from = new Date(now.getTime() - 30 * 86400000);
  else if (key === "90d") from = new Date(now.getTime() - 90 * 86400000);
  else if (key === "ano") from = new Date(now.getFullYear(), 0, 1);
  return { from, to };
}

export function Dashboard() {
  const [period, setPeriod] = useState("mes");
  const navigate = useNavigate();
  const { from, to } = useMemo(() => rangeFor(period), [period]);
  const qs = `?from=${from.toISOString()}&to=${to.toISOString()}`;

  const { data: summary, loading } = useFetch<Summary>(`/dashboard/summary${qs}`, [qs]);
  const { data: attention } = useFetch<Attention>("/dashboard/attention");
  const { data: today } = useFetch<Today>("/dashboard/today");
  const { data: charts } = useFetch<Charts>("/dashboard/charts");

  const plannedVsProducedData = charts
    ? [{ label: "Carteira atual", planejado: charts.plannedVsProducedTotals.planejado, produzido: charts.plannedVsProducedTotals.produzido }]
    : [];

  const attentionItems: AttentionItem[] = attention
    ? [
        ...attention.overdueFollowups, ...attention.proposalsNoReturn, ...attention.lateOrders,
        ...attention.atRiskOrders, ...attention.unscheduledOrders, ...attention.readyAwaitingPickup,
        ...attention.lowStock, ...attention.overdueFinancial, ...attention.incompleteRecords,
      ]
    : [];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Visão Geral</h1>
          <div className="desc">Central de comando da Logan Pré-Moldados</div>
        </div>
        <div className="filters-bar" style={{ marginBottom: 0 }}>
          <select value={period} onChange={(e) => setPeriod(e.target.value)}>
            {PERIODS.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
          </select>
        </div>
      </div>

      {loading && <p>Carregando indicadores...</p>}

      {summary && (
        <>
          <div className="section-title">Comercial</div>
          <div className="stat-grid">
            <StatCard label="Oportunidades recebidas" value={summary.comercial.totalOpportunities ?? 0} />
            <StatCard label="Oportunidades abertas" value={summary.comercial.openOpportunities ?? 0} />
            <StatCard label="Propostas enviadas" value={summary.comercial.proposalsSent ?? 0} />
            <StatCard label="Em negociação" value={summary.comercial.negotiating ?? 0} />
            <StatCard label="Vendas convertidas" value={summary.comercial.converted ?? 0} highlight />
            <StatCard label="Taxa de conversão" value={summary.comercial.conversionRate != null ? `${summary.comercial.conversionRate}%` : "—"} />
            <StatCard label="Valor em negociação" value={formatBRL(summary.comercial.pipelineValue)} />
            <StatCard label="Funil ponderado" value={formatBRL(summary.comercial.weightedPipeline)} />
          </div>

          <div className="section-title">Pedidos</div>
          <div className="stat-grid">
            <StatCard label="Pedidos ativos" value={summary.pedidos.active} />
            <StatCard label="Aguardando aprovação" value={summary.pedidos.awaitingApproval} />
            <StatCard label="Em produção" value={summary.pedidos.inProduction} />
            <StatCard label="Prontos" value={summary.pedidos.ready} />
            <StatCard label="Parcialmente entregues" value={summary.pedidos.partiallyDelivered} />
            <StatCard label="Atrasados" value={summary.pedidos.late} highlight={summary.pedidos.late > 0} />
            <StatCard label="Em risco de atraso" value={summary.pedidos.atRisk} />
          </div>

          <div className="section-title">Produção</div>
          <div className="stat-grid">
            <StatCard label="Qtde. programada" value={formatQty(summary.producao.plannedQty)} />
            <StatCard label="Qtde. produzida" value={formatQty(summary.producao.producedQty)} />
            <StatCard label="Qtde. pendente" value={formatQty(summary.producao.pendingQty)} />
            <StatCard label="% cumprimento" value={summary.producao.fulfillmentPct != null ? `${summary.producao.fulfillmentPct}%` : "—"} />
          </div>

          <div className="section-title">Financeiro</div>
          <div className="stat-grid">
            <StatCard label="Valor vendido no período" value={formatBRL(summary.financeiro.soldValuePeriod)} />
            <StatCard label="Valor recebido" value={formatBRL(summary.financeiro.receivedValuePeriod)} />
            <StatCard label="Valor a receber" value={formatBRL(summary.financeiro.receivableValue)} />
            <StatCard label="Saldo vencido" value={formatBRL(summary.financeiro.overdueBalance)} />
          </div>
        </>
      )}

      <div className="section-title">Gráficos</div>
      <div className="grid-2">
        <div className="card card-pad">
          <div className="section-title">Evolução de vendas (6 meses)</div>
          {charts ? <TrendLineChart data={charts.salesByMonth} xKey="month" yKey="valor" color={COLORS.laranja} formatter={formatBRL} /> : <p>Carregando...</p>}
        </div>
        <div className="card card-pad">
          <div className="section-title">Evolução de oportunidades recebidas (6 meses)</div>
          {charts ? <SimpleBarChart data={charts.opportunitiesByMonth} xKey="month" yKey="quantidade" color={COLORS.azul} formatter={formatQty} /> : <p>Carregando...</p>}
        </div>
      </div>
      <div className="grid-2" style={{ marginTop: 14 }}>
        <div className="card card-pad">
          <div className="section-title">Funil comercial</div>
          {charts ? <SimpleBarChart data={charts.funnelByStage} xKey="etapa" yKey="quantidade" layout="vertical" color={COLORS.laranja} formatter={formatQty} height={260} /> : <p>Carregando...</p>}
        </div>
        <div className="card card-pad">
          <div className="section-title">Pedidos por situação operacional</div>
          {charts ? <SimpleBarChart data={charts.ordersByStatus} xKey="situacao" yKey="quantidade" layout="vertical" color={COLORS.verde} formatter={formatQty} height={260} /> : <p>Carregando...</p>}
        </div>
      </div>
      <div className="grid-2" style={{ marginTop: 14 }}>
        <div className="card card-pad">
          <div className="section-title">Produção por produto (top 10)</div>
          {charts ? <SimpleBarChart data={charts.productionByProduct} xKey="produto" yKey="quantidade" layout="vertical" color={COLORS.azul} formatter={formatQty} height={300} /> : <p>Carregando...</p>}
        </div>
        <div className="card card-pad">
          <div className="section-title">Vendas por canal (oportunidades fechadas)</div>
          {charts ? <CategoricalBarChart data={charts.salesByChannel} xKey="canal" yKey="valor" formatter={formatBRL} /> : <p>Carregando...</p>}
          {charts && charts.salesByChannel.every((c) => c.valor === 0) && (
            <div style={{ fontSize: 11.5, color: "var(--cinza-medio)", marginTop: 6 }}>
              Nenhum valor comercial registrado para estas oportunidades na planilha de origem — não foi inventado valor.
            </div>
          )}
        </div>
      </div>
      <div className="grid-2" style={{ marginTop: 14 }}>
        <div className="card card-pad">
          <div className="section-title">Produção realizada por mês</div>
          {charts ? <SimpleBarChart data={charts.producedByMonth} xKey="month" yKey="produzido" color={COLORS.verde} formatter={formatQty} /> : <p>Carregando...</p>}
        </div>
        <div className="card card-pad">
          <div className="section-title">Planejado × Realizado (carteira atual)</div>
          {charts ? (
            <TwoSeriesBarChart data={plannedVsProducedData} xKey="label" aKey="planejado" bKey="produzido" aLabel="Planejado (necessário)" bLabel="Produzido (aprovado)" formatter={formatQty} />
          ) : <p>Carregando...</p>}
        </div>
      </div>

      <div className="grid-2" style={{ marginTop: 14 }}>
        <div className="card card-pad">
          <div className="section-title">⚠ Atenção necessária</div>
          {attentionItems.length === 0 && <div className="empty-state">Nenhum ponto de atenção no momento.</div>}
          <div className="attention-list">
            {attentionItems.slice(0, 15).map((item) => (
              <div key={item.type + item.id} className="attention-item" onClick={() => navigate(item.link)} style={{ cursor: "pointer" }}>
                <span>{item.label}</span>
                <span className="badge badge-orange">{item.type}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="card card-pad">
          <div className="section-title">Visão operacional de hoje</div>
          {today && (
            <div className="stat-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
              <StatCard label="Produzido hoje" value={formatQty(today.producedToday)} />
              <StatCard label="Itens aguardando produção" value={today.expectedToday} />
              <StatCard label="Follow-ups de hoje" value={today.followupsToday} />
              <StatCard label="Atividades programadas hoje" value={today.activitiesToday} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
