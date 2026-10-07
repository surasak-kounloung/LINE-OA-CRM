// sync ชุด Rich Menu ใน data/richmenu.json ไปยัง LINE OA หนึ่งบัญชี
// ทุกขั้นคำนวณจากสถานะจริงบน LINE จึงเรียกซ้ำหลังล้มเหลวได้ และจะทำต่อจากจุดที่ค้าง
const { describeChannel, toLineRichMenu, aliasFor } = require("./richMenuPlan");
const { describeLineError } = require("./lineRichMenuApi");
const { loadMenuImage } = require("./richMenuImages");

const POLL_INTERVAL_MS = 1000;
const POLL_LIMIT = 30;

const defaultSleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// api คือ interface ของ services/lineRichMenuApi.js — คืน { ok, steps: [ข้อความ], message }
async function syncChannel({ definition, api, loadImage = loadMenuImage, sleep = defaultSleep, pollLimit = POLL_LIMIT }) {
  const steps = [];
  const stop = (message) => ({ ok: false, steps, message });

  try {
    let status = describeChannel(definition, await api.readState());
    if (status.state === "blocked" || status.state === "empty") return stop(status.message);
    if (status.state === "in-sync") return { ok: true, steps, message: "เมนูตรงกับที่บันทึกไว้อยู่แล้ว" };

    // รูปทุกเมนูต้องผ่านก่อนจะแตะ LINE
    const images = new Map();
    const imageProblems = [];
    await Promise.all(
      definition.menus.map(async (menu) => {
        try {
          images.set(menu.key, await loadImage(menu.image, definition.size));
        } catch (error) {
          imageProblems.push(`${menu.label}: ${error.message}`);
        }
      })
    );
    if (imageProblems.length) return stop(`รูปไม่ผ่านการตรวจ — ${imageProblems.join(" | ")}`);
    steps.push(`ตรวจรูปครบ ${definition.menus.length} เมนู`);

    // สร้างเมนูที่ยังไม่มีหรือไม่ตรง แล้วชี้ alias ของระดับนั้นไปที่เมนูใหม่
    for (const menu of status.menus.filter((item) => item.state !== "ok")) {
      const source = definition.menus.find((item) => item.key === menu.key);
      const image = images.get(menu.key);
      const richMenuId = await api.createMenu(toLineRichMenu(definition, source));
      await api.uploadImage(richMenuId, image.buffer, image.contentType);
      if (menu.aliasExists) {
        await api.updateAlias(aliasFor(menu.key), richMenuId);
      } else {
        await api.createAlias(aliasFor(menu.key), richMenuId);
      }
      steps.push(`สร้างเมนู "${menu.label}"`);
    }

    for (const aliasId of status.removedAliases) {
      await api.deleteAlias(aliasId);
      steps.push(`ลบ alias ${aliasId} ของระดับที่ถูกลบออกจากรายการ`);
    }

    // อ่านสถานะใหม่: เมนูที่ไม่มี alias ชี้แล้วคือเมนูค้างที่ต้องย้ายลูกค้าออกก่อนลบ
    status = describeChannel(definition, await api.readState());

    let moved = true;
    if (status.staleMenus.length) {
      const operations = status.staleMenus.map((stale) => {
        const target = status.menus.find((menu) => menu.key === stale.key && menu.richMenuId);
        return target
          ? { type: "link", from: stale.richMenuId, to: target.richMenuId }
          : { type: "unlink", from: stale.richMenuId };
      });
      const requestId = await api.startBatch(operations);
      steps.push(`สั่ง LINE ย้ายลูกค้าออกจากเมนูเก่า ${operations.length} เมนู`);

      let phase = await api.batchPhase(requestId);
      for (let attempt = 1; attempt < pollLimit && phase === "ongoing"; attempt += 1) {
        await sleep(POLL_INTERVAL_MS);
        phase = await api.batchPhase(requestId);
      }
      moved = phase === "succeeded";
      if (moved) steps.push("LINE ย้ายลูกค้าเสร็จแล้ว");
    }

    // ตั้งเมนูเริ่มต้นก่อนลบเมนูเก่าเสมอ — เมนูที่เป็นเมนูเริ่มต้นอยู่ต้องไม่ถูกลบ
    const defaultMenu = status.menus.find((menu) => menu.isDefault);
    if (!status.defaultOk && defaultMenu && defaultMenu.richMenuId) {
      await api.setDefault(defaultMenu.richMenuId);
      steps.push(`ตั้ง "${defaultMenu.label}" เป็นเมนูเริ่มต้น`);
    }

    if (!moved) {
      return stop("LINE ยังย้ายลูกค้าออกจากเมนูเก่าไม่เสร็จ เมนูเก่าจึงยังไม่ถูกลบ กด sync อีกครั้งภายหลัง");
    }
    for (const stale of status.staleMenus) {
      await api.deleteMenu(stale.richMenuId);
    }
    if (status.staleMenus.length) steps.push(`ลบเมนูเก่า ${status.staleMenus.length} เมนู`);

    return { ok: true, steps, message: "sync สำเร็จ" };
  } catch (error) {
    return stop(`LINE ปฏิเสธคำสั่ง: ${describeLineError(error)}`);
  }
}

module.exports = { syncChannel };
