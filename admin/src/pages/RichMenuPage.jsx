import { useEffect, useState } from "react";
import { api } from "../api";
import { useResource } from "../hooks/useResource";
import PageHeader from "../components/PageHeader";
import UnsavedBar from "../components/UnsavedBar";
import FieldError from "../components/FieldError";
import ImagePreview from "../components/ImagePreview";
import RichMenuAreas from "../components/RichMenuAreas";
import RichMenuStatus from "../components/RichMenuStatus";
import { removeAt } from "../utils";

const toNumber = (value) => (value === "" ? "" : Number(value));

// Rich Menu ชุดเดียวของทุก LINE OA: ตั้งค่าร่วม + พื้นที่กด (ใช้ร่วมกันทุกระดับ) + รูปของแต่ละระดับ แล้ว sync ไปแต่ละ OA
export default function RichMenuPage() {
  const resource = useResource("richmenu");
  const { draft, setDraft, errors, status, message, dirty } = resource;
  const [triggers, setTriggers] = useState([]);
  const [previewKey, setPreviewKey] = useState("");

  useEffect(() => {
    api.get("/triggers").then(setTriggers).catch(() => setTriggers([]));
  }, []);

  if (status === "error") return <p className="field-error">{message}</p>;
  if (status === "loading" || draft === null) return <p className="muted">กำลังโหลด...</p>;

  const patch = (changes) => setDraft({ ...draft, ...changes });
  const setMenu = (i, changes) => patch({ menus: draft.menus.map((menu, j) => (j === i ? { ...menu, ...changes } : menu)) });
  const setDefault = (i) => patch({ menus: draft.menus.map((menu, j) => ({ ...menu, isDefault: j === i })) });
  const addMenu = () => patch({ menus: [...draft.menus, { key: "", label: "", image: "", isDefault: draft.menus.length === 0 }] });

  function removeMenu(i) {
    const menus = removeAt(draft.menus, i);
    // ลบเมนูเริ่มต้นไปแล้ว: ให้เมนูแรกที่เหลือเป็นเมนูเริ่มต้นแทน เพราะต้องมี 1 อันเสมอ
    if (menus.length && !menus.some((menu) => menu.isDefault)) menus[0] = { ...menus[0], isDefault: true };
    patch({ menus });
  }

  const previewMenu = draft.menus.find((menu) => menu.key === previewKey) || draft.menus.find((menu) => menu.isDefault) || draft.menus[0];

  return (
    <div>
      <PageHeader
        title="Rich Menu"
        subtitle={`${draft.menus.length} เมนู · แก้ที่นี่ที่เดียว บันทึก แล้วกด Sync เพื่อให้ทุก LINE OA ใช้เมนูชุดเดียวกัน`}
      />
      <UnsavedBar resource={resource} />
      <FieldError errors={errors} path="" />

      <div className="card">
        <div className="card-title">ตั้งค่าร่วมของทุกเมนู</div>
        <div className="form-grid">
          <label>
            ข้อความบนแถบเมนู
            <input value={draft.chatBarText} maxLength={14} onChange={(e) => patch({ chatBarText: e.target.value })} />
            <span className="hint">แสดงที่แถบด้านล่างของห้องแชต ไม่เกิน 14 ตัวอักษร</span>
            <FieldError errors={errors} path="chatBarText" />
          </label>
          <label className="check" style={{ alignSelf: "center" }}>
            <input type="checkbox" checked={draft.selected === true} onChange={(e) => patch({ selected: e.target.checked })} />
            เปิดเมนูค้างไว้เมื่อลูกค้าเข้าห้องแชต
          </label>
          <label>
            ความกว้างของเมนู
            <input type="number" min="800" max="2500" step="1" value={draft.size.width} onChange={(e) => patch({ size: { ...draft.size, width: toNumber(e.target.value) } })} />
            <FieldError errors={errors} path="size.width" />
          </label>
          <label>
            ความสูงของเมนู
            <input type="number" min="250" step="1" value={draft.size.height} onChange={(e) => patch({ size: { ...draft.size, height: toNumber(e.target.value) } })} />
            <FieldError errors={errors} path="size.height" />
          </label>
        </div>
        <div className="muted">ขนาดเมนูคือพิกัดอ้างอิงของพื้นที่กด รูปไม่ต้องมีขนาดเท่านี้ แต่สัดส่วนต้องตรงกัน เช่น เมนู 2500x1686 ใช้รูป 1200x810 ได้</div>
      </div>

      <div className="card">
        <div className="rm-status-head">
          <div className="card-title" style={{ margin: 0 }}>พื้นที่กด (ใช้ร่วมกันทุกระดับ)</div>
          {draft.menus.length > 1 && (
            <label className="rm-preview-pick">
              ดูกรอบบนรูปของ
              <select value={previewMenu ? previewMenu.key : ""} onChange={(e) => setPreviewKey(e.target.value)}>
                {draft.menus.map((menu, i) => <option key={i} value={menu.key}>{menu.label || menu.key || `เมนูที่ ${i + 1}`}</option>)}
              </select>
            </label>
          )}
        </div>
        <FieldError errors={errors} path="areas" />
        <RichMenuAreas
          size={draft.size}
          areas={draft.areas}
          onChange={(areas) => patch({ areas })}
          previewUrl={previewMenu ? previewMenu.image : ""}
          triggers={triggers}
          errors={errors}
        />
      </div>

      <div className="card">
        <div className="rm-status-head">
          <div className="card-title" style={{ margin: 0 }}>เมนูตามระดับสมาชิก</div>
          <button type="button" className="primary sm" onClick={addMenu}>+ เพิ่มเมนู</button>
        </div>
        <div className="muted" style={{ marginBottom: "0.75rem" }}>
          รูปต้องเป็น JPEG หรือ PNG ไม่เกิน 1 MB กว้าง 800–2500 พิกเซล และสัดส่วนตรงกับขนาดเมนู ถ้าเปลี่ยนรูปต้องใช้ URL ใหม่ (ทับไฟล์ที่ URL เดิมแอปจะไม่รู้ว่ารูปเปลี่ยน)
        </div>
        <FieldError errors={errors} path="menus" />
        <div className="table-wrap">
          <table className="table rm-table">
            <thead>
              <tr><th style={{ width: 96 }}>รูป</th><th style={{ width: 150 }}>รหัส</th><th style={{ width: 200 }}>ชื่อ</th><th>URL รูป</th><th className="num">เมนูเริ่มต้น</th><th></th></tr>
            </thead>
            <tbody>
              {draft.menus.length === 0 && <tr><td colSpan={6} className="empty">ยังไม่มีเมนู กด "+ เพิ่มเมนู" แล้วใส่รูปของแต่ละระดับ</td></tr>}
              {draft.menus.map((menu, i) => (
                <tr key={i} className={errors.some((e) => e.path === `menus[${i}]` || e.path.startsWith(`menus[${i}].`)) ? "has-error" : ""}>
                  <td className="thumb-sm rm-thumb"><ImagePreview url={menu.image} size={72} /></td>
                  <td>
                    <input value={menu.key} placeholder="เช่น gold" onChange={(e) => setMenu(i, { key: e.target.value })} />
                    <FieldError errors={errors} path={`menus[${i}].key`} />
                  </td>
                  <td>
                    <input value={menu.label} placeholder="เช่น V Gold" onChange={(e) => setMenu(i, { label: e.target.value })} />
                    <FieldError errors={errors} path={`menus[${i}].label`} />
                  </td>
                  <td>
                    <input value={menu.image} placeholder="https://..." onChange={(e) => setMenu(i, { image: e.target.value })} />
                    <FieldError errors={errors} path={`menus[${i}].image`} />
                    <FieldError errors={errors} path={`menus[${i}]`} />
                  </td>
                  <td className="num">
                    <input type="radio" name="rm-default" style={{ width: "auto" }} checked={menu.isDefault === true} onChange={() => setDefault(i)} />
                    <FieldError errors={errors} path={`menus[${i}].isDefault`} />
                  </td>
                  <td>
                    <div className="actions">
                      <button type="button" className="danger" onClick={() => { if (window.confirm(`ลบเมนู "${menu.label || menu.key}" ออกจากรายการ?`)) removeMenu(i); }}>ลบ</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="muted" style={{ marginTop: "0.75rem" }}>
          รหัสใช้ตั้งชื่ออ้างอิงบน LINE (a-z, 0-9, -) ไม่ควรเปลี่ยนหลัง sync แล้ว เพราะจะถือเป็นการลบระดับเดิมและเพิ่มระดับใหม่ · เมนูเริ่มต้นคือเมนูที่ลูกค้าเห็นเมื่อยังไม่ถูกผูกเมนูตามระดับ
        </div>
      </div>

      <RichMenuStatus dirty={dirty} />
    </div>
  );
}
