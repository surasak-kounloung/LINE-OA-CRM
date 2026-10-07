const test = require("node:test");
const assert = require("node:assert/strict");
const { aliasFor, menuHash, menuName, parseManagedName, toLineRichMenu, describeChannel } = require("../services/richMenuPlan");

const definition = (over = {}) => ({
  size: { width: 2500, height: 1686 },
  chatBarText: "Menu",
  selected: true,
  areas: [
    { x: 1596, y: 0, width: 904, height: 1084, action: { type: "uri", uri: "https://liff.line.me/x" } },
    { x: 0, y: 1082, width: 833, height: 604, action: { type: "message", text: "บริการทั้งหมด" } },
  ],
  menus: [
    { key: "default", label: "ก่อนสมัคร", image: "https://img.example/default.jpg", isDefault: true },
    { key: "gold", label: "V Gold", image: "https://img.example/gold.jpg", isDefault: false },
  ],
  ...over,
});

// สถานะบน LINE ของ OA ที่ sync ตรงกับ definition แล้ว
const remoteFor = (def) => ({
  menus: def.menus.map((menu) => ({ richMenuId: `rm-${menu.key}`, name: menuName(def, menu) })),
  aliases: def.menus.map((menu) => ({ richMenuAliasId: aliasFor(menu.key), richMenuId: `rm-${menu.key}` })),
  defaultRichMenuId: `rm-${def.menus.find((menu) => menu.isDefault).key}`,
});
const states = (status) => status.menus.map((menu) => [menu.key, menu.state]);

test("menu names carry the key and a 16-character hash, and parse back", () => {
  const def = definition();
  const name = menuName(def, def.menus[1]);
  assert.match(name, /^vsq\|gold\|[0-9a-f]{16}$/);
  assert.deepEqual(parseManagedName(name), { key: "gold", hash: menuHash(def, def.menus[1]) });
  assert.equal(aliasFor("gold"), "vsq-gold");
});

test("names made by other systems are not recognised as this app's menus", () => {
  for (const name of ["V Gold Richmenu 06/10/2026", "Default Richmenu 06/10/2026", "", undefined, null, 42, "vsq|GOLD|0123456789abcdef", "vsq|gold|0123", "vsq|gold|0123456789abcdef|x", "xvsq|gold|0123456789abcdef"]) {
    assert.equal(parseManagedName(name), null, String(name));
  }
});

test("the hash changes with anything LINE shows or uses, and nothing else", () => {
  const def = definition();
  const base = menuHash(def, def.menus[1]);
  const withArea = (patch) => definition({ areas: [{ ...def.areas[0], ...patch }, def.areas[1]] });
  const changed = [
    definition({ size: { width: 2500, height: 843 } }),
    definition({ chatBarText: "เมนู" }),
    definition({ selected: false }),
    withArea({ x: 1600 }),
    withArea({ action: { type: "uri", uri: "https://liff.line.me/y" } }),
    definition({ areas: [def.areas[1], def.areas[0]] }),
    definition({ areas: [def.areas[0]] }),
  ];
  for (const other of changed) assert.notEqual(menuHash(other, other.menus[1]), base);
  assert.notEqual(menuHash(def, { ...def.menus[1], image: "https://img.example/gold-v2.jpg" }), base);

  // label, isDefault, key และเมนูอื่นในรายการ ไม่ทำให้เมนูนี้ต้องถูกสร้างใหม่
  assert.equal(menuHash(def, { ...def.menus[1], label: "Gold ใหม่", isDefault: true, key: "other" }), base);
  const fewer = definition({ menus: [def.menus[1]] });
  assert.equal(menuHash(fewer, fewer.menus[0]), base);
});

test("toLineRichMenu builds exactly the object LINE expects", () => {
  const def = definition({
    areas: [
      { x: 1596, y: 0, width: 904, height: 1084, action: { type: "uri", uri: "https://liff.line.me/x", text: "leftover" } },
      { x: 0, y: 1082, width: 833, height: 604, action: { type: "message", text: "บริการทั้งหมด", uri: "leftover" } },
    ],
  });
  assert.deepEqual(toLineRichMenu(def, def.menus[1]), {
    size: { width: 2500, height: 1686 },
    selected: true,
    name: menuName(def, def.menus[1]),
    chatBarText: "Menu",
    areas: [
      { bounds: { x: 1596, y: 0, width: 904, height: 1084 }, action: { type: "uri", uri: "https://liff.line.me/x" } },
      { bounds: { x: 0, y: 1082, width: 833, height: 604 }, action: { type: "message", text: "บริการทั้งหมด" } },
    ],
  });
});

test("describeChannel: a menu from another system blocks the OA, whatever else is there", () => {
  const def = definition();
  const remote = remoteFor(def);
  remote.menus.push({ richMenuId: "rm-legacy", name: "V Gold Richmenu 06/10/2026" });
  const status = describeChannel(def, remote);
  assert.equal(status.state, "blocked");
  assert.deepEqual(status.foreignMenus, ["V Gold Richmenu 06/10/2026"]);
  assert.match(status.message, /ระบบอื่นสร้างไว้ 1 เมนู/);
  assert.deepEqual([status.menus, status.staleMenus, status.removedAliases], [[], [], []]);
  assert.equal(describeChannel(definition({ menus: [] }), remote).state, "blocked");
});

test("describeChannel: no menus in the list is 'empty'", () => {
  const status = describeChannel(definition({ menus: [] }), { menus: [], aliases: [], defaultRichMenuId: null });
  assert.equal(status.state, "empty");
  assert.match(status.message, /ยังไม่มีเมนูในรายการ/);
});

test("describeChannel: a fresh OA is out of date with every level missing", () => {
  const status = describeChannel(definition(), { menus: [], aliases: [], defaultRichMenuId: null });
  assert.equal(status.state, "out-of-date");
  assert.deepEqual(states(status), [["default", "missing"], ["gold", "missing"]]);
  assert.deepEqual(status.menus.map((menu) => [menu.aliasExists, menu.richMenuId, menu.isDefault]), [[false, null, true], [false, null, false]]);
  assert.equal(status.defaultOk, false);
});

test("describeChannel: an OA that matches is in sync", () => {
  const def = definition();
  const status = describeChannel(def, remoteFor(def));
  assert.equal(status.state, "in-sync");
  assert.deepEqual(states(status), [["default", "ok"], ["gold", "ok"]]);
  assert.deepEqual(status.menus.map((menu) => menu.richMenuId), ["rm-default", "rm-gold"]);
  assert.deepEqual([status.staleMenus, status.removedAliases, status.removedKeys, status.foreignMenus], [[], [], [], []]);
  assert.equal(status.defaultOk, true);
});

test("describeChannel: an alias from another system is ignored, not removed", () => {
  const def = definition();
  const remote = remoteFor(def);
  remote.aliases.push({ richMenuAliasId: "member", richMenuId: "rm-gold" });
  const status = describeChannel(def, remote);
  assert.equal(status.state, "in-sync");
  assert.deepEqual(status.removedAliases, []);
});

test("describeChannel: a changed level is outdated and keeps its alias", () => {
  const before = definition();
  const after = definition({ menus: [before.menus[0], { ...before.menus[1], image: "https://img.example/gold-v2.jpg" }] });
  const status = describeChannel(after, remoteFor(before));
  assert.equal(status.state, "out-of-date");
  assert.deepEqual(states(status), [["default", "ok"], ["gold", "outdated"]]);
  assert.deepEqual([status.menus[1].richMenuId, status.menus[1].aliasExists], [null, true]);
});

test("describeChannel: an alias pointing at a deleted menu is missing but the alias exists", () => {
  const def = definition();
  const remote = remoteFor(def);
  remote.menus = remote.menus.filter((menu) => menu.richMenuId !== "rm-gold");
  const status = describeChannel(def, remote);
  assert.deepEqual(states(status), [["default", "ok"], ["gold", "missing"]]);
  assert.equal(status.menus[1].aliasExists, true);
  assert.equal(status.state, "out-of-date");
});

test("describeChannel: a level removed from the list leaves an alias to remove", () => {
  const before = definition();
  const after = definition({ menus: [before.menus[0]] });
  const status = describeChannel(after, remoteFor(before));
  assert.equal(status.state, "out-of-date");
  assert.deepEqual([status.removedAliases, status.removedKeys], [["vsq-gold"], ["gold"]]);
  // เมนูของระดับที่ถูกลบยังมี alias ชี้อยู่ จึงยังไม่นับเป็นเมนูค้าง
  assert.deepEqual(status.staleMenus, []);
});

test("describeChannel: this app's menus that no alias points at are stale", () => {
  const def = definition();
  const remote = remoteFor(def);
  remote.menus.push({ richMenuId: "rm-old-gold", name: "vsq|gold|0000000000000000" }, { richMenuId: "rm-old-silver", name: "vsq|silver|1111111111111111" });
  const status = describeChannel(def, remote);
  assert.equal(status.state, "out-of-date");
  assert.deepEqual(status.staleMenus, [{ richMenuId: "rm-old-gold", key: "gold" }, { richMenuId: "rm-old-silver", key: "silver" }]);
  assert.deepEqual(states(status), [["default", "ok"], ["gold", "ok"]]);
});

test("describeChannel: a wrong or missing default menu is out of date", () => {
  const def = definition();
  for (const defaultRichMenuId of [null, "rm-gold", "rm-somewhere-else"]) {
    const status = describeChannel(def, { ...remoteFor(def), defaultRichMenuId });
    assert.equal(status.state, "out-of-date", String(defaultRichMenuId));
    assert.equal(status.defaultOk, false);
    assert.deepEqual(states(status), [["default", "ok"], ["gold", "ok"]]);
  }
});
