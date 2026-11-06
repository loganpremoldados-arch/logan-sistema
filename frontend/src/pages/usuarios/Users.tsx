import { useState } from "react";
import { useFetch } from "../../lib/useApi";
import { api, ApiError } from "../../lib/api";
import { roleLabels } from "../../lib/labels";
import { Badge } from "../../components/Badge";
import { Modal } from "../../components/Modal";

interface UserRow { id: string; name: string; email: string; role: string; active: boolean; mustResetPwd: boolean }

export function Users() {
  const { data, reload } = useFetch<UserRow[]>("/users");
  const [showForm, setShowForm] = useState(false);

  async function toggleActive(u: UserRow) {
    await api.put(`/users/${u.id}`, { active: !u.active });
    reload();
  }

  return (
    <div>
      <div className="page-header">
        <div><h1>Usuários</h1><div className="desc">Controle de acesso por perfil</div></div>
        <button className="btn btn-primary" onClick={() => setShowForm(true)}>+ Novo usuário</button>
      </div>
      <div className="card">
        <table>
          <thead><tr><th>Nome</th><th>E-mail</th><th>Perfil</th><th>Situação</th><th></th></tr></thead>
          <tbody>
            {data?.map((u) => (
              <tr key={u.id}>
                <td style={{ fontWeight: 600 }}>{u.name}</td><td>{u.email}</td>
                <td><Badge>{roleLabels[u.role] ?? u.role}</Badge></td>
                <td><Badge className={u.active ? "badge-green" : "badge-gray"}>{u.active ? "Ativo" : "Inativo"}</Badge></td>
                <td><button className="btn btn-sm" onClick={() => toggleActive(u)}>{u.active ? "Desativar" : "Ativar"}</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {showForm && <UserForm onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); reload(); }} />}
    </div>
  );
}

function UserForm({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ name: "", email: "", role: "COMERCIAL", password: "" });
  const [error, setError] = useState<string | null>(null);

  async function save() {
    try { await api.post("/users", form); onSaved(); }
    catch (e) { setError(e instanceof ApiError ? e.message : "Erro ao criar usuário."); }
  }

  return (
    <Modal title="Novo usuário" onClose={onClose} footer={
      <><button className="btn" onClick={onClose}>Cancelar</button><button className="btn btn-primary" onClick={save} disabled={!form.name || !form.email || form.password.length < 6}>Salvar</button></>
    }>
      <div className="form-grid">
        <div className="full"><label>Nome *</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
        <div className="full"><label>E-mail *</label><input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
        <div>
          <label>Perfil *</label>
          <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
            {Object.entries(roleLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div><label>Senha provisória *</label><input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></div>
      </div>
      {error && <div className="error-text">{error}</div>}
    </Modal>
  );
}
