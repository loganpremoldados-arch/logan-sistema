import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";

const MENU: { group: string; items: { to: string; label: string }[] }[] = [
  { group: "", items: [{ to: "/", label: "Visão Geral" }] },
  {
    group: "Comercial",
    items: [
      { to: "/comercial/oportunidades", label: "Oportunidades" },
      { to: "/comercial/funil", label: "Funil de vendas" },
      { to: "/comercial/followups", label: "Follow-ups" },
      { to: "/comercial/propostas", label: "Propostas" },
    ],
  },
  { group: "", items: [{ to: "/clientes", label: "Clientes" }] },
  {
    group: "Pedidos",
    items: [
      { to: "/pedidos", label: "Todos os pedidos" },
      { to: "/pedidos?filtro=atrasados", label: "Pedidos atrasados" },
      { to: "/pedidos?filtro=prontos", label: "Pedidos prontos" },
    ],
  },
  {
    group: "Produção",
    items: [
      { to: "/producao/fila", label: "Fila de produção" },
      { to: "/producao/apontamento", label: "Apontamento diário" },
      { to: "/producao/capacidade", label: "Capacidade produtiva" },
      { to: "/producao/comparativo", label: "Planejado x Realizado" },
    ],
  },
  { group: "", items: [{ to: "/estoque", label: "Estoque" }] },
  {
    group: "Gestão",
    items: [
      { to: "/cadastros", label: "Cadastros" },
      { to: "/migracao", label: "Validação da Migração" },
      { to: "/usuarios", label: "Usuários" },
    ],
  },
];

export function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const currentFull = location.pathname + location.search;
  const initials = (user?.name ?? "?").split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => { setMenuOpen(false); }, [location.pathname, location.search]);

  return (
    <div className="app-shell">
      <div className={`sidebar-backdrop${menuOpen ? " open" : ""}`} onClick={() => setMenuOpen(false)} />
      <aside className={`sidebar${menuOpen ? " open" : ""}`}>
        <div className="sidebar-brand">
          <div className="logo">LOGAN <span>|</span> Gestão Integrada</div>
          <div className="sub">Logan Pré-Moldados</div>
        </div>
        <nav>
          {MENU.map((section, idx) => (
            <div key={idx}>
              {section.group && <div className="group-title">{section.group}</div>}
              {section.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={() => {
                    const isActive = item.to.includes("?") ? currentFull === item.to : location.pathname === item.to;
                    return `navlink${isActive ? " active" : ""}`;
                  }}
                  end={item.to === "/"}
                >
                  {item.label}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
      </aside>
      <div className="main-area">
        <header className="topbar">
          <button className="menu-toggle" aria-label="Abrir menu" onClick={() => setMenuOpen((v) => !v)}>☰</button>
          <div className="search">
            <input
              placeholder="Buscar cliente, pedido, oportunidade, proposta, produto..."
              onKeyDown={(e) => {
                if (e.key === "Enter") navigate(`/busca?q=${encodeURIComponent((e.target as HTMLInputElement).value)}`);
              }}
            />
          </div>
          <div className="user">
            <div style={{ textAlign: "right" }}>
              <div style={{ fontWeight: 700 }}>{user?.name}</div>
              <div style={{ color: "var(--cinza-medio)", fontSize: 11.5 }}>{user?.role}</div>
            </div>
            <div className="avatar">{initials}</div>
            <button className="btn btn-ghost btn-sm" onClick={logout}>Sair</button>
          </div>
        </header>
        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
