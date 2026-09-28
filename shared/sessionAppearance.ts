import { z } from "zod";

const surface = z.object({ size: z.number().min(.85).max(1.35), opacity: z.number().min(.4).max(1) });
const dock = surface.extend({ expanded: z.boolean(), collapsed: z.boolean() });
export const sessionAppearanceSchema = z.object({
  version: z.literal(1), materials: dock, layers: dock, tools: surface, palette: surface,
});
export type SessionAppearance = z.infer<typeof sessionAppearanceSchema>;
export function defaultSessionAppearance(compact = false): SessionAppearance {
  return { version: 1,
    materials: { size: 1, opacity: .9, expanded: false, collapsed: compact },
    layers: { size: 1, opacity: .9, expanded: false, collapsed: compact },
    tools: { size: 1, opacity: .98 }, palette: { size: 1, opacity: .92 },
  };
}

export type MaterialSymbol = "liner" | "magnum" | "shader" | "needle" | "ink" | "cup" | "cream" | "gloves" | "diluent" | "soap" | "spray" | "paper" | "stencil" | "transfer" | "film" | "tape" | "mask" | "razor" | "gauze" | "apron" | "bag" | "sharps" | "pipette" | "machine" | "power" | "cable" | "pedal" | "marker" | "armrest" | "other";
export function materialSymbol(material: {name: string; category?: string | null; configuration?: string | null}): MaterialSymbol {
  // The specific item takes precedence over a broad inventory category.
  const t = `${material.name} ${material.configuration || ""}`.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (/coletor|perfuro|descarpack/.test(t)) return "sharps";
  if (/protetor|barreira|capa/.test(t)) return "film";
  if (/maquina|pen rotativa/.test(t)) return "machine";
  if (/fonte|bateria/.test(t)) return "power";
  if (/pedal/.test(t)) return "pedal";
  if (/clip.?cord|cabo/.test(t)) return "cable";
  if (/caneta|marcador/.test(t)) return "marker";
  if (/apoio|suporte de braco/.test(t)) return "armrest";
  if (/cartucho|magnum|round liner|round shader|\d(?:rl|rs|mg|rm|cm|m1)|\b(?:rl|rs|mg|rm|cm)\b/.test(t)) {
    if (/magnum|\d(?:mg|rm|cm|m1)|\b(?:mg|mag|rm|cm|m1)\b/.test(t)) return "magnum";
    return /shader|\d(rs)|\brs\b/.test(t) ? "shader" : "liner";
  }
  if (/agulha|needle/.test(t)) return "needle";
  if (/batoque|ink.?cap/.test(t)) return "cup";
  if (/luva|glove/.test(t)) return "gloves";
  if (/vaselina|pomada|creme|manteiga|ointment|butter/.test(t)) return "cream";
  if (/diluen|agua destil|agua deion|solucao de mistura/.test(t)) return "diluent";
  if (/gel transfer|transfer gel|stencil gel|transferencia/.test(t)) return "transfer";
  if (/stencil|hectograf|decalque|carbono/.test(t)) return "stencil";
  if (/green soap|sabonete|sabao|soap/.test(t)) return "soap";
  if (/alcool|antissep|desinf|cloro|borrif|spray/.test(t)) return "spray";
  if (/gaze|algodao/.test(t)) return "gauze";
  if (/lamina|barbeador|razor/.test(t)) return "razor";
  if (/mascara|mask/.test(t)) return "mask";
  if (/avental|campo|babador/.test(t)) return "apron";
  if (/bandagem|fita|esparadrapo/.test(t)) return "tape";
  if (/pelicula|filme|protetor|barreira|clip.?cord|second skin/.test(t)) return "film";
  if (/papel|lencol|toalha/.test(t)) return "paper";
  if (/coletor|perfuro|descarpack/.test(t)) return "sharps";
  if (/saco|sacola/.test(t)) return "bag";
  if (/pipeta|conta.gotas/.test(t)) return "pipette";
  if (/tinta|pigmento|\bink\b/.test(t)) return "ink";
  return material.category ? materialSymbol({name: material.category}) : "other";
}
export const materialSymbolLabels: Record<MaterialSymbol,string> = {
  liner:"RL", magnum:"MAG", shader:"RS", needle:"Agulha", ink:"Tinta", cup:"Batoque", cream:"Creme", gloves:"Luvas", diluent:"Diluente", soap:"Sabão", spray:"Solução", paper:"Papel", stencil:"Stencil", transfer:"Transfer", film:"Proteção", tape:"Bandagem", mask:"Máscara", razor:"Lâmina", gauze:"Gaze", apron:"Campo", bag:"Saco", sharps:"Coletor", pipette:"Pipeta", machine:"Máquina", power:"Fonte", cable:"Cabo", pedal:"Pedal", marker:"Caneta", armrest:"Apoio", other:"Insumo",
};
export function recordedColor(value: unknown): string | undefined {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value) ? value.toUpperCase() : undefined;
}
/** A target is not a measured result; never calculate a fictitious mixed pigment color. */
export function recipeDisplayColor(recipe: { result?: {hex?: string} | null; sampleId?: number | null }, samples: {id: string | number; hex: string}[]) {
  const result = recordedColor(recipe.result?.hex);
  if (result) return { color: result, label: "Resultado registrado" };
  const target = recordedColor(samples.find(s => String(s.id) === String(recipe.sampleId))?.hex);
  return { color: target, label: target ? "Cor da amostra de referência" : "Cor ainda não registrada" };
}
