import { Link } from "react-router-dom";
import { confirmDiscard } from "../dirtyState";

// หัวหน้า: breadcrumb + ชื่อหน้า + คำอธิบายสั้น + ปุ่ม action มุมขวา
// crumbs: [{ to, label }] รายการสุดท้ายไม่ต้องมี to
// guardCrumbs: ถามก่อนออกเมื่อมีการแก้ที่ยังไม่บันทึก (เปิดเฉพาะหน้าที่เก็บ draft ในหน้าเอง)
export default function PageHeader({ crumbs = [], title, subtitle, actions, guardCrumbs = false }) {
  return (
    <div className="page-head">
      <div>
        {crumbs.length > 0 && (
          <div className="crumb">
            {crumbs.map((c, i) => (
              <span key={i}>
                {i > 0 && <span style={{ margin: "0 0.35rem" }}>/</span>}
                {c.to ? <Link to={c.to} onClick={guardCrumbs ? (e) => { if (!confirmDiscard()) e.preventDefault(); } : undefined}>{c.label}</Link> : <span>{c.label}</span>}
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
