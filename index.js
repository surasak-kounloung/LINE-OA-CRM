const express = require("express");
const bodyParser = require("body-parser");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const { notFound, errorHandler } = require("./middlewares/errorHandler");
const chatRouter = require("./routes/chatRoute");
const path = require("path");
const fs = require("fs");
const { createAdminRouter } = require("./routes/adminRoute");

const PORT = process.env.PORT || 8080;

const rawBodySaver = (req, res, buf, encoding) => {
  if (buf && buf.length) {
    req.rawBody = buf.toString(encoding || "utf8");
  }
};

const app = express();

app.use(
  express.json({
    limit: "2mb",
    verify: rawBodySaver,
  })
);

app.use(cors());
app.use(bodyParser.json());
app.use(cookieParser());

app.use("/webhook", chatRouter);

// หน้า admin + API (ต้องอยู่ก่อน app.get("/"))
app.use("/api/admin", createAdminRouter({
  store: require("./services/dataStore").getDefaultStore(),
  messageTable: chatRouter.messageTable,
}));
const adminDist = path.join(__dirname, "admin", "dist");
if (fs.existsSync(adminDist)) {
  app.use("/admin", express.static(adminDist));
} else {
  app.get("/admin", (req, res) => res.status(404).send("admin UI not built: run `npm run build` inside admin/"));
}

app.get("/", (req, res) => {
  res.send("ok");
});

app.use(notFound);
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
