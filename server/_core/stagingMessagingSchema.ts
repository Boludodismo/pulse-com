import mysql, {type RowDataPacket} from 'mysql2/promise';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
export async function ensureStagingMessagingSchema() {
 if (process.env.RAILWAY_ENVIRONMENT_ID !== '92e8281a-668a-43ed-b2ba-cac84082a91c' || process.env.RAILWAY_SERVICE_ID !== '7527417a-b872-42bf-b828-e0987b805196') return;
 if (process.env.RUN_DB_MIGRATIONS !== 'true') throw new Error('Staging messaging schema upgrade requires migrations enabled.');
 const c=await mysql.createConnection(process.env.DATABASE_URL!);
 try {
  const [lock]=await c.query<RowDataPacket[]>("SELECT GET_LOCK('podcrm_messaging_upgrade',30) AS acquired");
  if (Number(lock[0]?.acquired)!==1) throw new Error('Messaging schema lock unavailable');
  const additions:Record<string,Record<string,string>>={
   whatsapp_integrations:{studio_id:'INT NULL',encrypted_api_token:'TEXT NULL',encrypted_webhook_secret:'TEXT NULL',connection_key:'VARCHAR(96) NULL',sandbox_mode:'TINYINT NOT NULL DEFAULT 1',sandbox_test_phone:'VARCHAR(32) NULL',is_enabled:'TINYINT NOT NULL DEFAULT 0',last_success_at:'TIMESTAMP NULL',failure_count:'INT NOT NULL DEFAULT 0',production_activated_at:'TIMESTAMP NULL',production_activated_by_user_id:'INT NULL'},
   message_templates:{studio_id:'INT NULL'},message_queue:{studio_id:'INT NULL',retry_of_queue_id:'INT NULL'},
  };
  for(const [table,fields] of Object.entries(additions)) {
   const [columns]=await c.execute<RowDataPacket[]>('SELECT COLUMN_NAME FROM information_schema.columns WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=?',[table]);
   if(!columns.length) throw new Error('Missing base messaging table: '+table);
   for(const [name,type] of Object.entries(fields)) if(!columns.some(r=>r.COLUMN_NAME===name)) await c.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${name}\` ${type}`);
  }
  for(const filename of ['0044_botconversa_phase1_foundation.sql','0047_botconversa_automatic_reminders.sql','0053_customer_care.sql','0054_studio_relations.sql']) {
   const source=await readFile(resolve(process.cwd(),'drizzle',filename),'utf8');
   const statements=source.split('\n').filter(l=>!l.trimStart().startsWith('--')).join('\n').split(';');
   for(let statement of statements) if(/^CREATE TABLE /i.test(statement.trim())) { statement=statement.trim().replace(/^CREATE TABLE (?!IF NOT EXISTS)/i,'CREATE TABLE IF NOT EXISTS ');await c.query(statement); }
  }
  const [cols]=await c.query<RowDataPacket[]>("SHOW COLUMNS FROM message_automation_settings LIKE 'one_hour_reminders_enabled'");
  if(!cols.length) await c.query('ALTER TABLE message_automation_settings ADD COLUMN one_hour_reminders_enabled TINYINT NOT NULL DEFAULT 0');
  console.log('[Messaging] Additive staging schema verified; legacy connections remain unassigned and disabled.');
 } finally { await c.query("SELECT RELEASE_LOCK('podcrm_messaging_upgrade')");await c.end(); }
}
