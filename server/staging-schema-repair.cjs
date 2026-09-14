// One-time login schema repair for staging-custos only. Never run in production.
const mysql = require("mysql2/promise");

const EXPECTED_ENVIRONMENT_ID = "92e8281a-668a-43ed-b2ba-cac84082a91c";
const EXPECTED_SERVICE_ID = "7527417a-b872-42bf-b828-e0987b805196";

async function ensureColumn(connection, table, column, definition) {
  const [rows] = await connection.execute(
    "SELECT COLUMN_NAME FROM information_schema.columns WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?",
    [table, column],
  );

  if (rows.length > 0) {
    console.log(`LOGIN_REPAIR already_present ${table}.${column}`);
    return;
  }

  const sql =
    "ALTER TABLE " +
    connection.escapeId(table) +
    " ADD COLUMN " +
    connection.escapeId(column) +
    " " +
    definition;

  try {
    await connection.query(sql);
    console.log(`LOGIN_REPAIR added ${table}.${column}`);
  } catch (error) {
    console.error("LOGIN_REPAIR_SQL_ERROR", {
      table,
      column,
      code: error.code,
      errno: error.errno,
      sqlState: error.sqlState,
      sqlMessage: error.sqlMessage,
      message: error.message,
      sql: error.sql,
    });
    throw error;
  }
}

async function main() {
  if (
    process.env.RAILWAY_ENVIRONMENT_ID !== EXPECTED_ENVIRONMENT_ID ||
    process.env.RAILWAY_SERVICE_ID !== EXPECTED_SERVICE_ID
  ) {
    throw new Error("Staging service guard rejected execution");
  }

  const connection = await mysql.createConnection(process.env.DATABASE_URL);
  try {
    const [versionRows] = await connection.query(
      "SELECT VERSION() AS version, DATABASE() AS databaseName",
    );
    console.log("LOGIN_REPAIR_DB", versionRows[0]);

    // VARCHAR is intentionally used here for compatibility with the inspected staging MySQL.
    // The application treats accessStatus as a string at runtime and accepts the same values.
    await ensureColumn(
      connection,
      "users",
      "accessStatus",
      "VARCHAR(20) NOT NULL DEFAULT 'active'",
    );
    await ensureColumn(
      connection,
      "users",
      "accessExpiresAt",
      "TIMESTAMP NULL",
    );

    const [verified] = await connection.execute(
      "SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT FROM information_schema.columns WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME IN ('accessStatus', 'accessExpiresAt') ORDER BY COLUMN_NAME",
    );
    console.log("LOGIN_REPAIR_VERIFIED", verified);
    console.log("LOGIN_REPAIR_COMPLETE");
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error("LOGIN_REPAIR_FATAL", error.code || error.name, error.message);
  process.exitCode = 1;
});
