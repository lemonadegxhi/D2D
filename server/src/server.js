const app = require("./app");
const pool = require("./config/db");
const { port } = require("./config/env");
const { ensureStorageRoot } = require("./services/storageService");
const { bootstrapDatabase } = require("./services/bootstrapService");

async function startServer() {
  try {
    ensureStorageRoot();
    await pool.query("SELECT 1");
    await bootstrapDatabase();
    console.log("Database connection established.");

    app.listen(port, () => {
      console.log(`Server listening on http://localhost:${port}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error.message);
    process.exit(1);
  }
}

startServer();
