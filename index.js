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
