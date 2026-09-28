export function chooseConsumptionSource(
  stock: number, quantity: number,
  batches: Array<{ id: number; remainingQuantity: string; expiresAt?: string | null }>,
  today: string, legacyExpiry?: string | null,
): { ready: true; batchId?: number } | { ready: false } {
  if (!Number.isFinite(quantity) || quantity <= 0 || stock < quantity) return { ready: false };
  const sources: Array<{ batchId?: number }> = batches
    .filter(b => Number(b.remainingQuantity) >= quantity && (!b.expiresAt || b.expiresAt.slice(0, 10) >= today))
    .map(b => ({ batchId: b.id }));
  const legacy = stock - batches.reduce((sum, b) => sum + Number(b.remainingQuantity), 0);
  if (legacy + 0.0000001 >= quantity && (!legacyExpiry || legacyExpiry.slice(0, 10) >= today)) sources.push({});
  return sources.length === 1 ? { ready: true, ...sources[0] } : { ready: false };
}
