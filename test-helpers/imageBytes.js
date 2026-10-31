// สร้างไฟล์รูปปลอมสำหรับเทสต์: มีแค่ส่วนหัวพอให้อ่านชนิดและขนาดภาพได้ (เปิดดูเป็นภาพไม่ได้)
// padding คือจำนวนไบต์ที่เติมเพื่อทำไฟล์ให้ใหญ่ตามต้องการ
function pngBytes(width, height, padding = 0) {
  const header = Buffer.alloc(33);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(header, 0);
  header.writeUInt32BE(13, 8);
  header.write("IHDR", 12, "latin1");
  header.writeUInt32BE(width, 16);
  header.writeUInt32BE(height, 20);
  header[24] = 8; // bit depth
  header[25] = 2; // color type: RGB
  return Buffer.concat([header, Buffer.alloc(padding)]);
}

const SOI = Buffer.from([0xff, 0xd8]);
const EOI = Buffer.from([0xff, 0xd9]);
const APP0 = Buffer.from([0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00]);
const DQT = Buffer.concat([Buffer.from([0xff, 0xdb, 0x00, 0x43, 0x00]), Buffer.alloc(64, 1)]);
// Huffman table: marker C4 อยู่ในช่วงเลขเดียวกับ Start Of Frame แต่ไม่ใช่
const DHT = Buffer.from([0xff, 0xc4, 0x00, 0x05, 0x00, 0x01, 0x02]);

function startOfFrame(width, height, marker = 0xc0) {
  const segment = Buffer.alloc(19);
  segment[0] = 0xff;
  segment[1] = marker;
  segment.writeUInt16BE(17, 2);
  segment[4] = 8; // precision
  segment.writeUInt16BE(height, 5);
  segment.writeUInt16BE(width, 7);
  segment[9] = 3; // components
  return segment;
}

function jpegBytes(width, height, { progressive = false, padding = 0 } = {}) {
  return Buffer.concat([SOI, APP0, DQT, startOfFrame(width, height, progressive ? 0xc2 : 0xc0), Buffer.alloc(padding), EOI]);
}

module.exports = { pngBytes, jpegBytes, startOfFrame, SOI, EOI, APP0, DQT, DHT };
