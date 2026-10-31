// Not Found
const notFound = (req, res, next) => {
    const error = new Error(`Not Found : ${req.originalUrl}`);
    res.status(404);
    next(error);
}

// Error Handler
// ไม่ส่ง stack trace กลับไปให้ client — log ไว้ฝั่ง server เท่านั้น
const errorHandler = (err, req, res, next) => {
    // error ที่ประกาศเองว่าเป็นความผิดของฝั่งที่ส่งมา (body-parser: JSON พัง = 400, body ใหญ่เกิน = 413)
    // ใช้ status นั้น และ log บรรทัดเดียว — ไม่พิมพ์ stack หรือ body เพราะใครก็ยิง /webhook แบบนี้ได้โดยไม่ต้องมี signature
    const clientStatus = Number(err?.status || err?.statusCode);
    if (err?.expose === true && clientStatus >= 400 && clientStatus < 500) {
        console.warn(`${req.method} ${req.originalUrl} ${clientStatus}: ${err.message}`);
        return res.status(clientStatus).json({ message: err.message });
    }
    const statuscode = res.statusCode == 200 ? 500 : res.statusCode;
    console.error(err);
    res.status(statuscode).json({
        message: err?.message || "Internal Server Error",
    });
}

module.exports = { errorHandler, notFound };