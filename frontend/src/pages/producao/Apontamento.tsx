import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useFetch } from "../../lib/useApi";
import { api, ApiError } from "../../lib/api";
import { formatDateTime, formatQty, formatDate } from "../../lib/format";

interface QueueRow { item: any; orderNumber: string; productName: string; pendingToProduce: number }
interface RecordRow { record: any; productName: string; orderNumber: string | null }

export function Apontamento() {
  const [params] = useSearchParams();
  const preselected = params.get("orderItemId") ?? "";
  const { data: queue } = useFetch<QueueRow[]>("/production/queue");
  const { data: records, reload } = useFetch<RecordRow[]>("/production/records");

  const [orderItemId, setOrderItemId] = useState(preselected);
  const [quantityProduced, setQuantityProduced] = useState("");
  const [quantityRejected, setQuantityRejected] = useState("0");
  const [lossReason, setLossReason] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const selected = queue?.find((q) => q.item.id === orderItemId);

  async function save() {
    if (!selected) { setError("Selecione um item da fila de produção."); return; }
    setSaving(true); setError(null);
    try {
      const produced = Number(quantityProduced);
      const rejected = Number(quantityRejected) || 0;
      await api.post("/production/records", {
        date: new Date().toISOString(),
        orderId: selected.item.orderId,
        orderItemId: selected.item.id,
        productId: selected.item.productId,
        quantityProduced: produced,
        quantityApproved: produced - rejected,
        quantityRejected: rejected,
        lossReason: lossReason || null,
        notes: notes || null,
      });
      setQuantityProduced(""); setQuantityRejected("0"); setLossReason(""); setNotes("");
      reload();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Erro ao registrar apontamento.");
    } finally { setSaving(false); }
  }

  return (
    <div>
      <div className="page-header"><div><h1>Apontamento de Produção</h1><div className="desc">Registro diário e rápido da produção</div></div></div>

      <div className="card card-pad" style={{ marginBottom: 16, maxWidth: 560 }}>
        <label>Pedido / item *</label>
        <select value={orderItemId} onChange={(e) => setOrderItemId(e.target.value)} style={{ width: "100%", marginBottom: 10 }}>
          <option value="">Selecione um item da fila...</option>
          {queue?.map((q) => <option key={q.item.id} value={q.item.id}>{q.orderNumber} — {q.productName} (pendente: {formatQty(q.pendingToProduce)})</option>)}
        </select>

        <div className="form-grid">
          <div><label>Quantidade produzida *</label><input type="number" value={quantityProduced} onChange={(e) => setQuantityProduced(e.target.value)} /></div>
          <div><label>Quantidade rejeitada</label><input type="number" value={quantityRejected} onChange={(e) => setQuantityRejected(e.target.value)} /></div>
          <div className="full"><label>Motivo da perda (se houver rejeição)</label><input value={lossReason} onChange={(e) => setLossReason(e.target.value)} /></div>
          <div className="full"><label>Observações / ocorrências</label><input value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
        </div>
        {error && <div className="error-text">{error}</div>}
        <button className="btn btn-primary" onClick={save} disabled={saving || !quantityProduced} style={{ marginTop: 12 }}>Registrar apontamento</button>
      </div>

      <div className="section-title">Últimos apontamentos</div>
      <div className="card">
        <table>
          <thead><tr><th>Data</th><th>Pedido</th><th>Produto</th><th>Produzido</th><th>Aprovado</th><th>Rejeitado</th></tr></thead>
          <tbody>
            {records?.slice(0, 30).map((r) => (
              <tr key={r.record.id}>
                <td>{formatDate(r.record.date)}</td><td>{r.orderNumber ?? "—"}</td><td>{r.productName}</td>
                <td>{formatQty(r.record.quantityProduced)}</td><td>{formatQty(r.record.quantityApproved)}</td><td>{formatQty(r.record.quantityRejected)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
