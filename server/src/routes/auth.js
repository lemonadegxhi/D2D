const express = require("express");

const {
  authenticateUser,
  changeUserPassword,
  registerUser,
} = require("../services/authService");

const router = express.Router();

router.post("/signup", async (req, res) => {
  const { email, username, password } = req.body ?? {};

  if (!email || !username || !password) {
    return res.status(400).json({
      message: "Email, username, and password are required.",
    });
  }

  try {
    const user = await registerUser(email, username, password);

    return res.status(201).json({
      message: "Account created successfully.",
      user,
    });
  } catch (error) {
    const status =
      error.message === "Username or email already exists."
        ? 409
        : error.message.includes("required") || error.message.includes("at least")
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

router.patch("/password", async (req, res) => {
  const username = req.header("x-demo-user");
  const { currentPassword, newPassword } = req.body ?? {};

  if (!username) {
    return res.status(401).json({
      message: "Login is required.",
    });
  }

  try {
    await changeUserPassword(username, currentPassword, newPassword);

    return res.json({
      message: "Password updated successfully.",
    });
  } catch (error) {
    const status =
      error.message === "Current password is incorrect."
        ? 401
        : error.message === "User not found."
          ? 404
          : error.message.includes("required") || error.message.includes("at least")
            ? 400
            : 500;

    return res.status(status).json({
      message: "Failed to update password.",
      error: error.message,
    });
  }
});

module.exports = router;
