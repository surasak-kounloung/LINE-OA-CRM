const express = require("express");
const bodyParser = require("body-parser");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const { notFound, errorHandler } = require("./middlewares/errorHandler");
const chatRouter = require("./routes/chatRoute");

const PORT = process.env.PORT || 8080;

const rawBodySaver = (req, res, buf, encoding) => {
  if (buf && buf.length) {
    req.rawBody = buf.toString(encoding || "utf8");
  }
};

const app = express();

app.use(
  express.json({
    verify: rawBodySaver,
  })
);

app.use(cors());
app.use(bodyParser.json());
app.use(cookieParser());

app.use("/webhook", chatRouter);
app.use("/", (req, res) => {
  res.send("ok");
});

app.use(notFound);
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
