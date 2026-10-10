import mysql, { type PoolConnection, type RowDataPacket } from "mysql2/promise";
let pool: mysql.Pool | undefined;
export function securityPool() {
  if (!process.env.DATABASE_URL)
    throw new Error("Security database unavailable");
  return (pool ??= mysql.createPool({
    uri: process.env.DATABASE_URL,
    connectionLimit: 5,
    timezone: "Z",
  }));
}
export async function ensureSecuritySchema() {
  if (!process.env.DATABASE_URL) return;
  // Additive tables only: no changes to existing users or business records.
  const database = securityPool();
  await database.query(`CREATE TABLE IF NOT EXISTS auth_security (
    userId INT NOT NULL PRIMARY KEY, method VARCHAR(8) NOT NULL DEFAULT 'off',
    secret TEXT NULL, version INT NOT NULL DEFAULT 0, lastCounter BIGINT NOT NULL DEFAULT -1
  ) ENGINE=InnoDB`);
  await database.query(`CREATE TABLE IF NOT EXISTS auth_challenges (
    tokenHash CHAR(64) NOT NULL PRIMARY KEY, userId INT NOT NULL,
    purpose VARCHAR(12) NOT NULL, method VARCHAR(8) NOT NULL, credentialVersion CHAR(64) NOT NULL,
    secret TEXT NULL, codeHash CHAR(64) NULL, attempts INT NOT NULL DEFAULT 0,
    expiresAt BIGINT NOT NULL, KEY auth_challenge_user (userId), KEY auth_challenge_expiry(expiresAt)
  ) ENGINE=InnoDB`);
  await database.query(`CREATE TABLE IF NOT EXISTS auth_recovery_codes (
    userId INT NOT NULL, codeHash CHAR(64) NOT NULL, PRIMARY KEY(userId,codeHash)
  ) ENGINE=InnoDB`);
  await database.query(`CREATE TABLE IF NOT EXISTS auth_sessions (
    tokenHash CHAR(64) NOT NULL PRIMARY KEY, userId INT NOT NULL,
    credentialVersion CHAR(64) NOT NULL, lastSeen BIGINT NOT NULL, expiresAt BIGINT NOT NULL,
    device VARCHAR(300) NOT NULL DEFAULT '', KEY auth_session_user(userId), KEY auth_session_expiry(expiresAt)
  ) ENGINE=InnoDB`);
  await database.query(`CREATE TABLE IF NOT EXISTS auth_rate_limits (
    keyHash CHAR(64) NOT NULL PRIMARY KEY, hits INT NOT NULL, expiresAt BIGINT NOT NULL,
    KEY auth_rate_expiry(expiresAt)
  ) ENGINE=InnoDB`);
  // Expired transient entries contain no usable authorization.
  await cleanupSecurityEntries();
  const timer = setInterval(() => {
    cleanupSecurityEntries().catch(() =>
      console.error("[Security] Expired entry cleanup unavailable")
    );
  }, 15 * 60000);
  timer.unref();
}
export type SecurityState = RowDataPacket & {
  userId: number;
  method: "off" | "totp" | "email";
  secret: string | null;
  version: number;
  lastCounter: number;
};
export async function getSecurity(userId: number): Promise<SecurityState> {
  const [rows] = await securityPool().query<SecurityState[]>(
    "SELECT * FROM auth_security WHERE userId=?",
    [userId]
  );
  return (
    rows[0] ??
    ({
      userId,
      method: "off",
      secret: null,
      version: 0,
      lastCounter: -1,
    } as SecurityState)
  );
}
export async function securityTransaction<T>(
  userId: number,
  fn: (connection: PoolConnection, state: SecurityState) => Promise<T>
) {
  const connection = await securityPool().getConnection();
  try {
    await connection.beginTransaction();
    await connection.query(
      "INSERT INTO auth_security(userId) VALUES(?) ON DUPLICATE KEY UPDATE userId=VALUES(userId)",
      [userId]
    );
    const [rows] = await connection.query<SecurityState[]>(
      "SELECT * FROM auth_security WHERE userId=? FOR UPDATE",
      [userId]
    );
    const result = await fn(connection, rows[0]);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function cleanupSecurityEntries() {
  for (const table of ["auth_challenges", "auth_sessions", "auth_rate_limits"])
    await securityPool().query(`DELETE FROM ${table} WHERE expiresAt < ?`, [
      Date.now(),
    ]);
}
