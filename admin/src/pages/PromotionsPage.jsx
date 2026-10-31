import { Link } from "react-router-dom";
import { useResourceContext } from "../hooks/useResourceContext";
import PageHeader from "../components/PageHeader";
import UnsavedBar from "../components/UnsavedBar";
import ImagePreview from "../components/ImagePreview";
import RowControls from "../components/RowControls";
import FlexPreviewButton from "../components/FlexPreviewButton";
import { move, removeAt } from "../utils";

export const emptyPromotion = (list) => ({
  id: `promotion-${list.length + 1}-${Date.now().toString(36)}`,
  image: "", title: "", lines: [""], inquiryText: "สอบถามโปร", hot: false,
});

export default function PromotionsPage() {
  const resource = useResourceContext();
  const { draft, setDraft, errors, status, message } = resource;
  if (status === "loading" || draft === null) return <p className="muted">กำลังโหลด...</p>;
  if (status === "error") return <p className="field-error">{message}</p>;

  const hasError = (i) => errors.some((e) => e.path.startsWith(`[${i}]`));

  function addPromotion() {
    setDraft([...draft, emptyPromotion(draft)]);
    window.location.hash = `#/promotions/${draft.length}`;
  }

  return (
    <div>
      <PageHeader
        title="โปรโมชั่นล่าสุด"
        subtitle={`${draft.length} รายการ · ตอบเมื่อผู้ใช้ส่ง "โปรโมชั่นล่าสุด" · ลำดับในตาราง = ลำดับใน carousel`}
        actions={<><FlexPreviewButton trigger="โปรโมชั่นล่าสุด" /><button type="button" className="primary" onClick={addPromotion}>+ เพิ่มโปรโมชั่น</button></>}
      />
      <UnsavedBar resource={resource} />
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th style={{ width: 72 }}>รูป</th><th>โปรโมชั่น</th><th>ข้อความปุ่มสอบถาม</th><th className="num">HOT</th><th style={{ width: 200 }}></th></tr></thead>
          <tbody>
            {draft.length === 0 && <tr><td colSpan={5} className="empty">ยังไม่มีโปรโมชั่น กด "+ เพิ่มโปรโมชั่น" เพื่อเริ่ม</td></tr>}
            {draft.map((p, i) => (
              <tr key={i} className={hasError(i) ? "has-error" : ""}>
                <td className="thumb-sm"><ImagePreview url={p.image} size={48} /></td>
                <td>
                  <div className="cell-main"><Link to={`/promotions/${i}`}>{p.title || "(ยังไม่ตั้งชื่อ)"}</Link>{hasError(i) && <span className="badge">มีข้อผิดพลาด</span>}</div>
                  <div className="cell-sub">{(p.lines || []).filter(Boolean).join(" · ") || "—"}</div>
                </td>
                <td className="muted">{p.inquiryText}</td>
                <td className="num">{p.hot ? <span className="badge" style={{ margin: 0 }}>HOT!</span> : <span className="muted">—</span>}</td>
                <td>
                  <div className="actions">
                    <Link to={`/promotions/${i}`} className="btn sm">แก้ไข</Link>
                    <RowControls index={i} length={draft.length} onMove={(a, b) => setDraft(move(draft, a, b))} onDelete={(k) => setDraft(removeAt(draft, k))} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
