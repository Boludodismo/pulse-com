import type { Express } from 'express';
import { createHmac, timingSafeEqual } from 'node:crypto';
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
  const basicValid=actual.length===expected.length&&timingSafeEqual(actual,expected);
  const cookie=req.headers.cookie?.split(';').map(v=>v.trim()).find(v=>v.startsWith('tatuei_demo_gate='))?.slice('tatuei_demo_gate='.length);
  if(basicValid){
   res.cookie('tatuei_demo_gate',createDemoGateToken(),{httpOnly:true,secure:true,sameSite:'strict',path:'/',maxAge:8*60*60*1000});
  }else if(!verifyDemoGateToken(cookie)){
   if(req.path.startsWith('/api/'))return res.status(401).json({error:'Acesso de teste expirado. Recarregue a pagina e entre com o usuario demo.'});
   res.setHeader('WWW-Authenticate','Basic realm="Tatuei Teste - somente dados ficticios"');return res.status(401).send('Acesso restrito ao ambiente ficticio de teste.');
  }
  if(/webhook|heartbeat|oauth|native-bot\/meta/i.test(req.path))return res.status(403).json({error:'Integracao desativada na demonstracao.'});
  next();
 });
 app.get('/api/demo-file',async(req,res)=>{try{
  const key=String(req.query.key||'');if(!verifyStorageAccessToken(key,String(req.query.token||'')))return res.sendStatus(403);
  const [bytes,mime]=await Promise.all([demoRead(key),demoMime(key)]);res.type(mime).setHeader('X-Content-Type-Options','nosniff');res.send(bytes);
 }catch{res.sendStatus(404);}});
}

// Establish the same demo access for fetch requests without depending on the
// browser forwarding its cached HTTP Basic header to every API request.
function gateSignature(value:string){
 return createHmac('sha256',process.env.AUTH_SECURITY_KEY||'').update('tatuei-demo-gate:'+value+':'+process.env.LOCAL_ADMIN_PASSWORD).digest('hex');
}
export function createDemoGateToken(now=Date.now()){
 if(!process.env.AUTH_SECURITY_KEY||!process.env.LOCAL_ADMIN_PASSWORD)throw new Error('DEMO_GATE_SECRET_REQUIRED');
 const expires=String(now+8*60*60*1000);return expires+'.'+gateSignature(expires);
}
export function verifyDemoGateToken(token:string|undefined,now=Date.now()){
 if(!process.env.AUTH_SECURITY_KEY||!process.env.LOCAL_ADMIN_PASSWORD||!token||!/^\d{13}\.[a-f0-9]{64}$/.test(token))return false;
 const [expires,signature]=token.split('.');const remaining=Number(expires)-now;
 return remaining>0&&remaining<=8*60*60*1000&&timingSafeEqual(Buffer.from(signature),Buffer.from(gateSignature(expires)));
}
