const app = require("./app");
const pool = require("./config/db");
const { port } = require("./config/env");

async function startServer() {
  try {
    await pool.query("SELECT 1");
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

