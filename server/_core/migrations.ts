import "dotenv/config";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import mysql, { type RowDataPacket } from "mysql2/promise";

type JournalEntry = { idx: number; tag: string };
type MigrationJournal = { entries: JournalEntry[] };
const DEFAULT_BASELINE_INDEX = 14;

function splitStatements(sqlText: string): string[] {
  const withoutLineComments = sqlText
    .split("\n")
    .filter(line => !line.trimStart().startsWith("--"))
    .join("\n");
  return withoutLineComments
    .split("--> statement-breakpoint")
    .flatMap(chunk => chunk.split(";"))
    .map(statement => statement.trim())
    .filter(statement => statement.length > 0);
}

export async function runStartupMigrations(): Promise<void> {
  if (process.env.RUN_DB_MIGRATIONS !== "true") return;
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) throw new Error("RUN_DB_MIGRATIONS=true but DATABASE_URL is not configured.");
  const baselineIndex = Number.parseInt(process.env.MIGRATION_BASELINE_INDEX ?? String(DEFAULT_BASELINE_INDEX), 10);
  const connection = await mysql.createConnection(databaseUrl);
  try {
    await connection.execute(`CREATE TABLE IF NOT EXISTS podcrm_migrations (tag varchar(255) NOT NULL, appliedAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (tag))`);
    const [appliedRows] = await connection.query<RowDataPacket[]>("SELECT tag FROM podcrm_migrations");
    const applied = new Set(appliedRows.map(row => String(row.tag)));
    const [schemaRows] = await connection.query<RowDataPacket[]>("SELECT COUNT(*) AS count FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'users'");
    const existingSchema = Number(schemaRows[0]?.count ?? 0) > 0;
    if (applied.size === 0 && existingSchema) {
      console.log("[Database] Existing schema detected without POD CRM migration tracking; startup replay skipped for safety.");
      return;
    }
    const journal = JSON.parse(await readFile(resolve(process.cwd(), "drizzle/meta/_journal.json"), "utf8")) as MigrationJournal;
    const entries = journal.entries.filter(entry => entry.idx >= baselineIndex).sort((a, b) => a.idx - b.idx);
    console.log(`[Database] Applying POD CRM migrations from baseline index ${baselineIndex}...`);
    for (const entry of entries) {
      if (applied.has(entry.tag)) continue;
      const sqlText = await readFile(resolve(process.cwd(), `drizzle/${entry.tag}.sql`), "utf8");
      for (const statement of splitStatements(sqlText)) await connection.query(statement);
      await connection.execute("INSERT INTO podcrm_migrations (tag) VALUES (?)", [entry.tag]);
      console.log(`[Database] Applied migration ${entry.tag}`);
    }
    console.log("[Database] POD CRM schema is up to date.");
  } finally {
    await connection.end();
  }
}
