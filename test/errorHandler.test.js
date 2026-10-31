const test = require("node:test");
const assert = require("node:assert/strict");
const util = require("util");
const express = require("express");
const { notFound, errorHandler } = require("../middlewares/errorHandler");

// เปิด express จริงบนพอร์ตสุ่ม ต่อ middleware ลำดับเดียวกับ index.js และเก็บทุกอย่างที่ถูก log ไว้
async function startApp() {
  const logged = [];
  const original = { error: console.error, warn: console.warn };
  console.error = (...args) => { logged.push(util.format(...args)); };
  console.warn = (...args) => { logged.push(util.format(...args)); };
  const app = express();
  app.use(express.json({ limit: "1kb" }));
  app.post("/echo", (req, res) => res.json(req.body));
  app.get("/boom", () => { throw new Error("kaboom"); });
  app.use(notFound);
  app.use(errorHandler);
  const server = await new Promise((resolve) => { const s = app.listen(0, () => resolve(s)); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const postJson = (body) => fetch(`${base}/echo`, { method: "POST", headers: { "content-type": "application/json" }, body });
  const close = () => {
    console.error = original.error;
    console.warn = original.warn;
    server.close();
  };
  return { base, postJson, logged, close };
}

test("malformed JSON gets 400 and one log line, with no stack and none of the body", async () => {
  const { postJson, logged, close } = await startApp();
  try {
    const res = await postJson('{"marker-from-the-request": ');
    assert.equal(res.status, 400);
    assert.equal(typeof (await res.json()).message, "string");
    assert.equal(logged.length, 1);
    assert.match(logged[0], /POST \/echo 400/);
    assert.ok(!logged[0].includes("marker-from-the-request"), "the request body reached the log");
    assert.ok(!logged[0].includes("\n"), "the log entry has more than one line");
  } finally {
    close();
  }
});

test("a body over the size limit gets 413", async () => {
  const { postJson, logged, close } = await startApp();
  try {
    const res = await postJson(JSON.stringify({ text: "x".repeat(2000) }));
    assert.equal(res.status, 413);
    assert.equal(logged.length, 1);
    assert.match(logged[0], /POST \/echo 413/);
  } finally {
    close();
  }
});

test("an unknown path still gets 404", async () => {
  const { base, close } = await startApp();
  try {
    const res = await fetch(`${base}/nope`);
    assert.equal(res.status, 404);
    assert.deepEqual(await res.json(), { message: "Not Found : /nope" });
  } finally {
    close();
  }
});

test("an unexpected error still gets 500 and is logged with its stack", async () => {
  const { base, logged, close } = await startApp();
  try {
    const res = await fetch(`${base}/boom`);
    assert.equal(res.status, 500);
    assert.deepEqual(await res.json(), { message: "kaboom" });
    assert.match(logged.join("\n"), /Error: kaboom\n\s+at /);
  } finally {
    close();
  }
});
