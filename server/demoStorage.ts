import { createHash, randomUUID } from 'node:crypto';
import { readFile, writeFile, rm, stat, readdir, rename } from 'node:fs/promises';
import { join, resolve } from 'node:path';
const FILE_LIMIT=10*1024*1024, TOTAL_LIMIT=64*1024*1024;
const MAGIC=Buffer.from('TATUEI-DEMO-OBJECT-1\n');
const queues=new Map<string,Promise<unknown>>();
export function demoPath(key: string) {
  const base=process.env.DEMO_UPLOAD_DIR;
  if(process.env.DEMO_MODE!=='true'||!base||!resolve(base).startsWith('/tmp/tatuei-demo-')) throw new Error('DEMO_STORAGE_SCOPE_REQUIRED');
  if(!key||key.length>1500)throw new Error('DEMO_INVALID_KEY');
  return join(base,createHash('sha256').update(key).digest('hex'));
}
async function exclusive<T>(base:string,work:()=>Promise<T>):Promise<T>{
  const previous=queues.get(base)??Promise.resolve();
  const next=previous.catch(()=>{}).then(work);queues.set(base,next);
  try{return await next;}finally{if(queues.get(base)===next)queues.delete(base);}
}
const allowedMime=(mime:unknown)=>['image/png','image/jpeg','image/webp','image/gif','application/pdf'].includes(String(mime))?String(mime):'application/octet-stream';
async function size(path:string){try{return (await stat(path)).size;}catch(error:any){if(error.code==='ENOENT')return 0;throw error;}}
/** One process owns a disposable demo directory. Metadata and payload publish as one atomic object. */
export async function demoPut(key:string,data:Buffer|Uint8Array|string,mime:string) {
  const bytes=Buffer.from(data);if(bytes.length>FILE_LIMIT)throw new Error('Arquivo de teste limitado a 10 MB.');
  const path=demoPath(key),base=process.env.DEMO_UPLOAD_DIR!;
  const header=Buffer.from(JSON.stringify({mime:allowedMime(mime),length:bytes.length})+'\n');
  const object=Buffer.concat([MAGIC,header,bytes]);
  return exclusive(base,async()=>{
    const total=(await Promise.all((await readdir(base)).map(n=>size(join(base,n))))).reduce((a,b)=>a+b,0);
    const replaced=await size(path)+await size(path+'.json');
    if(total-replaced+object.length>TOTAL_LIMIT)throw new Error('Armazenamento temporario de teste cheio.');
    const temporary=join(base,'.pending-'+randomUUID());
    try{
      await writeFile(temporary,object,{mode:0o600,flag:'wx'});
      await rename(temporary,path);
    }finally{await rm(temporary,{force:true});}
    // Only this object's obsolete legacy metadata; never evict another upload.
    await rm(path+'.json',{force:true});
  });
}
export async function demoReadObject(key:string,maxBytes=FILE_LIMIT){
  const path=demoPath(key);
  if((await stat(path)).size>Math.min(maxBytes,FILE_LIMIT)+1024)throw new Error('Arquivo maior que o limite.');
  const object=await readFile(path);
  if(object.subarray(0,MAGIC.length).equals(MAGIC)){
    const end=object.indexOf(10,MAGIC.length);if(end<0||end>MAGIC.length+1024)throw new Error('DEMO_INCOMPLETE_OBJECT');
    const header=JSON.parse(object.subarray(MAGIC.length,end).toString('utf8'));
    const bytes=object.subarray(end+1);
    if(header.length!==bytes.length)throw new Error('DEMO_INCOMPLETE_OBJECT');
    if(bytes.length>Math.min(maxBytes,FILE_LIMIT))throw new Error('Arquivo maior que o limite.');
    return {bytes,mime:allowedMime(header.mime)};
  }
  // Read compatibility for existing temporary files; no migration or inference of MIME.
  if(object.length>Math.min(maxBytes,FILE_LIMIT))throw new Error('Arquivo maior que o limite.');
  const meta=JSON.parse(await readFile(path+'.json','utf8'));
  return {bytes:object,mime:allowedMime(meta.mime)};
}
export async function demoRead(key:string,maxBytes=FILE_LIMIT){return (await demoReadObject(key,maxBytes)).bytes;}
export async function demoMime(key:string){return (await demoReadObject(key)).mime;}
export async function demoDelete(key:string){const path=demoPath(key),base=process.env.DEMO_UPLOAD_DIR!;await exclusive(base,async()=>{await rm(path,{force:true});await rm(path+'.json',{force:true});});}
