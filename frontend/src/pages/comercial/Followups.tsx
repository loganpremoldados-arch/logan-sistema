import { useNavigate } from "react-router-dom";
import { useFetch } from "../../lib/useApi";
import { formatDate } from "../../lib/format";

interface Followups { overdue: any[]; today: any[]; next7: any[]; noNextAction: any[]; noReturnProposals: any[] }

function List({ title, items, navigate, badge }: { title: string; items: any[]; navigate: (p: string) => void; badge: string }) {
  return (
    <div className="card card-pad" style={{ marginBottom: 14 }}>
      <div className="section-title">{title} <span className="badge badge-gray">{items.length}</span></div>
      {items.length === 0 && <div className="empty-state" style={{ padding: 16 }}>Nenhum registro.</div>}
      <div className="attention-list">
        {items.map((o) => (
          <div key={o.id} className="attention-item" onClick={() => navigate(`/comercial/oportunidades/${o.id}`)} style={{ cursor: "pointer" }}>
            <span>{o.code} — {o.contactName ?? "Cliente"} {o.nextAction ? `· ${o.nextAction}` : ""}</span>
            <span className={`badge ${badge}`}>{formatDate(o.nextContactDate)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function Followups() {
  const { data } = useFetch<Followups>("/opportunities/followups");
  const navigate = useNavigate();
  if (!data) return <p>Carregando...</p>;

  return (
    <div>
      <div className="page-header"><div><h1>Follow-ups</h1><div className="desc">Painel de acompanhamento comercial</div></div></div>
      <List title="Atrasados" items={data.overdue} navigate={navigate} badge="badge-red" />
      <List title="Para hoje" items={data.today} navigate={navigate} badge="badge-orange" />
      <List title="Próximos 7 dias" items={data.next7} navigate={navigate} badge="badge-yellow" />
      <List title="Sem próxima ação definida" items={data.noNextAction} navigate={navigate} badge="badge-gray" />
      <List title="Propostas enviadas sem retorno agendado" items={data.noReturnProposals} navigate={navigate} badge="badge-gray" />
    </div>
  );
}
