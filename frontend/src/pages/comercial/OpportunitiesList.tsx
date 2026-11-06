import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useFetch } from "../../lib/useApi";
import { formatBRL, formatDate } from "../../lib/format";
import { stageLabels } from "../../lib/labels";
import { Badge } from "../../components/Badge";
import { OpportunityForm } from "./OpportunityForm";

interface Row {
  opportunity: any; customerName: string; channelName: string | null; ownerName: string | null; productName: string | null;
}

export function OpportunitiesList() {
  const [stage, setStage] = useState("");
  const { data, loading, reload } = useFetch<Row[]>(`/opportunities${stage ? `?stage=${stage}` : ""}`, [stage]);
  const [showForm, setShowForm] = useState(false);
  const navigate = useNavigate();

  return (
    <div>
      <div className="page-header">
        <div><h1>Oportunidades</h1><div className="desc">Todas as oportunidades comerciais</div></div>
        <button className="btn btn-primary" onClick={() => setShowForm(true)}>+ Nova oportunidade</button>
      </div>

      <div className="filters-bar">
        <select value={stage} onChange={(e) => setStage(e.target.value)}>
          <option value="">Todas as etapas</option>
          {Object.entries(stageLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      <div className="card">
        <table>
          <thead><tr><th>Código</th><th>Cliente</th><th>Produto</th><th>Canal</th><th>Etapa</th><th>Valor estimado</th><th>Responsável</th></tr></thead>
          <tbody>
            {data?.map((r) => (
              <tr key={r.opportunity.id} className="clickable" onClick={() => navigate(`/comercial/oportunidades/${r.opportunity.id}`)}>
                <td>{r.opportunity.code}</td>
                <td style={{ fontWeight: 600 }}>{r.customerName}</td>
                <td>{r.productName ?? r.opportunity.productDescription ?? "—"}</td>
                <td>{r.channelName ?? "—"}</td>
                <td><Badge className={r.opportunity.stage === "FECHADA" ? "badge-green" : r.opportunity.stage === "PERDIDA" ? "badge-red" : "badge-orange"}>{stageLabels[r.opportunity.stage]}</Badge></td>
                <td>{formatBRL(r.opportunity.estimatedValue)}</td>
                <td>{r.ownerName ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && data?.length === 0 && <div className="empty-state">Nenhuma oportunidade encontrada.</div>}
      </div>

      {showForm && <OpportunityForm onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); reload(); }} />}
    </div>
  );
}
