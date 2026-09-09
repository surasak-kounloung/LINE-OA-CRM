import { useCallback, useEffect, useState } from "react";
import { api } from "../api";

const clone = (v) => JSON.parse(JSON.stringify(v));

// โหลด resource หนึ่งชุด แก้ใน draft บันทึกทั้งชุดด้วย PUT
export function useResource(name) {
  const [saved, setSaved] = useState(null);
  const [draft, setDraft] = useState(null);
  const [errors, setErrors] = useState([]);
  const [status, setStatus] = useState("loading"); // loading | ready | saving | error
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setStatus("loading");
    try {
      const data = await api.get(`/${name}`);
      setSaved(data);
      setDraft(clone(data));
      setStatus("ready");
    } catch (e) {
      setStatus("error");
      setMessage(e.message);
    }
  }, [name]);

  useEffect(() => { load(); }, [load]);

  const dirty = draft !== null && JSON.stringify(draft) !== JSON.stringify(saved);

  useEffect(() => {
    if (!dirty) return undefined;
    const handler = (e) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  async function save() {
    setStatus("saving");
    setErrors([]);
    setMessage("");
    try {
      const data = await api.put(`/${name}`, draft);
      setSaved(data);
      setDraft(clone(data));
      setStatus("ready");
      setMessage("บันทึกแล้ว");
    } catch (e) {
      setStatus("ready");
      setErrors(e.errors || []);
      setMessage(e.errors && e.errors.length ? "ข้อมูลไม่ถูกต้อง กรุณาตรวจช่องที่มีข้อผิดพลาด" : e.message);
    }
  }

  function reset() {
    setDraft(clone(saved));
    setErrors([]);
    setMessage("");
  }

  return { draft, setDraft, dirty, save, reset, errors, status, message, reload: load };
}
