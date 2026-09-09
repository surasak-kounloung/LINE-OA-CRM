const test = require("node:test");
const assert = require("node:assert/strict");
const legacyMessages = require("../scripts/legacy/messages.json");
const legacyPromotions = require("../scripts/legacy/promotions.json");
const legacyServices = require("../scripts/legacy/services.json");
const { FlexMessagePromotionBubble } = require("../flexmessage/promotion");
const { FlexMessageServicesBubble } = require("../flexmessage/services");
const { FlexMessageTableDoctorsBubble } = require("../flexmessage/tabledoctors");
const { FlexMessageTableDoctorsThonglorBubble } = require("../flexmessage/tabledoctorsThonglor");
const { FlexMessageBranchMap } = require("../flexmessage/flexMessageBranchMap");

test("promotion builder reproduces legacy carousel from legacy data", () => {
  assert.deepEqual(FlexMessagePromotionBubble(legacyPromotions), legacyMessages["โปรโมชั่นล่าสุด"][0].contents);
});

test("promotion builder renders one bubble per item and empty list", () => {
  assert.equal(FlexMessagePromotionBubble([]).contents.length, 0);
  assert.equal(FlexMessagePromotionBubble(legacyPromotions.slice(0, 2)).contents.length, 2);
});

test("services builder reproduces legacy carousel (subtitle replaces inquiryText)", () => {
  const services = legacyServices.map(({ inquiryText, ...s }) => ({ ...s, subtitle: inquiryText }));
  assert.deepEqual(FlexMessageServicesBubble(services), legacyMessages["บริการทั้งหมด"][0].contents);
});

test("tabledoctors builder renders groups with extraSections and mixed row objects", () => {
  const groups = [
    { title: "A", branches: [{ name: "x", actionText: "x" }, { name: "ทองหล่อ", actionText: "ตารางแพทย์สาขาทองหล่อ" }] },
    { title: "B", branches: [{ name: "y", actionText: "y" }], extraSections: [{ title: "C", branches: [{ name: "z", actionText: "z" }] }] },
  ];
  const out = FlexMessageTableDoctorsBubble(groups);
  assert.equal(out.type, "carousel");
  assert.equal(out.contents.length, 2);
  const legacyMain = legacyMessages["ตารางแพทย์"][0].contents;
  // same bubble skeleton as legacy (header/body keys)
  assert.deepEqual(Object.keys(out.contents[0]), Object.keys(legacyMain.contents[0]));
  // second bubble has: colored card, section header, colored card
  assert.equal(out.contents[1].body.contents.length, 3);
  // row action text is honoured (the action sits on the row box itself)
  const rows = out.contents[0].body.contents[0].contents[0].contents.filter((c) => c.layout === "baseline");
  assert.deepEqual(rows.map((r) => [r.contents[0].text, r.action.text]), [["x", "x"], ["ทองหล่อ", "ตารางแพทย์สาขาทองหล่อ"]]);
});

test("thonglor table builder renders a single bubble", () => {
  const out = FlexMessageTableDoctorsThonglorBubble({
    title: "กรุงเทพฯ ตอนใต้",
    branches: [{ name: "ทองหล่อ", actionText: "ทองหล่อ" }, { name: "ทองหล่อ เลเซอร์เซ็นเตอร์", actionText: "ทองหล่อ เลเซอร์เซ็นเตอร์" }],
  });
  assert.equal(out.type, "carousel");
  assert.equal(out.contents.length, 1);
  const rows = out.contents[0].body.contents[0].contents[0].contents.filter((c) => c.layout === "baseline");
  assert.deepEqual(rows.map((r) => [r.contents[0].text, r.action.text]), [["ทองหล่อ", "ทองหล่อ"], ["ทองหล่อ เลเซอร์เซ็นเตอร์", "ทองหล่อ เลเซอร์เซ็นเตอร์"]]);
  // exact equality with the legacy carousel is checked in scripts/verify-migration.js (Task 6)
});

test("branch map omits LINE row action when lineUrl is empty", () => {
  const base = { branchName: "X", fontSize: "xxl", mapUrl: "https://m", imageUrl: "https://i", phoneNumber: "093 110 9000", lineId: "@x" };
  const withUrl = FlexMessageBranchMap({ ...base, lineUrl: "https://l" }).contents[0];
  const without = FlexMessageBranchMap({ ...base, lineUrl: "" }).contents[0];
  const lineRow = (bubble) => bubble.body.contents[1].contents[1];
  assert.equal(lineRow(withUrl).contents[1].action.uri, "https://l");
  assert.equal(lineRow(without).contents[1].action, undefined);
});
