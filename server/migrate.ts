import "dotenv/config";
import { drizzle } from "drizzle-orm/mysql2";
import { migrate } from "drizzle-orm/mysql2/migrator";
import { createConnection } from "mysql2/promise";

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
    await migrate(drizzle(connection), {
      migrationsFolder: "./drizzle/migrations",
    });
    console.log("[Database] Migrations completed.");
  } finally {
    await connection.end();
  }
}

runMigrations().catch((error) => {
  console.error("[Database] Migration failed:", error);
  process.exitCode = 1;
});
