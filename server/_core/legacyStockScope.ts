import mysql, { type RowDataPacket } from "mysql2/promise";

/** Additive upgrade for pre-SaaS stock; never infer an owner from the active login. */
export async function ensureLegacyStockScope() {
  if (!process.env.DATABASE_URL) throw new Error("Database required for stock isolation");
  const connection = await mysql.createConnection(process.env.DATABASE_URL);
  const tables = ["suppliers", "materials", "purchase_orders"] as const;
  try {
    const [lock] = await connection.query<RowDataPacket[]>("SELECT GET_LOCK('crm-legacy-stock-scope-v1',30) AS acquired");
    if (Number(lock[0]?.acquired) !== 1) throw new Error("Stock scope migration lock unavailable");
    for (const table of tables) {
      const [columns] = await connection.query<RowDataPacket[]>(`SHOW COLUMNS FROM \`${table}\` LIKE 'studioId'`);
      if (!columns.length) await connection.query(`ALTER TABLE \`${table}\` ADD COLUMN studioId INT NULL`);
      const [indexes] = await connection.query<RowDataPacket[]>(`SHOW INDEX FROM \`${table}\` WHERE Key_name = '${table}_studioId_idx'`);
      if (!indexes.length) await connection.query(`CREATE INDEX \`${table}_studioId_idx\` ON \`${table}\` (studioId)`);
    }
    await connection.query("CREATE TABLE IF NOT EXISTS crm_stock_scope_backup (tableName VARCHAR(40) NOT NULL, recordId INT NOT NULL, studioId INT NOT NULL, savedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY(tableName,recordId))");
    await connection.beginTransaction();
    const [pending] = await connection.query<RowDataPacket[]>(`SELECT
      (SELECT COUNT(*) FROM suppliers WHERE studioId IS NULL) +
      (SELECT COUNT(*) FROM materials WHERE studioId IS NULL) +
      (SELECT COUNT(*) FROM purchase_orders WHERE studioId IS NULL) AS total`);
    if (Number(pending[0]?.total) > 0) {
      // This backup was created only when the legacy system had exactly ONE studio.
      // A session's studioId is mutable, so it is deliberately not used as evidence.
      const [origin] = await connection.query<RowDataPacket[]>("SELECT b.studioId FROM crm_studio_identity_backup b INNER JOIN studios s ON s.id=b.studioId");
      const explicit = process.env.LEGACY_STOCK_STUDIO_ID?.trim();
      const studioId = explicit ? Number(explicit) : origin.length === 1 ? Number(origin[0].studioId) : null;
      if (!studioId || !Number.isSafeInteger(studioId) || studioId <= 0) {
        throw new Error("Legacy stock ownership is ambiguous. Verify and configure LEGACY_STOCK_STUDIO_ID before deployment; no legacy records were reassigned.");
      }
      const [studio] = await connection.execute<RowDataPacket[]>("SELECT id FROM studios WHERE id=?", [studioId]);
      if (studio.length !== 1) throw new Error("Verified legacy stock studio does not exist");
      // Retain an audit of the exact assignments, including reruns after partial DDL.
      for (const table of tables) {
        await connection.execute(`INSERT IGNORE INTO crm_stock_scope_backup(tableName,recordId,studioId) SELECT ?,id,? FROM \`${table}\` WHERE studioId IS NULL`, [table, studioId]);
        await connection.execute(`UPDATE \`${table}\` SET studioId=? WHERE studioId IS NULL`, [studioId]);
      }
      console.log("[Stock scope] Legacy ownership preserved for studio", studioId);
    }
    await connection.commit();
    console.log("[Stock scope] Suppliers, materials and orders isolated by studio.");
  } catch (error) {
    await connection.rollback().catch(() => {});
    throw error;
  } finally {
    await connection.query("SELECT RELEASE_LOCK('crm-legacy-stock-scope-v1')").catch(() => {});
    await connection.end();
  }
}
