import { useState, useEffect, useRef, useCallback } from "react";
import React from "react";
import { useParams, useLocation } from "wouter";
import type { ReactNode } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
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
import { Label } from "@/components/ui/label";
import { SkeletonCard } from "@/components/SkeletonCard";
import { SkeletonTable } from "@/components/SkeletonTable";
import { toast } from "sonner";
import {
  Play,
  Pause,
  Square,
  Plus,
  Minus,
  Trash2,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Upload,
  ChevronLeft,
  Clock,
  Droplets,
  Package,
  Shield,
  Layers,
  Zap,
  FlaskConical,
  Heart,
  MoreHorizontal,
  CheckCircle2,
  Camera,
  BarChart3,
  Calendar,
  Link2,
  ExternalLink,
} from "lucide-react";

// ─── Tipos ──────────────────────────────────────────────────────────────────

type Consumable = {
  id: number;
  procedureId: number;
  category: string;
  name: string;
  inventoryItemId: number | null;
  materialLotId: number | null;
  lotNumber: string | null;
  expiresAt: string | null;
  unit: string;
  quantity: string;
  estimatedUnitCost: string | null;
  estimatedTotalCost: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

type ConsumableCategory =
  | "ink"
  | "cartridge"
  | "disposable"
  | "liquid"
  | "protection"
  | "stencil"
  | "aftercare"
  | "other";
type ConsumableUnit =
  "drop" | "ml" | "unit" | "pair" | "gram" | "portion" | "roll_fraction";
type ConsumableForm = {
  inventoryItemId: string;
  materialLotId: string;
  name: string;
  category: ConsumableCategory;
  unit: ConsumableUnit;
  quantity: number;
  estimatedUnitCost: number;
  notes: string;
};

// ─── Constantes ─────────────────────────────────────────────────────────────

const CATEGORY_ICONS: Record<string, ReactNode> = {
  ink: <Droplets className="w-4 h-4" />,
  cartridge: <Zap className="w-4 h-4" />,
  disposable: <Package className="w-4 h-4" />,
  liquid: <FlaskConical className="w-4 h-4" />,
  protection: <Shield className="w-4 h-4" />,
  stencil: <Layers className="w-4 h-4" />,
  aftercare: <Heart className="w-4 h-4" />,
  other: <MoreHorizontal className="w-4 h-4" />,
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

const UNIT_LABELS: Record<string, string> = {
  drop: "gotas",
  ml: "ml",
  unit: "un",
  pair: "par",
  gram: "g",
  portion: "porção",
  roll_fraction: "fração rolo",
};

function inventoryCategory(category: string): ConsumableCategory {
  const value = category.toLowerCase();
  if (value.includes("tinta") || value.includes("pigment")) return "ink";
  if (value.includes("cartucho") || value.includes("agulha"))
    return "cartridge";
  if (
    value.includes("proteção") ||
    value.includes("protecao") ||
    value.includes("epi") ||
    value.includes("luva")
  )
    return "protection";
  if (
    value.includes("líquido") ||
    value.includes("liquido") ||
    value.includes("higien")
  )
    return "liquid";
  if (value.includes("stencil") || value.includes("papel")) return "stencil";
  if (value.includes("pós") || value.includes("pos") || value.includes("after"))
    return "aftercare";
  if (value.includes("descart") || value.includes("barreira"))
    return "disposable";
  return "other";
}

function inventoryUnit(unit: string): ConsumableUnit {
  const value = unit.toLowerCase();
  if (value === "ml" || value === "l") return "ml";
  if (value === "par") return "pair";
  if (value === "g" || value === "kg") return "gram";
  if (value === "m" || value === "rolo") return "roll_fraction";
  return "unit";
}

const QUICK_CONSUMABLES = [
  {
    name: "Tinta preta",
    category: "ink" as const,
    unit: "drop" as const,
    qty: 5,
  },
  {
    name: "Tinta colorida",
    category: "ink" as const,
    unit: "drop" as const,
    qty: 3,
  },
  {
    name: "Cartucho liner",
    category: "cartridge" as const,
    unit: "unit" as const,
    qty: 1,
  },
  {
    name: "Cartucho shader",
    category: "cartridge" as const,
    unit: "unit" as const,
    qty: 1,
  },
  {
    name: "Luvas",
    category: "protection" as const,
    unit: "pair" as const,
    qty: 1,
  },
  {
    name: "Película",
    category: "protection" as const,
    unit: "unit" as const,
    qty: 1,
  },
  {
    name: "Vaselina",
    category: "liquid" as const,
    unit: "portion" as const,
    qty: 1,
  },
  {
    name: "Green Soap",
    category: "liquid" as const,
    unit: "ml" as const,
    qty: 10,
  },
  {
    name: "Papel stencil",
    category: "stencil" as const,
    unit: "unit" as const,
    qty: 1,
  },
];

// ─── Componente principal ────────────────────────────────────────────────────

export default function PodSession() {
  const { id } = useParams<{ id: string }>();
  const procedureId = parseInt(id ?? "0", 10);
  const [, navigate] = useLocation();

  // ── Estado do timer ──────────────────────────────────────────────────────
  const [elapsed, setElapsed] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number | null>(null);

  // ── Estado da imagem (zoom/pan) ──────────────────────────────────────────
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  const imageContainerRef = useRef<HTMLDivElement>(null);

  // ── Estado do modal de insumo ────────────────────────────────────────────
  const [addConsumableOpen, setAddConsumableOpen] = useState(false);
  const [selectedKitId, setSelectedKitId] = useState("");
  const [consumableForm, setConsumableForm] = useState<ConsumableForm>({
    inventoryItemId: "",
    materialLotId: "",
    name: "",
    category: "ink",
    unit: "drop",
    quantity: 1,
    estimatedUnitCost: 0,
    notes: "",
  });

  // ── Estado do upload de imagem ───────────────────────────────────────────
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Estado do modal de finalização ──────────────────────────────────────
  const [finalizeOpen, setFinalizeOpen] = useState(false);
  const [finalizeForm, setFinalizeForm] = useState({
    chargedAmount: "",
    paymentMethod: "pix" as
      "pix" | "dinheiro" | "credito" | "debito" | "transferencia",
    notes: "",
  });

  // ── Queries ──────────────────────────────────────────────────────────────
  const procedureQuery = trpc.procedures.getById.useQuery(
    { id: procedureId },
    { enabled: procedureId > 0, refetchInterval: 30_000 },
  );

  const utils = trpc.useUtils();

  const procedure = procedureQuery.data?.procedure;
  const consumables = procedureQuery.data?.consumables ?? [];
  const images = procedureQuery.data?.images ?? [];
  const { data: kits = [] } = trpc.kits.list.useQuery();
  const { data: inventoryMaterials = [] } = trpc.stock.listMaterials.useQuery({
    activeOnly: true,
  });
  const { data: inventoryLots = [] } = trpc.stock.listLots.useQuery({});
  const availableLots = inventoryLots.filter(
    (lot) =>
      String(lot.materialId) === consumableForm.inventoryItemId &&
      Number(lot.currentQuantity) > 0 &&
      (!lot.expiresAt || new Date(lot.expiresAt).getTime() >= Date.now()),
  );

  // Agendamento vinculado (se houver)
  const linkedAppointmentQuery = trpc.appointments.getById.useQuery(
    { id: procedure?.appointmentId ?? 0 },
    {
      enabled:
        !!procedure?.appointmentId && (procedure?.appointmentId ?? 0) > 0,
    },
  );
  const linkedAppointment = linkedAppointmentQuery.data;

  // ── Mutations ────────────────────────────────────────────────────────────
  const timerMutation = trpc.procedures.timerAction.useMutation({
    onSuccess: () => utils.procedures.getById.invalidate({ id: procedureId }),
    onError: (err) => toast.error("Erro no timer: " + err.message),
  });

  const addConsumableMutation = trpc.procedures.addConsumable.useMutation({
    onSuccess: () => {
      utils.procedures.getById.invalidate({ id: procedureId });
      setAddConsumableOpen(false);
      setConsumableForm({
        inventoryItemId: "",
        materialLotId: "",
        name: "",
        category: "ink",
        unit: "drop",
        quantity: 1,
        estimatedUnitCost: 0,
        notes: "",
      });
      toast.success("Insumo adicionado.");
    },
    onError: (err) => toast.error("Erro: " + err.message),
  });

  const updateConsumableMutation = trpc.procedures.updateConsumable.useMutation(
    {
      onSuccess: () => utils.procedures.getById.invalidate({ id: procedureId }),
      onError: (err) => toast.error("Erro: " + err.message),
    },
  );

  const removeConsumableMutation = trpc.procedures.removeConsumable.useMutation(
    {
      onSuccess: () => utils.procedures.getById.invalidate({ id: procedureId }),
      onError: (err) => toast.error("Erro: " + err.message),
    },
  );

  const finalizeMutation = trpc.procedures.finalize.useMutation({
    onSuccess: (data) => {
      utils.procedures.getById.invalidate({ id: procedureId });
      utils.appointments.list.invalidate();
      setFinalizeOpen(false);
      const msgs: string[] = ["Sessão finalizada com sucesso!"];
      if (data.appointmentUpdated)
        msgs.push("Agendamento marcado como concluído.");
      if (data.transactionCreated) msgs.push("Valor registrado no financeiro.");
      toast.success(msgs.join(" "));
      navigate(`/procedures/${procedureId}/summary`);
    },
    onError: (err) => toast.error("Erro ao finalizar: " + err.message),
  });

  const uploadImageMutation = trpc.procedures.uploadImage.useMutation({
    onSuccess: () => {
      utils.procedures.getById.invalidate({ id: procedureId });
      toast.success("Imagem salva.");
      setUploadingImage(false);
    },
    onError: (err) => {
      toast.error("Erro no upload: " + err.message);
      setUploadingImage(false);
    },
  });

  // ── Timer: sincronizar com dados do banco ────────────────────────────────
  useEffect(() => {
    if (!procedure) return;

    if (procedure.status === "em_andamento" && procedure.startedAt) {
      const start = new Date(procedure.startedAt).getTime();
      const now = Date.now();
      const initialElapsed = Math.floor((now - start) / 1000);
      setElapsed(initialElapsed > 0 ? initialElapsed : 0);
      setIsRunning(true);
      startTimeRef.current = start;
    } else if (procedure.status === "pausado") {
      setElapsed((procedure.totalDurationMinutes ?? 0) * 60);
      setIsRunning(false);
    } else if (procedure.status === "finalizado") {
      setElapsed((procedure.totalDurationMinutes ?? 0) * 60);
      setIsRunning(false);
    }
  }, [
    procedure?.status,
    procedure?.startedAt,
    procedure?.totalDurationMinutes,
  ]);

  // ── Timer: incrementar a cada segundo ───────────────────────────────────
  useEffect(() => {
    if (isRunning) {
      timerRef.current = setInterval(() => {
        if (startTimeRef.current) {
          setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
        } else {
          setElapsed((prev) => prev + 1);
        }
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRunning]);

  // ── Formatar tempo ───────────────────────────────────────────────────────
  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0)
      return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  // ── Controles do timer ───────────────────────────────────────────────────
  const handleStart = () => {
    startTimeRef.current = Date.now();
    timerMutation.mutate({ id: procedureId, action: "start" });
    setIsRunning(true);
  };

  const handlePause = () => {
    setIsRunning(false);
    timerMutation.mutate({ id: procedureId, action: "pause" });
  };

  const handleResume = () => {
    startTimeRef.current = Date.now() - elapsed * 1000;
    setIsRunning(true);
    timerMutation.mutate({ id: procedureId, action: "resume" });
  };

  const handleFinish = () => {
    // Abre modal de confirmação antes de finalizar
    setIsRunning(false);
    // Pré-preencher valor cobrado com o valor do procedimento, se existir
    if (procedure?.chargedAmount) {
      setFinalizeForm((f) => ({
        ...f,
        chargedAmount: String(procedure.chargedAmount),
      }));
    }
    setFinalizeOpen(true);
  };

  const handleConfirmFinalize = () => {
    const charged = finalizeForm.chargedAmount
      ? parseFloat(finalizeForm.chargedAmount)
      : 0;
    finalizeMutation.mutate({
      procedureId,
      chargedAmount: charged,
      paymentMethod: finalizeForm.paymentMethod as
        "pix" | "dinheiro" | "credito" | "debito" | "transferencia",
      notes: finalizeForm.notes || undefined,
    });
  };

  // ── Zoom / Pan ───────────────────────────────────────────────────────────
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setZoom((prev) => Math.min(5, Math.max(0.5, prev - e.deltaY * 0.001)));
  }, []);

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    dragStart.current = {
      x: e.clientX,
      y: e.clientY,
      panX: pan.x,
      panY: pan.y,
    };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPan({
      x: dragStart.current.panX + (e.clientX - dragStart.current.x),
      y: dragStart.current.panY + (e.clientY - dragStart.current.y),
    });
  };

  const handleMouseUp = () => setIsDragging(false);

  const resetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  // ── Upload de imagem ─────────────────────────────────────────────────────
  const handleFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
    imageType: "reference" | "progress" | "final",
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 16 * 1024 * 1024) {
      toast.error("Arquivo muito grande. Máximo 16MB.");
      return;
    }
    setUploadingImage(true);
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(",")[1];
      uploadImageMutation.mutate({
        procedureId,
        imageBase64: base64,
        mimeType: file.type,
        imageType,
      });
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  // ── Insumo rápido ────────────────────────────────────────────────────────
  // Quick consume mutation (one-click logging)
  const quickConsumeMutation = trpc.quickConsume.useMutation({
    onSuccess: () => {
      utils.procedures.getById.invalidate({ id: procedureId });
      toast.success("Insumo registrado rapidamente.");
    },
    onError: (err) => toast.error("Erro ao registrar: " + err.message),
  });

  const handleQuickAdd = (item: (typeof QUICK_CONSUMABLES)[number]) => {
    addConsumableMutation.mutate({
      procedureId,
      name: item.name,
      category: item.category,
      unit: item.unit,
      quantity: item.qty,
    });
  };

  const handleQuickConsume = (item: (typeof QUICK_CONSUMABLES)[number]) => {
    quickConsumeMutation.mutate({
      procedureId,
      inventoryItemId: 0,
      category: item.category,
      name: item.name,
      quantity: item.qty,
      estimatedUnitCost: 0,
    });
  };

  const applyKitMutation = trpc.kits.applyToProcedure.useMutation({
    onSuccess: (data) => {
      utils.procedures.getById.invalidate({ id: procedureId });
      setSelectedKitId("");
      toast.success(
        `${data.kitName} aplicado: ${data.itemCount} insumos registrados.`,
      );
    },
    onError: (err) =>
      toast.error("Não foi possível aplicar o kit: " + err.message),
  });

  const handleApplyKit = () => {
    const kitId = Number(selectedKitId);
    if (!kitId) {
      toast.error("Selecione um kit de procedimento.");
      return;
    }
    applyKitMutation.mutate({ kitId, procedureId });
  };

  // ── Ajustar quantidade ───────────────────────────────────────────────────
  const adjustQuantity = (consumable: Consumable, delta: number) => {
    const newQty = Math.max(0, Number(consumable.quantity) + delta);
    updateConsumableMutation.mutate({
      id: consumable.id,
      procedureId,
      quantity: newQty,
    });
  };

  // ─── Renderização ────────────────────────────────────────────────────────

  if (!procedureId || isNaN(procedureId)) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-muted-foreground">ID de procedimento inválido.</p>
      </div>
    );
  }

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

  const referenceImage =
    images.find((i) => i.imageType === "reference") ||
    (procedure.referenceImageUrl
      ? { imageUrl: procedure.referenceImageUrl, imageType: "reference" }
      : null);

  const isFinished = procedure.status === "finalizado";
  const isPaused = procedure.status === "pausado";
  const isActive = procedure.status === "em_andamento";
  const isNew = !procedure.startedAt;

  // Agrupar insumos por categoria
  const consumablesByCategory = consumables.reduce<
    Record<string, Consumable[]>
  >((acc, c) => {
    if (!acc[c.category]) acc[c.category] = [];
    acc[c.category].push(c);
    return acc;
  }, {});

  const totalCost = consumables.reduce(
    (sum, c) => sum + Number(c.estimatedTotalCost ?? 0),
    0,
  );

  // Formatar data do agendamento vinculado
  const formatLinkedDate = (dateStr: string) => {
    try {
      const d = dateStr.slice(8, 10);
      const m = dateStr.slice(5, 7);
      const y = dateStr.slice(0, 4);
      const time = dateStr.length > 10 ? ` às ${dateStr.slice(11, 16)}` : "";
      return `${d}/${m}/${y}${time}`;
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header className="border-b bg-card px-3 sm:px-4 py-2 sm:py-3 flex items-center gap-2 sm:gap-3 sticky top-0 z-40">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 sm:h-10 sm:w-10"
          onClick={() =>
            navigate(`/clients/${procedure.clientId}?tab=procedures`)
          }
        >
          <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="font-semibold truncate text-xs sm:text-sm md:text-base">
            {procedure.title}
          </h1>
          <p className="text-[10px] sm:text-xs text-muted-foreground truncate">
            {procedure.artistName && `${procedure.artistName} · `}
            {procedure.bodyLocation && `${procedure.bodyLocation} · `}
            {procedure.tattooStyle}
          </p>
        </div>
        <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
          {/* Badge do agendamento vinculado — desktop */}
          {linkedAppointment && (
            <button
              type="button"
              onClick={() => navigate("/schedule")}
              className="hidden sm:flex items-center gap-1 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg border border-primary/30 bg-primary/10 hover:bg-primary/20 transition-colors text-[10px] sm:text-xs text-primary"
            >
              <Link2 className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
              <span className="truncate max-w-[120px] sm:max-w-[160px]">
                {linkedAppointment.service || "Agendamento"}
                {linkedAppointment.date
                  ? ` · ${linkedAppointment.date.slice(8, 10)}/${linkedAppointment.date.slice(5, 7)}`
                  : ""}
              </span>
              <ExternalLink className="w-2.5 h-2.5 sm:w-3 sm:h-3 shrink-0 opacity-60" />
            </button>
          )}
          <Button
            variant="outline"
            size="sm"
            className="gap-1 hidden sm:flex text-xs"
            onClick={() => navigate(`/procedures/${procedureId}/summary`)}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            Resumo
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="sm:hidden h-8 w-8"
            onClick={() => navigate(`/procedures/${procedureId}/summary`)}
          >
            <BarChart3 className="w-4 h-4" />
          </Button>
        </div>
      </header>

      {/* Banner do agendamento vinculado — mobile */}
      {linkedAppointment && (
        <div
          className="sm:hidden flex items-center gap-2 px-4 py-2 bg-primary/10 border-b border-primary/20 cursor-pointer"
          onClick={() => navigate("/schedule")}
        >
          <Calendar className="w-4 h-4 text-primary shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-primary font-medium truncate">
              Vinculado: {linkedAppointment.service || "Agendamento"}
            </p>
            {linkedAppointment.date && (
              <p className="text-xs text-muted-foreground">
                {formatLinkedDate(linkedAppointment.date)}
              </p>
            )}
          </div>
          <ExternalLink className="w-3.5 h-3.5 text-primary/60 shrink-0" />
        </div>
      )}

      {/* ── Layout principal ────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* ── Coluna esquerda: imagem + timer ──────────────────────────── */}
        <div className="lg:w-1/2 xl:w-3/5 flex flex-col border-b lg:border-b-0 lg:border-r">
          {/* Timer */}
          <div className="bg-card border-b px-4 py-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Clock
                className={`w-5 h-5 ${isRunning ? "text-green-500 animate-pulse" : "text-muted-foreground"}`}
              />
              <span
                className={`font-mono text-2xl font-bold tabular-nums ${isRunning ? "text-green-500" : isFinished ? "text-muted-foreground" : "text-foreground"}`}
              >
                {formatTime(elapsed)}
              </span>
              {isFinished && (
                <Badge
                  variant="outline"
                  className="bg-green-500/20 text-green-400 border-green-500/30 text-xs"
                >
                  <CheckCircle2 className="w-3 h-3 mr-1" />
                  Finalizado
                </Badge>
              )}
            </div>

            <div className="flex gap-2">
              {isNew && (
                <Button
                  size="sm"
                  onClick={handleStart}
                  className="gap-1.5 bg-green-600 hover:bg-green-700"
                >
                  <Play className="w-4 h-4" />
                  Iniciar
                </Button>
              )}
              {isActive && (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handlePause}
                    className="gap-1.5"
                  >
                    <Pause className="w-4 h-4" />
                    Pausar
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleFinish}
                    className="gap-1.5 bg-green-600 hover:bg-green-700"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Finalizar
                  </Button>
                </>
              )}
              {isPaused && (
                <>
                  <Button
                    size="sm"
                    onClick={handleResume}
                    className="gap-1.5 bg-green-600 hover:bg-green-700"
                  >
                    <Play className="w-4 h-4" />
                    Retomar
                  </Button>
                  <Button size="sm" onClick={handleFinish} className="gap-1.5">
                    <Square className="w-4 h-4" />
                    Finalizar
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Área de imagem com zoom/pan */}
          <div
            ref={imageContainerRef}
            className="flex-1 relative overflow-hidden bg-black/90 cursor-grab active:cursor-grabbing select-none"
            style={{ minHeight: "300px" }}
            onWheel={handleWheel}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            {referenceImage ? (
              <img
                src={referenceImage.imageUrl}
                alt="Referência"
                className="absolute inset-0 w-full h-full object-contain pointer-events-none"
                style={{
                  transform: `scale(${zoom}) translate(${pan.x / zoom}px, ${pan.y / zoom}px)`,
                  transformOrigin: "center",
                  transition: isDragging ? "none" : "transform 0.1s ease",
                }}
                draggable={false}
              />
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-muted-foreground">
                <Camera className="w-12 h-12 opacity-30" />
                <p className="text-sm">Nenhuma imagem de referência</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  className="gap-1.5"
                >
                  <Upload className="w-4 h-4" />
                  Adicionar referência
                </Button>
              </div>
            )}

            {/* Controles de zoom */}
            <div className="absolute bottom-3 right-3 flex flex-col gap-1.5">
              <Button
                size="icon"
                variant="secondary"
                className="h-8 w-8 shadow-lg"
                onClick={() => setZoom((z) => Math.min(5, z + 0.25))}
              >
                <ZoomIn className="w-4 h-4" />
              </Button>
              <Button
                size="icon"
                variant="secondary"
                className="h-8 w-8 shadow-lg"
                onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}
              >
                <ZoomOut className="w-4 h-4" />
              </Button>
              <Button
                size="icon"
                variant="secondary"
                className="h-8 w-8 shadow-lg"
                onClick={resetView}
              >
                <RotateCcw className="w-4 h-4" />
              </Button>
            </div>

            {/* Botão de upload de imagem de progresso */}
            <div className="absolute bottom-3 left-3 flex gap-1.5">
              <Button
                size="sm"
                variant="secondary"
                className="gap-1.5 shadow-lg text-xs"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingImage}
              >
                <Camera className="w-3.5 h-3.5" />
                {uploadingImage ? "Enviando..." : "Foto"}
              </Button>
            </div>
          </div>

          {/* Input oculto para upload */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) =>
              handleFileChange(e, isFinished ? "final" : "progress")
            }
          />

          {/* Galeria de imagens de progresso */}
          {images.filter((i) => i.imageType !== "reference").length > 0 && (
            <div className="border-t p-3 flex gap-2 overflow-x-auto">
              {images
                .filter((i) => i.imageType !== "reference")
                .map((img) => (
                  <img
                    key={img.id}
                    src={img.imageUrl}
                    alt={img.imageType}
                    className="h-16 w-16 object-cover rounded-lg border shrink-0"
                  />
                ))}
            </div>
          )}
        </div>

        {/* ── Coluna direita: insumos ──────────────────────────────────── */}
        <div className="lg:w-1/2 xl:w-2/5 flex flex-col overflow-hidden">
          {/* Insumos rápidos */}
          <div className="border-b p-3">
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">
              Lançamento rápido
            </p>
            {kits.length > 0 && (
              <div className="flex flex-col sm:flex-row gap-1.5 mb-2">
                <Select value={selectedKitId} onValueChange={setSelectedKitId}>
                  <SelectTrigger className="h-8 flex-1 text-xs">
                    <SelectValue placeholder="Selecione um kit de procedimento" />
                  </SelectTrigger>
                  <SelectContent>
                    {kits.map((kit) => (
                      <SelectItem key={kit.id} value={String(kit.id)}>
                        {kit.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  size="sm"
                  className="h-8 gap-1.5 text-xs"
                  onClick={handleApplyKit}
                  disabled={!selectedKitId || applyKitMutation.isPending}
                >
                  <Layers className="w-3.5 h-3.5" />
                  Aplicar kit
                </Button>
              </div>
            )}
            <div className="flex flex-wrap gap-1.5">
              {QUICK_CONSUMABLES.map((item) => (
                <Button
                  key={item.name}
                  size="sm"
                  variant="outline"
                  className="gap-1.5 text-xs h-8"
                  onClick={() => handleQuickAdd(item)}
                  disabled={addConsumableMutation.isPending}
                >
                  {CATEGORY_ICONS[item.category]}
                  {item.name}
                </Button>
              ))}
              <Button
                size="sm"
                variant="default"
                className="gap-1.5 text-xs h-8"
                onClick={() => setAddConsumableOpen(true)}
              >
                <Plus className="w-3.5 h-3.5" />
                Personalizado
              </Button>
            </div>
          </div>

          {/* Lista de insumos lançados */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {consumables.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
                <Package className="w-8 h-8 opacity-30 mb-2" />
                <p className="text-sm">Nenhum insumo lançado</p>
                <p className="text-xs mt-1">
                  Use os botões acima para registrar
                </p>
              </div>
            ) : (
              Object.entries(consumablesByCategory).map(([category, items]) => (
                <div key={category}>
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <span className="text-muted-foreground">
                      {CATEGORY_ICONS[category]}
                    </span>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      {CATEGORY_LABELS[category] ?? category}
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    {items.map((c) => (
                      <div
                        key={c.id}
                        className="flex items-center gap-2 p-2 rounded-lg bg-muted/40 border"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {c.name}
                          </p>
                          {c.estimatedTotalCost &&
                            Number(c.estimatedTotalCost) > 0 && (
                              <p className="text-xs text-muted-foreground">
                                R$ {Number(c.estimatedTotalCost).toFixed(2)}
                              </p>
                            )}
                          {c.lotNumber && (
                            <p className="mt-0.5 text-[11px] text-amber-600 dark:text-amber-300">
                              Lote {c.lotNumber}
                              {c.expiresAt
                                ? ` · validade ${new Date(c.expiresAt).toLocaleDateString("pt-BR")}`
                                : ""}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6"
                            onClick={() => adjustQuantity(c, -1)}
                          >
                            <Minus className="w-3 h-3" />
                          </Button>
                          <span className="text-sm font-mono w-8 text-center tabular-nums">
                            {Number(c.quantity)}
                            {UNIT_LABELS[c.unit]
                              ? ` ${UNIT_LABELS[c.unit]}`
                              : ""}
                          </span>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6"
                            onClick={() => adjustQuantity(c, 1)}
                          >
                            <Plus className="w-3 h-3" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6 text-destructive hover:text-destructive"
                            onClick={() =>
                              removeConsumableMutation.mutate({
                                id: c.id,
                                procedureId,
                              })
                            }
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Rodapé: custo total */}
          {consumables.length > 0 && (
            <div className="border-t p-3 flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Custo estimado de insumos
              </p>
              <p className="font-semibold text-sm">R$ {totalCost.toFixed(2)}</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Modal de insumo personalizado ───────────────────────────────── */}
      <Dialog open={addConsumableOpen} onOpenChange={setAddConsumableOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Adicionar insumo</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label>
                Material do estoque{" "}
                <span className="text-muted-foreground">(opcional)</span>
              </Label>
              <Select
                value={consumableForm.inventoryItemId || "manual"}
                onValueChange={(value) => {
                  if (value === "manual") {
                    setConsumableForm((form) => ({
                      ...form,
                      inventoryItemId: "",
                      materialLotId: "",
                    }));
                    return;
                  }
                  const material = inventoryMaterials.find(
                    (item) => item.id === Number(value),
                  );
                  if (!material) return;
                  setConsumableForm((form) => ({
                    ...form,
                    inventoryItemId: value,
                    materialLotId: "",
                    name: material.name,
                    category: inventoryCategory(material.category || ""),
                    unit: inventoryUnit(
                      material.baseUnit || material.unit || "un",
                    ),
                    estimatedUnitCost: Number(material.avgPrice || 0),
                  }));
                }}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">
                    Lançamento sem vínculo com estoque
                  </SelectItem>
                  {inventoryMaterials.map((material) => (
                    <SelectItem key={material.id} value={String(material.id)}>
                      {material.name} · saldo{" "}
                      {Number(material.currentStock).toLocaleString("pt-BR")}{" "}
                      {material.baseUnit || material.unit}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {consumableForm.inventoryItemId && (
              <div>
                <Label>
                  Lote utilizado{" "}
                  <span className="text-muted-foreground">(opcional)</span>
                </Label>
                <Select
                  value={consumableForm.materialLotId || "none"}
                  onValueChange={(value) =>
                    setConsumableForm((form) => ({
                      ...form,
                      materialLotId: value === "none" ? "" : value,
                    }))
                  }
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem lote informado</SelectItem>
                    {availableLots.map((lot) => (
                      <SelectItem key={lot.id} value={String(lot.id)}>
                        {lot.lotNumber} · saldo{" "}
                        {Number(lot.currentQuantity).toLocaleString("pt-BR")}
                        {lot.expiresAt
                          ? ` · vence ${new Date(lot.expiresAt).toLocaleDateString("pt-BR")}`
                          : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {availableLots.length === 0 && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Este material não possui lote válido com saldo. O lançamento
                    ainda pode ser feito sem lote.
                  </p>
                )}
              </div>
            )}
            <div>
              <Label>Nome *</Label>
              <Input
                value={consumableForm.name}
                onChange={(e) =>
                  setConsumableForm((f) => ({ ...f, name: e.target.value }))
                }
                placeholder="Ex: Tinta vermelha, Agulha 7RL..."
                className="mt-1"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Categoria</Label>
                <Select
                  value={consumableForm.category}
                  onValueChange={(v) =>
                    setConsumableForm((f) => ({
                      ...f,
                      category: v as typeof f.category,
                    }))
                  }
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>
                        {v}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Unidade</Label>
                <Select
                  value={consumableForm.unit}
                  onValueChange={(v) =>
                    setConsumableForm((f) => ({
                      ...f,
                      unit: v as typeof f.unit,
                    }))
                  }
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(UNIT_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>
                        {v}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Quantidade</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.5"
                  value={consumableForm.quantity}
                  onChange={(e) =>
                    setConsumableForm((f) => ({
                      ...f,
                      quantity: parseFloat(e.target.value) || 0,
                    }))
                  }
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Custo unitário (R$)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={consumableForm.estimatedUnitCost}
                  onChange={(e) =>
                    setConsumableForm((f) => ({
                      ...f,
                      estimatedUnitCost: parseFloat(e.target.value) || 0,
                    }))
                  }
                  className="mt-1"
                />
              </div>
            </div>
            <div>
              <Label>Observação</Label>
              <Textarea
                value={consumableForm.notes}
                onChange={(e) =>
                  setConsumableForm((f) => ({ ...f, notes: e.target.value }))
                }
                placeholder="Opcional..."
                className="mt-1 resize-none"
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setAddConsumableOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              onClick={() => {
                if (!consumableForm.name.trim()) {
                  toast.error("Informe o nome do insumo.");
                  return;
                }
                addConsumableMutation.mutate({
                  procedureId,
                  inventoryItemId: consumableForm.inventoryItemId
                    ? Number(consumableForm.inventoryItemId)
                    : undefined,
                  materialLotId: consumableForm.materialLotId
                    ? Number(consumableForm.materialLotId)
                    : undefined,
                  name: consumableForm.name.trim(),
                  category: consumableForm.category,
                  unit: consumableForm.unit,
                  quantity: consumableForm.quantity,
                  estimatedUnitCost:
                    consumableForm.estimatedUnitCost > 0
                      ? consumableForm.estimatedUnitCost
                      : undefined,
                  notes: consumableForm.notes || undefined,
                });
              }}
              disabled={addConsumableMutation.isPending}
            >
              {addConsumableMutation.isPending ? "Adicionando..." : "Adicionar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Modal de Finalização ─────────────────────────────────────────────── */}
      <Dialog
        open={finalizeOpen}
        onOpenChange={(open) => {
          if (!open && !finalizeMutation.isPending) setFinalizeOpen(false);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-500" />
              Finalizar Sessão POD
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Resumo de insumos */}
            <div className="rounded-lg bg-muted/50 p-3 text-sm space-y-1">
              <p className="font-medium">Resumo da sessão</p>
              <p className="text-muted-foreground">
                Insumos registrados:{" "}
                <span className="font-medium text-foreground">
                  {consumables.length}
                </span>
              </p>
              <p className="text-muted-foreground">
                Duração:{" "}
                <span className="font-medium text-foreground">
                  {formatTime(elapsed)}
                </span>
              </p>
              {linkedAppointment && (
                <p className="text-muted-foreground">
                  Agendamento:{" "}
                  <span className="font-medium text-foreground">
                    {linkedAppointment.service} — {linkedAppointment.artist}
                  </span>
                  <span className="ml-1 text-xs text-green-600">
                    ✓ será marcado como concluído
                  </span>
                </p>
              )}
            </div>

            {/* Valor cobrado */}
            <div className="space-y-1.5">
              <Label htmlFor="charged-amount">Valor cobrado (R$)</Label>
              <Input
                id="charged-amount"
                type="number"
                min="0"
                step="0.01"
                placeholder="Ex: 350.00"
                value={finalizeForm.chargedAmount}
                onChange={(e) =>
                  setFinalizeForm((f) => ({
                    ...f,
                    chargedAmount: e.target.value,
                  }))
                }
              />
              {linkedAppointment && finalizeForm.chargedAmount && (
                <p className="text-xs text-green-600">
                  ✓ Será registrado no financeiro do cliente
                </p>
              )}
            </div>

            {/* Método de pagamento */}
            <div className="space-y-1.5">
              <Label>Método de pagamento</Label>
              <Select
                value={finalizeForm.paymentMethod}
                onValueChange={(v) =>
                  setFinalizeForm((f) => ({
                    ...f,
                    paymentMethod: v as typeof f.paymentMethod,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pix">PIX</SelectItem>
                  <SelectItem value="dinheiro">Dinheiro</SelectItem>
                  <SelectItem value="credito">Cartão de crédito</SelectItem>
                  <SelectItem value="debito">Cartão de débito</SelectItem>
                  <SelectItem value="transferencia">Transferência</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Observações finais */}
            <div className="space-y-1.5">
              <Label htmlFor="finalize-notes">
                Observações finais (opcional)
              </Label>
              <Textarea
                id="finalize-notes"
                placeholder="Cuidados pós-sessão, próxima etapa..."
                rows={3}
                value={finalizeForm.notes}
                onChange={(e) =>
                  setFinalizeForm((f) => ({ ...f, notes: e.target.value }))
                }
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setFinalizeOpen(false)}
              disabled={finalizeMutation.isPending}
            >
              Cancelar
            </Button>
            <Button
              className="bg-green-600 hover:bg-green-700 text-white"
              onClick={handleConfirmFinalize}
              disabled={finalizeMutation.isPending}
            >
              {finalizeMutation.isPending
                ? "Finalizando..."
                : "Confirmar e Finalizar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
