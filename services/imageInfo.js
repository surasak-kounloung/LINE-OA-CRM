// อ่านชนิดและขนาดภาพจากเนื้อไฟล์ (JPEG/PNG) โดยไม่ใช้ dependency — ไม่เชื่อนามสกุลไฟล์หรือ Content-Type
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const NOT_IMAGE = "ไม่ใช่ไฟล์ JPEG หรือ PNG";
const TRUNCATED = "ไฟล์รูปไม่สมบูรณ์";

function inspectPng(buffer) {
  // signature 8 ไบต์ + ความยาว chunk 4 + "IHDR" 4 + กว้าง 4 + สูง 4
  if (buffer.length < 24 || buffer.toString("latin1", 12, 16) !== "IHDR") {
    throw new Error(TRUNCATED);
  }
  return { format: "png", width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

function inspectJpeg(buffer) {
  let offset = 2;
  while (offset + 1 < buffer.length) {
    if (buffer[offset] !== 0xff) break;
    const marker = buffer[offset + 1];
    if (marker === 0xff) {
      // fill byte ระหว่าง segment
      offset += 1;
      continue;
    }
    offset += 2;
    // marker ที่ไม่มีข้อมูลตามหลัง
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8)) continue;
    // จบไฟล์ หรือเริ่มข้อมูลภาพก่อนจะเจอขนาด
    if (marker === 0xd9 || marker === 0xda) break;
    if (offset + 2 > buffer.length) break;
    const length = buffer.readUInt16BE(offset);
    // Start Of Frame ทุกแบบ ยกเว้น DHT (C4), JPG (C8), DAC (CC) ที่ใช้เลขช่วงเดียวกัน
    const isStartOfFrame = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isStartOfFrame) {
      if (offset + 7 > buffer.length) break;
      return { format: "jpeg", width: buffer.readUInt16BE(offset + 5), height: buffer.readUInt16BE(offset + 3) };
    }
    if (length < 2) break;
    offset += length;
  }
  throw new Error(TRUNCATED);
}

// คืน { format: "jpeg" | "png", width, height } หรือ throw พร้อมข้อความที่แสดงให้แอดมินได้
function inspectImage(buffer) {
  if (!Buffer.isBuffer(buffer)) throw new Error(NOT_IMAGE);
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(PNG_SIGNATURE)) return inspectPng(buffer);
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return inspectJpeg(buffer);
  throw new Error(NOT_IMAGE);
}

module.exports = { inspectImage };
