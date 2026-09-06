import { useCallback, useRef, useState } from "react";
import { Eye, Layers, Minus, Move, RotateCcw, RotateCw, ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "@/components/ui/button";

type Layer = "original" | "contrast" | "stencil";

type ReferenceViewerProps = {
  originalSrc?: string | null;
  contrastSrc?: string | null;
  stencilSrc?: string | null;
  alt: string;
  className?: string;
};

type Transform = { zoom: number; panX: number; panY: number; rotation: number; overlayOpacity: number };

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 5;

export function ReferenceViewer({ originalSrc, contrastSrc, stencilSrc, alt, className = "" }: ReferenceViewerProps) {
  const [activeLayer, setActiveLayer] = useState<Layer>("original");
  const [transform, setTransform] = useState<Transform>({ zoom: 1, panX: 0, panY: 0, rotation: 0, overlayOpacity: 0.55 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 });

  const displayedSource = activeLayer === "stencil"
    ? stencilSrc
    : activeLayer === "contrast"
      ? contrastSrc ?? originalSrc
      : originalSrc;

  const updateZoom = useCallback((amount: number) => {
    setTransform((current) => ({ ...current, zoom: Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, current.zoom + amount)) }));
  }, []);

  const reset = useCallback(() => {
    setTransform({ zoom: 1, panX: 0, panY: 0, rotation: 0, overlayOpacity: 0.55 });
  }, []);

  const onWheel = useCallback((event: React.WheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    updateZoom(event.deltaY > 0 ? -0.12 : 0.12);
  }, [updateZoom]);

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragStart.current = { x: event.clientX, y: event.clientY, panX: transform.panX, panY: transform.panY };
    setIsDragging(true);
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    setTransform((current) => ({
      ...current,
      panX: dragStart.current.panX + event.clientX - dragStart.current.x,
      panY: dragStart.current.panY + event.clientY - dragStart.current.y,
    }));
  };

  const stopDragging = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    setIsDragging(false);
  };

  const imageStyle = {
    transform: `translate(${transform.panX}px, ${transform.panY}px) scale(${transform.zoom}) rotate(${transform.rotation}deg)`,
    transition: isDragging ? "none" : "transform 160ms cubic-bezier(0.23, 1, 0.32, 1)",
  };

  return (
    <section className={`relative flex min-h-[300px] flex-1 flex-col overflow-hidden bg-black/90 ${className}`} aria-label="Visualizador de referência">
      <div
        className={`relative min-h-[250px] flex-1 touch-none select-none overflow-hidden ${isDragging ? "cursor-grabbing" : "cursor-grab"}`}
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={stopDragging}
        onPointerCancel={stopDragging}
      >
        {displayedSource ? (
          <img
            src={displayedSource}
            alt={alt}
            draggable={false}
            className={`pointer-events-none absolute inset-0 h-full w-full object-contain ${activeLayer === "contrast" ? "contrast-150 grayscale-[0.15]" : ""}`}
            style={imageStyle}
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-6 text-center text-sm text-white/65">
            <Layers className="h-8 w-8" aria-hidden="true" />
            <p>Nenhuma referência vinculada a esta sessão.</p>
          </div>
        )}
        {activeLayer !== "stencil" && stencilSrc && (
          <img
            src={stencilSrc}
            alt="Decalque sobreposto"
            draggable={false}
            className="pointer-events-none absolute inset-0 h-full w-full object-contain mix-blend-screen"
            style={{ ...imageStyle, opacity: transform.overlayOpacity }}
          />
        )}

        <div className="pointer-events-none absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-black/60 px-2.5 py-1 text-[11px] font-medium text-white/85 backdrop-blur">
          <Move className="h-3.5 w-3.5" aria-hidden="true" />
          Arraste para mover
        </div>
      </div>

      <div className="border-t border-white/10 bg-black/80 p-2.5 text-white backdrop-blur sm:p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex rounded-lg bg-white/10 p-0.5" role="group" aria-label="Camada visível">
            {([
              ["original", "Original", Boolean(originalSrc)],
              ["contrast", "Contraste", Boolean(contrastSrc ?? originalSrc)],
              ["stencil", "Decalque", Boolean(stencilSrc)],
            ] as const).map(([layer, label, available]) => (
              <button
                key={layer}
                type="button"
                disabled={!available}
                onClick={() => setActiveLayer(layer)}
                className={`rounded-md px-2 py-1 text-[11px] font-medium transition-colors ${activeLayer === layer ? "bg-white text-black" : "text-white/80 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-35"}`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1">
            <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-white hover:bg-white/10 hover:text-white" onClick={() => updateZoom(-0.2)} aria-label="Diminuir zoom">
              <ZoomOut className="h-4 w-4" />
            </Button>
            <span className="min-w-11 text-center text-xs tabular-nums text-white/75">{Math.round(transform.zoom * 100)}%</span>
            <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-white hover:bg-white/10 hover:text-white" onClick={() => updateZoom(0.2)} aria-label="Aumentar zoom">
              <ZoomIn className="h-4 w-4" />
            </Button>
            <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-white hover:bg-white/10 hover:text-white" onClick={() => setTransform((current) => ({ ...current, rotation: current.rotation - 15 }))} aria-label="Girar à esquerda">
              <RotateCcw className="h-4 w-4" />
            </Button>
            <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-white hover:bg-white/10 hover:text-white" onClick={() => setTransform((current) => ({ ...current, rotation: current.rotation + 15 }))} aria-label="Girar à direita">
              <RotateCw className="h-4 w-4" />
            </Button>
            <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-white hover:bg-white/10 hover:text-white" onClick={reset} aria-label="Restaurar visualização">
              <Eye className="h-4 w-4" />
            </Button>
          </div>
        </div>
        {stencilSrc && activeLayer !== "stencil" && (
          <label className="mt-2 flex items-center gap-2 text-[11px] text-white/75">
            <span>Opacidade do decalque</span>
            <Minus className="h-3.5 w-3.5" aria-hidden="true" />
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={transform.overlayOpacity}
              onChange={(event) => setTransform((current) => ({ ...current, overlayOpacity: Number(event.target.value) }))}
              className="h-1 min-w-0 flex-1 accent-primary"
              aria-label="Opacidade do decalque"
            />
          </label>
        )}
      </div>
    </section>
  );
}
