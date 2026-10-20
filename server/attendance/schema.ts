import { database } from '../commitments/db';
let ready: Promise<void> | undefined;
export async function ensureAttendanceSchema() {
  if (!process.env.DATABASE_URL) return;
  return ready ??= (async () => {
    const db = database();
    const statements = [
      `CREATE TABLE IF NOT EXISTS appointment_attendance (
        appointment_id INT PRIMARY KEY,studio_id INT NOT NULL,client_id INT NOT NULL,artist_id INT NULL,
        attendance VARCHAR(12) NOT NULL DEFAULT 'pending',session VARCHAR(16) NOT NULL DEFAULT 'not_started',
        needs_more TINYINT NOT NULL DEFAULT 0,present_at DATETIME NULL,started_at DATETIME NULL,finished_at DATETIME NULL,
        revision INT NOT NULL DEFAULT 0,updated_at DATETIME NOT NULL,KEY client_history(studio_id,client_id,attendance)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
      `CREATE TABLE IF NOT EXISTS appointment_attendance_events (
        id INT AUTO_INCREMENT PRIMARY KEY,appointment_id INT NOT NULL,studio_id INT NOT NULL,client_id INT NOT NULL,artist_id INT NULL,
        action VARCHAR(20) NOT NULL,source VARCHAR(40) NOT NULL,created_at DATETIME NOT NULL,KEY scoped_history(studio_id,client_id,created_at)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
      `CREATE TABLE IF NOT EXISTS appointment_attendance_links (
        token_hash CHAR(64) PRIMARY KEY,studio_id INT NOT NULL,appointment_id INT NOT NULL,fingerprint CHAR(64) NOT NULL,
        expires_at DATETIME NOT NULL,KEY appointment_links(studio_id,appointment_id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
      `CREATE TABLE IF NOT EXISTS attendance_runtime (id INT PRIMARY KEY,activated_at DATETIME NOT NULL) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
      `INSERT IGNORE INTO attendance_runtime(id,activated_at) VALUES(1,UTC_TIMESTAMP())`,
      `CREATE TABLE IF NOT EXISTS client_whatsapp_permissions (
        studio_id INT NOT NULL,client_id INT NOT NULL,normalized_phone VARCHAR(24) NOT NULL,enabled TINYINT NOT NULL,
        source VARCHAR(100) NOT NULL,recorded_at DATETIME NOT NULL,PRIMARY KEY(studio_id,client_id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    ];
    for (const statement of statements) await db.query(statement);
    const c = await db.getConnection();
    try {
      const [lock]: any = await c.query("SELECT GET_LOCK('tatuei-attendance-schema',30) AS acquired");
      if (Number(lock[0]?.acquired) !== 1) throw new Error('Não foi possível preparar o acompanhamento.');
      for (const [column, type] of [['attendanceEnabled', 'TINYINT NOT NULL DEFAULT 1'], ['attendanceRecipient', "VARCHAR(10) NOT NULL DEFAULT 'artist'"]]) {
        const [rows]: any = await c.query('SHOW COLUMNS FROM appointments LIKE ?', [column]);
        if (!rows.length) await c.query(`ALTER TABLE appointments ADD COLUMN ${column} ${type}`);
      }
      // Permissions belong to clients; shared family phones must not overwrite each other.
      const [indexes]: any = await c.query("SHOW INDEX FROM integration_contacts WHERE Key_name='integration_contacts_studio_phone_unique'");
      if (indexes.length && indexes.sort((a: any,b: any)=>a.Seq_in_index-b.Seq_in_index).map((r: any)=>r.Column_name).join(',') === 'studio_id,normalized_phone')
        await c.query('ALTER TABLE integration_contacts DROP INDEX integration_contacts_studio_phone_unique, ADD INDEX integration_contacts_studio_phone_lookup (studio_id,normalized_phone)');
    } finally { await c.query("SELECT RELEASE_LOCK('tatuei-attendance-schema')"); c.release(); }
    console.log('[Attendance] Estrutura de acompanhamento e autorização verificada.');
  })().catch(error => { ready = undefined; throw error; });
}
