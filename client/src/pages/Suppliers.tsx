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
  materialName: string;
  materialUnit: string;
  quantity: string;
  unitPrice: string;
  notes: string;
};

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

  // Visualizar pedido existente
  const [viewOrderId, setViewOrderId] = useState<number | null>(null);
  const [showViewOrder, setShowViewOrder] = useState(false);
  const [whatsappLink, setWhatsappLink] = useState("");
  const [whatsappMsg, setWhatsappMsg] = useState("");
  const [copiedMsg, setCopiedMsg] = useState(false);

  const { data: suppliers = [], isLoading } = trpc.suppliers.list.useQuery({ activeOnly: true });
  const { data: materials = [] } = trpc.stock.listMaterials.useQuery({ activeOnly: true });
  const { data: orders = [] } = trpc.stock.listOrders.useQuery();
  const { data: viewOrder } = trpc.stock.getOrder.useQuery(
    { id: viewOrderId! },
    { enabled: showViewOrder && viewOrderId !== null }
  );
  const { data: waLink } = trpc.stock.getWhatsAppLink.useQuery(
    { orderId: viewOrderId! },
    { enabled: showViewOrder && viewOrderId !== null }
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
    setShowOrder(true);
  };

  const addOrderItem = () => {
    setOrderItems(prev => [...prev, {
      materialId: 0,
      materialName: "",
      materialUnit: "",
      quantity: "",
      unitPrice: "",
      notes: "",
    }]);
  };

  const updateOrderItem = (index: number, field: keyof OrderItem, value: string) => {
    setOrderItems(prev => {
      const updated = [...prev];
      if (field === "materialId") {
        const mat = materials.find(m => m.id === parseInt(value));
        updated[index] = {
          ...updated[index],
          materialId: parseInt(value),
          materialName: mat?.name || "",
          materialUnit: mat?.unit || "",
        };
      } else {
        updated[index] = { ...updated[index], [field]: value };
      }
      return updated;
    });
  };

  const removeOrderItem = (index: number) => {
    setOrderItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleCreateOrder = () => {
    if (!orderSupplierId) return;
    const validItems = orderItems.filter(i => i.materialId > 0 && parseFloat(i.quantity) > 0);
    if (validItems.length === 0) {
      toast.error("Adicione pelo menos um item ao pedido.");
      return;
    }
    createOrder.mutate({
      supplierId: orderSupplierId,
      notes: orderNotes || undefined,
      items: validItems.map(i => ({
        materialId: i.materialId,
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

  const statusBadge = (status: string) => {
    const map: Record<string, { label: string; className: string }> = {
      rascunho: { label: "Rascunho", className: "bg-gray-700 text-gray-300" },
      enviado: { label: "Enviado", className: "bg-blue-900 text-blue-300" },
      confirmado: { label: "Confirmado", className: "bg-yellow-900 text-yellow-300" },
      recebido: { label: "Recebido", className: "bg-green-900 text-green-300" },
      cancelado: { label: "Cancelado", className: "bg-red-900 text-red-300" },
    };
    const s = map[status] || map.rascunho;
    return <Badge className={`text-xs ${s.className}`}>{s.label}</Badge>;
  };

  const filtered = suppliers.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    (s.contactName || "").toLowerCase().includes(search.toLowerCase())
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
            <p className="text-muted-foreground text-xs sm:text-sm mt-1">Gerencie fornecedores e pedidos de orçamento</p>
          </div>
          <Button onClick={() => { setEditingId(null); setForm(emptySupplierForm()); setShowForm(true); }}
            className="bg-orange-500 hover:bg-orange-600 text-white w-full sm:w-auto text-xs sm:text-sm">
            <Plus className="w-3 w-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" /><span className="hidden sm:inline">Novo Fornecedor</span><span className="sm:hidden">Novo</span>
          </Button>
        </div>

        <Tabs defaultValue="suppliers">
          <TabsList className="w-full sm:w-auto">
            <TabsTrigger value="suppliers" className="flex items-center gap-1 text-xs sm:text-sm">
              <Truck className="w-3 h-3 sm:w-4 sm:h-4" /><span className="hidden sm:inline">Fornecedores</span><span className="sm:hidden">Forn.</span>
            </TabsTrigger>
            <TabsTrigger value="orders" className="flex items-center gap-1 text-xs sm:text-sm">
              <ClipboardList className="w-3 h-3 sm:w-4 sm:h-4" /><span className="hidden sm:inline">Pedidos de Orçamento</span><span className="sm:hidden">Ped.</span>
              {orders.length > 0 && (
                <Badge className="ml-1 bg-orange-500 text-white text-xs">{orders.length}</Badge>
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
                <p className="text-muted-foreground col-span-3 text-center py-8">Carregando...</p>
              ) : filtered.length === 0 ? (
                <p className="text-muted-foreground col-span-3 text-center py-8">Nenhum fornecedor cadastrado.</p>
              ) : filtered.map((s) => (
                <Card key={s.id} className="hover:border-orange-500/50 transition-colors">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <CardTitle className="text-base">{s.name}</CardTitle>
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" title="Editar" onClick={() => handleEdit(s)}>
                          <Settings2 className="w-4 h-4" />
                        </Button>
                        <Button size="icon" variant="ghost" title="Remover"
                          onClick={() => { if (confirm("Remover este fornecedor?")) deleteSupplier.mutate({ id: s.id }); }}>
                          <Trash2 className="w-4 h-4 text-red-400" />
                        </Button>
                      </div>
                    </div>
                    {s.cnpj && <p className="text-xs text-muted-foreground">CNPJ: {s.cnpj}</p>}
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {s.contactName && (
                      <p className="text-sm text-muted-foreground">👤 {s.contactName}</p>
                    )}
                    {s.phone && (
                      <p className="text-sm flex items-center gap-1">
                        <Phone className="w-3 h-3 text-muted-foreground" />
                        <a href={`tel:${s.phone}`} className="hover:text-orange-400">{s.phone}</a>
                      </p>
                    )}
                    {s.whatsapp && (
                      <p className="text-sm flex items-center gap-1">
                        <MessageCircle className="w-3 h-3 text-green-400" />
                        <a href={`https://wa.me/55${s.whatsapp.replace(/\D/g, "")}`} target="_blank" rel="noreferrer"
                          className="hover:text-green-400">{s.whatsapp}</a>
                      </p>
                    )}
                    {s.email && (
                      <p className="text-sm flex items-center gap-1">
                        <Mail className="w-3 h-3 text-muted-foreground" />
                        <a href={`mailto:${s.email}`} className="hover:text-orange-400 truncate">{s.email}</a>
                      </p>
                    )}
                    {s.notes && <p className="text-xs text-muted-foreground italic mt-1">{s.notes}</p>}
                    <Button size="sm" variant="outline" className="w-full mt-2 border-orange-500/50 text-orange-400 hover:bg-orange-500/10"
                      onClick={() => handleNewOrder(s)}>
                      <ShoppingCart className="w-3 h-3 mr-1" /> Criar Pedido de Orçamento
                    </Button>
                  </CardContent>
                </Card>
              ))}
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
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          Nenhum pedido criado ainda.
                        </TableCell>
                      </TableRow>
                    ) : orders.map((o) => (
                      <TableRow key={o.id}>
                        <TableCell className="font-mono text-muted-foreground">#{o.id}</TableCell>
                        <TableCell className="font-medium">{o.supplierName}</TableCell>
                        <TableCell>{statusBadge(o.status)}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(o.createdAt).toLocaleDateString("pt-BR")}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {o.sentAt ? new Date(o.sentAt).toLocaleDateString("pt-BR") : "—"}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1 justify-end">
                            <Button size="sm" variant="outline" className="text-xs"
                              onClick={() => { setViewOrderId(o.id); setShowViewOrder(true); }}>
                              <ExternalLink className="w-3 h-3 mr-1" /> Ver
                            </Button>
                            <Button size="icon" variant="ghost"
                              onClick={() => { if (confirm("Remover este pedido?")) deleteOrder.mutate({ id: o.id }); }}>
                              <Trash2 className="w-4 h-4 text-red-400" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Dialog: Cadastro/Edição de Fornecedor */}
      <Dialog open={showForm} onOpenChange={(o) => { setShowForm(o); if (!o) { setEditingId(null); setForm(emptySupplierForm()); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar Fornecedor" : "Novo Fornecedor"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label>Nome / Razão Social *</Label>
                <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ex: Distribuidora Tattoo SP" />
              </div>
              <div>
                <Label>CNPJ</Label>
                <Input value={form.cnpj} onChange={e => setForm(f => ({ ...f, cnpj: e.target.value }))} placeholder="00.000.000/0001-00" />
              </div>
              <div>
                <Label>Nome do Contato</Label>
                <Input value={form.contactName} onChange={e => setForm(f => ({ ...f, contactName: e.target.value }))} placeholder="Ex: João Silva" />
              </div>
              <div>
                <Label>Telefone</Label>
                <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="(11) 9999-9999" />
              </div>
              <div>
                <Label>WhatsApp</Label>
                <Input value={form.whatsapp} onChange={e => setForm(f => ({ ...f, whatsapp: e.target.value }))} placeholder="(11) 99999-9999" />
              </div>
              <div className="col-span-2">
                <Label>E-mail</Label>
                <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="contato@fornecedor.com.br" />
              </div>
              <div className="col-span-2">
                <Label>Endereço</Label>
                <Input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder="Rua, número, cidade..." />
              </div>
              <div className="col-span-2">
                <Label>Observações</Label>
                <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} placeholder="Prazo de entrega, condições de pagamento..." />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
            <Button onClick={handleSupplierSubmit} className="bg-orange-500 hover:bg-orange-600 text-white"
              disabled={createSupplier.isPending || updateSupplier.isPending}>
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
              <div className="flex items-center justify-between mb-2">
                <Label className="text-base">Itens do Pedido</Label>
                <Button size="sm" variant="outline" onClick={addOrderItem}>
                  <Plus className="w-3 h-3 mr-1" /> Adicionar Item
                </Button>
              </div>
              {orderItems.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground border border-dashed rounded-lg">
                  <ShoppingCart className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Nenhum item adicionado. Clique em "Adicionar Item".</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {orderItems.map((item, i) => (
                    <div key={i} className="grid grid-cols-12 gap-2 items-end p-3 bg-card rounded-lg border border-border">
                      <div className="col-span-4">
                        <Label className="text-xs">Material</Label>
                        <Select value={item.materialId > 0 ? String(item.materialId) : ""}
                          onValueChange={v => updateOrderItem(i, "materialId", v)}>
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue placeholder="Selecionar..." />
                          </SelectTrigger>
                          <SelectContent>
                            {materials.map(m => (
                              <SelectItem key={m.id} value={String(m.id)}>{m.name} ({m.unit})</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="col-span-2">
                        <Label className="text-xs">Qtd ({item.materialUnit || "un"})</Label>
                        <Input className="h-8 text-xs" type="number" min="0" step="0.01"
                          value={item.quantity} onChange={e => updateOrderItem(i, "quantity", e.target.value)}
                          placeholder="0" />
                      </div>
                      <div className="col-span-2">
                        <Label className="text-xs">Preço Unit. (R$)</Label>
                        <Input className="h-8 text-xs" type="number" min="0" step="0.01"
                          value={item.unitPrice} onChange={e => updateOrderItem(i, "unitPrice", e.target.value)}
                          placeholder="0,00" />
                      </div>
                      <div className="col-span-3">
                        <Label className="text-xs">Observação</Label>
                        <Input className="h-8 text-xs" value={item.notes}
                          onChange={e => updateOrderItem(i, "notes", e.target.value)}
                          placeholder="Opcional..." />
                      </div>
                      <div className="col-span-1 flex justify-end">
                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => removeOrderItem(i)}>
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
              <Textarea value={orderNotes} onChange={e => setOrderNotes(e.target.value)} rows={2}
                placeholder="Prazo desejado, condições de entrega..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowOrder(false)}>Cancelar</Button>
            <Button onClick={handleCreateOrder} className="bg-orange-500 hover:bg-orange-600 text-white"
              disabled={createOrder.isPending}>
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
                <Select value={viewOrder.status}
                  onValueChange={v => updateOrderStatus.mutate({ id: viewOrder.id, status: v as any })}>
                  <SelectTrigger className="w-40 h-7 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="rascunho">Rascunho</SelectItem>
                    <SelectItem value="enviado">Enviado</SelectItem>
                    <SelectItem value="confirmado">Confirmado</SelectItem>
                    <SelectItem value="recebido">Recebido</SelectItem>
                    <SelectItem value="cancelado">Cancelado</SelectItem>
                  </SelectContent>
                </Select>
              </div>

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
                        <TableCell>{item.materialName}</TableCell>
                        <TableCell className="text-right font-mono">{qty} {item.materialUnit}</TableCell>
                        <TableCell className="text-right font-mono">
                          {price > 0 ? `R$ ${price.toFixed(2)}` : "—"}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {total > 0 ? `R$ ${total.toFixed(2)}` : "—"}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{item.notes || "—"}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>

              {viewOrder.notes && (
                <p className="text-sm text-muted-foreground italic">📝 {viewOrder.notes}</p>
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
                    <Button size="sm" variant="outline" className="flex-1 border-green-700 text-green-400 hover:bg-green-900/30"
                      onClick={() => handleCopyMessage(waLink.message)}>
                      {copiedMsg ? <CheckCircle2 className="w-3 h-3 mr-1" /> : <Copy className="w-3 h-3 mr-1" />}
                      {copiedMsg ? "Copiado!" : "Copiar Mensagem"}
                    </Button>
                    <Button size="sm" className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                      onClick={() => {
                        window.open(waLink.link, "_blank");
                        updateOrderStatus.mutate({ id: viewOrder.id, status: "enviado" });
                      }}>
                      <MessageCircle className="w-3 h-3 mr-1" /> Abrir WhatsApp
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Ao clicar em "Abrir WhatsApp", o status do pedido será atualizado para <strong>Enviado</strong>.
                  </p>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowViewOrder(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
