import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useResourceContext } from "../hooks/useResourceContext";
import PageHeader from "../components/PageHeader";
import UnsavedBar from "../components/UnsavedBar";
import FieldError from "../components/FieldError";
import ImagePreview from "../components/ImagePreview";
import RowControls from "../components/RowControls";
import FlexPreviewButton from "../components/FlexPreviewButton";
import { move, removeAt, chunkCount, DAYS, MENUS, MAX_BUBBLES } from "../utils";

const SCHEDULE_PREFIX = "สอบถามตารางแพทย์ สาขา";

export default function BranchEditPage() {
  const { index } = useParams();
  const resource = useResourceContext();
  const [tab, setTab] = useState("info");
  const { draft, setDraft, errors, status, message } = resource;
  if (status === "loading" || draft === null) return <p className="muted">กำลังโหลด...</p>;
  if (status === "error") return <p className="field-error">{message}</p>;

  const i = Number(index);
  const b = draft[i];
  if (!Number.isInteger(i) || !b) return <p>ไม่พบสาขา <Link to="/branches">กลับไปรายการ</Link></p>;
  const p = (field) => `[${i}].${field}`;
  const update = (patch) => setDraft(draft.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const doctors = b.doctors || [];
  const updateDoctor = (k, patch) => update({ doctors: doctors.map((d, j) => (j === k ? { ...d, ...patch } : d)) });
  const field = (label, name, hint) => (
    <label>{label}<input value={b[name] ?? ""} onChange={(e) => update({ [name]: e.target.value })} />{hint && <span className="hint">{hint}</span>}<FieldError errors={errors} path={p(name)} /></label>
  );
  const doctorErrors = errors.some((e) => e.path.startsWith(p("doctors")));
  const scheduleTrigger = SCHEDULE_PREFIX + b.trigger;

  return (
    <div>
      <PageHeader
        crumbs={[{ to: "/branches", label: "สาขา" }, { label: b.trigger || "สาขาใหม่" }]}
        title={<>{b.trigger || "สาขาใหม่"} {!b.enabled && <span className="badge muted">ปิดใช้งาน</span>}</>}
        subtitle={`สาขาที่ ${i + 1} จาก ${draft.length} · ${b.region || "ยังไม่กำหนดภูมิภาค"}`}
        actions={<><FlexPreviewButton trigger={b.trigger} label="Flex การ์ดสาขา" /><FlexPreviewButton trigger={scheduleTrigger} label="Flex ตารางแพทย์" /></>}
      />
      <UnsavedBar resource={resource} />
      <div className="tabs">
        <button type="button" className={tab === "info" ? "active" : ""} onClick={() => setTab("info")}>ข้อมูลสาขา</button>
        <button type="button" className={tab === "doctors" ? "active" : ""} onClick={() => setTab("doctors")}>ตารางแพทย์ ({doctors.length}){doctorErrors && <span className="badge">!</span>}</button>
      </div>

      {tab === "info" && (
        <div className="edit-grid">
          <div>
            <div className="card">
              <div className="card-title">การแสดงผลและเมนู</div>
              <div className="form-grid">
                <label>ข้อความ trigger<input value={b.trigger} onChange={(e) => update({ trigger: e.target.value })} /><span className="hint">ต้องตรงกับปุ่ม Rich Menu / เมนูสาขา ทุกตัวอักษร · trigger ตารางแพทย์: {scheduleTrigger}</span><FieldError errors={errors} path={p("trigger")} /></label>
                {field("ชื่อที่แสดงบนการ์ดแผนที่", "displayName")}
                <label>ภูมิภาค<select value={b.region} onChange={(e) => update({ region: e.target.value })}>{!resource.sections.includes(b.region) && <option value={b.region}>{b.region || "(เลือก)"}</option>}{resource.sections.map((s) => <option key={s} value={s}>{s}</option>)}</select><FieldError errors={errors} path={p("region")} /></label>
                <label>แสดงในเมนู<select value={b.menu} onChange={(e) => update({ menu: e.target.value })}>{MENUS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}</select><FieldError errors={errors} path={p("menu")} /></label>
                {field("ข้อความเมื่อกดจากเมนูหลัก", "mainMenuActionText", "ไม่บังคับ ค่าเริ่มต้น = trigger (ทองหล่อใช้เปิดเมนูย่อย)")}
                <label>ขนาดตัวอักษรชื่อสาขา<select value={b.fontSize} onChange={(e) => update({ fontSize: e.target.value })}>{["xl", "xxl", "3xl"].map((s) => <option key={s}>{s}</option>)}</select></label>
                {field("id", "id", "ตัวพิมพ์เล็ก a-z, 0-9 และ - เท่านั้น ห้ามซ้ำ")}
                <label className="check"><input type="checkbox" checked={b.enabled} onChange={(e) => update({ enabled: e.target.checked })} />เปิดใช้งาน (ตอบข้อความและแสดงในเมนู)</label>
              </div>
            </div>
            <div className="card">
              <div className="card-title">ที่อยู่และการติดต่อ</div>
              <div className="form-grid">
                <label className="full">URL แผนที่<input value={b.mapUrl ?? ""} onChange={(e) => update({ mapUrl: e.target.value })} placeholder="https://maps.app.goo.gl/..." /><FieldError errors={errors} path={p("mapUrl")} /></label>
                <label className="full">URL รูปสาขา<input value={b.imageUrl ?? ""} onChange={(e) => update({ imageUrl: e.target.value })} placeholder="https://..." /><FieldError errors={errors} path={p("imageUrl")} /></label>
                {field("เบอร์โทร", "phoneNumber")}
                {field("LINE ID", "lineId")}
                {field("LINE URL", "lineUrl", "ไม่บังคับ ถ้าว่างการ์ดจะไม่มีลิงก์ที่บรรทัด LINE")}
              </div>
            </div>
            <div className="edit-foot">
              <Link to="/branches" className="btn">← กลับไปรายการ</Link>
            </div>
          </div>
          <div className="card preview-card">
            <div className="card-title">รูปสาขา</div>
            <ImagePreview url={b.imageUrl} size={260} />
            <div className="muted">สัดส่วนบนการ์ด LINE คือ 20:13</div>
          </div>
        </div>
      )}

      {tab === "doctors" && (
        <div>
          <div className="card">
            <div className="card-title">ตารางแพทย์ · แสดงเป็น {chunkCount(doctors.length, MAX_BUBBLES) || 0} carousel (สูงสุด {MAX_BUBBLES} คนต่อ carousel)</div>
            {doctors.length === 0 && <div className="notice">ยังไม่มีแพทย์ บอทจะไม่ตอบ trigger ตารางแพทย์ของสาขานี้จนกว่าจะมีอย่างน้อย 1 คน</div>}
            <FieldError errors={errors} path={p("doctors")} />
            <div className="table-wrap" style={{ boxShadow: "none" }}>
              <table className="table">
                <thead><tr><th style={{ width: 64 }}>รูป</th><th style={{ width: 150 }}>วัน</th><th>ชื่อแพทย์</th><th style={{ width: 130 }}>เลขใบอนุญาต</th><th>URL รูป</th><th style={{ width: 130 }}></th></tr></thead>
                <tbody>
                  {doctors.map((d, k) => {
                    const dp = (f) => `${p("doctors")}[${k}].${f}`;
                    return (
                      <tr key={k}>
                        <td className="thumb-sm"><ImagePreview url={d.imageUrl} size={44} /></td>
                        <td><select value={d.day} onChange={(e) => updateDoctor(k, { day: e.target.value })}>{!DAYS.includes(d.day) && <option value={d.day}>{d.day || "(เลือก)"}</option>}{DAYS.map((day) => <option key={day}>{day}</option>)}</select><FieldError errors={errors} path={dp("day")} /></td>
                        <td><input value={d.name} onChange={(e) => updateDoctor(k, { name: e.target.value })} placeholder="พญ./นพ. ชื่อ นามสกุล" /><FieldError errors={errors} path={dp("name")} /></td>
                        <td><input value={d.license} onChange={(e) => updateDoctor(k, { license: e.target.value })} placeholder="ว.12345" /><FieldError errors={errors} path={dp("license")} /></td>
                        <td><input value={d.imageUrl} onChange={(e) => updateDoctor(k, { imageUrl: e.target.value })} placeholder="https://..." /><FieldError errors={errors} path={dp("imageUrl")} /></td>
                        <td><div className="actions"><RowControls index={k} length={doctors.length} onMove={(a, c) => update({ doctors: move(doctors, a, c) })} onDelete={(j) => update({ doctors: removeAt(doctors, j) })} /></div></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <button type="button" style={{ marginTop: "0.8rem" }} onClick={() => update({ doctors: [...doctors, { day: DAYS[0], name: "", license: "", imageUrl: "" }] })}>+ เพิ่มแพทย์</button>
          </div>
          <div className="edit-foot">
            <Link to="/branches" className="btn">← กลับไปรายการ</Link>
          </div>
        </div>
      )}
    </div>
  );
}
