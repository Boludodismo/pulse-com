import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  ChevronLeft,
  Clock,
  DollarSign,
  Package,
  TrendingUp,
  TrendingDown,
  Camera,
  MapPin,
  Palette,
  User,
  CheckCircle2,
  Edit3,
  Save,
  ExternalLink,
} from "lucide-react";

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  em_andamento: { label: "Em andamento", color: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  pausado: { label: "Pausado", color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
  finalizado: { label: "Finalizado", color: "bg-green-500/20 text-green-400 border-green-500/30" },
  retorno: { label: "Retorno", color: "bg-purple-500/20 text-purple-400 border-purple-500/30" },
  retoque: { label: "Retoque", color: "bg-orange-500/20 text-orange-400 border-orange-500/30" },
};

const CATEGORY_LABELS: Record<string, string> = {
  ink: "Tinta",
  cartridge: "Cartucho",
  disposable: "Descartável",
  liquid: "Líquido",
  protection: "Proteção",
  stencil: "Stencil",
  aftercare: "Pós-cuidado",
  other: "Outro",
};

export default function ProcedureSummary() {
  const { id } = useParams<{ id: string }>();
  const procedureId = parseInt(id ?? "0", 10);
  const [, navigate] = useLocation();

  const [editingNotes, setEditingNotes] = useState(false);
  const [notesValue, setNotesValue] = useState("");
  const [editingCharged, setEditingCharged] = useState(false);
  const [chargedValue, setChargedValue] = useState("");

  const procedureQuery = trpc.procedures.getById.useQuery(
    { id: procedureId },
    { enabled: procedureId > 0 }
  );

  const utils = trpc.useUtils();

  const updateMutation = trpc.procedures.update.useMutation({
    onSuccess: () => {
      utils.procedures.getById.invalidate({ id: procedureId });
      setEditingNotes(false);
      setEditingCharged(false);
      toast.success("Procedimento atualizado.");
    },
    onError: (err) => toast.error("Erro: " + err.message),
  });

  const procedure = procedureQuery.data?.procedure;
  const consumables = procedureQuery.data?.consumables ?? [];
  const images = procedureQuery.data?.images ?? [];

  if (procedureQuery.isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!procedure) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-muted-foreground">Procedimento não encontrado.</p>
      </div>
    );
  }

  // ── Cálculos financeiros ─────────────────────────────────────────────────
  const totalMaterialCost = consumables.reduce(
    (sum, c) => sum + Number(c.estimatedTotalCost ?? 0),
    0
  );
  const chargedAmount = Number(procedure.chargedAmount ?? 0);
  const durationMinutes = procedure.totalDurationMinutes ?? 0;
  const durationHours = durationMinutes / 60;
  const grossMargin = chargedAmount - totalMaterialCost;
  const grossMarginPercent = chargedAmount > 0 ? (grossMargin / chargedAmount) * 100 : 0;
  const hourlyRate = durationHours > 0 ? grossMargin / durationHours : 0;

  // ── Agrupar insumos por categoria ────────────────────────────────────────
  const consumablesByCategory = consumables.reduce<Record<string, typeof consumables>>((acc, c) => {
    if (!acc[c.category]) acc[c.category] = [];
    acc[c.category].push(c);
    return acc;
  }, {});

  const statusInfo = STATUS_LABELS[procedure.status] ?? STATUS_LABELS.em_andamento;

  const formatDuration = (minutes: number) => {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h === 0) return `${m}min`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}min`;
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card px-4 py-3 flex items-center gap-3 sticky top-0 z-40">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate(`/procedures/${procedureId}`)}
        >
          <ChevronLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="font-semibold truncate text-sm sm:text-base">Resumo do Procedimento</h1>
          <p className="text-xs text-muted-foreground truncate">{procedure.title}</p>
        </div>
        <Badge variant="outline" className={`text-xs ${statusInfo.color}`}>
          {statusInfo.label}
        </Badge>
      </header>

      <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6">

        {/* ── Informações gerais ─────────────────────────────────────────── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <User className="w-4 h-4 text-primary" />
              Informações do Procedimento
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
              {procedure.artistName && (
                <div>
                  <p className="text-muted-foreground text-xs mb-0.5">Artista</p>
                  <p className="font-medium">{procedure.artistName}</p>
                </div>
              )}
              {procedure.bodyLocation && (
                <div>
                  <p className="text-muted-foreground text-xs mb-0.5">Localização</p>
                  <p className="font-medium flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    {procedure.bodyLocation}
                  </p>
                </div>
              )}
              {procedure.tattooStyle && (
                <div>
                  <p className="text-muted-foreground text-xs mb-0.5">Estilo</p>
                  <p className="font-medium flex items-center gap-1">
                    <Palette className="w-3 h-3" />
                    {procedure.tattooStyle}
                  </p>
                </div>
              )}
              {procedure.startedAt && (
                <div>
                  <p className="text-muted-foreground text-xs mb-0.5">Início</p>
                  <p className="font-medium">
                    {new Date(procedure.startedAt).toLocaleString("pt-BR", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              )}
              {procedure.finishedAt && (
                <div>
                  <p className="text-muted-foreground text-xs mb-0.5">Término</p>
                  <p className="font-medium">
                    {new Date(procedure.finishedAt).toLocaleString("pt-BR", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              )}
              <div>
                <p className="text-muted-foreground text-xs mb-0.5">Duração total</p>
                <p className="font-medium flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {durationMinutes > 0 ? formatDuration(durationMinutes) : "—"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ── Resumo financeiro ──────────────────────────────────────────── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-primary" />
              Resumo Financeiro
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Valor cobrado */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Valor cobrado</p>
                <p className="text-xs text-muted-foreground">Valor total recebido do cliente</p>
              </div>
              {editingCharged ? (
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={0}
                    step={0.01}
                    value={chargedValue}
                    onChange={(e) => setChargedValue(e.target.value)}
                    className="w-28 h-8 text-right"
                    autoFocus
                  />
                  <Button
                    size="sm"
                    className="h-8 gap-1"
                    onClick={() => {
                      updateMutation.mutate({
                        id: procedureId,
                        chargedAmount: Math.round(Number(chargedValue) * 100),
                      });
                    }}
                    disabled={updateMutation.isPending}
                  >
                    <Save className="w-3 h-3" />
                    Salvar
                  </Button>
                  <Button size="sm" variant="ghost" className="h-8" onClick={() => setEditingCharged(false)}>
                    Cancelar
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-xl font-bold text-green-500">
                    R$ {(chargedAmount / 100).toFixed(2)}
                  </span>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    onClick={() => {
                      setChargedValue(String(chargedAmount / 100));
                      setEditingCharged(true);
                    }}
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              )}
            </div>

            <Separator />

            {/* Custo de materiais */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Custo de materiais</p>
                <p className="text-xs text-muted-foreground">{consumables.length} insumo(s) registrado(s)</p>
              </div>
              <span className="text-lg font-semibold text-red-400">
                - R$ {totalMaterialCost.toFixed(2)}
              </span>
            </div>

            <Separator />

            {/* Margem bruta */}
            <div className="flex items-center justify-between bg-muted/30 rounded-lg p-3">
              <div>
                <p className="text-sm font-semibold">Margem bruta</p>
                <p className="text-xs text-muted-foreground">
                  {grossMarginPercent.toFixed(1)}% do valor cobrado
                </p>
              </div>
              <div className="text-right">
                <div className={`text-xl font-bold flex items-center gap-1 ${grossMargin >= 0 ? "text-green-500" : "text-red-400"}`}>
                  {grossMargin >= 0 ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
                  R$ {(grossMargin / 100).toFixed(2)}
                </div>
              </div>
            </div>

            {/* Taxa horária */}
            {durationHours > 0 && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Taxa horária efetiva</span>
                <span className="font-medium">R$ {(hourlyRate / 100).toFixed(2)}/h</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Detalhamento de insumos ────────────────────────────────────── */}
        {consumables.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Package className="w-4 h-4 text-primary" />
                Detalhamento de Insumos
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {Object.entries(consumablesByCategory).map(([category, items]) => (
                <div key={category}>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                    {CATEGORY_LABELS[category] ?? category}
                  </p>
                  <div className="space-y-1">
                    {items.map((c) => (
                      <div key={c.id} className="flex items-center justify-between text-sm py-1">
                        <span className="text-muted-foreground">{c.name}</span>
                        <div className="flex items-center gap-4">
                          <span className="text-xs text-muted-foreground">
                            {Number(c.quantity)} {c.unit}
                          </span>
                          <span className="font-medium w-20 text-right">
                            R$ {Number(c.estimatedTotalCost ?? 0).toFixed(2)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-between text-xs font-semibold mt-1 pt-1 border-t">
                    <span>Subtotal {CATEGORY_LABELS[category] ?? category}</span>
                    <span>R$ {items.reduce((s, c) => s + Number(c.estimatedTotalCost ?? 0), 0).toFixed(2)}</span>
                  </div>
                </div>
              ))}
              <Separator />
              <div className="flex justify-between font-bold">
                <span>Total materiais</span>
                <span className="text-red-400">R$ {totalMaterialCost.toFixed(2)}</span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── Imagens ────────────────────────────────────────────────────── */}
        {images.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Camera className="w-4 h-4 text-primary" />
                Imagens ({images.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                {images.map((img) => (
                  <div key={img.id} className="relative group aspect-square">
                    <img
                      src={img.imageUrl}
                      alt={img.imageType}
                      className="w-full h-full object-cover rounded-lg border cursor-pointer hover:opacity-80 transition-opacity"
                      onClick={() => window.open(img.imageUrl, "_blank")}
                    />
                    <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[9px] text-center py-0.5 rounded-b-lg opacity-0 group-hover:opacity-100 transition-opacity">
                      {img.imageType === "reference" ? "Ref." : img.imageType === "progress" ? "Prog." : "Final"}
                    </div>
                    <ExternalLink className="absolute top-1 right-1 w-3 h-3 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── Observações ────────────────────────────────────────────────── */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-primary" />
                Observações técnicas
              </CardTitle>
              {!editingNotes && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1.5 h-7 text-xs"
                  onClick={() => {
                    setNotesValue(procedure.notes ?? "");
                    setEditingNotes(true);
                  }}
                >
                  <Edit3 className="w-3 h-3" />
                  Editar
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {editingNotes ? (
              <div className="space-y-3">
                <Textarea
                  value={notesValue}
                  onChange={(e) => setNotesValue(e.target.value)}
                  rows={5}
                  placeholder="Anote técnicas utilizadas, reações do cliente, ajustes de máquina, próximos passos..."
                  className="resize-none"
                  autoFocus
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => updateMutation.mutate({ id: procedureId, notes: notesValue })}
                    disabled={updateMutation.isPending}
                    className="gap-1.5"
                  >
                    <Save className="w-3 h-3" />
                    Salvar
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditingNotes(false)}>
                    Cancelar
                  </Button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                {procedure.notes || "Nenhuma observação registrada."}
              </p>
            )}
          </CardContent>
        </Card>

        {/* ── Ações ──────────────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row gap-3 pb-8">
          <Button
            variant="outline"
            className="flex-1 gap-2"
            onClick={() => navigate(`/procedures/${procedureId}`)}
          >
            <Clock className="w-4 h-4" />
            Voltar à sessão
          </Button>
          <Button
            className="flex-1 gap-2"
            onClick={() => navigate(`/clients/${procedure.clientId}?tab=procedures`)}
          >
            <User className="w-4 h-4" />
            Ver perfil do cliente
          </Button>
        </div>
      </div>
    </div>
  );
}
