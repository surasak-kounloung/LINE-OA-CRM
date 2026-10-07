const test = require("node:test");
const assert = require("node:assert/strict");
const { inspectImage } = require("../services/imageInfo");
const { pngBytes, jpegBytes, startOfFrame, SOI, EOI, APP0, DQT, DHT } = require("../test-helpers/imageBytes");

test("reads the size of a PNG", () => {
  assert.deepEqual(inspectImage(pngBytes(2500, 1686)), { format: "png", width: 2500, height: 1686 });
});

test("reads the size of baseline and progressive JPEGs", () => {
  assert.deepEqual(inspectImage(jpegBytes(2500, 1686)), { format: "jpeg", width: 2500, height: 1686 });
  assert.deepEqual(inspectImage(jpegBytes(2500, 843, { progressive: true })), { format: "jpeg", width: 2500, height: 843 });
});

test("skips Huffman tables and fill bytes before the frame header of a JPEG", () => {
  const withTableFirst = Buffer.concat([SOI, APP0, DHT, DQT, startOfFrame(1200, 810), EOI]);
  assert.deepEqual(inspectImage(withTableFirst), { format: "jpeg", width: 1200, height: 810 });
  const withFillBytes = Buffer.concat([SOI, APP0, Buffer.from([0xff, 0xff]), startOfFrame(800, 540).subarray(1), EOI]);
  assert.deepEqual(inspectImage(withFillBytes), { format: "jpeg", width: 800, height: 540 });
});

test("rejects anything that is not a JPEG or PNG", () => {
  const webp = Buffer.concat([Buffer.from("RIFF"), Buffer.alloc(4), Buffer.from("WEBPVP8 "), Buffer.alloc(20)]);
  for (const input of [Buffer.from("GIF89a" + "x".repeat(30)), webp, Buffer.from("<!doctype html><html>not found</html>"), Buffer.alloc(0), "a string", null, undefined]) {
    assert.throws(() => inspectImage(input), /ไม่ใช่ไฟล์ JPEG หรือ PNG/);
  }
});

test("rejects a truncated image instead of returning a wrong size", () => {
  assert.throws(() => inspectImage(pngBytes(2500, 1686).subarray(0, 20)), /ไฟล์รูปไม่สมบูรณ์/);
  // JPEG ที่ขาดก่อนถึงส่วนหัวของเฟรม
  assert.throws(() => inspectImage(Buffer.concat([SOI, APP0])), /ไฟล์รูปไม่สมบูรณ์/);
  assert.throws(() => inspectImage(jpegBytes(2500, 1686).subarray(0, SOI.length + APP0.length + DQT.length + 6)), /ไฟล์รูปไม่สมบูรณ์/);
  // เริ่มข้อมูลภาพ (SOS) โดยไม่มีส่วนหัวของเฟรม
  assert.throws(() => inspectImage(Buffer.concat([SOI, APP0, Buffer.from([0xff, 0xda, 0x00, 0x02]), EOI])), /ไฟล์รูปไม่สมบูรณ์/);
  assert.throws(() => inspectImage(Buffer.concat([SOI, Buffer.from([0xff, 0xe0, 0x00, 0x00]), startOfFrame(10, 10)])), /ไฟล์รูปไม่สมบูรณ์/);
});
