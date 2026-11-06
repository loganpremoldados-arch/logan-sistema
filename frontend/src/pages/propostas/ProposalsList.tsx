import { useNavigate } from "react-router-dom";
import { useFetch } from "../../lib/useApi";
import { formatBRL, formatDate } from "../../lib/format";
import { proposalStatusLabels } from "../../lib/labels";
import { Badge } from "../../components/Badge";

interface Row { proposal: any; customerName: string; opportunityCode: string }

export function ProposalsList() {
  const { data, loading } = useFetch<Row[]>("/proposals");
  const navigate = useNavigate();

  return (
    <div>
      <div className="page-header"><div><h1>Propostas</h1><div className="desc">Propostas comerciais e orçamentos</div></div></div>
      <div className="card">
        <table>
          <thead><tr><th>Número</th><th>Cliente</th><th>Oportunidade</th><th>Emissão</th><th>Situação</th><th>Valor</th></tr></thead>
          <tbody>
            {data?.map((r) => (
              <tr key={r.proposal.id} className="clickable" onClick={() => navigate(`/comercial/propostas/${r.proposal.id}`)}>
                <td>{r.proposal.number}</td><td style={{ fontWeight: 600 }}>{r.customerName}</td><td>{r.opportunityCode}</td>
                <td>{formatDate(r.proposal.issueDate)}</td>
                <td><Badge className={r.proposal.status === "APROVADA" ? "badge-green" : r.proposal.status === "RECUSADA" ? "badge-red" : "badge-orange"}>{proposalStatusLabels[r.proposal.status]}</Badge></td>
                <td>{formatBRL(r.proposal.totalValue)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && data?.length === 0 && <div className="empty-state">Nenhuma proposta cadastrada.</div>}
      </div>
    </div>
  );
}
