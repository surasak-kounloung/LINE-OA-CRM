import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import { getToken } from "./api";
import Layout from "./components/Layout";
import { ResourceProvider } from "./hooks/useResourceContext";
import LoginPage from "./pages/LoginPage";
import PromotionsPage from "./pages/PromotionsPage";
import PromotionEditPage from "./pages/PromotionEditPage";
import ServicesPage from "./pages/ServicesPage";
import ServiceEditPage from "./pages/ServiceEditPage";
import BranchesPage from "./pages/BranchesPage";
import BranchEditPage from "./pages/BranchEditPage";
import RegionsPage from "./pages/RegionsPage";

function Private({ children }) {
  return getToken() ? <Layout>{children}</Layout> : <Navigate to="/login" replace />;
}

// resource ที่มีหน้ารายการ + หน้าแก้ไข: ครอบ provider ครั้งเดียวที่ "/<name>/*"
// เพื่อให้ draft อยู่รอดตอนสลับไปมาระหว่างรายการกับหน้าแก้ไข (#/<name>/<index>)
function Section({ name, List, Edit, withRegions = false }) {
  return (
    <Private>
      <ResourceProvider name={name} withRegions={withRegions}>
        <Routes>
          <Route index element={<List />} />
          <Route path=":index" element={<Edit />} />
        </Routes>
      </ResourceProvider>
    </Private>
  );
}

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/promotions/*" element={<Section name="promotions" List={PromotionsPage} Edit={PromotionEditPage} />} />
        <Route path="/services/*" element={<Section name="services" List={ServicesPage} Edit={ServiceEditPage} />} />
        <Route path="/branches/*" element={<Section name="branches" List={BranchesPage} Edit={BranchEditPage} withRegions />} />
        <Route path="/regions" element={<Private><RegionsPage /></Private>} />
        <Route path="*" element={<Navigate to="/promotions" replace />} />
      </Routes>
    </HashRouter>
  );
}
