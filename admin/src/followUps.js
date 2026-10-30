// สำเนาฝั่ง client ของกฎเลือกข้อความต่อท้าย (ต้องให้ผลเหมือนกับ resolveFollowUpText ใน services/followUps.js)
// ค่าที่เก็บ: ไม่มี key = ใช้ของระดับบน, "" = ไม่ส่ง, ข้อความ = ตั้งเอง

// ค่าจาก server -> สถานะของช่อง
export function fieldFrom(value) {
  if (value === undefined) return { mode: "inherit", text: "" };
  if (value.trim() === "") return { mode: "none", text: "" };
  return { mode: "custom", text: value };
}

// สถานะของช่อง -> ค่าที่ส่งให้ server (undefined = ไม่ส่ง key)
export function valueFrom(field) {
  if (field.mode === "inherit") return undefined;
  if (field.mode === "none") return "";
  return field.text;
}

// service -> OA -> ค่าตั้งต้น: เจอ key ไหนก่อนใช้ระดับนั้น แม้เป็น "" ; ว่างหลัง trim = null (ไม่ส่ง)
export function resolveFollowUp(defaultText, oaValue, serviceValue) {
  let chosen = defaultText;
  if (serviceValue !== undefined) chosen = serviceValue;
  else if (oaValue !== undefined) chosen = oaValue;
  return typeof chosen === "string" && chosen.trim() !== "" ? chosen : null;
}
