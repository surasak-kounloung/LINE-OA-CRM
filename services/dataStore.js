// อ่าน/เขียนไฟล์ข้อมูล data/*.json ที่บอทและหน้า admin ใช้ร่วมกัน
// - cache ในหน่วยความจำ อ่านไฟล์ครั้งแรกครั้งเดียว
// - เขียนแบบ atomic (เขียน .tmp แล้ว rename) และสำรองไฟล์เดิมไว้ใน data/backup/
// - แจ้ง listener ทุกครั้งที่บันทึก เพื่อให้ messageTable สร้างตารางใหม่
const fs = require("fs");
const path = require("path");

const DATA_NAMES = ["promotions", "services", "branches", "regions"];
const MAX_BACKUPS = 20;

function createDataStore(baseDir) {
  const cache = new Map();
  const listeners = [];
  let backupCounter = 0;

  function filePath(name) {
    if (!DATA_NAMES.includes(name)) {
      throw new Error(`unknown data name: ${name}`);
    }
    return path.join(baseDir, `${name}.json`);
  }

  function get(name) {
    const file = filePath(name);
    if (!cache.has(name)) {
      cache.set(name, JSON.parse(fs.readFileSync(file, "utf8")));
    }
    return cache.get(name);
  }

  function backup(name) {
    const source = filePath(name);
    if (!fs.existsSync(source)) return;
    const dir = path.join(baseDir, "backup");
    fs.mkdirSync(dir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const counter = String(backupCounter++).padStart(4, "0");
    fs.copyFileSync(source, path.join(dir, `${name}.${stamp}-${counter}.json`));

    const existing = fs
      .readdirSync(dir)
      .filter((f) => f.startsWith(`${name}.`) && f.endsWith(".json"))
      .sort();
    while (existing.length > MAX_BACKUPS) {
      fs.unlinkSync(path.join(dir, existing.shift()));
    }
  }

  function set(name, value) {
    const target = filePath(name);
    backup(name);
    const tmp = `${target}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(value, null, 2) + "\n", "utf8");
    fs.renameSync(tmp, target);
    cache.set(name, value);
    listeners.forEach((fn) => fn(name, value));
  }

  function getAll() {
    return Object.fromEntries(DATA_NAMES.map((name) => [name, get(name)]));
  }

  function onChange(fn) {
    listeners.push(fn);
  }

  return { get, set, getAll, onChange, names: DATA_NAMES };
}

let defaultStore = null;
function getDefaultStore() {
  if (!defaultStore) {
    defaultStore = createDataStore(path.join(__dirname, "..", "data"));
  }
  return defaultStore;
}

module.exports = { createDataStore, getDefaultStore, DATA_NAMES };
