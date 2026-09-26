import { materialSymbol, materialSymbolLabels, recordedColor, recipeDisplayColor } from "@shared/sessionAppearance";
import SessionMaterialIcon from "./SessionMaterialIcon";
import SessionMaterialHint from "./SessionMaterialHint";
import SessionAppearancePanel from "./SessionAppearancePanel";
import { useSessionAppearance } from "./useSessionAppearance";
import { imageSamplePoint, samplePixelRegion, averageSamplePixels, imageSampleMarker, type SampleSource } from "@shared/sessionColorSampling";
import { visualLayerStack } from "@shared/sessionVisualLayers";
import SessionLayerPanel from "./SessionLayerPanel";
import { readTestMetadata } from "@shared/inventoryTestCatalog";
import SessionPreparationSummary from "@/components/SessionPreparationSummary";
import SessionMaterialQuantity from "@/components/SessionMaterialQuantity";
import { SESSION_CUP_ML, SESSION_DROPS_PER_ML, inkStockQuantity, isSessionCartridge, validateSessionUnit, isSessionOintment, isSessionDiluent, isSessionCup, isSessionInk, sessionCupSize } from "@shared/sessionInkQuantity";
import { createPortal } from "react-dom";
import {useEffect,useMemo,useRef,useState,type CSSProperties,type PointerEvent as RP,type WheelEvent as RW} from "react";
import {ArrowLeft,Home,Undo2,Redo2,Minus,Eye,EyeOff,Plus,Pause,Play,Package,Camera,Square,StickyNote,RotateCcw,RotateCw,Palette,Pipette,X,Search,Droplets,Check,Layers3,ChevronLeft,ChevronRight,Maximize2,Minimize2,Settings2} from "lucide-react";
import {toast} from "sonner";
import {trpc} from "@/lib/trpc";
import TemporaryColorSampler, { type ColorValue } from "./TemporaryColorSampler";
import "./session-cockpit-v2.css";

type Kind="cartridge"|"ink"|"diluent"|"ointment"|"protection"|"cup";
type Material={category?:string|null;id:string;name:string;short:string;kind:Kind;unit:string;color?:string;detail:string;brand?:string|null;configuration?:string|null;notes?:string|null};
type Cup="P"|"M"|"G"|"GG";
type Ingredient={materialId:string;drops:number};
type View={x:number;y:number;scale:number;rotation:number};
type Sample={source?:SampleSource|null;id:string;code:string;hex:string;rgb:[number,number,number];cmyk:[number,number,number,number];lab:[number,number,number];xPct:number;yPct:number};
type ReferenceDraft=ColorValue&{xPct:number;yPct:number;source:SampleSource;requestId:string};
type PhotoTarget={kind:"material";materialId:number;name:string}|{kind:"recipe";recipeId:number;code:string};
type Sheet="preparation"|"materials"|"ink"|"recipe"|"sample"|"notes"|"finish"|"layerAdd"|"appearance"|null;
type QuickAction={kind:"consumption";consumptionId:number;materialId:number;quantity:string;label:string;unit:string};
type RecipeAction={kind:"recipe";recipeId:number;label:string;payload:{procedureId:number;sampleId?:number;cupSize:Cup|null;dropsPerMl:number;cupTenantMaterialId?:number;ingredients:{tenantMaterialId:number;drops:number}[]}};
type StockAction=QuickAction|RecipeAction;

const CUP=SESSION_CUP_ML;

const V0:View={x:0,y:0,scale:1,rotation:0};
const GRAYS=["#050505","#191919","#333333","#525252","#737373","#969696","#b8b8b8","#dddddd","#ffffff"];
const COLOR_FAMILIES=[
  {key:"C",label:"Ciano",hex:"#00AEEF"},
  {key:"M",label:"Magenta",hex:"#EC008C"},
  {key:"Y",label:"Amarelo",hex:"#FFF200"},
  {key:"K",label:"Preto",hex:"#111111"},
  {key:"W",label:"Branco",hex:"#FFFFFF"},
] as const;

function hex(r:number,g:number,b:number){return "#"+[r,g,b].map(v=>Math.round(v).toString(16).padStart(2,"0")).join("")}
function cmyk(r:number,g:number,b:number):[number,number,number,number]{const R=r/255,G=g/255,B=b/255,k=1-Math.max(R,G,B);if(k>.999)return[0,0,0,100];return[Math.round((1-R-k)/(1-k)*100),Math.round((1-G-k)/(1-k)*100),Math.round((1-B-k)/(1-k)*100),Math.round(k*100)]}
function lab(r:number,g:number,b:number):[number,number,number]{const lin=(v:number)=>{v/=255;return v<=.04045?v/12.92:Math.pow((v+.055)/1.055,2.4)};const R=lin(r),G=lin(g),B=lin(b);let x=(R*.4124564+G*.3575761+B*.1804375)/.95047,y=(R*.2126729+G*.7151522+B*.072175),z=(R*.0193339+G*.1191920+B*.9503041)/1.08883;const f=(v:number)=>v>.008856?Math.cbrt(v):(7.787*v)+(16/116);x=f(x);y=f(y);z=f(z);return[Math.max(0,Math.min(100,116*y-16)),500*(x-y),200*(y-z)]}
function parseHexColor(value?:string){if(!value||!/^#[0-9a-f]{6}$/i.test(value))return null;return[parseInt(value.slice(1,3),16),parseInt(value.slice(3,5),16),parseInt(value.slice(5,7),16)] as [number,number,number]}
function familyForColor(hexValue?:string,stored?:any){let values:[number,number,number,number]|null=null;if(stored)values=[Number(stored.cyan),Number(stored.magenta),Number(stored.yellow),Number(stored.black)];else{const rgb=parseHexColor(hexValue);if(rgb)values=cmyk(...rgb)}if(!values)return null;const [C,M,Y,K]=values;if(K>=65)return"K";const rgb=parseHexColor(stored?.hex||hexValue);if(rgb&&rgb.every(v=>v>=225))return"W";const max=Math.max(C,M,Y);if(max===C)return"C";if(max===M)return"M";return"Y"}
function inferKind(name:string,category?:string|null):Kind{const m={name,category,unit:""};if(isSessionCartridge(m))return"cartridge";if(isSessionCup(m))return"cup";if(isSessionOintment(m))return"ointment";if(isSessionDiluent(m))return"diluent";if(isSessionInk(m))return"ink";if(/cartucho|agulha|needle|round liner|round shader|magnum|\brl\b|\brs\b/i.test(name+" "+category))return"cartridge";return"protection"}
function shortName(name:string,configuration?:string|null){if(configuration?.trim())return configuration.trim().slice(0,7).toUpperCase();const m=name.toUpperCase().match(/\b\d{1,2}(?:RL|RS|M1|CM|RM)\b/);if(m)return m[0];return name.replace(/[^A-Za-z0-9]/g,"").slice(0,4).toUpperCase()||"ITEM"}
function toMaterial(raw:any):Material{return{id:String(raw.id),name:String(raw.name||"Material"),short:shortName(String(raw.name||""),raw.configuration),kind:inferKind(String(raw.name||""),raw.category),unit:String(raw.unit||"unidade"),category:raw.category,color:recordedColor(raw.hex||raw.color),detail:[raw.brand,raw.configuration,raw.lot?"Lote "+raw.lot:null].filter(Boolean).join(" · ")||"Estoque ativo",brand:raw.brand,configuration:raw.configuration,notes:raw.notes}}
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



export type SessionCockpitV2Props={
  procedureId:number;
  studioId:number;
  clientId:number;
  artistId?:number;
  title:string;
  elapsed:string;
  running:boolean;
  started:boolean;
  finished:boolean;
  timerBusy:boolean;
  onTimer:()=>void;
  onClose:()=>void;
  onFinish:()=>void;
  originalSrc?:string|null;
};

export default function SessionCockpitV2(props:SessionCockpitV2Props){
const procedureId=props.procedureId;
const appearance=useSessionAppearance(procedureId);
const session=trpc.pod.session.get.useQuery({procedureId},{enabled:!!procedureId});
const proc=session.data?.procedure;
const client=trpc.clients.getById.useQuery({id:props.clientId},{enabled:!!props.clientId});
const inventory=trpc.pod.inventory.list.useQuery({artistId:props.artistId??proc?.artistId??undefined},{enabled:!!procedureId});
const materialColorQuery=trpc.pod.inventory.materialColorSamples.useQuery({artistId:props.artistId??proc?.artistId??undefined},{enabled:!!procedureId});
const sampleQuery=trpc.pod.session.listColorSamples.useQuery({procedureId},{enabled:!!procedureId});
const preparationQuery=trpc.procedures.getById.useQuery({id:procedureId},{enabled:!!procedureId});
const recipeQuery=trpc.pod.session.listInkRecipes.useQuery({procedureId},{enabled:!!procedureId});
const visualLayerQuery=trpc.pod.session.listVisualLayers.useQuery({procedureId},{enabled:!!procedureId});
const utils=trpc.useUtils();

const addMaterial=trpc.pod.session.addMaterial.useMutation();
const consumeAuto=trpc.pod.session.consumeAuto.useMutation();
const revert=trpc.pod.session.revertConsumption.useMutation();
const saveSampleMutation=trpc.pod.session.saveColorSample.useMutation();
const saveMaterialColorMutation=trpc.pod.inventory.saveMaterialColorSample.useMutation();
const saveRecipeResultMutation=trpc.pod.session.saveInkRecipeResult.useMutation();
const reorderVisualLayersMutation=trpc.pod.session.reorderVisualLayers.useMutation();
const updateVisualLayerMutation=trpc.pod.session.updateVisualLayer.useMutation();
const addVisualLayerMutation=trpc.pod.session.addVisualLayer.useMutation();
const removeVisualLayerMutation=trpc.pod.session.removeVisualLayer.useMutation();
const saveRecipeMutation=trpc.pod.session.saveInkRecipe.useMutation();
const revertRecipeMutation=trpc.pod.session.revertInkRecipe.useMutation();
const updateProcedure=trpc.procedures.update.useMutation();
const uploadImage=trpc.procedures.uploadImage.useMutation();

const stock=useMemo(()=>((inventory.data||[]) as any[]).map(toMaterial),[inventory.data]);
const materialColorMap=useMemo(()=>{const map:Record<string,any>={};for(const row of (materialColorQuery.data||[]) as any[])map[String(row.tenantMaterialId)]=row;return map},[materialColorQuery.data]);
const selections=session.data?.sessionMaterials??[];
const active=selections.map(m=>String(m.tenantMaterialId));
const mats=selections.map(item=>({...toMaterial({id:item.tenantMaterialId,name:item.name,unit:item.unit}),...stock.find(m=>m.id===String(item.tenantMaterialId)),unit:item.unit,plannedQuantity:item.quantity}));
const [search,setSearch]=useState("");
const found=useMemo(()=>{const q=search.toLowerCase();return stock.filter(m=>!active.includes(m.id)&&(!q||(m.name+" "+m.detail).toLowerCase().includes(q)))},[active,stock,search]);


const [view,setView]=useState<View>(V0),vr=useRef(view);vr.current=view;
const [vu,setVu]=useState<View[]>([]),[vredo,setVredo]=useState<View[]>([]);
const {materials:materialAppearance,layers:layerAppearance,tools:toolAppearance,palette:paletteAppearance}=appearance.value;
function setDock(key:"materials"|"layers",field:"size"|"opacity"|"expanded"|"collapsed",value:number|boolean|((previous:boolean)=>boolean)){
  appearance.change(previous=>({...previous,[key]:{...previous[key],[field]:typeof value==="function"?value(Boolean(previous[key][field])):value}}));
}
const lmin=materialAppearance.collapsed,rmin=layerAppearance.collapsed,lex=materialAppearance.expanded,rex=layerAppearance.expanded;
const setLmin=(v:boolean|((p:boolean)=>boolean))=>setDock("materials","collapsed",v),setRmin=(v:boolean|((p:boolean)=>boolean))=>setDock("layers","collapsed",v);
const setLex=(v:boolean|((p:boolean)=>boolean))=>setDock("materials","expanded",v),setRex=(v:boolean|((p:boolean)=>boolean))=>setDock("layers","expanded",v);
const lop=materialAppearance.opacity,rop=layerAppearance.opacity,lscale=materialAppearance.size,rscale=layerAppearance.size;
const setLop=(v:number)=>setDock("materials","opacity",v),setRop=(v:number)=>setDock("layers","opacity",v),setLscale=(v:number)=>setDock("materials","size",v),setRscale=(v:number)=>setDock("layers","size",v);
const [focusMode,setFocusMode]=useState(false),[cleanMode,setCleanMode]=useState(false);
const [layerLocal,setLayerLocal]=useState<Record<string,{opacity?:number;isVisible?:boolean}>>({});
const [selectedLayerKey,setSelectedLayerKey]=useState("reference");
const [samplingError,setSamplingError]=useState<string|null>(null);
const sampleSaving=useRef(false);
const [layerOrder,setLayerOrder]=useState<string[]|null>(null);
const [layerBusy,setLayerBusy]=useState(false),layerSaving=useRef(false);
const [mode,setMode]=useState<"tonal"|"color">("tonal"),[sampler,setSampler]=useState(false),[sample,setSample]=useState<Sample|null>(null),[referenceDraft,setReferenceDraft]=useState<ReferenceDraft|null>(null);
const [directQuantity,setDirectQuantity]=useState("1");
const [sheet,setSheet]=useState<Sheet>(null),[ink,setInk]=useState<Material|null>(null),[note,setNote]=useState("");
const [recipeDropsPerMl,setRecipeDropsPerMl]=useState(SESSION_DROPS_PER_ML);
const DROP=1/recipeDropsPerMl;
const [cup,setCup]=useState<Cup|null>(null),[ings,setIngs]=useState<Ingredient[]>([]),[familyFilter,setFamilyFilter]=useState<string|null>(null);
const [undoStack,setUndoStack]=useState<StockAction[]>([]),[redoStack,setRedoStack]=useState<StockAction[]>([]),[flash,setFlash]=useState<string|null>(null);
const [photoTarget,setPhotoTarget]=useState<PhotoTarget|null>(null),[photoSrc,setPhotoSrc]=useState<string|null>(null);
const [newLayerType,setNewLayerType]=useState<"contrast"|"stencil"|"stencil_overlay"|"image">("contrast"),[newLayerName,setNewLayerName]=useState("Contraste");
const finalInput=useRef<HTMLInputElement>(null),referenceInput=useRef<HTMLInputElement>(null),colorPhotoInput=useRef<HTMLInputElement>(null),layerImageInput=useRef<HTMLInputElement>(null),cockpitRoot=useRef<HTMLDivElement>(null);
// Fixed panels must follow the visual viewport inside Safari's in-app browser.
const [viewport,setViewport]=useState<CSSProperties>({});
useEffect(()=>{
  const visual=window.visualViewport;
  const sync=()=>setViewport({width:visual?.width??window.innerWidth,height:visual?.height??window.innerHeight,left:visual?.offsetLeft??0,top:visual?.offsetTop??0,right:"auto",bottom:"auto"});
  sync();visual?.addEventListener("resize",sync);visual?.addEventListener("scroll",sync);window.addEventListener("resize",sync);
  return()=>{visual?.removeEventListener("resize",sync);visual?.removeEventListener("scroll",sync);window.removeEventListener("resize",sync)};
},[]);
const stage=useRef<HTMLDivElement>(null),layerImages=useRef(new Map<string,HTMLImageElement>()),pts=useRef(new Map<number,{x:number;y:number}>());
const start=useRef<View|null>(null),pstart=useRef<{x:number;y:number}|null>(null),base=useRef<{v:View;d:number;a:number;m:{x:number;y:number}}|null>(null),multiTouch=useRef(false),samplerPointerActive=useRef(false),samplePointerId=useRef<number|null>(null),interactionMode=useRef<"idle"|"sample"|"transform">("idle");

const samples:Sample[]=useMemo(()=>((sampleQuery.data||[]) as any[]).map(s=>({source:s.source,id:String(s.id),code:s.code,hex:s.hex,rgb:[s.red,s.green,s.blue],cmyk:[s.cyan,s.magenta,s.yellow,s.black],lab:[Number(s.labL||0),Number(s.labA||0),Number(s.labB||0)],xPct:Number(s.xPct),yPct:Number(s.yPct)})),[sampleQuery.data]);
useEffect(()=>{if(preparationQuery.data?.preparation?.colors.length)setMode("color")},[preparationQuery.data?.preparation]);
const recipes=(recipeQuery.data||[]) as any[];
const visualLayers=(visualLayerQuery.data||[]) as any[];
const referenceLayer=visualLayers.find(l=>l.layerKey==="reference");
const refOn=layerLocal.reference?.isVisible??Boolean(referenceLayer?.isVisible??true);
const layerVisible=(layer:any)=>layerLocal[String(layer.layerKey)]?.isVisible??Boolean(layer.isVisible);
const layerOpacity=(layer:any)=>layerLocal[String(layer.layerKey)]?.opacity??Number(layer.opacity??100);
const selectedLayer=visualLayers.find(layer=>layer.layerKey===selectedLayerKey);
const selectedImageKey=selectedLayer?.imageKey??null;
const selectedImageUrl=selectedLayer?.imageUrl??null;
const selectedVisible=selectedLayer?layerVisible(selectedLayer)&&layerOpacity(selectedLayer)>0:false;
const canSampleSelected=!!selectedLayer&&selectedLayer.layerKey!=="samples"&&selectedVisible&&!!selectedImageUrl;
const [stageSize,setStageSize]=useState({width:0,height:0});
useEffect(()=>{
  const node=stage.current;if(!node)return;
  const update=()=>setStageSize({width:node.clientWidth,height:node.clientHeight});
  const observer=new ResizeObserver(update);observer.observe(node);update();return()=>observer.disconnect();
},[proc?.id]);
useEffect(()=>{setReferenceDraft(null);setSamplingError(null)},[selectedLayerKey,selectedImageKey,selectedImageUrl,selectedVisible]);
function selectLayer(key:string){setSelectedLayerKey(key);setReferenceDraft(null);setSamplingError(null)}
function samplePosition(s:Sample){
  return s.source&&stageSize.width&&stageSize.height?imageSampleMarker(s.source.imageXPct,s.source.imageYPct,s.source.width,s.source.height,stageSize.width,stageSize.height):s;
}

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

async function persistLayer(layerKey:string,patch:{name?:string;opacity?:number;isVisible?:boolean}){
  if(layerSaving.current)return false;
  const current=visualLayers.find(layer=>layer.layerKey===layerKey);
  if(current&&Object.entries(patch).every(([key,value])=>key==="isVisible"?Boolean(current[key])===value:key==="name"?current[key]===value:Number(current[key])===value)){
    setLayerLocal(previous=>{const next={...previous};delete next[layerKey];return next});return true;
  }
  layerSaving.current=true;setLayerBusy(true);
  try{
    await updateVisualLayerMutation.mutateAsync({procedureId,layerKey,...patch});
    await utils.pod.session.listVisualLayers.invalidate({procedureId});
    return true;
  }catch(e:any){
    toast.error(e.message||"Não foi possível salvar a camada. O ajuste foi desfeito.");
    return false;
  }finally{
    setLayerLocal(previous=>{const next={...previous};delete next[layerKey];return next});
    layerSaving.current=false;setLayerBusy(false);
  }
}
async function toggleLayer(layerKey:string,next:boolean){
  if(layerSaving.current)return;
  setLayerLocal(previous=>({...previous,[layerKey]:{...previous[layerKey],isVisible:next}}));
  if(layerKey===selectedLayerKey&&!next)setReferenceDraft(null);
  await persistLayer(layerKey,{isVisible:next});
}
async function reorderLayers(keys:string[]){
  if(layerSaving.current||!visualLayers.length)return;
  const expectedKeys=visualLayerStack(visualLayers).map(layer=>String(layer.layerKey));
  if(keys.join("|")===expectedKeys.join("|"))return;
  layerSaving.current=true;setLayerBusy(true);setLayerOrder(keys);
  try{
    await reorderVisualLayersMutation.mutateAsync({procedureId,orderedKeys:keys,expectedKeys});
    await utils.pod.session.listVisualLayers.invalidate({procedureId});
  }catch(e:any){
    toast.error(e.message||"Não foi possível salvar a ordem das camadas.");
    await utils.pod.session.listVisualLayers.invalidate({procedureId});
  }finally{setLayerOrder(null);layerSaving.current=false;setLayerBusy(false)}
}
async function uploadVisualLayer(file:File){
  if(file.size>16*1024*1024)return toast.error("Imagem acima de 16 MB.");
  if(!file.type.startsWith("image/"))return toast.error("Selecione um arquivo de imagem.");
  const b64=await new Promise<string>((resolve,reject)=>{const r=new FileReader();r.onerror=()=>reject(r.error);r.onload=()=>resolve(String(r.result).split(",")[1]||"");r.readAsDataURL(file)});
  try{
    const uploaded=await uploadImage.mutateAsync({procedureId,imageBase64:b64,mimeType:file.type||"image/jpeg",imageType:"other",description:"Camada visual: "+newLayerName});
    await addVisualLayerMutation.mutateAsync({procedureId,name:newLayerName.trim()||"Nova camada",layerType:newLayerType,imageUrl:String(uploaded.imageUrl),imageKey:String(uploaded.imageKey),opacity:100});
    await utils.pod.session.listVisualLayers.invalidate({procedureId});
    setSheet(null);toast.success("Camada adicionada à sessão.");
  }catch(e:any){toast.error(e.message||"Não foi possível adicionar a camada.")}
}
async function removeLayer(layer:any){
  if(!window.confirm("Remover a camada “"+layer.name+"”?"))return;
  try{await removeVisualLayerMutation.mutateAsync({procedureId,layerKey:String(layer.layerKey)});await utils.pod.session.listVisualLayers.invalidate({procedureId});toast.success("Camada removida.")}catch(e:any){toast.error(e.message||"Não foi possível remover a camada.")}
}
const stockActionPending=useRef(false);
const retryKeys=useRef(new Map<string,string>());
function stockRequestId(key:string){const id=retryKeys.current.get(key)||crypto.randomUUID();retryKeys.current.set(key,id);return id}
async function quickConsume(m:Material,quantity:string,label?:string){
  if(stockActionPending.current||props.finished)return;stockActionPending.current=true;
  try{const key=JSON.stringify(["consume",procedureId,m.id,quantity]);const r=await consumeAuto.mutateAsync({procedureId,tenantMaterialId:Number(m.id),quantity,expectedUnit:m.unit,requestId:stockRequestId(key)});retryKeys.current.delete(key);pushAction({kind:"consumption",consumptionId:r.id,materialId:Number(m.id),quantity,label:label||m.name,unit:m.unit});setSheet(null);await refreshAll()}
  catch(e:any){toast.error(e.message||"Falha ao consumir material.")}finally{stockActionPending.current=false}
}
function useMat(m:Material){
  try{validateSessionUnit(m)}catch(e:any){toast.error(e.message);return}
  setInk(m);setDirectQuantity((m.kind==="ink"||m.kind==="diluent")?inkStockQuantity(m.unit,1,"drops","M"):m.kind==="ointment"?"":"1");setSheet("ink");
}
function setIng(mid:string,n:number){setIngs(a=>n<=0?a.filter(x=>x.materialId!==mid):a.some(x=>x.materialId===mid)?a.map(x=>x.materialId===mid?{...x,drops:n}:x):[...a,{materialId:mid,drops:n}])}
function recipe(seed?:Material){setRecipeDropsPerMl(SESSION_DROPS_PER_ML);setCup(null);setIngs(seed?[{materialId:seed.id,drops:1}]:[]);setRecipeCupMaterialId("");setSheet("recipe")}
const [recipeCupMaterialId,setRecipeCupMaterialId]=useState<string>("");


async function saveRecipe(){
  if(stockActionPending.current)return;
  const drops=ings.reduce((a,b)=>a+b.drops,0),ml=drops*DROP;if(!drops)return toast.error("Adicione tinta ou diluente.");if(cup&&ml>CUP[cup])return toast.error("Mistura maior que a capacidade do batoque.");
  const payload={procedureId,sampleId:sample?Number(sample.id):undefined,cupSize:cup,dropsPerMl:recipeDropsPerMl,cupTenantMaterialId:recipeCupMaterialId?Number(recipeCupMaterialId):undefined,ingredients:ings.map(i=>({tenantMaterialId:Number(i.materialId),drops:i.drops}))};
  try{stockActionPending.current=true;const key=JSON.stringify(["recipe",payload]);const r=await saveRecipeMutation.mutateAsync({...payload,requestId:stockRequestId(key)});retryKeys.current.delete(key);pushAction({kind:"recipe",recipeId:r.id,label:r.code+" · "+drops+" gotas",payload});setSheet(null);await refreshAll();toast.success(r.code+" salva com baixa transacional no estoque.")}
  catch(e:any){toast.error(e.message||"Não foi possível salvar a mistura.")}finally{stockActionPending.current=false}
}

async function undoStock(){
  const a=undoStack[undoStack.length-1];if(!a||stockActionPending.current)return;
  stockActionPending.current=true;
  try{
    if(a.kind==="recipe")await revertRecipeMutation.mutateAsync({recipeId:a.recipeId,reason:"Desfeito pelo Cockpit V2"});
    else await revert.mutateAsync({consumptionId:a.consumptionId,reason:"Desfeito pelo Cockpit V2"});
    setUndoStack(x=>x.slice(0,-1));setRedoStack(x=>[a,...x]);setFlash(null);await refreshAll();toast.success(a.kind==="recipe"?"Mistura desfeita e saldos restaurados.":"Consumo desfeito e saldo restaurado.");
  }catch(e:any){toast.error(e.message||"Não foi possível desfazer.")}finally{stockActionPending.current=false}
}
async function redoStock(){
  const a=redoStack[0];if(!a||stockActionPending.current||props.finished)return;
  stockActionPending.current=true;
  const key=JSON.stringify(["redo",procedureId,a]);
  try{
    if(a.kind==="recipe"){const r=await saveRecipeMutation.mutateAsync({...a.payload,requestId:stockRequestId(key)});const next:RecipeAction={...a,recipeId:r.id,label:r.code+" · "+a.payload.ingredients.reduce((s,i)=>s+i.drops,0)+" gotas"};setUndoStack(x=>[...x,next])}
    else{const r=await consumeAuto.mutateAsync({procedureId,tenantMaterialId:a.materialId,quantity:a.quantity,expectedUnit:a.unit,requestId:stockRequestId(key)});setUndoStack(x=>[...x,{...a,consumptionId:r.id}])}
    retryKeys.current.delete(key);setRedoStack(x=>x.slice(1));await refreshAll();toast.success("Ação refeita.");
  }catch(e:any){toast.error(e.message||"Não foi possível refazer.")}finally{stockActionPending.current=false}
}

function readSelectedLayerAt(cx:number,cy:number){
  if(sampleSaving.current)return null;
  const s=stage.current,im=layerImages.current.get(selectedLayerKey);
  if(!s||!im||!im.complete||!im.naturalWidth||!canSampleSelected||samples.length>=30){setReferenceDraft(null);return null}
  const point=imageSamplePoint({x:cx,y:cy},s.getBoundingClientRect(),{width:im.naturalWidth,height:im.naturalHeight},vr.current);
  if(!point){setReferenceDraft(null);setSamplingError(null);return null}
  const region=samplePixelRegion(point.pixelX,point.pixelY,im.naturalWidth,im.naturalHeight);
  const canvas=document.createElement("canvas");canvas.width=region.width;canvas.height=region.height;
  const context=canvas.getContext("2d",{willReadFrequently:true});if(!context)return null;
  try{
    context.imageSmoothingEnabled=false;
    context.drawImage(im,region.left,region.top,region.width,region.height,0,0,region.width,region.height);
    const rgb=averageSamplePixels(context.getImageData(0,0,region.width,region.height).data);
    if(!rgb){setReferenceDraft(null);setSamplingError("Este ponto é transparente. Escolha uma área com cor.");return null}
    const [R,G,B]=rgb,CMYK=cmyk(R,G,B),LAB=lab(R,G,B);
    const source:SampleSource={layerKey:selectedLayerKey,layerName:String(selectedLayer.name),imageKey:selectedImageKey,imageXPct:point.imageXPct,imageYPct:point.imageYPct,width:im.naturalWidth,height:im.naturalHeight};
    const draft:ReferenceDraft={hex:hex(R,G,B),red:R,green:G,blue:B,cyan:CMYK[0],magenta:CMYK[1],yellow:CMYK[2],black:CMYK[3],labL:LAB[0],labA:LAB[1],labB:LAB[2],xPct:point.xPct,yPct:point.yPct,source,requestId:crypto.randomUUID()};
    setReferenceDraft(draft);setSamplingError(null);return draft;
  }catch{setReferenceDraft(null);setSamplingError("Não foi possível ler os pixels desta imagem. Reenvie o arquivo para esta camada.");return null}
}
function stopSampling(){setSampler(false);setReferenceDraft(null);setSamplingError(null)}
function startSampling(){
  if(samples.length>=30){toast.info("Limite de 30 amostras atingido.");return;}
  if(!canSampleSelected){toast.info("Selecione uma camada de imagem visível para coletar cores.");return;}
  setMode("color");setReferenceDraft(null);setSamplingError(null);setSampler(true);
}
function toggleSampling(){if(sampler)stopSampling();else startSampling();}
async function confirmReferenceSample(){
  const x=referenceDraft;
  if(!x||sampleSaving.current||!canSampleSelected||x.source.layerKey!==selectedLayerKey||x.source.imageKey!==selectedImageKey)return;
  sampleSaving.current=true;
  try{
    const saved=await saveSampleMutation.mutateAsync({procedureId,hex:x.hex,red:x.red,green:x.green,blue:x.blue,cyan:x.cyan,magenta:x.magenta,yellow:x.yellow,black:x.black,labL:x.labL,labA:x.labA,labB:x.labB,xPct:x.xPct,yPct:x.yPct,sampleSize:5,requestId:x.requestId,source:{layerKey:x.source.layerKey,imageKey:x.source.imageKey,imageXPct:x.source.imageXPct,imageYPct:x.source.imageYPct,width:x.source.width,height:x.source.height}});
    const s:Sample={source:saved.source,id:String(saved.id),code:saved.code,hex:x.hex,rgb:[x.red,x.green,x.blue],cmyk:[x.cyan,x.magenta,x.yellow,x.black],lab:[x.labL,x.labA,x.labB],xPct:x.xPct,yPct:x.yPct};
    setSample(s);setReferenceDraft(null);setMode("color");
    toast.success(saved.code+" salva. O conta-gotas continua ligado.");
    await utils.pod.session.listColorSamples.invalidate({procedureId});
  }catch(e:any){toast.error(e.message||"Não foi possível salvar essa cor.")}finally{sampleSaving.current=false}
}
function isControl(target:EventTarget|null){
  return target instanceof Element && Boolean(target.closest("button,input,textarea,select,a,[role=button],.reference-sampler-card"));
}
function down(e:RP<HTMLDivElement>){
  if(isControl(e.target)||sampleSaving.current)return;
  if(e.pointerType==="mouse"&&e.button!==0)return;
  e.preventDefault();e.stopPropagation();
  e.currentTarget.setPointerCapture(e.pointerId);
  pts.current.set(e.pointerId,{x:e.clientX,y:e.clientY});

  if(sampler&&pts.current.size===1){
    interactionMode.current="sample";
    samplePointerId.current=e.pointerId;
    samplerPointerActive.current=true;
    multiTouch.current=false;
    start.current=null;
    pstart.current={x:e.clientX,y:e.clientY};
    base.current=null;
    readSelectedLayerAt(e.clientX,e.clientY);
    return;
  }

  if(pts.current.size===2){
    interactionMode.current="transform";
    multiTouch.current=true;
    samplerPointerActive.current=false;
    samplePointerId.current=null;
    const[a,b]=Array.from(pts.current.values());
    base.current={v:vr.current,d:Math.hypot(b.x-a.x,b.y-a.y),a:Math.atan2(b.y-a.y,b.x-a.x),m:{x:(a.x+b.x)/2,y:(a.y+b.y)/2}};
    start.current=vr.current;
    return;
  }

  if(!sampler&&pts.current.size===1){
    interactionMode.current="transform";
    start.current=vr.current;
    pstart.current={x:e.clientX,y:e.clientY};
  }
}
function move(e:RP<HTMLDivElement>){
  if(!pts.current.has(e.pointerId))return;
  e.preventDefault();e.stopPropagation();
  pts.current.set(e.pointerId,{x:e.clientX,y:e.clientY});
  const p=Array.from(pts.current.values());

  if(sampler&&interactionMode.current==="sample"){
    if(p.length===1&&e.pointerId===samplePointerId.current){
      readSelectedLayerAt(e.clientX,e.clientY);
    }
    return;
  }

  if(interactionMode.current!=="transform")return;

  if(p.length===2&&base.current){
    const[a,b]=p,z=base.current,d=Math.hypot(b.x-a.x,b.y-a.y),ang=Math.atan2(b.y-a.y,b.x-a.x),m={x:(a.x+b.x)/2,y:(a.y+b.y)/2};
    setView({...z.v,scale:Math.max(.2,Math.min(5,z.v.scale*d/z.d)),rotation:z.v.rotation+(ang-z.a)*180/Math.PI,x:z.v.x+m.x-z.m.x,y:z.v.y+m.y-z.m.y});
    return;
  }

  if(!sampler&&p.length===1&&start.current&&pstart.current){
    setView({...start.current,x:start.current.x+e.clientX-pstart.current.x,y:start.current.y+e.clientY-pstart.current.y});
  }
}
function up(e:RP<HTMLDivElement>){
  if(!pts.current.has(e.pointerId))return;
  if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);
  e.preventDefault();e.stopPropagation();
  pts.current.delete(e.pointerId);

  if(e.pointerId===samplePointerId.current){
    samplePointerId.current=null;
    samplerPointerActive.current=false;
  }

  if(pts.current.size===0){
    if(interactionMode.current==="transform"&&start.current&&JSON.stringify(start.current)!==JSON.stringify(vr.current)){
      setVu(h=>[...h,start.current!]);setVredo([]);
    }
    interactionMode.current="idle";
    start.current=null;pstart.current=null;base.current=null;multiTouch.current=false;samplerPointerActive.current=false;samplePointerId.current=null;
    return;
  }

  // In sampler mode, after a two-finger gesture require a fresh touch before sampling again.
  if(sampler&&pts.current.size===1){
    interactionMode.current="idle";
    base.current=null;
    start.current=null;
    pstart.current=null;
    samplePointerId.current=null;
    samplerPointerActive.current=false;
  }
}
function wheel(e:RW<HTMLDivElement>){if(isControl(e.target))return;e.preventDefault();if(interactionMode.current==="sample")return;if(sampler&&!e.ctrlKey)return;vset({...vr.current,scale:Math.max(.2,Math.min(5,vr.current.scale*(e.deltaY<0?1.08:.92)))})}
useEffect(()=>{const el=stage.current as any;if(!el)return;let st:View|null=null;
      const a=(e:any)=>{if(isControl(e.target))return;e.preventDefault();if(sampler&&interactionMode.current==="sample")return;if(pts.current.size===1)return;interactionMode.current="transform";st={...vr.current}};
      const b=(e:any)=>{if(isControl(e.target))return;e.preventDefault();if(!st||interactionMode.current!=="transform")return;setView({...st,scale:Math.max(.2,Math.min(5,st.scale*(e.scale||1))),rotation:st.rotation+(e.rotation||0)})};
      const end=(e:any)=>{if(isControl(e.target))return;e.preventDefault();if(st){setVu(h=>[...h,st!]);setVredo([])}st=null;if(pts.current.size===0)interactionMode.current="idle"};
      el.addEventListener("gesturestart",a,{passive:false});el.addEventListener("gesturechange",b,{passive:false});el.addEventListener("gestureend",end,{passive:false});
      return()=>{el.removeEventListener("gesturestart",a);el.removeEventListener("gesturechange",b);el.removeEventListener("gestureend",end)}
    },[sampler]);

const timerLabel=props.running?"Pausar sessão":props.started?"Retomar sessão":"Iniciar sessão";
const startSessionAction=!props.finished&&!props.running?<div className="sheet-actions"><button type="button" className="primary" disabled={props.timerBusy} onClick={()=>{toggleTimer();setSheet(null)}}><Play size={16}/> {props.timerBusy?"Aguarde…":timerLabel}</button></div>:null;
function toggleTimer(){if(!props.finished&&!props.timerBusy)props.onTimer()}
async function saveNotes(){try{await updateProcedure.mutateAsync({id:procedureId,notes:note});setSheet(null);toast.success("Notas salvas na sessão.")}catch(e:any){toast.error(e.message)}}
function openColorPhoto(target:PhotoTarget){setPhotoTarget(target);colorPhotoInput.current?.click()}
function closeColorPhoto(){if(photoSrc)URL.revokeObjectURL(photoSrc);setPhotoSrc(null);setPhotoTarget(null)}
async function confirmTemporaryColor(color:ColorValue){
  if(!photoTarget)return;
  try{
    if(photoTarget.kind==="material"){
      await saveMaterialColorMutation.mutateAsync({tenantMaterialId:photoTarget.materialId,artistId:props.artistId??proc?.artistId??undefined,source:"photo",color});
      await utils.pod.inventory.materialColorSamples.invalidate({artistId:props.artistId??proc?.artistId??undefined});
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
    await toggleLayer("reference",true);
    setView(V0);
    toast.success("Referência principal atualizada.");
  }catch(e:any){
    toast.error(e.message||"Não foi possível enviar a referência.");
  }
}

async function finalPhoto(file:File){if(file.size>16*1024*1024)return toast.error("Foto acima de 16 MB.");const b64=await new Promise<string>((resolve,reject)=>{const r=new FileReader();r.onerror=()=>reject(r.error);r.onload=()=>resolve(String(r.result).split(",")[1]||"");r.readAsDataURL(file)});try{await uploadImage.mutateAsync({procedureId,imageBase64:b64,mimeType:file.type||"image/jpeg",imageType:"final"});await utils.pod.session.get.invalidate({procedureId});toast.success("Foto final arquivada na sessão.")}catch(e:any){toast.error(e.message)}}
if(session.isLoading||!proc)return <div className="cockpit-lab" style={{display:"grid",placeItems:"center"}}>Abrindo sessão…</div>;

const panel=(o:number,s:number,side:"left"|"right")=>({"--panel-alpha":o,"--dock-scale":s} as CSSProperties);
const drops=ings.reduce((a,b)=>a+b.drops,0),ml=drops*DROP,pct=cup?Math.round(ml/CUP[cup]*100):0,cupDropCapacity=cup?Math.floor(CUP[cup]/DROP):Infinity,ingredientLimit=500;
const refSrc=proc.referenceImageUrl?String(proc.referenceImageUrl):(props.originalSrc?String(props.originalSrc):null);
const canvasRefSrc=canvasSafeSource(refSrc);
const stackLayers=visualLayerStack(visualLayers.length?visualLayers:[
  {layerKey:"reference",name:"Referência principal",layerType:"reference",imageUrl:refSrc,opacity:100,isVisible:1,sortOrder:0},
  {layerKey:"samples",name:"Amostras de cor",layerType:"samples",imageUrl:null,opacity:100,isVisible:1,sortOrder:900},
]);
const panelLayers=layerOrder?layerOrder.map(key=>stackLayers.find(layer=>layer.layerKey===key)).filter(Boolean):stackLayers;
const orderedLayers=[...panelLayers].reverse();

return createPortal(<div style={{...viewport,"--tools-alpha":toolAppearance.opacity,"--tools-size":toolAppearance.size,"--palette-alpha":paletteAppearance.opacity,"--palette-size":paletteAppearance.size} as CSSProperties} ref={cockpitRoot} className={"cockpit-lab "+(focusMode?"focus-mode ":"")+(cleanMode?"clean-mode ":"")+(sampler?"sampling-mode":"")}>
<header className="cockpit-top">
<button type="button" aria-label="Voltar à sessão" className="cockpit-icon" onClick={props.onClose}><ArrowLeft size={18}/></button>
<button className="cockpit-icon" onClick={vundo} disabled={!vu.length} title="Desfazer imagem"><Undo2 size={18}/></button><button className="cockpit-icon" onClick={vred} disabled={!vredo.length} title="Refazer imagem"><Redo2 size={18}/></button>
<div className="cockpit-client"><strong>{client.data?.name||"Cliente"}</strong><small>{props.title} {proc.bodyLocation?"· "+proc.bodyLocation:""}</small></div>
<button type="button" className="cockpit-icon" aria-label="Preferências visuais" title="Preferências visuais" onClick={()=>setSheet("appearance")}><Settings2 size={18}/></button>
<button className="cockpit-icon desktop-only" onClick={()=>{setNote(String(proc.notes||""));setSheet("notes")}}><StickyNote size={17}/></button><div className="cockpit-status"><i/><b>{props.elapsed}</b><span>{props.finished?"CONCLUÍDA":props.running?"EM ANDAMENTO":props.started?"PAUSADA":"NÃO INICIADA"}</span></div>
</header>
{focusMode&&<><div className="focus-timer"><span className="cockpit-status"><i/><b>{props.elapsed}</b><span>{props.finished?"CONCLUÍDA":props.running?"EM ANDAMENTO":props.started?"PAUSADA":"NÃO INICIADA"}</span></span></div><div className="focus-toolbar">
  <button type="button" aria-label="Preferências visuais" title="Preferências visuais" onClick={()=>setSheet("appearance")}><Settings2 size={17}/></button>
  <button onClick={()=>void exitFocusMode()} title="Sair do modo foco"><Minimize2 size={17}/><span>Sair</span></button>
  <button className={cleanMode?"active":""} onClick={()=>setCleanMode(v=>!v)} title={cleanMode?"Mostrar painéis":"Imagem limpa"}>{cleanMode?<Eye size={17}/>:<EyeOff size={17}/>}<span>{cleanMode?"Painéis":"Limpar"}</span></button>
</div></>}

<main ref={stage} className="cockpit-stage" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onWheel={wheel}>
<div className="cockpit-anamnese">Sessão #{procedureId}</div>
<div className="cockpit-view-quick"><button type="button" aria-label="Restaurar imagem" onClick={()=>vset(V0)}>{Math.round(view.scale*100)}%</button><button type="button" aria-label="Girar imagem à esquerda" onClick={()=>vset({...vr.current,rotation:vr.current.rotation-15})}><RotateCcw size={15}/></button><button type="button" aria-label="Girar imagem à direita" onClick={()=>vset({...vr.current,rotation:vr.current.rotation+15})}><RotateCw size={15}/></button></div><button className="focus-entry-button" onClick={()=>void enterFocusMode()} title="Abrir modo foco"><Maximize2 size={16}/><span>FOCO</span></button>
<div className="cockpit-transform" style={{transform:"translate("+view.x+"px,"+view.y+"px) rotate("+view.rotation+"deg) scale("+view.scale+")"}}>
{orderedLayers.map((layer:any,index:number)=>{
  if(!layerVisible(layer))return null;
  if(layer.layerKey==="reference"){
    return canvasRefSrc?<img key="reference" ref={node=>{if(node)layerImages.current.set("reference",node);else layerImages.current.delete("reference")}} src={canvasRefSrc} className="cockpit-reference cockpit-layer-image" style={{opacity:layerOpacity(layer)/100,zIndex:index}} alt="Referência"/>:null;
  }
  if(layer.layerKey==="samples"){
    return <div key="samples" className="cockpit-sample-layer" style={{opacity:layerOpacity(layer)/100,zIndex:index}}>{samples.filter(s=>!s.code.startsWith("P")).map(s=><span key={s.id} className="sample-marker" data-code={s.code} style={{left:samplePosition(s).xPct+"%",top:samplePosition(s).yPct+"%",background:s.hex}}/>)}</div>;
  }
  const src=canvasSafeSource(layer.imageUrl);
  return src?<img key={layer.layerKey} ref={node=>{if(node)layerImages.current.set(String(layer.layerKey),node);else layerImages.current.delete(String(layer.layerKey))}} src={src} className="cockpit-reference cockpit-layer-image" style={{opacity:layerOpacity(layer)/100,zIndex:index}} alt={layer.name}/>:null;
})}
{referenceDraft&&<span className="reference-draft-marker" style={{left:referenceDraft.xPct+"%",top:referenceDraft.yPct+"%",background:referenceDraft.hex,zIndex:orderedLayers.length}}/>}
</div>
{refOn&&!canvasRefSrc&&<div className="cockpit-empty" style={{pointerEvents:"auto"}}>
  <div><div style={{marginBottom:10}}>Nenhuma referência anexada</div><button className="dock-add" style={{padding:"0 16px"}} onPointerDown={e=>e.stopPropagation()} onClick={e=>{e.stopPropagation();referenceInput.current?.click()}}><Plus size={16}/> Adicionar referência</button></div>
</div>}
{sampler&&!referenceDraft&&<div className="sampler-instruction" role="status"><Pipette size={16}/><span>{samplingError||(!canSampleSelected?"Selecione uma camada de imagem visível.":samples.length>=30?"Limite de 30 amostras atingido.":`Coletando de ${selectedLayer.name} · pressione e arraste para escolher a cor`)}</span></div>}
{sampler&&referenceDraft&&<div className="reference-sampler-card" onPointerDown={e=>e.stopPropagation()}>
  <div className="preview" style={{background:referenceDraft.hex}}/>
  <div className="reference-sampler-info"><strong>{referenceDraft.source.layerName} · amostra 5×5 px</strong><small>Cor original da camada selecionada</small><small>{referenceDraft.hex.toUpperCase()} · RGB {referenceDraft.red}/{referenceDraft.green}/{referenceDraft.blue}</small><small>CMYK {referenceDraft.cyan}/{referenceDraft.magenta}/{referenceDraft.yellow}/{referenceDraft.black} · LAB {referenceDraft.labL.toFixed(1)} {referenceDraft.labA.toFixed(1)} {referenceDraft.labB.toFixed(1)}</small></div>
  <div className="reference-sampler-actions">
  <button disabled={saveSampleMutation.isPending} onClick={()=>setReferenceDraft(null)}>Descartar ponto</button>
  <button className="primary" disabled={saveSampleMutation.isPending} onClick={()=>void confirmReferenceSample()}>{saveSampleMutation.isPending?"Salvando…":"Salvar amostra"}</button>
  </div>
</div>}
</main>

<aside className={"cockpit-dock left "+(lmin?"minimized ":"")+(lex?"expanded":"")} style={panel(lop,lscale,"left")}>
<header><button type="button" aria-label={lmin?"Abrir materiais":"Recolher materiais"} onClick={()=>{setLmin(v=>!v);if(lmin&&window.matchMedia("(max-width: 620px)").matches){setLex(true);setRmin(true)}}}>{lmin?<><Package size={18}/><span>Materiais</span></>:<Minus size={16}/>}</button><strong>Materiais</strong><button type="button" aria-label="Expandir ou compactar materiais" onClick={()=>setLex(v=>!v)}>{lex?<ChevronLeft size={16}/>:<ChevronRight size={16}/>}</button></header>
<div className="dock-controls"><label>Tamanho <input aria-label="Tamanho do painel de materiais" type="range" min=".85" max="1.35" step=".05" value={lscale} onChange={e=>setLscale(+e.target.value)}/><output>{Math.round(lscale*100)}%</output></label><label>Fundo <input aria-label="Opacidade do painel de materiais" type="range" min=".4" max="1" step=".05" value={lop} onChange={e=>setLop(+e.target.value)}/><output>{Math.round(lop*100)}%</output></label><button type="button" className="save-appearance-link" onClick={()=>setSheet("appearance")}><Settings2 size={13}/> Salvar preferências</button></div>
<div className="dock-body">{mats.map(m=>{
  const symbol=materialSymbol(m),label=materialSymbolLabels[symbol];
  const color=recordedColor(materialColorMap[m.id]?.hex||m.color);
  const linkedCups=m.kind==="cup"?recipes.filter(r=>r.status==="active"&&String(r.cupTenantMaterialId)===m.id).map(r=>({code:r.code,...recipeDisplayColor(r,samples)})):[];
  const description=[m.detail,`Previsto: ${m.plannedQuantity} ${m.unit}`,`Utilizado: ${Number(totals[m.id]||0).toLocaleString("pt-BR",{maximumFractionDigits:3})} ${m.unit}`,m.kind==="ink"?(color?`Cor registrada: ${color}`:"Cor ainda não registrada"):null,...linkedCups.map(c=>`${c.code}: ${c.label}${c.color?" · "+c.color:""}`)].filter(Boolean).join("\n");
  return <SessionMaterialHint key={m.id} title={m.name} description={description} opacity={toolAppearance.opacity}>
    <button disabled={props.finished||consumeAuto.isPending||!stock.some(x=>x.id===m.id)} aria-label={`Registrar consumo de ${m.name}`} className={"material-card "+(totals[m.id]?"active":"")} onClick={()=>useMat(m)}>
      <span className="material-glyph"><SessionMaterialIcon symbol={symbol} color={symbol==="ink"?color:linkedCups.length===1?linkedCups[0].color:undefined}/><span className="material-symbol-label">{label}{m.kind==="cup"&&sessionCupSize(m)?" "+sessionCupSize(m):""}</span></span>
      {lex&&<span className="material-meta"><b>{m.name}</b><small>{`Previsto: ${m.plannedQuantity} ${m.unit}`}</small></span>}
      {linkedCups.length>1&&<span className="material-cup-colors">{linkedCups.map(c=><span key={c.code} aria-label={`${c.code}: ${c.label}`}><SessionMaterialIcon symbol="cup" color={c.color}/><small>{c.code}</small></span>)}</span>}
      {!!totals[m.id]&&<span className="material-count">✓ {Number(totals[m.id]).toLocaleString("pt-BR",{maximumFractionDigits:3})} {m.unit}</span>}
    </button>
  </SessionMaterialHint>;
})}<button className="dock-add" onClick={()=>setSheet("materials")}><Plus size={18}/>{lex&&" Adicionar"}</button></div>
<div className="dock-undo"><button onClick={()=>void undoStock()} disabled={!undoStack.length}><Undo2 size={16}/></button><button onClick={()=>void redoStock()} disabled={!redoStack.length}><Redo2 size={16}/></button></div>
</aside>

<aside className={"cockpit-dock right "+(rmin?"minimized ":"")+(rex?"expanded":"")} style={panel(rop,rscale,"right")}>
<header><button type="button" aria-label={rmin?"Abrir camadas":"Recolher camadas"} onClick={()=>{setRmin(v=>!v);if(rmin&&window.matchMedia("(max-width: 620px)").matches){setRex(true);setLmin(true)}}}>{rmin?<><Layers3 size={18}/><span>Camadas</span></>:<Minus size={16}/>}</button><strong>Camadas</strong><button type="button" aria-label="Expandir ou compactar camadas" onClick={()=>setRex(v=>!v)}>{rex?<ChevronRight size={16}/>:<ChevronLeft size={16}/>}</button></header>
<div className="dock-controls"><label>Tamanho <input aria-label="Tamanho do painel de camadas" type="range" min=".85" max="1.35" step=".05" value={rscale} onChange={e=>setRscale(+e.target.value)}/><output>{Math.round(rscale*100)}%</output></label><label>Fundo <input aria-label="Opacidade do painel de camadas" type="range" min=".4" max="1" step=".05" value={rop} onChange={e=>setRop(+e.target.value)}/><output>{Math.round(rop*100)}%</output></label><button type="button" className="save-appearance-link" onClick={()=>setSheet("appearance")}><Settings2 size={13}/> Salvar preferências</button></div>
<div className="dock-body"><SessionLayerPanel
  layers={panelLayers.map((layer:any)=>({layerKey:String(layer.layerKey),name:String(layer.name),src:layer.layerKey==="reference"?canvasRefSrc:layer.layerKey==="samples"?null:canvasSafeSource(layer.imageUrl),opacity:layerOpacity(layer),visible:layerVisible(layer)}))}
  busy={layerBusy||visualLayerQuery.isLoading||addVisualLayerMutation.isPending||removeVisualLayerMutation.isPending}
  selected={selectedLayerKey} onSelect={selectLayer} onRename={(key,name)=>persistLayer(key,{name})}
  expanded={rex} onExpand={()=>{setRex(true);if(window.matchMedia("(max-width:620px)").matches)setLmin(true)}}
  onReorder={keys=>void reorderLayers(keys)} onVisibility={(key,visible)=>void toggleLayer(key,visible)}
  onOpacity={(key,opacity)=>setLayerLocal(previous=>({...previous,[key]:{...previous[key],opacity}}))}
  onCommitOpacity={(key,opacity)=>void persistLayer(key,{opacity})}
  onRemove={key=>{const layer=visualLayers.find(layer=>layer.layerKey===key);if(layer)void removeLayer(layer)}}
/>
<button className="dock-add" disabled={layerBusy} aria-label="Adicionar camada" onClick={()=>setSheet("layerAdd")}><Plus size={16}/>{rex&&" Nova camada"}</button>
<button className="dock-add secondary" disabled={layerBusy} aria-label="Trocar referência principal" onClick={()=>referenceInput.current?.click()}><Plus size={16}/>{rex&&(refSrc?" Trocar referência":" Adicionar referência")}</button></div>
</aside>

<div className="cockpit-palette">
  <button className="palette-add" onClick={()=>setMode(mode==="tonal"?"color":"tonal")}><Palette size={13}/>{mode==="tonal"?"Cores":"Tons"}</button>
  {mode==="tonal"?GRAYS.map((g,i)=><button key={g} className="palette-chip" style={{background:g}}><span>T{String(i+1).padStart(2,"0")}</span></button>):samples.map(s=><button key={s.id} className="palette-chip" style={{background:s.hex}} onClick={()=>{setSample(s);setSheet("sample")}}><span>{s.code}</span></button>)}
  <button className={"palette-add "+(sampler?"selected":"")} onClick={toggleSampling} aria-pressed={sampler} disabled={!sampler&&samples.length>=30}><Pipette size={13}/>{sampler?"Desligar conta-gotas":"Conta-gotas"}</button>
</div>{focusMode&&<div className="focus-palette-strip">
  <div className="focus-tonal-gradient" title="Escala de contraste"/>
  <div className="focus-samples">{samples.map(s=><button key={s.id} style={{background:s.hex}} onClick={()=>{setSample(s);setSheet("sample")}} title={s.code}><span>{s.code}</span></button>)}</div>
  <button className={"focus-sampler-button "+(sampler?"active":"")} onClick={toggleSampling} aria-pressed={sampler} disabled={!sampler&&samples.length>=30} aria-label={sampler?"Desligar conta-gotas":"Conta-gotas"} title={sampler?"Desligar conta-gotas":"Amostrar cor"}>{sampler?<X size={15}/>:<Pipette size={15}/>}<span>{sampler?"Encerrar":"Amostrar"}</span></button>
</div>}


{flash&&<div className="cockpit-toast"><Check size={17} color="#10b981"/><span>{flash}</span><button onClick={()=>void undoStock()}>DESFAZER (5s)</button></div>}
<input ref={colorPhotoInput} type="file" accept="image/*" capture="environment" style={{display:"none"}} onChange={e=>{const file=e.target.files?.[0];if(file){if(photoSrc)URL.revokeObjectURL(photoSrc);setPhotoSrc(URL.createObjectURL(file))}e.currentTarget.value=""}}/>
<input ref={layerImageInput} type="file" accept="image/jpeg,image/png,image/webp" style={{display:"none"}} onChange={e=>{const f=e.target.files?.[0];if(f)void uploadVisualLayer(f);e.currentTarget.value=""}}/>
<input ref={referenceInput} type="file" accept="image/jpeg,image/png,image/webp" style={{display:"none"}} onChange={e=>{const f=e.target.files?.[0];if(f)void uploadReference(f);e.currentTarget.value=""}}/>
<input ref={finalInput} type="file" accept="image/*" capture="environment" style={{display:"none"}} onChange={e=>{const f=e.target.files?.[0];if(f)void finalPhoto(f);e.currentTarget.value=""}}/>
<footer className="cockpit-bottom"><button type="button" aria-label={timerLabel} disabled={props.finished||props.timerBusy} onClick={()=>void toggleTimer()}>{props.running?<Pause size={18}/>:<Play size={18}/>}<span className="button-label">{props.running?"PAUSAR":props.started?"RETOMAR":"INICIAR"}</span></button><button type="button" aria-label="Buscar materiais no estoque" onClick={()=>setSheet("materials")}><Package size={18}/><span className="button-label">ESTOQUE</span></button><button type="button" aria-label="Adicionar foto da sessão" onClick={()=>finalInput.current?.click()}><Camera size={18}/><span className="button-label">FOTO</span></button><button type="button" aria-label="Revisar conclusão da sessão" className="finish" onClick={()=>setSheet("finish")}><Square size={17}/><span className="button-label">CONCLUIR</span></button></footer>

{sheet==="appearance"&&<SessionAppearancePanel value={appearance.value} onChange={appearance.change} artistName={appearance.artistName} canSave={appearance.canSave} busy={appearance.busy} dirty={appearance.dirty} onSave={()=>void appearance.save()} onReload={()=>void appearance.reload()} onReset={appearance.reset} onClose={()=>setSheet(null)}/>}
{sheet==="layerAdd"&&<section className="cockpit-sheet"><button type="button" aria-label="Fechar ferramenta" className="close" onClick={()=>setSheet(null)}><X size={17}/></button><h3>Nova camada visual</h3><p>Adicione uma imagem independente. O arquivo será exibido como enviado, sem filtros. Você controla a ordem, a opacidade e a visibilidade.</p>
<div className="sheet-grid">{[
  {type:"contrast",name:"Contraste",desc:"Versão preparada para leitura de contraste"},
  {type:"stencil",name:"Decalque",desc:"Decalque isolado"},
  {type:"stencil_overlay",name:"Decalque sobre referência",desc:"Imagem enviada pelo artista, sem tratamento automático"},
  {type:"image",name:"Camada de imagem",desc:"Qualquer outra imagem de apoio"},
].map((item:any)=><button key={item.type} className={"sheet-option "+(newLayerType===item.type?"selected":"")} onClick={()=>{setNewLayerType(item.type);setNewLayerName(item.name)}}><b>{item.name}</b><small>{item.desc}</small></button>)}</div>
<label className="layer-name-label">Nome da camada</label><input className="search-input" value={newLayerName} onChange={e=>setNewLayerName(e.target.value)} placeholder="Ex.: Contraste PB, Decalque 2..."/>
<div className="sheet-actions"><button onClick={()=>setSheet(null)}>Cancelar</button><button className="primary" disabled={!newLayerName.trim()||addVisualLayerMutation.isPending||uploadImage.isPending} onClick={()=>layerImageInput.current?.click()}><Plus size={15}/> Selecionar imagem</button></div>
</section>}
{sheet==="preparation"&&<section className="cockpit-sheet"><button type="button" aria-label="Fechar preparação" className="close" onClick={()=>setSheet(null)}><X size={17}/></button><h3>Preparação da sessão</h3>{startSessionAction}<SessionPreparationSummary preparation={preparationQuery.data?.preparation} onMaterial={props.finished?undefined:(id,quantity,unit)=>{
  const m=stock.find(x=>Number(x.id)===id&&x.unit===unit);if(!m)return toast.error("Material indisponível para este artista.");setInk(m);setDirectQuantity(quantity);setSheet("ink");
}} onRecipe={props.finished?undefined:index=>{
  const color=preparationQuery.data?.preparation?.colors[index];if(!color)return;
  if(color.ingredients.some(i=>!stock.some(m=>Number(m.id)===i.tenantMaterialId)))return toast.error("Uma tinta está indisponível. Atualize o estoque antes de reutilizar a receita.");
  setSample(samples.find(s=>s.code===`P${String(index+1).padStart(2,"0")}`)||null);setCup(color.cupSize);setRecipeCupMaterialId("");setRecipeDropsPerMl(color.dropsPerMl);setIngs(color.ingredients.map(i=>({materialId:String(i.tenantMaterialId),drops:i.drops})));setFamilyFilter(null);setReferenceDraft(null);setSheet("recipe");
}}/></section>}
{sheet==="materials"&&<section className="cockpit-sheet"><button type="button" aria-label="Fechar ferramenta" className="close" onClick={()=>setSheet(null)}><X size={17}/></button><h3>Adicionar material ativo</h3>{preparationQuery.data?.preparation&&<button className="dock-add" onClick={()=>setSheet("preparation")}>Ver materiais e receitas preparados</button>}<p>Adicionar inclui o material nesta sessão. A baixa acontece ao confirmar a quantidade utilizada.</p><div style={{position:"relative"}}><Search size={16} style={{position:"absolute",left:12,top:14,color:"#71717a"}}/><input className="search-input" style={{paddingLeft:36}} value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar cartucho, tinta, marca..."/></div><details className="session-costs"><summary>Consumo e custos desta sessão</summary><p>Valores registrados no consumo. Cadastros de teste ou preços estimados não comprovam gasto real.</p><p>Total registrado: {new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format((session.data?.consumptions||[]).filter(c=>c.status==='consumido').reduce((sum,c)=>sum+Number(c.totalCostSnapshot),0))}</p>{(session.data?.consumptions||[]).filter(c=>c.status==='consumido').map(c=><article key={c.id}><b>{c.nameSnapshot}</b><p>{Number(c.quantity).toLocaleString('pt-BR')} {c.unitSnapshot} · Lote: {c.lotSnapshot||'não informado'} · {new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(c.totalCostSnapshot))}</p>{Number(c.unitCostSnapshot)===0&&<p>Custo registrado como zero; confira o cadastro do lote.</p>}</article>)}</details><div className="sheet-grid">{found.map(m=><button className="sheet-option" key={m.id} disabled={addMaterial.isPending} onClick={async()=>{try{await addMaterial.mutateAsync({procedureId,tenantMaterialId:Number(m.id)});await refreshAll();setSheet(null);setSearch("")}catch(e:any){toast.error(e.message)}}}><b>{m.name}</b><small>{m.detail} · saldo {(inventory.data as any[])?.find(x=>String(x.id)===m.id)?.currentQuantity} {m.unit}</small></button>)}</div></section>}

{sheet==="ink"&&ink&&<section className="cockpit-sheet"><button type="button" aria-label="Fechar ferramenta" className="close" onClick={()=>setSheet(null)}><X size={17}/></button><h3>{ink.name}</h3>{(readTestMetadata(ink.notes).testStock||readTestMetadata(ink.notes).marketEstimate)&&<p>Este cadastro contém saldo de teste ou preço estimado. Confira a contagem e o custo de compra no estoque antes do uso real.</p>}
<SessionMaterialQuantity key={ink.id} material={ink} value={directQuantity} onChange={setDirectQuantity} materials={stock} onMaterialChange={id=>{const m=stock.find(m=>m.id===id);if(m){setInk(m);setDirectQuantity("1")}}} disabled={consumeAuto.isPending}/>
<div className="sheet-actions">{(ink.kind==="ink"||ink.kind==="diluent")&&<button onClick={()=>recipe(ink)}>Criar mistura</button>}<button className="primary" disabled={consumeAuto.isPending||!Number.isFinite(Number(directQuantity))||Number(directQuantity)<=0} onClick={()=>void quickConsume(ink,directQuantity,ink.name)}>Confirmar uso</button></div></section>}

{sheet==="recipe"&&<section className="cockpit-sheet recipe-sheet"><button type="button" aria-label="Fechar ferramenta" className="close" onClick={()=>setSheet(null)}><X size={17}/></button><h3>Receita {sample?"· "+sample.code:""}</h3><p>Será gravada junto da sessão e das baixas de cada pigmento. Conversão: {recipeDropsPerMl} gotas/ml.</p>
{sample&&<div className="recipe-sample-card">
  <div className="sample-crop" style={{background:sample.hex}}/>
  <div className="recipe-sample-swatch" style={{background:sample.hex}}/>
  <div className="recipe-sample-meta"><strong>{sample.code}</strong><span>{sample.code.startsWith("P")?"Cor preparada antes da sessão":"Referência retirada da imagem"}</span><small>{sample.hex.toUpperCase()} · RGB {sample.rgb.join(" / ")} · CMYK {sample.cmyk.join(" / ")}</small></div>
</div>}
<button className="sheet-option" onClick={()=>{setCup(null);setRecipeCupMaterialId("")}}>Sem recipiente definido</button><div className="sheet-grid cup-grid">{(["P","M","G","GG"] as Cup[]).map(c=><button key={c} className={"sheet-option "+(cup===c?"selected":"")} onClick={()=>{setCup(c);setRecipeCupMaterialId("")}}><b>Batoque {c}</b><small>{CUP[c]} ml · ~{Math.floor(CUP[c]/DROP)} gotas</small></button>)}</div>
{cup&&<><div className="recipe-cup-visual" aria-label={`Batoque ${cup}, capacidade ${CUP[cup]} ml`} style={{width:56+Math.sqrt(CUP[cup])*22,height:42+Math.sqrt(CUP[cup])*18}}><div style={{height:`${Math.min(100,pct)}%`,background:sample?.hex||"#777"}}/></div><p>Cor de referência; confirme o resultado real da mistura.</p><label>Baixar um batoque do estoque (opcional)<select className="search-input" value={recipeCupMaterialId} onChange={e=>setRecipeCupMaterialId(e.target.value)}><option value="">Já separado / não baixar outro</option>{stock.filter(m=>m.kind==="cup"&&sessionCupSize(m)===cup).map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</select></label></>}
<div className="stock-colors-title"><strong>Paleta-base</strong><small>CMYK + Branco</small></div>
<div className="color-family-strip">{COLOR_FAMILIES.map(f=><button key={f.key} className={"color-family-chip "+(familyFilter===f.key?"selected":"")} onClick={()=>setFamilyFilter(v=>v===f.key?null:f.key)}><i style={{background:f.hex}}/><span>{f.label}</span></button>)}</div>
<div className="stock-colors-title"><strong>Cores do estoque</strong><small>{familyFilter?"Filtro "+familyFilter:"Todas as tintas cadastradas"}</small></div>
<div className="mix-ingredients">
{visibleRecipeColors.map(m=>{const row=ings.find(x=>x.materialId===m.id),value=row?.drops??0,stored=materialColorMap[m.id],swatch=m.kind==="diluent"?undefined:stored?.hex||m.color;return <div className="mix-ingredient" key={m.id}>
  <div className="mix-ingredient-head with-swatch">
    <span className={"material-color-square "+(!swatch?"unknown":"")} style={swatch?{background:swatch}:undefined}>{!swatch?"?":""}</span>
    <span className="mix-ingredient-name">{m.name}<small>{m.kind==="diluent"?"Aditivo independente":stored?"Amostra tonal salva":swatch?"Cor cadastrada":"Sem amostra tonal"}</small></span>
    {m.kind!=="diluent"?<button className="material-color-calibrate" title="Fotografar e calibrar a cor desta tinta" onClick={()=>openColorPhoto({kind:"material",materialId:Number(m.id),name:m.name})}><Camera size={16}/></button>:<span aria-hidden="true"/>}
    <div className="mix-number-wrap"><input aria-label={"Gotas de "+m.name} type="number" inputMode="numeric" pattern="[0-9]*" min="1" max={ingredientLimit} placeholder="0" value={row?String(row.drops):""} onFocus={e=>{const el=e.currentTarget.closest(".mix-ingredient");setTimeout(()=>el?.scrollIntoView({block:"center",behavior:"smooth"}),180)}} onChange={e=>{const raw=e.target.value;if(raw==="")return setIng(m.id,0);const n=Math.min(ingredientLimit,Math.max(0,Math.floor(Number(raw)||0)));setIng(m.id,n)}}/><span>gt</span></div>
  </div>
  <input className="mix-drop-slider" aria-label={"Deslizar gotas de "+m.name} type="range" min="0" max={ingredientLimit} step="1" value={value} onChange={e=>setIng(m.id,Number(e.target.value))}/>
  <div className="mix-slider-scale"><span>0</span><span>{value} gotas</span><span>{ingredientLimit}</span></div>
</div>})}
</div>
<div className={"mix-summary mix-summary-sticky "+(drops>cupDropCapacity?"over":"")}><div>Total: {drops}{cup?` / ${cupDropCapacity}`:""} gotas · ~{ml.toFixed(2)} ml</div>{cup?<div>Batoque {cup}: {CUP[cup].toFixed(2)} ml · ocupação ~{pct}%</div>:<div>Composição sem recipiente definido</div>}{drops>cupDropCapacity&&<div className="mix-over-warning">Mistura acima da capacidade do batoque.</div>}{ings.map(i=>{const m=stock.find(x=>x.id===i.materialId);return <div key={i.materialId}>{m?.short}: {i.drops}gt · {drops?((i.drops/drops)*100).toFixed(1):0}%</div>})}</div>
<div className="sheet-actions recipe-actions"><button onClick={()=>setSheet(null)}>Cancelar</button><button className="primary" disabled={saveRecipeMutation.isPending||drops===0||drops>cupDropCapacity} onClick={()=>void saveRecipe()}>Salvar receita + baixar estoque</button></div></section>}

{sheet==="sample"&&sample&&<section className="cockpit-sheet"><button type="button" aria-label="Fechar ferramenta" className="close" onClick={()=>setSheet(null)}><X size={17}/></button><h3>{sample.code} · {sample.code.startsWith("P")?"Cor preparada":"Amostra 5×5 px"}</h3>{!sample.code.startsWith("P")&&<p>Camada de origem: {sample.source?.layerName||"não registrada nesta amostra antiga"}</p>}<div className="sample-detail sample-detail-expanded"><div className="sample-crop large" style={{background:sample.hex}}/><div><div className="sample-swatch compact" style={{background:sample.hex}}/><div className="sample-data"><div>HEX {sample.hex.toUpperCase()}</div><div>RGB {sample.rgb.join(" · ")}</div><div>CMYK {sample.cmyk.map(v=>v+"%").join(" · ")}</div></div></div></div><div className="sheet-actions"><button onClick={()=>{setSheet(null);startSampling()}}>Nova amostra</button><button className="primary" onClick={()=>recipe()}>Criar mistura</button>{sample.code.startsWith("P")&&<button onClick={()=>setSheet("preparation")}>Ver receita preparada</button>}</div>{recipes.filter((r:any)=>String(r.sampleId||"")===sample.id).map((r:any)=><div className="mix-summary" key={r.id}><b>{r.code} · {r.cupSize?`Batoque ${r.cupSize}`:"Sem recipiente"}</b><br/>{r.items?.map((i:any)=>i.nameSnapshot+" "+i.drops+"gt").join(" + ")}<br/>~{Number(r.estimatedMl).toFixed(2)} ml · {r.status==="reverted"?"DESFEITA":"ATIVA"}<div className="recipe-result-line">{r.result?<><span className="result-swatch" style={{background:r.result.hex}}/><span>Resultado {String(r.result.hex).toUpperCase()}<br/>LAB {Number(r.result.labL).toFixed(1)} {Number(r.result.labA).toFixed(1)} {Number(r.result.labB).toFixed(1)}</span></>:<span>Resultado ainda não registrado</span>}<button onClick={()=>openColorPhoto({kind:"recipe",recipeId:r.id,code:r.code})}><Camera size={13}/> {r.result?"Atualizar":"Registrar resultado"}</button></div></div>)}</section>}

{sheet==="notes"&&<section className="cockpit-sheet"><button type="button" aria-label="Fechar ferramenta" className="close" onClick={()=>setSheet(null)}><X size={17}/></button><h3>Notas rápidas</h3><textarea className="cockpit-note" value={note} onChange={e=>setNote(e.target.value)}/><div className="sheet-actions"><button className="primary" disabled={updateProcedure.isPending} onClick={()=>void saveNotes()}>Salvar na sessão</button></div></section>}
{sheet==="finish"&&<section className="cockpit-sheet"><button type="button" aria-label="Fechar ferramenta" className="close" onClick={()=>setSheet(null)}><X size={17}/></button><h3>Revisão antes de concluir</h3>{startSessionAction}<p>A conclusão continua usando o fluxo financeiro já existente da sessão.</p><div className="mix-summary"><div>Tempo: {props.elapsed}</div><div>Consumos ativos: {(session.data?.consumptions||[]).filter((x:any)=>x.status==="consumido").length}</div><div>Misturas: {recipes.filter((r:any)=>r.status!=="reverted").length}</div><div>Amostras: {samples.length}</div><div>Foto final: {proc.finalImageUrl?"✓ anexada":"não anexada"}</div></div><div className="sheet-actions"><button onClick={()=>setSheet(null)}>Voltar</button><button className="primary" onClick={()=>{setSheet(null);props.onFinish()}}>Ir para conclusão da sessão</button></div></section>}
{photoTarget&&photoSrc&&<TemporaryColorSampler src={photoSrc} title={photoTarget.kind==="material"?"Calibrar "+photoTarget.name:"Resultado da mistura "+photoTarget.code} subtitle="Pressione e arraste o ponto. O quadrado superior mostra a cor em tempo real." onCancel={closeColorPhoto} onConfirm={confirmTemporaryColor}/>}
</div>,document.body);
}
