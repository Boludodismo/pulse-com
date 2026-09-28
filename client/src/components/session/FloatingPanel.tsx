import { useEffect, useRef, useState, type ReactNode } from "react";
import { GripVertical, Minus } from "lucide-react";
export type Point = { x: number; y: number };
export function clampPanel(
  p: Point,
  width: number,
  height: number,
  areaWidth: number,
  areaHeight: number
): Point {
  return {
    x: Math.max(0, Math.min(p.x, Math.max(0, areaWidth - width))),
    y: Math.max(0, Math.min(p.y, Math.max(0, areaHeight - height))),
  };
}
export function FloatingPanel({
  title,
  position,
  onPosition,
  onClose,
  children,
  narrow = false,
  opacity = 0.88,
}: {
  title: string;
  position: Point;
  onPosition: (p: Point) => void;
  onClose?: () => void;
  children: ReactNode;
  narrow?: boolean;
  opacity?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef<{
    id: number;
    x: number;
    y: number;
    origin: Point;
  } | null>(null);
  const [actual, setActual] = useState(position);
  useEffect(() => {
    const fit = () => {
      const el = ref.current;
      if (el?.parentElement)
        setActual(
          clampPanel(
            position,
            el.offsetWidth,
            el.offsetHeight,
            el.parentElement.clientWidth,
            el.parentElement.clientHeight
          )
        );
    };
    fit();
    const observer = new ResizeObserver(fit);
    if (ref.current) observer.observe(ref.current);
    if (ref.current?.parentElement) observer.observe(ref.current.parentElement);
    return () => observer.disconnect();
  }, [position]);
  return (
    <section
      ref={ref}
      aria-label={title}
      className={`session-panel ${narrow ? "session-rail" : ""}`}
      style={{
        left: actual.x,
        top: actual.y,
        background: `rgba(24,24,27,${opacity})`,
      }}
    >
      <header>
        <button
          type="button"
          className="session-drag"
          aria-label={`Mover ${title}`}
          title="Arraste ou use as setas do teclado"
          onKeyDown={e => {
            const delta = (
              {
                ArrowLeft: [-16, 0],
                ArrowRight: [16, 0],
                ArrowUp: [0, -16],
                ArrowDown: [0, 16],
              } as Record<string, number[]>
            )[e.key];
            if (delta) {
              e.preventDefault();
              onPosition({ x: actual.x + delta[0], y: actual.y + delta[1] });
            }
          }}
          onPointerDown={e => {
            e.currentTarget.setPointerCapture(e.pointerId);
            drag.current = {
              id: e.pointerId,
              x: e.clientX,
              y: e.clientY,
              origin: actual,
            };
          }}
          onPointerMove={e => {
            const d = drag.current,
              el = ref.current;
            if (!d || d.id !== e.pointerId || !el?.parentElement) return;
            setActual(
              clampPanel(
                {
                  x: d.origin.x + e.clientX - d.x,
                  y: d.origin.y + e.clientY - d.y,
                },
                el.offsetWidth,
                el.offsetHeight,
                el.parentElement.clientWidth,
                el.parentElement.clientHeight
              )
            );
          }}
          onPointerUp={e => {
            if (drag.current?.id === e.pointerId) {
              drag.current = null;
              onPosition(actual);
              e.currentTarget.releasePointerCapture(e.pointerId);
            }
          }}
          onPointerCancel={() => {
            drag.current = null;
            onPosition(actual);
          }}
        >
          <GripVertical size={16} />
          {!narrow && <span>{title}</span>}
        </button>
        {onClose && (
          <button
            type="button"
            aria-label={`Recolher ${title}`}
            onClick={onClose}
          >
            <Minus size={18} />
          </button>
        )}
      </header>
      <div className="session-panel-body">{children}</div>
    </section>
  );
}
