const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { createDataStore, DATA_NAMES } = require("../services/dataStore");

function tmpDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "vsq-store-"));
  for (const name of DATA_NAMES) {
    fs.writeFileSync(path.join(dir, `${name}.json`), "[]\n", "utf8");
  }
  return dir;
}

test("get reads and parses the json file", () => {
  const dir = tmpDir();
  fs.writeFileSync(path.join(dir, "regions.json"), JSON.stringify([{ sections: ["A"] }]));
  const store = createDataStore(dir);
  assert.deepEqual(store.get("regions"), [{ sections: ["A"] }]);
});

test("get rejects unknown names", () => {
  const store = createDataStore(tmpDir());
  assert.throws(() => store.get("users"), /unknown data name/);
});

test("set writes file, updates cache and leaves no tmp file", () => {
  const dir = tmpDir();
  const store = createDataStore(dir);
  store.set("promotions", [{ id: "a" }]);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(dir, "promotions.json"), "utf8")), [{ id: "a" }]);
  assert.deepEqual(store.get("promotions"), [{ id: "a" }]);
  assert.equal(fs.existsSync(path.join(dir, "promotions.json.tmp")), false);
});

test("set writes a backup of the previous content and keeps at most 20", () => {
  const dir = tmpDir();
  const store = createDataStore(dir);
  for (let i = 0; i < 25; i++) store.set("services", [{ id: `s${i}` }]);
  const backups = fs.readdirSync(path.join(dir, "backup")).filter((f) => f.startsWith("services."));
  assert.equal(backups.length, 20);
  const newest = backups.sort().at(-1);
  // newest backup holds the content that was on disk *before* the last set (s23)
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(dir, "backup", newest), "utf8")), [{ id: "s23" }]);
});

test("onChange listeners are called with name and value", () => {
  const store = createDataStore(tmpDir());
  const calls = [];
  store.onChange((name, value) => calls.push([name, value]));
  store.set("regions", [{ sections: ["X"] }]);
  assert.deepEqual(calls, [["regions", [{ sections: ["X"] }]]]);
});

test("getAll returns all four resources", () => {
  const store = createDataStore(tmpDir());
  assert.deepEqual(Object.keys(store.getAll()).sort(), [...DATA_NAMES].sort());
});

test("set does not throw if a listener throws, and continues calling other listeners", () => {
  const store = createDataStore(tmpDir());
  const secondListenerCalls = [];
  const orig = console.error;
  console.error = () => {};
  try {
    store.onChange(() => {
      throw new Error("listener error");
    });
    store.onChange((name, value) => {
      secondListenerCalls.push([name, value]);
    });
    store.set("branches", [{ id: "b1" }]);
    assert.deepEqual(secondListenerCalls, [["branches", [{ id: "b1" }]]]);
  } finally {
    console.error = orig;
  }
});

test("richmenu is read, written and backed up like the other files", () => {
  const dir = tmpDir();
  fs.writeFileSync(path.join(dir, "richmenu.json"), JSON.stringify({ menus: [] }));
  const store = createDataStore(dir);
  assert.deepEqual(store.get("richmenu"), { menus: [] });
  store.set("richmenu", { menus: [{ key: "gold" }] });
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(dir, "richmenu.json"), "utf8")), { menus: [{ key: "gold" }] });
  assert.deepEqual(store.get("richmenu"), { menus: [{ key: "gold" }] });
  assert.equal(fs.readdirSync(path.join(dir, "backup")).filter((f) => f.startsWith("richmenu.")).length, 1);
});

test("getAll leaves richmenu out, so the trigger table never depends on it", () => {
  // tmpDir() ไม่มี richmenu.json: getAll() ต้องไม่พยายามอ่านไฟล์นั้น
  const store = createDataStore(tmpDir());
  assert.deepEqual(Object.keys(store.getAll()).sort(), [...DATA_NAMES].sort());
  assert.equal(DATA_NAMES.includes("richmenu"), false);
});
