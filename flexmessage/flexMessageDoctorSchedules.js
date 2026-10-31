// บริการทั้งหมด
const DEFAULT_BACKGROUND = {
    "type": "linearGradient",
    "angle": "0deg",
    "startColor": "#ffffff",
    "endColor": "#e6f0ff"
};

const DEFAULT_TEXT_COLOR = "#2549a2";
const DEFAULT_IMAGE_BOX_HEIGHT = "280px";
const DEFAULT_BUBBLE_HEIGHT = "315px";

// LINE Desktop ไม่โหลดรูปถ้า URL มีตัวอักษรที่ไม่ใช่ ASCII (เช่น ภาษาไทย)
function encodeUrlIfNeeded(url) {
    return /[^\x00-\x7F]/.test(url) ? encodeURI(url) : url;
}

// LINE proxy (obs.line-scdn.net) cache รูปตาม URL ระยะยาว ถ้าเคย cache รูปพังไว้
// (เช่น path ภาษาไทยที่ LINE Desktop โหลดไม่ได้) ให้ขยับเลขนี้เพื่อบังคับให้ดึงใหม่
// ใช้ค่าคงที่เท่านั้น — อย่าใช้ timestamp/random ไม่งั้น LINE จะดึงรูปใหม่ทุกข้อความ
const IMAGE_CACHE_VERSION = "2";

function withCacheBust(url) {
    if (!url) return url;
    const separator = url.includes("?") ? "&" : "?";
    return `${url}${separator}v=${IMAGE_CACHE_VERSION}`;
}

// รวม 2 ขั้นตอน: encode ASCII ก่อน แล้วค่อยต่อ cache-bust
function buildImageUrl(url) {
    return withCacheBust(encodeUrlIfNeeded(url));
}

function createDoctorCard(doctor = {}) {
    const {
        day = "",
        name = "",
        license = "",
        imageUrl = ""
    } = doctor;

    return {
        "type": "bubble",
        "size": "deca",
        "body": {
            "type": "box",
            "layout": "vertical",
            "contents": [
                {
                    "type": "box",
                    "layout": "vertical",
                    "contents": [
                        {
                            "type": "text",
                            "text": day,
                            "align": "center",
                            "gravity": "center",
                            "offsetBottom": "-5px",
                            "size": "lg",
                            "weight": "bold",
                            "offsetTop": "10px"
                        },
                        {
                            "type": "image",
                            "size": "600px",
                            "aspectRatio": "10:12",
                            "aspectMode": "fit",
                            "url": buildImageUrl(imageUrl),
                            "gravity": "center",
                            "align": "center"
                        }
                    ],
                    "height": DEFAULT_IMAGE_BOX_HEIGHT,
                    "offsetBottom": "10px"
                },
                {
                    "type": "text",
                    "text": name,
                    "wrap": false,
                    "weight": "regular",
                    "size": "md",
                    "gravity": "center",
                    "align": "center",
                    "color": DEFAULT_TEXT_COLOR,
                    "offsetBottom": "-5px",
                    "offsetTop": "-40px"
                },
                {
                    "type": "box",
                    "layout": "baseline",
                    "contents": [
                        {
                            "type": "text",
                            "text": license,
                            "wrap": false,
                            "weight": "bold",
                            "size": "md",
                            "flex": 0,
                            "align": "center",
                            "gravity": "center",
                            "color": DEFAULT_TEXT_COLOR
                        }
                    ],
                    "justifyContent": "center",
                    "offsetBottom": "-5px",
                    "offsetTop": "-40px"
                }
            ],
            "backgroundColor": "#e6f0ff",
            "background": DEFAULT_BACKGROUND,
            "height": DEFAULT_BUBBLE_HEIGHT
        },
        "styles": {
            "body": {
                "separator": true
            }
        }
    };
}

function FlexMessageDoctorSchedules(doctors = []) {
    const doctorList = Array.isArray(doctors) ? doctors : [];

    return {
        "type": "carousel",
        "contents": doctorList.map(createDoctorCard)
    };
}

module.exports = {
    FlexMessageDoctorSchedules,
    createDoctorCard
};