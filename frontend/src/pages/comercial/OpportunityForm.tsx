import { useState } from "react";
import { useFetch } from "../../lib/useApi";
import { api, ApiError } from "../../lib/api";
import { Modal } from "../../components/Modal";

interface Customer { id: string; name: string; code: string }
interface Product { id: string; name: string; code: string; unitCode: string }
interface Channel { id: string; name: string }

export function OpportunityForm({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { data: customers } = useFetch<Customer[]>("/customers");
  const { data: products } = useFetch<Product[]>("/catalog/products");
  const { data: channels } = useFetch<Channel[]>("/catalog/channels");

  const [form, setForm] = useState({
    customerId: "", contactName: "", phone: "", channelId: "", productId: "",
    productDescription: "", quantity: "", estimatedValue: "", desiredDeadline: "", notes: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState("");
  const [creatingCustomer, setCreatingCustomer] = useState(false);

  async function createCustomerInline() {
    if (!newCustomerName.trim()) return;
    setCreatingCustomer(true);
    try {
      const r = await api.post<{ customer: { id: string } }>("/customers", { name: newCustomerName });
      setForm((f) => ({ ...f, customerId: r.customer.id }));
      setNewCustomerName("");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Erro ao criar cliente.");
    } finally { setCreatingCustomer(false); }
  }

  async function save() {
    setSaving(true); setError(null);
    try {
      await api.post("/opportunities", {
        customerId: form.customerId,
        contactName: form.contactName || null,
        phone: form.phone || null,
        channelId: form.channelId || null,
        productId: form.productId || null,
        productDescription: form.productDescription || null,
        quantity: form.quantity ? Number(form.quantity) : null,
        estimatedValue: form.estimatedValue ? Number(form.estimatedValue) : null,
        desiredDeadline: form.desiredDeadline || null,
        notes: form.notes || null,
      });
      onSaved();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Erro ao criar oportunidade.");
    } finally { setSaving(false); }
  }

  return (
    <Modal title="Nova oportunidade" onClose={onClose} footer={
      <>
        <button className="btn" onClick={onClose}>Cancelar</button>
        <button className="btn btn-primary" onClick={save} disabled={saving || !form.customerId}>Salvar</button>
      </>
    }>
      <div className="form-grid">
        <div className="full">
          <label>Cliente *</label>
          <select value={form.customerId} onChange={(e) => setForm({ ...form, customerId: e.target.value })}>
            <option value="">Selecione...</option>
            {customers?.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.code})</option>)}
          </select>
          <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
            <input placeholder="ou cadastre um cliente novo rapidamente" value={newCustomerName} onChange={(e) => setNewCustomerName(e.target.value)} style={{ flex: 1 }} />
            <button type="button" className="btn btn-sm" onClick={createCustomerInline} disabled={creatingCustomer}>+ Criar</button>
          </div>
        </div>
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
        <div><label>Produto de interesse (texto)</label><input value={form.productDescription} onChange={(e) => setForm({ ...form, productDescription: e.target.value })} /></div>
        <div><label>Quantidade</label><input type="number" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} /></div>
        <div><label>Valor estimado (R$)</label><input type="number" value={form.estimatedValue} onChange={(e) => setForm({ ...form, estimatedValue: e.target.value })} /></div>
        <div><label>Prazo desejado pelo cliente</label><input value={form.desiredDeadline} onChange={(e) => setForm({ ...form, desiredDeadline: e.target.value })} /></div>
        <div className="full"><label>Observações</label><textarea rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} style={{ width: "100%" }} /></div>
      </div>
      {error && <div className="error-text">{error}</div>}
    </Modal>
  );
}
