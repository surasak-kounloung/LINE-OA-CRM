# Per-OA Follow-up Text Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the hard-coded `FOLLOW_UP_TEXT` sent after every service reply with text the chat team sets in `/backoffice`: a default, a per-OA override, and a per-OA-per-service override, where an empty value means "send nothing".

**Architecture:** A new pure module `services/followUps.js` owns the rules (resolve, validate, normalize, prune) and reads `data/followups.json` through the existing data store. `services/messageTable.js` keeps building one shared trigger table, tags service entries with their service id, and gains `getReply(trigger, channelId)`, which appends the resolved follow-up for that OA. The webhook and the admin preview both call `getReply`. A new admin router saves the default text and one OA at a time, and two new React pages edit them.

**Tech Stack:** Node.js + Express 4, `node --test` (no test framework), React 18 + Vite + react-router HashRouter in `admin/`.

**Spec:** `docs/superpowers/specs/2026-10-30-follow-up-text-design.md` (Thai, approved 2026-10-30). Read it before starting a task.

## Global Constraints

- No new dependencies in `package.json` or `admin/package.json`.
- Tests live in `test/*.test.js` and run with `npm test`. **Baseline: 192 tests, 190 pass.** The 2 failures in `test/builders.test.js` come from the user's uncommitted edits to `data/promotions.json` / `data/services.json` and are not this plan's to fix. After every task, the only failures must be those 2.
- Exact texts (copy byte-for-byte; the doctor emoji contains a zero-width joiner, so copy it from the current `services/messageTable.js:12`):
  - doctor: `👨‍⚕️ปรึกษาหมอได้เลย หมอตอบเองครับ`
  - staff/default: `✨ สนใจโปรโมชัน ทำนัดคิว หรือสอบถามข้อมูลเพิ่มเติม สามารถแจ้งได้เลยค่ะ`
- Max text length `5000` (LINE text message limit), measured with JS `string.length`.
- OA key = `channel.id` from `services/channels.js` (the `.env` number). Service key = service `id`, never `actionText`.
- Never return or log a channel token or secret. The OA list sent to the admin UI has `id` and `name` only.
- Never call `replyMessage` with an empty array.
- User-facing messages are Thai; code comments are Thai, matching the files around them.
- The working tree holds the user's unrelated uncommitted work (rich menu files, `data/*.json`, `CLAUDE.md`, `services/validate.js`, ...). **Stage files only by explicit path. Never `git add -A`, `git add .` or `git commit -a`.** Do not edit `services/validate.js` (it has uncommitted rich-menu changes); follow-up validation lives in `services/followUps.js`. `CLAUDE.md` is edited in Task 5 but left unstaged (see Task 5).
- Every commit message ends with:
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  ```

## Review Focus

1. **A branch whose `trigger` equals a service's `actionText`** — today the branch reply overwrites the service entry. That branch must keep replying with its map and icon table only, with no follow-up appended. Test in Task 2.
2. **Text with surrounding whitespace or Windows line endings** (`"\r\n  สวัสดี\nค่ะ  \n"`) — store `"สวัสดี\nค่ะ"`. Inner newlines are kept, and whitespace-only text becomes `""` (don't send). Tests in Task 1 and Task 3.
3. **An OA that was removed from `.env` but still has an entry in the file** (e.g. `"99"`) — it isn't listed in the UI, saving another OA keeps that entry, and `PUT /followups/channels/99` returns 404. Test in Task 3.
4. **A hand-edited `followups.json` with the wrong shape** (valid JSON but `defaultText: 5`) — the bot replies without a follow-up and logs once, and the admin API refuses to save over the file. Tests in Task 2 and Task 3.
5. **OA ids in the URL that only look like ids** (`/channels/01`, `/channels/abc`, `?channel=9`) — these return 404, never an entry saved under a key like `"01"`. Test in Task 3.

---

### Task 1: Follow-up rules module

**Files:**
- Create: `services/followUps.js`
- Test: `test/followUps.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces (all exported from `services/followUps.js`):
  - `MAX_FOLLOW_UP_LENGTH = 5000`
  - `resolveFollowUpText(followUps: {defaultText, channels}, channelId: number|string|null, serviceId: string) -> string | null`: service value, else OA `text`, else `defaultText`. Picks the first level whose key exists, even when its value is `""`. A chosen value that is empty after `trim()` returns `null`. A missing OA, a missing service or a `null` channelId falls through to the next level.
  - `validateFollowUpText(value: unknown, path: string) -> {path, message}[]`: the value must be a string of at most 5000 characters.
  - `validateFollowUpEntry(entry: unknown, prefix = "") -> {path, message}[]`: `entry` is a plain object. `text` is undefined or a valid text. `services` is undefined or a plain object whose values are valid texts. Paths: `${prefix}text`, `${prefix}services`, `${prefix}services.<id>`, and `prefix` without its trailing dot (or `""`) when the root has the wrong type.
  - `validateFollowUps(value: unknown) -> {path, message}[]`: checks the whole file. Root object, `defaultText` text, `channels` plain object. Each key must match `/^[1-9]\d*$/`; a bad key reports path `channels.<key>` and its entry is not checked further. Each entry under a good key is checked with prefix `channels.<key>.`.
  - `normalizeFollowUpEntry(entry, serviceIds: string[]) -> {text?, services?} | null`: run after the entry validates. Trims every value, drops service ids not in `serviceIds`, omits `services` when it is empty, and returns `null` when neither `text` nor `services` is left.
  - `pruneServices(followUps, serviceIds: string[]) -> followUps`: returns a new object with the same `defaultText`. Drops service ids not in `serviceIds` from every OA, and drops entries that become empty. Never mutates its input.

Thai messages: `"ต้องเป็นข้อความ"`, `` `ยาวได้ไม่เกิน ${MAX_FOLLOW_UP_LENGTH} ตัวอักษร` ``, `"รูปแบบไม่ถูกต้อง"`, `"เลข OA ต้องเป็นจำนวนเต็มตั้งแต่ 1 ขึ้นไป ไม่มีศูนย์นำหน้า"`.

- [ ] **Step 1: Commit the spec and this plan** (they are untracked)

```bash
git add docs/superpowers/specs/2026-10-30-follow-up-text-design.md docs/superpowers/plans/2026-10-30-follow-up-text.md
git commit -m "$(printf 'docs: design spec and plan for per-OA follow-up text\n\nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>')"
```

- [ ] **Step 2: Write the failing tests** in `test/followUps.test.js`

```js
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
    ["channels.01", "channels.0", "channels.x"],
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
```

- [ ] **Step 3: Run it and confirm it fails**

Run: `node --test test/followUps.test.js`
Expected: FAIL with `Cannot find module '../services/followUps'`

- [ ] **Step 4: Implement `services/followUps.js`** with the exports and signatures listed under Interfaces, in CommonJS, with a Thai header comment that summarizes the 3-level rule from spec §3.

- [ ] **Step 5: Run the tests**

Run: `node --test test/followUps.test.js` → all pass. Then `npm test` → only the 2 known `builders.test.js` failures.

- [ ] **Step 6: Commit**

```bash
git add services/followUps.js test/followUps.test.js
git commit -m "$(printf 'feat: follow-up text rules (resolve, validate, normalize, prune)\n\nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>')"
```

---

### Task 2: The bot sends each OA its own follow-up

**Files:**
- Create: `data/followups.json`
- Modify: `services/dataStore.js:10` (`EXTRA_NAMES`)
- Modify: `services/followUps.js` (add `readFollowUps`)
- Modify: `services/messageTable.js` (remove `FOLLOW_UP_TEXT`, tag service entries, add `getReply`)
- Modify: `routes/chatRoute.js` (`handleEvent`)
- Test: `test/messageTable.test.js`, `test/chatRoute.test.js`, `test/followUps.test.js`

**Interfaces:**
- Consumes: `resolveFollowUpText`, `validateFollowUps` (Task 1).
- Produces:
  - `readFollowUps(store) -> { value: object|null, problem: string|null }` in `services/followUps.js`. Reads `store.get("followups")`; a throw gives problem `"ไฟล์ data/followups.json ไม่มี หรือไม่ใช่ JSON ที่ถูกต้อง"`. A file that fails `validateFollowUps` gives `` `ข้อมูลใน data/followups.json ไม่ถูกต้อง (${path || "รูปแบบ"}: ${message})` `` for the first error. The problem text never contains a filesystem path beyond `data/followups.json`.
  - `serviceIdOf(messages: Message[]) -> string | undefined` exported from `services/messageTable.js`. `build()` registers each service's reply array in a module-level `WeakMap` (array → service id). An entry that a later branch overwrites is therefore untagged.
  - `build(data)` is unchanged in signature. A service entry is now `[priceCarousel]` when it has price images, or `[]` when it doesn't. The trigger still exists either way, because `/triggers` must keep listing it.
  - `createMessageTable(store, { logError }) -> { getTable, rebuild, getReply }`. `getReply(trigger: string, channelId: number|string|null) -> Message[] | null`:
    1. look up the table entry
    2. if `serviceIdOf(entry)` is set and `readFollowUps(store)` has no problem, append `{ type: "text", text }` when `resolveFollowUpText` returns text
    3. return `null` for an unknown trigger or an empty result

    On a problem, call `logError` only when the problem string differs from the last one logged, and reset that memory after a successful read. Log line: `` `ข้อความต่อท้าย: ${problem} — บอทตอบโดยไม่มีข้อความต่อท้ายจนกว่าจะแก้ไฟล์` ``. `createMessageTable` must not call `store.get` at construction, because the existing rebuild test passes a store that has only `getAll` and `onChange`.
  - `routes/chatRoute.js` `handleEvent` calls `messageTable.getReply(event.message.text, channel.id)` and returns without replying when it gets `null`.

- [ ] **Step 1: Write the failing tests**

In `test/messageTable.test.js`:
- Import `serviceIdOf` instead of `FOLLOW_UP_TEXT`, and add `const fs = require("fs"); const os = require("os");`.
- Replace the test `"service with price images replies carousel + follow-up; without replies follow-up only"` with the tests below.
- Keep every other test unchanged.

```js
const DOCTOR = "👨‍⚕️ปรึกษาหมอได้เลย หมอตอบเองครับ";
const STAFF = "✨ สนใจโปรโมชัน ทำนัดคิว หรือสอบถามข้อมูลเพิ่มเติม สามารถแจ้งได้เลยค่ะ";
const seedFollowUps = { defaultText: STAFF, channels: { "1": { text: DOCTOR }, "4": { text: "" } } };

// store จริงบนโฟลเดอร์ชั่วคราว: followups = object | สตริงดิบ | undefined (ไม่มีไฟล์)
function storeWith(followups, over = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "vsq-mt-"));
  for (const [name, value] of Object.entries(data(over))) fs.writeFileSync(path.join(dir, `${name}.json`), JSON.stringify(value));
  if (followups !== undefined) {
    fs.writeFileSync(path.join(dir, "followups.json"), typeof followups === "string" ? followups : JSON.stringify(followups));
  }
  return createDataStore(dir);
}

test("build: a service entry holds only its price carousel (or nothing) and is tagged with its service id", () => {
  const t = build(data());
  const withImages = t.get("สอบถามบริการ");
  assert.equal(withImages.length, 1);
  assert.equal(withImages[0].altText, "สอบถามบริการ");
  assert.equal(serviceIdOf(withImages), "s");
  assert.deepEqual(t.get("สอบถามอื่น"), []);
  assert.equal(serviceIdOf(t.get("สอบถามอื่น")), "o");
  assert.equal(serviceIdOf(t.get("สยาม")), undefined);
});

test("getReply: each OA gets its own follow-up after the price carousel", () => {
  const mt = createMessageTable(storeWith(seedFollowUps));
  const main = mt.getReply("สอบถามบริการ", 1);
  assert.equal(main.length, 2);
  assert.equal(main[0].type, "flex");
  assert.deepEqual(main[1], { type: "text", text: DOCTOR });
  assert.deepEqual(mt.getReply("สอบถามบริการ", 2)[1], { type: "text", text: STAFF });
  assert.equal(mt.getReply("สอบถามบริการ", 4).length, 1);
});

test("getReply: a service without price images answers with the follow-up only, or not at all", () => {
  const mt = createMessageTable(storeWith(seedFollowUps));
  assert.deepEqual(mt.getReply("สอบถามอื่น", 2), [{ type: "text", text: STAFF }]);
  assert.equal(mt.getReply("สอบถามอื่น", 4), null);
});

test("getReply: non-service triggers are unchanged; unknown text is null", () => {
  const mt = createMessageTable(storeWith(seedFollowUps));
  assert.deepEqual(mt.getReply("สยาม", 1), mt.getTable().get("สยาม"));
  assert.equal(mt.getReply("ไม่มี", 1), null);
});

test("getReply: a save to followups applies to the next reply", () => {
  const store = storeWith(seedFollowUps);
  const mt = createMessageTable(store);
  store.set("followups", { defaultText: "ใหม่", channels: {} });
  assert.deepEqual(mt.getReply("สอบถามบริการ", 1)[1], { type: "text", text: "ใหม่" });
});

test("getReply: missing, broken or invalid followups.json → no follow-up, logged once", () => {
  for (const followups of [undefined, "{not json", { defaultText: 5, channels: {} }]) {
    const logs = [];
    const mt = createMessageTable(storeWith(followups), { logError: (m) => logs.push(m) });
    assert.equal(mt.getReply("สอบถามบริการ", 1).length, 1);
    assert.equal(mt.getReply("สอบถามอื่น", 1), null);
    assert.equal(mt.getReply("สอบถามบริการ", 2).length, 1);
    assert.equal(logs.length, 1);
  }
});

test("getReply: a branch whose trigger equals a service actionText gets no follow-up", () => {
  const mt = createMessageTable(storeWith(seedFollowUps, { branches: [branch({ trigger: "สอบถามบริการ" })] }));
  const reply = mt.getReply("สอบถามบริการ", 1);
  assert.equal(reply.length, 2);
  assert.ok(reply.every((m) => m.type === "flex"));
});
```

Append to `test/followUps.test.js`:

```js
test("data/followups.json in the repo is valid: Main gets the doctor text, every other OA the staff text", () => {
  const value = require("../data/followups.json");
  assert.deepEqual(validateFollowUps(value), []);
  assert.equal(resolveFollowUpText(value, 1, "botox"), DOCTOR);
  assert.equal(resolveFollowUpText(value, 2, "botox"), STAFF);
  assert.equal(resolveFollowUpText(value, 32, "service-other"), STAFF);
});
```

In `test/chatRoute.test.js`:
- Replace line 10 with `const messageTable = { getReply: (text) => (text === TRIGGER ? REPLY : null) };`.
- Add:

```js
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
```

- [ ] **Step 2: Run them and confirm they fail**

Run: `node --test test/messageTable.test.js test/chatRoute.test.js test/followUps.test.js`
Expected: FAIL. `serviceIdOf` / `getReply` are not functions, and `data/followups.json` is not found.

- [ ] **Step 3: Create `data/followups.json`** with exactly this content (2-space JSON plus a trailing newline, like the data store writes):

```json
{
  "defaultText": "✨ สนใจโปรโมชัน ทำนัดคิว หรือสอบถามข้อมูลเพิ่มเติม สามารถแจ้งได้เลยค่ะ",
  "channels": {
    "1": {
      "text": "👨‍⚕️ปรึกษาหมอได้เลย หมอตอบเองครับ"
    }
  }
}
```

- [ ] **Step 4: Implement** `EXTRA_NAMES = ["richmenu", "followups"]`, `readFollowUps`, the `messageTable.js` changes and the `chatRoute.js` change, exactly as described under Interfaces. Delete `FOLLOW_UP_TEXT` and remove it from `module.exports`. Keep `createTextMessage`: `getReply` uses it to build the appended follow-up.

- [ ] **Step 5: Run the tests**

Run: `node --test test/messageTable.test.js test/chatRoute.test.js test/followUps.test.js` → all pass. `npm test` → only the 2 known failures. `git diff --stat test/fixtures/` → empty (the fixture must not change).

- [ ] **Step 6: Commit**

```bash
git add data/followups.json services/dataStore.js services/followUps.js services/messageTable.js routes/chatRoute.js test/messageTable.test.js test/chatRoute.test.js test/followUps.test.js
git commit -m "$(printf 'feat: send each LINE OA its own follow-up text after service replies\n\nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>')"
```

---

### Task 3: Admin API for follow-up texts, service cleanup, per-OA preview

**Files:**
- Create: `routes/followUpRoute.js`
- Modify: `services/followUps.js` (add `pruneStoredFollowUps`)
- Modify: `routes/adminRoute.js` (mount the router, prune after a services save, preview by OA)
- Test: `test/followUpRoute.test.js`

**Interfaces:**
- Consumes: `readFollowUps`, `validateFollowUpText`, `validateFollowUpEntry`, `normalizeFollowUpEntry`, `pruneServices` (Tasks 1–2), and `messageTable.getReply` (Task 2).
- Produces:
  - `createFollowUpRouter({ store, channels }) -> express.Router` in `routes/followUpRoute.js`, mounted by `adminRoute.js` at `/followups` after `requireAdmin` (next to the richmenu mount). All responses below are the same "view": `{ defaultText, channels, oas: [{ id, name }] }`. Here `channels` is the file's raw map, and `oas` lists the loaded OAs in `.env` order.
    - `GET /`: the view. If `readFollowUps` reports a problem, 500 `{ error: problem }`.
    - `PUT /default` body `{ text }`: errors from `validateFollowUpText(body.text, "text")` give 400 `{ error: "ข้อมูลไม่ถูกต้อง", errors }`. A problem with the current file gives 500 `{ error: problem }`, and the file is not written. Otherwise store `defaultText = text.trim()` and keep `channels`.
    - `PUT /channels/:id`: if no loaded channel has `String(channel.id) === req.params.id`, 404 `{ error: "ไม่พบ LINE OA นี้ในรายการที่โหลดจาก .env" }`. Errors from `validateFollowUpEntry(body)` give 400. A file problem gives 500 with no write. Otherwise `normalizeFollowUpEntry(body, ids of store.get("services"))`, then set or delete that one key (delete on `null`) and leave every other key untouched.
    - Writes go through `store.set("followups", next)`. A throw from the write gives 500 `{ error: "บันทึกไฟล์ไม่สำเร็จ" }`, the same wording as `adminRoute.js`.
  - `pruneStoredFollowUps(store, serviceIds: string[], { logError = console.error } = {}) -> void` in `services/followUps.js`. On a file problem it logs `` `ข้อความต่อท้าย: ข้ามการล้างค่าของบริการที่ถูกลบ เพราะ ${problem}` `` and returns. Otherwise it writes `pruneServices(...)` only when the result differs. It never throws: a write error is logged.
  - `adminRoute.js`: after a successful `PUT /services` save, call `pruneStoredFollowUps(store, req.body.map((s) => s.id))`.
  - `adminRoute.js` `GET /preview/:trigger`:
    - unknown trigger → 404 `"ไม่พบ trigger นี้"` (unchanged)
    - with `?channel=`, no loaded channel whose `String(id)` matches → 404 `"ไม่พบ LINE OA นี้"`
    - otherwise use that channel, or the first loaded channel when there is no query, or `null` when no channels are loaded; `getReply(trigger, id)` returning `null` → 404 `"LINE OA นี้ไม่ตอบ trigger นี้ (ไม่มีรูปราคา และตั้งข้อความต่อท้ายเป็นไม่ส่ง)"`
    - else 200 with the messages

- [ ] **Step 1: Write the failing tests** in `test/followUpRoute.test.js`

```js
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
  app.use("/api/admin", createAdminRouter({ store, messageTable: createMessageTable(store), channels, loginFailureDelayMs: 0 }));
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
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `node --test test/followUpRoute.test.js`
Expected: FAIL. `/followups` answers 404 (no route yet) and the preview has no follow-up.

- [ ] **Step 3: Implement** `routes/followUpRoute.js`, `pruneStoredFollowUps` and the three `adminRoute.js` changes as specified under Interfaces. Add a Thai header comment to the new route file in the style of `routes/richMenuRoute.js:1-2`.

- [ ] **Step 4: Run the tests**

Run: `node --test test/followUpRoute.test.js test/adminRoute.test.js` → all pass (the existing preview test in `adminRoute.test.js` must still pass unchanged). `npm test` → only the 2 known failures.

- [ ] **Step 5: Commit**

```bash
git add routes/followUpRoute.js routes/adminRoute.js services/followUps.js test/followUpRoute.test.js
git commit -m "$(printf 'feat: admin API to edit follow-up texts per OA, clean up removed services, preview per OA\n\nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>')"
```

---

### Task 4: Admin pages "ข้อความต่อท้าย"

**Files:**
- Create: `admin/src/followUps.js`
- Create: `admin/src/components/FollowUpField.jsx`
- Create: `admin/src/pages/FollowUpsPage.jsx`
- Create: `admin/src/pages/FollowUpEditPage.jsx`
- Modify: `admin/src/App.jsx`, `admin/src/components/Layout.jsx`, `admin/src/styles.css`, `admin/src/pages/ServiceEditPage.jsx:41,50`, `admin/src/pages/ServicesPage.jsx:52`

**Interfaces:**
- Consumes: `GET /followups`, `PUT /followups/default`, `PUT /followups/channels/:id` (Task 3), `GET /services`, and the existing `api`, `setDirty`, `PageHeader`, `UnsavedBar`, `FieldError`.
- Produces (`admin/src/followUps.js`, ESM; the client copy of the rule, with a comment pointing to `services/followUps.js`):
  - `fieldFrom(value: string|undefined) -> { mode: "inherit"|"custom"|"none", text: string }`: `undefined` → inherit, a string that is empty after trim → none, anything else → custom.
  - `valueFrom(field) -> string|undefined`: inherit → `undefined`, none → `""`, custom → `field.text`.
  - `resolveFollowUp(defaultText: string, oaValue: string|undefined, serviceValue: string|undefined) -> string|null`: the same rule as the server, taking the values directly.
  - `FollowUpField({ field, onChange, inheritLabel, effective, noReply, errors, path })`: renders three buttons — `inheritLabel` / `"ตั้งข้อความเอง"` / `"ไม่ส่ง"` — and a `<textarea>` when the mode is custom. Below them is the effective box:
    - `effective` is text → green `"บอทส่ง: " + effective`
    - `null` with `noReply` → red `"บอทไม่ตอบปุ่มนี้ใน OA นี้"`
    - otherwise → red `"บอทไม่ส่งข้อความนี้"`

    Then `<FieldError errors={errors} path={path} />`.

Page behaviour (spec §8; screen layout A, the one the user picked):
- `#/followups` (`FollowUpsPage`):
  - Card `"ข้อความตั้งต้น"` with hint `"ใช้กับ OA ที่ยังไม่ได้ตั้ง และ OA ใหม่ที่เพิ่มภายหลัง"`, a textarea, and its own save button that calls `PUT /followups/default`. While that text differs from the saved one, call `setDirty(true)` and register `beforeunload`, as `useResource` does.
  - Search box filtering by name or number.
  - Table with columns `LINE OA` (number + name, linking to `/followups/<id>`), `ข้อความของ OA` (badge `ใช้ค่าตั้งต้น` / `ตั้งเอง` plus the first ~40 characters / `ไม่ส่ง`) and `บริการที่ตั้งแยก` (count of keys in `services`, or `—`).
  - Note under the table: `"เลข OA มาจาก .env (LINE_CHANNEL_*_<เลข>) ห้ามสลับเลข ไม่อย่างนั้นข้อความจะไปอยู่กับสาขาอื่น"`.
  - On a load error, show the API's `error` in `.field-error`.
- `#/followups/:id` (`FollowUpEditPage`):
  - Loads `/followups` and `/services`. If the id is not in `oas`, show `"ไม่พบ LINE OA นี้"` with a link back.
  - Breadcrumb `ข้อความต่อท้าย / <name> (OA <id>)`.
  - Card `"ข้อความของ OA นี้ (ทุกบริการ)"` with a `FollowUpField` whose `inheritLabel` is `"ใช้ข้อความตั้งต้น"`.
  - Card `"แยกตามบริการ"` with one row per service in `services.json` order (title), each holding a `FollowUpField` with `inheritLabel="ใช้ของ OA"` and `noReply` when the service has no price images.
  - Effective text is computed live from the draft with `resolveFollowUp`. A custom field with blank text counts as none.
  - `UnsavedBar` gets `{ dirty, save, reset, status, message }`. Save sends `{ text: valueFrom(oa), services: { id: valueFrom(f) for fields not inherit } }`, omitting `text` when it is inherit.
  - Server errors (paths `text`, `services.<id>`) show under the matching field. Dirty guard as above.
- `App.jsx`: `<Route path="/followups" element={<Private><FollowUpsPage /></Private>} />` and `/followups/:id` the same way.
- `Layout.jsx`: append `["/followups", "ข้อความต่อท้าย", icons.message]` after Rich Menu, with a speech-bubble SVG in the same stroke style as the other icons.
- `styles.css`: add `.mode-picker` (a segmented button group, active button uses `--primary`) and `.effective` / `.effective.none` (green and red soft boxes, reusing the `.badge.ok` / `.badge` colours).
- `ServiceEditPage.jsx`:
  - line 50 notice → `ไม่มีรูปราคา: เมื่อลูกค้ากดปุ่ม บอทจะตอบเฉพาะข้อความต่อท้ายของ LINE OA นั้น (ตั้งในหน้า "ข้อความต่อท้าย") — OA ที่ตั้งเป็น "ไม่ส่ง" จะไม่ตอบปุ่มนี้`
  - line 41 id hint → `ตัวพิมพ์เล็ก a-z, 0-9 และ - เท่านั้น ห้ามซ้ำ · เปลี่ยน id แล้วข้อความต่อท้ายที่ตั้งแยกให้บริการนี้จะถูกล้าง`
- `ServicesPage.jsx:52` badge → `ตอบข้อความต่อท้ายอย่างเดียว`.

- [ ] **Step 1: Implement the files above.**

- [ ] **Step 2: Build**

Run: `npm run admin:build`
Expected: Vite prints `✓ built in …` with no errors or warnings about unresolved imports.

- [ ] **Step 3: Manual check** (not automated; the admin UI has no test harness)

Start the server with throwaway credentials. Variables set in the shell win over `.env`:

```bash
PORT=8097 ADMIN_PASSWORD=pw LINE_CHANNEL_NAME=Main LINE_CHANNEL_TOKEN=t1 LINE_CHANNEL_SECRET=s1 \
LINE_CHANNEL_NAME_2="Siam Square One" LINE_CHANNEL_TOKEN_2=t2 LINE_CHANNEL_SECRET_2=s2 node index.js
```

Then open `http://localhost:8097/backoffice/#/followups` (password `pw`) and check:
1. "ข้อความต่อท้าย" appears in the sidebar after Rich Menu.
2. Main shows `ตั้งเอง 👨‍⚕️ปรึกษาหมอ…`, and the other OAs show `ใช้ค่าตั้งต้น`.
3. In Main, set "ฉีด โบท็อกซ์" to "ไม่ส่ง": its box turns red. Set "หัตถการอื่นๆ" (no price images) to "ไม่ส่ง": it reads "บอทไม่ตอบปุ่มนี้ใน OA นี้".
4. Pick "ตั้งข้อความเอง", leave it empty, and save. After reload the field shows "ไม่ส่ง".
5. Type 5001 characters and save: the error shows under that field.
6. Leaving the page with unsaved changes asks for confirmation.

Stop the server. Then restore the data file: `git checkout -- data/followups.json`.

- [ ] **Step 4: Commit**

```bash
git add admin/src/followUps.js admin/src/components/FollowUpField.jsx admin/src/pages/FollowUpsPage.jsx admin/src/pages/FollowUpEditPage.jsx admin/src/App.jsx admin/src/components/Layout.jsx admin/src/styles.css admin/src/pages/ServiceEditPage.jsx admin/src/pages/ServicesPage.jsx
git commit -m "$(printf 'feat(admin): pages to edit follow-up text per LINE OA and per service\n\nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>')"
```

---

### Task 5: Documentation

**Files:**
- Modify: `README.md` (sections "ใช้หลาย LINE OA กับแอปเดียว", "Endpoints ที่มีให้ใช้งาน", "หน้า Admin")
- Modify: `CLAUDE.md` (**edit, but do not stage** — it already has the user's uncommitted rich-menu edits)

**Interfaces:** none.

- [ ] **Step 1: README.md**
  - Endpoints: add `GET /api/admin/followups`, `PUT /api/admin/followups/default`, `PUT /api/admin/followups/channels/:id`. The preview line gains `?channel=<เลข OA>` ("ไม่ใส่ = OA แรก").
  - Multi-OA section: a new OA uses the default follow-up text until someone sets one. Never renumber OAs in `.env`.
  - Add a short "ข้อความต่อท้ายบริการ" subsection under หน้า Admin with the three levels and "ว่าง = ไม่ส่ง".
- [ ] **Step 2: CLAUDE.md**
  - `data/*.json` bullet: add `followups.json`.
  - `services/messageTable.js` bullet: service entries hold the price carousel only (`[]` without images) and are tagged via `serviceIdOf`. `getReply(trigger, channelId)` appends the OA's follow-up and returns `null` instead of `[]`.
  - `routes/chatRoute.js` bullet: uses `getReply`.
  - Admin API bullet: the `/followups` routes and `preview?channel=`.
  - New bullet for `services/followUps.js`.
  - "Adding or changing content": replace "a service with an empty `priceImages` array replies with the follow-up text only" with the per-OA rule.
  - "Adding a LINE OA": a new OA gets the default follow-up text, and OA numbers must not be renumbered.
  - Deploying: `data/followups.json` follows the same live-edit cautions.
  - Tests: update the test count to what `npm test` prints and list the new test files.
- [ ] **Step 3: Verify**

Run: `npm test` → only the 2 known failures. `git status --short CLAUDE.md` → ` M CLAUDE.md` (still unstaged).

- [ ] **Step 4: Commit README only**

```bash
git add README.md
git commit -m "$(printf 'docs: follow-up text per LINE OA in README\n\nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>')"
```

Report to the user that the `CLAUDE.md` changes are left unstaged on purpose, because that file also holds their own uncommitted edits.
