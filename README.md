# LINE-OA-CRM

ระบบ Webhook สำหรับ LINE Official Account เพื่อทำงานเป็นแชทบอทแนว CRM ตอบกลับผู้ใช้ด้วย LINE Flex Message ตามข้อความที่พิมพ์มา และสามารถส่งต่ออีเวนต์ไปยังระบบภายนอกได้ตามต้องการ

## ภาพรวมโปรเจกต์
- ใช้ Express.js เปิดให้บริการเส้นทาง `POST /webhook` เพื่อรับอีเวนต์จาก LINE
- แอปเดียวรองรับ LINE OA หลายบัญชีบน Webhook URL เดียวกัน ทุกบัญชีตอบเนื้อหาชุดเดียวกัน — ดูหัวข้อ [ใช้หลาย LINE OA กับแอปเดียว](#ใช้หลาย-line-oa-กับแอปเดียว)
- ตรวจสอบลายเซ็นด้วย `@line/bot-sdk` และตอบกลับข้อความ/ Flex Message ผ่าน LINE Messaging API
- รองรับการ Forward อีเวนต์ไปยังปลายทางภายนอกผ่านตัวแปรแวดล้อม (ทำงานแบบ async ไม่บล็อกการตอบกลับ LINE)
- เนื้อหาบอททั้งหมด (โปรโมชั่น, บริการ, สาขา, ตารางแพทย์) เก็บเป็นไฟล์ JSON ใน `data/` และแก้ไขได้ผ่านหน้า Admin โดยไม่ต้องแก้โค้ด — ดูหัวข้อ [หน้า Admin](#หน้า-admin-แก้ไขข้อมูลบอทโดยไม่แก้โค้ด) ด้านล่าง
- โฟลเดอร์ `flexmessage/` มีเฉพาะฟังก์ชันสร้าง Flex Message (builder) รับข้อมูลเป็นพารามิเตอร์ ไม่มีเนื้อหาฝังในไฟล์

## โครงสร้างโดยย่อ
- `index.js` : ตั้งค่า Express, มิดเดิลแวร์, เมานต์เราท์ (`/webhook`, `/api/admin`, `/backoffice`) และเริ่มต้นเซิร์ฟเวอร์
- `routes/chatRoute.js` : รับอีเวนต์จาก LINE, หาว่ามาจาก OA ไหนจากลายเซ็น, ค้นหาข้อความผู้ใช้ในตารางที่สร้างจาก `services/messageTable.js` แล้วตอบด้วย token ของ OA นั้น, (ออปชัน) ส่งต่ออีเวนต์ไปปลายทางภายนอก
- `services/channels.js` : อ่านรายชื่อ LINE OA จาก `.env`, หา OA ต้นทางจากลายเซ็น, ตรวจ token ตอนเปิดแอป
- `routes/adminRoute.js`, `middlewares/adminAuth.js` : API ของหน้า Admin (login, อ่าน/แก้ไขข้อมูล) และมิดเดิลแวร์ตรวจสิทธิ์
- `services/dataStore.js` : อ่าน/เขียนไฟล์ใน `data/*.json` (เขียนแบบ atomic, สำรองไฟล์เดิม, cache)
- `services/messageTable.js` : สร้างตาราง trigger → Flex Message จากข้อมูลใน `data/*.json`
- `services/validate.js` : กฎตรวจสอบข้อมูลก่อนบันทึกจากหน้า Admin
- `data/` : ไฟล์ JSON ที่เป็นแหล่งข้อมูลจริงของบอท (`promotions.json`, `services.json`, `branches.json`, `regions.json`) และโฟลเดอร์ `data/backup/` เก็บไฟล์สำรอง
- `middlewares/errorHandler.js` : มิดเดิลแวร์จัดการ 404 และ Error
- `flexmessage/` : ฟังก์ชันสร้าง Flex Message (builder) แยกตามประเภท
- `admin/` : ซอร์สโค้ดหน้า Admin (Vite + React) build ออกมาเป็น `admin/dist`

## ความต้องการระบบ
- Node.js 18 ขึ้นไป (แนะนำ LTS)
- บัญชี LINE Developers พร้อม Channel (มี Channel access token และ Channel secret)

## การติดตั้ง
```bash
npm install
```

## การตั้งค่าไฟล์ .env
สร้างไฟล์ `.env` ที่รากโปรเจกต์ แล้วกำหนดค่าตัวแปรดังนี้
```dotenv
# พอร์ตของเซิร์ฟเวอร์ (ค่าเริ่มต้น 8080 หากไม่กำหนด)
PORT=8080

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

# หน้า Admin (/backoffice): รหัสผ่านเข้าใช้งาน และ secret สำหรับเซ็น token (ไม่ตั้งก็ derive จากรหัสผ่านได้ แต่แนะนำให้ตั้งแยก)
ADMIN_PASSWORD=
ADMIN_TOKEN_SECRET=
```

หมายเหตุ: ในโค้ดจะตรวจ `FORWARD_WEBHOOK_URL_PROCESS === "true"` ดังนั้นให้กำหนดเป็นสตริง "true" เพื่อเปิดการส่งต่อ

หาก `.env` ตั้งค่า LINE OA ไม่ถูกต้อง (เช่น มี token แต่ไม่มี secret, เลขต่อท้ายเป็น `_1`, หรือ secret ซ้ำกันสองบัญชี) แอปจะไม่เปิดและแจ้งชื่อตัวแปรที่ผิด

## การรันแอป
โหมดพัฒนา (auto-reload ด้วย nodemon):
```bash
npm run server
```

โหมดปกติ/โปรดักชัน:
```bash
npm start
```

ตรวจสุขภาพเบื้องต้น:
```bash
curl http://localhost:8080/
# ตอบกลับ: ok
```

## การเชื่อมต่อกับ LINE Developers
1. ไปที่ Console ของ LINE Developers และนำ `Channel access token` กับ `Channel secret` มากำหนดในไฟล์ `.env`
2. ตั้งค่า Webhook URL เป็น `https://<your-domain>/webhook`
3. เปิดใช้งาน Use Webhook และกด Verify เพื่อทดสอบ
4. ทดสอบส่งข้อความจากบัญชี LINE ของคุณไปยัง OA

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

## Endpoints ที่มีให้ใช้งาน
- `GET /` → ใช้เช็คสถานะเซิร์ฟเวอร์ (ตอบกลับเป็น `ok`)
- `POST /webhook` → จุดรับอีเวนต์จาก LINE (ต้องผ่านการตรวจลายเซ็น ใช้ URL เดียวกันทุก OA)
- `GET /backoffice` → หน้า Admin UI (ต้อง build ด้วย `npm run admin:build` ก่อน)
- `POST /api/admin/login` → ล็อกอินหน้า Admin ด้วยรหัสผ่าน ได้ token กลับมา
- `GET/PUT /api/admin/promotions`, `/api/admin/services`, `/api/admin/branches`, `/api/admin/regions` → อ่าน/แก้ไขข้อมูลแต่ละชุด (ต้องแนบ token)
- `GET /api/admin/triggers` → รายการ trigger ทั้งหมดที่บอทตอบได้จริงในขณะนี้
- `GET /api/admin/preview/:trigger` → ดูตัวอย่างข้อความ Flex ที่บอทจะตอบสำหรับ trigger นั้น

## คำสั่งข้อความที่รองรับ (ตัวอย่าง)
เมื่อผู้ใช้พิมพ์ข้อความด้านล่าง บอทจะตอบกลับ Flex Message ที่เกี่ยวข้องทันที (ตัวอย่างบางส่วน)

- เมนูหลัก/ทั่วไป
  - `บริการทั้งหมด`
  - `โปรโมชั่นล่าสุด`
  - `ตารางแพทย์`

- เมนูสาขา (ตอบกลับ 2 ข้อความ: ข้อมูลสาขา + ปุ่มไอคอนตารางแพทย์)
  - `สยาม สแควร์ วัน`
  - `เซ็นทรัล เวิล์ด`
  - `เทอร์มินอล อโศก`
  - `พระราม 9`
  - ฯลฯ

- ตารางแพทย์ตามสาขา (ตอบกลับตารางแพทย์โดยตรง)
  - `สอบถามตารางแพทย์ สาขาสยาม สแควร์ วัน`
  - `สอบถามตารางแพทย์ สาขาเซ็นทรัล เวิล์ด`
  - `สอบถามตารางแพทย์ สาขาเซ็นทรัล ลาดพร้าว`
  - ฯลฯ

หมายเหตุ: สามารถดูรายการคำสั่ง (trigger) ทั้งหมดที่บอทตอบได้จริงผ่าน `data/*.json` หรือหน้า Admin — ไม่มีการ hardcode ไว้ในโค้ดอีกต่อไป

## หน้า Admin (แก้ไขข้อมูลบอทโดยไม่แก้โค้ด)

1. ตั้ง `ADMIN_PASSWORD` ใน `.env` (และ `ADMIN_TOKEN_SECRET` ถ้าต้องการ)
2. สร้างหน้า admin ครั้งแรก: `npm run admin:build`
3. เปิด `https://<โดเมนของ server>/backoffice/` แล้วใส่รหัสผ่าน

ข้อมูลทั้งหมดอยู่ใน `data/*.json` (โปรโมชั่น, บริการ+รูปราคา, สาขา+ตารางแพทย์, ภูมิภาคของเมนูตารางแพทย์)
บันทึกแล้วบอทใช้ข้อมูลใหม่ทันที ไม่ต้อง restart ไฟล์เดิมถูกสำรองไว้ใน `data/backup/`

สำหรับนักพัฒนา: `cd admin && npm run dev` เปิด http://localhost:5173/backoffice/ (proxy API ไปที่ :8080)

## การส่งต่อ Webhook ไปยังระบบภายนอก (Forward)
การส่งต่อตั้งค่าแยกต่อ OA ใน `.env` (อ่านโดย `services/channels.js`)

- OA แรก: `FORWARD_WEBHOOK_URL_PROCESS` = "true" และมีค่า `FORWARD_WEBHOOK_URL` → ระบบจะส่งต่อ `req.body` ไปยังปลายทางด้วย `axios.post()` แบบ async (พร้อม ๆ กับการประมวลผลภายใน) หากไม่ต้องการส่งต่อ ให้ตั้ง `FORWARD_WEBHOOK_URL_PROCESS` เป็นค่าอื่น ๆ ที่ไม่ใช่ "true" หรือไม่กำหนดค่า
- OA เพิ่มเติม: ใส่ `FORWARD_WEBHOOK_URL_<n>` → ส่งต่ออีเวนต์ของ OA นั้นไป URL ดังกล่าว ถ้าไม่ใส่จะไม่ส่งต่อ (ไม่มีตัวแปร `_PROCESS` สำหรับ OA เพิ่มเติม ถ้าใส่ `FORWARD_WEBHOOK_URL_PROCESS_<n>` แอปจะไม่เปิดและแจ้งให้ลบออก)

คำแนะนำ:
- ควรใช้ HTTPS สำหรับปลายทาง
- รองรับกรณี LINE ทำการ retry ควรทำปลายทางให้ idempotent

## การเพิ่ม/แก้ไขเนื้อหา (โปรโมชั่น, บริการ, สาขา, ตารางแพทย์)
สำหรับเนื้อหาทั่วไปให้แก้ผ่านหน้า Admin ที่ `/backoffice` (ดูหัวข้อด้านบน) — ไม่ต้องแก้โค้ดหรือ deploy ใหม่
คำสั่ง (trigger) ต้องตรงกับข้อความที่ปุ่ม Rich Menu ส่งมาแบบ byte ต่อ byte

หากต้องแก้โครงสร้าง Flex Message เอง (เพิ่ม builder ใหม่):
1. เพิ่มไฟล์ builder ใหม่ในโฟลเดอร์ `flexmessage/` ที่รับข้อมูลเป็นพารามิเตอร์
2. เรียกใช้ builder นั้นจาก `services/messageTable.js`
3. ทดสอบและปรับปรุงข้อความ `altText` ให้สอดคล้องกับเนื้อหา

## ไลบรารีหลักที่ใช้งาน
- `@line/bot-sdk` สำหรับ LINE Messaging API และการตรวจลายเซ็น
- `express`, `body-parser`, `cookie-parser`, `cors` สำหรับเซิร์ฟเวอร์และมิดเดิลแวร์
- `axios` สำหรับการเรียก API ภายนอก/ส่งต่ออีเวนต์
- `dotenv` สำหรับโหลดตัวแปรแวดล้อมจากไฟล์ `.env`

## การดีพลอยและโดเมน
- หากทดสอบบนเครื่องท้องถิ่น แนะนำให้ใช้เครื่องมือเช่น ngrok เพื่อเปิด public URL ให้ LINE เรียก `POST /webhook`
- โปรดตั้งค่าไฟร์วอลล์และ HTTPS ให้เรียบร้อยเมื่อขึ้นโปรดักชัน

## การ deploy

`data/*.json` ถูก commit เข้า git **และ** ถูกแก้ไขสด ๆ บน server โดยหน้า Admin พร้อมกัน จึงต้องระวังไม่ให้การ deploy เขียนทับข้อมูลที่แอดมินแก้ผ่านหน้าเว็บ:

1. **ก่อน deploy เวอร์ชันใหม่** ให้คัดลอกไฟล์ `data/*.json` จาก server กลับเข้า repo (หรือ commit จาก server โดยตรง) เพื่อไม่ให้การแก้ไขของแอดมินหายไป
2. `git pull` จะปฏิเสธการเขียนทับไฟล์ใน `data/` ถ้ามีการแก้ไขค้างอยู่บน server (working tree มี local changes) — แก้ปัญหานี้โดย commit ข้อมูลจาก server ก่อน แล้วค่อย pull
3. อีกทางเลือกหนึ่ง: สั่ง `git update-index --skip-worktree data/*.json` บน server เพื่อบอก git ไม่ให้สนใจการเปลี่ยนแปลงของไฟล์เหล่านี้อีกต่อไป (เหมาะกับ server ที่ไม่ต้องการ sync ข้อมูลกลับ repo)
4. โฟลเดอร์ `admin/dist` ถูกใส่ไว้ใน `.gitignore` (ไม่ commit เข้า repo) ดังนั้นทุกครั้งที่ deploy ต้องรัน `npm run admin:build` เพื่อ build หน้า Admin ใหม่
5. ต้อง **restart เซิร์ฟเวอร์** หลัง build เสมอ เพราะ `index.js` เช็คว่ามีโฟลเดอร์ `admin/dist` อยู่หรือไม่แค่ครั้งเดียวตอนบูต (ถ้าไม่ restart หน้า `/backoffice` จะยังขึ้น 404 อยู่แม้ build เสร็จแล้ว)

## ใบอนุญาต
โครงการนี้ใช้สัญญาอนุญาตแบบ ISC (อ้างอิงจาก `package.json`)