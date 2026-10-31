import FieldError from "./FieldError";

// ช่องเลือกข้อความต่อท้าย: 3 โหมด + กล่องแสดงข้อความที่บอทจะส่งจริง
export default function FollowUpField({ field, onChange, inheritLabel, effective, noReply = false, errors, path }) {
  const modes = [["inherit", inheritLabel], ["custom", "ตั้งข้อความเอง"], ["none", "ไม่ส่ง"]];
  return (
    <div className="follow-up-field">
      <div className="mode-picker">
        {modes.map(([mode, label]) => (
          <button
            key={mode}
            type="button"
            className={field.mode === mode ? "active" : ""}
            onClick={() => onChange({ ...field, mode })}
          >
            {label}
          </button>
        ))}
      </div>
      {field.mode === "custom" && (
        <textarea rows={3} value={field.text} onChange={(e) => onChange({ ...field, text: e.target.value })} />
      )}
      {typeof effective === "string"
        ? <div className="effective">{"บอทส่ง: " + effective}</div>
        : <div className="effective none">{noReply ? "บอทไม่ตอบปุ่มนี้ใน OA นี้" : "บอทไม่ส่งข้อความนี้"}</div>}
      <FieldError errors={errors} path={path} />
    </div>
  );
}
