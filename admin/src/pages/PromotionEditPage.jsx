import { Link, useParams } from "react-router-dom";
import { useResourceContext } from "../hooks/useResourceContext";
import PageHeader from "../components/PageHeader";
import UnsavedBar from "../components/UnsavedBar";
import FieldError from "../components/FieldError";
import ImagePreview from "../components/ImagePreview";
import RowControls from "../components/RowControls";
import FlexPreviewButton from "../components/FlexPreviewButton";
import { move, removeAt } from "../utils";

export default function PromotionEditPage() {
  const { index } = useParams();
  const resource = useResourceContext();
  const { draft, setDraft, errors, status, message } = resource;
  if (status === "loading" || draft === null) return <p className="muted">กำลังโหลด...</p>;
  if (status === "error") return <p className="field-error">{message}</p>;

  const i = Number(index);
  const p = draft[i];
  if (!Number.isInteger(i) || !p) return <p>ไม่พบโปรโมชั่น <Link to="/promotions">กลับไปรายการ</Link></p>;
  const path = (f) => `[${i}].${f}`;
  const update = (patch) => setDraft(draft.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const lines = p.lines || [];
  const updateLine = (k, value) => update({ lines: lines.map((l, j) => (j === k ? value : l)) });

  return (
    <div>
      <PageHeader
        crumbs={[{ to: "/promotions", label: "โปรโมชั่น" }, { label: p.title || "โปรโมชั่นใหม่" }]}
        title={p.title || "โปรโมชั่นใหม่"}
        subtitle={`รายการที่ ${i + 1} จาก ${draft.length}`}
        actions={<FlexPreviewButton trigger="โปรโมชั่นล่าสุด" />}
      />
      <UnsavedBar resource={resource} />
      <div className="edit-grid">
        <div>
          <div className="card">
            <div className="card-title">ข้อมูลการ์ด</div>
            <div className="form-grid">
              <label>ชื่อโปรโมชั่น<input value={p.title} onChange={(e) => update({ title: e.target.value })} /><FieldError errors={errors} path={path("title")} /></label>
              <label>id<input value={p.id} onChange={(e) => update({ id: e.target.value })} /><span className="hint">ตัวพิมพ์เล็ก a-z, 0-9 และ - เท่านั้น ห้ามซ้ำ</span><FieldError errors={errors} path={path("id")} /></label>
              <label className="full">URL รูปหัวการ์ด<input value={p.image} onChange={(e) => update({ image: e.target.value })} placeholder="https://..." /><FieldError errors={errors} path={path("image")} /></label>
              <label className="full">ข้อความปุ่มสอบถาม<input value={p.inquiryText} onChange={(e) => update({ inquiryText: e.target.value })} /><span className="hint">แสดงบนปุ่ม และเป็นข้อความที่ส่งเข้าแชทเมื่อลูกค้ากด</span><FieldError errors={errors} path={path("inquiryText")} /></label>
              <label className="full check"><input type="checkbox" checked={p.hot} onChange={(e) => update({ hot: e.target.checked })} />แสดงป้าย HOT! มุมซ้ายบนของรูป</label>
            </div>
          </div>
          <div className="card">
            <div className="card-title">บรรทัดบรรยายใต้ชื่อ</div>
            <FieldError errors={errors} path={path("lines")} />
            <div className="inline-list">
              {lines.map((line, k) => (
                <div key={k}>
                  <span className="idx">{k + 1}.</span>
                  <input value={line} onChange={(e) => updateLine(k, e.target.value)} />
                  <RowControls index={k} length={lines.length} onMove={(a, b) => update({ lines: move(lines, a, b) })} onDelete={(j) => update({ lines: removeAt(lines, j) })} />
                  <FieldError errors={errors} path={`${path("lines")}[${k}]`} />
                </div>
              ))}
              <div><button type="button" onClick={() => update({ lines: [...lines, ""] })}>+ เพิ่มบรรทัด</button></div>
            </div>
          </div>
          <div className="edit-foot">
            <Link to="/promotions" className="btn">← กลับไปรายการ</Link>
          </div>
        </div>
        <div className="card preview-card">
          <div className="card-title">ตัวอย่างรูป</div>
          <ImagePreview url={p.image} size={260} />
          <div className="muted">สัดส่วนบนการ์ด LINE คือ 150:105</div>
        </div>
      </div>
    </div>
  );
}
