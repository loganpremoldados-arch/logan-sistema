import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useFetch } from "../../lib/useApi";
import { api, ApiError } from "../../lib/api";
import { formatBRL, formatDate, formatDateTime, formatQty } from "../../lib/format";
import { activityTypeLabels, stageLabels } from "../../lib/labels";
import { Badge } from "../../components/Badge";
import { Modal } from "../../components/Modal";

interface Detail { opportunity: any; activities: any[]; stageEvents: any[] }

export function OpportunityDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data, reload } = useFetch<Detail>(`/opportunities/${id}`, [id]);
  const [showActivity, setShowActivity] = useState(false);
  const [editing, setEditing] = useState(false);
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
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn" onClick={() => setEditing(true)}>Editar</button>
          <button className="btn btn-primary" onClick={createProposal} disabled={creatingProposal}>+ Criar proposta</button>
        </div>
      </div>
      {error && <div className="error-text">{error}</div>}

      {editing && (
        <OpportunityEditForm
          opportunity={opportunity}
          onClose={() => setEditing(false)}
          onSaved={() => { setEditing(false); reload(); }}
        />
      )}

      <div className="grid-2">
        <div className="card card-pad">
          <div className="section-title">Dados da oportunidade</div>
          <div className="form-grid">
            <div><label>Contato</label>{opportunity.contactName ?? "—"}</div>
            <div><label>Telefone</label>{opportunity.phone ?? "—"}</div>
            <div><label>Produto de interesse</label>{opportunity.productDescription ?? "—"}</div>
            <div><label>Quantidade</label>{opportunity.quantity != null ? formatQty(opportunity.quantity) : "—"}</div>
            <div>
              <label>Valor estimado (total)</label>
              {formatBRL(opportunity.estimatedValue)}
              {opportunity.quantity > 0 && opportunity.estimatedValue > 0 && (
                <div style={{ fontSize: 12, color: "var(--cinza-medio)" }}>
                  ≈ {formatBRL(Number(opportunity.estimatedValue) / Number(opportunity.quantity))} por unidade
                </div>
              )}
            </div>
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

interface Channel { id: string; name: string }
interface Product { id: string; name: string; code: string }

function OpportunityEditForm({ opportunity, onClose, onSaved }: { opportunity: any; onClose: () => void; onSaved: () => void }) {
  const { data: products } = useFetch<Product[]>("/catalog/products");
  const { data: channels } = useFetch<Channel[]>("/catalog/channels");

  const [form, setForm] = useState({
    contactName: opportunity.contactName ?? "",
    phone: opportunity.phone ?? "",
    channelId: opportunity.channelId ?? "",
    productId: opportunity.productId ?? "",
    productDescription: opportunity.productDescription ?? "",
    quantity: opportunity.quantity != null ? String(opportunity.quantity) : "",
    desiredDeadline: opportunity.desiredDeadline ?? "",
    notes: opportunity.notes ?? "",
  });
  // valor unitário é só um apoio de digitação — o que fica salvo é sempre o total.
  const quantityNum = Number(form.quantity) || 0;
  const [unitValue, setUnitValue] = useState(
    opportunity.quantity > 0 && opportunity.estimatedValue > 0
      ? String((Number(opportunity.estimatedValue) / Number(opportunity.quantity)).toFixed(2))
      : ""
  );
  const [totalValue, setTotalValue] = useState(
    opportunity.estimatedValue != null ? String(opportunity.estimatedValue) : ""
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function onUnitValueChange(v: string) {
    setUnitValue(v);
    const u = Number(v);
    if (u > 0 && quantityNum > 0) setTotalValue(String(Math.round(u * quantityNum * 100) / 100));
  }
  function onQuantityChange(v: string) {
    setForm({ ...form, quantity: v });
    const q = Number(v);
    const u = Number(unitValue);
    if (u > 0 && q > 0) setTotalValue(String(Math.round(u * q * 100) / 100));
  }

  async function save() {
    setSaving(true); setError(null);
    try {
      await api.put(`/opportunities/${opportunity.id}`, {
        contactName: form.contactName || null,
        phone: form.phone || null,
        channelId: form.channelId || null,
        productId: form.productId || null,
        productDescription: form.productDescription || null,
        quantity: form.quantity ? Number(form.quantity) : null,
        estimatedValue: totalValue ? Number(totalValue) : null,
        desiredDeadline: form.desiredDeadline || null,
        notes: form.notes || null,
      });
      onSaved();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Erro ao salvar as alterações.");
    } finally { setSaving(false); }
  }

  return (
    <Modal title={`Editar oportunidade — ${opportunity.code}`} onClose={onClose} wide footer={
      <>
        <button className="btn" onClick={onClose}>Cancelar</button>
        <button className="btn btn-primary" onClick={save} disabled={saving}>Salvar alterações</button>
      </>
    }>
      <div className="form-grid">
        <div><label>Nome do contato</label><input value={form.contactName} onChange={(e) => setForm({ ...form, contactName: e.target.value })} /></div>
        <div><label>Telefone/WhatsApp</label><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
        <div>
          <label>Origem do contato</label>
          <select value={form.channelId} onChange={(e) => setForm({ ...form, channelId: e.target.value })}>
            <option value="">Selecione...</option>
            {channels?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label>Produto cadastrado</label>
          <select value={form.productId} onChange={(e) => setForm({ ...form, productId: e.target.value })}>
            <option value="">— (descrever abaixo)</option>
            {products?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div className="full"><label>Produto de interesse (texto)</label><input value={form.productDescription} onChange={(e) => setForm({ ...form, productDescription: e.target.value })} /></div>
        <div><label>Quantidade</label><input type="number" value={form.quantity} onChange={(e) => onQuantityChange(e.target.value)} /></div>
        <div>
          <label>Valor unitário (R$) — opcional, só para calcular</label>
          <input type="number" value={unitValue} onChange={(e) => onUnitValueChange(e.target.value)} placeholder="ex: 53" />
        </div>
        <div>
          <label>Valor estimado TOTAL (R$) *</label>
          <input type="number" value={totalValue} onChange={(e) => setTotalValue(e.target.value)} />
          {quantityNum > 0 && Number(totalValue) > 0 && (
            <div style={{ fontSize: 12, color: "var(--cinza-medio)" }}>
              = {formatBRL(Number(totalValue) / quantityNum)} por unidade × {quantityNum}
            </div>
          )}
        </div>
        <div><label>Prazo desejado pelo cliente</label><input value={form.desiredDeadline} onChange={(e) => setForm({ ...form, desiredDeadline: e.target.value })} /></div>
        <div className="full"><label>Observações</label><textarea rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} style={{ width: "100%" }} /></div>
      </div>
      {error && <div className="error-text">{error}</div>}
    </Modal>
  );
}
