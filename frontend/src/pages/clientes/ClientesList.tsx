import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useFetch } from "../../lib/useApi";
import { api, ApiError } from "../../lib/api";
import { Modal } from "../../components/Modal";
import { customerProfileLabels } from "../../lib/labels";

interface Customer {
  id: string; code: string; name: string; phone: string | null; whatsapp: string | null;
  city: string | null; profile: string; status: string; document: string | null;
}

export function ClientesList() {
  const [q, setQ] = useState("");
  const { data, loading, reload } = useFetch<Customer[]>(`/customers?q=${encodeURIComponent(q)}`, [q]);
  const [showForm, setShowForm] = useState(false);
  const navigate = useNavigate();

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Clientes</h1>
          <div className="desc">Cadastro centralizado de clientes e contatos</div>
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm(true)}>+ Novo cliente</button>
      </div>

      <div className="filters-bar">
        <input placeholder="Buscar por nome, código, CPF/CNPJ ou telefone..." value={q} onChange={(e) => setQ(e.target.value)} style={{ width: 340 }} />
      </div>

      <div className="card">
        <table>
          <thead>
            <tr><th>Código</th><th>Nome</th><th>Perfil</th><th>Telefone</th><th>Cidade</th><th>Situação</th></tr>
          </thead>
          <tbody>
            {data?.map((c) => (
              <tr key={c.id} className="clickable" onClick={() => navigate(`/clientes/${c.id}`)}>
                <td>{c.code}</td>
                <td style={{ fontWeight: 600 }}>{c.name}</td>
                <td>{customerProfileLabels[c.profile] ?? c.profile}</td>
                <td>{c.phone ?? c.whatsapp ?? "—"}</td>
                <td>{c.city ?? "—"}</td>
                <td><span className={`badge ${c.status === "ATIVO" ? "badge-green" : "badge-gray"}`}>{c.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && data?.length === 0 && <div className="empty-state">Nenhum cliente encontrado.</div>}
      </div>

      {showForm && <ClienteForm onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); reload(); }} />}
    </div>
  );
}

function ClienteForm({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ name: "", document: "", phone: "", whatsapp: "", email: "", city: "", profile: "OUTROS" });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true); setError(null);
    try {
      await api.post("/customers", form);
      onSaved();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Erro ao salvar cliente.");
    } finally { setSaving(false); }
  }

  return (
    <Modal title="Novo cliente" onClose={onClose} footer={
      <>
        <button className="btn" onClick={onClose}>Cancelar</button>
        <button className="btn btn-primary" onClick={save} disabled={saving || !form.name}>Salvar</button>
      </>
    }>
      <div className="form-grid">
        <div className="full"><label>Nome ou razão social *</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
        <div><label>CPF/CNPJ</label><input value={form.document} onChange={(e) => setForm({ ...form, document: e.target.value })} /></div>
        <div>
          <label>Perfil do cliente</label>
          <select value={form.profile} onChange={(e) => setForm({ ...form, profile: e.target.value })}>
            {Object.entries(customerProfileLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div><label>Telefone</label><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
        <div><label>WhatsApp</label><input value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} /></div>
        <div><label>E-mail</label><input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
        <div><label>Cidade</label><input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></div>
      </div>
      {error && <div className="error-text">{error}</div>}
    </Modal>
  );
}
