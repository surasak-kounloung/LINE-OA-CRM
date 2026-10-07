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
const { createFakeLine } = require("../test-helpers/fakeLineRichMenuApi");

const channels = [
  { id: 1, name: "OA เดิม", channelSecret: "sec-AAA", channelAccessToken: "tok-AAA", forwardUrl: null },
  { id: 2, name: "OA ใหม่", channelSecret: "sec-BBB", channelAccessToken: "tok-BBB", forwardUrl: null },
  { id: 3, name: "OA พัง", channelSecret: "sec-CCC", channelAccessToken: "tok-CCC", forwardUrl: null },
];
const level = (key, label, isDefault = false, image = `https://img.example/${key}.jpg`) => ({ key, label, image, isDefault });
const richMenu = (over = {}) => ({
  size: { width: 2500, height: 1686 },
  chatBarText: "Menu",
  selected: true,
  areas: [{ x: 0, y: 1082, width: 833, height: 604, action: { type: "message", text: "บริการทั้งหมด" } }],
  menus: [],
  ...over,
});
const twoLevels = () => richMenu({ menus: [level("default", "ก่อนสมัคร", true), level("gold", "V Gold")] });

// OA 1 มีเมนูของระบบอื่น, OA 2 ว่าง, OA 3 เรียก LINE ไม่ได้
// เซิร์ฟเวอร์ถูกปิดผ่าน t.after เสมอ: เทสต์ที่ล้มกลางทางต้องไม่ทิ้งเซิร์ฟเวอร์ไว้จน `node --test` ค้าง
async function startApp(t, { saved = richMenu(), savedText, richMenuOptions = {} } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "vsq-richmenu-"));
  for (const name of ["promotions", "services", "branches", "regions"]) fs.writeFileSync(path.join(dir, `${name}.json`), "[]");
  // savedText: เขียนเนื้อไฟล์ตรง ๆ เพื่อจำลองไฟล์ที่ถูกแก้ด้วยมือจนพัง
  fs.writeFileSync(path.join(dir, "richmenu.json"), savedText === undefined ? JSON.stringify(saved) : savedText);
  const store = createDataStore(dir);

  const lines = new Map([
    [1, createFakeLine({ menus: [{ richMenuId: "richmenu-legacy", name: "V Gold Richmenu 06/10/2026" }], defaultRichMenuId: "richmenu-legacy" })],
    [2, createFakeLine()],
  ]);
  const broken = { readState: async () => { throw Object.assign(new Error("401 - Unauthorized"), { status: 401, body: '{"message":"Authentication failed"}' }); } };
  const loaded = [];
  const loadImage = async (url) => {
    loaded.push(url);
    if (url.includes("bad")) throw new Error("ไฟล์รูปใหญ่เกิน 1 MB");
    return { buffer: Buffer.from(url), contentType: "image/jpeg" };
  };

  const app = express();
  app.use(express.json({ limit: "2mb" }));
  app.use("/api/admin", createAdminRouter({
    store,
    messageTable: createMessageTable(store),
    channels,
    loginFailureDelayMs: 0,
    richMenu: { createApi: (channel) => (lines.has(channel.id) ? lines.get(channel.id).api : broken), loadImage, sleep: async () => {}, ...richMenuOptions },
  }));
  const server = await new Promise((resolve) => { const s = app.listen(0, () => resolve(s)); });
  t.after(() => { server.closeAllConnections(); server.close(); });

  const base = `http://127.0.0.1:${server.address().port}/api/admin`;
  // ทุก request มีเวลาจำกัด: route ที่ไม่ตอบต้องทำให้เทสต์ล้ม ไม่ใช่ค้าง
  const raw = (method, p, body, token) => fetch(base + p, {
    signal: AbortSignal.timeout(5000),
    method,
    headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const token = (await (await raw("POST", "/login", { password: "pw" })).json()).token;
  const call = (method, p, body) => raw(method, p, body, token);
  const onDisk = () => JSON.parse(fs.readFileSync(path.join(dir, "richmenu.json"), "utf8"));
  return { raw, call, lines, loaded, onDisk };
}

// เงียบ log ที่เส้นทางเหล่านี้พิมพ์โดยตั้งใจ
function quiet(t) {
  const original = { log: console.log, error: console.error };
  console.log = () => {};
  console.error = () => {};
  t.after(() => Object.assign(console, original));
}

test("every rich menu route needs an admin token", async (t) => {
  const { raw } = await startApp(t);
  assert.equal((await raw("GET", "/richmenu")).status, 401);
  assert.equal((await raw("PUT", "/richmenu", twoLevels())).status, 401);
  assert.equal((await raw("GET", "/richmenu/status")).status, 401);
  assert.equal((await raw("POST", "/richmenu/sync/2")).status, 401);
});

test("GET returns the saved definition", async (t) => {
  const { call } = await startApp(t, { saved: twoLevels() });
  const res = await call("GET", "/richmenu");
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), twoLevels());
});

test("PUT rejects invalid data with field paths and saves nothing", async (t) => {
  const { call, onDisk, loaded } = await startApp(t);
  const res = await call("PUT", "/richmenu", richMenu({ chatBarText: "", menus: [level("Gold", "V Gold", true)] }));
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.equal(body.error, "ข้อมูลไม่ถูกต้อง");
  assert.deepEqual(body.errors.map((e) => e.path).sort(), ["chatBarText", "menus[0].key"]);
  assert.deepEqual(onDisk(), richMenu());
  assert.deepEqual(loaded, []);
});

test("PUT saves the normalized definition and checks only images it has not seen", async (t) => {
  const { call, onDisk, loaded } = await startApp(t);
  const first = await call("PUT", "/richmenu", { ...twoLevels(), unknown: "dropped" });
  assert.equal(first.status, 200);
  assert.deepEqual(await first.json(), twoLevels());
  assert.deepEqual(onDisk(), twoLevels());
  assert.deepEqual(loaded.sort(), ["https://img.example/default.jpg", "https://img.example/gold.jpg"]);

  loaded.length = 0;
  const next = richMenu({ chatBarText: "เมนู", menus: [...twoLevels().menus, level("silver", "V Silver")] });
  assert.equal((await call("PUT", "/richmenu", next)).status, 200);
  assert.deepEqual(loaded, ["https://img.example/silver.jpg"]);
  assert.deepEqual(onDisk(), next);
});

test("PUT reports an image that fails its check on that menu's field and saves nothing", async (t) => {
  const { call, onDisk } = await startApp(t, { saved: twoLevels() });
  const res = await call("PUT", "/richmenu", richMenu({ menus: [level("default", "ก่อนสมัคร", true), level("gold", "V Gold", false, "https://img.example/bad.jpg")] }));
  assert.equal(res.status, 400);
  assert.deepEqual(await res.json(), { error: "รูปไม่ผ่านการตรวจ", errors: [{ path: "menus[1].image", message: "ไฟล์รูปใหญ่เกิน 1 MB" }] });
  assert.deepEqual(onDisk(), twoLevels());
});

test("status describes every OA: blocked by another system's menus, out of date, and unreachable", async (t) => {
  quiet(t);
  const { call } = await startApp(t, { saved: twoLevels() });
  const res = await call("GET", "/richmenu/status");
  assert.equal(res.status, 200);
  const [legacy, fresh, broken] = await res.json();

  assert.deepEqual([legacy.id, legacy.name, legacy.state], [1, "OA เดิม", "blocked"]);
  assert.deepEqual(legacy.foreignMenus, ["V Gold Richmenu 06/10/2026"]);
  assert.match(legacy.message, /ระบบอื่นสร้างไว้/);

  assert.deepEqual(fresh, {
    id: 2,
    name: "OA ใหม่",
    state: "out-of-date",
    message: "ยังไม่ตรงกับที่บันทึกไว้",
    menus: [{ key: "default", label: "ก่อนสมัคร", state: "missing" }, { key: "gold", label: "V Gold", state: "missing" }],
    staleCount: 0,
    removedKeys: [],
    foreignMenus: [],
  });

  assert.deepEqual([broken.id, broken.state, broken.menus], [3, "error", []]);
  assert.match(broken.message, /HTTP 401/);
  assert.ok(!JSON.stringify([legacy, fresh, broken]).includes("tok-"), "a channel token reached the response");
});

test("sync runs one OA and reports its steps; the status is then in sync", async (t) => {
  quiet(t);
  const { call, lines } = await startApp(t, { saved: twoLevels() });
  const res = await call("POST", "/richmenu/sync/2");
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.deepEqual([body.id, body.name, body.ok, body.message], [2, "OA ใหม่", true, "sync สำเร็จ"]);
  assert.ok(body.steps.includes('สร้างเมนู "V Gold"'));
  assert.deepEqual(Object.keys(lines.get(2).snapshot().aliases).sort(), ["vsq-default", "vsq-gold"]);

  const statuses = await (await call("GET", "/richmenu/status")).json();
  assert.equal(statuses[1].state, "in-sync");
  // OA อื่นไม่ถูกแตะ
  assert.deepEqual(lines.get(1).calls, []);
});

test("sync of a blocked or unreachable OA answers 200 with ok false and writes nothing", async (t) => {
  quiet(t);
  const { call, lines } = await startApp(t, { saved: twoLevels() });
  const blocked = await call("POST", "/richmenu/sync/1");
  assert.equal(blocked.status, 200);
  const body = await blocked.json();
  assert.equal(body.ok, false);
  assert.match(body.message, /ระบบอื่นสร้างไว้/);
  assert.deepEqual(lines.get(1).calls, []);

  const broken = await (await call("POST", "/richmenu/sync/3")).json();
  assert.equal(broken.ok, false);
  assert.match(broken.message, /HTTP 401/);
});

test("sync of an unknown OA is 404 with a JSON error", async (t) => {
  const { call } = await startApp(t, { saved: twoLevels() });
  for (const id of ["9", "abc", "2x"]) {
    const res = await call("POST", `/richmenu/sync/${id}`);
    assert.equal(res.status, 404, id);
    assert.deepEqual(await res.json(), { error: "ไม่พบ LINE OA นี้" }, id);
  }
});

test("only one sync runs at a time, and the lock is released afterwards", async (t) => {
  quiet(t);
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  let entered;
  const started = new Promise((resolve) => { entered = resolve; });
  const loadImage = async (url) => {
    entered();
    await gate;
    return { buffer: Buffer.from(url), contentType: "image/jpeg" };
  };
  const { call } = await startApp(t, { saved: twoLevels(), richMenuOptions: { loadImage } });
  t.after(() => release());

  const first = call("POST", "/richmenu/sync/2");
  // ถ้า sync แรกจบไปก่อนจะถึงขั้นโหลดรูป เทสต์ต้องล้มทันที ไม่ใช่รอไปเรื่อย ๆ
  const reachedImages = await Promise.race([started.then(() => true), first.then(() => false)]);
  assert.equal(reachedImages, true, "the first sync finished without ever loading an image");

  const second = await call("POST", "/richmenu/sync/2");
  assert.equal(second.status, 409);
  assert.match((await second.json()).error, /sync อื่นกำลังทำงานอยู่/);

  release();
  assert.equal((await (await first).json()).ok, true);
  const again = await call("POST", "/richmenu/sync/2");
  assert.equal(again.status, 200);
  assert.match((await again.json()).message, /ตรงกับที่บันทึกไว้อยู่แล้ว/);
});

test("an unreadable richmenu.json answers 500 as JSON on every route, without its path, and the server lives on", async (t) => {
  quiet(t);
  const { call } = await startApp(t, { savedText: "{ this is not json" });
  const requests = [["GET", "/richmenu"], ["GET", "/richmenu/status"], ["POST", "/richmenu/sync/2"], ["PUT", "/richmenu", twoLevels()], ["POST", "/richmenu/sync/2"]];
  for (const [method, p, body] of requests) {
    const res = await call(method, p, body);
    assert.equal(res.status, 500, `${method} ${p}`);
    assert.deepEqual(JSON.parse(await res.text()), { error: "เกิดข้อผิดพลาดภายในระบบ ดู log ของเซิร์ฟเวอร์" }, `${method} ${p}`);
  }
  // ส่วนอื่นของ admin API ยังตอบได้ตามปกติ
  assert.equal((await call("GET", "/triggers")).status, 200);
});

test("a saved definition that breaks the rules is reported as invalid and nothing is sent to LINE", async (t) => {
  quiet(t);
  const noDefault = richMenu({ menus: [level("default", "ก่อนสมัคร", false), level("gold", "V Gold", false)] });
  const { call, lines } = await startApp(t, { saved: noDefault });

  const statuses = await (await call("GET", "/richmenu/status")).json();
  assert.deepEqual(statuses.map((oa) => [oa.id, oa.state]), [[1, "invalid"], [2, "invalid"], [3, "invalid"]]);
  assert.match(statuses[1].message, /ข้อมูล Rich Menu ที่บันทึกไว้ไม่ถูกต้อง/);
  assert.match(statuses[1].message, /เมนูเริ่มต้น 1 อันพอดี/);

  const res = await call("POST", "/richmenu/sync/2");
  assert.equal(res.status, 200);
  const result = await res.json();
  assert.deepEqual([result.ok, result.steps], [false, []]);
  assert.match(result.message, /ข้อมูล Rich Menu ที่บันทึกไว้ไม่ถูกต้อง/);
  assert.deepEqual(lines.get(2).calls, []);
});
