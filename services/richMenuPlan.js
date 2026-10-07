// ส่วนคำนวณล้วนของ Rich Menu: ชื่อบน LINE, object ที่ส่งให้ LINE และสถานะของ OA เทียบกับ data/richmenu.json
const crypto = require("crypto");

const NAME_PREFIX = "vsq";
const ALIAS_PREFIX = "vsq-";
const MANAGED_NAME = /^vsq\|([a-z0-9-]{1,20})\|([0-9a-f]{16})$/;

const aliasFor = (key) => `${ALIAS_PREFIX}${key}`;

function toLineArea(area) {
  const action =
    area.action.type === "message"
      ? { type: "message", text: area.action.text }
      : { type: "uri", uri: area.action.uri };
  return { bounds: { x: area.x, y: area.y, width: area.width, height: area.height }, action };
}

// ค่าที่ทำให้เมนูบน LINE ต้องถูกสร้างใหม่เมื่อเปลี่ยน (label ไม่เกี่ยว เพราะไม่ได้ส่งไป LINE)
function menuHash(definition, menu) {
  const canonical = JSON.stringify({
    size: { width: definition.size.width, height: definition.size.height },
    chatBarText: definition.chatBarText,
    selected: definition.selected,
    areas: definition.areas.map(toLineArea),
    image: menu.image,
  });
  return crypto.createHash("sha256").update(canonical).digest("hex").slice(0, 16);
}

const menuName = (definition, menu) => `${NAME_PREFIX}|${menu.key}|${menuHash(definition, menu)}`;

// เมนูของแอปนี้คืน { key, hash } เมนูของระบบอื่นคืน null
function parseManagedName(name) {
  const match = MANAGED_NAME.exec(typeof name === "string" ? name : "");
  return match ? { key: match[1], hash: match[2] } : null;
}

function toLineRichMenu(definition, menu) {
  return {
    size: { width: definition.size.width, height: definition.size.height },
    selected: definition.selected,
    name: menuName(definition, menu),
    chatBarText: definition.chatBarText,
    areas: definition.areas.map(toLineArea),
  };
}

const emptyStatus = (state, message, foreignMenus = []) => ({
  state,
  message,
  menus: [],
  staleMenus: [],
  removedAliases: [],
  removedKeys: [],
  foreignMenus,
  defaultOk: false,
});

// remote = { menus: [{ richMenuId, name }], aliases: [{ richMenuAliasId, richMenuId }], defaultRichMenuId }
function describeChannel(definition, remote) {
  const foreignMenus = remote.menus.filter((menu) => !parseManagedName(menu.name)).map((menu) => menu.name);
  if (foreignMenus.length) {
    return emptyStatus(
      "blocked",
      `OA นี้มี Rich Menu ที่ระบบอื่นสร้างไว้ ${foreignMenus.length} เมนู แอปนี้จะไม่แตะเมนูเหล่านั้น จึงยัง sync OA นี้ไม่ได้`,
      foreignMenus
    );
  }
  if (!definition.menus.length) {
    return emptyStatus("empty", "ยังไม่มีเมนูในรายการ เพิ่มเมนูแล้วบันทึกก่อน");
  }

  const remoteById = new Map(remote.menus.map((menu) => [menu.richMenuId, menu]));
  const aliasTargets = new Map(
    remote.aliases
      .filter((alias) => alias.richMenuAliasId.startsWith(ALIAS_PREFIX))
      .map((alias) => [alias.richMenuAliasId, alias.richMenuId])
  );

  const menus = definition.menus.map((menu) => {
    const aliasId = aliasFor(menu.key);
    const current = remoteById.get(aliasTargets.get(aliasId));
    let state = "missing";
    if (current) state = current.name === menuName(definition, menu) ? "ok" : "outdated";
    return {
      key: menu.key,
      label: menu.label,
      isDefault: menu.isDefault === true,
      state,
      richMenuId: state === "ok" ? current.richMenuId : null,
      aliasExists: aliasTargets.has(aliasId),
    };
  });

  const keys = new Set(definition.menus.map((menu) => menu.key));
  const removedAliases = [...aliasTargets.keys()].filter((aliasId) => !keys.has(aliasId.slice(ALIAS_PREFIX.length)));
  const removedKeys = removedAliases.map((aliasId) => aliasId.slice(ALIAS_PREFIX.length));

  // เมนูค้าง = เมนูของแอปนี้ที่ไม่มี alias ชี้อยู่ (รุ่นเก่าที่ถูกแทน หรือสร้างค้างไว้จากรอบที่ล้ม)
  // เมนูที่มี alias ใดก็ตามชี้อยู่ (รวม alias ของระบบอื่น) ยังมีคนใช้ จึงไม่นับเป็นเมนูค้าง
  const aliased = new Set(remote.aliases.map((alias) => alias.richMenuId));
  const staleMenus = remote.menus
    .filter((menu) => !aliased.has(menu.richMenuId))
    .map((menu) => ({ richMenuId: menu.richMenuId, key: parseManagedName(menu.name).key }));

  const defaultMenu = menus.find((menu) => menu.isDefault);
  const defaultOk = Boolean(defaultMenu && defaultMenu.richMenuId && defaultMenu.richMenuId === remote.defaultRichMenuId);

  const inSync =
    menus.every((menu) => menu.state === "ok") && removedAliases.length === 0 && staleMenus.length === 0 && defaultOk;

  return {
    state: inSync ? "in-sync" : "out-of-date",
    message: inSync ? "ตรงกับที่บันทึกไว้" : "ยังไม่ตรงกับที่บันทึกไว้",
    menus,
    staleMenus,
    removedAliases,
    removedKeys,
    foreignMenus: [],
    defaultOk,
  };
}

module.exports = { aliasFor, menuHash, menuName, parseManagedName, toLineRichMenu, describeChannel, ALIAS_PREFIX };
