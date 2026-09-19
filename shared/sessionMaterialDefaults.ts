/** Consumption is expressed in the stock's base unit, never in purchase packages. */
export function defaultSessionQuantity(material?: { name: string; unit: string; category?: string | null }): string {
  if (!material) return '1';
  if (material.unit === 'g' && /vaselin|vaseline|slip/i.test(material.name)) return '20';
  if (material.unit === 'ml' && /tinta|pigmento/i.test(material.category ?? '')) return '0.5';
  return '1';
}
