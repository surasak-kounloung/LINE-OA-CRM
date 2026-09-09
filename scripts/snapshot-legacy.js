// One-off: freeze current bot output + raw data as the migration oracle.
// Run: node scripts/snapshot-legacy.js
const fs = require("fs");
const path = require("path");

process.env.LINE_CHANNEL_TOKEN = process.env.LINE_CHANNEL_TOKEN || "snapshot";
process.env.LINE_CHANNEL_SECRET = process.env.LINE_CHANNEL_SECRET || "snapshot";

const root = path.join(__dirname, "..");
const outDir = path.join(__dirname, "legacy");
fs.mkdirSync(outDir, { recursive: true });

function writeJson(name, value) {
  fs.writeFileSync(path.join(outDir, name), JSON.stringify(value, null, 2) + "\n", "utf8");
}

// 1) every reply the bot can produce today
const { flexMessage } = require(path.join(root, "routes", "chatRoute.js"));
const messages = {};
for (const [trigger, builder] of Object.entries(flexMessage)) {
  messages[trigger] = builder();
}
writeJson("messages.json", messages);

// 2) raw promotion / service arrays
writeJson("promotions.json", require(path.join(root, "flexmessage", "promotion.js")).PROMOTIONS);
writeJson("services.json", require(path.join(root, "flexmessage", "services.js")).SERVICES);

// 3) every doctor data export, keyed by export name
const doctors = {};
const flexDir = path.join(root, "flexmessage");
for (const file of fs.readdirSync(flexDir)) {
  if (!/^doctor.*SchedulesData\d*\.js$/.test(file)) continue;
  const mod = require(path.join(flexDir, file));
  for (const [name, list] of Object.entries(mod)) {
    if (doctors[name]) throw new Error(`duplicate doctor export ${name}`);
    doctors[name] = list;
  }
}
writeJson("doctors.json", doctors);

// 4) the routing table source (for parsing branch maps incl. commented-out ones)
fs.copyFileSync(path.join(root, "routes", "chatRoute.js"), path.join(outDir, "chatRoute.source.js"));

console.log(`triggers: ${Object.keys(messages).length}, doctor exports: ${Object.keys(doctors).length}`);
