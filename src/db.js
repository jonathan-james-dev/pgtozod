/*
 * This file is part of ProjectName, licensed under the MIT License (MIT).
 * See the LICENSE file in the project root for more information.
 */

const { Pool } = require("pg");
const os = require("os");
const path = require("path");
const fs = require("fs");

module.exports = function () {
  const configDir = path.join(os.homedir(), ".pgtozod");
  const configPath = path.join(configDir, "config.json");
  let config;

  if (fs.existsSync(configPath)) {
    const rawData = fs.readFileSync(configPath);
    config = JSON.parse(rawData);
  }

  const pool = new Pool({
    user: config.DB_USER,
    host: config.DB_HOST,
    database: config.DB_NAME,
    password: config.DB_PASSWORD,
    port: config.DB_PORT,
  });

  pool.on("error", (err, client) => {
    console.error("Unexpected error on idle client", err);
    process.exit(-1);
  });

  return pool;
};
