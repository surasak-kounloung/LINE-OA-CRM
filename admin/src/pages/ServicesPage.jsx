import { useResource } from "../hooks/useResource";
import UnsavedBar from "../components/UnsavedBar";
import FieldError from "../components/FieldError";
import ImagePreview from "../components/ImagePreview";
import RowControls from "../components/RowControls";
import FlexPreviewButton from "../components/FlexPreviewButton";
import { move, removeAt, MAX_PRICE_IMAGES } from "../utils";

const emptyService = (list) => ({
  id: `service-${list.length + 1}-${Date.now().toString(36)}`,
  image: "", title: "", subtitle: "", actionText: "สอบถามโปรโมชั่น", hot: true, priceImages: [],
});

export default function ServicesPage() {
  const resource = useResource("services");
  const { draft, setDraft, errors, status, message } = resource;
  if (status === "loading" || draft === null) return <p>กำลังโหลด...</p>;
  if (status === "error") return <p className="field-error">{message}</p>;

  const update = (i, patch) => setDraft(draft.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  const updatePrice = (i, k, value) => update(i, { priceImages: draft[i].priceImages.map((u, j) => (j === k ? value : u)) });

  return (
    <div>
      <h1>บริการทั้งหมด <span className="muted">({draft.length} รายการ · trigger "บริการทั้งหมด")</span> <FlexPreviewButton trigger="บริการทั้งหมด" /></h1>
      <UnsavedBar resource={resource} />
      {draft.map((s, i) => (
        <div className="card card-row" key={i}>
          <ImagePreview url={s.image} />
          <div>
            <div className="grid-2">
              <label>ชื่อโปรแกรม<input value={s.title} onChange={(e) => update(i, { title: e.target.value })} /><FieldError errors={errors} path={`[${i}].title`} /></label>
              <label>id<input value={s.id} onChange={(e) => update(i, { id: e.target.value })} /><FieldError errors={errors} path={`[${i}].id`} /></label>
              <label>ข้อความรอง (ใต้หัวข้อ)<input value={s.subtitle} onChange={(e) => update(i, { subtitle: e.target.value })} /><FieldError errors={errors} path={`[${i}].subtitle`} /></label>
              <label>ข้อความเมื่อกดปุ่ม (trigger รูปราคา)<input value={s.actionText} onChange={(e) => update(i, { actionText: e.target.value })} /><FieldError errors={errors} path={`[${i}].actionText`} /></label>
            </div>
            <label>URL รูปการ์ด<input value={s.image} onChange={(e) => update(i, { image: e.target.value })} /><FieldError errors={errors} path={`[${i}].image`} /></label>
            <label><input type="checkbox" style={{ width: "auto" }} checked={s.hot} onChange={(e) => update(i, { hot: e.target.checked })} /> แสดงป้าย HOT!</label>

            <div>
              รูปราคา ({s.priceImages.length}/{MAX_PRICE_IMAGES}) <FlexPreviewButton trigger={s.actionText} />
              {s.priceImages.length === 0 && <span className="muted"> — ไม่มีรูป: บอทจะตอบข้อความ "ปรึกษาหมอได้เลย" อย่างเดียว</span>}
              {s.priceImages.length > MAX_PRICE_IMAGES && <span className="field-error"> เกิน {MAX_PRICE_IMAGES} รูป LINE แสดงได้ไม่ครบ</span>}
            </div>
            <FieldError errors={errors} path={`[${i}].priceImages`} />
            <div className="inline-list">
              {s.priceImages.map((url, k) => (
                <div key={k}>
                  <ImagePreview url={url} size={48} />
                  <input value={url} onChange={(e) => updatePrice(i, k, e.target.value)} />
                  <RowControls index={k} length={s.priceImages.length} onMove={(a, b) => update(i, { priceImages: move(s.priceImages, a, b) })} onDelete={(j) => update(i, { priceImages: removeAt(s.priceImages, j) })} />
                  <FieldError errors={errors} path={`[${i}].priceImages[${k}]`} />
                </div>
              ))}
              <div><button type="button" onClick={() => update(i, { priceImages: [...s.priceImages, ""] })}>+ เพิ่มรูปราคา</button></div>
            </div>
          </div>
          <RowControls index={i} length={draft.length} onMove={(a, b) => setDraft(move(draft, a, b))} onDelete={(k) => setDraft(removeAt(draft, k))} />
        </div>
      ))}
      <button type="button" className="primary" onClick={() => setDraft([...draft, emptyService(draft)])}>+ เพิ่มบริการ</button>
    </div>
  );
}
