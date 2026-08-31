import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useSyncToast } from "@/hooks/useSyncToast";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { SkeletonCard } from "@/components/SkeletonCard";
import { SkeletonTable } from "@/components/SkeletonTable";
import TechnicalCatalog from "@/components/TechnicalCatalog";
import { toast } from "sonner";
import {
  Package,
  AlertTriangle,
  Plus,
  ArrowUpCircle,
  ArrowDownCircle,
  Settings2,
  Trash2,
  History,
  Layers,
} from "lucide-react";

const CATEGORIES = [
  "Agulhas",
  "Tintas",
  "Equipamentos",
  "Higiene e Proteção",
  "Cuidados Pós-Tatuagem",
  "Papelaria",
  "Outros",
];

const UNITS = ["un", "cx", "pct", "ml", "L", "g", "kg", "m", "par", "rolo"];

type MaterialForm = {
  name: string;
  category: string;
  unit: string;
  purchaseUnit: string;
  unitsPerPackage: string;
  currentStock: string;
  minStock: string;
  targetStock: string;
  avgPrice: string;
  supplierId: string;
  notes: string;
};

type MovementForm = {
  type: "entrada" | "saida" | "ajuste";
  quantity: string;
  inputUnit: "base" | "package";
  lotNumber: string;
  expiresAt: string;
  reason: string;
};

type KitItemForm = {
  materialId: string;
  quantity: string;
  unit: string;
};

type KitForm = {
  name: string;
  category: string;
  description: string;
  items: KitItemForm[];
};

const emptyKitForm = (): KitForm => ({
  name: "",
  category: "Geral",
  description: "",
  items: [{ materialId: "", quantity: "1", unit: "un" }],
});

const emptyForm = (): MaterialForm => ({
  name: "",
  category: "",
  unit: "un",
  purchaseUnit: "un",
  unitsPerPackage: "1",
  currentStock: "0",
  minStock: "0",
  targetStock: "0",
  avgPrice: "0",
  supplierId: "",
  notes: "",
});

export default function Stock() {
  const utils = trpc.useUtils();

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<MaterialForm>(emptyForm());

  const [showMovement, setShowMovement] = useState(false);
  const [movementMaterialId, setMovementMaterialId] = useState<number | null>(null);
  const [movementMaterialName, setMovementMaterialName] = useState("");
  const [movForm, setMovForm] = useState<MovementForm>({ type: "entrada", quantity: "", inputUnit: "base", lotNumber: "", expiresAt: "", reason: "" });

  const [showHistory, setShowHistory] = useState(false);
  const [historyMaterialId, setHistoryMaterialId] = useState<number | null>(null);
  const [historyMaterialName, setHistoryMaterialName] = useState("");
  const [showKitForm, setShowKitForm] = useState(false);
  const [kitForm, setKitForm] = useState<KitForm>(emptyKitForm());
  const [stockView, setStockView] = useState<"inventory" | "catalog">("inventory");

  const { data: materials = [], isLoading } = trpc.stock.listMaterials.useQuery({ activeOnly: true });
  const { data: lowStock = [] } = trpc.stock.getLowStock.useQuery();
  const { data: reorderSuggestions = [] } = trpc.stock.getReorderSuggestions.useQuery();
  const { data: suppliers = [] } = trpc.suppliers.list.useQuery({ activeOnly: true });
  const { data: movements = [] } = trpc.stock.listMovements.useQuery(
    { materialId: historyMaterialId ?? undefined, limit: 100 },
    { enabled: showHistory && historyMaterialId !== null }
  );
  const { data: kits = [] } = trpc.kits.list.useQuery();

  const { notifySync } = useSyncToast();

  const createMaterial = trpc.stock.createMaterial.useMutation({
    onSuccess: () => {
      utils.stock.listMaterials.invalidate();
      utils.stock.getLowStock.invalidate();
      setShowForm(false);
      setForm(emptyForm());
      toast.success("Material cadastrado com sucesso!");
      notifySync("material");
    },
    onError: (e) => toast.error(e.message),
  });

  const updateMaterial = trpc.stock.updateMaterial.useMutation({
    onSuccess: () => {
      utils.stock.listMaterials.invalidate();
      utils.stock.getLowStock.invalidate();
      setShowForm(false);
      setEditingId(null);
      setForm(emptyForm());
      toast.success("Material atualizado!");
      notifySync("material");
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteMaterial = trpc.stock.deleteMaterial.useMutation({
    onSuccess: () => {
      utils.stock.listMaterials.invalidate();
      utils.stock.getLowStock.invalidate();
      toast.success("Material removido.");
    },
    onError: (e) => toast.error(e.message),
  });

  const addMovement = trpc.stock.addMovement.useMutation({
    onSuccess: (result) => {
      utils.stock.listMaterials.invalidate();
      utils.stock.getLowStock.invalidate();
      utils.stock.listMovements.invalidate();
      setShowMovement(false);
      setMovForm({ type: "entrada", quantity: "", inputUnit: "base", lotNumber: "", expiresAt: "", reason: "" });
      toast.success(`Movimentação registrada! Estoque: ${result.previousStock} → ${result.newStock}`);
      notifySync("movimentacao");
    },
    onError: (e) => toast.error(e.message),
  });

  const createKit = trpc.kits.create.useMutation({
    onSuccess: () => {
      utils.kits.list.invalidate();
      setShowKitForm(false);
      setKitForm(emptyKitForm());
      toast.success("Kit de procedimento criado!");
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteKit = trpc.kits.delete.useMutation({
    onSuccess: () => {
      utils.kits.list.invalidate();
      toast.success("Kit removido.");
    },
    onError: (e) => toast.error(e.message),
  });

  const handleSubmit = () => {
    if (!form.name || !form.category || !form.unit) {
      toast.error("Preencha os campos obrigatórios.");
      return;
    }
    const payload = {
      name: form.name,
      category: form.category,
      unit: form.unit,
      baseUnit: form.unit,
      purchaseUnit: form.purchaseUnit,
      unitsPerPackage: parseFloat(form.unitsPerPackage) || 1,
      currentStock: parseFloat(form.currentStock) || 0,
      minStock: parseFloat(form.minStock) || 0,
      targetStock: parseFloat(form.targetStock) || parseFloat(form.minStock) || 0,
      avgPrice: parseFloat(form.avgPrice) || 0,
      supplierId: form.supplierId ? parseInt(form.supplierId) : undefined,
      notes: form.notes || undefined,
    };
    if (editingId) {
      updateMaterial.mutate({ id: editingId, ...payload });
    } else {
      createMaterial.mutate(payload);
    }
  };

  const handleEdit = (mat: any) => {
    setEditingId(mat.id);
    setForm({
      name: mat.name,
      category: mat.category,
      unit: mat.unit,
      purchaseUnit: mat.purchaseUnit || mat.unit,
      unitsPerPackage: String(mat.unitsPerPackage || 1),
      currentStock: String(mat.currentStock),
      minStock: String(mat.minStock),
      targetStock: String(mat.targetStock || mat.minStock),
      avgPrice: String(mat.avgPrice),
      supplierId: mat.supplierId ? String(mat.supplierId) : "",
      notes: mat.notes || "",
    });
    setShowForm(true);
  };

  const handleMovement = (mat: any) => {
    setMovementMaterialId(mat.id);
    setMovementMaterialName(mat.name);
    setMovForm({ type: "entrada", quantity: "", inputUnit: "base", lotNumber: "", expiresAt: "", reason: "" });
    setShowMovement(true);
  };

  const handleMovementSubmit = () => {
    if (!movementMaterialId || !movForm.quantity) {
      toast.error("Informe a quantidade.");
      return;
    }
    const material = materials.find((candidate) => candidate.id === movementMaterialId);
    const conversionFactor = movForm.type === "ajuste" || movForm.inputUnit === "base" ? 1 : Number(material?.unitsPerPackage || 1);
    addMovement.mutate({
      materialId: movementMaterialId,
      type: movForm.type,
      quantity: parseFloat(movForm.quantity),
      inputQuantity: parseFloat(movForm.quantity),
      inputUnit: movForm.inputUnit === "package" ? (material?.purchaseUnit || "embalagem") : (material?.baseUnit || material?.unit || "un"),
      conversionFactor,
      lotNumber: movForm.lotNumber.trim() || undefined,
      expiresAt: movForm.expiresAt ? `${movForm.expiresAt} 00:00:00` : undefined,
      source: movForm.type === "entrada" ? "compra" : movForm.type === "ajuste" ? "ajuste" : "manual",
      reason: movForm.reason || undefined,
    });
  };

  const addKitItem = () => {
    setKitForm((form) => ({ ...form, items: [...form.items, { materialId: "", quantity: "1", unit: "un" }] }));
  };

  const removeKitItem = (index: number) => {
    setKitForm((form) => ({ ...form, items: form.items.filter((_, itemIndex) => itemIndex !== index) }));
  };

  const updateKitItem = (index: number, patch: Partial<KitItemForm>) => {
    setKitForm((form) => ({
      ...form,
      items: form.items.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item),
    }));
  };

  const handleKitSubmit = () => {
    const items = kitForm.items
      .filter((item) => item.materialId && Number(item.quantity) > 0)
      .map((item) => ({ materialId: Number(item.materialId), quantity: Number(item.quantity), unit: item.unit || "un" }));
    if (!kitForm.name.trim() || items.length === 0) {
      toast.error("Informe o nome e pelo menos um material válido.");
      return;
    }
    createKit.mutate({
      name: kitForm.name.trim(),
      category: kitForm.category.trim() || "Geral",
      description: kitForm.description.trim() || undefined,
      items,
    });
  };

  const filtered = materials.filter((m) => {
    const matchSearch = m.name.toLowerCase().includes(search.toLowerCase());
    const matchCat = categoryFilter === "all" || m.category === categoryFilter;
    return matchSearch && matchCat;
  });

  const getStockStatus = (mat: any) => {
    const current = parseFloat(String(mat.currentStock));
    const min = parseFloat(String(mat.minStock));
    if (min <= 0) return "ok";
    if (current <= 0) return "empty";
    if (current <= min) return "low";
    return "ok";
  };

  const statusBadge = (status: string) => {
    if (status === "empty") return <Badge variant="destructive">Sem estoque</Badge>;
    if (status === "low") return <Badge className="bg-yellow-600 text-white">Estoque baixo</Badge>;
    return <Badge variant="secondary" className="bg-green-900 text-green-300">OK</Badge>;
  };

  const movTypeLabel = (type: string) => {
    if (type === "entrada") return <span className="text-green-400 flex items-center gap-1"><ArrowUpCircle className="w-3 h-3" />Entrada</span>;
    if (type === "saida") return <span className="text-red-400 flex items-center gap-1"><ArrowDownCircle className="w-3 h-3" />Saída</span>;
    return <span className="text-blue-400">Ajuste</span>;
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold text-foreground flex items-center gap-2">
              <Package className="w-5 sm:w-6 h-5 sm:h-6 text-orange-500 flex-shrink-0" />
              <span>Estoque de Materiais</span>
            </h1>
            <p className="text-muted-foreground text-xs sm:text-sm mt-1">Gerencie os insumos e materiais do estúdio</p>
          </div>
          <Button onClick={() => { setEditingId(null); setForm(emptyForm()); setShowForm(true); }}
            className="bg-orange-500 hover:bg-orange-600 text-white w-full sm:w-auto">
            <Plus className="w-4 h-4 mr-2" /> <span className="hidden sm:inline">Novo Material</span><span className="sm:hidden">Novo</span>
          </Button>
        </div>

        <div className="flex flex-wrap gap-2 border-b pb-4">
          <Button variant={stockView === "inventory" ? "default" : "outline"} size="sm" onClick={() => setStockView("inventory")} className={stockView === "inventory" ? "bg-orange-500 hover:bg-orange-600" : ""}>Estoque operacional</Button>
          <Button variant={stockView === "catalog" ? "default" : "outline"} size="sm" onClick={() => setStockView("catalog")} className={stockView === "catalog" ? "bg-orange-500 hover:bg-orange-600" : ""}>Catálogo técnico</Button>
        </div>

        {stockView === "catalog" ? <TechnicalCatalog /> : <>

        {/* Alertas de estoque baixo */}
        {lowStock.length > 0 && (
          <Card className="border-yellow-600/50 bg-yellow-950/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-yellow-400 text-sm flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                {lowStock.length} {lowStock.length === 1 ? "material com estoque baixo" : "materiais com estoque baixo"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {reorderSuggestions.map((m) => (
                  <Badge key={m.id} variant="outline" className="border-yellow-600 text-yellow-300 text-xs">
                    {m.name} — pedir {m.suggestedPackages} {m.purchaseUnit} ({m.suggestedBaseUnits} {m.baseUnit})
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Filtros */}
        <div className="flex gap-2 flex-col sm:flex-row">
          <Input
            placeholder="Buscar material..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 bg-card border-border text-sm"
          />
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-full sm:w-48 bg-card border-border text-sm">
              <SelectValue placeholder="Categoria" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as categorias</SelectItem>
              {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {/* Tabela */}
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs sm:text-sm">Material</TableHead>
                  <TableHead className="hidden sm:table-cell text-xs sm:text-sm">Categoria</TableHead>
                  <TableHead className="text-right text-xs sm:text-sm">Estoque</TableHead>
                  <TableHead className="hidden md:table-cell text-right text-xs sm:text-sm">Mínimo</TableHead>
                  <TableHead className="hidden lg:table-cell text-right text-xs sm:text-sm">Preço</TableHead>
                  <TableHead className="hidden lg:table-cell text-xs sm:text-sm">Fornecedor</TableHead>
                  <TableHead className="text-xs sm:text-sm">Status</TableHead>
                  <TableHead className="text-right text-xs sm:text-sm">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Nenhum material encontrado.</TableCell></TableRow>
                ) : filtered.map((mat) => {
                  const status = getStockStatus(mat);
                  return (
                    <TableRow key={mat.id} className={status !== "ok" ? "bg-yellow-950/10" : ""}>
                      <TableCell className="font-medium text-xs sm:text-sm">{mat.name}</TableCell>
                      <TableCell className="hidden sm:table-cell"><Badge variant="outline" className="text-xs">{mat.category}</Badge></TableCell>
                      <TableCell className="text-right font-mono text-xs sm:text-sm">
                        <span className={status === "empty" ? "text-red-400" : status === "low" ? "text-yellow-400" : ""}>
                          {parseFloat(String(mat.currentStock))} {mat.baseUnit || mat.unit}
                        </span>
                        {Number(mat.unitsPerPackage) > 1 && <span className="block text-[10px] text-muted-foreground">≈ {(Number(mat.currentStock) / Number(mat.unitsPerPackage)).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} {mat.purchaseUnit}</span>}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-right font-mono text-xs text-muted-foreground">{parseFloat(String(mat.minStock))} {mat.unit}</TableCell>
                      <TableCell className="hidden lg:table-cell text-right font-mono text-xs text-muted-foreground">
                        {parseFloat(String(mat.avgPrice)) > 0
                          ? `R$ ${parseFloat(String(mat.avgPrice)).toFixed(2)}`
                          : "—"}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-muted-foreground text-xs">{mat.supplierName || "—"}</TableCell>
                      <TableCell className="text-xs sm:text-sm">{statusBadge(status)}</TableCell>
                      <TableCell>
                        <div className="flex gap-0.5 justify-end">
                          <Button size="icon" variant="ghost" className="h-8 w-8" title="Movimentar estoque"
                            onClick={() => handleMovement(mat)}>
                            <ArrowUpCircle className="w-3 h-3 sm:w-4 sm:h-4 text-green-400" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-8 w-8" title="Histórico"
                            onClick={() => { setHistoryMaterialId(mat.id); setHistoryMaterialName(mat.name); setShowHistory(true); }}>
                            <History className="w-3 h-3 sm:w-4 sm:h-4 text-blue-400" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-8 w-8" title="Editar"
                            onClick={() => handleEdit(mat)}>
                            <Settings2 className="w-3 h-3 sm:w-4 sm:h-4" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-8 w-8" title="Remover"
                            onClick={() => { if (confirm("Remover este material?")) deleteMaterial.mutate({ id: mat.id }); }}>
                            <Trash2 className="w-3 h-3 sm:w-4 sm:h-4 text-red-400" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Resumo */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4">
              <p className="text-muted-foreground text-xs">Total de Materiais</p>
              <p className="text-2xl font-bold">{materials.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-muted-foreground text-xs">Estoque Baixo</p>
              <p className="text-2xl font-bold text-yellow-400">{lowStock.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-muted-foreground text-xs">Sem Estoque</p>
              <p className="text-2xl font-bold text-red-400">
                {materials.filter(m => parseFloat(String(m.currentStock)) <= 0 && parseFloat(String(m.minStock)) > 0).length}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-muted-foreground text-xs">Categorias</p>
              <p className="text-2xl font-bold">{new Set(materials.map(m => m.category)).size}</p>
            </CardContent>
          </Card>
        </div>

        {/* Kits de procedimento */}
        <Card>
          <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base sm:text-lg">Kits de Procedimento</CardTitle>
              <p className="text-xs text-muted-foreground mt-1">Conjuntos de materiais aplicáveis em um clique na POD Session.</p>
            </div>
            <Button size="sm" onClick={() => { setKitForm(emptyKitForm()); setShowKitForm(true); }} className="w-full sm:w-auto">
              <Plus className="w-4 h-4 mr-2" /> Novo kit
            </Button>
          </CardHeader>
          <CardContent>
            {kits.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum kit cadastrado. Crie um kit para acelerar o lançamento de insumos.</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {kits.map((kit) => (
                  <div key={kit.id} className="rounded-lg border bg-card/60 p-3 flex items-start gap-3">
                    <Layers className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">{kit.name}</p>
                      <p className="text-xs text-muted-foreground">{kit.category}</p>
                      {kit.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{kit.description}</p>}
                    </div>
                    <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" title="Remover kit"
                      onClick={() => { if (confirm("Remover este kit?")) deleteKit.mutate({ id: kit.id }); }}>
                      <Trash2 className="w-3.5 h-3.5 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        </>}
      </div>

      {/* Dialog: Cadastro/Edição de Material */}
      <Dialog open={showForm} onOpenChange={(o) => { setShowForm(o); if (!o) { setEditingId(null); setForm(emptyForm()); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar Material" : "Novo Material"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label>Nome do Material *</Label>
                <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ex: Cartucho 7RL" />
              </div>
              <div>
                <Label>Categoria *</Label>
                <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Unidade de consumo *</Label>
                <Select value={form.unit} onValueChange={v => setForm(f => ({ ...f, unit: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {UNITS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Unidade de compra</Label>
                <Select value={form.purchaseUnit} onValueChange={v => setForm(f => ({ ...f, purchaseUnit: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{["un", "cx", "pct", "frasco", "galão", "rolo"].map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Conteúdo por embalagem</Label>
                <Input type="number" min="0.001" step="0.001" value={form.unitsPerPackage} onChange={e => setForm(f => ({ ...f, unitsPerPackage: e.target.value }))} />
              </div>
              <div>
                <Label>Estoque Atual</Label>
                <Input type="number" min="0" step="0.01" value={form.currentStock}
                  onChange={e => setForm(f => ({ ...f, currentStock: e.target.value }))} />
              </div>
              <div>
                <Label>Estoque Mínimo (alerta)</Label>
                <Input type="number" min="0" step="0.01" value={form.minStock}
                  onChange={e => setForm(f => ({ ...f, minStock: e.target.value }))} />
              </div>
              <div>
                <Label>Estoque desejado</Label>
                <Input type="number" min="0" step="0.01" value={form.targetStock} onChange={e => setForm(f => ({ ...f, targetStock: e.target.value }))} />
              </div>
              <div>
                <Label>Preço Médio (R$)</Label>
                <Input type="number" min="0" step="0.01" value={form.avgPrice}
                  onChange={e => setForm(f => ({ ...f, avgPrice: e.target.value }))} />
              </div>
              <div>
                <Label>Fornecedor</Label>
                <Select value={form.supplierId} onValueChange={v => setForm(f => ({ ...f, supplierId: v }))}>
                  <SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum</SelectItem>
                    {suppliers.map(s => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2">
                <Label>Observações</Label>
                <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
            <Button onClick={handleSubmit} className="bg-orange-500 hover:bg-orange-600 text-white"
              disabled={createMaterial.isPending || updateMaterial.isPending}>
              {editingId ? "Salvar" : "Cadastrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Novo Kit de Procedimento */}
      <Dialog open={showKitForm} onOpenChange={(open) => { setShowKitForm(open); if (!open) setKitForm(emptyKitForm()); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Novo Kit de Procedimento</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>Nome do kit *</Label>
                <Input value={kitForm.name} onChange={(e) => setKitForm((form) => ({ ...form, name: e.target.value }))} placeholder="Ex: Kit Preto e Cinza" />
              </div>
              <div>
                <Label>Categoria</Label>
                <Input value={kitForm.category} onChange={(e) => setKitForm((form) => ({ ...form, category: e.target.value }))} placeholder="Ex: Tatuagem" />
              </div>
              <div className="sm:col-span-2">
                <Label>Descrição</Label>
                <Textarea value={kitForm.description} onChange={(e) => setKitForm((form) => ({ ...form, description: e.target.value }))} rows={2} placeholder="Quando este kit deve ser usado?" />
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label>Materiais do kit *</Label>
                <Button type="button" variant="outline" size="sm" onClick={addKitItem}><Plus className="w-3.5 h-3.5 mr-1" /> Material</Button>
              </div>
              {kitForm.items.map((item, index) => (
                <div key={index} className="grid grid-cols-[minmax(0,1fr)_90px_70px_auto] gap-2 items-end">
                  <div className="min-w-0">
                    <Label className="text-xs">Material</Label>
                    <Select value={item.materialId || "unselected"} onValueChange={(value) => {
                      const material = materials.find((candidate) => String(candidate.id) === value);
                      updateKitItem(index, { materialId: value === "unselected" ? "" : value, unit: material?.unit || item.unit });
                    }}>
                      <SelectTrigger className="text-xs"><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unselected">Selecione</SelectItem>
                        {materials.map((material) => <SelectItem key={material.id} value={String(material.id)}>{material.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Qtd.</Label>
                    <Input type="number" min="0.01" step="0.01" value={item.quantity} onChange={(e) => updateKitItem(index, { quantity: e.target.value })} />
                  </div>
                  <div>
                    <Label className="text-xs">Unidade</Label>
                    <Input value={item.unit} onChange={(e) => updateKitItem(index, { unit: e.target.value })} />
                  </div>
                  <Button type="button" variant="ghost" size="icon" className="h-9 w-9" disabled={kitForm.items.length === 1} onClick={() => removeKitItem(index)} title="Remover material">
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowKitForm(false)}>Cancelar</Button>
            <Button onClick={handleKitSubmit} disabled={createKit.isPending}>{createKit.isPending ? "Salvando..." : "Criar kit"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Movimentação de Estoque */}
      <Dialog open={showMovement} onOpenChange={setShowMovement}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Movimentar Estoque</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">{movementMaterialName}</p>
          <div className="space-y-4">
            <div>
              <Label>Tipo de Movimentação</Label>
              <Select value={movForm.type} onValueChange={v => setMovForm(f => ({ ...f, type: v as any }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="entrada">Entrada (compra/recebimento)</SelectItem>
                  <SelectItem value="saida">Saída (uso/consumo)</SelectItem>
                  <SelectItem value="ajuste">Ajuste (correção de inventário)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{movForm.type === "ajuste" ? "Novo valor do estoque" : "Quantidade"}</Label>
              <Input type="number" min="0" step="0.01" value={movForm.quantity}
                onChange={e => setMovForm(f => ({ ...f, quantity: e.target.value }))}
                placeholder="0" />
            </div>
            {movForm.type !== "ajuste" && <div>
              <Label>Informar quantidade em</Label>
              <Select value={movForm.inputUnit} onValueChange={v => setMovForm(f => ({ ...f, inputUnit: v as "base" | "package" }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="base">Unidade de consumo</SelectItem>
                  <SelectItem value="package">Embalagem de compra</SelectItem>
                </SelectContent>
              </Select>
            </div>}
            {(() => {
              const material = materials.find((candidate) => candidate.id === movementMaterialId);
              const factor = movForm.type === "ajuste" || movForm.inputUnit === "base" ? 1 : Number(material?.unitsPerPackage || 1);
              const normalized = (Number(movForm.quantity) || 0) * factor;
              return <div className="rounded-lg border border-orange-500/25 bg-orange-500/[0.06] p-3 text-sm"><span className="font-medium">Movimento calculado:</span> {normalized.toLocaleString("pt-BR")} {material?.baseUnit || material?.unit || "un"}</div>;
            })()}
            {movForm.type === "entrada" && <div className="grid grid-cols-2 gap-3"><div><Label>Lote</Label><Input value={movForm.lotNumber} onChange={e => setMovForm(f => ({ ...f, lotNumber: e.target.value }))} placeholder="Opcional" /></div><div><Label>Validade</Label><Input type="date" value={movForm.expiresAt} onChange={e => setMovForm(f => ({ ...f, expiresAt: e.target.value }))} /></div></div>}
            <div>
              <Label>Motivo / Referência</Label>
              <Input value={movForm.reason} onChange={e => setMovForm(f => ({ ...f, reason: e.target.value }))}
                placeholder="Ex: Compra NF 1234, Uso sessão..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowMovement(false)}>Cancelar</Button>
            <Button onClick={handleMovementSubmit} className="bg-orange-500 hover:bg-orange-600 text-white"
              disabled={addMovement.isPending}>
              Registrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Histórico de Movimentações */}
      <Dialog open={showHistory} onOpenChange={setShowHistory}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Histórico — {historyMaterialName}</DialogTitle>
          </DialogHeader>
          <div className="max-h-96 overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Qtd</TableHead>
                  <TableHead className="text-right">Anterior</TableHead>
                  <TableHead className="text-right">Novo</TableHead>
                  <TableHead>Motivo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {movements.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">Nenhuma movimentação registrada.</TableCell></TableRow>
                ) : movements.map(m => (
                  <TableRow key={m.id}>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(m.createdAt).toLocaleString("pt-BR")}
                    </TableCell>
                    <TableCell>{movTypeLabel(m.type)}</TableCell>
                    <TableCell className="text-right font-mono">{parseFloat(String(m.quantity))}</TableCell>
                    <TableCell className="text-right font-mono text-muted-foreground">{parseFloat(String(m.previousStock))}</TableCell>
                    <TableCell className="text-right font-mono font-bold">{parseFloat(String(m.newStock))}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{m.reason || "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowHistory(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
