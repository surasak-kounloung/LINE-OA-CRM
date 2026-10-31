// แถบบันทึก/ยกเลิก แสดงสถานะของ useResource
export default function UnsavedBar({ resource }) {
  const { dirty, save, reset, status, message } = resource;
  return (
    <div className={`unsaved-bar ${dirty ? "dirty" : ""}`}>
      <div className="state">
        <span className="dot" />
        <span>{dirty ? "มีการเปลี่ยนแปลงที่ยังไม่บันทึก" : message || "ข้อมูลตรงกับที่บันทึกไว้"}</span>
      </div>
      <div className="actions">
        <button type="button" onClick={reset} disabled={!dirty || status === "saving"}>ยกเลิก</button>
        <button type="button" className="primary" onClick={save} disabled={!dirty || status === "saving"}>
          {status === "saving" ? "กำลังบันทึก..." : "บันทึก"}
        </button>
      </div>
      {dirty && message && <div className="bar-message">{message}</div>}
    </div>
  );
}
