import { useSearchParams, useNavigate } from "react-router-dom";
import { useFetch } from "../lib/useApi";

export function Search() {
  const [params] = useSearchParams();
  const q = params.get("q") ?? "";
  const navigate = useNavigate();
  const { data: customers } = useFetch<any[]>(`/customers?q=${encodeURIComponent(q)}`, [q]);
  const { data: opportunities } = useFetch<any[]>("/opportunities", []);
  const { data: orders } = useFetch<any[]>("/orders", []);

  const filteredOpps = (opportunities ?? []).filter((r) => r.opportunity.code.toLowerCase().includes(q.toLowerCase()) || r.customerName?.toLowerCase().includes(q.toLowerCase()));
  const filteredOrders = (orders ?? []).filter((r) => r.order.number.toLowerCase().includes(q.toLowerCase()) || r.customerName?.toLowerCase().includes(q.toLowerCase()));

  return (
    <div>
      <div className="page-header"><div><h1>Busca: "{q}"</h1></div></div>
      <div className="section-title">Clientes</div>
      <div className="card" style={{ marginBottom: 16 }}>
        <table><tbody>
          {customers?.slice(0, 10).map((c) => <tr key={c.id} className="clickable" onClick={() => navigate(`/clientes/${c.id}`)}><td>{c.code}</td><td>{c.name}</td></tr>)}
        </tbody></table>
      </div>
      <div className="section-title">Oportunidades</div>
      <div className="card" style={{ marginBottom: 16 }}>
        <table><tbody>
          {filteredOpps.slice(0, 10).map((r) => <tr key={r.opportunity.id} className="clickable" onClick={() => navigate(`/comercial/oportunidades/${r.opportunity.id}`)}><td>{r.opportunity.code}</td><td>{r.customerName}</td></tr>)}
        </tbody></table>
      </div>
      <div className="section-title">Pedidos</div>
      <div className="card">
        <table><tbody>
          {filteredOrders.slice(0, 10).map((r) => <tr key={r.order.id} className="clickable" onClick={() => navigate(`/pedidos/${r.order.id}`)}><td>{r.order.number}</td><td>{r.customerName}</td></tr>)}
        </tbody></table>
      </div>
    </div>
  );
}
