const test = require("node:test");
const assert = require("node:assert/strict");
const {
  MAX_FOLLOW_UP_LENGTH, resolveFollowUpText, validateFollowUpText, validateFollowUpEntry,
  validateFollowUps, normalizeFollowUpEntry, pruneServices,
} = require("../services/followUps");

const DOCTOR = "👨‍⚕️ปรึกษาหมอได้เลย หมอตอบเองครับ";
const STAFF = "✨ สนใจโปรโมชัน ทำนัดคิว หรือสอบถามข้อมูลเพิ่มเติม สามารถแจ้งได้เลยค่ะ";
const file = () => ({
  defaultText: STAFF,
  channels: {
    "1": { text: DOCTOR },
    "3": { services: { botox: "โบท็อกซ์เอกมัย", slim: "" } },
    "30": { text: "" },
    "31": { text: "", services: { botox: "เฉพาะโบท็อกซ์" } },
  },
});
const paths = (errors) => errors.map((e) => e.path);

test("resolve: service beats OA beats default", () => {
  assert.equal(resolveFollowUpText(file(), 1, "botox"), DOCTOR);
  assert.equal(resolveFollowUpText(file(), 3, "botox"), "โบท็อกซ์เอกมัย");
  assert.equal(resolveFollowUpText(file(), 3, "filler"), STAFF);
  assert.equal(resolveFollowUpText(file(), 31, "botox"), "เฉพาะโบท็อกซ์");
});

test("resolve: an empty value stops at its level instead of falling through", () => {
  assert.equal(resolveFollowUpText(file(), 30, "botox"), null);
  assert.equal(resolveFollowUpText(file(), 3, "slim"), null);
  assert.equal(resolveFollowUpText(file(), 31, "filler"), null);
});

test("resolve: whitespace-only = don't send; unknown OA/service, string id and null id fall back", () => {
  const blank = { defaultText: " \n ", channels: { "2": { text: "  " } } };
  assert.equal(resolveFollowUpText(blank, 2, "x"), null);
  assert.equal(resolveFollowUpText(blank, 7, "x"), null);
  assert.equal(resolveFollowUpText(file(), 99, "nope"), STAFF);
  assert.equal(resolveFollowUpText(file(), "1", "nope"), DOCTOR);
  assert.equal(resolveFollowUpText(file(), null, "botox"), STAFF);
});

test("validateFollowUpText: string up to the LINE limit", () => {
  assert.deepEqual(validateFollowUpText("x".repeat(MAX_FOLLOW_UP_LENGTH), "text"), []);
  assert.deepEqual(paths(validateFollowUpText("x".repeat(MAX_FOLLOW_UP_LENGTH + 1), "text")), ["text"]);
  assert.deepEqual(paths(validateFollowUpText(null, "text")), ["text"]);
});

test("validateFollowUps: a valid file passes; wrong shapes report their paths", () => {
  assert.deepEqual(validateFollowUps(file()), []);
  assert.deepEqual(paths(validateFollowUps(null)), [""]);
  assert.deepEqual(paths(validateFollowUps([])), [""]);
  assert.deepEqual(paths(validateFollowUps({ channels: {} })), ["defaultText"]);
  assert.deepEqual(paths(validateFollowUps({ defaultText: "", channels: [] })), ["channels"]);
  assert.deepEqual(
    paths(validateFollowUps({ defaultText: "", channels: { "01": {}, "0": {}, x: {} } })),
    ["channels.0", "channels.01", "channels.x"],
  );
  assert.deepEqual(
    paths(validateFollowUps({ defaultText: "", channels: { "2": { text: null, services: { a: 5 } } } })),
    ["channels.2.text", "channels.2.services.a"],
  );
});

test("validateFollowUpEntry: body-relative paths", () => {
  assert.deepEqual(validateFollowUpEntry({}), []);
  assert.deepEqual(validateFollowUpEntry({ text: "a", services: { s: "" } }), []);
  assert.deepEqual(paths(validateFollowUpEntry("x")), [""]);
  assert.deepEqual(paths(validateFollowUpEntry({ services: [] })), ["services"]);
  assert.deepEqual(paths(validateFollowUpEntry({ text: 1 })), ["text"]);
});

test("normalizeFollowUpEntry: trims ends, keeps inner newlines, drops unknown services, null when nothing is set", () => {
  const ids = ["botox", "slim"];
  assert.deepEqual(
    normalizeFollowUpEntry({ text: "\r\n  สวัสดี\nค่ะ  \n", services: { botox: "  ", slim: " a ", gone: "x" } }, ids),
    { text: "สวัสดี\nค่ะ", services: { botox: "", slim: "a" } },
  );
  assert.deepEqual(normalizeFollowUpEntry({ text: "   " }, ids), { text: "" });
  assert.deepEqual(normalizeFollowUpEntry({ services: { botox: "b" } }, ids), { services: { botox: "b" } });
  assert.equal(normalizeFollowUpEntry({}, ids), null);
  assert.equal(normalizeFollowUpEntry({ services: { gone: "x" } }, ids), null);
});

test("pruneServices: drops removed ids everywhere and entries left empty, without mutating input", () => {
  const before = file();
  const after = pruneServices(before, ["slim"]);
  assert.equal(after.defaultText, STAFF);
  assert.deepEqual(after.channels, { "1": { text: DOCTOR }, "3": { services: { slim: "" } }, "30": { text: "" }, "31": { text: "" } });
  assert.deepEqual(before, file());
  assert.deepEqual(pruneServices({ defaultText: "", channels: { "5": { services: { gone: "x" } } } }, []).channels, {});
});
