// รายชื่อ LINE OA ที่แอปนี้เป็น webhook ให้ (อ่านจาก .env)

// ตัวแปรที่มีเลขต่อท้ายสำหรับ OA ที่ 2 ขึ้นไป (OA แรกใช้ชื่อเดิมที่ไม่มีเลข)
const SUFFIXED_KEY = /^(LINE_CHANNEL_TOKEN|LINE_CHANNEL_SECRET|LINE_CHANNEL_NAME|FORWARD_WEBHOOK_URL)_(\d+)$/;
const VALID_SUFFIX = /^([2-9]|[1-9]\d+)$/;

// ค่าว่างหรือมีแต่ช่องว่างถือว่าไม่ได้ตั้ง
function readValue(env, key) {
  const raw = env[key];
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  return trimmed === "" ? null : trimmed;
}

function forwardUrlFor(env, id) {
  if (id === 1) {
    // OA แรกคงความหมายเดิม: ต้องเปิดด้วย FORWARD_WEBHOOK_URL_PROCESS="true" ก่อน
    return env.FORWARD_WEBHOOK_URL_PROCESS === "true" ? readValue(env, "FORWARD_WEBHOOK_URL") : null;
  }
  return readValue(env, `FORWARD_WEBHOOK_URL_${id}`);
}

// อ่านรายชื่อ OA จาก env — throw พร้อมรายการที่ผิดทั้งหมด (ไม่พิมพ์ค่า secret/token)
function loadChannels(env = process.env) {
  const errors = [];
  const ids = new Set([1]);

  for (const key of Object.keys(env)) {
    const match = SUFFIXED_KEY.exec(key);
    if (!match || readValue(env, key) === null) continue;
    if (!VALID_SUFFIX.test(match[2])) {
      errors.push(`${key}: เลขต่อท้ายต้องเป็นจำนวนเต็มตั้งแต่ 2 ขึ้นไป ไม่มีศูนย์นำหน้า (OA แรกใช้ชื่อตัวแปรที่ไม่มีเลข)`);
      continue;
    }
    ids.add(Number(match[2]));
  }

  const channels = [];
  for (const id of [...ids].sort((a, b) => a - b)) {
    const suffix = id === 1 ? "" : `_${id}`;
    const tokenKey = `LINE_CHANNEL_TOKEN${suffix}`;
    const secretKey = `LINE_CHANNEL_SECRET${suffix}`;
    const channelAccessToken = readValue(env, tokenKey);
    const channelSecret = readValue(env, secretKey);
    if (!channelAccessToken || !channelSecret) {
      const missing = [channelAccessToken ? null : tokenKey, channelSecret ? null : secretKey].filter(Boolean);
      errors.push(`OA ${id}: ยังไม่ได้ตั้ง ${missing.join(" และ ")}`);
      continue;
    }
    channels.push({
      id,
      name: readValue(env, `LINE_CHANNEL_NAME${suffix}`) || `OA ${id}`,
      channelSecret,
      channelAccessToken,
      forwardUrl: forwardUrlFor(env, id),
    });
  }

  // secret ซ้ำ = แยกไม่ได้ว่า event มาจาก OA ไหน, token ซ้ำ = ตอบผิดบัญชี
  for (const [field, label] of [["channelSecret", "channel secret"], ["channelAccessToken", "access token"]]) {
    const seen = new Map();
    for (const channel of channels) {
      const first = seen.get(channel[field]);
      if (first) {
        errors.push(`OA ${first.id} กับ OA ${channel.id} ใช้ ${label} ค่าเดียวกัน`);
      } else {
        seen.set(channel[field], channel);
      }
    }
  }

  if (errors.length) {
    throw new Error(`ตั้งค่า LINE OA ใน .env ไม่ถูกต้อง:\n- ${errors.join("\n- ")}`);
  }
  return channels;
}

module.exports = { loadChannels };
