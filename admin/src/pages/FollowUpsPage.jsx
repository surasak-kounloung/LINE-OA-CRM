import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { confirmDiscard } from "../dirtyState";
import { useDirtyGuard } from "../useDirtyGuard";
import { resolveFollowUp } from "../followUps";
import PageHeader from "../components/PageHeader";
import FieldError from "../components/FieldError";

function summary(entry) {
  if (!entry || entry.text === undefined) return <span className="badge muted" style={{ margin: 0 }}>ใช้ค่าตั้งต้น</span>;
  const t = entry.text.trim();
  if (t === "") return <span className="badge muted" style={{ margin: 0 }}>ไม่ส่ง</span>;
  return (
    <>
      <span className="badge info" style={{ margin: 0 }}>ตั้งเอง</span>{" "}
      <span>{t.length > 40 ? t.slice(0, 40) + "…" : t}</span>
    </>
  );
}

export default function FollowUpsPage() {
  const [data, setData] = useState(null);
  const [text, setText] = useState("");
  const [status, setStatus] = useState("loading"); // loading | ready | saving | error
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState([]);
  const [failed, setFailed] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    let active = true;
    api.get("/followups").then((d) => {
      if (!active) return;
      setData(d);
      setText(d.defaultText);
      setStatus("ready");
    }).catch((e) => {
      if (!active) return;
      setStatus("error");
      setMessage(e.message);
    });
    return () => { active = false; };
  }, []);

  const dirty = data !== null && text !== data.defaultText;

  useDirtyGuard(dirty);

  async function save() {
    setStatus("saving");
    setErrors([]);
    setMessage("");
    setFailed(false);
    try {
      const d = await api.put("/followups/default", { text });
      setData(d);
      setText(d.defaultText);
      setMessage("บันทึกแล้ว");
    } catch (e) {
      setErrors(e.errors || []);
      setMessage(e.errors && e.errors.length ? "" : e.message);
      setFailed(true);
    }
    setStatus("ready");
  }

  if (status === "loading" || data === null) {
    return status === "error" ? <p className="field-error">{message}</p> : <p className="muted">กำลังโหลด...</p>;
  }

  const effective = resolveFollowUp(text, undefined, undefined);
  const q = query.trim().toLowerCase();
  const oas = data.oas.filter((o) => q === "" || String(o.id).includes(q) || o.name.toLowerCase().includes(q));

  return (
    <div>
      <PageHeader title="ข้อความต่อท้าย" subtitle="ข้อความที่บอทส่งต่อจากการตอบบริการ ตั้งแยกตาม LINE OA และตามบริการได้" />
      <div className="card">
        <div className="card-title">ข้อความตั้งต้น</div>
        <label>
          <span className="hint" style={{ marginTop: 0 }}>ใช้กับ OA ที่ยังไม่ได้ตั้ง และ OA ใหม่ที่เพิ่มภายหลัง</span>
          <textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} />
        </label>
        {typeof effective === "string"
          ? <div className="effective">{"บอทส่ง: " + effective}</div>
          : <div className="effective none">บอทไม่ส่งข้อความนี้ (OA ที่ใช้ข้อความตั้งต้นจะไม่ส่งอะไร)</div>}
        <FieldError errors={errors} path="text" />
        {message && <div className={failed ? "field-error" : "muted"}>{message}</div>}
        <div style={{ marginTop: "0.6rem" }}>
          <button type="button" className="primary" onClick={save} disabled={!dirty || status === "saving"}>
            {status === "saving" ? "กำลังบันทึก..." : "บันทึก"}
          </button>
        </div>
      </div>
      <div style={{ marginBottom: "0.8rem" }}>
        <input placeholder="ค้นหาชื่อหรือเลข OA" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>LINE OA</th><th>ข้อความของ OA</th><th className="num">บริการที่ตั้งแยก</th></tr></thead>
          <tbody>
            {oas.map((o) => {
              const entry = data.channels[String(o.id)];
              const n = entry && entry.services ? Object.keys(entry.services).length : 0;
              return (
                <tr key={o.id}>
                  <td><Link to={`/followups/${o.id}`} onClick={(e) => { if (!confirmDiscard()) e.preventDefault(); }}>{o.id}. {o.name}</Link></td>
                  <td>{summary(entry)}</td>
                  <td className="num">{n > 0 ? n : <span className="muted">—</span>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="muted">เลข OA มาจาก .env (LINE_CHANNEL_*_&lt;เลข&gt;) ห้ามสลับเลข ไม่อย่างนั้นข้อความจะไปอยู่กับสาขาอื่น</p>
    </div>
  );
}
