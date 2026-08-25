import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { EventModal } from "@/components/EventModal";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { SkeletonCard } from "@/components/SkeletonCard";
import { SkeletonTable } from "@/components/SkeletonTable";
import {
  ChevronLeft, ChevronRight, Clock, User, FileText,
  Pencil, AlertCircle, Plus, Stethoscope, SlidersHorizontal,
  PanelLeftClose, PanelLeftOpen,
} from "lucide-react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { PostSaleFollowupsBar } from "@/components/PostSaleFollowupsBar";

type AppointmentStatus = "agendado" | "confirmado" | "concluido" | "cancelado" | "reagendado";
type ViewMode = "day" | "week" | "month" | "year";

// ── Paleta de cores estilo Apple Calendar ─────────────────────────────────────
const COLOR_PALETTE = [
  "#FF3B30", "#FF9500", "#FFCC00", "#34C759", "#00C7BE",
  "#30B0C7", "#32ADE6", "#007AFF", "#5856D6", "#AF52DE",
  "#FF2D55", "#A2845E", "#8E8E93", "#636366", "#1C1C1E",
];

const HOURS = Array.from({ length: 16 }, (_, i) => i + 7); // 07:00 → 22:00
const SLOT_HEIGHT = 60; // px por hora
const MINUTES_PER_SLOT = 60;

const WEEKDAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MONTH_LABELS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

function toLocalDateString(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day} ${hours}:${minutes}:00`;
}

function isSameDay(d1: Date | null, d2: Date | null) {
  if (!d1 || !d2) return false;
  return d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate();
}

function isToday(date: Date | null) {
  if (!date) return false;
  return isSameDay(date, new Date());
}

// ── Mini Calendar Component ───────────────────────────────────────────────────
function MiniCalendar({
  currentDate,
  onSelectDate,
  appointments,
  getArtistColor,
}: {
  currentDate: Date;
  onSelectDate: (date: Date) => void;
  appointments: any[];
  getArtistColor: (name: string) => string;
}) {
  const [miniDate, setMiniDate] = useState(() => new Date(currentDate));

  useEffect(() => {
    setMiniDate(new Date(currentDate));
  }, [currentDate.getFullYear(), currentDate.getMonth()]);

  const year = miniDate.getFullYear();
  const month = miniDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const lastDay = new Date(year, month + 1, 0).getDate();

  const cells: (Date | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= lastDay; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);

  // Pontos coloridos por artista para cada dia
  const dotsByDay = useMemo(() => {
    const map: Record<number, Set<string>> = {};
    for (const apt of appointments) {
      const d = new Date(apt.date);
      if (d.getFullYear() === year && d.getMonth() === month) {
        const key = d.getDate();
        if (!map[key]) map[key] = new Set();
        if (apt.artist) map[key].add(apt.artist);
      }
    }
    return map;
  }, [appointments, year, month]);

  return (
    <div className="select-none">
      {/* Cabeçalho do mini calendário */}
      <div className="flex items-center justify-between mb-2">
        <button
          className="p-1 rounded hover:bg-white/10 transition-colors text-zinc-400 hover:text-white"
          onClick={() => setMiniDate(new Date(year, month - 1, 1))}
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </button>
        <span className="text-xs font-semibold text-zinc-200 capitalize">
          {MONTH_LABELS[month].slice(0, 3)} {year}
        </span>
        <button
          className="p-1 rounded hover:bg-white/10 transition-colors text-zinc-400 hover:text-white"
          onClick={() => setMiniDate(new Date(year, month + 1, 1))}
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Dias da semana */}
      <div className="grid grid-cols-7 mb-1">
        {WEEKDAY_LABELS.map((d) => (
          <div key={d} className="text-center text-[10px] font-medium text-zinc-500 py-0.5">
            {d[0]}
          </div>
        ))}
      </div>

      {/* Dias */}
      <div className="grid grid-cols-7 gap-y-0.5">
        {cells.map((date, i) => {
          if (!date) return <div key={i} />;
          const isSelected = isSameDay(date, currentDate);
          const today = isToday(date);
          const dots = dotsByDay[date.getDate()];
          return (
            <button
              key={i}
              onClick={() => onSelectDate(date)}
              className={`
                relative flex flex-col items-center justify-center w-7 h-7 mx-auto rounded-full text-[11px] font-medium transition-colors
                ${isSelected ? "bg-blue-500 text-white" : today ? "text-blue-400 font-bold" : "text-zinc-300 hover:bg-white/10"}
              `}
            >
              {date.getDate()}
              {dots && dots.size > 0 && !isSelected && (
                <div className="absolute bottom-0.5 flex gap-0.5 justify-center">
                  {Array.from(dots).slice(0, 3).map((artist, idx) => (
                    <span
                      key={idx}
                      className="w-1 h-1 rounded-full"
                      style={{ backgroundColor: getArtistColor(artist) }}
                    />
                  ))}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function Schedule() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>("week");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [selectedArtist, setSelectedArtist] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedAppointment, setSelectedAppointment] = useState<any>(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [hiddenArtists, setHiddenArtists] = useState<Set<string>>(new Set());

  // EventModal para criar/editar agendamento
  const [eventModalOpen, setEventModalOpen] = useState(false);
  const [eventModalDate, setEventModalDate] = useState<Date | undefined>();
  const [eventModalTime, setEventModalTime] = useState<string | undefined>();
  const [eventModalId, setEventModalId] = useState<number | null>(null);
  const [, navigate] = useLocation();

  // Ref para scroll da grade de horários
  const gridScrollRef = useRef<HTMLDivElement>(null);
  const [nowTop, setNowTop] = useState(0);

  // Drag state
  const [draggedAppointment, setDraggedAppointment] = useState<any>(null);
  const [dragOverSlot, setDragOverSlot] = useState<{ date: Date; hour: number; minute: number } | null>(null);
  const dragOffsetMinutes = useRef<number>(0);

  // Form state para edição
  const [editForm, setEditForm] = useState({ date: "", time: "", duration: "", service: "", artist: "", notes: "" });
  const [editConflictCheck, setEditConflictCheck] = useState<{ hasConflict: boolean; conflicts: any[] } | null>(null);

  // ── Queries ──────────────────────────────────────────────────────────────
  const { data: appointments = [], isLoading } = trpc.appointments.list.useQuery();
  const { data: clients = [] } = trpc.clients.list.useQuery();
  const { data: artistsList = [] } = trpc.artists.list.useQuery();
  const { data: podLinkedMap } = trpc.procedures.listLinkedAppointmentIds.useQuery(undefined, { staleTime: 60_000 });
  const utils = trpc.useUtils();

  const invalidateAll = useCallback(() => {
    utils.appointments.list.invalidate();
    utils.dashboard.metrics.invalidate();
  }, [utils]);

  // ── Mutations ─────────────────────────────────────────────────────────────
  const deleteAppointment = trpc.appointments.delete.useMutation({
    onSuccess: () => { toast.success("Agendamento deletado!"); invalidateAll(); setDetailsDialogOpen(false); setSelectedAppointment(null); },
    onError: (e) => toast.error(`Erro ao deletar: ${e.message}`),
  });

  const updateAppointmentStatus = trpc.appointments.update.useMutation({
    onSuccess: () => { toast.success("Status atualizado!"); invalidateAll(); },
    onError: (e) => toast.error(`Erro ao atualizar status: ${e.message}`),
  });

  const updateAppointmentDate = trpc.appointments.update.useMutation({
    onSuccess: () => { toast.success("Agendamento reagendado!"); invalidateAll(); setDraggedAppointment(null); setDragOverSlot(null); },
    onError: (e) => { toast.error(`Erro ao reagendar: ${e.message}`); setDraggedAppointment(null); setDragOverSlot(null); },
  });

  const updateAppointment = trpc.appointments.update.useMutation({
    onSuccess: () => { toast.success("Agendamento atualizado!"); invalidateAll(); setEditDialogOpen(false); setDetailsDialogOpen(false); },
    onError: (e) => toast.error(`Erro ao atualizar: ${e.message}`),
  });

  // ── Atalho de teclado Delete ──────────────────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === "Delete" || e.key === "Backspace") && selectedAppointment && detailsDialogOpen) {
        e.preventDefault();
        if (confirm("Tem certeza que deseja deletar este agendamento?")) {
          deleteAppointment.mutate({ id: selectedAppointment.id });
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedAppointment, detailsDialogOpen, deleteAppointment]);

  // ── Cores por artista ─────────────────────────────────────────────────────
  const allArtistNames = useMemo(() => {
    const fromApts = (appointments as any[]).map((a) => a.artist).filter(Boolean) as string[];
    const fromList = (artistsList as any[]).map((a) => a.name).filter(Boolean) as string[];
    return Array.from(new Set([...fromList, ...fromApts])).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [appointments, artistsList]);

  const artistColorMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const a of artistsList as any[]) {
      if (a.name && a.color) map[a.name] = a.color;
    }
    return map;
  }, [artistsList]);

  const getArtistColor = useCallback((name: string) => {
    if (artistColorMap[name]) return artistColorMap[name];
    const idx = allArtistNames.indexOf(name) % COLOR_PALETTE.length;
    return COLOR_PALETTE[Math.max(0, idx)];
  }, [artistColorMap, allArtistNames]);

  // ── Filtros ───────────────────────────────────────────────────────────────
  const filteredAppointments = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return (appointments as any[]).filter((apt) => {
      if (hiddenArtists.has(apt.artist)) return false;
      const statusMatch = selectedStatus === "all" || apt.status === selectedStatus;
      const artistMatch = selectedArtist === "all" || apt.artist === selectedArtist;
      const client = (clients as any[]).find((c) => c.id === apt.clientId);
      const clientName = client?.name || "";
      const clientPhone = client?.phone || "";
      const searchMatch = !q ||
        clientName.toLowerCase().includes(q) ||
        clientPhone.toLowerCase().includes(q) ||
        (apt.service || "").toLowerCase().includes(q) ||
        (apt.artist || "").toLowerCase().includes(q) ||
        (apt.notes || "").toLowerCase().includes(q) ||
        (apt.status || "").toLowerCase().includes(q);
      return statusMatch && artistMatch && searchMatch;
    });
  }, [appointments, clients, selectedStatus, selectedArtist, searchQuery, hiddenArtists]);

  // ── Navegação ─────────────────────────────────────────────────────────────
  const navigate_period = (dir: -1 | 1) => {
    const d = new Date(currentDate);
    if (viewMode === "day") d.setDate(d.getDate() + dir);
    else if (viewMode === "week") d.setDate(d.getDate() + dir * 7);
    else if (viewMode === "month") d.setMonth(d.getMonth() + dir);
    else if (viewMode === "year") d.setFullYear(d.getFullYear() + dir);
    setCurrentDate(d);
  };

  const scrollToNow = useCallback(() => {
    if (gridScrollRef.current) {
      const now = new Date();
      const minutes = (now.getHours() - HOURS[0]) * 60 + now.getMinutes();
      const top = Math.max(0, (minutes / 60) * SLOT_HEIGHT - 150);
      gridScrollRef.current.scrollTo({ top, behavior: "smooth" });
    }
  }, []);

  const goToToday = () => {
    setCurrentDate(new Date());
    if (viewMode === "day" || viewMode === "week") {
      setTimeout(scrollToNow, 150);
    }
  };

  // Atualizar linha de hora atual
  useEffect(() => {
    const updateNow = () => {
      const now = new Date();
      const minutes = (now.getHours() - HOURS[0]) * 60 + now.getMinutes();
      setNowTop(Math.max(0, (minutes / 60) * SLOT_HEIGHT));
    };
    updateNow();
    const interval = setInterval(updateNow, 60000);
    return () => clearInterval(interval);
  }, []);

  // Scroll automático ao entrar em visão com horários
  useEffect(() => {
    if (viewMode === "day" || viewMode === "week") {
      setTimeout(scrollToNow, 200);
    }
  }, [viewMode, scrollToNow]);

  // ── Grade mensal ──────────────────────────────────────────────────────────
  const calendarDays = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const days: Array<{ date: Date | null; appointments: any[] }> = [];
    for (let i = 0; i < firstDay.getDay(); i++) days.push({ date: null, appointments: [] });
    for (let day = 1; day <= lastDay.getDate(); day++) {
      const date = new Date(year, month, day);
      const dayAppointments = filteredAppointments.filter((apt) => {
        const aptDate = new Date(apt.date);
        return aptDate.getDate() === day && aptDate.getMonth() === month && aptDate.getFullYear() === year;
      });
      days.push({ date, appointments: dayAppointments });
    }
    while (days.length % 7 !== 0) days.push({ date: null, appointments: [] });
    return days;
  }, [currentDate, filteredAppointments]);

  // ── Grade semanal ─────────────────────────────────────────────────────────
  const weekDays = useMemo(() => {
    const d = new Date(currentDate);
    d.setDate(d.getDate() - d.getDay());
    d.setHours(0, 0, 0, 0);
    return Array.from({ length: 7 }, (_, i) => {
      const day = new Date(d);
      day.setDate(d.getDate() + i);
      return day;
    });
  }, [currentDate]);

  const appointmentsForWeek = useMemo(() => {
    return filteredAppointments.filter((apt) => {
      const aptDate = new Date(apt.date);
      return aptDate >= weekDays[0] && aptDate < new Date(weekDays[6].getTime() + 86400000);
    });
  }, [filteredAppointments, weekDays]);

  // ── Grade diária ──────────────────────────────────────────────────────────
  const appointmentsForDay = useMemo(() => {
    return filteredAppointments.filter((apt) => isSameDay(new Date(apt.date), currentDate));
  }, [filteredAppointments, currentDate]);

  // ── Helpers ───────────────────────────────────────────────────────────────
  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case "concluido": return "bg-green-500/10 text-green-600 border-green-500/20";
      case "confirmado": return "bg-blue-500/10 text-blue-600 border-blue-500/20";
      case "cancelado": return "bg-red-500/10 text-red-600 border-red-500/20";
      case "reagendado": return "bg-orange-500/10 text-orange-600 border-orange-500/20";
      default: return "bg-gray-400/10 text-gray-600 border-gray-400/20";
    }
  };

  const formatDate = (date: any) => {
    if (!date) return "-";
    return new Date(date).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
  };

  const formatDateForInput = (date: any) => {
    if (!date) return "";
    const d = new Date(date);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };

  const formatTime = (date: any) => {
    if (!date) return "-";
    return new Date(date).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  };

  const formatTimeForInput = (date: any) => {
    if (!date) return "";
    const d = new Date(date);
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  };

  const getClientName = (clientId: number) => {
    const client = (clients as any[]).find((c) => c.id === clientId);
    return client?.name || "Cliente";
  };

  const getClientPhone = (clientId: number) => {
    const client = (clients as any[]).find((c) => c.id === clientId);
    return client?.phone || "Sem telefone";
  };

  // ── Título dinâmico do período ────────────────────────────────────────────
  const periodLabel = useMemo(() => {
    if (viewMode === "day") {
      return currentDate.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
    }
    if (viewMode === "week") {
      return `${weekDays[0].toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })} — ${weekDays[6].toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}`;
    }
    if (viewMode === "month") {
      return currentDate.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
    }
    return String(currentDate.getFullYear());
  }, [viewMode, currentDate, weekDays]);

  const postSalePeriod = useMemo(() => {
    if (viewMode === "day") return { start: currentDate, end: currentDate };
    if (viewMode === "week") return { start: weekDays[0], end: weekDays[6] };
    if (viewMode === "month") {
      return {
        start: new Date(currentDate.getFullYear(), currentDate.getMonth(), 1),
        end: new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0),
      };
    }
    return {
      start: new Date(currentDate.getFullYear(), 0, 1),
      end: new Date(currentDate.getFullYear(), 11, 31),
    };
  }, [viewMode, currentDate, weekDays]);

  // ── Drag & Drop — Mensal ──────────────────────────────────────────────────
  const handleMonthDragStart = (e: React.DragEvent, apt: any) => {
    setDraggedAppointment(apt);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", apt.id.toString());
  };

  const handleMonthDragEnd = () => { setDraggedAppointment(null); setDragOverSlot(null); };

  const handleMonthDragOver = (e: React.DragEvent, date: Date | null) => {
    if (!date || !draggedAppointment) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverSlot({ date, hour: 0, minute: 0 });
  };

  const handleMonthDrop = (e: React.DragEvent, targetDate: Date | null) => {
    e.preventDefault();
    if (!targetDate || !draggedAppointment) { setDraggedAppointment(null); setDragOverSlot(null); return; }
    const originalDate = new Date(draggedAppointment.date);
    const newDate = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), originalDate.getHours(), originalDate.getMinutes(), 0);
    if (isSameDay(originalDate, newDate)) { setDraggedAppointment(null); setDragOverSlot(null); return; }
    updateAppointmentDate.mutate({ id: draggedAppointment.id, data: { date: toLocalDateString(newDate) } });
  };

  // ── Drag & Drop — Semanal/Diário ──────────────────────────────────────────
  const handleWeekDragStart = (e: React.DragEvent, apt: any) => {
    setDraggedAppointment(apt);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", apt.id.toString());
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const offsetY = e.clientY - rect.top;
    const offsetMinutes = Math.floor((offsetY / SLOT_HEIGHT) * MINUTES_PER_SLOT);
    dragOffsetMinutes.current = Math.max(0, Math.min(offsetMinutes, apt.duration - 15));
  };

  const handleWeekDragOver = (e: React.DragEvent, date: Date, hour: number, minute: number) => {
    if (!draggedAppointment) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverSlot({ date, hour, minute });
  };

  const handleWeekDrop = (e: React.DragEvent, targetDate: Date, hour: number, minute: number) => {
    e.preventDefault();
    if (!draggedAppointment) return;
    const totalMinutes = hour * 60 + minute - dragOffsetMinutes.current;
    const adjustedHour = Math.floor(Math.max(0, totalMinutes) / 60);
    const adjustedMinute = Math.round((Math.max(0, totalMinutes) % 60) / 15) * 15;
    const newDate = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), adjustedHour, adjustedMinute, 0);
    const originalDate = new Date(draggedAppointment.date);
    if (originalDate.getTime() === newDate.getTime()) { setDraggedAppointment(null); setDragOverSlot(null); return; }
    updateAppointmentDate.mutate({ id: draggedAppointment.id, data: { date: toLocalDateString(newDate) } });
  };

  // ── Posicionamento de eventos na grade de horários ────────────────────────
  const getEventStyle = (apt: any) => {
    const start = new Date(apt.date);
    const startHour = start.getHours();
    const startMinute = start.getMinutes();
    const duration = apt.duration || 60;
    const topOffset = (startHour - HOURS[0]) * SLOT_HEIGHT + (startMinute / 60) * SLOT_HEIGHT;
    const height = Math.max((duration / 60) * SLOT_HEIGHT, 20);
    return { top: `${topOffset}px`, height: `${height}px` };
  };

  // ── Handlers de clique ────────────────────────────────────────────────────
  const handleAppointmentClick = (apt: any, e: React.MouseEvent) => {
    if (draggedAppointment) return;
    e.stopPropagation();
    setSelectedAppointment(apt);
    setEventModalId(apt.id);
    setEventModalDate(undefined);
    setEventModalTime(undefined);
    setEventModalOpen(true);
  };

  const handleSlotDoubleClick = (date: Date, hour?: number, minute?: number) => {
    const newDate = new Date(date);
    if (hour !== undefined) newDate.setHours(hour, minute ?? 0, 0, 0);
    setEventModalDate(newDate);
    if (hour !== undefined) {
      setEventModalTime(`${String(hour).padStart(2, "0")}:${String(minute ?? 0).padStart(2, "0")}`);
    } else {
      setEventModalTime(undefined);
    }
    setEventModalId(null);
    setEventModalOpen(true);
  };

  const handleEditClick = () => {
    if (!selectedAppointment) return;
    setEditForm({
      date: formatDateForInput(selectedAppointment.date),
      time: formatTimeForInput(selectedAppointment.date),
      duration: String(selectedAppointment.duration),
      service: selectedAppointment.service,
      artist: selectedAppointment.artist,
      notes: selectedAppointment.notes || "",
    });
    setDetailsDialogOpen(false);
    setEditDialogOpen(true);
  };

  const handleSaveEdit = () => {
    if (!selectedAppointment) return;
    if (!editForm.date || !editForm.time || !editForm.duration || !editForm.service || !editForm.artist) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }
    const [year, month, day] = editForm.date.split("-").map(Number);
    const [hours, minutes] = editForm.time.split(":").map(Number);
    const newDate = new Date(year, month - 1, day, hours, minutes);
    utils.appointments.checkConflicts
      .fetch({ artist: editForm.artist, date: newDate.toISOString(), duration: Number(editForm.duration), excludeId: selectedAppointment.id })
      .then((conflictResult) => {
        if (conflictResult.hasConflict) {
          setEditConflictCheck(conflictResult);
          toast.error(`Conflito de horário! ${conflictResult.conflicts.length} agendamento(s) sobrepostos.`);
          return;
        }
        setEditConflictCheck(null);
        updateAppointment.mutate({
          id: selectedAppointment.id,
          data: { date: toLocalDateString(newDate), duration: Number(editForm.duration), service: editForm.service, artist: editForm.artist, notes: editForm.notes || undefined },
        });
      })
      .catch(() => toast.error("Erro ao verificar conflitos"));
  };

  const handleStatusChange = (newStatus: AppointmentStatus) => {
    if (!selectedAppointment) return;
    updateAppointmentStatus.mutate({ id: selectedAppointment.id, data: { status: newStatus } });
    setSelectedAppointment({ ...selectedAppointment, status: newStatus });
  };

  // ── Toggle artista ────────────────────────────────────────────────────────
  const toggleArtist = (name: string) => {
    setHiddenArtists((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  // ── Renderização das visões ───────────────────────────────────────────────

  const renderTimeGrid = (days: Date[], aptsByDay: (date: Date) => any[]) => (
    <div
      ref={gridScrollRef}
      className="overflow-y-auto"
      style={{ maxHeight: "calc(100vh - 220px)", minHeight: "400px" }}
    >
      {/* Cabeçalho dos dias */}
      <div
        className="grid border-b border-border sticky top-0 z-10 bg-background"
        style={{ gridTemplateColumns: `56px repeat(${days.length}, 1fr)` }}
      >
        <div className="text-xs text-muted-foreground p-2" />
        {days.map((day, i) => (
          <div
            key={i}
            className={`text-center p-2 border-l border-border ${isToday(day) ? "bg-primary/10" : ""}`}
          >
            <div className="text-xs text-muted-foreground">
              {day.toLocaleDateString("pt-BR", { weekday: "short" })}
            </div>
            <div
              className={`text-sm font-bold mx-auto w-7 h-7 flex items-center justify-center rounded-full
                ${isToday(day) ? "bg-primary text-primary-foreground" : ""}`}
            >
              {day.getDate()}
            </div>
          </div>
        ))}
      </div>

      {/* Grade de horários */}
      <div
        className="relative grid"
        style={{ gridTemplateColumns: `56px repeat(${days.length}, 1fr)`, height: `${HOURS.length * SLOT_HEIGHT}px` }}
      >
        {/* Coluna de horas */}
        <div className="relative">
          {HOURS.map((hour) => (
            <div
              key={hour}
              className="absolute w-full border-t border-border/50 text-xs text-muted-foreground pr-2 text-right"
              style={{ top: `${(hour - HOURS[0]) * SLOT_HEIGHT}px`, height: `${SLOT_HEIGHT}px` }}
            >
              {String(hour).padStart(2, "0")}:00
            </div>
          ))}
        </div>

        {/* Colunas dos dias */}
        {days.map((day, dayIndex) => {
          const dayApts = aptsByDay(day);
          return (
            <div
              key={dayIndex}
              className={`relative border-l border-border ${isToday(day) ? "bg-primary/5" : ""}`}
            >
              {/* Slots de horário */}
              {HOURS.map((hour) => (
                <div
                  key={hour}
                  className="absolute w-full border-t border-border/30"
                  style={{ top: `${(hour - HOURS[0]) * SLOT_HEIGHT}px`, height: `${SLOT_HEIGHT}px` }}
                  onDragOver={(e) => handleWeekDragOver(e, day, hour, 0)}
                  onDrop={(e) => handleWeekDrop(e, day, hour, 0)}
                  onDoubleClick={(e) => { e.stopPropagation(); handleSlotDoubleClick(day, hour, 0); }}
                >
                  <div
                    className="absolute w-full border-t border-border/20"
                    style={{ top: "50%", height: "50%" }}
                    onDragOver={(e) => { e.stopPropagation(); handleWeekDragOver(e, day, hour, 30); }}
                    onDrop={(e) => { e.stopPropagation(); handleWeekDrop(e, day, hour, 30); }}
                    onDoubleClick={(e) => { e.stopPropagation(); handleSlotDoubleClick(day, hour, 30); }}
                  />
                </div>
              ))}

              {/* Highlight do slot de drop */}
              {dragOverSlot && isSameDay(dragOverSlot.date, day) && draggedAppointment && (
                <div
                  className="absolute w-full bg-primary/20 border-2 border-primary rounded pointer-events-none z-10"
                  style={{
                    top: `${(dragOverSlot.hour - HOURS[0]) * SLOT_HEIGHT + (dragOverSlot.minute / 60) * SLOT_HEIGHT}px`,
                    height: `${(draggedAppointment.duration / 60) * SLOT_HEIGHT}px`,
                  }}
                />
              )}

              {/* Linha de hora atual */}
              {isToday(day) && (
                <div className="absolute left-0 right-0 z-30 pointer-events-none" style={{ top: `${nowTop}px` }}>
                  <div className="flex items-center">
                    <div className="w-2 h-2 rounded-full bg-red-500 -ml-1 flex-shrink-0" />
                    <div className="flex-1 h-[2px] bg-red-500" />
                  </div>
                </div>
              )}

              {/* Eventos */}
              {dayApts.map((apt) => {
                const style = getEventStyle(apt);
                const color = getArtistColor(apt.artist);
                return (
                  <div
                    key={apt.id}
                    draggable
                    onDragStart={(e) => handleWeekDragStart(e, apt)}
                    onDragEnd={handleMonthDragEnd}
                    onClick={(e) => handleAppointmentClick(apt, e)}
                    className={`
                      absolute left-0.5 right-0.5 rounded px-1 py-0.5 text-xs text-white
                      cursor-grab active:cursor-grabbing overflow-hidden z-20
                      hover:opacity-90 transition-opacity
                      ${draggedAppointment?.id === apt.id ? "opacity-40" : ""}
                    `}
                    style={{ ...style, backgroundColor: color, borderLeft: `3px solid ${color}` }}
                    title={`${getClientName(apt.clientId)} — ${getClientPhone(apt.clientId)} — ${apt.service} (${apt.duration}min)`}
                  >
                    <div className="font-semibold truncate flex items-center gap-1">
                      {apt.confirmationAttention === 'pending' && <AlertCircle className="w-3.5 h-3.5 shrink-0 text-yellow-200 fill-amber-500/40" />}
                      {podLinkedMap?.[apt.id] && <Stethoscope className="w-3 h-3 shrink-0 opacity-90" />}
                      {getClientName(apt.clientId)}
                    </div>
                    <div className="truncate opacity-90">{getClientPhone(apt.clientId)}</div>
                    <div className="truncate opacity-75 text-[10px]">{formatTime(apt.date)} · {apt.service}</div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );

  const renderMonthView = () => (
    <>
      <div className="grid grid-cols-7 gap-1 mb-2">
        {WEEKDAY_LABELS.map((d) => (
          <div key={d} className="text-center text-xs font-semibold text-muted-foreground py-2">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {calendarDays.map((day, index) => (
          <div
            key={index}
            onDragOver={(e) => handleMonthDragOver(e, day.date)}
            onDragLeave={() => setDragOverSlot(null)}
            onDrop={(e) => handleMonthDrop(e, day.date)}
            onDoubleClick={() => day.date && handleSlotDoubleClick(day.date)}
            className={`
              min-h-16 sm:min-h-24 p-1 sm:p-1.5 rounded-lg border transition-all
              ${day.date ? "bg-card hover:bg-accent/30 cursor-pointer" : "bg-muted/20"}
              ${isToday(day.date) ? "border-primary border-2" : "border-border"}
              ${dragOverSlot && isSameDay(day.date, dragOverSlot.date) && draggedAppointment ? "ring-2 ring-primary bg-primary/10" : ""}
            `}
          >
            {day.date && (
              <>
                <div className={`text-xs font-semibold mb-1 w-6 h-6 flex items-center justify-center rounded-full
                  ${isToday(day.date) ? "bg-primary text-primary-foreground" : "text-foreground"}`}>
                  {day.date.getDate()}
                </div>
                <div className="space-y-0.5">
                  {day.appointments.slice(0, 3).map((apt) => {
                    const color = getArtistColor(apt.artist);
                    return (
                      <div
                        key={apt.id}
                        draggable
                        onDragStart={(e) => handleMonthDragStart(e, apt)}
                        onDragEnd={handleMonthDragEnd}
                        onClick={(e) => handleAppointmentClick(apt, e)}
                        className={`text-xs px-1 py-0.5 rounded truncate cursor-grab active:cursor-grabbing text-white hover:opacity-80 transition-opacity ${draggedAppointment?.id === apt.id ? "opacity-40 scale-95" : ""}`}
                        style={{ backgroundColor: color }}
                        title={`${getClientName(apt.clientId)} — ${getClientPhone(apt.clientId)} — ${apt.service}`}
                      >
                        <span className="flex items-center gap-1">
                          {apt.confirmationAttention === 'pending' && <AlertCircle className="w-3 h-3 shrink-0 text-yellow-200 fill-amber-500/40" />}
                          {podLinkedMap?.[apt.id] && <Stethoscope className="w-2.5 h-2.5 shrink-0 opacity-90" />}
                          {getClientName(apt.clientId)} · {getClientPhone(apt.clientId)}
                        </span>
                      </div>
                    );
                  })}
                  {day.appointments.length > 3 && (
                    <div className="text-xs text-muted-foreground text-center">+{day.appointments.length - 3}</div>
                  )}
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </>
  );

  const renderYearView = () => {
    const year = currentDate.getFullYear();
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {Array.from({ length: 12 }, (_, monthIdx) => {
          const firstDay = new Date(year, monthIdx, 1).getDay();
          const lastDay = new Date(year, monthIdx + 1, 0).getDate();
          const cells: (number | null)[] = [];
          for (let i = 0; i < firstDay; i++) cells.push(null);
          for (let d = 1; d <= lastDay; d++) cells.push(d);
          while (cells.length % 7 !== 0) cells.push(null);

          // Pontos por dia
          const dotsByDay: Record<number, string[]> = {};
          for (const apt of filteredAppointments) {
            const d = new Date(apt.date);
            if (d.getFullYear() === year && d.getMonth() === monthIdx) {
              const key = d.getDate();
              if (!dotsByDay[key]) dotsByDay[key] = [];
              if (apt.artist && !dotsByDay[key].includes(apt.artist)) {
                dotsByDay[key].push(apt.artist);
              }
            }
          }

          const isCurrentMonth = monthIdx === currentDate.getMonth();

          return (
            <div
              key={monthIdx}
              className={`rounded-xl border p-3 cursor-pointer hover:bg-accent/20 transition-colors ${isCurrentMonth ? "border-primary/50 bg-primary/5" : "border-border bg-card"}`}
              onClick={() => { setCurrentDate(new Date(year, monthIdx, 1)); setViewMode("month"); }}
            >
              <div className={`text-xs font-bold mb-2 ${isCurrentMonth ? "text-primary" : "text-muted-foreground"}`}>
                {MONTH_LABELS[monthIdx]}
              </div>
              <div className="grid grid-cols-7 gap-0">
                {WEEKDAY_LABELS.map((d) => (
                  <div key={d} className="text-center text-[8px] text-muted-foreground/60 pb-0.5">{d[0]}</div>
                ))}
                {cells.map((day, i) => {
                  if (!day) return <div key={i} />;
                  const today = isToday(new Date(year, monthIdx, day));
                  const dots = dotsByDay[day];
                  return (
                    <div
                      key={i}
                      className={`relative flex flex-col items-center justify-center w-5 h-5 mx-auto rounded-full text-[9px]
                        ${today ? "bg-primary text-primary-foreground font-bold" : "text-foreground/70"}`}
                    >
                      {day}
                      {dots && dots.length > 0 && !today && (
                        <div className="absolute bottom-0 flex gap-px justify-center">
                          {dots.slice(0, 3).map((artist, idx) => (
                            <span key={idx} className="w-1 h-1 rounded-full" style={{ backgroundColor: getArtistColor(artist) }} />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="flex h-full gap-0 -mx-4 sm:-mx-6 -mt-4 sm:-mt-6">
      {/* ── SIDEBAR MOBILE OVERLAY ──────────────────────────────────────── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/60 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      {/* ── SIDEBAR ─────────────────────────────────────────────────────── */}
      <aside
        className={`
          flex-shrink-0 bg-zinc-900/80 border-r border-border transition-all duration-300 overflow-hidden
          md:relative md:block
          ${sidebarOpen
            ? "fixed left-0 top-0 h-full w-56 z-40 md:static md:z-auto md:w-56"
            : "fixed left-0 top-0 h-full w-0 z-40 md:static md:z-auto md:w-0"}
        `}
      >
        <div className="p-3 flex flex-col gap-4 w-56 h-full overflow-y-auto">
          {/* Botão Novo Agendamento */}
          <Button
            size="sm"
            className="w-full"
            onClick={() => { setEventModalId(null); setEventModalDate(undefined); setEventModalTime(undefined); setEventModalOpen(true); }}
          >
            <Plus className="h-4 w-4 mr-1.5" />
            Novo Agendamento
          </Button>

          {/* Mini calendário */}
          <MiniCalendar
            currentDate={currentDate}
            onSelectDate={(date) => {
              setCurrentDate(date);
              if (viewMode === "year") setViewMode("month");
            }}
            appointments={filteredAppointments}
            getArtistColor={getArtistColor}
          />

          {/* Lista de artistas */}
          {allArtistNames.length > 0 && (
            <div className="flex-1 min-h-0">
              <div className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-2">Artistas</div>
              <div className="space-y-1 overflow-y-auto max-h-64 pr-1">
                {allArtistNames.map((name) => {
                  const color = getArtistColor(name);
                  const hidden = hiddenArtists.has(name);
                  return (
                    <button
                      key={name}
                      onClick={() => toggleArtist(name)}
                      className="flex items-center gap-2 w-full px-1 py-0.5 rounded hover:bg-white/5 transition-colors"
                    >
                      <span
                        className={`w-3 h-3 rounded-sm flex-shrink-0 transition-opacity ${hidden ? "opacity-30" : ""}`}
                        style={{ backgroundColor: color }}
                      />
                      <span className={`text-xs truncate ${hidden ? "text-zinc-600 line-through" : "text-zinc-300"}`}>
                        {name}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* ── ÁREA PRINCIPAL ──────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Barra superior */}
        <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-background/95 backdrop-blur sticky top-0 z-20">
          {/* Toggle sidebar */}
          <button
            className="flex p-1.5 rounded hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
            onClick={() => setSidebarOpen((v) => !v)}
            title={sidebarOpen ? "Recolher sidebar" : "Expandir sidebar"}
          >
            {sidebarOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
          </button>

          {/* Setas de navegação */}
          <button
            className="p-1.5 rounded hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
            onClick={() => navigate_period(-1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            className="p-1.5 rounded hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
            onClick={() => navigate_period(1)}
          >
            <ChevronRight className="h-4 w-4" />
          </button>

          {/* Botão Hoje */}
          <Button variant="outline" size="sm" onClick={goToToday} className="text-xs px-2 py-1 h-7">
            Hoje
          </Button>

          {/* Título dinâmico */}
          <h2 className="text-sm font-semibold capitalize flex-1 truncate">{periodLabel}</h2>

          {/* Filtros toggle */}
          <button
            className={`p-1.5 rounded transition-colors text-muted-foreground hover:text-foreground ${filtersOpen ? "bg-accent text-foreground" : "hover:bg-accent"}`}
            onClick={() => setFiltersOpen((v) => !v)}
            title="Filtros"
          >
            <SlidersHorizontal className="h-4 w-4" />
          </button>

          {/* Botões de visão */}
          <div className="flex rounded-lg border border-border overflow-hidden">
            {(["day", "week", "month", "year"] as ViewMode[]).map((mode, idx) => {
              const labelsMobile = ["D", "S", "M", "A"];
              const labelsDesktop = ["Dia", "Semana", "Mês", "Ano"];
              return (
                <button
                  key={mode}
                  className={`px-1.5 sm:px-2.5 py-1 text-xs font-medium transition-colors ${idx > 0 ? "border-l border-border" : ""} ${viewMode === mode ? "bg-primary text-primary-foreground" : "bg-background hover:bg-accent"}`}
                  onClick={() => setViewMode(mode)}
                >
                  <span className="sm:hidden">{labelsMobile[idx]}</span>
                  <span className="hidden sm:inline">{labelsDesktop[idx]}</span>
                </button>
              );
            })}
          </div>

          {/* Novo agendamento (mobile) */}
          <Button
            size="sm"
            className="md:hidden h-7 px-2"
            onClick={() => { setEventModalId(null); setEventModalDate(undefined); setEventModalTime(undefined); setEventModalOpen(true); }}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        {/* Painel de filtros recolhível */}
        {filtersOpen && (
          <div className="px-4 py-3 border-b border-border bg-zinc-900/50 flex flex-wrap gap-3 items-end">
            <div className="relative flex-1 min-w-40">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <Input
                className="pl-8 h-8 text-xs"
                placeholder="Buscar cliente, serviço, artista..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" onClick={() => setSearchQuery("")}>
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              )}
            </div>
            <div className="flex gap-2">
              <select
                className="h-8 rounded-md border border-border bg-background text-xs px-2 text-foreground"
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
              >
                <option value="all">Todos os status</option>
                <option value="agendado">Agendado</option>
                <option value="confirmado">Confirmado</option>
                <option value="concluido">Concluído</option>
                <option value="cancelado">Cancelado</option>
                <option value="reagendado">Reagendado</option>
              </select>
              <select
                className="h-8 rounded-md border border-border bg-background text-xs px-2 text-foreground"
                value={selectedArtist}
                onChange={(e) => setSelectedArtist(e.target.value)}
              >
                <option value="all">Todos os artistas</option>
                {allArtistNames.map((artist) => (
                  <option key={artist} value={artist}>{artist}</option>
                ))}
              </select>
            </div>
            {(searchQuery || selectedStatus !== "all" || selectedArtist !== "all") && (
              <div className="text-xs text-muted-foreground">
                <span className="font-medium text-primary">{filteredAppointments.length}</span> resultado(s)
              </div>
            )}
          </div>
        )}

        <PostSaleFollowupsBar visibleStart={postSalePeriod.start} visibleEnd={postSalePeriod.end} />

        {/* Área do calendário */}
        <div className="flex-1 overflow-auto px-4 py-3">
          {viewMode === "day" && renderTimeGrid([currentDate], (day) => appointmentsForDay.filter((apt) => isSameDay(new Date(apt.date), day)))}
          {viewMode === "week" && renderTimeGrid(weekDays, (day) => appointmentsForWeek.filter((apt) => isSameDay(new Date(apt.date), day)))}
          {viewMode === "month" && renderMonthView()}
          {viewMode === "year" && renderYearView()}
        </div>
      </div>

      {/* ── MODAL DE EDIÇÃO ──────────────────────────────────────────────── */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Editar Agendamento</DialogTitle>
            <DialogDescription>Altere os detalhes do agendamento</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Cliente (somente leitura)</Label>
              <Input value={selectedAppointment ? getClientName(selectedAppointment.clientId) : ""} disabled className="bg-muted" />
            </div>
            <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Data *</Label>
                <Input type="date" value={editForm.date} onChange={(e) => setEditForm({ ...editForm, date: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Hora *</Label>
                <Input type="time" value={editForm.time} onChange={(e) => setEditForm({ ...editForm, time: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Duração (minutos) *</Label>
              <Input type="number" min="15" step="15" value={editForm.duration} onChange={(e) => setEditForm({ ...editForm, duration: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Serviço *</Label>
              <Input value={editForm.service} onChange={(e) => setEditForm({ ...editForm, service: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Artista *</Label>
              <Input value={editForm.artist} onChange={(e) => setEditForm({ ...editForm, artist: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea value={editForm.notes} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} rows={3} />
            </div>
            {editConflictCheck?.hasConflict && (
              <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4 space-y-2">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-destructive">Conflito de Horário!</p>
                    <p className="text-sm text-muted-foreground">{editForm.artist} tem {editConflictCheck.conflicts.length} agendamento(s) sobrepostos.</p>
                  </div>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setEditDialogOpen(false); setEditConflictCheck(null); }}>Cancelar</Button>
            <Button onClick={handleSaveEdit} disabled={updateAppointment.isPending}>
              {updateAppointment.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── EVENT MODAL ──────────────────────────────────────────────────── */}
      <EventModal
        isOpen={eventModalOpen}
        onClose={() => { setEventModalOpen(false); setEventModalId(null); }}
        eventId={eventModalId}
        initialDate={eventModalDate}
        initialStartTime={eventModalTime}
        initialEndTime={
          eventModalTime
            ? (() => {
                const [h, m] = eventModalTime.split(":").map(Number);
                const endH = h + 1;
                return `${String(endH).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
              })()
            : undefined
        }
        onSuccess={invalidateAll}
      />
    </div>
  );
}
