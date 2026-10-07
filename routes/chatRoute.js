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
