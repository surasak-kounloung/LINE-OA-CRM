const express = require("express");
const line = require("@line/bot-sdk");
const axios = require("axios");
const dotEnv = require("dotenv").config();

const { FlexMessageBranchMap } = require("../flexmessage/flexMessageBranchMap");
const { FlexMessageIconTable } = require("../flexmessage/flexMessageIconTable");
const { FlexMessageDoctorSchedules } = require("../flexmessage/flexMessageDoctorSchedules");
const { FlexMessageServicePrices } = require("../flexmessage/flexMessageServicePrices");

// นำเข้าไฟล์เมนูหลัก
const { FlexMessageServicesBubble } = require("../flexmessage/services");
const { FlexMessagePromotionBubble } = require("../flexmessage/promotion");
const { FlexMessageTableDoctorsBubble } = require("../flexmessage/tabledoctors");
const { FlexMessageTableDoctorsThonglorBubble } = require("../flexmessage/tabledoctorsThonglor");

// นำเข้าไฟล์ข้อมูลตารางแพทย์แต่ละสาขา
const { siamDoctorSchedules } = require("../flexmessage/doctorSiamSchedulesData");
const { gatewayEkamaiDoctorSchedules } = require("../flexmessage/doctorGatewayEkamaiSchedulesData");
const { centralLadpraoDoctorSchedules } = require("../flexmessage/doctorCentralLadpraoSchedulesData");
const { majorRatchayothinDoctorSchedules } = require("../flexmessage/doctorMajorRatchayothinSchedulesData");
const { futureParkRangsitDoctorSchedules } = require("../flexmessage/doctorFutureParkRangsitSchedulesData");
const { centralChaengwattanaDoctorSchedules } = require("../flexmessage/doctorCentralChaengwattanaSchedulesData");
const { centralBangnaDoctorSchedules } = require("../flexmessage/doctorCentralBangnaSchedulesData");
const { seaconSrinakarinDoctorSchedules } = require("../flexmessage/doctorSeaconSrinakarinSchedulesData");
const { centralPinklaoDoctorSchedules } = require("../flexmessage/doctorCentralPinklaoSchedulesData");
const { centralRama2DoctorSchedules } = require("../flexmessage/doctorCentralRama2SchedulesData");
const { centralEastvilleDoctorSchedules } = require("../flexmessage/doctorCentralEastvilleSchedulesData");
const { thePromenadeDoctorSchedules } = require("../flexmessage/doctorThePromenadeSchedulesData");
const { theMallBangkapiDoctorSchedules } = require("../flexmessage/doctorTheMallBangkapiSchedulesData");
const { paseoKanchanapisekDoctorSchedules } = require("../flexmessage/doctorPaseoKanchanapisekSchedulesData");
const { centralRama3DoctorSchedules } = require("../flexmessage/doctorCentralRama3SchedulesData");
const { centralWestgateDoctorSchedules } = require("../flexmessage/doctorCentralWestgateSchedulesData");
const { theMallBangkaeDoctorSchedules } = require("../flexmessage/doctorTheMallBangkaeSchedulesData");
const { emQuartierDoctorSchedules } = require("../flexmessage/doctorEmQuartierSchedulesData");
const { theMallThapraDoctorSchedules } = require("../flexmessage/doctorTheMallThapraSchedulesData");
const { centralRamindraDoctorSchedules } = require("../flexmessage/doctorCentralRamindraSchedulesData");
const { terminalAsokeDoctorSchedules } = require("../flexmessage/doctorTerminalAsokeSchedulesData");
const { centralSalayaDoctorSchedules } = require("../flexmessage/doctorCentralSalayaSchedulesData");
const { centralWestvilleDoctorSchedules } = require("../flexmessage/doctorCentralWestvilleSchedulesData");
const { centralNakhonpathomDoctorSchedules } = require("../flexmessage/doctorCentralNakhonpathomSchedulesData");
const { rama9DoctorSchedules } = require("../flexmessage/doctorRama9SchedulesData");
const { rama9DoctorSchedules2 } = require("../flexmessage/doctorRama9SchedulesData2");
const { megaBangnaDoctorSchedules } = require("../flexmessage/doctorMegaBangnaSchedulesData");
const { centralMahachaiDoctorSchedules } = require("../flexmessage/doctorCentralMahachaiSchedulesData");
const { centralWorldDoctorSchedules } = require("../flexmessage/doctorCentralWorldSchedulesData");
const { oneBangkokDoctorSchedules } = require("../flexmessage/doctorOneBangkokSchedulesData");
const { esplanadeRatchadaDoctorSchedules } = require("../flexmessage/doctorEsplanadeRatchadaSchedulesData");
const { theMallNgamwongwanDoctorSchedules } = require("../flexmessage/doctorTheMallNgamwongwanSchedulesData");
const { thonglorDoctorSchedules } = require("../flexmessage/doctorThongLorSchedulesData");
const { thonglorDoctorSchedules2 } = require("../flexmessage/doctorThongLorSchedulesData2");
const { thonglorLaserDoctorSchedules } = require("../flexmessage/doctorThongLorLaserSchedulesData");
const { thonglorWellnessDoctorSchedules } = require("../flexmessage/doctorThongLorWellnessSchedulesData");
const { dusitCentralParkDoctorSchedules } = require("../flexmessage/doctorDusitCentralParkSchedulesData");
const { liabDuanDoctorSchedules } = require("../flexmessage/doctorLiabduanSchedulesData");

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

// ตรวจสอบคำและสร้างข้อความตอบกลับ
const flexMessage = {
  // เมนูหลัก
  "บริการทั้งหมด": () => [ createFlexMessage("บริการทั้งหมด", FlexMessageServicesBubble()) ],
  "โปรโมชั่นล่าสุด": () => [ createFlexMessage("โปรโมชั่นล่าสุด", FlexMessagePromotionBubble()) ],
  "ตารางแพทย์": () => [ createFlexMessage("ตารางแพทย์", FlexMessageTableDoctorsBubble()) ],
  "ตารางแพทย์สาขาทองหล่อ": () => [ createFlexMessage("ตารางแพทย์สาขาทองหล่อ", FlexMessageTableDoctorsThonglorBubble()) ],
  "สอบถามโปรโมชั่นหัตถการอื่นๆ": () => [ { type: "text", text: "👨‍⚕️ปรึกษาหมอได้เลย หมอตอบเองครับ" } ],


  // ราคาแต่ละบริการ
  "สอบถามโปรโมชั่นโปรแกรมฉีด โบท็อกซ์": () => [
    createFlexMessage("สอบถามโปรโมชั่นโปรแกรมฉีด โบท็อกซ์", FlexMessageServicePrices({
      imagePriceUrl: [
        "https://www.vsquareclinic.com/wp-content/uploads/2026/06/0_โปรโบท็อกซ์เกาหลี.jpg",
        "https://www.vsquareclinic.com/wp-content/uploads/2026/06/1_neuronox.jpg",
        "https://www.vsquareclinic.com/wp-content/uploads/2026/06/2_nabota.jpg",
        "https://www.vsquareclinic.com/wp-content/uploads/2026/06/3_aestox.jpg",
        "https://www.vsquareclinic.com/wp-content/uploads/2026/06/4_inbo.jpg",
        "https://www.vsquareclinic.com/wp-content/uploads/2026/06/5_bienox.jpg",
        "https://www.vsquareclinic.com/wp-content/uploads/2026/06/6_allergan.jpg",
        "https://www.vsquareclinic.com/wp-content/uploads/2026/06/7_xeomin.jpg",
        "https://www.vsquareclinic.com/wp-content/uploads/2026/06/8_dysport.jpg",
      ]
    })),
    { type: "text", text: "👨‍⚕️ปรึกษาหมอได้เลย หมอตอบเองครับ" }
  ],
  "สอบถามโปรโมชั่นโปรแกรมฉีด ฟิลเลอร์": () => [
    createFlexMessage("สอบถามโปรโมชั่นโปรแกรมฉีด ฟิลเลอร์", FlexMessageServicePrices({
      imagePriceUrl: [
        "https://www.vsquareclinic.com/wp-content/uploads/2026/06/filler_card_1.jpg",
        "https://www.vsquareclinic.com/wp-content/uploads/2026/06/filler_card_2.jpg",
        "https://www.vsquareclinic.com/wp-content/uploads/2026/06/filler_card_3.jpg",
        "https://www.vsquareclinic.com/wp-content/uploads/2026/06/filler_card_4.jpg",
        "https://www.vsquareclinic.com/wp-content/uploads/2026/06/filler_card_5.jpg",
        "https://www.vsquareclinic.com/wp-content/uploads/2026/06/filler_card_6.jpg",
        "https://www.vsquareclinic.com/wp-content/uploads/2026/06/filler_card_7.jpg",
        "https://www.vsquareclinic.com/wp-content/uploads/2026/06/filler_card_8.jpg",
        "https://www.vsquareclinic.com/wp-content/uploads/2026/06/filler_card_9.jpg",
      ]
    })),
    { type: "text", text: "👨‍⚕️ปรึกษาหมอได้เลย หมอตอบเองครับ" }
  ],
  "สอบถามโปรโมชั่นโปรแกรม V Safe Slim": () => [
    createFlexMessage("สอบถามโปรโมชั่นโปรแกรม V Safe Slim", FlexMessageServicePrices({
      imagePriceUrl: [
        "https://www.vsquareclinic.com/wp-content/uploads/2026/06/v_safe_slim_card_1-220626.png",
        "https://www.vsquareclinic.com/wp-content/uploads/2026/06/v_safe_slim_card_2-220626.png",
        "https://www.vsquareclinic.com/wp-content/uploads/2026/06/v_safe_slim_card_3-220626-1.png",
        "https://www.vsquareclinic.com/wp-content/uploads/2026/06/v_safe_slim_card_4.png",
        "https://www.vsquareclinic.com/wp-content/uploads/2026/06/v_safe_slim_card_5.png",
      ]
    })),
    { type: "text", text: "👨‍⚕️ปรึกษาหมอได้เลย หมอตอบเองครับ" }
  ],
  "สอบถามโปรโมชั่นโปรแกรมเครื่องยกกระชับ": () => [
    createFlexMessage("สอบถามโปรโมชั่นโปรแกรมเครื่องยกกระชับ", FlexMessageServicePrices({
      imagePriceUrl: [
        "https://www.vsquareclinic.com/wp-content/uploads/2026/07/ultraformer-card-070726.jpg",
        "https://www.vsquareclinic.com/wp-content/uploads/2026/07/ultherapy-prime-card-070726.jpg",
        "https://www.vsquareclinic.com/wp-content/uploads/2026/07/volnewmer-card-070726.jpg",
        "https://www.vsquareclinic.com/wp-content/uploads/2026/07/ultraformer-mpt-card-070726.jpg",
        "https://www.vsquareclinic.com/wp-content/uploads/2026/07/ultherapy-spt-card-070726.jpg",
        "https://www.vsquareclinic.com/wp-content/uploads/2026/08/thermage-flx-card-070826.jpg",
      ]
    })),
    { type: "text", text: "👨‍⚕️ปรึกษาหมอได้เลย หมอตอบเองครับ" }
  ],
  "สอบถามโปรโมชั่นโปรแกรมฉีด กระตุ้นคอลลาเจน": () => [
    createFlexMessage("สอบถามโปรโมชั่นโปรแกรมฉีด กระตุ้นคอลลาเจน", FlexMessageServicePrices({
      imagePriceUrl: [
        "https://www.vsquareclinic.com/wp-content/uploads/2026/06/1_sculptra_card.jpg",
        "https://www.vsquareclinic.com/wp-content/uploads/2026/06/2_harmonyca_card.jpg",
        "https://www.vsquareclinic.com/wp-content/uploads/2026/06/3_profhilo_card.jpg",
        "https://www.vsquareclinic.com/wp-content/uploads/2026/06/4_juvelook_card.jpg",
        "https://www.vsquareclinic.com/wp-content/uploads/2026/06/5_juvelook-volume_card.jpg",
        "https://www.vsquareclinic.com/wp-content/uploads/2026/06/6_ellanse_card.jpg",
        "https://www.vsquareclinic.com/wp-content/uploads/2026/06/7_radiesse_card.jpg",
        "https://www.vsquareclinic.com/wp-content/uploads/2026/06/8_RR-mix_card.jpg",
      ]
    })),
    { type: "text", text: "👨‍⚕️ปรึกษาหมอได้เลย หมอตอบเองครับ" }
  ],
  "สอบถามโปรโมชั่นโปรแกรมคอลลาเจนสด": () => [
    createFlexMessage("สอบถามโปรโมชั่นโปรแกรมคอลลาเจนสด", FlexMessageServicePrices({
      imagePriceUrl: [
        "https://www.vsquareclinic.com/wp-content/uploads/2026/06/1_collaju.jpg",
        "https://www.vsquareclinic.com/wp-content/uploads/2026/06/2_therafill.jpg",
        "https://www.vsquareclinic.com/wp-content/uploads/2026/06/3_deusaderm.jpg",
        "https://www.vsquareclinic.com/wp-content/uploads/2026/06/4_karisma.jpg",
      ]
    })),
    { type: "text", text: "👨‍⚕️ปรึกษาหมอได้เลย หมอตอบเองครับ" }
  ],
  "สอบถามโปรโมชั่นโปรแกรมดริปวิตามิน": () => [
    createFlexMessage("สอบถามโปรโมชั่นโปรแกรมดริปวิตามิน", FlexMessageServicePrices({
      imagePriceUrl: [
        "https://www.vsquareclinic.com/wp-content/uploads/2026/06/drip-vitamin_card_1.jpg",
        "https://www.vsquareclinic.com/wp-content/uploads/2026/06/drip-vitamin_card_2.jpg",
        "https://www.vsquareclinic.com/wp-content/uploads/2026/06/drip-vitamin_card_3.jpg",
        "https://www.vsquareclinic.com/wp-content/uploads/2026/06/drip-vitamin_card_4.jpg",
        "https://www.vsquareclinic.com/wp-content/uploads/2026/06/drip-vitamin_card_5.jpg",
        "https://www.vsquareclinic.com/wp-content/uploads/2026/06/drip-vitamin_card_6.jpg",
        "https://www.vsquareclinic.com/wp-content/uploads/2026/06/drip-vitamin_card_7.jpg",
        "https://www.vsquareclinic.com/wp-content/uploads/2026/06/drip-vitamin_card_8.jpg",
        "https://www.vsquareclinic.com/wp-content/uploads/2026/06/drip-vitamin_card_9.jpg",
      ]
    })),
    { type: "text", text: "👨‍⚕️ปรึกษาหมอได้เลย หมอตอบเองครับ" }
  ],
  "สอบถามโปรโมชั่นโปรแกรมหน้าใส": () => [
    createFlexMessage("สอบถามโปรโมชั่นโปรแกรมหน้าใส", FlexMessageServicePrices({
      imagePriceUrl: [
        "https://www.vsquareclinic.com/wp-content/uploads/2026/07/v-id-facial_card_1-070726.jpg",
        "https://www.vsquareclinic.com/wp-content/uploads/2026/07/v-id-facial_card_2-070726.jpg",
        "https://www.vsquareclinic.com/wp-content/uploads/2026/07/v-id-facial_card_3-070726.jpg",
        "https://www.vsquareclinic.com/wp-content/uploads/2026/07/v-id-facial_card_4-070726.jpg",
        "https://www.vsquareclinic.com/wp-content/uploads/2026/07/v-id-facial_card_5-070726.jpg",
        "https://www.vsquareclinic.com/wp-content/uploads/2026/07/v-id-facial_card_6-070726.jpg",
      ]
    })),
    { type: "text", text: "👨‍⚕️ปรึกษาหมอได้เลย หมอตอบเองครับ" }
  ],
  


  // แผนที่แต่ละสาขา
  "สยาม สแควร์ วัน": () => [
    createFlexMessage("สาขาสยาม สแควร์ วัน", FlexMessageBranchMap({
      branchName: "สยามสแควร์วัน",
      fontSize: "xxl",
      mapUrl: "https://g.page/VSQSiam?share",
      imageUrl: "https://vsquareclinic.co/wp-content/uploads/2025/10/สยามสแควร์วัน.jpg",
      phoneNumber: "093 110 9000",
      lineId: "@VsqSQR",
      lineUrl: "https://line.me/R/ti/p/%40vsqsqr"
    })),
    createFlexMessage("สอบถามตารางแพทย์ สาขาสยาม สแควร์ วัน", FlexMessageIconTable({
      messageText: "สอบถามตารางแพทย์ สาขาสยาม สแควร์ วัน",
    }))
  ],
  "เกตเวย์ เอกมัย": () => [
    createFlexMessage("สาขาเกตเวย์ เอกมัย", FlexMessageBranchMap({
      branchName: "เกตเวย์ เอกมัย",
      fontSize: "xxl",
      mapUrl: "https://www.google.com/maps/place/V+Square+Clinic+Gateway+%E0%B9%80%E0%B8%AD%E0%B8%81%E0%B8%A1%E0%B8%B1%E0%B8%A2+Botox+Filler+Center+%E0%B8%A8%E0%B8%B9%E0%B8%99%E0%B8%A2%E0%B9%8C%E0%B8%A3%E0%B9%89%E0%B8%AD%E0%B8%A2%E0%B9%84%E0%B8%AB%E0%B8%A1+%E0%B9%82%E0%B8%9A%E0%B8%97%E0%B9%87%E0%B8%AD%E0%B8%81%E0%B8%8B%E0%B9%8C+%E0%B8%9F%E0%B8%B4%E0%B8%A5%E0%B9%80%E0%B8%A5%E0%B8%AD%E0%B8%A3%E0%B9%8C+%E0%B8%9B%E0%B8%A3%E0%B8%B1%E0%B8%9A%E0%B8%A3%E0%B8%B9%E0%B8%9B%E0%B8%AB%E0%B8%99%E0%B9%89%E0%B8%B2/@13.719769,100.5857395,15.54z/data=!4m5!3m4!1s0x30e29fa52fdbb469:0xe380d3d0e76e4c0b!8m2!3d13.719028!4d100.585232",
      imageUrl: "https://vsquareclinic.co/wp-content/uploads/2025/10/เกตเวย์-เอกมัย.jpg",
      phoneNumber: "099 005 9000",
      lineId: "@VSqGTW",
      lineUrl: "https://lin.ee/A5ldAZp"
    })),
    createFlexMessage("สอบถามตารางแพทย์ สาขาเกตเวย์ เอกมัย", FlexMessageIconTable({
      messageText: "สอบถามตารางแพทย์ สาขาเกตเวย์ เอกมัย",
    }))
  ],
  "เซ็นทรัล ลาดพร้าว": () => [
    createFlexMessage("สาขาเซ็นทรัล ลาดพร้าว", FlexMessageBranchMap({
      branchName: "เซ็นทรัล ลาดพร้าว",
      fontSize: "xxl",
      mapUrl: "https://goo.gl/maps/3JVgq9heeEjxsFro6",
      imageUrl: "https://vsquareclinic.co/wp-content/uploads/2025/10/เซ็นทรัล-ลาดพร้าว.jpg",
      phoneNumber: "091 905 7000",
      lineId: "@VsqCLP",
      lineUrl: "https://line.me/R/ti/p/%40vsqclp"
    })),
    createFlexMessage("สอบถามตารางแพทย์ สาขาเซ็นทรัล ลาดพร้าว", FlexMessageIconTable({
      messageText: "สอบถามตารางแพทย์ สาขาเซ็นทรัล ลาดพร้าว",
    }))
  ],
  "เมเจอร์ รัชโยธิน": () => [
    createFlexMessage("สาขาเมเจอร์ รัชโยธิน", FlexMessageBranchMap({
      branchName: "เมเจอร์ รัชโยธิน",
      fontSize: "xxl",
      mapUrl: "https://goo.gl/maps/Mr7aGiMYFUp",
      imageUrl: "https://vsquareclinic.co/wp-content/uploads/2025/10/เมเจอร์-รัชโยธิน.jpg",
      phoneNumber: "093 001 9000",
      lineId: "@VsqRCT",
      lineUrl: "https://line.me/ti/p/@VsqRCT"
    })),
    createFlexMessage("สอบถามตารางแพทย์ สาขาเมเจอร์ รัชโยธิน", FlexMessageIconTable({
      messageText: "สอบถามตารางแพทย์ สาขาเมเจอร์ รัชโยธิน",
    }))
  ],
  "ฟิวเจอร์พาร์ค รังสิต": () => [
    createFlexMessage("สาขาฟิวเจอร์พาร์ค รังสิต", FlexMessageBranchMap({
      branchName: "ฟิวเจอร์พาร์ค รังสิต",
      fontSize: "xxl",
      mapUrl: "https://www.google.com/maps/place/V+Square+Clinic+%E0%B8%9F%E0%B8%B4%E0%B8%A7%E0%B9%80%E0%B8%88%E0%B8%AD%E0%B8%A3%E0%B9%8C%E0%B8%9E%E0%B8%B2%E0%B8%A3%E0%B9%8C%E0%B8%84%E0%B8%A3%E0%B8%B1%E0%B8%87%E0%B8%AA%E0%B8%B4%E0%B8%95+Botox+Filler+%E0%B8%A3%E0%B9%89%E0%B8%AD%E0%B8%A2%E0%B9%84%E0%B8%AB%E0%B8%A1+%E0%B9%82%E0%B8%9A%E0%B8%97%E0%B9%87%E0%B8%AD%E0%B8%81%E0%B8%8B%E0%B9%8C+%E0%B8%9F%E0%B8%B4%E0%B8%A5%E0%B9%80%E0%B8%A5%E0%B8%AD%E0%B8%A3%E0%B9%8C+%E0%B8%9B%E0%B8%A3%E0%B8%B1%E0%B8%9A%E0%B8%A3%E0%B8%B9%E0%B8%9B%E0%B8%AB%E0%B8%99%E0%B9%89%E0%B8%B2/@13.9692304,100.6030853,14z/data=!4m5!3m4!1s0x30e281d8e125cacb:0x35a61db5d8e83ca!8m2!3d13.9899887!4d100.6171303",
      imageUrl: "https://vsquareclinic.co/wp-content/uploads/2025/10/ฟิวเจอร์พาร์ค-รังสิต.jpg",
      phoneNumber: "093 030 9000",
      lineId: "@VsqRST",
      lineUrl: "https://line.me/ti/p/@VsqRST"
    })),
    createFlexMessage("สอบถามตารางแพทย์ สาขาฟิวเจอร์พาร์ค รังสิต", FlexMessageIconTable({
      messageText: "สอบถามตารางแพทย์ สาขาฟิวเจอร์พาร์ค รังสิต",
    }))
  ],
  "เซ็นทรัล แจ้งวัฒนะ": () => [
    createFlexMessage("สาขาเซ็นทรัล แจ้งวัฒนะ", FlexMessageBranchMap({
      branchName: "เซ็นทรัล แจ้งวัฒนะ",
      fontSize: "xxl",
      mapUrl: "https://g.page/VSQCWT",
      imageUrl: "https://vsquareclinic.co/wp-content/uploads/2025/10/เซ็นทรัล-แจ้งวัฒนะ.jpg",
      phoneNumber: "093 007 9000",
      lineId: "@VsqCWT",
      lineUrl: "https://line.me/ti/p/@vsqcwt"
    })),
    createFlexMessage("สอบถามตารางแพทย์ สาขาเซ็นทรัล แจ้งวัฒนะ", FlexMessageIconTable({
      messageText: "สอบถามตารางแพทย์ สาขาเซ็นทรัล แจ้งวัฒนะ",
    }))
  ],
  "เซ็นทรัล บางนา": () => [
    createFlexMessage("สาขาเซ็นทรัล บางนา", FlexMessageBranchMap({
      branchName: "เซ็นทรัล บางนา",
      fontSize: "xxl",
      mapUrl: "https://goo.gl/maps/ZnDuQ2Ldkm23vLMS7",
      imageUrl: "https://vsquareclinic.co/wp-content/uploads/2025/10/เซ็นทรัล-บางนา.jpg",
      phoneNumber: "099 105 9000",
      lineId: "@VsqBNA",
      lineUrl: "https://line.me/R/ti/p/%40vsqbna"
    })),
    createFlexMessage("สอบถามตารางแพทย์ สาขาเซ็นทรัล บางนา", FlexMessageIconTable({
      messageText: "สอบถามตารางแพทย์ สาขาเซ็นทรัล บางนา",
    }))
  ],
  "ซีคอน สแควร์ ศรีนครินทร์": () => [
    createFlexMessage("สาขาซีคอน สแควร์ ศรีนครินทร์", FlexMessageBranchMap({
      branchName: "ซีคอน สแควร์ ศรีนครินทร์",
      fontSize: "xl",
      mapUrl: "https://goo.gl/maps/YSp732HxAHn",
      imageUrl: "https://vsquareclinic.co/wp-content/uploads/2025/10/ซีคอน-ศรีนครินทร์.jpg",
      phoneNumber: "091 916 9000",
      lineId: "@VsqSCN",
      lineUrl: "https://line.me/ti/p/@VsqSCN"
    })),
    createFlexMessage("สอบถามตารางแพทย์ สาขาซีคอน สแควร์ ศรีนครินทร์", FlexMessageIconTable({
      messageText: "สอบถามตารางแพทย์ สาขาซีคอน สแควร์ ศรีนครินทร์",
    }))
  ],
  "เซ็นทรัล ปิ่นเกล้า": () => [
    createFlexMessage("สาขาเซ็นทรัล ปิ่นเกล้า", FlexMessageBranchMap({
      branchName: "เซ็นทรัล ปิ่นเกล้า",
      fontSize: "xxl",
      mapUrl: "https://www.google.com/maps/place/V+Square+Clinic+%E0%B9%80%E0%B8%8B%E0%B9%87%E0%B8%99%E0%B8%97%E0%B8%A3%E0%B8%B1%E0%B8%A5%E0%B8%9B%E0%B8%B4%E0%B9%88%E0%B8%99%E0%B9%80%E0%B8%81%E0%B8%A5%E0%B9%89%E0%B8%B2+Botox+Filler+%E0%B8%A3%E0%B9%89%E0%B8%AD%E0%B8%A2%E0%B9%84%E0%B8%AB%E0%B8%A1+%E0%B9%82%E0%B8%9A%E0%B8%97%E0%B9%87%E0%B8%AD%E0%B8%81%E0%B8%8B%E0%B9%8C+%E0%B8%9F%E0%B8%B4%E0%B8%A5%E0%B9%80%E0%B8%A5%E0%B8%AD%E0%B8%A3%E0%B9%8C+%E0%B8%9B%E0%B8%A3%E0%B8%B1%E0%B8%9A%E0%B8%A3%E0%B8%B9%E0%B8%9B%E0%B8%AB%E0%B8%99%E0%B9%89%E0%B8%B2/@13.7775808,100.4734057,15.39z/data=!4m5!3m4!1s0x30e29986940e81b5:0xb003687ab208356f!8m2!3d13.7779355!4d100.4773313",
      imageUrl: "https://vsquareclinic.co/wp-content/uploads/2025/10/เซ็นทรัล-ปิ่นเกล้า.jpg",
      phoneNumber: "099 006 7000",
      lineId: "@VsqPNK",
      lineUrl: "https://line.me/ti/p/@VsqPNK"
    })),
    createFlexMessage("สอบถามตารางแพทย์ สาขาเซ็นทรัล ปิ่นเกล้า", FlexMessageIconTable({
      messageText: "สอบถามตารางแพทย์ สาขาเซ็นทรัล ปิ่นเกล้า",
    }))
  ],
  "เซ็นทรัล พระราม 2": () => [
    createFlexMessage("สาขาเซ็นทรัล พระราม 2", FlexMessageBranchMap({
      branchName: "เซ็นทรัล พระราม 2",
      fontSize: "xxl",
      mapUrl: "https://goo.gl/maps/NkeVGFo34W52",
      imageUrl: "https://vsquareclinic.co/wp-content/uploads/2025/10/เซ็นทรัล-พระราม-2.jpg",
      phoneNumber: "091 914 9000",
      lineId: "@VsqCTR",
      lineUrl: "https://line.me/ti/p/@VsqCTR"
    })),
    createFlexMessage("สอบถามตารางแพทย์ สาขาเซ็นทรัล พระราม 2", FlexMessageIconTable({
      messageText: "สอบถามตารางแพทย์ สาขาเซ็นทรัล พระราม 2",
    }))
  ],
  "เซ็นทรัล อีสวิลล์": () => [
    createFlexMessage("สาขาเซ็นทรัล อีสวิลล์", FlexMessageBranchMap({
      branchName: "เซ็นทรัล อีสวิลล์",
      fontSize: "xxl",
      mapUrl: "https://g.page/VSQESV?share",
      imageUrl: "https://vsquareclinic.co/wp-content/uploads/2025/10/เซ็นทรัล-อีสวิลล์.jpg",
      phoneNumber: "093 012 9000",
      lineId: "@VsqESV",
      lineUrl: "https://line.me/R/ti/p/%40vsqesv"
    })),
    createFlexMessage("สอบถามตารางแพทย์ สาขาเซ็นทรัล อีสวิลล์", FlexMessageIconTable({
      messageText: "สอบถามตารางแพทย์ สาขาเซ็นทรัล อีสวิลล์",
    }))
  ],
  "เดอะ พรอมานาด": () => [
    createFlexMessage("สาขาเดอะ พรอมานาด", FlexMessageBranchMap({
      branchName: "เดอะ พรอมานาด",
      fontSize: "xxl",
      mapUrl: "https://g.page/VsqPRM?share",
      imageUrl: "https://vsquareclinic.co/wp-content/uploads/2025/10/เดอะพรอมมานาด.jpg",
      phoneNumber: "091 905 8000",
      lineId: "@VsqPRM",
      lineUrl: "https://line.me/R/ti/p/%40VsqPRM"
    })),
    createFlexMessage("สอบถามตารางแพทย์ สาขาเดอะ พรอมานาด", FlexMessageIconTable({
      messageText: "สอบถามตารางแพทย์ สาขาเดอะ พรอมานาด",
    }))
  ],
  "เดอะมอลล์ บางกะปิ": () => [
    createFlexMessage("สาขาเดอะมอลล์ บางกะปิ", FlexMessageBranchMap({
      branchName: "เดอะมอลล์ บางกะปิ",
      fontSize: "xxl",
      mapUrl: "https://goo.gl/maps/F4xbv6HNeTG2",
      imageUrl: "https://vsquareclinic.co/wp-content/uploads/2025/10/เดอะมอลล์-บางกะปิ.jpg",
      phoneNumber: "091 903 9000",
      lineId: "@VsqBKP",
      lineUrl: "https://line.me/ti/p/@VsqBKP"
    })),
    createFlexMessage("สอบถามตารางแพทย์ สาขาเดอะมอลล์ บางกะปิ", FlexMessageIconTable({
      messageText: "สอบถามตารางแพทย์ สาขาเดอะมอลล์ บางกะปิ",
    }))
  ],
  "พาซิโอ กาญจนา": () => [
    createFlexMessage("สาขาพาซิโอ กาญจนา", FlexMessageBranchMap({
      branchName: "พาซิโอ กาญจนา",
      fontSize: "xxl",
      mapUrl: "https://g.page/VSQPSO",
      imageUrl: "https://vsquareclinic.co/wp-content/uploads/2025/10/พาซิโอ-กาญจนา.jpg",
      phoneNumber: "084 242 4000",
      lineId: "@VsqPSO",
      lineUrl: "https://lin.ee/QkCCisW"
    })),
    createFlexMessage("สอบถามตารางแพทย์ สาขาพาซิโอ กาญจนา", FlexMessageIconTable({
      messageText: "สอบถามตารางแพทย์ สาขาพาซิโอ กาญจนา",
    }))
  ],
  "เซ็นทรัล พระราม 3": () => [
    createFlexMessage("สาขาเซ็นทรัล พระราม 3", FlexMessageBranchMap({
      branchName: "เซ็นทรัล พระราม 3",
      fontSize: "xxl",
      mapUrl: "https://goo.gl/maps/6JN6SeNtWp4UGcL36",
      imageUrl: "https://vsquareclinic.co/wp-content/uploads/2025/10/เซ็นทรัล-พระราม-3.jpg",
      phoneNumber: "092 236 2000",
      lineId: "@VsqCRM",
      lineUrl: "https://line.me/R/ti/p/%40427natjj"
    })),
    createFlexMessage("สอบถามตารางแพทย์ สาขาเซ็นทรัล พระราม 3", FlexMessageIconTable({
      messageText: "สอบถามตารางแพทย์ สาขาเซ็นทรัล พระราม 3",
    }))
  ],
  "เซ็นทรัล เวสต์เกต": () => [
    createFlexMessage("สาขาเซ็นทรัล เวสต์เกต", FlexMessageBranchMap({
      branchName: "เซ็นทรัล เวสต์เกต",
      fontSize: "xxl",
      mapUrl: "https://goo.gl/maps/pLmPLNJ89FVHWAfC7",
      imageUrl: "https://vsquareclinic.co/wp-content/uploads/2025/10/เซ็นทรัล-เวสต์เกต.jpg",
      phoneNumber: "084 404 0400",
      lineId: "@VsqCWG",
      lineUrl: "https://lin.ee/7lfUeIS"
    })),
    createFlexMessage("สอบถามตารางแพทย์ สาขาเซ็นทรัล เวสต์เกต", FlexMessageIconTable({
      messageText: "สอบถามตารางแพทย์ สาขาเซ็นทรัล เวสต์เกต",
    }))
  ],
  "เดอะมอลล์ บางแค": () => [
    createFlexMessage("สาขาเดอะมอลล์ บางแค", FlexMessageBranchMap({
      branchName: "เดอะมอลล์ บางแค",
      fontSize: "xxl",
      mapUrl: "https://goo.gl/maps/bmHJcKbMso6tCd1D6",
      imageUrl: "https://vsquareclinic.co/wp-content/uploads/2025/10/เดอะมอลล์-บางแค.jpg",
      phoneNumber: "092 245 2000",
      lineId: "@VsqMBA",
      lineUrl: "https://lin.ee/QjQxSSp"
    })),
    createFlexMessage("สอบถามตารางแพทย์ สาขาเดอะมอลล์ บางแค", FlexMessageIconTable({
      messageText: "สอบถามตารางแพทย์ สาขาเดอะมอลล์ บางแค",
    }))
  ],
  "เอ็มควอเทียร์": () => [
    createFlexMessage("สาขาเอ็มควอเทียร์", FlexMessageBranchMap({
      branchName: "เอ็มควอเทียร์",
      fontSize: "xxl",
      mapUrl: "https://g.page/r/CW8lI8JcDplzEAE",
      imageUrl: "https://vsquareclinic.co/wp-content/uploads/2025/10/เอ็มควอเทียร์.jpg",
      phoneNumber: "081 712 5000",
      lineId: "@VsqEMQ",
      lineUrl: "https://lin.ee/ct1WXMe"
    })),
    createFlexMessage("สอบถามตารางแพทย์ สาขาเอ็มควอเทียร์", FlexMessageIconTable({
      messageText: "สอบถามตารางแพทย์ สาขาเอ็มควอเทียร์",
    }))
  ],
  "เดอะมอลล์ ท่าพระ": () => [
    createFlexMessage("สาขาเดอะมอลล์ ท่าพระ", FlexMessageBranchMap({
      branchName: "เดอะมอลล์ ท่าพระ",
      fontSize: "xxl",
      mapUrl: "https://goo.gl/maps/DpytzbYqm66ACxrCA",
      imageUrl: "https://vsquareclinic.co/wp-content/uploads/2025/10/เดอะมอลล์-ท่าพระ.jpg",
      phoneNumber: "080 453 4000",
      lineId: "@VsqMTA",
      lineUrl: "https://lin.ee/yZBZmgY"
    })),
    createFlexMessage("สอบถามตารางแพทย์ สาขาเดอะมอลล์ ท่าพระ", FlexMessageIconTable({
      messageText: "สอบถามตารางแพทย์ สาขาเดอะมอลล์ ท่าพระ",
    }))
  ],
  "เซ็นทรัล รามอินทรา": () => [
    createFlexMessage("สาขาเซ็นทรัล รามอินทรา", FlexMessageBranchMap({
      branchName: "เซ็นทรัล รามอินทรา",
      fontSize: "xxl",
      mapUrl: "https://goo.gl/maps/z7RMt1bH4Vb6zbhY7",
      imageUrl: "https://vsquareclinic.co/wp-content/uploads/2025/10/เซ็นทรัล-รามอินทรา.jpg",
      phoneNumber: "092 628 9000",
      lineId: "@VsqCRA",
      lineUrl: "https://page.line.me/VsqCRA"
    })),
    createFlexMessage("สอบถามตารางแพทย์ สาขาเซ็นทรัล รามอินทรา", FlexMessageIconTable({
      messageText: "สอบถามตารางแพทย์ สาขาเซ็นทรัล รามอินทรา",
    }))
  ],
  "เทอร์มินอล อโศก": () => [
    createFlexMessage("สาขาเทอร์มินอล อโศก", FlexMessageBranchMap({
      branchName: "เทอร์มินอล อโศก",
      fontSize: "xxl",
      mapUrl: "https://goo.gl/maps/yrk3zv55g1ppTHGf6",
      imageUrl: "https://vsquareclinic.co/wp-content/uploads/2025/10/เทอร์มินอล-อโศก.jpg",
      phoneNumber: "092 879 9000",
      lineId: "@VsqTMA",
      lineUrl: "https://page.line.me/VsqTMA"
    })),
    createFlexMessage("สอบถามตารางแพทย์ สาขาเทอร์มินอล อโศก", FlexMessageIconTable({
      messageText: "สอบถามตารางแพทย์ สาขาเทอร์มินอล อโศก",
    }))
  ],
  // "เซ็นทรัล ศาลายา": () => [
  //   createFlexMessage("สาขาเซ็นทรัล ศาลายา", FlexMessageBranchMap({
  //     branchName: "เซ็นทรัล ศาลายา",
  //     fontSize: "xxl",
  //     mapUrl: "https://goo.gl/maps/Wa42Krot2h9H16hh9",
  //     imageUrl: "https://vsquareclinic.co/wp-content/uploads/2025/10/เซ็นทรัล-ศาลายา.jpg",
  //     phoneNumber: "064 939 9000",
  //     lineId: "@VsqCSA",
  //     lineUrl: "https://page.line.me/VsqCSA"
  //   })),
  //   createFlexMessage("สอบถามตารางแพทย์ สาขาเซ็นทรัล ศาลายา", FlexMessageIconTable({
  //     messageText: "สอบถามตารางแพทย์ สาขาเซ็นทรัล ศาลายา",
  //   }))
  // ],
  "เซ็นทรัล เวสต์วิลล์": () => [
    createFlexMessage("สาขาเซ็นทรัล เวสต์วิลล์", FlexMessageBranchMap({
      branchName: "เซ็นทรัล เวสต์วิลล์",
      fontSize: "xxl",
      mapUrl: "https://maps.app.goo.gl/L8wq3pamoTEfLtVt6?g_st=ic",
      imageUrl: "https://vsquareclinic.co/wp-content/uploads/2025/10/เซ็นทรัล-เวสต์วิลล์.jpg",
      phoneNumber: "099 005 7000",
      lineId: "@VsqRCP",
      lineUrl: "https://lin.ee/ASqi4XV"
    })),
    createFlexMessage("สอบถามตารางแพทย์ สาขาเซ็นทรัล เวสต์วิลล์", FlexMessageIconTable({
      messageText: "สอบถามตารางแพทย์ สาขาเซ็นทรัล เวสต์วิลล์",
    }))
  ],
  "เซ็นทรัล นครปฐม": () => [
    createFlexMessage("สาขาเซ็นทรัล นครปฐม", FlexMessageBranchMap({
      branchName: "เซ็นทรัล นครปฐม",
      fontSize: "xxl",
      mapUrl: "https://maps.app.goo.gl/HqyDVqgbHhU7sHJz6",
      imageUrl: "https://vsquareclinic.co/wp-content/uploads/2025/10/เซ็นทรัล-นครปฐม.jpg",
      phoneNumber: "092 826 9000",
      lineId: "@VsqCNK",
      lineUrl: "https://lin.ee/k4OlKHm"
    })),
    createFlexMessage("สอบถามตารางแพทย์ สาขาเซ็นทรัล นครปฐม", FlexMessageIconTable({
      messageText: "สอบถามตารางแพทย์ สาขาเซ็นทรัล นครปฐม",
    }))
  ],
  "พระราม 9": () => [
    createFlexMessage("สาขาพระราม 9", FlexMessageBranchMap({
      branchName: "พระราม 9",
      fontSize: "xxl",
      mapUrl: "https://maps.app.goo.gl/JRVhcdCzWwugroEcA",
      imageUrl: "https://vsquareclinic.co/wp-content/uploads/2025/10/พระราม-9.jpg",
      phoneNumber: "098 964 9000",
      lineId: "@VsqCPN",
      lineUrl: "https://lin.ee/Z5gJDiS"
    })),
    createFlexMessage("สอบถามตารางแพทย์ สาขาพระราม 9", FlexMessageIconTable({
      messageText: "สอบถามตารางแพทย์ สาขาพระราม 9",
    }))
  ],
  "เมกา บางนา": () => [
    createFlexMessage("สาขาเมกา บางนา", FlexMessageBranchMap({
      branchName: "เมกา บางนา",
      fontSize: "xxl",
      mapUrl: "https://maps.app.goo.gl/rDYCZBcFgTLhhpzT6",
      imageUrl: "https://vsquareclinic.co/wp-content/uploads/2025/10/เมกา-บางนา.jpg",
      phoneNumber: "065 156 1000",
      lineId: "@VsqMGA",
      lineUrl: "https://lin.ee/JLcFrR4"
    })),
    createFlexMessage("สอบถามตารางแพทย์ สาขาเมกา บางนา", FlexMessageIconTable({
      messageText: "สอบถามตารางแพทย์ สาขาเมกา บางนา",
    }))
  ],
  // "เซ็นทรัล มหาชัย": () => [
  //   createFlexMessage("สาขาเซ็นทรัล มหาชัย", FlexMessageBranchMap({
  //     branchName: "เซ็นทรัล มหาชัย",
  //     fontSize: "xxl",
  //     mapUrl: "https://maps.app.goo.gl/kKTDNxyCvQyaSR5b7",
  //     imageUrl: "https://vsquareclinic.co/wp-content/uploads/2025/10/เซ็นทรัลมหาชัย.jpg",
  //     phoneNumber: "098 969 4000",
  //     lineId: "@VsqCMC",
  //     lineUrl: "https://lin.ee/i3vFTuM"
  //   })),
  //   createFlexMessage("สอบถามตารางแพทย์ สาขาเซ็นทรัล มหาชัย", FlexMessageIconTable({
  //     messageText: "สอบถามตารางแพทย์ สาขาเซ็นทรัล มหาชัย",
  //   }))
  // ],
  "เซ็นทรัล เวิล์ด": () => [
    createFlexMessage("สาขาเซ็นทรัล เวิล์ด", FlexMessageBranchMap({
      branchName: "เซ็นทรัลเวิลด์",
      fontSize: "xxl",
      mapUrl: "https://maps.app.goo.gl/Whv5z8TsxCTsTYw77",
      imageUrl: "https://vsquareclinic.co/wp-content/uploads/2025/10/เซ็นทรัลเวิลด์.jpg",
      phoneNumber: "085 599 6000",
      lineId: "@VsqCTW",
      lineUrl: "https://lin.ee/USDXorz"
    })),
    createFlexMessage("สอบถามตารางแพทย์ สาขาเซ็นทรัล เวิล์ด", FlexMessageIconTable({
      messageText: "สอบถามตารางแพทย์ สาขาเซ็นทรัล เวิล์ด",
    }))
  ],
  "วัน แบงค็อก": () => [
    createFlexMessage("สาขาวัน แบงค็อก", FlexMessageBranchMap({
      branchName: "วัน แบงค็อก",
      fontSize: "xxl",
      mapUrl: "https://maps.app.goo.gl/AJ9jhVLFxDJGZb6P9",
      imageUrl: "https://vsquareclinic.co/wp-content/uploads/2025/10/One-Bangkok.jpg",
      phoneNumber: "082 252 5000",
      lineId: "@VsqONE",
      lineUrl: "https://lin.ee/l57Qmbp"
    })),
    createFlexMessage("สอบถามตารางแพทย์ สาขาวัน แบงค็อก", FlexMessageIconTable({
      messageText: "สอบถามตารางแพทย์ สาขาวัน แบงค็อก",
    }))
  ],
  // "เอสพลานาด รัชดาภิเษก": () => [
  //   createFlexMessage("สาขาเอสพลานาด รัชดาภิเษก", FlexMessageBranchMap({
  //     branchName: "เอสพลานาด รัชดาภิเษก",
  //     fontSize: "xl",
  //     mapUrl: "https://maps.app.goo.gl/xqz79arFEgeFrjYz7",
  //     imageUrl: "https://vsquareclinic.co/wp-content/uploads/2025/10/เอสพลานาด-รัชดา.jpg",
  //     phoneNumber: "092 208 3000",
  //     lineId: "@VsqESP"
  //   })),
  //   createFlexMessage("สอบถามตารางแพทย์ สาขาเอสพลานาด รัชดาภิเษก", FlexMessageIconTable({
  //     messageText: "สอบถามตารางแพทย์ สาขาเอสพลานาด รัชดาภิเษก",
  //   }))
  // ],
  "เดอะมอลล์ งามวงศ์วาน": () => [
    createFlexMessage("สาขาเดอะมอลล์ งามวงศ์วาน", FlexMessageBranchMap({
      branchName: "เดอะมอลล์ งามวงศ์วาน",
      fontSize: "xl",
      mapUrl: "https://maps.app.goo.gl/VnVFsD2DJoaNh91L8",
      imageUrl: "https://vsquareclinic.co/wp-content/uploads/2025/10/เดอะมอลล์-งามวงศ์วาน.jpg",
      phoneNumber: "082 632 3000",
      lineId: "@VsqMNG",
      lineUrl: "https://lin.ee/ppU0e1X"
    })),
    createFlexMessage("สอบถามตารางแพทย์ สาขาเดอะมอลล์ งามวงศ์วาน", FlexMessageIconTable({
      messageText: "สอบถามตารางแพทย์ สาขาเดอะมอลล์ งามวงศ์วาน",
    }))
  ],
  "ทองหล่อ": () => [
    createFlexMessage("สาขาทองหล่อ", FlexMessageBranchMap({
      branchName: "ทองหล่อ",
      fontSize: "xxl",
      mapUrl: "https://maps.app.goo.gl/22aY7rSw27FruSyw6",
      imageUrl: "https://vsquareclinic.co/wp-content/uploads/2025/10/ทองหล่อ.jpg",
      phoneNumber: "095 697 9000",
      lineId: "@VsqTLR",
      lineUrl: "https://lin.ee/PMwPl30"
    })),
    createFlexMessage("สอบถามตารางแพทย์ สาขาทองหล่อ", FlexMessageIconTable({
      messageText: "สอบถามตารางแพทย์ สาขาทองหล่อ",
    }))
  ],
  "ทองหล่อ เลเซอร์เซ็นเตอร์": () => [
    createFlexMessage("สาขาทองหล่อ เลเซอร์เซ็นเตอร์", FlexMessageBranchMap({
      branchName: "ทองหล่อ เลเซอร์เซ็นเตอร์",
      fontSize: "xl",
      mapUrl: "https://maps.app.goo.gl/22aY7rSw27FruSyw6",
      imageUrl: "https://vsquareclinic.co/wp-content/uploads/2025/10/ทองหล่อ.jpg",
      phoneNumber: "095 697 9000",
      lineId: "@VsqTLR",
      lineUrl: "https://lin.ee/PMwPl30"
    })),
    createFlexMessage("สอบถามตารางแพทย์ สาขาทองหล่อ เลเซอร์เซ็นเตอร์", FlexMessageIconTable({
      messageText: "สอบถามตารางแพทย์ สาขาทองหล่อ เลเซอร์เซ็นเตอร์",
    }))
  ],
  "ทองหล่อ เวลเนสเช็นเตอร์": () => [
    createFlexMessage("สาขาทองหล่อ เวลเนสเช็นเตอร์", FlexMessageBranchMap({
      branchName: "ทองหล่อ เวลเนสเช็นเตอร์",
      fontSize: "xl",
      mapUrl: "https://maps.app.goo.gl/22aY7rSw27FruSyw6",
      imageUrl: "https://vsquareclinic.co/wp-content/uploads/2025/10/ทองหล่อ.jpg",
      phoneNumber: "095 697 9000",
      lineId: "@VsqTLR",
      lineUrl: "https://lin.ee/PMwPl30"
    })),
    createFlexMessage("สอบถามตารางแพทย์ สาขาทองหล่อ เวลเนสเช็นเตอร์", FlexMessageIconTable({
      messageText: "สอบถามตารางแพทย์ สาขาทองหล่อ เวลเนสเช็นเตอร์",
    }))
  ],
  "ดุสิต เซ็นทรัล พาร์ค": () => [
    createFlexMessage("สาขาดุสิต เซ็นทรัล พาร์ค", FlexMessageBranchMap({
      branchName: "ดุสิต เซ็นทรัล พาร์ค",
      fontSize: "xxl",
      mapUrl: "https://maps.app.goo.gl/rPdBQbqVhrxQarHNA",
      imageUrl: "https://www.vsquareclinic.com/wp-content/uploads/2025/11/เซ็นทรัล-พาร์ค.jpg",
      phoneNumber: "091 081 5000",
      lineId: "@VsqDCP",
      lineUrl: "https://lin.ee/wahYfcc"
    })),
    createFlexMessage("สอบถามตารางแพทย์ สาขาดุสิต เซ็นทรัล พาร์ค", FlexMessageIconTable({
      messageText: "สอบถามตารางแพทย์ สาขาดุสิต เซ็นทรัล พาร์ค",
    }))
  ],
  "เลียบด่วน": () => [
    createFlexMessage("สาขาเลียบด่วน", FlexMessageBranchMap({
      branchName: "เลียบด่วน",
      fontSize: "xxl",
      mapUrl: "https://maps.app.goo.gl/kKhJsub1NhnarXj59",
      imageUrl: "https://www.vsquareclinic.com/wp-content/uploads/2026/05/เลียบด่วน.jpg",
      phoneNumber: "093 012 9000",
      lineId: "@VsqCDR",
      lineUrl: "https://lin.ee/NyMs0tn"
    })),
    createFlexMessage("สอบถามตารางแพทย์ สาขาเลียบด่วน", FlexMessageIconTable({
      messageText: "สอบถามตารางแพทย์ สาขาเลียบด่วน",
    }))
  ],

  // ตารางแพทย์แต่ละวันของสาขา
  "สอบถามตารางแพทย์ สาขาสยาม สแควร์ วัน": () => [
    createFlexMessage("สอบถามตารางแพทย์ สาขาสยาม สแควร์ วัน", FlexMessageDoctorSchedules(siamDoctorSchedules))
  ],
  "สอบถามตารางแพทย์ สาขาเกตเวย์ เอกมัย": () => [
    createFlexMessage("สอบถามตารางแพทย์ สาขาเกตเวย์ เอกมัย", FlexMessageDoctorSchedules(gatewayEkamaiDoctorSchedules))
  ],
  "สอบถามตารางแพทย์ สาขาเซ็นทรัล ลาดพร้าว": () => [
    createFlexMessage("สอบถามตารางแพทย์ สาขาเซ็นทรัล ลาดพร้าว", FlexMessageDoctorSchedules(centralLadpraoDoctorSchedules))
  ],
  "สอบถามตารางแพทย์ สาขาเมเจอร์ รัชโยธิน": () => [
    createFlexMessage("สอบถามตารางแพทย์ สาขาเมเจอร์ รัชโยธิน", FlexMessageDoctorSchedules(majorRatchayothinDoctorSchedules))
  ],
  "สอบถามตารางแพทย์ สาขาฟิวเจอร์พาร์ค รังสิต": () => [
    createFlexMessage("สอบถามตารางแพทย์ สาขาฟิวเจอร์พาร์ค รังสิต", FlexMessageDoctorSchedules(futureParkRangsitDoctorSchedules))
  ],
  "สอบถามตารางแพทย์ สาขาเซ็นทรัล แจ้งวัฒนะ": () => [
    createFlexMessage("สอบถามตารางแพทย์ สาขาเซ็นทรัล แจ้งวัฒนะ", FlexMessageDoctorSchedules(centralChaengwattanaDoctorSchedules))
  ],
  "สอบถามตารางแพทย์ สาขาเซ็นทรัล บางนา": () => [
    createFlexMessage("สอบถามตารางแพทย์ สาขาเซ็นทรัล บางนา", FlexMessageDoctorSchedules(centralBangnaDoctorSchedules))
  ],
  "สอบถามตารางแพทย์ สาขาซีคอน สแควร์ ศรีนครินทร์": () => [
    createFlexMessage("สอบถามตารางแพทย์ สาขาซีคอน สแควร์ ศรีนครินทร์", FlexMessageDoctorSchedules(seaconSrinakarinDoctorSchedules))
  ],
  "สอบถามตารางแพทย์ สาขาเซ็นทรัล ปิ่นเกล้า": () => [
    createFlexMessage("สอบถามตารางแพทย์ สาขาเซ็นทรัล ปิ่นเกล้า", FlexMessageDoctorSchedules(centralPinklaoDoctorSchedules))
  ],
  "สอบถามตารางแพทย์ สาขาเซ็นทรัล พระราม 2": () => [
    createFlexMessage("สอบถามตารางแพทย์ สาขาเซ็นทรัล พระราม 2", FlexMessageDoctorSchedules(centralRama2DoctorSchedules))
  ],
  "สอบถามตารางแพทย์ สาขาเซ็นทรัล อีสวิลล์": () => [
    createFlexMessage("สอบถามตารางแพทย์ สาขาเซ็นทรัล อีสวิลล์", FlexMessageDoctorSchedules(centralEastvilleDoctorSchedules))
  ],
  "สอบถามตารางแพทย์ สาขาเดอะ พรอมานาด": () => [
    createFlexMessage("สอบถามตารางแพทย์ สาขาเดอะ พรอมานาด", FlexMessageDoctorSchedules(thePromenadeDoctorSchedules))
  ],
  "สอบถามตารางแพทย์ สาขาเดอะมอลล์ บางกะปิ": () => [
    createFlexMessage("สอบถามตารางแพทย์ สาขาเดอะมอลล์ บางกะปิ", FlexMessageDoctorSchedules(theMallBangkapiDoctorSchedules))
  ],
  "สอบถามตารางแพทย์ สาขาพาซิโอ กาญจนา": () => [
    createFlexMessage("สอบถามตารางแพทย์ สาขาพาซิโอ กาญจนา", FlexMessageDoctorSchedules(paseoKanchanapisekDoctorSchedules))
  ],
  "สอบถามตารางแพทย์ สาขาเซ็นทรัล พระราม 3": () => [
    createFlexMessage("สอบถามตารางแพทย์ สาขาเซ็นทรัล พระราม 3", FlexMessageDoctorSchedules(centralRama3DoctorSchedules))
  ],
  "สอบถามตารางแพทย์ สาขาเซ็นทรัล เวสต์เกต": () => [
    createFlexMessage("สอบถามตารางแพทย์ สาขาเซ็นทรัล เวสต์เกต", FlexMessageDoctorSchedules(centralWestgateDoctorSchedules))
  ],
  "สอบถามตารางแพทย์ สาขาเดอะมอลล์ บางแค": () => [
    createFlexMessage("สอบถามตารางแพทย์ สาขาเดอะมอลล์ บางแค", FlexMessageDoctorSchedules(theMallBangkaeDoctorSchedules))
  ],
  "สอบถามตารางแพทย์ สาขาเอ็มควอเทียร์": () => [
    createFlexMessage("สอบถามตารางแพทย์ สาขาเอ็มควอเทียร์", FlexMessageDoctorSchedules(emQuartierDoctorSchedules))
  ],
  "สอบถามตารางแพทย์ สาขาเดอะมอลล์ ท่าพระ": () => [
    createFlexMessage("สอบถามตารางแพทย์ สาขาเดอะมอลล์ ท่าพระ", FlexMessageDoctorSchedules(theMallThapraDoctorSchedules))
  ],
  "สอบถามตารางแพทย์ สาขาเซ็นทรัล รามอินทรา": () => [
    createFlexMessage("สอบถามตารางแพทย์ สาขาเซ็นทรัล รามอินทรา", FlexMessageDoctorSchedules(centralRamindraDoctorSchedules))
  ],
  "สอบถามตารางแพทย์ สาขาเทอร์มินอล อโศก": () => [
    createFlexMessage("สอบถามตารางแพทย์ สาขาเทอร์มินอล อโศก", FlexMessageDoctorSchedules(terminalAsokeDoctorSchedules))
  ],
  "สอบถามตารางแพทย์ สาขาเซ็นทรัล ศาลายา": () => [
    createFlexMessage("สอบถามตารางแพทย์ สาขาเซ็นทรัล ศาลายา", FlexMessageDoctorSchedules(centralSalayaDoctorSchedules))
  ],
  "สอบถามตารางแพทย์ สาขาเซ็นทรัล เวสต์วิลล์": () => [
    createFlexMessage("สอบถามตารางแพทย์ สาขาเซ็นทรัล เวสต์วิลล์", FlexMessageDoctorSchedules(centralWestvilleDoctorSchedules))
  ],
  "สอบถามตารางแพทย์ สาขาเซ็นทรัล นครปฐม": () => [
    createFlexMessage("สอบถามตารางแพทย์ สาขาเซ็นทรัล นครปฐม", FlexMessageDoctorSchedules(centralNakhonpathomDoctorSchedules))
  ],
  "สอบถามตารางแพทย์ สาขาพระราม 9": () => [
    createFlexMessage("สอบถามตารางแพทย์ สาขาพระราม 9", FlexMessageDoctorSchedules(rama9DoctorSchedules)),
    createFlexMessage("สอบถามตารางแพทย์ สาขาพระราม 9", FlexMessageDoctorSchedules(rama9DoctorSchedules2))
  ],
  "สอบถามตารางแพทย์ สาขาเมกา บางนา": () => [
    createFlexMessage("สอบถามตารางแพทย์ สาขาเมกา บางนา", FlexMessageDoctorSchedules(megaBangnaDoctorSchedules))
  ],
  "สอบถามตารางแพทย์ สาขาเซ็นทรัล มหาชัย": () => [
    createFlexMessage("สอบถามตารางแพทย์ สาขาเซ็นทรัล มหาชัย", FlexMessageDoctorSchedules(centralMahachaiDoctorSchedules))
  ],
  "สอบถามตารางแพทย์ สาขาเซ็นทรัล เวิล์ด": () => [
    createFlexMessage("สอบถามตารางแพทย์ สาขาเซ็นทรัล เวิล์ด", FlexMessageDoctorSchedules(centralWorldDoctorSchedules))
  ],
  "สอบถามตารางแพทย์ สาขาวัน แบงค็อก": () => [
    createFlexMessage("สอบถามตารางแพทย์ สาขาวัน แบงค็อก", FlexMessageDoctorSchedules(oneBangkokDoctorSchedules))
  ],
  // "สอบถามตารางแพทย์ สาขาเอสพลานาด รัชดาภิเษก": () => [
  //   createFlexMessage("สอบถามตารางแพทย์ สาขาเอสพลานาด รัชดาภิเษก", FlexMessageDoctorSchedules(esplanadeRatchadaDoctorSchedules))
  // ],
  "สอบถามตารางแพทย์ สาขาเดอะมอลล์ งามวงศ์วาน": () => [
    createFlexMessage("สอบถามตารางแพทย์ สาขาเดอะมอลล์ งามวงศ์วาน", FlexMessageDoctorSchedules(theMallNgamwongwanDoctorSchedules))
  ],
  "สอบถามตารางแพทย์ สาขาทองหล่อ": () => [
    createFlexMessage("สอบถามตารางแพทย์ สาขาทองหล่อ", FlexMessageDoctorSchedules(thonglorDoctorSchedules)),
    createFlexMessage("สอบถามตารางแพทย์ สาขาทองหล่อ", FlexMessageDoctorSchedules(thonglorDoctorSchedules2))
  ],
  "สอบถามตารางแพทย์ สาขาทองหล่อ เลเซอร์เซ็นเตอร์": () => [
    createFlexMessage("สอบถามตารางแพทย์ สาขาทองหล่อ เลเซอร์เซ็นเตอร์", FlexMessageDoctorSchedules(thonglorLaserDoctorSchedules))
  ],
  "สอบถามตารางแพทย์ สาขาทองหล่อ เวลเนสเช็นเตอร์": () => [
    createFlexMessage("สอบถามตารางแพทย์ สาขาทองหล่อ เวลเนสเช็นเตอร์", FlexMessageDoctorSchedules(thonglorWellnessDoctorSchedules))
  ],
  "สอบถามตารางแพทย์ สาขาดุสิต เซ็นทรัล พาร์ค": () => [
    createFlexMessage("สอบถามตารางแพทย์ สาขาดุสิต เซ็นทรัล พาร์ค", FlexMessageDoctorSchedules(dusitCentralParkDoctorSchedules))
  ],
  "สอบถามตารางแพทย์ สาขาเลียบด่วน": () => [
    createFlexMessage("สอบถามตารางแพทย์ สาขาเลียบด่วน", FlexMessageDoctorSchedules(liabDuanDoctorSchedules))
  ],
};

const handleEvents = async (event) => {
  try {

    if (event.type !== 'message' || event.message.type !== 'text') {
      return null;
    }

    const messageUser = event.message.text;
    const client = new line.Client(lineConfig);
    const messageBuilder = flexMessage[messageUser];
    if (messageBuilder) {
      await client.replyMessage(event.replyToken, messageBuilder());
      return;
    }

    return null;
  } catch (error) {
    console.error("เกิดข้อผิดพลาดในการจัดการอีเวนต์:", error);
    return null;
  }
};

module.exports = router;
module.exports.flexMessage = flexMessage;
