import mysql, {
  type Pool,
  type PoolConnection,
  type RowDataPacket,
  type ResultSetHeader,
} from "mysql2/promise";
import { TRPCError } from "@trpc/server";
let pool: Pool | undefined;
let schemaReady = false;
export function botPool() {
  if (!process.env.DATABASE_URL)
    throw new TRPCError({
      code: "SERVICE_UNAVAILABLE",
      message: "Banco de dados indisponível.",
    });
  return (pool ??= mysql.createPool({
    uri: process.env.DATABASE_URL,
    connectionLimit: 5,
    dateStrings: true,
    timezone: "Z",
    charset: "utf8mb4",
  }));
}
export type BotConnection = Pool | PoolConnection;
export async function rows<T = Record<string, any>>(
  sql: string,
  args: unknown[] = [],
  conn: BotConnection = botPool()
): Promise<T[]> {
  const [result] = await conn.query<RowDataPacket[]>(sql, args);
  return result as T[];
}
export async function exec(
  sql: string,
  args: unknown[] = [],
  conn: BotConnection = botPool()
) {
  const [result] = await conn.query<ResultSetHeader>(sql, args);
  return result;
}
export function isNativeBotReady() {
  return schemaReady;
}
export function assertBotSchema() {
  if (!schemaReady)
    throw new TRPCError({
      code: "SERVICE_UNAVAILABLE",
      message:
        "O módulo Bot Tatuei ainda não está disponível. Tente novamente em instantes.",
    });
}
export async function botTransaction<T>(fn: (c: PoolConnection) => Promise<T>) {
  const c = await botPool().getConnection();
  try {
    await c.beginTransaction();
    const result = await fn(c);
    await c.commit();
    return result;
  } catch (e) {
    await c.rollback();
    throw e;
  } finally {
    c.release();
  }
}
export async function withBotLock<T>(
  name: string,
  fn: (c: PoolConnection) => Promise<T>,
  timeout = 5
): Promise<T | undefined> {
  const c = await botPool().getConnection();
  try {
    const [r] = await rows<{ acquired: number }>(
      "SELECT GET_LOCK(?,?) acquired",
      [name, timeout],
      c
    );
    if (r?.acquired !== 1) return;
    try {
      return await fn(c);
    } finally {
      await rows("SELECT RELEASE_LOCK(?)", [name], c);
    }
  } finally {
    c.release();
  }
}
export const BOT_DDL = [
  `CREATE TABLE IF NOT EXISTS tatuei_bot_settings (
 studio_id INT PRIMARY KEY, enabled TINYINT NOT NULL DEFAULT 0,
 ai_secret TEXT NULL, ai_model VARCHAR(100) NOT NULL DEFAULT 'gpt-4.1-mini', ai_daily_limit INT NOT NULL DEFAULT 200, ai_day VARCHAR(10) NULL, ai_used INT NOT NULL DEFAULT 0,
 wa_secret TEXT NULL, wa_instance VARCHAR(100) NULL, wa_status VARCHAR(24) NOT NULL DEFAULT 'unconfigured', wa_phone VARCHAR(24) NULL,
 webhook_key VARCHAR(64) NULL UNIQUE, webhook_ready TINYINT NOT NULL DEFAULT 0, last_error VARCHAR(300) NULL,
 updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS tatuei_bot_profiles (
 id INT AUTO_INCREMENT PRIMARY KEY, studio_id INT NOT NULL, artist_id INT NOT NULL DEFAULT 0, enabled TINYINT NOT NULL DEFAULT 0,
 permissions JSON NOT NULL, config JSON NOT NULL, version INT NOT NULL DEFAULT 1,
 updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 UNIQUE KEY bot_profile_scope(studio_id,artist_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS tatuei_bot_consents (
 studio_id INT NOT NULL, client_id INT NOT NULL, enabled TINYINT NOT NULL DEFAULT 0, actor_id INT NOT NULL,
 updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, PRIMARY KEY(studio_id,client_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS tatuei_bot_conversations (
 id INT AUTO_INCREMENT PRIMARY KEY, studio_id INT NOT NULL, artist_id INT NOT NULL DEFAULT 0, client_id INT NULL,
 phone VARCHAR(24) NOT NULL, name VARCHAR(255) NOT NULL, mode VARCHAR(12) NOT NULL DEFAULT 'bot', revision INT NOT NULL DEFAULT 1,
 opted_out TINYINT NOT NULL DEFAULT 0, last_inbound_at DATETIME NULL,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 UNIQUE KEY bot_conversation_phone(studio_id,phone), KEY bot_conversation_artist(studio_id,artist_id,updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS tatuei_bot_messages (
 id INT AUTO_INCREMENT PRIMARY KEY, studio_id INT NOT NULL, conversation_id INT NOT NULL, role VARCHAR(12) NOT NULL,
 body TEXT NOT NULL, status VARCHAR(16) NOT NULL, external_id VARCHAR(160) NULL, event_key VARCHAR(200) NULL,
 origin VARCHAR(24) NOT NULL DEFAULT 'reply', expected_revision INT NOT NULL DEFAULT 1, profile_version INT NULL,
 appointment_id INT NULL, appointment_date VARCHAR(30) NULL, rule_event VARCHAR(20) NULL,
 after_mode VARCHAR(12) NOT NULL DEFAULT 'bot', due_at DATETIME NOT NULL, error VARCHAR(300) NULL,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 UNIQUE KEY bot_external_message(studio_id,external_id), UNIQUE KEY bot_message_event(studio_id,event_key),
 KEY bot_message_due(status,due_at), KEY bot_message_thread(studio_id,conversation_id,id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS tatuei_bot_history (
 id INT AUTO_INCREMENT PRIMARY KEY, studio_id INT NOT NULL, artist_id INT NOT NULL DEFAULT 0, actor_id INT NULL,
 action VARCHAR(120) NOT NULL, detail VARCHAR(500) NOT NULL DEFAULT '', created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 KEY bot_history_scope(studio_id,artist_id,id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
];
export async function ensureNativeBotSchema() {
  if (!process.env.DATABASE_URL) return;
  try {
    await withBotLock(
      "tatuei_native_bot_schema",
      async c => {
        for (const ddl of BOT_DDL) await c.query(ddl);
        schemaReady = true;
      },
      30
    );
    console.log(
      "[Bot Tatuei] Schema " + (schemaReady ? "ready" : "unavailable")
    );
  } catch {
    schemaReady = false;
    console.error(
      "[Bot Tatuei] Schema unavailable; existing CRM remains available."
    );
  }
}
export async function botAudit(
  studioId: number,
  artistId: number,
  action: string,
  detail = "",
  actorId: number | null = null,
  c: BotConnection = botPool()
) {
  await exec(
    "INSERT INTO tatuei_bot_history(studio_id,artist_id,actor_id,action,detail) VALUES(?,?,?,?,?)",
    [studioId, artistId, actorId, action.slice(0, 120), detail.slice(0, 500)],
    c
  );
}
export function jsonValue<T>(value: any, fallback: T): T {
  if (value == null) return fallback;
  try {
    return typeof value === "string" ? JSON.parse(value) : value;
  } catch {
    return fallback;
  }
}
export const utcSql = (d = new Date()) =>
  d.toISOString().slice(0, 19).replace("T", " ");
