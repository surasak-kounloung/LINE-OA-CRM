const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("crypto");
const { loadChannels, findChannelBySignature, checkChannelTokens } = require("../services/channels");

const oa1 = { LINE_CHANNEL_TOKEN: "tok-AAA", LINE_CHANNEL_SECRET: "sec-AAA" };
const oa2 = { LINE_CHANNEL_TOKEN_2: "tok-BBB", LINE_CHANNEL_SECRET_2: "sec-BBB" };
const oa3 = { LINE_CHANNEL_TOKEN_3: "tok-CCC", LINE_CHANNEL_SECRET_3: "sec-CCC" };

// ต้อง throw, ข้อความต้องตรง pattern ทุกตัว และห้ามมีค่า secret/token หลุดออกมา
function assertConfigError(env, ...patterns) {
  let error;
  try {
    loadChannels(env);
  } catch (caught) {
    error = caught;
  }
  assert.ok(error, "loadChannels should throw");
  for (const pattern of patterns) assert.match(error.message, pattern);
  for (const [key, value] of Object.entries(env)) {
    if (/TOKEN|SECRET/.test(key) && value.trim()) {
      assert.ok(!error.message.includes(value.trim()), `message leaks the value of ${key}`);
    }
  }
}

test("loadChannels: only the original variables give one channel named OA 1", () => {
  assert.deepEqual(loadChannels(oa1), [
    { id: 1, name: "OA 1", channelSecret: "sec-AAA", channelAccessToken: "tok-AAA", forwardUrl: null },
  ]);
});

test("loadChannels: three accounts come back ordered by id with their names", () => {
  const channels = loadChannels({
    ...oa3, LINE_CHANNEL_NAME_3: "VSQ สาม",
    ...oa1, LINE_CHANNEL_NAME: "VSQ หลัก",
    ...oa2, LINE_CHANNEL_NAME_2: "VSQ สอง",
  });
  assert.deepEqual(channels.map((c) => [c.id, c.name, c.channelSecret, c.channelAccessToken]), [
    [1, "VSQ หลัก", "sec-AAA", "tok-AAA"],
    [2, "VSQ สอง", "sec-BBB", "tok-BBB"],
    [3, "VSQ สาม", "sec-CCC", "tok-CCC"],
  ]);
});

test("loadChannels: numbers may skip and sort numerically, default name is OA <n>", () => {
  const channels = loadChannels({
    ...oa1,
    LINE_CHANNEL_TOKEN_10: "tok-JJJ", LINE_CHANNEL_SECRET_10: "sec-JJJ",
    LINE_CHANNEL_TOKEN_4: "tok-DDD", LINE_CHANNEL_SECRET_4: "sec-DDD",
    ...oa2,
  });
  assert.deepEqual(channels.map((c) => c.id), [1, 2, 4, 10]);
  assert.equal(channels[2].name, "OA 4");
});

test("loadChannels: blank values count as unset", () => {
  const channels = loadChannels({
    ...oa1,
    LINE_CHANNEL_NAME: "   ",
    LINE_CHANNEL_TOKEN_2: "", LINE_CHANNEL_SECRET_2: "  ", LINE_CHANNEL_NAME_2: "", FORWARD_WEBHOOK_URL_2: "",
    LINE_CHANNEL_TOKEN_1: "",
  });
  assert.deepEqual(channels.map((c) => [c.id, c.name]), [[1, "OA 1"]]);
});

test("loadChannels: values pasted with stray whitespace or CR are trimmed", () => {
  const channels = loadChannels({
    LINE_CHANNEL_TOKEN: " tok-AAA\r", LINE_CHANNEL_SECRET: "sec-AAA \r",
    LINE_CHANNEL_TOKEN_2: "tok-BBB\t", LINE_CHANNEL_SECRET_2: "\tsec-BBB", LINE_CHANNEL_NAME_2: " สอง ",
    FORWARD_WEBHOOK_URL_2: " https://crm.example/two ",
  });
  assert.deepEqual(channels, [
    { id: 1, name: "OA 1", channelSecret: "sec-AAA", channelAccessToken: "tok-AAA", forwardUrl: null },
    { id: 2, name: "สอง", channelSecret: "sec-BBB", channelAccessToken: "tok-BBB", forwardUrl: "https://crm.example/two" },
  ]);
});

test("loadChannels: variables with a non-numeric suffix are ignored", () => {
  const channels = loadChannels({ ...oa1, LINE_CHANNEL_TOKEN_OLD: "tok-OLD", LINE_CHANNEL_SECRET_BACKUP: "sec-OLD" });
  assert.equal(channels.length, 1);
});

test("loadChannels: the first account is required", () => {
  assertConfigError({}, /OA 1: ยังไม่ได้ตั้ง LINE_CHANNEL_TOKEN และ LINE_CHANNEL_SECRET/);
  assertConfigError({ LINE_CHANNEL_TOKEN: "tok-AAA" }, /OA 1: ยังไม่ได้ตั้ง LINE_CHANNEL_SECRET$/m);
  assertConfigError({ LINE_CHANNEL_SECRET: "sec-AAA" }, /OA 1: ยังไม่ได้ตั้ง LINE_CHANNEL_TOKEN$/m);
  assertConfigError({ ...oa2 }, /OA 1: ยังไม่ได้ตั้ง/);
});

test("loadChannels: a token without its secret (or the reverse) is rejected", () => {
  assertConfigError({ ...oa1, LINE_CHANNEL_TOKEN_2: "tok-BBB" }, /OA 2: ยังไม่ได้ตั้ง LINE_CHANNEL_SECRET_2$/m);
  assertConfigError({ ...oa1, LINE_CHANNEL_SECRET_2: "sec-BBB" }, /OA 2: ยังไม่ได้ตั้ง LINE_CHANNEL_TOKEN_2$/m);
});

test("loadChannels: a name or forward URL for an account without credentials is rejected", () => {
  assertConfigError({ ...oa1, LINE_CHANNEL_NAME_3: "สาม" }, /OA 3: ยังไม่ได้ตั้ง LINE_CHANNEL_TOKEN_3 และ LINE_CHANNEL_SECRET_3/);
  assertConfigError({ ...oa1, FORWARD_WEBHOOK_URL_3: "https://crm.example/three" }, /OA 3: ยังไม่ได้ตั้ง LINE_CHANNEL_TOKEN_3 และ LINE_CHANNEL_SECRET_3/);
});

test("loadChannels: suffixes _0, _1 and leading zeros are rejected on every variable family", () => {
  assertConfigError({ ...oa1, LINE_CHANNEL_TOKEN_1: "tok-XXX" }, /LINE_CHANNEL_TOKEN_1: เลขต่อท้าย/);
  assertConfigError({ ...oa1, LINE_CHANNEL_SECRET_0: "sec-XXX" }, /LINE_CHANNEL_SECRET_0: เลขต่อท้าย/);
  assertConfigError({ ...oa1, ...oa2, LINE_CHANNEL_NAME_02: "สอง" }, /LINE_CHANNEL_NAME_02: เลขต่อท้าย/);
  assertConfigError({ ...oa1, FORWARD_WEBHOOK_URL_1: "https://crm.example/one" }, /FORWARD_WEBHOOK_URL_1: เลขต่อท้าย/);
});

test("loadChannels: duplicate secrets or tokens are rejected", () => {
  assertConfigError(
    { ...oa1, LINE_CHANNEL_TOKEN_2: "tok-BBB", LINE_CHANNEL_SECRET_2: "sec-AAA" },
    /OA 1 กับ OA 2 ใช้ channel secret ค่าเดียวกัน/
  );
  assertConfigError(
    { ...oa1, ...oa2, LINE_CHANNEL_TOKEN_3: "tok-BBB", LINE_CHANNEL_SECRET_3: "sec-CCC" },
    /OA 2 กับ OA 3 ใช้ access token ค่าเดียวกัน/
  );
});

test("loadChannels: every problem is reported in one error", () => {
  assertConfigError(
    { ...oa1, LINE_CHANNEL_TOKEN_2: "tok-BBB", LINE_CHANNEL_TOKEN_1: "tok-XXX" },
    /LINE_CHANNEL_TOKEN_1: เลขต่อท้าย/,
    /OA 2: ยังไม่ได้ตั้ง LINE_CHANNEL_SECRET_2/
  );
});

test("loadChannels: the first account forwards only when PROCESS is exactly \"true\" and a URL is set", () => {
  const url = "https://crm.example/one";
  const forwardUrl = (extra) => loadChannels({ ...oa1, ...extra })[0].forwardUrl;
  assert.equal(forwardUrl({ FORWARD_WEBHOOK_URL_PROCESS: "true", FORWARD_WEBHOOK_URL: url }), url);
  assert.equal(forwardUrl({ FORWARD_WEBHOOK_URL_PROCESS: "false", FORWARD_WEBHOOK_URL: url }), null);
  assert.equal(forwardUrl({ FORWARD_WEBHOOK_URL_PROCESS: "TRUE", FORWARD_WEBHOOK_URL: url }), null);
  assert.equal(forwardUrl({ FORWARD_WEBHOOK_URL: url }), null);
  assert.equal(forwardUrl({ FORWARD_WEBHOOK_URL_PROCESS: "true" }), null);
  assert.equal(forwardUrl({ FORWARD_WEBHOOK_URL_PROCESS: "true", FORWARD_WEBHOOK_URL: "" }), null);
});

test("loadChannels: later accounts forward only when their own URL is set", () => {
  const channels = loadChannels({
    ...oa1, FORWARD_WEBHOOK_URL_PROCESS: "true", FORWARD_WEBHOOK_URL: "https://crm.example/one",
    ...oa2,
    ...oa3, FORWARD_WEBHOOK_URL_3: "https://crm.example/three",
  });
  assert.deepEqual(channels.map((c) => c.forwardUrl), ["https://crm.example/one", null, "https://crm.example/three"]);

  const off = loadChannels({ ...oa1, FORWARD_WEBHOOK_URL_PROCESS: "false", ...oa2, FORWARD_WEBHOOK_URL_2: "https://crm.example/two" });
  assert.deepEqual(off.map((c) => c.forwardUrl), [null, "https://crm.example/two"]);
});

const sign = (rawBody, secret) => crypto.createHmac("sha256", secret).update(rawBody).digest("base64");
const channels = loadChannels({ ...oa1, ...oa2, ...oa3 });
const rawBody = JSON.stringify({
  destination: "U1",
  events: [{ type: "message", replyToken: "rt", message: { type: "text", text: "โปรโมชั่นล่าสุด 👨‍⚕️" } }],
});

test("findChannelBySignature: returns the account whose secret signed the body", () => {
  for (const channel of channels) {
    assert.equal(findChannelBySignature(channels, rawBody, sign(rawBody, channel.channelSecret)), channel);
  }
  assert.equal(findChannelBySignature(channels, Buffer.from(rawBody, "utf8"), sign(rawBody, "sec-BBB")), channels[1]);
});

test("findChannelBySignature: unknown, tampered or malformed signatures give null", () => {
  assert.equal(findChannelBySignature(channels, rawBody, sign(rawBody, "sec-ZZZ")), null);
  assert.equal(findChannelBySignature(channels, rawBody + " ", sign(rawBody, "sec-AAA")), null);
  assert.equal(findChannelBySignature(channels, rawBody, "not-base64-!!"), null);
  assert.equal(findChannelBySignature([], rawBody, sign(rawBody, "sec-AAA")), null);
});

test("findChannelBySignature: a missing signature or body gives null instead of throwing", () => {
  const signature = sign(rawBody, "sec-AAA");
  for (const missing of [undefined, null, "", ["a", "b"], 42]) {
    assert.equal(findChannelBySignature(channels, rawBody, missing), null);
  }
  for (const missing of [undefined, null, ""]) {
    assert.equal(findChannelBySignature(channels, missing, signature), null);
  }
});

test("checkChannelTokens: reports every account in order and passes the channel to getBotInfo", async () => {
  const seen = [];
  const results = await checkChannelTokens(channels, {
    getBotInfo: async (channel) => {
      seen.push(channel.channelAccessToken);
      // OA แรกตอบช้าสุด ผลลัพธ์ยังต้องเรียงตามลำดับ channel
      await new Promise((resolve) => setTimeout(resolve, channel.id === 1 ? 30 : 0));
      return { userId: `U${channel.id}`, basicId: `@oa${channel.id}`, displayName: `VSQ ${channel.id}` };
    },
  });
  assert.deepEqual(seen, ["tok-AAA", "tok-BBB", "tok-CCC"]);
  assert.deepEqual(results, [
    { id: 1, name: "OA 1", ok: true, basicId: "@oa1", displayName: "VSQ 1" },
    { id: 2, name: "OA 2", ok: true, basicId: "@oa2", displayName: "VSQ 2" },
    { id: 3, name: "OA 3", ok: true, basicId: "@oa3", displayName: "VSQ 3" },
  ]);
});

test("checkChannelTokens: a rejected or throwing check is reported, never thrown", async () => {
  const results = await checkChannelTokens(channels, {
    getBotInfo: (channel) => {
      if (channel.id === 1) throw new Error("boom");
      if (channel.id === 2) return Promise.reject(new Error("Request failed with status code 401"));
      return Promise.resolve({ basicId: "@oa3", displayName: "VSQ 3" });
    },
  });
  assert.deepEqual(results, [
    { id: 1, name: "OA 1", ok: false, error: "boom" },
    { id: 2, name: "OA 2", ok: false, error: "Request failed with status code 401" },
    { id: 3, name: "OA 3", ok: true, basicId: "@oa3", displayName: "VSQ 3" },
  ]);
  assert.deepEqual(await checkChannelTokens([], { getBotInfo: () => { throw new Error("unused"); } }), []);
});
