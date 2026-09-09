// Not Found
const notFound = (req, res, next) => {
    const error = new Error(`Not Found : ${req.originalUrl}`);
    res.status(404);
    next(error);
}

// Error Handler
// ไม่ส่ง stack trace กลับไปให้ client — log ไว้ฝั่ง server เท่านั้น
const errorHandler = (err, req, res, next) => {
    const statuscode = res.statusCode == 200 ? 500 : res.statusCode;
    console.error(err);
    res.status(statuscode).json({
        message: err?.message || "Internal Server Error",
    });
}

module.exports = { errorHandler, notFound };