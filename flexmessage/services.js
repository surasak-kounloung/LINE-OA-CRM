// บริการทั้งหมด (carousel) — แต่ละ bubble = 1 บริการ
// วิธีแก้ไข: แก้ใน data/services.json หรือหน้า admin ไม่ต้องแตะไฟล์นี้

// ===== ค่าคงที่ของดีไซน์ (แก้ที่เดียว มีผลทุก bubble) =====
const PRIMARY_COLOR = "#3283e8";   // สีหัวข้อ + ปุ่ม
const TEXT_COLOR = "#000000";      // สีข้อความรอง
const BADGE_COLOR = "#EC3D44";     // สีป้าย HOT!
const BODY_BG_COLOR = "#FFFFFF";   // สีพื้นหลังเนื้อหา
const IMAGE_ASPECT_RATIO = "150:105";
const BADGE_LABEL = "HOT!";
const BUTTON_LABEL = "สอบถามโปรโมชั่น";

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

// ส่วนหัวการ์ด: รูปบริการ + ป้าย HOT! (ถ้ามี)
function createServiceHeader(imageUrl, showHotBadge) {
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

// ส่วนเนื้อหาการ์ด: ชื่อโปรแกรม + ข้อความรอง + ปุ่มสอบถาม
function createServiceBody(title, subtitle, actionText) {
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
                        "contents": [
                            {
                                "type": "text",
                                "text": title,
                                "size": "lg",
                                "weight": "bold",
                                "color": PRIMARY_COLOR,
                                "align": "center",
                                "wrap": true
                            },
                            {
                                "type": "text",
                                "text": subtitle,
                                "size": "sm",
                                "color": TEXT_COLOR,
                                "align": "center"
                            }
                        ]
                    },
                    {
                        "type": "button",
                        "action": {
                            "type": "message",
                            "label": BUTTON_LABEL,
                            "text": actionText
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

// ประกอบ 1 bubble จากข้อมูลบริการ 1 รายการ
// service: { image, title, subtitle, actionText, hot }
function createServiceBubble(service) {
    return {
        "type": "bubble",
        "header": createServiceHeader(service.image, service.hot),
        "body": createServiceBody(service.title, service.subtitle, service.actionText)
    };
}

// รับรายการบริการจาก data/services.json
function FlexMessageServicesBubble(services = []) {
    return {
        "type": "carousel",
        "contents": services.map(createServiceBubble)
    };
}

module.exports = {
    FlexMessageServicesBubble,
};
