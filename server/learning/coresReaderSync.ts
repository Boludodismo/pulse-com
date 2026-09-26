/** Isolated, read-only subtitle integration. Audio, PDFs and all CRM records are unchanged. */
import { createHash } from 'node:crypto';
import { brotliDecompressSync } from 'node:zlib';
import { SYNC_PACKED } from './coresSyncData';
import { SYNC_JS, SYNC_CSS } from './coresSyncAssets';
export const SYNC_FILES = new Set(['sync.js','sync.css','sync-data.json']);
const MAP_SHA = '4e7cf46b0a97e6f39d626ed7d895c444430108c71ef2ff8f10eccf82d91f034a';
export function installCoresSync(files: Map<string, Buffer>): void {
  const map = brotliDecompressSync(Buffer.from(SYNC_PACKED,'base64'),{maxOutputLength:1000000});
  if(createHash('sha256').update(map).digest('hex')!==MAP_SHA)throw Error('Cores sync integrity mismatch');
  const data=JSON.parse(map.toString('utf8'));
  if(data.version!=='2.0.0'||data.packed.length!==1114||data.blocks.length!==343)throw Error('Cores sync map invalid');
  const next=new Map(files);
  const edit=(file:string,fn:(s:string)=>string)=>{const old=next.get(file);if(!old)throw Error('Reader base asset missing');next.set(file,Buffer.from(fn(old.toString('utf8'))));};
  next.set('sync.js',Buffer.from(SYNC_JS));next.set('sync.css',Buffer.from(SYNC_CSS));next.set('sync-data.json',map);
  edit('app.js',s=>{
    const nav='function goPage(n,options={}) {',render='renderToc();renderNotes();renderMarks();updateSyncStatus();',anchor='  // Expose a read-only diagnostic snapshot';
    if(!s.includes(nav)||!s.includes(render)||!s.includes(anchor))throw Error('Reader bridge anchors changed');
    return s.replace(nav,nav+'\n    if(options.manual!==false)document.dispatchEvent(new Event("cores:navigate"));')
      .replace(render,render+'document.dispatchEvent(new Event("cores:page"));')
      .replace(anchor,'  window.CoresReaderBridge={getPage:()=>state.page,getMode:()=>state.mode,goPage:n=>goPage(n,{manual:false}),seek,play,disableLegacy:()=>{state.follow=false;$("followCheck").checked=false;updateSyncStatus();save(true);}};\n'+anchor);
  });
  edit('index.html',s=>s.replace('</head>','<meta name="cores-reader-version" content="2.0.0"><link rel="stylesheet" href="sync.css?v=2.0.0"></head>')
    .replace('src="app.js"','src="app.js?v=2.0.0"').replace('href="app.css"','href="app.css?v=2.0.0"')
    .replace('</body>','<script src="sync.js?v=2.0.0"></script></body>')
    .replace('Leitor de estudo 1.1 · versão web','Leitor de estudo 2.0 · leitura acompanhada')
    .replace('áudio e páginas estão integrados, mas a correspondência exata entre a narração e o texto não foi validada. Por isso, as páginas são manuais e não há destaque automático de palavras. Nenhum tempo foi estimado ou inventado.','o texto acompanha os intervalos das legendas exportadas do ElevenLabs. Toque em reproduzir; use Acompanhar para retomar após navegar. O destaque é por trecho de legenda, não palavra por palavra. O PDF e o áudio foram preservados.'));
  edit('sw.js',s=>s.replace('cores-na-pele-web-v1-1','cores-na-pele-web-v2-0')
    .replace('const found=await cache.match(req.url);','const found=await cache.match(req.url,{ignoreSearch:true});'+
      'const relative=new URL(req.url).pathname.slice(new URL(self.registration.scope).pathname.length);'+
      "if(['','index.html','app.js','app.css','sync.js','sync.css','sync-data.json','manifest.webmanifest','cache-list.json'].includes(relative)){"+
      'try{const fresh=await fetch(req);if(fresh.ok&&found)await cache.put(req.url,fresh.clone());return fresh;}catch(error){if(found)return found;throw error;}}'));
  edit('cache-list.json',s=>JSON.stringify([...new Set([...JSON.parse(s),'sync.js','sync.css','sync-data.json'])]));
  for(const [name,bytes]of next)files.set(name,bytes);
  console.log('[CoresSync] Ready v2.0.0: 1114 SRT intervals; 343 book blocks; audio unchanged');
}
