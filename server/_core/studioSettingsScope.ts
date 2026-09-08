import mysql, { type RowDataPacket } from 'mysql2/promise';

/** Additive upgrade. Ambiguous legacy rows are retained unassigned, never shared. */
export async function ensureStudioSettingsScope() {
  if (!process.env.DATABASE_URL) throw new Error('Database required for studio settings');
  const connection = await mysql.createConnection(process.env.DATABASE_URL);
  try {
    const [lock] = await connection.query<RowDataPacket[]>("SELECT GET_LOCK('crm-studio-settings-scope-v1',30) AS acquired");
    if (Number(lock[0]?.acquired) !== 1) throw new Error('Studio settings migration lock unavailable');
    const [columns] = await connection.query<RowDataPacket[]>("SHOW COLUMNS FROM studioSettings LIKE 'studioId'");
    if (!columns.length) {
      await connection.query('ALTER TABLE studioSettings ADD COLUMN studioId INT NULL, ADD UNIQUE KEY studioSettings_studioId_unique(studioId)');
    }
    await connection.query('CREATE TABLE IF NOT EXISTS crm_studio_identity_backup (studioId INT PRIMARY KEY, previousIdentity JSON NOT NULL, savedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP)');
    await connection.beginTransaction();
    const [studios] = await connection.query<RowDataPacket[]>('SELECT id,name,phone,email,address,city,state,zipCode FROM studios FOR UPDATE');
    const [settings] = await connection.query<RowDataPacket[]>('SELECT * FROM studioSettings FOR UPDATE');
    if (studios.length === 1 && settings.length === 1 && settings[0].studioId == null) {
      const studio = studios[0], config = settings[0];
      await connection.execute('INSERT IGNORE INTO crm_studio_identity_backup(studioId,previousIdentity) VALUES (?,?)', [studio.id, JSON.stringify(studio)]);
      await connection.execute('UPDATE studioSettings SET studioId=? WHERE id=? AND studioId IS NULL', [studio.id, config.id]);
      await connection.execute('UPDATE studios SET name=COALESCE(NULLIF(?,\'\'),name),phone=COALESCE(?,phone),email=COALESCE(?,email),address=COALESCE(?,address),city=COALESCE(?,city),state=COALESCE(?,state),zipCode=COALESCE(?,zipCode) WHERE id=?', [config.studioName,config.phone,config.email,config.address,config.city,config.state,config.zipCode,studio.id]);
      console.log('[Studio settings] Existing studio linked; identity synchronized; backup retained.');
    }
    await connection.commit();
    console.log('[Studio settings] Tenant isolation ready.');
    const [counts] = await connection.query<RowDataPacket[]>(`SELECT COUNT(*) AS total,
      SUM(CASE WHEN phone IS NULL OR TRIM(phone)='' THEN 1 ELSE 0 END) AS withoutPhone,
      SUM(CASE WHEN EXISTS(SELECT 1 FROM anamnesisRecords a WHERE a.clientId=clients.id) THEN 1 ELSE 0 END) AS withLegacyAnamnesis
      FROM clients`);
    console.log('[Client audit] Read-only totals:', JSON.stringify(counts[0] ?? {}));
  } catch (error) {
    await connection.rollback().catch(() => {});
    throw error;
  } finally {
    await connection.query("SELECT RELEASE_LOCK('crm-studio-settings-scope-v1')").catch(() => {});
    await connection.end();
  }
}
