import { Link, useParams } from "react-router-dom";
import { useResourceContext } from "../hooks/useResourceContext";
import PageHeader from "../components/PageHeader";
import UnsavedBar from "../components/UnsavedBar";
import FieldError from "../components/FieldError";
import ImagePreview from "../components/ImagePreview";
import RowControls from "../components/RowControls";
import FlexPreviewButton from "../components/FlexPreviewButton";
import { move, removeAt, MAX_PRICE_IMAGES } from "../utils";

export default function ServiceEditPage() {
  const { index } = useParams();
  const resource = useResourceContext();
  const { draft, setDraft, errors, status, message } = resource;
  if (status === "loading" || draft === null) return <p className="muted">กำลังโหลด...</p>;
  if (status === "error") return <p className="field-error">{message}</p>;

  const i = Number(index);
  const s = draft[i];
  if (!Number.isInteger(i) || !s) return <p>ไม่พบบริการ <Link to="/services">กลับไปรายการ</Link></p>;
  const path = (f) => `[${i}].${f}`;
  const update = (patch) => setDraft(draft.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const prices = s.priceImages || [];
  const updatePrice = (k, value) => update({ priceImages: prices.map((u, j) => (j === k ? value : u)) });

  return (
    <div>
      <PageHeader
        crumbs={[{ to: "/services", label: "บริการ" }, { label: s.title || "บริการใหม่" }]}
        title={s.title || "บริการใหม่"}
        subtitle={`รายการที่ ${i + 1} จาก ${draft.length}`}
        actions={<FlexPreviewButton trigger="บริการทั้งหมด" />}
      />
      <UnsavedBar resource={resource} />
      <div className="edit-grid">
        <div>
          <div className="card">
            <div className="card-title">ข้อมูลการ์ดบริการ</div>
            <div className="form-grid">
              <label>ชื่อโปรแกรม<input value={s.title} onChange={(e) => update({ title: e.target.value })} /><FieldError errors={errors} path={path("title")} /></label>
              <label>id<input value={s.id} onChange={(e) => update({ id: e.target.value })} /><span className="hint">ตัวพิมพ์เล็ก a-z, 0-9 และ - เท่านั้น ห้ามซ้ำ · เปลี่ยน id แล้วข้อความต่อท้ายที่ตั้งแยกให้บริการนี้จะถูกล้าง</span><FieldError errors={errors} path={path("id")} /></label>
              <label>ข้อความรอง (ใต้หัวข้อ)<input value={s.subtitle} onChange={(e) => update({ subtitle: e.target.value })} /><FieldError errors={errors} path={path("subtitle")} /></label>
              <label>ข้อความเมื่อกดปุ่ม<input value={s.actionText} onChange={(e) => update({ actionText: e.target.value })} /><span className="hint">เป็น trigger ของรูปราคา ห้ามซ้ำกับบริการอื่น</span><FieldError errors={errors} path={path("actionText")} /></label>
              <label className="full">URL รูปหัวการ์ด<input value={s.image} onChange={(e) => update({ image: e.target.value })} placeholder="https://..." /><FieldError errors={errors} path={path("image")} /></label>
              <label className="full check"><input type="checkbox" checked={s.hot} onChange={(e) => update({ hot: e.target.checked })} />แสดงป้าย HOT! มุมซ้ายบนของรูป</label>
            </div>
          </div>
          <div className="card">
            <div className="card-title">รูปราคา ({prices.length}/{MAX_PRICE_IMAGES}) <FlexPreviewButton trigger={s.actionText} /></div>
            {prices.length === 0 && <div className="notice">ไม่มีรูปราคา: เมื่อลูกค้ากดปุ่ม บอทจะตอบเฉพาะข้อความต่อท้ายของ LINE OA นั้น (ตั้งในหน้า "ข้อความต่อท้าย") — OA ที่ตั้งเป็น "ไม่ส่ง" จะไม่ตอบปุ่มนี้</div>}
            {prices.length > MAX_PRICE_IMAGES && <div className="field-error" style={{ marginBottom: "0.6rem" }}>เกิน {MAX_PRICE_IMAGES} รูป LINE แสดงได้ไม่ครบ</div>}
            <FieldError errors={errors} path={path("priceImages")} />
            <div className="inline-list">
              {prices.map((url, k) => (
                <div key={k}>
                  <span className="idx">{k + 1}.</span>
                  <span className="thumb-sm"><ImagePreview url={url} size={44} /></span>
                  <input value={url} onChange={(e) => updatePrice(k, e.target.value)} placeholder="https://..." />
                  <RowControls index={k} length={prices.length} onMove={(a, b) => update({ priceImages: move(prices, a, b) })} onDelete={(j) => update({ priceImages: removeAt(prices, j) })} />
                  <FieldError errors={errors} path={`${path("priceImages")}[${k}]`} />
                </div>
              ))}
              <div><button type="button" onClick={() => update({ priceImages: [...prices, ""] })}>+ เพิ่มรูปราคา</button></div>
            </div>
          </div>
          <div className="edit-foot">
            <Link to="/services" className="btn">← กลับไปรายการ</Link>
          </div>
        </div>
        <div className="card preview-card">
          <div className="card-title">ตัวอย่างรูปหัวการ์ด</div>
          <ImagePreview url={s.image} size={260} />
          <div className="muted">สัดส่วนบนการ์ด LINE คือ 150:105</div>
        </div>
      </div>
    </div>
  );
}
