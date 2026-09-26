export type LayerOrder = { layerKey: string; sortOrder: number };

/** The panel is front-to-back; the renderer paints the reverse order. */
export function visualLayerStack<T extends LayerOrder>(layers: readonly T[]): T[] {
  return [...layers].sort((a, b) => a.sortOrder - b.sortOrder).reverse();
}

export function completeVisualLayerOrder(stored: readonly LayerOrder[]): LayerOrder[] {
  return [
    stored.find(l => l.layerKey === "reference") ?? { layerKey: "reference", sortOrder: 0 },
    ...stored.filter(l => l.layerKey !== "reference" && l.layerKey !== "samples"),
    stored.find(l => l.layerKey === "samples") ?? { layerKey: "samples", sortOrder: 900 },
  ];
}

export function validateVisualLayerOrder(current: readonly string[], ordered: readonly string[], expected: readonly string[]) {
  if (current.length !== expected.length || current.some((key, index) => key !== expected[index])) {
    throw new Error("As camadas mudaram em outra janela. Confira a ordem atual e tente novamente.");
  }
  if (ordered.length !== current.length || new Set(ordered).size !== ordered.length || ordered.some(key => !current.includes(key))) {
    throw new Error("A ordem deve conter todas as camadas desta sessão, sem repetições.");
  }
}

export function moveVisualLayer(keys: readonly string[], key: string, targetIndex: number): string[] {
  if (!keys.includes(key)) return [...keys];
  const next = keys.filter(value => value !== key);
  next.splice(Math.max(0, Math.min(next.length, targetIndex)), 0, key);
  return next;
}
