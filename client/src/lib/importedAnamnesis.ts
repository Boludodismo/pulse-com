export type ImportedSource = {
  kind: string;
  key: string;
  row: number;
  headers: unknown[];
  values: unknown[];
  confirmedSessionDate?: string;
};

function field(source: ImportedSource, header: string): unknown {
  const index = source.headers.findIndex(value => typeof value === "string" && value.trim() === header);
  return index < 0 ? null : source.values[index];
}

export function originalText(value: unknown): string {
  if (value === null || value === undefined || value === "") return "Não informado";
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    if (record.type === "formula") return `${String(record.formula)} (fórmula original)`;
    if (typeof record.iso === "string") return record.iso;
    return JSON.stringify(value);
  }
  return String(value);
}

// Excel dates have no timezone. Display their calendar components without shifting the day.
function sourceIso(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (!["date", "datetime"].includes(String(record.type)) || typeof record.iso !== "string") return null;
  const day = record.iso.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  const date = new Date(`${day}T12:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === day ? record.iso : null;
}

function displayDate(value: unknown, withTime = false): string {
  const iso = sourceIso(value);
  if (!iso) return originalText(value);
  const day = iso.slice(0, 10).split("-").reverse().join("/");
  return withTime && iso.length >= 19 ? `${day} às ${iso.slice(11, 19)}` : day;
}

export function summarizeAnamnesis(source: ImportedSource) {
  if (source.kind !== "anamnese") return null;
  const amount = field(source, "Qual o valor da sua tatuagem?");
  const filledDate = field(source, "Data do preenchimento da ficha de anamnese");
  const submitted = field(source, "Carimbo de data/hora");
  const filledIso = sourceIso(filledDate);
  const submittedIso = sourceIso(submitted);
  const amountWarning = typeof amount === "number" && (amount < 50 || amount > 10000)
    ? "Valor numérico fora da faixa de R$ 50 a R$ 10.000: conferir a resposta original."
    : null;
  const dateWarning = !filledIso
    ? "Data de preenchimento ausente ou em formato a conferir."
    : submittedIso && filledIso.slice(0, 10) !== submittedIso.slice(0, 10)
      ? "A data declarada na ficha difere da data do envio."
      : null;
  return {
    key: source.key,
    row: source.row,
    sessionDate: source.confirmedSessionDate ? displayDate({type:'date',iso:source.confirmedSessionDate}) : null,
    amount: typeof amount === "number" && Number.isFinite(amount)
      ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 20 }).format(amount)
      : originalText(amount),
    amountWarning,
    filledDate: displayDate(filledDate),
    submitted: displayDate(submitted, true),
    dateWarning,
    artist: originalText(field(source, "Qual o nome do profissional que irá fazer sua tatuagem?")),
    description: originalText(field(source, "Descreva a arte e o local do corpo que vai realizar a sua tatuagem.")),
  };
}
