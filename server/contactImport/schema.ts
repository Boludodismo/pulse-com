import mysql from 'mysql2/promise';
export async function ensureContactImportSchema() {
 if(process.env.RUN_DB_MIGRATIONS!=='true')return;
 await initializeContactImportSchema();
}
// Explicit manager imports can initialize this additive feature even where
// replay of the application's general startup migration history is disabled.
export async function initializeContactImportSchema() {
 const c=await mysql.createConnection(process.env.DATABASE_URL!);
 try {
  await c.query(`CREATE TABLE IF NOT EXISTS client_import_batches (
   id INT NOT NULL AUTO_INCREMENT PRIMARY KEY, studio_id INT NOT NULL, author_id INT NOT NULL,
   content_hash VARCHAR(64) NOT NULL, payload_json LONGTEXT NOT NULL, before_json LONGTEXT NOT NULL,
   created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE KEY studio_hash(studio_id,content_hash)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  await c.query(`CREATE TABLE IF NOT EXISTS client_import_records (
   id INT NOT NULL AUTO_INCREMENT PRIMARY KEY, studio_id INT NOT NULL, batch_id INT NOT NULL,
   group_key VARCHAR(50) NOT NULL, client_id INT NOT NULL, payload_json LONGTEXT NOT NULL,
   result_json TEXT NOT NULL, author_id INT NOT NULL, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
   UNIQUE KEY studio_batch_group(studio_id,batch_id,group_key), KEY studio_client(studio_id,client_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  const [columns]:any=await c.query("SHOW COLUMNS FROM clients LIKE 'birthDate'");
  // Birth dates before 1970 are legitimate. DATETIME preserves existing values
  // while removing TIMESTAMP's lower bound; no dates are guessed or rewritten.
  if(String(columns[0]?.Type).toLowerCase()==='timestamp')await c.query('ALTER TABLE clients MODIFY COLUMN birthDate DATETIME NULL');
 }finally{await c.end()}
}
