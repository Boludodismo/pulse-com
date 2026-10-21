import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Maximize2, Minimize2, Minus, X } from "lucide-react";

type Point = { x: number; y: number };
export function boundWindow(position: Point, width: number, height: number, viewportWidth: number, viewportHeight: number): Point {
  return {
    x: Math.max(0, Math.min(position.x, Math.max(0, viewportWidth - width))),
    y: Math.max(0, Math.min(position.y, Math.max(0, viewportHeight - height))),
  };
}

/** Visual-only shell. Keeps its children mounted while minimized, preserving unsaved UI state. */
export default function SessionGlassWindow({ title, onClose, children, active = true, order = 0, onFocus, minimizeTarget, restoreKey = 0 }: {
  title: string; onClose: () => void; children: ReactNode;
  active?: boolean; order?: number; onFocus?: () => void;
  minimizeTarget?: HTMLElement | null; restoreKey?: number;
}) {
  const [minimized, setMinimized] = useState(false);
  const [maximized, setMaximized] = useState(false);
  const [position, setPosition] = useState<Point>({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  const pointer = useRef<{ id: number; x: number; y: number; start: Point } | null>(null);
  const positionRef = useRef(position);
  const updatePosition = (next: Point) => { positionRef.current = next; setPosition(next); };
  useEffect(() => { setMinimized(false); }, [restoreKey]);
  const fit = (next: Point) => {
    const node = panel.current, parent = node?.offsetParent as HTMLElement | null;
    if (!node || !parent) return next;
    // Include the initial CSS left/top, inside the cockpit's visual viewport.
    const footer=parent.querySelector<HTMLElement>(".cockpit-bottom")?.offsetHeight||64;
    const tray=parent.querySelector<HTMLElement>(".session-glass-tray")?.offsetHeight||0;
    const bounded = boundWindow(
      { x: node.offsetLeft + next.x - 8, y: node.offsetTop + next.y - 8 },
      node.offsetWidth, node.offsetHeight,
      Math.max(0, parent.clientWidth - 16), Math.max(0, parent.clientHeight - footer - tray - 24),
    );
    return { x: bounded.x + 8 - node.offsetLeft, y: bounded.y + 8 - node.offsetTop };
  };
  useLayoutEffect(() => {
    if (maximized || minimized) return;
    const resize = () => updatePosition(fit(positionRef.current));
    resize();
    const observer = new ResizeObserver(resize);
    if (panel.current) {
      observer.observe(panel.current);
      if (panel.current.parentElement) observer.observe(panel.current.parentElement);
    }
    window.addEventListener("resize", resize);
    return () => { observer.disconnect(); window.removeEventListener("resize", resize); };
  }, [maximized, minimized]);
  const finishDrag = (id: number, target: HTMLButtonElement) => {
    if (pointer.current?.id !== id) return;
    pointer.current = null;
    setDragging(false);
    if (target.hasPointerCapture(id)) target.releasePointerCapture(id);
  };
  return <><div
    ref={panel}
    className={`session-glass-window ${active ? "is-active" : ""} ${maximized ? "is-maximized" : ""} ${minimized ? "is-minimized" : ""} ${dragging ? "is-dragging" : ""}`}
    style={{ "--glass-x": `${position.x}px`, "--glass-y": `${position.y}px`, zIndex: 55 + order } as CSSProperties}
    role="region"
    hidden={minimized && !!minimizeTarget}
    aria-label={title} onPointerDown={onFocus} onFocusCapture={onFocus}
  >
    <div className="session-glass-header">
      <button type="button" className="session-glass-grip" aria-label={minimized ? `Restaurar ${title}` : `Mover ${title}`} aria-expanded={!minimized}
        onClick={() => { if (minimized) setMinimized(false); }}
        onPointerDown={e => {
          if (minimized || maximized || !panel.current || e.button !== 0) return;
          e.currentTarget.setPointerCapture(e.pointerId);
          pointer.current = { id: e.pointerId, x: e.clientX, y: e.clientY, start: positionRef.current };
          setDragging(true);
        }}
        onPointerMove={e => {
          const p = pointer.current;
          if (!p || p.id !== e.pointerId || !panel.current) return;
          updatePosition(fit({ x: p.start.x + e.clientX - p.x, y: p.start.y + e.clientY - p.y }));
        }}
        onPointerUp={e => finishDrag(e.pointerId, e.currentTarget)}
        onPointerCancel={e => finishDrag(e.pointerId, e.currentTarget)}
        onLostPointerCapture={e => finishDrag(e.pointerId, e.currentTarget)}
        onKeyDown={e => {
          if (minimized || maximized) return;
          const steps: Record<string, Point> = { ArrowUp: {x:0,y:-16}, ArrowDown:{x:0,y:16}, ArrowLeft:{x:-16,y:0}, ArrowRight:{x:16,y:0} };
          const step = steps[e.key];
          if (!step || !panel.current) return;
          e.preventDefault();
          updatePosition(fit({x:positionRef.current.x+step.x,y:positionRef.current.y+step.y}));
        }}
      ><span className="session-glass-handle" aria-hidden="true"/><span className="session-glass-title">{title}</span></button>
      <div className="session-glass-controls">
        <button type="button" aria-label={minimized ? "Restaurar janela" : "Minimizar janela"} onClick={() => setMinimized(v => !v)}><Minus size={18}/></button>
        <button type="button" aria-label={maximized ? "Restaurar tamanho" : "Maximizar janela"} onClick={() => {setMinimized(false);setMaximized(v => !v);}}>{maximized?<Minimize2 size={18}/>:<Maximize2 size={18}/>}</button>
        <button type="button" aria-label="Fechar janela" onClick={onClose}><X size={18}/></button>
      </div>
    </div>
    <div className="session-glass-scroll" hidden={minimized}>{children}</div>
  </div>{minimized && minimizeTarget && createPortal(<div className="session-glass-pill">
    <button type="button" aria-label={`Restaurar ${title}`} onClick={() => { setMinimized(false); onFocus?.(); }}><Maximize2 size={16}/><span>{title}</span></button>
    <button type="button" aria-label={`Fechar ${title}`} onClick={onClose}><X size={16}/></button>
  </div>, minimizeTarget)}</>;
}
