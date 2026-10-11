import { useState, useRef } from "react";
import Cropper, { type Area } from "react-easy-crop";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "../ui/dialog";
import { Button } from "../ui/button";
import type { CardImageEdit } from "../../../../shared/artistCardImage";

export default function CardImageEditor({
  image,
  initialEdit,
  title,
  onCancel,
  onSave,
}: {
  image: string;
  initialEdit?: CardImageEdit;
  title: string;
  onCancel: () => void;
  onSave: (edit: CardImageEdit | null) => Promise<void>;
}) {
  const [crop, setCrop] = useState({ x: 0, y: 0 }),
    [zoom, setZoom] = useState(1),
    [aspect, setAspect] = useState(1),
    [appearance, setAppearance] = useState<"color" | "bw">(
      initialEdit?.appearance ?? "color"
    ),
    [busy, setBusy] = useState(false),
    [loaded, setLoaded] = useState(false),
    [error, setError] = useState("");
  const area = useRef<Area | null>(null),
    natural = useRef(1);
  const initial = useRef(
    initialEdit
      ? {
          x: initialEdit.crop.x * 100,
          y: initialEdit.crop.y * 100,
          width: initialEdit.crop.width * 100,
          height: initialEdit.crop.height * 100,
        }
      : undefined
  );
  const finish = async (edit: CardImageEdit | null) => {
    setBusy(true);
    setError("");
    try {
      await onSave(edit);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Não foi possível salvar a foto."
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog
      open
      onOpenChange={open => {
        if (!open && !busy) onCancel();
      }}
    >
      <DialogContent
        className="max-h-[94dvh] overflow-y-auto sm:max-w-2xl data-[state=open]:animate-none data-[state=closed]:animate-none"
        onClick={e => e.stopPropagation()}
        onPointerDownOutside={e => {
          if (busy) e.preventDefault();
        }}
        onEscapeKeyDown={e => {
          if (busy) e.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle>Ajustar foto · {title}</DialogTitle>
          <DialogDescription>
            Arraste para posicionar. Use o zoom ou dois dedos no celular. A foto
            original será preservada.
          </DialogDescription>
        </DialogHeader>
        <div
          className="relative h-[min(42dvh,360px)] min-h-[220px] overflow-hidden rounded-lg bg-black"
          aria-label="Área de recorte da foto"
          aria-busy={!loaded}
        >
          <Cropper
            image={image}
            crop={crop}
            zoom={zoom}
            maxZoom={4}
            aspect={aspect}
            initialCroppedAreaPercentages={initial.current}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={value => {
              area.current = value;
            }}
            style={{
              mediaStyle: {
                filter: appearance === "bw" ? "grayscale(1)" : "none",
              },
            }}
            onMediaLoaded={media => {
              natural.current = media.naturalWidth / media.naturalHeight;
              setAspect(
                initialEdit
                  ? (natural.current * initialEdit.crop.width) /
                      initialEdit.crop.height
                  : natural.current
              );
              setLoaded(true);
            }}
            mediaProps={{
              onError: () => {
                setLoaded(false);
                setError(
                  "Não foi possível carregar a imagem. Tente novamente."
                );
              },
            }}
          />
        </div>
        <label className="block text-sm">
          Zoom · {zoom.toFixed(1)}×
          <input
            aria-label="Zoom da foto"
            className="mt-2 block w-full accent-orange-500"
            type="range"
            min={1}
            max={4}
            step={0.01}
            value={zoom}
            disabled={busy || !loaded}
            onChange={e => setZoom(Number(e.target.value))}
          />
        </label>
        <div
          className="flex flex-wrap gap-2"
          role="group"
          aria-label="Formato do recorte"
        >
          {[
            ["Original", natural.current],
            ["Quadrado", 1],
            ["Retrato", 4 / 5],
            ["Paisagem", 4 / 3],
          ].map(([label, ratio]) => (
            <Button
              key={String(label)}
              type="button"
              size="sm"
              variant={
                Math.abs(aspect - Number(ratio)) < 0.001 ? "default" : "outline"
              }
              disabled={busy || !loaded}
              aria-pressed={Math.abs(aspect - Number(ratio)) < 0.001}
              onClick={() => {
                setAspect(Number(ratio));
                setCrop({ x: 0, y: 0 });
                setZoom(1);
              }}
            >
              {label}
            </Button>
          ))}
        </div>
        <div className="flex gap-2" role="group" aria-label="Cor da foto">
          <Button
            type="button"
            variant={appearance === "color" ? "default" : "outline"}
            aria-pressed={appearance === "color"}
            disabled={busy}
            onClick={() => setAppearance("color")}
          >
            Colorida
          </Button>
          <Button
            type="button"
            variant={appearance === "bw" ? "default" : "outline"}
            aria-pressed={appearance === "bw"}
            disabled={busy}
            onClick={() => setAppearance("bw")}
          >
            Preto e branco
          </Button>
        </div>
        {error && (
          <p role="alert" className="text-sm text-red-400">
            {error}
          </p>
        )}
        <div className="flex flex-wrap justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={busy || !loaded}
            onClick={() => finish(null)}
          >
            Restaurar original
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={onCancel}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            disabled={busy || !loaded}
            onClick={() => {
              const a = area.current;
              if (a)
                void finish({
                  appearance,
                  crop: {
                    x: a.x / 100,
                    y: a.y / 100,
                    width: a.width / 100,
                    height: a.height / 100,
                  },
                });
            }}
          >
            {busy ? "Salvando…" : "Aplicar e salvar foto"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
