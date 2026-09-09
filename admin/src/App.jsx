import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import { getToken } from "./api";
import Layout from "./components/Layout";
import LoginPage from "./pages/LoginPage";
import PromotionsPage from "./pages/PromotionsPage";
import ServicesPage from "./pages/ServicesPage";
import { BranchesProvider } from "./hooks/useBranches";
import BranchesPage from "./pages/BranchesPage";
import BranchEditPage from "./pages/BranchEditPage";
import RegionsPage from "./pages/RegionsPage";

function Private({ children }) {
  return getToken() ? <Layout>{children}</Layout> : <Navigate to="/login" replace />;
}

function BranchRoutes() {
  return (
    <Routes>
      <Route index element={<BranchesPage />} />
      <Route path=":index" element={<BranchEditPage />} />
    </Routes>
  );
}

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/promotions" element={<Private><PromotionsPage /></Private>} />
        <Route path="/services" element={<Private><ServicesPage /></Private>} />
        <Route path="/branches/*" element={<Private><BranchesProvider><BranchRoutes /></BranchesProvider></Private>} />
        <Route path="/regions" element={<Private><RegionsPage /></Private>} />
        <Route path="*" element={<Navigate to="/promotions" replace />} />
      </Routes>
    </HashRouter>
  );
}
