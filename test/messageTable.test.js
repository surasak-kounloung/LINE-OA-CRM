const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const { build, createMessageTable, scheduleTrigger, FOLLOW_UP_TEXT } = require("../services/messageTable");
const { createDataStore } = require("../services/dataStore");

const doctor = (n) => ({ day: "วันจันทร์", name: `หมอ${n}`, license: `ว.${n}`, imageUrl: `https://x/${n}.png` });
const branch = (over = {}) => ({
  id: "siam", trigger: "สยาม", displayName: "สยาม", region: "ในเมือง", menu: "main", enabled: true,
  fontSize: "xxl", mapUrl: "https://g/map", imageUrl: "https://x/b.jpg", phoneNumber: "093 110 9000",
  lineId: "@vsq", lineUrl: "https://line.me/x", doctors: [doctor(1)], ...over,
});
const data = (over = {}) => ({
  promotions: [{ id: "p", image: "https://x/p.jpg", title: "โปร", lines: [], inquiryText: "สอบถามโปร", hot: false }],
  services: [
    { id: "s", image: "https://x/s.jpg", title: "บริการ", subtitle: "S", actionText: "สอบถามบริการ", hot: true, priceImages: ["https://x/1.jpg"] },
    { id: "o", image: "https://x/o.jpg", title: "อื่น", subtitle: "O", actionText: "สอบถามอื่น", hot: true, priceImages: [] },
  ],
  regions: [{ sections: ["ในเมือง"] }, { sections: ["เหนือ", "นนท์"] }],
  branches: [branch()],
  ...over,
});

test("fixed menu triggers and service triggers exist", () => {
  const t = build(data());
  for (const k of ["บริการทั้งหมด", "โปรโมชั่นล่าสุด", "ตารางแพทย์", "สอบถามบริการ", "สอบถามอื่น"]) {
    assert.ok(t.has(k), k);
  }
  assert.equal(t.get("โปรโมชั่นล่าสุด")[0].altText, "โปรโมชั่นล่าสุด");
});

test("service with price images replies carousel + follow-up; without replies follow-up only", () => {
  const t = build(data());
  const withImages = t.get("สอบถามบริการ");
  assert.equal(withImages.length, 2);
  assert.equal(withImages[0].type, "flex");
  assert.equal(withImages[0].altText, "สอบถามบริการ");
  assert.deepEqual(withImages[1], { type: "text", text: FOLLOW_UP_TEXT });
  assert.deepEqual(t.get("สอบถามอื่น"), [{ type: "text", text: FOLLOW_UP_TEXT }]);
});

test("branch trigger replies map + icon table; schedule trigger replies doctor carousel", () => {
  const t = build(data());
  const reply = t.get("สยาม");
  assert.equal(reply.length, 2);
  assert.equal(reply[0].altText, "สาขาสยาม");
  assert.equal(reply[1].altText, "สอบถามตารางแพทย์ สาขาสยาม");
  const sched = t.get(scheduleTrigger(branch()));
  assert.equal(sched.length, 1);
  assert.equal(sched[0].contents.contents.length, 1);
});

test("disabled branch is not registered at all", () => {
  const t = build(data({ branches: [branch({ enabled: false })] }));
  assert.equal(t.has("สยาม"), false);
  assert.equal(t.has("สอบถามตารางแพทย์ สาขาสยาม"), false);
});

test("branch with no doctors has no schedule trigger", () => {
  const t = build(data({ branches: [branch({ doctors: [] })] }));
  assert.equal(t.has("สยาม"), true);
  assert.equal(t.has("สอบถามตารางแพทย์ สาขาสยาม"), false);
});

test("more than 12 doctors are split into several carousels of max 12", () => {
  const doctors = Array.from({ length: 14 }, (_, i) => doctor(i));
  const t = build(data({ branches: [branch({ doctors })] }));
  const sched = t.get("สอบถามตารางแพทย์ สาขาสยาม");
  assert.equal(sched.length, 2);
  assert.equal(sched[0].contents.contents.length, 12);
  assert.equal(sched[1].contents.contents.length, 2);
  assert.equal(sched[1].altText, "สอบถามตารางแพทย์ สาขาสยาม");
});

test("doctor-table menu groups branches by region sections in order, honours menu + mainMenuActionText", () => {
  const branches = [
    branch({ id: "a", trigger: "A", region: "เหนือ" }),
    branch({ id: "tl", trigger: "ทองหล่อ", region: "ในเมือง", menu: "both", mainMenuActionText: "ตารางแพทย์สาขาทองหล่อ" }),
    branch({ id: "tl2", trigger: "ทองหล่อ เลเซอร์", region: "ในเมือง", menu: "thonglor" }),
    branch({ id: "b", trigger: "B", region: "นนท์" }),
    branch({ id: "off", trigger: "OFF", region: "นนท์", enabled: false }),
  ];
  const t = build(data({ branches }));
  const main = t.get("ตารางแพทย์")[0].contents.contents;
  assert.equal(main.length, 2);
  const rowsOf = (card) => card.contents[0].contents.filter((c) => c.layout === "baseline");
  const bubble0Rows = rowsOf(main[0].body.contents[0]);
  assert.deepEqual(bubble0Rows.map((r) => [r.contents[0].text, r.action.text]), [["ทองหล่อ", "ตารางแพทย์สาขาทองหล่อ"]]);
  assert.equal(main[1].body.contents.length, 3); // card, section header, card
  assert.deepEqual(rowsOf(main[1].body.contents[2]).map((r) => r.contents[0].text), ["B"]);
  const thonglor = t.get("ตารางแพทย์สาขาทองหล่อ")[0].contents.contents;
  assert.equal(thonglor.length, 1);
  assert.deepEqual(rowsOf(thonglor[0].body.contents[0]).map((r) => [r.contents[0].text, r.action.text]), [["ทองหล่อ", "ทองหล่อ"], ["ทองหล่อ เลเซอร์", "ทองหล่อ เลเซอร์"]]);
});

test("no thonglor branches → no thonglor menu trigger", () => {
  assert.equal(build(data()).has("ตารางแพทย์สาขาทองหล่อ"), false);
});

test("createMessageTable rebuilds on store change and keeps old table when rebuild fails", () => {
  let current = data();
  const listeners = [];
  const store = { getAll: () => current, onChange: (fn) => listeners.push(fn) };
  const logs = [];
  const mt = createMessageTable(store, { logError: (m) => logs.push(m) });
  assert.equal(mt.getTable().has("สยาม"), true);
  current = data({ branches: [branch({ trigger: "ใหม่" })] });
  listeners.forEach((fn) => fn("branches", current.branches));
  assert.equal(mt.getTable().has("ใหม่"), true);
  current = data({ services: null });
  listeners.forEach((fn) => fn("services", null));
  assert.equal(mt.getTable().has("ใหม่"), true);
  assert.equal(logs.length, 1);
});

// ===== ไม่ส่ง Flex ที่มี contents ว่าง (LINE reject ทั้งข้อความ) =====

const titleOf = (bubble) => bubble.header.contents[0].contents[0].contents[1].text;
const rowsOf = (card) => card.contents[0].contents.filter((c) => c.layout === "baseline");

test("a region whose only section has no enabled branch is omitted from the ตารางแพทย์ carousel", () => {
  const t = build(data({
    regions: [{ sections: ["ว่าง"] }, { sections: ["มีสาขา"] }],
    branches: [branch({ region: "มีสาขา" })],
  }));
  const groups = t.get("ตารางแพทย์")[0].contents.contents;
  assert.equal(groups.length, 1);
  assert.equal(titleOf(groups[0]), "มีสาขา");
});

test("a region with an empty main section but a populated extraSection still renders one bubble with that section as title", () => {
  const t = build(data({
    regions: [{ sections: ["ว่าง", "มีของ"] }],
    branches: [branch({ region: "มีของ" })],
  }));
  const groups = t.get("ตารางแพทย์")[0].contents.contents;
  assert.equal(groups.length, 1);
  const bubble = groups[0];
  assert.equal(titleOf(bubble), "มีของ");
  // ไม่มี extraSection เหลือ (ว่างถูกตัดทิ้งไปแล้ว, มีของถูกโปรโมทเป็นหลัก) → มีแค่การ์ดเดียวใน body
  assert.equal(bubble.body.contents.length, 1);
  assert.deepEqual(rowsOf(bubble.body.contents[0]).map((r) => r.contents[0].text), ["สยาม"]);
});

test("promotions: [] → no โปรโมชั่นล่าสุด key", () => {
  assert.equal(build(data({ promotions: [] })).has("โปรโมชั่นล่าสุด"), false);
});

test("services: [] → no บริการทั้งหมด key", () => {
  assert.equal(build(data({ services: [] })).has("บริการทั้งหมด"), false);
});

test("all branches disabled → no ตารางแพทย์ key", () => {
  assert.equal(build(data({ branches: [branch({ enabled: false })] })).has("ตารางแพทย์"), false);
});

function assertNoEmptyContents(node, ctx) {
  if (Array.isArray(node)) {
    node.forEach((item, i) => assertNoEmptyContents(item, `${ctx}[${i}]`));
    return;
  }
  if (node && typeof node === "object") {
    if (Array.isArray(node.contents)) {
      assert.ok(node.contents.length > 0, `empty contents at ${ctx}.contents`);
    }
    Object.entries(node).forEach(([k, v]) => assertNoEmptyContents(v, `${ctx}.${k}`));
  }
}

function assertTableHasNoEmptyContents(table) {
  for (const [trigger, messages] of table.entries()) {
    assertNoEmptyContents(messages, `[${trigger}]`);
  }
}

test("no message in the table has an empty box/carousel contents array (synthetic data)", () => {
  assertTableHasNoEmptyContents(build(data()));
});

test("no message in the table has an empty box/carousel contents array (real data/*.json)", () => {
  const store = createDataStore(path.join(__dirname, "..", "data"));
  assertTableHasNoEmptyContents(build(store.getAll()));
});
