import { cloneElement, isValidElement, useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

/** Hover/keyboard details and a touch hold that never dispatches a consumption click. */
export default function SessionMaterialHint({children,title,description,opacity=.98}:{children:ReactNode;title:string;description:string;opacity?:number}) {
  const id=useId(),anchor=useRef<HTMLDivElement>(null),tip=useRef<HTMLDivElement>(null);
  const [open,setOpen]=useState(false),[position,setPosition]=useState({left:0,top:0});
  const hold=useRef<ReturnType<typeof setTimeout>|null>(null),close=useRef<ReturnType<typeof setTimeout>|null>(null);
  const pointer=useRef<{x:number;y:number}|null>(null),suppress=useRef(false);
  const clearHold=()=>{if(hold.current)clearTimeout(hold.current);hold.current=null;};
  const clearClose=()=>{if(close.current)clearTimeout(close.current);close.current=null;};
  const show=()=>{clearClose();setOpen(true);};
  const later=()=>{clearClose();close.current=setTimeout(()=>setOpen(false),180);};
  useLayoutEffect(()=>{
    if(!open||!anchor.current||!tip.current)return;
    const r=anchor.current.getBoundingClientRect(),t=tip.current.getBoundingClientRect();
    const v=window.visualViewport,left=v?.offsetLeft??0,top=v?.offsetTop??0,w=v?.width??window.innerWidth,h=v?.height??window.innerHeight;
    const x=r.right+8+t.width<left+w-8?r.right+8:r.left-t.width-8;
    setPosition({left:Math.max(left+8,Math.min(x,left+w-t.width-8)),top:Math.max(top+8,Math.min(r.top,top+h-t.height-8))});
  },[open,title,description]);
  useEffect(()=>{
    if(!open)return;
    const esc=(e:KeyboardEvent)=>{if(e.key==="Escape")setOpen(false);};
    const dismiss=()=>setOpen(false);
    const outside=(e:PointerEvent)=>{if(!anchor.current?.contains(e.target as Node)&&!tip.current?.contains(e.target as Node))setOpen(false);};
    document.addEventListener("keydown",esc);window.addEventListener("resize",dismiss);window.addEventListener("scroll",dismiss,true);
    document.addEventListener("pointerdown",outside);
    return()=>{document.removeEventListener("keydown",esc);document.removeEventListener("pointerdown",outside);window.removeEventListener("resize",dismiss);window.removeEventListener("scroll",dismiss,true);};
  },[open]);
  useEffect(()=>()=>{clearHold();clearClose();},[]);
  return <div className="material-hint-anchor" ref={anchor} aria-describedby={open?id:undefined}
    onPointerEnter={e=>{if(e.pointerType!=="touch")show();}} onPointerLeave={e=>{clearHold();pointer.current=null;if(e.pointerType!=="touch")later();}}
    onFocus={show} onBlur={e=>{if(!e.currentTarget.contains(e.relatedTarget))later();}}
    onPointerDown={e=>{suppress.current=false;clearHold();if(e.pointerType!=="touch"&&e.pointerType!=="pen")return;pointer.current={x:e.clientX,y:e.clientY};hold.current=setTimeout(()=>{suppress.current=true;show();},450);}}
    onPointerMove={e=>{const p=pointer.current;if(p&&Math.hypot(e.clientX-p.x,e.clientY-p.y)>8){clearHold();pointer.current=null;setOpen(false);}}}
    onPointerUp={()=>{clearHold();pointer.current=null;}} onPointerCancel={()=>{clearHold();pointer.current=null;setOpen(false);}}
    onContextMenu={e=>{if(suppress.current||pointer.current)e.preventDefault();}}
    onClickCapture={e=>{if(suppress.current){e.preventDefault();e.stopPropagation();suppress.current=false;}else setOpen(false);}}>
    {isValidElement<{"aria-describedby"?:string}>(children)?cloneElement(children,{"aria-describedby":open?id:undefined}):children}
    {open&&createPortal(<div ref={tip} id={id} role="tooltip" className="session-material-tooltip" style={{...position,background:`rgba(26,26,26,${opacity})`}}
      onPointerEnter={clearClose} onPointerLeave={later}>
      <button type="button" aria-label="Fechar descrição do material" onClick={()=>setOpen(false)}>×</button>
      <strong>{title}</strong><p>{description}</p>
    </div>,document.fullscreenElement??document.body)}
  </div>;
}
