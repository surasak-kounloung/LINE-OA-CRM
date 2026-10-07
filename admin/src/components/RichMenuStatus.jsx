import { useCallback, useEffect, useState } from "react";
import { api } from "../api";

const STATE_LABELS = {
  "in-sync": ["ตรงกับที่บันทึกไว้", "ok"],
  "out-of-date": ["ยังไม่ตรง", "info"],
  blocked: ["sync ไม่ได้", ""],
  empty: ["ยังไม่มีเมนู", "muted"],
  error: ["เรียก LINE ไม่ได้", ""],
};
const MENU_LABELS = { ok: "ตรงแล้ว", missing: "ยังไม่มีบน LINE", outdated: "ต้องสร้างใหม่" };

// สรุปสิ่งที่จะเกิดขึ้นเมื่อ sync OA นี้ สำหรับหน้าต่างยืนยัน
function describePlan(oa) {
  const lines = [`Sync Rich Menu ไปที่ ${oa.name}?`, ""];
  const toCreate = oa.menus.filter((menu) => menu.state !== "ok").map((menu) => menu.label);
  if (toCreate.length) lines.push(`• สร้างเมนูใหม่: ${toCreate.join(", ")}`);
  if (oa.removedKeys.length) {
    lines.push(`• ลบเมนูของระดับ: ${oa.removedKeys.join(", ")} — ลูกค้าที่ผูกกับเมนูนี้จะกลับไปเห็นเมนูเริ่มต้น`);
  }
  if (oa.staleCount) lines.push(`• เก็บกวาดเมนูเก่าที่ค้างอยู่ ${oa.staleCount} เมนู`);
  lines.push("• ลูกค้าที่ผูกกับเมนูเดิมของแต่ละระดับจะถูกย้ายไปเมนูใหม่ของระดับเดียวกัน");
  return lines.join("\n");
}

// สถานะ Rich Menu ของแต่ละ LINE OA + ปุ่ม sync (ทีละ OA หนึ่ง request ต่อหนึ่ง OA)
// dirty: หน้ามีการแก้ไขที่ยังไม่บันทึก — sync ไม่ได้จนกว่าจะบันทึก เพราะ sync ใช้ข้อมูลที่บันทึกแล้ว
export default function RichMenuStatus({ dirty }) {
  const [statuses, setStatuses] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(""); // "" | "load" | "sync"
  const [reports, setReports] = useState([]);

  const load = useCallback(async () => {
    setBusy("load");
    setError("");
    try {
      setStatuses(await api.get("/richmenu/status"));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy("");
    }
  }, []);

  // โหลดตอนเปิดหน้า และโหลดใหม่ทุกครั้งที่บันทึกหรือยกเลิกการแก้ไข
  useEffect(() => { if (!dirty) load(); }, [dirty, load]);

  async function sync(targets) {
    setBusy("sync");
    setReports([]);
    const done = [];
    for (const oa of targets) {
      try {
        done.push(await api.post(`/richmenu/sync/${oa.id}`));
      } catch (e) {
        done.push({ id: oa.id, name: oa.name, ok: false, steps: [], message: e.message });
      }
      setReports([...done]);
    }
    await load();
  }

  function confirmAndSync(targets) {
    if (window.confirm(targets.map(describePlan).join("\n\n"))) sync(targets);
  }

  const syncable = (statuses || []).filter((oa) => oa.state === "out-of-date");
  const disabled = dirty || busy !== "";

  return (
    <div className="card">
      <div className="rm-status-head">
        <div className="card-title" style={{ margin: 0 }}>สถานะบน LINE OA</div>
        <div className="page-actions">
          <button type="button" className="sm" onClick={load} disabled={busy !== ""}>{busy === "load" ? "กำลังโหลด..." : "รีเฟรช"}</button>
          <button type="button" className="primary sm" onClick={() => confirmAndSync(syncable)} disabled={disabled || syncable.length === 0}>
            {busy === "sync" ? "กำลัง sync..." : `Sync ทุก OA ที่ sync ได้ (${syncable.length})`}
          </button>
        </div>
      </div>

      {dirty && <div className="notice">มีการแก้ไขที่ยังไม่บันทึก บันทึกก่อนจึงจะ sync ได้ (สถานะด้านล่างเทียบกับข้อมูลที่บันทึกไว้ล่าสุด)</div>}
      {error && <div className="field-error">{error}</div>}
      {statuses === null && !error && <p className="muted">กำลังโหลด...</p>}

      {(statuses || []).map((oa) => {
        const [label, tone] = STATE_LABELS[oa.state] || [oa.state, ""];
        return (
          <div className="rm-oa" key={oa.id}>
            <div className="rm-oa-head">
              <div>
                <span className="rm-oa-name">{oa.name}</span>
                <span className={`badge ${tone}`}>{label}</span>
              </div>
              <button type="button" className="sm" onClick={() => confirmAndSync([oa])} disabled={disabled || oa.state !== "out-of-date"}>Sync OA นี้</button>
            </div>
            {oa.state !== "in-sync" && oa.state !== "out-of-date" && <div className="muted">{oa.message}</div>}
            {oa.foreignMenus.length > 0 && <div className="muted">เมนูของระบบอื่นที่พบ: {oa.foreignMenus.join(", ")}</div>}
            {oa.menus.length > 0 && (
              <div className="rm-levels">
                {oa.menus.map((menu) => (
                  <span key={menu.key} className={`badge ${menu.state === "ok" ? "ok" : "info"}`}>{menu.label}: {MENU_LABELS[menu.state] || menu.state}</span>
                ))}
                {oa.removedKeys.map((key) => <span key={key} className="badge">{key}: จะถูกลบ</span>)}
                {oa.staleCount > 0 && <span className="badge muted">เมนูเก่าค้าง {oa.staleCount}</span>}
              </div>
            )}
          </div>
        );
      })}

      {reports.map((report) => (
        <div className={`rm-report ${report.ok ? "ok" : "failed"}`} key={report.id}>
          <strong>{report.name}: {report.ok ? "สำเร็จ" : "ไม่สำเร็จ"}</strong> — {report.message}
          {report.steps.length > 0 && <ol>{report.steps.map((step, i) => <li key={i}>{step}</li>)}</ol>}
        </div>
      ))}
    </div>
  );
}
