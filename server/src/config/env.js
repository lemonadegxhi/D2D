const dotenv = require("dotenv");
const path = require("path");

dotenv.config();

const rootDir = path.resolve(__dirname, "..", "..");

module.exports = {
  port: Number(process.env.PORT) || 5000,
  clientUrl: process.env.CLIENT_URL || "http://localhost:5173",
  dbHost: process.env.DB_HOST || "localhost",
  dbPort: Number(process.env.DB_PORT) || 5432,
  dbName: process.env.DB_NAME || "day2day",
  dbUser: process.env.DB_USER || "postgres",
  dbPassword: process.env.DB_PASSWORD || "postgres",
  storageRoot:
    process.env.STORAGE_ROOT || path.join(rootDir, "storage", "library"),
  seedAdminUsername: process.env.SEED_ADMIN_USERNAME || "admin",
  seedAdminPassword: process.env.SEED_ADMIN_PASSWORD || "ChangeMeNow123!",
};
