const test = require("node:test");
const assert = require("node:assert/strict");
const {
  validatePromotions, validateServices, validateBranches, validateRegions, DAYS,
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
