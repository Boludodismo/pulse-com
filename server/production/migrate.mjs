import mysql from 'mysql2/promise';
import { readFile } from 'node:fs/promises';
import { createHash, createCipheriv, randomBytes } from 'node:crypto';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
const env = process.env;
if (env.RAILWAY_ENVIRONMENT_ID !== '9890a3b6-7cb6-4330-abfe-d7665bbcf900' || env.RAILWAY_SERVICE_ID !== '7527417a-b872-42bf-b828-e0987b805196') throw Error('Production migration scope mismatch');
if (!env.DATABASE_URL || !env.JWT_SECRET || !env.AWS_S3_BUCKET_NAME) throw Error('Missing migration configuration');
const sqlText = await readFile(new URL('./upgrade.sql', import.meta.url), 'utf8');
const version = createHash('sha256').update(sqlText).digest('hex');
const c = await mysql.createConnection({ uri: env.DATABASE_URL, multipleStatements: true, dateStrings: true, supportBigNumbers: true, bigNumberStrings: true });
const qi = s => '`' + s.replaceAll('`', '``') + '`';
try {
  const [[lock]] = await c.query("SELECT GET_LOCK('crm-production-upgrade-20260908',120) AS acquired");
  if (Number(lock.acquired) !== 1) throw Error('Migration lock not acquired');
  await c.query('CREATE TABLE IF NOT EXISTS crm_production_upgrades (version varchar(64) PRIMARY KEY, backupKey varchar(255) NOT NULL, appliedAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP)');
  const [done] = await c.execute('SELECT version FROM crm_production_upgrades WHERE version=?', [version]);
  if (!done.length) {
    const [tables] = await c.query("SELECT TABLE_NAME AS name FROM information_schema.tables WHERE TABLE_SCHEMA=DATABASE() AND TABLE_TYPE='BASE TABLE' ORDER BY TABLE_NAME");
    const backup = { format: 'crm-json-v1', createdAt: new Date().toISOString(), tables: {} };
    await c.query('START TRANSACTION WITH CONSISTENT SNAPSHOT, READ ONLY');
    for (const {name} of tables) {
      const [[ddl]] = await c.query(`SHOW CREATE TABLE ${qi(name)}`);
      const [rows] = await c.query(`SELECT * FROM ${qi(name)}`);
      backup.tables[name] = { ddl: ddl['Create Table'], rows };
    }
    await c.query('COMMIT');
    const key = createHash('sha256').update('crm-production-backup-v1:' + env.JWT_SECRET).digest();
    const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', key, iv);
    const ciphertext = Buffer.concat([cipher.update(JSON.stringify(backup)), cipher.final()]);
    const body = Buffer.from(JSON.stringify({ format:'crm-aes256gcm-json-v1', iv:iv.toString('base64'), tag:cipher.getAuthTag().toString('base64'), data:ciphertext.toString('base64') }));
    const backupKey = `_backups/production-before-upgrade-${Date.now()}.json.enc`;
    const s3 = new S3Client({ endpoint:env.AWS_ENDPOINT_URL, region:env.AWS_DEFAULT_REGION || 'auto', forcePathStyle:env.AWS_S3_URL_STYLE==='path', credentials:{accessKeyId:env.AWS_ACCESS_KEY_ID,secretAccessKey:env.AWS_SECRET_ACCESS_KEY} });
    await s3.send(new PutObjectCommand({Bucket:env.AWS_S3_BUCKET_NAME,Key:backupKey,Body:body,ContentType:'application/octet-stream'}));
    const check = await s3.send(new GetObjectCommand({Bucket:env.AWS_S3_BUCKET_NAME,Key:backupKey}));
    const returned = Buffer.from(await check.Body.transformToByteArray());
    if (!returned.equals(body)) throw Error('Backup verification failed');
    console.log('[Production migration] Encrypted backup verified:', backupKey);
    await c.query(sqlText);
    for (const [name, snapshot] of Object.entries(backup.tables)) {
      const [[row]] = await c.query(`SELECT COUNT(*) AS n FROM ${qi(name)}`);
      if (Number(row.n) < snapshot.rows.length) throw Error(`Row count decreased: ${name}`);
    }
    const [users] = await c.query('SELECT id, passwordHash, role, studioId FROM users');
    for (const u of backup.tables.users.rows) {
      const actual = users.find(x=>x.id===u.id);
      if (!actual || ['passwordHash','role','studioId'].some(k=>actual[k]!==u[k])) throw Error('Existing user credentials or role changed');
    }
    await c.execute('INSERT INTO crm_production_upgrades(version,backupKey) VALUES (?,?)', [version,backupKey]);
    console.log('[Production migration] Additive schema applied; existing row counts and credentials preserved');
  } else console.log('[Production migration] Verified upgrade already applied');
} finally {
  await c.query("SELECT RELEASE_LOCK('crm-production-upgrade-20260908')").catch(()=>{});
  await c.end();
}
