# รองรับ LINE OA หลายบัญชีบน webhook เดียว (เฟส 1) — Design Spec

วันที่: 2026-10-07
สถานะ: ผู้ใช้อนุมัติแล้ว ลงมือทำแล้วบน branch `feat/multi-oa-webhook` (มีข้อเพิ่มเติมหลังตรวจโค้ดในข้อ 10)

## 1. เป้าหมาย

ให้แอปนี้เป็น webhook ของ LINE OA ได้หลายบัญชีพร้อมกัน (ตอนนี้ 3 บัญชี: เดิม 1 + ใหม่ 2)
โดยทุกบัญชีตอบเนื้อหาชุดเดียวกันจาก `data/*.json` แก้ใน `/backoffice` ครั้งเดียวมีผลทุกบัญชี

ปัจจุบัน `routes/chatRoute.js` อ่าน channel secret / access token ได้คู่เดียวจาก `.env`
ถ้านำ Webhook URL เดิมไปใส่ใน OA อื่น การตรวจ signature จะไม่ผ่านทุกครั้ง

งานทั้งหมดแบ่งเป็น 2 เฟส เอกสารนี้ครอบคลุมเฟส 1 เท่านั้น

| เฟส | เนื้องาน | เอกสาร |
|---|---|---|
| 1 | Webhook หลายบัญชี | เอกสารนี้ |
| 2 | หน้า Rich Menu ใน `/backoffice` และปุ่ม sync ไปทุก OA ผ่าน Messaging API | spec แยก เขียนหลังเฟส 1 เสร็จ |

### สิ่งที่ผู้ใช้ยืนยันแล้ว

- OA ทั้ง 3 บัญชีตอบเนื้อหาเหมือนกันทั้งหมด
- แอปเดียว ทุก OA ใช้ Webhook URL เดียวกัน แยกบัญชีจาก signature
- secret / token ของ OA เก็บใน `.env` ไม่กรอกผ่าน `/backoffice`
- Rich Menu จะจัดการใน `/backoffice` และ sync ผ่าน API (เฟส 2)

### สมมติฐาน

- OA ใหม่ไม่ส่งต่อ webhook ไประบบภายนอกจนกว่าจะตั้งค่าเปิดเอง
  (เลือกค่าเริ่มต้นที่ปลอดภัย เพราะยังไม่ได้ข้อสรุปว่าระบบปลายทางต้องการ event ของ OA ใหม่หรือไม่)
- ไม่ทราบค่า `FORWARD_WEBHOOK_URL_PROCESS` บนเซิร์ฟเวอร์จริง ดีไซน์นี้จึงคงพฤติกรรมของ OA เดิมไว้ทุกกรณี

## 2. ขอบเขต

ทำ:
- อ่านรายชื่อ OA หลายบัญชีจาก `.env`
- หา OA ต้นทางของแต่ละ request จาก signature แล้วตอบด้วย token ของ OA นั้น
- ตั้งค่าการส่งต่อ webhook แยกต่อ OA
- ตรวจ token ของทุก OA ตอนเปิดแอป และ log ผล
- เทสต์ฝั่ง server ด้วย `node --test`
- อัปเดต `.env.example`, `CLAUDE.md`, `README.md`

ไม่ทำ (อยู่เฟส 2):
- หน้า Rich Menu และการ sync
- แสดงรายชื่อ OA ใน `/backoffice`

ไม่ทำ (ไม่มีแผน):
- เนื้อหาต่างกันต่อ OA
- เพิ่ม/ลบ OA โดยไม่ restart
- เปลี่ยน payload หรือ header ของการส่งต่อ webhook

## 3. การตั้งค่า (`.env`)

OA แรกใช้ชื่อตัวแปรเดิม ไม่มีเลขต่อท้าย OA ถัดไปใช้เลขต่อท้ายตั้งแต่ `_2`
เซิร์ฟเวอร์ที่มีเฉพาะตัวแปรเดิมต้องทำงานเหมือนก่อน deploy ทุกประการ

| ตัวแปร | บังคับ | ความหมาย |
|---|---|---|
| `LINE_CHANNEL_TOKEN` | ✓ | access token ของ OA 1 |
| `LINE_CHANNEL_SECRET` | ✓ | channel secret ของ OA 1 |
| `LINE_CHANNEL_NAME` | | ชื่อที่ใช้ใน log ค่าเริ่มต้น `OA 1` |
| `FORWARD_WEBHOOK_URL_PROCESS` | | `"true"` = เปิดส่งต่อของ OA 1 (ความหมายเดิม) |
| `FORWARD_WEBHOOK_URL` | | ปลายทางส่งต่อของ OA 1 (ความหมายเดิม) |
| `LINE_CHANNEL_TOKEN_<n>` | คู่กับ secret | access token ของ OA n |
| `LINE_CHANNEL_SECRET_<n>` | คู่กับ token | channel secret ของ OA n |
| `LINE_CHANNEL_NAME_<n>` | | ชื่อที่ใช้ใน log ค่าเริ่มต้น `OA <n>` |
| `FORWARD_WEBHOOK_URL_<n>` | | ถ้ามีค่า = ส่งต่อ event ของ OA n ไป URL นี้ ถ้าไม่มี = ไม่ส่งต่อ |

กติกา:
- `<n>` เป็นจำนวนเต็มตั้งแต่ 2 ขึ้นไป ไม่มีศูนย์นำหน้า ไม่จำเป็นต้องเรียงติดกัน (มี `_2` กับ `_4` ได้)
- ค่าว่าง (`LINE_CHANNEL_TOKEN_2=`) ถือว่าไม่ได้ตั้ง
- OA n ≥ 2 ไม่มีตัวแปร `_PROCESS` การมีหรือไม่มี `FORWARD_WEBHOOK_URL_<n>` คือสวิตช์
- ตัวแปรที่ลงท้ายด้วยอย่างอื่นที่ไม่ใช่ตัวเลข เช่น `LINE_CHANNEL_TOKEN_OLD` ถูกเมิน

แอปไม่ยอมเปิดและแจ้งสาเหตุ เมื่อ:
- ไม่มี `LINE_CHANNEL_TOKEN` หรือ `LINE_CHANNEL_SECRET`
- OA ใดมี token แต่ไม่มี secret หรือกลับกัน
- เลขต่อท้ายของตัวแปรใดในตารางข้างบนเป็น `_0`, `_1` หรือมีศูนย์นำหน้า (`_02`)
- secret ซ้ำกันสองบัญชี หรือ token ซ้ำกันสองบัญชี
- มี `LINE_CHANNEL_NAME_<n>` หรือ `FORWARD_WEBHOOK_URL_<n>` แต่ไม่มี token/secret ของ OA n
- มี `FORWARD_WEBHOOK_URL_PROCESS_<n>` (เพิ่มหลังตรวจโค้ด ดูข้อ 10)

ข้อความ error ระบุชื่อตัวแปรที่ผิด แต่ไม่พิมพ์ค่าของ secret หรือ token

## 4. โครงสร้างโค้ด

### 4.1 `services/channels.js` (ไฟล์ใหม่)

```js
loadChannels(env = process.env)
// → [{ id: 1, name: "OA 1", channelSecret, channelAccessToken, forwardUrl: string | null }, ...]
// เรียงตาม id, throw Error ตามกติกาข้อ 3, เป็น pure function ไม่แตะ network หรือไฟล์

findChannelBySignature(channels, rawBody, signature)
// → channel ตัวแรกที่ line.validateSignature(rawBody, channel.channelSecret, signature) เป็นจริง
// → null ถ้าไม่มี rawBody, ไม่มี signature หรือไม่ตรงกับ OA ใด

checkChannelTokens(channels, { getBotInfo })
// → Promise<[{ id, name, ok: true, basicId, displayName } | { id, name, ok: false, error }]>
// ไม่ throw, ค่าเริ่มต้นของ getBotInfo เรียก GET /v2/bot/info ด้วย token ของ channel นั้น
```

`forwardUrl` ของ OA 1 = `FORWARD_WEBHOOK_URL` เมื่อ `FORWARD_WEBHOOK_URL_PROCESS === "true"` และ URL มีค่า นอกนั้น `null`
`forwardUrl` ของ OA n = `FORWARD_WEBHOOK_URL_<n>` หรือ `null`

### 4.2 `routes/chatRoute.js` (แก้)

เปลี่ยนจาก module ที่อ่าน `.env` เอง เป็น factory แบบเดียวกับ `createAdminRouter`:

```js
createChatRouter({ channels, messageTable, createClient, forward })
```

- `createClient(channel)` ค่าเริ่มต้นสร้าง `line.Client` ของ channel นั้น เรียกครั้งเดียวต่อ channel ตอนสร้าง router
- `forward(url, body)` ค่าเริ่มต้นคือ `axios.post` พร้อม header `Content-Type: application/json` เหมือนเดิม
- เลิกใช้ `line.middleware` เพราะรับ secret ได้ตัวเดียว
- ไม่ export `messageTable` อีกต่อไป และไม่เรียก `dotenv` ในไฟล์นี้

### 4.3 `index.js` (แก้)

- ย้าย `require("dotenv").config()` มาไว้บรรทัดบนสุด
- สร้าง `store`, `messageTable`, `channels` ที่นี่ แล้วส่งให้ทั้ง `createChatRouter` และ `createAdminRouter`
- ถ้า `loadChannels` throw ให้แอปจบการทำงานพร้อมข้อความ error
- หลัง `listen`: log จำนวนและชื่อ OA พร้อมสถานะส่งต่อ (เปิด/ปิด ไม่พิมพ์ URL) แล้วเรียก `checkChannelTokens` และ log ผลทีละบัญชี
  token ที่ใช้ไม่ได้ให้ `console.warn` แต่แอปยังทำงานต่อ

## 5. ลำดับการทำงานของ `POST /webhook`

1. `express.json` ใน `index.js` เก็บ `req.rawBody` ไว้เหมือนเดิม
2. อ่าน header `x-line-signature` แล้วเรียก `findChannelBySignature`
3. ไม่พบ OA → ตอบ `401 { "message": "invalid signature" }` จบ
4. พบ OA → ถ้า `channel.forwardUrl` มีค่า ส่งต่อ `req.body` ไป URL นั้น (ทำคู่ขนานกับข้อ 5 เหมือนเดิม)
5. แต่ละ event ที่เป็นข้อความ text: หา `messageTable.getTable().get(text)` ถ้าเจอ ตอบด้วย client ของ OA นั้น
6. ตอบ `200` พร้อมผลลัพธ์รูปแบบเดิม

`messageTable` เป็นตัวเดียวใช้ร่วมกันทุก OA

## 6. การจัดการข้อผิดพลาด

| กรณี | ผล |
|---|---|
| ไม่มี signature หรือไม่ตรงกับ OA ใด | `401`, log เตือนหนึ่งบรรทัด, ไม่ตอบลูกค้า, ไม่ส่งต่อ |
| ส่งต่อไม่สำเร็จ | log พร้อมชื่อ OA, ยังตอบลูกค้าตามปกติ (เหมือนเดิม) |
| `replyMessage` ล้มเหลว | log พร้อมชื่อ OA, ตอบ `200` (เหมือนเดิม) |
| `req.body.events` ไม่มี | ถือเป็น array ว่าง ตอบ `200` |
| `.env` ผิดกติกาข้อ 3 | แอปไม่เปิด แจ้งสาเหตุ |
| token ใช้ไม่ได้ตอนเปิดแอป | `console.warn` แอปทำงานต่อ |

พฤติกรรมที่เปลี่ยนจากเดิม: signature ผิดเคยได้ `500` (ผ่าน `errorHandler`) ตอนนี้ได้ `401` และมีอีก 2 ข้อที่เพิ่มหลังตรวจโค้ด (ข้อ 10)
LINE ถือว่าทั้งสองแบบคือส่งไม่สำเร็จ จึงไม่กระทบการทำงาน

## 7. การทดสอบ

ใช้ `node --test` ไม่เพิ่ม dependency เทสต์เดิม 52 ข้อต้องผ่านทั้งหมด

`test/channels.test.js`
- มีเฉพาะ OA 1 → 1 channel ชื่อ `OA 1`
- มี OA 1, 2, 3 → 3 channel เรียงตาม id พร้อมชื่อที่ตั้ง
- เลขไม่ติดกัน (`_2`, `_4`) → โหลดได้ครบ
- ค่าว่างถือว่าไม่ได้ตั้ง
- กรณี error แต่ละข้อในข้อ 3 → throw และข้อความไม่มีค่า secret/token
- `forwardUrl` ของ OA 1 ตามคู่ `_PROCESS` + URL, ของ OA n ตาม `FORWARD_WEBHOOK_URL_<n>`
- `findChannelBySignature`: เซ็นด้วย secret ของแต่ละ OA ได้ OA นั้น, signature มั่วได้ `null`, ไม่มี signature ได้ `null`
- `checkChannelTokens`: `getBotInfo` ปลอมที่สำเร็จและล้มเหลว ได้ผลครบทุก OA และไม่ throw

`test/chatRoute.test.js` (เปิด express จริงบนพอร์ตสุ่ม ใช้ client และ `forward` ปลอมที่บันทึกการเรียก)
- เซ็นด้วย secret ของ OA 2 และส่ง trigger ที่มีอยู่ → `replyMessage` ถูกเรียกบน client ของ OA 2 เท่านั้น
- signature ผิด → `401` ไม่มี client ใดถูกเรียก ไม่มีการส่งต่อ
- ไม่มี header signature → `401`
- trigger ที่ไม่มีในตาราง → `200` ไม่มีการตอบ
- `events: []` (ปุ่ม Verify ของ LINE) → `200`
- ส่งต่อเฉพาะ OA ที่มี `forwardUrl` และไป URL ของ OA นั้น
- `forward` ล้มเหลว → ยังตอบลูกค้าและได้ `200`

## 8. ขั้นตอนนำขึ้นใช้งาน

1. ทดสอบบน staging: ใส่ค่าของ OA ที่ยังไม่เปิดใช้จริงเป็น `_2` แล้วตั้ง Webhook URL ของ OA นั้นมาที่ staging
2. Deploy ขึ้นเซิร์ฟเวอร์จริงตามขั้นตอนในหัวข้อ Deploying ของ `CLAUDE.md` โดยยังไม่แก้ `.env` แล้วยืนยันว่า OA เดิมตอบปกติ
3. เพิ่ม `LINE_CHANNEL_TOKEN_2` / `_SECRET_2` / `_NAME_2` และ `_3` ใน `.env` ของเซิร์ฟเวอร์ แล้ว restart
4. ดู log ตอนเปิดแอปว่าโหลดครบ 3 บัญชีและ token ผ่านทุกตัว
5. ใน LINE Developers console ของ OA ใหม่แต่ละบัญชี: ใส่ Webhook URL เดียวกับ OA เดิม เปิด Use webhook แล้วกด Verify
6. ใน LINE OA Manager ของ OA ใหม่: ตั้ง Response settings ให้เปิด Webhook
7. สร้าง Rich Menu ด้วยมือใน OA Manager ให้ OA ใหม่ไปก่อน โดยพิมพ์ข้อความ trigger ให้ตรงกับ OA เดิมทุกตัวอักษร (ใช้จนกว่าเฟส 2 เสร็จ)

ถอยกลับ: ลบตัวแปร `_2` / `_3` ออกจาก `.env` แล้ว restart OA เดิมไม่ได้รับผลกระทบ

## 9. เกณฑ์ว่าสำเร็จ

- ส่ง trigger เดียวกันจาก OA ทั้ง 3 บัญชี ได้คำตอบเหมือนกัน และแต่ละคำตอบออกจากบัญชีที่ลูกค้าทักมา
- แก้ข้อมูลใน `/backoffice` ครั้งเดียว คำตอบของทั้ง 3 บัญชีเปลี่ยนตาม
- เซิร์ฟเวอร์ที่ `.env` มีเฉพาะ OA เดิมทำงานเหมือนก่อน deploy
- `npm test` ผ่านทั้งหมด

## 10. ข้อเพิ่มเติมหลังตรวจโค้ด (2026-10-07)

ผู้ตรวจอิสระตรวจทั้ง branch แล้วพบ 3 เรื่องที่แก้ไปพร้อมกัน แต่ละเรื่องมีเทสต์ที่ล้มก่อนแก้

| เรื่อง | ก่อนแก้ | หลังแก้ |
|---|---|---|
| access token ลง log | เมื่อ `replyMessage` ล้มเหลว โค้ด log error ของ LINE SDK ทั้ง object ซึ่งมี header `Authorization: Bearer <token>` อยู่ข้างใน (เป็นมาตั้งแต่ก่อนงานนี้) | log เฉพาะข้อความ, HTTP status และ error body ของ LINE |
| JSON พังหรือ body ใหญ่เกิน 2 MB | ได้ `500` และ log stack พร้อม body ที่ส่งมา โดยไม่ต้องมี signature (เป็นมาตั้งแต่ก่อนงานนี้) | ได้ `400` / `413` และ log บรรทัดเดียวไม่มี body มีผลกับทุก route เพราะแก้ที่ `middlewares/errorHandler.js` |
| `FORWARD_WEBHOOK_URL_PROCESS_<n>` | ถูกเมิน คนที่ตั้ง `_PROCESS_2=false` คู่กับ `FORWARD_WEBHOOK_URL_2` จะเข้าใจว่าปิดส่งต่อแล้ว ทั้งที่ยังเปิดอยู่ | แอปไม่เปิดและแจ้งให้ลบตัวแปรนี้ ค่าว่างยังถือว่าไม่ได้ตั้ง |

เทสต์รวมเป็น 90 ข้อ (เพิ่ม `test/errorHandler.test.js` 4 ข้อ, `test/chatRoute.test.js` 1 ข้อ, `test/channels.test.js` 1 ข้อ)

หลังจากนั้นผู้ใช้ขอให้แก้เรื่องเล็กที่ผู้ตรวจแจ้งไว้ด้วย รวมเป็น 94 ข้อ

| เรื่อง | หลังแก้ |
|---|---|
| การส่งต่อ webhook | ไม่รอผลอีกต่อไป (แทนข้อ 5 ขั้นที่ 4 ที่เขียนว่าเหมือนเดิม) LINE ได้คำตอบทันทีแม้ปลายทางช้า และมี timeout 10 วินาที payload กับ header ไม่เปลี่ยน |
| log เมื่อ signature ไม่ผ่าน | มี IP ของผู้ส่ง และ destination เฉพาะเมื่อหน้าตาเป็น user ID ของ LINE ส่วน log ตอนเปิดแอปพิมพ์ user ID ของแต่ละ OA ไว้ให้เทียบ |
| event ชนิด message ที่ไม่มี field `message` | ข้ามไปโดยไม่ log error |
| `FORWARD_WEBHOOK_URL_PROCESS` | ตัดช่องว่างหัวท้ายก่อนเทียบกับ `true` เหมือนค่าอื่น |
