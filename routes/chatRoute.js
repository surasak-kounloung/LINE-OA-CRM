// Webhook ของ LINE (รองรับหลาย OA): หา OA ต้นทางจาก signature → ส่งต่อ payload ถ้าตั้งค่าไว้ → ตอบจากตาราง trigger
const express = require("express");
const line = require("@line/bot-sdk");
const axios = require("axios");
const { findChannelBySignature } = require("../services/channels");

const defaultCreateClient = (channel) =>
  new line.Client({ channelAccessToken: channel.channelAccessToken, channelSecret: channel.channelSecret });

// ปลายทางส่งต่อที่ค้างต้องไม่กิน connection ไปเรื่อย ๆ
const FORWARD_TIMEOUT_MS = 10000;
const defaultForward = (url, body) =>
  axios.post(url, body, { headers: { "Content-Type": "application/json" }, timeout: FORWARD_TIMEOUT_MS });

// destination ใน body ยังไม่ผ่านการตรวจ signature — จะ log ก็ต่อเมื่อหน้าตาเป็น user ID ของ LINE จริง
const LINE_USER_ID = /^U[0-9a-f]{32}$/;

// ข้อความสำหรับ log — ห้าม log error ของ LINE SDK ทั้ง object เพราะ originalError มี header Authorization (access token) อยู่ข้างใน
function describeError(error) {
  if (!error || typeof error !== "object") return String(error);
  if (error.originalError || error.statusCode) {
    const detail = error.originalError?.response?.data;
    return `${error.message} (HTTP ${error.statusCode})${detail ? ` ${JSON.stringify(detail)}` : ""}`;
  }
  return error.stack || error.message || String(error);
}

function createChatRouter({ channels, messageTable, createClient = defaultCreateClient, forward = defaultForward }) {
  const router = express.Router();

  // client ของแต่ละ OA สร้างครั้งเดียว — ต้องตอบด้วย token ของ OA ที่ลูกค้าทักมาเท่านั้น
  const clients = new Map(channels.map((channel) => [channel.id, createClient(channel)]));

  const handleEvent = async (channel, event) => {
    try {
      if (event.type !== "message" || event.message?.type !== "text") {
        return null;
      }
      const messages = messageTable.getTable().get(event.message.text);
      if (!messages) {
        return null;
      }
      await clients.get(channel.id).replyMessage(event.replyToken, messages);
      return null;
    } catch (error) {
      console.error(`[${channel.name}] เกิดข้อผิดพลาดในการจัดการอีเวนต์: ${describeError(error)}`);
      return null;
    }
  };

  // ส่งต่อ payload ดิบไป CRM โดยไม่รอผล — LINE ต้องได้คำตอบทันทีแม้ปลายทางช้าหรือล่ม
  const forwardInBackground = (channel, body) => {
    new Promise((resolve) => resolve(forward(channel.forwardUrl, body)))
      .then((response) => console.log(`[${channel.name}] ส่งต่อข้อมูลสำเร็จ:`, response && response.status))
      .catch((error) => console.error(`[${channel.name}] เกิดข้อผิดพลาดในการส่งต่อข้อมูล:`, error?.message));
  };

  router.post("/", async (req, res) => {
    // req.rawBody มาจาก rawBodySaver ใน index.js — signature ของ LINE คำนวณจาก body ดิบ
    const channel = findChannelBySignature(channels, req.rawBody, req.get("x-line-signature"));
    if (!channel) {
      // ถ้า destination ตรงกับ user ID ของ OA ที่ log ไว้ตอนเปิดแอป แปลว่า secret ของ OA นั้นใน .env ผิด
      const destination = LINE_USER_ID.test(req.body?.destination) ? req.body.destination : "-";
      console.warn(`webhook: signature ไม่ตรงกับ LINE OA ใดที่ตั้งค่าไว้ (ip ${req.ip}, destination ${destination})`);
      return res.status(401).json({ message: "invalid signature" });
    }

    try {
      if (channel.forwardUrl) {
        forwardInBackground(channel, req.body);
      }

      const events = Array.isArray(req.body.events) ? req.body.events : [];
      const handleResult = await Promise.all(events.map((event) => handleEvent(channel, event)));
      return res.json(handleResult);
    } catch (error) {
      console.error(`[${channel.name}] เกิดข้อผิดพลาดในการดำเนินการ:`, error.message);
      return res.status(500).end();
    }
  });

  return router;
}

module.exports = { createChatRouter };
