import { useFetch } from "../lib/useApi";
import { formatQty } from "../lib/format";
import { Badge } from "../components/Badge";

interface Row { productId: string; productName: string; productCode: string; unitCode: string; physicalQty: string; reservedQty: string; inspectionQty: string; rejectedQty: string; minimumQty: string; availableQty: number }

export function Inventory() {
  const { data } = useFetch<Row[]>("/catalog/inventory");

  return (
    <div>
      <div className="page-header"><div><h1>Estoque</h1><div className="desc">Produtos acabados — físico, reservado e disponível</div></div></div>
      <div className="card">
        <table>
          <thead><tr><th>Produto</th><th>Físico</th><th>Reservado</th><th>Em inspeção</th><th>Rejeitado</th><th>Disponível</th><th>Mínimo</th><th>Situação</th></tr></thead>
          <tbody>
            {data?.map((r) => (
              <tr key={r.productId}>
                <td style={{ fontWeight: 600 }}>{r.productName}</td>
                <td>{formatQty(r.physicalQty)} {r.unitCode}</td>
                <td>{formatQty(r.reservedQty)}</td>
                <td>{formatQty(r.inspectionQty)}</td>
                <td>{formatQty(r.rejectedQty)}</td>
                <td style={{ fontWeight: 700 }}>{formatQty(r.availableQty)}</td>
                <td>{formatQty(r.minimumQty)}</td>
                <td>{Number(r.minimumQty) > 0 && r.availableQty < Number(r.minimumQty)
                  ? <Badge className="badge-red">Abaixo do mínimo</Badge>
                  : <Badge className="badge-green">OK</Badge>}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {data && data.length === 0 && <div className="empty-state">Nenhum produto cadastrado ainda.</div>}
      </div>
    </div>
  );
}
