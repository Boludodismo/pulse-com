import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import mysql, { type RowDataPacket } from "mysql2/promise";

// An untracked imported schema cannot safely replay historical migrations.
// This additive upgrade is restricted to the explicitly authorized staging service.
export async function ensureStagingInventorySchema() {
  if (
    process.env.RAILWAY_ENVIRONMENT_ID !==
      "92e8281a-668a-43ed-b2ba-cac84082a91c" ||
    process.env.RAILWAY_SERVICE_ID !== "7527417a-b872-42bf-b828-e0987b805196"
  )
    return;
  if (process.env.RUN_DB_MIGRATIONS !== "true")
    throw new Error("Staging inventory requires migrations enabled.");
  const connection = await mysql.createConnection(process.env.DATABASE_URL!);
  try {
    const [lock] = await connection.query<RowDataPacket[]>(
      "SELECT GET_LOCK('podcrm_artist_inventory_upgrade', 30) AS acquired"
    );
    if (Number(lock[0]?.acquired) !== 1)
      throw new Error("Could not acquire inventory schema lock.");
    // Only additive CREATE statements for the existing POD inventory foundation.
    const foundation = await readFile(
      resolve(
        process.cwd(),
        "drizzle/0051_pod_session_multitenant_foundation.sql"
      ),
      "utf8"
    );
    const statements = foundation
      .split("\n")
      .filter(line => !line.trimStart().startsWith("--"))
      .join("\n")
      .split(";")
      .map(s => s.trim());
    for (const statement of statements) {
      if (/^CREATE TABLE IF NOT EXISTS /i.test(statement))
        await connection.query(statement);
    }
    const [columns] = await connection.execute<RowDataPacket[]>(
      "SELECT COLUMN_NAME FROM information_schema.columns WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tenant_materials' AND COLUMN_NAME = 'ownerArtistId'"
    );
    if (!columns.length)
      await connection.query(
        "ALTER TABLE tenant_materials ADD COLUMN ownerArtistId INT NULL"
      );
    const upgrade = await readFile(
      resolve(process.cwd(), "drizzle/0052_artist_inventory_ownership.sql"),
      "utf8"
    );
    await connection.query(
      upgrade.slice(upgrade.indexOf("CREATE TABLE")).trim()
    );
    console.log(
      "[Inventory] Staging ownership schema verified; existing balances preserved."
    );
  } finally {
    await connection.query(
      "SELECT RELEASE_LOCK('podcrm_artist_inventory_upgrade')"
    );
    await connection.end();
  }
}
