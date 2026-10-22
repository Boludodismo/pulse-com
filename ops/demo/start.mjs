import { mkdtemp, mkdir } from 'node:fs/promises';
import { tmpdir, userInfo } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import mysql from 'mysql2/promise';
import { initialize } from './bootstrap.mjs';
let db, app;
async function main(){
if (process.env.DEMO_MODE !== 'true') throw new Error('DEMO_MODE_REQUIRED');
for (const k of ['DATABASE_URL','AWS_ACCESS_KEY_ID','AWS_SECRET_ACCESS_KEY','AWS_ENDPOINT_URL','BUILT_IN_FORGE_API_KEY','AUTH_EMAIL_API_KEY','GOOGLE_CALENDAR_CLIENT_SECRET','RAILWAY_PROJECT_ID']) {
  if (process.env[k]) throw new Error('DEMO_FORBIDS_EXTERNAL_CONFIGURATION: '+k);
}
const password = process.env.LOCAL_ADMIN_PASSWORD;
if (!password || password.length<16) throw new Error('DEMO_PASSWORD_REQUIRED');
const base = await mkdtemp(join(tmpdir(),'tatuei-demo-'));
const datadir=join(base,'mysql'); const uploads=join(base,'uploads'); await mkdir(uploads,{mode:0o700});
const socket=join(base,'db.sock'); const dbPort=Number(process.env.DEMO_DB_PORT||3307);
const bin=process.env.DEMO_MARIADB_BASEDIR; const init=bin?join(bin,'bin/mariadb-install-db'):'mariadb-install-db';
const daemon=bin?join(bin,'sbin/mariadbd'):'mariadbd';
function run(file,args) { return new Promise((resolve,reject)=> { const p=spawn(file,args,{stdio:['ignore','pipe','pipe']}); let output=''; p.stdout.on('data',b=>output+=b);p.stderr.on('data',b=>output+=b);p.on('error',reject);p.on('exit',code=>code===0?resolve():reject(new Error('Demo database initialization failed (no credentials logged): '+output.slice(-1600)))); }); }
await run(init,['--no-defaults','--datadir='+datadir,'--auth-root-authentication-method=normal','--skip-test-db','--user='+userInfo().username,...(bin?['--basedir='+bin]:[])]);
db=spawn(daemon,['--no-defaults','--user='+userInfo().username,'--datadir='+datadir,'--socket=','--pid-file='+join(base,'db.pid'),'--bind-address=127.0.0.1','--port='+dbPort,'--skip-log-bin','--performance-schema=OFF','--innodb-buffer-pool-size=32M','--innodb-log-file-size=16M','--key-buffer-size=8M','--aria-pagecache-buffer-size=8M','--max-connections=40','--tmp-table-size=4M','--max-heap-table-size=4M',...(bin?['--basedir='+bin,'--lc-messages-dir='+join(bin,'share/mysql')]:[])],{stdio:['ignore','ignore','pipe']});
let databaseErrors='';db.stderr.on('data',b=>databaseErrors+=b);
function stop(code=0) { app?.kill('SIGTERM');db.kill('SIGTERM'); setTimeout(()=>process.exit(code),1000).unref(); }
process.on('SIGTERM',()=>stop()); process.on('SIGINT',()=>stop()); db.on('exit',()=>{if(app)stop(1);});
let root;
for(let i=0;i<90;i++){ try { root=await mysql.createConnection({host:'127.0.0.1',port:dbPort,user:'root',connectTimeout:1000});break;} catch { if(db.exitCode!==null)throw new Error('Demo database stopped: '+databaseErrors.slice(-1200));await new Promise(r=>setTimeout(r,500)); } }
if(!root)throw new Error('DEMO_DATABASE_START_TIMEOUT');
const dbPassword=randomBytes(24).toString('hex');
await root.query('CREATE DATABASE tatuei_demo CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
await root.query("CREATE USER 'tatuei_demo'@'127.0.0.1' IDENTIFIED BY ?",[dbPassword]);
await root.query("GRANT ALL ON tatuei_demo.* TO 'tatuei_demo'@'127.0.0.1'");
await root.query("ALTER USER 'root'@'localhost' IDENTIFIED BY ?",[randomBytes(32).toString('hex')]);
await root.end();
const connection=await mysql.createConnection({host:'127.0.0.1',port:dbPort,user:'tatuei_demo',password:dbPassword,database:'tatuei_demo'});
try { await initialize(connection,password); } catch(e) {db.kill();throw e;} finally { await connection.end(); }
const env={PATH:process.env.PATH,NODE_ENV:'production',TZ:'America/Sao_Paulo',PORT:process.env.PORT||'10000',DEMO_MODE:'true',DEMO_UPLOAD_DIR:uploads,DATABASE_URL:'mysql://tatuei_demo:'+dbPassword+'@127.0.0.1:'+dbPort+'/tatuei_demo',AUTH_MODE:'local',VITE_AUTH_MODE:'local',LOCAL_ADMIN_EMAIL:'demo@example.invalid',LOCAL_ADMIN_PASSWORD:password,LOCAL_ADMIN_NAME:'Administrador de Teste',LOCAL_STUDIO_NAME:'Estudio Ficticio - TESTE',OWNER_OPEN_ID:'demo-owner',JWT_SECRET:process.env.JWT_SECRET||randomBytes(48).toString('hex'),AUTH_SECURITY_KEY:process.env.AUTH_SECURITY_KEY||randomBytes(48).toString('hex'),OUTBOUND_MESSAGING_DISABLED:'true',SCHEDULER_MODE:'disabled',RUN_DB_MIGRATIONS:'false',STORAGE_PROVIDER:'demo',STORAGE_STARTUP_CHECK:'false',INTELLIGENT_INBOX_ENABLED:'false',APP_BASE_URL:process.env.RENDER_EXTERNAL_URL||'http://127.0.0.1:'+(process.env.PORT||'10000')};
app=spawn(process.execPath,['--max-old-space-size=200','--import','./ops/demo/network-guard.mjs','dist/index.js'],{env,stdio:['ignore','pipe','pipe']});
function forward(stream, dest){let pending='';stream.on('data',chunk=>{pending+=chunk;let at;while((at=pending.indexOf('\n'))>=0){let line=pending.slice(0,at);pending=pending.slice(at+1);for(const value of [password,dbPassword,env.JWT_SECRET,env.AUTH_SECURITY_KEY])line=line.split(value).join('<redacted>');dest.write(line+'\n');}});}
forward(app.stdout,process.stdout);forward(app.stderr,process.stderr);
app.on('exit',code=>stop(code||0));
console.log('[Demo] Ambiente descartavel: dados e uploads podem ser recriados apos reinicio.');

}
main().catch(error=>{console.error('[Demo] Falha na inicializacao isolada:',error.code || (String(error.message).startsWith('DEMO_')?error.message:'STARTUP_FAILED'));app?.kill('SIGTERM');db?.kill('SIGTERM');process.exitCode=1;});
