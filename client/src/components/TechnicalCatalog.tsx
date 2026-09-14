import { useState } from "react";
import { TECHNICAL_CATALOG_2026 as items, filterTechnicalCatalog, canAddCatalogItemToOperationalStock } from "@shared/technicalCatalog2026";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
export default function TechnicalCatalog({ onSelect }: { onSelect: (index: number) => void }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [brand, setBrand] = useState("all");
  const [line, setLine] = useState("all");
  const [page, setPage] = useState(0);
  const rows = filterTechnicalCatalog(items, { query, category, brand, line });
  const brands = Array.from(new Set(items.map(i => i.brandName))).sort();
  const lines = Array.from(new Set(items.filter(i => brand === "all" || i.brandName === brand).map(i => i.lineName))).sort();
  return <section className="space-y-4 rounded-xl border p-4 sm:p-6">
    <p className="text-xs font-semibold tracking-widest text-orange-500">BIBLIOTECA OPERACIONAL</p>
    <h2 className="text-2xl font-bold">Catálogo técnico de materiais</h2>
    <p className="text-sm text-muted-foreground">{items.length} referências do catálogo enviado. Escolha um item para cadastrar saldo, custo e proprietário. Fornecedores não são vinculados automaticamente.</p>
    <div className="grid gap-3 sm:grid-cols-3">
      <Input aria-label="Pesquisar catálogo" placeholder="Marca, linha, SKU, pontas…" value={query} onChange={e => { setQuery(e.target.value); setPage(0); }} />
      <select aria-label="Marca" className="rounded-md border bg-background p-2" value={brand} onChange={e => { setBrand(e.target.value); setLine("all"); setPage(0); }}><option value="all">Todas as marcas</option>{brands.map(b => <option key={b}>{b}</option>)}</select>
      <select aria-label="Linha" className="rounded-md border bg-background p-2" value={line} onChange={e => { setLine(e.target.value); setPage(0); }}><option value="all">Todas as linhas</option>{lines.map(l => <option key={l}>{l}</option>)}</select>
    </div>
    <div className="flex flex-wrap gap-2">{["all", ...Array.from(new Set(items.map(i => i.category)))].map(c => <Button key={c} size="sm" variant={category === c ? "default" : "outline"} onClick={() => { setCategory(c); setPage(0); }}>{c === "all" ? "Todas" : c}</Button>)}</div>
    <p className="text-sm text-muted-foreground">{rows.length} itens · Situação e evidência conforme o catálogo enviado. Confirme SKU, embalagem e registro antes da compra.</p>
    <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr>{["Marca / linha", "SKU / modelo", "Formato", "Pontas", "Diâmetro", "Taper", "Embalagem", "Aplicação / evidência", "Fornecedor", "Ação"].map(h => <th key={h} className="p-3 text-left whitespace-nowrap border-b">{h}</th>)}</tr></thead><tbody>
    {rows.slice(page * 40, (page + 1) * 40).map(i => <tr key={items.indexOf(i)} className="border-b align-top">
      <td className="p-3 min-w-40"><strong>{i.brandName}</strong><p className="text-muted-foreground">{i.lineName}</p></td>
      <td className="p-3 min-w-52">{i.name}<p className="text-xs text-muted-foreground">{i.sku || "SKU a confirmar"}</p></td>
      <td className="p-3">{i.format || "—"}</td><td className="p-3">{i.needleCount ?? "—"}</td><td className="p-3 whitespace-nowrap">{i.needleDiameter == null ? "—" : `${i.needleDiameter} mm`}</td><td className="p-3">{i.taper || "—"}</td>
      <td className="p-3 min-w-32">{i.packageUnit || `${i.unitsPerPackage} ${i.baseUnit}`}{i.volumeMl ? ` · ${i.volumeMl} ml` : ""}</td>
      <td className="p-3 min-w-48">{i.application || "—"}<p className={canAddCatalogItemToOperationalStock(i) ? "text-orange-400 mt-1" : "text-red-400 mt-1"}>{i.evidenceStatus}</p></td><td className="p-3 whitespace-nowrap text-muted-foreground">Sem vínculo</td>
      <td className="p-3"><Button size="sm" disabled={!canAddCatalogItemToOperationalStock(i)} onClick={() => onSelect(items.indexOf(i))}>{canAddCatalogItemToOperationalStock(i) ? "Estoque" : "Uso bloqueado"}</Button></td>
    </tr>)}
    </tbody></table></div>
    {rows.length === 0 && <p>Nenhum item encontrado. Ajuste os filtros.</p>}
    <div className="flex items-center justify-between"><Button variant="outline" disabled={page === 0} onClick={() => setPage(page - 1)}>Anterior</Button><span>{page + 1} / {Math.max(1, Math.ceil(rows.length / 40))}</span><Button variant="outline" disabled={(page + 1) * 40 >= rows.length} onClick={() => setPage(page + 1)}>Próxima</Button></div>
  </section>;
}
