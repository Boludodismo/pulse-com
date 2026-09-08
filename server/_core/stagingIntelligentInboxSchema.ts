import mysql, { type RowDataPacket } from "mysql2/promise";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
/** Existing imported staging DB skips historical replay. Apply only this additive migration. */
export async function ensureStagingIntelligentInboxSchema() {
  if (
    process.env.RAILWAY_ENVIRONMENT_ID !==
      "92e8281a-668a-43ed-b2ba-cac84082a91c" ||
    process.env.RAILWAY_SERVICE_ID !== "7527417a-b872-42bf-b828-e0987b805196"
  )
    return;
  if (process.env.RUN_DB_MIGRATIONS !== "true") return;
  const c = await mysql.createConnection(process.env.DATABASE_URL!);
  try {
    const [lock] = await c.query<RowDataPacket[]>(
      "SELECT GET_LOCK('podcrm_inbox_schema',30) AS acquired"
    );
    if (Number(lock[0]?.acquired) !== 1)
      throw new Error("Inbox schema lock unavailable.");
    const foundation = await readFile(resolve(process.cwd(), 'drizzle/0056_inbox_rbac_foundation.sql'), 'utf8');
    const createPermissions = foundation.split('\n').filter(line => !line.startsWith('--')).join('\n').trim();
    if (!createPermissions.startsWith('CREATE TABLE IF NOT EXISTS `user_module_permissions`')) throw new Error('Unexpected RBAC foundation statement.');
    await c.query(createPermissions);
    const source = await readFile(
      resolve(process.cwd(), "drizzle/0055_intelligent_inbox.sql"),
      "utf8"
    );
    for (const statement of source
      .split("\n")
      .filter(l => !l.startsWith("--"))
      .join("\n")
      .split(";")
      .map(s => s.trim())
      .filter(Boolean)) {
      if (statement.startsWith("CREATE TABLE IF NOT EXISTS inbox_"))
        await c.query(statement);
      else if (
        statement.startsWith(
          "ALTER TABLE user_module_permissions MODIFY COLUMN module ENUM("
        )
      ) {
        const [columns] = await c.query<RowDataPacket[]>(
          "SHOW COLUMNS FROM user_module_permissions LIKE 'module'"
        );
        if (!columns[0]) throw new Error("Existing RBAC schema missing.");
        const current = String(columns[0].Type);
        const members = Array.from(current.matchAll(/'([^']+)'/g), m => m[1]);
        if (!members.length)
          throw new Error(
            "Unexpected RBAC column type; manual review required."
          );
        // Refuse a narrowing conversion; never discard an existing module.
        if (members.some(m => !statement.includes("'" + m + "'")))
          throw new Error("Unexpected RBAC modules; manual review required.");
        if (!current.includes("'inbox_suggestions'")) await c.query(statement);
      } else
        throw new Error("Unexpected statement in isolated inbox migration.");
    }
    console.log(
      "[IntelligentInbox] Schema prepared; no integrations or jobs activated."
    );
  } finally {
    await c.query("SELECT RELEASE_LOCK('podcrm_inbox_schema')");
    await c.end();
  }
}
