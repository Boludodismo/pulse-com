// Runs the real cockpit with local RPC fixtures. No database or outbound messages.
// npm i --no-save playwright, or set PLAYWRIGHT_MODULE_ROOT to its node_modules.
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs/promises';
import http from 'node:http';
import assert from 'node:assert/strict';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const req = createRequire(root + '/package.json');
const { build } = req('esbuild');
const runtime = process.env.PLAYWRIGHT_MODULE_ROOT || process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES;
const { chromium, webkit } = runtime ? createRequire(runtime + '/package.json')('playwright') : req('playwright');
const mock = `import {useState} from 'react';
const image='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="600" height="800"><rect width="600" height="800" fill="#555"/><circle cx="300" cy="300" r="170" fill="#aaa"/></svg>');
const ink={id:11,name:'Tinta preta com nome completo de fabricante e descrição para leitura em telas pequenas',category:'Tinta',unit:'ml',currentQuantity:30,quantity:'1',brand:'Marca de teste',configuration:'',notes:''};
const needle={id:12,name:'Cartucho 09RL de teste',category:'Cartucho',unit:'unidade',currentQuantity:20,quantity:'1',notes:''};
const white={id:14,name:'Tinta branca',category:'Tinta',unit:'ml',currentQuantity:30,brand:'Marca de teste',notes:''};
const extra={id:13,name:'Material adicional de teste',category:'Proteção',unit:'unidade',currentQuantity:20};
const sample={id:21,code:'A01',hex:'#777777',red:119,green:119,blue:119,cyan:0,magenta:0,yellow:0,black:53,labL:50,labA:0,labB:0,xPct:50,yPct:50};
const preparation={materials:[{tenantMaterialId:12,name:needle.name,quantity:'1',unit:'unidade'}],colors:[]};
const data={
 'pod.session.get':{procedure:{id:1,artistId:2,notes:'Nota existente',referenceImageUrl:image},sessionMaterials:[{tenantMaterialId:11,name:ink.name,unit:'ml',quantity:'1'},{tenantMaterialId:12,name:needle.name,unit:'unidade',quantity:'1'}],consumptions:[]},
 'clients.getById':{name:'Cliente de teste'},
 'pod.inventory.list':[ink,needle,extra,white],
 'pod.inventory.materialColorSamples':[],
 'pod.session.listColorSamples':[sample],
 'pod.session.listInkRecipes':[{id:61,code:'M01',status:'active',cupSize:'M',dropsPerMl:'20.000',items:[{id:1,tenantMaterialId:11,nameSnapshot:ink.name,drops:2},{id:2,tenantMaterialId:14,nameSnapshot:white.name,drops:3}]},{id:62,code:'M02',status:'active',refillRecipeId:61,cupSize:'M',dropsPerMl:'20.000',items:[{id:3,tenantMaterialId:11,nameSnapshot:ink.name,drops:1}]}],
 'pod.session.listVisualLayers':[{layerKey:'reference',name:'Referência principal',layerType:'reference',imageUrl:image,opacity:100,isVisible:1,sortOrder:0}],
 'procedures.getById':{preparation},
 'pod.session.getAppearance':{revision:1,preferences:null,artistId:2,artistName:'Artista de teste'},
};
const empty=[];
const proxy=(parts=[])=>new Proxy(()=>Promise.resolve(),{get:(_t,key)=>{
 if(key==='useUtils')return()=>proxy();
 if(key==='then')return undefined;
 if(key==='useQuery')return()=>({data:data[parts.join('.')]??empty,isLoading:false,isFetching:false,refetch:async()=>({data:data[parts.join('.')]})});
 if(key==='useMutation')return()=>{const [isPending,setPending]=useState(false);return{isPending,mutateAsync:async input=>{setPending(true);const name=parts.join('.');window.__calls.push({name,input});try{if(window.__defer===name)await new Promise(resolve=>window.__resolve=resolve);return{id:99,code:'R01',revision:2};}finally{setPending(false);}}};};
 return proxy([...parts,String(key)]);
}});export const trpc=proxy();`;
const result = await build({
  stdin: {contents:`import React,{useState} from 'react';import {createRoot} from 'react-dom/client';import SessionCockpitV2 from './client/src/components/session/SessionCockpitV2';window.__calls=[];window.__timer=0;window.__finish=0;window.__close=0;function Fixture(){const [timing,setTiming]=useState({running:true,started:true,finished:false,timerBusy:false});window.__setTimer=setTiming;return <SessionCockpitV2 procedureId={1} studioId={1} clientId={1} artistId={2} title="Sessão de teste" elapsed="00:12:34" {...timing} onTimer={()=>{window.__timer++;setTiming(t=>({...t,started:true,running:!t.running}));}} onFinish={()=>window.__finish++} onClose={()=>window.__close++}/>;}createRoot(document.getElementById('root')).render(<Fixture/>);`,loader:'tsx',resolveDir:root},
  bundle:true,write:false,outdir:'/tmp/session-glass-fixture',format:'iife',jsx:'automatic',
  define:{'process.env.NODE_ENV':'"production"'},alias:{'@':root+'/client/src','@shared':root+'/shared'},
  plugins:[{name:'local-rpc',setup(b){b.onResolve({filter:/lib\/trpc$/},()=>({path:'trpc',namespace:'fixture'}));b.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:mock,loader:'tsx',resolveDir:root}));}}],
});
const js=result.outputFiles.find(f=>f.path.endsWith('.js')).text;
const assets=await fs.readdir(root+'/dist/public/assets');
const css=await fs.readFile(root+'/dist/public/assets/'+assets.find(f=>/^index-.*\.css$/.test(f)));
const server=http.createServer((request,response)=>{
  if(request.url==='/app.js'){response.setHeader('Content-Type','application/javascript');response.end(js);}
  else if(request.url==='/app.css'){response.setHeader('Content-Type','text/css');response.end(css);}
  else {response.setHeader('Content-Type','text/html');response.end('<!doctype html><html class="dark"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/app.css"><div id="root"></div><script src="/app.js"></script></html>');}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const url='http://127.0.0.1:'+server.address().port;
if(process.env.SERVE_ONLY){console.log(url);await new Promise(()=>{});}
const sizes=process.env.QA_VIEWPORT?[process.env.QA_VIEWPORT.split('x').map(Number)]:[[320,568],[390,844],[667,320],[768,1024],[1440,900]];
const engine=process.env.BROWSER_ENGINE==='webkit'?webkit:chromium;
let browser;
try {
  for(const [width,height] of sizes){
    browser=await engine.launch({headless:true,args:process.env.BROWSER_SINGLE_PROCESS?['--single-process','--no-zygote']:[],executablePath:process.env.BROWSER_EXECUTABLE||undefined});
    const page=await browser.newPage({viewport:{width,height}});
    const errors=[];page.on('pageerror',e=>{errors.push(e.message);console.error('PAGE ERROR',e.message)});
    await page.goto(url);await page.getByRole('button',{name:'Buscar materiais no estoque'}).waitFor();
    // Exercise the actual time badge through its existing start/pause/resume callback.
    await page.evaluate(()=>window.__setTimer({running:false,started:false,finished:false,timerBusy:false}));
    const timer=page.locator('.session-timer-control').first();
    await page.waitForFunction(label=>document.querySelector('.session-timer-control')?.getAttribute('aria-label')===label,'Iniciar sessão');await timer.click();
    await page.waitForFunction(label=>document.querySelector('.session-timer-control')?.getAttribute('aria-label')===label,'Pausar sessão');await timer.click();
    await page.waitForFunction(label=>document.querySelector('.session-timer-control')?.getAttribute('aria-label')===label,'Retomar sessão');await timer.click();
    assert.equal(await timer.locator('b').textContent(),'00:12:34');assert.equal(await page.evaluate(()=>window.__timer),3);
    await page.evaluate(()=>window.__setTimer({running:false,started:true,finished:false,timerBusy:true}));
    await page.waitForFunction(()=>document.querySelector('.session-timer-control')?.disabled);assert(await timer.isDisabled());
    await page.evaluate(()=>window.__setTimer({running:false,started:true,finished:true,timerBusy:false}));
    await page.waitForFunction(label=>document.querySelector('.session-timer-control')?.getAttribute('aria-label')===label,'Sessão concluída');assert(await timer.isDisabled());
    await page.evaluate(()=>{window.__timer=0;window.__setTimer({running:true,started:true,finished:false,timerBusy:false});});
    const region=title=>page.locator('.session-glass-window').filter({has:page.locator('.session-glass-title',{hasText:title})});
    const click=async(locator)=>{await locator.scrollIntoViewIfNeeded();await locator.click({timeout:5000});};
    const check=async(panel)=>{
      const metrics=await panel.evaluate(el=>{
        const r=el.getBoundingClientRect(),s=el.querySelector('.session-glass-scroll,.session-material-drawer-scroll');
        const horizontal=[el,s,...el.querySelectorAll('h2,p,small,b,strong,label,summary,button,.mix-summary,.sample-data,.mix-number-wrap,.mix-number-wrap span')].filter(n=>n.getClientRects().length&&n.scrollWidth>n.clientWidth+2).map(n=>n.className||n.tagName);
        return{x:r.x,y:r.y,right:r.right,bottom:r.bottom,sw:s.scrollWidth,cw:s.clientWidth,horizontal};
      });
      assert(metrics.x>=-1&&metrics.y>=-1&&metrics.right<=width+1&&metrics.bottom<=height+1,JSON.stringify({width,height,metrics}));
      assert.deepEqual(metrics.horizontal,[],JSON.stringify({width,height,metrics}));
    };
    await page.getByRole('button',{name:'Preferências visuais',exact:true}).first().click();
    const appearance=region('Preferências visuais');await check(appearance);
    const scroller=appearance.locator('.session-glass-scroll');
    assert.equal(await scroller.evaluate(e=>getComputedStyle(e).overflowY),'auto');
    if(await scroller.evaluate(e=>e.scrollHeight>e.clientHeight)){
      await scroller.evaluate(e=>e.scrollTop=e.scrollHeight);assert(await scroller.evaluate(e=>e.scrollTop)>0);
    }
    await click(appearance.getByRole('button',{name:'Minimizar janela'}));
    assert.equal(await appearance.isVisible(),false);
    await page.getByRole('button',{name:'Buscar materiais no estoque'}).click();
    const materials=region('Adicionar material ativo');await check(materials);
    await click(materials.getByRole('button',{name:'Minimizar janela'}));
    assert.equal(await page.locator('.session-glass-pill').count(),2);
    await page.getByRole('button',{name:'Restaurar Preferências visuais',exact:true}).click({timeout:5000});await check(appearance);
    await click(appearance.getByRole('button',{name:'Maximizar janela'}));await check(appearance);
    await click(appearance.getByRole('button',{name:'Restaurar tamanho'}));await check(appearance);
    // Keyboard movement exercises both initial centered origin and every edge.
    const grip=appearance.getByRole('button',{name:'Mover Preferências visuais'});
    for(const key of ['ArrowRight','ArrowDown','ArrowLeft','ArrowUp']){
      await grip.evaluate((el,key)=>{for(let i=0;i<100;i++)el.dispatchEvent(new KeyboardEvent('keydown',{key,bubbles:true}));},key);
      await check(appearance);
    }
    await click(appearance.getByRole('button',{name:'Fechar janela'}));
    await page.getByRole('button',{name:'Buscar materiais no estoque'}).click();await check(materials);
    await click(materials.getByRole('button',{name:'Ver materiais e receitas preparados'}));
    const preparation=region('Preparação da sessão');await check(preparation);
    await click(preparation.getByRole('button',{name:'Minimizar janela'}));
    await click(materials.getByRole('button',{name:'Fechar janela'}));
    // Actual existing material quantity controls and transaction payload.
    const openMaterials=page.getByRole('button',{name:'Abrir materiais',exact:true});
    if(await openMaterials.isVisible())await openMaterials.click();
    await page.getByRole('button',{name:'Registrar consumo de Tinta preta',exact:false}).click();
    const ink=page.locator('.session-material-drawer');await check(ink);
    assert.equal(await page.locator('.session-glass-window:visible').count(),0);
    const quantity=ink.getByRole('spinbutton',{name:'Quantidade de Tinta preta',exact:false});
    await quantity.fill('7');
    assert.equal(await page.evaluate(()=>window.__calls.filter(c=>c.name==='pod.session.consumeAuto').length),0);
    await click(ink.getByRole('button',{name:'Confirmar uso'}));
    const consumption=await page.evaluate(()=>window.__calls.find(c=>c.name==='pod.session.consumeAuto').input);
    assert.equal(consumption.tenantMaterialId,11);assert.equal(consumption.quantity,'0.350');assert.equal(consumption.expectedUnit,'ml');
    await check(ink);assert.equal(await quantity.inputValue(),'1');
    await click(ink.getByRole('button',{name:'Criar mistura'}));
    const recipe=page.locator('.session-material-drawer');await check(recipe);
    const drops=recipe.getByRole('spinbutton',{name:/Gotas de Tinta preta/});await drops.fill('5');
    assert.equal(await page.evaluate(()=>window.__calls.filter(c=>c.name==='pod.session.saveInkRecipe').length),0);
    await click(recipe.getByRole('button',{name:'Salvar mistura + baixar estoque'}));
    const payload=await page.evaluate(()=>window.__calls.find(c=>c.name==='pod.session.saveInkRecipe').input);
    assert.equal(payload.procedureId,1);assert.deepEqual(payload.ingredients,[{tenantMaterialId:11,drops:5}]);
    await page.getByRole('button',{name:'Repor mistura M01',exact:true}).click();await check(recipe);
    await recipe.getByRole('spinbutton',{name:/Gotas de Tinta preta/}).fill('4');
    await recipe.getByRole('spinbutton',{name:'Gotas de Tinta branca',exact:true}).fill('2');
    if(process.env.QA_SCREENSHOT_PATH)await page.screenshot({path:process.env.QA_SCREENSHOT_PATH});
    await click(recipe.getByRole('button',{name:'Confirmar reposição'}));
    const refill=await page.evaluate(()=>window.__calls.filter(c=>c.name==='pod.session.saveInkRecipe').at(-1).input);
    assert.equal(refill.refillRecipeId,61);assert.equal(refill.cupTenantMaterialId,undefined);
    assert.deepEqual(refill.ingredients,[{tenantMaterialId:11,drops:4},{tenantMaterialId:14,drops:2}]);
    await click(recipe.getByRole('button',{name:'Recolher aba de materiais'}));
    // No automatic completion: the existing callback requires explicit action.
    await page.getByRole('button',{name:'Revisar conclusão da sessão'}).click();
    const finish=region('Revisão antes de concluir');await check(finish);
    assert.equal(await page.evaluate(()=>window.__finish),0);
    await click(finish.getByRole('button',{name:'Ir para conclusão da sessão'}));
    assert.equal(await page.evaluate(()=>window.__finish),1);
    await page.locator('.session-timer-control').first().click();assert.equal(await page.evaluate(()=>window.__timer),1);
    // Other submenus use the same real shell and keep their original handlers.
    await page.keyboard.press('Escape');
    const openLayers=page.getByRole('button',{name:'Abrir camadas',exact:true});
    if(await openLayers.isVisible())await openLayers.click();
    await page.getByRole('button',{name:'Adicionar camada',exact:true}).click();
    const layer=region('Nova camada visual');await check(layer);
    await click(layer.getByRole('button',{name:'Fechar janela'}));
    const mode=page.locator('.cockpit-palette .palette-add').first();
    if(await mode.textContent()==='Cores')await mode.click();
    await page.locator('.cockpit-palette .palette-chip').filter({hasText:'A01'}).click();
    const samplePanel=region('A01');await check(samplePanel);
    await click(samplePanel.getByRole('button',{name:'Fechar janela'}));
    if(width>620){
      await page.getByRole('button',{name:'Notas rápidas',exact:true}).click();
      const notes=region('Notas rápidas');await check(notes);
      await notes.locator('textarea').fill('Rascunho preservado');
      await click(notes.getByRole('button',{name:'Minimizar janela'}));
      await page.getByRole('button',{name:'Notas rápidas',exact:true}).click();
      assert.equal(await notes.locator('textarea').inputValue(),'Rascunho preservado');
      await page.evaluate(()=>window.__defer='procedures.update');
      await click(notes.getByRole('button',{name:'Salvar na sessão'}));
      await page.getByRole('button',{name:'Preferências visuais',exact:true}).first().click();
      await page.evaluate(()=>window.__resolve());
      await notes.waitFor({state:'detached'});await check(region('Preferências visuais'));
      await click(region('Preferências visuais').getByRole('button',{name:'Fechar janela'}));
    }
    // Resize/orientation change after dragging must refit the same mounted tool.
    await page.getByRole('button',{name:'Preferências visuais',exact:true}).first().click();
    await page.setViewportSize({width:320,height:568});
    await page.waitForTimeout(150);
    const resized=await region('Preferências visuais').boundingBox();
    assert(resized.x>=0&&resized.y>=0&&resized.x+resized.width<=321&&resized.y+resized.height<=569);
    await page.mouse.click(318,300); // Existing outside dismissal returns to the canvas.
    assert.equal(await page.locator('.session-glass-window').count(),0);
    assert.deepEqual(errors,[]);
    console.log('PASS',width+'x'+height,': bounds, text, scroll, multiple windows, draft retention, recipe/consumption payloads, timer, finish, layers, samples, notes and resize');
    await browser.close();
  }
} finally {await browser?.close();server.close();}
