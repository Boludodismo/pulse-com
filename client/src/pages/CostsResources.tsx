import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertTriangle,
  CalendarClock,
  Check,
  Package,
  Plus,
  Search,
  Sparkles,
  WalletCards,
} from "lucide-react";
import { toast } from "sonner";

type CatalogCategory = { name: string; icon: string; items: string[] };

const CATALOG: CatalogCategory[] = [
  {
    name: "Agulhas e cartuchos",
    icon: "🪡",
    items: [
      "Cartucho 1RL",
      "Cartucho 3RL",
      "Cartucho 5RL",
      "Cartucho 7RL",
      "Cartucho 9RL",
      "Cartucho 11RL",
      "Cartucho 14RL",
      "Cartucho 3RS",
      "Cartucho 5RS",
      "Cartucho 7RS",
      "Cartucho 9RS",
      "Cartucho 14RS",
      "Cartucho Flat",
      "Cartucho Magnum M1",
      "Cartucho Magnum M2",
      "Cartucho Curved Magnum",
      "Cartucho Soft Edge Magnum",
      "Cartucho Bugpin",
      "Biqueira descartável",
      "Grip descartável",
    ],
  },
  {
    name: "Tintas e pigmentos",
    icon: "🎨",
    items: [
      "Preto para linha",
      "Preto para preenchimento",
      "Preto para sombra",
      "Greywash extra claro",
      "Greywash claro",
      "Greywash médio",
      "Greywash escuro",
      "Greywash extra escuro",
      "Branco",
      "Mixing White",
      "Tinta colorida",
      "Solução para diluição",
      "Batoque pequeno",
      "Batoque médio",
      "Batoque grande",
      "Batoque extragrande",
      "Suporte de batoques",
      "Misturador descartável",
      "Refil para mixer",
    ],
  },
  {
    name: "Preparação e decalque",
    icon: "✍️",
    items: [
      "Sabonete líquido",
      "Antisséptico para pele",
      "Álcool etílico 70%",
      "Aparelho de barbear descartável",
      "Papel hectográfico",
      "Papel térmico para estêncil",
      "Gel transferidor de decalque",
      "Removedor de estêncil",
      "Caneta cirúrgica",
      "Marcador de pele",
      "Régua descartável",
      "Fita métrica",
      "Algodão",
      "Gaze estéril",
      "Compressa",
      "Papel-toalha",
      "Vaselina sólida",
      "Produto deslizante para tatuagem",
      "Green soap",
      "Frasco squeeze 250 ml",
      "Frasco squeeze 500 ml",
      "Copo para enxágue",
    ],
  },
  {
    name: "Barreiras e proteção",
    icon: "🛡️",
    items: [
      "Plástico filme 15 cm",
      "Plástico filme 28 cm",
      "Plástico filme 30 cm",
      "Plástico filme 38 cm",
      "Plástico filme 40 cm",
      "Plástico filme 45 cm",
      "Barreira adesiva",
      "Capa para máquina pen",
      "Capa para grip",
      "Protetor de clip cord",
      "Protetor de cabo RCA",
      "Protetor de bateria",
      "Protetor de pedal",
      "Capa para frasco",
      "Capa para apoio de braço",
      "Capa para maca",
      "Lençol descartável 50 cm",
      "Lençol descartável 60 cm",
      "Lençol descartável 70 cm",
      "Campo impermeável",
      "Babador impermeável",
    ],
  },
  {
    name: "EPIs de procedimento",
    icon: "🥽",
    items: [
      "Luva nitrílica PP",
      "Luva nitrílica P",
      "Luva nitrílica M",
      "Luva nitrílica G",
      "Luva nitrílica GG",
      "Luva de látex P",
      "Luva de látex M",
      "Luva de látex G",
      "Luva sem látex",
      "Sobreluva plástica",
      "Máscara cirúrgica",
      "Máscara PFF2/N95",
      "Avental descartável",
      "Avental impermeável",
      "Manga protetora",
      "Touca descartável",
      "Óculos de proteção",
      "Protetor facial",
    ],
  },
  {
    name: "EPIs de limpeza",
    icon: "🧤",
    items: [
      "Luva de borracha P",
      "Luva de borracha M",
      "Luva de borracha G",
      "Luva química resistente",
      "Avental impermeável reutilizável",
      "Máscara para limpeza",
      "Óculos de ampla proteção",
      "Protetor facial de limpeza",
      "Bota impermeável",
      "Calçado antiderrapante",
    ],
  },
  {
    name: "Limpeza e desinfecção",
    icon: "🧹",
    items: [
      "Detergente neutro 500 ml",
      "Detergente neutro 1 L",
      "Detergente neutro 5 L",
      "Detergente enzimático",
      "Desinfetante 1 L",
      "Desinfetante 2 L",
      "Desinfetante 5 L",
      "Álcool 70% 500 ml",
      "Álcool 70% 1 L",
      "Álcool 70% 5 L",
      "Álcool glicerinado",
      "Hipoclorito de sódio",
      "Ácido peracético",
      "Sabonete líquido para mãos",
      "Limpador de piso",
      "Limpador de vidro",
      "Desengordurante",
      "Pano descartável sem fiapos",
      "Pano de chão",
      "Pano de microfibra",
      "Flanela",
      "Esponja não abrasiva",
      "Escova de limpeza",
      "Borrifador 500 ml",
      "Balde 5 L",
      "Balde 10 L",
      "Balde 20 L",
      "Mop úmido",
      "Refil de mop",
      "Vassoura macia",
      "Vassoura rígida",
      "Rodo 30 cm",
      "Rodo 40 cm",
      "Rodo 60 cm",
      "Pá de lixo",
      "Escova sanitária",
      "Placa de piso molhado",
    ],
  },
  {
    name: "Sacos, lixeiras e resíduos",
    icon: "♻️",
    items: [
      "Saco de lixo 15 L",
      "Saco de lixo 20 L",
      "Saco de lixo 30 L",
      "Saco de lixo 50 L",
      "Saco de lixo 60 L",
      "Saco de lixo 100 L",
      "Saco de lixo 150 L",
      "Saco de lixo 200 L",
      "Saco branco infectante 15 L",
      "Saco branco infectante 30 L",
      "Saco branco infectante 50 L",
      "Saco branco infectante 100 L",
      "Coletor perfurocortante 1,5 L",
      "Coletor perfurocortante 3 L",
      "Coletor perfurocortante 5 L",
      "Coletor perfurocortante 7 L",
      "Coletor perfurocortante 13 L",
      "Coletor perfurocortante 20 L",
      "Suporte para coletor",
      "Lixeira com pedal 10 L",
      "Lixeira com pedal 20 L",
      "Lixeira com pedal 50 L",
      "Lacre",
      "Etiqueta de risco biológico",
    ],
  },
  {
    name: "Curativo e pós-procedimento",
    icon: "🩹",
    items: [
      "Gaze",
      "Compressa",
      "Fita microporosa",
      "Curativo absorvente",
      "Filme adesivo cicatrizante",
      "Produto de cuidado posterior",
      "Sachê de cuidado posterior",
      "Embalagem para kit",
      "Sacola",
      "Folheto de cuidados",
      "Cartão de retorno",
      "Etiqueta de identificação",
    ],
  },
  {
    name: "Escritório e apoio",
    icon: "📎",
    items: [
      "Papel A4",
      "Papel fotográfico",
      "Toner de impressora",
      "Bobina térmica",
      "Etiqueta adesiva",
      "Caneta",
      "Marcador",
      "Pasta",
      "Envelope",
      "Fita adesiva",
      "Pilha",
      "Bateria",
      "Copo descartável",
      "Água mineral",
      "Café",
      "Açúcar",
      "Guardanapo",
      "Papel higiênico",
      "Cartão de visita",
      "Material de divulgação",
    ],
  },
];

const UNITS = [
  "un",
  "par",
  "cx",
  "pct",
  "rolo",
  "folha",
  "kit",
  "frasco",
  "saco",
  "ml",
  "L",
  "g",
  "kg",
  "m",
];

function suggestedUnit(name: string) {
  const text = name.toLowerCase();
  if (text.includes("plástico filme") || text.includes("filme adesivo"))
    return "rolo";
  if (text.includes("luva")) return "cx";
  if (text.includes("saco ")) return "pct";
  if (text.includes("papel") || text.includes("folheto")) return "pct";
  if (/\b(ml|1 l|2 l|5 l)\b/.test(text)) return "frasco";
  return "un";
}

export default function CostsResources() {
  const utils = trpc.useUtils();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    category: "Outros",
    unit: "un",
    currentStock: "0",
    minStock: "0",
    avgPrice: "0",
  });
  const { data: materials = [] } = trpc.stock.listMaterials.useQuery({
    activeOnly: true,
  });
  const { data: lowStock = [] } = trpc.stock.getLowStock.useQuery();

  const createMaterial = trpc.stock.createMaterial.useMutation({
    onSuccess: () => {
      utils.stock.listMaterials.invalidate();
      utils.stock.getLowStock.invalidate();
      setDialogOpen(false);
      toast.success("Item adicionado ao estoque.");
    },
    onError: (error) =>
      toast.error(error.message || "Não foi possível adicionar o item."),
  });

  const filtered = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("pt-BR");
    if (!term) return CATALOG;
    return CATALOG.map((category) => ({
      ...category,
      items: category.items.filter((item) =>
        `${category.name} ${item}`.toLocaleLowerCase("pt-BR").includes(term),
      ),
    })).filter((category) => category.items.length > 0);
  }, [search]);

  const openItem = (name?: string, category?: string) => {
    const itemName = name || "";
    setForm({
      name: itemName,
      category: category || "Outros",
      unit: suggestedUnit(itemName),
      currentStock: "0",
      minStock: "0",
      avgPrice: "0",
    });
    setDialogOpen(true);
  };

  const save = () => {
    if (!form.name.trim()) return toast.error("Informe o nome do item.");
    createMaterial.mutate({
      name: form.name.trim(),
      category: form.category,
      unit: form.unit,
      currentStock: Number(form.currentStock) || 0,
      minStock: Number(form.minStock) || 0,
      avgPrice: Number(form.avgPrice) || 0,
      notes: "Adicionado pelo catálogo de Custos e Recursos",
    });
  };

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <WalletCards className="h-7 w-7 text-orange-500" />
            <h1 className="text-2xl sm:text-3xl font-bold">
              Custos e Recursos
            </h1>
          </div>
          <p className="text-muted-foreground mt-1">
            Cadastre insumos rapidamente e prepare o controle completo de custos
            do estúdio.
          </p>
        </div>
        <Button
          onClick={() => openItem()}
          className="bg-orange-500 hover:bg-orange-600"
        >
          <Plus className="h-4 w-4 mr-2" />
          Criar outro item
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-6 flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Itens cadastrados</p>
              <p className="text-3xl font-bold">{materials.length}</p>
            </div>
            <Package className="h-8 w-8 text-blue-500" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Estoque baixo</p>
              <p className="text-3xl font-bold">{lowStock.length}</p>
            </div>
            <AlertTriangle className="h-8 w-8 text-amber-500" />
          </CardContent>
        </Card>
        <Card className="opacity-80">
          <CardContent className="pt-6 flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">
                Contas recorrentes
              </p>
              <p className="font-semibold mt-1">Próxima entrega</p>
            </div>
            <CalendarClock className="h-8 w-8 text-violet-500" />
          </CardContent>
        </Card>
        <Card className="opacity-80">
          <CardContent className="pt-6 flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">
                Previsão financeira
              </p>
              <p className="font-semibold mt-1">Próxima entrega</p>
            </div>
            <Sparkles className="h-8 w-8 text-emerald-500" />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between gap-3">
            <span>Catálogo rápido de insumos</span>
            <Badge variant="secondary">
              {CATALOG.reduce((sum, c) => sum + c.items.length, 0)} opções
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar cartucho, luva, saco de lixo, hipoclorito..."
              className="pl-9"
            />
          </div>
          <ScrollArea className="h-[52vh] min-h-[380px] pr-4">
            {filtered.length ? (
              <Accordion
                type="multiple"
                className="space-y-2"
                defaultValue={search ? filtered.map((c) => c.name) : []}
                key={search}
              >
                {filtered.map((category) => (
                  <AccordionItem
                    key={category.name}
                    value={category.name}
                    className="border rounded-lg px-4 bg-muted/20"
                  >
                    <AccordionTrigger className="hover:no-underline">
                      <span className="flex items-center gap-3">
                        <span className="text-xl">{category.icon}</span>
                        <span>{category.name}</span>
                        <Badge variant="outline">{category.items.length}</Badge>
                      </span>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 pb-2">
                        {category.items.map((item) => (
                          <button
                            key={item}
                            onClick={() => openItem(item, category.name)}
                            className="flex items-center justify-between gap-2 rounded-md border bg-background px-3 py-2.5 text-left text-sm transition hover:border-orange-400 hover:bg-orange-500/5"
                          >
                            <span>{item}</span>
                            <Plus className="h-4 w-4 shrink-0 text-orange-500" />
                          </button>
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            ) : (
              <div className="h-64 flex flex-col items-center justify-center text-center">
                <Search className="h-10 w-10 text-muted-foreground mb-3" />
                <p className="font-medium">Nenhum item encontrado</p>
                <Button
                  variant="link"
                  onClick={() => openItem(search, "Outros")}
                >
                  Cadastrar “{search}” como novo item
                </Button>
              </div>
            )}
          </ScrollArea>
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t pt-4">
            <p className="text-sm text-muted-foreground">
              Não encontrou o material? Cadastre uma opção própria para este
              estúdio.
            </p>
            <Button
              variant="outline"
              onClick={() => openItem(search, "Outros")}
            >
              <Plus className="h-4 w-4 mr-2" />
              Outro material
            </Button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Adicionar item ao estoque</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-2">
              <Label>Nome do material *</Label>
              <Input
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
                placeholder="Ex.: Saco de lixo 80 L"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Categoria</Label>
                <Select
                  value={form.category}
                  onValueChange={(value) =>
                    setForm((f) => ({ ...f, category: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[...CATALOG.map((c) => c.name), "Outros"].map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Unidade de controle</Label>
                <Select
                  value={form.unit}
                  onValueChange={(value) =>
                    setForm((f) => ({ ...f, unit: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {UNITS.map((u) => (
                      <SelectItem key={u} value={u}>
                        {u}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label>Estoque inicial</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.currentStock}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, currentStock: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Estoque mínimo</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.minStock}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, minStock: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Custo médio (R$)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.avgPrice}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, avgPrice: e.target.value }))
                  }
                />
              </div>
            </div>
            <div className="rounded-md bg-muted p-3 text-sm text-muted-foreground flex gap-2">
              <Check className="h-4 w-4 text-emerald-500 mt-0.5" />
              Após salvar, o item aparecerá no estoque atual e poderá receber
              entradas, saídas e ajustes normalmente.
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={save}
              disabled={createMaterial.isPending}
              className="bg-orange-500 hover:bg-orange-600"
            >
              {createMaterial.isPending
                ? "Salvando..."
                : "Adicionar ao estoque"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
