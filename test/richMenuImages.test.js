const test = require("node:test");
const assert = require("node:assert/strict");
const { loadMenuImage, checkChangedImages, menusNeedingImageCheck, MAX_IMAGE_BYTES } = require("../services/richMenuImages");
const { pngBytes, jpegBytes } = require("../test-helpers/imageBytes");

const size = { width: 2500, height: 1686 };
const url = "https://img.example/menu.jpg";
const respond = (body, init = {}) => async () => new Response(body, { status: 200, ...init });
const load = (fetchImpl, target = url, options = {}) => loadMenuImage(target, size, { fetchImpl, ...options });

test("loads a JPEG or PNG of the right size and reports its type", async () => {
  const jpeg = jpegBytes(2500, 1686);
  assert.deepEqual(await load(respond(jpeg)), { buffer: jpeg, contentType: "image/jpeg", width: 2500, height: 1686, bytes: jpeg.length });
  const png = pngBytes(2500, 1686);
  assert.equal((await load(respond(png, { headers: { "content-type": "text/plain" } }))).contentType, "image/png");
});

test("asks for the URL it was given, follows redirects and sets a timeout", async () => {
  const seen = [];
  await load(async (target, options) => {
    seen.push({ target, redirect: options.redirect, hasSignal: options.signal instanceof AbortSignal });
    return new Response(jpegBytes(2500, 1686));
  });
  assert.deepEqual(seen, [{ target: url, redirect: "follow", hasSignal: true }]);
});

test("reports an HTTP error, a network failure and a timeout in words an admin can act on", async () => {
  await assert.rejects(load(respond("gone", { status: 404 })), /โหลดรูปไม่ได้ \(HTTP 404\)/);
  await assert.rejects(load(async () => { throw new TypeError("fetch failed"); }), /โหลดรูปไม่ได้ ตรวจว่า URL เปิดได้จริง/);
  // timer ของ AbortSignal.timeout ไม่ยึด event loop ไว้ จึงต้องมี timer ของเทสต์เองระหว่างรอ
  const never = (target, { signal }) => new Promise((resolve, reject) => {
    const keepAlive = setInterval(() => {}, 1000);
    signal.addEventListener("abort", () => {
      clearInterval(keepAlive);
      reject(signal.reason);
    });
  });
  await assert.rejects(load(never, url, { timeoutMs: 20 }), /โหลดรูปไม่ทัน/);
});

test("accepts a smaller image with the menu's proportions, as LINE does", async () => {
  // เมนูจริงของคลินิก: ประกาศ 2500x1686 แต่รูปที่อัปโหลดคือ 1200x810
  const image = await load(respond(jpegBytes(1200, 810)));
  assert.deepEqual([image.width, image.height], [1200, 810]);
  assert.equal((await load(respond(pngBytes(800, 540)))).width, 800);
});

test("rejects an image whose proportions or dimensions LINE would not show correctly", async () => {
  await assert.rejects(load(respond(jpegBytes(2500, 843))), /รูปขนาด 2500x843 สัดส่วนไม่ตรงกับเมนู 2500x1686/);
  await assert.rejects(load(respond(pngBytes(1686, 2500))), /สัดส่วนไม่ตรงกับเมนู/);
  await assert.rejects(load(respond(jpegBytes(1200, 840))), /สัดส่วนไม่ตรงกับเมนู/);
  await assert.rejects(load(respond(jpegBytes(600, 405))), /รูปขนาด 600x405: LINE รับความกว้าง 800–2500 พิกเซล/);
  await assert.rejects(load(respond(jpegBytes(3000, 2023))), /LINE รับความกว้าง 800–2500 พิกเซล/);
  // เมนูเตี้ยมาก: สัดส่วนตรง แต่รูปเตี้ยกว่าที่ LINE รับ
  await assert.rejects(loadMenuImage(url, { width: 2500, height: 500 }, { fetchImpl: respond(jpegBytes(1000, 200)) }), /LINE รับความสูงตั้งแต่ 250 พิกเซล/);
});

test("accepts exactly 1 MB and rejects anything larger, by header or by actual bytes", async () => {
  const base = jpegBytes(2500, 1686).length;
  const exact = jpegBytes(2500, 1686, { padding: MAX_IMAGE_BYTES - base });
  assert.equal(exact.length, MAX_IMAGE_BYTES);
  assert.equal((await load(respond(exact))).bytes, MAX_IMAGE_BYTES);

  const tooBig = jpegBytes(2500, 1686, { padding: MAX_IMAGE_BYTES - base + 1 });
  await assert.rejects(load(respond(tooBig)), /ไฟล์รูปใหญ่เกิน 1 MB/);
  // header บอกว่าใหญ่เกิน: ปฏิเสธโดยไม่ต้องอ่านเนื้อไฟล์
  await assert.rejects(load(respond(jpegBytes(2500, 1686), { headers: { "content-length": String(5 * MAX_IMAGE_BYTES) } })), /ไฟล์รูปใหญ่เกิน 1 MB/);
});

test("rejects a response that is not an image even when the server says 200", async () => {
  await assert.rejects(load(respond("<!doctype html><title>Not found</title>", { headers: { "content-type": "image/jpeg" } })), /ไม่ใช่ไฟล์ JPEG หรือ PNG/);
  await assert.rejects(load(respond(null)), /ไม่ใช่ไฟล์ JPEG หรือ PNG/);
});

test("never fetches a URL that is not https or points at localhost or an IP address", async () => {
  let fetched = 0;
  const fetchImpl = async () => { fetched += 1; return new Response(jpegBytes(2500, 1686)); };
  const cases = [
    ["http://img.example/menu.jpg", /ต้องขึ้นต้นด้วย https/],
    ["ftp://img.example/menu.jpg", /ต้องขึ้นต้นด้วย https/],
    ["not a url", /URL ของรูปไม่ถูกต้อง/],
    ["https://localhost/menu.jpg", /localhost หรือเลข IP/],
    ["https://app.localhost/menu.jpg", /localhost หรือเลข IP/],
    ["https://127.0.0.1/menu.jpg", /localhost หรือเลข IP/],
    ["https://169.254.169.254/latest/meta-data", /localhost หรือเลข IP/],
    ["https://[::1]/menu.jpg", /localhost หรือเลข IP/],
  ];
  for (const [target, pattern] of cases) {
    await assert.rejects(load(fetchImpl, target), pattern, target);
  }
  assert.equal(fetched, 0);
});

test("rejects a redirect that lands on a forbidden address", async () => {
  const redirected = async () => ({ ok: true, status: 200, url: "https://10.0.0.5/internal.jpg", headers: new Headers(), body: null });
  await assert.rejects(load(redirected), /localhost หรือเลข IP/);
  const downgraded = async () => ({ ok: true, status: 200, url: "http://img.example/menu.jpg", headers: new Headers(), body: null });
  await assert.rejects(load(downgraded), /ต้องขึ้นต้นด้วย https/);
});

const menu = (key, image) => ({ key, label: key, image, isDefault: key === "default" });
const saved = { size, menus: [menu("default", "https://img.example/a.jpg"), menu("gold", "https://img.example/b.jpg")] };

test("menusNeedingImageCheck: only URLs not saved before, or every menu when the size changes", () => {
  const next = { size, menus: [menu("default", "https://img.example/a.jpg"), menu("gold", "https://img.example/new.jpg"), menu("silver", "https://img.example/b.jpg")] };
  assert.deepEqual(menusNeedingImageCheck(next, saved).map((item) => [item.index, item.menu.key]), [[1, "gold"]]);
  assert.deepEqual(menusNeedingImageCheck({ ...next, size: { width: 2500, height: 843 } }, saved).map((item) => item.index), [0, 1, 2]);
  assert.deepEqual(menusNeedingImageCheck(next, { size, menus: [] }).map((item) => item.index), [0, 1, 2]);
  assert.deepEqual(menusNeedingImageCheck(next, undefined).map((item) => item.index), [0, 1, 2]);
});

test("checkChangedImages: loads only the changed images and reports failures by field path", async () => {
  const next = { size, menus: [menu("default", "https://img.example/a.jpg"), menu("gold", "https://img.example/bad.jpg"), menu("silver", "https://img.example/good.jpg")] };
  const loaded = [];
  const loadImage = async (target, wanted) => {
    loaded.push([target, wanted]);
    if (target.endsWith("bad.jpg")) throw new Error("ไฟล์รูปใหญ่เกิน 1 MB");
    return {};
  };
  assert.deepEqual(await checkChangedImages(next, saved, loadImage), [{ path: "menus[1].image", message: "ไฟล์รูปใหญ่เกิน 1 MB" }]);
  assert.deepEqual(loaded, [["https://img.example/bad.jpg", size], ["https://img.example/good.jpg", size]]);
  assert.deepEqual(await checkChangedImages(saved, saved, loadImage), []);
});
