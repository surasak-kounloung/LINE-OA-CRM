import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import { getToken } from "./api";
import Layout from "./components/Layout";
import LoginPage from "./pages/LoginPage";
import PlaceholderPage from "./pages/PlaceholderPage";
import PromotionsPage from "./pages/PromotionsPage";

function Private({ children }) {
  return getToken() ? <Layout>{children}</Layout> : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/promotions" element={<Private><PromotionsPage /></Private>} />
        <Route path="/services" element={<Private><PlaceholderPage title="บริการ" /></Private>} />
        <Route path="/branches" element={<Private><PlaceholderPage title="สาขา" /></Private>} />
        <Route path="/branches/:id" element={<Private><PlaceholderPage title="แก้ไขสาขา" /></Private>} />
        <Route path="/regions" element={<Private><PlaceholderPage title="ภูมิภาค" /></Private>} />
        <Route path="*" element={<Navigate to="/promotions" replace />} />
      </Routes>
    </HashRouter>
  );
}
