// ตารางสาขาทองหล่อ
// โครงสร้าง flex แบบ normal flow (ไม่ใช้ offset/px hack) ให้แสดงผลตรงกันทั้งมือถือและ LINE Desktop
// โครงสร้างเดียวกับ tabledoctors.js เพื่อให้หน้าตาสอดคล้องกัน

const TITLE_COLOR = "#2549a2";
const SEPARATOR_COLOR = "#79b9e5";
const LOCATION_ICON_URL = "https://www.vsquareclinic.com/wp-content/uploads/2026/04/icon-blue-location-3d.png";
const ARROW_ICON_URL = "https://www.vsquareclinic.com/wp-content/uploads/2026/04/icon-angle-right.png";

// ข้อมูลสาขา (1 กลุ่ม = 1 bubble)
const BRANCH_GROUP = {
    title: "กรุงเทพฯ ตอนใต้",
    branches: [
        "ทองหล่อ",
        "ทองหล่อ เลเซอร์เซ็นเตอร์",
        "ทองหล่อ เวลเนสเช็นเตอร์"
    ]
};

// ส่วนหัวข้อ: "สาขา" + ชื่อภูมิภาค + ไอคอนหมุดด้านขวา
function createTitleContent(title) {
    return {
        "type": "box",
        "layout": "horizontal",
        "alignItems": "center",
        "contents": [
            {
                "type": "box",
                "layout": "vertical",
                "flex": 1,
                "contents": [
                    {
                        "type": "text",
                        "text": "สาขา",
                        "color": TITLE_COLOR,
                        "size": "sm"
                    },
                    {
                        "type": "text",
                        "text": title,
                        "color": TITLE_COLOR,
                        "size": "xl",
                        "weight": "bold"
                    }
                ]
            },
            {
                "type": "box",
                "layout": "baseline",
                "flex": 0,
                "contents": [
                    {
                        "type": "icon",
                        "url": LOCATION_ICON_URL,
                        "size": "3xl"
                    }
                ]
            }
        ]
    };
}

// แถวชื่อสาขา: ข้อความซ้าย + ลูกศรขวา กดแล้วส่งข้อความชื่อสาขา
function createBranchRow(branchName) {
    return {
        "type": "box",
        "layout": "baseline",
        "action": {
            "type": "message",
            "text": branchName
        },
        "paddingTop": "10px",
        "paddingBottom": "10px",
        "paddingStart": "25px",
        "paddingEnd": "30px",
        "contents": [
            {
                "type": "text",
                "text": branchName,
                "color": TITLE_COLOR,
                "size": "md",
                "flex": 1
            },
            {
                "type": "icon",
                "url": ARROW_ICON_URL,
                "size": "sm"
            }
        ]
    };
}

function createRowSeparator() {
    return {
        "type": "box",
        "layout": "vertical",
        "paddingStart": "25px",
        "paddingEnd": "30px",
        "contents": [
            {
                "type": "separator",
                "color": SEPARATOR_COLOR
            }
        ]
    };
}

function createBranchRows(branches) {
    const rows = [];
    branches.forEach((branchName) => {
        rows.push(createBranchRow(branchName));
        rows.push(createRowSeparator());
    });
    return rows;
}

// กล่องสี gradient (1 ภูมิภาค = 1 กล่อง) กว้างเกินขอบ bubble (mega = 300px)
// เพื่อให้มุมขวาถูก clip ทิ้ง เหลือมุมโค้งเฉพาะด้านซ้าย
function createColoredCard(rowContents) {
    return {
        "type": "box",
        "layout": "vertical",
        "width": "400px",
        "backgroundColor": "#e7f5ff",
        "background": {
            "type": "linearGradient",
            "angle": "0deg",
            "startColor": "#ffffff",
            "centerColor": "#ffffff",
            "endColor": "#d5edff"
        },
        "cornerRadius": "40px",
        "paddingTop": "10px",
        "paddingBottom": "35px",
        "contents": [
            {
                // พื้นที่เนื้อหาจริง ล็อกเท่าความกว้าง bubble เพื่อไม่ให้ลูกศรหลุดขอบ
                "type": "box",
                "layout": "vertical",
                "width": "300px",
                "contents": rowContents
            }
        ]
    };
}

function createBranchBubble(group) {
    return {
        "type": "bubble",
        "size": "mega",
        "header": {
            "type": "box",
            "layout": "vertical",
            "backgroundColor": "#ffffff",
            "paddingAll": "20px",
            "contents": [
                createTitleContent(group.title)
            ]
        },
        "body": {
            "type": "box",
            "layout": "vertical",
            "paddingAll": "0px",
            "contents": [
                createColoredCard(createBranchRows(group.branches))
            ]
        }
    };
}

function FlexMessageTableDoctorsThonglorBubble() {
    return {
        "type": "carousel",
        "contents": [
            createBranchBubble(BRANCH_GROUP)
        ]
    };
}

module.exports = {
    FlexMessageTableDoctorsThonglorBubble,
};
