import { Link } from "react-router-dom";

// หัวหน้า: breadcrumb + ชื่อหน้า + คำอธิบายสั้น + ปุ่ม action มุมขวา
// crumbs: [{ to, label }] รายการสุดท้ายไม่ต้องมี to
export default function PageHeader({ crumbs = [], title, subtitle, actions }) {
  return (
    <div className="page-head">
      <div>
        {crumbs.length > 0 && (
          <div className="crumb">
            {crumbs.map((c, i) => (
              <span key={i}>
                {i > 0 && <span style={{ margin: "0 0.35rem" }}>/</span>}
                {c.to ? <Link to={c.to}>{c.label}</Link> : <span>{c.label}</span>}
              </span>
            ))}
          </div>
        )}
        <h1>{title}</h1>
        {subtitle && <div className="page-sub">{subtitle}</div>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </div>
  );
}
