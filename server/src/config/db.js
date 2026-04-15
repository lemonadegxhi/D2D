const { Pool } = require("pg");
const { dbHost, dbPort, dbName, dbUser, dbPassword } = require("./env");

const pool = new Pool({
  host: dbHost,
  port: dbPort,
  database: dbName,
  user: dbUser,
  password: dbPassword,
});

pool.on("connect", () => {
  console.log("PostgreSQL pool connected.");
});

pool.on("error", (error) => {
  console.error("Unexpected PostgreSQL error:", error.message);
});

module.exports = pool;

