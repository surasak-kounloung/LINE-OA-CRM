import FieldError from "./FieldError";
import { removeAt } from "../utils";

const CUSTOM = "__custom__";
const AREA_FIELDS = ["x", "y", "width", "height", "action.type", "action.text", "action.uri"];
const BOUNDS = [["x", "x"], ["y", "y"], ["width", "กว้าง"], ["height", "สูง"]];

// ช่องตัวเลขที่ลบจนว่างได้ระหว่างพิมพ์ (ค่าว่างจะถูกแจ้งเป็นข้อผิดพลาดตอนบันทึก)
const toNumber = (value) => (value === "" ? "" : Number(value));
const percent = (part, whole) => `${whole > 0 ? (Number(part) / whole) * 100 : 0}%`;
export const emptyArea = () => ({ x: 0, y: 0, width: 500, height: 500, action: { type: "message", text: "" } });

// ตารางพื้นที่กด + กรอบหมายเลขซ้อนบนรูปเมนู
// พิกัดเทียบกับ size ของเมนู ไม่ใช่ขนาดไฟล์รูป (LINE ย่อ/ขยายรูปให้พอดีเอง)
export default function RichMenuAreas({ size, areas, onChange, previewUrl, triggers, errors }) {
  const setArea = (i, patch) => onChange(areas.map((area, j) => (j === i ? { ...area, ...patch } : area)));

  function setType(i, type) {
    setArea(i, { action: type === "message" ? { type, text: "" } : { type, uri: "" } });
  }

  return (
    <div className="rm-areas">
      <div className="rm-preview" style={{ aspectRatio: `${size.width || 1} / ${size.height || 1}` }}>
        {previewUrl && <img src={previewUrl} alt="" />}
        {areas.map((area, i) => (
          <div
            key={i}
            className="rm-box"
            style={{
              left: percent(area.x, size.width),
              top: percent(area.y, size.height),
              width: percent(area.width, size.width),
              height: percent(area.height, size.height),
            }}
          >
            <span>{i + 1}</span>
          </div>
        ))}
      </div>
      {!previewUrl && <div className="muted rm-preview-note">เพิ่มเมนูและใส่ URL รูป เพื่อดูกรอบซ้อนบนรูปจริง</div>}

      <div className="table-wrap">
        <table className="table rm-table">
          <thead>
            <tr>
              <th className="num">#</th>
              {BOUNDS.map(([field, label]) => <th key={field}>{label}</th>)}
              <th style={{ width: 150 }}>เมื่อกด</th>
              <th>ข้อความที่ส่ง / ลิงก์ที่เปิด</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {areas.length === 0 && <tr><td colSpan={8} className="empty">ยังไม่มีพื้นที่กด</td></tr>}
            {areas.map((area, i) => {
              const action = area.action || {};
              const isKnownTrigger = action.type === "message" && triggers.includes(action.text);
              return (
                <tr key={i}>
                  <td className="num"><span className="rm-index">{i + 1}</span></td>
                  {BOUNDS.map(([field]) => (
                    <td key={field}>
                      <input type="number" min="0" step="1" className="rm-number" value={area[field]} onChange={(e) => setArea(i, { [field]: toNumber(e.target.value) })} />
                    </td>
                  ))}
                  <td>
                    <select value={action.type} onChange={(e) => setType(i, e.target.value)}>
                      <option value="message">ส่งข้อความ</option>
                      <option value="uri">เปิดลิงก์</option>
                    </select>
                  </td>
                  <td>
                    {action.type === "uri" ? (
                      <input value={action.uri || ""} placeholder="https://..." onChange={(e) => setArea(i, { action: { type: "uri", uri: e.target.value } })} />
                    ) : (
                      <>
                        <select
                          value={isKnownTrigger ? action.text : CUSTOM}
                          onChange={(e) => setArea(i, { action: { type: "message", text: e.target.value === CUSTOM ? "" : e.target.value } })}
                        >
                          {triggers.map((trigger) => <option key={trigger} value={trigger}>{trigger}</option>)}
                          <option value={CUSTOM}>พิมพ์เอง…</option>
                        </select>
                        {!isKnownTrigger && (
                          <input
                            style={{ marginTop: "0.35rem" }}
                            value={action.text || ""}
                            placeholder="ข้อความที่จะส่งเข้าแชต"
                            onChange={(e) => setArea(i, { action: { type: "message", text: e.target.value } })}
                          />
                        )}
                      </>
                    )}
                    <FieldError errors={errors} path={`areas[${i}]`} />
                    {AREA_FIELDS.map((field) => <FieldError key={field} errors={errors} path={`areas[${i}].${field}`} />)}
                  </td>
                  <td>
                    <div className="actions">
                      <button type="button" className="danger" title="ลบ" onClick={() => { if (window.confirm(`ลบพื้นที่กดช่องที่ ${i + 1}?`)) onChange(removeAt(areas, i)); }}>ลบ</button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div style={{ marginTop: "0.75rem" }}>
        <button type="button" className="sm" onClick={() => onChange([...areas, emptyArea()])}>+ เพิ่มพื้นที่กด</button>
      </div>
    </div>
  );
}
