// โหลดรูปของ Rich Menu จาก URL ที่แอดมินกรอก แล้วตรวจตามข้อกำหนดของ LINE
const net = require("net");
const { inspectImage } = require("./imageInfo");

const MAX_IMAGE_BYTES = 1024 * 1024;
const FETCH_TIMEOUT_MS = 15000;
const MAX_REDIRECTS = 3;
const CONTENT_TYPES = { jpeg: "image/jpeg", png: "image/png" };
const TOO_BIG = "ไฟล์รูปใหญ่เกิน 1 MB";
// ข้อกำหนดรูป Rich Menu ของ LINE — รูปไม่ต้องมีขนาดเท่ากับ size ของเมนู (LINE ย่อ/ขยายให้) แต่สัดส่วนต้องตรงกัน
const MIN_WIDTH = 800;
const MAX_WIDTH = 2500;
const MIN_HEIGHT = 250;
const MIN_ASPECT = 1.45;
const ASPECT_TOLERANCE = 0.01;

// เซิร์ฟเวอร์เป็นคนไปโหลด URL นี้เอง จึงรับเฉพาะ https และไม่รับปลายทางที่เป็น localhost หรือเลข IP
function assertFetchableUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch (error) {
    throw new Error("URL ของรูปไม่ถูกต้อง");
  }
  if (url.protocol !== "https:") {
    throw new Error("URL ของรูปต้องขึ้นต้นด้วย https://");
  }
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost") || net.isIP(host) !== 0) {
    throw new Error("ไม่รับ URL ของรูปที่ชี้ไป localhost หรือเลข IP");
  }
  return url;
}

// อ่าน body โดยหยุดทันทีที่เกินขนาดที่ LINE รับ — ไม่โหลดไฟล์ใหญ่เข้าหน่วยความจำทั้งก้อน
async function readLimited(response) {
  if (Number(response.headers.get("content-length")) > MAX_IMAGE_BYTES) {
    throw new Error(TOO_BIG);
  }
  if (!response.body) return Buffer.alloc(0);
  const chunks = [];
  let total = 0;
  for await (const chunk of response.body) {
    total += chunk.length;
    if (total > MAX_IMAGE_BYTES) throw new Error(TOO_BIG);
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

const isTimeout = (error) => Boolean(error) && (error.name === "TimeoutError" || error.name === "AbortError");

// คืน { buffer, contentType, width, height, bytes } หรือ throw พร้อมข้อความที่แสดงให้แอดมินได้
async function loadMenuImage(imageUrl, size, { fetchImpl = fetch, timeoutMs = FETCH_TIMEOUT_MS } = {}) {
  const timeoutMessage = `โหลดรูปไม่ทันใน ${Math.round(timeoutMs / 1000)} วินาที`;
  const signal = AbortSignal.timeout(timeoutMs);

  // ตาม redirect เองทีละทอด เพื่อให้ปลายทางทุกทอดผ่านกติกาเดียวกับ URL ที่กรอก "ก่อน" จะส่ง request ไปหา
  let response;
  let target = imageUrl;
  for (let hop = 0; ; hop += 1) {
    assertFetchableUrl(target);
    try {
      response = await fetchImpl(target, { redirect: "manual", signal });
    } catch (error) {
      throw new Error(isTimeout(error) ? timeoutMessage : "โหลดรูปไม่ได้ ตรวจว่า URL เปิดได้จริง");
    }
    const location = response.status >= 300 && response.status < 400 ? response.headers.get("location") : null;
    if (!location) break;
    if (hop === MAX_REDIRECTS) {
      throw new Error(`URL ของรูป redirect เกิน ${MAX_REDIRECTS} ทอด`);
    }
    try {
      target = new URL(location, target).toString();
    } catch (error) {
      throw new Error("URL ของรูป redirect ไปยังที่อยู่ที่ไม่ถูกต้อง");
    }
  }
  if (!response.ok) {
    throw new Error(`โหลดรูปไม่ได้ (HTTP ${response.status})`);
  }

  let buffer;
  try {
    buffer = await readLimited(response);
  } catch (error) {
    if (error.message === TOO_BIG) throw error;
    throw new Error(isTimeout(error) ? timeoutMessage : "โหลดรูปไม่สำเร็จระหว่างรับข้อมูล");
  }

  const info = inspectImage(buffer);
  const dimensions = `${info.width}x${info.height}`;
  if (info.width < MIN_WIDTH || info.width > MAX_WIDTH) {
    throw new Error(`รูปขนาด ${dimensions}: LINE รับความกว้าง ${MIN_WIDTH}–${MAX_WIDTH} พิกเซล`);
  }
  if (info.height < MIN_HEIGHT) {
    throw new Error(`รูปขนาด ${dimensions}: LINE รับความสูงตั้งแต่ ${MIN_HEIGHT} พิกเซล`);
  }
  const aspect = info.width / info.height;
  const wanted = size.width / size.height;
  if (aspect < MIN_ASPECT || Math.abs(aspect - wanted) / wanted > ASPECT_TOLERANCE) {
    throw new Error(`รูปขนาด ${dimensions} สัดส่วนไม่ตรงกับเมนู ${size.width}x${size.height} พื้นที่กดจะไม่ตรงกับรูป`);
  }
  return { buffer, contentType: CONTENT_TYPES[info.format], width: info.width, height: info.height, bytes: buffer.length };
}

// เมนูที่ต้องตรวจรูปตอนบันทึก: URL ที่ยังไม่เคยอยู่ในข้อมูลที่บันทึกไว้ หรือทุกเมนูเมื่อขนาดเมนูเปลี่ยน
function menusNeedingImageCheck(next, saved) {
  const savedSize = (saved && saved.size) || {};
  const sizeChanged = savedSize.width !== next.size.width || savedSize.height !== next.size.height;
  const savedImages = new Set(((saved && saved.menus) || []).map((menu) => menu.image));
  return next.menus
    .map((menu, index) => ({ menu, index }))
    .filter(({ menu }) => sizeChanged || !savedImages.has(menu.image));
}

// คืน [{ path, message }] ของรูปที่ไม่ผ่าน (รูปแบบเดียวกับ services/validate.js)
async function checkChangedImages(next, saved, loadImage = loadMenuImage) {
  const results = await Promise.all(
    menusNeedingImageCheck(next, saved).map(async ({ menu, index }) => {
      try {
        await loadImage(menu.image, next.size);
        return null;
      } catch (error) {
        return { path: `menus[${index}].image`, message: error.message };
      }
    })
  );
  return results.filter(Boolean);
}

module.exports = { loadMenuImage, checkChangedImages, menusNeedingImageCheck, assertFetchableUrl, MAX_IMAGE_BYTES };
