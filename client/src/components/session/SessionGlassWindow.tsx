import { useEffect, useRef, useState, type ReactNode } from "react";
import { Maximize2, Minimize2, Minus, X } from "lucide-react";

type Point = { x: number; y: number };
export function boundWindow(position: Point, width: number, height: number, viewportWidth: number, viewportHeight: number): Point {
  return {
    x: Math.max(0, Math.min(position.x, Math.max(0, viewportWidth - width))),
    y: Math.max(0, Math.min(position.y, Math.max(0, viewportHeight - height))),
  };
}

/** Visual-only shell. Keeps its children mounted while minimized, preserving unsaved UI state. */
export default function SessionGlassWindow({ title, onClose, children }: {
  title: string; onClose: () => void; children: ReactNode;
}) {
  const [minimized, setMinimized] = useState(false);
  const [maximized, setMaximized] = useState(false);
  const [position, setPosition] = useState<Point>({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  const pointer = useRef<{ id: number; x: number; y: number; start: Point } | null>(null);
  const positionRef = useRef(position);
  const updatePosition = (next: Point) => { positionRef.current = next; setPosition(next); };
  useEffect(() => {
    const fit = () => {
      if (!panel.current) return;
      updatePosition(boundWindow(positionRef.current, panel.current.offsetWidth, panel.current.offsetHeight, window.innerWidth, window.innerHeight));
    };
    fit();
    window.addEventListener("resize", fit);
    window.visualViewport?.addEventListener("resize", fit);
    return () => {
      window.removeEventListener("resize", fit);
      window.visualViewport?.removeEventListener("resize", fit);
    };
  }, [maximized, minimized]);
  const finishDrag = (id: number, target: HTMLButtonElement) => {
    if (pointer.current?.id !== id) return;
    pointer.current = null;
    setDragging(false);
    if (target.hasPointerCapture(id)) target.releasePointerCapture(id);
  };
  return <div
    ref={panel}
    className={`session-glass-window ${maximized ? "is-maximized" : ""} ${minimized ? "is-minimized" : ""} ${dragging ? "is-dragging" : ""}`}
    style={{ "--glass-x": `${position.x}px`, "--glass-y": `${position.y}px` } as React.CSSProperties}
    role="region"
    aria-label={title}
  >
    <div className="session-glass-header">
      <button type="button" className="session-glass-grip" aria-label={`Mover ${title}`} style={{ touchAction: "none" }}
        onPointerDown={e => {
          if (minimized || maximized || !panel.current) return;
          e.currentTarget.setPointerCapture(e.pointerId);
          pointer.current = { id: e.pointerId, x: e.clientX, y: e.clientY, start: positionRef.current };
          setDragging(true);
        }}
        onPointerMove={e => {
          const p = pointer.current;
          if (!p || p.id !== e.pointerId || !panel.current) return;
          updatePosition(boundWindow({ x: p.start.x + e.clientX - p.x, y: p.start.y + e.clientY - p.y },
            panel.current.offsetWidth, panel.current.offsetHeight, window.innerWidth, window.innerHeight));
        }}
        onPointerUp={e => finishDrag(e.pointerId, e.currentTarget)}
        onPointerCancel={e => finishDrag(e.pointerId, e.currentTarget)}
        onKeyDown={e => {
          const steps: Record<string, Point> = { ArrowUp: {x:0,y:-16}, ArrowDown:{x:0,y:16}, ArrowLeft:{x:-16,y:0}, ArrowRight:{x:16,y:0} };
          const step = steps[e.key];
          if (!step || !panel.current) return;
          e.preventDefault();
          updatePosition(boundWindow({x:positionRef.current.x+step.x,y:positionRef.current.y+step.y},
            panel.current.offsetWidth,panel.current.offsetHeight,window.innerWidth,window.innerHeight));
        }}
      ><span className="session-glass-handle" aria-hidden="true"/><span className="session-glass-title">{title}</span></button>
      <div className="session-glass-controls">
        <button type="button" aria-label={minimized ? "Restaurar janela" : "Minimizar janela"} onClick={() => setMinimized(v => !v)}><Minus size={18}/></button>
        <button type="button" aria-label={maximized ? "Restaurar tamanho" : "Maximizar janela"} onClick={() => {setMinimized(false);setMaximized(v => !v);updatePosition({x:0,y:0});}}>{maximized?<Minimize2 size={18}/>:<Maximize2 size={18}/>}</button>
        <button type="button" aria-label="Fechar janela" onClick={onClose}><X size={18}/></button>
      </div>
    </div>
    <div className="session-glass-scroll" aria-hidden={minimized ? true : undefined} style={minimized ? {display:"none"} : undefined}>{children}</div>
  </div>;
}
