// Real React creation surfaces in a DOM fixture; no database, network or messages.
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const require=createRequire(root+'/package.json');
const {build}=require('esbuild');
const {JSDOM}=process.env.DOM_MODULE_ROOT?createRequire(process.env.DOM_MODULE_ROOT+'/package.json')('jsdom'):require('jsdom');
const mock=`import {useState} from 'react';
export const user={id:8,studioId:2,artistId:3,role:'collaborator',name:'Teste'};
const empty=[];const data={'auth.me':user,'artists.list':[{id:3,name:'Teste'}]};
const proxy=(parts=[])=>new Proxy(()=>Promise.resolve(),{get:(_t,key)=>{
 if(key==='useUtils')return()=>proxy();if(key==='then')return undefined;
 if(key==='useQuery')return()=>({data:data[parts.join('.')]??(/getById$|session.get$/.test(parts.join('.'))?null:empty),isLoading:false,isFetching:false,refetch:async()=>({data:empty})});
 if(key==='useMutation')return(options={})=>{const [isPending,setPending]=useState(false);const mutateAsync=async input=>{setPending(true);window.__calls.push({name:parts.join('.'),input});const result=parts.join('.')==='contacts.previewImport'?{validCount:1,totalRows:1,invalidCount:0,detectedColumns:[],preview:[]}:parts.join('.')==='contactImport.prepare'?{batchId:1,total:1,newClients:1,matched:0,eligible:0,withReview:0,integrationReady:true,plan:[]}:parts.join('.')==='contactImport.importBatch'?{results:[],nextOffset:1,done:true}:parts.join('.')==='contacts.importContacts'?{imported:1,errors:0,skipped:0,errorDetails:[],notificationWarnings:0}:{id:99,name:input.name,warnings:[]};try{await options.onSuccess?.(result);return result;}finally{setPending(false)}};return{isPending,mutateAsync,mutate:input=>void mutateAsync(input)}};
 return proxy([...parts,String(key)]);
}});export const trpc=proxy();`;
const result=await build({stdin:{contents:`import React from 'react';import {createRoot} from 'react-dom/client';import NewClient from './client/src/pages/NewClient';import NewProcedure from './client/src/pages/NewProcedure';import Quotes from './client/src/pages/Quotes';import ContactsImportExport from './client/src/pages/ContactsImportExport';import {EventModal} from './client/src/components/EventModal';window.__calls=[];const kind=new URLSearchParams(location.search).get('kind');createRoot(document.getElementById('root')).render(kind==='event'?<EventModal isOpen onClose={()=>{}}/>:kind==='procedure'?<NewProcedure/>:kind==='quotes'?<Quotes/>:(kind==='import'||kind==='complete')?<ContactsImportExport/>:<NewClient/>);`,loader:'tsx',resolveDir:root},bundle:true,write:false,loader:{'.png':'dataurl'},outdir:'/tmp/client-registration-fixture',format:'iife',jsx:'automatic',define:{'process.env.NODE_ENV':'"production"'},alias:{'@':root+'/client/src','@shared':root+'/shared'},plugins:[{name:'fixtures',setup(b){
 b.onResolve({filter:/lib\/trpc$/},()=>({path:'rpc',namespace:'mock'}));
 b.onResolve({filter:/hooks\/useAuth$/},()=>({path:'auth',namespace:'mock'}));
 b.onResolve({filter:/DashboardLayout$/},()=>({path:'layout',namespace:'mock'}));
 b.onResolve({filter:/useSyncToast$/},()=>({path:'sync',namespace:'mock'}));
 b.onResolve({filter:/lib\/sessionDraft$/},()=>({path:'draft',namespace:'mock'}));
 b.onLoad({filter:/.*/,namespace:'mock'},a=>({contents:a.path==='rpc'?mock:a.path==='auth'?`import {user} from 'rpc';export const useAuth=()=>({user,loading:false,isAuthenticated:true});`:a.path==='layout'?`export default function Layout({children}){return children;}`:a.path==='sync'?`export const useSyncToast=()=>({notifySync:()=>{}});`:`export const draftOperation=async()=>null;export const sessionDraftKey=()=> 'fixture';`,loader:'tsx',resolveDir:root}));
 b.onResolve({filter:/^rpc$/},()=>({path:'rpc',namespace:'mock'}));
}}]});
const js=result.outputFiles.find(f=>f.path.endsWith('.js')).text;

const wait=async(fn)=>{for(let i=0;i<100;i++){if(fn())return;await new Promise(r=>setTimeout(r,20));}throw new Error('DOM condition timed out');};
for(const kind of ['client','event','procedure','quotes','import','complete']){
 for(const enabled of [true,false]){
  const dom=new JSDOM('<html><div id="root"></div></html>',{url:'https://fixture.test/?kind='+kind,runScripts:'outside-only',pretendToBeVisual:true});
  const w=dom.window;const errors=[];w.addEventListener('error',e=>errors.push(e.message));
  w.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){},addListener(){},removeListener(){}});
  w.ResizeObserver=class{observe(){}unobserve(){}disconnect(){}};w.HTMLElement.prototype.scrollIntoView=function(){};w.scrollTo=()=>{};
  w.eval(js);const d=w.document;
  const button=text=>Array.from(d.querySelectorAll('button')).find(e=>e.textContent.trim()===text);
  const click=async text=>{await wait(()=>button(text));button(text).click();await new Promise(r=>setTimeout(r,25));};
  const fill=(selector,value)=>{const el=d.querySelector(selector);assert(el,kind+' missing '+selector);Object.getOwnPropertyDescriptor(w.HTMLInputElement.prototype,'value').set.call(el,value);el.dispatchEvent(new w.Event('input',{bubbles:true}));el.dispatchEvent(new w.Event('change',{bubbles:true}));};
  if(kind==='event')await click('Novo Cliente');
  if(kind==='procedure')await click('Adicionar novo cliente');
  if(kind==='quotes'){await click('Novo orçamento');await click('Novo cliente');}
  if(kind==='import'||kind==='complete'){
   if(kind==='import'){await wait(()=>button('Importar'));button('Importar').dispatchEvent(new w.MouseEvent('mousedown',{bubbles:true,button:0}));await new Promise(r=>setTimeout(r,25));}
   await wait(()=>kind==='complete'?d.querySelector('#complete-contact-file'):d.querySelector('input[accept=".csv,.xlsx"]'));
   const input=kind==='complete'?d.querySelector('#complete-contact-file'):d.querySelector('input[accept=".csv,.xlsx"]');
   assert(input,kind+' file input');const file=new w.File(['nome,telefone\nCliente Fixture,(31) 99999-8888'],kind==='complete'?'fixture.json':'fixture.csv');file.text=async()=> '{}';
   Object.defineProperty(input,'files',{value:[file]});input.dispatchEvent(new w.Event('change',{bubbles:true}));
   await wait(()=>w.__calls.some(c=>c.name===(kind==='import'?'contacts.previewImport':'contactImport.prepare')));await new Promise(r=>setTimeout(r,25));
  }
  const getCheckbox=()=>{const labels=Array.from(d.querySelectorAll('label')).filter(e=>e.textContent==='Habilitar notificações do cliente pelo WhatsApp');const label=kind==='import'?labels.at(-1):labels[0];return label&&d.getElementById(label.htmlFor);};
  await wait(getCheckbox);assert.equal(getCheckbox().getAttribute('aria-checked'),'true',kind+' default');
  if(!enabled){getCheckbox().click();await new Promise(r=>setTimeout(r,25));}
  if(kind==='import'||kind==='complete'){
   await click(kind==='import'?'Importar 1 contato(s)':'Importar cadastros e autorizações');
   const rpc=kind==='import'?'contacts.importContacts':'contactImport.importBatch';await wait(()=>w.__calls.some(c=>c.name===rpc));
   assert.equal(w.__calls.find(c=>c.name===rpc).input.recordWhatsAppConsent,enabled);assert.deepEqual(errors,[]);console.log('PASS',kind,'choice',enabled);dom.window.close();continue;
  }
  const selectors=kind==='client'?['#name','#phone']:kind==='event'?['input[placeholder="Nome completo *"]','input[placeholder="Telefone / WhatsApp"]']:kind==='procedure'?['#session-new-client-name','#session-new-client-phone']:['#quick-client-name','#quick-client-phone'];
  fill(selectors[0],'Cliente Fixture');fill(selectors[1],'(31) 99999-8888');await new Promise(r=>setTimeout(r,25));
  await click(kind==='client'?'Criar Cliente':kind==='event'?'Salvar e Selecionar':kind==='procedure'?'Cadastrar e selecionar':'Salvar e selecionar');
  await wait(()=>w.__calls.some(c=>c.name==='clients.create'));
  const call=w.__calls.find(c=>c.name==='clients.create');assert.equal(call.input.recordWhatsAppConsent,enabled,kind+' payload');assert.deepEqual(errors,[]);
  console.log('PASS',kind,'choice',enabled);dom.window.close();
 }
}
