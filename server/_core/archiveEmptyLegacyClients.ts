import type { Connection, RowDataPacket } from 'mysql2/promise';
const quote = (name: string) => '`' + name.replaceAll('`','``') + '`';
/** One-time reversible cleanup; any relational history keeps a client active. */
export async function archiveEmptyLegacyClients(connection: Connection, studioId: number) {
  await connection.query('CREATE TABLE IF NOT EXISTS crm_client_archive_20260908 (clientId INT PRIMARY KEY, studioId INT NOT NULL, archivedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP)');
  await connection.query('CREATE TABLE IF NOT EXISTS crm_data_repairs (version VARCHAR(100) PRIMARY KEY, appliedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP)');
  const [done] = await connection.query<RowDataPacket[]>("SELECT version FROM crm_data_repairs WHERE version='archive-empty-clients-20260908'");
  if (done.length) return;
  await connection.beginTransaction();
  try {
    const [candidates] = await connection.execute<RowDataPacket[]>("SELECT id FROM clients WHERE studioId=? AND isArchived=0 AND (phone IS NULL OR TRIM(phone)='') AND totalSpent=0 AND appointmentCount=0 FOR UPDATE",[studioId]);
    const ids = candidates.map(row=>Number(row.id));
    const kept = new Set<number>();
    if (ids.length) {
      const placeholders = ids.map(()=>'?').join(',');
      const [references] = await connection.query<RowDataPacket[]>("SELECT TABLE_NAME AS tableName,COLUMN_NAME AS columnName FROM information_schema.columns WHERE TABLE_SCHEMA=DATABASE() AND COLUMN_NAME IN ('clientId','client_id','customer_id') AND TABLE_NAME NOT LIKE 'crm_%'");
      for (const ref of references) {
        const [rows] = await connection.execute<RowDataPacket[]>(`SELECT DISTINCT ${quote(ref.columnName)} AS id FROM ${quote(ref.tableName)} WHERE ${quote(ref.columnName)} IN (${placeholders})`,ids);
        for (const row of rows) kept.add(Number(row.id));
      }
      for (const id of ids.filter(id=>!kept.has(id))) {
        await connection.execute('INSERT INTO crm_client_archive_20260908(clientId,studioId) VALUES (?,?)',[id,studioId]);
        await connection.execute('UPDATE clients SET isArchived=1 WHERE id=? AND studioId=?',[id,studioId]);
      }
    }
    await connection.query("INSERT INTO crm_data_repairs(version) VALUES ('archive-empty-clients-20260908')");
    await connection.commit();
    console.log('[Client cleanup]', JSON.stringify({archived:ids.length-kept.size,preservedWithHistory:kept.size,deleted:0}));
  } catch (error) {
    await connection.rollback();
    throw error;
  }
}
