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
const { createElement, act } = await import('react');
const { createRoot } = await import('react-dom/client');
const ui = `import React from 'react';
export const Button=({children,variant,size,...p})=>React.createElement('button',p,children);
export const Input=p=>React.createElement('input',p);
export const Label=({children,...p})=>React.createElement('label',p,children);
export const Dialog=({children,open})=>open?React.createElement('div',{},children):null;
export const DialogContent=({children,...p})=>React.createElement('div',p,children);
export const DialogHeader=DialogContent; export const DialogTitle=DialogContent;`;
const mockTrpc = `const chain=(p=[])=>new Proxy(()=>{}, {get:(_,k)=> k==='useQuery'?(()=>({data:globalThis.fixtures[p.join('.')],isLoading:false,refetch:async()=>{}})):k==='useMutation'?((options)=>({isPending:false,mutate:input=>{globalThis.sent.push({path:p.join('.'),input});}})):k==='useUtils'?(()=>chain()):k==='invalidate'?(async()=>{}):chain([...p,k])}); export const trpc=chain();`;
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
