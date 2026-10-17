import { securityPool } from "../security/database";
import type { PoolConnection, RowDataPacket } from "mysql2/promise";
export const pool = securityPool;
export async function rows<T = any>(
  query: string,
  params: any[] = [],
  connection?: PoolConnection
): Promise<T[]> {
  const [result] = await (connection || pool()).query<RowDataPacket[]>(
    query,
    params
  );
  return result as T[];
}
export async function ensureMinorConsentSchema() {
  if (!process.env.DATABASE_URL) return;
  const sql = [
    `CREATE TABLE IF NOT EXISTS tattoo_consent_templates (studio_id INT NOT NULL,artist_id INT NOT NULL DEFAULT 0,template_json MEDIUMTEXT NOT NULL,revision INT NOT NULL DEFAULT 1,updated_by INT NOT NULL,updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,PRIMARY KEY(studio_id,artist_id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    `CREATE TABLE IF NOT EXISTS minor_consent_requests (id INT AUTO_INCREMENT PRIMARY KEY,studio_id INT NOT NULL,client_id INT NOT NULL,artist_id INT NOT NULL,created_by INT NOT NULL,token_hash CHAR(64) NOT NULL,template_json MEDIUMTEXT NOT NULL,procedure_json TEXT NOT NULL,anamnese_request_id INT NULL,status VARCHAR(20) NOT NULL DEFAULT 'pending',expires_at BIGINT NOT NULL,notify_studio TINYINT NOT NULL DEFAULT 1,notify_artist TINYINT NOT NULL DEFAULT 1,legal_review_declared TINYINT NOT NULL DEFAULT 0,prepared_hash CHAR(64) NULL,prepared_pdf_key VARCHAR(255) NULL,submission_json MEDIUMTEXT NULL,submission_hash CHAR(64) NULL,submitted_at TIMESTAMP NULL,review_json TEXT NULL,materials_json MEDIUMTEXT NULL,revision INT NOT NULL DEFAULT 0,backup_revision INT NOT NULL DEFAULT -1,backup_key VARCHAR(255) NULL,backup_error VARCHAR(400) NULL,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,UNIQUE KEY minor_consent_token(token_hash),KEY consent_client(studio_id,client_id,id),KEY consent_backup(submitted_at,revision,backup_revision)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    `CREATE TABLE IF NOT EXISTS minor_consent_files (id CHAR(36) PRIMARY KEY,request_id INT NOT NULL,studio_id INT NOT NULL,kind VARCHAR(30) NOT NULL,name VARCHAR(180) NOT NULL,mime VARCHAR(60) NOT NULL,bytes INT NOT NULL,sha256 CHAR(64) NOT NULL,storage_key VARCHAR(255) NOT NULL,document_hash CHAR(64) NULL,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,UNIQUE KEY consent_file_request(request_id,kind)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    `CREATE TABLE IF NOT EXISTS minor_consent_events (id INT AUTO_INCREMENT PRIMARY KEY,request_id INT NOT NULL,studio_id INT NOT NULL,user_id INT NULL,action VARCHAR(40) NOT NULL,details_json TEXT NOT NULL,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,KEY consent_event_request(request_id,id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    `CREATE TABLE IF NOT EXISTS minor_consent_notices (request_id INT NOT NULL,recipient VARCHAR(10) NOT NULL,status VARCHAR(20) NOT NULL DEFAULT 'pending',queue_id INT NULL,error_text VARCHAR(400) NULL,attempts INT NOT NULL DEFAULT 0,next_attempt BIGINT NOT NULL DEFAULT 0,PRIMARY KEY(request_id,recipient)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  ];
  for (const statement of sql) await pool().query(statement);
}
export function audit(
  requestId: number,
  studioId: number,
  userId: number | null,
  action: string,
  details: object = {},
  connection?: PoolConnection
) {
  return (connection || pool()).query(
    "INSERT INTO minor_consent_events(request_id,studio_id,user_id,action,details_json) VALUES(?,?,?,?,?)",
    [requestId, studioId, userId, action, JSON.stringify(details)]
  );
}
export async function studioNoticePhone(
  studioId: number,
  trigger: string | undefined | null
) {
  const match = /^minor_consent_completed:(\d+):studio$/.exec(trigger || "");
  if (!match) return null;
  const [r] = await rows(
    `SELECT s.phone FROM minor_consent_requests r INNER JOIN studioSettings s ON s.studioId=r.studio_id WHERE r.id=? AND r.studio_id=? AND r.submitted_at IS NOT NULL AND r.notify_studio=1`,
    [Number(match[1]), studioId]
  );
  return r?.phone || null;
}
