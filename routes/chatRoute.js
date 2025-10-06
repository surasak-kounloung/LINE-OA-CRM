const express = require("express");
const line = require("@line/bot-sdk");
const axios = require("axios");
const dotEnv = require("dotenv").config();

const { FlexMessageServicesBubble } = require("../flexmessage/services");
const { FlexMessagePromotionBubble } = require("../flexmessage/promotion");
const { FlexMessageTableDoctorsBubble } = require("../flexmessage/tabledoctors");
const { FlexMessageBranchSiamBubble } = require("../flexmessage/branchSiam");
const { FlexMessageBranchCentralWorldBubble } = require("../flexmessage/branchCentralWorld");
const { FlexMessageBranchTerminalAsokeBubble } = require("../flexmessage/branchTerminalAsoke");
const { FlexMessageBranchRama9Bubble } = require("../flexmessage/branchRama9");
const { FlexMessageBranchEsplanadeRatchadaBubble } = require("../flexmessage/branchEsplanadeRatchada");
const { FlexMessageBranchCentralLadpraoBubble } = require("../flexmessage/branchCentralLadprao");
const { FlexMessageBranchMajorRatchayothinBubble } = require("../flexmessage/branchMajorRatchayothin");
const { FlexMessageBranchCentralRamindraBubble } = require("../flexmessage/branchCentralRamindra");
const { FlexMessageBranchTheMallNgamwongwanBubble } = require("../flexmessage/branchTheMallNgamwongwan");
const { FlexMessageBranchCentralEastvilleBubble } = require("../flexmessage/branchCentralEastville");
const { FlexMessageBranchThePromenadeBubble } = require("../flexmessage/branchThePromenade");
const { FlexMessageBranchTheMallBangkapiBubble } = require("../flexmessage/branchTheMallBangkapi");
const { FlexMessageBranchSeaconSrinakarinBubble } = require("../flexmessage/branchSeaconSrinakarin");
const { FlexMessageBranchMegaBangnaBubble } = require("../flexmessage/branchMegaBangna");
const { FlexMessageBranchCentralBangnaBubble } = require("../flexmessage/branchCentralBangna");
const { FlexMessageBranchOneBangkokBubble } = require("../flexmessage/branchOneBangkok");
const { FlexMessageBranchThonglorBubble } = require("../flexmessage/branchThonglor");
const { FlexMessageBranchGatewayEkamaiBubble } = require("../flexmessage/branchGatewayEkamai");
const { FlexMessageBranchCentralRama3Bubble } = require("../flexmessage/branchCentralRama3");
const { FlexMessageBranchFutureParkRangsitBubble } = require("../flexmessage/branchFutureParkRangsit");
const { FlexMessageBranchCentralWestvilleBubble } = require("../flexmessage/branchCentralWestville");
const { FlexMessageBranchCentralWestgateBubble } = require("../flexmessage/branchCentralWestgate");
const { FlexMessageBranchCentralChaengwattanaBubble } = require("../flexmessage/branchCentralChaengwattana");
const { FlexMessageBranchCentralSalayaBubble } = require("../flexmessage/branchCentralSalaya");
const { FlexMessageBranchCentralNakhonpathomBubble } = require("../flexmessage/branchCentralNakhonpathom");
const { FlexMessageBranchCentralMahachaiBubble } = require("../flexmessage/branchCentralMahachai");
const { FlexMessageBranchEmQuartierBubble } = require("../flexmessage/branchEmQuartier");
const { FlexMessageBranchCentralPinklaoBubble } = require("../flexmessage/branchCentralPinklao");
const { FlexMessageBranchTheMallThapraBubble } = require("../flexmessage/branchTheMallThapra");
const { FlexMessageBranchCentralRama2Bubble } = require("../flexmessage/branchCentralRama2");
const { FlexMessageBranchTheMallBangkaeBubble } = require("../flexmessage/branchTheMallBangkae");
const { FlexMessageBranchPaseoKanchanapisekBubble } = require("../flexmessage/branchPaseoKanchanapisek");


const { FlexMessageBranchSiamIconTableBubble } = require("../flexmessage/branchSiamIconTable");
const { FlexMessageBranchSiamDoctorsBubble } = require("../flexmessage/branchSiamDoctors");
const { FlexMessageBranchCentralWorldIconTableBubble } = require("../flexmessage/branchCentralWorldIconTable");
const { FlexMessageBranchCentralWorldDoctorsBubble } = require("../flexmessage/branchCentralWorldDoctors");
const { FlexMessageBranchTerminalAsokeIconTableBubble } = require("../flexmessage/branchTerminalAsokeIconTable");
const { FlexMessageBranchTerminalAsokeDoctorsBubble } = require("../flexmessage/branchTerminalAsokeDoctors");
const { FlexMessageBranchRama9IconTableBubble } = require("../flexmessage/branchRama9IconTable");
const { FlexMessageBranchRama9DoctorsBubble } = require("../flexmessage/branchRama9Doctors");
const { FlexMessageBranchRama9DoctorsBubble2 } = require("../flexmessage/branchRama9Doctors2");
const { FlexMessageBranchEsplanadeRatchadaIconTableBubble } = require("../flexmessage/branchEsplanadeRatchadaIconTable");
const { FlexMessageBranchEsplanadeRatchadaDoctorsBubble } = require("../flexmessage/branchEsplanadeRatchadaDoctors");
const { FlexMessageBranchCentralLadpraoIconTableBubble } = require("../flexmessage/branchCentralLadpraoIconTable");
const { FlexMessageBranchCentralLadpraoDoctorsBubble } = require("../flexmessage/branchCentralLadpraoDoctors");
const { FlexMessageBranchMajorRatchayothinIconTableBubble } = require("../flexmessage/branchMajorRatchayothinIconTable");
const { FlexMessageBranchMajorRatchayothinDoctorsBubble } = require("../flexmessage/branchMajorRatchayothinDoctors");
const { FlexMessageBranchCentralRamindraIconTableBubble } = require("../flexmessage/branchCentralRamindraIconTable");
const { FlexMessageBranchCentralRamindraDoctorsBubble } = require("../flexmessage/branchCentralRamindraDoctors");
const { FlexMessageBranchTheMallNgamwongwanIconTableBubble } = require("../flexmessage/branchTheMallNgamwongwanIconTable");
const { FlexMessageBranchTheMallNgamwongwanDoctorsBubble } = require("../flexmessage/branchTheMallNgamwongwanDoctors");
const { FlexMessageBranchCentralEastvilleIconTableBubble } = require("../flexmessage/branchCentralEastvilleIconTable");
const { FlexMessageBranchCentralEastvilleDoctorsBubble } = require("../flexmessage/branchCentralEastvilleDoctors");
const { FlexMessageBranchThePromenadeIconTableBubble } = require("../flexmessage/branchThePromenadeIconTable");
const { FlexMessageBranchThePromenadeDoctorsBubble } = require("../flexmessage/branchThePromenadeDoctors");
const { FlexMessageBranchTheMallBangkapiIconTableBubble } = require("../flexmessage/branchTheMallBangkapiIconTable");
const { FlexMessageBranchTheMallBangkapiDoctorsBubble } = require("../flexmessage/branchTheMallBangkapiDoctors");
const { FlexMessageBranchSeaconSrinakarinIconTableBubble } = require("../flexmessage/branchSeaconSrinakarinIconTable");
const { FlexMessageBranchSeaconSrinakarinDoctorsBubble } = require("../flexmessage/branchSeaconSrinakarinDoctors");
const { FlexMessageBranchMegaBangnaIconTableBubble } = require("../flexmessage/branchMegaBangnaIconTable");
const { FlexMessageBranchMegaBangnaDoctorsBubble } = require("../flexmessage/branchMegaBangnaDoctors");
const { FlexMessageBranchCentralBangnaIconTableBubble } = require("../flexmessage/branchCentralBangnaIconTable");
const { FlexMessageBranchCentralBangnaDoctorsBubble } = require("../flexmessage/branchCentralBangnaDoctors");
const { FlexMessageBranchOneBangkokIconTableBubble } = require("../flexmessage/branchOneBangkokIconTable");
const { FlexMessageBranchOneBangkokDoctorsBubble } = require("../flexmessage/branchOneBangkokDoctors");
const { FlexMessageBranchThonglorIconTableBubble } = require("../flexmessage/branchThonglorIconTable");
const { FlexMessageBranchThonglorDoctorsBubble } = require("../flexmessage/branchThonglorDoctors");
const { FlexMessageBranchThonglorDoctorsBubble2 } = require("../flexmessage/branchThonglorDoctors2");
const { FlexMessageBranchGatewayEkamaiIconTableBubble } = require("../flexmessage/branchGatewayEkamaiIconTable");
const { FlexMessageBranchGatewayEkamaiDoctorsBubble } = require("../flexmessage/branchGatewayEkamaiDoctors");
const { FlexMessageBranchCentralRama3IconTableBubble } = require("../flexmessage/branchCentralRama3IconTable");
const { FlexMessageBranchCentralRama3DoctorsBubble } = require("../flexmessage/branchCentralRama3Doctors");
const { FlexMessageBranchFutureParkRangsitIconTableBubble } = require("../flexmessage/branchFutureParkRangsitIconTable");
const { FlexMessageBranchFutureParkRangsitDoctorsBubble } = require("../flexmessage/branchFutureParkRangsitDoctors");
const { FlexMessageBranchCentralWestvilleIconTableBubble } = require("../flexmessage/branchCentralWestvilleIconTable");
const { FlexMessageBranchCentralWestvilleDoctorsBubble } = require("../flexmessage/branchCentralWestvilleDoctors");
const { FlexMessageBranchCentralWestgateIconTableBubble } = require("../flexmessage/branchCentralWestgateIconTable");
const { FlexMessageBranchCentralWestgateDoctorsBubble } = require("../flexmessage/branchCentralWestgateDoctors");
const { FlexMessageBranchCentralChaengwattanaIconTableBubble } = require("../flexmessage/branchCentralChaengwattanaIconTable");
const { FlexMessageBranchCentralChaengwattanaDoctorsBubble } = require("../flexmessage/branchCentralChaengwattanaDoctors");
const { FlexMessageBranchCentralSalayaIconTableBubble } = require("../flexmessage/branchCentralSalayaIconTable");
const { FlexMessageBranchCentralSalayaDoctorsBubble } = require("../flexmessage/branchCentralSalayaDoctors");
const { FlexMessageBranchCentralNakhonpathomIconTableBubble } = require("../flexmessage/branchCentralNakhonpathomIconTable");
const { FlexMessageBranchCentralNakhonpathomDoctorsBubble } = require("../flexmessage/branchCentralNakhonpathomDoctors");
const { FlexMessageBranchCentralMahachaiIconTableBubble } = require("../flexmessage/branchCentralMahachaiIconTable");
const { FlexMessageBranchCentralMahachaiDoctorsBubble } = require("../flexmessage/branchCentralMahachaiDoctors");
const { FlexMessageBranchEmQuartierIconTableBubble } = require("../flexmessage/branchEmQuartierIconTable");
const { FlexMessageBranchEmQuartierDoctorsBubble } = require("../flexmessage/branchEmQuartierDoctors");
const { FlexMessageBranchCentralPinklaoIconTableBubble } = require("../flexmessage/branchCentralPinklaoIconTable");
const { FlexMessageBranchCentralPinklaoDoctorsBubble } = require("../flexmessage/branchCentralPinklaoDoctors");
const { FlexMessageBranchTheMallThapraIconTableBubble } = require("../flexmessage/branchTheMallThapraIconTable");
const { FlexMessageBranchTheMallThapraDoctorsBubble } = require("../flexmessage/branchTheMallThapraDoctors");
const { FlexMessageBranchCentralRama2IconTableBubble } = require("../flexmessage/branchCentralRama2IconTable");
const { FlexMessageBranchCentralRama2DoctorsBubble } = require("../flexmessage/branchCentralRama2Doctors");
const { FlexMessageBranchTheMallBangkaeIconTableBubble } = require("../flexmessage/branchTheMallBangkaeIconTable");
const { FlexMessageBranchTheMallBangkaeDoctorsBubble } = require("../flexmessage/branchTheMallBangkaeDoctors");
const { FlexMessageBranchPaseoKanchanapisekIconTableBubble } = require("../flexmessage/branchPaseoKanchanapisekIconTable");
const { FlexMessageBranchPaseoKanchanapisekDoctorsBubble } = require("../flexmessage/branchPaseoKanchanapisekDoctors");


const router = express.Router();

const lineConfig = {
  channelAccessToken: process.env.LINE_CHANNEL_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET,
};

// URL ปลายทางสำหรับส่งต่อข้อมูล
const forwardUrl = process.env.FORWARD_WEBHOOK_URL;
const processLocally = process.env.FORWARD_WEBHOOK_URL_PROCESS === "true";

router.post("/", line.middleware(lineConfig), async (req, res) => {
  try {
    let forwardPromise = Promise.resolve(null);

    // ตรวจสอบเงื่อนไข processLocally เพื่อตัดสินใจว่าจะส่งข้อมูลไป URL ปลายทางหรือไม่
    if (processLocally === true && forwardUrl) {
      forwardPromise = axios.post(forwardUrl, req.body, {
        headers: {
          'Content-Type': 'application/json'
        }
      })
        .then(response => {
          console.log("ส่งต่อข้อมูลสำเร็จ:", response.status);
          return response;
        })
        .catch(error => {
          console.error("เกิดข้อผิดพลาดในการส่งต่อข้อมูล:", error.message);
          return null;
        });
    }

    let handlePromise = Promise.resolve(null);

    handlePromise = Promise.all(req.body.events.map(handleEvents))
      .then(result => {
        return result;
      })
      .catch(error => {
        console.error(err);
        res.status(500).end();
      });

    const [forwardResult, handleResult] = await Promise.all([forwardPromise, handlePromise]);

    if (handleResult) {
      res.json(handleResult);
    } else {
      res.json(handleResult);
    }
  } catch (error) {
    console.error("เกิดข้อผิดพลาดในการดำเนินการ:", error.message);
    res.status(500).end();
  }
});

const createFlexMessage = (altText, bubble) => ({
  type: "flex",
  altText,
  contents: bubble,
});

const singleFlexMap = {
  // เมนูหลัก
  "บริการทั้งหมด": () => createFlexMessage("บริการทั้งหมด", FlexMessageServicesBubble()),
  "โปรโมชั่นล่าสุด": () => createFlexMessage("โปรโมชั่นล่าสุด", FlexMessagePromotionBubble()),
  "ตารางแพทย์": () => createFlexMessage("ตารางแพทย์", FlexMessageTableDoctorsBubble()),

  // ตารางแพทย์ตามสาขา
  "สอบถามตารางแพทย์ สาขาสยาม สแควร์ วัน": () => createFlexMessage(
    "สอบถามตารางแพทย์ สาขาสยาม สแควร์ วัน",
    FlexMessageBranchSiamDoctorsBubble()
  ),
  "สอบถามตารางแพทย์ สาขาเซ็นทรัล เวิล์ด": () => createFlexMessage(
    "สอบถามตารางแพทย์ สาขาเซ็นทรัล เวิล์ด",
    FlexMessageBranchCentralWorldDoctorsBubble()
  ),
  "สอบถามตารางแพทย์ สาขาเทอร์มินอล อโศก": () => createFlexMessage(
    "สอบถามตารางแพทย์ สาขาเทอร์มินอล อโศก",
    FlexMessageBranchTerminalAsokeDoctorsBubble()
  ),
  // "สอบถามตารางแพทย์ สาขาพระราม 9": () => createFlexMessage(
  //   "สอบถามตารางแพทย์ สาขาพระราม 9",
  //   FlexMessageBranchRama9DoctorsBubble()
  // ),
  "สอบถามตารางแพทย์ สาขาเอสพลานาด รัชดาภิเษก": () => createFlexMessage(
    "สอบถามตารางแพทย์ สาขาเอสพลานาด รัชดาภิเษก",
    FlexMessageBranchEsplanadeRatchadaDoctorsBubble()
  ),
  "สอบถามตารางแพทย์ สาขาเซ็นทรัล ลาดพร้าว": () => createFlexMessage(
    "สอบถามตารางแพทย์ สาขาเซ็นทรัล ลาดพร้าว",
    FlexMessageBranchCentralLadpraoDoctorsBubble()
  ),
  "สอบถามตารางแพทย์ สาขาเมเจอร์ รัชโยธิน": () => createFlexMessage(
    "สอบถามตารางแพทย์ สาขาเมเจอร์ รัชโยธิน",
    FlexMessageBranchMajorRatchayothinDoctorsBubble()
  ),
  "สอบถามตารางแพทย์ สาขาเซ็นทรัล รามอินทรา": () => createFlexMessage(
    "สอบถามตารางแพทย์ สาขาเซ็นทรัล รามอินทรา",
    FlexMessageBranchCentralRamindraDoctorsBubble()
  ),
  "สอบถามตารางแพทย์ สาขาเดอะมอลล์ งามวงศ์วาน": () => createFlexMessage(
    "สอบถามตารางแพทย์ สาขาเดอะมอลล์ งามวงศ์วาน",
    FlexMessageBranchTheMallNgamwongwanDoctorsBubble()
  ),
  "สอบถามตารางแพทย์ สาขาเซ็นทรัล อีสวิลล์": () => createFlexMessage(
    "สอบถามตารางแพทย์ สาขาเซ็นทรัล อีสวิลล์",
    FlexMessageBranchCentralEastvilleDoctorsBubble()
  ),
  "สอบถามตารางแพทย์ สาขาเดอะ พรอมานาด": () => createFlexMessage(
    "สอบถามตารางแพทย์ สาขาเดอะ พรอมานาด",
    FlexMessageBranchThePromenadeDoctorsBubble()
  ),
  "สอบถามตารางแพทย์ สาขาเดอะมอลล์ บางกะปิ": () => createFlexMessage(
    "สอบถามตารางแพทย์ สาขาเดอะมอลล์ บางกะปิ",
    FlexMessageBranchTheMallBangkapiDoctorsBubble()
  ),
  "สอบถามตารางแพทย์ สาขาซีคอน สแควร์ ศรีนครินทร์": () => createFlexMessage(
    "สอบถามตารางแพทย์ สาขาซีคอน สแควร์ ศรีนครินทร์",
    FlexMessageBranchSeaconSrinakarinDoctorsBubble()
  ),
  "สอบถามตารางแพทย์ สาขาเมกา บางนา": () => createFlexMessage(
    "สอบถามตารางแพทย์ สาขาเมกา บางนา",
    FlexMessageBranchMegaBangnaDoctorsBubble()
  ),
  "สอบถามตารางแพทย์ สาขาเซ็นทรัล บางนา": () => createFlexMessage(
    "สอบถามตารางแพทย์ สาขาเซ็นทรัล บางนา",
    FlexMessageBranchCentralBangnaDoctorsBubble()
  ),
  "สอบถามตารางแพทย์ สาขาวัน แบงค็อก": () => createFlexMessage(
    "สอบถามตารางแพทย์ สาขาวัน แบงค็อก",
    FlexMessageBranchOneBangkokDoctorsBubble()
  ),
  // "สอบถามตารางแพทย์ สาขาทองหล่อ": () => createFlexMessage(
  //   "สอบถามตารางแพทย์ สาขาทองหล่อ",
  //   FlexMessageBranchThonglorDoctorsBubble()
  // ),
  "สอบถามตารางแพทย์ สาขาเอ็มควอเทียร์": () => createFlexMessage(
    "สอบถามตารางแพทย์ สาขาเอ็มควอเทียร์",
    FlexMessageBranchEmQuartierDoctorsBubble()
  ),
  "สอบถามตารางแพทย์ สาขาเกตเวย์ เอกมัย": () => createFlexMessage(
    "สอบถามตารางแพทย์ สาขาเกตเวย์ เอกมัย",
    FlexMessageBranchGatewayEkamaiDoctorsBubble()
  ),
  "สอบถามตารางแพทย์ สาขาเซ็นทรัล พระราม 3": () => createFlexMessage(
    "สอบถามตารางแพทย์ สาขาเซ็นทรัล พระราม 3",
    FlexMessageBranchCentralRama3DoctorsBubble()
  ),
  "สอบถามตารางแพทย์ สาขาฟิวเจอร์พาร์ค รังสิต": () => createFlexMessage(
    "สอบถามตารางแพทย์ สาขาฟิวเจอร์พาร์ค รังสิต",
    FlexMessageBranchFutureParkRangsitDoctorsBubble()
  ),
  "สอบถามตารางแพทย์ สาขาเซ็นทรัล เวสต์วิลล์": () => createFlexMessage(
    "สอบถามตารางแพทย์ สาขาเซ็นทรัล เวสต์วิลล์",
    FlexMessageBranchCentralWestvilleDoctorsBubble()
  ),
  "สอบถามตารางแพทย์ สาขาเซ็นทรัล เวสต์เกต": () => createFlexMessage(
    "สอบถามตารางแพทย์ สาขาเซ็นทรัล เวสต์เกต",
    FlexMessageBranchCentralWestgateDoctorsBubble()
  ),
  "สอบถามตารางแพทย์ สาขาเซ็นทรัล แจ้งวัฒนะ": () => createFlexMessage(
    "สอบถามตารางแพทย์ สาขาเซ็นทรัล แจ้งวัฒนะ",
    FlexMessageBranchCentralChaengwattanaDoctorsBubble()
  ),
  "สอบถามตารางแพทย์ สาขาเซ็นทรัล ศาลายา": () => createFlexMessage(
    "สอบถามตารางแพทย์ สาขาเซ็นทรัล ศาลายา",
    FlexMessageBranchCentralSalayaDoctorsBubble()
  ),
  "สอบถามตารางแพทย์ สาขาเซ็นทรัล นครปฐม": () => createFlexMessage(
    "สอบถามตารางแพทย์ สาขาเซ็นทรัล นครปฐม",
    FlexMessageBranchCentralNakhonpathomDoctorsBubble()
  ),
  "สอบถามตารางแพทย์ สาขาเซ็นทรัล มหาชัย": () => createFlexMessage(
    "สอบถามตารางแพทย์ สาขาเซ็นทรัล มหาชัย",
    FlexMessageBranchCentralMahachaiDoctorsBubble()
  ),
  "สอบถามตารางแพทย์ สาขาเซ็นทรัล ปิ่นเกล้า": () => createFlexMessage(
    "สอบถามตารางแพทย์ สาขาเซ็นทรัล ปิ่นเกล้า",
    FlexMessageBranchCentralPinklaoDoctorsBubble()
  ),
  "สอบถามตารางแพทย์ สาขาเดอะมอลล์ ท่าพระ": () => createFlexMessage(
    "สอบถามตารางแพทย์ สาขาเดอะมอลล์ ท่าพระ",
    FlexMessageBranchTheMallThapraDoctorsBubble()
  ),
  "สอบถามตารางแพทย์ สาขาเซ็นทรัล พระราม 2": () => createFlexMessage(
    "สอบถามตารางแพทย์ สาขาเซ็นทรัล พระราม 2",
    FlexMessageBranchCentralRama2DoctorsBubble()
  ),
  "สอบถามตารางแพทย์ สาขาเดอะมอลล์ บางแค": () => createFlexMessage(
    "สอบถามตารางแพทย์ สาขาเดอะมอลล์ บางแค",
    FlexMessageBranchTheMallBangkaeDoctorsBubble()
  ),
  "สอบถามตารางแพทย์ สาขาพาซิโอ กาญจนา": () => createFlexMessage(
    "สอบถามตารางแพทย์ สาขาพาซิโอ กาญจนา",
    FlexMessageBranchPaseoKanchanapisekDoctorsBubble()
  ),
};



// กลุ่มข้อความสาขาที่ตอบกลับเป็น 2 ข้อความ (ข้อมูลสาขา + ปุ่มไอคอนตารางแพทย์)
const branchMenuMap = {
  "สยาม สแควร์ วัน": () => [
    createFlexMessage("สาขาสยาม สแควร์ วัน", FlexMessageBranchSiamBubble()),
    createFlexMessage(
      "สอบถามตารางแพทย์ สาขาสยาม สแควร์ วัน",
      FlexMessageBranchSiamIconTableBubble()
    ),
  ],
  "เซ็นทรัล เวิล์ด": () => [
    createFlexMessage("สาขาเซ็นทรัล เวิล์ด", FlexMessageBranchCentralWorldBubble()),
    createFlexMessage(
      "สอบถามตารางแพทย์ สาขาเซ็นทรัล เวิล์ด",
      FlexMessageBranchCentralWorldIconTableBubble()
    ),
  ],
  "เทอร์มินอล อโศก": () => [
    createFlexMessage("สาขาเทอร์มินอล อโศก", FlexMessageBranchTerminalAsokeBubble()),
    createFlexMessage(
      "สอบถามตารางแพทย์ สาขาเทอร์มินอล อโศก",
      FlexMessageBranchTerminalAsokeIconTableBubble()
    ),
  ],
  "พระราม 9": () => [
    createFlexMessage("สาขาพระราม 9", FlexMessageBranchRama9Bubble()),
    createFlexMessage(
      "สอบถามตารางแพทย์ สาขาพระราม 9",
      FlexMessageBranchRama9IconTableBubble()
    ),
  ],
  "สอบถามตารางแพทย์ สาขาพระราม 9": () => [
    createFlexMessage("สอบถามตารางแพทย์ สาขาพระราม 9", FlexMessageBranchRama9DoctorsBubble()),
    createFlexMessage(
      "สอบถามตารางแพทย์ สาขาพระราม 9",
      FlexMessageBranchRama9DoctorsBubble2()
    ),
  ],
  "เอสพลานาด รัชดาภิเษก": () => [
    createFlexMessage("สาขาเอสพลานาด รัชดาภิเษก", FlexMessageBranchEsplanadeRatchadaBubble()),
    createFlexMessage(
      "สอบถามตารางแพทย์ สาขาเอสพลานาด รัชดาภิเษก",
      FlexMessageBranchEsplanadeRatchadaIconTableBubble()
    ),
  ],
  "เซ็นทรัล ลาดพร้าว": () => [
    createFlexMessage("สาขาเซ็นทรัล ลาดพร้าว", FlexMessageBranchCentralLadpraoBubble()),
    createFlexMessage(
      "สอบถามตารางแพทย์ สาขาเซ็นทรัล ลาดพร้าว",
      FlexMessageBranchCentralLadpraoIconTableBubble()
    ),
  ],
  "เมเจอร์ รัชโยธิน": () => [
    createFlexMessage("สาขาเมเจอร์ รัชโยธิน", FlexMessageBranchMajorRatchayothinBubble()),
    createFlexMessage(
      "สอบถามตารางแพทย์ สาขาเมเจอร์ รัชโยธิน",
      FlexMessageBranchMajorRatchayothinIconTableBubble()
    ),
  ],
  "เซ็นทรัล รามอินทรา": () => [
    createFlexMessage("สาขาเซ็นทรัล รามอินทรา", FlexMessageBranchCentralRamindraBubble()),
    createFlexMessage(
      "สอบถามตารางแพทย์ สาขาเซ็นทรัล รามอินทรา",
      FlexMessageBranchCentralRamindraIconTableBubble()
    ),
  ],
  "เดอะมอลล์ งามวงศ์วาน": () => [
    createFlexMessage("สาขาเดอะมอลล์ งามวงศ์วาน", FlexMessageBranchTheMallNgamwongwanBubble()),
    createFlexMessage(
      "สอบถามตารางแพทย์ สาขาเดอะมอลล์ งามวงศ์วาน",
      FlexMessageBranchTheMallNgamwongwanIconTableBubble()
    ),
  ],
  "เซ็นทรัล อีสวิลล์": () => [
    createFlexMessage("สาขาเซ็นทรัล อีสวิลล์", FlexMessageBranchCentralEastvilleBubble()),
    createFlexMessage(
      "สอบถามตารางแพทย์ สาขาเซ็นทรัล อีสวิลล์",
      FlexMessageBranchCentralEastvilleIconTableBubble()
    ),
  ],
  "เดอะ พรอมานาด": () => [
    createFlexMessage("สาขาเดอะ พรอมานาด", FlexMessageBranchThePromenadeBubble()),
    createFlexMessage(
      "สอบถามตารางแพทย์ สาขาเดอะ พรอมานาด",
      FlexMessageBranchThePromenadeIconTableBubble()
    ),
  ],
  "เดอะมอลล์ บางกะปิ": () => [
    createFlexMessage("สาขาเดอะมอลล์ บางกะปิ", FlexMessageBranchTheMallBangkapiBubble()),
    createFlexMessage(
      "สอบถามตารางแพทย์ สาขาเดอะมอลล์ บางกะปิ",
      FlexMessageBranchTheMallBangkapiIconTableBubble()
    ),
  ],
  "ซีคอน สแควร์ ศรีนครินทร์": () => [
    createFlexMessage("สาขาซีคอน สแควร์ ศรีนครินทร์", FlexMessageBranchSeaconSrinakarinBubble()),
    createFlexMessage(
      "สอบถามตารางแพทย์ สาขาซีคอน สแควร์ ศรีนครินทร์",
      FlexMessageBranchSeaconSrinakarinIconTableBubble()
    ),
  ],
  "เมกา บางนา": () => [
    createFlexMessage("สาขาเมกา บางนา", FlexMessageBranchMegaBangnaBubble()),
    createFlexMessage(
      "สอบถามตารางแพทย์ สาขาเมกา บางนา",
      FlexMessageBranchMegaBangnaIconTableBubble()
    ),
  ],
  "เซ็นทรัล บางนา": () => [
    createFlexMessage("สาขาเซ็นทรัล บางนา", FlexMessageBranchCentralBangnaBubble()),
    createFlexMessage(
      "สอบถามตารางแพทย์ สาขาเซ็นทรัล บางนา",
      FlexMessageBranchCentralBangnaIconTableBubble()
    ),
  ],
  "วัน แบงค็อก": () => [
    createFlexMessage("สาขาวัน แบงค็อก", FlexMessageBranchOneBangkokBubble()),
    createFlexMessage(
      "สอบถามตารางแพทย์ สาขาวัน แบงค็อก",
      FlexMessageBranchOneBangkokIconTableBubble()
    ),
  ],
  "ทองหล่อ": () => [
    createFlexMessage("สาขาทองหล่อ", FlexMessageBranchThonglorBubble()),
    createFlexMessage(
      "สอบถามตารางแพทย์ สาขาทองหล่อ",
      FlexMessageBranchThonglorIconTableBubble()
    ),
  ],
  "สอบถามตารางแพทย์ สาขาทองหล่อ": () => [
    createFlexMessage("สาขาทองหล่อ", FlexMessageBranchThonglorDoctorsBubble()),
    createFlexMessage(
      "สอบถามตารางแพทย์ สาขาทองหล่อ",
      FlexMessageBranchThonglorDoctorsBubble2()
    ),
  ],
  "เอ็มควอเทียร์": () => [
    createFlexMessage("สาขาเอ็มควอเทียร์", FlexMessageBranchEmQuartierBubble()),
    createFlexMessage(
      "สอบถามตารางแพทย์ สาขาเอ็มควอเทียร์",
      FlexMessageBranchEmQuartierIconTableBubble()
    ),
  ],
  "เกตเวย์ เอกมัย": () => [
    createFlexMessage("สาขาเกตเวย์ เอกมัย", FlexMessageBranchGatewayEkamaiBubble()),
    createFlexMessage(
      "สอบถามตารางแพทย์ สาขาเกตเวย์ เอกมัย",
      FlexMessageBranchGatewayEkamaiIconTableBubble()
    ),
  ],
  "เซ็นทรัล พระราม 3": () => [
    createFlexMessage("สาขาเซ็นทรัล พระราม 3", FlexMessageBranchCentralRama3Bubble()),
    createFlexMessage(
      "สอบถามตารางแพทย์ สาขาเซ็นทรัล พระราม 3",
      FlexMessageBranchCentralRama3IconTableBubble()
    ),
  ],
  "ฟิวเจอร์พาร์ค รังสิต": () => [
    createFlexMessage("สาขาฟิวเจอร์พาร์ค รังสิต", FlexMessageBranchFutureParkRangsitBubble()),
    createFlexMessage(
      "สอบถามตารางแพทย์ สาขาฟิวเจอร์พาร์ค รังสิต",
      FlexMessageBranchFutureParkRangsitIconTableBubble()
    ),
  ],
  "เซ็นทรัล เวสต์วิลล์": () => [
    createFlexMessage("สาขาเซ็นทรัล เวสต์วิลล์", FlexMessageBranchCentralWestvilleBubble()),
    createFlexMessage(
      "สอบถามตารางแพทย์ สาขาเซ็นทรัล เวสต์วิลล์",
      FlexMessageBranchCentralWestvilleIconTableBubble()
    ),
  ],
  "เซ็นทรัล เวสต์เกต": () => [
    createFlexMessage("สาขาเซ็นทรัล เวสต์เกต", FlexMessageBranchCentralWestgateBubble()),
    createFlexMessage(
      "สอบถามตารางแพทย์ สาขาเซ็นทรัล เวสต์เกต",
      FlexMessageBranchCentralWestgateIconTableBubble()
    ),
  ],
  "เซ็นทรัล แจ้งวัฒนะ": () => [
    createFlexMessage("สาขาเซ็นทรัล แจ้งวัฒนะ", FlexMessageBranchCentralChaengwattanaBubble()),
    createFlexMessage(
      "สอบถามตารางแพทย์ สาขาเซ็นทรัล แจ้งวัฒนะ",
      FlexMessageBranchCentralChaengwattanaIconTableBubble()
    ),
  ],
  "เซ็นทรัล ศาลายา": () => [
    createFlexMessage("สาขาเซ็นทรัล ศาลายา", FlexMessageBranchCentralSalayaBubble()),
    createFlexMessage(
      "สอบถามตารางแพทย์ สาขาเซ็นทรัล ศาลายา",
      FlexMessageBranchCentralSalayaIconTableBubble()
    ),
  ],
  "เซ็นทรัล นครปฐม": () => [
    createFlexMessage("สาขาเซ็นทรัล นครปฐม", FlexMessageBranchCentralNakhonpathomBubble()),
    createFlexMessage(
      "สอบถามตารางแพทย์ สาขาเซ็นทรัล นครปฐม",
      FlexMessageBranchCentralNakhonpathomIconTableBubble()
    ),
  ],
  "เซ็นทรัล มหาชัย": () => [
    createFlexMessage("สาขาเซ็นทรัล มหาชัย", FlexMessageBranchCentralMahachaiBubble()),
    createFlexMessage(
      "สอบถามตารางแพทย์ สาขาเซ็นทรัล มหาชัย",
      FlexMessageBranchCentralMahachaiIconTableBubble()
    ),
  ],
  "เซ็นทรัล ปิ่นเกล้า": () => [
    createFlexMessage("สาขาเซ็นทรัล ปิ่นเกล้า", FlexMessageBranchCentralPinklaoBubble()),
    createFlexMessage(
      "สอบถามตารางแพทย์ สาขาเซ็นทรัล ปิ่นเกล้า",
      FlexMessageBranchCentralPinklaoIconTableBubble()
    ),
  ],
  "เดอะมอลล์ ท่าพระ": () => [
    createFlexMessage("สาขาเดอะมอลล์ ท่าพระ", FlexMessageBranchTheMallThapraBubble()),
    createFlexMessage(
      "สอบถามตารางแพทย์ สาขาเดอะมอลล์ ท่าพระ",
      FlexMessageBranchTheMallThapraIconTableBubble()
    ),
  ],
  "เซ็นทรัล พระราม 2": () => [
    createFlexMessage("สาขาเซ็นทรัล พระราม 2", FlexMessageBranchCentralRama2Bubble()),
    createFlexMessage(
      "สอบถามตารางแพทย์ สาขาเซ็นทรัล พระราม 2",
      FlexMessageBranchCentralRama2IconTableBubble()
    ),
  ],
  "เดอะมอลล์ บางแค": () => [
    createFlexMessage("สาขาเดอะมอลล์ บางแค", FlexMessageBranchTheMallBangkaeBubble()),
    createFlexMessage(
      "สอบถามตารางแพทย์ สาขาเดอะมอลล์ บางแค",
      FlexMessageBranchTheMallBangkaeIconTableBubble()
    ),
  ],
  "พาซิโอ กาญจนา": () => [
    createFlexMessage("สาขาพาซิโอ กาญจนา", FlexMessageBranchPaseoKanchanapisekBubble()),
    createFlexMessage(
      "สอบถามตารางแพทย์ สาขาพาซิโอ กาญจนา",
      FlexMessageBranchPaseoKanchanapisekIconTableBubble()
    ),
  ],
};

const handleEvents = async (event) => {
  try {

    if (event.type !== 'message' || event.message.type !== 'text') {
      return null;
    }

    const messageUser = event.message.text;
    const client = new line.Client(lineConfig);
    const singleBuilder = singleFlexMap[messageUser];
    if (singleBuilder) {
      await client.replyMessage(event.replyToken, singleBuilder());
      return;
    }

    const branchBuilder = branchMenuMap[messageUser];
    if (branchBuilder) {
      await client.replyMessage(event.replyToken, branchBuilder());
      return;
    }

    return null;
  } catch (error) {
    console.error("เกิดข้อผิดพลาดในการจัดการอีเวนต์:", error);
    return null;
  }
};

module.exports = router;
