import { useResource } from "../hooks/useResource";
import UnsavedBar from "../components/UnsavedBar";
import FieldError from "../components/FieldError";
import ImagePreview from "../components/ImagePreview";
import RowControls from "../components/RowControls";
import FlexPreviewButton from "../components/FlexPreviewButton";
import { move, removeAt, slugify } from "../utils";

const emptyPromotion = (list) => ({
  id: `promotion-${list.length + 1}-${Date.now().toString(36)}`,
  image: "", title: "", lines: [""], inquiryText: "สอบถามโปร", hot: false,
});

export default function PromotionsPage() {
  const resource = useResource("promotions");
  const { draft, setDraft, errors, status, message } = resource;
  if (status === "loading" || draft === null) return <p>กำลังโหลด...</p>;
  if (status === "error") return <p className="field-error">{message}</p>;

  const update = (i, patch) => setDraft(draft.map((p, j) => (j === i ? { ...p, ...patch } : p)));
  const updateLine = (i, k, value) => update(i, { lines: draft[i].lines.map((l, j) => (j === k ? value : l)) });

  return (
    <div>
      <h1>โปรโมชั่นล่าสุด <span className="muted">({draft.length} รายการ · trigger "โปรโมชั่นล่าสุด")</span> <FlexPreviewButton trigger="โปรโมชั่นล่าสุด" /></h1>
      <UnsavedBar resource={resource} />
      {draft.map((p, i) => (
        <div className="card card-row" key={p.id}>
          <ImagePreview url={p.image} />
          <div>
            <div className="grid-2">
              <label>ชื่อโปรโมชั่น<input value={p.title} onChange={(e) => update(i, { title: e.target.value, id: p.id.startsWith("promotion-") ? slugify(e.target.value, p.id) : p.id })} /><FieldError errors={errors} path={`[${i}].title`} /></label>
              <label>id<input value={p.id} onChange={(e) => update(i, { id: e.target.value })} /><FieldError errors={errors} path={`[${i}].id`} /></label>
            </div>
            <label>URL รูป<input value={p.image} onChange={(e) => update(i, { image: e.target.value })} /><FieldError errors={errors} path={`[${i}].image`} /></label>
            <label>ข้อความปุ่มสอบถาม<input value={p.inquiryText} onChange={(e) => update(i, { inquiryText: e.target.value })} /><FieldError errors={errors} path={`[${i}].inquiryText`} /></label>
            <div>บรรทัดบรรยาย</div>
            <div className="inline-list">
              {p.lines.map((line, k) => (
                <div key={k}>
                  <input value={line} onChange={(e) => updateLine(i, k, e.target.value)} />
                  <button type="button" onClick={() => update(i, { lines: removeAt(p.lines, k) })}>ลบ</button>
                  <FieldError errors={errors} path={`[${i}].lines[${k}]`} />
                </div>
              ))}
              <div><button type="button" onClick={() => update(i, { lines: [...p.lines, ""] })}>+ เพิ่มบรรทัด</button></div>
            </div>
            <label style={{ marginTop: "0.6rem" }}>
              <input type="checkbox" style={{ width: "auto" }} checked={p.hot} onChange={(e) => update(i, { hot: e.target.checked })} /> แสดงป้าย HOT!
            </label>
          </div>
          <RowControls index={i} length={draft.length} onMove={(a, b) => setDraft(move(draft, a, b))} onDelete={(k) => setDraft(removeAt(draft, k))} />
        </div>
      ))}
      <button type="button" className="primary" onClick={() => setDraft([...draft, emptyPromotion(draft)])}>+ เพิ่มโปรโมชั่น</button>
    </div>
  );
}
