import { createHash } from 'node:crypto';
import { readFile, writeFile, rm, stat, readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
export function demoPath(key: string) {
  const base=process.env.DEMO_UPLOAD_DIR;
  if(process.env.DEMO_MODE!=='true'||!base||!resolve(base).startsWith('/tmp/tatuei-demo-')) throw new Error('DEMO_STORAGE_SCOPE_REQUIRED');
  if(!key||key.length>1500)throw new Error('DEMO_INVALID_KEY');
  return join(base,createHash('sha256').update(key).digest('hex'));
}
export async function demoPut(key:string,data:Buffer|Uint8Array|string,mime:string) {
  const bytes=Buffer.from(data);if(bytes.length>10*1024*1024)throw new Error('Arquivo de teste limitado a 10 MB.');
  const base=process.env.DEMO_UPLOAD_DIR!; const path=demoPath(key);
  const sizes=await Promise.all((await readdir(base)).map(async n=>(await stat(join(base,n))).size));
  if(sizes.reduce((a,b)=>a+b,0)+bytes.length>64*1024*1024)throw new Error('Armazenamento temporario de teste cheio.');
  await writeFile(path,bytes,{mode:0o600});await writeFile(path+'.json',JSON.stringify({mime}),{mode:0o600});
}
export async function demoRead(key:string,maxBytes=10*1024*1024){const p=demoPath(key);if((await stat(p)).size>maxBytes)throw new Error('Arquivo maior que o limite.');return readFile(p);}
export async function demoMime(key:string){const v=JSON.parse(await readFile(demoPath(key)+'.json','utf8'));return ['image/png','image/jpeg','image/webp','image/gif','application/pdf'].includes(v.mime)?v.mime:'application/octet-stream';}
export async function demoDelete(key:string){const p=demoPath(key);await rm(p,{force:true});await rm(p+'.json',{force:true});}
