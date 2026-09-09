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

const region = { sections: ["ในเมือง"] };
const branch = {
  id: "siam", trigger: "สยาม", displayName: "สยาม", region: "ในเมือง", menu: "main", enabled: true,
  fontSize: "xxl", mapUrl: "https://g/map", imageUrl: "https://x/b.jpg", phoneNumber: "093", lineId: "@v", lineUrl: "https://l",
  doctors: [{ day: "วันจันทร์", name: "หมอ", license: "ว.1", imageUrl: "https://x/d.png" }],
};

async function startApp() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "vsq-admin-"));
  const seed = { promotions: [], services: [], branches: [branch], regions: [region] };
  for (const [name, value] of Object.entries(seed)) fs.writeFileSync(path.join(dir, `${name}.json`), JSON.stringify(value));
  const store = createDataStore(dir);
  const messageTable = createMessageTable(store);
  const app = express();
  app.use(express.json({ limit: "2mb" }));
  app.use("/api/admin", createAdminRouter({ store, messageTable, loginFailureDelayMs: 0 }));
  const server = await new Promise((resolve) => { const s = app.listen(0, () => resolve(s)); });
  const base = `http://127.0.0.1:${server.address().port}/api/admin`;
  const call = (method, p, body, token) => fetch(base + p, {
    method, headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { dir, call, close: () => server.close() };
}

async function login(call) {
  const res = await call("POST", "/login", { password: "pw" });
  return (await res.json()).token;
}

test("login: wrong password 401, right password returns token", async () => {
  const { call, close } = await startApp();
  assert.equal((await call("POST", "/login", { password: "nope" })).status, 401);
  const res = await call("POST", "/login", { password: "pw" });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.ok(body.token);
  assert.ok(body.expiresAt > Date.now());
  close();
});

test("data routes need a token", async () => {
  const { call, close } = await startApp();
  assert.equal((await call("GET", "/branches")).status, 401);
  close();
});

test("GET returns data, PUT validates and persists, table rebuilds", async () => {
  const { dir, call, close } = await startApp();
  const token = await login(call);
  assert.deepEqual(await (await call("GET", "/branches", undefined, token)).json(), [branch]);

  const bad = await call("PUT", "/branches", [{ ...branch, imageUrl: "x" }], token);
  assert.equal(bad.status, 400);
  assert.deepEqual((await bad.json()).errors.map((e) => e.path), ["[0].imageUrl"]);

  const ok = await call("PUT", "/branches", [{ ...branch, trigger: "ใหม่" }], token);
  assert.equal(ok.status, 200);
  assert.equal(JSON.parse(fs.readFileSync(path.join(dir, "branches.json"), "utf8"))[0].trigger, "ใหม่");
  const triggers = await (await call("GET", "/triggers", undefined, token)).json();
  assert.ok(triggers.includes("ใหม่"));
  assert.ok(!triggers.includes("สยาม"));
  close();
});

test("PUT regions rejects removing a section still in use", async () => {
  const { call, close } = await startApp();
  const token = await login(call);
  const res = await call("PUT", "/regions", [{ sections: ["อื่น"] }], token);
  assert.equal(res.status, 400);
  close();
});

test("preview returns messages for a trigger, 404 for unknown", async () => {
  const { call, close } = await startApp();
  const token = await login(call);
  const res = await call("GET", `/preview/${encodeURIComponent("สยาม")}`, undefined, token);
  assert.equal(res.status, 200);
  const messages = await res.json();
  assert.equal(messages[0].altText, "สาขาสยาม");
  assert.equal((await call("GET", "/preview/ไม่มี", undefined, token)).status, 404);
  close();
});

test("everything is 503 when ADMIN_PASSWORD is unset", async () => {
  const { call, close } = await startApp();
  const saved = process.env.ADMIN_PASSWORD;
  delete process.env.ADMIN_PASSWORD;
  assert.equal((await call("POST", "/login", { password: "pw" })).status, 503);
  assert.equal((await call("GET", "/promotions")).status, 503);
  process.env.ADMIN_PASSWORD = saved;
  close();
});
