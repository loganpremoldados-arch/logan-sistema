import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useFetch } from "../../lib/useApi";
import { api, ApiError } from "../../lib/api";
import { formatBRL } from "../../lib/format";
import { stageLabels, stageOrder } from "../../lib/labels";
import { Modal } from "../../components/Modal";

interface Row { opportunity: any; customerName: string }

const OPEN_STAGES = stageOrder.filter((s) => !["FECHADA", "PERDIDA", "SUSPENSA"].includes(s));

export function FunilKanban() {
  const { data, reload } = useFetch<Row[]>("/opportunities?open=1");
  const navigate = useNavigate();
  const [moving, setMoving] = useState<{ id: string; toStage: string } | null>(null);

  const byStage: Record<string, Row[]> = {};
  for (const s of OPEN_STAGES) byStage[s] = [];
  data?.forEach((r) => { if (byStage[r.opportunity.stage]) byStage[r.opportunity.stage].push(r); });

  async function moveTo(id: string, toStage: string) {
    if (toStage === "PERDIDA") { setMoving({ id, toStage }); return; }
    await api.post(`/opportunities/${id}/stage`, { stage: toStage });
    reload();
  }

  return (
    <div>
      <div className="page-header">
        <div><h1>Funil de Vendas</h1><div className="desc">Clique em uma oportunidade para avançar, recuar ou marcar como perdida</div></div>
      </div>
      <div className="kanban">
        {OPEN_STAGES.map((stage, idx) => (
          <div key={stage} className="kanban-col">
            <div className="kanban-col-header">
              <span>{stageLabels[stage]}</span>
              <span className="badge badge-gray">{byStage[stage]?.length ?? 0}</span>
            </div>
            <div className="kanban-col-body">
              {byStage[stage]?.map((r) => (
                <div key={r.opportunity.id} className="kanban-card" onClick={() => navigate(`/comercial/oportunidades/${r.opportunity.id}`)}>
                  <div className="title">{r.customerName}</div>
                  <div className="meta">{r.opportunity.code}</div>
                  <div className="meta">{formatBRL(r.opportunity.estimatedValue)}</div>
                  <div style={{ display: "flex", gap: 4, marginTop: 8 }} onClick={(e) => e.stopPropagation()}>
                    {idx > 0 && <button className="btn btn-sm" onClick={() => moveTo(r.opportunity.id, OPEN_STAGES[idx - 1])}>←</button>}
                    {idx < OPEN_STAGES.length - 1 && <button className="btn btn-sm" onClick={() => moveTo(r.opportunity.id, OPEN_STAGES[idx + 1])}>→</button>}
                    <button className="btn btn-sm" onClick={() => moveTo(r.opportunity.id, "FECHADA")} title="Marcar como fechada">✓</button>
                    <button className="btn btn-sm btn-danger" onClick={() => moveTo(r.opportunity.id, "PERDIDA")} title="Marcar como perdida">✕</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      {moving && <LossModal opportunityId={moving.id} onClose={() => setMoving(null)} onDone={() => { setMoving(null); reload(); }} />}
    </div>
  );
}

function LossModal({ opportunityId, onClose, onDone }: { opportunityId: string; onClose: () => void; onDone: () => void }) {
  const { data: reasons } = useFetch<{ id: string; name: string }[]>("/catalog/loss-reasons");
  const [lossReasonId, setLossReasonId] = useState("");
  const [lossJustification, setLossJustification] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    try {
      await api.post(`/opportunities/${opportunityId}/stage`, { stage: "PERDIDA", lossReasonId, lossJustification });
      onDone();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Erro ao marcar como perdida.");
    }
  }

  return (
    <Modal title="Marcar oportunidade como perdida" onClose={onClose} footer={
      <>
        <button className="btn" onClick={onClose}>Cancelar</button>
        <button className="btn btn-danger" onClick={confirm} disabled={!lossReasonId || !lossJustification}>Confirmar perda</button>
      </>
    }>
      <label>Motivo da perda *</label>
      <select value={lossReasonId} onChange={(e) => setLossReasonId(e.target.value)} style={{ width: "100%", marginBottom: 12 }}>
        <option value="">Selecione...</option>
        {reasons?.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
      </select>
      <label>Justificativa *</label>
      <textarea rows={3} value={lossJustification} onChange={(e) => setLossJustification(e.target.value)} style={{ width: "100%" }} />
      {error && <div className="error-text">{error}</div>}
    </Modal>
  );
}
