// โปรโมชั่นล่าสุด (carousel) — แต่ละ bubble = 1 โปรโมชั่น
// วิธีแก้ไข: แก้ใน data/promotions.json หรือหน้า admin ไม่ต้องแตะไฟล์นี้

// ===== ค่าคงที่ของดีไซน์ (แก้ที่เดียว มีผลทุก bubble) =====
const PRIMARY_COLOR = "#3283e8";   // สีหัวข้อ + ปุ่ม
const TEXT_COLOR = "#000000";      // สีข้อความบรรยาย
const BADGE_COLOR = "#EC3D44";     // สีป้าย HOT!
const BODY_BG_COLOR = "#FFFFFF";   // สีพื้นหลังเนื้อหา
const TITLE_SIZE = "xl";
const IMAGE_ASPECT_RATIO = "150:105";
const BADGE_LABEL = "HOT!";

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

// รับรายการโปรโมชั่นจาก data/promotions.json
// promotion: { image, title, lines: string[], inquiryText, hot }
function FlexMessagePromotionBubble(promotions = []) {
    return {
        "type": "carousel",
        "contents": promotions.map(createPromotionBubble)
    };
}

module.exports = {
    FlexMessagePromotionBubble,
};
