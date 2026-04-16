const express = require("express");

const { authenticateUser, registerUser } = require("../services/authService");

const router = express.Router();

router.post("/signup", async (req, res) => {
  const { username, password } = req.body ?? {};

  if (!username || !password) {
    return res.status(400).json({
      message: "Username and password are required.",
    });
  }

  try {
    const user = await registerUser(username, password);

    return res.status(201).json({
      message: "Account created successfully.",
      user,
    });
  } catch (error) {
    const status =
      error.message === "Username already exists."
        ? 409
        : error.message.includes("at least")
          ? 400
          : 500;

    return res.status(status).json({
      message: "Failed to create account.",
      error: error.message,
    });
  }
});

router.post("/login", async (req, res) => {
  const { username, password } = req.body ?? {};

  if (!username || !password) {
    return res.status(400).json({
      message: "Username and password are required.",
    });
  }

  try {
    const user = await authenticateUser(username, password);

    if (!user) {
      return res.status(401).json({
        message: "Invalid credentials.",
      });
    }

    return res.json({
      message: "Login successful.",
      user,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to authenticate user.",
      error: error.message,
    });
  }
});

module.exports = router;
