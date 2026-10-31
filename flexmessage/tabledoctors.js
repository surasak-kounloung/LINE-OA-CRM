// บริการทั้งหมด
// โครงสร้าง flex แบบ normal flow (ไม่ใช้ offset/px hack) เพื่อให้แสดงผลตรงกันทั้งมือถือและ LINE Desktop

const TITLE_COLOR = "#2549a2";
const SEPARATOR_COLOR = "#79b9e5";
const LOCATION_ICON_URL = "https://www.vsquareclinic.com/wp-content/uploads/2026/04/icon-blue-location-3d.png";
const ARROW_ICON_URL = "https://www.vsquareclinic.com/wp-content/uploads/2026/04/icon-angle-right.png";

// ส่วนหัวข้อ: " สาขา" + ชื่อภูมิภาค + ไอคอนหมุดด้านขวา
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

// แปลงข้อมูลสาขาให้เป็นรูปแบบมาตรฐาน { name, actionText }
// รองรับทั้งแบบ string และแบบ object — ถ้าไม่ระบุ actionText จะใช้ชื่อสาขาเป็นข้อความ action
function normalizeBranch(branch) {
    if (typeof branch === "string") {
        return { name: branch, actionText: branch };
    }
    return { name: branch.name, actionText: branch.actionText || branch.name };
}

// แถวชื่อสาขา: ข้อความซ้าย + ลูกศรขวา กดแล้วส่งข้อความ action (กำหนดแยกจากชื่อที่แสดงได้)
function createBranchRow(branch) {
    const { name, actionText } = normalizeBranch(branch);
    return {
        "type": "box",
        "layout": "baseline",
        "action": {
            "type": "message",
            "text": actionText
        },
        "paddingTop": "10px",
        "paddingBottom": "10px",
        "paddingStart": "25px",
        "paddingEnd": "30px",
        "contents": [
            {
                "type": "text",
                "text": name,
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

// แถบหัวข้อย่อยสีขาว (กรณีมีหลายภูมิภาคใน bubble เดียว)
// กว้างเกินขอบ bubble เพื่อให้มุมขวาถูก clip ทิ้ง เหลือมุมโค้งเฉพาะด้านซ้าย
function createSectionHeader(title) {
    return {
        "type": "box",
        "layout": "vertical",
        "width": "400px",
        "backgroundColor": "#ffffff",
        "cornerRadius": "25px",
        "paddingTop": "20px",
        "paddingBottom": "20px",
        "contents": [
            {
                // พื้นที่เนื้อหาจริง ล็อกเท่าความกว้าง bubble เพื่อไม่ให้ไอคอนหลุดขอบ
                "type": "box",
                "layout": "vertical",
                "width": "300px",
                "paddingStart": "20px",
                "paddingEnd": "20px",
                "contents": [
                    createTitleContent(title)
                ]
            }
        ]
    };
}

function createBranchRows(branches) {
    const rows = [];
    branches.forEach((branch) => {
        rows.push(createBranchRow(branch));
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
        "paddingBottom": "10px",
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
    // กลุ่มหลัก = กล่อง gradient ของตัวเอง
    const bodyContents = [createColoredCard(createBranchRows(group.branches))];

    // แต่ละ extraSection = หัวข้อย่อยสีขาว + กล่อง gradient แยกของตัวเอง
    (group.extraSections || []).forEach((section) => {
        bodyContents.push(createSectionHeader(section.title));
        bodyContents.push(createColoredCard(createBranchRows(section.branches)));
    });

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
            "contents": bodyContents
        }
    };
}

// groups: [{ title, branches: [{ name, actionText }], extraSections?: [{ title, branches }] }]
// สร้างจาก data/regions.json + data/branches.json ใน services/messageTable.js
function FlexMessageTableDoctorsBubble(groups = []) {
    return {
        "type": "carousel",
        "contents": groups.map(createBranchBubble)
    };
}

module.exports = {
    FlexMessageTableDoctorsBubble,
};
