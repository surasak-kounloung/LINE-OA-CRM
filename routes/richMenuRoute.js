// API ของหน้า Rich Menu: ข้อมูลเมนู, สถานะของแต่ละ LINE OA และการ sync ทีละ OA
// ถูกเมานต์ใน adminRoute หลัง requireAdmin จึงต้องมี token ของแอดมินทุกเส้นทาง
const express = require("express");
const { validateRichMenu, normalizeRichMenu } = require("../services/validate");
const { loadMenuImage, checkChangedImages } = require("../services/richMenuImages");
const { describeChannel } = require("../services/richMenuPlan");
const { syncChannel } = require("../services/richMenuSync");
const { createLineRichMenuApi, describeLineError } = require("../services/lineRichMenuApi");

const INTERNAL_ERROR = "เกิดข้อผิดพลาดภายในระบบ ดู log ของเซิร์ฟเวอร์";

// Express 4 ไม่จับ error ของ async handler ให้: ถ้าปล่อยหลุดจะเป็น unhandled rejection แล้ว process ทั้งตัว (รวม webhook) ดับ
// ตอบข้อความคงที่ ไม่ส่ง error.message ออกไป เพราะอาจมี path ของไฟล์บนเซิร์ฟเวอร์
const guarded = (handler) => async (req, res) => {
  try {
    await handler(req, res);
  } catch (error) {
    console.error(`Rich Menu API ${req.method} ${req.originalUrl} ล้มเหลว: ${error && error.message}`);
    if (!res.headersSent) res.status(500).json({ error: INTERNAL_ERROR });
  }
};

function createRichMenuRouter({ store, channels, createApi = createLineRichMenuApi, loadImage = loadMenuImage, sleep }) {
  const router = express.Router();

  // sync ได้ครั้งละ 1 งานทั้งแอป: สองงานพร้อมกันบน OA เดียวจะสร้างเมนูซ้ำและแย่งกันย้ายลูกค้า
  let syncing = false;

  // ไฟล์ที่บันทึกไว้อาจถูกแก้ด้วยมือจนผิดกติกา จึงตรวจซ้ำทุกครั้งก่อนนำไปใช้กับ LINE
  function savedDefinition() {
    const definition = store.get("richmenu");
    const [first] = validateRichMenu(definition);
    const problem = first
      ? `ข้อมูล Rich Menu ที่บันทึกไว้ไม่ถูกต้อง (${first.path || "รูปแบบ"}: ${first.message}) แก้ในหน้า Rich Menu แล้วบันทึกใหม่`
      : null;
    return { definition, problem };
  }

  router.get("/", guarded((req, res) => res.json(store.get("richmenu"))));

  router.put("/", guarded(async (req, res) => {
    const errors = validateRichMenu(req.body);
    if (errors.length) {
      return res.status(400).json({ error: "ข้อมูลไม่ถูกต้อง", errors });
    }
    const next = normalizeRichMenu(req.body);
    const imageErrors = await checkChangedImages(next, store.get("richmenu"), loadImage);
    if (imageErrors.length) {
      return res.status(400).json({ error: "รูปไม่ผ่านการตรวจ", errors: imageErrors });
    }
    try {
      store.set("richmenu", next);
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: "บันทึกไฟล์ไม่สำเร็จ" });
    }
    return res.json(store.get("richmenu"));
  }));

  router.get("/status", guarded(async (req, res) => {
    const { definition, problem } = savedDefinition();
    const statuses = await Promise.all(
      channels.map(async (channel) => {
        const base = { id: channel.id, name: channel.name };
        const unknown = { menus: [], staleCount: 0, removedKeys: [], foreignMenus: [] };
        if (problem) return { ...base, state: "invalid", message: problem, ...unknown };
        try {
          const status = describeChannel(definition, await createApi(channel).readState());
          return {
            ...base,
            state: status.state,
            message: status.message,
            menus: status.menus.map((menu) => ({ key: menu.key, label: menu.label, state: menu.state })),
            staleCount: status.staleMenus.length,
            removedKeys: status.removedKeys,
            foreignMenus: status.foreignMenus,
          };
        } catch (error) {
          const message = describeLineError(error);
          console.error(`[${channel.name}] อ่านสถานะ Rich Menu ไม่สำเร็จ: ${message}`);
          return { ...base, state: "error", message, ...unknown };
        }
      })
    );
    res.json(statuses);
  }));

  router.post("/sync/:channelId", guarded(async (req, res) => {
    const channel = channels.find((item) => String(item.id) === req.params.channelId);
    if (!channel) {
      return res.status(404).json({ error: "ไม่พบ LINE OA นี้" });
    }
    const { definition, problem } = savedDefinition();
    if (problem) {
      return res.json({ id: channel.id, name: channel.name, ok: false, steps: [], message: problem });
    }
    if (syncing) {
      return res.status(409).json({ error: "มีการ sync อื่นกำลังทำงานอยู่ กรุณารอให้เสร็จก่อน" });
    }
    syncing = true;
    try {
      const result = await syncChannel({ definition, api: createApi(channel), loadImage, sleep });
      console.log(`[${channel.name}] sync Rich Menu ${result.ok ? "สำเร็จ" : "ไม่สำเร็จ"}: ${result.message}`);
      return res.json({ id: channel.id, name: channel.name, ...result });
    } finally {
      syncing = false;
    }
  }));

  return router;
}

module.exports = { createRichMenuRouter };
