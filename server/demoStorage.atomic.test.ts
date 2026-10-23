import {describe,it,expect,vi,afterEach} from 'vitest';
import {mkdtemp,readdir,stat,readFile,writeFile,rm} from 'node:fs/promises';
import {demoPut,demoReadObject,demoPath} from './demoStorage';
const dirs:string[]=[];
afterEach(async()=>{vi.restoreAllMocks();vi.unstubAllEnvs();for(const dir of dirs.splice(0))await rm(dir,{recursive:true,force:true});});
async function setup(){const base=await mkdtemp('/tmp/tatuei-demo-quota-');dirs.push(base);vi.stubEnv('DEMO_MODE','true');vi.stubEnv('DEMO_UPLOAD_DIR',base);return base;}
describe('atomic disposable demo uploads',()=>{
 it('serializes concurrent writes within 64 MiB and refuses overflow without eviction',async()=>{
  const base=await setup(),bytes=Buffer.alloc(10*1024*1024,42);
  const results=await Promise.allSettled(Array.from({length:8},(_,i)=>demoPut('fiction-'+i,bytes,'image/png')));
  expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(6);
  const files=await readdir(base);expect(files).toHaveLength(6);
  const total=(await Promise.all(files.map(f=>stat(base+'/'+f)))).reduce((n,s)=>n+s.size,0);expect(total).toBeLessThanOrEqual(64*1024*1024);
  for(let i=0;i<6;i++)expect((await demoReadObject('fiction-'+i)).bytes.equals(bytes)).toBe(true);
 });
 it('replaces an object without double counting, enforces per-file bounds and keeps MIME with bytes',async()=>{
  await setup();const bytes=Buffer.from('synthetic');await demoPut('a',bytes,'image/png');await demoPut('a','new','application/pdf');
  expect(await demoReadObject('a')).toEqual({bytes:Buffer.from('new'),mime:'application/pdf'});
  await expect(demoReadObject('a',2)).rejects.toThrow('limite');
  await expect(demoPut('b',Buffer.alloc(10*1024*1024+1),'image/png')).rejects.toThrow('10 MB');
 });
 it('reads the previous layout without rewriting existing files',async()=>{
  await setup();const path=demoPath('legacy');await writeFile(path,'old');await writeFile(path+'.json',JSON.stringify({mime:'image/jpeg'}));
  expect(await demoReadObject('legacy')).toEqual({bytes:Buffer.from('old'),mime:'image/jpeg'});expect(await readFile(path,'utf8')).toBe('old');
 });
 it('removes staging files after rename failure and retains the previous complete object',async()=>{
  const base=await setup();await demoPut('a','old','image/png');
  // A directory at a new opaque destination forces rename failure, without touching any other object.
  const fs=await import('node:fs/promises');await fs.mkdir(demoPath('blocked'));
  await expect(demoPut('blocked','new','image/png')).rejects.toThrow();
  expect((await readdir(base)).some(f=>f.startsWith('.pending-'))).toBe(false);
  expect((await demoReadObject('a')).bytes.toString()).toBe('old');
 });
});
