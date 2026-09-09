export function errorFor(errors, path) {
  const hit = (errors || []).find((e) => e.path === path);
  return hit ? hit.message : undefined;
}

export function move(list, from, to) {
  if (to < 0 || to >= list.length) return list;
  const next = list.slice();
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

export function removeAt(list, index) {
  return list.filter((_, i) => i !== index);
}

export function slugify(text, fallback) {
  const s = String(text || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return s || fallback;
}

export function chunkCount(n, size) {
  return Math.ceil(n / size);
}

export const DAYS = ["วันจันทร์", "วันอังคาร", "วันพุธ", "วันพฤหัสบดี", "วันศุกร์", "วันเสาร์", "วันอาทิตย์"];
export const MENUS = [
  { value: "main", label: "เมนูหลัก" },
  { value: "thonglor", label: "เมนูทองหล่อ" },
  { value: "both", label: "ทั้งสองเมนู" },
];
export const MAX_PRICE_IMAGES = 12;
export const MAX_BUBBLES = 12;
