const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("crypto");
const util = require("util");
const express = require("express");
const { createChatRouter } = require("../routes/chatRoute");

const TRIGGER = "โปรโมชั่นล่าสุด";
const REPLY = [{ type: "text", text: "👨‍⚕️ปรึกษาหมอได้เลย หมอตอบเองครับ" }];
const messageTable = { getReply: (text) => (text === TRIGGER ? REPLY : null) };

const channels = [
  { id: 1, name: "OA 1", channelSecret: "sec-AAA", channelAccessToken: "tok-AAA", forwardUrl: "https://crm.example/one" },
  { id: 2, name: "OA 2", channelSecret: "sec-BBB", channelAccessToken: "tok-BBB", forwardUrl: null },
  { id: 3, name: "OA 3", channelSecret: "sec-CCC", channelAccessToken: "tok-CCC", forwardUrl: "https://crm.example/three" },
];

const sign = (raw, secret) => crypto.createHmac("sha256", secret).update(raw).digest("base64");
const textEvent = (text, replyToken = "rt-1") => ({ type: "message", replyToken, message: { type: "text", text } });
const payload = (...events) => ({ destination: "Udest", events });

// เก็บสิ่งที่ถูก log ผ่าน console[method] ระหว่างรัน fn
async function captureLog(method, fn) {
  const logged = [];
  const original = console[method];
  console[method] = (...args) => { logged.push(util.format(...args)); };
  try {
    await fn();
  } finally {
    console[method] = original;
  }
  return logged;
}

// เปิด express จริงบนพอร์ตสุ่ม ใช้ client และ forward ปลอมที่บันทึกการเรียกไว้
async function startApp(overrides = {}) {
  const replies = []; // { channelId, replyToken, messages }
  const forwards = []; // { url, body }
  const createClient = (channel) => ({
    replyMessage: async (replyToken, messages) => {
      replies.push({ channelId: channel.id, replyToken, messages });
    },
  });
  const forward = async (url, body) => {
    forwards.push({ url, body });
    return { status: 200 };
  };
  const app = express();
  // เหมือน rawBodySaver ใน index.js
  app.use(express.json({
    limit: "2mb",
    verify: (req, res, buf) => { if (buf && buf.length) req.rawBody = buf.toString("utf8"); },
  }));
  app.use("/webhook", createChatRouter({ channels, messageTable, createClient, forward, ...overrides }));
  const server = await new Promise((resolve) => { const s = app.listen(0, () => resolve(s)); });
  const url = `http://127.0.0.1:${server.address().port}/webhook`;
  // secret = เซ็นให้ถูกต้องด้วย secret นั้น, signature = ใส่ค่า header ตรง ๆ, ไม่ใส่ทั้งคู่ = ไม่มี header
  const post = (body, { secret, signature } = {}) => {
    const raw = JSON.stringify(body);
    const headers = { "content-type": "application/json" };
    if (signature !== undefined) headers["x-line-signature"] = signature;
    else if (secret) headers["x-line-signature"] = sign(raw, secret);
    return fetch(url, { method: "POST", headers, body: raw });
  };
  return { replies, forwards, post, url, close: () => server.close() };
}

test("replies through the account whose secret signed the request, and only that one", async () => {
  const { replies, post, close } = await startApp();
  const res = await post(payload(textEvent(TRIGGER)), { secret: "sec-BBB" });
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), [null]);
  assert.deepEqual(replies, [{ channelId: 2, replyToken: "rt-1", messages: REPLY }]);
  close();
});

test("every configured account answers the same trigger with the same messages", async () => {
  const { replies, post, close } = await startApp();
  for (const channel of channels) {
    assert.equal((await post(payload(textEvent(TRIGGER, `rt-${channel.id}`)), { secret: channel.channelSecret })).status, 200);
  }
  assert.deepEqual(replies, [
    { channelId: 1, replyToken: "rt-1", messages: REPLY },
    { channelId: 2, replyToken: "rt-2", messages: REPLY },
    { channelId: 3, replyToken: "rt-3", messages: REPLY },
  ]);
  close();
});

test("a wrong, tampered or missing signature gets 401 with no reply and no forward", async () => {
  const { replies, forwards, post, close } = await startApp();
  const body = payload(textEvent(TRIGGER));

  const wrong = await post(body, { secret: "sec-ZZZ" });
  assert.equal(wrong.status, 401);
  assert.deepEqual(await wrong.json(), { message: "invalid signature" });

  // signature ถูกต้องของ body อื่น
  const tampered = await post(body, { signature: sign(JSON.stringify(payload(textEvent("อื่น"))), "sec-AAA") });
  assert.equal(tampered.status, 401);

  assert.equal((await post(body, { signature: "garbage" })).status, 401);
  assert.equal((await post(body)).status, 401);

  assert.deepEqual(replies, []);
  assert.deepEqual(forwards, []);
  close();
});

test("a request with no body gets 401, not 500", async () => {
  const { replies, url, close } = await startApp();
  assert.equal((await fetch(url, { method: "POST" })).status, 401);
  assert.equal((await fetch(url, { method: "POST", headers: { "x-line-signature": sign("", "sec-AAA") } })).status, 401);
  assert.deepEqual(replies, []);
  close();
});

test("Thai text and emoji in the body still pass the signature check", async () => {
  const { replies, post, close } = await startApp();
  const res = await post(payload(textEvent("สวัสดีค่ะ 👨‍⚕️🙏", "rt-emoji"), textEvent(TRIGGER, "rt-thai")), { secret: "sec-CCC" });
  assert.equal(res.status, 200);
  assert.deepEqual(replies, [{ channelId: 3, replyToken: "rt-thai", messages: REPLY }]);
  close();
});

test("text that is not a trigger gets 200 and no reply", async () => {
  const { replies, post, close } = await startApp();
  const res = await post(payload(textEvent("สวัสดี")), { secret: "sec-BBB" });
  assert.equal(res.status, 200);
  assert.deepEqual(replies, []);
  close();
});

test("LINE's Verify request (events: []) and a body without events get 200", async () => {
  const { replies, post, close } = await startApp();
  const verify = await post({ destination: "Udest", events: [] }, { secret: "sec-BBB" });
  assert.equal(verify.status, 200);
  assert.deepEqual(await verify.json(), []);
  const noEvents = await post({ destination: "Udest" }, { secret: "sec-BBB" });
  assert.equal(noEvents.status, 200);
  assert.deepEqual(await noEvents.json(), []);
  assert.deepEqual(replies, []);
  close();
});

test("one webhook with mixed events replies only to the text triggers", async () => {
  const { replies, post, close } = await startApp();
  const res = await post(payload(
    { type: "follow", replyToken: "rt-follow" },
    { type: "message", replyToken: "rt-sticker", message: { type: "sticker", packageId: "1", stickerId: "1" } },
    { type: "postback", replyToken: "rt-postback", postback: { data: "x" } },
    textEvent("ไม่ใช่ trigger", "rt-unknown"),
    textEvent(TRIGGER, "rt-hit"),
    { type: "unfollow" }
  ), { secret: "sec-BBB" });
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), [null, null, null, null, null, null]);
  assert.deepEqual(replies, [{ channelId: 2, replyToken: "rt-hit", messages: REPLY }]);
  close();
});

test("a failed reply is logged, the other events are still answered, and LINE gets 200", async () => {
  const sent = [];
  const createClient = (channel) => ({
    replyMessage: async (replyToken) => {
      if (replyToken === "rt-bad") throw new Error("Invalid reply token");
      sent.push({ channelId: channel.id, replyToken });
    },
  });
  const { post, close } = await startApp({ createClient });
  const res = await post(payload(textEvent(TRIGGER, "rt-bad"), textEvent(TRIGGER, "rt-good")), { secret: "sec-BBB" });
  assert.equal(res.status, 200);
  assert.deepEqual(sent, [{ channelId: 2, replyToken: "rt-good" }]);
  close();
});

test("a failed reply is logged without the access token carried inside the SDK error", async () => {
  // รูปร่างเดียวกับ HTTPError ของ @line/bot-sdk: originalError คือ AxiosError ที่มี header Authorization อยู่ข้างใน
  const sdkError = Object.assign(new Error("Request failed with status code 400"), {
    statusCode: 400,
    originalError: {
      request: { _header: "POST /v2/bot/message/reply HTTP/1.1\r\nAuthorization: Bearer tok-BBB\r\n\r\n" },
      response: { data: { message: "Invalid reply token" } },
    },
  });
  const createClient = () => ({ replyMessage: async () => { throw sdkError; } });
  const { post, close } = await startApp({ createClient });
  const logged = [];
  const originalError = console.error;
  console.error = (...args) => { logged.push(util.format(...args)); };
  try {
    assert.equal((await post(payload(textEvent(TRIGGER)), { secret: "sec-BBB" })).status, 200);
  } finally {
    console.error = originalError;
    close();
  }
  const output = logged.join("\n");
  assert.ok(!output.includes("tok-BBB"), "the access token reached the log");
  assert.match(output, /\[OA 2\]/);
  assert.match(output, /HTTP 400/);
  assert.match(output, /Invalid reply token/);
});

test("forwards the raw payload only for accounts with a forwardUrl, each to its own URL", async () => {
  const { forwards, post, close } = await startApp();
  const one = payload(textEvent("สวัสดี", "rt-a"));
  const two = payload(textEvent("สวัสดี", "rt-b"));
  const three = payload({ type: "follow", replyToken: "rt-c" });
  await post(one, { secret: "sec-AAA" });
  await post(two, { secret: "sec-BBB" });
  await post(three, { secret: "sec-CCC" });
  assert.deepEqual(forwards, [
    { url: "https://crm.example/one", body: one },
    { url: "https://crm.example/three", body: three },
  ]);
  close();
});

test("a forward that rejects or throws still answers the customer and returns 200", async () => {
  for (const forward of [
    async () => { throw new Error("crm down"); },
    () => { throw new Error("sync failure"); },
  ]) {
    const { replies, post, close } = await startApp({ forward });
    const res = await post(payload(textEvent(TRIGGER)), { secret: "sec-AAA" });
    assert.equal(res.status, 200);
    assert.deepEqual(replies, [{ channelId: 1, replyToken: "rt-1", messages: REPLY }]);
    close();
  }
});

test("a slow forward target delays neither the reply to the customer nor the response to LINE", async () => {
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  const { replies, post, close } = await startApp({ forward: () => gate });
  try {
    const pending = post(payload(textEvent(TRIGGER)), { secret: "sec-AAA" });
    const timedOut = new Promise((resolve) => setTimeout(() => resolve(null), 1000));
    // ปลายทางส่งต่อยังไม่ตอบกลับเลย แต่ LINE ต้องได้ 200 และลูกค้าต้องได้คำตอบแล้ว
    const res = await Promise.race([pending, timedOut]);
    assert.ok(res, "the response to LINE waited for the forward target");
    assert.equal(res.status, 200);
    assert.deepEqual(replies, [{ channelId: 1, replyToken: "rt-1", messages: REPLY }]);
  } finally {
    release({ status: 200 });
    close();
  }
});

test("the default forward posts the payload as JSON with a timeout", async () => {
  const axios = require("axios");
  const originalPost = axios.post;
  const calls = [];
  axios.post = async (url, body, config) => {
    calls.push({ url, body, config });
    return { status: 200 };
  };
  const { post, close } = await startApp({ forward: undefined });
  try {
    const body = payload(textEvent("สวัสดี"));
    assert.equal((await post(body, { secret: "sec-AAA" })).status, 200);
    assert.deepEqual(calls, [
      { url: "https://crm.example/one", body, config: { headers: { "Content-Type": "application/json" }, timeout: 10000 } },
    ]);
  } finally {
    axios.post = originalPost;
    close();
  }
});

test("a message event with no message field is skipped without logging an error", async () => {
  const { replies, post, close } = await startApp();
  let res;
  const logged = await captureLog("error", async () => {
    res = await post(payload({ type: "message", replyToken: "rt-odd" }, textEvent(TRIGGER, "rt-hit")), { secret: "sec-BBB" });
  });
  close();
  assert.equal(res.status, 200);
  assert.deepEqual(replies, [{ channelId: 2, replyToken: "rt-hit", messages: REPLY }]);
  assert.deepEqual(logged, []);
});

test("a rejected signature is logged with the caller's IP and only a well-formed destination", async () => {
  const { post, close } = await startApp();
  const destination = `U${"0123456789abcdef".repeat(2)}`;
  const logged = await captureLog("warn", async () => {
    assert.equal((await post({ destination, events: [] }, { secret: "sec-ZZZ" })).status, 401);
    // destination มาจาก body ที่ยังไม่ผ่านการตรวจ — ค่าที่หน้าตาไม่ใช่ user ID ของ LINE ต้องไม่ถูกพิมพ์
    assert.equal((await post({ destination: "U123\nFAKE LOG LINE", events: [] }, { secret: "sec-ZZZ" })).status, 401);
  });
  close();
  assert.equal(logged.length, 2);
  assert.match(logged[0], /ip [0-9a-f:.]+, destination U0123456789abcdef0123456789abcdef\)/);
  assert.match(logged[1], /destination -\)/);
  assert.ok(!logged[1].includes("FAKE LOG LINE"));
});

test("one client is created per account, not per request", async () => {
  const created = [];
  const createClient = (channel) => {
    created.push(channel.id);
    return { replyMessage: async () => {} };
  };
  const { post, close } = await startApp({ createClient });
  await post(payload(textEvent(TRIGGER)), { secret: "sec-AAA" });
  await post(payload(textEvent(TRIGGER)), { secret: "sec-AAA" });
  assert.deepEqual(created, [1, 2, 3]);
  close();
});

test("asks for the reply of the OA that sent the event, and stays silent when there is none", async () => {
  const asked = [];
  const { replies, post, close } = await startApp({
    messageTable: { getReply: (text, channelId) => { asked.push([text, channelId]); return channelId === 3 ? null : REPLY; } },
  });
  assert.equal((await post(payload(textEvent(TRIGGER)), { secret: "sec-CCC" })).status, 200);
  assert.equal((await post(payload(textEvent(TRIGGER)), { secret: "sec-BBB" })).status, 200);
  assert.deepEqual(asked, [[TRIGGER, 3], [TRIGGER, 2]]);
  assert.deepEqual(replies.map((r) => r.channelId), [2]);
  close();
});
