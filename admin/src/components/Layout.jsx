import { NavLink, useNavigate } from "react-router-dom";
import { clearToken } from "../api";

const links = [
  ["/promotions", "โปรโมชั่น"],
  ["/services", "บริการ"],
  ["/branches", "สาขา"],
  ["/regions", "ภูมิภาค"],
];

export default function Layout({ children }) {
  const navigate = useNavigate();
  function logout() {
    clearToken();
    navigate("/login");
  }
  return (
    <div className="layout">
      <header className="topbar">
        <strong>VSQ LINE Admin</strong>
        <nav>
          {links.map(([to, label]) => (
            <NavLink key={to} to={to} className={({ isActive }) => (isActive ? "active" : "")}>{label}</NavLink>
          ))}
        </nav>
        <button type="button" className="link" onClick={logout}>ออกจากระบบ</button>
      </header>
      <main className="content">{children}</main>
    </div>
  );
}
