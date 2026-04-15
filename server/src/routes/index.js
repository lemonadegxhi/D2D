const express = require("express");

const pool = require("../config/db");

const router = express.Router();

router.get("/", (req, res) => {
  res.json({
    message: "DAY2DAY API is running.",
  });
});

router.get("/health", async (req, res) => {
  try {
    const result = await pool.query("SELECT NOW() AS current_time");

    res.json({
      status: "ok",
      database: "connected",
      time: result.rows[0].current_time,
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      database: "disconnected",
      message: error.message,
    });
  }
});

module.exports = router;
