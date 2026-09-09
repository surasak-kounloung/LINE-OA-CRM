// API สำหรับหน้า admin: login + อ่าน/เขียน data/*.json + preview ข้อความที่บอทจะตอบ
const express = require("express");
const { requireAdmin, isAdminEnabled, passwordMatches, createToken } = require("../middlewares/adminAuth");
const { validatePromotions, validateServices, validateBranches, validateRegions } = require("../services/validate");

const LOGIN_MAX_FAILURES = 5;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;

function createAdminRouter({
  store,
  messageTable,
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
      return res.json(store.get(name));
    });
  }

  router.get("/triggers", (req, res) => res.json([...messageTable.getTable().keys()]));

  router.get("/preview/:trigger", (req, res) => {
    const messages = messageTable.getTable().get(req.params.trigger);
    if (!messages) return res.status(404).json({ error: "ไม่พบ trigger นี้" });
    return res.json(messages);
  });

  return router;
}

module.exports = { createAdminRouter };
