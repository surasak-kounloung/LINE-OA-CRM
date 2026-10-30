// ข้อความติดตามหลังตอบ (follow-up) แยกตาม LINE OA และตามบริการ
// ลำดับการเลือกข้อความ 3 ระดับ (เจอ key ไหนก่อนใช้ระดับนั้น แม้ค่าเป็น ""):
//   1) channels[<เลข OA>].services[<service id>]
//   2) channels[<เลข OA>].text
//   3) defaultText
// ค่าที่เลือกแล้วว่าง (หลัง trim) = ไม่ส่งข้อความ (คืน null) ไม่ตกไประดับถัดไป
// ไฟล์นี้เป็นกฎล้วน ๆ ไม่อ่าน/เขียนไฟล์ และไม่แก้ข้อมูลที่รับเข้ามา
const MAX_FOLLOW_UP_LENGTH = 5000; // เพดานความยาวข้อความของ LINE
const CHANNEL_KEY = /^[1-9]\d*$/;

const isPlainObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const has = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);

function resolveFollowUpText(followUps, channelId, serviceId) {
  const entry = channelId == null ? undefined : followUps.channels?.[String(channelId)];
  let chosen = followUps.defaultText;
  if (entry && entry.services && has(entry.services, serviceId)) chosen = entry.services[serviceId];
  else if (entry && has(entry, "text")) chosen = entry.text;
  return typeof chosen === "string" && chosen.trim() !== "" ? chosen : null;
}

function validateFollowUpText(value, path) {
  if (typeof value !== "string") return [{ path, message: "ต้องเป็นข้อความ" }];
  if (value.length > MAX_FOLLOW_UP_LENGTH) {
    return [{ path, message: `ยาวได้ไม่เกิน ${MAX_FOLLOW_UP_LENGTH} ตัวอักษร` }];
  }
  return [];
}

// prefix เช่น "channels.2." ; path ของราก = prefix ตัดจุดท้าย (หรือ "")
function validateFollowUpEntry(entry, prefix = "") {
  if (!isPlainObject(entry)) return [{ path: prefix.replace(/\.$/, ""), message: "รูปแบบไม่ถูกต้อง" }];
  const errors = [];
  if (entry.text !== undefined) errors.push(...validateFollowUpText(entry.text, `${prefix}text`));
  if (entry.services !== undefined) {
    if (!isPlainObject(entry.services)) {
      errors.push({ path: `${prefix}services`, message: "รูปแบบไม่ถูกต้อง" });
    } else {
      for (const [id, text] of Object.entries(entry.services)) {
        errors.push(...validateFollowUpText(text, `${prefix}services.${id}`));
      }
    }
  }
  return errors;
}

function validateFollowUps(value) {
  if (!isPlainObject(value)) return [{ path: "", message: "รูปแบบไม่ถูกต้อง" }];
  const errors = validateFollowUpText(value.defaultText, "defaultText");
  if (!isPlainObject(value.channels)) {
    errors.push({ path: "channels", message: "รูปแบบไม่ถูกต้อง" });
    return errors;
  }
  for (const [key, entry] of Object.entries(value.channels)) {
    if (!CHANNEL_KEY.test(key)) {
      errors.push({ path: `channels.${key}`, message: "เลข OA ต้องเป็นจำนวนเต็มตั้งแต่ 1 ขึ้นไป ไม่มีศูนย์นำหน้า" });
      continue;
    }
    errors.push(...validateFollowUpEntry(entry, `channels.${key}.`));
  }
  return errors;
}

// เรียกหลัง validate ผ่านแล้ว: trim ทุกค่า ตัด service id ที่ไม่มีอยู่ คืน null ถ้าไม่เหลืออะไร
function normalizeFollowUpEntry(entry, serviceIds) {
  const result = {};
  if (entry.text !== undefined) result.text = entry.text.trim();
  if (entry.services !== undefined) {
    const services = {};
    for (const [id, text] of Object.entries(entry.services)) {
      if (serviceIds.includes(id)) services[id] = text.trim();
    }
    if (Object.keys(services).length > 0) result.services = services;
  }
  return result.text === undefined && result.services === undefined ? null : result;
}

// คืนข้อมูลชุดใหม่ที่ตัด service id ที่ถูกลบออกจากทุก OA และทิ้ง entry ที่ว่างเปล่า (ไม่แก้ของเดิม)
function pruneServices(followUps, serviceIds) {
  const channels = {};
  for (const [key, entry] of Object.entries(followUps.channels)) {
    const next = {};
    if (has(entry, "text")) next.text = entry.text;
    if (entry.services) {
      const services = {};
      for (const [id, text] of Object.entries(entry.services)) {
        if (serviceIds.includes(id)) services[id] = text;
      }
      if (Object.keys(services).length > 0) next.services = services;
    }
    if (Object.keys(next).length > 0) channels[key] = next;
  }
  return { ...followUps, channels };
}

module.exports = {
  MAX_FOLLOW_UP_LENGTH,
  resolveFollowUpText,
  validateFollowUpText,
  validateFollowUpEntry,
  validateFollowUps,
  normalizeFollowUpEntry,
  pruneServices,
};
