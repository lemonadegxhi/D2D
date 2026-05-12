const crypto = require("crypto");

const pool = require("../config/db");
const { hashPassword, verifyPassword } = require("./passwordService");

const OWNER_USERNAME = "chuseman";
const MANAGEABLE_ROLES = new Set(["user", "admin"]);

function isAdminRole(role) {
  return role === "admin" || role === "owner";
}

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

async function getUserByUsername(username) {
  const normalizedUsername = String(username || "").trim();

  if (!normalizedUsername) {
    return null;
  }

  const result = await pool.query(
    `
      SELECT id, email, username, role, created_at
      FROM app_users
      WHERE username = $1
    `,
    [normalizedUsername]
  );

  return result.rows[0] ?? null;
}

async function listUsers() {
  const result = await pool.query(`
    SELECT id, email, username, role, created_at
    FROM app_users
    ORDER BY created_at DESC, username ASC
  `);

  return result.rows;
}

async function updateUserRole(userId, role) {
  const normalizedRole = String(role || "").trim().toLowerCase();

  if (!MANAGEABLE_ROLES.has(normalizedRole)) {
    throw new Error("Role must be user or admin.");
  }

  const currentUser = await pool.query(
    `
      SELECT id, username, role
      FROM app_users
      WHERE id = $1
    `,
    [userId]
  );

  if (currentUser.rowCount === 0) {
    throw new Error("User not found.");
  }

  if (currentUser.rows[0].username === OWNER_USERNAME || currentUser.rows[0].role === "owner") {
    throw new Error("The owner account role cannot be changed.");
  }

  const result = await pool.query(
    `
      UPDATE app_users
      SET role = $1
      WHERE id = $2
      RETURNING id, email, username, role, created_at
    `,
    [normalizedRole, userId]
  );

  return result.rows[0];
}

module.exports = {
  authenticateUser,
  changeUserPassword,
  getUserByUsername,
  isAdminRole,
  listUsers,
  registerUser,
  updateUserRole,
};
