/** Isolated, read-only preview. No CRM imports, database, credentials or jobs. */
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { brotliDecompressSync } from 'node:zlib';
import { createHash } from 'node:crypto';
const html = brotliDecompressSync(Buffer.concat([1,2,3].map(n=>readFileSync(new URL(`./page.${n}.brpart`,import.meta.url)))));
const expected = 'f1c733770f8de84e224762bc93c9b8a1fd8ac0577cd4dd8cc775cee3ce72ce8d';
if (createHash('sha256').update(html).digest('hex') !== expected) throw new Error('Preview integrity check failed');
const health = Buffer.from(JSON.stringify({ status: 'ok', mode: 'artist-card-preview', crmConnected: false, version: expected.slice(0,12) }));
const server = createServer((req,res) => {
  const path = new URL(req.url || '/', 'http://localhost').pathname;
  const headers = {
    'Content-Type':'text/html; charset=utf-8', 'Cache-Control':'no-store',
    'X-Content-Type-Options':'nosniff', 'X-Robots-Tag':'noindex, nofollow, noarchive',
    'Referrer-Policy':'no-referrer',
    'Content-Security-Policy':"default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob: https:; connect-src 'none'; form-action 'none'; base-uri 'none'; frame-ancestors 'none'",
    'Permissions-Policy':'camera=(), microphone=(), geolocation=()'
  };
  if (!['GET','HEAD'].includes(req.method)) { res.writeHead(405,{...headers,Allow:'GET, HEAD'}); return res.end('Method not allowed'); }
  let status=200,body=html;
  if (path === '/health') { headers['Content-Type']='application/json; charset=utf-8'; body=health; }
  else if(path === '/robots.txt') {headers['Content-Type']='text/plain; charset=utf-8'; body=Buffer.from('User-agent: *\nDisallow: /\n');}
  else if(path === '/favicon.ico') {status=204;body=Buffer.alloc(0);}
  else if(!['/','/cartao','/cartao/'].includes(path)){status=404;body=Buffer.from('Página não encontrada.');}
  headers['Content-Length']=String(body.length);
  res.writeHead(status,headers);res.end(req.method==='HEAD'?undefined:body);
});
const port=Number(process.env.PORT||8080);
if(!Number.isInteger(port)||port<1||port>65535)throw new Error('Invalid PORT');
server.listen(port,'0.0.0.0',()=>console.log('Isolated artist-card preview ready'));
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>server.close(()=>process.exit(0)));
