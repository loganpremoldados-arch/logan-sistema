import { useState } from "react";
import { useFetch } from "../../lib/useApi";
import { api, ApiError } from "../../lib/api";

interface Product { id: string; code: string; name: string; unitCode: string; active: boolean }
interface SimpleRow { id: string; name: string; active?: boolean }
interface Unit { code: string; description: string }

export function Cadastros() {
  const [tab, setTab] = useState(0);
  return (
    <div>
      <div className="page-header"><div><h1>Cadastros</h1><div className="desc">Produtos, unidades, categorias, canais e motivos de perda — sem precisar alterar código</div></div></div>
      <div className="tabs">
        {["Produtos", "Unidades", "Categorias", "Canais de venda", "Motivos de perda"].map((t, i) => (
          <button key={t} className={tab === i ? "active" : ""} onClick={() => setTab(i)}>{t}</button>
        ))}
      </div>
      {tab === 0 && <ProductsTab />}
      {tab === 1 && <SimpleTab endpoint="/catalog/units" nameField="code" label="Código" extraField="description" extraLabel="Descrição" idIsCode />}
      {tab === 2 && <SimpleTab endpoint="/catalog/categories" nameField="name" label="Nome da categoria" />}
      {tab === 3 && <SimpleTab endpoint="/catalog/channels" nameField="name" label="Nome do canal" />}
      {tab === 4 && <SimpleTab endpoint="/catalog/loss-reasons" nameField="name" label="Motivo de perda" />}
    </div>
  );
}

function ProductsTab() {
  const { data: products, reload } = useFetch<Product[]>("/catalog/products");
  const { data: units } = useFetch<Unit[]>("/catalog/units");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [unitCode, setUnitCode] = useState("UN");
  const [error, setError] = useState<string | null>(null);

  async function add() {
    try {
      await api.post("/catalog/products", { code, name, unitCode });
      setName(""); setCode(""); reload();
    } catch (e) { setError(e instanceof ApiError ? e.message : "Erro ao criar produto."); }
  }

  return (
    <div className="card card-pad">
      <div className="filters-bar">
        <input placeholder="Código" value={code} onChange={(e) => setCode(e.target.value)} style={{ width: 120 }} />
        <input placeholder="Nome do produto" value={name} onChange={(e) => setName(e.target.value)} style={{ width: 260 }} />
        <select value={unitCode} onChange={(e) => setUnitCode(e.target.value)}>
          {units?.map((u) => <option key={u.code} value={u.code}>{u.code} — {u.description}</option>)}
        </select>
        <button className="btn btn-primary" onClick={add} disabled={!code || !name}>+ Adicionar</button>
      </div>
      {error && <div className="error-text">{error}</div>}
      <table>
        <thead><tr><th>Código</th><th>Nome</th><th>Unidade</th><th>Situação</th></tr></thead>
        <tbody>
          {products?.map((p) => (
            <tr key={p.id}><td>{p.code}</td><td style={{ fontWeight: 600 }}>{p.name}</td><td>{p.unitCode}</td><td>{p.active ? "Ativo" : "Inativo"}</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SimpleTab({
  endpoint, nameField, label, extraField, extraLabel, idIsCode,
}: { endpoint: string; nameField: string; label: string; extraField?: string; extraLabel?: string; idIsCode?: boolean }) {
  const { data, reload } = useFetch<any[]>(endpoint);
  const [value, setValue] = useState("");
  const [extra, setExtra] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function add() {
    try {
      const payload: any = { [nameField]: value };
      if (extraField) payload[extraField] = extra;
      await api.post(endpoint, payload);
      setValue(""); setExtra(""); reload();
    } catch (e) { setError(e instanceof ApiError ? e.message : "Erro ao salvar."); }
  }

  return (
    <div className="card card-pad">
      <div className="filters-bar">
        <input placeholder={label} value={value} onChange={(e) => setValue(e.target.value)} style={{ width: 240 }} />
        {extraField && <input placeholder={extraLabel} value={extra} onChange={(e) => setExtra(e.target.value)} style={{ width: 240 }} />}
        <button className="btn btn-primary" onClick={add} disabled={!value}>+ Adicionar</button>
      </div>
      {error && <div className="error-text">{error}</div>}
      <table>
        <thead><tr><th>{label}</th>{extraLabel && <th>{extraLabel}</th>}</tr></thead>
        <tbody>
          {data?.map((row) => (
            <tr key={idIsCode ? row.code : row.id}>
              <td style={{ fontWeight: 600 }}>{row[nameField]}</td>
              {extraField && <td>{row[extraField]}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
