import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api";
import { setDirty } from "../dirtyState";
import { fieldFrom, valueFrom, resolveFollowUp } from "../followUps";
import PageHeader from "../components/PageHeader";
import UnsavedBar from "../components/UnsavedBar";
import FollowUpField from "../components/FollowUpField";

// draft = { oa: field, svc: { [serviceId]: field } }
function toDraft(entry, services) {
  const e = entry || {};
  const svc = {};
  for (const s of services) svc[s.id] = fieldFrom(e.services ? e.services[s.id] : undefined);
  return { oa: fieldFrom(e.text), svc };
}

export default function FollowUpEditPage() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [services, setServices] = useState([]);
  const [saved, setSaved] = useState(null);
  const [draft, setDraft] = useState(null);
  const [errors, setErrors] = useState([]);
  const [status, setStatus] = useState("loading"); // loading | ready | saving | error
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    setStatus("loading");
    Promise.all([api.get("/followups"), api.get("/services")]).then(([d, s]) => {
      if (!active) return;
      const draft0 = toDraft(d.channels[id], s);
      setData(d);
      setServices(s);
      setSaved(draft0);
      setDraft(draft0);
      setStatus("ready");
    }).catch((e) => {
      if (!active) return;
      setStatus("error");
      setMessage(e.message);
    });
    return () => { active = false; };
  }, [id]);

  const dirty = draft !== null && JSON.stringify(draft) !== JSON.stringify(saved);

  useEffect(() => {
    if (!dirty) return undefined;
    const handler = (e) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  useEffect(() => { setDirty(dirty); return () => setDirty(false); }, [dirty]);

  async function save() {
    setStatus("saving");
    setErrors([]);
    setMessage("");
    const body = { services: {} };
    const text = valueFrom(draft.oa);
    if (text !== undefined) body.text = text;
    for (const s of services) {
      const v = valueFrom(draft.svc[s.id]);
      if (v !== undefined) body.services[s.id] = v;
    }
    try {
      const d = await api.put(`/followups/channels/${encodeURIComponent(id)}`, body);
      const draft1 = toDraft(d.channels[id], services);
      setData(d);
      setSaved(draft1);
      setDraft(draft1);
      setMessage("บันทึกแล้ว");
    } catch (e) {
      setErrors(e.errors || []);
      setMessage(e.errors && e.errors.length ? "ข้อมูลไม่ถูกต้อง กรุณาตรวจช่องที่มีข้อผิดพลาด" : e.message);
    }
    setStatus("ready");
  }

  function reset() {
    setDraft(saved);
    setErrors([]);
    setMessage("");
  }

  if (status === "loading" || draft === null) {
    return status === "error" ? <p className="field-error">{message}</p> : <p className="muted">กำลังโหลด...</p>;
  }

  const oa = data.oas.find((o) => String(o.id) === id);
  if (!oa) return <p>ไม่พบ LINE OA นี้ <Link to="/followups">กลับไปรายการ</Link></p>;

  const oaValue = valueFrom(draft.oa);
  const setSvc = (sid, field) => setDraft({ ...draft, svc: { ...draft.svc, [sid]: field } });

  return (
    <div>
      <PageHeader
        crumbs={[{ to: "/followups", label: "ข้อความต่อท้าย" }, { label: `${oa.name} (OA ${oa.id})` }]}
        title={oa.name}
        subtitle={`OA ${oa.id}`}
      />
      <UnsavedBar resource={{ dirty, save, reset, status, message }} />
      <div className="card">
        <div className="card-title">ข้อความของ OA นี้ (ทุกบริการ)</div>
        <FollowUpField
          field={draft.oa}
          onChange={(f) => setDraft({ ...draft, oa: f })}
          inheritLabel="ใช้ข้อความตั้งต้น"
          effective={resolveFollowUp(data.defaultText, oaValue, undefined)}
          errors={errors}
          path="text"
        />
      </div>
      <div className="card">
        <div className="card-title">แยกตามบริการ</div>
        {services.map((s) => (
          <div key={s.id} className="follow-up-row">
            <div className="cell-main">{s.title}</div>
            <FollowUpField
              field={draft.svc[s.id]}
              onChange={(f) => setSvc(s.id, f)}
              inheritLabel="ใช้ของ OA"
              effective={resolveFollowUp(data.defaultText, oaValue, valueFrom(draft.svc[s.id]))}
              noReply={(s.priceImages || []).length === 0}
              errors={errors}
              path={`services.${s.id}`}
            />
          </div>
        ))}
      </div>
      <div className="edit-foot">
        <Link to="/followups" className="btn">← กลับไปรายการ</Link>
      </div>
    </div>
  );
}
