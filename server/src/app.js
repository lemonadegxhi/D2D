const express = require("express");
const cors = require("cors");

const routes = require("./routes");
const { clientUrl } = require("./config/env");

const app = express();

app.use(
  cors({
    origin: clientUrl,
  })
);
app.use(express.json({ limit: "12mb" }));

app.use("/api", routes);

module.exports = app;
