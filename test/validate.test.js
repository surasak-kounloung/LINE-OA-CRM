const test = require("node:test");
const assert = require("node:assert/strict");
const {
  validatePromotions, validateServices, validateBranches, validateRegions, DAYS,
  validateRichMenu, normalizeRichMenu,
} = require("../services/validate");

const promo = () => ({ id: "p1", image: "https://x/a.jpg", title: "โปร", lines: ["a"], inquiryText: "สอบถาม", hot: false });
const service = () => ({ id: "s1", image: "https://x/a.jpg", title: "บริการ", subtitle: "Sub", actionText: "สอบถามบริการ", hot: true, priceImages: ["https://x/p.jpg"] });
const regions = () => [{ sections: ["ในเมือง", "ตอนเหนือ"] }];
const branch = () => ({
  id: "siam", trigger: "สยาม", displayName: "สยาม", region: "ในเมือง", menu: "main", enabled: true,
  fontSize: "xxl", mapUrl: "https://g/map", imageUrl: "https://x/b.jpg", phoneNumber: "093 110 9000",
  lineId: "@vsq", lineUrl: "https://line.me/x",
  doctors: [{ day: "วันจันทร์", name: "พญ.ก", license: "ว.1", imageUrl: "https://x/d.png" }],
});
const paths = (errors) => errors.map((e) => e.path);

test("valid promotions pass", () => {
  assert.deepEqual(validatePromotions([promo()]), []);
});

test("promotions: non-array, bad url, missing title, non-bool hot, duplicate id", () => {
  assert.equal(validatePromotions({})[0].path, "");
  const bad = [promo(), { ...promo(), image: "ftp://x", title: " ", hot: "yes" }];
  const errs = validatePromotions(bad);
  assert.deepEqual(paths(errs).sort(), ["[1].hot", "[1].id", "[1].image", "[1].title"].sort());
});

test("promotions: lines must be array of strings", () => {
  assert.deepEqual(paths(validatePromotions([{ ...promo(), lines: "x" }])), ["[0].lines"]);
  assert.deepEqual(paths(validatePromotions([{ ...promo(), lines: [1] }])), ["[0].lines[0]"]);
});

test("valid services pass, empty priceImages allowed", () => {
  assert.deepEqual(validateServices([service(), { ...service(), id: "s2", actionText: "อื่น", priceImages: [] }]), []);
});

test("services: duplicate actionText, >12 price images, bad price url", () => {
  const many = Array.from({ length: 13 }, (_, i) => `https://x/${i}.jpg`);
  const errs = validateServices([service(), { ...service(), id: "s2", priceImages: many }, { ...service(), id: "s3", actionText: "t3", priceImages: ["nope"] }]);
  assert.deepEqual(paths(errs).sort(), ["[1].actionText", "[1].priceImages", "[2].priceImages[0]"].sort());
});

test("valid branches pass, lineUrl optional, doctors may be empty", () => {
  const b = branch();
  delete b.lineUrl;
  b.doctors = [];
  assert.deepEqual(validateBranches([b], regions()), []);
});

test("branches: unknown region, bad menu, bad day, duplicate trigger, bad lineUrl when present", () => {
  const b1 = branch();
  const b2 = { ...branch(), id: "b2", region: "ไม่มี", menu: "x", lineUrl: "bad", doctors: [{ day: "จันทร์", name: "", license: "ว.1", imageUrl: "https://x" }] };
  const errs = validateBranches([b1, b2], regions());
  assert.deepEqual(paths(errs).sort(), ["[1].doctors[0].day", "[1].doctors[0].name", "[1].lineUrl", "[1].menu", "[1].region", "[1].trigger"].sort());
});

test("branches: mainMenuActionText optional but must be string if present", () => {
  assert.deepEqual(validateBranches([{ ...branch(), mainMenuActionText: "ตารางแพทย์สาขาทองหล่อ" }], regions()), []);
  assert.deepEqual(paths(validateBranches([{ ...branch(), mainMenuActionText: 5 }], regions())), ["[0].mainMenuActionText"]);
});

test("id must be a string", () => {
  assert.deepEqual(paths(validatePromotions([{ ...promo(), id: 123 }])), ["[0].id"]);
  assert.deepEqual(paths(validateBranches([{ ...branch(), id: true }], regions())), ["[0].id"]);
});

test("regions: valid", () => {
  assert.deepEqual(validateRegions(regions(), [branch()]), []);
});

test("regions: empty sections, duplicate section, section still used by a branch", () => {
  const errs = validateRegions([{ sections: [] }, { sections: ["A", "A"] }], [branch()]);
  assert.deepEqual(paths(errs).sort(), ["", "[0].sections", "[1].sections[1]"].sort());
  assert.match(errs.find((e) => e.path === "").message, /ในเมือง/);
  assert.match(errs.find((e) => e.path === "").message, /สยาม/);
});

test("DAYS lists the seven Thai day names", () => {
  assert.equal(DAYS.length, 7);
  assert.equal(DAYS[0], "วันจันทร์");
});

const richMenu = (over = {}) => ({
  size: { width: 2500, height: 1686 },
  chatBarText: "Menu",
  selected: true,
  areas: [
    { x: 1596, y: 0, width: 904, height: 1084, action: { type: "uri", uri: "https://liff.line.me/2007605538-yPqjO4RW" } },
    { x: 0, y: 1082, width: 833, height: 604, action: { type: "message", text: "บริการทั้งหมด" } },
  ],
  menus: [
    { key: "default", label: "ก่อนสมัคร", image: "https://img.example/default.jpg", isDefault: true },
    { key: "gold", label: "V Gold", image: "https://img.example/gold.jpg", isDefault: false },
  ],
  ...over,
});
const withArea = (patch) => richMenu({ areas: [{ ...richMenu().areas[0], ...patch }] });
const withMenu = (patch) => richMenu({ menus: [{ ...richMenu().menus[0], ...patch }] });

test("richmenu: a complete definition passes, with or without menus", () => {
  assert.deepEqual(validateRichMenu(richMenu()), []);
  assert.deepEqual(validateRichMenu(richMenu({ menus: [] })), []);
});

test("richmenu: the file committed in data/ passes", () => {
  assert.deepEqual(validateRichMenu(require("../data/richmenu.json")), []);
});

test("richmenu: the root must be an object", () => {
  for (const value of [null, [], "x", 3]) assert.deepEqual(paths(validateRichMenu(value)), [""]);
});

test("richmenu: size limits and proportions", () => {
  assert.deepEqual(paths(validateRichMenu(richMenu({ size: { width: 799, height: 1686 } }))), ["size.width"]);
  assert.deepEqual(paths(validateRichMenu(richMenu({ size: { width: 2501, height: 1686 } }))), ["size.width"]);
  assert.deepEqual(paths(validateRichMenu(richMenu({ size: { width: 2500.5, height: 1686 } }))), ["size.width"]);
  assert.deepEqual(paths(validateRichMenu(richMenu({ size: { width: 2500, height: 249 }, areas: [{ ...richMenu().areas[0], y: 0, height: 100 }] }))), ["size.height"]);
  // 2500 / 1725 = 1.449 ต่ำกว่า 1.45
  assert.deepEqual(paths(validateRichMenu(richMenu({ size: { width: 2500, height: 1725 } }))), ["size.height"]);
  assert.deepEqual(validateRichMenu(richMenu({ size: { width: 2500, height: 1724 } })), []);
  assert.deepEqual(paths(validateRichMenu(richMenu({ size: undefined }))).sort(), ["size.height", "size.width"]);
  assert.deepEqual(paths(validateRichMenu(richMenu({ size: { width: "2500", height: "1686" } }))).sort(), ["size.height", "size.width"]);
});

test("richmenu: chat bar text and selected", () => {
  assert.deepEqual(paths(validateRichMenu(richMenu({ chatBarText: "" }))), ["chatBarText"]);
  assert.deepEqual(paths(validateRichMenu(richMenu({ chatBarText: "   " }))), ["chatBarText"]);
  assert.deepEqual(paths(validateRichMenu(richMenu({ chatBarText: "x".repeat(15) }))), ["chatBarText"]);
  assert.deepEqual(validateRichMenu(richMenu({ chatBarText: "x".repeat(14) })), []);
  assert.deepEqual(paths(validateRichMenu(richMenu({ selected: "true" }))), ["selected"]);
});

test("richmenu: between 1 and 20 areas", () => {
  assert.deepEqual(paths(validateRichMenu(richMenu({ areas: [] }))), ["areas"]);
  assert.deepEqual(paths(validateRichMenu(richMenu({ areas: undefined }))), ["areas"]);
  const area = richMenu().areas[1];
  assert.deepEqual(validateRichMenu(richMenu({ areas: Array.from({ length: 20 }, () => area) })), []);
  assert.deepEqual(paths(validateRichMenu(richMenu({ areas: Array.from({ length: 21 }, () => area) }))), ["areas"]);
  assert.deepEqual(paths(validateRichMenu(richMenu({ areas: ["x"] }))), ["areas[0]"]);
});

test("richmenu: area bounds are whole numbers inside the menu", () => {
  assert.deepEqual(paths(validateRichMenu(withArea({ x: -1 }))), ["areas[0].x"]);
  assert.deepEqual(paths(validateRichMenu(withArea({ y: 1.5 }))), ["areas[0].y"]);
  assert.deepEqual(paths(validateRichMenu(withArea({ width: 0 }))), ["areas[0].width"]);
  assert.deepEqual(paths(validateRichMenu(withArea({ height: "" }))), ["areas[0].height"]);
  // 1596 + 905 = 2501 เลยขอบขวา, 0 + 1687 เลยขอบล่าง
  assert.deepEqual(paths(validateRichMenu(withArea({ width: 905 }))), ["areas[0].width"]);
  assert.deepEqual(paths(validateRichMenu(withArea({ height: 1687 }))), ["areas[0].height"]);
  assert.deepEqual(validateRichMenu(withArea({ x: 0, y: 0, width: 2500, height: 1686 })), []);
});

test("richmenu: an area sends a message or opens a link", () => {
  assert.deepEqual(paths(validateRichMenu(withArea({ action: { type: "message", text: "" } }))), ["areas[0].action.text"]);
  assert.deepEqual(paths(validateRichMenu(withArea({ action: { type: "message", text: "x".repeat(301) } }))), ["areas[0].action.text"]);
  assert.deepEqual(validateRichMenu(withArea({ action: { type: "message", text: "ข้อความที่ยังไม่มี trigger" } })), []);
  for (const uri of ["https://vsquareclinic.com/", "http://example.com/a", "line://ti/p/@vsq", "tel:021234567"]) {
    assert.deepEqual(validateRichMenu(withArea({ action: { type: "uri", uri } })), [], uri);
  }
  for (const uri of ["", "vsquareclinic.com", "javascript:alert(1)", "https://", "https://a b", "https://x/" + "a".repeat(1000)]) {
    assert.deepEqual(paths(validateRichMenu(withArea({ action: { type: "uri", uri } }))), ["areas[0].action.uri"], uri);
  }
  assert.deepEqual(paths(validateRichMenu(withArea({ action: { type: "postback", data: "x" } }))), ["areas[0].action.type"]);
  assert.deepEqual(paths(validateRichMenu(withArea({ action: undefined }))), ["areas[0].action.type"]);
});

test("richmenu: menu key, label, image and default flag", () => {
  for (const key of ["", "Gold", "v gold", "ทอง", "a".repeat(21), 5]) {
    assert.deepEqual(paths(validateRichMenu(withMenu({ key }))), ["menus[0].key"], String(key));
  }
  assert.deepEqual(validateRichMenu(withMenu({ key: "v-gold-2" })), []);
  assert.deepEqual(paths(validateRichMenu(withMenu({ label: " " }))), ["menus[0].label"]);
  assert.deepEqual(paths(validateRichMenu(withMenu({ label: "x".repeat(51) }))), ["menus[0].label"]);
  for (const image of ["", "http://img.example/a.jpg", "img.example/a.jpg", "https://img.example/a b.jpg"]) {
    assert.deepEqual(paths(validateRichMenu(withMenu({ image }))), ["menus[0].image"], image);
  }
  assert.deepEqual(paths(validateRichMenu(richMenu({ menus: [{ ...richMenu().menus[0] }, { ...richMenu().menus[1], isDefault: "no" }] }))), ["menus[1].isDefault"]);
  assert.deepEqual(paths(validateRichMenu(richMenu({ menus: ["x"] }))), ["menus[0]", "menus"]);
  assert.deepEqual(paths(validateRichMenu(richMenu({ menus: undefined }))), ["menus"]);
});

test("richmenu: keys are unique and exactly one menu is the default", () => {
  const [first, second] = richMenu().menus;
  const duplicate = validateRichMenu(richMenu({ menus: [first, { ...second, key: "default" }] }));
  assert.deepEqual(paths(duplicate), ["menus[1].key"]);
  assert.match(duplicate[0].message, /รายการที่ 1/);
  assert.deepEqual(paths(validateRichMenu(richMenu({ menus: [first, { ...second, isDefault: true }] }))), ["menus"]);
  assert.deepEqual(paths(validateRichMenu(richMenu({ menus: [{ ...first, isDefault: false }, second] }))), ["menus"]);
  const many = Array.from({ length: 21 }, (_, i) => ({ ...second, key: `k${i}`, isDefault: i === 0 }));
  assert.deepEqual(paths(validateRichMenu(richMenu({ menus: many }))), ["menus"]);
});

test("richmenu: normalizeRichMenu keeps only the known fields", () => {
  const messy = richMenu({ extra: 1 });
  messy.size.depth = 3;
  messy.areas[0].action.text = "leftover";
  messy.areas[1].action.uri = "leftover";
  messy.areas[1].note = "x";
  messy.menus[0].richMenuId = "rm-1";
  assert.deepEqual(normalizeRichMenu(messy), richMenu());
});
