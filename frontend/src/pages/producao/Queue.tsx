import { useNavigate } from "react-router-dom";
import { useFetch } from "../../lib/useApi";
import { formatDate, formatQty } from "../../lib/format";
import { Badge } from "../../components/Badge";

interface Row { item: any; orderNumber: string; orderPriority: string; expectedDeliveryDate: string | null; productName: string; pendingToProduce: number }

export function ProductionQueue() {
  const { data, loading } = useFetch<Row[]>("/production/queue");
  const navigate = useNavigate();
  const sorted = [...(data ?? [])].sort((a, b) => {
    const da = a.expectedDeliveryDate ? new Date(a.expectedDeliveryDate).getTime() : Infinity;
    const db = b.expectedDeliveryDate ? new Date(b.expectedDeliveryDate).getTime() : Infinity;
    return da - db;
  });

  return (
    <div>
      <div className="page-header"><div><h1>Fila de Produção</h1><div className="desc">Itens de pedidos aprovados com saldo a produzir, ordenados por prazo</div></div></div>
      <div className="card">
        <table>
          <thead><tr><th>Pedido</th><th>Produto</th><th>Prioridade</th><th>Entrega prevista</th><th>Pendente produzir</th><th></th></tr></thead>
          <tbody>
            {sorted.map((r) => (
              <tr key={r.item.id}>
                <td style={{ fontWeight: 700 }}>{r.orderNumber}</td>
                <td>{r.productName}</td>
                <td><Badge className={r.orderPriority === "URGENTE" ? "badge-red" : r.orderPriority === "ALTA" ? "badge-orange" : "badge-gray"}>{r.orderPriority}</Badge></td>
                <td>{formatDate(r.expectedDeliveryDate)}</td>
                <td>{formatQty(r.pendingToProduce)}</td>
                <td><button className="btn btn-sm" onClick={() => navigate(`/producao/apontamento?orderItemId=${r.item.id}`)}>Apontar produção</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && sorted.length === 0 && <div className="empty-state">Fila de produção vazia — nenhum item pendente.</div>}
      </div>
    </div>
  );
}
