import { useState } from "react";
import { api } from "../api";

// ดึงข้อความที่บอทจะตอบสำหรับ trigger นี้ (จากข้อมูลที่บันทึกแล้ว) และให้ copy ไปวางใน LINE Flex Simulator
export default function FlexPreviewButton({ trigger }) {
  const [json, setJson] = useState(null);
  const [error, setError] = useState("");

  async function open() {
    setError("");
    try {
      const messages = await api.get(`/preview/${encodeURIComponent(trigger)}`);
      setJson(JSON.stringify(messages, null, 2));
    } catch (e) {
      setError(e.status === 404 ? "ยังไม่มีข้อความสำหรับ trigger นี้ (บันทึกก่อน)" : e.message);
    }
  }

  return (
    <span className="flex-preview">
      <button type="button" className="link" onClick={open}>ดู Flex JSON</button>
      {error && <span className="field-error">{error}</span>}
      {json !== null && (
        <div className="modal-backdrop" onClick={() => setJson(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <strong>{trigger}</strong>
              <div>
                <button type="button" onClick={() => navigator.clipboard.writeText(json)}>คัดลอก</button>
                <button type="button" onClick={() => setJson(null)}>ปิด</button>
              </div>
            </div>
            <textarea readOnly value={json} />
          </div>
        </div>
      )}
    </span>
  );
}
