import {describe,it,expect} from 'vitest';
import {build} from 'esbuild';
import {mkdtemp,writeFile,rm,mkdir} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
describe('PDF export in compiled Node ESM runtime',()=>{
 it('uses the real dependency exports and produces a PDF outside Vitest interop',async()=>{
  const cache=resolve('node_modules/.cache');await mkdir(cache,{recursive:true});const temp=await mkdtemp(cache+'/tatuei-pdf-');
  try{
   const output=await build({entryPoints:['server/auditPdfGenerator.ts'],bundle:true,platform:'node',packages:'external',format:'esm',write:false});
   await writeFile(temp+'/generator.mjs',output.outputFiles[0].contents);
   const data={startDate:'2026-01-01',endDate:'2026-12-31',statistics:{totalActions:0,actionsLast24h:0,mostActiveUser:null,mostModifiedEntity:null},actionsByDay:[],actionsByType:[],actionsByEntity:[],topUsers:[],recentLogs:[]};
   const script=`import {generateAuditPDF} from ${JSON.stringify(pathToFileURL(temp+'/generator.mjs').href)};const bytes=await generateAuditPDF(${JSON.stringify(data)});console.log(JSON.stringify({header:bytes.subarray(0,5).toString(),bytes:bytes.length}));`;
   const result=JSON.parse(execFileSync(process.execPath,['--input-type=module','-e',script],{encoding:'utf8'}));
   expect(result.header).toBe('%PDF-');expect(result.bytes).toBeGreaterThan(1000);
  }finally{await rm(temp,{recursive:true,force:true});}
 },15000);
});
