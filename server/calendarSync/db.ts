import { database, ensureCommitmentsSchema } from "../commitments/db";
let ready: Promise<void> | undefined;
export async function ensureCalendarSyncSchema() {
  return (ready ??= (async () => {
    await ensureCommitmentsSchema();
    const db = database();
    for (const query of [
      `CREATE TABLE IF NOT EXISTS calendar_sync_connections(id INT AUTO_INCREMENT PRIMARY KEY,studio_id INT NOT NULL,user_id INT NOT NULL,calendar_id INT NOT NULL,provider VARCHAR(12) NOT NULL,credentials TEXT NOT NULL,remote_calendar VARCHAR(1000),choices_json TEXT,status VARCHAR(20) NOT NULL DEFAULT 'select',timezone VARCHAR(64) NOT NULL DEFAULT 'America/Sao_Paulo',last_sync DATETIME NULL,last_error VARCHAR(300),scan_cursor INT NOT NULL DEFAULT 0,lease_until DATETIME NULL,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,UNIQUE KEY per_calendar_provider(studio_id,user_id,calendar_id,provider)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
      `CREATE TABLE IF NOT EXISTS calendar_sync_links(id INT AUTO_INCREMENT PRIMARY KEY,connection_id INT NOT NULL,kind VARCHAR(12) NOT NULL,local_id INT NOT NULL,remote_id VARCHAR(1000),etag VARCHAR(300),local_hash VARCHAR(64),remote_hash VARCHAR(64),conflict_json TEXT,UNIQUE KEY linked_event(connection_id,kind,local_id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
      `CREATE TABLE IF NOT EXISTS calendar_sync_oauth(state_hash VARCHAR(64) PRIMARY KEY,studio_id INT NOT NULL,user_id INT NOT NULL,calendar_id INT NOT NULL,expires_at DATETIME NOT NULL,verifier VARCHAR(128) NOT NULL) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    ])
      await db.query(query);
    console.log("[CalendarSync] Estrutura pronta.");
  })().catch(e => {
    ready = undefined;
    throw e;
  }));
}
