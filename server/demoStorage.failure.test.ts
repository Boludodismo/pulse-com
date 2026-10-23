import {describe,it,expect,vi} from 'vitest';
const failure=vi.hoisted(()=>({enabled:false}));
vi.mock('node:fs/promises',async importOriginal=>{
 const fs=await importOriginal<typeof import('node:fs/promises')>();
 return {...fs,writeFile:async(...args:Parameters<typeof fs.writeFile>)=>{
  if(failure.enabled&&String(args[0]).includes('/.pending-')){
   await fs.writeFile(args[0],Buffer.from(args[1] as Buffer).subarray(0,7),args[2]);throw new Error('simulated partial disk write');
  }
  return fs.writeFile(...args);
 }};
});
import {mkdtemp,readdir,rm} from 'node:fs/promises';
import {demoPut,demoReadObject} from './demoStorage';
describe('failed demo disk writes',()=>{
 it('leaves the previous complete object readable and no partial new object or metadata',async()=>{
  const base=await mkdtemp('/tmp/tatuei-demo-failure-');vi.stubEnv('DEMO_MODE','true');vi.stubEnv('DEMO_UPLOAD_DIR',base);
  try{
   await demoPut('existing','old bytes','image/png');failure.enabled=true;
   await expect(demoPut('existing','replacement','image/jpeg')).rejects.toThrow('partial disk write');
   await expect(demoPut('new','new bytes','image/png')).rejects.toThrow('partial disk write');
   expect(await demoReadObject('existing')).toEqual({bytes:Buffer.from('old bytes'),mime:'image/png'});
   await expect(demoReadObject('new')).rejects.toThrow();expect(await readdir(base)).toHaveLength(1);
  }finally{failure.enabled=false;vi.unstubAllEnvs();await rm(base,{recursive:true,force:true});}
 });
});
