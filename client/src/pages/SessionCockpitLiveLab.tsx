import {useEffect,useMemo,useRef,useState,type CSSProperties,type PointerEvent as RP,type WheelEvent as RW} from "react";
import {ArrowLeft,Home,Undo2,Redo2,Minus,Eye,EyeOff,Plus,Pause,Play,Package,Camera,Square,StickyNote,RotateCcw,RotateCw,Palette,Pipette,X,Search,Droplets,Check,Layers3,ChevronLeft,ChevronRight,Maximize2,Minimize2} from "lucide-react";
import {toast} from "sonner";
import {trpc} from "@/lib/trpc";
import LocalLogin from "./LocalLogin";
import TemporaryColorSampler, { type ColorValue } from "../components/session/TemporaryColorSampler";
import "../components/session/cockpit-v2-lab.css";

type Kind="cartridge"|"ink"|"diluent"|"ointment"|"protection"|"cup";
type Material={id:string;name:string;short:string;kind:Kind;unit:string;color?:string;detail:string;brand?:string|null;configuration?:string|null};
type Cup="P"|"M"|"G"|"GG";
type Ingredient={materialId:string;drops:number};
type View={x:number;y:number;scale:number;rotation:number};
type Sample={id:string;code:string;hex:string;rgb:[number,number,number];cmyk:[number,number,number,number];lab:[number,number,number];xPct:number;yPct:number};
type ReferenceDraft=ColorValue&{xPct:number;yPct:number};
type PhotoTarget={kind:"material";materialId:number;name:string}|{kind:"recipe";recipeId:number;code:string};
type Sheet="materials"|"ink"|"recipe"|"sample"|"notes"|"finish"|"layerAdd"|null;
type QuickAction={kind:"consumption";consumptionId:number;materialId:number;quantity:string;label:string;unit:string};
type RecipeAction={kind:"recipe";recipeId:number;label:string;payload:{procedureId:number;sampleId?:number;cupSize:Cup;dropsPerMl:number;cupTenantMaterialId?:number;ingredients:{tenantMaterialId:number;drops:number}[]}};
type StockAction=QuickAction|RecipeAction;

const CUP:Record<Cup,number>={P:.5,M:1,G:2,GG:4};
const DROP=.05;
const V0:View={x:0,y:0,scale:1,rotation:0};
const GRAYS=["#050505","#191919","#333333","#525252","#737373","#969696","#b8b8b8","#dddddd","#ffffff"];
const COLOR_FAMILIES=[
  {key:"C",label:"Ciano",hex:"#00AEEF"},
  {key:"M",label:"Magenta",hex:"#EC008C"},
  {key:"Y",label:"Amarelo",hex:"#FFF200"},
  {key:"K",label:"Preto",hex:"#111111"},
  {key:"W",label:"Branco",hex:"#FFFFFF"},
] as const;

function timer(s:number){const h=Math.floor(s/3600),m=Math.floor(s%3600/60),x=s%60;return [h,m,x].map(v=>String(v).padStart(2,"0")).join(":")}
function hex(r:number,g:number,b:number){return "#"+[r,g,b].map(v=>Math.round(v).toString(16).padStart(2,"0")).join("")}
function cmyk(r:number,g:number,b:number):[number,number,number,number]{const R=r/255,G=g/255,B=b/255,k=1-Math.max(R,G,B);if(k>.999)return[0,0,0,100];return[Math.round((1-R-k)/(1-k)*100),Math.round((1-G-k)/(1-k)*100),Math.round((1-B-k)/(1-k)*100),Math.round(k*100)]}
function lab(r:number,g:number,b:number):[number,number,number]{const lin=(v:number)=>{v/=255;return v<=.04045?v/12.92:Math.pow((v+.055)/1.055,2.4)};const R=lin(r),G=lin(g),B=lin(b);let x=(R*.4124564+G*.3575761+B*.1804375)/.95047,y=(R*.2126729+G*.7151522+B*.072175),z=(R*.0193339+G*.1191920+B*.9503041)/1.08883;const f=(v:number)=>v>.008856?Math.cbrt(v):(7.787*v)+(16/116);x=f(x);y=f(y);z=f(z);return[Math.max(0,Math.min(100,116*y-16)),500*(x-y),200*(y-z)]}
function parseHexColor(value?:string){if(!value||!/^#[0-9a-f]{6}$/i.test(value))return null;return[parseInt(value.slice(1,3),16),parseInt(value.slice(3,5),16),parseInt(value.slice(5,7),16)] as [number,number,number]}
function familyForColor(hexValue?:string,stored?:any){let values:[number,number,number,number]|null=null;if(stored)values=[Number(stored.cyan),Number(stored.magenta),Number(stored.yellow),Number(stored.black)];else{const rgb=parseHexColor(hexValue);if(rgb)values=cmyk(...rgb)}if(!values)return null;const [C,M,Y,K]=values;if(K>=65)return"K";const rgb=parseHexColor(stored?.hex||hexValue);if(rgb&&rgb.every(v=>v>=225))return"W";const max=Math.max(C,M,Y);if(max===C)return"C";if(max===M)return"M";return"Y"}
function inferKind(name:string,category?:string|null):Kind{const t=((category||"")+" "+name).toLowerCase();if(/batoque|ink\s*cap|inkcap/.test(t))return"cup";if(/diluent|diluente|mixing|solucao de mistura/.test(t))return"diluent";if(/tinta|pigment|dynamic|electric ink|\bink\b/.test(t))return"ink";if(/cartucho|agulha|needle|round liner|round shader|magnum|\brl\b|\brs\b/.test(t))return"cartridge";if(/vaselina|butter|pomada|karit|slip/.test(t))return"ointment";return"protection"}
function guessColor(name:string){const t=name.toLowerCase();if(/white|branco/.test(t))return"#f4f4f5";if(/black|preto/.test(t))return"#111111";if(/navy|marinho/.test(t))return"#14213d";if(/orange|laranja/.test(t))return"#f97316";if(/olive|oliva/.test(t))return"#65743a";if(/red|vermelh/.test(t))return"#b91c1c";if(/blue|azul/.test(t))return"#2563eb";if(/green|verde/.test(t))return"#16a34a";if(/yellow|amarel/.test(t))return"#eab308";return undefined}
function shortName(name:string,configuration?:string|null){if(configuration?.trim())return configuration.trim().slice(0,7).toUpperCase();const m=name.toUpperCase().match(/\b\d{1,2}(?:RL|RS|M1|CM|RM)\b/);if(m)return m[0];return name.replace(/[^A-Za-z0-9]/g,"").slice(0,4).toUpperCase()||"ITEM"}
function toMaterial(raw:any):Material{return{id:String(raw.id),name:String(raw.name||"Material"),short:shortName(String(raw.name||""),raw.configuration),kind:inferKind(String(raw.name||""),raw.category),unit:String(raw.unit||"unidade"),color:guessColor(String(raw.name||"")),detail:[raw.brand,raw.configuration,raw.lot?"Lote "+raw.lot:null].filter(Boolean).join(" · ")||"Estoque ativo",brand:raw.brand,configuration:raw.configuration}}
function quantityForDrops(material:Material,drops:number){const u=material.unit.toLowerCase();if(u==="ml"||u.includes("mililit"))return(drops/20).toFixed(3);if(u.includes("gota")||u==="drop"||u==="gt")return drops.toFixed(3);throw new Error("Configure esta tinta em ml ou gotas no estoque.")}
function canvasSafeSource(value:string|null|undefined){
  if(!value)return null;
  try{
    const url=new URL(value,window.location.origin);
    if(url.pathname==="/api/storage"){
      const key=url.searchParams.get("key"),token=url.searchParams.get("token");
      if(key&&token)return "/api/storage-inline?key="+encodeURIComponent(key)+"&token="+encodeURIComponent(token);
    }
    if(url.origin===window.location.origin)return url.pathname+url.search+url.hash;
  }catch{}
  return value;
}



export default function SessionCockpitLiveLab(){
const auth=trpc.auth.me.useQuery();
const [procedureId,setProcedureId]=useState(()=>Number(new URLSearchParams(location.search).get("procedureId")||0));
const clients=trpc.clients.list.useQuery(undefined,{enabled:!!auth.data&&!procedureId});
const artists=trpc.artists.list.useQuery(undefined,{enabled:!!auth.data&&!procedureId});
const [clientId,setClientId]=useState(0),[artistId,setArtistId]=useState(0),[title,setTitle]=useState("Sessão Cockpit V2");
useEffect(()=>{if(!clientId&&clients.data?.[0])setClientId(clients.data[0].id)},[clients.data,clientId]);
useEffect(()=>{if(!artistId&&artists.data?.[0])setArtistId(artists.data[0].id)},[artists.data,artistId]);

const createSession=trpc.pod.session.create.useMutation({
  onSuccess:(r)=>{const id=Number(r.id);setProcedureId(id);history.replaceState(null,"",location.pathname+"?procedureId="+id);toast.success("Sessão de teste iniciada no banco de staging.")},
  onError:e=>toast.error(e.message)
});
const session=trpc.pod.session.get.useQuery({procedureId},{enabled:!!procedureId});
const proc=session.data?.procedure;
const client=trpc.clients.getById.useQuery({id:Number(proc?.clientId||0)},{enabled:!!proc?.clientId});
const inventory=trpc.pod.inventory.list.useQuery({artistId:proc?.artistId??undefined},{enabled:!!procedureId});
const materialColorQuery=trpc.pod.inventory.materialColorSamples.useQuery({artistId:proc?.artistId??undefined},{enabled:!!procedureId});
const sampleQuery=trpc.pod.session.listColorSamples.useQuery({procedureId},{enabled:!!procedureId});
const recipeQuery=trpc.pod.session.listInkRecipes.useQuery({procedureId},{enabled:!!procedureId});
const visualLayerQuery=trpc.pod.session.listVisualLayers.useQuery({procedureId},{enabled:!!procedureId});
const utils=trpc.useUtils();

const consumeAuto=trpc.pod.session.consumeAuto.useMutation();
const revert=trpc.pod.session.revertConsumption.useMutation();
const saveSampleMutation=trpc.pod.session.saveColorSample.useMutation();
const saveMaterialColorMutation=trpc.pod.inventory.saveMaterialColorSample.useMutation();
const saveRecipeResultMutation=trpc.pod.session.saveInkRecipeResult.useMutation();
const updateVisualLayerMutation=trpc.pod.session.updateVisualLayer.useMutation();
const addVisualLayerMutation=trpc.pod.session.addVisualLayer.useMutation();
const removeVisualLayerMutation=trpc.pod.session.removeVisualLayer.useMutation();
const saveRecipeMutation=trpc.pod.session.saveInkRecipe.useMutation();
const revertRecipeMutation=trpc.pod.session.revertInkRecipe.useMutation();
const pauseMutation=trpc.pod.session.startPause.useMutation();
const resumeMutation=trpc.pod.session.resumePause.useMutation();
const updateProcedure=trpc.procedures.update.useMutation();
const uploadImage=trpc.procedures.uploadImage.useMutation();
const finalize=trpc.procedures.finalize.useMutation();

const stock=useMemo(()=>((inventory.data||[]) as any[]).map(toMaterial),[inventory.data]);
const materialColorMap=useMemo(()=>{const map:Record<string,any>={};for(const row of (materialColorQuery.data||[]) as any[])map[String(row.tenantMaterialId)]=row;return map},[materialColorQuery.data]);
const [active,setActive]=useState<string[]>([]);
useEffect(()=>{if(active.length||!stock.length)return;const planned=(session.data?.plannedMaterials||[]).map((p:any)=>String(p.tenantMaterialId||"")).filter(Boolean);setActive((planned.length?planned:stock.slice(0,6).map(m=>m.id)))},[stock,session.data?.plannedMaterials,active.length]);
const mats=useMemo(()=>active.map(x=>stock.find(m=>m.id===x)).filter(Boolean) as Material[],[active,stock]);
const [search,setSearch]=useState("");
const found=useMemo(()=>{const q=search.toLowerCase();return stock.filter(m=>!active.includes(m.id)&&(!q||(m.name+" "+m.detail).toLowerCase().includes(q)))},[active,stock,search]);

const [run,setRun]=useState(false),[sec,setSec]=useState(0);
useEffect(()=>{if(!session.data)return;setSec(Math.round((session.data.timing?.effectiveMinutes||0)*60));setRun(session.data.procedure.status==="em_andamento")},[procedureId,session.data?.procedure.status]);
useEffect(()=>{if(!run)return;const t=setInterval(()=>setSec(s=>s+1),1000);return()=>clearInterval(t)},[run]);

const [view,setView]=useState<View>(V0),vr=useRef(view);vr.current=view;
const [vu,setVu]=useState<View[]>([]),[vredo,setVredo]=useState<View[]>([]);
const [lmin,setLmin]=useState(false),[rmin,setRmin]=useState(false),[lex,setLex]=useState(false),[rex,setRex]=useState(false);
const [focusMode,setFocusMode]=useState(false),[cleanMode,setCleanMode]=useState(false);
const [lop,setLop]=useState(.9),[rop,setRop]=useState(.9),[lscale,setLscale]=useState(1),[rscale,setRscale]=useState(1);
const [layerLocal,setLayerLocal]=useState<Record<string,{opacity:number;isVisible:boolean}>>({});
const [refOn,setRefOn]=useState(true),[refOp,setRefOp]=useState(1),[markOn,setMarkOn]=useState(true),[markOp,setMarkOp]=useState(1);
const [mode,setMode]=useState<"tonal"|"color">("tonal"),[sampler,setSampler]=useState(false),[sample,setSample]=useState<Sample|null>(null),[referenceDraft,setReferenceDraft]=useState<ReferenceDraft|null>(null);
const [sheet,setSheet]=useState<Sheet>(null),[ink,setInk]=useState<Material|null>(null),[note,setNote]=useState("");
const [cup,setCup]=useState<Cup>("M"),[ings,setIngs]=useState<Ingredient[]>([]),[familyFilter,setFamilyFilter]=useState<string|null>(null);
const [undoStack,setUndoStack]=useState<StockAction[]>([]),[redoStack,setRedoStack]=useState<StockAction[]>([]),[flash,setFlash]=useState<string|null>(null);
const [charged,setCharged]=useState(""),[payment,setPayment]=useState<"pix"|"dinheiro"|"credito"|"debito"|"transferencia">("pix");
const [photoTarget,setPhotoTarget]=useState<PhotoTarget|null>(null),[photoSrc,setPhotoSrc]=useState<string|null>(null);
const [newLayerType,setNewLayerType]=useState<"contrast"|"stencil"|"stencil_overlay"|"image">("contrast"),[newLayerName,setNewLayerName]=useState("Contraste");
const finalInput=useRef<HTMLInputElement>(null),referenceInput=useRef<HTMLInputElement>(null),colorPhotoInput=useRef<HTMLInputElement>(null),layerImageInput=useRef<HTMLInputElement>(null),cockpitRoot=useRef<HTMLDivElement>(null);
const stage=useRef<HTMLDivElement>(null),image=useRef<HTMLImageElement>(null),pts=useRef(new Map<number,{x:number;y:number}>());
const start=useRef<View|null>(null),pstart=useRef<{x:number;y:number}|null>(null),base=useRef<{v:View;d:number;a:number;m:{x:number;y:number}}|null>(null),multiTouch=useRef(false),samplerPointerActive=useRef(false),samplePointerId=useRef<number|null>(null);

const samples:Sample[]=useMemo(()=>((sampleQuery.data||[]) as any[]).map(s=>({id:String(s.id),code:s.code,hex:s.hex,rgb:[s.red,s.green,s.blue],cmyk:[s.cyan,s.magenta,s.yellow,s.black],lab:[Number(s.labL||0),Number(s.labA||0),Number(s.labB||0)],xPct:Number(s.xPct),yPct:Number(s.yPct)})),[sampleQuery.data]);
const recipes=(recipeQuery.data||[]) as any[];
const visualLayers=(visualLayerQuery.data||[]) as any[];
const referenceLayer=visualLayers.find(l=>l.layerKey==="reference");
const sampleLayer=visualLayers.find(l=>l.layerKey==="samples");
const extraLayers=visualLayers.filter(l=>l.layerKey!=="reference"&&l.layerKey!=="samples");
useEffect(()=>{
  if(!visualLayers.length)return;
  if(referenceLayer){setRefOn(Boolean(referenceLayer.isVisible));setRefOp(Number(referenceLayer.opacity??100)/100)}
  if(sampleLayer){setMarkOn(Boolean(sampleLayer.isVisible));setMarkOp(Number(sampleLayer.opacity??100)/100)}
  setLayerLocal(Object.fromEntries(extraLayers.map(layer=>[String(layer.layerKey),{opacity:Number(layer.opacity??100),isVisible:Boolean(layer.isVisible)}])));
},[visualLayerQuery.data]);
const totals=useMemo(()=>{const o:Record<string,number>={};for(const u of (session.data?.consumptions||[]) as any[]){if(u.status!=="consumido")continue;o[String(u.tenantMaterialId)]=(o[String(u.tenantMaterialId)]||0)+Number(u.quantity)}return o},[session.data?.consumptions]);
const visibleRecipeColors=useMemo(()=>stock.filter(m=>m.kind==="ink"||m.kind==="diluent").filter(m=>{if(!familyFilter||m.kind==="diluent")return true;const stored=materialColorMap[m.id];return familyForColor(stored?.hex||m.color,stored)===familyFilter}),[stock,familyFilter,materialColorMap]);

function vset(n:View){setVu(h=>[...h,vr.current].slice(-30));setVredo([]);setView(n)}
function vundo(){setVu(h=>{const p=h[h.length-1];if(!p)return h;setVredo(r=>[vr.current,...r]);setView(p);return h.slice(0,-1)})}
function vred(){setVredo(r=>{const n=r[0];if(!n)return r;setVu(h=>[...h,vr.current]);setView(n);return r.slice(1)})}
async function refreshAll(){await Promise.all([utils.pod.session.get.invalidate({procedureId}),utils.pod.inventory.list.invalidate(),utils.pod.session.listInkRecipes.invalidate({procedureId}),utils.pod.session.listColorSamples.invalidate({procedureId})])}
function pushAction(a:StockAction){setUndoStack(x=>[...x,a]);setRedoStack([]);setFlash(a.label);setTimeout(()=>setFlash(f=>f===a.label?null:f),5000)}

useEffect(()=>{
  const sync=()=>{if(!document.fullscreenElement&&focusMode)setFocusMode(false)};
  document.addEventListener("fullscreenchange",sync);
  return()=>document.removeEventListener("fullscreenchange",sync);
},[focusMode]);

async function enterFocusMode(){
  setSheet(null);
  setFocusMode(true);
  setCleanMode(false);
  const node=cockpitRoot.current as any;
  try{
    if(node?.requestFullscreen&&!document.fullscreenElement)await node.requestFullscreen();
  }catch{}
}
async function exitFocusMode(){
  setFocusMode(false);
  setCleanMode(false);
  try{if(document.fullscreenElement)await document.exitFullscreen()}catch{}
}

async function persistLayer(layerKey:string,patch:{name?:string;opacity?:number;isVisible?:boolean;sortOrder?:number}){
  try{
    await updateVisualLayerMutation.mutateAsync({procedureId,layerKey,...patch});
    await utils.pod.session.listVisualLayers.invalidate({procedureId});
  }catch(e:any){toast.error(e.message||"Não foi possível atualizar a camada.")}
}
async function toggleLayer(layerKey:string,next:boolean){
  if(layerKey==="reference")setRefOn(next);
  else if(layerKey==="samples")setMarkOn(next);
  else setLayerLocal(x=>({...x,[layerKey]:{opacity:x[layerKey]?.opacity??100,isVisible:next}}));
  await persistLayer(layerKey,{isVisible:next});
}
async function uploadVisualLayer(file:File){
  if(file.size>16*1024*1024)return toast.error("Imagem acima de 16 MB.");
  if(!file.type.startsWith("image/"))return toast.error("Selecione um arquivo de imagem.");
  const b64=await new Promise<string>((resolve,reject)=>{const r=new FileReader();r.onerror=()=>reject(r.error);r.onload=()=>resolve(String(r.result).split(",")[1]||"");r.readAsDataURL(file)});
  try{
    const uploaded=await uploadImage.mutateAsync({procedureId,imageBase64:b64,mimeType:file.type||"image/jpeg",imageType:"other",description:"Camada visual: "+newLayerName});
    await addVisualLayerMutation.mutateAsync({procedureId,name:newLayerName.trim()||"Nova camada",layerType:newLayerType,imageUrl:String(uploaded.imageUrl),imageKey:String(uploaded.imageKey),opacity:newLayerType==="stencil_overlay"?65:100});
    await utils.pod.session.listVisualLayers.invalidate({procedureId});
    setSheet(null);toast.success("Camada adicionada à sessão.");
  }catch(e:any){toast.error(e.message||"Não foi possível adicionar a camada.")}
}
async function removeLayer(layer:any){
  if(!window.confirm("Remover a camada “"+layer.name+"”?"))return;
  try{await removeVisualLayerMutation.mutateAsync({procedureId,layerKey:String(layer.layerKey)});await utils.pod.session.listVisualLayers.invalidate({procedureId});toast.success("Camada removida.")}catch(e:any){toast.error(e.message||"Não foi possível remover a camada.")}
}
async function moveLayer(layer:any,direction:-1|1){
  const ordered=extraLayers.slice().sort((a:any,b:any)=>Number(a.sortOrder)-Number(b.sortOrder));
  const index=ordered.findIndex((x:any)=>x.layerKey===layer.layerKey),other=ordered[index+direction];
  if(index<0||!other)return;
  const aOrder=Number(layer.sortOrder),bOrder=Number(other.sortOrder);
  try{
    await Promise.all([
      updateVisualLayerMutation.mutateAsync({procedureId,layerKey:String(layer.layerKey),sortOrder:bOrder}),
      updateVisualLayerMutation.mutateAsync({procedureId,layerKey:String(other.layerKey),sortOrder:aOrder}),
    ]);
    await utils.pod.session.listVisualLayers.invalidate({procedureId});
  }catch(e:any){toast.error(e.message||"Não foi possível reordenar as camadas.")}
}

async function quickConsume(m:Material,quantity:string,label?:string){
  try{const r=await consumeAuto.mutateAsync({procedureId,tenantMaterialId:Number(m.id),quantity});pushAction({kind:"consumption",consumptionId:r.id,materialId:Number(m.id),quantity,label:label||m.name,unit:m.unit});await refreshAll()}
  catch(e:any){toast.error(e.message||"Falha ao consumir material.")}
}
function useMat(m:Material){if(m.kind==="cartridge"||m.kind==="protection"||m.kind==="cup")return void quickConsume(m,"1.000",m.name);if(m.kind==="ointment")return void quickConsume(m,"10.000",m.name+" +10 g");setInk(m);setSheet("ink")}
function setIng(mid:string,n:number){setIngs(a=>n<=0?a.filter(x=>x.materialId!==mid):a.some(x=>x.materialId===mid)?a.map(x=>x.materialId===mid?{...x,drops:n}:x):[...a,{materialId:mid,drops:n}])}
function recipe(seed?:Material){setCup("M");setIngs(seed?[{materialId:seed.id,drops:1}]:[]);setSheet("recipe")}
function cupMaterialId(size:Cup){const re=new RegExp("(batoque|ink.?cap).*(^|[^a-z])"+size.toLowerCase()+"([^a-z]|$)","i");const direct=stock.find(m=>re.test(m.name+" "+(m.configuration||"")));if(direct)return Number(direct.id);const byName=stock.find(m=>(m.name+" "+(m.configuration||"")).toLowerCase().includes("batoque "+size.toLowerCase()));return byName?Number(byName.id):undefined}

async function saveRecipe(){
  const drops=ings.reduce((a,b)=>a+b.drops,0),ml=drops*DROP;if(!drops)return toast.error("Adicione tinta ou diluente.");if(ml>CUP[cup])return toast.error("Mistura maior que a capacidade do batoque.");
  const payload={procedureId,sampleId:sample?Number(sample.id):undefined,cupSize:cup,dropsPerMl:20,cupTenantMaterialId:cupMaterialId(cup),ingredients:ings.map(i=>({tenantMaterialId:Number(i.materialId),drops:i.drops}))};
  try{const r=await saveRecipeMutation.mutateAsync(payload);pushAction({kind:"recipe",recipeId:r.id,label:r.code+" · "+drops+" gotas",payload});setSheet(null);await refreshAll();toast.success(r.code+" salva com baixa transacional no estoque.")}
  catch(e:any){toast.error(e.message||"Não foi possível salvar a mistura.")}
}

async function undoStock(){
  const a=undoStack[undoStack.length-1];if(!a)return;
  try{
    if(a.kind==="recipe")await revertRecipeMutation.mutateAsync({recipeId:a.recipeId,reason:"Desfeito pelo Cockpit V2"});
    else await revert.mutateAsync({consumptionId:a.consumptionId,reason:"Desfeito pelo Cockpit V2"});
    setUndoStack(x=>x.slice(0,-1));setRedoStack(x=>[a,...x]);setFlash(null);await refreshAll();toast.success(a.kind==="recipe"?"Mistura desfeita e saldos restaurados.":"Consumo desfeito e saldo restaurado.");
  }catch(e:any){toast.error(e.message||"Não foi possível desfazer.")}
}
async function redoStock(){
  const a=redoStack[0];if(!a)return;
  try{
    if(a.kind==="recipe"){const r=await saveRecipeMutation.mutateAsync(a.payload);const next:RecipeAction={...a,recipeId:r.id,label:r.code+" · "+a.payload.ingredients.reduce((s,i)=>s+i.drops,0)+" gotas"};setUndoStack(x=>[...x,next])}
    else{const r=await consumeAuto.mutateAsync({procedureId,tenantMaterialId:a.materialId,quantity:a.quantity});setUndoStack(x=>[...x,{...a,consumptionId:r.id}])}
    setRedoStack(x=>x.slice(1));await refreshAll();toast.success("Ação refeita.");
  }catch(e:any){toast.error(e.message||"Não foi possível refazer.")}
}

function readReferenceAt(cx:number,cy:number){
  const s=stage.current,im=image.current;if(!s||!im||!im.naturalWidth||samples.length>=30)return null;
  const rect=s.getBoundingClientRect(),w=rect.width,h=rect.height,p=new DOMPoint(cx-rect.left,cy-rect.top);
  const matrix=new DOMMatrix().translate(w/2+vr.current.x,h/2+vr.current.y).rotate(vr.current.rotation).scale(vr.current.scale).translate(-w/2,-h/2);
  const q=p.matrixTransform(matrix.inverse()),fit=Math.min(w/im.naturalWidth,h/im.naturalHeight),iw=im.naturalWidth*fit,ih=im.naturalHeight*fit,ox=(w-iw)/2,oy=(h-ih)/2;
  if(q.x<ox||q.x>ox+iw||q.y<oy||q.y>oy+ih)return null;
  const px=Math.round((q.x-ox)/iw*im.naturalWidth),py=Math.round((q.y-oy)/ih*im.naturalHeight),canvas=document.createElement("canvas");canvas.width=5;canvas.height=5;const ctx=canvas.getContext("2d",{willReadFrequently:true});if(!ctx)return null;
  try{
    const sx=Math.max(0,Math.min(im.naturalWidth-5,px-2)),sy=Math.max(0,Math.min(im.naturalHeight-5,py-2));
    ctx.drawImage(im,sx,sy,5,5,0,0,5,5);const d=ctx.getImageData(0,0,5,5).data;let R=0,G=0,B=0,n=0;for(let i=0;i<d.length;i+=4){R+=d[i];G+=d[i+1];B+=d[i+2];n++}R=Math.round(R/n);G=Math.round(G/n);B=Math.round(B/n);
    const CMYK=cmyk(R,G,B),LAB=lab(R,G,B),draft:ReferenceDraft={hex:hex(R,G,B),red:R,green:G,blue:B,cyan:CMYK[0],magenta:CMYK[1],yellow:CMYK[2],black:CMYK[3],labL:LAB[0],labA:LAB[1],labB:LAB[2],xPct:q.x/w*100,yPct:q.y/h*100};
    setReferenceDraft(draft);return draft;
  }catch{return null}
}
async function confirmReferenceSample(){
  const x=referenceDraft;if(!x)return;
  try{
    const saved=await saveSampleMutation.mutateAsync({procedureId,hex:x.hex,red:x.red,green:x.green,blue:x.blue,cyan:x.cyan,magenta:x.magenta,yellow:x.yellow,black:x.black,labL:x.labL,labA:x.labA,labB:x.labB,xPct:x.xPct,yPct:x.yPct,sampleSize:5});
    const s:Sample={id:String(saved.id),code:saved.code,hex:x.hex,rgb:[x.red,x.green,x.blue],cmyk:[x.cyan,x.magenta,x.yellow,x.black],lab:[x.labL,x.labA,x.labB],xPct:x.xPct,yPct:x.yPct};
    setSample(s);setReferenceDraft(null);setMode("color");await utils.pod.session.listColorSamples.invalidate({procedureId});
    if(samples.length+1>=30){setSampler(false);toast.success(saved.code+" salva. Limite de 30 amostras atingido.");}else{setSampler(true);toast.success(saved.code+" salva. Arraste para escolher a próxima cor.");}
  }catch(e:any){toast.error(e.message||"Não foi possível salvar essa cor.")}
}
function down(e:RP<HTMLDivElement>){
  e.preventDefault();
  e.stopPropagation();
  e.currentTarget.setPointerCapture(e.pointerId);
  pts.current.set(e.pointerId,{x:e.clientX,y:e.clientY});

  if(pts.current.size===1){
    pstart.current={x:e.clientX,y:e.clientY};
    if(sampler){
      samplePointerId.current=e.pointerId;
      samplerPointerActive.current=true;
      start.current=null;
      readReferenceAt(e.clientX,e.clientY);
      return;
    }
    start.current=vr.current;
  }

  if(pts.current.size===2){
    multiTouch.current=true;
    samplerPointerActive.current=false;
    samplePointerId.current=null;
    const[a,b]=[...pts.current.values()];
    base.current={v:vr.current,d:Math.hypot(b.x-a.x,b.y-a.y),a:Math.atan2(b.y-a.y,b.x-a.x),m:{x:(a.x+b.x)/2,y:(a.y+b.y)/2}};
  }
}
function move(e:RP<HTMLDivElement>){
  if(!pts.current.has(e.pointerId))return;
  e.preventDefault();
  e.stopPropagation();
  pts.current.set(e.pointerId,{x:e.clientX,y:e.clientY});
  const p=[...pts.current.values()];

  if(p.length===2&&base.current){
    const[a,b]=p,z=base.current,d=Math.hypot(b.x-a.x,b.y-a.y),ang=Math.atan2(b.y-a.y,b.x-a.x),m={x:(a.x+b.x)/2,y:(a.y+b.y)/2};
    setView({...z.v,scale:Math.max(.2,Math.min(5,z.v.scale*d/z.d)),rotation:z.v.rotation+(ang-z.a)*180/Math.PI,x:z.v.x+m.x-z.m.x,y:z.v.y+m.y-z.m.y});
    return;
  }

  if(sampler){
    if(!multiTouch.current&&samplerPointerActive.current&&samplePointerId.current===e.pointerId){
      readReferenceAt(e.clientX,e.clientY);
    }
    return;
  }

  if(p.length===1&&start.current&&pstart.current){
    setView({...start.current,x:start.current.x+e.clientX-pstart.current.x,y:start.current.y+e.clientY-pstart.current.y});
  }
}
function up(e:RP<HTMLDivElement>){
  e.preventDefault();
  e.stopPropagation();
  pts.current.delete(e.pointerId);
  if(samplePointerId.current===e.pointerId){
    samplePointerId.current=null;
    samplerPointerActive.current=false;
  }
  if(pts.current.size===0){
    if(!sampler&&start.current&&JSON.stringify(start.current)!==JSON.stringify(vr.current)){
      setVu(h=>[...h,start.current!]);setVredo([]);
    }
    start.current=null;pstart.current=null;base.current=null;multiTouch.current=false;samplerPointerActive.current=false;samplePointerId.current=null;
  }
}
function wheel(e:RW<HTMLDivElement>){e.preventDefault();if(sampler)return;vset({...vr.current,scale:Math.max(.2,Math.min(5,vr.current.scale*(e.deltaY<0?1.08:.92)))})}
useEffect(()=>{const el=stage.current as any;if(!el)return;let st:View|null=null;const a=(e:any)=>{e.preventDefault();if(sampler&&pts.current.size<2)return;st={...vr.current}},b=(e:any)=>{if(st){e.preventDefault();setView({...st,scale:Math.max(.2,Math.min(5,st.scale*(e.scale||1))),rotation:st.rotation+(e.rotation||0)})}},end=(e:any)=>{e.preventDefault();if(st){setVu(h=>[...h,st!]);setVredo([])}st=null};el.addEventListener("gesturestart",a,{passive:false});el.addEventListener("gesturechange",b,{passive:false});el.addEventListener("gestureend",end,{passive:false});return()=>{el.removeEventListener("gesturestart",a);el.removeEventListener("gesturechange",b);el.removeEventListener("gestureend",end)}},[sampler]);

async function toggleTimer(){
  try{if(run){await pauseMutation.mutateAsync({procedureId});setRun(false)}else{await resumeMutation.mutateAsync({procedureId});setRun(true)}await utils.pod.session.get.invalidate({procedureId})}catch(e:any){toast.error(e.message)}
}
async function saveNotes(){try{await updateProcedure.mutateAsync({id:procedureId,notes:note});setSheet(null);toast.success("Notas salvas na sessão.")}catch(e:any){toast.error(e.message)}}
function openColorPhoto(target:PhotoTarget){setPhotoTarget(target);colorPhotoInput.current?.click()}
function closeColorPhoto(){if(photoSrc)URL.revokeObjectURL(photoSrc);setPhotoSrc(null);setPhotoTarget(null)}
async function confirmTemporaryColor(color:ColorValue){
  if(!photoTarget)return;
  try{
    if(photoTarget.kind==="material"){
      await saveMaterialColorMutation.mutateAsync({tenantMaterialId:photoTarget.materialId,artistId:proc?.artistId??undefined,source:"photo",color});
      await utils.pod.inventory.materialColorSamples.invalidate({artistId:proc?.artistId??undefined});
      toast.success("Amostra tonal da tinta salva. A foto foi descartada.");
    }else{
      await saveRecipeResultMutation.mutateAsync({recipeId:photoTarget.recipeId,color});
      await utils.pod.session.listInkRecipes.invalidate({procedureId});
      toast.success("Resultado tonal da mistura salvo. A foto foi descartada.");
    }
    closeColorPhoto();
  }catch(e:any){toast.error(e.message||"Não foi possível salvar a amostra tonal.")}
}
async function uploadReference(file:File){
  if(file.size>16*1024*1024)return toast.error("Imagem acima de 16 MB.");
  if(!file.type.startsWith("image/"))return toast.error("Selecione um arquivo de imagem.");
  const b64=await new Promise<string>((resolve,reject)=>{
    const r=new FileReader();
    r.onerror=()=>reject(r.error);
    r.onload=()=>resolve(String(r.result).split(",")[1]||"");
    r.readAsDataURL(file);
  });
  try{
    await uploadImage.mutateAsync({
      procedureId,
      imageBase64:b64,
      mimeType:file.type||"image/jpeg",
      imageType:"reference",
      description:"Referência principal da sessão",
    });
    await utils.pod.session.get.invalidate({procedureId});
    await utils.pod.session.listVisualLayers.invalidate({procedureId});
    setRefOn(true);
    setView(V0);
    toast.success("Referência principal atualizada.");
  }catch(e:any){
    toast.error(e.message||"Não foi possível enviar a referência.");
  }
}

async function finalPhoto(file:File){if(file.size>16*1024*1024)return toast.error("Foto acima de 16 MB.");const b64=await new Promise<string>((resolve,reject)=>{const r=new FileReader();r.onerror=()=>reject(r.error);r.onload=()=>resolve(String(r.result).split(",")[1]||"");r.readAsDataURL(file)});try{await uploadImage.mutateAsync({procedureId,imageBase64:b64,mimeType:file.type||"image/jpeg",imageType:"final"});await utils.pod.session.get.invalidate({procedureId});toast.success("Foto final arquivada na sessão de teste.")}catch(e:any){toast.error(e.message)}}
async function finishLive(){const value=Number(charged.replace(",", "."));if(!Number.isFinite(value)||value<0)return toast.error("Informe o valor recebido.");try{await finalize.mutateAsync({procedureId,chargedAmount:value,paymentMethod:payment,notes:note||undefined});setRun(false);setSheet(null);await utils.pod.session.get.invalidate({procedureId});toast.success("Sessão finalizada; financeiro e estoque de staging atualizados.")}catch(e:any){toast.error(e.message)}}

if(auth.isLoading)return <div className="cockpit-lab" style={{display:"grid",placeItems:"center"}}>Carregando laboratório…</div>;
if(!auth.data)return <LocalLogin onSuccess={()=>void auth.refetch()}/>;
if(!procedureId){
  return <div className="cockpit-lab" style={{display:"grid",placeItems:"center",padding:16}}>
    <section style={{width:"min(520px,100%)",background:"#141417",border:"1px solid #27272a",borderRadius:18,padding:18}}>
      <h2 style={{margin:"0 0 6px",fontSize:20}}>Iniciar sessão live de teste</h2>
      <p style={{color:"#a1a1aa",fontSize:12}}>Usa somente o banco de staging. Produção não é alterada.</p>
      <label style={{display:"block",fontSize:11,marginTop:14}}>Cliente</label>
      <select className="search-input" value={clientId} onChange={e=>setClientId(Number(e.target.value))}>{(clients.data||[]).map((c:any)=><option key={c.id} value={c.id}>{c.name}</option>)}</select>
      <label style={{display:"block",fontSize:11}}>Artista</label>
      <select className="search-input" value={artistId} onChange={e=>setArtistId(Number(e.target.value))}><option value={0}>Sem artista</option>{(artists.data||[]).map((a:any)=><option key={a.id} value={a.id}>{a.name}</option>)}</select>
      <label style={{display:"block",fontSize:11}}>Projeto</label>
      <input className="search-input" value={title} onChange={e=>setTitle(e.target.value)}/>
      <button className="dock-add" style={{width:"100%"}} disabled={!clientId||createSession.isPending} onClick={()=>createSession.mutate({clientId,artistId:artistId||undefined,title})}>{createSession.isPending?"Criando…":"INICIAR SESSÃO DE TESTE"}</button>
    </section>
  </div>
}
if(session.isLoading||!proc)return <div className="cockpit-lab" style={{display:"grid",placeItems:"center"}}>Abrindo sessão…</div>;

const panel=(o:number,s:number,side:"left"|"right")=>({"--panel-alpha":o,transform:"scale("+s+")",transformOrigin:side==="left"?"left top":"right top"} as CSSProperties);
const drops=ings.reduce((a,b)=>a+b.drops,0),ml=drops*DROP,pct=Math.round(ml/CUP[cup]*100),cupDropCapacity=Math.round(CUP[cup]/DROP);
const refSrc=proc.referenceImageUrl?String(proc.referenceImageUrl):null;
const canvasRefSrc=canvasSafeSource(refSrc);
const orderedLayers=(visualLayers.length?visualLayers:[
  {layerKey:"reference",name:"Referência principal",layerType:"reference",imageUrl:refSrc,opacity:Math.round(refOp*100),isVisible:refOn?1:0,sortOrder:0},
  {layerKey:"samples",name:"Amostras de cor",layerType:"samples",imageUrl:null,opacity:Math.round(markOp*100),isVisible:markOn?1:0,sortOrder:900},
]).slice().sort((a:any,b:any)=>Number(a.sortOrder)-Number(b.sortOrder));
const layerVisible=(layer:any)=>layer.layerKey==="reference"?refOn:layer.layerKey==="samples"?markOn:(layerLocal[String(layer.layerKey)]?.isVisible??Boolean(layer.isVisible));
const layerOpacity=(layer:any)=>layer.layerKey==="reference"?Math.round(refOp*100):layer.layerKey==="samples"?Math.round(markOp*100):(layerLocal[String(layer.layerKey)]?.opacity??Number(layer.opacity??100));

return <div ref={cockpitRoot} className={"cockpit-lab "+(focusMode?"focus-mode ":"")+(cleanMode?"clean-mode ":"")+(sampler?"sampling-mode":"")}>
<header className="cockpit-top">
<button className="cockpit-icon" onClick={()=>history.back()}><ArrowLeft size={18}/></button><button className="cockpit-icon minor-nav" onClick={()=>location.assign("/")}><Home size={18}/></button>
<button className="cockpit-icon" onClick={vundo} disabled={!vu.length} title="Desfazer imagem"><Undo2 size={18}/></button><button className="cockpit-icon" onClick={vred} disabled={!vredo.length} title="Refazer imagem"><Redo2 size={18}/></button>
<div className="cockpit-client"><strong>{client.data?.name||"Cliente"} <span style={{fontSize:9,color:"#10b981"}}>· LIVE STAGING</span></strong><small>{proc.title} {proc.bodyLocation?"· "+proc.bodyLocation:""}</small></div>
<button className="cockpit-icon desktop-only" onClick={()=>{setNote(String(proc.notes||""));setSheet("notes")}}><StickyNote size={17}/></button><div className="cockpit-status"><i/><b>{timer(sec)}</b><span>{run?"EM ANDAMENTO":"PAUSADA"}</span></div>
</header>
{focusMode&&<div className="focus-toolbar">
  <button onClick={()=>void exitFocusMode()} title="Sair do modo foco"><Minimize2 size={17}/><span>Sair</span></button>
  <button className={cleanMode?"active":""} onClick={()=>setCleanMode(v=>!v)} title={cleanMode?"Mostrar painéis":"Imagem limpa"}>{cleanMode?<Eye size={17}/>:<EyeOff size={17}/>}<span>{cleanMode?"Painéis":"Limpar"}</span></button>
</div>}

<main ref={stage} className="cockpit-stage" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onWheel={wheel}>
<div className="cockpit-anamnese">Sessão #{procedureId} · banco de teste</div>
<div className="cockpit-view-quick"><button onClick={()=>vset(V0)}>{Math.round(view.scale*100)}%</button><button onClick={()=>vset({...vr.current,rotation:vr.current.rotation-15})}><RotateCcw size={15}/></button><button onClick={()=>vset({...vr.current,rotation:vr.current.rotation+15})}><RotateCw size={15}/></button></div><button className="focus-entry-button" onClick={()=>void enterFocusMode()} title="Abrir modo foco"><Maximize2 size={16}/><span>FOCO</span></button>
<div className="cockpit-transform" style={{transform:"translate("+view.x+"px,"+view.y+"px) rotate("+view.rotation+"deg) scale("+view.scale+")"}}>
{orderedLayers.map((layer:any)=>{
  if(!layerVisible(layer))return null;
  if(layer.layerKey==="reference"){
    return canvasRefSrc?<img key="reference" ref={image} src={canvasRefSrc} className="cockpit-reference cockpit-layer-image" style={{opacity:layerOpacity(layer)/100}} alt="Referência"/>:null;
  }
  if(layer.layerKey==="samples"){
    return <div key="samples" className="cockpit-sample-layer" style={{opacity:layerOpacity(layer)/100}}>{samples.map(s=><span key={s.id} className="sample-marker" data-code={s.code} style={{left:s.xPct+"%",top:s.yPct+"%",background:s.hex}}/>)}</div>;
  }
  const src=canvasSafeSource(layer.imageUrl);
  return src?<img key={layer.layerKey} src={src} className="cockpit-reference cockpit-layer-image" style={{opacity:layerOpacity(layer)/100}} alt={layer.name}/>:null;
})}
{referenceDraft&&<span className="reference-draft-marker" style={{left:referenceDraft.xPct+"%",top:referenceDraft.yPct+"%",background:referenceDraft.hex}}/>}
</div>
{refOn&&!canvasRefSrc&&<div className="cockpit-empty" style={{pointerEvents:"auto"}}>
  <div><div style={{marginBottom:10}}>Nenhuma referência anexada</div><button className="dock-add" style={{padding:"0 16px"}} onPointerDown={e=>e.stopPropagation()} onClick={e=>{e.stopPropagation();referenceInput.current?.click()}}><Plus size={16}/> Adicionar referência</button></div>
</div>}
{sampler&&!referenceDraft&&<div className="cockpit-empty" style={{pointerEvents:"none",color:"#fecdd3"}}><Pipette size={28}/><br/>Pressione e arraste sobre a referência<br/><small style={{fontSize:10,color:"#fda4af"}}>A cor muda em tempo real · solte para fixar · confirme para salvar</small></div>}
{sampler&&referenceDraft&&<div className="reference-sampler-card" onPointerDown={e=>e.stopPropagation()}>
  <div className="preview" style={{background:referenceDraft.hex}}/>
  <div><strong>Cor selecionada</strong><small>{referenceDraft.hex.toUpperCase()} · RGB {referenceDraft.red}/{referenceDraft.green}/{referenceDraft.blue}</small><small>CMYK {referenceDraft.cyan}/{referenceDraft.magenta}/{referenceDraft.yellow}/{referenceDraft.black} · LAB {referenceDraft.labL.toFixed(1)} {referenceDraft.labA.toFixed(1)} {referenceDraft.labB.toFixed(1)}</small></div>
  <button className="cancel-label" onClick={()=>setReferenceDraft(null)}>Mover novamente</button>
  <button className="primary" disabled={saveSampleMutation.isPending} onClick={()=>void confirmReferenceSample()}>Confirmar</button>
</div>}
</main>

<aside className={"cockpit-dock left "+(lmin?"minimized ":"")+(lex?"expanded":"")} style={panel(lop,lscale,"left")}>
<header><button onClick={()=>setLmin(v=>!v)}><Minus size={16}/></button><strong>Materiais</strong><button onClick={()=>setLex(v=>!v)}>{lex?<ChevronLeft size={16}/>:<ChevronRight size={16}/>}</button></header>
<div className="dock-controls"><label>Escala <input type="range" min=".9" max="1.1" step=".05" value={lscale} onChange={e=>setLscale(+e.target.value)}/><output>{Math.round(lscale*100)}</output></label><label>Fundo <input type="range" min=".35" max="1" step=".05" value={lop} onChange={e=>setLop(+e.target.value)}/><output>{Math.round(lop*100)}</output></label></div>
<div className="dock-body">{mats.map(m=><button key={m.id} className={"material-card "+(totals[m.id]?"active":"")} onClick={()=>useMat(m)}><span className="material-glyph" style={m.color?{background:m.color,color:m.color==="#f4f4f5"?"#18181b":"white"}:undefined}>{m.kind==="ink"||m.kind==="diluent"?<Droplets size={17}/>:m.short}</span>{lex&&<span className="material-meta"><b>{m.name}</b><small>{m.kind==="ink"||m.kind==="diluent"?"gotas / mistura":m.kind==="ointment"?"+10 g":"+1"}</small></span>}{!!totals[m.id]&&<span className="material-count">✓ {Number(totals[m.id]).toFixed(2)} {m.unit}</span>}</button>)}<button className="dock-add" onClick={()=>setSheet("materials")}><Plus size={18}/>{lex&&" Adicionar"}</button></div>
<div className="dock-undo"><button onClick={()=>void undoStock()} disabled={!undoStack.length}><Undo2 size={16}/></button><button onClick={()=>void redoStock()} disabled={!redoStack.length}><Redo2 size={16}/></button></div>
</aside>

<aside className={"cockpit-dock right "+(rmin?"minimized ":"")+(rex?"expanded":"")} style={panel(rop,rscale,"right")}>
<header><button onClick={()=>setRmin(v=>!v)}><Minus size={16}/></button><strong>Camadas</strong><button onClick={()=>setRex(v=>!v)}>{rex?<ChevronRight size={16}/>:<ChevronLeft size={16}/>}</button></header>
<div className="dock-controls"><label>Escala <input type="range" min=".9" max="1.1" step=".05" value={rscale} onChange={e=>setRscale(+e.target.value)}/><output>{Math.round(rscale*100)}</output></label><label>Fundo <input type="range" min=".35" max="1" step=".05" value={rop} onChange={e=>setRop(+e.target.value)}/><output>{Math.round(rop*100)}</output></label></div>
<div className="dock-body">{orderedLayers.map((layer:any)=>{
  const src=layer.layerKey==="reference"?canvasRefSrc:layer.layerKey==="samples"?null:canvasSafeSource(layer.imageUrl);
  const opacity=layerOpacity(layer),visible=layerVisible(layer);
  return <div className="layer-card layer-card-dynamic" key={layer.layerKey}>
    {layer.layerKey==="samples"?<div className="layer-thumb" style={{display:"grid",placeItems:"center"}}><Pipette size={17}/></div>:src?<img className="layer-thumb" src={src}/>:<div className="layer-thumb" style={{display:"grid",placeItems:"center"}}><Layers3 size={17}/></div>}
    <div className="layer-main"><strong>{layer.name}</strong><input type="range" min="0" max="100" step="5" value={opacity} onChange={e=>{const value=Number(e.target.value);if(layer.layerKey==="reference")setRefOp(value/100);else if(layer.layerKey==="samples")setMarkOp(value/100);else setLayerLocal(x=>({...x,[layer.layerKey]:{opacity:value,isVisible:x[layer.layerKey]?.isVisible??visible}}))}} onPointerUp={e=>void persistLayer(String(layer.layerKey),{opacity:Number(e.currentTarget.value)})}/>{rex&&layer.layerKey!=="reference"&&layer.layerKey!=="samples"&&<div className="layer-row-actions"><button onClick={()=>void moveLayer(layer,-1)}>↑</button><button onClick={()=>void moveLayer(layer,1)}>↓</button><button className="danger" onClick={()=>void removeLayer(layer)}><X size={11}/></button></div>}</div>
    <button className="layer-eye" onClick={()=>void toggleLayer(String(layer.layerKey),!visible)}>{visible?<Eye size={16}/>:<EyeOff size={16}/>}</button>
  </div>
})}
<button className="dock-add" onClick={()=>setSheet("layerAdd")}><Plus size={16}/>{rex&&" Nova camada"}</button>
<button className="dock-add secondary" onClick={()=>referenceInput.current?.click()}><Plus size={16}/>{rex&&(refSrc?" Trocar referência":" Adicionar referência")}</button></div>
</aside>

<div className="cockpit-palette"><button className="palette-add" onClick={()=>{if(mode==="tonal"){setMode("color");setSampler(true)}else{setMode("tonal");setSampler(false);setReferenceDraft(null)}}}><Palette size={13}/> {mode==="tonal"?"Cores":"Tons"}</button>
{mode==="tonal"?GRAYS.map((g,i)=><button key={g} className="palette-chip" style={{background:g}}><span>T{String(i+1).padStart(2,"0")}</span></button>):<>{samples.map(s=><button key={s.id} className="palette-chip" style={{background:s.hex}} onClick={()=>{setSample(s);setSheet("sample")}}><span>{s.code}</span></button>)}<button className={"palette-add "+(sampler?"selected":"")} onClick={()=>setSampler(v=>{const next=!v;if(!next)setReferenceDraft(null);return next})} disabled={samples.length>=30}><Pipette size={13}/> {sampler?"Amostragem ativa":"Amostrar"}</button></>}</div>{focusMode&&<div className="focus-palette-strip">
  <div className="focus-tonal-gradient" title="Escala de contraste"/>
  <div className="focus-samples">{samples.map(s=><button key={s.id} style={{background:s.hex}} onClick={()=>{setSample(s);setSheet("sample")}} title={s.code}><span>{s.code}</span></button>)}</div>
  <button className={"focus-sampler-button "+(sampler?"active":"")} onClick={()=>setSampler(v=>{const next=!v;if(!next)setReferenceDraft(null);return next})} title={sampler?"Encerrar amostragem":"Amostrar cor"}><Pipette size={15}/></button>
</div>}


{flash&&<div className="cockpit-toast"><Check size={17} color="#10b981"/><span>{flash}</span><button onClick={()=>void undoStock()}>DESFAZER (5s)</button></div>}
<input ref={colorPhotoInput} type="file" accept="image/*" capture="environment" style={{display:"none"}} onChange={e=>{const file=e.target.files?.[0];if(file){if(photoSrc)URL.revokeObjectURL(photoSrc);setPhotoSrc(URL.createObjectURL(file))}e.currentTarget.value=""}}/>
<input ref={layerImageInput} type="file" accept="image/jpeg,image/png,image/webp" style={{display:"none"}} onChange={e=>{const f=e.target.files?.[0];if(f)void uploadVisualLayer(f);e.currentTarget.value=""}}/>
<input ref={referenceInput} type="file" accept="image/jpeg,image/png,image/webp" style={{display:"none"}} onChange={e=>{const f=e.target.files?.[0];if(f)void uploadReference(f);e.currentTarget.value=""}}/>
<input ref={finalInput} type="file" accept="image/*" capture="environment" style={{display:"none"}} onChange={e=>{const f=e.target.files?.[0];if(f)void finalPhoto(f);e.currentTarget.value=""}}/>
<footer className="cockpit-bottom"><button onClick={()=>void toggleTimer()}>{run?<Pause size={18}/>:<Play size={18}/>}<span className="button-label">{run?"PAUSAR":"RETOMAR"}</span></button><button onClick={()=>setSheet("materials")}><Package size={18}/><span className="button-label">ESTOQUE</span></button><button onClick={()=>finalInput.current?.click()}><Camera size={18}/><span className="button-label">FOTO</span></button><button className="finish" onClick={()=>{if(!charged&&proc.chargedAmount)setCharged(String(Number(proc.chargedAmount)/100));setSheet("finish")}}><Square size={17}/><span className="button-label">CONCLUIR</span></button></footer>

{sheet==="layerAdd"&&<section className="cockpit-sheet"><button className="close" onClick={()=>setSheet(null)}><X size={17}/></button><h3>Nova camada visual</h3><p>Adicione uma imagem independente. Ela poderá ser ocultada, ter a opacidade alterada e ser reordenada sem modificar a referência principal.</p>
<div className="sheet-grid">{[
  {type:"contrast",name:"Contraste",desc:"Versão preparada para leitura de contraste"},
  {type:"stencil",name:"Decalque",desc:"Decalque isolado"},
  {type:"stencil_overlay",name:"Decalque sobre referência",desc:"Sobreposição com opacidade inicial de 65%"},
  {type:"image",name:"Camada de imagem",desc:"Qualquer outra imagem de apoio"},
].map((item:any)=><button key={item.type} className={"sheet-option "+(newLayerType===item.type?"selected":"")} onClick={()=>{setNewLayerType(item.type);setNewLayerName(item.name)}}><b>{item.name}</b><small>{item.desc}</small></button>)}</div>
<label className="layer-name-label">Nome da camada</label><input className="search-input" value={newLayerName} onChange={e=>setNewLayerName(e.target.value)} placeholder="Ex.: Contraste PB, Decalque 2..."/>
<div className="sheet-actions"><button onClick={()=>setSheet(null)}>Cancelar</button><button className="primary" disabled={!newLayerName.trim()||addVisualLayerMutation.isPending||uploadImage.isPending} onClick={()=>layerImageInput.current?.click()}><Plus size={15}/> Selecionar imagem</button></div>
</section>}
{sheet==="materials"&&<section className="cockpit-sheet"><button className="close" onClick={()=>setSheet(null)}><X size={17}/></button><h3>Adicionar material ativo</h3><p>Busca real no estoque de staging. Nenhum material é duplicado.</p><div style={{position:"relative"}}><Search size={16} style={{position:"absolute",left:12,top:14,color:"#71717a"}}/><input className="search-input" style={{paddingLeft:36}} value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar cartucho, tinta, marca..."/></div><div className="sheet-grid">{found.map(m=><button className="sheet-option" key={m.id} onClick={()=>{setActive(a=>[...a,m.id]);setSheet(null);setSearch("")}}><b>{m.name}</b><small>{m.detail} · saldo {(inventory.data as any[])?.find(x=>String(x.id)===m.id)?.currentQuantity} {m.unit}</small></button>)}</div></section>}

{sheet==="ink"&&ink&&<section className="cockpit-sheet"><button className="close" onClick={()=>setSheet(null)}><X size={17}/></button><h3>{ink.name}</h3><p>Uso direto ou mistura. Conversão padrão: 20 gotas/ml.</p><div className="sheet-grid">{[1,3,5,10].map(n=><button key={n} className="sheet-option" onClick={()=>{try{const q=quantityForDrops(ink,n);void quickConsume(ink,q,ink.name+" · "+n+" gotas");setSheet(null)}catch(e:any){toast.error(e.message)}}}><b>+ {n} gotas</b><small>~ {(n*DROP).toFixed(2)} ml</small></button>)}<button className="sheet-option selected" onClick={()=>recipe(ink)}><b>Criar mistura</b><small>Batoque + proporções + histórico</small></button></div></section>}

{sheet==="recipe"&&<section className="cockpit-sheet recipe-sheet"><button className="close" onClick={()=>setSheet(null)}><X size={17}/></button><h3>Receita {sample?"· "+sample.code:""}</h3><p>Será gravada junto da sessão e das baixas de cada pigmento.</p>
{sample&&<div className="recipe-sample-card">
  <div className="sample-crop" style={canvasRefSrc?{backgroundImage:"url(\""+canvasRefSrc+"\")",backgroundPosition:sample.xPct+"% "+sample.yPct+"%"}:{background:sample.hex}}/>
  <div className="recipe-sample-swatch" style={{background:sample.hex}}/>
  <div className="recipe-sample-meta"><strong>{sample.code}</strong><span>Referência retirada da imagem</span><small>{sample.hex.toUpperCase()} · RGB {sample.rgb.join(" / ")} · CMYK {sample.cmyk.join(" / ")}</small></div>
</div>}
<div className="sheet-grid cup-grid">{(["P","M","G","GG"] as Cup[]).map(c=><button key={c} className={"sheet-option "+(cup===c?"selected":"")} onClick={()=>setCup(c)}><b>Batoque {c}</b><small>{CUP[c]} ml · ~{Math.round(CUP[c]/DROP)} gotas</small></button>)}</div>
<div className="stock-colors-title"><strong>Paleta-base</strong><small>CMYK + Branco</small></div>
<div className="color-family-strip">{COLOR_FAMILIES.map(f=><button key={f.key} className={"color-family-chip "+(familyFilter===f.key?"selected":"")} onClick={()=>setFamilyFilter(v=>v===f.key?null:f.key)}><i style={{background:f.hex}}/><span>{f.label}</span></button>)}</div>
<div className="stock-colors-title"><strong>Cores do estoque</strong><small>{familyFilter?"Filtro "+familyFilter:"Todas as tintas cadastradas"}</small></div>
<div className="mix-ingredients">
{visibleRecipeColors.map(m=>{const row=ings.find(x=>x.materialId===m.id),value=row?.drops??0,stored=materialColorMap[m.id],swatch=stored?.hex||m.color;return <div className="mix-ingredient" key={m.id}>
  <div className="mix-ingredient-head with-swatch">
    <span className={"material-color-square "+(!swatch?"unknown":"")} style={swatch?{background:swatch}:undefined}>{!swatch?"?":""}</span>
    <span className="mix-ingredient-name">{m.name}<small>{stored?"Amostra tonal salva":swatch?"Cor estimada pelo nome":"Sem amostra tonal"}</small></span>
    <button className="material-color-calibrate" title="Fotografar e calibrar a cor desta tinta" onClick={()=>openColorPhoto({kind:"material",materialId:Number(m.id),name:m.name})}><Camera size={16}/></button>
    <div className="mix-number-wrap"><input aria-label={"Gotas de "+m.name} type="number" inputMode="numeric" pattern="[0-9]*" min="1" max={cupDropCapacity} placeholder="0" value={row?String(row.drops):""} onFocus={e=>{const el=e.currentTarget.closest(".mix-ingredient");setTimeout(()=>el?.scrollIntoView({block:"center",behavior:"smooth"}),180)}} onChange={e=>{const raw=e.target.value;if(raw==="")return setIng(m.id,0);const n=Math.min(cupDropCapacity,Math.max(0,Math.floor(Number(raw)||0)));setIng(m.id,n)}}/><span>gt</span></div>
  </div>
  <input className="mix-drop-slider" aria-label={"Deslizar gotas de "+m.name} type="range" min="0" max={cupDropCapacity} step="1" value={value} onChange={e=>setIng(m.id,Number(e.target.value))}/>
  <div className="mix-slider-scale"><span>0</span><span>{value} gotas</span><span>{cupDropCapacity}</span></div>
</div>})}
</div>
<div className={"mix-summary mix-summary-sticky "+(drops>cupDropCapacity?"over":"")}><div>Total: {drops} / {cupDropCapacity} gotas · ~{ml.toFixed(2)} ml</div><div>Batoque {cup}: {CUP[cup].toFixed(2)} ml · ocupação ~{pct}%</div>{drops>cupDropCapacity&&<div className="mix-over-warning">Mistura acima da capacidade do batoque.</div>}{ings.map(i=>{const m=stock.find(x=>x.id===i.materialId);return <div key={i.materialId}>{m?.short}: {i.drops}gt · {drops?((i.drops/drops)*100).toFixed(1):0}%</div>})}</div>
<div className="sheet-actions recipe-actions"><button onClick={()=>setSheet(null)}>Cancelar</button><button className="primary" disabled={saveRecipeMutation.isPending||drops===0||drops>cupDropCapacity} onClick={()=>void saveRecipe()}>Salvar receita + baixar estoque</button></div></section>}

{sheet==="sample"&&sample&&<section className="cockpit-sheet"><button className="close" onClick={()=>setSheet(null)}><X size={17}/></button><h3>{sample.code} · Amostra 5×5 px</h3><div className="sample-detail sample-detail-expanded"><div className="sample-crop large" style={canvasRefSrc?{backgroundImage:"url(\""+canvasRefSrc+"\")",backgroundPosition:sample.xPct+"% "+sample.yPct+"%"}:{background:sample.hex}}/><div><div className="sample-swatch compact" style={{background:sample.hex}}/><div className="sample-data"><div>HEX {sample.hex.toUpperCase()}</div><div>RGB {sample.rgb.join(" · ")}</div><div>CMYK {sample.cmyk.map(v=>v+"%").join(" · ")}</div></div></div></div><div className="sheet-actions"><button onClick={()=>{setSheet(null);setSampler(true)}}>Nova amostra</button><button className="primary" onClick={()=>recipe()}>Criar mistura</button></div>{recipes.filter((r:any)=>String(r.sampleId||"")===sample.id).map((r:any)=><div className="mix-summary" key={r.id}><b>{r.code} · Batoque {r.cupSize}</b><br/>{r.items?.map((i:any)=>i.nameSnapshot+" "+i.drops+"gt").join(" + ")}<br/>~{Number(r.estimatedMl).toFixed(2)} ml · {r.status==="reverted"?"DESFEITA":"ATIVA"}<div className="recipe-result-line">{r.result?<><span className="result-swatch" style={{background:r.result.hex}}/><span>Resultado {String(r.result.hex).toUpperCase()}<br/>LAB {Number(r.result.labL).toFixed(1)} {Number(r.result.labA).toFixed(1)} {Number(r.result.labB).toFixed(1)}</span></>:<span>Resultado ainda não registrado</span>}<button onClick={()=>openColorPhoto({kind:"recipe",recipeId:r.id,code:r.code})}><Camera size={13}/> {r.result?"Atualizar":"Registrar resultado"}</button></div></div>)}</section>}

{sheet==="notes"&&<section className="cockpit-sheet"><button className="close" onClick={()=>setSheet(null)}><X size={17}/></button><h3>Notas rápidas</h3><textarea className="cockpit-note" value={note} onChange={e=>setNote(e.target.value)}/><div className="sheet-actions"><button className="primary" disabled={updateProcedure.isPending} onClick={()=>void saveNotes()}>Salvar na sessão</button></div></section>}
{sheet==="finish"&&<section className="cockpit-sheet"><button className="close" onClick={()=>setSheet(null)}><X size={17}/></button><h3>Revisão antes de concluir</h3><p>Esta conclusão altera somente o financeiro/estoque do ambiente de staging.</p><div className="mix-summary"><div>Duração: {timer(sec)}</div><div>Consumos ativos: {(session.data?.consumptions||[]).filter((x:any)=>x.status==="consumido").length}</div><div>Misturas: {recipes.filter((r:any)=>r.status!=="reverted").length}</div><div>Amostras: {samples.length}</div><div>Foto final: {proc.finalImageUrl?"✓ anexada":"não anexada"}</div></div><label style={{fontSize:10}}>Valor recebido (R$)</label><input className="search-input" inputMode="decimal" value={charged} onChange={e=>setCharged(e.target.value)} placeholder="1800,00"/><label style={{fontSize:10}}>Pagamento</label><select className="search-input" value={payment} onChange={e=>setPayment(e.target.value as any)}><option value="pix">Pix</option><option value="dinheiro">Dinheiro</option><option value="credito">Crédito</option><option value="debito">Débito</option><option value="transferencia">Transferência</option></select><div className="sheet-actions"><button onClick={()=>setSheet(null)}>Voltar</button><button className="primary" disabled={finalize.isPending} onClick={()=>void finishLive()}>Concluir no staging</button></div></section>}
{photoTarget&&photoSrc&&<TemporaryColorSampler src={photoSrc} title={photoTarget.kind==="material"?"Calibrar "+photoTarget.name:"Resultado da mistura "+photoTarget.code} subtitle="Pressione e arraste o ponto. O quadrado superior mostra a cor em tempo real." onCancel={closeColorPhoto} onConfirm={confirmTemporaryColor}/>}
</div>
}
