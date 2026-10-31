// LINE จำลองในหน่วยความจำของหนึ่ง OA สำหรับเทสต์ Rich Menu
// มี interface เดียวกับ services/lineRichMenuApi.js และเก็บเมนู, alias, เมนูเริ่มต้น, การผูกลูกค้า
// อยู่นอกโฟลเดอร์ test/ เพราะ `node --test` รันทุกไฟล์ .js ใน test/ เป็นเทสต์
function createFakeLine({ menus = [], aliases = [], defaultRichMenuId = null, links = {} } = {}) {
  const state = {
    menus: new Map(menus.map((menu) => [menu.richMenuId, { ...menu, hasImage: true }])),
    aliases: new Map(aliases.map((alias) => [alias.richMenuAliasId, alias.richMenuId])),
    defaultRichMenuId,
    links: new Map(Object.entries(links)), // userId -> richMenuId
    batches: new Map(), // requestId -> phase
  };
  const calls = []; // ชื่อคำสั่งเขียนที่ถูกเรียก ตามลำดับ
  const failing = new Set(); // คำสั่งที่จะล้มในการเรียกครั้งถัดไป (ครั้งเดียว)
  const orphanedUsers = []; // ลูกค้าที่เมนูของตัวเองถูกลบทั้งที่ยังผูกอยู่
  let lostDefault = false; // เมนูเริ่มต้นถูกลบโดยยังไม่ได้ตั้งอันใหม่
  let batchOutcome = "succeeded";
  let nextId = 1;
  let createdSinceRead = []; // ID ของเมนูที่สร้างหลังการอ่านสถานะครั้งล่าสุด
  let lagOnce = false;

  const lineError = (status, message) => Object.assign(new Error(`${status} - ${message}`), { status, body: JSON.stringify({ message }) });

  function record(name) {
    calls.push(name);
    if (failing.delete(name)) throw lineError(500, `${name} failed`);
  }
  function requireMenu(richMenuId, { withImage = false } = {}) {
    const menu = state.menus.get(richMenuId);
    if (!menu) throw lineError(404, "richmenu not found");
    if (withImage && !menu.hasImage) throw lineError(400, "must upload richmenu image before applying it");
    return menu;
  }

  const api = {
    async readState() {
      // เมื่อสั่ง lagNextReadAfterCreate(): การอ่านครั้งถัดไปยังไม่เห็นเมนูที่เพิ่งสร้าง (alias และเมนูเริ่มต้นเห็นตามจริง)
      const hidden = new Set(lagOnce ? createdSinceRead : []);
      if (createdSinceRead.length) lagOnce = false;
      createdSinceRead = [];
      return {
        menus: [...state.menus.values()].filter((menu) => !hidden.has(menu.richMenuId)).map((menu) => ({ richMenuId: menu.richMenuId, name: menu.name })),
        aliases: [...state.aliases].map(([richMenuAliasId, richMenuId]) => ({ richMenuAliasId, richMenuId })),
        defaultRichMenuId: state.defaultRichMenuId,
      };
    },
    async createMenu(richMenu) {
      record("createMenu");
      const richMenuId = `richmenu-${nextId}`;
      nextId += 1;
      state.menus.set(richMenuId, { richMenuId, name: richMenu.name, richMenu, hasImage: false });
      createdSinceRead.push(richMenuId);
      return richMenuId;
    },
    async uploadImage(richMenuId, buffer, contentType) {
      record("uploadImage");
      const menu = requireMenu(richMenuId);
      menu.hasImage = true;
      menu.image = { bytes: buffer.length, contentType };
    },
    async createAlias(richMenuAliasId, richMenuId) {
      record("createAlias");
      requireMenu(richMenuId, { withImage: true });
      if (state.aliases.has(richMenuAliasId)) throw lineError(400, "conflict richmenu alias id");
      state.aliases.set(richMenuAliasId, richMenuId);
    },
    async updateAlias(richMenuAliasId, richMenuId) {
      record("updateAlias");
      requireMenu(richMenuId, { withImage: true });
      if (!state.aliases.has(richMenuAliasId)) throw lineError(404, "richmenu alias not found");
      state.aliases.set(richMenuAliasId, richMenuId);
    },
    async deleteAlias(richMenuAliasId) {
      record("deleteAlias");
      if (!state.aliases.delete(richMenuAliasId)) throw lineError(404, "richmenu alias not found");
    },
    async startBatch(operations) {
      record("startBatch");
      for (const operation of operations) {
        requireMenu(operation.from);
        if (operation.type === "link") requireMenu(operation.to, { withImage: true });
      }
      const requestId = `request-${state.batches.size + 1}`;
      state.batches.set(requestId, batchOutcome);
      if (batchOutcome === "succeeded") {
        for (const operation of operations) {
          for (const [userId, richMenuId] of [...state.links]) {
            if (richMenuId !== operation.from) continue;
            if (operation.type === "link") state.links.set(userId, operation.to);
            else state.links.delete(userId);
          }
        }
      }
      return requestId;
    },
    async batchPhase(requestId) {
      return state.batches.get(requestId);
    },
    async setDefault(richMenuId) {
      record("setDefault");
      requireMenu(richMenuId, { withImage: true });
      state.defaultRichMenuId = richMenuId;
    },
    async deleteMenu(richMenuId) {
      record("deleteMenu");
      requireMenu(richMenuId);
      state.menus.delete(richMenuId);
      if (state.defaultRichMenuId === richMenuId) {
        state.defaultRichMenuId = null;
        lostDefault = true;
      }
      for (const [userId, linked] of [...state.links]) {
        if (linked === richMenuId) {
          state.links.delete(userId);
          orphanedUsers.push(userId);
        }
      }
    },
  };

  return {
    api,
    calls,
    orphanedUsers,
    get lostDefault() { return lostDefault; },
    // คำสั่งชื่อนี้จะล้มหนึ่งครั้งในการเรียกครั้งถัดไป
    failNext(name) { failing.add(name); },
    // "succeeded" | "failed" | "ongoing" — ผลของคำสั่งย้ายลูกค้าที่จะถูกส่งหลังจากนี้
    setBatchOutcome(outcome) { batchOutcome = outcome; },
    // LINE จริงอาจยังไม่แสดงเมนูที่เพิ่งสร้างในรายการทันที: ให้การอ่านครั้งแรกหลังมีการสร้างเมนูเป็นแบบนั้นหนึ่งครั้ง
    lagNextReadAfterCreate() { lagOnce = true; },
    link(userId, richMenuId) { state.links.set(userId, richMenuId); },
    addMenu(richMenuId, name) { state.menus.set(richMenuId, { richMenuId, name, hasImage: true }); },
    idOfAlias(richMenuAliasId) { return state.aliases.get(richMenuAliasId) || null; },
    menu(richMenuId) { return state.menus.get(richMenuId) || null; },
    // ภาพรวมที่อ่านง่ายสำหรับ assert: ใช้ชื่อเมนูแทน ID
    snapshot() {
      const nameOf = (richMenuId) => (state.menus.get(richMenuId) || { name: `(deleted ${richMenuId})` }).name;
      return {
        menus: [...state.menus.values()].map((menu) => menu.name).sort(),
        aliases: Object.fromEntries([...state.aliases].map(([aliasId, richMenuId]) => [aliasId, nameOf(richMenuId)])),
        defaultMenu: state.defaultRichMenuId ? nameOf(state.defaultRichMenuId) : null,
        links: Object.fromEntries([...state.links].map(([userId, richMenuId]) => [userId, nameOf(richMenuId)])),
      };
    },
  };
}

module.exports = { createFakeLine };
