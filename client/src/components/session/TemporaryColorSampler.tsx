import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Check, Pipette, X } from "lucide-react";

export type ColorValue = {
  hex: string;
  red: number;
  green: number;
  blue: number;
  cyan: number;
  magenta: number;
  yellow: number;
  black: number;
  labL: number;
  labA: number;
  labB: number;
};

function toHex(r: number, g: number, b: number) {
  return "#" + [r, g, b].map(v => Math.round(v).toString(16).padStart(2, "0")).join("");
}

function toCmyk(r: number, g: number, b: number) {
  const R = r / 255, G = g / 255, B = b / 255;
  const k = 1 - Math.max(R, G, B);
  if (k > .999) return [0, 0, 0, 100] as const;
  return [
    Math.round(((1 - R - k) / (1 - k)) * 100),
    Math.round(((1 - G - k) / (1 - k)) * 100),
    Math.round(((1 - B - k) / (1 - k)) * 100),
    Math.round(k * 100),
  ] as const;
}

function toLab(r: number, g: number, b: number) {
  const lin = (v: number) => {
    v /= 255;
    return v <= .04045 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4);
  };
  const R = lin(r), G = lin(g), B = lin(b);
  let x = (R * .4124564 + G * .3575761 + B * .1804375) / .95047;
  let y = (R * .2126729 + G * .7151522 + B * .0721750);
  let z = (R * .0193339 + G * .1191920 + B * .9503041) / 1.08883;
  const f = (v: number) => v > .008856 ? Math.cbrt(v) : (7.787 * v) + (16 / 116);
  x = f(x); y = f(y); z = f(z);
  return {
    labL: Math.max(0, Math.min(100, 116 * y - 16)),
    labA: 500 * (x - y),
    labB: 200 * (y - z),
  };
}

function fromRgb(r: number, g: number, b: number): ColorValue {
  const [cyan, magenta, yellow, black] = toCmyk(r, g, b);
  const lab = toLab(r, g, b);
  return { hex: toHex(r, g, b), red: r, green: g, blue: b, cyan, magenta, yellow, black, ...lab };
}

export default function TemporaryColorSampler({
  src,
  title,
  subtitle,
  onConfirm,
  onCancel,
}: {
  src: string;
  title: string;
  subtitle?: string;
  onConfirm: (color: ColorValue) => void | Promise<void>;
  onCancel: () => void;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const dragging = useRef(false);
  const [point, setPoint] = useState<{ xPct: number; yPct: number } | null>(null);
  const [color, setColor] = useState<ColorValue | null>(null);
  const [saving, setSaving] = useState(false);

  const sample = (clientX: number, clientY: number) => {
    const box = boxRef.current, image = imageRef.current;
    if (!box || !image || !image.naturalWidth || !image.naturalHeight) return;
    const rect = box.getBoundingClientRect();
    const fit = Math.min(rect.width / image.naturalWidth, rect.height / image.naturalHeight);
    const iw = image.naturalWidth * fit, ih = image.naturalHeight * fit;
    const ox = (rect.width - iw) / 2, oy = (rect.height - ih) / 2;
    const x = clientX - rect.left, y = clientY - rect.top;
    if (x < ox || x > ox + iw || y < oy || y > oy + ih) return;
    const xPct = (x - ox) / iw * 100, yPct = (y - oy) / ih * 100;
    const px = Math.max(0, Math.min(image.naturalWidth - 1, Math.round(xPct / 100 * image.naturalWidth)));
    const py = Math.max(0, Math.min(image.naturalHeight - 1, Math.round(yPct / 100 * image.naturalHeight)));
    const canvas = document.createElement("canvas");
    canvas.width = 5; canvas.height = 5;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;
    try {
      const sx = Math.max(0, Math.min(image.naturalWidth - 5, px - 2));
      const sy = Math.max(0, Math.min(image.naturalHeight - 5, py - 2));
      ctx.drawImage(image, sx, sy, 5, 5, 0, 0, 5, 5);
      const data = ctx.getImageData(0, 0, 5, 5).data;
      let r = 0, g = 0, b = 0, n = 0;
      for (let i = 0; i < data.length; i += 4) {
        r += data[i]; g += data[i + 1]; b += data[i + 2]; n++;
      }
      r = Math.round(r / n); g = Math.round(g / n); b = Math.round(b / n);
      setColor(fromRgb(r, g, b));
      setPoint({ xPct, yPct });
    } catch {
      // Local photo/object URLs are same-origin safe. Ignore until image is ready.
    }
  };

  const down = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragging.current = true;
    sample(e.clientX, e.clientY);
  };
  const move = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (dragging.current) sample(e.clientX, e.clientY);
  };
  const up = () => { dragging.current = false; };

  useEffect(() => () => { dragging.current = false; }, []);

  return <div className="temp-sampler-backdrop">
    <section className="temp-sampler-panel">
      <header className="temp-sampler-head">
        <div className="temp-sampler-preview" style={{ background: color?.hex || "#27272a" }} />
        <div>
          <strong>{title}</strong>
          <small>{subtitle || "Pressione e arraste o conta-gotas até encontrar o melhor ponto."}</small>
          {color && <div className="temp-sampler-values">
            <span>{color.hex.toUpperCase()}</span>
            <span>RGB {color.red}/{color.green}/{color.blue}</span>
            <span>CMYK {color.cyan}/{color.magenta}/{color.yellow}/{color.black}</span>
            <span>LAB {color.labL.toFixed(1)} {color.labA.toFixed(1)} {color.labB.toFixed(1)}</span>
          </div>}
        </div>
        <button onClick={onCancel} aria-label="Cancelar"><X size={18}/></button>
      </header>

      <div ref={boxRef} className="temp-sampler-imagebox" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
        <img ref={imageRef} src={src} alt="Imagem temporária para amostragem de cor" draggable={false}/>
        {point && <>
          <div className="temp-sampler-loupe" style={{
            left: point.xPct + "%",
            top: point.yPct + "%",
            backgroundImage: `url("${src}")`,
            backgroundPosition: point.xPct + "% " + point.yPct + "%",
          }}/>
          <div className="temp-sampler-cross" style={{ left: point.xPct + "%", top: point.yPct + "%" }}><Pipette size={14}/></div>
        </>}
      </div>

      <footer className="temp-sampler-actions">
        <button onClick={onCancel}>Cancelar</button>
        <button className="primary" disabled={!color || saving} onClick={async () => {
          if (!color) return;
          setSaving(true);
          try { await onConfirm(color); } finally { setSaving(false); }
        }}><Check size={16}/>{saving ? "Salvando…" : "Confirmar amostra"}</button>
      </footer>
      <p className="temp-sampler-footnote">A fotografia é temporária. O Tatuei salva somente os valores cromáticos confirmados.</p>
    </section>
  </div>;
}
