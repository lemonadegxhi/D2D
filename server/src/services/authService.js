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

async function registerUser(username, password) {
  const normalizedUsername = String(username || "").trim();

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
      WHERE username = $1
    `,
    [normalizedUsername]
  );

  if (existingUser.rowCount > 0) {
    throw new Error("Username already exists.");
  }

  const result = await pool.query(
    `
      INSERT INTO app_users (username, password_hash, role)
      VALUES ($1, $2, 'user')
      RETURNING id, username, role
    `,
    [normalizedUsername, hashPassword(password)]
  );

  return result.rows[0];
}

module.exports = {
  authenticateUser,
  registerUser,
};
