// บริการทั้งหมด
// โครงสร้าง flex แบบ normal flow (ไม่ใช้ offset/px hack) เพื่อให้แสดงผลตรงกันทั้งมือถือและ LINE Desktop

const TITLE_COLOR = "#2549a2";
const SEPARATOR_COLOR = "#79b9e5";
const LOCATION_ICON_URL = "https://www.vsquareclinic.com/wp-content/uploads/2026/04/icon-blue-location-3d.png";
const ARROW_ICON_URL = "https://www.vsquareclinic.com/wp-content/uploads/2026/04/icon-angle-right.png";

// ข้อมูลสาขาแยกตามภูมิภาค (1 กลุ่ม = 1 bubble, extraSections = หัวข้อย่อยใน bubble เดียวกัน)
// แต่ละสาขาใส่ได้ 2 แบบ:
//   1) string         → "ชื่อสาขา" (กดแล้วส่งข้อความ = ชื่อสาขา)
//   2) object         → { name: "ชื่อที่แสดง", actionText: "ข้อความที่ส่งตอนกด" }
//                       ใช้เมื่อต้องการให้ข้อความ action ต่างจากชื่อที่แสดง
const BRANCH_GROUPS = [
    {
        title: "กรุงเทพฯ ในเมือง",
        branches: [
            "สยาม สแควร์ วัน",
            "เซ็นทรัล เวิล์ด",
            "เทอร์มินอล อโศก",
            "พระราม 9"
            // "เอสพลานาด รัชดาภิเษก"
        ]
    },
    {
        title: "กรุงเทพฯ ตอนเหนือ",
        branches: [
            "เซ็นทรัล ลาดพร้าว",
            "เมเจอร์ รัชโยธิน",
            "เซ็นทรัล รามอินทรา",
            "เดอะมอลล์ งามวงศ์วาน",
            "เซ็นทรัล อีสวิลล์",
            "เลียบด่วน"
        ]
    },
    {
        title: "กรุงเทพฯ ฝั่งตะวันออก",
        branches: [
            "เดอะ พรอมานาด",
            "เดอะมอลล์ บางกะปิ",
            "ซีคอน สแควร์ ศรีนครินทร์",
            "เมกา บางนา",
            "เซ็นทรัล บางนา"
        ]
    },
    {
        title: "กรุงเทพฯ ฝั่งธนบุรี",
        branches: [
            "เซ็นทรัล ปิ่นเกล้า",
            "เดอะมอลล์ ท่าพระ",
            "เซ็นทรัล พระราม 2",
            "เดอะมอลล์ บางแค",
            "พาซิโอ กาญจนา"
        ]
    },
    {
        title: "กรุงเทพฯ ตอนใต้",
        branches: [
            "ดุสิต เซ็นทรัล พาร์ค",
            "วัน แบงค็อก",
            { name: "ทองหล่อ", actionText: "ตารางแพทย์สาขาทองหล่อ" },
            "เอ็มควอเทียร์",
            "เกตเวย์ เอกมัย",
            "เซ็นทรัล พระราม 3"
        ]
    },
    {
        title: "กรุงเทพฯ-ปทุมธานี",
        branches: [
            "ฟิวเจอร์พาร์ค รังสิต"
        ],
        extraSections: [
            {
                title: "กรุงเทพฯ-นนทบุรี",
                branches: [
                    "เซ็นทรัล เวสต์วิลล์",
                    "เซ็นทรัล เวสต์เกต",
                    "เซ็นทรัล แจ้งวัฒนะ"
                ]
            }
        ]
    },
    {
        title: "กรุงเทพฯ-นครปฐม",
        branches: [
            // "เซ็นทรัล ศาลายา",
            "เซ็นทรัล นครปฐม"
        ]
        // extraSections: [
        //     {
        //         title: "กรุงเทพฯ-สมุทรสาคร",
        //         branches: ["เซ็นทรัล มหาชัย"]
        //     }
        // ]
    }
];

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

function FlexMessageTableDoctorsBubble() {
    return {
        "type": "carousel",
        "contents": BRANCH_GROUPS.map(createBranchBubble)
    };
}

module.exports = {
    FlexMessageTableDoctorsBubble,
};
