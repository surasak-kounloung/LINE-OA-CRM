// โปรโมชั่นล่าสุด (carousel) — แต่ละ bubble = 1 โปรโมชั่น
// วิธีแก้ไข: เพิ่ม/ลบ/แก้ไขรายการใน PROMOTIONS ด้านล่างได้เลย ไม่ต้องแตะส่วนสร้าง flex

// ===== ค่าคงที่ของดีไซน์ (แก้ที่เดียว มีผลทุก bubble) =====
const PRIMARY_COLOR = "#3283e8";   // สีหัวข้อ + ปุ่ม
const TEXT_COLOR = "#000000";      // สีข้อความบรรยาย
const BADGE_COLOR = "#EC3D44";     // สีป้าย HOT!
const BODY_BG_COLOR = "#FFFFFF";   // สีพื้นหลังเนื้อหา
const TITLE_SIZE = "xl";
const IMAGE_ASPECT_RATIO = "150:105";
const BADGE_LABEL = "HOT!";

// ===== ข้อมูลโปรโมชั่น =====
// image       : URL รูปหัวการ์ด
// title       : ชื่อโปรโมชั่น (ตัวหนาสีน้ำเงิน)
// lines       : ข้อความบรรยายใต้หัวข้อ (ใส่ได้หลายบรรทัด)
// inquiryText : ข้อความที่ส่งเมื่อกดปุ่มสอบถาม
// hot         : true = แสดงป้าย HOT! มุมซ้ายบน (ละไว้ = ไม่แสดง)
const PROMOTIONS = [
    {
        image: "https://www.vsquareclinic.com/wp-content/uploads/2026/09/CRM_Pro-Fill-Firm-new-kv.jpg",
        title: "โปรฟิลเลอร์ FILL & FIRM",
        lines: [
            "ซื้อฟิลเลอร์ ครบ 2 CC",
            "รับฟรี Volnewmer มูลค่า 7,500 (โดย SP)"
        ],
        inquiryText: "สอบถามโปรฟิลเลอร์ FILL & FIRM",
        hot: false
    },
    {
        image: "https://www.vsquareclinic.com/wp-content/uploads/2026/06/ฟิลเลอร์หน้าไม่ล้น_1000x704_13.05.26.jpg",
        title: "โปรฟิลเลอร์",
        lines: [
            "โดยทีมแพทย์มากประสบการณ์",
            "ลดคุ้มตั้งแต่ CC แรก"
        ],
        inquiryText: "สอบถามโปรฟิลเลอร์",
        hot: false
    },
    {
        image: "https://www.vsquareclinic.com/wp-content/uploads/2026/07/โปร_SPT-Prime_Volnewmer_1000x704_06JULY26_V2.jpg",
        title: "โปร Ultherapy Prime",
        lines: [
            "ออกแบบการรักษาโดยแพทย์",
            "เทคนิคเฉพาะยิงลงถูกชั้นผิว เห็นผลจริง"
        ],
        inquiryText: "สอบถามโปร Ultherapy Prime",
        hot: false
    },
    {
        image: "https://www.vsquareclinic.com/wp-content/uploads/2026/06/CRM_Double-Perfect.jpg",
        title: "โปร Double Perfect Lift",
        lines: [
            "ทำคู่กันผิวแน่นเฟิร์ม หน้ายกชัด",
            "ออกแบบการรักษาโดยแพทย์"
        ],
        inquiryText: "สอบถามโปร Double Perfect Lift",
        hot: false
    },
    {
        image: "https://www.vsquareclinic.com/wp-content/uploads/2026/09/CRM_NewKV_FGUG_Final.jpg",
        title: "โปร เพื่อนได้ เราได้",
        lines: [
            "แนะนำเพื่อนมาใช้บริการ",
            "เลือกรับของแถม ได้ทั้งคู่ ฟรีทันที!"
        ],
        inquiryText: "สอบถามโปร เพื่อนได้ เราได้",
        hot: true
    },
    {
        image: "https://www.vsquareclinic.com/wp-content/uploads/2026/06/CRM_Ultra-DysportV8.jpg",
        title: "โปร หน้าเรียว x2",
        lines: [
            "พิเศษ เพิ่มเงินเพียง 4,000 บาท",
            "อัปเกรดเป็น Ultraformer MPT"
        ],
        inquiryText: "สอบถามโปร หน้าเรียว x2",
        hot: false
    }
];

// LINE Desktop ไม่โหลดรูปถ้า URL มีตัวอักษรที่ไม่ใช่ ASCII (เช่น ภาษาไทย)
function encodeUrlIfNeeded(url) {
    return /[^\x00-\x7F]/.test(url) ? encodeURI(url) : url;
}

// ป้าย "HOT!" ลอยมุมซ้ายบนของรูป
function createHotBadge() {
    return {
        "type": "box",
        "layout": "horizontal",
        "contents": [
            {
                "type": "text",
                "text": BADGE_LABEL,
                "size": "xs",
                "color": "#ffffff",
                "align": "center",
                "gravity": "center"
            }
        ],
        "backgroundColor": BADGE_COLOR,
        "paddingAll": "2px",
        "paddingStart": "4px",
        "paddingEnd": "4px",
        "flex": 0,
        "position": "absolute",
        "offsetStart": "10px",
        "offsetTop": "10px",
        "cornerRadius": "100px",
        "width": "48px",
        "height": "25px"
    };
}

// ส่วนหัวการ์ด: รูปโปรโมชั่น + ป้าย HOT! (ถ้ามี)
function createPromotionHeader(imageUrl, showHotBadge) {
    const headerContents = [
        {
            "type": "box",
            "layout": "vertical",
            "flex": 1,
            "contents": [
                {
                    "type": "image",
                    "url": encodeUrlIfNeeded(imageUrl),
                    "size": "full",
                    "aspectMode": "fit",
                    "gravity": "center",
                    "aspectRatio": IMAGE_ASPECT_RATIO
                }
            ]
        }
    ];

    if (showHotBadge) {
        headerContents.push(createHotBadge());
    }

    return {
        "type": "box",
        "layout": "vertical",
        "paddingAll": "0px",
        "contents": [
            {
                "type": "box",
                "layout": "horizontal",
                "contents": headerContents
            }
        ]
    };
}

// ข้อความบรรยาย 1 บรรทัด
function createDescriptionLine(text) {
    return {
        "type": "text",
        "text": text,
        "size": "sm",
        "color": TEXT_COLOR,
        "align": "center",
        "margin": "0px"
    };
}

// ส่วนเนื้อหาการ์ด: ชื่อโปรโมชั่น + บรรทัดบรรยาย + ปุ่มสอบถาม
function createPromotionBody(title, lines, inquiryText) {
    const textContents = [
        {
            "type": "box",
            "layout": "vertical",
            "paddingTop": "0px",
            "paddingStart": "0px",
            "paddingBottom": "6px",
            "paddingEnd": "0px",
            "contents": [
                {
                    "type": "text",
                    "text": title,
                    "size": TITLE_SIZE,
                    "weight": "bold",
                    "color": PRIMARY_COLOR,
                    "align": "center",
                    "wrap": true
                }
            ]
        },
        ...lines.map(createDescriptionLine)
    ];

    return {
        "type": "box",
        "layout": "vertical",
        "backgroundColor": BODY_BG_COLOR,
        "paddingTop": "15px",
        "paddingStart": "20px",
        "paddingBottom": "20px",
        "paddingEnd": "20px",
        "contents": [
            {
                "type": "box",
                "layout": "vertical",
                "contents": [
                    {
                        "type": "box",
                        "layout": "vertical",
                        "spacing": "sm",
                        "contents": textContents
                    },
                    {
                        "type": "button",
                        "action": {
                            "type": "message",
                            "label": inquiryText,
                            "text": inquiryText
                        },
                        "color": PRIMARY_COLOR,
                        "style": "primary",
                        "margin": "15px",
                        "height": "sm"
                    }
                ]
            }
        ]
    };
}

// ประกอบ 1 bubble จากข้อมูลโปรโมชั่น 1 รายการ
function createPromotionBubble(promotion) {
    return {
        "type": "bubble",
        "header": createPromotionHeader(promotion.image, promotion.hot),
        "body": createPromotionBody(promotion.title, promotion.lines, promotion.inquiryText)
    };
}

function FlexMessagePromotionBubble() {
    return {
        "type": "carousel",
        "contents": PROMOTIONS.map(createPromotionBubble)
    };
}

module.exports = {
    FlexMessagePromotionBubble,
    PROMOTIONS,
};
