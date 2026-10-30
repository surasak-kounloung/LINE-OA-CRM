import { Link } from "react-router-dom";
import { useResourceContext } from "../hooks/useResourceContext";
import PageHeader from "../components/PageHeader";
import UnsavedBar from "../components/UnsavedBar";
import ImagePreview from "../components/ImagePreview";
import RowControls from "../components/RowControls";
import FlexPreviewButton from "../components/FlexPreviewButton";
import { move, removeAt, MAX_PRICE_IMAGES } from "../utils";

export const emptyService = (list) => ({
  id: `service-${list.length + 1}-${Date.now().toString(36)}`,
  image: "", title: "", subtitle: "", actionText: "สอบถามโปรโมชั่น", hot: true, priceImages: [],
});

export default function ServicesPage() {
  const resource = useResourceContext();
  const { draft, setDraft, errors, status, message } = resource;
  if (status === "loading" || draft === null) return <p className="muted">กำลังโหลด...</p>;
  if (status === "error") return <p className="field-error">{message}</p>;

  const hasError = (i) => errors.some((e) => e.path.startsWith(`[${i}]`));

  function addService() {
    setDraft([...draft, emptyService(draft)]);
    window.location.hash = `#/services/${draft.length}`;
  }

  return (
    <div>
      <PageHeader
        title="บริการทั้งหมด"
        subtitle={`${draft.length} รายการ · ตอบเมื่อผู้ใช้ส่ง "บริการทั้งหมด" · ลำดับในตาราง = ลำดับใน carousel`}
        actions={<><FlexPreviewButton trigger="บริการทั้งหมด" /><button type="button" className="primary" onClick={addService}>+ เพิ่มบริการ</button></>}
      />
      <UnsavedBar resource={resource} />
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th style={{ width: 72 }}>รูป</th><th>บริการ</th><th>ข้อความเมื่อกดปุ่ม</th><th className="num">รูปราคา</th><th className="num">HOT</th><th style={{ width: 200 }}></th></tr></thead>
          <tbody>
            {draft.length === 0 && <tr><td colSpan={6} className="empty">ยังไม่มีบริการ กด "+ เพิ่มบริการ" เพื่อเริ่ม</td></tr>}
            {draft.map((s, i) => {
              const n = (s.priceImages || []).length;
              return (
                <tr key={i} className={hasError(i) ? "has-error" : ""}>
                  <td className="thumb-sm"><ImagePreview url={s.image} size={48} /></td>
                  <td>
                    <div className="cell-main"><Link to={`/services/${i}`}>{s.title || "(ยังไม่ตั้งชื่อ)"}</Link>{hasError(i) && <span className="badge">มีข้อผิดพลาด</span>}</div>
                    <div className="cell-sub">{s.subtitle || "—"}</div>
                  </td>
                  <td className="muted">{s.actionText}</td>
                  <td className="num">
                    {n === 0 ? <span className="badge muted" style={{ margin: 0 }}>ตอบข้อความต่อท้ายอย่างเดียว</span>
                      : n > MAX_PRICE_IMAGES ? <span className="badge" style={{ margin: 0 }}>{n} รูป เกิน {MAX_PRICE_IMAGES}</span>
                      : <span className="badge info" style={{ margin: 0 }}>{n} รูป</span>}
                  </td>
                  <td className="num">{s.hot ? <span className="badge" style={{ margin: 0 }}>HOT!</span> : <span className="muted">—</span>}</td>
                  <td>
                    <div className="actions">
                      <Link to={`/services/${i}`} className="btn sm">แก้ไข</Link>
                      <RowControls index={i} length={draft.length} onMove={(a, b) => setDraft(move(draft, a, b))} onDelete={(k) => setDraft(removeAt(draft, k))} />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
