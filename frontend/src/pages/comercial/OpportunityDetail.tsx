import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useFetch } from "../../lib/useApi";
import { api, ApiError } from "../../lib/api";
import { formatBRL, formatDate, formatDateTime } from "../../lib/format";
import { activityTypeLabels, stageLabels } from "../../lib/labels";
import { Badge } from "../../components/Badge";

interface Detail { opportunity: any; activities: any[]; stageEvents: any[] }

export function OpportunityDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data, reload } = useFetch<Detail>(`/opportunities/${id}`, [id]);
  const [showActivity, setShowActivity] = useState(false);
  const [creatingProposal, setCreatingProposal] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!data) return <p>Carregando...</p>;
  const { opportunity, activities, stageEvents } = data;

  async function createProposal() {
    setCreatingProposal(true); setError(null);
    try {
      const r = await api.post<{ id: string }>("/proposals", {
        opportunityId: opportunity.id,
        items: [{ description: opportunity.productDescription ?? "Item a definir", unitCode: opportunity.unitCode ?? "UN", quantity: Number(opportunity.quantity ?? 1), unitPrice: Number(opportunity.proposalValue ?? opportunity.estimatedValue ?? 0) / Number(opportunity.quantity || 1) }],
      });
      navigate(`/comercial/propostas/${r.id}`);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Erro ao criar proposta.");
    } finally { setCreatingProposal(false); }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>{opportunity.code}</h1>
          <div className="desc"><Badge>{stageLabels[opportunity.stage]}</Badge></div>
        </div>
        <button className="btn btn-primary" onClick={createProposal} disabled={creatingProposal}>+ Criar proposta</button>
      </div>
      {error && <div className="error-text">{error}</div>}

      <div className="grid-2">
        <div className="card card-pad">
          <div className="section-title">Dados da oportunidade</div>
          <div className="form-grid">
            <div><label>Contato</label>{opportunity.contactName ?? "—"}</div>
            <div><label>Telefone</label>{opportunity.phone ?? "—"}</div>
            <div><label>Produto de interesse</label>{opportunity.productDescription ?? "—"}</div>
            <div><label>Quantidade</label>{opportunity.quantity ?? "—"}</div>
            <div><label>Valor estimado</label>{formatBRL(opportunity.estimatedValue)}</div>
            <div><label>Probabilidade</label>{opportunity.probability}%</div>
            <div><label>Próxima ação</label>{opportunity.nextAction ?? "—"}</div>
            <div><label>Próximo contato</label>{formatDate(opportunity.nextContactDate)}</div>
            <div className="full"><label>Observações</label><div style={{ whiteSpace: "pre-wrap" }}>{opportunity.notes ?? "—"}</div></div>
          </div>
        </div>

        <div className="card card-pad">
          <div className="section-title">Histórico de etapas</div>
          <div className="timeline">
            {stageEvents.map((e) => (
              <div key={e.id} className="timeline-item">
                <div style={{ fontWeight: 600 }}>{stageLabels[e.toStage] ?? e.toStage}</div>
                <div style={{ color: "var(--cinza-medio)", fontSize: 12 }}>{formatDateTime(e.createdAt)}{e.note ? ` — ${e.note}` : ""}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card card-pad" style={{ marginTop: 14 }}>
        <div className="section-title" style={{ justifyContent: "space-between", display: "flex" }}>
          <span>Atividades comerciais</span>
          <button className="btn btn-sm" onClick={() => setShowActivity(true)}>+ Registrar atividade</button>
        </div>
        <table>
          <thead><tr><th>Data</th><th>Tipo</th><th>Descrição</th><th>Resultado</th><th>Próximo contato</th></tr></thead>
          <tbody>
            {activities.map((a) => (
              <tr key={a.id}>
                <td>{formatDateTime(a.occurredAt)}</td>
                <td>{activityTypeLabels[a.type]}</td>
                <td>{a.description}</td>
                <td>{a.result ?? "—"}</td>
                <td>{formatDate(a.nextContactAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {activities.length === 0 && <div className="empty-state">Nenhuma atividade registrada ainda.</div>}
      </div>

      {showActivity && <ActivityForm opportunityId={opportunity.id} onClose={() => setShowActivity(false)} onSaved={() => { setShowActivity(false); reload(); }} />}
    </div>
  );
}

function ActivityForm({ opportunityId, onClose, onSaved }: { opportunityId: string; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ type: "LIGACAO", description: "", result: "", nextAction: "", nextContactAt: "" });
  const [error, setError] = useState<string | null>(null);

  async function save() {
    try {
      await api.post(`/opportunities/${opportunityId}/activities`, {
        type: form.type, description: form.description, result: form.result || null,
        nextAction: form.nextAction || null,
        nextContactAt: form.nextContactAt ? new Date(form.nextContactAt).toISOString() : null,
      });
      onSaved();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Erro ao registrar atividade.");
    }
  }

  return (
    <div className="modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal">
        <div className="modal-header"><h3>Registrar atividade</h3><button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button></div>
        <div className="modal-body">
          <label>Tipo de atividade</label>
          <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} style={{ width: "100%", marginBottom: 10 }}>
            {Object.entries(activityTypeLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <label>Descrição do contato *</label>
          <textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} style={{ width: "100%", marginBottom: 10 }} />
          <label>Resultado</label>
          <input value={form.result} onChange={(e) => setForm({ ...form, result: e.target.value })} style={{ width: "100%", marginBottom: 10 }} />
          <label>Próxima ação</label>
          <input value={form.nextAction} onChange={(e) => setForm({ ...form, nextAction: e.target.value })} style={{ width: "100%", marginBottom: 10 }} />
          <label>Data do próximo contato</label>
          <input type="datetime-local" value={form.nextContactAt} onChange={(e) => setForm({ ...form, nextContactAt: e.target.value })} style={{ width: "100%" }} />
          {error && <div className="error-text">{error}</div>}
        </div>
        <div className="modal-footer">
          <button className="btn" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={save} disabled={!form.description}>Salvar</button>
        </div>
      </div>
    </div>
  );
}
