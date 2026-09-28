/** Explicit, guarded release preflight. Never imported by the CRM server. */
import assert from 'node:assert/strict';
import {randomBytes,createHash,createCipheriv,createDecipheriv,hkdfSync} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {gzipSync,gunzipSync} from 'node:zlib';
import mysql from 'mysql2/promise';
import {S3Client,PutObjectCommand,GetObjectCommand} from '@aws-sdk/client-s3';
const MAGIC=Buffer.from('TATUEI_CARD_BACKUP_V1\n');
const INFO=Buffer.from('tatuei-artist-card-backup-v1');
export function encryptCardSnapshot(plain,secret){
 const salt=randomBytes(32),iv=randomBytes(12),key=Buffer.from(hkdfSync('sha256',Buffer.from(secret),salt,INFO,32));
 const cipher=createCipheriv('aes-256-gcm',key,iv);cipher.setAAD(MAGIC);
 const body=Buffer.concat([cipher.update(gzipSync(plain)),cipher.final()]);
 return Buffer.concat([MAGIC,salt,iv,cipher.getAuthTag(),body]);
}
export function decryptCardSnapshot(encoded,secret){
 assert.ok(encoded.subarray(0,MAGIC.length).equals(MAGIC),'Unsupported card snapshot');
 let p=MAGIC.length;const salt=encoded.subarray(p,p+=32),iv=encoded.subarray(p,p+=12),tag=encoded.subarray(p,p+=16);
 const key=Buffer.from(hkdfSync('sha256',Buffer.from(secret),salt,INFO,32)),decipher=createDecipheriv('aes-256-gcm',key,iv);decipher.setAAD(MAGIC);decipher.setAuthTag(tag);
 return gunzipSync(Buffer.concat([decipher.update(encoded.subarray(p)),decipher.final()]));
}
export async function migrateCardPresentation(connection){
 const sql=await readFile(new URL('../drizzle/0059_artist_card_presentation.sql',import.meta.url),'utf8');
 const statements=sql.split('\n').filter(l=>!l.trimStart().startsWith('--')).join('\n').split(';').map(s=>s.trim()).filter(Boolean);
 for(const statement of statements)await connection.query(statement);
 const [columns]=await connection.query("SELECT DATA_TYPE,IS_NULLABLE FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='artist_cards' AND column_name='presentation'");
 assert.equal(columns.length,1);assert.equal(columns[0].DATA_TYPE,'text');assert.equal(columns[0].IS_NULLABLE,'YES');
}
export async function releaseCard(){
 const service=process.env.RAILWAY_SERVICE_ID,environment=process.env.RAILWAY_ENVIRONMENT_ID;
 const production=service==='7527417a-b872-42bf-b828-e0987b805196'&&environment==='9890a3b6-7cb6-4330-abfe-d7665bbcf900';
 const isolated=service==='e834a3ac-1180-4ba3-b0c6-e9f07a20ddd6'&&environment==='92e8281a-668a-43ed-b2ba-cac84082a91c'&&process.env.ARTIST_CARD_TEST_ENV==='true';
 assert.ok(production||isolated,'Release preflight is restricted to the approved CRM or its isolated card test service');
 assert.equal(process.env.STORAGE_PROVIDER,'s3','A durable private S3 backup is required');
 for(const key of ['DATABASE_URL','JWT_SECRET','AWS_ENDPOINT_URL','AWS_ACCESS_KEY_ID','AWS_SECRET_ACCESS_KEY','AWS_S3_BUCKET_NAME'])assert.ok(process.env[key],key+' must be configured');
 assert.ok(process.env.JWT_SECRET.length>=32,'A strong existing encryption secret is required');
 if(production)assert.ok(['crm.tatuei.com','tatuei.com','www.tatuei.com'].includes(new URL(process.env.APP_BASE_URL).hostname));
 if(isolated){assert.equal(new URL(process.env.DATABASE_URL).pathname,'/artist_card_test_20260919');assert.equal(process.env.OUTBOUND_MESSAGING_DISABLED,'true');}
 const db=await mysql.createConnection(process.env.DATABASE_URL);
 let locked=false;
 const client=new S3Client({region:process.env.AWS_DEFAULT_REGION||'auto',endpoint:process.env.AWS_ENDPOINT_URL,forcePathStyle:process.env.AWS_S3_URL_STYLE==='path',credentials:{accessKeyId:process.env.AWS_ACCESS_KEY_ID,secretAccessKey:process.env.AWS_SECRET_ACCESS_KEY},maxAttempts:2});
 try{
  await db.query('SET SESSION lock_wait_timeout=10');
  const [locks]=await db.query("SELECT GET_LOCK('tatuei_artist_card_release_0059',15) AS acquired");assert.equal(Number(locks[0].acquired),1,'Card release lock unavailable');locked=true;
  await db.beginTransaction();
  const [rows]=await db.query('SELECT * FROM artist_cards ORDER BY id');
  const [schema]=await db.query('SHOW CREATE TABLE artist_cards');
  await db.commit();
  const plain=Buffer.from(JSON.stringify({version:1,table:'artist_cards',createdAt:new Date().toISOString(),schema:schema[0]['Create Table'],rows}));
  const encrypted=encryptCardSnapshot(plain,process.env.JWT_SECRET);
  const key='private/maintenance/artist-cards/'+new Date().toISOString().replace(/[:.]/g,'-')+'-'+randomBytes(8).toString('hex')+'.json.enc';
  const bucket=process.env.AWS_S3_BUCKET_NAME;
  await client.send(new PutObjectCommand({Bucket:bucket,Key:key,Body:encrypted,ContentType:'application/octet-stream'}),{abortSignal:AbortSignal.timeout(20000)});
  const stored=await client.send(new GetObjectCommand({Bucket:bucket,Key:key}),{abortSignal:AbortSignal.timeout(20000)});
  assert.ok(stored.Body);const returned=Buffer.from(await stored.Body.transformToByteArray());
  assert.ok(returned.equals(encrypted),'Stored encrypted snapshot differs');
  const restored=decryptCardSnapshot(returned,process.env.JWT_SECRET);assert.ok(restored.equals(plain),'Snapshot read-back verification failed');
  console.log('[ArtistCardRelease] Encrypted private snapshot verified; rows='+rows.length+' sha256='+createHash('sha256').update(plain).digest('hex'));
  console.log('[ArtistCardRelease] Recovery object: '+key);
  await migrateCardPresentation(db);
  console.log('[ArtistCardRelease] Nullable presentation column verified. No existing card field, token or record was rewritten.');
 }finally{
  if(locked)await db.query("SELECT RELEASE_LOCK('tatuei_artist_card_release_0059')").catch(()=>{});
  await db.end();client.destroy();
 }
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){releaseCard().catch(error=>{console.error('[ArtistCardRelease] Aborted safely: '+(error?.code||error?.name||'Error'));process.exitCode=1;});}
