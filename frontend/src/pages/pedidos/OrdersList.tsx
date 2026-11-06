import { useSearchParams, useNavigate } from "react-router-dom";
import { useFetch } from "../../lib/useApi";
import { formatBRL, formatDate } from "../../lib/format";
import { orderCommercialLabels, orderOperationalLabels, deadlineLabels } from "../../lib/labels";
import { Badge } from "../../components/Badge";

interface Row { order: any; customerName: string; customerCode: string; deadline: { situation: string } }

export function OrdersList() {
  const [params] = useSearchParams();
  const filtro = params.get("filtro");
  const { data, loading } = useFetch<Row[]>("/orders");
  const navigate = useNavigate();

  let rows = data ?? [];
  if (filtro === "atrasados") rows = rows.filter((r) => r.deadline.situation === "ATRASADO");
  if (filtro === "prontos") rows = rows.filter((r) => r.order.operationalStatus === "PRONTO_PARA_SEPARACAO");

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Pedidos</h1>
          <div className="desc">{filtro === "atrasados" ? "Pedidos atrasados" : filtro === "prontos" ? "Pedidos prontos" : "Todos os pedidos"}</div>
        </div>
      </div>
      <div className="card">
        <table>
          <thead><tr><th>Número</th><th>Cliente</th><th>Fechamento</th><th>Previsão entrega</th><th>Comercial</th><th>Operacional</th><th>Prazo</th><th>Valor líquido</th></tr></thead>
          <tbody>
            {rows.map((r) => {
              const dl = deadlineLabels[r.deadline.situation] ?? { label: r.deadline.situation, badge: "badge-gray" };
              return (
                <tr key={r.order.id} className="clickable" onClick={() => navigate(`/pedidos/${r.order.id}`)}>
                  <td style={{ fontWeight: 700 }}>{r.order.number}</td>
                  <td>{r.customerName}</td>
                  <td>{formatDate(r.order.closingDate)}</td>
                  <td>{formatDate(r.order.expectedDeliveryDate)}</td>
                  <td><Badge>{orderCommercialLabels[r.order.commercialStatus]}</Badge></td>
                  <td><Badge className="badge-blue">{orderOperationalLabels[r.order.operationalStatus]}</Badge></td>
                  <td><Badge className={dl.badge}>{dl.label}</Badge></td>
                  <td>{formatBRL(r.order.netValue)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!loading && rows.length === 0 && <div className="empty-state">Nenhum pedido encontrado.</div>}
      </div>
    </div>
  );
}
