// บริการทั้งหมด (carousel) — แต่ละ bubble = 1 บริการ
// วิธีแก้ไข: เพิ่ม/ลบ/แก้ไขรายการใน SERVICES ด้านล่างได้เลย ไม่ต้องแตะส่วนสร้าง flex

// ===== ค่าคงที่ของดีไซน์ (แก้ที่เดียว มีผลทุก bubble) =====
const PRIMARY_COLOR = "#3283e8";   // สีหัวข้อ + ปุ่ม
const TEXT_COLOR = "#000000";      // สีข้อความรอง
const BADGE_COLOR = "#EC3D44";     // สีป้าย HOT!
const BODY_BG_COLOR = "#FFFFFF";   // สีพื้นหลังเนื้อหา
const IMAGE_ASPECT_RATIO = "150:105";
const BADGE_LABEL = "HOT!";
const BUTTON_LABEL = "สอบถามโปรโมชั่น";

// ===== ข้อมูลบริการ =====
// image       : URL รูปหัวการ์ด
// title       : ชื่อโปรแกรม (ตัวหนาสีน้ำเงิน)
// inquiryText : ข้อความใต้หัวข้อ + ข้อความที่ส่งเมื่อกดปุ่ม (ใช้ค่าเดียวกัน)
// hot         : true = แสดงป้าย HOT! มุมซ้ายบน (ละไว้ = ไม่แสดง)
const SERVICES = [
    {
        image: "https://www.vsquareclinic.com/wp-content/uploads/2026/04/Botox.jpg",
        title: "โปรแกรมฉีด โบท็อกซ์",
        inquiryText: "Botox Program",
        actionText: "สอบถามโปรโมชั่นโปรแกรมฉีด โบท็อกซ์",
        hot: true
    },
    {
        image: "https://www.vsquareclinic.com/wp-content/uploads/2026/04/Filler-1.jpg",
        title: "โปรแกรมฉีด ฟิลเลอร์",
        inquiryText: "Filler Program",
        actionText: "สอบถามโปรโมชั่นโปรแกรมฉีด ฟิลเลอร์",
        hot: true
    },
    {
        image: "https://www.vsquareclinic.com/wp-content/uploads/2026/06/ปากกาลดน้ำหนัก.png",
        title: "โปรแกรม V Safe Slim",
        inquiryText: "V Safe Slim Program",
        actionText: "สอบถามโปรโมชั่นโปรแกรม V Safe Slim",
        hot: true
    },
    {
        image: "https://www.vsquareclinic.com/wp-content/uploads/2026/04/04_เครื่องยกกระชับ.jpg",
        title: "โปรแกรมเครื่องยกกระชับ",
        inquiryText: "Facial Lifting Program",
        actionText: "สอบถามโปรโมชั่นโปรแกรมเครื่องยกกระชับ",
        hot: true
    },
    {
        image: "https://www.vsquareclinic.com/wp-content/uploads/2026/04/03_กระตุ้นคอลลาเจน.jpg",
        title: "โปรแกรมฉีด กระตุ้นคอลลาเจน",
        inquiryText: "Biostimulator Program",
        actionText: "สอบถามโปรโมชั่นโปรแกรมฉีด กระตุ้นคอลลาเจน",
        hot: true
    },
    {
        image: "https://www.vsquareclinic.com/wp-content/uploads/2026/06/โปรคอลลาเจนสด.jpg",
        title: "โปรแกรมคอลลาเจนสด",
        inquiryText: "Collagen Program",
        actionText: "สอบถามโปรโมชั่นโปรแกรมคอลลาเจนสด",
        hot: true
    },
    {
        image: "https://www.vsquareclinic.com/wp-content/uploads/2026/06/โปรดริปวิตามิน.1.jpg",
        title: "โปรแกรมดริปวิตามิน",
        inquiryText: "IV Drip Vitamin Program",
        actionText: "สอบถามโปรโมชั่นโปรแกรมดริปวิตามิน",
        hot: true
    },
    {
        image: "https://www.vsquareclinic.com/wp-content/uploads/2026/06/โปรดริปวิตามินผิว.1.jpg",
        title: "โปรแกรมหน้าใส",
        inquiryText: "V-ID Facial Program",
        actionText: "สอบถามโปรโมชั่นโปรแกรมหน้าใส",
        hot: true
    },
    {
        image: "https://www.vsquareclinic.com/wp-content/uploads/2026/04/06_อื่นๆCool-YAG.jpg",
        title: "หัตถการอื่นๆ",
        inquiryText: "สอบถามโปรโมชั่นหัตถการอื่นๆ",
        actionText: "สอบถามโปรโมชั่นหัตถการอื่นๆ",
        hot: true
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
function createServiceBody(title, inquiryText, actionText) {
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
                                "text": inquiryText,
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
function createServiceBubble(service) {
    return {
        "type": "bubble",
        "header": createServiceHeader(service.image, service.hot),
        "body": createServiceBody(service.title, service.inquiryText, service.actionText)
    };
}

function FlexMessageServicesBubble() {
    return {
        "type": "carousel",
        "contents": SERVICES.map(createServiceBubble)
    };
}

module.exports = {
    FlexMessageServicesBubble,
};
