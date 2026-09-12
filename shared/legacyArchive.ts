export const legacyArchiveTables = {
  anamnesis_risk_history: 'Histórico de riscos de anamnese',
  post_sale_followups: 'Acompanhamentos de pós-venda',
  material_lots: 'Lotes de materiais',
  catalog_brands: 'Marcas do catálogo anterior',
  catalog_product_lines: 'Linhas do catálogo anterior',
  catalog_variants: 'Itens do catálogo anterior',
  supplier_catalog_offerings: 'Ofertas de fornecedores',
  legacy_import_batches: 'Importações anteriores',
  legacy_import_rows: 'Registros de importações',
  procedure_kits: 'Kits anteriores',
  procedure_kit_items: 'Itens de kits',
  sales_leads: 'Oportunidades anteriores',
  waitlist_entries: 'Lista de espera anterior',
} as const;
export type LegacyArchiveTable = keyof typeof legacyArchiveTables;
export function isLegacyArchiveTable(table: string): table is LegacyArchiveTable {
  return Object.prototype.hasOwnProperty.call(legacyArchiveTables, table);
}
