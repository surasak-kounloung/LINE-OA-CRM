// การ์ดแผนที่/ข้อมูลติดต่อสาขา (carousel)
// โครงสร้าง flex แบบ normal flow (ไม่ใช้ offset/px hack) เพื่อให้แสดงผลตรงกันทั้งมือถือและ LINE Desktop

const LABEL_COLOR = "#aaaaaa";
const VALUE_COLOR = "#8a8a8a";

// สัดส่วนคอลัมน์ของแถวข้อมูล (label : value) — ใช้ flex จัดให้ค่าตรงคอลัมน์กันทุกแถว
const LABEL_FLEX = 2;
const VALUE_FLEX = 4;

// LINE Desktop ไม่โหลดรูปถ้า URL มีตัวอักษรที่ไม่ใช่ ASCII (เช่น ภาษาไทย)
function encodeUrlIfNeeded(url) {
    return /[^\x00-\x7F]/.test(url) ? encodeURI(url) : url;
}

// ตัดช่องว่างและขีดออกจากเบอร์โทร เช่น "091 916 9000" → "0919169000" (สำหรับลิงก์ tel:)
function sanitizePhoneNumber(phoneNumber) {
    return String(phoneNumber).replace(/[\s-]/g, "");
}

// แถวข้อมูล: ป้ายกำกับซ้าย + ค่าขวา (จัดคอลัมน์ด้วย flex ไม่ใช้ margin px)
function createInfoRow(label, value, actionUri) {
    return {
        "type": "box",
        "layout": "baseline",
        "paddingTop": "0px",
        "paddingBottom": "0px",
        "paddingStart": "20px",
        "paddingEnd": "20px", 
        "margin": "2px", 
        "contents": [
            {
                "type": "text",
                "text": label,
                "size": "sm",
                "color": LABEL_COLOR,
                "flex": LABEL_FLEX
            },
            {
                "type": "text",
                "text": value,
                "size": "sm",
                "color": VALUE_COLOR,
                "align": "start",
                "flex": VALUE_FLEX,
                "action": {
                    "type": "uri",
                    "uri": actionUri
                }
            }
        ]
    };
}

function createBranchMapCard(branch = {}) {
    const {
        branchName = "",
        fontSize = "",
        mapUrl = "",
        imageUrl = "",
        phoneNumber = "",
        lineId = "",
        lineUrl = ""
    } = branch;

    return {
        "type": "bubble",
        "hero": {
            "type": "image",
            "url": encodeUrlIfNeeded(imageUrl),
            "size": "full",
            "aspectRatio": "20:13",
            "aspectMode": "cover",
            "action": {
                "type": "uri",
                "uri": mapUrl
            }
        },
        "body": {
            "type": "box",
            "layout": "vertical",
            "paddingTop": "15px",
            "paddingBottom": "0px",
            "paddingStart": "0px",
            "paddingEnd": "0px", 
            "contents": [
                {
                    "type": "box",
                    "layout": "vertical",
                    "paddingTop": "0px",
                    "paddingBottom": "2px",
                    "paddingStart": "20px",
                    "paddingEnd": "20px", 
                    "contents": [
                        {
                            "type": "text",
                            "text": branchName,
                            "weight": "bold",
                            "size": fontSize,
                            "wrap": true
                        },
                    ]
                },
                {
                    "type": "box",
                    "layout": "vertical",
                    "paddingTop": "0px",
                    "paddingBottom": "20px",
                    "paddingStart": "0px",
                    "paddingEnd": "0px", 
                    "contents": [
                        createInfoRow("เบอร์โทร", phoneNumber, `tel:${sanitizePhoneNumber(phoneNumber)}`),
                        createInfoRow("ไลน์", lineId, lineUrl),
                    ]
                },
                {
                    "type": "separator",
                    "margin": "0px"
                }
            ]
        },
        "footer": {
            "type": "box",
            "layout": "vertical",
            "paddingTop": "5px",
            "paddingBottom": "10px",
            "paddingStart": "0px",
            "paddingEnd": "0px",
            "contents": [
                {
                    "type": "button",
                    "height": "sm",
                    "action": {
                        "type": "uri",
                        "label": "ดูแผนที่",
                        "uri": mapUrl
                    }
                }
            ]
        }
    };
}

function normalizeBranchList(branches) {
    if (Array.isArray(branches)) {
        return branches.filter((branch) => branch && typeof branch === "object");
    }

    if (branches && typeof branches === "object") {
        return [branches];
    }

    return [];
}

function FlexMessageBranchMap(branchesData) {
    const branchList = normalizeBranchList(branchesData);
    if (!branchList.length) {
        throw new Error("FlexMessageBranchMap ต้องระบุข้อมูลสาขาอย่างน้อย 1 รายการ");
    }
    const contents = branchList.map(createBranchMapCard);

    return {
        "type": "carousel",
        "contents": contents
    };
}

module.exports = {
    FlexMessageBranchMap,
    createBranchMapCard
};
