// These are the session capacities already used by the recipe service.
export const SESSION_CUP_ML = { P: 0.5, M: 1, G: 2, GG: 4 } as const;
export type SessionCupSize = keyof typeof SESSION_CUP_ML;
export const SESSION_DROPS_PER_ML = 20;
export type QuantityMaterial = { id?: string | number; name: string; unit: string; category?: string | null; configuration?: string | null; kind?: string };
export function isSessionCup(m: QuantityMaterial) { return !/suporte|bandeja|porta.batoque/i.test(m.name) && (m.kind === 'cup' || /batoque|ink\s*cap/i.test(m.name)); }
export function isSessionVaseline(m: QuantityMaterial) { return /vaselin|petroleum jelly/i.test(m.name); }
export function isSessionOintment(m: QuantityMaterial) { return isSessionVaseline(m) || /butter|pomada|karit|slip/i.test(m.name); }
export function isSessionDiluent(m: QuantityMaterial) { return m.kind === 'diluent' || /diluent|mixing|solu[cç][aã]o de mistura/i.test(m.name + ' ' + (m.category || '')); }
export function isSessionInk(m: QuantityMaterial) {
  return !isSessionCup(m) && !isSessionOintment(m) && (isSessionDiluent(m) || m.kind === 'ink' || /tinta|pigment|\bink\b/i.test(m.name + ' ' + (m.category || '')));
}
/** Never reinterpret historic balances in another physical unit. */
export function validateSessionUnit(m: QuantityMaterial) {
  if (isSessionVaseline(m) && m.unit !== 'g') throw new Error('A vaselina deve ser cadastrada em gramas (g). Revise o cadastro e o saldo antes de consumir; não há conversão segura de gotas para gramas.');
}
export function sessionCupSize(m: QuantityMaterial): SessionCupSize | undefined {
  return sessionCupSizeLabel(m)?.toUpperCase().match(/\b(GG|P|M|G)\b/)?.[1] as SessionCupSize | undefined;
}
export function inkStockQuantity(unit: string, count: number, mode: 'drops' | 'cup', size: SessionCupSize | number): string {
  if (!Number.isInteger(count) || count <= 0) return '';
  const capacity = typeof size === 'number' ? size : SESSION_CUP_ML[size];
  if (mode === 'cup' && (!Number.isFinite(capacity) || capacity <= 0)) return '';
  const ml = mode === 'cup' ? count * capacity : count / SESSION_DROPS_PER_ML;
  const u = unit.trim().toLowerCase();
  if (u === 'ml' || u.includes('mililit')) return ml.toFixed(3);
  if (u.includes('gota') || ['drop', 'drops', 'gt'].includes(u)) return (ml * SESSION_DROPS_PER_ML).toFixed(3);
  return '';
}

// The stock item's size is independent from the ink conversion defaults.
export function sessionCupSizeLabel(m: QuantityMaterial): string | undefined {
  return m.configuration?.trim() || m.name.toUpperCase().match(/\b(PP|GG|P|M|G)\b/)?.[1];
}
export function sessionMaterialName(m: QuantityMaterial): string {
  if (!isSessionCup(m)) return m.name;
  const name = m.name.replace(/\s*[—–-]\s*\d+\s*(?:un|unidades)\s*$/i, '').trim();
  const size = sessionCupSizeLabel(m);
  return size && !name.toUpperCase().endsWith(` · ${size.toUpperCase()}`) && !name.toUpperCase().split(/\s+/).includes(size.toUpperCase())
    ? `${name} · ${size}` : name;
}
