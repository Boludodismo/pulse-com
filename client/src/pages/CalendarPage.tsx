import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { trpc } from "../lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { useLocation } from "wouter";
import {
  ChevronLeft, ChevronRight, Plus, Edit2, Trash2,
  Calendar as CalendarIcon, Check, Clock, User, FileText, Pencil, ExternalLink, Stethoscope, Users, TriangleAlert,
} from "lucide-react";
import { EventModal } from "@/components/EventModal";

// Paleta de cores estilo Apple Calendar
const COLOR_PALETTE = [
  "#FF3B30", "#FF9500", "#FFCC00", "#34C759", "#00C7BE",
  "#30B0C7", "#32ADE6", "#007AFF", "#5856D6", "#AF52DE",
  "#FF2D55", "#A2845E", "#8E8E93", "#636366", "#1C1C1E",
];

const HOURS = Array.from({ length: 16 }, (_, i) => i + 7); // 07:00 → 22:00
const SLOT_HEIGHT = 64; // px por hora
const MINUTES_PER_SLOT = 60;

function toLocalDateString(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day} ${hours}:${minutes}:00`;
}

// ID virtual para o calendário "Agendamentos" (agendamentos sem calendarId)
const AGENDA_VIRTUAL_ID = -1;
const AGENDA_VIRTUAL_COLOR = "#AF52DE"; // violeta

function isSameDay(d1: Date | null, d2: Date | null) {
  if (!d1 || !d2) return false;
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
}
function isToday(date: Date | null) {
  if (!date) return false;
  return isSameDay(date, new Date());
}

const STATUS_LABELS: Record<string, string> = {
  agendado: "Agendado", confirmado: "Confirmado", concluido: "Concluído",
  cancelado: "Cancelado", reagendado: "Reagendado",
};
const STATUS_COLORS: Record<string, string> = {
  agendado: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  confirmado: "bg-green-500/20 text-green-300 border-green-500/30",
  concluido: "bg-gray-500/20 text-gray-300 border-gray-500/30",
  cancelado: "bg-red-500/20 text-red-300 border-red-500/30",
  reagendado: "bg-orange-500/20 text-orange-300 border-orange-500/30",
};

export default function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<"month" | "week" | "day">("week");
  const [visibleCalendars, setVisibleCalendars] = useState<number[]>([]);
  const [showAgenda, setShowAgenda] = useState(true); // controla visibilidade do calendário virtual "Agendamentos"
  // Filtro por artista: null = todos visíveis; Set de nomes = apenas esses
  const [hiddenArtists, setHiddenArtists] = useState<Set<string>>(new Set());
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const weekScrollRef = useRef<HTMLDivElement>(null);
  const [nowTop, setNowTop] = useState(0);
  const [, navigate] = useLocation();

  // Dialogs de calendário
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingCalendar, setEditingCalendar] = useState<any>(null);
  const [calForm, setCalForm] = useState({ name: "", description: "", color: "#007AFF" });

  // Modal de detalhes do agendamento
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedApt, setSelectedApt] = useState<any>(null);

  // EventModal (criar/editar agendamento)
  const [eventModalOpen, setEventModalOpen] = useState(false);
  const [eventModalId, setEventModalId] = useState<number | null>(null);
  const [eventModalDate, setEventModalDate] = useState<Date | undefined>();
  const [eventModalTime, setEventModalTime] = useState<string | undefined>();

  // Drag & Drop
  const [draggedApt, setDraggedApt] = useState<any>(null);
  const [dragOverSlot, setDragOverSlot] = useState<{ date: Date; hour: number; minute: number } | null>(null);
  const dragOffsetMinutes = useRef<number>(0);

  // Queries
  const { data: calendars = [], refetch: refetchCalendars } = trpc.calendars.list.useQuery();
  const { data: appointments = [], refetch: refetchAppointments } = trpc.appointments.list.useQuery();
  const { data: artistsList = [] } = trpc.artists.list.useQuery();
  const { data: podLinkedMap } = trpc.procedures.listLinkedAppointmentIds.useQuery(undefined, { staleTime: 60_000 });

  const invalidateAll = useCallback(() => {
    refetchAppointments();
  }, [refetchAppointments]);

  // Mutations
  const createCalendar = trpc.calendars.create.useMutation({
    onSuccess: () => {
      refetchCalendars();
      setCreateOpen(false);
      setCalForm({ name: "", description: "", color: "#007AFF" });
      toast.success("Calendário criado!");
    },
    onError: (e) => toast.error(e.message),
  });
  const updateCalendar = trpc.calendars.update.useMutation({
    onSuccess: () => { refetchCalendars(); setEditOpen(false); toast.success("Calendário atualizado!"); },
    onError: (e) => toast.error(e.message),
  });
  const deleteCalendar = trpc.calendars.delete.useMutation({
    onSuccess: () => { refetchCalendars(); toast.success("Calendário excluído!"); },
    onError: (e) => toast.error(e.message),
  });

  const updateAppointmentDate = trpc.appointments.update.useMutation({
    onSuccess: () => {
      toast.success("Agendamento reagendado!");
      invalidateAll();
      setDraggedApt(null);
      setDragOverSlot(null);
    },
    onError: (e) => {
      toast.error(`Erro ao reagendar: ${e.message}`);
      setDraggedApt(null);
      setDragOverSlot(null);
    },
  });

  // Handlers de Drag & Drop
  const handleDragStart = (e: React.DragEvent, apt: any) => {
    setDraggedApt(apt);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", apt.id.toString());
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const offsetY = e.clientY - rect.top;
    const offsetMinutes = Math.floor((offsetY / SLOT_HEIGHT) * MINUTES_PER_SLOT);
    dragOffsetMinutes.current = Math.max(0, Math.min(offsetMinutes, (apt.duration || 60) - 15));
  };

  const handleDragOver = (e: React.DragEvent, date: Date, hour: number, minute: number) => {
    if (!draggedApt) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverSlot({ date, hour, minute });
  };

  const handleDrop = (e: React.DragEvent, targetDate: Date, hour: number, minute: number) => {
    e.preventDefault();
    if (!draggedApt) return;
    const totalMinutes = hour * 60 + minute - dragOffsetMinutes.current;
    const adjustedHour = Math.floor(Math.max(0, totalMinutes) / 60);
    const adjustedMinute = Math.round((Math.max(0, totalMinutes) % 60) / 30) * 30; // snap 30min
    const newDate = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), adjustedHour, adjustedMinute, 0);
    const originalDate = new Date(draggedApt.date);
    if (originalDate.getTime() === newDate.getTime()) { setDraggedApt(null); setDragOverSlot(null); return; }
    updateAppointmentDate.mutate({ id: draggedApt.id, data: { date: toLocalDateString(newDate) } });
  };

  // Inicializar calendários visíveis
  useEffect(() => {
    if (calendars.length > 0 && visibleCalendars.length === 0) {
      setVisibleCalendars((calendars as any[]).map((c) => c.id));
    }
  }, [calendars]);

  // Linha de hora atual
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

  // Scroll automático para hora atual
  const scrollToNow = () => {
    if (weekScrollRef.current) {
      const now = new Date();
      const minutes = (now.getHours() - HOURS[0]) * 60 + now.getMinutes();
      const top = Math.max(0, (minutes / 60) * SLOT_HEIGHT - 120);
      weekScrollRef.current.scrollTo({ top, behavior: "smooth" });
    }
  };

  useEffect(() => { setTimeout(scrollToNow, 150); }, [viewMode]);

  // Navegação
  const goToToday = () => { setCurrentDate(new Date()); setTimeout(scrollToNow, 150); };
  const nav = (dir: -1 | 1) => {
    const d = new Date(currentDate);
    if (viewMode === "month") d.setMonth(d.getMonth() + dir);
    else if (viewMode === "week") d.setDate(d.getDate() + dir * 7);
    else d.setDate(d.getDate() + dir);
    setCurrentDate(d);
  };

  // Semana atual
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

  // Mês atual
  const calendarDays = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const days: (Date | null)[] = [];
    for (let i = 0; i < firstDay.getDay(); i++) days.push(null);
    for (let d = 1; d <= lastDay.getDate(); d++) days.push(new Date(year, month, d));
    while (days.length % 7 !== 0) days.push(null);
    return days;
  }, [currentDate]);

  // Artistas únicos extraídos dos agendamentos + lista cadastrada
  const allArtistNames = useMemo(() => {
    const fromApts = (appointments as any[]).map((a) => a.artist).filter(Boolean) as string[];
    const fromList = (artistsList as any[]).map((a) => a.name).filter(Boolean) as string[];
    return Array.from(new Set([...fromList, ...fromApts])).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [appointments, artistsList]);

  // Mapa nome → cor personalizada do artista cadastrado
  const artistColorMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const a of artistsList as any[]) {
      if (a.name && a.color) map[a.name] = a.color;
    }
    return map;
  }, [artistsList]);

  // Retorna a cor de um artista: personalizada > paleta automática por índice
  const getArtistColor = (name: string) => {
    if (artistColorMap[name]) return artistColorMap[name];
    const idx = allArtistNames.indexOf(name) % COLOR_PALETTE.length;
    return COLOR_PALETTE[idx];
  };

  const handleToggleArtist = (name: string) => {
    setHiddenArtists((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });
  };

  const handleToggleAllArtists = () => {
    if (hiddenArtists.size === 0) {
      // ocultar todos
      setHiddenArtists(new Set(allArtistNames));
    } else {
      // mostrar todos
      setHiddenArtists(new Set());
    }
  };

  // Filtrar agendamentos considerando calendários visíveis + toggle "Agendamentos" + filtro de artistas
  const filteredAppointments = useMemo(() => {
    return (appointments as any[]).filter((apt) => {
      // Filtro por artista
      if (hiddenArtists.size > 0 && apt.artist && hiddenArtists.has(apt.artist)) return false;
      if (apt.calendarId) {
        // Agendamento vinculado a um calendário real → respeita visibilidade
        return visibleCalendars.includes(apt.calendarId);
      }
      // Agendamento sem calendário → pertence ao calendário virtual "Agendamentos"
      return showAgenda;
    });
  }, [appointments, visibleCalendars, showAgenda, hiddenArtists]);

  // Cor do agendamento: cor do artista (personalizada ou automática) > calendário > status
  const getAppointmentColor = (apt: any) => {
    // Prioridade 1: cor personalizada do artista cadastrado
    if (apt.artist && artistColorMap[apt.artist]) return artistColorMap[apt.artist];
    // Prioridade 2: cor do calendário vinculado
    if (apt.calendarId) {
      const cal = (calendars as any[]).find((c) => c.id === apt.calendarId);
      if (cal) return cal.color;
    }
    // Prioridade 3: cor por artista (paleta automática) se o nome estiver nos agendamentos
    if (apt.artist) return getArtistColor(apt.artist);
    // Fallback: cor por status
    const colors: Record<string, string> = {
      agendado: "#007AFF", confirmado: "#34C759", concluido: "#8E8E93",
      cancelado: "#FF3B30", reagendado: "#FF9500",
    };
    return colors[apt.status] || AGENDA_VIRTUAL_COLOR;
  };

  const getAptsByDay = (day: Date) =>
    filteredAppointments.filter((apt: any) => isSameDay(new Date(apt.date.replace(" ", "T")), day));

  // Título do header
  const headerTitle = useMemo(() => {
    if (viewMode === "month") {
      return currentDate.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
    } else if (viewMode === "week") {
      const start = weekDays[0].toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
      const end = weekDays[6].toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
      return `${start} — ${end}`;
    } else {
      return currentDate.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });
    }
  }, [currentDate, viewMode, weekDays]);

  const handleToggleCalendar = (id: number) => {
    setVisibleCalendars((prev) =>
      prev.includes(id) ? prev.filter((cid) => cid !== id) : [...prev, id]
    );
  };

  const openEdit = (cal: any) => {
    setEditingCalendar(cal);
    setCalForm({ name: cal.name, description: cal.description || "", color: cal.color });
    setEditOpen(true);
  };

  const handleCreate = () => {
    if (!calForm.name.trim()) { toast.error("Nome obrigatório"); return; }
    createCalendar.mutate(calForm);
  };

  const handleUpdate = () => {
    if (!editingCalendar) return;
    updateCalendar.mutate({ id: editingCalendar.id, ...calForm });
  };

  const handleDelete = (id: number) => {
    if (confirm("Excluir este calendário? Os agendamentos não serão excluídos.")) {
      deleteCalendar.mutate({ id });
    }
  };

  const openDetails = (apt: any) => {
    setSelectedApt(apt);
    setDetailsOpen(true);
  };

  // Abre EventModal para criar agendamento em data/hora específica
  const openNewApt = (date: Date, hour?: number, minute?: number) => {
    setEventModalId(null);
    setEventModalDate(date);
    if (hour !== undefined) {
      setEventModalTime(`${String(hour).padStart(2, "0")}:${String(minute ?? 0).padStart(2, "0")}`);
    } else {
      setEventModalTime(undefined);
    }
    setEventModalOpen(true);
  };

  // Abre EventModal para editar agendamento existente
  const openEditApt = (apt: any) => {
    setEventModalId(apt.id);
    setEventModalDate(undefined);
    setEventModalTime(undefined);
    setEventModalOpen(true);
  };

  // Duplo clique em slot de hora → novo agendamento
  const handleSlotDblClick = (day: Date, hour: number, e: React.MouseEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const offsetY = e.clientY - rect.top;
    const minute = Math.floor((offsetY / SLOT_HEIGHT) * 60);
    const snapped = Math.round(minute / 15) * 15;
    openNewApt(day, hour, snapped >= 60 ? 59 : snapped);
  };

  // ── Visão Semanal ─────────────────────────────────────────────────────────
  const renderWeekView = () => (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="grid grid-cols-[56px_repeat(7,1fr)] border-b border-white/10 bg-[#1c1c1e] sticky top-0 z-10">
        <div className="p-2" />
        {weekDays.map((day, i) => (
          <div key={i} className={`text-center py-2 border-l border-white/10 ${isToday(day) ? "bg-blue-600/10" : ""}`}>
            <div className="text-[11px] text-gray-400 uppercase tracking-wide">
              {day.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "")}
            </div>
            <div className={`text-lg font-semibold mx-auto w-8 h-8 flex items-center justify-center rounded-full mt-0.5
              ${isToday(day) ? "bg-blue-500 text-white" : "text-gray-100"}`}>
              {day.getDate()}
            </div>
          </div>
        ))}
      </div>
      <div ref={weekScrollRef} className="flex-1 overflow-y-auto">
        <div className="relative grid grid-cols-[56px_repeat(7,1fr)]" style={{ height: `${HOURS.length * SLOT_HEIGHT}px` }}>
          <div className="relative">
            {HOURS.map((hour) => (
              <div key={hour} className="absolute w-full border-t border-white/10 text-[11px] text-gray-500 pr-2 text-right"
                style={{ top: `${(hour - HOURS[0]) * SLOT_HEIGHT}px`, height: `${SLOT_HEIGHT}px` }}>
                {String(hour).padStart(2, "0")}:00
              </div>
            ))}
          </div>
          {weekDays.map((day, dayIndex) => {
            const dayApts = getAptsByDay(day);
            return (
              <div key={dayIndex} className={`relative border-l border-white/10 ${isToday(day) ? "bg-blue-500/5" : ""}`}>
                {HOURS.map((hour) => (
                  <div key={hour}
                    className="absolute w-full border-t border-white/10 hover:bg-white/5 cursor-pointer transition-colors"
                    style={{ top: `${(hour - HOURS[0]) * SLOT_HEIGHT}px`, height: `${SLOT_HEIGHT}px` }}
                    onDoubleClick={(e) => handleSlotDblClick(day, hour, e)}>
                    {/* Drop targets: hora cheia e meia hora */}
                    <div className="absolute inset-x-0 top-0 h-1/2 z-5"
                      onDragOver={(e) => handleDragOver(e, day, hour, 0)}
                      onDrop={(e) => handleDrop(e, day, hour, 0)} />
                    <div className="absolute inset-x-0 bottom-0 h-1/2 z-5"
                      onDragOver={(e) => handleDragOver(e, day, hour, 30)}
                      onDrop={(e) => handleDrop(e, day, hour, 30)} />
                    <div className="absolute w-full border-t border-white/5" style={{ top: "50%" }} />
                  </div>
                ))}
                {isToday(day) && (
                  <div className="absolute left-0 right-0 z-20 pointer-events-none" style={{ top: `${nowTop}px` }}>
                    <div className="flex items-center">
                      <div className="w-2 h-2 rounded-full bg-red-500 -ml-1 flex-shrink-0" />
                      <div className="flex-1 h-[2px] bg-red-500" />
                    </div>
                  </div>
                )}
                {dayApts.map((apt: any) => {
                  const aptDate = new Date(apt.date.replace(" ", "T"));
                  const startMinutes = (aptDate.getHours() - HOURS[0]) * 60 + aptDate.getMinutes();
                  const durationMinutes = apt.duration || 60;
                  const top = (startMinutes / 60) * SLOT_HEIGHT;
                  const height = Math.max(20, (durationMinutes / 60) * SLOT_HEIGHT - 2);
                  const color = getAppointmentColor(apt);
                  const hasPod = podLinkedMap && podLinkedMap[apt.id];
                  return (
                    <div key={apt.id}
                      draggable
                      onDragStart={(e) => { e.stopPropagation(); handleDragStart(e, apt); }}
                      onDragEnd={() => { setDraggedApt(null); setDragOverSlot(null); }}
                      onClick={() => { if (!draggedApt) openDetails(apt); }}
                      onDoubleClick={(e) => { e.stopPropagation(); openEditApt(apt); }}
                      className={`absolute left-0.5 right-0.5 rounded-md px-1.5 py-1 overflow-hidden cursor-grab active:cursor-grabbing z-10 transition-opacity hover:opacity-90 ${draggedApt?.id === apt.id ? "opacity-40" : ""}`}
                      style={{ top: `${top}px`, height: `${height}px`, backgroundColor: color + "cc", borderLeft: `3px solid ${color}` }}>
                      <div className="text-white text-[11px] font-semibold truncate leading-tight flex items-center gap-1">
                        {apt.confirmationAttention === 'pending' && <TriangleAlert className="h-3 w-3 shrink-0 text-yellow-200 fill-amber-500/50" />}
                        {hasPod && <Stethoscope className="h-2.5 w-2.5 shrink-0" />}
                        {apt.clientName || "Cliente"}
                      </div>
                      {height > 30 && <div className="text-white/80 text-[10px] truncate">{apt.service || ""}</div>}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );

  // ── Visão Mensal ──────────────────────────────────────────────────────────
  const renderMonthView = () => (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="grid grid-cols-7 border-b border-white/10 bg-[#1c1c1e]">
        {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((d) => (
          <div key={d} className="text-center text-[11px] text-gray-400 uppercase tracking-wide py-2">{d}</div>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto">
        <div className="grid grid-cols-7">
          {calendarDays.map((day, index) => {
            const dayApts = day ? getAptsByDay(day) : [];
            return (
              <div key={index}
                className={`min-h-[100px] p-1.5 border-b border-r border-white/10
                  ${day ? "hover:bg-white/5 cursor-pointer" : "bg-[#111]"}
                  ${isToday(day) ? "bg-blue-500/10" : ""}`}
                onDoubleClick={() => day && openNewApt(day)}>
                {day && (
                  <>
                    <div className={`text-xs font-semibold mb-1 w-6 h-6 flex items-center justify-center rounded-full
                      ${isToday(day) ? "bg-blue-500 text-white" : "text-gray-300"}`}>
                      {day.getDate()}
                    </div>
                    <div className="space-y-0.5">
                      {dayApts.slice(0, 3).map((apt: any) => {
                        const color = getAppointmentColor(apt);
                        const hasPod = podLinkedMap && podLinkedMap[apt.id];
                        return (
                          <div key={apt.id}
                            onClick={(e) => { e.stopPropagation(); openDetails(apt); }}
                            onDoubleClick={(e) => { e.stopPropagation(); openEditApt(apt); }}
                            className="text-[10px] text-white px-1 py-0.5 rounded truncate flex items-center gap-1 cursor-pointer hover:opacity-80"
                            style={{ backgroundColor: color + "cc" }}>
                            {apt.confirmationAttention === 'pending' && <TriangleAlert className="h-2.5 w-2.5 shrink-0 text-yellow-200 fill-amber-500/50" />}
                            {hasPod && <Stethoscope className="h-2 w-2 shrink-0" />}
                            {apt.clientName || "Cliente"}
                          </div>
                        );
                      })}
                      {dayApts.length > 3 && (
                        <div className="text-[10px] text-gray-400 pl-1">+{dayApts.length - 3} mais</div>
                      )}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );

  // ── Visão Diária ──────────────────────────────────────────────────────────
  const renderDayView = () => {
    const dayApts = getAptsByDay(currentDate);
    return (
      <div className="flex flex-col flex-1 overflow-hidden">
        <div className="border-b border-white/10 bg-[#1c1c1e] px-4 py-3 text-center">
          <div className="text-[11px] text-gray-400 uppercase tracking-wide">
            {currentDate.toLocaleDateString("pt-BR", { weekday: "long" })}
          </div>
          <div className={`text-3xl font-light mx-auto w-12 h-12 flex items-center justify-center rounded-full mt-1
            ${isToday(currentDate) ? "bg-blue-500 text-white" : "text-gray-100"}`}>
            {currentDate.getDate()}
          </div>
        </div>
        <div ref={weekScrollRef} className="flex-1 overflow-y-auto">
          <div className="relative grid grid-cols-[56px_1fr]" style={{ height: `${HOURS.length * SLOT_HEIGHT}px` }}>
            <div className="relative">
              {HOURS.map((hour) => (
                <div key={hour} className="absolute w-full border-t border-white/10 text-[11px] text-gray-500 pr-2 text-right"
                  style={{ top: `${(hour - HOURS[0]) * SLOT_HEIGHT}px`, height: `${SLOT_HEIGHT}px` }}>
                  {String(hour).padStart(2, "0")}:00
                </div>
              ))}
            </div>
            <div className="relative border-l border-white/10">
              {HOURS.map((hour) => (
                <div key={hour}
                  className="absolute w-full border-t border-white/10 hover:bg-white/5 cursor-pointer"
                  style={{ top: `${(hour - HOURS[0]) * SLOT_HEIGHT}px`, height: `${SLOT_HEIGHT}px` }}
                  onDoubleClick={(e) => handleSlotDblClick(currentDate, hour, e)}>
                  <div className="absolute inset-x-0 top-0 h-1/2 z-5"
                    onDragOver={(e) => handleDragOver(e, currentDate, hour, 0)}
                    onDrop={(e) => handleDrop(e, currentDate, hour, 0)} />
                  <div className="absolute inset-x-0 bottom-0 h-1/2 z-5"
                    onDragOver={(e) => handleDragOver(e, currentDate, hour, 30)}
                    onDrop={(e) => handleDrop(e, currentDate, hour, 30)} />
                </div>
              ))}
              {isToday(currentDate) && (
                <div className="absolute left-0 right-0 z-20 pointer-events-none" style={{ top: `${nowTop}px` }}>
                  <div className="flex items-center">
                    <div className="w-2 h-2 rounded-full bg-red-500 -ml-1 flex-shrink-0" />
                    <div className="flex-1 h-[2px] bg-red-500" />
                  </div>
                </div>
              )}
              {dayApts.map((apt: any) => {
                const aptDate = new Date(apt.date.replace(" ", "T"));
                const startMinutes = (aptDate.getHours() - HOURS[0]) * 60 + aptDate.getMinutes();
                const top = (startMinutes / 60) * SLOT_HEIGHT;
                const height = Math.max(24, ((apt.duration || 60) / 60) * SLOT_HEIGHT - 2);
                const color = getAppointmentColor(apt);
                const hasPod = podLinkedMap && podLinkedMap[apt.id];
                return (
                  <div key={apt.id}
                    draggable
                    onDragStart={(e) => { e.stopPropagation(); handleDragStart(e, apt); }}
                    onDragEnd={() => { setDraggedApt(null); setDragOverSlot(null); }}
                    onClick={() => { if (!draggedApt) openDetails(apt); }}
                    onDoubleClick={(e) => { e.stopPropagation(); openEditApt(apt); }}
                    className={`absolute left-1 right-1 rounded-lg px-2 py-1.5 overflow-hidden cursor-grab active:cursor-grabbing z-10 hover:opacity-90 transition-opacity ${draggedApt?.id === apt.id ? "opacity-40" : ""}`}
                    style={{ top: `${top}px`, height: `${height}px`, backgroundColor: color + "cc", borderLeft: `4px solid ${color}` }}>
                    <div className="text-white text-xs font-semibold truncate flex items-center gap-1">
                      {apt.confirmationAttention === 'pending' && <TriangleAlert className="h-3.5 w-3.5 shrink-0 text-yellow-200 fill-amber-500/50" />}
                      {hasPod && <Stethoscope className="h-3 w-3 shrink-0" />}
                      {apt.clientName || "Cliente"}
                    </div>
                    {height > 36 && <div className="text-white/80 text-[11px] truncate">{apt.service || ""}</div>}
                    {height > 52 && <div className="text-white/70 text-[10px]">{aptDate.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</div>}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ── Mini calendário mensal no sidebar ─────────────────────────────────────
  const renderMiniCalendar = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const lastDate = new Date(year, month + 1, 0).getDate();
    const cells: React.ReactElement[] = [];
    for (let i = 0; i < firstDay; i++) cells.push(<div key={`e${i}`} />);
    for (let d = 1; d <= lastDate; d++) {
      const isT = d === now.getDate();
      cells.push(
        <div key={d} onClick={() => setCurrentDate(new Date(year, month, d))}
          className={`text-[10px] w-5 h-5 flex items-center justify-center rounded-full mx-auto cursor-pointer
            ${isT ? "bg-blue-500 text-white font-bold" : "text-gray-400 hover:bg-white/10"}`}>
          {d}
        </div>
      );
    }
    return (
      <div className="p-3 border-b border-white/10">
        <div className="text-xs font-semibold text-gray-300 capitalize mb-2">
          {now.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
        </div>
        <div className="grid grid-cols-7 gap-0.5 text-center">
          {["D","S","T","Q","Q","S","S"].map((d, i) => (
            <div key={i} className="text-[9px] text-gray-500 py-0.5">{d}</div>
          ))}
          {cells}
        </div>
      </div>
    );
  };

  // ── Dialog de calendário (form compartilhado) ─────────────────────────────
  const renderCalendarForm = () => (
    <div className="space-y-4">
      <div>
        <Label className="text-gray-300 text-sm">Nome *</Label>
        <Input value={calForm.name} onChange={(e) => setCalForm({ ...calForm, name: e.target.value })}
          placeholder="Ex: Tatuagens, Piercing, Pessoal..." className="bg-white/5 border-white/20 text-gray-100 mt-1" />
      </div>
      <div>
        <Label className="text-gray-300 text-sm">Descrição</Label>
        <Input value={calForm.description} onChange={(e) => setCalForm({ ...calForm, description: e.target.value })}
          placeholder="Descrição opcional" className="bg-white/5 border-white/20 text-gray-100 mt-1" />
      </div>
      <div>
        <Label className="text-gray-300 text-sm">Cor</Label>
        <div className="flex flex-wrap gap-2 mt-2">
          {COLOR_PALETTE.map((color) => (
            <button key={color}
              className={`w-7 h-7 rounded-full transition-transform hover:scale-110 flex items-center justify-center
                ${calForm.color === color ? "ring-2 ring-white ring-offset-2 ring-offset-[#2c2c2e]" : ""}`}
              style={{ backgroundColor: color }}
              onClick={() => setCalForm({ ...calForm, color })}>
              {calForm.color === color && <Check className="h-3 w-3 text-white" />}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 mt-2">
          <input type="color" value={calForm.color} onChange={(e) => setCalForm({ ...calForm, color: e.target.value })}
            className="w-8 h-8 rounded cursor-pointer border-0 bg-transparent" />
          <span className="text-xs text-gray-400">Cor personalizada: {calForm.color}</span>
        </div>
      </div>
    </div>
  );

  // ── Modal de detalhes do agendamento ─────────────────────────────────────
  const renderDetailsModal = () => {
    if (!selectedApt) return null;
    const aptDate = new Date(selectedApt.date.replace(" ", "T"));
    const hasPod = podLinkedMap && podLinkedMap[selectedApt.id];
    const calName = selectedApt.calendarId
      ? (calendars as any[]).find((c) => c.id === selectedApt.calendarId)?.name
      : "Agendamentos";
    const calColor = selectedApt.calendarId
      ? (calendars as any[]).find((c) => c.id === selectedApt.calendarId)?.color
      : AGENDA_VIRTUAL_COLOR;

    return (
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="bg-[#2c2c2e] border-white/10 text-gray-100 max-w-md">
          <DialogHeader>
            <DialogTitle className="text-gray-100 flex items-center gap-2">
              <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: calColor }} />
              Detalhes do Agendamento
            </DialogTitle>
            <DialogDescription className="text-gray-400 text-xs">{calName}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Cliente */}
            <div className="flex items-start gap-3">
              <User className="h-4 w-4 text-gray-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-gray-400">Cliente</p>
                <p className="font-semibold text-gray-100">{selectedApt.clientName || "—"}</p>
              </div>
            </div>
            {/* Data/hora */}
            <div className="flex items-start gap-3">
              <Clock className="h-4 w-4 text-gray-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-gray-400">Data e Hora</p>
                <p className="font-semibold text-gray-100">
                  {aptDate.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })}
                  {" às "}
                  {aptDate.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">{selectedApt.duration} minutos</p>
              </div>
            </div>
            {/* Serviço / Artista */}
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-start gap-2">
                <FileText className="h-4 w-4 text-gray-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-gray-400">Serviço</p>
                  <p className="text-sm text-gray-100">{selectedApt.service}</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <User className="h-4 w-4 text-gray-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-gray-400">Artista</p>
                  <p className="text-sm text-gray-100">{selectedApt.artist}</p>
                </div>
              </div>
            </div>
            {/* Status */}
            <div className="flex items-center gap-2">
              <span className={`text-xs px-2 py-0.5 rounded border ${STATUS_COLORS[selectedApt.status] || "bg-gray-500/20 text-gray-300"}`}>
                {STATUS_LABELS[selectedApt.status] || selectedApt.status}
              </span>
              {hasPod && (
                <span className="text-xs px-2 py-0.5 rounded border border-violet-500/30 bg-violet-500/20 text-violet-300 flex items-center gap-1">
                  <Stethoscope className="h-3 w-3" /> Sessão POD
                </span>
              )}
            </div>
            {selectedApt.confirmationAttention === 'pending' && (
              <div className="rounded-lg border border-amber-500/50 bg-amber-500/10 p-3 flex items-start gap-2">
                <TriangleAlert className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-amber-300">Resposta do cliente exige atenção</p>
                  <p className="text-xs text-gray-300 mt-1">
                    {selectedApt.confirmationStatus === 'atraso'
                      ? `Atraso aproximado de ${selectedApt.confirmationDelayMinutes || '?'} minutos. Abra o agendamento para decidir se ainda será possível atender.`
                      : selectedApt.confirmationStatus === 'reagendar'
                        ? 'O cliente solicitou reagendamento.'
                        : 'O cliente informou que não conseguirá comparecer.'}
                  </p>
                </div>
              </div>
            )}
            {/* Observações */}
            {selectedApt.notes && (
              <div className="bg-white/5 rounded-lg p-3 text-sm text-gray-300">{selectedApt.notes}</div>
            )}
          </div>
          <DialogFooter className="flex gap-2 flex-wrap">
            {hasPod && (
              <Button size="sm" variant="outline"
                className="border-violet-500/50 text-violet-300 hover:bg-violet-500/10 text-xs"
                onClick={() => { setDetailsOpen(false); navigate(`/pod/session/${podLinkedMap![selectedApt.id]}`); }}>
                <Stethoscope className="h-3.5 w-3.5 mr-1" />
                Abrir POD
              </Button>
            )}
            <Button size="sm" variant="outline"
              className="border-white/20 text-gray-300 hover:bg-white/10 text-xs"
              onClick={() => { setDetailsOpen(false); navigate(`/clients/${selectedApt.clientId}`); }}>
              <ExternalLink className="h-3.5 w-3.5 mr-1" />
              Ver Cliente
            </Button>
            <Button size="sm" variant="ghost" className="text-gray-400 text-xs ml-auto"
              onClick={() => setDetailsOpen(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  };

  // Contagem de agendamentos sem calendário (para o badge do virtual)
  const agendaCount = useMemo(() =>
    (appointments as any[]).filter((a) => !a.calendarId).length,
    [appointments]
  );

  return (
    <div className="flex bg-[#1c1c1e] text-gray-100 overflow-hidden" style={{ height: "calc(100dvh - 56px)" }}>
      {/* Overlay mobile para sidebar */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-30 bg-black/60 sm:hidden" onClick={() => setSidebarOpen(false)} aria-hidden="true" />
      )}

      {/* Sidebar */}
      {sidebarOpen && (
        <div className="fixed sm:relative inset-y-0 left-0 z-40 sm:z-auto w-56 flex-shrink-0 bg-[#161618] border-r border-white/10 flex flex-col shadow-xl sm:shadow-none" style={{ top: 0, height: "100%" }}>
          {renderMiniCalendar()}
          <div className="flex-1 overflow-y-auto p-3">

            {/* Calendário virtual "Agendamentos" */}
            <div className="mb-3">
              <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide block mb-1.5">Agenda</span>
              <div className="flex items-center gap-2 px-1 py-1.5 rounded-md hover:bg-white/5 cursor-pointer"
                onClick={() => setShowAgenda((v) => !v)}>
                <div className="w-3 h-3 rounded-sm flex-shrink-0"
                  style={{ backgroundColor: showAgenda ? AGENDA_VIRTUAL_COLOR : "transparent", border: `2px solid ${AGENDA_VIRTUAL_COLOR}` }} />
                <span className={`flex-1 text-xs truncate ${showAgenda ? "text-gray-200" : "text-gray-500"}`}>
                  Agendamentos
                </span>
                {agendaCount > 0 && (
                  <span className="text-[10px] text-gray-500 bg-white/10 rounded-full px-1.5">{agendaCount}</span>
                )}
              </div>
            </div>

            {/* Filtro por Artistas */}
            {allArtistNames.length > 0 && (
              <div className="mb-3">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    Artistas
                  </span>
                  <button
                    className="text-[10px] text-gray-500 hover:text-gray-300 transition-colors"
                    onClick={handleToggleAllArtists}
                    title={hiddenArtists.size === 0 ? "Ocultar todos" : "Mostrar todos"}
                  >
                    {hiddenArtists.size === 0 ? "ocultar" : "mostrar"}
                  </button>
                </div>
                <div className="space-y-0.5">
                  {allArtistNames.map((name) => {
                    const visible = !hiddenArtists.has(name);
                    // Cor personalizada do artista (ou automática por índice)
                    const color = getArtistColor(name);
                    const count = (appointments as any[]).filter((a: any) => a.artist === name).length;
                    return (
                      <div
                        key={name}
                        className="flex items-center gap-2 px-1 py-1.5 rounded-md hover:bg-white/5 cursor-pointer"
                        onClick={() => handleToggleArtist(name)}
                      >
                        <div
                          className="w-3 h-3 rounded-full flex-shrink-0"
                          style={{
                            backgroundColor: visible ? color : "transparent",
                            border: `2px solid ${color}`,
                          }}
                        />
                        <span className={`flex-1 text-xs truncate ${visible ? "text-gray-200" : "text-gray-500"}`}>
                          {name}
                        </span>
                        {count > 0 && (
                          <span className="text-[10px] text-gray-500 bg-white/10 rounded-full px-1.5">{count}</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Calendários personalizados */}
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Meus Calendários</span>
              <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-gray-400 hover:text-white"
                onClick={() => { setCalForm({ name: "", description: "", color: "#007AFF" }); setCreateOpen(true); }}>
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
            <div className="space-y-0.5">
              {(calendars as any[]).map((cal) => (
                <div key={cal.id} className="flex items-center gap-2 px-1 py-1.5 rounded-md hover:bg-white/5 group cursor-pointer">
                  <div className="w-3 h-3 rounded-sm flex-shrink-0 cursor-pointer"
                    style={{ backgroundColor: visibleCalendars.includes(cal.id) ? cal.color : "transparent", border: `2px solid ${cal.color}` }}
                    onClick={() => handleToggleCalendar(cal.id)} />
                  <span className={`flex-1 text-xs truncate ${visibleCalendars.includes(cal.id) ? "text-gray-200" : "text-gray-500"}`}>
                    {cal.name}
                  </span>
                  <div className="opacity-0 group-hover:opacity-100 flex gap-0.5">
                    <button className="text-gray-400 hover:text-white p-0.5 rounded" onClick={() => openEdit(cal)}>
                      <Edit2 className="h-3 w-3" />
                    </button>
                    <button className="text-gray-400 hover:text-red-400 p-0.5 rounded" onClick={() => handleDelete(cal.id)}>
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              ))}
              {(calendars as any[]).length === 0 && (
                <div className="text-[11px] text-gray-500 text-center py-4">
                  Nenhum calendário.<br />
                  <button className="text-blue-400 hover:underline mt-1"
                    onClick={() => { setCalForm({ name: "", description: "", color: "#007AFF" }); setCreateOpen(true); }}>
                    Criar calendário
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Área principal */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Toolbar */}
        <div className="flex items-center gap-2 px-4 py-2 border-b border-white/10 bg-[#1c1c1e] flex-shrink-0">
          <Button variant="ghost" size="sm" className="text-gray-400 hover:text-white h-7 w-7 p-0"
            onClick={() => setSidebarOpen(!sidebarOpen)}>
            <CalendarIcon className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm"
            className="h-7 px-3 text-xs border-white/20 bg-transparent text-gray-200 hover:bg-white/10"
            onClick={goToToday}>
            Hoje
          </Button>
          <div className="flex items-center gap-0.5">
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-gray-400 hover:text-white" onClick={() => nav(-1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-gray-400 hover:text-white" onClick={() => nav(1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <h2 className="text-sm font-semibold text-gray-100 flex-1 capitalize">{headerTitle}</h2>
          <div className="flex items-center bg-white/5 rounded-lg p-0.5 gap-0.5">
            {(["day", "week", "month"] as const).map((mode) => (
              <button key={mode} onClick={() => setViewMode(mode)}
                className={`px-2.5 py-1 text-xs rounded-md transition-colors
                  ${viewMode === mode ? "bg-white/15 text-white font-medium" : "text-gray-400 hover:text-white"}`}>
                {mode === "day" ? "Dia" : mode === "week" ? "Semana" : "Mês"}
              </button>
            ))}
          </div>
          <Button size="sm" className="h-7 px-2 sm:px-3 text-xs bg-green-600 hover:bg-green-700 text-white"
            onClick={() => openNewApt(currentDate)}>
            <Plus className="h-3.5 w-3.5 sm:mr-1" />
            <span className="hidden sm:inline">Novo Agendamento</span>
          </Button>
          <Button size="sm" className="h-7 px-2 sm:px-3 text-xs bg-blue-600 hover:bg-blue-700 text-white"
            onClick={() => { setCalForm({ name: "", description: "", color: "#007AFF" }); setCreateOpen(true); }}>
            <Plus className="h-3.5 w-3.5 sm:mr-1" />
            <span className="hidden sm:inline">Novo Calendário</span>
          </Button>
        </div>

        {/* Conteúdo */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {viewMode === "week" && renderWeekView()}
          {viewMode === "month" && renderMonthView()}
          {viewMode === "day" && renderDayView()}
        </div>
      </div>

      {/* Modal de detalhes */}
      {renderDetailsModal()}

      {/* EventModal: criar/editar agendamento */}
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
                return `${String(endH > 23 ? 23 : endH).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
              })()
            : undefined
        }
        onSuccess={() => { invalidateAll(); setEventModalOpen(false); setEventModalId(null); }}
      />

      {/* Dialog: Criar Calendário */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="bg-[#2c2c2e] border-white/10 text-gray-100">
          <DialogHeader>
            <DialogTitle className="text-gray-100">Novo Calendário</DialogTitle>
          </DialogHeader>
          {renderCalendarForm()}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCreateOpen(false)} className="text-gray-400">Cancelar</Button>
            <Button onClick={handleCreate} className="bg-blue-600 hover:bg-blue-700" disabled={createCalendar.isPending}>
              {createCalendar.isPending ? "Criando..." : "Criar Calendário"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Editar Calendário */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="bg-[#2c2c2e] border-white/10 text-gray-100">
          <DialogHeader>
            <DialogTitle className="text-gray-100">Editar Calendário</DialogTitle>
          </DialogHeader>
          {renderCalendarForm()}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditOpen(false)} className="text-gray-400">Cancelar</Button>
            <Button onClick={handleUpdate} className="bg-blue-600 hover:bg-blue-700" disabled={updateCalendar.isPending}>
              {updateCalendar.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
