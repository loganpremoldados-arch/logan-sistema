import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./lib/auth";
import { Layout } from "./components/Layout";
import { Login } from "./pages/Login";
import { Dashboard } from "./pages/Dashboard";
import { ClientesList } from "./pages/clientes/ClientesList";
import { ClienteDetail } from "./pages/clientes/ClienteDetail";
import { OpportunitiesList } from "./pages/comercial/OpportunitiesList";
import { FunilKanban } from "./pages/comercial/FunilKanban";
import { OpportunityDetail } from "./pages/comercial/OpportunityDetail";
import { Followups } from "./pages/comercial/Followups";
import { ProposalsList } from "./pages/propostas/ProposalsList";
import { ProposalDetail } from "./pages/propostas/ProposalDetail";
import { OrdersList } from "./pages/pedidos/OrdersList";
import { OrderDetail } from "./pages/pedidos/OrderDetail";
import { ProductionQueue } from "./pages/producao/Queue";
import { Apontamento } from "./pages/producao/Apontamento";
import { Capacity } from "./pages/producao/Capacity";
import { Comparativo } from "./pages/producao/Comparativo";
import { Inventory } from "./pages/Inventory";
import { MigrationValidation } from "./pages/migracao/MigrationValidation";
import { Users } from "./pages/usuarios/Users";
import { Cadastros } from "./pages/cadastros/Cadastros";
import { Search } from "./pages/Search";

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div style={{ padding: 40 }}>Carregando...</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
        <Route index element={<Dashboard />} />
        <Route path="clientes" element={<ClientesList />} />
        <Route path="clientes/:id" element={<ClienteDetail />} />
        <Route path="comercial/oportunidades" element={<OpportunitiesList />} />
        <Route path="comercial/oportunidades/:id" element={<OpportunityDetail />} />
        <Route path="comercial/funil" element={<FunilKanban />} />
        <Route path="comercial/followups" element={<Followups />} />
        <Route path="comercial/propostas" element={<ProposalsList />} />
        <Route path="comercial/propostas/:id" element={<ProposalDetail />} />
        <Route path="pedidos" element={<OrdersList />} />
        <Route path="pedidos/:id" element={<OrderDetail />} />
        <Route path="producao/fila" element={<ProductionQueue />} />
        <Route path="producao/apontamento" element={<Apontamento />} />
        <Route path="producao/capacidade" element={<Capacity />} />
        <Route path="producao/comparativo" element={<Comparativo />} />
        <Route path="estoque" element={<Inventory />} />
        <Route path="migracao" element={<MigrationValidation />} />
        <Route path="usuarios" element={<Users />} />
        <Route path="cadastros" element={<Cadastros />} />
        <Route path="busca" element={<Search />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
