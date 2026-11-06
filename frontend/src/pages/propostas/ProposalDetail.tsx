import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useFetch } from "../../lib/useApi";
import { api, ApiError } from "../../lib/api";
import { formatBRL, formatDate } from "../../lib/format";
import { proposalStatusLabels } from "../../lib/labels";
import { Badge } from "../../components/Badge";

interface Detail { proposal: any; items: any[]; versions: any[] }

const NEXT_STATUS: Record<string, string[]> = {
  EM_ELABORACAO: ["ENVIADA", "CANCELADA"],
  ENVIADA: ["VISUALIZADA", "EM_NEGOCIACAO", "APROVADA", "RECUSADA", "EXPIRADA"],
  VISUALIZADA: ["EM_NEGOCIACAO", "APROVADA", "RECUSADA"],
  EM_NEGOCIACAO: ["REVISAO_SOLICITADA", "APROVADA", "RECUSADA"],
  REVISAO_SOLICITADA: ["ENVIADA"],
  APROVADA: [],
  RECUSADA: [],
  EXPIRADA: [],
  CANCELADA: [],
};

export function ProposalDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data, reload } = useFetch<Detail>(`/proposals/${id}`, [id]);
  const [error, setError] = useState<string | null>(null);
  const [converting, setConverting] = useState(false);

  if (!data) return <p>Carregando...</p>;
  const { proposal, items } = data;

  async function setStatus(status: string) {
    setError(null);
    try {
      await api.post(`/proposals/${proposal.id}/status`, { status });
      reload();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Erro ao atualizar situação.");
    }
  }

  async function convertToOrder() {
    setConverting(true); setError(null);
    try {
      const order = await api.post<{ id: string }>(`/proposals/${proposal.id}/convert-to-order`, { agreedDeadlineDays: proposal.estimatedDays ?? 15 });
      navigate(`/pedidos/${order.id}`);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Erro ao gerar pedido.");
    } finally { setConverting(false); }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Proposta {proposal.number}</h1>
          <div className="desc"><Badge>{proposalStatusLabels[proposal.status]}</Badge></div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {NEXT_STATUS[proposal.status]?.map((s) => (
            <button key={s} className={`btn ${s === "APROVADA" ? "btn-primary" : s === "RECUSADA" ? "btn-danger" : ""}`} onClick={() => setStatus(s)}>
              {proposalStatusLabels[s]}
            </button>
          ))}
          {proposal.status === "APROVADA" && (
            <button className="btn btn-primary" onClick={convertToOrder} disabled={converting}>Gerar pedido</button>
          )}
        </div>
      </div>
      {error && <div className="error-text">{error}</div>}

      <div className="card card-pad" style={{ marginBottom: 14 }}>
        <div className="form-grid">
          <div><label>Emissão</label>{formatDate(proposal.issueDate)}</div>
          <div><label>Validade</label>{formatDate(proposal.validUntil)}</div>
          <div><label>Prazo estimado</label>{proposal.estimatedDays ? `${proposal.estimatedDays} dias` : "—"}</div>
          <div><label>Condições de pagamento</label>{proposal.paymentTerms ?? "—"}</div>
          <div><label>Frete</label>{formatBRL(proposal.freightValue)}</div>
          <div><label>Desconto</label>{formatBRL(proposal.discountValue)}</div>
          <div><label>Valor total</label><strong>{formatBRL(proposal.totalValue)}</strong></div>
        </div>
      </div>

      <div className="card">
        <table>
          <thead><tr><th>Descrição</th><th>Qtde.</th><th>Unid.</th><th>Preço unit.</th><th>Desconto</th><th>Total</th></tr></thead>
          <tbody>
            {items.map((it) => (
              <tr key={it.id}>
                <td>{it.description}</td><td>{it.quantity}</td><td>{it.unitCode}</td>
                <td>{formatBRL(it.unitPrice)}</td><td>{formatBRL(it.discount)}</td><td>{formatBRL(it.totalValue)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
