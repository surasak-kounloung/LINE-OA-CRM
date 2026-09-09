import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useBranches } from "../hooks/useBranches";
import UnsavedBar from "../components/UnsavedBar";
import FieldError from "../components/FieldError";
import ImagePreview from "../components/ImagePreview";
import RowControls from "../components/RowControls";
import FlexPreviewButton from "../components/FlexPreviewButton";
import { move, removeAt, chunkCount, DAYS, MENUS, MAX_BUBBLES } from "../utils";

const SCHEDULE_PREFIX = "สอบถามตารางแพทย์ สาขา";

export default function BranchEditPage() {
  const { id } = useParams();
  const resource = useBranches();
  const [tab, setTab] = useState("info");
  const { draft, setDraft, errors, status, message } = resource;
  if (status === "loading" || draft === null) return <p>กำลังโหลด...</p>;
  if (status === "error") return <p className="field-error">{message}</p>;

  const i = draft.findIndex((b) => b.id === id);
  if (i === -1) return <p>ไม่พบสาขา <Link to="/branches">กลับ</Link></p>;
  const b = draft[i];
  const p = (field) => `[${i}].${field}`;
  const update = (patch) => setDraft(draft.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const updateDoctor = (k, patch) => update({ doctors: b.doctors.map((d, j) => (j === k ? { ...d, ...patch } : d)) });
  const field = (label, name, type = "text") => (
    <label>{label}<input type={type} value={b[name] ?? ""} onChange={(e) => update({ [name]: e.target.value })} /><FieldError errors={errors} path={p(name)} /></label>
  );

  return (
    <div>
      <p><Link to="/branches">← รายชื่อสาขา</Link></p>
      <h1>{b.trigger || "สาขาใหม่"} {!b.enabled && <span className="badge muted">ปิด</span>}</h1>
      <UnsavedBar resource={resource} />
      <div className="tabs">
        <button type="button" className={tab === "info" ? "active" : ""} onClick={() => setTab("info")}>ข้อมูลสาขา</button>
        <button type="button" className={tab === "doctors" ? "active" : ""} onClick={() => setTab("doctors")}>ตารางแพทย์ ({b.doctors.length})</button>
      </div>

      {tab === "info" && (
        <div className="card">
          <div className="grid-2">
            <label>ข้อความ trigger (ตรงกับปุ่ม Rich Menu / เมนูสาขา)<input value={b.trigger} onChange={(e) => update({ trigger: e.target.value })} /><FieldError errors={errors} path={p("trigger")} /><span className="muted">trigger ตารางแพทย์: {SCHEDULE_PREFIX}{b.trigger}</span></label>
            {field("ชื่อที่แสดงบนการ์ด", "displayName")}
            {field("id", "id")}
            <label>ภูมิภาค<select value={b.region} onChange={(e) => update({ region: e.target.value })}>{!resource.sections.includes(b.region) && <option value={b.region}>{b.region || "(เลือก)"}</option>}{resource.sections.map((s) => <option key={s} value={s}>{s}</option>)}</select><FieldError errors={errors} path={p("region")} /></label>
            <label>แสดงในเมนู<select value={b.menu} onChange={(e) => update({ menu: e.target.value })}>{MENUS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}</select><FieldError errors={errors} path={p("menu")} /></label>
            {field("ข้อความเมื่อกดจากเมนูหลัก (ไม่บังคับ ค่าเริ่มต้น = trigger)", "mainMenuActionText")}
            <label>ขนาดตัวอักษรชื่อสาขา<select value={b.fontSize} onChange={(e) => update({ fontSize: e.target.value })}>{["xl", "xxl", "3xl"].map((s) => <option key={s}>{s}</option>)}</select></label>
            <label><input type="checkbox" style={{ width: "auto" }} checked={b.enabled} onChange={(e) => update({ enabled: e.target.checked })} /> เปิดใช้งาน (ตอบข้อความและแสดงในเมนู)</label>
            {field("URL แผนที่", "mapUrl")}
            {field("URL รูปสาขา", "imageUrl")}
            {field("เบอร์โทร", "phoneNumber")}
            {field("LINE ID", "lineId")}
            {field("LINE URL (ไม่บังคับ)", "lineUrl")}
          </div>
          <ImagePreview url={b.imageUrl} size={160} />
          <p><FlexPreviewButton trigger={b.trigger} /></p>
        </div>
      )}

      {tab === "doctors" && (
        <div className="card">
          <p className="muted">แสดงเป็น {chunkCount(b.doctors.length, MAX_BUBBLES) || 0} carousel (สูงสุด {MAX_BUBBLES} คนต่อ carousel) · trigger: {SCHEDULE_PREFIX}{b.trigger} <FlexPreviewButton trigger={SCHEDULE_PREFIX + b.trigger} /></p>
          <FieldError errors={errors} path={p("doctors")} />
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>รูป</th><th>วัน</th><th>ชื่อแพทย์</th><th>เลขใบอนุญาต</th><th>URL รูป</th><th></th></tr></thead>
              <tbody>
                {b.doctors.map((d, k) => {
                  const dp = (f) => `${p("doctors")}[${k}].${f}`;
                  return (
                    <tr key={k}>
                      <td><ImagePreview url={d.imageUrl} size={48} /></td>
                      <td><select value={d.day} onChange={(e) => updateDoctor(k, { day: e.target.value })}>{!DAYS.includes(d.day) && <option value={d.day}>{d.day || "(เลือก)"}</option>}{DAYS.map((day) => <option key={day}>{day}</option>)}</select><FieldError errors={errors} path={dp("day")} /></td>
                      <td><input value={d.name} onChange={(e) => updateDoctor(k, { name: e.target.value })} /><FieldError errors={errors} path={dp("name")} /></td>
                      <td><input value={d.license} onChange={(e) => updateDoctor(k, { license: e.target.value })} /><FieldError errors={errors} path={dp("license")} /></td>
                      <td><input value={d.imageUrl} onChange={(e) => updateDoctor(k, { imageUrl: e.target.value })} /><FieldError errors={errors} path={dp("imageUrl")} /></td>
                      <td><RowControls index={k} length={b.doctors.length} onMove={(a, c) => update({ doctors: move(b.doctors, a, c) })} onDelete={(j) => update({ doctors: removeAt(b.doctors, j) })} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <button type="button" style={{ marginTop: "0.6rem" }} onClick={() => update({ doctors: [...b.doctors, { day: DAYS[0], name: "", license: "", imageUrl: "" }] })}>+ เพิ่มแพทย์</button>
        </div>
      )}
    </div>
  );
}
