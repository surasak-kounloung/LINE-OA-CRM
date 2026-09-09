// สร้างตาราง trigger → ข้อความตอบ จากข้อมูลใน data/*.json
// build() เป็น pure function; createMessageTable() ผูกกับ dataStore และสร้างใหม่เมื่อข้อมูลเปลี่ยน
const { FlexMessageBranchMap } = require("../flexmessage/flexMessageBranchMap");
const { FlexMessageIconTable } = require("../flexmessage/flexMessageIconTable");
const { FlexMessageDoctorSchedules } = require("../flexmessage/flexMessageDoctorSchedules");
const { FlexMessageServicePrices } = require("../flexmessage/flexMessageServicePrices");
const { FlexMessageServicesBubble } = require("../flexmessage/services");
const { FlexMessagePromotionBubble } = require("../flexmessage/promotion");
const { FlexMessageTableDoctorsBubble } = require("../flexmessage/tabledoctors");
const { FlexMessageTableDoctorsThonglorBubble } = require("../flexmessage/tabledoctorsThonglor");

const FOLLOW_UP_TEXT = "👨‍⚕️ปรึกษาหมอได้เลย หมอตอบเองครับ";
const SCHEDULE_PREFIX = "สอบถามตารางแพทย์ สาขา";
const MAX_BUBBLES = 12; // LINE จำกัด 12 bubble ต่อ carousel

const createFlexMessage = (altText, contents) => ({ type: "flex", altText, contents });
const createTextMessage = (text) => ({ type: "text", text });

function chunk(list, size) {
  const out = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

function scheduleTrigger(branch) {
  return SCHEDULE_PREFIX + branch.trigger;
}

const inMainMenu = (b) => b.enabled && (b.menu === "main" || b.menu === "both");
const inThonglorMenu = (b) => b.enabled && (b.menu === "thonglor" || b.menu === "both");

// เมนู "ตารางแพทย์": 1 region = 1 bubble, section แรกเป็นหัวข้อหลัก ที่เหลือเป็น extraSections
function buildMainMenuGroups(regions, branches) {
  const rowsFor = (section) =>
    branches
      .filter((b) => inMainMenu(b) && b.region === section)
      .map((b) => ({ name: b.trigger, actionText: b.mainMenuActionText || b.trigger }));
  return regions.map((region) => {
    const [first, ...rest] = region.sections;
    const group = { title: first, branches: rowsFor(first) };
    if (rest.length) group.extraSections = rest.map((s) => ({ title: s, branches: rowsFor(s) }));
    return group;
  });
}

// เมนู "ตารางแพทย์สาขาทองหล่อ": bubble เดียว
function buildThonglorGroup(branches) {
  const list = branches.filter(inThonglorMenu);
  if (!list.length) return null;
  return { title: list[0].region, branches: list.map((b) => ({ name: b.trigger, actionText: b.trigger })) };
}

function build(data) {
  const { promotions, services, branches, regions } = data;
  if (![promotions, services, branches, regions].every(Array.isArray)) {
    throw new Error("messageTable: ข้อมูลไม่ครบหรือไม่ใช่ array");
  }
  const table = new Map();

  table.set("บริการทั้งหมด", [createFlexMessage("บริการทั้งหมด", FlexMessageServicesBubble(services))]);
  table.set("โปรโมชั่นล่าสุด", [createFlexMessage("โปรโมชั่นล่าสุด", FlexMessagePromotionBubble(promotions))]);
  table.set("ตารางแพทย์", [createFlexMessage("ตารางแพทย์", FlexMessageTableDoctorsBubble(buildMainMenuGroups(regions, branches)))]);

  const thonglor = buildThonglorGroup(branches);
  if (thonglor) {
    table.set("ตารางแพทย์สาขาทองหล่อ", [createFlexMessage("ตารางแพทย์สาขาทองหล่อ", FlexMessageTableDoctorsThonglorBubble(thonglor))]);
  }

  services.forEach((service) => {
    const followUp = createTextMessage(FOLLOW_UP_TEXT);
    if (service.priceImages && service.priceImages.length) {
      table.set(service.actionText, [
        createFlexMessage(service.actionText, FlexMessageServicePrices({ imagePriceUrl: service.priceImages })),
        followUp,
      ]);
    } else {
      table.set(service.actionText, [followUp]);
    }
  });

  branches.filter((b) => b.enabled).forEach((branch) => {
    const trigger = scheduleTrigger(branch);
    table.set(branch.trigger, [
      createFlexMessage("สาขา" + branch.trigger, FlexMessageBranchMap({
        branchName: branch.displayName,
        fontSize: branch.fontSize,
        mapUrl: branch.mapUrl,
        imageUrl: branch.imageUrl,
        phoneNumber: branch.phoneNumber,
        lineId: branch.lineId,
        lineUrl: branch.lineUrl || "",
      })),
      createFlexMessage(trigger, FlexMessageIconTable({ messageText: trigger })),
    ]);
    if (branch.doctors && branch.doctors.length) {
      table.set(trigger, chunk(branch.doctors, MAX_BUBBLES).map((group) =>
        createFlexMessage(trigger, FlexMessageDoctorSchedules(group))));
    }
  });

  return table;
}

function createMessageTable(store, { logError = (msg) => console.error(msg) } = {}) {
  let table = build(store.getAll());
  function rebuild() {
    try {
      table = build(store.getAll());
    } catch (error) {
      logError(`messageTable: สร้างตารางใหม่ไม่สำเร็จ ใช้ตารางเดิมต่อ (${error.message})`);
    }
  }
  store.onChange(rebuild);
  return { getTable: () => table, rebuild };
}

module.exports = { build, createMessageTable, scheduleTrigger, FOLLOW_UP_TEXT, SCHEDULE_PREFIX, MAX_BUBBLES };
