import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { rm } from 'node:fs/promises';
import { build } from 'esbuild';
import { JSDOM } from 'jsdom';
import assert from 'node:assert/strict';
const here = path.dirname(fileURLToPath(import.meta.url));
const dom = new JSDOM('<div id="root"></div>', { url: 'https://example.test/stock' });
globalThis.window = dom.window; globalThis.document = dom.window.document;
globalThis.HTMLElement = dom.window.HTMLElement; globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const { createElement, act, useState } = await import('react');
const { createRoot } = await import('react-dom/client');
const ui = `import React from 'react';
export const Button=({children,variant,size,...p})=>React.createElement('button',p,children);
export const Input=p=>React.createElement('input',p);
export const Label=({children,...p})=>React.createElement('label',p,children);
export const Dialog=({children,open})=>open?React.createElement('div',{},children):null;
export const DialogContent=({children,...p})=>React.createElement('div',p,children);
export const DialogHeader=DialogContent; export const DialogTitle=DialogContent;`;
const mockTrpc = `const chain=(p=[])=>new Proxy(()=>{}, {get:(_,k)=> k==='useQuery'?(()=>({data:globalThis.fixtures[p.join('.')],isLoading:false,refetch:async()=>{}})):k==='useMutation'?((options)=>({isPending:false,mutate:input=>{globalThis.sent.push({path:p.join('.'),input});},mutateAsync:async input=>{globalThis.sent.push({path:p.join('.'),input});options?.onSuccess?.({success:true});return {success:true};}})):k==='useUtils'?(()=>chain()):k==='invalidate'?(async()=>{}):chain([...p,k])}); export const trpc=chain();`;
async function compile(name) {
  const out = path.join(here, `.inventory-${name}.mjs`);
  await build({ entryPoints: [path.resolve(here, `../../client/src/components/${name}.tsx`)], outfile: out, bundle: true, format: 'esm', platform: 'node', jsx: 'automatic', external: ['react'], plugins: [{ name: 'mocks', setup(b) {
    b.onResolve({ filter: /^(\.\/ui\/|@\/lib\/trpc|@\/_core\/hooks\/useAuth|sonner|lucide-react)/ }, a => ({ path: a.path, namespace: 'mock' }));
    b.onLoad({ filter: /.*/, namespace: 'mock' }, a => ({ contents: a.path === '@/lib/trpc' ? mockTrpc : a.path.includes('useAuth') ? `export const useAuth=()=>({user:{role:'admin',id:101,studioId:101}});` : a.path === 'sonner' ? `export const toast={success:()=>{},error:()=>{}};` : a.path === 'lucide-react' ? `export const Bell=()=>null;` : ui, loader: 'js' }));
  } }] });
  const module = await import(out); await rm(out); return module;
}
let root;
async function mount(Component, props={}) { globalThis.sent=[]; root=createRoot(document.getElementById('root')); await act(async()=>root.render(createElement(Component,props))); }
async function unmount() { await act(async()=>root.unmount()); }
const button = text => [...document.querySelectorAll('button')].find(b=>b.textContent.includes(text));
async function change(id,value) { const el=document.getElementById(id); const proto=el.tagName==='SELECT'?window.HTMLSelectElement.prototype:window.HTMLInputElement.prototype; await act(async()=>{Object.getOwnPropertyDescriptor(proto,'value').set.call(el,value);el.dispatchEvent(new window.Event(el.tagName==='SELECT'?'change':'input',{bubbles:true}));}); }
globalThis.fixtures={};
const { MaterialForecast, PlannedQuantityEditor }=await compile('MaterialForecast');
await mount(MaterialForecast,{rows:['available','attention','shortage'].map((level,i)=>({material:{id:i+1,name:'Material '+i,unit:'un',ownerArtistId:i===0?null:3102},projectedQuantity:2-i*2,replenishmentQuantity:i,expiredQuantity:i===2?1:0,level,authorized:true}))});
for(const text of ['Suficiente','Atenção ao mínimo','Falta prevista','validade anterior à sessão','Estúdio','Estoque do artista'])assert(document.body.textContent.includes(text));
await unmount();
await mount(PlannedQuantityEditor,{id:17,value:'3.000',unit:'un',onSaved:()=>{}});
await act(async()=>button('Quantidade').click());
const input=document.querySelector('input'); await act(async()=>{Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set.call(input,'2.5');input.dispatchEvent(new window.Event('input',{bubbles:true}));});
await act(async()=>button('Salvar').click());assert.deepEqual(sent[0],{path:'pod.planning.updateQuantity',input:{plannedMaterialId:17,expectedQuantity:'3.000',quantity:'2.5'}});await unmount();
const {default:Loans}=await compile('InventoryLoans');
fixtures={'artists.list':[{id:3101,name:'Artista A'},{id:3102,name:'Artista B'}],'pod.inventory.loans.list':[{id:42,status:'requested',materialName:'Cartucho',unit:'un',quantityRequested:'3.000',quantityApproved:null,quantitySettled:'0.000',lenderName:'Artista A',borrowerName:'Artista B',lenderArtistId:3101,borrowerArtistId:3102,sourceMaterialId:10,reminderHours:24,canLend:true,canBorrow:true}],'pod.inventory.loans.detail':{events:[],batches:[],candidates:[]}};
await mount(Loans);await act(async()=>button('Abrir empréstimo #42').click());await act(async()=>button('Aprovar e definir prazo').click());await change('loan-due','2099-10-15T12:30');await change('loan-action-quantity','2');await act(async()=>document.querySelector('form').dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true})));assert.equal(sent[0].path,'pod.inventory.loans.approve');assert.equal(sent[0].input.quantity,'2');assert.equal(sent[0].input.dueAt,'2099-10-15 12:30:00');assert.equal(sent[0].input.reminderHours,24);await unmount();
const {default:Notices}=await compile('InventoryNotices');fixtures={'pod.inventory.notices.preferences':{leadHours:48,scope:'artist',whatsappEnabled:false},'pod.inventory.notices.list':[{id:9,title:'Falta prevista',message:'Material da sessão',recipientArtistId:3102,createdAt:'2026-09-14 12:00:00',deliveryStatus:'internal',severity:'danger'}]};
await mount(Notices);assert(document.body.textContent.includes('WhatsApp desativado'));await act(async()=>document.querySelector('input[type="checkbox"]').click());await act(async()=>document.querySelector('form').dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true})));assert.deepEqual(sent[0],{path:'pod.inventory.notices.savePreferences',input:{leadHours:48,whatsappEnabled:true}});await act(async()=>button('Marcar como lido').click());assert.deepEqual(sent[1],{path:'pod.inventory.notices.read',input:{id:9}});await unmount();
console.log('PASS: forecast levels and origin, quantity editing with concurrency check, approval deadline form, explicit WhatsApp opt-in and read acknowledgements');

const {default:AppointmentMaterials}=await compile('AppointmentMaterials');
const baseProps={artistId:3101,artistName:'Artista A',clientName:'João Cliente',date:'2099-10-15 12:30:00',enabled:true,canReadStock:true};
let latestDraft;
function DraftKit(props) {
  const [draft,setDraft]=useState({name:'',items:[],operationKey:crypto.randomUUID()});
  latestDraft=draft;
  return createElement(AppointmentMaterials,{...baseProps,...props,draft,onDraftChange:setDraft});
}
fixtures={'pod.inventory.list':[],'pod.planning.kits.list':[]};
await mount(DraftKit);
assert(!button('Criar kit do cliente').disabled,'empty stock allows a client-specific kit');
assert(!document.querySelector('fieldset').disabled);
await act(async()=>button('Criar kit do cliente').click());
assert.equal(latestDraft.name,'Kit de João');
assert.equal(sent.length,0,'new appointment kit stays in the draft until appointment creation');
await change('appointment-client-kit-name','Reforma oriental');
await act(async()=>button('Material não listado').click());
await change('appointment-missing-name','Cartucho especial 3RL');
await change('appointment-material-quantity','2,5');
const addButton=()=>[...document.querySelectorAll('button')].find(b=>b.textContent==='Adicionar ao kit');
await act(async()=>addButton().click());
assert.deepEqual(latestDraft.items,[{name:'Cartucho especial 3RL',unit:'unidade',quantity:'2.5'}]);
assert(document.body.textContent.includes('Pendente de cadastro'));
assert(document.body.textContent.includes('O lembrete será criado ao salvar o agendamento'));
assert(button('Salvar também como modelo reutilizável').disabled,'pending items cannot become a stock template');
await unmount();

fixtures={'pod.inventory.list':[], 'pod.planning.kits.list':[],'pod.planning.listByAppointment':[]};
await mount(DraftKit,{appointmentId:51});
await change('appointment-client-kit-name','Kit exclusivo João');
await act(async()=>button('Criar kit do cliente').click());
assert.equal(sent[0].path,'pod.planning.clientKit.save');
assert.equal(sent[0].input.name,'Kit exclusivo João');
assert.deepEqual(sent[0].input.items,[]);
await act(async()=>button('Material não listado').click());
await change('appointment-missing-name','Filme protetor');
await act(async()=>addButton().click());
assert.equal(sent[1].input.appointmentId,51);
assert.deepEqual(sent[1].input.items,[{name:'Filme protetor',unit:'unidade',quantity:'1'}]);
assert.notEqual(sent[0].input.operationKey,sent[1].input.operationKey,'successful distinct actions use distinct operation keys');
await unmount();

fixtures={'pod.inventory.list':[{id:71,name:'Cartucho disponível',unit:'unidade',ownerArtistId:3101,currentQuantity:'10'},{id:72,name:'Pigmento',unit:'ml',ownerArtistId:3101,currentQuantity:'5'}],'pod.planning.kits.list':[{id:5,name:'Modelo salvo',items:[{tenantMaterialId:71,materialName:'Cartucho disponível',unit:'unidade',quantity:'2.000'}]}],'pod.planning.listByAppointment':[{id:81,tenantMaterialId:null,nameSnapshot:'Cartucho pendente',unitSnapshot:'un',quantityPlanned:'3.000',status:'planejado'}],'pod.planning.clientKit.get':{name:'Kit João'}};
await mount(DraftKit,{appointmentId:51});
assert.equal(document.getElementById('appointment-client-kit-name').value,'Kit João');
assert(document.querySelector('a[href="/stock"]'));
assert.equal(document.getElementById('link-material-81').options.length,2,'only equivalent units are offered for linking');
await change('link-material-81','71');
await act(async()=>button('Vincular ao estoque').click());
assert.deepEqual(sent[0],{path:'pod.planning.clientKit.linkMaterial',input:{appointmentId:51,plannedMaterialId:81,tenantMaterialId:71}});
await change('appointment-kit-template','5');
await act(async()=>button('Adicionar ao kit do cliente').click());
assert.deepEqual(sent[1].input.items,[{tenantMaterialId:71,name:'Cartucho disponível',unit:'unidade',quantity:'2.000'}]);
assert.equal(fixtures['pod.planning.kits.list'][0].items[0].quantity,'2.000');
await unmount();
console.log('PASS: client-specific kit with empty stock, freeform material draft and saved appointment, registration reminder state, operation keys, stock linkage with unit matching, independent template copy');
