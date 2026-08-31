import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Building2, CheckCircle2, ExternalLink, Filter, Layers3, PackagePlus, Search, ShieldCheck, SlidersHorizontal, Store, Tag, TriangleAlert, X } from "lucide-react";

const ALL_VALUE = "all";
const SUPPLIER_LIST_INPUT = { activeOnly: true };

const CATALOG_CATEGORIES = [
  "Cartuchos e agulhas",
  "Tintas e pigmentos",
  "Batoques e acessórios",
  "Máquinas e alimentação",
  "Stencil e transferência",
  "Barreiras e descartáveis",
  "Higienização e processamento",
  "Pós-tatuagem",
  "Outros insumos",
];

const CARTRIDGE_FORMATS = ["RLF", "RL", "RS", "RMG", "Flat", "Magnum", "Soft Edge", "Curved", "Textured", "Whip"];

type CatalogVariant = {
  id: number;
  lineId: number;
  name: string;
  sku: string | null;
  category: string;
  format: string | null;
  needleCount: number | null;
  needleDiameter: string | null;
  taper: string | null;
  packageQuantity: number | null;
  packageUnit: string | null;
  baseUnit: string;
  purchaseUnit: string;
  unitsPerPackage: string;
  volumeMl: string | null;
  colorName: string | null;
  anvisaRegistration: string | null;
  anvisaStatus: "nao_aplicavel" | "regularizado" | "pendente" | "bloqueado";
  requiresLotControl: number;
  application: string | null;
  evidenceStatus: "fabricante" | "fornecedor" | "pendente" | "bloqueado";
  sourceUrl: string | null;
  notes: string | null;
  lineName: string;
  brandId: number;
  brandName: string;
  suppliers: Array<{
    id: number;
    supplierId: number;
    supplierName: string;
    supplierPhone: string | null;
    supplierWhatsapp: string | null;
    sourceUrl: string | null;
    evidenceStatus: "item" | "marca" | "pendente";
    lastVerifiedAt: number | null;
    notes: string | null;
    matchLevel: "item" | "linha" | "marca";
  }>;
};

function evidenceBadge(status: CatalogVariant["evidenceStatus"]) {
  const options = {
    fabricante: { label: "Fabricante", className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30" },
    fornecedor: { label: "Fornecedor", className: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30" },
    pendente: { label: "Confirmar SKU", className: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30" },
    bloqueado: { label: "Bloqueado", className: "bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30" },
  }[status];
  return <Badge variant="outline" className={`whitespace-nowrap text-[10px] ${options.className}`}>{options.label}</Badge>;
}

function supplierMatchLabel(level: "item" | "linha" | "marca") {
  if (level === "item") return "Fornece esta variação";
  if (level === "linha") return "Trabalha com a linha";
  return "Trabalha com a marca";
}

function presentVariant(variant: CatalogVariant) {
  return [variant.brandName, variant.lineName, variant.sku || variant.name].filter(Boolean).join(" · ");
}

export default function TechnicalCatalog() {
  const utils = trpc.useUtils();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState(ALL_VALUE);
  const [brandId, setBrandId] = useState<number | null>(null);
  const [lineId, setLineId] = useState<number | null>(null);
  const [format, setFormat] = useState(ALL_VALUE);
  const [supplierId, setSupplierId] = useState<number | null>(null);
  const [selected, setSelected] = useState<CatalogVariant | null>(null);
  const [stockDialogOpen, setStockDialogOpen] = useState(false);
  const [portfolioDialogOpen, setPortfolioDialogOpen] = useState(false);
  const [stockForm, setStockForm] = useState({ baseUnit: "un", purchaseUnit: "cx", unitsPerPackage: "1", packageQuantity: "", minStock: "", targetStock: "", avgPrice: "", supplierId: "", lotNumber: "", expiresAt: "", notes: "" });
  const [portfolioForm, setPortfolioForm] = useState({ supplierId: "", evidenceStatus: "item" as "item" | "marca" | "pendente", sourceUrl: "", notes: "" });

  const linesInput = useMemo(() => ({
    brandId: brandId ?? undefined,
    category: category === ALL_VALUE ? undefined : category,
  }), [brandId, category]);
  const searchInput = useMemo(() => ({
    query: query.trim() || undefined,
    category: category === ALL_VALUE ? undefined : category,
    brandId: brandId ?? undefined,
    lineId: lineId ?? undefined,
    formats: format === ALL_VALUE ? undefined : [format],
    supplierId: supplierId ?? undefined,
    limit: 100,
  }), [query, category, brandId, lineId, format, supplierId]);

  const { data: brands = [] } = trpc.catalog.brands.useQuery();
  const { data: lines = [] } = trpc.catalog.productLines.useQuery(linesInput);
  const { data: variants = [], isLoading } = trpc.catalog.search.useQuery(searchInput);
  const { data: suppliers = [] } = trpc.suppliers.list.useQuery(SUPPLIER_LIST_INPUT);

  const createOffering = trpc.catalog.createSupplierOffering.useMutation({
    onSuccess: () => {
      utils.catalog.search.invalidate();
      utils.catalog.supplierOfferings.invalidate();
      setPortfolioDialogOpen(false);
      setPortfolioForm({ supplierId: "", evidenceStatus: "item", sourceUrl: "", notes: "" });
      toast.success("Portfólio do fornecedor vinculado ao catálogo.");
    },
    onError: (error) => toast.error(error.message),
  });

  const addToStock = trpc.catalog.addToStock.useMutation({
    onSuccess: () => {
      utils.stock.listMaterials.invalidate();
      utils.stock.getLowStock.invalidate();
      setStockDialogOpen(false);
      setStockForm({ baseUnit: "un", purchaseUnit: "cx", unitsPerPackage: "1", packageQuantity: "", minStock: "", targetStock: "", avgPrice: "", supplierId: "", lotNumber: "", expiresAt: "", notes: "" });
      toast.success("Variação técnica adicionada ao estoque.");
    },
    onError: (error) => toast.error(error.message),
  });

  const openStock = (variant: CatalogVariant) => {
    setSelected(variant);
    setStockForm((current) => ({
      ...current,
      baseUnit: variant.baseUnit || "un",
      purchaseUnit: variant.purchaseUnit || "cx",
      unitsPerPackage: String(variant.unitsPerPackage || variant.packageQuantity || 1),
      supplierId: variant.suppliers[0] ? String(variant.suppliers[0].supplierId) : "",
    }));
    setStockDialogOpen(true);
  };

  const openPortfolio = (variant: CatalogVariant | null = selected, initialSupplierId = "") => {
    if (!variant) return;
    setSelected(variant);
    setPortfolioForm({ supplierId: initialSupplierId, evidenceStatus: "item", sourceUrl: "", notes: "" });
    setPortfolioDialogOpen(true);
  };

  const submitPortfolio = () => {
    if (!selected || !portfolioForm.supplierId) {
      toast.error("Selecione um fornecedor para vincular o portfólio.");
      return;
    }
    createOffering.mutate({
      supplierId: Number(portfolioForm.supplierId),
      brandId: selected.brandId,
      lineId: portfolioForm.evidenceStatus === "marca" ? undefined : selected.lineId,
      variantId: portfolioForm.evidenceStatus === "item" ? selected.id : undefined,
      evidenceStatus: portfolioForm.evidenceStatus,
      sourceUrl: portfolioForm.sourceUrl.trim(),
      notes: portfolioForm.notes.trim() || undefined,
      lastVerifiedAt: Date.now(),
    });
  };

  const submitStock = () => {
    if (!selected) return;
    if (!stockForm.packageQuantity || !stockForm.minStock || !stockForm.avgPrice || !stockForm.unitsPerPackage) {
      toast.error("Informe embalagens, conversão, estoque mínimo e preço.");
      return;
    }
    addToStock.mutate({
      variantId: selected.id,
      supplierId: stockForm.supplierId ? Number(stockForm.supplierId) : undefined,
      baseUnit: stockForm.baseUnit,
      purchaseUnit: stockForm.purchaseUnit,
      unitsPerPackage: Number(stockForm.unitsPerPackage),
      packageQuantity: Number(stockForm.packageQuantity),
      minStock: Number(stockForm.minStock),
      targetStock: Number(stockForm.targetStock || stockForm.minStock),
      avgPrice: Number(stockForm.avgPrice),
      lotNumber: stockForm.lotNumber.trim() || undefined,
      expiresAt: stockForm.expiresAt ? `${stockForm.expiresAt} 00:00:00` : undefined,
      notes: stockForm.notes.trim() || undefined,
    });
  };

  const activeSupplierNames = new Set(selected?.suppliers.map((supplier) => supplier.supplierId) ?? []);
  const unverifiedSuppliers = suppliers.filter((supplier) => !activeSupplierNames.has(supplier.id));

  return (
    <div className="space-y-5">
      <Card className="overflow-hidden border-orange-500/20 bg-gradient-to-br from-orange-500/[0.05] via-card to-card">
        <CardContent className="p-4 sm:p-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <div className="flex items-center gap-2 text-orange-500"><Layers3 className="h-5 w-5" /><span className="text-xs font-semibold uppercase tracking-[0.18em]">Biblioteca operacional</span></div>
              <h2 className="mt-2 text-2xl font-bold tracking-tight">Catálogo técnico de materiais</h2>
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">Localize variações reais por marca, modelo e configuração. Fornecedores só aparecem como compatíveis quando houver portfólio ou item vinculado.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="border-orange-500/30 bg-orange-500/10 text-orange-600 dark:text-orange-300">{brands.length} marcas</Badge>
              <Badge variant="outline" className="border-border bg-background/70">{variants.length} resultados</Badge>
              <Button size="sm" variant="outline" onClick={() => openPortfolio()} disabled={!selected} className="gap-2"><Building2 className="h-4 w-4" /> Vincular fornecedor</Button>
            </div>
          </div>

          <div className="mt-5 grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px_220px_220px]">
            <div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={query} onChange={(event) => setQuery(event.target.value)} className="h-11 bg-background pl-9" placeholder="Buscar marca, linha, SKU, pontas, diâmetro, taper ou fornecedor" /></div>
            <Select value={brandId ? String(brandId) : ALL_VALUE} onValueChange={(value) => { setBrandId(value === ALL_VALUE ? null : Number(value)); setLineId(null); }}>
              <SelectTrigger className="h-11 bg-background"><SelectValue placeholder="Marca" /></SelectTrigger><SelectContent><SelectItem value={ALL_VALUE}>Marca: todas</SelectItem>{brands.map((brand) => <SelectItem key={brand.id} value={String(brand.id)}>{brand.name}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={lineId ? String(lineId) : ALL_VALUE} onValueChange={(value) => setLineId(value === ALL_VALUE ? null : Number(value))}>
              <SelectTrigger className="h-11 bg-background"><SelectValue placeholder="Linha / modelo" /></SelectTrigger><SelectContent><SelectItem value={ALL_VALUE}>Linha / modelo: todos</SelectItem>{lines.map((line) => <SelectItem key={line.id} value={String(line.id)}>{line.brandName} · {line.name}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={supplierId ? String(supplierId) : ALL_VALUE} onValueChange={(value) => setSupplierId(value === ALL_VALUE ? null : Number(value))}>
              <SelectTrigger className="h-11 bg-background"><SelectValue placeholder="Fornecedor" /></SelectTrigger><SelectContent><SelectItem value={ALL_VALUE}>Fornecedor: todos os status</SelectItem>{suppliers.map((supplier) => <SelectItem key={supplier.id} value={String(supplier.id)}>{supplier.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Filter className="h-3.5 w-3.5 text-muted-foreground" />
            <Button size="sm" variant={category === ALL_VALUE ? "default" : "outline"} onClick={() => { setCategory(ALL_VALUE); setLineId(null); }} className="h-8 text-xs">Todas</Button>
            {CATALOG_CATEGORIES.map((item) => <Button key={item} size="sm" variant={category === item ? "default" : "outline"} onClick={() => { setCategory(item); setLineId(null); }} className="h-8 text-xs">{item.replace(" e ", " · ")}</Button>)}
          </div>
          {category === "Cartuchos e agulhas" && <div className="mt-2 flex flex-wrap gap-2"><SlidersHorizontal className="mt-1 h-3.5 w-3.5 text-muted-foreground" />{[ALL_VALUE, ...CARTRIDGE_FORMATS].map((item) => <Button key={item} size="sm" variant={format === item ? "secondary" : "ghost"} className="h-7 border text-[11px]" onClick={() => setFormat(item)}>{item === ALL_VALUE ? "Todos os formatos" : item}</Button>)}</div>}
        </CardContent>
      </Card>

      <div className="grid gap-5 2xl:grid-cols-[minmax(0,1fr)_340px]">
        <Card className="min-w-0">
          <CardHeader className="border-b py-4"><CardTitle className="flex items-center gap-2 text-base"><Tag className="h-4 w-4 text-orange-500" /> Variações técnicas <span className="text-xs font-normal text-muted-foreground">ordenadas por marca, linha, formato, pontas e diâmetro</span></CardTitle></CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow><TableHead>Marca / linha</TableHead><TableHead>SKU / modelo</TableHead><TableHead>Formato</TableHead><TableHead className="text-right">Pontas</TableHead><TableHead>Diâmetro</TableHead><TableHead>Taper</TableHead><TableHead>Embalagem</TableHead><TableHead>Aplicação</TableHead><TableHead>Fornecedor</TableHead><TableHead className="text-right">Ação</TableHead></TableRow></TableHeader>
                <TableBody>
                  {isLoading ? <TableRow><TableCell colSpan={10} className="py-10 text-center text-muted-foreground">Carregando catálogo técnico…</TableCell></TableRow> : variants.length === 0 ? <TableRow><TableCell colSpan={10} className="py-10 text-center text-muted-foreground">Nenhuma variação corresponde aos filtros atuais.</TableCell></TableRow> : variants.map((rawVariant) => {
                    const variant = rawVariant as CatalogVariant;
                    const isSelected = selected?.id === variant.id;
                    return <TableRow key={variant.id} onClick={() => setSelected(variant)} className={`cursor-pointer transition-colors ${isSelected ? "bg-orange-500/[0.07]" : "hover:bg-muted/50"}`}>
                      <TableCell className="min-w-[150px]"><p className="font-medium text-xs">{variant.brandName}</p><p className="text-[11px] text-muted-foreground">{variant.lineName}</p></TableCell>
                      <TableCell className="min-w-[150px]"><p className="font-mono text-xs">{variant.sku || variant.name}</p>{variant.sku && <p className="max-w-[150px] truncate text-[10px] text-muted-foreground">{variant.name}</p>}</TableCell>
                      <TableCell className="text-xs">{variant.format || "—"}</TableCell><TableCell className="text-right font-mono text-xs">{variant.needleCount ?? "—"}</TableCell><TableCell className="whitespace-nowrap font-mono text-xs">{variant.needleDiameter ? `${variant.needleDiameter} mm` : "—"}</TableCell><TableCell className="min-w-[90px] text-xs">{variant.taper || "—"}</TableCell>
                      <TableCell className="max-w-[170px] text-xs text-muted-foreground"><span className="line-clamp-2">{variant.packageUnit || `${variant.purchaseUnit} com ${Number(variant.unitsPerPackage)} ${variant.baseUnit}`}</span></TableCell>
                      <TableCell className="max-w-[170px]"><p className="line-clamp-2 text-xs">{variant.application || "Confirmar aplicação no SKU"}</p><div className="mt-1">{evidenceBadge(variant.evidenceStatus)}</div></TableCell>
                      <TableCell className="min-w-[120px]">{variant.suppliers.length ? <div className="flex flex-col gap-1">{variant.suppliers.slice(0, 2).map((supplier) => <Badge key={supplier.id} variant="outline" className="max-w-[120px] truncate text-[10px]">{supplier.supplierName}</Badge>)}</div> : <span className="text-[11px] text-muted-foreground">Sem vínculo</span>}</TableCell>
                      <TableCell className="text-right"><Button size="sm" variant="outline" disabled={variant.evidenceStatus === "bloqueado" || variant.anvisaStatus === "bloqueado"} className="h-8 gap-1 whitespace-nowrap text-xs" onClick={(event) => { event.stopPropagation(); openStock(variant); }}><PackagePlus className="h-3.5 w-3.5" /> {variant.anvisaStatus === "bloqueado" ? "Uso bloqueado" : "Estoque"}</Button></TableCell>
                    </TableRow>;
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Card className="h-fit overflow-hidden border-orange-500/20">
          <CardHeader className="border-b bg-orange-500/[0.04] py-4"><CardTitle className="flex items-center gap-2 text-base"><Store className="h-4 w-4 text-orange-500" /> Fornecedores compatíveis</CardTitle></CardHeader>
          <CardContent className="space-y-5 p-4">
            {!selected ? <div className="rounded-xl border border-dashed p-5 text-center"><Building2 className="mx-auto h-6 w-6 text-muted-foreground" /><p className="mt-2 text-sm font-medium">Selecione uma variação</p><p className="mt-1 text-xs text-muted-foreground">Veja fornecedores por marca, linha ou SKU sem associações presumidas.</p></div> : <>
              <div><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Variação selecionada</p><p className="mt-1 font-medium">{presentVariant(selected)}</p><div className="mt-2 flex flex-wrap gap-1">{evidenceBadge(selected.evidenceStatus)}{selected.sourceUrl && <a href={selected.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-orange-600 hover:underline"><ExternalLink className="h-3 w-3" /> Fonte</a>}</div></div>
              <div className="space-y-2"><p className="text-sm font-semibold">Fornece esta variação ou linha</p>{selected.suppliers.length ? selected.suppliers.map((supplier) => <div key={supplier.id} className="rounded-lg border bg-card p-3"><div className="flex items-start justify-between gap-2"><div><p className="text-sm font-medium">{supplier.supplierName}</p><p className="mt-0.5 text-[11px] text-muted-foreground">{supplierMatchLabel(supplier.matchLevel)}</p></div><CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" /></div>{(supplier.supplierWhatsapp || supplier.supplierPhone) && <p className="mt-2 text-xs text-muted-foreground">{supplier.supplierWhatsapp || supplier.supplierPhone}</p>}{supplier.lastVerifiedAt && <p className="mt-1 text-[11px] text-muted-foreground">Verificado em {new Date(supplier.lastVerifiedAt).toLocaleDateString("pt-BR")}</p>}</div>) : <div className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">Nenhum fornecedor com portfólio validado para esta variação.</div>}</div>
              <div className="space-y-2"><p className="text-sm font-semibold">Cadastrados sem portfólio validado</p>{unverifiedSuppliers.length ? <div className="space-y-2">{unverifiedSuppliers.map((supplier) => <button type="button" key={supplier.id} onClick={() => openPortfolio(selected, String(supplier.id))} className="w-full rounded-lg border p-3 text-left transition-colors hover:border-orange-500/50 hover:bg-orange-500/[0.04]"><p className="text-sm font-medium">{supplier.name}</p><p className="mt-0.5 text-[11px] text-muted-foreground">{supplier.whatsapp || supplier.phone || "Sem contato informado"}</p></button>)}</div> : <p className="text-xs text-muted-foreground">Todos os fornecedores ativos já possuem algum vínculo para este resultado.</p>}</div>
              <div className="rounded-lg border border-amber-500/25 bg-amber-500/[0.06] p-3"><div className="flex gap-2"><TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" /><p className="text-xs text-amber-900 dark:text-amber-200">O sistema não presume que um fornecedor trabalha com uma marca sem vínculo validado. Use “Vincular fornecedor” para cadastrar essa evidência.</p></div></div>
              <Button className="w-full gap-2" variant="outline" onClick={() => openPortfolio(selected)}><Building2 className="h-4 w-4" /> Vincular fornecedor</Button>
            </>}
          </CardContent>
        </Card>
      </div>

      <Dialog open={portfolioDialogOpen} onOpenChange={setPortfolioDialogOpen}>
        <DialogContent className="max-w-lg"><DialogHeader><DialogTitle>Vincular portfólio de fornecedor</DialogTitle></DialogHeader>{selected && <div className="space-y-4"><div className="rounded-lg border bg-muted/30 p-3 text-sm"><p className="font-medium">{presentVariant(selected)}</p><p className="mt-1 text-xs text-muted-foreground">Escolha o nível da evidência. O vínculo só será exibido nos resultados após ser salvo.</p></div><div><Label>Fornecedor *</Label><Select value={portfolioForm.supplierId} onValueChange={(value) => setPortfolioForm((current) => ({ ...current, supplierId: value }))}><SelectTrigger><SelectValue placeholder="Selecione o fornecedor" /></SelectTrigger><SelectContent>{suppliers.map((supplier) => <SelectItem key={supplier.id} value={String(supplier.id)}>{supplier.name}</SelectItem>)}</SelectContent></Select></div><div><Label>Nível de vínculo *</Label><Select value={portfolioForm.evidenceStatus} onValueChange={(value) => setPortfolioForm((current) => ({ ...current, evidenceStatus: value as typeof portfolioForm.evidenceStatus }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="item">Fornece esta variação/SKU</SelectItem><SelectItem value="marca">Trabalha com a marca</SelectItem><SelectItem value="pendente">Pendente de conferência</SelectItem></SelectContent></Select></div><div><Label>URL da evidência (opcional)</Label><Input value={portfolioForm.sourceUrl} onChange={(event) => setPortfolioForm((current) => ({ ...current, sourceUrl: event.target.value }))} placeholder="https://fornecedor.com/produto" /></div><div><Label>Observação comercial</Label><Input value={portfolioForm.notes} onChange={(event) => setPortfolioForm((current) => ({ ...current, notes: event.target.value }))} placeholder="Ex.: confirmou disponibilidade por WhatsApp" /></div></div>}<DialogFooter><Button variant="outline" onClick={() => setPortfolioDialogOpen(false)}>Cancelar</Button><Button disabled={createOffering.isPending} onClick={submitPortfolio}>{createOffering.isPending ? "Salvando…" : "Salvar vínculo"}</Button></DialogFooter></DialogContent>
      </Dialog>

      <Dialog open={stockDialogOpen} onOpenChange={setStockDialogOpen}>
        <DialogContent className="max-w-xl"><DialogHeader><DialogTitle>Adicionar variação ao estoque</DialogTitle></DialogHeader>{selected && <div className="max-h-[70vh] space-y-4 overflow-y-auto pr-1"><div className="rounded-lg border bg-muted/30 p-3"><p className="font-medium">{presentVariant(selected)}</p><p className="mt-1 text-xs text-muted-foreground">{[selected.format, selected.needleCount && `${selected.needleCount} pontas`, selected.needleDiameter && `${selected.needleDiameter} mm`, selected.taper].filter(Boolean).join(" · ") || "Confirmar configuração no SKU"}</p></div><div className="grid grid-cols-2 gap-3"><div><Label>Quantidade comprada *</Label><Input type="number" min="0" step="0.01" value={stockForm.packageQuantity} onChange={(event) => setStockForm((current) => ({ ...current, packageQuantity: event.target.value }))} placeholder="Ex.: 5" /></div><div><Label>Unidade de compra *</Label><Select value={stockForm.purchaseUnit} onValueChange={(value) => setStockForm((current) => ({ ...current, purchaseUnit: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="cx">Caixa</SelectItem><SelectItem value="frasco">Frasco</SelectItem><SelectItem value="pct">Pacote</SelectItem><SelectItem value="rolo">Rolo</SelectItem><SelectItem value="un">Unidade</SelectItem></SelectContent></Select></div><div><Label>Conteúdo por embalagem *</Label><Input type="number" min="0.001" step="0.001" value={stockForm.unitsPerPackage} onChange={(event) => setStockForm((current) => ({ ...current, unitsPerPackage: event.target.value }))} /></div><div><Label>Unidade de consumo *</Label><Select value={stockForm.baseUnit} onValueChange={(value) => setStockForm((current) => ({ ...current, baseUnit: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="un">Unidade</SelectItem><SelectItem value="par">Par</SelectItem><SelectItem value="ml">ml</SelectItem><SelectItem value="g">g</SelectItem><SelectItem value="m">Metro</SelectItem><SelectItem value="rolo">Rolo</SelectItem></SelectContent></Select></div><div className="col-span-2 rounded-lg border border-orange-500/25 bg-orange-500/[0.06] p-3 text-sm"><span className="font-medium">Entrada calculada:</span> {(Number(stockForm.packageQuantity) * Number(stockForm.unitsPerPackage) || 0).toLocaleString("pt-BR")} {stockForm.baseUnit}</div><div><Label>Estoque mínimo *</Label><Input type="number" min="0" step="0.01" value={stockForm.minStock} onChange={(event) => setStockForm((current) => ({ ...current, minStock: event.target.value }))} /></div><div><Label>Estoque desejado</Label><Input type="number" min="0" step="0.01" value={stockForm.targetStock} onChange={(event) => setStockForm((current) => ({ ...current, targetStock: event.target.value }))} placeholder="Usado no pedido sugerido" /></div><div><Label>Preço por embalagem (R$) *</Label><Input type="number" min="0" step="0.01" value={stockForm.avgPrice} onChange={(event) => setStockForm((current) => ({ ...current, avgPrice: event.target.value }))} /></div><div><Label>Fornecedor</Label><Select value={stockForm.supplierId || ALL_VALUE} onValueChange={(value) => setStockForm((current) => ({ ...current, supplierId: value === ALL_VALUE ? "" : value }))}><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger><SelectContent><SelectItem value={ALL_VALUE}>Não informado</SelectItem>{suppliers.map((supplier) => <SelectItem key={supplier.id} value={String(supplier.id)}>{supplier.name}</SelectItem>)}</SelectContent></Select></div>{selected.requiresLotControl === 1 && <><div><Label>Lote</Label><Input value={stockForm.lotNumber} onChange={(event) => setStockForm((current) => ({ ...current, lotNumber: event.target.value }))} /></div><div><Label>Validade</Label><Input type="date" value={stockForm.expiresAt} onChange={(event) => setStockForm((current) => ({ ...current, expiresAt: event.target.value }))} /></div></>}<div className="col-span-2"><Label>Observações do recebimento</Label><Input value={stockForm.notes} onChange={(event) => setStockForm((current) => ({ ...current, notes: event.target.value }))} placeholder="Ex.: conferir integridade da embalagem" /></div></div></div>}<DialogFooter><Button variant="outline" onClick={() => setStockDialogOpen(false)}>Cancelar</Button><Button disabled={addToStock.isPending} onClick={submitStock} className="gap-2"><PackagePlus className="h-4 w-4" /> {addToStock.isPending ? "Adicionando…" : "Adicionar ao estoque"}</Button></DialogFooter></DialogContent>
      </Dialog>
    </div>
  );
}
