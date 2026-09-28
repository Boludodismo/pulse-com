import { z } from "zod";
const cents = z.number().int().min(0).max(999999999);
export const finalizeSessionInput = z.object({
  procedureId: z.number().int().positive(),
  requestId: z.string().uuid(),
  previewHash: z.string().regex(/^[a-f0-9]{64}$/),
  totalCents: cents,
  receivedCents: cents,
  receiptIds: z.array(z.number().int().positive()).max(200),
  paymentMethod: z.enum([
    "dinheiro",
    "pix",
    "credito",
    "debito",
    "transferencia",
  ]),
  notes: z.string().trim().max(4000),
  nextSteps: z.string().trim().max(4000),
  reviewed: z.literal(true),
});
export function parseMoneyCents(value: string): number | null {
  const text = value.trim().replace(/\s/g, "");
  if (!text) return null;
  const normalized = text.includes(",")
    ? text.replace(/\./g, "").replace(",", ".")
    : text;
  if (!/^\d{1,7}(\.\d{1,2})?$/.test(normalized)) return null;
  const [whole, fraction = ""] = normalized.split(".");
  return Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
}
export function settlement(
  total: number,
  received: number,
  receiptIds: number[],
  receipts: { id: number; amount: number }[]
) {
  if (new Set(receiptIds).size !== receiptIds.length)
    throw new Error("Há recebimentos repetidos na seleção.");
  let previous = 0;
  for (const id of receiptIds) {
    const receipt = receipts.find(r => r.id === id);
    if (!receipt)
      throw new Error(
        "Um recebimento já foi utilizado ou não está disponível. Atualize a revisão."
      );
    previous += receipt.amount;
  }
  if (previous + received > total)
    throw new Error(
      "Os recebimentos ultrapassam o valor desta sessão. Revise os valores e os lançamentos selecionados."
    );
  return {
    totalCents: total,
    previousCents: previous,
    receivedCents: received,
    outstandingCents: total - previous - received,
  };
}
export function effectiveMinutes(
  start: string | null,
  end: string,
  pauses: { startedAt: string; endedAt: string | null }[]
) {
  const date = (s: string) => Date.parse(s.replace(" ", "T") + "Z");
  if (!start) return 0;
  const from = date(start),
    until = date(end);
  const intervals = pauses
    .map(p => [
      Math.max(from, date(p.startedAt)),
      Math.min(until, p.endedAt ? date(p.endedAt) : until),
    ])
    .filter(([a, b]) => Number.isFinite(a) && Number.isFinite(b) && b > a)
    .sort((a, b) => a[0] - b[0]);
  let paused = 0,
    last = from;
  for (const [a, b] of intervals) {
    paused += Math.max(0, b - Math.max(a, last));
    last = Math.max(last, b);
  }
  return Math.max(0, Math.round((until - from - paused) / 60000));
}
export function readFinalization(payload?: string | null): any | null {
  try {
    const p = JSON.parse(payload || "null");
    return p?.version === 1 && Number.isInteger(p.totalCents) ? p : null;
  } catch {
    return null;
  }
}
