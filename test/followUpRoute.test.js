const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const express = require("express");

process.env.ADMIN_PASSWORD = "pw";
const { createDataStore } = require("../services/dataStore");
const { createMessageTable } = require("../services/messageTable");
const { createAdminRouter } = require("../routes/adminRoute");

const DOCTOR = "👨‍⚕️ปรึกษาหมอได้เลย หมอตอบเองครับ";
const STAFF = "✨ สนใจโปรโมชัน ทำนัดคิว หรือสอบถามข้อมูลเพิ่มเติม สามารถแจ้งได้เลยค่ะ";
const channels = [
  { id: 1, name: "Main", channelSecret: "sec-1", channelAccessToken: "tok-1", forwardUrl: null },
  { id: 2, name: "Siam Square One", channelSecret: "sec-2", channelAccessToken: "tok-2", forwardUrl: null },
  { id: 3, name: "Gateway Ekamai", channelSecret: "sec-3", channelAccessToken: "tok-3", forwardUrl: null },
];
const service = (id, priceImages = ["https://x/p.jpg"]) =>
  ({ id, image: "https://x/s.jpg", title: id, subtitle: "S", actionText: `สอบถาม ${id}`, hot: false, priceImages });
const seed = () => ({ defaultText: STAFF, channels: { "1": { text: DOCTOR }, "99": { text: "OA ที่ถูกเอาออกจาก env" } } });

// followups: object | สตริงดิบ | undefined (ไม่มีไฟล์)
async function startApp({ followups = seed(), services = [service("botox"), service("other", [])] } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "vsq-followups-"));
  for (const [name, value] of Object.entries({ promotions: [], services, branches: [], regions: [] })) {
    fs.writeFileSync(path.join(dir, `${name}.json`), JSON.stringify(value));
  }
  if (followups !== undefined) {
    fs.writeFileSync(path.join(dir, "followups.json"), typeof followups === "string" ? followups : JSON.stringify(followups));
  }
  const store = createDataStore(dir);
  const app = express();
  app.use(express.json({ limit: "2mb" }));
  app.use("/api/admin", createAdminRouter({
    store, messageTable: createMessageTable(store), channels, loginFailureDelayMs: 0, logError: () => {},
  }));
  const server = await new Promise((resolve) => { const s = app.listen(0, () => resolve(s)); });
  const base = `http://127.0.0.1:${server.address().port}/api/admin`;
  const call = (method, p, body, token) => fetch(base + p, {
    method, headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const token = (await (await call("POST", "/login", { password: "pw" })).json()).token;
  const raw = () => fs.readFileSync(path.join(dir, "followups.json"), "utf8");
  return { call, token, raw, read: () => JSON.parse(raw()), close: () => server.close() };
}

test("GET lists the file and the loaded OAs, never tokens or secrets; needs a token", async () => {
  const { call, token, close } = await startApp();
  assert.equal((await call("GET", "/followups")).status, 401);
  const body = await (await call("GET", "/followups", undefined, token)).json();
  assert.equal(body.defaultText, STAFF);
  assert.deepEqual(body.channels, seed().channels);
  assert.deepEqual(body.oas, [{ id: 1, name: "Main" }, { id: 2, name: "Siam Square One" }, { id: 3, name: "Gateway Ekamai" }]);
  assert.ok(!/sec-|tok-/.test(JSON.stringify(body)));
  close();
});

test("PUT default trims and keeps every OA entry; non-string is 400", async () => {
  const { call, token, read, close } = await startApp();
  const res = await call("PUT", "/followups/default", { text: "  ใหม่\n" }, token);
  assert.equal(res.status, 200);
  assert.equal((await res.json()).defaultText, "ใหม่");
  assert.deepEqual(read(), { defaultText: "ใหม่", channels: seed().channels });
  const bad = await call("PUT", "/followups/default", { text: 5 }, token);
  assert.equal(bad.status, 400);
  assert.deepEqual((await bad.json()).errors.map((e) => e.path), ["text"]);
  close();
});

test("PUT one OA replaces only that OA, keeps the others (also one no longer in .env), drops unknown services", async () => {
  const { call, token, read, close } = await startApp();
  const res = await call("PUT", "/followups/channels/3", { text: " สาขาเอกมัย ", services: { botox: "  ", gone: "x" } }, token);
  assert.equal(res.status, 200);
  assert.deepEqual(read().channels, {
    "1": { text: DOCTOR }, "99": { text: "OA ที่ถูกเอาออกจาก env" }, "3": { text: "สาขาเอกมัย", services: { botox: "" } },
  });
  assert.equal((await call("PUT", "/followups/channels/1", {}, token)).status, 200);
  assert.equal("1" in read().channels, false);
  close();
});

test("PUT one OA: unknown or look-alike ids are 404, bad values are 400 with paths", async () => {
  const { call, token, read, close } = await startApp();
  for (const id of ["7", "99", "01", "abc"]) {
    assert.equal((await call("PUT", `/followups/channels/${id}`, { text: "x" }, token)).status, 404, id);
  }
  const bad = await call("PUT", "/followups/channels/2", { text: null, services: { botox: 5 } }, token);
  assert.equal(bad.status, 400);
  assert.deepEqual((await bad.json()).errors.map((e) => e.path), ["text", "services.botox"]);
  assert.deepEqual(read(), seed());
  close();
});

test("a broken or invalid file is reported and never overwritten", async () => {
  for (const followups of ["{not json", JSON.stringify({ defaultText: 5, channels: {} })]) {
    const { call, token, raw, close } = await startApp({ followups });
    const get = await call("GET", "/followups", undefined, token);
    assert.equal(get.status, 500);
    assert.match((await get.json()).error, /data\/followups\.json/);
    assert.equal((await call("PUT", "/followups/default", { text: "x" }, token)).status, 500);
    assert.equal((await call("PUT", "/followups/channels/2", { text: "x" }, token)).status, 500);
    assert.equal(raw(), followups);
    close();
  }
});

test("saving services removes texts of deleted service ids; a missing file does not block the save", async () => {
  const { call, token, read, close } = await startApp({
    followups: { defaultText: STAFF, channels: { "3": { services: { botox: "a", other: "b" } }, "2": { services: { botox: "c" } } } },
  });
  assert.equal((await call("PUT", "/services", [service("other", [])], token)).status, 200);
  assert.deepEqual(read().channels, { "3": { services: { other: "b" } } });
  close();
  const noFile = await startApp({ followups: undefined });
  assert.equal((await noFile.call("PUT", "/services", [service("other", [])], noFile.token)).status, 200);
  noFile.close();
});

test("preview shows what one OA would send: Main by default, ?channel= for another, 404 when nothing", async () => {
  const { call, token, close } = await startApp();
  const botox = encodeURIComponent("สอบถาม botox");
  const main = await (await call("GET", `/preview/${botox}`, undefined, token)).json();
  assert.deepEqual(main.at(-1), { type: "text", text: DOCTOR });
  const siam = await (await call("GET", `/preview/${botox}?channel=2`, undefined, token)).json();
  assert.deepEqual(siam.at(-1), { type: "text", text: STAFF });
  assert.equal((await call("GET", `/preview/${botox}?channel=9`, undefined, token)).status, 404);
  assert.equal((await call("PUT", "/followups/channels/2", { text: "" }, token)).status, 200);
  const none = await call("GET", `/preview/${encodeURIComponent("สอบถาม other")}?channel=2`, undefined, token);
  assert.equal(none.status, 404);
  assert.match((await none.json()).error, /ไม่ตอบ/);
  close();
});
