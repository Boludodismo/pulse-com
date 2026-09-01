import { useState } from "react";
import { trpc } from "@/lib/trpc";
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
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { toast } from "sonner";
import {
  Truck,
  Plus,
  Settings2,
  Trash2,
  ShoppingCart,
  MessageCircle,
  ExternalLink,
  Phone,
  Mail,
  Copy,
  CheckCircle2,
  ClipboardList,
  PackageSearch,
  Sparkles,
  PackageCheck,
  ScanLine,
  Bot,
} from "lucide-react";

type SupplierForm = {
  name: string;
  cnpj: string;
  contactName: string;
  phone: string;
  whatsapp: string;
  email: string;
  address: string;
  notes: string;
};

type OrderItem = {
  materialId: number;
  catalogVariantId: number;
  materialName: string;
  materialUnit: string;
  quantity: string;
  unitPrice: string;
  notes: string;
};

type ReceiptItem = {
  orderItemId: number;
  materialId: number;
  materialName: string;
  receivedQuantity: string;
  baseUnit: string;
  purchaseUnit: string;
  unitsPerPackage: string;
  unitPrice: string;
  lotNumber: string;
  expiresAt: string;
  alertAt: string;
  qualityStatus: "nao_verificada" | "aprovado" | "ressalva" | "recusado";
  qualityNotes: string;
};

type OcrAssistant = "ChatGPT" | "Gemini" | "Claude";

const buildPackagingOcrPrompt = (
  assistant: OcrAssistant,
  orderId: number | null,
  materialNames: string[],
) => `Você está atuando como um leitor OCR rigoroso de embalagens de insumos para um estúdio de tatuagem.

Vou enviar uma ou mais fotos das embalagens referentes ao pedido #${orderId ?? "não informado"}. Os materiais esperados são:
${materialNames.map((name, index) => `${index + 1}. ${name}`).join("\n") || "- material não informado"}

Leia somente o que estiver visível nas imagens. Não invente, não complete por conhecimento próprio e não deduza validade a partir do lote. Se um dado não aparecer ou não estiver legível, escreva exatamente: NÃO LEGÍVEL. Se houver dúvida, apresente as alternativas e marque a confiança como baixa.

Para cada embalagem, responda em português com os campos abaixo. Coloque CADA VALOR em um bloco de código Markdown separado, para que apareça com botão de copiar. O título do campo deve ficar fora do bloco. Não coloque explicações dentro dos blocos.

PRODUTO
MARCA
LINHA OU MODELO
VARIANTE / COR / MEDIDA
SKU OU REFERÊNCIA
LOTE
DATA DE FABRICAÇÃO
VALIDADE
QUANTIDADE DA EMBALAGEM
UNIDADE
REGISTRO ANVISA, QUANDO EXISTIR
OUTROS CÓDIGOS VISÍVEIS
CONDIÇÃO VISUAL DA EMBALAGEM
CONFIANÇA DA LEITURA
PENDÊNCIAS OU TRECHOS ILEGÍVEIS

Padronize datas como AAAA-MM-DD somente quando dia, mês e ano estiverem claros. Preserve o texto original entre parênteses depois da data. Em cartuchos e agulhas, destaque configuração, número de agulhas, diâmetro, taper e formato. Em tintas, destaque cor, volume em ml, lote, validade e registro. Em biqueiras, batoques, luvas e descartáveis, destaque tamanho, quantidade e unidade.

Se houver mais de uma embalagem ou lote, crie uma seção numerada para cada uma e não misture os dados. Antes de responder, confira a leitura uma segunda vez. Esta resposta será copiada manualmente para um controle de estoque; não execute nenhuma ação externa.

Formate a resposta para funcionar bem no ${assistant}.`;

const CATALOG_CATEGORIES = [
  "Cartuchos e agulhas",
  "Tintas e pigmentos",
  "Barreiras e descartáveis",
  "EPIs de procedimento",
  "Higiene e antissepsia",
  "Stencil e transferência",
  "Cuidados pós-tatuagem",
  "Limpeza do estúdio",
  "Sacos, lixeiras e resíduos",
  "Equipamentos e acessórios",
];

const emptySupplierForm = (): SupplierForm => ({
  name: "",
  cnpj: "",
  contactName: "",
  phone: "",
  whatsapp: "",
  email: "",
  address: "",
  notes: "",
});

export default function Suppliers() {
  const utils = trpc.useUtils();

  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<SupplierForm>(emptySupplierForm());

  // Pedido de orçamento
  const [showOrder, setShowOrder] = useState(false);
  const [orderSupplierId, setOrderSupplierId] = useState<number | null>(null);
  const [orderSupplierName, setOrderSupplierName] = useState("");
  const [orderNotes, setOrderNotes] = useState("");
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [showOrderCatalog, setShowOrderCatalog] = useState(false);
  const [catalogSearch, setCatalogSearch] = useState("");
  const [catalogBrandId, setCatalogBrandId] = useState("all");
  const [catalogCategory, setCatalogCategory] = useState("all");

  // Visualizar pedido existente
  const [viewOrderId, setViewOrderId] = useState<number | null>(null);
  const [showViewOrder, setShowViewOrder] = useState(false);
  const [whatsappLink, setWhatsappLink] = useState("");
  const [whatsappMsg, setWhatsappMsg] = useState("");
  const [copiedMsg, setCopiedMsg] = useState(false);

  // Recebimento do pedido e entrada no estoque
  const [showReceiveOrder, setShowReceiveOrder] = useState(false);
  const [receiptItems, setReceiptItems] = useState<ReceiptItem[]>([]);
  const [copiedAssistant, setCopiedAssistant] = useState<OcrAssistant | null>(
    null,
  );

  const { data: suppliers = [], isLoading } = trpc.suppliers.list.useQuery({
    activeOnly: true,
  });
  const { data: materials = [] } = trpc.stock.listMaterials.useQuery({
    activeOnly: true,
  });
  const { data: catalogBrands = [] } = trpc.catalog.brands.useQuery();
  const { data: catalogVariants = [], isLoading: catalogLoading } =
    trpc.catalog.search.useQuery(
      {
        query: catalogSearch.trim() || undefined,
        brandId: catalogBrandId === "all" ? undefined : Number(catalogBrandId),
        category: catalogCategory === "all" ? undefined : catalogCategory,
        limit: 100,
      },
      { enabled: showOrder && showOrderCatalog },
    );
  const { data: orders = [] } = trpc.stock.listOrders.useQuery();
  const { data: viewOrder } = trpc.stock.getOrder.useQuery(
    { id: viewOrderId! },
    { enabled: showViewOrder && viewOrderId !== null },
  );
  const { data: waLink } = trpc.stock.getWhatsAppLink.useQuery(
    { orderId: viewOrderId! },
    { enabled: showViewOrder && viewOrderId !== null },
  );

  const createSupplier = trpc.suppliers.create.useMutation({
    onSuccess: () => {
      utils.suppliers.list.invalidate();
      setShowForm(false);
      setForm(emptySupplierForm());
      toast.success("Fornecedor cadastrado com sucesso!");
    },
    onError: (e) => toast.error(e.message),
  });

  const updateSupplier = trpc.suppliers.update.useMutation({
    onSuccess: () => {
      utils.suppliers.list.invalidate();
      setShowForm(false);
      setEditingId(null);
      setForm(emptySupplierForm());
      toast.success("Fornecedor atualizado!");
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteSupplier = trpc.suppliers.delete.useMutation({
    onSuccess: () => {
      utils.suppliers.list.invalidate();
      toast.success("Fornecedor removido.");
    },
    onError: (e) => toast.error(e.message),
  });

  const createOrder = trpc.stock.createOrder.useMutation({
    onSuccess: (result) => {
      utils.stock.listOrders.invalidate();
      setShowOrder(false);
      setOrderItems([]);
      setOrderNotes("");
      // Abrir visualização do pedido criado
      setViewOrderId(result.id);
      setShowViewOrder(true);
      toast.success("Pedido de orçamento criado!");
    },
    onError: (e) => toast.error(e.message),
  });

  const updateOrderStatus = trpc.stock.updateOrderStatus.useMutation({
    onSuccess: () => {
      utils.stock.listOrders.invalidate();
      utils.stock.getOrder.invalidate();
      toast.success("Status atualizado!");
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteOrder = trpc.stock.deleteOrder.useMutation({
    onSuccess: () => {
      utils.stock.listOrders.invalidate();
      toast.success("Pedido removido.");
    },
    onError: (e) => toast.error(e.message),
  });

  const receiveOrder = trpc.stock.receiveOrder.useMutation({
    onSuccess: () => {
      utils.stock.listOrders.invalidate();
      utils.stock.getOrder.invalidate();
      utils.stock.listMaterials.invalidate();
      utils.stock.listMovements.invalidate();
      utils.stock.listLots.invalidate();
      utils.stock.getExpiryAlerts.invalidate();
      setShowReceiveOrder(false);
      setReceiptItems([]);
      setShowViewOrder(true);
      toast.success("Pedido recebido e estoque atualizado!");
    },
    onError: (e) => toast.error(e.message),
  });

  const handleSupplierSubmit = () => {
    if (!form.name) {
      toast.error("Informe o nome do fornecedor.");
      return;
    }
    const payload = {
      name: form.name,
      cnpj: form.cnpj || undefined,
      contactName: form.contactName || undefined,
      phone: form.phone || undefined,
      whatsapp: form.whatsapp || undefined,
      email: form.email || undefined,
      address: form.address || undefined,
      notes: form.notes || undefined,
    };
    if (editingId) {
      updateSupplier.mutate({ id: editingId, ...payload });
    } else {
      createSupplier.mutate(payload);
    }
  };

  const handleEdit = (s: any) => {
    setEditingId(s.id);
    setForm({
      name: s.name,
      cnpj: s.cnpj || "",
      contactName: s.contactName || "",
      phone: s.phone || "",
      whatsapp: s.whatsapp || "",
      email: s.email || "",
      address: s.address || "",
      notes: s.notes || "",
    });
    setShowForm(true);
  };

  const handleNewOrder = (supplier: any) => {
    setOrderSupplierId(supplier.id);
    setOrderSupplierName(supplier.name);
    setOrderItems([]);
    setOrderNotes("");
    setShowOrderCatalog(false);
    setCatalogSearch("");
    setCatalogBrandId("all");
    setCatalogCategory("all");
    setShowOrder(true);
  };

  const getSuggestedPackages = (material: any) => {
    const current = Number(material.currentStock) || 0;
    const configuredTarget = Number(material.targetStock) || 0;
    const target =
      configuredTarget > 0 ? configuredTarget : Number(material.minStock) || 0;
    const unitsPerPackage = Number(material.unitsPerPackage) || 1;
    return Math.max(
      1,
      Math.ceil(Math.max(target - current, 0) / unitsPerPackage),
    );
  };

  const addMaterialToOrder = (material: any, suggested = false) => {
    if (orderItems.some((item) => item.materialId === material.id)) {
      toast.info("Este material já está no pedido.");
      return;
    }
    const quantity = suggested ? String(getSuggestedPackages(material)) : "";
    setOrderItems((prev) => [
      ...prev,
      {
        materialId: material.id,
        catalogVariantId: material.catalogVariantId || 0,
        materialName: material.name,
        materialUnit: material.purchaseUnit || material.unit || "un",
        quantity,
        unitPrice:
          Number(material.avgPrice) > 0 ? String(material.avgPrice) : "",
        notes: suggested
          ? `Sugestão pelo estoque atual: ${Number(material.currentStock).toLocaleString("pt-BR")} ${material.baseUnit || material.unit || "un"}`
          : "",
      },
    ]);
  };

  const addStockSuggestions = () => {
    const suggestions = materials.filter((material) => {
      const current = Number(material.currentStock) || 0;
      const configuredTarget = Number(material.targetStock) || 0;
      const target =
        configuredTarget > 0
          ? configuredTarget
          : Number(material.minStock) || 0;
      const supplierMatches =
        !material.supplierId || material.supplierId === orderSupplierId;
      return supplierMatches && target > current;
    });
    const existingIds = new Set(orderItems.map((item) => item.materialId));
    const newItems = suggestions
      .filter((material) => !existingIds.has(material.id))
      .map((material) => ({
        materialId: material.id,
        catalogVariantId: material.catalogVariantId || 0,
        materialName: material.name,
        materialUnit: material.purchaseUnit || material.unit || "un",
        quantity: String(getSuggestedPackages(material)),
        unitPrice:
          Number(material.avgPrice) > 0 ? String(material.avgPrice) : "",
        notes: `Sugestão pelo estoque atual: ${Number(material.currentStock).toLocaleString("pt-BR")} ${material.baseUnit || material.unit || "un"}`,
      }));
    if (newItems.length === 0) {
      toast.info("Nenhuma nova sugestão de reposição para este fornecedor.");
      return;
    }
    setOrderItems((prev) => [...prev, ...newItems]);
    toast.success(`${newItems.length} sugestão(ões) adicionada(s).`);
  };

  const addCatalogVariantToOrder = (variant: any) => {
    const linkedMaterial = materials.find(
      (material) => material.catalogVariantId === variant.id,
    );
    if (linkedMaterial) {
      addMaterialToOrder(linkedMaterial, true);
      return;
    }
    const name = [
      variant.brandName,
      variant.lineName,
      variant.name,
      variant.sku,
    ]
      .filter(Boolean)
      .join(" · ")
      .slice(0, 255);
    if (
      orderItems.some(
        (item) => item.materialId === 0 && item.materialName === name,
      )
    ) {
      toast.info("Este preset já está no pedido.");
      return;
    }
    setOrderItems((prev) => [
      ...prev,
      {
        materialId: 0,
        catalogVariantId: variant.id,
        materialName: name,
        materialUnit: variant.purchaseUnit || "un",
        quantity: "1",
        unitPrice: "",
        notes: "Novo item selecionado no catálogo técnico",
      },
    ]);
    toast.success("Preset adicionado ao pedido.");
  };

  const addOrderItem = () => {
    setOrderItems((prev) => [
      ...prev,
      {
        materialId: 0,
        catalogVariantId: 0,
        materialName: "",
        materialUnit: "",
        quantity: "",
        unitPrice: "",
        notes: "",
      },
    ]);
  };

  const updateOrderItem = (
    index: number,
    field: keyof OrderItem,
    value: string,
  ) => {
    setOrderItems((prev) => {
      const updated = [...prev];
      if (field === "materialId") {
        const mat = materials.find((m) => m.id === parseInt(value));
        updated[index] = {
          ...updated[index],
          materialId: parseInt(value),
          catalogVariantId: mat?.catalogVariantId || 0,
          materialName: mat?.name || "",
          materialUnit: mat?.purchaseUnit || mat?.unit || "",
        };
      } else {
        updated[index] = { ...updated[index], [field]: value };
      }
      return updated;
    });
  };

  const removeOrderItem = (index: number) => {
    setOrderItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleCreateOrder = () => {
    if (!orderSupplierId) return;
    const validItems = orderItems.filter(
      (i) => i.materialName && parseFloat(i.quantity) > 0,
    );
    if (validItems.length === 0) {
      toast.error("Adicione pelo menos um item ao pedido.");
      return;
    }
    createOrder.mutate({
      supplierId: orderSupplierId,
      notes: orderNotes || undefined,
      items: validItems.map((i) => ({
        materialId: i.materialId > 0 ? i.materialId : undefined,
        catalogVariantId:
          i.catalogVariantId > 0 ? i.catalogVariantId : undefined,
        materialName: i.materialName,
        materialUnit: i.materialUnit || "un",
        quantity: parseFloat(i.quantity),
        unitPrice: i.unitPrice ? parseFloat(i.unitPrice) : 0,
        notes: i.notes || undefined,
      })),
    });
  };

  const handleCopyMessage = (msg: string) => {
    navigator.clipboard.writeText(msg).then(() => {
      setCopiedMsg(true);
      setTimeout(() => setCopiedMsg(false), 2000);
      toast.success("Mensagem copiada!");
    });
  };

  const startReceivingOrder = () => {
    if (!viewOrder) return;
    setReceiptItems(
      viewOrder.items.map((item) => ({
        orderItemId: item.id,
        materialId: item.materialId || 0,
        materialName: item.materialName || "Material",
        receivedQuantity: String(item.quantity),
        baseUnit: item.baseUnit || item.materialUnit || "un",
        purchaseUnit: item.purchaseUnit || item.materialUnit || "un",
        unitsPerPackage: String(Number(item.unitsPerPackage) || 1),
        unitPrice: Number(item.unitPrice) > 0 ? String(item.unitPrice) : "",
        lotNumber: "",
        expiresAt: "",
        alertAt: "",
        qualityStatus: "nao_verificada" as const,
        qualityNotes: "",
      })),
    );
    setCopiedAssistant(null);
    setShowViewOrder(false);
    setShowReceiveOrder(true);
  };

  const updateReceiptItem = (
    index: number,
    field: keyof ReceiptItem,
    value: string,
  ) => {
    setReceiptItems((current) => {
      const updated = [...current];
      if (field === "materialId") {
        const material = materials.find((item) => item.id === Number(value));
        updated[index] = {
          ...updated[index],
          materialId: value === "new" ? 0 : Number(value),
          ...(material
            ? {
                baseUnit: material.baseUnit || material.unit || "un",
                purchaseUnit: material.purchaseUnit || material.unit || "un",
                unitsPerPackage: String(Number(material.unitsPerPackage) || 1),
              }
            : {}),
        };
      } else {
        updated[index] = { ...updated[index], [field]: value } as ReceiptItem;
      }
      return updated;
    });
  };

  const handleReceiveOrder = () => {
    if (!viewOrderId) return;
    const invalidItem = receiptItems.find(
      (item) =>
        item.qualityStatus !== "recusado" &&
        (!(Number(item.receivedQuantity) > 0) ||
          !(Number(item.unitsPerPackage) > 0)),
    );
    if (invalidItem) {
      toast.error(
        `Confira a quantidade e a conversão de ${invalidItem.materialName}.`,
      );
      return;
    }
    const invalidLot = receiptItems.find(
      (item) => (item.expiresAt || item.alertAt) && !item.lotNumber.trim(),
    );
    if (invalidLot) {
      toast.error(`Informe o lote de ${invalidLot.materialName}.`);
      return;
    }
    const invalidAlert = receiptItems.find(
      (item) => item.alertAt && !item.expiresAt,
    );
    if (invalidAlert) {
      toast.error(`Informe a validade de ${invalidAlert.materialName}.`);
      return;
    }
    receiveOrder.mutate({
      orderId: viewOrderId,
      items: receiptItems.map((item) => ({
        orderItemId: item.orderItemId,
        materialId: item.materialId > 0 ? item.materialId : undefined,
        receivedQuantity:
          item.qualityStatus === "recusado" ? 0 : Number(item.receivedQuantity),
        baseUnit: item.baseUnit,
        purchaseUnit: item.purchaseUnit,
        unitsPerPackage: Number(item.unitsPerPackage),
        unitPrice: item.unitPrice ? Number(item.unitPrice) : undefined,
        lotNumber: item.lotNumber.trim() || undefined,
        expiresAt: item.expiresAt || undefined,
        alertAt: item.alertAt || undefined,
        qualityStatus: item.qualityStatus,
        qualityNotes: item.qualityNotes.trim() || undefined,
      })),
    });
  };

  const copyOcrPrompt = (assistant: OcrAssistant) => {
    const prompt = buildPackagingOcrPrompt(
      assistant,
      viewOrderId,
      receiptItems.map((item) => item.materialName),
    );
    navigator.clipboard.writeText(prompt).then(() => {
      setCopiedAssistant(assistant);
      setTimeout(() => setCopiedAssistant(null), 2000);
      toast.success(`Prompt para ${assistant} copiado!`);
    });
  };

  const statusBadge = (status: string) => {
    const map: Record<string, { label: string; className: string }> = {
      rascunho: { label: "Rascunho", className: "bg-gray-700 text-gray-300" },
      enviado: { label: "Enviado", className: "bg-blue-900 text-blue-300" },
      confirmado: {
        label: "Confirmado",
        className: "bg-yellow-900 text-yellow-300",
      },
      recebido: { label: "Recebido", className: "bg-green-900 text-green-300" },
      cancelado: { label: "Cancelado", className: "bg-red-900 text-red-300" },
    };
    const s = map[status] || map.rascunho;
    return <Badge className={`text-xs ${s.className}`}>{s.label}</Badge>;
  };

  const filtered = suppliers.filter(
    (s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      (s.contactName || "").toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 sm:mb-6 gap-3 sm:gap-0">
          <div className="flex-1 min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold text-foreground flex items-center gap-2">
              <Truck className="w-5 w-5 sm:w-6 sm:h-6 text-orange-500 flex-shrink-0" />
              Fornecedores
            </h1>
            <p className="text-muted-foreground text-xs sm:text-sm mt-1">
              Gerencie fornecedores e pedidos de orçamento
            </p>
          </div>
          <Button
            onClick={() => {
              setEditingId(null);
              setForm(emptySupplierForm());
              setShowForm(true);
            }}
            className="bg-orange-500 hover:bg-orange-600 text-white w-full sm:w-auto text-xs sm:text-sm"
          >
            <Plus className="w-3 w-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
            <span className="hidden sm:inline">Novo Fornecedor</span>
            <span className="sm:hidden">Novo</span>
          </Button>
        </div>

        <Tabs defaultValue="suppliers">
          <TabsList className="w-full sm:w-auto">
            <TabsTrigger
              value="suppliers"
              className="flex items-center gap-1 text-xs sm:text-sm"
            >
              <Truck className="w-3 h-3 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">Fornecedores</span>
              <span className="sm:hidden">Forn.</span>
            </TabsTrigger>
            <TabsTrigger
              value="orders"
              className="flex items-center gap-1 text-xs sm:text-sm"
            >
              <ClipboardList className="w-3 h-3 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">Pedidos de Orçamento</span>
              <span className="sm:hidden">Ped.</span>
              {orders.length > 0 && (
                <Badge className="ml-1 bg-orange-500 text-white text-xs">
                  {orders.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* Aba Fornecedores */}
          <TabsContent value="suppliers" className="space-y-4">
            <Input
              placeholder="Buscar fornecedor..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full sm:max-w-xs bg-card border-border text-xs sm:text-sm"
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              {isLoading ? (
                <p className="text-muted-foreground col-span-3 text-center py-8">
                  Carregando...
                </p>
              ) : filtered.length === 0 ? (
                <p className="text-muted-foreground col-span-3 text-center py-8">
                  Nenhum fornecedor cadastrado.
                </p>
              ) : (
                filtered.map((s) => (
                  <Card
                    key={s.id}
                    className="hover:border-orange-500/50 transition-colors"
                  >
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <CardTitle className="text-base">{s.name}</CardTitle>
                        <div className="flex gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            title="Editar"
                            onClick={() => handleEdit(s)}
                          >
                            <Settings2 className="w-4 h-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            title="Remover"
                            onClick={() => {
                              if (confirm("Remover este fornecedor?"))
                                deleteSupplier.mutate({ id: s.id });
                            }}
                          >
                            <Trash2 className="w-4 h-4 text-red-400" />
                          </Button>
                        </div>
                      </div>
                      {s.cnpj && (
                        <p className="text-xs text-muted-foreground">
                          CNPJ: {s.cnpj}
                        </p>
                      )}
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {s.contactName && (
                        <p className="text-sm text-muted-foreground">
                          👤 {s.contactName}
                        </p>
                      )}
                      {s.phone && (
                        <p className="text-sm flex items-center gap-1">
                          <Phone className="w-3 h-3 text-muted-foreground" />
                          <a
                            href={`tel:${s.phone}`}
                            className="hover:text-orange-400"
                          >
                            {s.phone}
                          </a>
                        </p>
                      )}
                      {s.whatsapp && (
                        <p className="text-sm flex items-center gap-1">
                          <MessageCircle className="w-3 h-3 text-green-400" />
                          <a
                            href={`https://wa.me/55${s.whatsapp.replace(/\D/g, "")}`}
                            target="_blank"
                            rel="noreferrer"
                            className="hover:text-green-400"
                          >
                            {s.whatsapp}
                          </a>
                        </p>
                      )}
                      {s.email && (
                        <p className="text-sm flex items-center gap-1">
                          <Mail className="w-3 h-3 text-muted-foreground" />
                          <a
                            href={`mailto:${s.email}`}
                            className="hover:text-orange-400 truncate"
                          >
                            {s.email}
                          </a>
                        </p>
                      )}
                      {s.notes && (
                        <p className="text-xs text-muted-foreground italic mt-1">
                          {s.notes}
                        </p>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full mt-2 border-orange-500/50 text-orange-400 hover:bg-orange-500/10"
                        onClick={() => handleNewOrder(s)}
                      >
                        <ShoppingCart className="w-3 h-3 mr-1" /> Criar Pedido
                        de Orçamento
                      </Button>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>

          {/* Aba Pedidos */}
          <TabsContent value="orders" className="space-y-4">
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>#</TableHead>
                      <TableHead>Fornecedor</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Criado em</TableHead>
                      <TableHead>Enviado em</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orders.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={6}
                          className="text-center py-8 text-muted-foreground"
                        >
                          Nenhum pedido criado ainda.
                        </TableCell>
                      </TableRow>
                    ) : (
                      orders.map((o) => (
                        <TableRow key={o.id}>
                          <TableCell className="font-mono text-muted-foreground">
                            #{o.id}
                          </TableCell>
                          <TableCell className="font-medium">
                            {o.supplierName}
                          </TableCell>
                          <TableCell>{statusBadge(o.status)}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {new Date(o.createdAt).toLocaleDateString("pt-BR")}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {o.sentAt
                              ? new Date(o.sentAt).toLocaleDateString("pt-BR")
                              : "—"}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1 justify-end">
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-xs"
                                onClick={() => {
                                  setViewOrderId(o.id);
                                  setShowViewOrder(true);
                                }}
                              >
                                <ExternalLink className="w-3 h-3 mr-1" /> Ver
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => {
                                  if (confirm("Remover este pedido?"))
                                    deleteOrder.mutate({ id: o.id });
                                }}
                              >
                                <Trash2 className="w-4 h-4 text-red-400" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Dialog: Cadastro/Edição de Fornecedor */}
      <Dialog
        open={showForm}
        onOpenChange={(o) => {
          setShowForm(o);
          if (!o) {
            setEditingId(null);
            setForm(emptySupplierForm());
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Editar Fornecedor" : "Novo Fornecedor"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label>Nome / Razão Social *</Label>
                <Input
                  value={form.name}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, name: e.target.value }))
                  }
                  placeholder="Ex: Distribuidora Tattoo SP"
                />
              </div>
              <div>
                <Label>CNPJ</Label>
                <Input
                  value={form.cnpj}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, cnpj: e.target.value }))
                  }
                  placeholder="00.000.000/0001-00"
                />
              </div>
              <div>
                <Label>Nome do Contato</Label>
                <Input
                  value={form.contactName}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, contactName: e.target.value }))
                  }
                  placeholder="Ex: João Silva"
                />
              </div>
              <div>
                <Label>Telefone</Label>
                <Input
                  value={form.phone}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, phone: e.target.value }))
                  }
                  placeholder="(11) 9999-9999"
                />
              </div>
              <div>
                <Label>WhatsApp</Label>
                <Input
                  value={form.whatsapp}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, whatsapp: e.target.value }))
                  }
                  placeholder="(11) 99999-9999"
                />
              </div>
              <div className="col-span-2">
                <Label>E-mail</Label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, email: e.target.value }))
                  }
                  placeholder="contato@fornecedor.com.br"
                />
              </div>
              <div className="col-span-2">
                <Label>Endereço</Label>
                <Input
                  value={form.address}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, address: e.target.value }))
                  }
                  placeholder="Rua, número, cidade..."
                />
              </div>
              <div className="col-span-2">
                <Label>Observações</Label>
                <Textarea
                  value={form.notes}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, notes: e.target.value }))
                  }
                  rows={2}
                  placeholder="Prazo de entrega, condições de pagamento..."
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleSupplierSubmit}
              className="bg-orange-500 hover:bg-orange-600 text-white"
              disabled={createSupplier.isPending || updateSupplier.isPending}
            >
              {editingId ? "Salvar" : "Cadastrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Criar Pedido de Orçamento */}
      <Dialog open={showOrder} onOpenChange={setShowOrder}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-orange-500" />
              Pedido de Orçamento — {orderSupplierName}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Itens do pedido */}
            <div>
              <div className="flex flex-col gap-2 mb-3 sm:flex-row sm:items-center sm:justify-between">
                <Label className="text-base">Itens do Pedido</Label>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={addStockSuggestions}
                  >
                    <Sparkles className="w-3 h-3 mr-1" /> Sugestões do estoque
                  </Button>
                  <Button
                    size="sm"
                    variant={showOrderCatalog ? "default" : "outline"}
                    onClick={() => setShowOrderCatalog((open) => !open)}
                  >
                    <PackageSearch className="w-3 h-3 mr-1" /> Catálogo técnico
                  </Button>
                  <Button size="sm" variant="outline" onClick={addOrderItem}>
                    <Plus className="w-3 h-3 mr-1" /> Manual
                  </Button>
                </div>
              </div>

              {showOrderCatalog && (
                <div className="mb-4 space-y-3 rounded-lg border border-orange-500/30 bg-orange-500/[0.04] p-3">
                  <div>
                    <p className="text-sm font-medium">
                      Escolher no catálogo técnico
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Busque o preset por marca, modelo, SKU, cor ou medida. A
                      quantidade sugerida usa o estoque atual quando o item já
                      estiver cadastrado.
                    </p>
                  </div>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    <Input
                      value={catalogSearch}
                      onChange={(event) => setCatalogSearch(event.target.value)}
                      placeholder="Buscar material ou SKU..."
                      className="sm:col-span-3"
                    />
                    <Select
                      value={catalogBrandId}
                      onValueChange={setCatalogBrandId}
                    >
                      <SelectTrigger className="sm:col-span-1">
                        <SelectValue placeholder="Todas as marcas" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todas as marcas</SelectItem>
                        {catalogBrands.map((brand) => (
                          <SelectItem key={brand.id} value={String(brand.id)}>
                            {brand.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select
                      value={catalogCategory}
                      onValueChange={setCatalogCategory}
                    >
                      <SelectTrigger className="sm:col-span-2">
                        <SelectValue placeholder="Todas as categorias" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todas as categorias</SelectItem>
                        {CATALOG_CATEGORIES.map((category) => (
                          <SelectItem key={category} value={category}>
                            {category}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
                    {catalogLoading ? (
                      <p className="py-4 text-center text-sm text-muted-foreground">
                        Carregando catálogo...
                      </p>
                    ) : catalogVariants.length === 0 ? (
                      <p className="py-4 text-center text-sm text-muted-foreground">
                        Nenhum preset encontrado.
                      </p>
                    ) : (
                      catalogVariants.map((variant) => {
                        const linkedMaterial = materials.find(
                          (material) =>
                            material.catalogVariantId === variant.id,
                        );
                        return (
                          <div
                            key={variant.id}
                            className="flex flex-col gap-2 rounded-md border bg-card p-3 sm:flex-row sm:items-center sm:justify-between"
                          >
                            <div className="min-w-0">
                              <p className="break-words text-sm font-medium">
                                {[
                                  variant.brandName,
                                  variant.lineName,
                                  variant.name,
                                ]
                                  .filter(Boolean)
                                  .join(" · ")}
                              </p>
                              <p className="break-words text-xs text-muted-foreground">
                                {[
                                  variant.sku,
                                  variant.format,
                                  variant.colorName,
                                ]
                                  .filter(Boolean)
                                  .join(" · ") || "Preset técnico"}
                              </p>
                              <p className="mt-1 text-xs text-orange-400">
                                {linkedMaterial
                                  ? `Estoque: ${Number(linkedMaterial.currentStock).toLocaleString("pt-BR")} ${linkedMaterial.baseUnit || linkedMaterial.unit} · sugestão: ${getSuggestedPackages(linkedMaterial)} ${linkedMaterial.purchaseUnit || linkedMaterial.unit}`
                                  : `Novo no estoque · pedido inicial: 1 ${variant.purchaseUnit || "un"}`}
                              </p>
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              className="shrink-0"
                              onClick={() => addCatalogVariantToOrder(variant)}
                            >
                              <Plus className="mr-1 h-3 w-3" /> Adicionar
                            </Button>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
              {orderItems.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground border border-dashed rounded-lg">
                  <ShoppingCart className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">
                    Nenhum item adicionado. Use as sugestões, o catálogo ou o
                    preenchimento manual.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {orderItems.map((item, i) => (
                    <div
                      key={i}
                      className="grid grid-cols-1 gap-2 items-end p-3 bg-card rounded-lg border border-border sm:grid-cols-12"
                    >
                      <div className="sm:col-span-4">
                        <Label className="text-xs">Material</Label>
                        <Select
                          value={
                            item.materialId > 0 ? String(item.materialId) : ""
                          }
                          onValueChange={(v) =>
                            updateOrderItem(i, "materialId", v)
                          }
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue placeholder="Selecionar..." />
                          </SelectTrigger>
                          <SelectContent>
                            {materials.map((m) => (
                              <SelectItem key={m.id} value={String(m.id)}>
                                {m.name} ({m.purchaseUnit || m.unit})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="sm:col-span-2">
                        <Label className="text-xs">
                          Qtd ({item.materialUnit || "un"})
                        </Label>
                        <Input
                          className="h-8 text-xs"
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.quantity}
                          onChange={(e) =>
                            updateOrderItem(i, "quantity", e.target.value)
                          }
                          placeholder="0"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <Label className="text-xs">Preço Unit. (R$)</Label>
                        <Input
                          className="h-8 text-xs"
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.unitPrice}
                          onChange={(e) =>
                            updateOrderItem(i, "unitPrice", e.target.value)
                          }
                          placeholder="0,00"
                        />
                      </div>
                      <div className="sm:col-span-3">
                        <Label className="text-xs">Observação</Label>
                        <Input
                          className="h-8 text-xs"
                          value={item.notes}
                          onChange={(e) =>
                            updateOrderItem(i, "notes", e.target.value)
                          }
                          placeholder="Opcional..."
                        />
                      </div>
                      <div className="flex justify-end sm:col-span-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          onClick={() => removeOrderItem(i)}
                        >
                          <Trash2 className="w-3 h-3 text-red-400" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <Label>Observações Gerais</Label>
              <Textarea
                value={orderNotes}
                onChange={(e) => setOrderNotes(e.target.value)}
                rows={2}
                placeholder="Prazo desejado, condições de entrega..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowOrder(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleCreateOrder}
              className="bg-orange-500 hover:bg-orange-600 text-white"
              disabled={createOrder.isPending}
            >
              <ShoppingCart className="w-4 h-4 mr-2" /> Criar Pedido
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Visualizar Pedido + WhatsApp */}
      <Dialog open={showViewOrder} onOpenChange={setShowViewOrder}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-orange-500" />
              Pedido #{viewOrderId} — {viewOrder?.supplierName}
            </DialogTitle>
          </DialogHeader>
          {viewOrder && (
            <div className="space-y-4">
              {/* Status */}
              <div className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground">Status:</span>
                {statusBadge(viewOrder.status)}
                {viewOrder.status !== "recebido" && (
                  <Select
                    value={viewOrder.status}
                    onValueChange={(v) =>
                      updateOrderStatus.mutate({
                        id: viewOrder.id,
                        status: v as any,
                      })
                    }
                  >
                    <SelectTrigger className="w-40 h-7 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="rascunho">Rascunho</SelectItem>
                      <SelectItem value="enviado">Enviado</SelectItem>
                      <SelectItem value="confirmado">Confirmado</SelectItem>
                      <SelectItem value="cancelado">Cancelado</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </div>

              {viewOrder.status !== "recebido" &&
                viewOrder.status !== "cancelado" && (
                  <Button
                    className="w-full bg-orange-500 text-white hover:bg-orange-600"
                    onClick={startReceivingOrder}
                  >
                    <PackageCheck className="mr-2 h-4 w-4" />
                    Receber pedido e dar entrada no estoque
                  </Button>
                )}

              {viewOrder.status === "recebido" && viewOrder.receivedAt && (
                <div className="rounded-lg border border-green-700/40 bg-green-950/20 p-3 text-sm text-green-300">
                  <CheckCircle2 className="mr-2 inline h-4 w-4" />
                  Recebido em{" "}
                  {new Date(viewOrder.receivedAt).toLocaleString("pt-BR")} e
                  lançado no estoque.
                </div>
              )}

              {/* Itens */}
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Material</TableHead>
                    <TableHead className="text-right">Qtd</TableHead>
                    <TableHead className="text-right">Preço Unit.</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Obs.</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {viewOrder.items.map((item) => {
                    const qty = parseFloat(String(item.quantity));
                    const price = parseFloat(String(item.unitPrice));
                    const total = qty * price;
                    return (
                      <TableRow key={item.id}>
                        <TableCell>
                          <p>{item.materialName}</p>
                          {item.receivedAt && (
                            <p className="mt-1 text-xs text-green-400">
                              Recebido: {Number(item.receivedQuantity)}{" "}
                              {item.purchaseUnit || item.materialUnit}
                              {item.receivedLotNumber
                                ? ` · lote ${item.receivedLotNumber}`
                                : ""}
                              {item.receivedExpiresAt
                                ? ` · validade ${new Date(item.receivedExpiresAt).toLocaleDateString("pt-BR")}`
                                : ""}
                            </p>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {qty} {item.materialUnit}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {price > 0 ? `R$ ${price.toFixed(2)}` : "—"}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {total > 0 ? `R$ ${total.toFixed(2)}` : "—"}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {item.notes || "—"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>

              {viewOrder.notes && (
                <p className="text-sm text-muted-foreground italic">
                  📝 {viewOrder.notes}
                </p>
              )}

              {/* WhatsApp */}
              {waLink && (
                <div className="space-y-3 border border-green-800/50 rounded-lg p-4 bg-green-950/20">
                  <p className="text-sm font-medium text-green-400 flex items-center gap-2">
                    <MessageCircle className="w-4 h-4" /> Enviar via WhatsApp
                  </p>
                  <div className="bg-card rounded p-3 text-xs font-mono whitespace-pre-wrap text-muted-foreground max-h-40 overflow-y-auto">
                    {waLink.message}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 border-green-700 text-green-400 hover:bg-green-900/30"
                      onClick={() => handleCopyMessage(waLink.message)}
                    >
                      {copiedMsg ? (
                        <CheckCircle2 className="w-3 h-3 mr-1" />
                      ) : (
                        <Copy className="w-3 h-3 mr-1" />
                      )}
                      {copiedMsg ? "Copiado!" : "Copiar Mensagem"}
                    </Button>
                    <Button
                      size="sm"
                      className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                      onClick={() => {
                        window.open(waLink.link, "_blank");
                        updateOrderStatus.mutate({
                          id: viewOrder.id,
                          status: "enviado",
                        });
                      }}
                    >
                      <MessageCircle className="w-3 h-3 mr-1" /> Abrir WhatsApp
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Ao clicar em "Abrir WhatsApp", o status do pedido será
                    atualizado para <strong>Enviado</strong>.
                  </p>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowViewOrder(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Receber pedido e dar entrada no estoque */}
      <Dialog
        open={showReceiveOrder}
        onOpenChange={(open) => {
          setShowReceiveOrder(open);
          if (!open && !receiveOrder.isPending) setShowViewOrder(true);
        }}
      >
        <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg sm:text-xl">
              <PackageCheck className="h-5 w-5 shrink-0 text-orange-500" />
              Receber pedido #{viewOrderId}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-5">
            <div className="rounded-lg border border-orange-500/30 bg-orange-500/[0.04] p-3 text-sm">
              Confira o que realmente chegou. Ao confirmar, cada quantidade será
              convertida para a unidade-base, lançada no estoque e vinculada ao
              lote e à validade informados.
            </div>

            <div className="space-y-4">
              {receiptItems.map((item, index) => {
                const normalized =
                  item.qualityStatus === "recusado"
                    ? 0
                    : (Number(item.receivedQuantity) || 0) *
                      (Number(item.unitsPerPackage) || 0);
                return (
                  <Card key={item.orderItemId} className="overflow-hidden">
                    <CardHeader className="p-4 pb-2">
                      <CardTitle className="break-words text-sm sm:text-base">
                        {index + 1}. {item.materialName}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="grid grid-cols-1 gap-3 p-4 pt-2 sm:grid-cols-2 lg:grid-cols-3">
                      <div className="sm:col-span-2 lg:col-span-3">
                        <Label className="text-xs">Destino no estoque</Label>
                        <Select
                          value={
                            item.materialId > 0
                              ? String(item.materialId)
                              : "new"
                          }
                          onValueChange={(value) =>
                            updateReceiptItem(index, "materialId", value)
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="new">
                              Criar novo cadastro automaticamente
                            </SelectItem>
                            {materials.map((material) => (
                              <SelectItem
                                key={material.id}
                                value={String(material.id)}
                              >
                                {material.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label className="text-xs">Quantidade recebida</Label>
                        <Input
                          type="number"
                          min="0"
                          step="0.001"
                          value={item.receivedQuantity}
                          disabled={item.qualityStatus === "recusado"}
                          onChange={(event) =>
                            updateReceiptItem(
                              index,
                              "receivedQuantity",
                              event.target.value,
                            )
                          }
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Unidade de compra</Label>
                        <Input
                          value={item.purchaseUnit}
                          onChange={(event) =>
                            updateReceiptItem(
                              index,
                              "purchaseUnit",
                              event.target.value,
                            )
                          }
                        />
                      </div>
                      <div>
                        <Label className="text-xs">
                          Unidades por embalagem
                        </Label>
                        <Input
                          type="number"
                          min="0.001"
                          step="0.001"
                          value={item.unitsPerPackage}
                          onChange={(event) =>
                            updateReceiptItem(
                              index,
                              "unitsPerPackage",
                              event.target.value,
                            )
                          }
                        />
                      </div>
                      <div>
                        <Label className="text-xs">
                          Unidade-base do estoque
                        </Label>
                        <Input
                          value={item.baseUnit}
                          onChange={(event) =>
                            updateReceiptItem(
                              index,
                              "baseUnit",
                              event.target.value,
                            )
                          }
                        />
                      </div>
                      <div>
                        <Label className="text-xs">
                          Preço pago por {item.purchaseUnit || "unidade"}
                        </Label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.unitPrice}
                          onChange={(event) =>
                            updateReceiptItem(
                              index,
                              "unitPrice",
                              event.target.value,
                            )
                          }
                          placeholder="0,00"
                        />
                      </div>
                      <div className="flex items-end">
                        <div className="w-full rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                          Entrada calculada:{" "}
                          <strong className="text-foreground">
                            {normalized.toLocaleString("pt-BR")}{" "}
                            {item.baseUnit || "un"}
                          </strong>
                        </div>
                      </div>

                      <div>
                        <Label className="text-xs">Lote (opcional)</Label>
                        <Input
                          value={item.lotNumber}
                          onChange={(event) =>
                            updateReceiptItem(
                              index,
                              "lotNumber",
                              event.target.value,
                            )
                          }
                          placeholder="Ex.: LOT-240831"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Validade (opcional)</Label>
                        <Input
                          type="date"
                          value={item.expiresAt}
                          onChange={(event) =>
                            updateReceiptItem(
                              index,
                              "expiresAt",
                              event.target.value,
                            )
                          }
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Avisar em (opcional)</Label>
                        <Input
                          type="date"
                          value={item.alertAt}
                          onChange={(event) =>
                            updateReceiptItem(
                              index,
                              "alertAt",
                              event.target.value,
                            )
                          }
                        />
                      </div>

                      <div>
                        <Label className="text-xs">Condição / qualidade</Label>
                        <Select
                          value={item.qualityStatus}
                          onValueChange={(value) =>
                            updateReceiptItem(index, "qualityStatus", value)
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="nao_verificada">
                              Não verificada
                            </SelectItem>
                            <SelectItem value="aprovado">
                              Aprovado / íntegro
                            </SelectItem>
                            <SelectItem value="ressalva">
                              Recebido com ressalva
                            </SelectItem>
                            <SelectItem value="recusado">
                              Recusado — não entra no estoque
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="sm:col-span-1 lg:col-span-2">
                        <Label className="text-xs">
                          Observação da conferência
                        </Label>
                        <Input
                          value={item.qualityNotes}
                          onChange={(event) =>
                            updateReceiptItem(
                              index,
                              "qualityNotes",
                              event.target.value,
                            )
                          }
                          placeholder="Lacre, avaria, divergência ou observação..."
                        />
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            <div className="rounded-lg border border-violet-500/30 bg-violet-500/[0.04] p-3 sm:p-4">
              <div className="mb-2 flex items-start gap-2">
                <ScanLine className="mt-0.5 h-5 w-5 shrink-0 text-violet-400" />
                <div>
                  <p className="font-medium">Assistente para ler a embalagem</p>
                  <p className="text-xs text-muted-foreground">
                    Escolha o assistente que você já utiliza, copie o prompt e
                    envie as fotos por lá. Depois copie lote, validade e demais
                    dados para os campos acima.
                  </p>
                </div>
              </div>
              <Accordion type="single" collapsible className="w-full">
                {(["ChatGPT", "Gemini", "Claude"] as OcrAssistant[]).map(
                  (assistant) => (
                    <AccordionItem key={assistant} value={assistant}>
                      <AccordionTrigger className="py-3">
                        <span className="flex items-center gap-2">
                          <Bot className="h-4 w-4" /> Prompt para {assistant}
                        </span>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="space-y-3">
                          <div className="max-h-40 overflow-y-auto whitespace-pre-wrap rounded-md border bg-background p-3 text-xs text-muted-foreground">
                            {buildPackagingOcrPrompt(
                              assistant,
                              viewOrderId,
                              receiptItems.map(
                                (receiptItem) => receiptItem.materialName,
                              ),
                            )}
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            className="w-full"
                            onClick={() => copyOcrPrompt(assistant)}
                          >
                            {copiedAssistant === assistant ? (
                              <CheckCircle2 className="mr-2 h-4 w-4 text-green-400" />
                            ) : (
                              <Copy className="mr-2 h-4 w-4" />
                            )}
                            {copiedAssistant === assistant
                              ? "Prompt copiado!"
                              : `Copiar prompt para ${assistant}`}
                          </Button>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  ),
                )}
              </Accordion>
              <p className="mt-3 text-[11px] text-muted-foreground">
                Revise sempre o texto extraído comparando com a embalagem. O
                sistema não envia fotos nem dados automaticamente para nenhuma
                IA.
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              disabled={receiveOrder.isPending}
              onClick={() => {
                setShowReceiveOrder(false);
                setShowViewOrder(true);
              }}
            >
              Voltar sem salvar
            </Button>
            <Button
              className="bg-green-600 text-white hover:bg-green-700"
              disabled={receiveOrder.isPending || receiptItems.length === 0}
              onClick={handleReceiveOrder}
            >
              <PackageCheck className="mr-2 h-4 w-4" />
              {receiveOrder.isPending
                ? "Lançando no estoque..."
                : "Confirmar recebimento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
