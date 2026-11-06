import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useFetch } from "../../lib/useApi";
import { formatBRL, formatDate } from "../../lib/format";
import { customerProfileLabels, stageLabels, proposalStatusLabels } from "../../lib/labels";
import { Badge } from "../../components/Badge";

interface Detail {
  customer: any; contacts: any[]; opportunities: any[]; proposals: any[]; orders: any[];
  indicators: { totalSold: number; totalReceived: number; balanceDue: number; ordersCount: number; ticketMedio: number; lastOrderDate: string | null; openOpportunities: number; lostProposals: number };
}

const TABS = ["Dados cadastrais", "Oportunidades", "Propostas", "Pedidos", "Indicadores"];

export function ClienteDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data } = useFetch<Detail>(`/customers/${id}`, [id]);
  const [tab, setTab] = useState(0);

  if (!data) return <p>Carregando...</p>;
  const { customer, opportunities, proposals, orders, indicators } = data;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>{customer.name}</h1>
          <div className="desc">{customer.code} · {customerProfileLabels[customer.profile]}</div>
        </div>
      </div>

      <div className="stat-grid">
        <div className="stat-card"><div className="label">Total vendido</div><div className="value">{formatBRL(indicators.totalSold)}</div></div>
        <div className="stat-card"><div className="label">Saldo a receber</div><div className="value laranja">{formatBRL(indicators.balanceDue)}</div></div>
        <div className="stat-card"><div className="label">Pedidos</div><div className="value">{indicators.ordersCount}</div></div>
        <div className="stat-card"><div className="label">Ticket médio</div><div className="value">{formatBRL(indicators.ticketMedio)}</div></div>
        <div className="stat-card"><div className="label">Oportunidades abertas</div><div className="value">{indicators.openOpportunities}</div></div>
        <div className="stat-card"><div className="label">Última compra</div><div className="value" style={{ fontSize: 16 }}>{formatDate(indicators.lastOrderDate)}</div></div>
      </div>

      <div className="tabs">
        {TABS.map((t, i) => <button key={t} className={tab === i ? "active" : ""} onClick={() => setTab(i)}>{t}</button>)}
      </div>

      {tab === 0 && (
        <div className="card card-pad">
          <div className="form-grid">
            <div><label>CPF/CNPJ</label>{customer.document ?? "—"}</div>
            <div><label>Telefone</label>{customer.phone ?? "—"}</div>
            <div><label>WhatsApp</label>{customer.whatsapp ?? "—"}</div>
            <div><label>E-mail</label>{customer.email ?? "—"}</div>
            <div><label>Cidade</label>{customer.city ?? "—"}</div>
            <div><label>Endereço</label>{customer.address ?? "—"}</div>
          </div>
        </div>
      )}

      {tab === 1 && (
        <div className="card">
          <table>
            <thead><tr><th>Código</th><th>Data</th><th>Etapa</th><th>Valor estimado</th></tr></thead>
            <tbody>
              {opportunities.map((o) => (
                <tr key={o.id} className="clickable" onClick={() => navigate(`/comercial/oportunidades/${o.id}`)}>
                  <td>{o.code}</td><td>{formatDate(o.entryDate)}</td>
                  <td><Badge>{stageLabels[o.stage]}</Badge></td><td>{formatBRL(o.estimatedValue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {opportunities.length === 0 && <div className="empty-state">Nenhuma oportunidade registrada.</div>}
        </div>
      )}

      {tab === 2 && (
        <div className="card">
          <table>
            <thead><tr><th>Número</th><th>Emissão</th><th>Situação</th><th>Valor</th></tr></thead>
            <tbody>
              {proposals.map((p) => (
                <tr key={p.id} className="clickable" onClick={() => navigate(`/comercial/propostas/${p.id}`)}>
                  <td>{p.number}</td><td>{formatDate(p.issueDate)}</td>
                  <td><Badge>{proposalStatusLabels[p.status]}</Badge></td><td>{formatBRL(p.totalValue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {proposals.length === 0 && <div className="empty-state">Nenhuma proposta registrada.</div>}
        </div>
      )}

      {tab === 3 && (
        <div className="card">
          <table>
            <thead><tr><th>Número</th><th>Fechamento</th><th>Situação comercial</th><th>Valor líquido</th><th>Recebido</th></tr></thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id} className="clickable" onClick={() => navigate(`/pedidos/${o.id}`)}>
                  <td>{o.number}</td><td>{formatDate(o.closingDate)}</td><td>{o.commercialStatus}</td>
                  <td>{formatBRL(o.netValue)}</td><td>{formatBRL(o.receivedValue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {orders.length === 0 && <div className="empty-state">Nenhum pedido registrado.</div>}
        </div>
      )}

      {tab === 4 && (
        <div className="card card-pad">
          <p>Propostas perdidas (recusadas): <strong>{indicators.lostProposals}</strong></p>
          <p>Total recebido: <strong>{formatBRL(indicators.totalReceived)}</strong></p>
        </div>
      )}
    </div>
  );
}
