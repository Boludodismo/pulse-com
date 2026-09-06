import { migrate } from "drizzle-orm/mysql2/migrator";
import { getDb } from "../db";

/**
 * Applies committed Drizzle migrations at startup when explicitly enabled.
 * This is intended for single-instance staging/test deployments where the
 * database is provisioned together with the application (e.g. Railway).
 */
export async function runStartupMigrations(): Promise<void> {
  if (process.env.RUN_DB_MIGRATIONS !== "true") return;

  const database = await getDb();
  if (!database) {
    throw new Error("RUN_DB_MIGRATIONS=true but DATABASE_URL is not configured or the database is unavailable.");
  }

  console.log("[Database] Applying committed Drizzle migrations...");
  await migrate(database, { migrationsFolder: "./drizzle" });
  console.log("[Database] Migrations are up to date.");
}
