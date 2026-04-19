const crypto = require("crypto");

const pool = require("../config/db");
const { hashPassword, verifyPassword } = require("./passwordService");

async function authenticateUser(username, password) {
  const result = await pool.query(
    `
      SELECT id, username, password_hash, role
      FROM app_users
      WHERE username = $1
    `,
    [username]
  );

  if (result.rowCount === 0) {
    return null;
  }

  const user = result.rows[0];

  if (!verifyPassword(password, user.password_hash)) {
    return null;
  }

  return {
    id: user.id,
    username: user.username,
    role: user.role,
    sessionToken: crypto.randomBytes(24).toString("hex"),
  };
}

async function registerUser(email, username, password) {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  const normalizedUsername = String(username || "").trim();

  if (!normalizedEmail || !normalizedEmail.includes("@")) {
    throw new Error("A valid email is required.");
  }

  if (normalizedUsername.length < 3) {
    throw new Error("Username must be at least 3 characters.");
  }

  if (String(password || "").length < 8) {
    throw new Error("Password must be at least 8 characters.");
  }

  const existingUser = await pool.query(
    `
      SELECT id
      FROM app_users
      WHERE username = $1 OR lower(email) = $2
    `,
    [normalizedUsername, normalizedEmail]
  );

  if (existingUser.rowCount > 0) {
    throw new Error("Username or email already exists.");
  }

  const result = await pool.query(
    `
      INSERT INTO app_users (email, username, password_hash, role)
      VALUES ($1, $2, $3, 'user')
      RETURNING id, email, username, role
    `,
    [normalizedEmail, normalizedUsername, hashPassword(password)]
  );

  return result.rows[0];
}

async function changeUserPassword(username, currentPassword, newPassword) {
  const normalizedUsername = String(username || "").trim();

  if (!normalizedUsername) {
    throw new Error("Username is required.");
  }

  if (!currentPassword || !newPassword) {
    throw new Error("Current password and new password are required.");
  }

  if (String(newPassword).length < 8) {
    throw new Error("Password must be at least 8 characters.");
  }

  const result = await pool.query(
    `
      SELECT id, password_hash
      FROM app_users
      WHERE username = $1
    `,
    [normalizedUsername]
  );

  if (result.rowCount === 0) {
    throw new Error("User not found.");
  }

  const user = result.rows[0];

  if (!verifyPassword(currentPassword, user.password_hash)) {
    throw new Error("Current password is incorrect.");
  }

  await pool.query(
    `
      UPDATE app_users
      SET password_hash = $1
      WHERE id = $2
    `,
    [hashPassword(newPassword), user.id]
  );

  return {
    username: normalizedUsername,
  };
}

module.exports = {
  authenticateUser,
  changeUserPassword,
  registerUser,
};
