import "dotenv/config";
import { drizzle } from "drizzle-orm/mysql2";
import { migrate } from "drizzle-orm/mysql2/migrator";
import { createConnection } from "mysql2/promise";
import { consolidateClientDuplicates } from "./clientDeduplication";

async function runMigrations() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error(
      "DATABASE_URL is required. Configure a MySQL connection before starting the application.",
    );
  }

  const connection = await createConnection(databaseUrl);

  try {
    console.log("[Database] Applying pending migrations...");
    const database = drizzle(connection);
    await migrate(database, {
      migrationsFolder: "./drizzle/migrations",
    });
    console.log("[Database] Migrations completed.");
    console.log("[Database] Checking safe client duplicates...");
    const result = await consolidateClientDuplicates(undefined, database);
    console.log(`[Database] Client consolidation completed: ${result.mergedClients} duplicate(s) merged in ${result.duplicateGroups} group(s).`);
  } finally {
    await connection.end();
  }
}

runMigrations().catch((error) => {
  console.error("[Database] Migration failed:", error);
  process.exitCode = 1;
});
