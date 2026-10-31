# Multi-OA Webhook (Phase 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let this one app be the webhook of several LINE OAs on the same `/webhook` URL, each customer answered through the OA they wrote to, all OAs sharing the same `data/*.json` content.

**Architecture:** A new `services/channels.js` reads the OA list from `.env` (original variable names for the first OA, `_2`, `_3`… suffixes for the rest), finds which OA sent a request by trying each channel secret against the `X-Line-Signature` header, and checks each token against LINE at boot. `routes/chatRoute.js` becomes a factory `createChatRouter({ channels, messageTable })` (same shape as `createAdminRouter`) that replies with the matched OA's client. `index.js` builds the store, the message table and the OA list once and hands them to both routers.

**Tech Stack:** Node 20 (built-in `node --test`, `crypto`, `fetch`), Express 4, `@line/bot-sdk` 9.4.1 (`line.validateSignature`, `line.Client`), axios.

**Spec:** `docs/superpowers/specs/2026-10-07-multi-oa-webhook-design.md`

## Global Constraints

- Node `v20.11.0`. Windows host; run commands in Git Bash from the repo root.
- **No new npm dependencies.** Tests use `node --test` only (`npm test`).
- The 52 existing tests must keep passing. Final total: **84** (52 + 19 in `test/channels.test.js` + 13 in `test/chatRoute.test.js`).
- A server whose `.env` has only the original variables (`LINE_CHANNEL_TOKEN`, `LINE_CHANNEL_SECRET`, `FORWARD_WEBHOOK_URL_PROCESS`, `FORWARD_WEBHOOK_URL`) must behave exactly as before, except that a bad signature now gets `401` instead of `500`.
- Variable names, verbatim: `LINE_CHANNEL_TOKEN`, `LINE_CHANNEL_SECRET`, `LINE_CHANNEL_NAME`, `FORWARD_WEBHOOK_URL_PROCESS`, `FORWARD_WEBHOOK_URL`, and for OA n ≥ 2: `LINE_CHANNEL_TOKEN_<n>`, `LINE_CHANNEL_SECRET_<n>`, `LINE_CHANNEL_NAME_<n>`, `FORWARD_WEBHOOK_URL_<n>`. There is no `_PROCESS` variable for n ≥ 2.
- `<n>` is an integer ≥ 2 with no leading zero; numbers may skip. Blank or whitespace-only values count as unset.
- Config errors stop the app at boot (exit code 1). Error text names the variable and **never contains a secret or token value**.
- Bad or missing signature → `401` with body `{"message":"invalid signature"}`.
- Forwarding is unchanged on the wire: `axios.post(url, req.body, { headers: { "Content-Type": "application/json" } })`.
- Code style of the repo: CommonJS, 2-space indent, double quotes, semicolons, Thai comments at the same density as the surrounding files.
- Never read or print the values in the local `.env`. Smoke tests override what they need with shell variables.
- Work on branch `feat/multi-oa-webhook`. Every commit message ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Out of scope (phase 2, separate spec): Rich Menu page and sync, showing the OA list in `/backoffice`.
- Spec §8 (staging test, deploy, LINE console settings) is a manual rollout done by the user after this branch is merged; Task 4 documents it.

## Review Focus

Inputs the spec implies but does not list as tests. Each one has a test in the task that owns the code.

1. **Thai text and emoji in the webhook body.** The signature is checked against `req.rawBody`, a UTF-8 string rebuilt from the bytes. A customer's Thai message must still match. → Task 2 (`findChannelBySignature` body), Task 3 ("Thai text and emoji…").
2. **A secret or token pasted into `.env` with a trailing space, tab or CR.** It must be trimmed; otherwise every request from that OA gets 401 with nothing pointing at the cause. → Task 1 ("values pasted with stray whitespace…").
3. **One webhook carrying several events of mixed types, with one reply failing.** Only text triggers are answered, a failed reply does not stop the others, and LINE still gets 200. → Task 3 ("one webhook with mixed events…", "a failed reply…").
4. **Requests with no body or no signature** (scanners hitting `/webhook`). They get 401, never a 500 or an unhandled exception — `line.validateSignature` throws on an `undefined` signature. → Task 2 ("a missing signature or body…"), Task 3 ("a request with no body…").
5. **A slow or hanging forward target.** The customer's reply must be sent without waiting for it. → Task 3 ("a slow forward target…").

---

## File Structure

| Path | Responsibility |
|---|---|
| `services/channels.js` (new) | The OA list: `loadChannels(env)`, `findChannelBySignature(channels, rawBody, signature)`, `checkChannelTokens(channels, { getBotInfo })` |
| `routes/chatRoute.js` (rewrite) | `createChatRouter({ channels, messageTable, createClient, forward })` — webhook only |
| `index.js` (modify) | Loads `.env`, builds store / message table / OA list, mounts routers, logs OA status at boot |
| `test/channels.test.js` (new) | 19 tests for `services/channels.js` |
| `test/chatRoute.test.js` (new) | 13 tests for the webhook route |
| `.env.example`, `CLAUDE.md`, `README.md` (modify) | Document the new variables and how to add an OA |

---

### Task 1: `loadChannels` — read the OA list from the environment

**Files:**
- Create: `services/channels.js`
- Test: `test/channels.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces: `loadChannels(env = process.env)` → `Channel[]` sorted by `id`, where `Channel = { id: number, name: string, channelSecret: string, channelAccessToken: string, forwardUrl: string | null }`. Throws `Error` whose message starts with `ตั้งค่า LINE OA ใน .env ไม่ถูกต้อง:` and lists every problem on its own `- ` line. Pure function: no network, no file access.

- [ ] **Step 1: Write the failing tests**

Create `test/channels.test.js`:

```js
const test = require("node:test");
const assert = require("node:assert/strict");
const { loadChannels } = require("../services/channels");

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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test test/channels.test.js`
Expected: FAIL — `Error: Cannot find module '../services/channels'`.

- [ ] **Step 3: Write the implementation**

Create `services/channels.js`:

```js
// รายชื่อ LINE OA ที่แอปนี้เป็น webhook ให้ (อ่านจาก .env)

// ตัวแปรที่มีเลขต่อท้ายสำหรับ OA ที่ 2 ขึ้นไป (OA แรกใช้ชื่อเดิมที่ไม่มีเลข)
const SUFFIXED_KEY = /^(LINE_CHANNEL_TOKEN|LINE_CHANNEL_SECRET|LINE_CHANNEL_NAME|FORWARD_WEBHOOK_URL)_(\d+)$/;
const VALID_SUFFIX = /^([2-9]|[1-9]\d+)$/;

// ค่าว่างหรือมีแต่ช่องว่างถือว่าไม่ได้ตั้ง
function readValue(env, key) {
  const raw = env[key];
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  return trimmed === "" ? null : trimmed;
}

function forwardUrlFor(env, id) {
  if (id === 1) {
    // OA แรกคงความหมายเดิม: ต้องเปิดด้วย FORWARD_WEBHOOK_URL_PROCESS="true" ก่อน
    return env.FORWARD_WEBHOOK_URL_PROCESS === "true" ? readValue(env, "FORWARD_WEBHOOK_URL") : null;
  }
  return readValue(env, `FORWARD_WEBHOOK_URL_${id}`);
}

// อ่านรายชื่อ OA จาก env — throw พร้อมรายการที่ผิดทั้งหมด (ไม่พิมพ์ค่า secret/token)
function loadChannels(env = process.env) {
  const errors = [];
  const ids = new Set([1]);

  for (const key of Object.keys(env)) {
    const match = SUFFIXED_KEY.exec(key);
    if (!match || readValue(env, key) === null) continue;
    if (!VALID_SUFFIX.test(match[2])) {
      errors.push(`${key}: เลขต่อท้ายต้องเป็นจำนวนเต็มตั้งแต่ 2 ขึ้นไป ไม่มีศูนย์นำหน้า (OA แรกใช้ชื่อตัวแปรที่ไม่มีเลข)`);
      continue;
    }
    ids.add(Number(match[2]));
  }

  const channels = [];
  for (const id of [...ids].sort((a, b) => a - b)) {
    const suffix = id === 1 ? "" : `_${id}`;
    const tokenKey = `LINE_CHANNEL_TOKEN${suffix}`;
    const secretKey = `LINE_CHANNEL_SECRET${suffix}`;
    const channelAccessToken = readValue(env, tokenKey);
    const channelSecret = readValue(env, secretKey);
    if (!channelAccessToken || !channelSecret) {
      const missing = [channelAccessToken ? null : tokenKey, channelSecret ? null : secretKey].filter(Boolean);
      errors.push(`OA ${id}: ยังไม่ได้ตั้ง ${missing.join(" และ ")}`);
      continue;
    }
    channels.push({
      id,
      name: readValue(env, `LINE_CHANNEL_NAME${suffix}`) || `OA ${id}`,
      channelSecret,
      channelAccessToken,
      forwardUrl: forwardUrlFor(env, id),
    });
  }

  // secret ซ้ำ = แยกไม่ได้ว่า event มาจาก OA ไหน, token ซ้ำ = ตอบผิดบัญชี
  for (const [field, label] of [["channelSecret", "channel secret"], ["channelAccessToken", "access token"]]) {
    const seen = new Map();
    for (const channel of channels) {
      const first = seen.get(channel[field]);
      if (first) {
        errors.push(`OA ${first.id} กับ OA ${channel.id} ใช้ ${label} ค่าเดียวกัน`);
      } else {
        seen.set(channel[field], channel);
      }
    }
  }

  if (errors.length) {
    throw new Error(`ตั้งค่า LINE OA ใน .env ไม่ถูกต้อง:\n- ${errors.join("\n- ")}`);
  }
  return channels;
}

module.exports = { loadChannels };
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test test/channels.test.js`
Expected: `# tests 14`, `# pass 14`, `# fail 0`.

- [ ] **Step 5: Commit**

```bash
git add services/channels.js test/channels.test.js
git commit -m "feat: load multiple LINE OA credentials from .env" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: `findChannelBySignature` and `checkChannelTokens`

**Files:**
- Modify: `services/channels.js`
- Test: `test/channels.test.js`

**Interfaces:**
- Consumes: `loadChannels` and the `Channel` shape from Task 1.
- Produces:
  - `findChannelBySignature(channels: Channel[], rawBody: string | Buffer, signature: string)` → the `Channel` (same object as in the array) whose `channelSecret` signed `rawBody`, or `null`. Never throws, whatever is passed as `rawBody` or `signature`.
  - `checkChannelTokens(channels: Channel[], { getBotInfo } = {})` → `Promise<Array<{ id, name, ok: true, basicId, displayName } | { id, name, ok: false, error: string }>>`, same order as `channels`. Never rejects. `getBotInfo(channel)` defaults to `GET /v2/bot/info` with that channel's token.

- [ ] **Step 1: Write the failing tests**

In `test/channels.test.js`, replace the three `require` lines at the top with these four:

```js
const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("crypto");
const { loadChannels, findChannelBySignature, checkChannelTokens } = require("../services/channels");
```

Then append to the end of the file:

```js
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test test/channels.test.js`
Expected: the 14 `loadChannels` tests pass; the 5 new tests fail with `TypeError: findChannelBySignature is not a function` / `TypeError: checkChannelTokens is not a function`.

- [ ] **Step 3: Write the implementation**

In `services/channels.js`, replace the first line (the header comment) with:

```js
// รายชื่อ LINE OA ที่แอปนี้เป็น webhook ให้: อ่านจาก .env, หา OA ต้นทางจาก signature, ตรวจ token
const line = require("@line/bot-sdk");
```

Then replace the last line (`module.exports = { loadChannels };`) with:

```js
// หา OA ที่ secret ของมันเซ็น rawBody ได้ตรงกับ signature — ไม่เจอคืน null
function findChannelBySignature(channels, rawBody, signature) {
  if (!rawBody || typeof signature !== "string" || signature === "") return null;
  return channels.find((channel) => line.validateSignature(rawBody, channel.channelSecret, signature)) || null;
}

const defaultGetBotInfo = (channel) =>
  new line.Client({ channelAccessToken: channel.channelAccessToken }).getBotInfo();

// ถาม LINE ว่า token ของแต่ละ OA ใช้ได้ไหม — ไม่ throw, คืนผลครบทุก OA ตามลำดับเดิม
async function checkChannelTokens(channels, { getBotInfo = defaultGetBotInfo } = {}) {
  return Promise.all(
    channels.map(async (channel) => {
      try {
        const info = await getBotInfo(channel);
        return { id: channel.id, name: channel.name, ok: true, basicId: info.basicId, displayName: info.displayName };
      } catch (error) {
        return { id: channel.id, name: channel.name, ok: false, error: error.message };
      }
    })
  );
}

module.exports = { loadChannels, findChannelBySignature, checkChannelTokens };
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test test/channels.test.js`
Expected: `# tests 19`, `# pass 19`, `# fail 0`.

- [ ] **Step 5: Commit**

```bash
git add services/channels.js test/channels.test.js
git commit -m "feat: identify the LINE OA of a webhook by its signature and check tokens" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Webhook route for several OAs, wired into `index.js`

**Files:**
- Rewrite: `routes/chatRoute.js`
- Rewrite: `index.js`
- Test: `test/chatRoute.test.js`

**Interfaces:**
- Consumes: `loadChannels`, `findChannelBySignature`, `checkChannelTokens` and the `Channel` shape from Tasks 1–2; `createMessageTable(store)` → `{ getTable(): Map<string, Message[]> }` from `services/messageTable.js`; `getDefaultStore()` from `services/dataStore.js`; `createAdminRouter({ store, messageTable })` from `routes/adminRoute.js`.
- Produces: `createChatRouter({ channels, messageTable, createClient, forward })` → an Express router handling `POST /`.
  - `createClient(channel)` → object with `replyMessage(replyToken, messages)`; default builds a `line.Client`. Called once per channel when the router is created.
  - `forward(url, body)` → promise; default is `axios.post` with `Content-Type: application/json`.
  - The router reads `req.rawBody` (string), which the app must set in `express.json({ verify })` before the router runs.
  - `routes/chatRoute.js` no longer exports a router or `messageTable`, and no longer calls `dotenv`.

- [ ] **Step 1: Write the failing tests**

Create `test/chatRoute.test.js`:

```js
const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("crypto");
const express = require("express");
const { createChatRouter } = require("../routes/chatRoute");

const TRIGGER = "โปรโมชั่นล่าสุด";
const REPLY = [{ type: "text", text: "👨‍⚕️ปรึกษาหมอได้เลย หมอตอบเองครับ" }];
const messageTable = { getTable: () => new Map([[TRIGGER, REPLY]]) };

const channels = [
  { id: 1, name: "OA 1", channelSecret: "sec-AAA", channelAccessToken: "tok-AAA", forwardUrl: "https://crm.example/one" },
  { id: 2, name: "OA 2", channelSecret: "sec-BBB", channelAccessToken: "tok-BBB", forwardUrl: null },
  { id: 3, name: "OA 3", channelSecret: "sec-CCC", channelAccessToken: "tok-CCC", forwardUrl: "https://crm.example/three" },
];

const sign = (raw, secret) => crypto.createHmac("sha256", secret).update(raw).digest("base64");
const textEvent = (text, replyToken = "rt-1") => ({ type: "message", replyToken, message: { type: "text", text } });
const payload = (...events) => ({ destination: "Udest", events });

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

test("a slow forward target does not delay the reply to the customer", async () => {
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  const { replies, post, close } = await startApp({ forward: () => gate });
  const pending = post(payload(textEvent(TRIGGER)), { secret: "sec-AAA" });
  for (let i = 0; i < 100 && replies.length === 0; i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  // ตอบลูกค้าแล้ว ทั้งที่ปลายทางส่งต่อยังไม่ตอบกลับ
  assert.deepEqual(replies, [{ channelId: 1, replyToken: "rt-1", messages: REPLY }]);
  release({ status: 200 });
  assert.equal((await pending).status, 200);
  close();
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test test/chatRoute.test.js`
Expected: FAIL — every test errors with `TypeError: createChatRouter is not a function`. (On a machine without a `.env` the file instead fails to load with `no channel access token`; both mean the factory does not exist yet.)

- [ ] **Step 3: Rewrite the route**

Replace the whole content of `routes/chatRoute.js` with:

```js
// Webhook ของ LINE (รองรับหลาย OA): หา OA ต้นทางจาก signature → ส่งต่อ payload ถ้าตั้งค่าไว้ → ตอบจากตาราง trigger
const express = require("express");
const line = require("@line/bot-sdk");
const axios = require("axios");
const { findChannelBySignature } = require("../services/channels");

const defaultCreateClient = (channel) =>
  new line.Client({ channelAccessToken: channel.channelAccessToken, channelSecret: channel.channelSecret });

const defaultForward = (url, body) => axios.post(url, body, { headers: { "Content-Type": "application/json" } });

function createChatRouter({ channels, messageTable, createClient = defaultCreateClient, forward = defaultForward }) {
  const router = express.Router();

  // client ของแต่ละ OA สร้างครั้งเดียว — ต้องตอบด้วย token ของ OA ที่ลูกค้าทักมาเท่านั้น
  const clients = new Map(channels.map((channel) => [channel.id, createClient(channel)]));

  const handleEvent = async (channel, event) => {
    try {
      if (event.type !== "message" || event.message.type !== "text") {
        return null;
      }
      const messages = messageTable.getTable().get(event.message.text);
      if (!messages) {
        return null;
      }
      await clients.get(channel.id).replyMessage(event.replyToken, messages);
      return null;
    } catch (error) {
      console.error(`[${channel.name}] เกิดข้อผิดพลาดในการจัดการอีเวนต์:`, error);
      return null;
    }
  };

  router.post("/", async (req, res) => {
    // req.rawBody มาจาก rawBodySaver ใน index.js — signature ของ LINE คำนวณจาก body ดิบ
    const channel = findChannelBySignature(channels, req.rawBody, req.get("x-line-signature"));
    if (!channel) {
      console.warn("webhook: signature ไม่ตรงกับ LINE OA ใดที่ตั้งค่าไว้");
      return res.status(401).json({ message: "invalid signature" });
    }

    try {
      let forwardPromise = Promise.resolve(null);

      // ส่งต่อ payload ดิบไป CRM ถ้า OA นี้ตั้งค่าไว้ (ไม่บล็อกการตอบ)
      if (channel.forwardUrl) {
        forwardPromise = Promise.resolve()
          .then(() => forward(channel.forwardUrl, req.body))
          .then((response) => {
            console.log(`[${channel.name}] ส่งต่อข้อมูลสำเร็จ:`, response && response.status);
            return response;
          })
          .catch((error) => {
            console.error(`[${channel.name}] เกิดข้อผิดพลาดในการส่งต่อข้อมูล:`, error.message);
            return null;
          });
      }

      const events = Array.isArray(req.body.events) ? req.body.events : [];
      const handlePromise = Promise.all(events.map((event) => handleEvent(channel, event)));
      const [, handleResult] = await Promise.all([forwardPromise, handlePromise]);
      return res.json(handleResult);
    } catch (error) {
      console.error(`[${channel.name}] เกิดข้อผิดพลาดในการดำเนินการ:`, error.message);
      return res.status(500).end();
    }
  });

  return router;
}

module.exports = { createChatRouter };
```

- [ ] **Step 4: Run the route tests to verify they pass**

Run: `node --test test/chatRoute.test.js`
Expected: `# tests 13`, `# pass 13`, `# fail 0`. Lines such as `[OA 2] เกิดข้อผิดพลาดในการจัดการอีเวนต์` and `webhook: signature ไม่ตรงกับ LINE OA ใดที่ตั้งค่าไว้` in the output are the failures the tests provoke on purpose.

- [ ] **Step 5: Wire it into `index.js`**

`index.js` still does `require("./routes/chatRoute")` as a router and reads `chatRouter.messageTable`, so the app cannot start until this step is done. Replace the whole content of `index.js` with:

```js
require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const { notFound, errorHandler } = require("./middlewares/errorHandler");
const path = require("path");
const fs = require("fs");
const { getDefaultStore } = require("./services/dataStore");
const { createMessageTable } = require("./services/messageTable");
const { loadChannels, checkChannelTokens } = require("./services/channels");
const { createChatRouter } = require("./routes/chatRoute");
const { createAdminRouter } = require("./routes/adminRoute");

const PORT = process.env.PORT || 8080;

// รายชื่อ LINE OA จาก .env — ถ้าตั้งค่าผิดให้หยุดตั้งแต่ตอนเปิดแอป ดีกว่าเปิดได้แต่ตอบผิดบัญชี
let channels;
try {
  channels = loadChannels(process.env);
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

const store = getDefaultStore();
// ตาราง trigger → ข้อความตอบ สร้างจาก data/*.json และสร้างใหม่อัตโนมัติเมื่อหน้า admin บันทึก (ใช้ร่วมกันทุก OA)
const messageTable = createMessageTable(store);

const rawBodySaver = (req, res, buf, encoding) => {
  if (buf && buf.length) {
    req.rawBody = buf.toString(encoding || "utf8");
  }
};

const app = express();

// อยู่หลัง nginx บนเครื่องเดียวกัน: เชื่อ X-Forwarded-For เฉพาะที่มาจาก loopback
// เพื่อให้ req.ip เป็น IP จริงของผู้ใช้ (login lockout ใน adminRoute นับแยกตาม IP)
// ถ้าไม่ตั้ง ทุกคำขอจะเป็น 127.0.0.1 และการใส่รหัสผิดของคนเดียวจะล็อกแอดมินทุกคน
app.set("trust proxy", "loopback");

app.use(
  express.json({
    limit: "2mb",
    verify: rawBodySaver,
  })
);

app.use(bodyParser.json());
app.use(cookieParser());

app.use("/webhook", cors());
app.use("/webhook", createChatRouter({ channels, messageTable }));

// หน้า admin + API (ต้องอยู่ก่อน app.get("/"))
app.use("/api/admin", createAdminRouter({ store, messageTable }));
// path ของหน้า admin UI — ต้องตรงกับ `base` ใน admin/vite.config.js (ต้อง build ใหม่ทุกครั้งที่เปลี่ยน)
const ADMIN_UI_PATH = "/backoffice";
const adminDist = path.join(__dirname, "admin", "dist");
if (fs.existsSync(adminDist)) {
  app.use(ADMIN_UI_PATH, express.static(adminDist));
} else {
  app.use(ADMIN_UI_PATH, (req, res) => res.status(404).send("admin UI not built: run `npm run admin:build`"));
}

app.get("/", (req, res) => {
  res.send("ok");
});

app.use(notFound);
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`LINE OA ที่โหลดจาก .env: ${channels.length} บัญชี`);
  for (const channel of channels) {
    console.log(`- [${channel.id}] ${channel.name} (ส่งต่อ webhook: ${channel.forwardUrl ? "เปิด" : "ปิด"})`);
  }
  // ตรวจ token ของทุก OA กับ LINE — แค่เตือนใน log ไม่หยุดแอป
  checkChannelTokens(channels).then((results) => {
    for (const result of results) {
      if (result.ok) {
        console.log(`[${result.name}] token ใช้ได้: ${result.displayName} (${result.basicId})`);
      } else {
        console.warn(`[${result.name}] ตรวจ token ไม่ผ่าน: ${result.error}`);
      }
    }
  });
});
```

- [ ] **Step 6: Confirm nothing else depends on the old exports**

Run: `grep -rn "chatRoute" --include=*.js . | grep -v node_modules`
Expected: exactly two files mention it — `index.js` (`createChatRouter`) and `test/chatRoute.test.js`.

- [ ] **Step 7: Smoke-test the boot**

One OA, as an existing server would start:

```bash
LINE_CHANNEL_TOKEN=x LINE_CHANNEL_SECRET=x FORWARD_WEBHOOK_URL_PROCESS=false PORT=8099 timeout 6 node index.js; echo "exit=$?"
```

Expected (the token line needs network access and may not appear within 6 seconds):

```
Server is running on port 8099
LINE OA ที่โหลดจาก .env: 1 บัญชี
- [1] OA 1 (ส่งต่อ webhook: ปิด)
[OA 1] ตรวจ token ไม่ผ่าน: Request failed with status code 401
exit=124
```

A broken configuration must stop the app:

```bash
LINE_CHANNEL_TOKEN=x LINE_CHANNEL_SECRET=x LINE_CHANNEL_TOKEN_9=only-token PORT=8099 node index.js; echo "exit=$?"
```

Expected:

```
ตั้งค่า LINE OA ใน .env ไม่ถูกต้อง:
- OA 9: ยังไม่ได้ตั้ง LINE_CHANNEL_SECRET_9
exit=1
```

Two OAs answering signed requests on the same URL:

```bash
LINE_CHANNEL_TOKEN=x LINE_CHANNEL_SECRET=sec-one LINE_CHANNEL_TOKEN_2=y LINE_CHANNEL_SECRET_2=sec-two LINE_CHANNEL_NAME_2="VSQ สอง" PORT=8099 node index.js > /dev/null 2>&1 &
PID=$!
node -e "
const crypto=require('crypto');
const body=JSON.stringify({destination:'U1',events:[]});
const sig=(s)=>crypto.createHmac('sha256',s).update(body).digest('base64');
const post=(h)=>fetch('http://127.0.0.1:8099/webhook',{method:'POST',headers:{'content-type':'application/json',...h},body}).then(r=>r.status);
(async()=>{
  for(let i=0;i<50;i++){try{await fetch('http://127.0.0.1:8099/');break}catch(e){await new Promise(r=>setTimeout(r,100))}}
  console.log('OA1',await post({'x-line-signature':sig('sec-one')}),'OA2',await post({'x-line-signature':sig('sec-two')}),'bad',await post({'x-line-signature':sig('nope')}),'none',await post({}));
})();
"
kill $PID
```

Expected: `OA1 200 OA2 200 bad 401 none 401`

- [ ] **Step 8: Run the whole suite**

Run: `npm test`
Expected: `# tests 84`, `# pass 84`, `# fail 0`.

- [ ] **Step 9: Commit**

```bash
git add routes/chatRoute.js index.js test/chatRoute.test.js
git commit -m "feat: serve several LINE OAs on one webhook URL" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Document the new configuration

**Files:**
- Modify: `.env.example`
- Modify: `CLAUDE.md`
- Modify: `README.md`

**Interfaces:**
- Consumes: the variable names and behavior from Tasks 1–3.
- Produces: nothing other tasks rely on.

- [ ] **Step 1: Update `.env.example`**

Replace the lines from `# LINE Messaging API` through `FORWARD_WEBHOOK_URL=` (inclusive) with:

```dotenv
# LINE Messaging API — OA แรก (บังคับ)
LINE_CHANNEL_TOKEN=YOUR_LINE_CHANNEL_ACCESS_TOKEN
LINE_CHANNEL_SECRET=YOUR_LINE_CHANNEL_SECRET
# ไม่บังคับ: ชื่อที่ใช้ใน log (ค่าเริ่มต้น "OA 1")
LINE_CHANNEL_NAME=

# LINE OA เพิ่มเติม: ใช้เลขต่อท้ายตั้งแต่ _2 (ไม่ต้องเรียงติดกัน) ทุก OA ใช้ Webhook URL เดียวกัน
# token กับ secret ต้องมาคู่กัน เว้นว่างทั้งคู่ = ไม่ใช้ OA นั้น
LINE_CHANNEL_TOKEN_2=
LINE_CHANNEL_SECRET_2=
LINE_CHANNEL_NAME_2=
LINE_CHANNEL_TOKEN_3=
LINE_CHANNEL_SECRET_3=
LINE_CHANNEL_NAME_3=

# Forward webhook to external URL — OA แรกเท่านั้น ("true" to enable)
FORWARD_WEBHOOK_URL_PROCESS=false
# Beacon API or other
FORWARD_WEBHOOK_URL=
# OA เพิ่มเติม: ใส่ URL = ส่งต่อ event ของ OA นั้น, เว้นว่าง = ไม่ส่งต่อ
FORWARD_WEBHOOK_URL_2=
FORWARD_WEBHOOK_URL_3=
```

Leave `PORT=8080` above it and the `ADMIN_*` lines below it unchanged.

- [ ] **Step 2: Update `CLAUDE.md`**

Make these six replacements.

(a) Under `## What this is`, replace the paragraph with:

```markdown
A Node.js/Express webhook server for the V Square Clinic LINE Official Accounts. One instance serves several OAs on the same `/webhook` URL, and every OA answers from the same content. It receives LINE Messaging API webhook events, matches the user's text against a lookup table, and replies with LINE Flex Messages (branch maps, doctor schedules, services, promotions). It can also forward incoming webhook payloads to an external CRM URL, configured per OA.
```

(b) Under `### Testing the webhook locally`, replace the first two sentences (from `` `POST /webhook` is wrapped in `` through `will fail signature verification.`) with:

```markdown
`POST /webhook` checks the `X-Line-Signature` header against the raw body with each configured OA's channel secret; the secret that matches identifies which OA sent the event. A plain `curl` has no valid signature and gets 401.
```

Keep the rest of that paragraph (`To test end-to-end, …`).

(c) Under `## Environment`, replace the three bullets for `LINE_CHANNEL_TOKEN` / `LINE_CHANNEL_SECRET`, `FORWARD_WEBHOOK_URL_PROCESS` and `FORWARD_WEBHOOK_URL` with:

```markdown
- `LINE_CHANNEL_TOKEN` / `LINE_CHANNEL_SECRET` — the first OA, from its LINE Developers Channel (required). `LINE_CHANNEL_NAME` — optional name used in logs (default `OA 1`)
- `LINE_CHANNEL_TOKEN_<n>` / `LINE_CHANNEL_SECRET_<n>` / `LINE_CHANNEL_NAME_<n>` — additional OAs, `<n>` = 2 and up (gaps allowed, no leading zeros). Token and secret must come as a pair; blank values count as unset
- `FORWARD_WEBHOOK_URL_PROCESS` — the string `"true"` enables forwarding **for the first OA**; any other value disables it
- `FORWARD_WEBHOOK_URL` — destination CRM/beacon URL for the first OA when forwarding is enabled
- `FORWARD_WEBHOOK_URL_<n>` — if set, OA `<n>`'s events are forwarded there; unset means that OA forwards nothing (there is no `_PROCESS` flag for additional OAs)
```

and add this paragraph after the last bullet of that section (after the `ADMIN_TOKEN_SECRET` bullet):

```markdown

The app refuses to start (exit 1; the message names the variable and never prints a secret) when the first OA is missing, a token/secret pair is incomplete, a suffix is `_0`, `_1` or zero-padded, a name or forward URL is set for an OA without credentials, or two OAs share a secret or a token.
```

(d) Under `## Architecture`, replace the `index.js` bullet with:

```markdown
- **`index.js`** — Express bootstrap. Loads `.env`, builds the OA list (`loadChannels`; exits on a config error), the data store and the message table, and passes them to the routers. `rawBodySaver` on `express.json({ limit: "2mb", verify })` keeps the raw body for LINE's signature check. Mounts `/webhook` (LINE), `/api/admin` (admin API), `/backoffice` (static build of the React admin UI, only if `admin/dist` exists). `GET /` returns `"ok"`. After `listen` it logs the loaded OAs and checks each token against LINE (`checkChannelTokens`; a bad token is only a warning).
- **`services/channels.js`** — the OA list. `loadChannels(env)` → `[{ id, name, channelSecret, channelAccessToken, forwardUrl }]`; `findChannelBySignature(channels, rawBody, signature)` returns the OA whose secret signed the body, or `null`; `checkChannelTokens(channels)` asks LINE whether each token works.
```

and replace the `routes/chatRoute.js` bullet with:

```markdown
- **`routes/chatRoute.js`** — `createChatRouter({ channels, messageTable })`, webhook only: find the OA by signature (no match → 401), optional forwarding to that OA's `forwardUrl`, then `messageTable.getTable().get(text)` → `replyMessage` with that OA's client. No trigger match → no reply. The message table is shared by every OA.
```

(e) Insert this section between `## Adding or changing content` (after its paragraph) and `## Tests`:

```markdown
## Adding a LINE OA

Add `LINE_CHANNEL_TOKEN_<n>` / `LINE_CHANNEL_SECRET_<n>` (optionally `LINE_CHANNEL_NAME_<n>`, `FORWARD_WEBHOOK_URL_<n>`) to the server's `.env`, restart, and check that the boot log lists the OA with a working token. In that OA's LINE Developers console set the **same** Webhook URL as the other OAs, enable "Use webhook" and press Verify. No code or data changes are needed. Each OA's Rich Menu is still created separately in LINE Official Account Manager, and its trigger strings must byte-match the other OAs'.

```

(f) Under `## Tests`, replace `(data store, validators, builders, message table, admin auth/routes) — 52 tests` with `(data store, validators, builders, message table, admin auth/routes, OA list, webhook route) — 84 tests`.

- [ ] **Step 3: Update `README.md`**

Make these eight replacements.

(a) In `## ภาพรวมโปรเจกต์`, add this bullet after the first bullet (`- ใช้ Express.js เปิดให้บริการเส้นทาง …`):

```markdown
- แอปเดียวรองรับ LINE OA หลายบัญชีบน Webhook URL เดียวกัน ทุกบัญชีตอบเนื้อหาชุดเดียวกัน — ดูหัวข้อ [ใช้หลาย LINE OA กับแอปเดียว](#ใช้หลาย-line-oa-กับแอปเดียว)
```

(b) In `## โครงสร้างโดยย่อ`, replace the `routes/chatRoute.js` bullet with these two:

```markdown
- `routes/chatRoute.js` : รับอีเวนต์จาก LINE, หาว่ามาจาก OA ไหนจากลายเซ็น, ค้นหาข้อความผู้ใช้ในตารางที่สร้างจาก `services/messageTable.js` แล้วตอบด้วย token ของ OA นั้น, (ออปชัน) ส่งต่ออีเวนต์ไปปลายทางภายนอก
- `services/channels.js` : อ่านรายชื่อ LINE OA จาก `.env`, หา OA ต้นทางจากลายเซ็น, ตรวจ token ตอนเปิดแอป
```

(c) In the `.env` code block under `## การตั้งค่าไฟล์ .env`, replace the lines from `# ค่าจาก LINE Developers` through `FORWARD_WEBHOOK_URL=https://your-api.example.com/line-webhook` (inclusive) with:

```dotenv
# ค่าจาก LINE Developers ของ OA แรก (บังคับ)
LINE_CHANNEL_TOKEN=YOUR_LINE_CHANNEL_ACCESS_TOKEN
LINE_CHANNEL_SECRET=YOUR_LINE_CHANNEL_SECRET
# ชื่อที่ใช้ใน log (ไม่บังคับ ค่าเริ่มต้น "OA 1")
LINE_CHANNEL_NAME=

# LINE OA เพิ่มเติม (ออปชัน): ใช้เลขต่อท้ายตั้งแต่ _2 ขึ้นไป token กับ secret ต้องมาคู่กัน
LINE_CHANNEL_TOKEN_2=
LINE_CHANNEL_SECRET_2=
LINE_CHANNEL_NAME_2=

# ส่งต่ออีเวนต์ของ OA แรกไปยังปลายทางภายนอก (ออปชัน)
# เมื่อตั้งค่าเป็น "true" และกำหนด URL ระบบจะส่งต่อ req.body ไปยัง URL ดังกล่าว
FORWARD_WEBHOOK_URL_PROCESS=false
FORWARD_WEBHOOK_URL=https://your-api.example.com/line-webhook
# ส่งต่ออีเวนต์ของ OA เพิ่มเติม: ใส่ URL = ส่งต่อ, เว้นว่าง = ไม่ส่งต่อ
FORWARD_WEBHOOK_URL_2=
```

(d) Directly after the line that starts with `หมายเหตุ: ในโค้ดจะตรวจ`, add:

```markdown

หาก `.env` ตั้งค่า LINE OA ไม่ถูกต้อง (เช่น มี token แต่ไม่มี secret, เลขต่อท้ายเป็น `_1`, หรือ secret ซ้ำกันสองบัญชี) แอปจะไม่เปิดและแจ้งชื่อตัวแปรที่ผิด
```

(e) Replace the line that contains `line.middleware` (it starts with `หมายเหตุ: เส้นทาง`) with:

```markdown
หมายเหตุ: เส้นทาง `/webhook` ตรวจลายเซ็นใน HTTP Header `X-Line-Signature` กับ channel secret ของทุก OA ที่ตั้งค่าไว้ คำขอที่ลายเซ็นไม่ตรงกับ OA ใดจะได้ `401` ดังนั้นการทดสอบด้วย `curl` จำเป็นต้องมีลายเซ็นที่ถูกต้อง แนะนำให้ทดสอบผ่านปุ่ม Verify ใน LINE Developers หรือส่งข้อความจริงจาก OA

## ใช้หลาย LINE OA กับแอปเดียว

แอปเดียวเป็น webhook ให้ LINE OA ได้หลายบัญชี ทุกบัญชีใช้ Webhook URL เดียวกัน และตอบเนื้อหาชุดเดียวกันจาก `data/*.json` (แก้ในหน้า Admin ครั้งเดียวมีผลทุกบัญชี) แอปรู้ว่าอีเวนต์มาจากบัญชีไหนจากลายเซ็น แล้วตอบด้วย token ของบัญชีนั้น

วิธีเพิ่ม OA:
1. เพิ่ม `LINE_CHANNEL_TOKEN_<n>` และ `LINE_CHANNEL_SECRET_<n>` ใน `.env` ของเซิร์ฟเวอร์ (`<n>` เริ่มที่ 2) จะตั้ง `LINE_CHANNEL_NAME_<n>` เป็นชื่อที่ใช้ใน log ด้วยก็ได้
2. restart เซิร์ฟเวอร์ แล้วดู log ตอนเปิดแอปว่ามีบัญชีใหม่และ token ใช้ได้
3. ใน LINE Developers console ของ OA นั้น ใส่ Webhook URL เดียวกับ OA อื่น (`https://<your-domain>/webhook`) เปิด Use webhook แล้วกด Verify
4. ใน LINE Official Account Manager ของ OA นั้น เปิด Webhook ใน Response settings
5. สร้าง Rich Menu ของ OA นั้นให้ส่งข้อความ trigger ตรงกับ OA อื่นทุกตัวอักษร

OA ที่เพิ่มมาจะไม่ส่งต่ออีเวนต์ไประบบภายนอก จนกว่าจะตั้ง `FORWARD_WEBHOOK_URL_<n>`
```

(f) In `## Endpoints ที่มีให้ใช้งาน`, replace `(ต้องผ่านการตรวจลายเซ็น)` with `(ต้องผ่านการตรวจลายเซ็น ใช้ URL เดียวกันทุก OA)`.

(g) Under `## การส่งต่อ Webhook ไปยังระบบภายนอก (Forward)`, replace the line that starts with `ภายใน` and the two bullets below it with:

```markdown
การส่งต่อตั้งค่าแยกต่อ OA ใน `.env` (อ่านโดย `services/channels.js`)

- OA แรก: `FORWARD_WEBHOOK_URL_PROCESS` = "true" และมีค่า `FORWARD_WEBHOOK_URL` → ระบบจะส่งต่อ `req.body` ไปยังปลายทางด้วย `axios.post()` แบบ async (พร้อม ๆ กับการประมวลผลภายใน) หากไม่ต้องการส่งต่อ ให้ตั้ง `FORWARD_WEBHOOK_URL_PROCESS` เป็นค่าอื่น ๆ ที่ไม่ใช่ "true" หรือไม่กำหนดค่า
- OA เพิ่มเติม: ใส่ `FORWARD_WEBHOOK_URL_<n>` → ส่งต่ออีเวนต์ของ OA นั้นไป URL ดังกล่าว ถ้าไม่ใส่จะไม่ส่งต่อ (ไม่มีตัวแปร `_PROCESS` สำหรับ OA เพิ่มเติม)
```

(h) In `## ไลบรารีหลักที่ใช้งาน`, replace `และ middleware ตรวจลายเซ็น` with `และการตรวจลายเซ็น`.

- [ ] **Step 4: Verify the docs and the suite**

Run: `grep -c "line.middleware" CLAUDE.md README.md; grep -c "LINE_CHANNEL_TOKEN_" .env.example CLAUDE.md README.md; grep -n "84 tests" CLAUDE.md`
Expected: `CLAUDE.md:0` and `README.md:0` for the first command; a count of at least 1 for each of the three files in the second; one matching line in the third.

Run: `LINE_CHANNEL_TOKEN=x LINE_CHANNEL_SECRET=x node -e "require('dotenv').config({ path: '.env.example', override: false }); console.log(require('./services/channels').loadChannels(process.env).length)"`
Expected: `1` — the blank `_2` / `_3` entries in `.env.example` do not create accounts or errors.

Run: `npm test`
Expected: `# tests 84`, `# pass 84`, `# fail 0`.

- [ ] **Step 5: Commit**

```bash
git add .env.example CLAUDE.md README.md
git commit -m "docs: describe multi-OA webhook configuration" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
