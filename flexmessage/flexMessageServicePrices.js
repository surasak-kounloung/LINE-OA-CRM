// LINE Desktop ไม่โหลดรูปถ้า URL มีตัวอักษรที่ไม่ใช่ ASCII (เช่น ภาษาไทย)
function encodeUrlIfNeeded(url) {
    return /[^\x00-\x7F]/.test(url) ? encodeURI(url) : url;
}

// 1 รูป = 1 การ์ด แสดงเต็มการ์ด ไม่มีขอบขาว
// aspectRatio ต้องตรงกับสัดส่วนรูปจริง (เช่น รูป 1000x901 -> "1000:901")
// เมื่อสัดส่วนตรงกัน aspectMode: "cover" จะเติมเต็มกรอบพอดีโดยไม่ crop
function createPriceCard(imageUrl = "", aspectRatio = "1000:901") {
    return {
        "type": "bubble",
        "hero": {
            "type": "image",
            "url": encodeUrlIfNeeded(imageUrl),
            "size": "full",
            "aspectRatio": aspectRatio,
            "aspectMode": "cover"
        }
    };
}

// รับข้อมูลได้หลายรูปแบบ แล้วคืนเป็น array ของ URL (string) เสมอ
// - { imagePriceUrl: ["url1", "url2", ...] }
// - { imagePriceUrl: "url" }
// - ["url1", "url2", ...]
// - "url"
function normalizeImageUrls(pricesData) {
    let raw = pricesData;

    if (raw && typeof raw === "object" && !Array.isArray(raw)) {
        raw = raw.imagePriceUrl;
    }

    const list = Array.isArray(raw) ? raw : [raw];

    return list.filter((url) => typeof url === "string" && url.trim() !== "");
}

function FlexMessageServicePrices(pricesData) {
    const imageUrls = normalizeImageUrls(pricesData);
    if (!imageUrls.length) {
        throw new Error("FlexMessageServicePrices ต้องระบุ URL รูปภาพอย่างน้อย 1 รายการ");
    }

    // รองรับการกำหนด aspectRatio รวมผ่าน object (ใช้กับทุกการ์ด)
    const aspectRatio =
        pricesData && typeof pricesData === "object" && !Array.isArray(pricesData)
            ? pricesData.aspectRatio || "1000:901"
            : "1000:901";

    // LINE carousel รองรับสูงสุด 12 bubble ต่อ 1 ข้อความ
    const contents = imageUrls.slice(0, 12).map((url) => createPriceCard(url, aspectRatio));

    return {
        "type": "carousel",
        "contents": contents
    };
}

module.exports = {
    FlexMessageServicePrices,
    createPriceCard
};
