const test = require("node:test");
const assert = require("node:assert/strict");
const { syncChannel } = require("../services/richMenuSync");
const { describeChannel, menuName } = require("../services/richMenuPlan");
const { createFakeLine } = require("../test-helpers/fakeLineRichMenuApi");

const level = (key, label, isDefault = false, image = `https://img.example/${key}.jpg`) => ({ key, label, image, isDefault });
const definition = (over = {}) => ({
  size: { width: 2500, height: 1686 },
  chatBarText: "Menu",
  selected: true,
  areas: [
    { x: 1596, y: 0, width: 904, height: 1084, action: { type: "uri", uri: "https://liff.line.me/x" } },
    { x: 0, y: 1082, width: 833, height: 604, action: { type: "message", text: "บริการทั้งหมด" } },
  ],
  menus: [level("default", "ก่อนสมัคร", true), level("gold", "V Gold"), level("silver", "V Silver", false, "https://img.example/silver.png")],
  ...over,
});
const editedAreas = (def) => [{ ...def.areas[0], width: 900 }, def.areas[1]];

const loadImage = async (url) => ({ buffer: Buffer.from(url), contentType: url.endsWith(".png") ? "image/png" : "image/jpeg" });
const run = (fake, def, extra = {}) => syncChannel({ definition: def, api: fake.api, loadImage, sleep: async () => {}, pollLimit: 3, ...extra });
const stateOf = async (fake, def) => describeChannel(def, await fake.api.readState()).state;
const names = (def) => Object.fromEntries(def.menus.map((menu) => [menu.key, menuName(def, menu)]));

// OA ที่ sync ตาม def แล้ว พร้อมลูกค้าที่ผูกกับเมนูของแต่ละระดับ (users: { userId: key })
async function syncedOa(def, users = {}) {
  const fake = createFakeLine();
  assert.equal((await run(fake, def)).ok, true);
  for (const [userId, key] of Object.entries(users)) fake.link(userId, fake.idOfAlias(`vsq-${key}`));
  fake.calls.length = 0;
  return fake;
}

test("a fresh OA gets every menu, its alias, its image and the default", async () => {
  const def = definition();
  const fake = createFakeLine();
  const result = await run(fake, def);

  assert.equal(result.ok, true);
  assert.deepEqual(fake.calls, [
    "createMenu", "uploadImage", "createAlias",
    "createMenu", "uploadImage", "createAlias",
    "createMenu", "uploadImage", "createAlias",
    "setDefault",
  ]);
  const expected = names(def);
  assert.deepEqual(fake.snapshot(), {
    menus: Object.values(expected).sort(),
    aliases: { "vsq-default": expected.default, "vsq-gold": expected.gold, "vsq-silver": expected.silver },
    defaultMenu: expected.default,
    links: {},
  });
  assert.equal(fake.menu(fake.idOfAlias("vsq-gold")).image.contentType, "image/jpeg");
  assert.equal(fake.menu(fake.idOfAlias("vsq-silver")).image.contentType, "image/png");
  assert.deepEqual(fake.menu(fake.idOfAlias("vsq-gold")).richMenu.areas[1], { bounds: { x: 0, y: 1082, width: 833, height: 604 }, action: { type: "message", text: "บริการทั้งหมด" } });
  assert.equal(await stateOf(fake, def), "in-sync");
  assert.ok(result.steps.length > 0);
});

test("syncing again right away sends no write command", async () => {
  const def = definition();
  const fake = await syncedOa(def);
  const result = await run(fake, def);
  assert.equal(result.ok, true);
  assert.match(result.message, /ตรงกับที่บันทึกไว้อยู่แล้ว/);
  assert.deepEqual(fake.calls, []);
});

test("editing the tap areas replaces every menu and moves linked customers along", async () => {
  const before = definition();
  const fake = await syncedOa(before, { "u-default": "default", "u-gold-1": "gold", "u-gold-2": "gold", "u-silver": "silver" });
  const after = definition({ areas: editedAreas(before) });

  const result = await run(fake, after);

  assert.equal(result.ok, true);
  const expected = names(after);
  assert.deepEqual(fake.snapshot(), {
    menus: Object.values(expected).sort(),
    aliases: { "vsq-default": expected.default, "vsq-gold": expected.gold, "vsq-silver": expected.silver },
    defaultMenu: expected.default,
    links: { "u-default": expected.default, "u-gold-1": expected.gold, "u-gold-2": expected.gold, "u-silver": expected.silver },
  });
  assert.equal(fake.calls.filter((call) => call === "startBatch").length, 1);
  assert.equal(fake.calls.filter((call) => call === "deleteMenu").length, 3);
  assert.ok(fake.calls.indexOf("setDefault") < fake.calls.indexOf("deleteMenu"), "the default must move before the old default menu is deleted");
  assert.deepEqual(fake.orphanedUsers, []);
  assert.equal(fake.lostDefault, false);
  assert.equal(await stateOf(fake, after), "in-sync");
});

test("changing one image replaces only that level", async () => {
  const before = definition();
  const fake = await syncedOa(before, { "u-gold": "gold", "u-silver": "silver" });
  const untouched = fake.idOfAlias("vsq-silver");
  const after = definition({ menus: [before.menus[0], level("gold", "V Gold", false, "https://img.example/gold-v2.jpg"), before.menus[2]] });

  assert.equal((await run(fake, after)).ok, true);

  assert.deepEqual(fake.calls, ["createMenu", "uploadImage", "updateAlias", "startBatch", "deleteMenu"]);
  assert.equal(fake.idOfAlias("vsq-silver"), untouched);
  assert.deepEqual(fake.snapshot().links, { "u-gold": names(after).gold, "u-silver": names(after).silver });
  assert.deepEqual(fake.orphanedUsers, []);
});

test("removing a level unlinks its customers and deletes its alias and menu", async () => {
  const before = definition();
  const fake = await syncedOa(before, { "u-gold": "gold", "u-silver": "silver" });
  const after = definition({ menus: [before.menus[0], before.menus[1]] });

  assert.equal((await run(fake, after)).ok, true);

  assert.deepEqual(fake.calls, ["deleteAlias", "startBatch", "deleteMenu"]);
  const expected = names(after);
  assert.deepEqual(fake.snapshot(), {
    menus: [expected.default, expected.gold].sort(),
    aliases: { "vsq-default": expected.default, "vsq-gold": expected.gold },
    defaultMenu: expected.default,
    links: { "u-gold": expected.gold },
  });
  // ลูกค้าของระดับที่ถูกลบถูกยกเลิกการผูกก่อน ไม่ใช่หลุดเพราะเมนูถูกลบ
  assert.deepEqual(fake.orphanedUsers, []);
});

test("choosing another default menu only sets the default", async () => {
  const before = definition();
  const fake = await syncedOa(before);
  const after = definition({ menus: [level("default", "ก่อนสมัคร", false), level("gold", "V Gold", true), before.menus[2]] });

  assert.equal((await run(fake, after)).ok, true);

  assert.deepEqual(fake.calls, ["setDefault"]);
  assert.equal(fake.snapshot().defaultMenu, names(after).gold);
});

test("a failure at any step is recovered by syncing again, with no customer or default lost", async () => {
  const before = definition();
  // แก้พื้นที่กด (แทนทุกเมนู), ลบ silver, เพิ่ม platinum, เปลี่ยนเมนูเริ่มต้นเป็น gold — ให้เกิดคำสั่งเขียนครบทุกชนิด
  const after = definition({
    areas: editedAreas(before),
    menus: [level("default", "ก่อนสมัคร", false), level("gold", "V Gold", true), level("platinum", "V Platinum")],
  });
  const expected = names(after);

  for (const step of ["createMenu", "uploadImage", "updateAlias", "createAlias", "deleteAlias", "startBatch", "setDefault", "deleteMenu"]) {
    const fake = await syncedOa(before, { "u-default": "default", "u-gold": "gold", "u-silver": "silver" });
    fake.failNext(step);

    const first = await run(fake, after);
    assert.equal(first.ok, false, step);
    assert.match(first.message, /LINE ปฏิเสธคำสั่ง/, step);
    assert.ok(fake.calls.includes(step), `${step} was never called, so this scenario does not cover it`);

    const second = await run(fake, after);
    assert.equal(second.ok, true, `${step}: ${second.message}`);
    assert.deepEqual(fake.snapshot(), {
      menus: Object.values(expected).sort(),
      aliases: { "vsq-default": expected.default, "vsq-gold": expected.gold, "vsq-platinum": expected.platinum },
      defaultMenu: expected.gold,
      links: { "u-default": expected.default, "u-gold": expected.gold },
    }, step);
    assert.deepEqual(fake.orphanedUsers, [], step);
    assert.equal(fake.lostDefault, false, step);
    assert.equal(await stateOf(fake, after), "in-sync", step);
  }
});

test("old menus are kept while LINE has not finished moving customers, and removed by a later sync", async () => {
  for (const outcome of ["ongoing", "failed"]) {
    const before = definition();
    const fake = await syncedOa(before, { "u-gold": "gold" });
    const after = definition({ areas: editedAreas(before) });
    fake.setBatchOutcome(outcome);

    const first = await run(fake, after);
    assert.equal(first.ok, false, outcome);
    assert.match(first.message, /ยังย้ายลูกค้าออกจากเมนูเก่าไม่เสร็จ/, outcome);
    assert.equal(fake.calls.includes("deleteMenu"), false, outcome);
    assert.equal(fake.snapshot().menus.length, 6, outcome);
    assert.equal(fake.snapshot().links["u-gold"], names(before).gold, outcome);
    // เมนูเริ่มต้นและ alias ชี้ไปเมนูใหม่แล้ว ลูกค้าใหม่จึงเห็นเมนูใหม่ทันที
    assert.equal(fake.snapshot().defaultMenu, names(after).default, outcome);

    fake.setBatchOutcome("succeeded");
    assert.equal((await run(fake, after)).ok, true, outcome);
    assert.equal(fake.snapshot().menus.length, 3, outcome);
    assert.equal(fake.snapshot().links["u-gold"], names(after).gold, outcome);
    assert.deepEqual(fake.orphanedUsers, [], outcome);
    assert.equal(await stateOf(fake, after), "in-sync", outcome);
  }
});

test("an OA with a menu from another system is never written to", async () => {
  const fake = createFakeLine({ menus: [{ richMenuId: "richmenu-legacy", name: "V Gold Richmenu 06/10/2026" }], defaultRichMenuId: "richmenu-legacy", links: { "u-1": "richmenu-legacy" } });
  const result = await run(fake, definition());
  assert.equal(result.ok, false);
  assert.match(result.message, /ระบบอื่นสร้างไว้/);
  assert.deepEqual(fake.calls, []);
  assert.deepEqual(fake.snapshot().links, { "u-1": "V Gold Richmenu 06/10/2026" });
});

test("an empty menu list is never synced", async () => {
  const fake = await syncedOa(definition());
  const result = await run(fake, definition({ menus: [] }));
  assert.equal(result.ok, false);
  assert.match(result.message, /ยังไม่มีเมนูในรายการ/);
  assert.deepEqual(fake.calls, []);
});

test("an image that fails its check stops the sync before anything is sent to LINE", async () => {
  const fake = createFakeLine();
  const failing = async (url, size) => {
    if (url.includes("gold")) throw new Error("ไฟล์รูปใหญ่เกิน 1 MB");
    return loadImage(url, size);
  };
  const result = await run(fake, definition(), { loadImage: failing });
  assert.equal(result.ok, false);
  assert.match(result.message, /รูปไม่ผ่านการตรวจ — V Gold: ไฟล์รูปใหญ่เกิน 1 MB/);
  assert.deepEqual(fake.calls, []);
});

test("an alias left pointing at a deleted menu is updated rather than created again", async () => {
  const def = definition({ menus: [level("default", "ก่อนสมัคร", true), level("gold", "V Gold")] });
  const fake = createFakeLine({ aliases: [{ richMenuAliasId: "vsq-gold", richMenuId: "richmenu-gone" }] });
  const result = await run(fake, def);
  assert.equal(result.ok, true, result.message);
  assert.deepEqual(fake.calls, ["createMenu", "uploadImage", "createAlias", "createMenu", "uploadImage", "updateAlias", "setDefault"]);
  assert.equal(await stateOf(fake, def), "in-sync");
});

test("a LINE error comes back as a message with its status and body, not as an exception", async () => {
  const fake = createFakeLine();
  fake.failNext("createMenu");
  const result = await run(fake, definition());
  assert.equal(result.ok, false);
  assert.match(result.message, /HTTP 500/);
  assert.match(result.message, /createMenu failed/);
  assert.deepEqual(result.steps, ["ตรวจรูปครบ 3 เมนู"]);
});

test("the wait for LINE to move customers is bounded by pollLimit", async () => {
  const before = definition();
  const fake = await syncedOa(before);
  fake.setBatchOutcome("ongoing");
  const naps = [];
  await run(fake, definition({ areas: editedAreas(before) }), { sleep: async (ms) => { naps.push(ms); }, pollLimit: 5 });
  assert.deepEqual(naps, [1000, 1000, 1000, 1000]);
});

test("a menu list that lags behind LINE's own writes never unlinks customers or loses the default", async () => {
  const before = definition();
  const fake = await syncedOa(before, { "u-default": "default", "u-gold": "gold", "u-silver": "silver" });
  const after = definition({ areas: editedAreas(before) });
  fake.lagNextReadAfterCreate();

  const result = await run(fake, after);

  const expected = names(after);
  assert.deepEqual(fake.snapshot().links, { "u-default": expected.default, "u-gold": expected.gold, "u-silver": expected.silver });
  assert.equal(fake.snapshot().defaultMenu, expected.default);
  assert.deepEqual(fake.orphanedUsers, []);
  assert.equal(fake.lostDefault, false);
  assert.equal(result.ok, true, result.message);
  assert.equal(await stateOf(fake, after), "in-sync");
});

test("a definition without exactly one default menu is never synced", async () => {
  // ผ่านหน้าแอดมินไม่ได้เพราะมีการตรวจ แต่เกิดได้เมื่อแก้ data/richmenu.json ด้วยมือ
  const before = definition();
  const noDefault = before.menus.map((menu) => ({ ...menu, isDefault: false }));
  const twoDefaults = before.menus.map((menu) => ({ ...menu, isDefault: menu.key !== "silver" }));
  for (const menus of [noDefault, twoDefaults]) {
    const fake = await syncedOa(before, { "u-gold": "gold" });
    const result = await run(fake, definition({ areas: editedAreas(before), menus }));
    assert.equal(result.ok, false);
    assert.match(result.message, /เมนูเริ่มต้น 1 อันพอดี/);
    assert.deepEqual(fake.calls, []);
    assert.equal(fake.snapshot().defaultMenu, names(before).default);
  }
});
