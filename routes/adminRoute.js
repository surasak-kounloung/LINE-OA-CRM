// API สำหรับหน้า admin: login + อ่าน/เขียน data/*.json + preview ข้อความที่บอทจะตอบ
const express = require("express");
const { requireAdmin, isAdminEnabled, passwordMatches, createToken } = require("../middlewares/adminAuth");
const { validatePromotions, validateServices, validateBranches, validateRegions } = require("../services/validate");
const { createRichMenuRouter } = require("./richMenuRoute");
const { createFollowUpRouter } = require("./followUpRoute");
const { pruneStoredFollowUps, readFollowUps } = require("../services/followUps");

const LOGIN_MAX_FAILURES = 5;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;

function createAdminRouter({
  store,
  messageTable,
  channels = [],
  richMenu = {},
  logError = console.error,
  loginFailureDelayMs = 1000,
  loginMaxFailures = LOGIN_MAX_FAILURES,
  loginWindowMs = LOGIN_WINDOW_MS,
}) {
  const router = express.Router();

  // ป้องกัน brute-force: จำกัดจำนวนครั้งที่ login ผิดต่อ IP ภายในช่วงเวลาหนึ่ง (ในหน่วยความจำ ไม่ persist)
  const loginFailures = new Map(); // ip -> { count, firstAt }

  function isLockedOut(ip) {
    const entry = loginFailures.get(ip);
    if (!entry) return false;
    if (Date.now() - entry.firstAt > loginWindowMs) {
      loginFailures.delete(ip);
      return false;
    }
    return entry.count >= loginMaxFailures;
  }

  function recordFailure(ip) {
    const now = Date.now();
    const entry = loginFailures.get(ip);
    if (!entry || now - entry.firstAt > loginWindowMs) {
      loginFailures.set(ip, { count: 1, firstAt: now });
    } else {
      entry.count += 1;
    }
  }

  function clearFailures(ip) {
    loginFailures.delete(ip);
  }

  router.post("/login", async (req, res) => {
    if (!isAdminEnabled()) {
      return res.status(503).json({ error: "admin disabled: ตั้งค่า ADMIN_PASSWORD ใน .env ก่อน" });
    }
    const ip = req.ip;
    if (isLockedOut(ip)) {
      return res.status(429).json({ error: "พยายามเข้าสู่ระบบผิดหลายครั้ง กรุณารอ 15 นาที" });
    }
    const password = req.body && req.body.password;
    if (!passwordMatches(password)) {
      recordFailure(ip);
      await new Promise((resolve) => setTimeout(resolve, loginFailureDelayMs));
      return res.status(401).json({ error: "รหัสผ่านไม่ถูกต้อง" });
    }
    clearFailures(ip);
    return res.json(createToken());
  });

  router.use(requireAdmin);

  // Rich Menu: ข้อมูลเมนู + สถานะและการ sync ของแต่ละ LINE OA (richMenu ใช้ส่งตัวจำลอง LINE เข้ามาในเทสต์)
  router.use("/richmenu", createRichMenuRouter({ store, channels, ...richMenu }));

  // ข้อความต่อท้ายของแต่ละ LINE OA
  router.use("/followups", createFollowUpRouter({ store, channels }));

  // validator ของแต่ละ resource (บางตัวต้องดูข้อมูลอีกไฟล์ประกอบ)
  const validators = {
    promotions: (value) => validatePromotions(value),
    services: (value) => validateServices(value),
    branches: (value) => validateBranches(value, store.get("regions")),
    regions: (value) => validateRegions(value, store.get("branches")),
  };

  for (const name of Object.keys(validators)) {
    router.get(`/${name}`, (req, res) => res.json(store.get(name)));
    router.put(`/${name}`, (req, res) => {
      const errors = validators[name](req.body);
      if (errors.length) {
        return res.status(400).json({ error: "ข้อมูลไม่ถูกต้อง", errors });
      }
      try {
        store.set(name, req.body);
      } catch (error) {
        console.error(error);
        return res.status(500).json({ error: "บันทึกไฟล์ไม่สำเร็จ" });
      }
      if (name === "services") pruneStoredFollowUps(store, req.body.map((s) => s.id), { logError });
      return res.json(store.get(name));
    });
  }

  router.get("/triggers", (req, res) => res.json([...messageTable.getTable().keys()]));

  // ?channel=<เลข OA> ดูสิ่งที่ OA นั้นจะส่ง; ไม่ระบุ = OA แรกที่โหลด
  router.get("/preview/:trigger", (req, res) => {
    if (!messageTable.getTable().has(req.params.trigger)) return res.status(404).json({ error: "ไม่พบ trigger นี้" });
    let channel = channels[0];
    if (req.query.channel !== undefined) {
      channel = channels.find((c) => String(c.id) === String(req.query.channel));
      if (!channel) return res.status(404).json({ error: "ไม่พบ LINE OA นี้" });
    }
    const messages = messageTable.getReply(req.params.trigger, channel ? channel.id : null);
    if (!messages) {
      const { problem } = readFollowUps(store);
      if (problem) return res.status(404).json({ error: `ไม่มีข้อความตอบ เพราะ ${problem}` });
      return res.status(404).json({ error: "LINE OA นี้ไม่ตอบ trigger นี้ (ไม่มีรูปราคา และตั้งข้อความต่อท้ายเป็นไม่ส่ง)" });
    }
    return res.json(messages);
  });

  return router;
}

module.exports = { createAdminRouter };
