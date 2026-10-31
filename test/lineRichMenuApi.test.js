const test = require("node:test");
const assert = require("node:assert/strict");
const { createLineRichMenuApi, describeLineError } = require("../services/lineRichMenuApi");

const channel = { id: 2, name: "OA 2", channelAccessToken: "tok-BBB", channelSecret: "sec-BBB", forwardUrl: null };
const notFound = () => Object.assign(new Error("404 - Not Found"), { status: 404, body: '{"message":"no default rich menu"}' });

// client ปลอมของ SDK ที่บันทึกทุกคำสั่งที่ถูกเรียก
function stubs(over = {}) {
  const calls = [];
  const record = (name, result) => async (...args) => {
    calls.push([name, ...args]);
    return typeof result === "function" ? result(...args) : result;
  };
  const client = {
    getRichMenuList: record("getRichMenuList", { richmenus: [{ richMenuId: "rm-1", name: "vsq|gold|0123456789abcdef", size: { width: 2500, height: 1686 }, chatBarText: "Menu", areas: [] }] }),
    getRichMenuAliasList: record("getRichMenuAliasList", { aliases: [{ richMenuAliasId: "vsq-gold", richMenuId: "rm-1" }] }),
    getDefaultRichMenuId: record("getDefaultRichMenuId", { richMenuId: "rm-1" }),
    createRichMenu: record("createRichMenu", { richMenuId: "rm-new" }),
    createRichMenuAlias: record("createRichMenuAlias", {}),
    updateRichMenuAlias: record("updateRichMenuAlias", {}),
    deleteRichMenuAlias: record("deleteRichMenuAlias", {}),
    richMenuBatchWithHttpInfo: record("richMenuBatchWithHttpInfo", () => ({ httpResponse: new Response(null, { status: 202, headers: { "x-line-request-id": "request-9" } }), body: {} })),
    getRichMenuBatchProgress: record("getRichMenuBatchProgress", { phase: "succeeded", acceptedTime: "2026-10-07T00:00:00Z" }),
    setDefaultRichMenu: record("setDefaultRichMenu", {}),
    deleteRichMenu: record("deleteRichMenu", {}),
    ...over,
  };
  const blobClient = { setRichMenuImage: record("setRichMenuImage", {}) };
  return { calls, api: createLineRichMenuApi(channel, { client, blobClient }) };
}

test("readState keeps only the fields the sync needs", async () => {
  const { api } = stubs();
  assert.deepEqual(await api.readState(), {
    menus: [{ richMenuId: "rm-1", name: "vsq|gold|0123456789abcdef" }],
    aliases: [{ richMenuAliasId: "vsq-gold", richMenuId: "rm-1" }],
    defaultRichMenuId: "rm-1",
  });
});

test("readState: no default menu (LINE answers 404) is null, any other failure is passed on", async () => {
  const none = stubs({ getDefaultRichMenuId: async () => { throw notFound(); } });
  assert.equal((await none.api.readState()).defaultRichMenuId, null);

  const denied = Object.assign(new Error("401 - Unauthorized"), { status: 401 });
  const broken = stubs({ getDefaultRichMenuId: async () => { throw denied; } });
  await assert.rejects(broken.api.readState(), denied);

  const empty = stubs({ getRichMenuList: async () => ({}), getRichMenuAliasList: async () => ({}) });
  assert.deepEqual(await empty.api.readState(), { menus: [], aliases: [], defaultRichMenuId: "rm-1" });
});

test("createMenu passes the object through and returns the new ID", async () => {
  const { api, calls } = stubs();
  const richMenu = { size: { width: 2500, height: 1686 }, selected: true, name: "vsq|gold|0123456789abcdef", chatBarText: "Menu", areas: [] };
  assert.equal(await api.createMenu(richMenu), "rm-new");
  assert.deepEqual(calls, [["createRichMenu", richMenu]]);
});

test("uploadImage sends the bytes as a Blob with the image type", async () => {
  const { api, calls } = stubs();
  const bytes = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);
  await api.uploadImage("rm-new", bytes, "image/jpeg");
  const [name, richMenuId, blob] = calls[0];
  assert.deepEqual([name, richMenuId, blob.type], ["setRichMenuImage", "rm-new", "image/jpeg"]);
  assert.deepEqual(Buffer.from(await blob.arrayBuffer()), bytes);
});

test("alias, default and delete commands use the argument shapes of the SDK", async () => {
  const { api, calls } = stubs();
  await api.createAlias("vsq-gold", "rm-new");
  await api.updateAlias("vsq-gold", "rm-newer");
  await api.deleteAlias("vsq-silver");
  await api.setDefault("rm-new");
  await api.deleteMenu("rm-old");
  assert.deepEqual(calls, [
    ["createRichMenuAlias", { richMenuAliasId: "vsq-gold", richMenuId: "rm-new" }],
    ["updateRichMenuAlias", "vsq-gold", { richMenuId: "rm-newer" }],
    ["deleteRichMenuAlias", "vsq-silver"],
    ["setDefaultRichMenu", "rm-new"],
    ["deleteRichMenu", "rm-old"],
  ]);
});

test("startBatch wraps the operations and returns LINE's request ID; batchPhase reads the phase", async () => {
  const { api, calls } = stubs();
  const operations = [{ type: "link", from: "rm-old", to: "rm-new" }, { type: "unlink", from: "rm-gone" }];
  assert.equal(await api.startBatch(operations), "request-9");
  assert.equal(await api.batchPhase("request-9"), "succeeded");
  assert.deepEqual(calls, [["richMenuBatchWithHttpInfo", { operations }], ["getRichMenuBatchProgress", "request-9"]]);
});

test("describeLineError keeps the status and a bounded part of the body, and never the token", () => {
  const sdkError = Object.assign(new Error("400 - Bad Request"), {
    status: 400,
    statusText: "Bad Request",
    headers: new Headers({ authorization: "Bearer tok-BBB" }),
    body: '{"message":"The request body has 1 error(s)","details":[{"message":"must upload richmenu image"}]}',
  });
  const text = describeLineError(sdkError);
  assert.match(text, /^400 - Bad Request \(HTTP 400\) \{"message":"The request body has 1 error/);
  assert.ok(!text.includes("tok-BBB"));

  assert.equal(describeLineError(new Error("socket hang up")), "socket hang up");
  assert.equal(describeLineError("plain"), "plain");
  assert.equal(describeLineError(undefined), "undefined");
  const long = describeLineError(Object.assign(new Error("500 - Server Error"), { status: 500, body: "x".repeat(5000) }));
  assert.equal(long.length, "500 - Server Error (HTTP 500) ".length + 300);
});
