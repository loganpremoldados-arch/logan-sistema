import { useState } from "react";
import { useFetch } from "../../lib/useApi";
import { api, ApiError } from "../../lib/api";
import { formatQty } from "../../lib/format";

interface Row {
  id: string; productId: string; productName: string; productCode: string; unitCode: string;
  theoreticalDailyQty: string; realDailyQty: string | null; curingTimeDays: string | null;
  finishingTimeDays: string | null; defaultLeadTimeDays: number | null; validated: boolean; notes: string | null;
}

export function Capacity() {
  const { data, reload } = useFetch<Row[]>("/catalog/capacity");
  const [editing, setEditing] = useState<Row | null>(null);

  return (
    <div>
      <div className="page-header"><div><h1>Capacidade Produtiva</h1><div className="desc">Parâmetros de produção por produto — revise e valide antes de usar em previsões de prazo</div></div></div>
      <div className="card">
        <table>
          <thead><tr><th>Produto</th><th>Capacidade teórica/dia</th><th>Capacidade real/dia</th><th>Cura (dias)</th><th>Acabamento (dias)</th><th>Validado</th><th></th></tr></thead>
          <tbody>
            {data?.map((r) => (
              <tr key={r.id}>
                <td style={{ fontWeight: 600 }}>{r.productName}</td>
                <td>{formatQty(r.theoreticalDailyQty)} {r.unitCode}</td>
                <td>{r.realDailyQty ? `${formatQty(r.realDailyQty)} ${r.unitCode}` : "—"}</td>
                <td>{r.curingTimeDays ?? "—"}</td>
                <td>{r.finishingTimeDays ?? "—"}</td>
                <td><span className={`badge ${r.validated ? "badge-green" : "badge-yellow"}`}>{r.validated ? "Validado" : "Pendente"}</span></td>
                <td><button className="btn btn-sm" onClick={() => setEditing(r)}>Editar</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {editing && <CapacityForm row={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reload(); }} />}
    </div>
  );
}

function CapacityForm({ row, onClose, onSaved }: { row: Row; onClose: () => void; onSaved: () => void }) {
  const [realDailyQty, setRealDailyQty] = useState(row.realDailyQty ?? row.theoreticalDailyQty);
  const [curingTimeDays, setCuringTimeDays] = useState(row.curingTimeDays ?? "0");
  const [finishingTimeDays, setFinishingTimeDays] = useState(row.finishingTimeDays ?? "0");
  const [validated, setValidated] = useState(row.validated);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    try {
      await api.post("/catalog/capacity", {
        productId: row.productId, theoreticalDailyQty: Number(row.theoreticalDailyQty),
        realDailyQty: Number(realDailyQty), curingTimeDays: Number(curingTimeDays),
        finishingTimeDays: Number(finishingTimeDays), validated,
      });
      onSaved();
    } catch (e) { setError(e instanceof ApiError ? e.message : "Erro ao salvar."); }
  }

  return (
    <div className="modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal">
        <div className="modal-header"><h3>{row.productName}</h3><button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button></div>
        <div className="modal-body">
          <div className="form-grid">
            <div><label>Capacidade real por dia</label><input type="number" value={realDailyQty} onChange={(e) => setRealDailyQty(e.target.value)} /></div>
            <div><label>Tempo de cura (dias)</label><input type="number" value={curingTimeDays} onChange={(e) => setCuringTimeDays(e.target.value)} /></div>
            <div><label>Tempo de acabamento (dias)</label><input type="number" value={finishingTimeDays} onChange={(e) => setFinishingTimeDays(e.target.value)} /></div>
            <div><label><input type="checkbox" checked={validated} onChange={(e) => setValidated(e.target.checked)} style={{ marginRight: 6 }} />Capacidade validada pela gestão</label></div>
          </div>
          {error && <div className="error-text">{error}</div>}
        </div>
        <div className="modal-footer"><button className="btn" onClick={onClose}>Cancelar</button><button className="btn btn-primary" onClick={save}>Salvar</button></div>
      </div>
    </div>
  );
}
