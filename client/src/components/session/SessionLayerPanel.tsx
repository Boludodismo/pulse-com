import { useEffect, useRef, useState, type PointerEvent } from "react";
import { ArrowDown, ArrowUp, Eye, EyeOff, GripVertical, Layers3, Pipette, Pencil, Check, X } from "lucide-react";
import { moveVisualLayer } from "@shared/sessionVisualLayers";

export type PanelLayer = {
  layerKey: string;
  name: string;
  src: string | null;
  opacity: number;
  visible: boolean;
};

type Props = {
  layers: PanelLayer[]; // front to back, matching the displayed stack
  busy: boolean;
  expanded: boolean;
  onExpand: () => void;
  selected: string;
  onSelect: (key: string) => void;
  onRename: (key: string, name: string) => Promise<boolean>;
  onReorder: (keys: string[]) => void;
  onVisibility: (key: string, visible: boolean) => void;
  onOpacity: (key: string, opacity: number) => void;
  onCommitOpacity: (key: string, opacity: number) => void;
  onRemove: (key: string) => void;
};

export default function SessionLayerPanel(props: Props) {
  const selected=props.selected, setSelected=props.onSelect;
  const [renaming,setRenaming]=useState<string|null>(null);
  const [nameDraft,setNameDraft]=useState("");
  async function saveName(key:string){
    const name=nameDraft.trim();if(!name||props.busy)return;
    if(await props.onRename(key,name))setRenaming(null);
  }
  const [dragging, setDragging] = useState<string | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const list = useRef<HTMLDivElement>(null);
  const drag = useRef<{ key: string; id: number; x: number; y: number; moved: boolean; target: number; keys: string[] } | null>(null);
  const suppressClick = useRef(false);
  const keys = props.layers.map(layer => layer.layerKey);
  useEffect(() => {
    if (keys.length&&!keys.includes(selected)) setSelected(keys.includes("reference")?"reference":keys[0]);
  }, [keys.join("|"), selected]);

  function begin(event: PointerEvent<HTMLButtonElement>, key: string) {
    if (props.busy || (event.pointerType === "mouse" && event.button !== 0)) return;
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    setSelected(key);
    suppressClick.current = false;
    drag.current = { key, id: event.pointerId, x: event.clientX, y: event.clientY, moved: false, target: keys.indexOf(key), keys };
  }

  function move(event: PointerEvent<HTMLButtonElement>) {
    const current = drag.current;
    if (!current || current.id !== event.pointerId) return;
    if (!current.moved && Math.hypot(event.clientX - current.x, event.clientY - current.y) < 6) return;
    current.moved = true;
    suppressClick.current = true;
    event.preventDefault();
    const scroller = list.current?.closest(".dock-body");
    if (scroller) {
      const rect = scroller.getBoundingClientRect();
      if (event.clientY < rect.top + 40) scroller.scrollTop -= 16;
      if (event.clientY > rect.bottom - 40) scroller.scrollTop += 16;
    }
    const others = Array.from(list.current?.querySelectorAll<HTMLElement>("[data-layer-key]") || [])
      .filter(row => row.dataset.layerKey !== current.key);
    const index = others.findIndex(row => {
      const rect = row.getBoundingClientRect();
      return event.clientY < rect.top + rect.height / 2;
    });
    current.target = index < 0 ? others.length : index;
    setDragging(current.key);
    setDropIndex(current.target);
  }

  function end(event: PointerEvent<HTMLButtonElement>, cancel = false) {
    const current = drag.current;
    if (!current || current.id !== event.pointerId) return;
    drag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    setDragging(null);
    setDropIndex(null);
    if (!cancel && current.moved && current.keys.join("|") === keys.join("|")) {
      props.onReorder(moveVisualLayer(keys, current.key, current.target));
    }
  }

  function select(key: string) {
    if (suppressClick.current) { suppressClick.current = false; return; }
    setSelected(key);
    props.onExpand();
  }

  const remaining = keys.filter(key => key !== dragging);
  const beforeKey = dropIndex === null ? null : remaining[dropIndex];
  return <div className="session-layer-panel" ref={list} aria-label="Camadas da sessão" aria-busy={props.busy}>
    {props.expanded && <p className="session-layer-hint">Arraste a miniatura para ordenar. A primeira camada fica por cima.</p>}
    {props.layers.map((layer, index) => <div key={layer.layerKey} data-layer-key={layer.layerKey}
      className={`session-layer-row ${selected === layer.layerKey ? "selected" : ""} ${dragging === layer.layerKey ? "dragging" : ""} ${beforeKey === layer.layerKey ? "drop-before" : ""}`}>
      <button type="button" className="session-layer-select" aria-label={`Selecionar e arrastar ${layer.name}`}
        aria-pressed={selected === layer.layerKey} disabled={props.busy} title={`${layer.name} · arraste para ordenar`}
        onPointerDown={event => begin(event, layer.layerKey)} onPointerMove={move}
        onPointerUp={event => end(event)} onPointerCancel={event => end(event, true)} onLostPointerCapture={event => end(event, true)}
        onClick={() => select(layer.layerKey)} onKeyDown={event => {
          if (event.key === "Escape") { drag.current = null; setDragging(null); setDropIndex(null); }
          if (event.altKey && (event.key === "ArrowUp" || event.key === "ArrowDown")) {
            event.preventDefault();
            props.onReorder(moveVisualLayer(keys, layer.layerKey, index + (event.key === "ArrowUp" ? -1 : 1)));
          }
        }}>
        <span className="session-layer-thumb">{layer.src ? <img src={layer.src} alt="" draggable={false}/> : layer.layerKey === "samples" ? <Pipette size={20}/> : <Layers3 size={20}/>}</span>
        {props.expanded && <span className="session-layer-title"><strong>{layer.name}</strong><small><GripVertical size={12}/> Arrastar</small></span>}
      </button>
      <button type="button" className="session-layer-eye" disabled={props.busy} aria-pressed={layer.visible}
        aria-label={`${layer.visible ? "Ocultar" : "Mostrar"} ${layer.name}`} title={layer.visible ? "Ocultar camada" : "Mostrar camada"}
        onClick={() => props.onVisibility(layer.layerKey, !layer.visible)}>{layer.visible ? <Eye size={18}/> : <EyeOff size={18}/>}</button>
      {props.expanded ? <>
        <label className="session-layer-opacity"><span>Opacidade <output>{layer.opacity}%</output></span>
          <input type="range" min="0" max="100" step="1" value={layer.opacity} disabled={props.busy}
            aria-label={`Opacidade de ${layer.name}`} aria-valuetext={`${layer.opacity}%`}
            onChange={event => props.onOpacity(layer.layerKey, Number(event.target.value))}
            onPointerUp={event => props.onCommitOpacity(layer.layerKey, Number(event.currentTarget.value))}
            onPointerCancel={event => props.onCommitOpacity(layer.layerKey, Number(event.currentTarget.value))}
            onKeyUp={event => props.onCommitOpacity(layer.layerKey, Number(event.currentTarget.value))}
            onBlur={event => props.onCommitOpacity(layer.layerKey, Number(event.currentTarget.value))}/>
        </label>
        {renaming === layer.layerKey && <form className="session-layer-rename" onSubmit={event=>{event.preventDefault();void saveName(layer.layerKey)}}>
          <label>Nome da camada<input autoFocus maxLength={160} value={nameDraft} disabled={props.busy} aria-label={`Nome de ${layer.name}`} onChange={event=>setNameDraft(event.target.value)} onKeyDown={event=>{if(event.key==="Escape"){event.preventDefault();setRenaming(null)}}}/></label>
          <button type="submit" disabled={props.busy||!nameDraft.trim()} aria-label="Salvar nome da camada"><Check size={16}/></button>
          <button type="button" disabled={props.busy} onClick={()=>setRenaming(null)} aria-label="Cancelar edição do nome"><X size={16}/></button>
        </form>}
        {selected === layer.layerKey && <div className="session-layer-actions">
          <button type="button" disabled={props.busy} aria-label={`Renomear ${layer.name}`} title="Renomear camada" onClick={()=>{setRenaming(layer.layerKey);setNameDraft(layer.name)}}><Pencil size={16}/></button>
          <button type="button" aria-label={`Subir ${layer.name}`} title="Subir camada" disabled={props.busy || index === 0} onClick={() => props.onReorder(moveVisualLayer(keys, layer.layerKey, index - 1))}><ArrowUp size={16}/></button>
          <button type="button" aria-label={`Descer ${layer.name}`} title="Descer camada" disabled={props.busy || index === keys.length - 1} onClick={() => props.onReorder(moveVisualLayer(keys, layer.layerKey, index + 1))}><ArrowDown size={16}/></button>
          {!["reference", "samples"].includes(layer.layerKey) && <button type="button" className="danger" disabled={props.busy} aria-label={`Remover ${layer.name}`} title="Remover camada" onClick={() => props.onRemove(layer.layerKey)}><X size={16}/></button>}
        </div>}
      </> : <output className="session-layer-percent">{layer.opacity}%</output>}
    </div>)}
    {dragging && dropIndex === remaining.length && <div className="session-layer-drop-end"/>}
    {props.busy && <span className="session-layer-status" role="status">Salvando camadas…</span>}
  </div>;
}
