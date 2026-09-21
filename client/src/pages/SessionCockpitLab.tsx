import {useEffect,useMemo,useRef,useState,type CSSProperties,type PointerEvent as RP,type WheelEvent as RW} from "react";
import {ArrowLeft,Home,Undo2,Redo2,Minus,Eye,EyeOff,Plus,Pause,Play,Package,Camera,Square,StickyNote,RotateCcw,RotateCw,Palette,Pipette,X,Search,Droplets,Check,Layers3,ChevronLeft,ChevronRight} from "lucide-react";
import {toast} from "sonner";
import "../components/session/cockpit-v2-lab.css";

type Kind="cartridge"|"ink"|"diluent"|"ointment"|"protection";
type Material={id:string;name:string;short:string;kind:Kind;unit:string;color?:string;detail:string};
type Use={id:string;materialId:string;label:string;amount:number;unit:string;recipeId?:string};
type Cup="P"|"M"|"G"|"GG";
type Ingredient={materialId:string;drops:number};
type Recipe={id:string;code:string;sampleId?:string;cup:Cup;ingredients:Ingredient[];drops:number;ml:number};
type View={x:number;y:number;scale:number;rotation:number};
type Sample={id:string;code:string;hex:string;rgb:[number,number,number];cmyk:[number,number,number,number];xPct:number;yPct:number};
type Sheet="materials"|"ink"|"recipe"|"sample"|"notes"|"finish"|null;

const CUP:Record<Cup,number>={P:.5,M:1,G:2,GG:4};
const DROP=.05;
const V0:View={x:0,y:0,scale:1,rotation:0};
const GRAYS=["#050505","#191919","#333333","#525252","#737373","#969696","#b8b8b8","#dddddd","#ffffff"];
const STOCK:Material[]=[
{id:"3rl",name:"Cartucho 3RL 0.30",short:"3RL",kind:"cartridge",unit:"un",detail:"Liner - lote ativo"},
{id:"5rl",name:"Cartucho 5RL 0.30",short:"5RL",kind:"cartridge",unit:"un",detail:"Liner - lote ativo"},
{id:"7rl",name:"Cartucho 7RL 0.30",short:"7RL",kind:"cartridge",unit:"un",detail:"Liner - lote ativo"},
{id:"black",name:"Dynamic Black",short:"BLK",kind:"ink",unit:"gt",color:"#111111",detail:"Pigmento - preto"},
{id:"navy",name:"Navy Blue",short:"NVY",kind:"ink",unit:"gt",color:"#14213d",detail:"Pigmento - azul marinho"},
{id:"orange",name:"Orange",short:"ORG",kind:"ink",unit:"gt",color:"#f97316",detail:"Pigmento - laranja"},
{id:"olive",name:"Olive Green",short:"OLV",kind:"ink",unit:"gt",color:"#65743a",detail:"Pigmento - verde oliva"},
{id:"white",name:"White",short:"WHT",kind:"ink",unit:"gt",color:"#f4f4f5",detail:"Pigmento - branco"},
{id:"diluent",name:"Diluente",short:"DIL",kind:"diluent",unit:"gt",color:"#9ca3af",detail:"Diluente - gotas"},
{id:"vaseline",name:"Vaselina / Butter",short:"VAS",kind:"ointment",unit:"g",detail:"Passos de 10 g"},
{id:"gloves",name:"Luvas",short:"LUV",kind:"protection",unit:"par",detail:"Consumo por par"}];

function id(p:string){return p+"-"+Date.now()+"-"+Math.random().toString(36).slice(2,6)}
function timer(s:number){const h=Math.floor(s/3600),m=Math.floor(s%3600/60),x=s%60;return [h,m,x].map(v=>String(v).padStart(2,"0")).join(":")}
function hex(r:number,g:number,b:number){return "#"+[r,g,b].map(v=>v.toString(16).padStart(2,"0")).join("")}
function cmyk(r:number,g:number,b:number):[number,number,number,number]{const R=r/255,G=g/255,B=b/255,k=1-Math.max(R,G,B);if(k>.999)return[0,0,0,100];return[Math.round((1-R-k)/(1-k)*100),Math.round((1-G-k)/(1-k)*100),Math.round((1-B-k)/(1-k)*100),Math.round(k*100)]}

export default function SessionCockpitLab(){
const [run,setRun]=useState(true),[sec,setSec]=useState(10095);
const [view,setView]=useState<View>(V0),vr=useRef(view);vr.current=view;
const [vu,setVu]=useState<View[]>([]),[vredo,setVredo]=useState<View[]>([]);
const [lmin,setLmin]=useState(false),[rmin,setRmin]=useState(false),[lex,setLex]=useState(false),[rex,setRex]=useState(false);
const [lop,setLop]=useState(.9),[rop,setRop]=useState(.9),[lscale,setLscale]=useState(1),[rscale,setRscale]=useState(1);
const [refOn,setRefOn]=useState(true),[refOp,setRefOp]=useState(1),[markOn,setMarkOn]=useState(true),[markOp,setMarkOp]=useState(1);
const [mode,setMode]=useState<"tonal"|"color">("tonal"),[sampler,setSampler]=useState(false),[samples,setSamples]=useState<Sample[]>([]),[sample,setSample]=useState<Sample|null>(null);
const [active,setActive]=useState(["3rl","7rl","navy","orange","diluent","vaseline"]),[uses,setUses]=useState<Use[]>([]),[redoUses,setRedoUses]=useState<Use[]>([]);
const [recipes,setRecipes]=useState<Recipe[]>([]),[sheet,setSheet]=useState<Sheet>(null),[ink,setInk]=useState<Material|null>(null),[search,setSearch]=useState(""),[note,setNote]=useState("");
const [cup,setCup]=useState<Cup>("M"),[ings,setIngs]=useState<Ingredient[]>([]),[flash,setFlash]=useState<Use|null>(null);
const stage=useRef<HTMLDivElement>(null),image=useRef<HTMLImageElement>(null),pts=useRef(new Map<number,{x:number;y:number}>());
const start=useRef<View|null>(null),pstart=useRef<{x:number;y:number}|null>(null),base=useRef<{v:View;d:number;a:number;m:{x:number;y:number}}|null>(null);

useEffect(()=>{if(!run)return;const t=setInterval(()=>setSec(s=>s+1),1000);return()=>clearInterval(t)},[run]);
const mats=useMemo(()=>active.map(x=>STOCK.find(m=>m.id===x)).filter(Boolean) as Material[],[active]);
const totals=useMemo(()=>{const o:Record<string,number>={};uses.forEach(u=>o[u.materialId]=(o[u.materialId]||0)+u.amount);return o},[uses]);
const found=useMemo(()=>{const q=search.toLowerCase();return STOCK.filter(m=>!active.includes(m.id)&&(!q||(m.name+" "+m.detail).toLowerCase().includes(q)))},[active,search]);

function vset(n:View){setVu(h=>[...h,vr.current].slice(-30));setVredo([]);setView(n)}
function vundo(){setVu(h=>{const p=h[h.length-1];if(!p)return h;setVredo(r=>[vr.current,...r]);setView(p);return h.slice(0,-1)})}
function vred(){setVredo(r=>{const n=r[0];if(!n)return r;setVu(h=>[...h,vr.current]);setView(n);return r.slice(1)})}
function addUse(materialId:string,label:string,amount:number,unit:string,recipeId?:string){const u={id:id("u"),materialId,label,amount,unit,recipeId};setUses(x=>[...x,u]);setRedoUses([]);setFlash(u);setTimeout(()=>setFlash(f=>f?.id===u.id?null:f),5000)}
function uundo(){setUses(x=>{const u=x[x.length-1];if(!u)return x;setRedoUses(r=>[u,...r]);setFlash(null);return x.slice(0,-1)})}
function redoUse(){setRedoUses(r=>{const u=r[0];if(!u)return r;setUses(x=>[...x,u]);return r.slice(1)})}
function useMat(m:Material){if(m.kind==="cartridge")return addUse(m.id,m.name,1,"un");if(m.kind==="protection")return addUse(m.id,m.name,1,"par");if(m.kind==="ointment")return addUse(m.id,m.name,10,"g");setInk(m);setSheet("ink")}
function setIng(mid:string,n:number){setIngs(a=>n<=0?a.filter(x=>x.materialId!==mid):a.some(x=>x.materialId===mid)?a.map(x=>x.materialId===mid?{...x,drops:n}:x):[...a,{materialId:mid,drops:n}])}
function recipe(seed?:Material){setCup("M");setIngs(seed?[{materialId:seed.id,drops:1}]:[]);setSheet("recipe")}
function saveRecipe(){const drops=ings.reduce((a,b)=>a+b.drops,0),ml=drops*DROP;if(!drops)return toast.error("Adicione tinta ou diluente.");if(ml>CUP[cup])return toast.error("Mistura maior que a capacidade do batoque.");const r:Recipe={id:id("mix"),code:"M"+String(recipes.length+1).padStart(2,"0"),sampleId:sample?.id,cup,ingredients:ings,drops,ml};setRecipes(x=>[...x,r]);addUse("cup-"+cup,"Batoque "+cup,1,"un",r.id);ings.forEach(i=>{const m=STOCK.find(x=>x.id===i.materialId);if(m)addUse(m.id,m.name,i.drops,"gt",r.id)});setSheet(null);toast.success(r.code+" salva na sessao")}

function sampleAt(cx:number,cy:number){const s=stage.current,im=image.current;if(!s||!im||!im.naturalWidth||samples.length>=30)return;const rect=s.getBoundingClientRect(),w=rect.width,h=rect.height,p=new DOMPoint(cx-rect.left,cy-rect.top);const matrix=new DOMMatrix().translate(w/2+vr.current.x,h/2+vr.current.y).rotate(vr.current.rotation).scale(vr.current.scale).translate(-w/2,-h/2);const q=p.matrixTransform(matrix.inverse()),fit=Math.min(w/im.naturalWidth,h/im.naturalHeight),iw=im.naturalWidth*fit,ih=im.naturalHeight*fit,ox=(w-iw)/2,oy=(h-ih)/2;if(q.x<ox||q.x>ox+iw||q.y<oy||q.y>oy+ih)return toast.error("Toque sobre a referencia.");const px=Math.round((q.x-ox)/iw*im.naturalWidth),py=Math.round((q.y-oy)/ih*im.naturalHeight),c=document.createElement("canvas");c.width=5;c.height=5;const ctx=c.getContext("2d",{willReadFrequently:true});if(!ctx)return;ctx.drawImage(im,Math.max(0,px-2),Math.max(0,py-2),5,5,0,0,5,5);const d=ctx.getImageData(0,0,5,5).data;let R=0,G=0,B=0,n=0;for(let i=0;i<d.length;i+=4){R+=d[i];G+=d[i+1];B+=d[i+2];n++}R=Math.round(R/n);G=Math.round(G/n);B=Math.round(B/n);const x:Sample={id:id("c"),code:"C"+String(samples.length+1).padStart(2,"0"),hex:hex(R,G,B),rgb:[R,G,B],cmyk:cmyk(R,G,B),xPct:q.x/w*100,yPct:q.y/h*100};setSamples(a=>[...a,x]);setSample(x);setMode("color");setSampler(false);toast.success(x.code+" capturada - media 5x5 px")}

function down(e:RP<HTMLDivElement>){e.currentTarget.setPointerCapture(e.pointerId);pts.current.set(e.pointerId,{x:e.clientX,y:e.clientY});if(pts.current.size===1){start.current=vr.current;pstart.current={x:e.clientX,y:e.clientY}}if(pts.current.size===2){const[a,b]=[...pts.current.values()];base.current={v:vr.current,d:Math.hypot(b.x-a.x,b.y-a.y),a:Math.atan2(b.y-a.y,b.x-a.x),m:{x:(a.x+b.x)/2,y:(a.y+b.y)/2}}}}
function move(e:RP<HTMLDivElement>){if(!pts.current.has(e.pointerId))return;pts.current.set(e.pointerId,{x:e.clientX,y:e.clientY});const p=[...pts.current.values()];if(p.length===2&&base.current){const[a,b]=p,z=base.current,d=Math.hypot(b.x-a.x,b.y-a.y),ang=Math.atan2(b.y-a.y,b.x-a.x),m={x:(a.x+b.x)/2,y:(a.y+b.y)/2};setView({...z.v,scale:Math.max(.2,Math.min(5,z.v.scale*d/z.d)),rotation:z.v.rotation+(ang-z.a)*180/Math.PI,x:z.v.x+m.x-z.m.x,y:z.v.y+m.y-z.m.y})}else if(p.length===1&&!sampler&&start.current&&pstart.current)setView({...start.current,x:start.current.x+e.clientX-pstart.current.x,y:start.current.y+e.clientY-pstart.current.y})}
function up(e:RP<HTMLDivElement>){const ps=pstart.current;pts.current.delete(e.pointerId);if(sampler&&ps&&Math.hypot(e.clientX-ps.x,e.clientY-ps.y)<8)sampleAt(e.clientX,e.clientY);if(pts.current.size===0){if(start.current&&JSON.stringify(start.current)!==JSON.stringify(vr.current)){setVu(h=>[...h,start.current!]);setVredo([])}start.current=null;pstart.current=null;base.current=null}}
function wheel(e:RW<HTMLDivElement>){e.preventDefault();vset({...vr.current,scale:Math.max(.2,Math.min(5,vr.current.scale*(e.deltaY<0?1.08:.92)))})}

useEffect(()=>{const el=stage.current as any;if(!el)return;let st:View|null=null;const a=(e:any)=>{e.preventDefault();st={...vr.current}},b=(e:any)=>{if(st){e.preventDefault();setView({...st,scale:Math.max(.2,Math.min(5,st.scale*(e.scale||1))),rotation:st.rotation+(e.rotation||0)})}},c=(e:any)=>{e.preventDefault();if(st){setVu(h=>[...h,st!]);setVredo([])}st=null};el.addEventListener("gesturestart",a,{passive:false});el.addEventListener("gesturechange",b,{passive:false});el.addEventListener("gestureend",c,{passive:false});return()=>{el.removeEventListener("gesturestart",a);el.removeEventListener("gesturechange",b);el.removeEventListener("gestureend",c)}},[]);

const panel=(o:number,s:number,side:"left"|"right")=>({"--panel-alpha":o,transform:"scale("+s+")",transformOrigin:side==="left"?"left top":"right top"} as CSSProperties);
const drops=ings.reduce((a,b)=>a+b.drops,0),ml=drops*DROP,pct=Math.round(ml/CUP[cup]*100);

return <div className="cockpit-lab">
<header className="cockpit-top">
<button className="cockpit-icon" onClick={()=>history.back()}><ArrowLeft size={18}/></button><button className="cockpit-icon minor-nav" onClick={()=>location.assign("/")}><Home size={18}/></button>
<button className="cockpit-icon" onClick={vundo} disabled={!vu.length} title="Desfazer imagem"><Undo2 size={18}/></button><button className="cockpit-icon" onClick={vred} disabled={!vredo.length} title="Refazer imagem"><Redo2 size={18}/></button>
<div className="cockpit-client"><strong>Marina Oliveira</strong><small>Samurai & Peonias - Antebraco direito - LAB V2</small></div>
<button className="cockpit-icon desktop-only" onClick={()=>setSheet("notes")}><StickyNote size={17}/></button><div className="cockpit-status"><i/><b>{timer(sec)}</b><span>{run?"EM ANDAMENTO":"PAUSADA"}</span></div>
</header>

<main ref={stage} className="cockpit-stage" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onWheel={wheel}>
<div className="cockpit-anamnese">Sem alergias registradas - Pele normal</div>
<div className="cockpit-view-quick"><button onClick={()=>vset(V0)}>{Math.round(view.scale*100)}%</button><button onClick={()=>vset({...vr.current,rotation:vr.current.rotation-15})}><RotateCcw size={15}/></button><button onClick={()=>vset({...vr.current,rotation:vr.current.rotation+15})}><RotateCw size={15}/></button></div>
<div className="cockpit-transform" style={{transform:"translate("+view.x+"px,"+view.y+"px) rotate("+view.rotation+"deg) scale("+view.scale+")"}}>
{refOn?<img ref={image} src="/quote-cover-reference.jpg" className="cockpit-reference" style={{opacity:refOp}} alt="Referencia"/>:<div className="cockpit-empty">Referencia oculta</div>}
{markOn&&samples.map(s=><span key={s.id} className="sample-marker" data-code={s.code} style={{left:s.xPct+"%",top:s.yPct+"%",background:s.hex,opacity:markOp}}/>)}
</div>{sampler&&<div className="cockpit-empty" style={{pointerEvents:"none",color:"#fecdd3"}}><Pipette size={28}/><br/>Toque em um ponto da referencia</div>}
</main>

<aside className={"cockpit-dock left "+(lmin?"minimized ":"")+(lex?"expanded":"")} style={panel(lop,lscale,"left")}>
<header><button onClick={()=>setLmin(v=>!v)}><Minus size={16}/></button><strong>Materiais</strong><button onClick={()=>setLex(v=>!v)}>{lex?<ChevronLeft size={16}/>:<ChevronRight size={16}/>}</button></header>
<div className="dock-controls"><label>Escala <input type="range" min=".9" max="1.1" step=".05" value={lscale} onChange={e=>setLscale(+e.target.value)}/><output>{Math.round(lscale*100)}</output></label><label>Fundo <input type="range" min=".35" max="1" step=".05" value={lop} onChange={e=>setLop(+e.target.value)}/><output>{Math.round(lop*100)}</output></label></div>
<div className="dock-body">{mats.map(m=><button key={m.id} className={"material-card "+(totals[m.id]?"active":"")} onClick={()=>useMat(m)}><span className="material-glyph" style={m.color?{background:m.color,color:m.id==="white"?"#18181b":"white"}:undefined}>{m.kind==="ink"||m.kind==="diluent"?<Droplets size={17}/>:m.short}</span>{lex&&<span className="material-meta"><b>{m.name}</b><small>{m.kind==="ink"||m.kind==="diluent"?"gotas / mistura":m.kind==="ointment"?"+10 g":"+1"}</small></span>}{!!totals[m.id]&&<span className="material-count">OK {totals[m.id]} {m.unit}</span>}</button>)}<button className="dock-add" onClick={()=>setSheet("materials")}><Plus size={18}/>{lex&&" Adicionar"}</button></div>
<div className="dock-undo"><button onClick={uundo} disabled={!uses.length}><Undo2 size={16}/></button><button onClick={redoUse} disabled={!redoUses.length}><Redo2 size={16}/></button></div>
</aside>

<aside className={"cockpit-dock right "+(rmin?"minimized ":"")+(rex?"expanded":"")} style={panel(rop,rscale,"right")}>
<header><button onClick={()=>setRmin(v=>!v)}><Minus size={16}/></button><strong>Camadas</strong><button onClick={()=>setRex(v=>!v)}>{rex?<ChevronRight size={16}/>:<ChevronLeft size={16}/>}</button></header>
<div className="dock-controls"><label>Escala <input type="range" min=".9" max="1.1" step=".05" value={rscale} onChange={e=>setRscale(+e.target.value)}/><output>{Math.round(rscale*100)}</output></label><label>Fundo <input type="range" min=".35" max="1" step=".05" value={rop} onChange={e=>setRop(+e.target.value)}/><output>{Math.round(rop*100)}</output></label></div>
<div className="dock-body"><div className="layer-card"><img className="layer-thumb" src="/quote-cover-reference.jpg"/><div><strong>Ref. Principal</strong><input type="range" min="0" max="1" step=".05" value={refOp} onChange={e=>setRefOp(+e.target.value)}/></div><button className="layer-eye" onClick={()=>setRefOn(v=>!v)}>{refOn?<Eye size={16}/>:<EyeOff size={16}/>}</button></div>
<div className="layer-card"><div className="layer-thumb" style={{display:"grid",placeItems:"center"}}><Pipette size={17}/></div><div><strong>Amostras</strong><input type="range" min="0" max="1" step=".05" value={markOp} onChange={e=>setMarkOp(+e.target.value)}/></div><button className="layer-eye" onClick={()=>setMarkOn(v=>!v)}>{markOn?<Eye size={16}/>:<EyeOff size={16}/>}</button></div>
<div className="layer-card"><div className="layer-thumb" style={{display:"grid",placeItems:"center"}}><Layers3 size={17}/></div><div><strong>Linework</strong><small style={{fontSize:8,color:"#71717a"}}>proxima etapa</small></div><button className="layer-eye" disabled><EyeOff size={16}/></button></div></div>
</aside>

<div className="cockpit-palette"><button className="palette-add" onClick={()=>setMode(x=>x==="tonal"?"color":"tonal")}><Palette size={13}/> {mode==="tonal"?"Escala tonal":"Cores"}</button>
{mode==="tonal"?GRAYS.map((g,i)=><button key={g} className="palette-chip" style={{background:g}}><span>T{String(i+1).padStart(2,"0")}</span></button>):<>{samples.map(s=><button key={s.id} className="palette-chip" style={{background:s.hex}} onClick={()=>{setSample(s);setSheet("sample")}}><span>{s.code}</span></button>)}<button className="palette-add" onClick={()=>setSampler(true)}><Pipette size={13}/> Amostrar</button></>}</div>

{flash&&<div className="cockpit-toast"><Check size={17} color="#10b981"/><span>{flash.label}: +{flash.amount} {flash.unit}</span><button onClick={uundo}>DESFAZER (5s)</button></div>}
<footer className="cockpit-bottom"><button onClick={()=>setRun(v=>!v)}>{run?<Pause size={18}/>:<Play size={18}/>}<span className="button-label">{run?"PAUSAR":"RETOMAR"}</span></button><button onClick={()=>setSheet("materials")}><Package size={18}/><span className="button-label">ESTOQUE</span></button><button onClick={()=>toast.success("Foto final: proxima integracao")}><Camera size={18}/><span className="button-label">FOTO</span></button><button className="finish" onClick={()=>setSheet("finish")}><Square size={17}/><span className="button-label">CONCLUIR</span></button></footer>

{sheet==="materials"&&<section className="cockpit-sheet"><button className="close" onClick={()=>setSheet(null)}><X size={17}/></button><h3>Adicionar material ativo</h3><p>Busca simulada do estoque central.</p><div style={{position:"relative"}}><Search size={16} style={{position:"absolute",left:12,top:14,color:"#71717a"}}/><input className="search-input" style={{paddingLeft:36}} value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar cartucho, tinta, marca..."/></div><div className="sheet-grid">{found.map(m=><button className="sheet-option" key={m.id} onClick={()=>{setActive(a=>[...a,m.id]);setSheet(null);setSearch("")}}><b>{m.name}</b><small>{m.detail}</small></button>)}</div></section>}

{sheet==="ink"&&ink&&<section className="cockpit-sheet"><button className="close" onClick={()=>setSheet(null)}><X size={17}/></button><h3>{ink.name}</h3><p>Uso direto ou mistura.</p><div className="sheet-grid">{[1,3,5,10].map(n=><button key={n} className="sheet-option" onClick={()=>{addUse(ink.id,ink.name,n,"gt");setSheet(null)}}><b>+ {n} gotas</b><small>~ {(n*DROP).toFixed(2)} ml</small></button>)}<button className="sheet-option selected" onClick={()=>recipe(ink)}><b>Criar mistura</b><small>Batoque + proporcoes</small></button></div></section>}

{sheet==="recipe"&&<section className="cockpit-sheet"><button className="close" onClick={()=>setSheet(null)}><X size={17}/></button><h3>Receita {sample?"- "+sample.code:""}</h3><p>Referencia inicial: 20 gotas/ml. A receita fica no historico da sessao.</p><div className="sheet-grid">{(["P","M","G","GG"] as Cup[]).map(c=><button key={c} className={"sheet-option "+(cup===c?"selected":"")} onClick={()=>setCup(c)}><b>Batoque {c}</b><small>{CUP[c]} ml - ~{Math.round(CUP[c]/DROP)} gotas</small></button>)}</div>
{STOCK.filter(m=>m.kind==="ink"||m.kind==="diluent").map(m=>{const row=ings.find(x=>x.materialId===m.id);return <div className="mix-row" key={m.id}><span>{m.name}</span><input type="number" min="0" value={row?.drops||0} onChange={e=>setIng(m.id,Math.max(0,+e.target.value||0))}/><span>gt</span></div>})}
<div className="mix-summary"><div>Total: {drops} gotas - ~{ml.toFixed(2)} ml</div><div>Batoque {cup}: {CUP[cup].toFixed(2)} ml - ocupacao ~{pct}%</div>{ings.map(i=>{const m=STOCK.find(x=>x.id===i.materialId);return <div key={i.materialId}>{m?.short}: {i.drops}gt - {drops?((i.drops/drops)*100).toFixed(1):0}%</div>})}</div><div className="sheet-actions"><button onClick={()=>setSheet(null)}>Cancelar</button><button className="primary" onClick={saveRecipe}>Salvar receita</button></div></section>}

{sheet==="sample"&&sample&&<section className="cockpit-sheet"><button className="close" onClick={()=>setSheet(null)}><X size={17}/></button><h3>{sample.code} - Amostra 5x5 px</h3><div className="sample-detail"><div className="sample-swatch" style={{background:sample.hex}}/><div className="sample-data"><div>HEX {sample.hex.toUpperCase()}</div><div>RGB {sample.rgb.join(" - ")}</div><div>CMYK {sample.cmyk.map(v=>v+"%").join(" - ")}</div></div></div><div className="sheet-actions"><button onClick={()=>{setSheet(null);setSampler(true)}}>Nova amostra</button><button className="primary" onClick={()=>recipe()}>Criar mistura</button></div>{recipes.filter(r=>r.sampleId===sample.id).map(r=><div className="mix-summary" key={r.id}>{r.code+" - Batoque "+r.cup+" - "+r.drops+"gt - ~"+r.ml.toFixed(2)+"ml"}</div>)}</section>}

{sheet==="notes"&&<section className="cockpit-sheet"><button className="close" onClick={()=>setSheet(null)}><X size={17}/></button><h3>Notas rapidas</h3><textarea className="cockpit-note" value={note} onChange={e=>setNote(e.target.value)}/><div className="sheet-actions"><button className="primary" onClick={()=>setSheet(null)}>Salvar</button></div></section>}
{sheet==="finish"&&<section className="cockpit-sheet"><button className="close" onClick={()=>setSheet(null)}><X size={17}/></button><h3>Revisao antes de concluir</h3><p>LAB: nenhuma baixa real sera feita.</p><div className="mix-summary"><div>Duracao: {timer(sec)}</div><div>Consumos: {uses.length}</div><div>Misturas: {recipes.length}</div><div>Amostras: {samples.length}</div><div>Vaselina: {totals.vaseline||0} g</div></div><div className="sheet-actions"><button onClick={()=>setSheet(null)}>Voltar</button><button className="primary" onClick={()=>{setSheet(null);toast.success("Simulacao concluida sem alterar producao")}}>Concluir simulacao</button></div></section>}
</div>
}
