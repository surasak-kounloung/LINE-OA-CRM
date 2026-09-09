// Compare messageTable built from data/*.json against scripts/legacy/messages.json
const path = require("path");
const { createDataStore } = require("../services/dataStore");
const { build } = require("../services/messageTable");

const legacy = require("./legacy/messages.json");
const table = build(createDataStore(path.join(__dirname, "..", "data")).getAll());

// schedule triggers of branches whose map entry was commented out: intentionally gone (enabled=false)
const ALLOWED_MISSING = new Set([
  "สอบถามตารางแพทย์ สาขาเซ็นทรัล ศาลายา",
  "สอบถามตารางแพทย์ สาขาเซ็นทรัล มหาชัย",
]);

function firstDiff(a, b, p = "$") {
  if (JSON.stringify(a) === JSON.stringify(b)) return null;
  if (typeof a !== "object" || typeof b !== "object" || !a || !b) return `${p}: ${JSON.stringify(a)} != ${JSON.stringify(b)}`;
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of keys) {
    const d = firstDiff(a[k], b[k], `${p}.${k}`);
    if (d) return d;
  }
  return `${p}: key order differs`;
}

let failures = 0;
for (const [trigger, expected] of Object.entries(legacy)) {
  const actual = table.get(trigger);
  if (!actual) {
    if (ALLOWED_MISSING.has(trigger)) { console.log(`skip (allowed missing): ${trigger}`); continue; }
    failures++; console.error(`MISSING: ${trigger}`); continue;
  }
  const diff = firstDiff(actual, expected);
  if (diff) { failures++; console.error(`DIFF ${trigger}\n  ${diff}`); }
}
for (const trigger of table.keys()) {
  if (!(trigger in legacy)) { failures++; console.error(`EXTRA: ${trigger}`); }
}
console.log(`${Object.keys(legacy).length} legacy triggers, ${table.size} new triggers, ${failures} failures`);
process.exit(failures ? 1 : 0);
