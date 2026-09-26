import { useId, useState } from "react";
import { allQuoteMedia, type QuoteEditorData } from "@shared/quoteProposal";
import { Label } from "@/components/ui/label";

export default function WatermarkControl({ editor, artistName, onChange }: { editor: QuoteEditorData; artistName: string; onChange: (value: number) => void }) {
  const id = useId();
  const patternId = `quote-watermark-${id.replace(/:/g, "")}`;
  const images = allQuoteMedia(editor).filter(image => image.protect);
  const [selected, setSelected] = useState("");
  const sample = images.find(image => image.key === selected) || images[0];
  return <div className="rounded-xl border bg-muted/20 p-4 space-y-3">
    <div className="flex items-center justify-between gap-3"><Label htmlFor={id}>Opacidade da marca d’água</Label><output htmlFor={id} className="font-semibold tabular-nums text-primary">{editor.watermarkOpacity}%</output></div>
    <input id={id} className="w-full h-8 accent-orange-500 cursor-pointer" type="range" min={20} max={100} step={1} value={editor.watermarkOpacity} onChange={e => onChange(Number(e.target.value))}/>
    <div className="flex justify-between text-xs text-muted-foreground"><span>Discreta · 20%</span><span>Intensa · 100%</span></div>
    {images.length > 1 && <select className="w-full rounded-md border bg-background p-2 text-sm" aria-label="Imagem para conferir a marca d’água" value={sample?.key || ""} onChange={e => setSelected(e.target.value)}>{images.map((image, i) => <option key={image.key + i} value={image.key}>{image.alt || `Imagem ${i + 1}`}</option>)}</select>}
    {sample ? <div className="relative overflow-hidden rounded-lg bg-zinc-900" aria-label="Prévia da intensidade da marca d’água">
      <img className="w-full h-56 object-contain" src={sample.url} alt={sample.alt || "Prévia da marca d’água"} draggable={false}/>
      <svg className="absolute inset-0 w-full h-full pointer-events-none" aria-hidden="true"><defs><pattern id={patternId} width="300" height="100" patternUnits="userSpaceOnUse" patternTransform="rotate(-24)"><rect x="2" y="12" width="296" height="48" rx="4" fill="black" opacity={editor.watermarkOpacity / 100 * .35}/><g fill="white" textAnchor="middle" fontSize="12" opacity={editor.watermarkOpacity / 100}><text x="150" y="31">{artistName || "Artista"}</text><text x="150" y="49">ARTE AUTORAL · PROPOSTA INDIVIDUAL</text></g></pattern></defs><rect width="100%" height="100%" fill={`url(#${patternId})`}/></svg>
    </div> : <p className="text-sm text-muted-foreground">Marque “Proteger arte com marca d’água” em uma imagem para conferir a intensidade aqui.</p>}
    <p className="text-xs text-muted-foreground">A intensidade vale para as imagens protegidas deste orçamento e para a logo sobreposta. Ajuste antes de finalizar. A prévia ilustra a intensidade; a distribuição da marca acompanha o tamanho de cada imagem.</p>
  </div>;
}
