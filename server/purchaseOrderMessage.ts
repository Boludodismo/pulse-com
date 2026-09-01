export type QuoteOrderItem = {
  materialName?: string | null;
  materialCategory?: string | null;
  quantity: string | number;
  materialUnit?: string | null;
};

export type QuoteOrder = {
  items: QuoteOrderItem[];
};

const INTERNAL_NOISE_PATTERNS = [
  /_?novo item selecionado no cat[aá]logo t[eé]cnico_?/gi,
  /_?sugest[aã]o pelo estoque atual:[^·\n]*/gi,
  /\b(?:material_?id|variant_?id|catalog_?variant_?id|id)\s*[:#=]?\s*\d+\b/gi,
];

const CATEGORY_LABELS: Array<[RegExp, string]> = [
  [/cartuchos?|agulhas?/, "Cartucho"],
  [/tintas?|pigmentos?/, "Tinta"],
  [/barreiras?|descart[aá]veis/, "Descartável"],
  [/epis?|equipamentos? de prote[cç][aã]o/, "EPI"],
  [/higiene|antissepsia/, "Higiene"],
  [/stencil|transfer[eê]ncia/, "Stencil"],
  [/p[oó]s[- ]?tatuagem|aftercare/, "Pós-tatuagem"],
  [/limpeza/, "Limpeza"],
  [/sacos?|lixeiras?|res[ií]duos?/, "Resíduo"],
  [/equipamentos?|acess[oó]rios?/, "Acessório"],
];

function comparable(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/[^a-z0-9]+/g, "");
}

function tokenKey(value: string): string {
  const key = comparable(value);
  return /^[a-z]{5,}s$/.test(key) ? key.slice(0, -1) : key;
}

function cleanRawName(value: string): string {
  let cleaned = value;
  for (const pattern of INTERNAL_NOISE_PATTERNS) {
    cleaned = cleaned.replace(pattern, " ");
  }
  return cleaned
    .replace(/[•]/g, " ")
    .replace(/\s*[|/]\s*/g, " · ")
    .replace(/\s+/g, " ")
    .trim();
}

function categoryLabel(category?: string | null): string {
  const normalized = (category || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR");
  return (
    CATEGORY_LABELS.find(([pattern]) => pattern.test(normalized))?.[1] || ""
  );
}

function normalizeTechnicalSegment(segment: string): string[] {
  return segment
    .replace(/([A-Za-zÀ-ÿ0-9])[-_]+(?=[A-Za-zÀ-ÿ0-9])/g, "$1 ")
    .replace(/[()[\]{},;:]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
}

/**
 * Converte o nome técnico concatenado do catálogo em uma descrição legível.
 * Ex.: "Skin Ink · Round Liner · Round Liner 1005 · 1005-RL"
 * vira "Cartucho Skin Ink Round Liner 1005 RL".
 */
export function sanitizeCatalogItemName(item: QuoteOrderItem): string {
  const rawName = cleanRawName(item.materialName || "");
  const label = categoryLabel(item.materialCategory);
  const seen = new Set<string>();
  const result: string[] = [];

  const appendToken = (token: string) => {
    const key = tokenKey(token);
    if (!key || seen.has(key)) return;
    seen.add(key);
    result.push(token);
  };

  if (label) {
    for (const token of label.split(" ")) appendToken(token);
  }

  for (const segment of rawName.split(/\s*·\s*/)) {
    for (const token of normalizeTechnicalSegment(segment)) {
      appendToken(token);
    }
  }

  return result.join(" ").replace(/\s+/g, " ").trim() || "Material";
}

function formatQuantity(quantity: string | number): string {
  const parsed = Number(quantity);
  if (!Number.isFinite(parsed)) return String(quantity).trim() || "0";
  return parsed.toLocaleString("pt-BR", { maximumFractionDigits: 3 });
}

export function formatQuoteItemLine(item: QuoteOrderItem): string {
  const quantity = formatQuantity(item.quantity);
  const unit = cleanRawName(item.materialUnit || "un") || "un";
  return `• ${quantity} ${unit} — ${sanitizeCatalogItemName(item)}`;
}

/** Mensagem humanizada usada tanto no clipboard quanto no link do WhatsApp. */
export function buildWhatsAppOrderMessage(order: QuoteOrder): string {
  const itemLines = order.items.map(formatQuoteItemLine).join("\n");

  return [
    "Olá! Tudo bem?",
    "",
    "Gostaria de fazer um orçamento com vocês. Segue a lista dos materiais para verificar o valor e a disponibilidade para envio:",
    "",
    "📦 *Lista de Materiais:*",
    itemLines,
    "",
    "Assim que me passarem os valores e o prazo, já fecho o planejamento aqui e confirmamos o pedido.",
    "",
    "Obrigado!",
  ].join("\n");
}
