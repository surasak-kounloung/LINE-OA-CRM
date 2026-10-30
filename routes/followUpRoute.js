// API ของหน้าข้อความต่อท้าย (follow-up): อ่าน/แก้ข้อความหลักและข้อความของแต่ละ LINE OA
// ถูกเมานต์ใน adminRoute หลัง requireAdmin จึงต้องมี token ของแอดมินทุกเส้นทาง
const express = require("express");
const {
  readFollowUps,
  validateFollowUpText,
  validateFollowUpEntry,
  normalizeFollowUpEntry,
} = require("../services/followUps");

function createFollowUpRouter({ store, channels = [] }) {
  const router = express.Router();

  // ส่งออกเฉพาะ id กับชื่อ OA ห้ามมี token หรือ secret
  const oas = () => channels.map((c) => ({ id: c.id, name: c.name }));
  const view = (value) => ({ defaultText: value.defaultText, channels: value.channels, oas: oas() });

  // เขียนไฟล์ผ่าน store; ไฟล์ที่เสียต้องไม่ถูกเขียนทับ (ตรวจก่อนเรียกทุกครั้ง)
  function save(res, next) {
    try {
      store.set("followups", next);
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: "บันทึกไฟล์ไม่สำเร็จ" });
    }
    return res.json(view(next));
  }

  router.get("/", (req, res) => {
    const { value, problem } = readFollowUps(store);
    if (problem) return res.status(500).json({ error: problem });
    return res.json(view(value));
  });

  router.put("/default", (req, res) => {
    const body = req.body || {};
    const errors = validateFollowUpText(body.text, "text");
    if (errors.length) return res.status(400).json({ error: "ข้อมูลไม่ถูกต้อง", errors });
    const { value, problem } = readFollowUps(store);
    if (problem) return res.status(500).json({ error: problem });
    return save(res, { ...value, defaultText: body.text.trim() });
  });

  router.put("/channels/:id", (req, res) => {
    const channel = channels.find((c) => String(c.id) === req.params.id);
    if (!channel) return res.status(404).json({ error: "ไม่พบ LINE OA นี้ในรายการที่โหลดจาก .env" });
    const errors = validateFollowUpEntry(req.body);
    if (errors.length) return res.status(400).json({ error: "ข้อมูลไม่ถูกต้อง", errors });
    const { value, problem } = readFollowUps(store);
    if (problem) return res.status(500).json({ error: problem });
    const entry = normalizeFollowUpEntry(req.body, (store.get("services") || []).map((s) => s.id));
    const nextChannels = { ...value.channels };
    if (entry === null) delete nextChannels[req.params.id];
    else nextChannels[req.params.id] = entry;
    return save(res, { ...value, channels: nextChannels });
  });

  return router;
}

module.exports = { createFollowUpRouter };
