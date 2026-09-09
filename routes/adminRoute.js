// API สำหรับหน้า admin: login + อ่าน/เขียน data/*.json + preview ข้อความที่บอทจะตอบ
const express = require("express");
const { requireAdmin, isAdminEnabled, passwordMatches, createToken } = require("../middlewares/adminAuth");
const { validatePromotions, validateServices, validateBranches, validateRegions } = require("../services/validate");

function createAdminRouter({ store, messageTable, loginFailureDelayMs = 1000 }) {
  const router = express.Router();

  router.post("/login", async (req, res) => {
    if (!isAdminEnabled()) {
      return res.status(503).json({ error: "admin disabled: ตั้งค่า ADMIN_PASSWORD ใน .env ก่อน" });
    }
    const password = req.body && req.body.password;
    if (!passwordMatches(password)) {
      await new Promise((resolve) => setTimeout(resolve, loginFailureDelayMs));
      return res.status(401).json({ error: "รหัสผ่านไม่ถูกต้อง" });
    }
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
      store.set(name, req.body);
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
