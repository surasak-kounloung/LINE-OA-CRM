# Admin UI สำหรับแก้ไขข้อมูลบอท LINE — Design Spec

วันที่: 2026-09-09
สถานะ: รอผู้ใช้ตรวจ

## 1. เป้าหมาย

ให้ทีมคลินิกแก้ไขข้อมูลที่บอทใช้ตอบ (โปรโมชั่น, บริการ+รูปราคา, สาขา, ตารางแพทย์ทุกสาขา)
ผ่านหน้าเว็บ โดยไม่ต้องแก้โค้ดและไม่ต้อง restart server

ปัจจุบันข้อมูลทั้งหมดฝังอยู่ในไฟล์ JS (`flexmessage/promotion.js`, `flexmessage/services.js`,
`flexmessage/doctor*SchedulesData.js` 38 ไฟล์, ตาราง `flexMessage` ใน `routes/chatRoute.js`,
`BRANCH_GROUPS` ใน `tabledoctors.js` / `tabledoctorsThonglor.js`)

## 2. ขอบเขต

ทำ:
- ย้ายข้อมูลทั้งหมดข้างต้นออกเป็นไฟล์ JSON ใน `data/`
- ตาราง trigger → ข้อความตอบ สร้างอัตโนมัติจาก JSON
- Admin API ป้องกันด้วยรหัสผ่านเดียวจาก `.env`
- หน้า admin React (Vite) ในโฟลเดอร์ `admin/` เสิร์ฟจาก Express เดียวกันที่ `/admin`
- สคริปต์ย้ายข้อมูลครั้งเดียว + สคริปต์ตรวจว่า Flex ที่ได้เหมือนเดิม
- ทดสอบฝั่ง server ด้วย `node --test`

ไม่ทำ:
- ระบบผู้ใช้หลายคน / สิทธิ์
- อัปโหลดรูป (ยังใส่ URL ที่ฝากบน WordPress ของคลินิก)
- แก้ไขสี/ขนาด/layout ของ Flex จาก UI
- ฐานข้อมูลภายนอก (MongoDB)
- unit test ฝั่ง React

## 3. โครงสร้างข้อมูล (`data/`)

ทุกไฟล์เป็น UTF-8 JSON เยื้อง 2 ช่อง commit เข้า repo

### 3.1 `data/promotions.json`
Array เรียงตามลำดับที่แสดงใน carousel

| ฟิลด์ | ชนิด | บังคับ | ความหมาย |
|---|---|---|---|
| `id` | string | ✓ | ไม่ซ้ำ, `[a-z0-9-]+` |
| `image` | string URL | ✓ | รูปหัวการ์ด |
| `title` | string | ✓ | ชื่อโปรโมชั่น |
| `lines` | string[] | ✓ (ว่างได้) | บรรทัดบรรยาย |
| `inquiryText` | string | ✓ | label + ข้อความที่ส่งเมื่อกดปุ่ม |
| `hot` | boolean | ✓ | แสดงป้าย HOT! |

### 3.2 `data/services.json`
Array เรียงตามลำดับ carousel รวม "การ์ดบริการ" กับ "รูปราคา" ไว้เรคคอร์ดเดียว

| ฟิลด์ | ชนิด | บังคับ | ความหมาย |
|---|---|---|---|
| `id` | string | ✓ | ไม่ซ้ำ |
| `image` | string URL | ✓ | รูปหัวการ์ด |
| `title` | string | ✓ | ชื่อโปรแกรม |
| `subtitle` | string | ✓ | ข้อความใต้หัวข้อ (เดิมชื่อ `inquiryText`) |
| `actionText` | string | ✓ | ข้อความที่ส่งเมื่อกดปุ่ม และเป็น trigger ของรูปราคา ไม่ซ้ำ |
| `hot` | boolean | ✓ | ป้าย HOT! |
| `priceImages` | string URL[] | ✓ (ว่างได้) | รูปราคา 1 รูป = 1 bubble สูงสุด 12 |

พฤติกรรม: เมื่อผู้ใช้ส่ง `actionText`
- `priceImages` ไม่ว่าง → ตอบ `[FlexServicePrices(priceImages), textFollowUp]`
- `priceImages` ว่าง → ตอบ `[textFollowUp]` เท่านั้น

`textFollowUp` = `"👨‍⚕️ปรึกษาหมอได้เลย หมอตอบเองครับ"` เป็นค่าคงที่ในโค้ด

### 3.3 `data/branches.json`
Array 1 เรคคอร์ด = 1 สาขา ลำดับใน array = ลำดับที่แสดงภายในภูมิภาค

| ฟิลด์ | ชนิด | บังคับ | ความหมาย |
|---|---|---|---|
| `id` | string | ✓ | ไม่ซ้ำ |
| `trigger` | string | ✓ | ข้อความจาก Rich Menu / เมนูสาขา (key เดิม) ไม่ซ้ำ |
| `displayName` | string | ✓ | ชื่อบนการ์ดแผนที่ (เดิม `branchName`) |
| `region` | string | ✓ | ต้องมีใน `regions.json` |
| `menu` | `"main"` / `"thonglor"` / `"both"` | ✓ | แสดงในเมนู "ตารางแพทย์" / "ตารางแพทย์สาขาทองหล่อ" / ทั้งสอง |
| `mainMenuActionText` | string | ✗ | ข้อความที่ส่งเมื่อกดสาขานี้จาก**เมนูหลัก** (ค่าเริ่มต้น = `trigger`) ใช้กับ "ทองหล่อ" ที่กดแล้วส่ง `"ตารางแพทย์สาขาทองหล่อ"` เพื่อเปิดเมนูย่อย |
| `enabled` | boolean | ✓ | false = ไม่ตอบ trigger และไม่ขึ้นในเมนูสาขา |
| `fontSize` | string | ✓ | ขนาดชื่อสาขาบนการ์ด (ค่าเดิม `xxl` / `xl`) |
| `mapUrl` | string URL | ✓ | ลิงก์แผนที่ |
| `imageUrl` | string URL | ✓ | รูปสาขา |
| `phoneNumber` | string | ✓ | เบอร์โทรแสดงผล |
| `lineId` | string | ✓ | LINE ID แสดงผล |
| `lineUrl` | string URL | ✗ | ลิงก์ LINE (ถ้าไม่มี การ์ดไม่ใส่ action) |
| `doctors` | Doctor[] | ✓ (ว่างได้) | ตารางแพทย์ |

Doctor: `{ day, name, license, imageUrl }` ทุกฟิลด์ string บังคับ `day` ต้องเป็นหนึ่งใน
วันจันทร์ วันอังคาร วันพุธ วันพฤหัสบดี วันศุกร์ วันเสาร์ วันอาทิตย์

Trigger ที่สร้างอัตโนมัติจากสาขา:
- `trigger` → `[BranchMap(สาขา), IconTable(scheduleTrigger)]`
- `scheduleTrigger = "สอบถามตารางแพทย์ สาขา" + trigger` → carousel ตารางแพทย์ แบ่งเป็นหลายข้อความ
  ทุก 12 คน (LINE จำกัด 12 bubble ต่อ carousel) `doctors` ว่าง → ไม่ลงทะเบียน scheduleTrigger

ตรวจแล้ว: ทุกสาขาในโค้ดเดิม scheduleTrigger ตรงกับสูตรนี้ และ altText ของแผนที่เดิมคือ `"สาขา" + trigger`

### 3.4 `data/regions.json`
Array ของ bubble ในเมนู "ตารางแพทย์" 1 รายการ = 1 bubble แต่ละ bubble มีหัวข้อได้หลายหัวข้อ
(ตรงกับ `title` + `extraSections` ใน `tabledoctors.js` เดิม)

```json
[
  { "sections": ["กรุงเทพฯ ในเมือง"] },
  { "sections": ["กรุงเทพฯ-ปทุมธานี", "กรุงเทพฯ-นนทบุรี"] }
]
```

- ชื่อหัวข้อ (section) ห้ามซ้ำกันทั้งไฟล์ และ `branch.region` ต้องอ้างถึงชื่อหัวข้อที่มีอยู่
- ในแต่ละหัวข้อ สาขาเรียงตามลำดับใน `branches.json` แสดงเฉพาะ `enabled` และ `menu` เป็น `main` หรือ `both`
  ข้อความที่ส่งเมื่อกด = `mainMenuActionText` ถ้ามี ไม่งั้น = `trigger`
- เมนู "ตารางแพทย์สาขาทองหล่อ" = bubble เดียว หัวข้อ = `region` ของสาขาแรกที่ `menu` เป็น `thonglor` หรือ `both`
  รายการ = สาขาเหล่านั้นตามลำดับใน `branches.json` กดแล้วส่ง `trigger`

## 4. ฝั่ง server

### 4.1 ไฟล์ใหม่

**`services/dataStore.js`**
- `get(name)` คืนข้อมูล (จาก cache; อ่านไฟล์ครั้งแรก)
- `set(name, value)` เขียน atomic: เขียน `data/<name>.json.tmp` แล้ว rename ทับ
  ก่อนเขียน สำเนาไฟล์เดิมไป `data/backup/<name>.<ISO timestamp>.json` เก็บล่าสุด 20 ชุดต่อชื่อ
  จากนั้นอัปเดต cache และเรียก listener (`onChange(fn)`) ให้ messageTable สร้างใหม่
- `name` เป็นหนึ่งใน `promotions | services | branches | regions` เท่านั้น
- รับ `baseDir` เป็นพารามิเตอร์ตอนสร้าง เพื่อทดสอบด้วยโฟลเดอร์ชั่วคราวได้

**`services/validate.js`**
- `validatePromotions(arr)`, `validateServices(arr)`, `validateBranches(arr, regions)`, `validateRegions(arr, branches)`
- คืน `[]` เมื่อผ่าน หรือ `[{ path: "branches[3].doctors[1].imageUrl", message: "ต้องเป็น URL ขึ้นต้นด้วย http" }]`
- กฎ: ชนิดข้อมูล, ฟิลด์บังคับไม่ว่าง, URL ขึ้นต้น `http://` หรือ `https://`, `id`/`trigger`/`actionText` ไม่ซ้ำ,
  `day` อยู่ในรายการวัน, `region` มีใน regions, `menu` เป็นค่าที่กำหนด, `priceImages` ไม่เกิน 12,
  ชื่อหัวข้อใน regions ไม่ซ้ำและทุก bubble มีอย่างน้อย 1 หัวข้อ, ลบหัวข้อที่ยังมีสาขาใช้ไม่ได้

**`services/messageTable.js`**
- `build(data) → Map<trigger, () => Message[]>` เป็น pure function (ทดสอบง่าย)
- เนื้อหาตาราง:
  - `"บริการทั้งหมด"`, `"โปรโมชั่นล่าสุด"`, `"ตารางแพทย์"`, `"ตารางแพทย์สาขาทองหล่อ"`
  - ทุก `service.actionText`
  - ทุก `branch.trigger` และ `scheduleTrigger` (เฉพาะ `enabled`)
- `getTable()` คืนตารางปัจจุบัน สร้างใหม่เมื่อ dataStore แจ้ง onChange
- ถ้าข้อมูลใน JSON ทำให้ builder โยน error ตอนสร้างตาราง ให้ log และ**คงตารางเดิม**ไว้ (บอทไม่ล่ม)

**`middlewares/adminAuth.js`**
- ถ้าไม่มี `ADMIN_PASSWORD` → 503 `{ error: "admin disabled" }`
- ตรวจ `Authorization: Bearer <token>` token = `base64(exp) + "." + HMAC-SHA256(ADMIN_TOKEN_SECRET, exp)`
  หมดอายุหรือลายเซ็นผิด → 401

**`routes/adminRoute.js`** mount ที่ `/api/admin`

| Method | Path | Auth | ทำอะไร |
|---|---|---|---|
| POST | `/login` | ✗ | body `{password}` เทียบ constant-time กับ `ADMIN_PASSWORD`; ผิด → หน่วง 1 วิ แล้ว 401; ถูก → `{token, expiresAt}` อายุ 12 ชม. |
| GET | `/promotions` `/services` `/branches` `/regions` | ✓ | คืนข้อมูลทั้งชุด |
| PUT | `/promotions` `/services` `/branches` `/regions` | ✓ | body = ทั้งชุด; validate ไม่ผ่าน → 400 `{errors:[...]}`; ผ่าน → บันทึก, 200 คืนข้อมูลที่บันทึก |
| GET | `/triggers` | ✓ | `string[]` trigger ทั้งหมดที่บอทรู้จักตอนนี้ |
| GET | `/preview/:trigger` | ✓ | `Message[]` ที่บอทจะตอบ; ไม่รู้จัก → 404 |

### 4.2 แก้ไฟล์เดิม

- `index.js` — mount `/api/admin` และ `express.static(admin/dist)` ที่ `/admin` (SPA fallback ไป `index.html`)
  **ก่อน** `app.use("/", ...)` ที่ตอบ `"ok"` เปลี่ยน catch-all นั้นเป็น `app.get("/")` เพื่อไม่กิน path อื่น
- `routes/chatRoute.js` — เหลือ webhook handler + forwarding; `handleEvents` ใช้ `messageTable.getTable().get(text)`
- `flexmessage/promotion.js` → `FlexMessagePromotionBubble(promotions)` รับ array
- `flexmessage/services.js` → `FlexMessageServicesBubble(services)` รับ array (map `subtitle` → ข้อความรอง)
- `flexmessage/tabledoctors.js` → `FlexMessageTableDoctorsBubble(groups)` รับ `[{title, branches:[{name, actionText}]}]`
- `flexmessage/tabledoctorsThonglor.js` → `FlexMessageTableDoctorsThonglorBubble(group)` รับ 1 กลุ่ม
- ลบ `flexmessage/doctor*SchedulesData.js` ทั้งหมด (หลัง verify ผ่าน)
- `.env.example` เพิ่ม `ADMIN_PASSWORD=` และ `ADMIN_TOKEN_SECRET=` (ถ้าไม่ตั้ง secret ให้ derive จาก SHA-256 ของ password)
- `.gitignore` เพิ่ม `data/backup/`, `admin/node_modules/`, `admin/dist/`
- `package.json` — `"test": "node --test test/"`; ไม่เพิ่ม dependency ใหม่ฝั่ง server

## 5. หน้า admin (`admin/`)

- Vite + React 18 + react-router-dom; ไม่มี state library, ไม่มี UI framework; CSS ไฟล์เดียว รองรับมือถือ; ภาษาไทย
- dev: `cd admin && npm run dev` (:5173, proxy `/api` → `http://localhost:8080`)
- prod: `cd admin && npm run build` → `admin/dist` เสิร์ฟที่ `/admin`; `vite.config` ตั้ง `base: "/admin/"`
- `src/api.js` — fetch wrapper ใส่ Bearer token จาก localStorage; ได้ 401 → ล้าง token, ไปหน้า login

หน้า:
1. **Login** — ช่องรหัสผ่าน
2. **โปรโมชั่น** — รายการการ์ด (thumbnail, ชื่อ, ป้าย HOT) ปุ่ม ขึ้น/ลง/ลบ/แก้ไข; ฟอร์ม: URL รูป (preview), ชื่อ, บรรทัดบรรยาย (เพิ่ม/ลบ), ข้อความปุ่มสอบถาม, สวิตช์ HOT
3. **บริการ** — เหมือนโปรโมชั่น + ส่วนรูปราคา (รายการ URL เพิ่ม/ลบ/เรียง, preview, เตือนเมื่อเกิน 12)
4. **สาขา** — ตารางรายชื่อ (ชื่อ, ภูมิภาค, เมนู, เปิด/ปิด, จำนวนแพทย์) + ปุ่มเพิ่มสาขา (generate `id` จากชื่อ)
   หน้าแก้ไข 2 แท็บ: *ข้อมูลสาขา* (ทุกฟิลด์ใน 3.3; ภูมิภาค = dropdown จากหัวข้อทั้งหมดใน regions, เมนู = dropdown หลัก/ทองหล่อ/ทั้งสอง, ช่อง "ข้อความเมื่อกดจากเมนูหลัก" ไม่บังคับ) และ *ตารางแพทย์* (ตารางแถวละ 1 คน วัน dropdown, ชื่อ, ใบอนุญาต, URL รูป preview, เพิ่ม/ลบ/ขึ้น/ลง, แสดงจำนวน carousel ที่จะถูกแบ่ง)
5. **ภูมิภาค** — รายการ bubble เรียงขึ้น/ลง/เพิ่ม/ลบ แต่ละ bubble แก้รายชื่อหัวข้อได้ (เพิ่ม/ลบ/เรียง) ลบหัวข้อไม่ได้ถ้ามีสาขาใช้อยู่

พฤติกรรมร่วม:
- แก้ในหน่วยความจำ; แถบบน "มีการเปลี่ยนแปลงที่ยังไม่บันทึก" + ปุ่ม บันทึก / ยกเลิก
- บันทึก = PUT ทั้งชุดของหน้านั้น; 400 → แสดง error ใต้ช่องตาม `path`
- `beforeunload` เตือนถ้ายังไม่บันทึก
- ปุ่ม "ดู Flex JSON" ต่อรายการ → เรียก `/preview/:trigger` แสดง JSON + ปุ่ม copy (เอาไปวาง LINE Flex Simulator)

## 6. การย้ายข้อมูล

- `scripts/migrate-to-json.js` — require ไฟล์ JS เดิม (รวม parse สาขาที่ถูก comment ออกใน chatRoute.js เป็น `enabled:false`)
  เขียน `data/*.json`; รันครั้งเดียว
- `scripts/verify-migration.js` — สร้างข้อความจากตารางเดิม (hard-code) และตารางใหม่ (จาก JSON) ทุก trigger
  แล้ว `JSON.stringify` เทียบกัน; สาขาที่แพทย์เกิน 12 คน (พระราม 9, ทองหล่อ) เทียบว่า bubble รวมทั้งหมดเท่ากันและลำดับเดิม
  ต้องผ่านทุก trigger ก่อนลบโค้ดเก่า
- หลัง verify ผ่าน: ลบไฟล์ข้อมูล JS เดิม, ลบสคริปต์ทั้งสอง (เหลือใน git history), commit JSON

## 7. การทดสอบ

`node --test test/` (Node 20 มีในตัว) ไม่ติดตั้ง test library เพิ่ม
- `test/dataStore.test.js` — อ่าน, เขียน atomic, backup ไม่เกิน 20, cache refresh, onChange ถูกเรียก
- `test/validate.test.js` — กรณีผ่าน/ไม่ผ่านทุกกฎ พร้อม `path` ถูกต้อง
- `test/messageTable.test.js` — trigger ครบ, สาขาปิดไม่ถูกตอบ, แพทย์เกิน 12 แบ่งถูก, บริการไม่มีรูปราคาตอบเฉพาะข้อความ, ข้อมูลเสียคงตารางเดิม
- `test/adminRoute.test.js` — ใช้ `http` + `fetch` ในตัว Node กับ app ที่ listen พอร์ตสุ่ม:
  login ผิด/ถูก, ไม่มี token → 401, ไม่ตั้ง ADMIN_PASSWORD → 503, PUT ผิด → 400 พร้อม errors, PUT ถูก → ไฟล์เปลี่ยน
- ฝั่ง React: `npm run build` ผ่าน + ทดสอบด้วยมือทุกหน้าในเบราว์เซอร์

## 8. เอกสาร

อัปเดต `CLAUDE.md` และ `README.md` ส่วน "Adding or changing a menu/branch" ให้ชี้ไปที่หน้า admin / `data/*.json`
และวิธีรัน admin (dev/build) และตัวแปร env ใหม่
