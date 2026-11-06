import { useFetch } from "../../lib/useApi";
import { formatQty } from "../../lib/format";

interface Data { from: string; to: string; days: number; items: { productId: string; productName: string; planejado: number; produzido: number; aprovado: number; rejeitado: number; indiceDePerdas: number; cumprimento: number | null }[] }

export function Comparativo() {
  const { data } = useFetch<Data>("/production/comparativo");

  return (
    <div>
      <div className="page-header"><div><h1>Planejado × Realizado</h1><div className="desc">Comparativo de produção nos últimos {data?.days ?? 30} dias</div></div></div>
      <div className="card">
        <table>
          <thead><tr><th>Produto</th><th>Planejado (capacidade × dias)</th><th>Produzido</th><th>Aprovado</th><th>Rejeitado</th><th>Índice de perdas</th><th>% Cumprimento</th></tr></thead>
          <tbody>
            {data?.items.map((i) => (
              <tr key={i.productId}>
                <td style={{ fontWeight: 600 }}>{i.productName}</td>
                <td>{formatQty(i.planejado)}</td><td>{formatQty(i.produzido)}</td><td>{formatQty(i.aprovado)}</td>
                <td>{formatQty(i.rejeitado)}</td><td>{i.indiceDePerdas}%</td>
                <td>{i.cumprimento != null ? `${i.cumprimento}%` : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {data && data.items.length === 0 && <div className="empty-state">Nenhum apontamento no período.</div>}
      </div>
    </div>
  );
}
