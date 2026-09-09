// ตรวจข้อมูลก่อนบันทึก คืน [] ถ้าผ่าน หรือ [{ path, message }] (path เทียบกับ array ราก เช่น "[3].doctors[1].imageUrl")
const DAYS = ["วันจันทร์", "วันอังคาร", "วันพุธ", "วันพฤหัสบดี", "วันศุกร์", "วันเสาร์", "วันอาทิตย์"];
const MENUS = ["main", "thonglor", "both"];
const MAX_PRICE_IMAGES = 12;

const isNonEmpty = (v) => typeof v === "string" && v.trim() !== "";
const isUrl = (v) => typeof v === "string" && /^https?:\/\//.test(v);

function checkArrayRoot(errors, value) {
  if (!Array.isArray(value)) {
    errors.push({ path: "", message: "ต้องเป็นรายการ (array)" });
    return false;
  }
  return true;
}
function checkString(errors, path, v) {
  if (!isNonEmpty(v)) errors.push({ path, message: "ต้องระบุ" });
}
function checkUrl(errors, path, v) {
  if (!isUrl(v)) errors.push({ path, message: "ต้องเป็น URL ขึ้นต้นด้วย http:// หรือ https://" });
}
function checkBool(errors, path, v) {
  if (typeof v !== "boolean") errors.push({ path, message: "ต้องเป็น true/false" });
}
function checkId(errors, path, v) {
  if (typeof v !== "string" || !/^[a-z0-9-]+$/.test(v)) errors.push({ path, message: "id ใช้ได้เฉพาะ a-z, 0-9 และ -" });
}
function checkUnique(errors, items, field, label) {
  const seen = new Map();
  items.forEach((item, i) => {
    const v = item && item[field];
    if (!isNonEmpty(String(v ?? ""))) return;
    if (seen.has(v)) errors.push({ path: `[${i}].${field}`, message: `${label} ซ้ำกับรายการที่ ${seen.get(v) + 1}` });
    else seen.set(v, i);
  });
}
function checkStringList(errors, path, list, check) {
  if (!Array.isArray(list)) {
    errors.push({ path, message: "ต้องเป็นรายการ" });
    return;
  }
  list.forEach((v, i) => check(errors, `${path}[${i}]`, v));
}
function isObject(v) {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

function validatePromotions(list) {
  const errors = [];
  if (!checkArrayRoot(errors, list)) return errors;
  list.forEach((p, i) => {
    if (!isObject(p)) { errors.push({ path: `[${i}]`, message: "รูปแบบไม่ถูกต้อง" }); return; }
    checkId(errors, `[${i}].id`, p.id);
    checkUrl(errors, `[${i}].image`, p.image);
    checkString(errors, `[${i}].title`, p.title);
    checkStringList(errors, `[${i}].lines`, p.lines, checkString);
    checkString(errors, `[${i}].inquiryText`, p.inquiryText);
    checkBool(errors, `[${i}].hot`, p.hot);
  });
  checkUnique(errors, list, "id", "id");
  return errors;
}

function validateServices(list) {
  const errors = [];
  if (!checkArrayRoot(errors, list)) return errors;
  list.forEach((s, i) => {
    if (!isObject(s)) { errors.push({ path: `[${i}]`, message: "รูปแบบไม่ถูกต้อง" }); return; }
    checkId(errors, `[${i}].id`, s.id);
    checkUrl(errors, `[${i}].image`, s.image);
    checkString(errors, `[${i}].title`, s.title);
    checkString(errors, `[${i}].subtitle`, s.subtitle);
    checkString(errors, `[${i}].actionText`, s.actionText);
    checkBool(errors, `[${i}].hot`, s.hot);
    if (Array.isArray(s.priceImages) && s.priceImages.length > MAX_PRICE_IMAGES) {
      errors.push({ path: `[${i}].priceImages`, message: `รูปราคาได้ไม่เกิน ${MAX_PRICE_IMAGES} รูป` });
    } else {
      checkStringList(errors, `[${i}].priceImages`, s.priceImages, checkUrl);
    }
  });
  checkUnique(errors, list, "id", "id");
  checkUnique(errors, list, "actionText", "ข้อความปุ่ม (actionText)");
  return errors;
}

function sectionNames(regions) {
  if (!Array.isArray(regions)) return [];
  return regions.flatMap((r) => (r && Array.isArray(r.sections) ? r.sections : []));
}

function validateBranches(list, regions) {
  const errors = [];
  if (!checkArrayRoot(errors, list)) return errors;
  const sections = new Set(sectionNames(regions));
  list.forEach((b, i) => {
    if (!isObject(b)) { errors.push({ path: `[${i}]`, message: "รูปแบบไม่ถูกต้อง" }); return; }
    checkId(errors, `[${i}].id`, b.id);
    checkString(errors, `[${i}].trigger`, b.trigger);
    checkString(errors, `[${i}].displayName`, b.displayName);
    if (!sections.has(b.region)) errors.push({ path: `[${i}].region`, message: "ไม่มีภูมิภาคนี้ในรายการภูมิภาค" });
    if (!MENUS.includes(b.menu)) errors.push({ path: `[${i}].menu`, message: `ต้องเป็นหนึ่งใน ${MENUS.join(", ")}` });
    checkBool(errors, `[${i}].enabled`, b.enabled);
    checkString(errors, `[${i}].fontSize`, b.fontSize);
    checkUrl(errors, `[${i}].mapUrl`, b.mapUrl);
    checkUrl(errors, `[${i}].imageUrl`, b.imageUrl);
    checkString(errors, `[${i}].phoneNumber`, b.phoneNumber);
    checkString(errors, `[${i}].lineId`, b.lineId);
    if (b.lineUrl !== undefined && b.lineUrl !== "" && !isUrl(b.lineUrl)) {
      errors.push({ path: `[${i}].lineUrl`, message: "ต้องเป็น URL ขึ้นต้นด้วย http:// หรือ https://" });
    }
    if (b.mainMenuActionText !== undefined && typeof b.mainMenuActionText !== "string") {
      errors.push({ path: `[${i}].mainMenuActionText`, message: "ต้องเป็นข้อความ" });
    }
    if (!Array.isArray(b.doctors)) {
      errors.push({ path: `[${i}].doctors`, message: "ต้องเป็นรายการ" });
    } else {
      b.doctors.forEach((d, j) => {
        const p = `[${i}].doctors[${j}]`;
        if (!isObject(d)) { errors.push({ path: p, message: "รูปแบบไม่ถูกต้อง" }); return; }
        if (!DAYS.includes(d.day)) errors.push({ path: `${p}.day`, message: "ต้องเลือกวันในสัปดาห์" });
        checkString(errors, `${p}.name`, d.name);
        checkString(errors, `${p}.license`, d.license);
        checkUrl(errors, `${p}.imageUrl`, d.imageUrl);
      });
    }
  });
  checkUnique(errors, list, "id", "id");
  checkUnique(errors, list, "trigger", "ข้อความ trigger");
  return errors;
}

function validateRegions(regions, branches) {
  const errors = [];
  if (!checkArrayRoot(errors, regions)) return errors;
  const seen = new Map();
  regions.forEach((r, i) => {
    if (!isObject(r) || !Array.isArray(r.sections)) {
      errors.push({ path: `[${i}].sections`, message: "ต้องเป็นรายการหัวข้อ" });
      return;
    }
    if (r.sections.length === 0) {
      errors.push({ path: `[${i}].sections`, message: "ต้องมีอย่างน้อย 1 หัวข้อ" });
    }
    r.sections.forEach((s, j) => {
      const p = `[${i}].sections[${j}]`;
      if (!isNonEmpty(s)) { errors.push({ path: p, message: "ต้องระบุ" }); return; }
      if (seen.has(s)) errors.push({ path: p, message: "ชื่อหัวข้อซ้ำ" });
      else seen.set(s, p);
    });
  });
  const names = new Set(seen.keys());
  (Array.isArray(branches) ? branches : []).forEach((b) => {
    if (b && !names.has(b.region)) {
      errors.push({ path: "", message: `หัวข้อ "${b.region}" ลบไม่ได้ เพราะสาขา "${b.trigger}" ยังใช้อยู่` });
    }
  });
  return errors;
}

module.exports = {
  validatePromotions, validateServices, validateBranches, validateRegions,
  sectionNames, DAYS, MENUS, MAX_PRICE_IMAGES,
};
