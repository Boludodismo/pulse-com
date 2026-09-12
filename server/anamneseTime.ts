/**
 * Drizzle uses string-mode MySQL TIMESTAMP columns for anamnese requests.
 * Persist UTC SQL timestamps, and interpret those timezone-less values as UTC.
 */
export function parseAnamneseExpiry(value: string | Date): Date {
  const normalized = typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(value)
      ? value.replace(" ", "T") + "Z"
      : value;
  const date = normalized instanceof Date ? new Date(normalized.getTime()) : new Date(normalized);
  if (!Number.isFinite(date.getTime())) {
    throw new Error("Data de validade da anamnese inválida");
  }
  return date;
}

export function anamneseExpiryForDatabase(value: string | Date): string {
  return parseAnamneseExpiry(value).toISOString().slice(0, 19).replace("T", " ");
}
