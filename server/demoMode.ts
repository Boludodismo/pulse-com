import type { Express } from 'express';
import { timingSafeEqual } from 'node:crypto';
import { demoRead, demoMime } from './demoStorage';
import { verifyStorageAccessToken } from './storage';
export function assertDemoScope(){
 if(process.env.DEMO_MODE!=='true')return;
 const u=new URL(process.env.DATABASE_URL||'');
 if(u.protocol!=='mysql:'||u.hostname!=='127.0.0.1'||u.pathname!=='/tatuei_demo'||!process.env.DEMO_UPLOAD_DIR?.startsWith('/tmp/tatuei-demo-'))throw new Error('DEMO_ISOLATION_REQUIRED');
 if(process.env.OUTBOUND_MESSAGING_DISABLED!=='true'||process.env.RUN_DB_MIGRATIONS!=='false')throw new Error('DEMO_SAFETY_REQUIRED');
}
export function registerDemoMode(app:Express){
 if(process.env.DEMO_MODE!=='true')return;
 app.use((req,res,next)=>{
  res.setHeader('X-Robots-Tag','noindex, nofollow');res.setHeader('Cache-Control','no-store');
  res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; media-src 'self' blob:; frame-src 'none'; form-action 'self'");
  if(req.path==='/api/health'&&req.method==='GET')return next();
  const expected=Buffer.from('demo:'+process.env.LOCAL_ADMIN_PASSWORD);
  const auth=req.get('authorization')||'';let actual=Buffer.alloc(0);
  if(auth.startsWith('Basic '))actual=Buffer.from(auth.slice(6),'base64');
  if(actual.length!==expected.length||!timingSafeEqual(actual,expected)){res.setHeader('WWW-Authenticate','Basic realm="Tatuei Teste - somente dados ficticios"');return res.status(401).send('Acesso restrito ao ambiente ficticio de teste.');}
  if(/webhook|heartbeat|oauth|native-bot\/meta/i.test(req.path))return res.status(403).json({error:'Integracao desativada na demonstracao.'});
  next();
 });
 app.get('/api/demo-file',async(req,res)=>{try{
  const key=String(req.query.key||'');if(!verifyStorageAccessToken(key,String(req.query.token||'')))return res.sendStatus(403);
  const [bytes,mime]=await Promise.all([demoRead(key),demoMime(key)]);res.type(mime).setHeader('X-Content-Type-Options','nosniff');res.send(bytes);
 }catch{res.sendStatus(404);}});
}
