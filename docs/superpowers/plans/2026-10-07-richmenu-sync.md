# Rich Menu Backoffice Page and Sync (Phase 2A) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the team edit one Rich Menu set in `/backoffice` and sync it to every LINE OA, without unlinking customers from their per-user menu when a menu changes.

**Architecture:** The menu set lives in `data/richmenu.json` (shared tap areas plus one image URL per membership level). A pure module (`services/richMenuPlan.js`) names each menu on LINE `vsq|<key>|<hash>`, points a stable alias `vsq-<key>` at it, and compares LINE's real state with the file. `services/richMenuSync.js` converges one OA to the file through a small LINE interface (`services/lineRichMenuApi.js` in production, an in-memory fake in tests); it keeps no state of its own, so a failed run is simply repeated. `routes/richMenuRoute.js` exposes data, per-OA status and per-OA sync under `/api/admin/richmenu`, and a new React page drives it.

**Tech Stack:** Node 20 (built-in `node --test`, `crypto`, `fetch`, `Blob`, `AbortSignal.timeout`), Express 4, `@line/bot-sdk` 9.4.1 (`messagingApi.MessagingApiClient`, `MessagingApiBlobClient`), Vite 5 + React 18.

**Spec:** `docs/superpowers/specs/2026-10-07-richmenu-sync-design.md`

## Global Constraints

- Node `v20.11.0`. Windows host; run commands in Git Bash from the repo root.
- **No new npm dependencies**, server or admin. Tests use `node --test` only (`npm test`).
- The 94 existing tests must keep passing. Final total: **168**.
- **Never send a write command to real LINE** while implementing (create/upload/alias/batch/default/delete). The user tries the write path on staging. Read-only calls against the test OA are allowed: list menus, list aliases, get default, validate.
- Never read or print the values in the local `.env`. Smoke steps override what they need with shell variables.
- Names on LINE, verbatim: menu name `vsq|<key>|<hash>` where `<hash>` is the first 16 hex characters of a SHA-256; alias `vsq-<key>`. A menu whose name does not match `^vsq\|[a-z0-9-]{1,20}\|[0-9a-f]{16}$` belongs to another system.
- The app never deletes, changes, or moves users off a menu of another system. An OA that has one is `blocked` and receives no write command.
- A menu is deleted only after LINE reports that its users were moved (`succeeded`), and the default menu is set before any old menu is deleted.
- At most one "move linked users" batch request per OA per sync, and none when there is nothing to move.
- Image rules: JPEG or PNG by content, at most 1,048,576 bytes, width 800–2500, height at least 250, width/height at least 1.45 and within 1% of the menu's `size` proportions. The image does **not** have to equal `size` (the clinic's real artwork is 1200x810 for a 2500x1686 menu). Only `https://` URLs; never `localhost` or an IP address.
- Validation error shape: `{ path, message }`, `path` relative to the root object, e.g. `areas[1].action.text`, `menus[2].image`, `chatBarText`.
- Test helpers live in `test-helpers/`, **not** in `test/`: `node --test` runs every `.js` file under `test/` as a test file.
- Code style of the repo: CommonJS on the server, 2-space indent, double quotes, semicolons, Thai comments at the same density as neighbouring files. Admin UI copy is Thai.
- Work on branch `feat/richmenu-sync`. Every commit message ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Out of scope (phase 2B, separate spec): an API for the CRM to report a member's level, per-user linking, syncing the original OA, changes to the CRM project.

## Review Focus

Inputs the spec implies but does not list as tests. Each has a test in the task that owns the code.

1. **Artwork smaller than the menu size.** The clinic's real images are 1200x810 for a 2500x1686 menu and LINE accepts them; rejecting them would block the first save. → Task 2 ("accepts a smaller image with the menu's proportions…").
2. **A URL that answers 200 with something that is not a JPEG or PNG** — an HTML error page, or a WebP that a CDN substitutes. It must be rejected by content, not trusted by extension or `Content-Type`. → Task 2 ("rejects anything that is not a JPEG or PNG", "rejects a response that is not an image…").
3. **A sync that fails halfway, at any single command, then is run again.** No customer may lose their menu and the OA may never be left without a default menu. → Task 5 ("a failure at any step is recovered by syncing again…").
4. **LINE still moving users when the wait runs out, or reporting failure.** Old menus must stay until a later sync confirms the move. → Task 5 ("old menus are kept while LINE has not finished…").
5. **Two sync requests at once** (a double click, or two admins). The second must be refused and the lock must be free again afterwards, including after a failed sync. → Task 6 ("only one sync runs at a time…").

---

## File Structure

| Path | Responsibility |
|---|---|
| `data/richmenu.json` (new) | The menu set; seeded with the four tap areas of today's menus and no menus |
| `services/dataStore.js` (modify) | Knows `richmenu` without adding it to `getAll()` |
| `services/validate.js` (modify) | `validateRichMenu`, `normalizeRichMenu` |
| `services/imageInfo.js` (new) | Format and dimensions of a JPEG/PNG from its bytes |
| `services/richMenuImages.js` (new) | Fetch an image URL and check it against LINE's rules |
| `services/richMenuPlan.js` (new) | Pure: names, hash, LINE menu object, status of one OA |
| `services/lineRichMenuApi.js` (new) | Thin adapter over the SDK for one OA; `describeLineError` |
| `services/richMenuSync.js` (new) | Converges one OA to the menu set |
| `routes/richMenuRoute.js` (new) | `/api/admin/richmenu` routes |
| `routes/adminRoute.js`, `index.js` (modify) | Mount the routes and pass the OA list |
| `test-helpers/imageBytes.js`, `test-helpers/fakeLineRichMenuApi.js` (new) | Fake image files and an in-memory LINE for tests |
| `admin/src/pages/RichMenuPage.jsx`, `admin/src/components/RichMenuAreas.jsx`, `admin/src/components/RichMenuStatus.jsx` (new) | The page |
| `admin/src/App.jsx`, `admin/src/components/Layout.jsx`, `admin/src/styles.css` (modify) | Route, sidebar link, styles |
| `CLAUDE.md`, `README.md` (modify) | Documentation |

---

### Task 1: Menu set data, store support and validation

**Files:**
- Create: `data/richmenu.json`
- Modify: `services/dataStore.js`, `services/validate.js`
- Test: `test/dataStore.test.js`, `test/validate.test.js`

**Interfaces:**
- Consumes: `createDataStore(dir)` → `{ get, set, getAll, onChange }` and the helpers already in `services/validate.js` (`isObject`, `isNonEmpty`, `checkBool`).
- Produces:
  - `store.get("richmenu")` / `store.set("richmenu", value)`; `store.getAll()` still returns only the four content files.
  - `validateRichMenu(value)` → `[{ path, message }]` (empty when valid).
  - `normalizeRichMenu(value)` → a copy with only the known fields; call it only after validation passed.
  - Definition shape: `{ size: { width, height }, chatBarText, selected, areas: [{ x, y, width, height, action: { type: "message", text } | { type: "uri", uri } }], menus: [{ key, label, image, isDefault }] }`.

- [ ] **Step 1: Write the failing tests**

Append to the end of `test/dataStore.test.js`:

```js
test("richmenu is read, written and backed up like the other files", () => {
  const dir = tmpDir();
  fs.writeFileSync(path.join(dir, "richmenu.json"), JSON.stringify({ menus: [] }));
  const store = createDataStore(dir);
  assert.deepEqual(store.get("richmenu"), { menus: [] });
  store.set("richmenu", { menus: [{ key: "gold" }] });
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(dir, "richmenu.json"), "utf8")), { menus: [{ key: "gold" }] });
  assert.deepEqual(store.get("richmenu"), { menus: [{ key: "gold" }] });
  assert.equal(fs.readdirSync(path.join(dir, "backup")).filter((f) => f.startsWith("richmenu.")).length, 1);
});

test("getAll leaves richmenu out, so the trigger table never depends on it", () => {
  // tmpDir() ไม่มี richmenu.json: getAll() ต้องไม่พยายามอ่านไฟล์นั้น
  const store = createDataStore(tmpDir());
  assert.deepEqual(Object.keys(store.getAll()).sort(), [...DATA_NAMES].sort());
  assert.equal(DATA_NAMES.includes("richmenu"), false);
});
```

In `test/validate.test.js`, make this replacement (each "find" text occurs exactly once):

Find:

```js
const {
  validatePromotions, validateServices, validateBranches, validateRegions, DAYS,
} = require("../services/validate");
```

Replace with:

```js
const {
  validatePromotions, validateServices, validateBranches, validateRegions, DAYS,
  validateRichMenu, normalizeRichMenu,
} = require("../services/validate");
```

Then append to the end of `test/validate.test.js`:

```js
const richMenu = (over = {}) => ({
  size: { width: 2500, height: 1686 },
  chatBarText: "Menu",
  selected: true,
  areas: [
    { x: 1596, y: 0, width: 904, height: 1084, action: { type: "uri", uri: "https://liff.line.me/2007605538-yPqjO4RW" } },
    { x: 0, y: 1082, width: 833, height: 604, action: { type: "message", text: "บริการทั้งหมด" } },
  ],
  menus: [
    { key: "default", label: "ก่อนสมัคร", image: "https://img.example/default.jpg", isDefault: true },
    { key: "gold", label: "V Gold", image: "https://img.example/gold.jpg", isDefault: false },
  ],
  ...over,
});
const withArea = (patch) => richMenu({ areas: [{ ...richMenu().areas[0], ...patch }] });
const withMenu = (patch) => richMenu({ menus: [{ ...richMenu().menus[0], ...patch }] });

test("richmenu: a complete definition passes, with or without menus", () => {
  assert.deepEqual(validateRichMenu(richMenu()), []);
  assert.deepEqual(validateRichMenu(richMenu({ menus: [] })), []);
});

test("richmenu: the file committed in data/ passes", () => {
  assert.deepEqual(validateRichMenu(require("../data/richmenu.json")), []);
});

test("richmenu: the root must be an object", () => {
  for (const value of [null, [], "x", 3]) assert.deepEqual(paths(validateRichMenu(value)), [""]);
});

test("richmenu: size limits and proportions", () => {
  assert.deepEqual(paths(validateRichMenu(richMenu({ size: { width: 799, height: 1686 } }))), ["size.width"]);
  assert.deepEqual(paths(validateRichMenu(richMenu({ size: { width: 2501, height: 1686 } }))), ["size.width"]);
  assert.deepEqual(paths(validateRichMenu(richMenu({ size: { width: 2500.5, height: 1686 } }))), ["size.width"]);
  assert.deepEqual(paths(validateRichMenu(richMenu({ size: { width: 2500, height: 249 }, areas: [{ ...richMenu().areas[0], y: 0, height: 100 }] }))), ["size.height"]);
  // 2500 / 1725 = 1.449 ต่ำกว่า 1.45
  assert.deepEqual(paths(validateRichMenu(richMenu({ size: { width: 2500, height: 1725 } }))), ["size.height"]);
  assert.deepEqual(validateRichMenu(richMenu({ size: { width: 2500, height: 1724 } })), []);
  assert.deepEqual(paths(validateRichMenu(richMenu({ size: undefined }))).sort(), ["size.height", "size.width"]);
  assert.deepEqual(paths(validateRichMenu(richMenu({ size: { width: "2500", height: "1686" } }))).sort(), ["size.height", "size.width"]);
});

test("richmenu: chat bar text and selected", () => {
  assert.deepEqual(paths(validateRichMenu(richMenu({ chatBarText: "" }))), ["chatBarText"]);
  assert.deepEqual(paths(validateRichMenu(richMenu({ chatBarText: "   " }))), ["chatBarText"]);
  assert.deepEqual(paths(validateRichMenu(richMenu({ chatBarText: "x".repeat(15) }))), ["chatBarText"]);
  assert.deepEqual(validateRichMenu(richMenu({ chatBarText: "x".repeat(14) })), []);
  assert.deepEqual(paths(validateRichMenu(richMenu({ selected: "true" }))), ["selected"]);
});

test("richmenu: between 1 and 20 areas", () => {
  assert.deepEqual(paths(validateRichMenu(richMenu({ areas: [] }))), ["areas"]);
  assert.deepEqual(paths(validateRichMenu(richMenu({ areas: undefined }))), ["areas"]);
  const area = richMenu().areas[1];
  assert.deepEqual(validateRichMenu(richMenu({ areas: Array.from({ length: 20 }, () => area) })), []);
  assert.deepEqual(paths(validateRichMenu(richMenu({ areas: Array.from({ length: 21 }, () => area) }))), ["areas"]);
  assert.deepEqual(paths(validateRichMenu(richMenu({ areas: ["x"] }))), ["areas[0]"]);
});

test("richmenu: area bounds are whole numbers inside the menu", () => {
  assert.deepEqual(paths(validateRichMenu(withArea({ x: -1 }))), ["areas[0].x"]);
  assert.deepEqual(paths(validateRichMenu(withArea({ y: 1.5 }))), ["areas[0].y"]);
  assert.deepEqual(paths(validateRichMenu(withArea({ width: 0 }))), ["areas[0].width"]);
  assert.deepEqual(paths(validateRichMenu(withArea({ height: "" }))), ["areas[0].height"]);
  // 1596 + 905 = 2501 เลยขอบขวา, 0 + 1687 เลยขอบล่าง
  assert.deepEqual(paths(validateRichMenu(withArea({ width: 905 }))), ["areas[0].width"]);
  assert.deepEqual(paths(validateRichMenu(withArea({ height: 1687 }))), ["areas[0].height"]);
  assert.deepEqual(validateRichMenu(withArea({ x: 0, y: 0, width: 2500, height: 1686 })), []);
});

test("richmenu: an area sends a message or opens a link", () => {
  assert.deepEqual(paths(validateRichMenu(withArea({ action: { type: "message", text: "" } }))), ["areas[0].action.text"]);
  assert.deepEqual(paths(validateRichMenu(withArea({ action: { type: "message", text: "x".repeat(301) } }))), ["areas[0].action.text"]);
  assert.deepEqual(validateRichMenu(withArea({ action: { type: "message", text: "ข้อความที่ยังไม่มี trigger" } })), []);
  for (const uri of ["https://vsquareclinic.com/", "http://example.com/a", "line://ti/p/@vsq", "tel:021234567"]) {
    assert.deepEqual(validateRichMenu(withArea({ action: { type: "uri", uri } })), [], uri);
  }
  for (const uri of ["", "vsquareclinic.com", "javascript:alert(1)", "https://", "https://a b", "https://x/" + "a".repeat(1000)]) {
    assert.deepEqual(paths(validateRichMenu(withArea({ action: { type: "uri", uri } }))), ["areas[0].action.uri"], uri);
  }
  assert.deepEqual(paths(validateRichMenu(withArea({ action: { type: "postback", data: "x" } }))), ["areas[0].action.type"]);
  assert.deepEqual(paths(validateRichMenu(withArea({ action: undefined }))), ["areas[0].action.type"]);
});

test("richmenu: menu key, label, image and default flag", () => {
  for (const key of ["", "Gold", "v gold", "ทอง", "a".repeat(21), 5]) {
    assert.deepEqual(paths(validateRichMenu(withMenu({ key }))), ["menus[0].key"], String(key));
  }
  assert.deepEqual(validateRichMenu(withMenu({ key: "v-gold-2" })), []);
  assert.deepEqual(paths(validateRichMenu(withMenu({ label: " " }))), ["menus[0].label"]);
  assert.deepEqual(paths(validateRichMenu(withMenu({ label: "x".repeat(51) }))), ["menus[0].label"]);
  for (const image of ["", "http://img.example/a.jpg", "img.example/a.jpg", "https://img.example/a b.jpg"]) {
    assert.deepEqual(paths(validateRichMenu(withMenu({ image }))), ["menus[0].image"], image);
  }
  assert.deepEqual(paths(validateRichMenu(richMenu({ menus: [{ ...richMenu().menus[0] }, { ...richMenu().menus[1], isDefault: "no" }] }))), ["menus[1].isDefault"]);
  assert.deepEqual(paths(validateRichMenu(richMenu({ menus: ["x"] }))), ["menus[0]", "menus"]);
  assert.deepEqual(paths(validateRichMenu(richMenu({ menus: undefined }))), ["menus"]);
});

test("richmenu: keys are unique and exactly one menu is the default", () => {
  const [first, second] = richMenu().menus;
  const duplicate = validateRichMenu(richMenu({ menus: [first, { ...second, key: "default" }] }));
  assert.deepEqual(paths(duplicate), ["menus[1].key"]);
  assert.match(duplicate[0].message, /รายการที่ 1/);
  assert.deepEqual(paths(validateRichMenu(richMenu({ menus: [first, { ...second, isDefault: true }] }))), ["menus"]);
  assert.deepEqual(paths(validateRichMenu(richMenu({ menus: [{ ...first, isDefault: false }, second] }))), ["menus"]);
  const many = Array.from({ length: 21 }, (_, i) => ({ ...second, key: `k${i}`, isDefault: i === 0 }));
  assert.deepEqual(paths(validateRichMenu(richMenu({ menus: many }))), ["menus"]);
});

test("richmenu: normalizeRichMenu keeps only the known fields", () => {
  const messy = richMenu({ extra: 1 });
  messy.size.depth = 3;
  messy.areas[0].action.text = "leftover";
  messy.areas[1].action.uri = "leftover";
  messy.areas[1].note = "x";
  messy.menus[0].richMenuId = "rm-1";
  assert.deepEqual(normalizeRichMenu(messy), richMenu());
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test test/dataStore.test.js test/validate.test.js`
Expected: FAIL — the existing tests pass; the new ones fail with `unknown data name: richmenu`, `validateRichMenu is not a function` / `normalizeRichMenu is not a function`, and `Cannot find module '../data/richmenu.json'`.

- [ ] **Step 3: Write the implementation**

In `services/dataStore.js`, make these 2 replacements (each "find" text occurs exactly once):

(1) Find:

```js
const DATA_NAMES = ["promotions", "services", "branches", "regions"];
```

Replace with:

```js
const DATA_NAMES = ["promotions", "services", "branches", "regions"];
// ไฟล์ที่ไม่ใช่เนื้อหาคำตอบของบอท: อ่าน/เขียน/สำรองเหมือนกัน แต่ไม่อยู่ใน getAll() ที่ใช้สร้างตาราง trigger
const EXTRA_NAMES = ["richmenu"];
```

(2) Find:

```js
    if (!DATA_NAMES.includes(name)) {
```

Replace with:

```js
    if (!DATA_NAMES.includes(name) && !EXTRA_NAMES.includes(name)) {
```

Create `data/richmenu.json`:

```json
{
  "size": {
    "width": 2500,
    "height": 1686
  },
  "chatBarText": "Menu",
  "selected": true,
  "areas": [
    {
      "x": 1596,
      "y": 0,
      "width": 904,
      "height": 1084,
      "action": {
        "type": "uri",
        "uri": "https://liff.line.me/2007605538-yPqjO4RW"
      }
    },
    {
      "x": 0,
      "y": 1082,
      "width": 833,
      "height": 604,
      "action": {
        "type": "message",
        "text": "บริการทั้งหมด"
      }
    },
    {
      "x": 833,
      "y": 1082,
      "width": 833,
      "height": 604,
      "action": {
        "type": "message",
        "text": "โปรโมชั่นล่าสุด"
      }
    },
    {
      "x": 1666,
      "y": 1082,
      "width": 833,
      "height": 604,
      "action": {
        "type": "message",
        "text": "ตารางแพทย์"
      }
    }
  ],
  "menus": []
}
```

In `services/validate.js`, make this replacement (each "find" text occurs exactly once):

Find:

```js
module.exports = {
  validatePromotions, validateServices, validateBranches, validateRegions,
  sectionNames, DAYS, MENUS, MAX_PRICE_IMAGES,
};
```

Replace with:

```js
// ---------- Rich Menu ----------
// data/richmenu.json เป็น object เดียว path จึงเทียบกับ object ราก เช่น "areas[1].action.text", "menus[2].image"
const RICH_MENU_KEY = /^[a-z0-9-]{1,20}$/;
const RICH_MENU_URI = /^(https?:\/\/|line:\/\/|tel:)\S+$/;
const isInt = (v) => Number.isInteger(v);

function validateRichMenu(value) {
  const errors = [];
  if (!isObject(value)) {
    errors.push({ path: "", message: "รูปแบบไม่ถูกต้อง" });
    return errors;
  }

  const size = isObject(value.size) ? value.size : {};
  const widthOk = isInt(size.width) && size.width >= 800 && size.width <= 2500;
  const heightOk = isInt(size.height) && size.height >= 250;
  if (!widthOk) errors.push({ path: "size.width", message: "ต้องเป็นจำนวนเต็ม 800–2500" });
  if (!heightOk) errors.push({ path: "size.height", message: "ต้องเป็นจำนวนเต็มตั้งแต่ 250" });
  if (widthOk && heightOk && size.width / size.height < 1.45) {
    errors.push({ path: "size.height", message: "สูงเกินไป: กว้างหารสูงต้องไม่น้อยกว่า 1.45" });
  }

  if (!isNonEmpty(value.chatBarText) || value.chatBarText.length > 14) {
    errors.push({ path: "chatBarText", message: "ต้องระบุ ไม่เกิน 14 ตัวอักษร" });
  }
  checkBool(errors, "selected", value.selected);

  const areas = Array.isArray(value.areas) ? value.areas : [];
  if (!Array.isArray(value.areas) || areas.length < 1 || areas.length > 20) {
    errors.push({ path: "areas", message: "ต้องมีพื้นที่กด 1–20 ช่อง" });
  }
  const okStart = (v) => isInt(v) && v >= 0;
  const okLength = (v) => isInt(v) && v >= 1;
  areas.forEach((area, i) => {
    const p = `areas[${i}]`;
    if (!isObject(area)) { errors.push({ path: p, message: "รูปแบบไม่ถูกต้อง" }); return; }
    if (!okStart(area.x)) errors.push({ path: `${p}.x`, message: "ต้องเป็นจำนวนเต็มตั้งแต่ 0" });
    if (!okStart(area.y)) errors.push({ path: `${p}.y`, message: "ต้องเป็นจำนวนเต็มตั้งแต่ 0" });
    if (!okLength(area.width)) errors.push({ path: `${p}.width`, message: "ต้องเป็นจำนวนเต็มตั้งแต่ 1" });
    if (!okLength(area.height)) errors.push({ path: `${p}.height`, message: "ต้องเป็นจำนวนเต็มตั้งแต่ 1" });
    if (widthOk && okStart(area.x) && okLength(area.width) && area.x + area.width > size.width) {
      errors.push({ path: `${p}.width`, message: "กรอบเลยขอบขวาของเมนู" });
    }
    if (heightOk && okStart(area.y) && okLength(area.height) && area.y + area.height > size.height) {
      errors.push({ path: `${p}.height`, message: "กรอบเลยขอบล่างของเมนู" });
    }

    const action = isObject(area.action) ? area.action : {};
    if (action.type === "message") {
      if (!isNonEmpty(action.text) || action.text.length > 300) {
        errors.push({ path: `${p}.action.text`, message: "ต้องระบุข้อความ ไม่เกิน 300 ตัวอักษร" });
      }
    } else if (action.type === "uri") {
      if (typeof action.uri !== "string" || action.uri.length > 1000 || !RICH_MENU_URI.test(action.uri)) {
        errors.push({ path: `${p}.action.uri`, message: "ต้องเป็นลิงก์ขึ้นต้นด้วย https://, http://, line:// หรือ tel: ไม่เกิน 1000 ตัวอักษร" });
      }
    } else {
      errors.push({ path: `${p}.action.type`, message: "ต้องเป็น message หรือ uri" });
    }
  });

  const menus = Array.isArray(value.menus) ? value.menus : [];
  if (!Array.isArray(value.menus) || menus.length > 20) {
    errors.push({ path: "menus", message: "ต้องเป็นรายการ ไม่เกิน 20 เมนู" });
  }
  const firstIndexOfKey = new Map();
  menus.forEach((menu, i) => {
    const p = `menus[${i}]`;
    if (!isObject(menu)) { errors.push({ path: p, message: "รูปแบบไม่ถูกต้อง" }); return; }
    if (typeof menu.key !== "string" || !RICH_MENU_KEY.test(menu.key)) {
      errors.push({ path: `${p}.key`, message: "ใช้ได้เฉพาะ a-z, 0-9 และ - ยาว 1–20 ตัว" });
    } else if (firstIndexOfKey.has(menu.key)) {
      errors.push({ path: `${p}.key`, message: `รหัสซ้ำกับรายการที่ ${firstIndexOfKey.get(menu.key) + 1}` });
    } else {
      firstIndexOfKey.set(menu.key, i);
    }
    if (!isNonEmpty(menu.label) || menu.label.length > 50) {
      errors.push({ path: `${p}.label`, message: "ต้องระบุ ไม่เกิน 50 ตัวอักษร" });
    }
    if (typeof menu.image !== "string" || !/^https:\/\/\S+$/.test(menu.image)) {
      errors.push({ path: `${p}.image`, message: "ต้องเป็น URL ขึ้นต้นด้วย https://" });
    }
    checkBool(errors, `${p}.isDefault`, menu.isDefault);
  });
  const defaults = menus.filter((menu) => isObject(menu) && menu.isDefault === true).length;
  if (menus.length > 0 && defaults !== 1) {
    errors.push({ path: "menus", message: "ต้องเลือกเมนูเริ่มต้น 1 อันพอดี" });
  }
  return errors;
}

// เก็บเฉพาะฟิลด์ที่รู้จัก ไฟล์จึงสะอาดและ hash ของเมนูไม่เปลี่ยนเพราะฟิลด์แปลกปลอม (เรียกหลัง validateRichMenu ผ่านแล้ว)
function normalizeRichMenu(value) {
  return {
    size: { width: value.size.width, height: value.size.height },
    chatBarText: value.chatBarText,
    selected: value.selected,
    areas: value.areas.map((area) => ({
      x: area.x,
      y: area.y,
      width: area.width,
      height: area.height,
      action: area.action.type === "message" ? { type: "message", text: area.action.text } : { type: "uri", uri: area.action.uri },
    })),
    menus: value.menus.map((menu) => ({ key: menu.key, label: menu.label, image: menu.image, isDefault: menu.isDefault })),
  };
}

module.exports = {
  validatePromotions, validateServices, validateBranches, validateRegions,
  validateRichMenu, normalizeRichMenu,
  sectionNames, DAYS, MENUS, MAX_PRICE_IMAGES,
};
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test test/dataStore.test.js test/validate.test.js`
Expected: `# tests 32`, `# pass 32`, `# fail 0`.

- [ ] **Step 5: Commit**

```bash
git add data/richmenu.json services/dataStore.js services/validate.js test/dataStore.test.js test/validate.test.js
git commit -m "feat: rich menu set data file and validation" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Read image dimensions and check menu images

**Files:**
- Create: `services/imageInfo.js`, `services/richMenuImages.js`, `test-helpers/imageBytes.js`
- Test: `test/imageInfo.test.js`, `test/richMenuImages.test.js`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces:
  - `inspectImage(buffer)` → `{ format: "jpeg" | "png", width, height }`; throws `Error` with a Thai message (`ไม่ใช่ไฟล์ JPEG หรือ PNG`, `ไฟล์รูปไม่สมบูรณ์`).
  - `loadMenuImage(url, size, { fetchImpl = fetch, timeoutMs = 15000 } = {})` → `Promise<{ buffer, contentType: "image/jpeg" | "image/png", width, height, bytes }>`; rejects with an `Error` whose message can be shown to the admin.
  - `checkChangedImages(next, saved, loadImage = loadMenuImage)` → `Promise<[{ path: "menus[i].image", message }]>`; loads only images whose URL is not in `saved`, or all of them when `size` changed.
  - `menusNeedingImageCheck(next, saved)` → `[{ menu, index }]`; `MAX_IMAGE_BYTES` = 1048576.
  - Test helpers: `pngBytes(width, height, padding = 0)`, `jpegBytes(width, height, { progressive, padding })` → `Buffer`.

- [ ] **Step 1: Write the test helper and the failing tests**

Create `test-helpers/imageBytes.js`:

```js
// สร้างไฟล์รูปปลอมสำหรับเทสต์: มีแค่ส่วนหัวพอให้อ่านชนิดและขนาดภาพได้ (เปิดดูเป็นภาพไม่ได้)
// padding คือจำนวนไบต์ที่เติมเพื่อทำไฟล์ให้ใหญ่ตามต้องการ
function pngBytes(width, height, padding = 0) {
  const header = Buffer.alloc(33);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(header, 0);
  header.writeUInt32BE(13, 8);
  header.write("IHDR", 12, "latin1");
  header.writeUInt32BE(width, 16);
  header.writeUInt32BE(height, 20);
  header[24] = 8; // bit depth
  header[25] = 2; // color type: RGB
  return Buffer.concat([header, Buffer.alloc(padding)]);
}

const SOI = Buffer.from([0xff, 0xd8]);
const EOI = Buffer.from([0xff, 0xd9]);
const APP0 = Buffer.from([0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00]);
const DQT = Buffer.concat([Buffer.from([0xff, 0xdb, 0x00, 0x43, 0x00]), Buffer.alloc(64, 1)]);
// Huffman table: marker C4 อยู่ในช่วงเลขเดียวกับ Start Of Frame แต่ไม่ใช่
const DHT = Buffer.from([0xff, 0xc4, 0x00, 0x05, 0x00, 0x01, 0x02]);

function startOfFrame(width, height, marker = 0xc0) {
  const segment = Buffer.alloc(19);
  segment[0] = 0xff;
  segment[1] = marker;
  segment.writeUInt16BE(17, 2);
  segment[4] = 8; // precision
  segment.writeUInt16BE(height, 5);
  segment.writeUInt16BE(width, 7);
  segment[9] = 3; // components
  return segment;
}

function jpegBytes(width, height, { progressive = false, padding = 0 } = {}) {
  return Buffer.concat([SOI, APP0, DQT, startOfFrame(width, height, progressive ? 0xc2 : 0xc0), Buffer.alloc(padding), EOI]);
}

module.exports = { pngBytes, jpegBytes, startOfFrame, SOI, EOI, APP0, DQT, DHT };
```

Create `test/imageInfo.test.js`:

```js
const test = require("node:test");
const assert = require("node:assert/strict");
const { inspectImage } = require("../services/imageInfo");
const { pngBytes, jpegBytes, startOfFrame, SOI, EOI, APP0, DQT, DHT } = require("../test-helpers/imageBytes");

test("reads the size of a PNG", () => {
  assert.deepEqual(inspectImage(pngBytes(2500, 1686)), { format: "png", width: 2500, height: 1686 });
});

test("reads the size of baseline and progressive JPEGs", () => {
  assert.deepEqual(inspectImage(jpegBytes(2500, 1686)), { format: "jpeg", width: 2500, height: 1686 });
  assert.deepEqual(inspectImage(jpegBytes(2500, 843, { progressive: true })), { format: "jpeg", width: 2500, height: 843 });
});

test("skips Huffman tables and fill bytes before the frame header of a JPEG", () => {
  const withTableFirst = Buffer.concat([SOI, APP0, DHT, DQT, startOfFrame(1200, 810), EOI]);
  assert.deepEqual(inspectImage(withTableFirst), { format: "jpeg", width: 1200, height: 810 });
  const withFillBytes = Buffer.concat([SOI, APP0, Buffer.from([0xff, 0xff]), startOfFrame(800, 540).subarray(1), EOI]);
  assert.deepEqual(inspectImage(withFillBytes), { format: "jpeg", width: 800, height: 540 });
});

test("rejects anything that is not a JPEG or PNG", () => {
  const webp = Buffer.concat([Buffer.from("RIFF"), Buffer.alloc(4), Buffer.from("WEBPVP8 "), Buffer.alloc(20)]);
  for (const input of [Buffer.from("GIF89a" + "x".repeat(30)), webp, Buffer.from("<!doctype html><html>not found</html>"), Buffer.alloc(0), "a string", null, undefined]) {
    assert.throws(() => inspectImage(input), /ไม่ใช่ไฟล์ JPEG หรือ PNG/);
  }
});

test("rejects a truncated image instead of returning a wrong size", () => {
  assert.throws(() => inspectImage(pngBytes(2500, 1686).subarray(0, 20)), /ไฟล์รูปไม่สมบูรณ์/);
  // JPEG ที่ขาดก่อนถึงส่วนหัวของเฟรม
  assert.throws(() => inspectImage(Buffer.concat([SOI, APP0])), /ไฟล์รูปไม่สมบูรณ์/);
  assert.throws(() => inspectImage(jpegBytes(2500, 1686).subarray(0, SOI.length + APP0.length + DQT.length + 6)), /ไฟล์รูปไม่สมบูรณ์/);
  // เริ่มข้อมูลภาพ (SOS) โดยไม่มีส่วนหัวของเฟรม
  assert.throws(() => inspectImage(Buffer.concat([SOI, APP0, Buffer.from([0xff, 0xda, 0x00, 0x02]), EOI])), /ไฟล์รูปไม่สมบูรณ์/);
  assert.throws(() => inspectImage(Buffer.concat([SOI, Buffer.from([0xff, 0xe0, 0x00, 0x00]), startOfFrame(10, 10)])), /ไฟล์รูปไม่สมบูรณ์/);
});
```

Create `test/richMenuImages.test.js`:

```js
const test = require("node:test");
const assert = require("node:assert/strict");
const { loadMenuImage, checkChangedImages, menusNeedingImageCheck, MAX_IMAGE_BYTES } = require("../services/richMenuImages");
const { pngBytes, jpegBytes } = require("../test-helpers/imageBytes");

const size = { width: 2500, height: 1686 };
const url = "https://img.example/menu.jpg";
const respond = (body, init = {}) => async () => new Response(body, { status: 200, ...init });
const load = (fetchImpl, target = url, options = {}) => loadMenuImage(target, size, { fetchImpl, ...options });

test("loads a JPEG or PNG of the right size and reports its type", async () => {
  const jpeg = jpegBytes(2500, 1686);
  assert.deepEqual(await load(respond(jpeg)), { buffer: jpeg, contentType: "image/jpeg", width: 2500, height: 1686, bytes: jpeg.length });
  const png = pngBytes(2500, 1686);
  assert.equal((await load(respond(png, { headers: { "content-type": "text/plain" } }))).contentType, "image/png");
});

test("asks for the URL it was given, follows redirects and sets a timeout", async () => {
  const seen = [];
  await load(async (target, options) => {
    seen.push({ target, redirect: options.redirect, hasSignal: options.signal instanceof AbortSignal });
    return new Response(jpegBytes(2500, 1686));
  });
  assert.deepEqual(seen, [{ target: url, redirect: "follow", hasSignal: true }]);
});

test("reports an HTTP error, a network failure and a timeout in words an admin can act on", async () => {
  await assert.rejects(load(respond("gone", { status: 404 })), /โหลดรูปไม่ได้ \(HTTP 404\)/);
  await assert.rejects(load(async () => { throw new TypeError("fetch failed"); }), /โหลดรูปไม่ได้ ตรวจว่า URL เปิดได้จริง/);
  // timer ของ AbortSignal.timeout ไม่ยึด event loop ไว้ จึงต้องมี timer ของเทสต์เองระหว่างรอ
  const never = (target, { signal }) => new Promise((resolve, reject) => {
    const keepAlive = setInterval(() => {}, 1000);
    signal.addEventListener("abort", () => {
      clearInterval(keepAlive);
      reject(signal.reason);
    });
  });
  await assert.rejects(load(never, url, { timeoutMs: 20 }), /โหลดรูปไม่ทัน/);
});

test("accepts a smaller image with the menu's proportions, as LINE does", async () => {
  // เมนูจริงของคลินิก: ประกาศ 2500x1686 แต่รูปที่อัปโหลดคือ 1200x810
  const image = await load(respond(jpegBytes(1200, 810)));
  assert.deepEqual([image.width, image.height], [1200, 810]);
  assert.equal((await load(respond(pngBytes(800, 540)))).width, 800);
});

test("rejects an image whose proportions or dimensions LINE would not show correctly", async () => {
  await assert.rejects(load(respond(jpegBytes(2500, 843))), /รูปขนาด 2500x843 สัดส่วนไม่ตรงกับเมนู 2500x1686/);
  await assert.rejects(load(respond(pngBytes(1686, 2500))), /สัดส่วนไม่ตรงกับเมนู/);
  await assert.rejects(load(respond(jpegBytes(1200, 840))), /สัดส่วนไม่ตรงกับเมนู/);
  await assert.rejects(load(respond(jpegBytes(600, 405))), /รูปขนาด 600x405: LINE รับความกว้าง 800–2500 พิกเซล/);
  await assert.rejects(load(respond(jpegBytes(3000, 2023))), /LINE รับความกว้าง 800–2500 พิกเซล/);
  // เมนูเตี้ยมาก: สัดส่วนตรง แต่รูปเตี้ยกว่าที่ LINE รับ
  await assert.rejects(loadMenuImage(url, { width: 2500, height: 500 }, { fetchImpl: respond(jpegBytes(1000, 200)) }), /LINE รับความสูงตั้งแต่ 250 พิกเซล/);
});

test("accepts exactly 1 MB and rejects anything larger, by header or by actual bytes", async () => {
  const base = jpegBytes(2500, 1686).length;
  const exact = jpegBytes(2500, 1686, { padding: MAX_IMAGE_BYTES - base });
  assert.equal(exact.length, MAX_IMAGE_BYTES);
  assert.equal((await load(respond(exact))).bytes, MAX_IMAGE_BYTES);

  const tooBig = jpegBytes(2500, 1686, { padding: MAX_IMAGE_BYTES - base + 1 });
  await assert.rejects(load(respond(tooBig)), /ไฟล์รูปใหญ่เกิน 1 MB/);
  // header บอกว่าใหญ่เกิน: ปฏิเสธโดยไม่ต้องอ่านเนื้อไฟล์
  await assert.rejects(load(respond(jpegBytes(2500, 1686), { headers: { "content-length": String(5 * MAX_IMAGE_BYTES) } })), /ไฟล์รูปใหญ่เกิน 1 MB/);
});

test("rejects a response that is not an image even when the server says 200", async () => {
  await assert.rejects(load(respond("<!doctype html><title>Not found</title>", { headers: { "content-type": "image/jpeg" } })), /ไม่ใช่ไฟล์ JPEG หรือ PNG/);
  await assert.rejects(load(respond(null)), /ไม่ใช่ไฟล์ JPEG หรือ PNG/);
});

test("never fetches a URL that is not https or points at localhost or an IP address", async () => {
  let fetched = 0;
  const fetchImpl = async () => { fetched += 1; return new Response(jpegBytes(2500, 1686)); };
  const cases = [
    ["http://img.example/menu.jpg", /ต้องขึ้นต้นด้วย https/],
    ["ftp://img.example/menu.jpg", /ต้องขึ้นต้นด้วย https/],
    ["not a url", /URL ของรูปไม่ถูกต้อง/],
    ["https://localhost/menu.jpg", /localhost หรือเลข IP/],
    ["https://app.localhost/menu.jpg", /localhost หรือเลข IP/],
    ["https://127.0.0.1/menu.jpg", /localhost หรือเลข IP/],
    ["https://169.254.169.254/latest/meta-data", /localhost หรือเลข IP/],
    ["https://[::1]/menu.jpg", /localhost หรือเลข IP/],
  ];
  for (const [target, pattern] of cases) {
    await assert.rejects(load(fetchImpl, target), pattern, target);
  }
  assert.equal(fetched, 0);
});

test("rejects a redirect that lands on a forbidden address", async () => {
  const redirected = async () => ({ ok: true, status: 200, url: "https://10.0.0.5/internal.jpg", headers: new Headers(), body: null });
  await assert.rejects(load(redirected), /localhost หรือเลข IP/);
  const downgraded = async () => ({ ok: true, status: 200, url: "http://img.example/menu.jpg", headers: new Headers(), body: null });
  await assert.rejects(load(downgraded), /ต้องขึ้นต้นด้วย https/);
});

const menu = (key, image) => ({ key, label: key, image, isDefault: key === "default" });
const saved = { size, menus: [menu("default", "https://img.example/a.jpg"), menu("gold", "https://img.example/b.jpg")] };

test("menusNeedingImageCheck: only URLs not saved before, or every menu when the size changes", () => {
  const next = { size, menus: [menu("default", "https://img.example/a.jpg"), menu("gold", "https://img.example/new.jpg"), menu("silver", "https://img.example/b.jpg")] };
  assert.deepEqual(menusNeedingImageCheck(next, saved).map((item) => [item.index, item.menu.key]), [[1, "gold"]]);
  assert.deepEqual(menusNeedingImageCheck({ ...next, size: { width: 2500, height: 843 } }, saved).map((item) => item.index), [0, 1, 2]);
  assert.deepEqual(menusNeedingImageCheck(next, { size, menus: [] }).map((item) => item.index), [0, 1, 2]);
  assert.deepEqual(menusNeedingImageCheck(next, undefined).map((item) => item.index), [0, 1, 2]);
});

test("checkChangedImages: loads only the changed images and reports failures by field path", async () => {
  const next = { size, menus: [menu("default", "https://img.example/a.jpg"), menu("gold", "https://img.example/bad.jpg"), menu("silver", "https://img.example/good.jpg")] };
  const loaded = [];
  const loadImage = async (target, wanted) => {
    loaded.push([target, wanted]);
    if (target.endsWith("bad.jpg")) throw new Error("ไฟล์รูปใหญ่เกิน 1 MB");
    return {};
  };
  assert.deepEqual(await checkChangedImages(next, saved, loadImage), [{ path: "menus[1].image", message: "ไฟล์รูปใหญ่เกิน 1 MB" }]);
  assert.deepEqual(loaded, [["https://img.example/bad.jpg", size], ["https://img.example/good.jpg", size]]);
  assert.deepEqual(await checkChangedImages(saved, saved, loadImage), []);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test test/imageInfo.test.js test/richMenuImages.test.js`
Expected: FAIL — `Cannot find module '../services/imageInfo'` and `Cannot find module '../services/richMenuImages'`.

- [ ] **Step 3: Write the implementation**

Create `services/imageInfo.js`:

```js
// อ่านชนิดและขนาดภาพจากเนื้อไฟล์ (JPEG/PNG) โดยไม่ใช้ dependency — ไม่เชื่อนามสกุลไฟล์หรือ Content-Type
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const NOT_IMAGE = "ไม่ใช่ไฟล์ JPEG หรือ PNG";
const TRUNCATED = "ไฟล์รูปไม่สมบูรณ์";

function inspectPng(buffer) {
  // signature 8 ไบต์ + ความยาว chunk 4 + "IHDR" 4 + กว้าง 4 + สูง 4
  if (buffer.length < 24 || buffer.toString("latin1", 12, 16) !== "IHDR") {
    throw new Error(TRUNCATED);
  }
  return { format: "png", width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

function inspectJpeg(buffer) {
  let offset = 2;
  while (offset + 1 < buffer.length) {
    if (buffer[offset] !== 0xff) break;
    const marker = buffer[offset + 1];
    if (marker === 0xff) {
      // fill byte ระหว่าง segment
      offset += 1;
      continue;
    }
    offset += 2;
    // marker ที่ไม่มีข้อมูลตามหลัง
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8)) continue;
    // จบไฟล์ หรือเริ่มข้อมูลภาพก่อนจะเจอขนาด
    if (marker === 0xd9 || marker === 0xda) break;
    if (offset + 2 > buffer.length) break;
    const length = buffer.readUInt16BE(offset);
    // Start Of Frame ทุกแบบ ยกเว้น DHT (C4), JPG (C8), DAC (CC) ที่ใช้เลขช่วงเดียวกัน
    const isStartOfFrame = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isStartOfFrame) {
      if (offset + 7 > buffer.length) break;
      return { format: "jpeg", width: buffer.readUInt16BE(offset + 5), height: buffer.readUInt16BE(offset + 3) };
    }
    if (length < 2) break;
    offset += length;
  }
  throw new Error(TRUNCATED);
}

// คืน { format: "jpeg" | "png", width, height } หรือ throw พร้อมข้อความที่แสดงให้แอดมินได้
function inspectImage(buffer) {
  if (!Buffer.isBuffer(buffer)) throw new Error(NOT_IMAGE);
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(PNG_SIGNATURE)) return inspectPng(buffer);
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return inspectJpeg(buffer);
  throw new Error(NOT_IMAGE);
}

module.exports = { inspectImage };
```

Create `services/richMenuImages.js`:

```js
// โหลดรูปของ Rich Menu จาก URL ที่แอดมินกรอก แล้วตรวจตามข้อกำหนดของ LINE
const net = require("net");
const { inspectImage } = require("./imageInfo");

const MAX_IMAGE_BYTES = 1024 * 1024;
const FETCH_TIMEOUT_MS = 15000;
const CONTENT_TYPES = { jpeg: "image/jpeg", png: "image/png" };
const TOO_BIG = "ไฟล์รูปใหญ่เกิน 1 MB";
// ข้อกำหนดรูป Rich Menu ของ LINE — รูปไม่ต้องมีขนาดเท่ากับ size ของเมนู (LINE ย่อ/ขยายให้) แต่สัดส่วนต้องตรงกัน
const MIN_WIDTH = 800;
const MAX_WIDTH = 2500;
const MIN_HEIGHT = 250;
const MIN_ASPECT = 1.45;
const ASPECT_TOLERANCE = 0.01;

// เซิร์ฟเวอร์เป็นคนไปโหลด URL นี้เอง จึงรับเฉพาะ https และไม่รับปลายทางที่เป็น localhost หรือเลข IP
function assertFetchableUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch (error) {
    throw new Error("URL ของรูปไม่ถูกต้อง");
  }
  if (url.protocol !== "https:") {
    throw new Error("URL ของรูปต้องขึ้นต้นด้วย https://");
  }
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost") || net.isIP(host) !== 0) {
    throw new Error("ไม่รับ URL ของรูปที่ชี้ไป localhost หรือเลข IP");
  }
  return url;
}

// อ่าน body โดยหยุดทันทีที่เกินขนาดที่ LINE รับ — ไม่โหลดไฟล์ใหญ่เข้าหน่วยความจำทั้งก้อน
async function readLimited(response) {
  if (Number(response.headers.get("content-length")) > MAX_IMAGE_BYTES) {
    throw new Error(TOO_BIG);
  }
  if (!response.body) return Buffer.alloc(0);
  const chunks = [];
  let total = 0;
  for await (const chunk of response.body) {
    total += chunk.length;
    if (total > MAX_IMAGE_BYTES) throw new Error(TOO_BIG);
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

const isTimeout = (error) => Boolean(error) && (error.name === "TimeoutError" || error.name === "AbortError");

// คืน { buffer, contentType, width, height, bytes } หรือ throw พร้อมข้อความที่แสดงให้แอดมินได้
async function loadMenuImage(imageUrl, size, { fetchImpl = fetch, timeoutMs = FETCH_TIMEOUT_MS } = {}) {
  assertFetchableUrl(imageUrl);
  const timeoutMessage = `โหลดรูปไม่ทันใน ${Math.round(timeoutMs / 1000)} วินาที`;

  let response;
  try {
    response = await fetchImpl(imageUrl, { redirect: "follow", signal: AbortSignal.timeout(timeoutMs) });
  } catch (error) {
    throw new Error(isTimeout(error) ? timeoutMessage : "โหลดรูปไม่ได้ ตรวจว่า URL เปิดได้จริง");
  }
  // ปลายทางหลัง redirect ต้องผ่านกติกาเดียวกับ URL ที่กรอก
  if (response.url) assertFetchableUrl(response.url);
  if (!response.ok) {
    throw new Error(`โหลดรูปไม่ได้ (HTTP ${response.status})`);
  }

  let buffer;
  try {
    buffer = await readLimited(response);
  } catch (error) {
    if (error.message === TOO_BIG) throw error;
    throw new Error(isTimeout(error) ? timeoutMessage : "โหลดรูปไม่สำเร็จระหว่างรับข้อมูล");
  }

  const info = inspectImage(buffer);
  const dimensions = `${info.width}x${info.height}`;
  if (info.width < MIN_WIDTH || info.width > MAX_WIDTH) {
    throw new Error(`รูปขนาด ${dimensions}: LINE รับความกว้าง ${MIN_WIDTH}–${MAX_WIDTH} พิกเซล`);
  }
  if (info.height < MIN_HEIGHT) {
    throw new Error(`รูปขนาด ${dimensions}: LINE รับความสูงตั้งแต่ ${MIN_HEIGHT} พิกเซล`);
  }
  const aspect = info.width / info.height;
  const wanted = size.width / size.height;
  if (aspect < MIN_ASPECT || Math.abs(aspect - wanted) / wanted > ASPECT_TOLERANCE) {
    throw new Error(`รูปขนาด ${dimensions} สัดส่วนไม่ตรงกับเมนู ${size.width}x${size.height} พื้นที่กดจะไม่ตรงกับรูป`);
  }
  return { buffer, contentType: CONTENT_TYPES[info.format], width: info.width, height: info.height, bytes: buffer.length };
}

// เมนูที่ต้องตรวจรูปตอนบันทึก: URL ที่ยังไม่เคยอยู่ในข้อมูลที่บันทึกไว้ หรือทุกเมนูเมื่อขนาดเมนูเปลี่ยน
function menusNeedingImageCheck(next, saved) {
  const savedSize = (saved && saved.size) || {};
  const sizeChanged = savedSize.width !== next.size.width || savedSize.height !== next.size.height;
  const savedImages = new Set(((saved && saved.menus) || []).map((menu) => menu.image));
  return next.menus
    .map((menu, index) => ({ menu, index }))
    .filter(({ menu }) => sizeChanged || !savedImages.has(menu.image));
}

// คืน [{ path, message }] ของรูปที่ไม่ผ่าน (รูปแบบเดียวกับ services/validate.js)
async function checkChangedImages(next, saved, loadImage = loadMenuImage) {
  const results = await Promise.all(
    menusNeedingImageCheck(next, saved).map(async ({ menu, index }) => {
      try {
        await loadImage(menu.image, next.size);
        return null;
      } catch (error) {
        return { path: `menus[${index}].image`, message: error.message };
      }
    })
  );
  return results.filter(Boolean);
}

module.exports = { loadMenuImage, checkChangedImages, menusNeedingImageCheck, assertFetchableUrl, MAX_IMAGE_BYTES };
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test test/imageInfo.test.js test/richMenuImages.test.js`
Expected: `# tests 16`, `# pass 16`, `# fail 0`.

- [ ] **Step 5: Commit**

```bash
git add services/imageInfo.js services/richMenuImages.js test-helpers/imageBytes.js test/imageInfo.test.js test/richMenuImages.test.js
git commit -m "feat: fetch and check rich menu images against LINE's rules" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Names, hash and status of one OA (pure)

**Files:**
- Create: `services/richMenuPlan.js`
- Test: `test/richMenuPlan.test.js`

**Interfaces:**
- Consumes: the definition shape from Task 1.
- Produces:
  - `aliasFor(key)` → `"vsq-<key>"`; `menuHash(definition, menu)` → 16 hex characters; `menuName(definition, menu)` → `"vsq|<key>|<hash>"`; `parseManagedName(name)` → `{ key, hash } | null`.
  - `toLineRichMenu(definition, menu)` → `{ size, selected, name, chatBarText, areas: [{ bounds: { x, y, width, height }, action }] }`.
  - `describeChannel(definition, remote)` where `remote = { menus: [{ richMenuId, name }], aliases: [{ richMenuAliasId, richMenuId }], defaultRichMenuId: string | null }` → `{ state: "blocked" | "empty" | "in-sync" | "out-of-date", message, menus: [{ key, label, isDefault, state: "ok" | "missing" | "outdated", richMenuId: string | null, aliasExists }], staleMenus: [{ richMenuId, key }], removedAliases: [aliasId], removedKeys: [key], foreignMenus: [name], defaultOk }`.

- [ ] **Step 1: Write the failing tests**

Create `test/richMenuPlan.test.js`:

```js
const test = require("node:test");
const assert = require("node:assert/strict");
const { aliasFor, menuHash, menuName, parseManagedName, toLineRichMenu, describeChannel } = require("../services/richMenuPlan");

const definition = (over = {}) => ({
  size: { width: 2500, height: 1686 },
  chatBarText: "Menu",
  selected: true,
  areas: [
    { x: 1596, y: 0, width: 904, height: 1084, action: { type: "uri", uri: "https://liff.line.me/x" } },
    { x: 0, y: 1082, width: 833, height: 604, action: { type: "message", text: "บริการทั้งหมด" } },
  ],
  menus: [
    { key: "default", label: "ก่อนสมัคร", image: "https://img.example/default.jpg", isDefault: true },
    { key: "gold", label: "V Gold", image: "https://img.example/gold.jpg", isDefault: false },
  ],
  ...over,
});

// สถานะบน LINE ของ OA ที่ sync ตรงกับ definition แล้ว
const remoteFor = (def) => ({
  menus: def.menus.map((menu) => ({ richMenuId: `rm-${menu.key}`, name: menuName(def, menu) })),
  aliases: def.menus.map((menu) => ({ richMenuAliasId: aliasFor(menu.key), richMenuId: `rm-${menu.key}` })),
  defaultRichMenuId: `rm-${def.menus.find((menu) => menu.isDefault).key}`,
});
const states = (status) => status.menus.map((menu) => [menu.key, menu.state]);

test("menu names carry the key and a 16-character hash, and parse back", () => {
  const def = definition();
  const name = menuName(def, def.menus[1]);
  assert.match(name, /^vsq\|gold\|[0-9a-f]{16}$/);
  assert.deepEqual(parseManagedName(name), { key: "gold", hash: menuHash(def, def.menus[1]) });
  assert.equal(aliasFor("gold"), "vsq-gold");
});

test("names made by other systems are not recognised as this app's menus", () => {
  for (const name of ["V Gold Richmenu 06/10/2026", "Default Richmenu 06/10/2026", "", undefined, null, 42, "vsq|GOLD|0123456789abcdef", "vsq|gold|0123", "vsq|gold|0123456789abcdef|x", "xvsq|gold|0123456789abcdef"]) {
    assert.equal(parseManagedName(name), null, String(name));
  }
});

test("the hash changes with anything LINE shows or uses, and nothing else", () => {
  const def = definition();
  const base = menuHash(def, def.menus[1]);
  const withArea = (patch) => definition({ areas: [{ ...def.areas[0], ...patch }, def.areas[1]] });
  const changed = [
    definition({ size: { width: 2500, height: 843 } }),
    definition({ chatBarText: "เมนู" }),
    definition({ selected: false }),
    withArea({ x: 1600 }),
    withArea({ action: { type: "uri", uri: "https://liff.line.me/y" } }),
    definition({ areas: [def.areas[1], def.areas[0]] }),
    definition({ areas: [def.areas[0]] }),
  ];
  for (const other of changed) assert.notEqual(menuHash(other, other.menus[1]), base);
  assert.notEqual(menuHash(def, { ...def.menus[1], image: "https://img.example/gold-v2.jpg" }), base);

  // label, isDefault, key และเมนูอื่นในรายการ ไม่ทำให้เมนูนี้ต้องถูกสร้างใหม่
  assert.equal(menuHash(def, { ...def.menus[1], label: "Gold ใหม่", isDefault: true, key: "other" }), base);
  const fewer = definition({ menus: [def.menus[1]] });
  assert.equal(menuHash(fewer, fewer.menus[0]), base);
});

test("toLineRichMenu builds exactly the object LINE expects", () => {
  const def = definition({
    areas: [
      { x: 1596, y: 0, width: 904, height: 1084, action: { type: "uri", uri: "https://liff.line.me/x", text: "leftover" } },
      { x: 0, y: 1082, width: 833, height: 604, action: { type: "message", text: "บริการทั้งหมด", uri: "leftover" } },
    ],
  });
  assert.deepEqual(toLineRichMenu(def, def.menus[1]), {
    size: { width: 2500, height: 1686 },
    selected: true,
    name: menuName(def, def.menus[1]),
    chatBarText: "Menu",
    areas: [
      { bounds: { x: 1596, y: 0, width: 904, height: 1084 }, action: { type: "uri", uri: "https://liff.line.me/x" } },
      { bounds: { x: 0, y: 1082, width: 833, height: 604 }, action: { type: "message", text: "บริการทั้งหมด" } },
    ],
  });
});

test("describeChannel: a menu from another system blocks the OA, whatever else is there", () => {
  const def = definition();
  const remote = remoteFor(def);
  remote.menus.push({ richMenuId: "rm-legacy", name: "V Gold Richmenu 06/10/2026" });
  const status = describeChannel(def, remote);
  assert.equal(status.state, "blocked");
  assert.deepEqual(status.foreignMenus, ["V Gold Richmenu 06/10/2026"]);
  assert.match(status.message, /ระบบอื่นสร้างไว้ 1 เมนู/);
  assert.deepEqual([status.menus, status.staleMenus, status.removedAliases], [[], [], []]);
  assert.equal(describeChannel(definition({ menus: [] }), remote).state, "blocked");
});

test("describeChannel: no menus in the list is 'empty'", () => {
  const status = describeChannel(definition({ menus: [] }), { menus: [], aliases: [], defaultRichMenuId: null });
  assert.equal(status.state, "empty");
  assert.match(status.message, /ยังไม่มีเมนูในรายการ/);
});

test("describeChannel: a fresh OA is out of date with every level missing", () => {
  const status = describeChannel(definition(), { menus: [], aliases: [], defaultRichMenuId: null });
  assert.equal(status.state, "out-of-date");
  assert.deepEqual(states(status), [["default", "missing"], ["gold", "missing"]]);
  assert.deepEqual(status.menus.map((menu) => [menu.aliasExists, menu.richMenuId, menu.isDefault]), [[false, null, true], [false, null, false]]);
  assert.equal(status.defaultOk, false);
});

test("describeChannel: an OA that matches is in sync", () => {
  const def = definition();
  const status = describeChannel(def, remoteFor(def));
  assert.equal(status.state, "in-sync");
  assert.deepEqual(states(status), [["default", "ok"], ["gold", "ok"]]);
  assert.deepEqual(status.menus.map((menu) => menu.richMenuId), ["rm-default", "rm-gold"]);
  assert.deepEqual([status.staleMenus, status.removedAliases, status.removedKeys, status.foreignMenus], [[], [], [], []]);
  assert.equal(status.defaultOk, true);
});

test("describeChannel: an alias from another system is ignored, not removed", () => {
  const def = definition();
  const remote = remoteFor(def);
  remote.aliases.push({ richMenuAliasId: "member", richMenuId: "rm-gold" });
  const status = describeChannel(def, remote);
  assert.equal(status.state, "in-sync");
  assert.deepEqual(status.removedAliases, []);
});

test("describeChannel: a changed level is outdated and keeps its alias", () => {
  const before = definition();
  const after = definition({ menus: [before.menus[0], { ...before.menus[1], image: "https://img.example/gold-v2.jpg" }] });
  const status = describeChannel(after, remoteFor(before));
  assert.equal(status.state, "out-of-date");
  assert.deepEqual(states(status), [["default", "ok"], ["gold", "outdated"]]);
  assert.deepEqual([status.menus[1].richMenuId, status.menus[1].aliasExists], [null, true]);
});

test("describeChannel: an alias pointing at a deleted menu is missing but the alias exists", () => {
  const def = definition();
  const remote = remoteFor(def);
  remote.menus = remote.menus.filter((menu) => menu.richMenuId !== "rm-gold");
  const status = describeChannel(def, remote);
  assert.deepEqual(states(status), [["default", "ok"], ["gold", "missing"]]);
  assert.equal(status.menus[1].aliasExists, true);
  assert.equal(status.state, "out-of-date");
});

test("describeChannel: a level removed from the list leaves an alias to remove", () => {
  const before = definition();
  const after = definition({ menus: [before.menus[0]] });
  const status = describeChannel(after, remoteFor(before));
  assert.equal(status.state, "out-of-date");
  assert.deepEqual([status.removedAliases, status.removedKeys], [["vsq-gold"], ["gold"]]);
  // เมนูของระดับที่ถูกลบยังมี alias ชี้อยู่ จึงยังไม่นับเป็นเมนูค้าง
  assert.deepEqual(status.staleMenus, []);
});

test("describeChannel: this app's menus that no alias points at are stale", () => {
  const def = definition();
  const remote = remoteFor(def);
  remote.menus.push({ richMenuId: "rm-old-gold", name: "vsq|gold|0000000000000000" }, { richMenuId: "rm-old-silver", name: "vsq|silver|1111111111111111" });
  const status = describeChannel(def, remote);
  assert.equal(status.state, "out-of-date");
  assert.deepEqual(status.staleMenus, [{ richMenuId: "rm-old-gold", key: "gold" }, { richMenuId: "rm-old-silver", key: "silver" }]);
  assert.deepEqual(states(status), [["default", "ok"], ["gold", "ok"]]);
});

test("describeChannel: a wrong or missing default menu is out of date", () => {
  const def = definition();
  for (const defaultRichMenuId of [null, "rm-gold", "rm-somewhere-else"]) {
    const status = describeChannel(def, { ...remoteFor(def), defaultRichMenuId });
    assert.equal(status.state, "out-of-date", String(defaultRichMenuId));
    assert.equal(status.defaultOk, false);
    assert.deepEqual(states(status), [["default", "ok"], ["gold", "ok"]]);
  }
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test test/richMenuPlan.test.js`
Expected: FAIL — `Cannot find module '../services/richMenuPlan'`.

- [ ] **Step 3: Write the implementation**

Create `services/richMenuPlan.js`:

```js
// ส่วนคำนวณล้วนของ Rich Menu: ชื่อบน LINE, object ที่ส่งให้ LINE และสถานะของ OA เทียบกับ data/richmenu.json
const crypto = require("crypto");

const NAME_PREFIX = "vsq";
const ALIAS_PREFIX = "vsq-";
const MANAGED_NAME = /^vsq\|([a-z0-9-]{1,20})\|([0-9a-f]{16})$/;

const aliasFor = (key) => `${ALIAS_PREFIX}${key}`;

function toLineArea(area) {
  const action =
    area.action.type === "message"
      ? { type: "message", text: area.action.text }
      : { type: "uri", uri: area.action.uri };
  return { bounds: { x: area.x, y: area.y, width: area.width, height: area.height }, action };
}

// ค่าที่ทำให้เมนูบน LINE ต้องถูกสร้างใหม่เมื่อเปลี่ยน (label ไม่เกี่ยว เพราะไม่ได้ส่งไป LINE)
function menuHash(definition, menu) {
  const canonical = JSON.stringify({
    size: { width: definition.size.width, height: definition.size.height },
    chatBarText: definition.chatBarText,
    selected: definition.selected,
    areas: definition.areas.map(toLineArea),
    image: menu.image,
  });
  return crypto.createHash("sha256").update(canonical).digest("hex").slice(0, 16);
}

const menuName = (definition, menu) => `${NAME_PREFIX}|${menu.key}|${menuHash(definition, menu)}`;

// เมนูของแอปนี้คืน { key, hash } เมนูของระบบอื่นคืน null
function parseManagedName(name) {
  const match = MANAGED_NAME.exec(typeof name === "string" ? name : "");
  return match ? { key: match[1], hash: match[2] } : null;
}

function toLineRichMenu(definition, menu) {
  return {
    size: { width: definition.size.width, height: definition.size.height },
    selected: definition.selected,
    name: menuName(definition, menu),
    chatBarText: definition.chatBarText,
    areas: definition.areas.map(toLineArea),
  };
}

const emptyStatus = (state, message, foreignMenus = []) => ({
  state,
  message,
  menus: [],
  staleMenus: [],
  removedAliases: [],
  removedKeys: [],
  foreignMenus,
  defaultOk: false,
});

// remote = { menus: [{ richMenuId, name }], aliases: [{ richMenuAliasId, richMenuId }], defaultRichMenuId }
function describeChannel(definition, remote) {
  const foreignMenus = remote.menus.filter((menu) => !parseManagedName(menu.name)).map((menu) => menu.name);
  if (foreignMenus.length) {
    return emptyStatus(
      "blocked",
      `OA นี้มี Rich Menu ที่ระบบอื่นสร้างไว้ ${foreignMenus.length} เมนู แอปนี้จะไม่แตะเมนูเหล่านั้น จึงยัง sync OA นี้ไม่ได้`,
      foreignMenus
    );
  }
  if (!definition.menus.length) {
    return emptyStatus("empty", "ยังไม่มีเมนูในรายการ เพิ่มเมนูแล้วบันทึกก่อน");
  }

  const remoteById = new Map(remote.menus.map((menu) => [menu.richMenuId, menu]));
  const aliasTargets = new Map(
    remote.aliases
      .filter((alias) => alias.richMenuAliasId.startsWith(ALIAS_PREFIX))
      .map((alias) => [alias.richMenuAliasId, alias.richMenuId])
  );

  const menus = definition.menus.map((menu) => {
    const aliasId = aliasFor(menu.key);
    const current = remoteById.get(aliasTargets.get(aliasId));
    let state = "missing";
    if (current) state = current.name === menuName(definition, menu) ? "ok" : "outdated";
    return {
      key: menu.key,
      label: menu.label,
      isDefault: menu.isDefault === true,
      state,
      richMenuId: state === "ok" ? current.richMenuId : null,
      aliasExists: aliasTargets.has(aliasId),
    };
  });

  const keys = new Set(definition.menus.map((menu) => menu.key));
  const removedAliases = [...aliasTargets.keys()].filter((aliasId) => !keys.has(aliasId.slice(ALIAS_PREFIX.length)));
  const removedKeys = removedAliases.map((aliasId) => aliasId.slice(ALIAS_PREFIX.length));

  // เมนูค้าง = เมนูของแอปนี้ที่ไม่มี alias ชี้อยู่ (รุ่นเก่าที่ถูกแทน หรือสร้างค้างไว้จากรอบที่ล้ม)
  const aliased = new Set(aliasTargets.values());
  const staleMenus = remote.menus
    .filter((menu) => !aliased.has(menu.richMenuId))
    .map((menu) => ({ richMenuId: menu.richMenuId, key: parseManagedName(menu.name).key }));

  const defaultMenu = menus.find((menu) => menu.isDefault);
  const defaultOk = Boolean(defaultMenu && defaultMenu.richMenuId && defaultMenu.richMenuId === remote.defaultRichMenuId);

  const inSync =
    menus.every((menu) => menu.state === "ok") && removedAliases.length === 0 && staleMenus.length === 0 && defaultOk;

  return {
    state: inSync ? "in-sync" : "out-of-date",
    message: inSync ? "ตรงกับที่บันทึกไว้" : "ยังไม่ตรงกับที่บันทึกไว้",
    menus,
    staleMenus,
    removedAliases,
    removedKeys,
    foreignMenus: [],
    defaultOk,
  };
}

module.exports = { aliasFor, menuHash, menuName, parseManagedName, toLineRichMenu, describeChannel, ALIAS_PREFIX };
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test test/richMenuPlan.test.js`
Expected: `# tests 14`, `# pass 14`, `# fail 0`.

- [ ] **Step 5: Commit**

```bash
git add services/richMenuPlan.js test/richMenuPlan.test.js
git commit -m "feat: compute rich menu names and the status of an OA" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: LINE adapter for rich menus

**Files:**
- Create: `services/lineRichMenuApi.js`
- Test: `test/lineRichMenuApi.test.js`

**Interfaces:**
- Consumes: a `Channel` from `services/channels.js` (`{ id, name, channelAccessToken, … }`).
- Produces:
  - `createLineRichMenuApi(channel, { client, blobClient } = {})` → the LINE interface used by Task 5 and Task 6:
    `readState()` → `remote` (shape in Task 3); `createMenu(lineRichMenu)` → `richMenuId`; `uploadImage(richMenuId, buffer, contentType)`; `createAlias(aliasId, richMenuId)`; `updateAlias(aliasId, richMenuId)`; `deleteAlias(aliasId)`; `startBatch(operations)` → `requestId`; `batchPhase(requestId)` → `"ongoing" | "succeeded" | "failed"`; `setDefault(richMenuId)`; `deleteMenu(richMenuId)`. All return promises.
  - `describeLineError(error)` → string with message, HTTP status and at most 300 characters of LINE's error body.

- [ ] **Step 1: Write the failing tests**

Create `test/lineRichMenuApi.test.js`:

```js
const test = require("node:test");
const assert = require("node:assert/strict");
const { createLineRichMenuApi, describeLineError } = require("../services/lineRichMenuApi");

const channel = { id: 2, name: "OA 2", channelAccessToken: "tok-BBB", channelSecret: "sec-BBB", forwardUrl: null };
const notFound = () => Object.assign(new Error("404 - Not Found"), { status: 404, body: '{"message":"no default rich menu"}' });

// client ปลอมของ SDK ที่บันทึกทุกคำสั่งที่ถูกเรียก
function stubs(over = {}) {
  const calls = [];
  const record = (name, result) => async (...args) => {
    calls.push([name, ...args]);
    return typeof result === "function" ? result(...args) : result;
  };
  const client = {
    getRichMenuList: record("getRichMenuList", { richmenus: [{ richMenuId: "rm-1", name: "vsq|gold|0123456789abcdef", size: { width: 2500, height: 1686 }, chatBarText: "Menu", areas: [] }] }),
    getRichMenuAliasList: record("getRichMenuAliasList", { aliases: [{ richMenuAliasId: "vsq-gold", richMenuId: "rm-1" }] }),
    getDefaultRichMenuId: record("getDefaultRichMenuId", { richMenuId: "rm-1" }),
    createRichMenu: record("createRichMenu", { richMenuId: "rm-new" }),
    createRichMenuAlias: record("createRichMenuAlias", {}),
    updateRichMenuAlias: record("updateRichMenuAlias", {}),
    deleteRichMenuAlias: record("deleteRichMenuAlias", {}),
    richMenuBatchWithHttpInfo: record("richMenuBatchWithHttpInfo", () => ({ httpResponse: new Response(null, { status: 202, headers: { "x-line-request-id": "request-9" } }), body: {} })),
    getRichMenuBatchProgress: record("getRichMenuBatchProgress", { phase: "succeeded", acceptedTime: "2026-10-07T00:00:00Z" }),
    setDefaultRichMenu: record("setDefaultRichMenu", {}),
    deleteRichMenu: record("deleteRichMenu", {}),
    ...over,
  };
  const blobClient = { setRichMenuImage: record("setRichMenuImage", {}) };
  return { calls, api: createLineRichMenuApi(channel, { client, blobClient }) };
}

test("readState keeps only the fields the sync needs", async () => {
  const { api } = stubs();
  assert.deepEqual(await api.readState(), {
    menus: [{ richMenuId: "rm-1", name: "vsq|gold|0123456789abcdef" }],
    aliases: [{ richMenuAliasId: "vsq-gold", richMenuId: "rm-1" }],
    defaultRichMenuId: "rm-1",
  });
});

test("readState: no default menu (LINE answers 404) is null, any other failure is passed on", async () => {
  const none = stubs({ getDefaultRichMenuId: async () => { throw notFound(); } });
  assert.equal((await none.api.readState()).defaultRichMenuId, null);

  const denied = Object.assign(new Error("401 - Unauthorized"), { status: 401 });
  const broken = stubs({ getDefaultRichMenuId: async () => { throw denied; } });
  await assert.rejects(broken.api.readState(), denied);

  const empty = stubs({ getRichMenuList: async () => ({}), getRichMenuAliasList: async () => ({}) });
  assert.deepEqual(await empty.api.readState(), { menus: [], aliases: [], defaultRichMenuId: "rm-1" });
});

test("createMenu passes the object through and returns the new ID", async () => {
  const { api, calls } = stubs();
  const richMenu = { size: { width: 2500, height: 1686 }, selected: true, name: "vsq|gold|0123456789abcdef", chatBarText: "Menu", areas: [] };
  assert.equal(await api.createMenu(richMenu), "rm-new");
  assert.deepEqual(calls, [["createRichMenu", richMenu]]);
});

test("uploadImage sends the bytes as a Blob with the image type", async () => {
  const { api, calls } = stubs();
  const bytes = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);
  await api.uploadImage("rm-new", bytes, "image/jpeg");
  const [name, richMenuId, blob] = calls[0];
  assert.deepEqual([name, richMenuId, blob.type], ["setRichMenuImage", "rm-new", "image/jpeg"]);
  assert.deepEqual(Buffer.from(await blob.arrayBuffer()), bytes);
});

test("alias, default and delete commands use the argument shapes of the SDK", async () => {
  const { api, calls } = stubs();
  await api.createAlias("vsq-gold", "rm-new");
  await api.updateAlias("vsq-gold", "rm-newer");
  await api.deleteAlias("vsq-silver");
  await api.setDefault("rm-new");
  await api.deleteMenu("rm-old");
  assert.deepEqual(calls, [
    ["createRichMenuAlias", { richMenuAliasId: "vsq-gold", richMenuId: "rm-new" }],
    ["updateRichMenuAlias", "vsq-gold", { richMenuId: "rm-newer" }],
    ["deleteRichMenuAlias", "vsq-silver"],
    ["setDefaultRichMenu", "rm-new"],
    ["deleteRichMenu", "rm-old"],
  ]);
});

test("startBatch wraps the operations and returns LINE's request ID; batchPhase reads the phase", async () => {
  const { api, calls } = stubs();
  const operations = [{ type: "link", from: "rm-old", to: "rm-new" }, { type: "unlink", from: "rm-gone" }];
  assert.equal(await api.startBatch(operations), "request-9");
  assert.equal(await api.batchPhase("request-9"), "succeeded");
  assert.deepEqual(calls, [["richMenuBatchWithHttpInfo", { operations }], ["getRichMenuBatchProgress", "request-9"]]);
});

test("describeLineError keeps the status and a bounded part of the body, and never the token", () => {
  const sdkError = Object.assign(new Error("400 - Bad Request"), {
    status: 400,
    statusText: "Bad Request",
    headers: new Headers({ authorization: "Bearer tok-BBB" }),
    body: '{"message":"The request body has 1 error(s)","details":[{"message":"must upload richmenu image"}]}',
  });
  const text = describeLineError(sdkError);
  assert.match(text, /^400 - Bad Request \(HTTP 400\) \{"message":"The request body has 1 error/);
  assert.ok(!text.includes("tok-BBB"));

  assert.equal(describeLineError(new Error("socket hang up")), "socket hang up");
  assert.equal(describeLineError("plain"), "plain");
  assert.equal(describeLineError(undefined), "undefined");
  const long = describeLineError(Object.assign(new Error("500 - Server Error"), { status: 500, body: "x".repeat(5000) }));
  assert.equal(long.length, "500 - Server Error (HTTP 500) ".length + 300);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test test/lineRichMenuApi.test.js`
Expected: FAIL — `Cannot find module '../services/lineRichMenuApi'`.

- [ ] **Step 3: Write the implementation**

Create `services/lineRichMenuApi.js`:

```js
// ตัวเชื่อมบาง ๆ ระหว่าง services/richMenuSync.js กับ @line/bot-sdk ของหนึ่ง OA
const line = require("@line/bot-sdk");

// ข้อความสำหรับ log และหน้าจอ — ไม่ส่ง object error ของ SDK ออกไปทั้งก้อน
function describeLineError(error) {
  if (!error || typeof error !== "object") return String(error);
  const status = error.status || error.statusCode;
  const body = typeof error.body === "string" && error.body ? ` ${error.body.slice(0, 300)}` : "";
  return `${error.message}${status ? ` (HTTP ${status})` : ""}${body}`;
}

function createLineRichMenuApi(channel, clients = {}) {
  const config = { channelAccessToken: channel.channelAccessToken };
  const client = clients.client || new line.messagingApi.MessagingApiClient(config);
  const blobClient = clients.blobClient || new line.messagingApi.MessagingApiBlobClient(config);

  // LINE ตอบ 404 เมื่อยังไม่ได้ตั้งเมนูเริ่มต้นผ่าน API
  async function getDefaultRichMenuId() {
    try {
      return (await client.getDefaultRichMenuId()).richMenuId || null;
    } catch (error) {
      if (error && error.status === 404) return null;
      throw error;
    }
  }

  return {
    async readState() {
      const [list, aliasList, defaultRichMenuId] = await Promise.all([
        client.getRichMenuList(),
        client.getRichMenuAliasList(),
        getDefaultRichMenuId(),
      ]);
      return {
        menus: (list.richmenus || []).map((menu) => ({ richMenuId: menu.richMenuId, name: menu.name })),
        aliases: (aliasList.aliases || []).map((alias) => ({
          richMenuAliasId: alias.richMenuAliasId,
          richMenuId: alias.richMenuId,
        })),
        defaultRichMenuId,
      };
    },
    async createMenu(richMenu) {
      return (await client.createRichMenu(richMenu)).richMenuId;
    },
    async uploadImage(richMenuId, buffer, contentType) {
      await blobClient.setRichMenuImage(richMenuId, new Blob([buffer], { type: contentType }));
    },
    async createAlias(richMenuAliasId, richMenuId) {
      await client.createRichMenuAlias({ richMenuAliasId, richMenuId });
    },
    async updateAlias(richMenuAliasId, richMenuId) {
      await client.updateRichMenuAlias(richMenuAliasId, { richMenuId });
    },
    async deleteAlias(richMenuAliasId) {
      await client.deleteRichMenuAlias(richMenuAliasId);
    },
    // คืน request ID ที่ใช้ถามความคืบหน้าของการย้ายลูกค้า
    async startBatch(operations) {
      const response = await client.richMenuBatchWithHttpInfo({ operations });
      return response.httpResponse.headers.get("x-line-request-id");
    },
    async batchPhase(requestId) {
      return (await client.getRichMenuBatchProgress(requestId)).phase;
    },
    async setDefault(richMenuId) {
      await client.setDefaultRichMenu(richMenuId);
    },
    async deleteMenu(richMenuId) {
      await client.deleteRichMenu(richMenuId);
    },
  };
}

module.exports = { createLineRichMenuApi, describeLineError };
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test test/lineRichMenuApi.test.js`
Expected: `# tests 7`, `# pass 7`, `# fail 0`.

- [ ] **Step 5: Commit**

```bash
git add services/lineRichMenuApi.js test/lineRichMenuApi.test.js
git commit -m "feat: thin LINE SDK adapter for rich menu commands" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Sync one OA

**Files:**
- Create: `services/richMenuSync.js`, `test-helpers/fakeLineRichMenuApi.js`
- Test: `test/richMenuSync.test.js`

**Interfaces:**
- Consumes: `describeChannel`, `toLineRichMenu`, `aliasFor`, `menuName` (Task 3); the LINE interface and `describeLineError` (Task 4); `loadMenuImage` (Task 2).
- Produces:
  - `syncChannel({ definition, api, loadImage = loadMenuImage, sleep, pollLimit = 30 })` → `Promise<{ ok: boolean, steps: string[], message: string }>`. Never rejects.
  - Test helper `createFakeLine({ menus, aliases, defaultRichMenuId, links })` → `{ api, calls, orphanedUsers, lostDefault, failNext(name), setBatchOutcome(outcome), link(userId, richMenuId), addMenu(richMenuId, name), idOfAlias(aliasId), menu(richMenuId), snapshot() }`. `api` has the interface from Task 4; `calls` lists write commands in order; `snapshot()` returns `{ menus: [name], aliases: { aliasId: name }, defaultMenu: name | null, links: { userId: name } }`.

- [ ] **Step 1: Write the fake LINE and the failing tests**

Create `test-helpers/fakeLineRichMenuApi.js`:

```js
// LINE จำลองในหน่วยความจำของหนึ่ง OA สำหรับเทสต์ Rich Menu
// มี interface เดียวกับ services/lineRichMenuApi.js และเก็บเมนู, alias, เมนูเริ่มต้น, การผูกลูกค้า
// อยู่นอกโฟลเดอร์ test/ เพราะ `node --test` รันทุกไฟล์ .js ใน test/ เป็นเทสต์
function createFakeLine({ menus = [], aliases = [], defaultRichMenuId = null, links = {} } = {}) {
  const state = {
    menus: new Map(menus.map((menu) => [menu.richMenuId, { ...menu, hasImage: true }])),
    aliases: new Map(aliases.map((alias) => [alias.richMenuAliasId, alias.richMenuId])),
    defaultRichMenuId,
    links: new Map(Object.entries(links)), // userId -> richMenuId
    batches: new Map(), // requestId -> phase
  };
  const calls = []; // ชื่อคำสั่งเขียนที่ถูกเรียก ตามลำดับ
  const failing = new Set(); // คำสั่งที่จะล้มในการเรียกครั้งถัดไป (ครั้งเดียว)
  const orphanedUsers = []; // ลูกค้าที่เมนูของตัวเองถูกลบทั้งที่ยังผูกอยู่
  let lostDefault = false; // เมนูเริ่มต้นถูกลบโดยยังไม่ได้ตั้งอันใหม่
  let batchOutcome = "succeeded";
  let nextId = 1;

  const lineError = (status, message) => Object.assign(new Error(`${status} - ${message}`), { status, body: JSON.stringify({ message }) });

  function record(name) {
    calls.push(name);
    if (failing.delete(name)) throw lineError(500, `${name} failed`);
  }
  function requireMenu(richMenuId, { withImage = false } = {}) {
    const menu = state.menus.get(richMenuId);
    if (!menu) throw lineError(404, "richmenu not found");
    if (withImage && !menu.hasImage) throw lineError(400, "must upload richmenu image before applying it");
    return menu;
  }

  const api = {
    async readState() {
      return {
        menus: [...state.menus.values()].map((menu) => ({ richMenuId: menu.richMenuId, name: menu.name })),
        aliases: [...state.aliases].map(([richMenuAliasId, richMenuId]) => ({ richMenuAliasId, richMenuId })),
        defaultRichMenuId: state.defaultRichMenuId,
      };
    },
    async createMenu(richMenu) {
      record("createMenu");
      const richMenuId = `richmenu-${nextId}`;
      nextId += 1;
      state.menus.set(richMenuId, { richMenuId, name: richMenu.name, richMenu, hasImage: false });
      return richMenuId;
    },
    async uploadImage(richMenuId, buffer, contentType) {
      record("uploadImage");
      const menu = requireMenu(richMenuId);
      menu.hasImage = true;
      menu.image = { bytes: buffer.length, contentType };
    },
    async createAlias(richMenuAliasId, richMenuId) {
      record("createAlias");
      requireMenu(richMenuId, { withImage: true });
      if (state.aliases.has(richMenuAliasId)) throw lineError(400, "conflict richmenu alias id");
      state.aliases.set(richMenuAliasId, richMenuId);
    },
    async updateAlias(richMenuAliasId, richMenuId) {
      record("updateAlias");
      requireMenu(richMenuId, { withImage: true });
      if (!state.aliases.has(richMenuAliasId)) throw lineError(404, "richmenu alias not found");
      state.aliases.set(richMenuAliasId, richMenuId);
    },
    async deleteAlias(richMenuAliasId) {
      record("deleteAlias");
      if (!state.aliases.delete(richMenuAliasId)) throw lineError(404, "richmenu alias not found");
    },
    async startBatch(operations) {
      record("startBatch");
      for (const operation of operations) {
        requireMenu(operation.from);
        if (operation.type === "link") requireMenu(operation.to, { withImage: true });
      }
      const requestId = `request-${state.batches.size + 1}`;
      state.batches.set(requestId, batchOutcome);
      if (batchOutcome === "succeeded") {
        for (const operation of operations) {
          for (const [userId, richMenuId] of [...state.links]) {
            if (richMenuId !== operation.from) continue;
            if (operation.type === "link") state.links.set(userId, operation.to);
            else state.links.delete(userId);
          }
        }
      }
      return requestId;
    },
    async batchPhase(requestId) {
      return state.batches.get(requestId);
    },
    async setDefault(richMenuId) {
      record("setDefault");
      requireMenu(richMenuId, { withImage: true });
      state.defaultRichMenuId = richMenuId;
    },
    async deleteMenu(richMenuId) {
      record("deleteMenu");
      requireMenu(richMenuId);
      state.menus.delete(richMenuId);
      if (state.defaultRichMenuId === richMenuId) {
        state.defaultRichMenuId = null;
        lostDefault = true;
      }
      for (const [userId, linked] of [...state.links]) {
        if (linked === richMenuId) {
          state.links.delete(userId);
          orphanedUsers.push(userId);
        }
      }
    },
  };

  return {
    api,
    calls,
    orphanedUsers,
    get lostDefault() { return lostDefault; },
    // คำสั่งชื่อนี้จะล้มหนึ่งครั้งในการเรียกครั้งถัดไป
    failNext(name) { failing.add(name); },
    // "succeeded" | "failed" | "ongoing" — ผลของคำสั่งย้ายลูกค้าที่จะถูกส่งหลังจากนี้
    setBatchOutcome(outcome) { batchOutcome = outcome; },
    link(userId, richMenuId) { state.links.set(userId, richMenuId); },
    addMenu(richMenuId, name) { state.menus.set(richMenuId, { richMenuId, name, hasImage: true }); },
    idOfAlias(richMenuAliasId) { return state.aliases.get(richMenuAliasId) || null; },
    menu(richMenuId) { return state.menus.get(richMenuId) || null; },
    // ภาพรวมที่อ่านง่ายสำหรับ assert: ใช้ชื่อเมนูแทน ID
    snapshot() {
      const nameOf = (richMenuId) => (state.menus.get(richMenuId) || { name: `(deleted ${richMenuId})` }).name;
      return {
        menus: [...state.menus.values()].map((menu) => menu.name).sort(),
        aliases: Object.fromEntries([...state.aliases].map(([aliasId, richMenuId]) => [aliasId, nameOf(richMenuId)])),
        defaultMenu: state.defaultRichMenuId ? nameOf(state.defaultRichMenuId) : null,
        links: Object.fromEntries([...state.links].map(([userId, richMenuId]) => [userId, nameOf(richMenuId)])),
      };
    },
  };
}

module.exports = { createFakeLine };
```

Create `test/richMenuSync.test.js`:

```js
const test = require("node:test");
const assert = require("node:assert/strict");
const { syncChannel } = require("../services/richMenuSync");
const { describeChannel, menuName } = require("../services/richMenuPlan");
const { createFakeLine } = require("../test-helpers/fakeLineRichMenuApi");

const level = (key, label, isDefault = false, image = `https://img.example/${key}.jpg`) => ({ key, label, image, isDefault });
const definition = (over = {}) => ({
  size: { width: 2500, height: 1686 },
  chatBarText: "Menu",
  selected: true,
  areas: [
    { x: 1596, y: 0, width: 904, height: 1084, action: { type: "uri", uri: "https://liff.line.me/x" } },
    { x: 0, y: 1082, width: 833, height: 604, action: { type: "message", text: "บริการทั้งหมด" } },
  ],
  menus: [level("default", "ก่อนสมัคร", true), level("gold", "V Gold"), level("silver", "V Silver", false, "https://img.example/silver.png")],
  ...over,
});
const editedAreas = (def) => [{ ...def.areas[0], width: 900 }, def.areas[1]];

const loadImage = async (url) => ({ buffer: Buffer.from(url), contentType: url.endsWith(".png") ? "image/png" : "image/jpeg" });
const run = (fake, def, extra = {}) => syncChannel({ definition: def, api: fake.api, loadImage, sleep: async () => {}, pollLimit: 3, ...extra });
const stateOf = async (fake, def) => describeChannel(def, await fake.api.readState()).state;
const names = (def) => Object.fromEntries(def.menus.map((menu) => [menu.key, menuName(def, menu)]));

// OA ที่ sync ตาม def แล้ว พร้อมลูกค้าที่ผูกกับเมนูของแต่ละระดับ (users: { userId: key })
async function syncedOa(def, users = {}) {
  const fake = createFakeLine();
  assert.equal((await run(fake, def)).ok, true);
  for (const [userId, key] of Object.entries(users)) fake.link(userId, fake.idOfAlias(`vsq-${key}`));
  fake.calls.length = 0;
  return fake;
}

test("a fresh OA gets every menu, its alias, its image and the default", async () => {
  const def = definition();
  const fake = createFakeLine();
  const result = await run(fake, def);

  assert.equal(result.ok, true);
  assert.deepEqual(fake.calls, [
    "createMenu", "uploadImage", "createAlias",
    "createMenu", "uploadImage", "createAlias",
    "createMenu", "uploadImage", "createAlias",
    "setDefault",
  ]);
  const expected = names(def);
  assert.deepEqual(fake.snapshot(), {
    menus: Object.values(expected).sort(),
    aliases: { "vsq-default": expected.default, "vsq-gold": expected.gold, "vsq-silver": expected.silver },
    defaultMenu: expected.default,
    links: {},
  });
  assert.equal(fake.menu(fake.idOfAlias("vsq-gold")).image.contentType, "image/jpeg");
  assert.equal(fake.menu(fake.idOfAlias("vsq-silver")).image.contentType, "image/png");
  assert.deepEqual(fake.menu(fake.idOfAlias("vsq-gold")).richMenu.areas[1], { bounds: { x: 0, y: 1082, width: 833, height: 604 }, action: { type: "message", text: "บริการทั้งหมด" } });
  assert.equal(await stateOf(fake, def), "in-sync");
  assert.ok(result.steps.length > 0);
});

test("syncing again right away sends no write command", async () => {
  const def = definition();
  const fake = await syncedOa(def);
  const result = await run(fake, def);
  assert.equal(result.ok, true);
  assert.match(result.message, /ตรงกับที่บันทึกไว้อยู่แล้ว/);
  assert.deepEqual(fake.calls, []);
});

test("editing the tap areas replaces every menu and moves linked customers along", async () => {
  const before = definition();
  const fake = await syncedOa(before, { "u-default": "default", "u-gold-1": "gold", "u-gold-2": "gold", "u-silver": "silver" });
  const after = definition({ areas: editedAreas(before) });

  const result = await run(fake, after);

  assert.equal(result.ok, true);
  const expected = names(after);
  assert.deepEqual(fake.snapshot(), {
    menus: Object.values(expected).sort(),
    aliases: { "vsq-default": expected.default, "vsq-gold": expected.gold, "vsq-silver": expected.silver },
    defaultMenu: expected.default,
    links: { "u-default": expected.default, "u-gold-1": expected.gold, "u-gold-2": expected.gold, "u-silver": expected.silver },
  });
  assert.equal(fake.calls.filter((call) => call === "startBatch").length, 1);
  assert.equal(fake.calls.filter((call) => call === "deleteMenu").length, 3);
  assert.ok(fake.calls.indexOf("setDefault") < fake.calls.indexOf("deleteMenu"), "the default must move before the old default menu is deleted");
  assert.deepEqual(fake.orphanedUsers, []);
  assert.equal(fake.lostDefault, false);
  assert.equal(await stateOf(fake, after), "in-sync");
});

test("changing one image replaces only that level", async () => {
  const before = definition();
  const fake = await syncedOa(before, { "u-gold": "gold", "u-silver": "silver" });
  const untouched = fake.idOfAlias("vsq-silver");
  const after = definition({ menus: [before.menus[0], level("gold", "V Gold", false, "https://img.example/gold-v2.jpg"), before.menus[2]] });

  assert.equal((await run(fake, after)).ok, true);

  assert.deepEqual(fake.calls, ["createMenu", "uploadImage", "updateAlias", "startBatch", "deleteMenu"]);
  assert.equal(fake.idOfAlias("vsq-silver"), untouched);
  assert.deepEqual(fake.snapshot().links, { "u-gold": names(after).gold, "u-silver": names(after).silver });
  assert.deepEqual(fake.orphanedUsers, []);
});

test("removing a level unlinks its customers and deletes its alias and menu", async () => {
  const before = definition();
  const fake = await syncedOa(before, { "u-gold": "gold", "u-silver": "silver" });
  const after = definition({ menus: [before.menus[0], before.menus[1]] });

  assert.equal((await run(fake, after)).ok, true);

  assert.deepEqual(fake.calls, ["deleteAlias", "startBatch", "deleteMenu"]);
  const expected = names(after);
  assert.deepEqual(fake.snapshot(), {
    menus: [expected.default, expected.gold].sort(),
    aliases: { "vsq-default": expected.default, "vsq-gold": expected.gold },
    defaultMenu: expected.default,
    links: { "u-gold": expected.gold },
  });
  // ลูกค้าของระดับที่ถูกลบถูกยกเลิกการผูกก่อน ไม่ใช่หลุดเพราะเมนูถูกลบ
  assert.deepEqual(fake.orphanedUsers, []);
});

test("choosing another default menu only sets the default", async () => {
  const before = definition();
  const fake = await syncedOa(before);
  const after = definition({ menus: [level("default", "ก่อนสมัคร", false), level("gold", "V Gold", true), before.menus[2]] });

  assert.equal((await run(fake, after)).ok, true);

  assert.deepEqual(fake.calls, ["setDefault"]);
  assert.equal(fake.snapshot().defaultMenu, names(after).gold);
});

test("a failure at any step is recovered by syncing again, with no customer or default lost", async () => {
  const before = definition();
  // แก้พื้นที่กด (แทนทุกเมนู), ลบ silver, เพิ่ม platinum, เปลี่ยนเมนูเริ่มต้นเป็น gold — ให้เกิดคำสั่งเขียนครบทุกชนิด
  const after = definition({
    areas: editedAreas(before),
    menus: [level("default", "ก่อนสมัคร", false), level("gold", "V Gold", true), level("platinum", "V Platinum")],
  });
  const expected = names(after);

  for (const step of ["createMenu", "uploadImage", "updateAlias", "createAlias", "deleteAlias", "startBatch", "setDefault", "deleteMenu"]) {
    const fake = await syncedOa(before, { "u-default": "default", "u-gold": "gold", "u-silver": "silver" });
    fake.failNext(step);

    const first = await run(fake, after);
    assert.equal(first.ok, false, step);
    assert.match(first.message, /LINE ปฏิเสธคำสั่ง/, step);
    assert.ok(fake.calls.includes(step), `${step} was never called, so this scenario does not cover it`);

    const second = await run(fake, after);
    assert.equal(second.ok, true, `${step}: ${second.message}`);
    assert.deepEqual(fake.snapshot(), {
      menus: Object.values(expected).sort(),
      aliases: { "vsq-default": expected.default, "vsq-gold": expected.gold, "vsq-platinum": expected.platinum },
      defaultMenu: expected.gold,
      links: { "u-default": expected.default, "u-gold": expected.gold },
    }, step);
    assert.deepEqual(fake.orphanedUsers, [], step);
    assert.equal(fake.lostDefault, false, step);
    assert.equal(await stateOf(fake, after), "in-sync", step);
  }
});

test("old menus are kept while LINE has not finished moving customers, and removed by a later sync", async () => {
  for (const outcome of ["ongoing", "failed"]) {
    const before = definition();
    const fake = await syncedOa(before, { "u-gold": "gold" });
    const after = definition({ areas: editedAreas(before) });
    fake.setBatchOutcome(outcome);

    const first = await run(fake, after);
    assert.equal(first.ok, false, outcome);
    assert.match(first.message, /ยังย้ายลูกค้าออกจากเมนูเก่าไม่เสร็จ/, outcome);
    assert.equal(fake.calls.includes("deleteMenu"), false, outcome);
    assert.equal(fake.snapshot().menus.length, 6, outcome);
    assert.equal(fake.snapshot().links["u-gold"], names(before).gold, outcome);
    // เมนูเริ่มต้นและ alias ชี้ไปเมนูใหม่แล้ว ลูกค้าใหม่จึงเห็นเมนูใหม่ทันที
    assert.equal(fake.snapshot().defaultMenu, names(after).default, outcome);

    fake.setBatchOutcome("succeeded");
    assert.equal((await run(fake, after)).ok, true, outcome);
    assert.equal(fake.snapshot().menus.length, 3, outcome);
    assert.equal(fake.snapshot().links["u-gold"], names(after).gold, outcome);
    assert.deepEqual(fake.orphanedUsers, [], outcome);
    assert.equal(await stateOf(fake, after), "in-sync", outcome);
  }
});

test("an OA with a menu from another system is never written to", async () => {
  const fake = createFakeLine({ menus: [{ richMenuId: "richmenu-legacy", name: "V Gold Richmenu 06/10/2026" }], defaultRichMenuId: "richmenu-legacy", links: { "u-1": "richmenu-legacy" } });
  const result = await run(fake, definition());
  assert.equal(result.ok, false);
  assert.match(result.message, /ระบบอื่นสร้างไว้/);
  assert.deepEqual(fake.calls, []);
  assert.deepEqual(fake.snapshot().links, { "u-1": "V Gold Richmenu 06/10/2026" });
});

test("an empty menu list is never synced", async () => {
  const fake = await syncedOa(definition());
  const result = await run(fake, definition({ menus: [] }));
  assert.equal(result.ok, false);
  assert.match(result.message, /ยังไม่มีเมนูในรายการ/);
  assert.deepEqual(fake.calls, []);
});

test("an image that fails its check stops the sync before anything is sent to LINE", async () => {
  const fake = createFakeLine();
  const failing = async (url, size) => {
    if (url.includes("gold")) throw new Error("ไฟล์รูปใหญ่เกิน 1 MB");
    return loadImage(url, size);
  };
  const result = await run(fake, definition(), { loadImage: failing });
  assert.equal(result.ok, false);
  assert.match(result.message, /รูปไม่ผ่านการตรวจ — V Gold: ไฟล์รูปใหญ่เกิน 1 MB/);
  assert.deepEqual(fake.calls, []);
});

test("an alias left pointing at a deleted menu is updated rather than created again", async () => {
  const def = definition({ menus: [level("default", "ก่อนสมัคร", true), level("gold", "V Gold")] });
  const fake = createFakeLine({ aliases: [{ richMenuAliasId: "vsq-gold", richMenuId: "richmenu-gone" }] });
  const result = await run(fake, def);
  assert.equal(result.ok, true, result.message);
  assert.deepEqual(fake.calls, ["createMenu", "uploadImage", "createAlias", "createMenu", "uploadImage", "updateAlias", "setDefault"]);
  assert.equal(await stateOf(fake, def), "in-sync");
});

test("a LINE error comes back as a message with its status and body, not as an exception", async () => {
  const fake = createFakeLine();
  fake.failNext("createMenu");
  const result = await run(fake, definition());
  assert.equal(result.ok, false);
  assert.match(result.message, /HTTP 500/);
  assert.match(result.message, /createMenu failed/);
  assert.deepEqual(result.steps, ["ตรวจรูปครบ 3 เมนู"]);
});

test("the wait for LINE to move customers is bounded by pollLimit", async () => {
  const before = definition();
  const fake = await syncedOa(before);
  fake.setBatchOutcome("ongoing");
  const naps = [];
  await run(fake, definition({ areas: editedAreas(before) }), { sleep: async (ms) => { naps.push(ms); }, pollLimit: 5 });
  assert.deepEqual(naps, [1000, 1000, 1000, 1000]);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test test/richMenuSync.test.js`
Expected: FAIL — `Cannot find module '../services/richMenuSync'`.

- [ ] **Step 3: Write the implementation**

Create `services/richMenuSync.js`:

```js
// sync ชุด Rich Menu ใน data/richmenu.json ไปยัง LINE OA หนึ่งบัญชี
// ทุกขั้นคำนวณจากสถานะจริงบน LINE จึงเรียกซ้ำหลังล้มเหลวได้ และจะทำต่อจากจุดที่ค้าง
const { describeChannel, toLineRichMenu, aliasFor } = require("./richMenuPlan");
const { describeLineError } = require("./lineRichMenuApi");
const { loadMenuImage } = require("./richMenuImages");

const POLL_INTERVAL_MS = 1000;
const POLL_LIMIT = 30;

const defaultSleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// api คือ interface ของ services/lineRichMenuApi.js — คืน { ok, steps: [ข้อความ], message }
async function syncChannel({ definition, api, loadImage = loadMenuImage, sleep = defaultSleep, pollLimit = POLL_LIMIT }) {
  const steps = [];
  const stop = (message) => ({ ok: false, steps, message });

  try {
    let status = describeChannel(definition, await api.readState());
    if (status.state === "blocked" || status.state === "empty") return stop(status.message);
    if (status.state === "in-sync") return { ok: true, steps, message: "เมนูตรงกับที่บันทึกไว้อยู่แล้ว" };

    // รูปทุกเมนูต้องผ่านก่อนจะแตะ LINE
    const images = new Map();
    const imageProblems = [];
    await Promise.all(
      definition.menus.map(async (menu) => {
        try {
          images.set(menu.key, await loadImage(menu.image, definition.size));
        } catch (error) {
          imageProblems.push(`${menu.label}: ${error.message}`);
        }
      })
    );
    if (imageProblems.length) return stop(`รูปไม่ผ่านการตรวจ — ${imageProblems.join(" | ")}`);
    steps.push(`ตรวจรูปครบ ${definition.menus.length} เมนู`);

    // สร้างเมนูที่ยังไม่มีหรือไม่ตรง แล้วชี้ alias ของระดับนั้นไปที่เมนูใหม่
    for (const menu of status.menus.filter((item) => item.state !== "ok")) {
      const source = definition.menus.find((item) => item.key === menu.key);
      const image = images.get(menu.key);
      const richMenuId = await api.createMenu(toLineRichMenu(definition, source));
      await api.uploadImage(richMenuId, image.buffer, image.contentType);
      if (menu.aliasExists) {
        await api.updateAlias(aliasFor(menu.key), richMenuId);
      } else {
        await api.createAlias(aliasFor(menu.key), richMenuId);
      }
      steps.push(`สร้างเมนู "${menu.label}"`);
    }

    for (const aliasId of status.removedAliases) {
      await api.deleteAlias(aliasId);
      steps.push(`ลบ alias ${aliasId} ของระดับที่ถูกลบออกจากรายการ`);
    }

    // อ่านสถานะใหม่: เมนูที่ไม่มี alias ชี้แล้วคือเมนูค้างที่ต้องย้ายลูกค้าออกก่อนลบ
    status = describeChannel(definition, await api.readState());

    let moved = true;
    if (status.staleMenus.length) {
      const operations = status.staleMenus.map((stale) => {
        const target = status.menus.find((menu) => menu.key === stale.key && menu.richMenuId);
        return target
          ? { type: "link", from: stale.richMenuId, to: target.richMenuId }
          : { type: "unlink", from: stale.richMenuId };
      });
      const requestId = await api.startBatch(operations);
      steps.push(`สั่ง LINE ย้ายลูกค้าออกจากเมนูเก่า ${operations.length} เมนู`);

      let phase = await api.batchPhase(requestId);
      for (let attempt = 1; attempt < pollLimit && phase === "ongoing"; attempt += 1) {
        await sleep(POLL_INTERVAL_MS);
        phase = await api.batchPhase(requestId);
      }
      moved = phase === "succeeded";
      if (moved) steps.push("LINE ย้ายลูกค้าเสร็จแล้ว");
    }

    // ตั้งเมนูเริ่มต้นก่อนลบเมนูเก่าเสมอ — เมนูที่เป็นเมนูเริ่มต้นอยู่ต้องไม่ถูกลบ
    const defaultMenu = status.menus.find((menu) => menu.isDefault);
    if (!status.defaultOk && defaultMenu && defaultMenu.richMenuId) {
      await api.setDefault(defaultMenu.richMenuId);
      steps.push(`ตั้ง "${defaultMenu.label}" เป็นเมนูเริ่มต้น`);
    }

    if (!moved) {
      return stop("LINE ยังย้ายลูกค้าออกจากเมนูเก่าไม่เสร็จ เมนูเก่าจึงยังไม่ถูกลบ กด sync อีกครั้งภายหลัง");
    }
    for (const stale of status.staleMenus) {
      await api.deleteMenu(stale.richMenuId);
    }
    if (status.staleMenus.length) steps.push(`ลบเมนูเก่า ${status.staleMenus.length} เมนู`);

    return { ok: true, steps, message: "sync สำเร็จ" };
  } catch (error) {
    return stop(`LINE ปฏิเสธคำสั่ง: ${describeLineError(error)}`);
  }
}

module.exports = { syncChannel };
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test test/richMenuSync.test.js`
Expected: `# tests 14`, `# pass 14`, `# fail 0`.

- [ ] **Step 5: Commit**

```bash
git add services/richMenuSync.js test-helpers/fakeLineRichMenuApi.js test/richMenuSync.test.js
git commit -m "feat: sync the rich menu set to one LINE OA" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Admin API for the Rich Menu page

**Files:**
- Create: `routes/richMenuRoute.js`
- Modify: `routes/adminRoute.js`, `index.js`
- Test: `test/richMenuRoute.test.js`

**Interfaces:**
- Consumes: `store.get/set("richmenu")`, `validateRichMenu`, `normalizeRichMenu` (Task 1); `loadMenuImage`, `checkChangedImages` (Task 2); `describeChannel` (Task 3); `createLineRichMenuApi`, `describeLineError` (Task 4); `syncChannel`, `createFakeLine` (Task 5); `channels` from `loadChannels` (phase 1).
- Produces, all under `/api/admin` and behind the admin token:
  - `GET /richmenu` → the definition.
  - `PUT /richmenu` → the saved definition, or `400 { error, errors: [{ path, message }] }`.
  - `GET /richmenu/status` → `[{ id, name, state, message, menus: [{ key, label, state }], staleCount, removedKeys, foreignMenus }]`, `state` one of `error | blocked | empty | in-sync | out-of-date`.
  - `POST /richmenu/sync/:channelId` → `{ id, name, ok, steps, message }`; `404` unknown OA; `409` while another sync runs.
  - `createAdminRouter({ store, messageTable, channels = [], richMenu = {}, … })`; `richMenu` may carry `{ createApi, loadImage, sleep }` for tests.

- [ ] **Step 1: Write the failing tests**

Create `test/richMenuRoute.test.js`:

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
async function startApp({ saved = richMenu(), richMenuOptions = {} } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "vsq-richmenu-"));
  for (const name of ["promotions", "services", "branches", "regions"]) fs.writeFileSync(path.join(dir, `${name}.json`), "[]");
  fs.writeFileSync(path.join(dir, "richmenu.json"), JSON.stringify(saved));
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
  const base = `http://127.0.0.1:${server.address().port}/api/admin`;
  const raw = (method, p, body, token) => fetch(base + p, {
    method,
    headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const token = (await (await raw("POST", "/login", { password: "pw" })).json()).token;
  const call = (method, p, body) => raw(method, p, body, token);
  const onDisk = () => JSON.parse(fs.readFileSync(path.join(dir, "richmenu.json"), "utf8"));
  return { raw, call, lines, loaded, onDisk, close: () => server.close() };
}

// เงียบ log ที่เส้นทางเหล่านี้พิมพ์โดยตั้งใจ
function quiet(t) {
  const original = { log: console.log, error: console.error };
  console.log = () => {};
  console.error = () => {};
  t.after(() => Object.assign(console, original));
}

test("every rich menu route needs an admin token", async () => {
  const { raw, close } = await startApp();
  assert.equal((await raw("GET", "/richmenu")).status, 401);
  assert.equal((await raw("PUT", "/richmenu", twoLevels())).status, 401);
  assert.equal((await raw("GET", "/richmenu/status")).status, 401);
  assert.equal((await raw("POST", "/richmenu/sync/2")).status, 401);
  close();
});

test("GET returns the saved definition", async () => {
  const { call, close } = await startApp({ saved: twoLevels() });
  const res = await call("GET", "/richmenu");
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), twoLevels());
  close();
});

test("PUT rejects invalid data with field paths and saves nothing", async () => {
  const { call, onDisk, loaded, close } = await startApp();
  const res = await call("PUT", "/richmenu", richMenu({ chatBarText: "", menus: [level("Gold", "V Gold", true)] }));
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.equal(body.error, "ข้อมูลไม่ถูกต้อง");
  assert.deepEqual(body.errors.map((e) => e.path).sort(), ["chatBarText", "menus[0].key"]);
  assert.deepEqual(onDisk(), richMenu());
  assert.deepEqual(loaded, []);
  close();
});

test("PUT saves the normalized definition and checks only images it has not seen", async () => {
  const { call, onDisk, loaded, close } = await startApp();
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
  close();
});

test("PUT reports an image that fails its check on that menu's field and saves nothing", async () => {
  const { call, onDisk, close } = await startApp({ saved: twoLevels() });
  const res = await call("PUT", "/richmenu", richMenu({ menus: [level("default", "ก่อนสมัคร", true), level("gold", "V Gold", false, "https://img.example/bad.jpg")] }));
  assert.equal(res.status, 400);
  assert.deepEqual(await res.json(), { error: "รูปไม่ผ่านการตรวจ", errors: [{ path: "menus[1].image", message: "ไฟล์รูปใหญ่เกิน 1 MB" }] });
  assert.deepEqual(onDisk(), twoLevels());
  close();
});

test("status describes every OA: blocked by another system's menus, out of date, and unreachable", async (t) => {
  quiet(t);
  const { call, close } = await startApp({ saved: twoLevels() });
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
  close();
});

test("sync runs one OA and reports its steps; the status is then in sync", async (t) => {
  quiet(t);
  const { call, lines, close } = await startApp({ saved: twoLevels() });
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
  close();
});

test("sync of a blocked or unreachable OA answers 200 with ok false and writes nothing", async (t) => {
  quiet(t);
  const { call, lines, close } = await startApp({ saved: twoLevels() });
  const blocked = await call("POST", "/richmenu/sync/1");
  assert.equal(blocked.status, 200);
  const body = await blocked.json();
  assert.equal(body.ok, false);
  assert.match(body.message, /ระบบอื่นสร้างไว้/);
  assert.deepEqual(lines.get(1).calls, []);

  const broken = await (await call("POST", "/richmenu/sync/3")).json();
  assert.equal(broken.ok, false);
  assert.match(broken.message, /HTTP 401/);
  close();
});

test("sync of an unknown OA is 404", async () => {
  const { call, close } = await startApp({ saved: twoLevels() });
  for (const id of ["9", "abc", "2x"]) assert.equal((await call("POST", `/richmenu/sync/${id}`)).status, 404, id);
  close();
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
  const { call, close } = await startApp({ saved: twoLevels(), richMenuOptions: { loadImage } });

  const first = call("POST", "/richmenu/sync/2");
  await started;
  const second = await call("POST", "/richmenu/sync/2");
  assert.equal(second.status, 409);
  assert.match((await second.json()).error, /sync อื่นกำลังทำงานอยู่/);

  release();
  assert.equal((await (await first).json()).ok, true);
  const again = await call("POST", "/richmenu/sync/2");
  assert.equal(again.status, 200);
  assert.match((await again.json()).message, /ตรงกับที่บันทึกไว้อยู่แล้ว/);
  close();
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test test/richMenuRoute.test.js`
Expected: FAIL — 9 of 10 fail: no `/richmenu` route exists yet, so the requests answer 404 and the assertions on status or on the JSON body fail. "every rich menu route needs an admin token" already passes: the existing auth middleware answers 401 for any path.

- [ ] **Step 3: Write the route**

Create `routes/richMenuRoute.js`:

```js
// API ของหน้า Rich Menu: ข้อมูลเมนู, สถานะของแต่ละ LINE OA และการ sync ทีละ OA
// ถูกเมานต์ใน adminRoute หลัง requireAdmin จึงต้องมี token ของแอดมินทุกเส้นทาง
const express = require("express");
const { validateRichMenu, normalizeRichMenu } = require("../services/validate");
const { loadMenuImage, checkChangedImages } = require("../services/richMenuImages");
const { describeChannel } = require("../services/richMenuPlan");
const { syncChannel } = require("../services/richMenuSync");
const { createLineRichMenuApi, describeLineError } = require("../services/lineRichMenuApi");

function createRichMenuRouter({ store, channels, createApi = createLineRichMenuApi, loadImage = loadMenuImage, sleep }) {
  const router = express.Router();

  // sync ได้ครั้งละ 1 งานทั้งแอป: สองงานพร้อมกันบน OA เดียวจะสร้างเมนูซ้ำและแย่งกันย้ายลูกค้า
  let syncing = false;

  router.get("/", (req, res) => res.json(store.get("richmenu")));

  router.put("/", async (req, res) => {
    const errors = validateRichMenu(req.body);
    if (errors.length) {
      return res.status(400).json({ error: "ข้อมูลไม่ถูกต้อง", errors });
    }
    const next = normalizeRichMenu(req.body);
    const imageErrors = await checkChangedImages(next, store.get("richmenu"), loadImage);
    if (imageErrors.length) {
      return res.status(400).json({ error: "รูปไม่ผ่านการตรวจ", errors: imageErrors });
    }
    try {
      store.set("richmenu", next);
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: "บันทึกไฟล์ไม่สำเร็จ" });
    }
    return res.json(store.get("richmenu"));
  });

  router.get("/status", async (req, res) => {
    const definition = store.get("richmenu");
    const statuses = await Promise.all(
      channels.map(async (channel) => {
        const base = { id: channel.id, name: channel.name };
        try {
          const status = describeChannel(definition, await createApi(channel).readState());
          return {
            ...base,
            state: status.state,
            message: status.message,
            menus: status.menus.map((menu) => ({ key: menu.key, label: menu.label, state: menu.state })),
            staleCount: status.staleMenus.length,
            removedKeys: status.removedKeys,
            foreignMenus: status.foreignMenus,
          };
        } catch (error) {
          const message = describeLineError(error);
          console.error(`[${channel.name}] อ่านสถานะ Rich Menu ไม่สำเร็จ: ${message}`);
          return { ...base, state: "error", message, menus: [], staleCount: 0, removedKeys: [], foreignMenus: [] };
        }
      })
    );
    res.json(statuses);
  });

  router.post("/sync/:channelId", async (req, res) => {
    const channel = channels.find((item) => String(item.id) === req.params.channelId);
    if (!channel) {
      return res.status(404).json({ error: "ไม่พบ LINE OA นี้" });
    }
    if (syncing) {
      return res.status(409).json({ error: "มีการ sync อื่นกำลังทำงานอยู่ กรุณารอให้เสร็จก่อน" });
    }
    syncing = true;
    try {
      const result = await syncChannel({ definition: store.get("richmenu"), api: createApi(channel), loadImage, sleep });
      console.log(`[${channel.name}] sync Rich Menu ${result.ok ? "สำเร็จ" : "ไม่สำเร็จ"}: ${result.message}`);
      return res.json({ id: channel.id, name: channel.name, ...result });
    } finally {
      syncing = false;
    }
  });

  return router;
}

module.exports = { createRichMenuRouter };
```

In `routes/adminRoute.js`, make these 3 replacements (each "find" text occurs exactly once):

(1) Find:

```js
const { validatePromotions, validateServices, validateBranches, validateRegions } = require("../services/validate");
```

Replace with:

```js
const { validatePromotions, validateServices, validateBranches, validateRegions } = require("../services/validate");
const { createRichMenuRouter } = require("./richMenuRoute");
```

(2) Find:

```js
function createAdminRouter({
  store,
  messageTable,
  loginFailureDelayMs = 1000,
```

Replace with:

```js
function createAdminRouter({
  store,
  messageTable,
  channels = [],
  richMenu = {},
  loginFailureDelayMs = 1000,
```

(3) Find:

```js
  router.use(requireAdmin);
```

Replace with:

```js
  router.use(requireAdmin);

  // Rich Menu: ข้อมูลเมนู + สถานะและการ sync ของแต่ละ LINE OA (richMenu ใช้ส่งตัวจำลอง LINE เข้ามาในเทสต์)
  router.use("/richmenu", createRichMenuRouter({ store, channels, ...richMenu }));
```

- [ ] **Step 4: Run the route tests to verify they pass**

Run: `node --test test/richMenuRoute.test.js`
Expected: `# tests 10`, `# pass 10`, `# fail 0`.

- [ ] **Step 5: Pass the OA list from `index.js`**

In `index.js`, make this replacement (each "find" text occurs exactly once):

Find:

```js
app.use("/api/admin", createAdminRouter({ store, messageTable }));
```

Replace with:

```js
app.use("/api/admin", createAdminRouter({ store, messageTable, channels }));
```

- [ ] **Step 6: Smoke-test against the test OA with read-only calls**

This starts the real app with the local `.env` (the test OA) and asks only for status, which sends three GET requests to LINE and nothing else.

```bash
ADMIN_PASSWORD=pw-smoke PORT=8097 node index.js > /dev/null 2>&1 &
PID=$!
node -e "
(async()=>{
  const b='http://127.0.0.1:8097';
  for(let i=0;i<50;i++){try{await fetch(b+'/');break}catch(e){await new Promise(r=>setTimeout(r,100))}}
  const token=(await (await fetch(b+'/api/admin/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({password:'pw-smoke'})})).json()).token;
  const h={authorization:'Bearer '+token};
  const def=await (await fetch(b+'/api/admin/richmenu',{headers:h})).json();
  console.log('definition: areas',def.areas.length,'menus',def.menus.length);
  for(const oa of await (await fetch(b+'/api/admin/richmenu/status',{headers:h})).json()) console.log(oa.name,'->',oa.state,'| foreign menus:',oa.foreignMenus.length);
})().catch(e=>console.log('error',e.message));
"
kill $PID
```

Expected, while the local `.env` still points at "VSQ CRM Test" and its six legacy menus exist:

```
definition: areas 4 menus 0
OA 1 -> blocked | foreign menus: 6
```

`error` instead of `blocked` means the adapter's read path is broken: stop and investigate before continuing.

- [ ] **Step 7: Run the whole suite**

Run: `npm test`
Expected: `# tests 168`, `# pass 168`, `# fail 0`.

- [ ] **Step 8: Commit**

```bash
git add routes/richMenuRoute.js routes/adminRoute.js index.js test/richMenuRoute.test.js
git commit -m "feat: admin API for rich menu data, status and sync" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Rich Menu page in the admin UI

There are no React tests in this repo (spec §2). The gate for this task is a clean production build plus the manual checklist in Step 5.

**Files:**
- Create: `admin/src/pages/RichMenuPage.jsx`, `admin/src/components/RichMenuAreas.jsx`, `admin/src/components/RichMenuStatus.jsx`
- Modify: `admin/src/App.jsx`, `admin/src/components/Layout.jsx`, `admin/src/styles.css`

**Interfaces:**
- Consumes: the API from Task 6; existing `useResource(name)` (`{ draft, setDraft, dirty, save, reset, errors, status, message }`), `api.get/post`, `PageHeader`, `UnsavedBar`, `FieldError`, `ImagePreview`, `removeAt`; `GET /api/admin/triggers` → `string[]`.
- Produces: route `#/richmenu` and a "Rich Menu" link in the sidebar.

- [ ] **Step 1: Create the tap-area editor**

Create `admin/src/components/RichMenuAreas.jsx`:

```jsx
import FieldError from "./FieldError";
import { removeAt } from "../utils";

const CUSTOM = "__custom__";
const AREA_FIELDS = ["x", "y", "width", "height", "action.type", "action.text", "action.uri"];
const BOUNDS = [["x", "x"], ["y", "y"], ["width", "กว้าง"], ["height", "สูง"]];

// ช่องตัวเลขที่ลบจนว่างได้ระหว่างพิมพ์ (ค่าว่างจะถูกแจ้งเป็นข้อผิดพลาดตอนบันทึก)
const toNumber = (value) => (value === "" ? "" : Number(value));
const percent = (part, whole) => `${whole > 0 ? (Number(part) / whole) * 100 : 0}%`;
export const emptyArea = () => ({ x: 0, y: 0, width: 500, height: 500, action: { type: "message", text: "" } });

// ตารางพื้นที่กด + กรอบหมายเลขซ้อนบนรูปเมนู
// พิกัดเทียบกับ size ของเมนู ไม่ใช่ขนาดไฟล์รูป (LINE ย่อ/ขยายรูปให้พอดีเอง)
export default function RichMenuAreas({ size, areas, onChange, previewUrl, triggers, errors }) {
  const setArea = (i, patch) => onChange(areas.map((area, j) => (j === i ? { ...area, ...patch } : area)));

  function setType(i, type) {
    setArea(i, { action: type === "message" ? { type, text: "" } : { type, uri: "" } });
  }

  return (
    <div className="rm-areas">
      <div className="rm-preview" style={{ aspectRatio: `${size.width || 1} / ${size.height || 1}` }}>
        {previewUrl ? <img src={previewUrl} alt="" /> : <span className="rm-preview-empty">เพิ่มเมนูและใส่ URL รูปเพื่อดูกรอบซ้อนบนรูปจริง</span>}
        {areas.map((area, i) => (
          <div
            key={i}
            className="rm-box"
            style={{
              left: percent(area.x, size.width),
              top: percent(area.y, size.height),
              width: percent(area.width, size.width),
              height: percent(area.height, size.height),
            }}
          >
            <span>{i + 1}</span>
          </div>
        ))}
      </div>

      <div className="table-wrap">
        <table className="table rm-table">
          <thead>
            <tr>
              <th className="num">#</th>
              {BOUNDS.map(([field, label]) => <th key={field}>{label}</th>)}
              <th style={{ width: 150 }}>เมื่อกด</th>
              <th>ข้อความที่ส่ง / ลิงก์ที่เปิด</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {areas.length === 0 && <tr><td colSpan={8} className="empty">ยังไม่มีพื้นที่กด</td></tr>}
            {areas.map((area, i) => {
              const action = area.action || {};
              const isKnownTrigger = action.type === "message" && triggers.includes(action.text);
              return (
                <tr key={i}>
                  <td className="num"><span className="rm-index">{i + 1}</span></td>
                  {BOUNDS.map(([field]) => (
                    <td key={field}>
                      <input type="number" min="0" step="1" className="rm-number" value={area[field]} onChange={(e) => setArea(i, { [field]: toNumber(e.target.value) })} />
                    </td>
                  ))}
                  <td>
                    <select value={action.type} onChange={(e) => setType(i, e.target.value)}>
                      <option value="message">ส่งข้อความ</option>
                      <option value="uri">เปิดลิงก์</option>
                    </select>
                  </td>
                  <td>
                    {action.type === "uri" ? (
                      <input value={action.uri || ""} placeholder="https://..." onChange={(e) => setArea(i, { action: { type: "uri", uri: e.target.value } })} />
                    ) : (
                      <>
                        <select
                          value={isKnownTrigger ? action.text : CUSTOM}
                          onChange={(e) => setArea(i, { action: { type: "message", text: e.target.value === CUSTOM ? "" : e.target.value } })}
                        >
                          {triggers.map((trigger) => <option key={trigger} value={trigger}>{trigger}</option>)}
                          <option value={CUSTOM}>พิมพ์เอง…</option>
                        </select>
                        {!isKnownTrigger && (
                          <input
                            style={{ marginTop: "0.35rem" }}
                            value={action.text || ""}
                            placeholder="ข้อความที่จะส่งเข้าแชต"
                            onChange={(e) => setArea(i, { action: { type: "message", text: e.target.value } })}
                          />
                        )}
                      </>
                    )}
                    <FieldError errors={errors} path={`areas[${i}]`} />
                    {AREA_FIELDS.map((field) => <FieldError key={field} errors={errors} path={`areas[${i}].${field}`} />)}
                  </td>
                  <td>
                    <div className="actions">
                      <button type="button" className="danger" title="ลบ" onClick={() => { if (window.confirm(`ลบพื้นที่กดช่องที่ ${i + 1}?`)) onChange(removeAt(areas, i)); }}>ลบ</button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div style={{ marginTop: "0.75rem" }}>
        <button type="button" className="sm" onClick={() => onChange([...areas, emptyArea()])}>+ เพิ่มพื้นที่กด</button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create the OA status and sync panel**

Create `admin/src/components/RichMenuStatus.jsx`:

```jsx
import { useCallback, useEffect, useState } from "react";
import { api } from "../api";

const STATE_LABELS = {
  "in-sync": ["ตรงกับที่บันทึกไว้", "ok"],
  "out-of-date": ["ยังไม่ตรง", "info"],
  blocked: ["sync ไม่ได้", ""],
  empty: ["ยังไม่มีเมนู", "muted"],
  error: ["เรียก LINE ไม่ได้", ""],
};
const MENU_LABELS = { ok: "ตรงแล้ว", missing: "ยังไม่มีบน LINE", outdated: "ต้องสร้างใหม่" };

// สรุปสิ่งที่จะเกิดขึ้นเมื่อ sync OA นี้ สำหรับหน้าต่างยืนยัน
function describePlan(oa) {
  const lines = [`Sync Rich Menu ไปที่ ${oa.name}?`, ""];
  const toCreate = oa.menus.filter((menu) => menu.state !== "ok").map((menu) => menu.label);
  if (toCreate.length) lines.push(`• สร้างเมนูใหม่: ${toCreate.join(", ")}`);
  if (oa.removedKeys.length) {
    lines.push(`• ลบเมนูของระดับ: ${oa.removedKeys.join(", ")} — ลูกค้าที่ผูกกับเมนูนี้จะกลับไปเห็นเมนูเริ่มต้น`);
  }
  if (oa.staleCount) lines.push(`• เก็บกวาดเมนูเก่าที่ค้างอยู่ ${oa.staleCount} เมนู`);
  lines.push("• ลูกค้าที่ผูกกับเมนูเดิมของแต่ละระดับจะถูกย้ายไปเมนูใหม่ของระดับเดียวกัน");
  return lines.join("\n");
}

// สถานะ Rich Menu ของแต่ละ LINE OA + ปุ่ม sync (ทีละ OA หนึ่ง request ต่อหนึ่ง OA)
// dirty: หน้ามีการแก้ไขที่ยังไม่บันทึก — sync ไม่ได้จนกว่าจะบันทึก เพราะ sync ใช้ข้อมูลที่บันทึกแล้ว
export default function RichMenuStatus({ dirty }) {
  const [statuses, setStatuses] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(""); // "" | "load" | "sync"
  const [reports, setReports] = useState([]);

  const load = useCallback(async () => {
    setBusy("load");
    setError("");
    try {
      setStatuses(await api.get("/richmenu/status"));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy("");
    }
  }, []);

  // โหลดตอนเปิดหน้า และโหลดใหม่ทุกครั้งที่บันทึกหรือยกเลิกการแก้ไข
  useEffect(() => { if (!dirty) load(); }, [dirty, load]);

  async function sync(targets) {
    setBusy("sync");
    setReports([]);
    const done = [];
    for (const oa of targets) {
      try {
        done.push(await api.post(`/richmenu/sync/${oa.id}`));
      } catch (e) {
        done.push({ id: oa.id, name: oa.name, ok: false, steps: [], message: e.message });
      }
      setReports([...done]);
    }
    await load();
  }

  function confirmAndSync(targets) {
    if (window.confirm(targets.map(describePlan).join("\n\n"))) sync(targets);
  }

  const syncable = (statuses || []).filter((oa) => oa.state === "out-of-date");
  const disabled = dirty || busy !== "";

  return (
    <div className="card">
      <div className="rm-status-head">
        <div className="card-title" style={{ margin: 0 }}>สถานะบน LINE OA</div>
        <div className="page-actions">
          <button type="button" className="sm" onClick={load} disabled={busy !== ""}>{busy === "load" ? "กำลังโหลด..." : "รีเฟรช"}</button>
          <button type="button" className="primary sm" onClick={() => confirmAndSync(syncable)} disabled={disabled || syncable.length === 0}>
            {busy === "sync" ? "กำลัง sync..." : `Sync ทุก OA ที่ sync ได้ (${syncable.length})`}
          </button>
        </div>
      </div>

      {dirty && <div className="notice">มีการแก้ไขที่ยังไม่บันทึก บันทึกก่อนจึงจะ sync ได้ (สถานะด้านล่างเทียบกับข้อมูลที่บันทึกไว้ล่าสุด)</div>}
      {error && <div className="field-error">{error}</div>}
      {statuses === null && !error && <p className="muted">กำลังโหลด...</p>}

      {(statuses || []).map((oa) => {
        const [label, tone] = STATE_LABELS[oa.state] || [oa.state, ""];
        return (
          <div className="rm-oa" key={oa.id}>
            <div className="rm-oa-head">
              <div>
                <span className="rm-oa-name">{oa.name}</span>
                <span className={`badge ${tone}`}>{label}</span>
              </div>
              <button type="button" className="sm" onClick={() => confirmAndSync([oa])} disabled={disabled || oa.state !== "out-of-date"}>Sync OA นี้</button>
            </div>
            {oa.state !== "in-sync" && oa.state !== "out-of-date" && <div className="muted">{oa.message}</div>}
            {oa.foreignMenus.length > 0 && <div className="muted">เมนูของระบบอื่นที่พบ: {oa.foreignMenus.join(", ")}</div>}
            {oa.menus.length > 0 && (
              <div className="rm-levels">
                {oa.menus.map((menu) => (
                  <span key={menu.key} className={`badge ${menu.state === "ok" ? "ok" : "info"}`}>{menu.label}: {MENU_LABELS[menu.state] || menu.state}</span>
                ))}
                {oa.removedKeys.map((key) => <span key={key} className="badge">{key}: จะถูกลบ</span>)}
                {oa.staleCount > 0 && <span className="badge muted">เมนูเก่าค้าง {oa.staleCount}</span>}
              </div>
            )}
          </div>
        );
      })}

      {reports.map((report) => (
        <div className={`rm-report ${report.ok ? "ok" : "failed"}`} key={report.id}>
          <strong>{report.name}: {report.ok ? "สำเร็จ" : "ไม่สำเร็จ"}</strong> — {report.message}
          {report.steps.length > 0 && <ol>{report.steps.map((step, i) => <li key={i}>{step}</li>)}</ol>}
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Create the page**

Create `admin/src/pages/RichMenuPage.jsx`:

```jsx
import { useEffect, useState } from "react";
import { api } from "../api";
import { useResource } from "../hooks/useResource";
import PageHeader from "../components/PageHeader";
import UnsavedBar from "../components/UnsavedBar";
import FieldError from "../components/FieldError";
import ImagePreview from "../components/ImagePreview";
import RichMenuAreas from "../components/RichMenuAreas";
import RichMenuStatus from "../components/RichMenuStatus";
import { removeAt } from "../utils";

const toNumber = (value) => (value === "" ? "" : Number(value));

// Rich Menu ชุดเดียวของทุก LINE OA: ตั้งค่าร่วม + พื้นที่กด (ใช้ร่วมกันทุกระดับ) + รูปของแต่ละระดับ แล้ว sync ไปแต่ละ OA
export default function RichMenuPage() {
  const resource = useResource("richmenu");
  const { draft, setDraft, errors, status, message, dirty } = resource;
  const [triggers, setTriggers] = useState([]);
  const [previewKey, setPreviewKey] = useState("");

  useEffect(() => {
    api.get("/triggers").then(setTriggers).catch(() => setTriggers([]));
  }, []);

  if (status === "error") return <p className="field-error">{message}</p>;
  if (status === "loading" || draft === null) return <p className="muted">กำลังโหลด...</p>;

  const patch = (changes) => setDraft({ ...draft, ...changes });
  const setMenu = (i, changes) => patch({ menus: draft.menus.map((menu, j) => (j === i ? { ...menu, ...changes } : menu)) });
  const setDefault = (i) => patch({ menus: draft.menus.map((menu, j) => ({ ...menu, isDefault: j === i })) });
  const addMenu = () => patch({ menus: [...draft.menus, { key: "", label: "", image: "", isDefault: draft.menus.length === 0 }] });

  function removeMenu(i) {
    const menus = removeAt(draft.menus, i);
    // ลบเมนูเริ่มต้นไปแล้ว: ให้เมนูแรกที่เหลือเป็นเมนูเริ่มต้นแทน เพราะต้องมี 1 อันเสมอ
    if (menus.length && !menus.some((menu) => menu.isDefault)) menus[0] = { ...menus[0], isDefault: true };
    patch({ menus });
  }

  const previewMenu = draft.menus.find((menu) => menu.key === previewKey) || draft.menus.find((menu) => menu.isDefault) || draft.menus[0];

  return (
    <div>
      <PageHeader
        title="Rich Menu"
        subtitle={`${draft.menus.length} เมนู · แก้ที่นี่ที่เดียว บันทึก แล้วกด Sync เพื่อให้ทุก LINE OA ใช้เมนูชุดเดียวกัน`}
      />
      <UnsavedBar resource={resource} />
      <FieldError errors={errors} path="" />

      <div className="card">
        <div className="card-title">ตั้งค่าร่วมของทุกเมนู</div>
        <div className="form-grid">
          <label>
            ข้อความบนแถบเมนู
            <input value={draft.chatBarText} maxLength={14} onChange={(e) => patch({ chatBarText: e.target.value })} />
            <span className="hint">แสดงที่แถบด้านล่างของห้องแชต ไม่เกิน 14 ตัวอักษร</span>
            <FieldError errors={errors} path="chatBarText" />
          </label>
          <label className="check" style={{ alignSelf: "center" }}>
            <input type="checkbox" checked={draft.selected === true} onChange={(e) => patch({ selected: e.target.checked })} />
            เปิดเมนูค้างไว้เมื่อลูกค้าเข้าห้องแชต
          </label>
          <label>
            ความกว้างของเมนู
            <input type="number" min="800" max="2500" step="1" value={draft.size.width} onChange={(e) => patch({ size: { ...draft.size, width: toNumber(e.target.value) } })} />
            <FieldError errors={errors} path="size.width" />
          </label>
          <label>
            ความสูงของเมนู
            <input type="number" min="250" step="1" value={draft.size.height} onChange={(e) => patch({ size: { ...draft.size, height: toNumber(e.target.value) } })} />
            <FieldError errors={errors} path="size.height" />
          </label>
        </div>
        <div className="muted">ขนาดเมนูคือพิกัดอ้างอิงของพื้นที่กด รูปไม่ต้องมีขนาดเท่านี้ แต่สัดส่วนต้องตรงกัน เช่น เมนู 2500x1686 ใช้รูป 1200x810 ได้</div>
      </div>

      <div className="card">
        <div className="rm-status-head">
          <div className="card-title" style={{ margin: 0 }}>พื้นที่กด (ใช้ร่วมกันทุกระดับ)</div>
          {draft.menus.length > 1 && (
            <label className="rm-preview-pick">
              ดูกรอบบนรูปของ
              <select value={previewMenu ? previewMenu.key : ""} onChange={(e) => setPreviewKey(e.target.value)}>
                {draft.menus.map((menu, i) => <option key={i} value={menu.key}>{menu.label || menu.key || `เมนูที่ ${i + 1}`}</option>)}
              </select>
            </label>
          )}
        </div>
        <FieldError errors={errors} path="areas" />
        <RichMenuAreas
          size={draft.size}
          areas={draft.areas}
          onChange={(areas) => patch({ areas })}
          previewUrl={previewMenu ? previewMenu.image : ""}
          triggers={triggers}
          errors={errors}
        />
      </div>

      <div className="card">
        <div className="rm-status-head">
          <div className="card-title" style={{ margin: 0 }}>เมนูตามระดับสมาชิก</div>
          <button type="button" className="primary sm" onClick={addMenu}>+ เพิ่มเมนู</button>
        </div>
        <div className="muted" style={{ marginBottom: "0.75rem" }}>
          รูปต้องเป็น JPEG หรือ PNG ไม่เกิน 1 MB กว้าง 800–2500 พิกเซล และสัดส่วนตรงกับขนาดเมนู ถ้าเปลี่ยนรูปต้องใช้ URL ใหม่ (ทับไฟล์ที่ URL เดิมแอปจะไม่รู้ว่ารูปเปลี่ยน)
        </div>
        <FieldError errors={errors} path="menus" />
        <div className="table-wrap">
          <table className="table rm-table">
            <thead>
              <tr><th style={{ width: 96 }}>รูป</th><th style={{ width: 150 }}>รหัส</th><th style={{ width: 200 }}>ชื่อ</th><th>URL รูป</th><th className="num">เมนูเริ่มต้น</th><th></th></tr>
            </thead>
            <tbody>
              {draft.menus.length === 0 && <tr><td colSpan={6} className="empty">ยังไม่มีเมนู กด "+ เพิ่มเมนู" แล้วใส่รูปของแต่ละระดับ</td></tr>}
              {draft.menus.map((menu, i) => (
                <tr key={i} className={errors.some((e) => e.path.startsWith(`menus[${i}]`)) ? "has-error" : ""}>
                  <td className="thumb-sm rm-thumb"><ImagePreview url={menu.image} size={72} /></td>
                  <td>
                    <input value={menu.key} placeholder="เช่น gold" onChange={(e) => setMenu(i, { key: e.target.value })} />
                    <FieldError errors={errors} path={`menus[${i}].key`} />
                  </td>
                  <td>
                    <input value={menu.label} placeholder="เช่น V Gold" onChange={(e) => setMenu(i, { label: e.target.value })} />
                    <FieldError errors={errors} path={`menus[${i}].label`} />
                  </td>
                  <td>
                    <input value={menu.image} placeholder="https://..." onChange={(e) => setMenu(i, { image: e.target.value })} />
                    <FieldError errors={errors} path={`menus[${i}].image`} />
                    <FieldError errors={errors} path={`menus[${i}]`} />
                  </td>
                  <td className="num">
                    <input type="radio" name="rm-default" style={{ width: "auto" }} checked={menu.isDefault === true} onChange={() => setDefault(i)} />
                    <FieldError errors={errors} path={`menus[${i}].isDefault`} />
                  </td>
                  <td>
                    <div className="actions">
                      <button type="button" className="danger" onClick={() => { if (window.confirm(`ลบเมนู "${menu.label || menu.key}" ออกจากรายการ?`)) removeMenu(i); }}>ลบ</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="muted" style={{ marginTop: "0.75rem" }}>
          รหัสใช้ตั้งชื่ออ้างอิงบน LINE (a-z, 0-9, -) ไม่ควรเปลี่ยนหลัง sync แล้ว เพราะจะถือเป็นการลบระดับเดิมและเพิ่มระดับใหม่ · เมนูเริ่มต้นคือเมนูที่ลูกค้าเห็นเมื่อยังไม่ถูกผูกเมนูตามระดับ
        </div>
      </div>

      <RichMenuStatus dirty={dirty} />
    </div>
  );
}
```

- [ ] **Step 4: Add the route, the sidebar link and the styles**

In `admin/src/App.jsx`, make these 2 replacements (each "find" text occurs exactly once):

(1) Find:

```jsx
import RegionsPage from "./pages/RegionsPage";
```

Replace with:

```jsx
import RegionsPage from "./pages/RegionsPage";
import RichMenuPage from "./pages/RichMenuPage";
```

(2) Find:

```jsx
        <Route path="/regions" element={<Private><RegionsPage /></Private>} />
```

Replace with:

```jsx
        <Route path="/regions" element={<Private><RegionsPage /></Private>} />
        <Route path="/richmenu" element={<Private><RichMenuPage /></Private>} />
```

In `admin/src/components/Layout.jsx`, make these 2 replacements (each "find" text occurs exactly once):

(1) Find:

```jsx
  logout: <svg viewBox="0 0 24 24"
```

Replace with:

```jsx
  menu: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 13h18" /><path d="M9 13v7" /><path d="M15 13v7" /></svg>,
  logout: <svg viewBox="0 0 24 24"
```

(2) Find:

```jsx
  ["/regions", "ภูมิภาค", icons.layers],
```

Replace with:

```jsx
  ["/regions", "ภูมิภาค", icons.layers],
  ["/richmenu", "Rich Menu", icons.menu],
```

In `admin/src/styles.css`, make this replacement (each "find" text occurs exactly once):

Find:

```css
/* ---------- login ---------- */
```

Replace with:

```css
/* ---------- rich menu ---------- */
.rm-status-head { display: flex; justify-content: space-between; align-items: center; gap: 0.75rem; flex-wrap: wrap; margin-bottom: 0.9rem; }
.rm-preview-pick { display: flex; align-items: center; gap: 0.5rem; margin: 0; white-space: nowrap; }
.rm-preview-pick select { margin: 0; width: auto; }
.rm-preview { position: relative; width: 100%; max-width: 640px; margin: 0 auto 1rem; background: #eef1f5; border: 1px solid var(--border); border-radius: 10px; overflow: hidden; }
.rm-preview img { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
.rm-preview-empty { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; color: var(--muted); font-size: 0.85rem; padding: 1rem; text-align: center; }
.rm-box { position: absolute; border: 2px solid var(--primary); background: rgba(50, 131, 232, 0.18); display: flex; align-items: center; justify-content: center; }
.rm-box span, .rm-index { display: inline-flex; align-items: center; justify-content: center; min-width: 1.6rem; height: 1.6rem; padding: 0 0.3rem; border-radius: 999px; background: var(--primary); color: #fff; font-weight: 700; font-size: 0.8rem; }
.rm-table td { vertical-align: top; }
.rm-table .rm-number { width: 5.5rem; }
.rm-thumb .img-preview { object-fit: contain; }
.rm-oa { border-top: 1px solid #eef1f5; padding: 0.8rem 0; }
.rm-oa-head { display: flex; justify-content: space-between; align-items: center; gap: 0.75rem; margin-bottom: 0.35rem; }
.rm-oa-name { font-weight: 600; margin-right: 0.5rem; }
.rm-levels { display: flex; flex-wrap: wrap; gap: 0.35rem; margin-top: 0.4rem; }
.rm-levels .badge { margin: 0; }
.rm-report { border-radius: 10px; padding: 0.7rem 1rem; margin-top: 0.75rem; font-size: 0.85rem; }
.rm-report.ok { background: #e6f6ee; color: #1f7a4d; }
.rm-report.failed { background: var(--danger-soft); color: var(--danger); }
.rm-report ol { margin: 0.4rem 0 0; padding-left: 1.2rem; }

/* ---------- login ---------- */
```

- [ ] **Step 5: Build and check**

Run: `npm run admin:build`
Expected: ends with `✓ built in …` and no error or warning about the three new files.

Then serve it and confirm the built page is reachable:

```bash
ADMIN_PASSWORD=pw-smoke PORT=8097 node index.js > /dev/null 2>&1 &
PID=$!
node -e "
(async()=>{
  const b='http://127.0.0.1:8097';
  for(let i=0;i<50;i++){try{await fetch(b+'/');break}catch(e){await new Promise(r=>setTimeout(r,100))}}
  const r=await fetch(b+'/backoffice/');const html=await r.text();
  console.log('backoffice',r.status,html.includes('id=\"root\"')?'has root':'NO ROOT');
})();
"
kill $PID
```

Expected: `backoffice 200 has root`

Manual checklist for whoever opens `http://localhost:8097/backoffice/#/richmenu` (not automated):
- the four seeded tap areas appear in the table and as numbered boxes on the preview;
- adding a menu with a bad image URL and saving shows the error under that row;
- the status card lists each OA; with unsaved edits the Sync buttons are disabled and the notice appears.

- [ ] **Step 6: Commit**

```bash
git add admin/src/pages/RichMenuPage.jsx admin/src/components/RichMenuAreas.jsx admin/src/components/RichMenuStatus.jsx admin/src/App.jsx admin/src/components/Layout.jsx admin/src/styles.css
git commit -m "feat(admin): rich menu page with tap-area editor and per-OA sync" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Documentation

**Files:**
- Modify: `CLAUDE.md`, `README.md`

**Interfaces:**
- Consumes: the behaviour of Tasks 1–7.
- Produces: nothing other tasks rely on.

- [ ] **Step 1: Update `CLAUDE.md`**

In `CLAUDE.md`, make these 5 replacements (each "find" text occurs exactly once):

(1) Find:

```markdown
`regions.json` (bubbles of the "ตารางแพทย์" menu). Edited via the admin UI;
```

Replace with:

```markdown
`regions.json` (bubbles of the "ตารางแพทย์" menu), plus `richmenu.json` (the Rich Menu set — not reply content, so it is not part of the trigger table). Edited via the admin UI;
```

(2) Find:

```markdown
- **`flexmessage/`**
```

Replace with:

```markdown
- **Rich Menu** — `data/richmenu.json` holds one menu set for every OA: shared `size` / `chatBarText` / `areas`, plus `menus[]` (`key`, `label`, `image` URL, `isDefault`), one per membership level. `services/richMenuPlan.js` (pure) names menus on LINE `vsq|<key>|<hash>` with alias `vsq-<key>` and compares LINE's state with the file. `services/richMenuSync.js` converges one OA to it (create → repoint alias → move linked users with LINE's batch API → set default → delete old) and reads LINE's real state every time, so a failed run is simply repeated. `services/lineRichMenuApi.js` is the thin SDK adapter, `services/richMenuImages.js` + `services/imageInfo.js` fetch and check images, and `routes/richMenuRoute.js` serves `GET/PUT /api/admin/richmenu`, `GET /api/admin/richmenu/status` and `POST /api/admin/richmenu/sync/:channelId`.
- **`flexmessage/`**
```

(3) Find:

```markdown
## Adding a LINE OA
```

Replace with:

```markdown
## Rich Menu

One menu set for every OA, edited on the Rich Menu page of the admin UI: shared settings and tap areas, one image per membership level, and one level marked as the default menu. Save, then press Sync for each OA; the page shows whether each OA matches the saved set.

- Images are URLs: JPEG or PNG, at most 1 MB, 800–2500 px wide, same proportions as the menu `size`. The image does not have to be `size` itself — LINE scales it (the current artwork is 1200x810 for a 2500x1686 menu). A changed image needs a new URL; overwriting the file at the same URL is not detected.
- Sync never touches a rich menu it did not create (names starting with `vsq|`). An OA that has API-created menus from another system is `blocked`; today that is the original OA, whose six membership menus are linked to members by the CRM LIFF project (`vsq-crm/CRM-LINE-Liff-App/vsq_crm_project`) using menu IDs in its own env. Moving that OA over is phase 2B.
- Changing a level creates a new LINE menu, repoints the alias `vsq-<key>`, moves every linked user to it with LINE's batch API, then deletes the old menu. Removing a level unlinks its users, who fall back to the default menu.
- The write path to LINE is tested only against the in-memory fake in `test-helpers/`. Not yet confirmed against real LINE: how many "move linked users" batch requests per hour LINE allows (sync sends at most one per OA per run).

## Adding a LINE OA
```

(4) Find:

```markdown
Each OA's Rich Menu is still created separately in LINE Official Account Manager, and its trigger strings must byte-match the other OAs'.
```

Replace with:

```markdown
Then open the Rich Menu page and press Sync for the new OA.
```

(5) Find:

```markdown
webhook route, error handler) — 94 tests, no test framework dependencies.
```

Replace with:

```markdown
webhook route, error handler, and rich menu validation / images / plan / sync / SDK adapter / routes) — 168 tests, no test framework dependencies. `test-helpers/` holds an in-memory fake of LINE's rich menu API and image-byte builders; it sits outside `test/` because `node --test` runs every `.js` file under `test/` as a test.
```

- [ ] **Step 2: Update `README.md`**

In `README.md`, make these 4 replacements (each "find" text occurs exactly once):

(1) Find:

```markdown
- `services/channels.js` : อ่านรายชื่อ LINE OA จาก `.env`, หา OA ต้นทางจากลายเซ็น, ตรวจ token ตอนเปิดแอป
```

Replace with:

```markdown
- `services/channels.js` : อ่านรายชื่อ LINE OA จาก `.env`, หา OA ต้นทางจากลายเซ็น, ตรวจ token ตอนเปิดแอป
- `services/richMenuPlan.js`, `services/richMenuSync.js`, `services/lineRichMenuApi.js`, `services/richMenuImages.js`, `services/imageInfo.js` : คำนวณสถานะ, sync, เชื่อมกับ LINE และตรวจรูปของ Rich Menu
- `routes/richMenuRoute.js` : API ของหน้า Rich Menu (อยู่ใต้ `/api/admin/richmenu`)
```

(2) Find:

```markdown
- `GET /api/admin/preview/:trigger` → ดูตัวอย่างข้อความ Flex ที่บอทจะตอบสำหรับ trigger นั้น
```

Replace with:

```markdown
- `GET /api/admin/preview/:trigger` → ดูตัวอย่างข้อความ Flex ที่บอทจะตอบสำหรับ trigger นั้น
- `GET/PUT /api/admin/richmenu` → อ่าน/แก้ไขชุด Rich Menu
- `GET /api/admin/richmenu/status` → สถานะ Rich Menu ของแต่ละ LINE OA เทียบกับที่บันทึกไว้
- `POST /api/admin/richmenu/sync/:channelId` → sync ชุด Rich Menu ไปยัง LINE OA หนึ่งบัญชี
```

(3) Find:

```markdown
5. สร้าง Rich Menu ของ OA นั้นให้ส่งข้อความ trigger ตรงกับ OA อื่นทุกตัวอักษร
```

Replace with:

```markdown
5. เปิดหน้า Rich Menu ใน `/backoffice` แล้วกด Sync ของ OA นั้น (ดูหัวข้อ Rich Menu ด้านล่าง)
```

(4) Find:

```markdown
## การส่งต่อ Webhook ไปยังระบบภายนอก (Forward)
```

Replace with:

```markdown
## Rich Menu (แก้ที่เดียว ใช้ทุก OA)

หน้า Rich Menu ใน `/backoffice` เก็บเมนูชุดเดียวสำหรับทุก LINE OA: ตั้งค่าร่วมและพื้นที่กด (ใช้ร่วมกันทุกระดับ) กับรูปของแต่ละระดับสมาชิก และเลือกหนึ่งระดับเป็นเมนูเริ่มต้นที่ทุกคนเห็น

วิธีใช้:
1. อัปโหลดรูปของแต่ละระดับขึ้น WordPress แล้วคัดลอก URL
2. เปิดหน้า Rich Menu กด "+ เพิ่มเมนู" ใส่รหัส (เช่น `gold`) ชื่อ และ URL รูป เลือกเมนูเริ่มต้น แล้วบันทึก
3. ดูส่วน "สถานะบน LINE OA" แล้วกด Sync ของ OA ที่ต้องการ

ข้อกำหนดของรูป: JPEG หรือ PNG ไม่เกิน 1 MB กว้าง 800–2500 พิกเซล และสัดส่วนตรงกับขนาดเมนู (เมนู 2500x1686 ใช้รูป 1200x810 ได้) ถ้าเปลี่ยนรูปต้องใช้ URL ใหม่ เพราะการทับไฟล์ที่ URL เดิมแอปจะไม่รู้ว่ารูปเปลี่ยน

สิ่งที่ควรรู้:
- แอปแตะเฉพาะเมนูที่ตัวเองสร้าง OA ที่มี Rich Menu ซึ่งระบบอื่นสร้างผ่าน API ไว้จะขึ้นสถานะ "sync ไม่ได้" และจะไม่ถูกแก้ไขใด ๆ
- แก้เมนูแล้ว sync: ลูกค้าที่ถูกผูกเมนูรายคนจะถูกย้ายไปเมนูใหม่ของระดับเดียวกัน
- ลบระดับออกจากรายการแล้ว sync: ลูกค้าของระดับนั้นกลับไปเห็นเมนูเริ่มต้น
- ถ้า sync ล้มเหลวกลางทาง กด Sync ซ้ำได้ แอปจะทำต่อจากจุดที่ค้าง

## การส่งต่อ Webhook ไปยังระบบภายนอก (Forward)
```

- [ ] **Step 3: Verify**

Run: `grep -c "richmenu" CLAUDE.md README.md; grep -n "168 tests" CLAUDE.md | cut -c1-60; npm test 2>&1 | grep -E "^# (tests|pass|fail)"`
Expected: a count of at least 3 for each file; one line containing `168 tests`; `# tests 168`, `# pass 168`, `# fail 0`.

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md README.md
git commit -m "docs: describe the rich menu page and sync" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
