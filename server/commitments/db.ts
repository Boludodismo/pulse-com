import mysql, { type Pool } from "mysql2/promise";
let pool: Pool | undefined;
let ready: Promise<void> | undefined;
export function database() {
  return (pool ??= mysql.createPool({
    uri: process.env.DATABASE_URL!,
    connectionLimit: 4,
    dateStrings: true,
  }));
}
export async function ensureCommitmentsSchema() {
  if (!process.env.DATABASE_URL) return;
  return (ready ??= (async () => {
    const db = database();
    for (const statement of [
      `CREATE TABLE IF NOT EXISTS commitment_preferences (studio_id INT NOT NULL,user_id INT NOT NULL,phone VARCHAR(24),consent TINYINT NOT NULL DEFAULT 0,timezone VARCHAR(64) NOT NULL DEFAULT 'America/Sao_Paulo',before_time VARCHAR(5) NOT NULL DEFAULT '09:00',first_time VARCHAR(5) NOT NULL DEFAULT '09:00',second_time VARCHAR(5) NOT NULL DEFAULT '16:00',holidays_json TEXT NOT NULL,PRIMARY KEY(studio_id,user_id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
      `CREATE TABLE IF NOT EXISTS commitment_series (id INT AUTO_INCREMENT PRIMARY KEY,studio_id INT NOT NULL,owner_id INT NOT NULL,assignee_id INT NOT NULL,title VARCHAR(200) NOT NULL,category VARCHAR(24) NOT NULL,calendar_name VARCHAR(100) NOT NULL,color VARCHAR(7) NOT NULL,amount INT NULL,start_date DATE NOT NULL,end_date DATE NULL,repeat_kind VARCHAR(12) NOT NULL,repeat_interval INT NOT NULL DEFAULT 1,shift_business TINYINT NOT NULL DEFAULT 1,notes TEXT,active TINYINT NOT NULL DEFAULT 1,created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,KEY scoped_owner(studio_id,owner_id),KEY scoped_assignee(studio_id,assignee_id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
      `CREATE TABLE IF NOT EXISTS commitment_occurrences (id INT AUTO_INCREMENT PRIMARY KEY,series_id INT NOT NULL,studio_id INT NOT NULL,original_date DATE NOT NULL,effective_date DATE NOT NULL,status VARCHAR(12) NOT NULL DEFAULT 'pending',revision INT NOT NULL DEFAULT 0,snooze_until DATETIME NULL,updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,UNIQUE KEY series_day(series_id,original_date),KEY due_date(studio_id,effective_date,status)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
      `CREATE TABLE IF NOT EXISTS commitment_deliveries (id INT AUTO_INCREMENT PRIMARY KEY,occurrence_id INT NOT NULL,revision INT NOT NULL,slot VARCHAR(12) NOT NULL,state VARCHAR(12) NOT NULL DEFAULT 'claimed',error_text VARCHAR(500),created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,UNIQUE KEY single_delivery(occurrence_id,revision,slot)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
      `CREATE TABLE IF NOT EXISTS commitment_attachments (id INT AUTO_INCREMENT PRIMARY KEY,series_id INT NOT NULL,studio_id INT NOT NULL,name VARCHAR(150) NOT NULL,mime VARCHAR(40) NOT NULL,data MEDIUMTEXT NOT NULL) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
      `CREATE TABLE IF NOT EXISTS commitment_actions (id INT AUTO_INCREMENT PRIMARY KEY,occurrence_id INT NOT NULL,studio_id INT NOT NULL,user_id INT NOT NULL,action VARCHAR(20) NOT NULL,details TEXT,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    ])
      await db.query(statement);
    console.log("[Commitments] Estrutura de compromissos pronta.");
  })().catch(e => {
    ready = undefined;
    throw e;
  }));
}
export const seriesSelect = `s.id,s.studio_id AS studioId,s.owner_id AS ownerId,s.assignee_id AS assigneeId,s.title,s.category,s.calendar_name AS calendarName,s.color,s.amount,s.start_date AS startDate,s.end_date AS endDate,s.repeat_kind AS repeatKind,s.repeat_interval AS repeatInterval,s.shift_business AS shiftBusiness,s.notes,s.active`;
export const occurrenceSelect = `o.id,o.series_id AS seriesId,o.original_date AS originalDate,o.effective_date AS effectiveDate,o.status,o.revision,o.snooze_until AS snoozeUntil,s.studio_id AS studioId,s.owner_id AS ownerId,s.assignee_id AS assigneeId,s.title,s.category,s.calendar_name AS calendarName,s.color,s.amount,s.notes`;
