const pool = require("../config/db");
const { seedAdminUsername, seedAdminPassword } = require("../config/env");
const { hashPassword } = require("./passwordService");

async function bootstrapDatabase() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS app_users (
      id SERIAL PRIMARY KEY,
      username VARCHAR(64) UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role VARCHAR(32) NOT NULL DEFAULT 'admin',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS file_audit_log (
      id SERIAL PRIMARY KEY,
      username VARCHAR(64) NOT NULL,
      action VARCHAR(32) NOT NULL,
      target_path TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_files (
      id SERIAL PRIMARY KEY,
      owner_username VARCHAR(64) NOT NULL REFERENCES app_users(username) ON DELETE CASCADE,
      original_name TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      byte_size INTEGER NOT NULL CHECK (byte_size >= 0),
      file_data BYTEA NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  const existingUser = await pool.query(
    "SELECT id FROM app_users WHERE username = $1",
    [seedAdminUsername]
  );

  if (existingUser.rowCount === 0) {
    await pool.query(
      `
        INSERT INTO app_users (username, password_hash, role)
        VALUES ($1, $2, 'admin')
      `,
      [seedAdminUsername, hashPassword(seedAdminPassword)]
    );
  }
}

module.exports = {
  bootstrapDatabase,
};
