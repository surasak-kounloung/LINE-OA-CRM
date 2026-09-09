const test = require("node:test");
const assert = require("node:assert/strict");

process.env.ADMIN_PASSWORD = "secret-pass";
delete process.env.ADMIN_TOKEN_SECRET;
const auth = require("../middlewares/adminAuth");

function run(headers) {
  const req = { get: (h) => headers[h.toLowerCase()] };
  const res = { statusCode: 200, body: null, status(c) { this.statusCode = c; return this; }, json(b) { this.body = b; return this; } };
  let nextCalled = false;
  auth.requireAdmin(req, res, () => { nextCalled = true; });
  return { res, nextCalled };
}

test("passwordMatches compares against ADMIN_PASSWORD", () => {
  assert.equal(auth.passwordMatches("secret-pass"), true);
  assert.equal(auth.passwordMatches("secret-pas"), false);
  assert.equal(auth.passwordMatches(undefined), false);
});

test("token round-trips and expires", () => {
  const now = 1_700_000_000_000;
  const { token, expiresAt } = auth.createToken(now);
  assert.equal(expiresAt, now + auth.TOKEN_TTL_MS);
  assert.equal(auth.verifyToken(token, now + 1000), true);
  assert.equal(auth.verifyToken(token, expiresAt + 1), false);
  assert.equal(auth.verifyToken(token + "x", now), false);
  assert.equal(auth.verifyToken("garbage", now), false);
  assert.equal(auth.verifyToken(undefined, now), false);
  // Verify non-ASCII and non-hex signatures are rejected without throwing
  const [expPart] = token.split(".");
  assert.equal(auth.verifyToken(`${expPart}.${"é".repeat(64)}`, now), false);
  assert.equal(auth.verifyToken(`${expPart}.${"z".repeat(64)}`, now), false);
});

test("requireAdmin: 401 without/with bad token, next with good token", () => {
  assert.equal(run({}).res.statusCode, 401);
  assert.equal(run({ authorization: "Bearer nope" }).res.statusCode, 401);
  const { token } = auth.createToken();
  const ok = run({ authorization: `Bearer ${token}` });
  assert.equal(ok.nextCalled, true);
});

test("requireAdmin: 503 when ADMIN_PASSWORD unset", () => {
  const saved = process.env.ADMIN_PASSWORD;
  delete process.env.ADMIN_PASSWORD;
  const { res } = run({});
  process.env.ADMIN_PASSWORD = saved;
  assert.equal(res.statusCode, 503);
  assert.equal(auth.isAdminEnabled(), true);
});
