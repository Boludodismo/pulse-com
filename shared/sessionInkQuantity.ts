// These are the session capacities already used by the recipe service.
export const SESSION_CUP_ML = { P: 0.5, M: 1, G: 2, GG: 4 } as const;
export type SessionCupSize = keyof typeof SESSION_CUP_ML;
export const SESSION_DROPS_PER_ML = 20;
export type QuantityMaterial = { id?: string | number; name: string; unit: string; category?: string | null; configuration?: string | null; kind?: string };
export function isSessionCup(m: QuantityMaterial) { return !/suporte|bandeja|porta.batoque/i.test(m.name) && (m.kind === 'cup' || /batoque|ink\s*cap/i.test(m.name)); }
export function isSessionVaseline(m: QuantityMaterial) { return /vaselin|petroleum jelly/i.test(m.name); }
export function isSessionOintment(m: QuantityMaterial) { return isSessionVaseline(m) || /butter|pomada|karit|slip/i.test(m.name); }
export function isSessionDiluent(m: QuantityMaterial) { return m.kind === 'diluent' || /diluent|mixing|solu[cç][aã]o de mistura/i.test(m.name + ' ' + (m.category || '')); }
export function isSessionCartridge(m: QuantityMaterial) {
  return m.kind === 'cartridge' || /cartucho|agulha|needle|round liner|round shader|magnum/i.test(m.name + ' ' + (m.category || ''));
}
export function sessionUnitKey(unit: string) {
  const u = unit.trim().toLowerCase();
  if (/^(un|und|unid|unidade|unidades|pcs?|peças?)\.?$/.test(u)) return 'un';
  if (/^(par|pares)$/.test(u)) return 'par';
  if (/^(g|gr|gramas?)$/.test(u)) return 'g';
  if (/^(ml|mililitros?)$/.test(u)) return 'ml';
  return u;
}
export function isSessionCounted(m: QuantityMaterial) { return ['un', 'par'].includes(sessionUnitKey(m.unit)); }
export function validateSessionConsumption(m: QuantityMaterial, quantity: string, batch?: { unitSnapshot: string } | null) {
  validateSessionUnit(m);
  if (isSessionCounted(m) && !Number.isInteger(Number(quantity))) throw new Error('Informe uma quantidade inteira de unidades ou pares.');
  if (batch && sessionUnitKey(batch.unitSnapshot) !== sessionUnitKey(m.unit)) throw new Error('A unidade do lote diverge do estoque. Revise o lote e seu custo antes de consumir; o saldo não foi alterado.');
}
export function isSessionInk(m: QuantityMaterial) {
  return !isSessionCartridge(m) && !isSessionCup(m) && !isSessionOintment(m) && (isSessionDiluent(m) || m.kind === 'ink' || /tinta|pigment|\bink\b/i.test(m.name + ' ' + (m.category || '')));
}
/** Never reinterpret historic balances in another physical unit. */
export function validateSessionUnit(m: QuantityMaterial) {
  if ((isSessionCartridge(m) || isSessionCup(m)) && sessionUnitKey(m.unit) !== 'un') throw new Error('Cartuchos, agulhas e batoques devem ser cadastrados por unidade. Revise o cadastro, os lotes e os saldos antes de consumir.');
  if (/luva|glove/i.test(m.name + ' ' + (m.category || '')) && !isSessionCounted(m)) throw new Error('Luvas devem ser cadastradas por unidade ou par, conforme o saldo recebido.');
  if (isSessionVaseline(m) && sessionUnitKey(m.unit) !== 'g') throw new Error('A vaselina deve ser cadastrada em gramas (g). Revise o cadastro e o saldo antes de consumir; não há conversão segura de gotas para gramas.');
}
export function sessionCupSize(m: QuantityMaterial): SessionCupSize | undefined {
  return sessionCupSizeLabel(m)?.toUpperCase().match(/\b(GG|P|M|G)\b/)?.[1] as SessionCupSize | undefined;
}
export function inkStockQuantity(unit: string, count: number, mode: 'drops' | 'cup', size: SessionCupSize | number, dropsPerMl = SESSION_DROPS_PER_ML): string {
  if (!Number.isInteger(count) || count <= 0 || !Number.isFinite(dropsPerMl) || dropsPerMl <= 0) return '';
  const capacity = typeof size === 'number' ? size : SESSION_CUP_ML[size];
  if (mode === 'cup' && (!Number.isFinite(capacity) || capacity <= 0)) return '';
  const ml = mode === 'cup' ? count * capacity : count / dropsPerMl;
  const u = unit.trim().toLowerCase();
  if (u === 'ml' || u.includes('mililit')) return ml.toFixed(3);
  if (u.includes('gota') || ['drop', 'drops', 'gt'].includes(u)) return (ml * dropsPerMl).toFixed(3);
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
