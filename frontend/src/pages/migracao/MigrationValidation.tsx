import { Fragment, useState } from "react";
import { useFetch } from "../../lib/useApi";
import { api, ApiError } from "../../lib/api";
import { formatDateTime } from "../../lib/format";
import { migrationIssueStatusLabels } from "../../lib/labels";
import { Badge } from "../../components/Badge";

interface Issue {
  id: string; sourceFile: string; sourceSheet: string; sourceRow: number; entityType: string;
  rawData: unknown; issueType: string; issueDescription: string; suggestion: string | null;
  status: string; resolutionNote: string | null; createdAt: string;
}
interface Summary { total: number; pending: number; bySourceAndStatus: Record<string, Record<string, number>> }

const STATUS_BADGE: Record<string, string> = { PENDENTE: "badge-yellow", APROVADO: "badge-green", IGNORADO: "badge-gray", REPROCESSAR: "badge-orange" };

export function MigrationValidation() {
  const [statusFilter, setStatusFilter] = useState("PENDENTE");
  const { data: issues, reload } = useFetch<Issue[]>(`/migration/issues${statusFilter ? `?status=${statusFilter}` : ""}`, [statusFilter]);
  const { data: summary, reload: reloadSummary } = useFetch<Summary>("/migration/summary");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function resolve(id: string, status: "APROVADO" | "IGNORADO" | "REPROCESSAR") {
    setError(null);
    try {
      await api.post(`/migration/issues/${id}/resolve`, { status });
      reload(); reloadSummary();
    } catch (e) { setError(e instanceof ApiError ? e.message : "Erro ao atualizar pendência."); }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Validação da Migração</h1>
          <div className="desc">Pendências encontradas ao migrar as planilhas originais — nada foi corrigido automaticamente</div>
        </div>
      </div>

      {summary && (
        <div className="stat-grid">
          <div className="stat-card"><div className="label">Total de pendências</div><div className="value">{summary.total}</div></div>
          <div className="stat-card"><div className="label">Pendentes de revisão</div><div className="value laranja">{summary.pending}</div></div>
        </div>
      )}

      <div className="filters-bar">
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">Todas</option>
          {Object.entries(migrationIssueStatusLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>
      {error && <div className="error-text">{error}</div>}

      <div className="card">
        <table>
          <thead><tr><th>Origem</th><th>Tipo</th><th>Descrição</th><th>Situação</th><th></th></tr></thead>
          <tbody>
            {issues?.map((i) => (
              <Fragment key={i.id}>
                <tr className="clickable" onClick={() => setExpanded(expanded === i.id ? null : i.id)}>
                  <td style={{ fontSize: 11.5, color: "var(--cinza-medio)" }}>{i.sourceSheet} · linha {i.sourceRow || "—"}</td>
                  <td><Badge className="badge-gray">{i.issueType}</Badge></td>
                  <td style={{ maxWidth: 480 }}>{i.issueDescription}</td>
                  <td><Badge className={STATUS_BADGE[i.status]}>{migrationIssueStatusLabels[i.status]}</Badge></td>
                  <td onClick={(e) => e.stopPropagation()}>
                    {i.status === "PENDENTE" && (
                      <div style={{ display: "flex", gap: 6 }}>
                        <button className="btn btn-sm" onClick={() => resolve(i.id, "APROVADO")}>Aprovar</button>
                        <button className="btn btn-sm" onClick={() => resolve(i.id, "IGNORADO")}>Ignorar</button>
                        <button className="btn btn-sm" onClick={() => resolve(i.id, "REPROCESSAR")}>Reprocessar</button>
                      </div>
                    )}
                  </td>
                </tr>
                {expanded === i.id && (
                  <tr>
                    <td colSpan={5} style={{ background: "#fbfaf7" }}>
                      {i.suggestion && <p><strong>Sugestão:</strong> {i.suggestion}</p>}
                      <p><strong>Registro original:</strong></p>
                      <pre style={{ fontSize: 11.5, background: "#fff", padding: 10, borderRadius: 6, overflowX: "auto" }}>{JSON.stringify(i.rawData, null, 2)}</pre>
                      <p style={{ fontSize: 11.5, color: "var(--cinza-medio)" }}>Arquivo de origem: {i.sourceFile} — registrado em {formatDateTime(i.createdAt)}</p>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
        {issues && issues.length === 0 && <div className="empty-state">Nenhuma pendência nesta situação.</div>}
      </div>
    </div>
  );
}
