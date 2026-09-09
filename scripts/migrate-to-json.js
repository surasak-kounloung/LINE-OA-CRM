// One-off: build data/*.json from scripts/legacy/*. Run: node scripts/migrate-to-json.js
const fs = require("fs");
const path = require("path");
const { validatePromotions, validateServices, validateBranches, validateRegions } = require("../services/validate");

const legacyDir = path.join(__dirname, "legacy");
const dataDir = path.join(__dirname, "..", "data");
const readJson = (name) => JSON.parse(fs.readFileSync(path.join(legacyDir, name), "utf8"));
const writeJson = (name, value) => fs.writeFileSync(path.join(dataDir, name), JSON.stringify(value, null, 2) + "\n", "utf8");

function slug(text, fallback) {
  const s = String(text).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return s || fallback;
}

// ---------- regions + menu layout (from BRANCH_GROUPS in tabledoctors.js, incl. commented entries) ----------
const REGIONS = [
  { sections: ["กรุงเทพฯ ในเมือง"] },
  { sections: ["กรุงเทพฯ ตอนเหนือ"] },
  { sections: ["กรุงเทพฯ ฝั่งตะวันออก"] },
  { sections: ["กรุงเทพฯ ฝั่งธนบุรี"] },
  { sections: ["กรุงเทพฯ ตอนใต้"] },
  { sections: ["กรุงเทพฯ-ปทุมธานี", "กรุงเทพฯ-นนทบุรี"] },
  { sections: ["กรุงเทพฯ-นครปฐม"] },
];
// section → triggers in display order (disabled branches included where they used to sit)
const MENU_LAYOUT = [
  ["กรุงเทพฯ ในเมือง", ["สยาม สแควร์ วัน", "เซ็นทรัล เวิล์ด", "เทอร์มินอล อโศก", "พระราม 9", "เอสพลานาด รัชดาภิเษก"]],
  ["กรุงเทพฯ ตอนเหนือ", ["เซ็นทรัล ลาดพร้าว", "เมเจอร์ รัชโยธิน", "เซ็นทรัล รามอินทรา", "เดอะมอลล์ งามวงศ์วาน", "เซ็นทรัล อีสวิลล์", "เลียบด่วน"]],
  ["กรุงเทพฯ ฝั่งตะวันออก", ["เดอะ พรอมานาด", "เดอะมอลล์ บางกะปิ", "ซีคอน สแควร์ ศรีนครินทร์", "เมกา บางนา", "เซ็นทรัล บางนา"]],
  ["กรุงเทพฯ ฝั่งธนบุรี", ["เซ็นทรัล ปิ่นเกล้า", "เดอะมอลล์ ท่าพระ", "เซ็นทรัล พระราม 2", "เดอะมอลล์ บางแค", "พาซิโอ กาญจนา"]],
  ["กรุงเทพฯ ตอนใต้", ["ดุสิต เซ็นทรัล พาร์ค", "วัน แบงค็อก", "ทองหล่อ", "ทองหล่อ เลเซอร์เซ็นเตอร์", "ทองหล่อ เวลเนสเช็นเตอร์", "เอ็มควอเทียร์", "เกตเวย์ เอกมัย", "เซ็นทรัล พระราม 3"]],
  ["กรุงเทพฯ-ปทุมธานี", ["ฟิวเจอร์พาร์ค รังสิต"]],
  ["กรุงเทพฯ-นนทบุรี", ["เซ็นทรัล เวสต์วิลล์", "เซ็นทรัล เวสต์เกต", "เซ็นทรัล แจ้งวัฒนะ"]],
  ["กรุงเทพฯ-นครปฐม", ["เซ็นทรัล ศาลายา", "เซ็นทรัล นครปฐม", "เซ็นทรัล มหาชัย"]],
];
const MENU_OVERRIDES = {
  "ทองหล่อ": { menu: "both", mainMenuActionText: "ตารางแพทย์สาขาทองหล่อ" },
  "ทองหล่อ เลเซอร์เซ็นเตอร์": { menu: "thonglor" },
  "ทองหล่อ เวลเนสเช็นเตอร์": { menu: "thonglor" },
};

// ---------- parse chatRoute source ----------
// normalise CRLF so the `$` anchors below match on Windows checkouts
const source = fs.readFileSync(path.join(legacyDir, "chatRoute.source.js"), "utf8").replace(/\r\n/g, "\n");
const uncommented = source.replace(/^(\s*)\/\/ ?/gm, "$1");
const ENTRY_RE = /^  "([^"\n]+)": \(\) => \[\n([\s\S]*?)\n  \],?$/gm;

function parseEntries(text) {
  const entries = new Map();
  for (const m of text.matchAll(ENTRY_RE)) entries.set(m[1], m[2]);
  return entries;
}
const activeEntries = parseEntries(source);
const allEntries = parseEntries(uncommented);

const branchMaps = new Map(); // trigger → fields
const priceImages = new Map(); // actionText → urls
const scheduleVars = new Map(); // trigger → [varName]
for (const [key, body] of allEntries) {
  if (body.includes("FlexMessageBranchMap({")) {
    const block = body.slice(body.indexOf("FlexMessageBranchMap({"));
    const fields = {};
    for (const f of block.matchAll(/(\w+):\s*"([^"]*)"/g)) fields[f[1]] = f[2];
    branchMaps.set(key, fields);
  } else if (body.includes("FlexMessageServicePrices(")) {
    priceImages.set(key, [...body.matchAll(/"(https?:\/\/[^"]+)"/g)].map((m) => m[1]));
  } else if (body.includes("FlexMessageDoctorSchedules(")) {
    const trigger = key.replace(/^สอบถามตารางแพทย์ สาขา/, "");
    scheduleVars.set(trigger, [...body.matchAll(/FlexMessageDoctorSchedules\((\w+)\)/g)].map((m) => m[1]));
  }
}

// ---------- promotions ----------
const promotions = readJson("promotions.json").map((p, i) => ({
  id: slug(p.title, `promotion-${i + 1}`),
  image: p.image, title: p.title, lines: p.lines, inquiryText: p.inquiryText, hot: Boolean(p.hot),
}));

// ---------- services ----------
const services = readJson("services.json").map((s, i) => ({
  id: slug(s.inquiryText, `service-${i + 1}`),
  image: s.image, title: s.title, subtitle: s.inquiryText, actionText: s.actionText, hot: Boolean(s.hot),
  priceImages: priceImages.get(s.actionText) || [],
}));

// ---------- branches ----------
const doctorsByVar = readJson("doctors.json");
const branches = [];
for (const [section, triggers] of MENU_LAYOUT) {
  for (const trigger of triggers) {
    const fields = branchMaps.get(trigger);
    if (!fields) throw new Error(`no FlexMessageBranchMap entry for "${trigger}"`);
    const vars = scheduleVars.get(trigger) || [];
    const doctors = vars.flatMap((v) => {
      if (!doctorsByVar[v]) throw new Error(`unknown doctor export ${v} for "${trigger}"`);
      return doctorsByVar[v];
    });
    const id = vars[0]
      ? vars[0].replace(/DoctorSchedules\d*$/, "").replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase()
      : slug(trigger, `branch-${branches.length + 1}`);
    const branch = {
      id, trigger,
      displayName: fields.branchName,
      region: section,
      menu: "main",
      enabled: activeEntries.has(trigger),
      fontSize: fields.fontSize,
      mapUrl: fields.mapUrl,
      imageUrl: fields.imageUrl,
      phoneNumber: fields.phoneNumber,
      lineId: fields.lineId,
      lineUrl: fields.lineUrl || "",
      ...MENU_OVERRIDES[trigger],
      // two disabled-branch doctor exports (esplanade, มหาชัย) have "ไม่มีหมอ" placeholder
      // rows whose license is a single space in scripts/legacy/doctors.json; these branches
      // are disabled so messageTable.build() never reads their doctors array (it filters to
      // enabled branches before emitting doctor-schedule messages), but validateBranches still
      // requires a non-blank license. Normalise blank/whitespace-only licenses to "-" so the
      // schema validator passes without altering any output the legacy snapshot compares against.
      doctors: doctors.map(({ day, name, license, imageUrl }) => ({
        day, name, license: license && license.trim() ? license : "-", imageUrl,
      })),
    };
    branches.push(branch);
  }
}
const layoutTriggers = new Set(MENU_LAYOUT.flatMap(([, t]) => t));
for (const trigger of branchMaps.keys()) {
  if (!layoutTriggers.has(trigger)) throw new Error(`branch "${trigger}" missing from MENU_LAYOUT`);
}

// ---------- validate + write ----------
const problems = [
  ...validatePromotions(promotions).map((e) => ({ file: "promotions", ...e })),
  ...validateServices(services).map((e) => ({ file: "services", ...e })),
  ...validateBranches(branches, REGIONS).map((e) => ({ file: "branches", ...e })),
  ...validateRegions(REGIONS, branches).map((e) => ({ file: "regions", ...e })),
];
if (problems.length) {
  console.error(problems);
  throw new Error("migrated data failed validation");
}
fs.mkdirSync(dataDir, { recursive: true });
writeJson("promotions.json", promotions);
writeJson("services.json", services);
writeJson("branches.json", branches);
writeJson("regions.json", REGIONS);
console.log(`promotions ${promotions.length}, services ${services.length}, branches ${branches.length} (${branches.filter((b) => b.enabled).length} enabled), regions ${REGIONS.length}`);
