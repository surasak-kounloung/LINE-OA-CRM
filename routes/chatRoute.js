const express = require("express");
const line = require("@line/bot-sdk");
const axios = require("axios");
require("dotenv").config();

const { getDefaultStore } = require("../services/dataStore");
const { createMessageTable } = require("../services/messageTable");

const router = express.Router();

const lineConfig = {
  channelAccessToken: process.env.LINE_CHANNEL_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET,
};

// URL ปลายทางสำหรับส่งต่อข้อมูล
const forwardUrl = process.env.FORWARD_WEBHOOK_URL;
const processLocally = process.env.FORWARD_WEBHOOK_URL_PROCESS === "true";

// ตาราง trigger → ข้อความตอบ สร้างจาก data/*.json และสร้างใหม่อัตโนมัติเมื่อหน้า admin บันทึก
const messageTable = createMessageTable(getDefaultStore());
const lineClient = new line.Client(lineConfig);

router.post("/", line.middleware(lineConfig), async (req, res) => {
  try {
    let forwardPromise = Promise.resolve(null);

    // ส่งต่อ payload ดิบไป CRM ถ้าเปิดใช้งาน (ไม่บล็อกการตอบ)
    if (processLocally === true && forwardUrl) {
      forwardPromise = axios
        .post(forwardUrl, req.body, { headers: { "Content-Type": "application/json" } })
        .then((response) => {
          console.log("ส่งต่อข้อมูลสำเร็จ:", response.status);
          return response;
        })
        .catch((error) => {
          console.error("เกิดข้อผิดพลาดในการส่งต่อข้อมูล:", error.message);
          return null;
        });
    }

    const handlePromise = Promise.all(req.body.events.map(handleEvents));
    const [, handleResult] = await Promise.all([forwardPromise, handlePromise]);
    res.json(handleResult);
  } catch (error) {
    console.error("เกิดข้อผิดพลาดในการดำเนินการ:", error.message);
    res.status(500).end();
  }
});

const handleEvents = async (event) => {
  try {
    if (event.type !== "message" || event.message.type !== "text") {
      return null;
    }
    const messages = messageTable.getTable().get(event.message.text);
    if (!messages) {
      return null;
    }
    await lineClient.replyMessage(event.replyToken, messages);
    return null;
  } catch (error) {
    console.error("เกิดข้อผิดพลาดในการจัดการอีเวนต์:", error);
    return null;
  }
};

module.exports = router;
module.exports.messageTable = messageTable;
