// One-time additive repair for the inspected staging schema. Never run in production.
const mysql = require("mysql2/promise");
const definitions = {
  "users": {
    "accessStatus": "enum('active','suspended','expired') NOT NULL DEFAULT 'active'",
    "accessExpiresAt": "timestamp NULL"
  },
  "whatsapp_integrations": {
    "studio_id": "int NULL",
    "encrypted_api_token": "text NULL",
    "encrypted_webhook_secret": "text NULL",
    "connection_key": "varchar(96) NULL",
    "sandbox_mode": "tinyint NOT NULL DEFAULT 1",
    "sandbox_test_phone": "varchar(32) NULL",
    "production_activated_at": "timestamp NULL",
    "production_activated_by_user_id": "int NULL",
    "is_enabled": "tinyint NOT NULL DEFAULT 0",
    "last_success_at": "timestamp NULL",
    "failure_count": "int NOT NULL DEFAULT 0"
  }
};
async function main() {
  if (process.env.RAILWAY_ENVIRONMENT_ID !== "92e8281a-668a-43ed-b2ba-cac84082a91c" ||
      process.env.RAILWAY_SERVICE_ID !== "7527417a-b872-42bf-b828-e0987b805196") {
    throw new Error("Staging service guard rejected execution");
  }
  const connection = await mysql.createConnection(process.env.DATABASE_URL);
  try {
    await connection.query("SET SESSION lock_wait_timeout=15");
    for (const [table, columns] of Object.entries(definitions)) {
      const [rows] = await connection.execute(
        "SELECT COLUMN_NAME FROM information_schema.columns WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=?", [table]);
      if (!rows.length) throw new Error("Expected table missing: " + table);
      const existing = new Set(rows.map(row => row.COLUMN_NAME));
      for (const [column, definition] of Object.entries(columns)) {
        if (existing.has(column)) continue;
        await connection.query("ALTER TABLE " + table + " ADD COLUMN " + column + " " + definition);
        console.log("QA_REPAIR added " + table + "." + column);
      }
    }
    console.log("QA_REPAIR complete");
  } finally {
    await connection.end();
  }
}
main().catch(error => {
  console.error("QA_REPAIR_ERROR", error.code || error.name);
  process.exitCode = 1;
});
