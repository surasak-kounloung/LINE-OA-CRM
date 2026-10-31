// สถานะ "มีการแก้ไขที่ยังไม่บันทึก" แบบ global — ใช้เตือนก่อนออกจากหน้าโดยการนำทางภายในแอป
// (การปิด/รีเฟรชแท็บใช้ beforeunload ใน useResource.js แยกต่างหาก)
let dirty = false;
export const setDirty = (v) => { dirty = Boolean(v); };
export const isDirty = () => dirty;
export const confirmDiscard = () => !dirty || window.confirm("มีการเปลี่ยนแปลงที่ยังไม่บันทึก ต้องการออกจากหน้านี้โดยไม่บันทึกหรือไม่?");
