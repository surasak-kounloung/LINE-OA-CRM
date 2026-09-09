// ป้องกัน /api/admin ด้วยรหัสผ่านเดียวจาก .env (ADMIN_PASSWORD) และ token HMAC อายุ 12 ชม.
const crypto = require("crypto");

const TOKEN_TTL_MS = 12 * 60 * 60 * 1000;

function isAdminEnabled() {
  return Boolean(process.env.ADMIN_PASSWORD);
}

// ใช้ ADMIN_TOKEN_SECRET ถ้ามี ไม่งั้น derive จาก password (เปลี่ยน password = token เก่าหมดอายุทันที)
function tokenSecret() {
  return process.env.ADMIN_TOKEN_SECRET
    || crypto.createHash("sha256").update(process.env.ADMIN_PASSWORD || "").digest("hex");
}

function sha256(value) {
  return crypto.createHash("sha256").update(String(value ?? "")).digest();
}

function passwordMatches(input) {
  if (!isAdminEnabled()) return false;
  return crypto.timingSafeEqual(sha256(input), sha256(process.env.ADMIN_PASSWORD));
}

function sign(exp) {
  return crypto.createHmac("sha256", tokenSecret()).update(String(exp)).digest("hex");
}

function createToken(now = Date.now()) {
  const expiresAt = now + TOKEN_TTL_MS;
  const token = `${Buffer.from(String(expiresAt)).toString("base64url")}.${sign(expiresAt)}`;
  return { token, expiresAt };
}

function verifyToken(token, now = Date.now()) {
  if (typeof token !== "string") return false;
  const [expPart, signature] = token.split(".");
  if (!expPart || !signature) return false;
  const expiresAt = Number(Buffer.from(expPart, "base64url").toString());
  if (!Number.isFinite(expiresAt) || expiresAt < now) return false;
  const expected = sign(expiresAt);
  if (signature.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

function requireAdmin(req, res, next) {
  if (!isAdminEnabled()) {
    return res.status(503).json({ error: "admin disabled: ตั้งค่า ADMIN_PASSWORD ใน .env ก่อน" });
  }
  const header = req.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!verifyToken(token)) {
    return res.status(401).json({ error: "unauthorized" });
  }
  return next();
}

module.exports = { isAdminEnabled, passwordMatches, createToken, verifyToken, requireAdmin, TOKEN_TTL_MS };
