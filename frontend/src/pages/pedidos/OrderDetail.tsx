import { useState } from "react";
import { useParams } from "react-router-dom";
import { useFetch } from "../../lib/useApi";
import { api, ApiError } from "../../lib/api";
import { formatBRL, formatDate, formatDateTime, formatQty } from "../../lib/format";
import { orderCommercialLabels, orderFinancialLabels, orderOperationalLabels, deadlineLabels } from "../../lib/labels";
import { Badge } from "../../components/Badge";
import { Modal } from "../../components/Modal";

interface Detail {
  order: any; customer: any; items: { item: any; productName: string; productCode: string }[];
  statusEvents: any[]; production: any[]; deadline: { situation: string; details: string; daysRemaining: number | null; estimatedDaysToFinish: number | null };
}

const FINANCIAL_OPTIONS = ["NAO_FATURADO", "AGUARDANDO_PAGAMENTO", "PARCIALMENTE_PAGO", "PAGO", "VENCIDO", "COM_SALDO_PENDENTE"];
const OPERATIONAL_OPTIONS = Object.keys(orderOperationalLabels);

export function OrderDetail() {
  const { id } = useParams();
  const { data, reload } = useFetch<Detail>(`/orders/${id}`, [id]);
  const [error, setError] = useState<string | null>(null);
  const [deliverItem, setDeliverItem] = useState<{ id: string; productName: string; pending: number; unit: string } | null>(null);
  const [busy, setBusy] = useState(false);

  if (!data) return <p>Carregando...</p>;
  const { order, customer, items, statusEvents, production, deadline } = data;
  const dl = deadlineLabels[deadline.situation] ?? { label: deadline.situation, badge: "badge-gray" };

  async function confirmOrder() {
    setBusy(true); setError(null);
    try { await api.post(`/orders/${order.id}/confirm`); reload(); }
    catch (e) { setError(e instanceof ApiError ? e.message : "Erro ao confirmar pedido."); }
    finally { setBusy(false); }
  }

  async function changeStatus(dimension: "FINANCEIRO" | "OPERACIONAL", status: string) {
    setError(null);
    try { await api.post(`/orders/${order.id}/status`, { dimension, status }); reload(); }
    catch (e) { setError(e instanceof ApiError ? e.message : "Erro ao atualizar situação."); }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Pedido {order.number}</h1>
          <div className="desc">{customer?.name} · {formatDate(order.closingDate)}</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {order.commercialStatus !== "APROVADO" && order.commercialStatus !== "ENCERRADO" && (
            <button className="btn btn-primary" onClick={confirmOrder} disabled={busy}>Confirmar / aprovar pedido</button>
          )}
        </div>
      </div>
      {error && <div className="error-text">{error}</div>}

      <div className="stat-grid">
        <div className="stat-card"><div className="label">Situação comercial</div><div className="value" style={{ fontSize: 15 }}><Badge>{orderCommercialLabels[order.commercialStatus]}</Badge></div></div>
        <div className="stat-card"><div className="label">Situação financeira</div><div className="value" style={{ fontSize: 15 }}>
          <select value={order.financialStatus} onChange={(e) => changeStatus("FINANCEIRO", e.target.value)}>
            {FINANCIAL_OPTIONS.map((s) => <option key={s} value={s}>{orderFinancialLabels[s]}</option>)}
          </select>
        </div></div>
        <div className="stat-card"><div className="label">Situação operacional</div><div className="value" style={{ fontSize: 15 }}>
          <select value={order.operationalStatus} onChange={(e) => changeStatus("OPERACIONAL", e.target.value)}>
            {OPERATIONAL_OPTIONS.map((s) => <option key={s} value={s}>{orderOperationalLabels[s]}</option>)}
          </select>
        </div></div>
        <div className="stat-card"><div className="label">Prazo</div><div className="value" style={{ fontSize: 15 }}><Badge className={dl.badge}>{dl.label}</Badge></div></div>
      </div>
      <p style={{ color: "var(--cinza-medio)", fontSize: 12.5, marginTop: -8, marginBottom: 18 }}>{deadline.details}</p>

      <div className="grid-2">
        <div className="card card-pad">
          <div className="form-grid">
            <div><label>Valor bruto</label>{formatBRL(order.grossValue)}</div>
            <div><label>Desconto</label>{formatBRL(order.discountValue)}</div>
            <div><label>Valor líquido</label><strong>{formatBRL(order.netValue)}</strong></div>
            <div><label>Recebido</label>{formatBRL(order.receivedValue)}</div>
            <div><label>Prazo acordado</label>{order.agreedDeadlineDays ? `${order.agreedDeadlineDays} dias` : "—"}</div>
            <div><label>Entrega prevista</label>{formatDate(order.expectedDeliveryDate)}</div>
            <div><label>Modalidade</label>{order.deliveryMode === "ENTREGA" ? "Entrega" : "Retirada"}</div>
            <div><label>Forma de pagamento</label>{order.paymentMethod ?? "—"}</div>
          </div>
        </div>
        <div className="card card-pad">
          <div className="section-title">Linha do tempo</div>
          <div className="timeline">
            {statusEvents.map((e) => (
              <div key={e.id} className="timeline-item">
                <div style={{ fontWeight: 600 }}>{e.dimension}: {e.fromStatus ? `${e.fromStatus} → ` : ""}{e.toStatus}</div>
                <div style={{ color: "var(--cinza-medio)", fontSize: 12 }}>{formatDateTime(e.createdAt)}</div>
              </div>
            ))}
            {statusEvents.length === 0 && <div className="empty-state">Sem eventos ainda.</div>}
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 14 }}>
        <div className="card-pad" style={{ paddingBottom: 0 }}><div className="section-title">Itens do pedido</div></div>
        <table>
          <thead>
            <tr>
              <th>Produto</th><th>Solicitado</th><th>Necessário produzir</th><th>Produzido</th><th>Aprovado</th>
              <th>Separado</th><th>Entregue</th><th>Pendente entregar</th><th>Valor</th><th></th>
            </tr>
          </thead>
          <tbody>
            {items.map(({ item, productName }) => {
              const pending = Number(item.quantityRequested) - Number(item.quantityDelivered);
              return (
                <tr key={item.id}>
                  <td style={{ fontWeight: 600 }}>{productName}</td>
                  <td>{formatQty(item.quantityRequested)} {item.unitCode}</td>
                  <td>{formatQty(item.quantityNeeded)}</td>
                  <td>{formatQty(item.quantityProduced)}</td>
                  <td>{formatQty(item.quantityApproved)}</td>
                  <td>{formatQty(item.quantitySeparated)}</td>
                  <td>{formatQty(item.quantityDelivered)}</td>
                  <td>{formatQty(pending)}</td>
                  <td>{formatBRL(item.totalValue)}</td>
                  <td>
                    {pending > 0 && Number(item.quantityApproved) > 0 && (
                      <button className="btn btn-sm" onClick={() => setDeliverItem({ id: item.id, productName, pending, unit: item.unitCode })}>Registrar entrega</button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="card card-pad" style={{ marginTop: 14 }}>
        <div className="section-title">Produção vinculada a este pedido</div>
        <table>
          <thead><tr><th>Data</th><th>Produzido</th><th>Aprovado</th><th>Rejeitado</th><th>Observações</th></tr></thead>
          <tbody>
            {production.map((p) => (
              <tr key={p.id}><td>{formatDate(p.date)}</td><td>{formatQty(p.quantityProduced)}</td><td>{formatQty(p.quantityApproved)}</td><td>{formatQty(p.quantityRejected)}</td><td>{p.notes ?? "—"}</td></tr>
            ))}
          </tbody>
        </table>
        {production.length === 0 && <div className="empty-state">Nenhum apontamento de produção vinculado ainda.</div>}
      </div>

      {deliverItem && (
        <DeliverModal orderId={order.id} item={deliverItem} onClose={() => setDeliverItem(null)} onDone={() => { setDeliverItem(null); reload(); }} />
      )}
    </div>
  );
}

function DeliverModal({ orderId, item, onClose, onDone }: { orderId: string; item: { id: string; productName: string; pending: number; unit: string }; onClose: () => void; onDone: () => void }) {
  const [qty, setQty] = useState(String(item.pending));
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    setError(null);
    try {
      await api.post(`/orders/${orderId}/deliver-item`, { orderItemId: item.id, quantity: Number(qty) });
      onDone();
    } catch (e) { setError(e instanceof ApiError ? e.message : "Erro ao registrar entrega."); }
  }

  return (
    <Modal title={`Registrar entrega — ${item.productName}`} onClose={onClose} footer={
      <><button className="btn" onClick={onClose}>Cancelar</button><button className="btn btn-primary" onClick={confirm}>Confirmar entrega</button></>
    }>
      <label>Quantidade entregue agora ({item.unit}) — pendente: {item.pending}</label>
      <input type="number" value={qty} onChange={(e) => setQty(e.target.value)} style={{ width: "100%" }} />
      {error && <div className="error-text">{error}</div>}
    </Modal>
  );
}
