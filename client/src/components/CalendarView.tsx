import { useRef, useState, useCallback } from "react";
import FullCalendar from "@fullcalendar/react";
import "../styles/fullcalendar-dark.css";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import multiMonthPlugin from "@fullcalendar/multimonth";
import listPlugin from "@fullcalendar/list";
import ptBrLocale from "@fullcalendar/core/locales/pt-br";
import { trpc } from "../lib/trpc";
import { toast } from "sonner";
import { EventModal } from "./EventModal";

interface CalendarViewProps {
  visibleCalendars: number[];
}

/** Converte um objeto Date para string local "YYYY-MM-DD HH:mm:ss" sem conversão UTC */
function toLocalDateString(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  const seconds = String(d.getSeconds()).padStart(2, "0");
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

export function CalendarView({ visibleCalendars }: CalendarViewProps) {
  const calendarRef = useRef<FullCalendar>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null);
  const [clickedDate, setClickedDate] = useState<Date | undefined>();
  const [clickedTime, setClickedTime] = useState<string | undefined>();

  // Duplo clique em evento
  const [lastEventClickTime, setLastEventClickTime] = useState<number>(0);
  const [lastClickedEventId, setLastClickedEventId] = useState<string | null>(null);

  // Duplo clique em data vazia
  const [lastDateClickTime, setLastDateClickTime] = useState<number>(0);

  const utils = trpc.useUtils();

  // Buscar appointments — usamos invalidate para sincronizar com a Agenda
  const { data: appointments = [] } = trpc.appointments.list.useQuery();

  // Buscar calendários
  const { data: calendars = [] } = trpc.calendars.list.useQuery();

  // Mutation para atualizar appointment (drag & drop / resize)
  const updateMutation = trpc.appointments.update.useMutation({
    onSuccess: () => {
      // Invalida AMBAS as queries para sincronizar Calendário Visual ↔ Agenda
      utils.appointments.list.invalidate();
      utils.dashboard.metrics.invalidate();
    },
    onError: (error) => {
      toast.error(`Erro ao atualizar: ${error.message}`);
      // Refetch para reverter visualmente
      utils.appointments.list.invalidate();
    },
  });

  // Converter appointments para eventos do FullCalendar
  const events = appointments
    .filter((apt) => !apt.calendarId || visibleCalendars.includes(apt.calendarId))
    .map((apt) => {
      const calendar = calendars.find((c) => c.id === apt.calendarId);
      const startDate = new Date(apt.date);
      const endDate = new Date(startDate.getTime() + apt.duration * 60 * 1000);

      return {
        id: apt.id.toString(),
        title: `${apt.clientName || "Cliente"} — ${apt.clientPhone || "Sem telefone"}`,
        start: startDate,
        end: endDate,
        backgroundColor: calendar?.color || "#f97316",
        borderColor: calendar?.color || "#f97316",
        textColor: "#ffffff",
        extendedProps: {
          clientId: apt.clientId,
          clientName: apt.clientName,
          clientPhone: apt.clientPhone,
          calendarId: apt.calendarId,
          status: apt.status,
          notes: apt.notes,
          artist: apt.artist,
          service: apt.service,
          duration: apt.duration,
        },
      };
    });

  // Handler para drag & drop — preserva horário relativo ao drop
  const handleEventDrop = useCallback(
    (info: any) => {
      const eventId = parseInt(info.event.id);
      const newStart: Date = info.event.start;
      const newEnd: Date | null = info.event.end;

      const duration = newEnd
        ? Math.round((newEnd.getTime() - newStart.getTime()) / 60000)
        : info.event.extendedProps.duration;

      const dateString = toLocalDateString(newStart);

      toast.loading("Reagendando...", { id: `drag-${eventId}` });

      updateMutation.mutate(
        { id: eventId, data: { date: dateString, duration } },
        {
          onSuccess: () => {
            toast.success("Agendamento reagendado!", { id: `drag-${eventId}` });
          },
          onError: (error) => {
            toast.error(`Erro: ${error.message}`, { id: `drag-${eventId}` });
            info.revert();
          },
        }
      );
    },
    [updateMutation]
  );

  // Handler para resize (redimensionamento de duração)
  const handleEventResize = useCallback(
    (info: any) => {
      const eventId = parseInt(info.event.id);
      const newStart: Date = info.event.start;
      const newEnd: Date = info.event.end;
      const duration = Math.round((newEnd.getTime() - newStart.getTime()) / 60000);
      const dateString = toLocalDateString(newStart);

      toast.loading("Atualizando duração...", { id: `resize-${eventId}` });

      updateMutation.mutate(
        { id: eventId, data: { date: dateString, duration } },
        {
          onSuccess: () => {
            toast.success("Duração atualizada!", { id: `resize-${eventId}` });
          },
          onError: (error) => {
            toast.error(`Erro: ${error.message}`, { id: `resize-${eventId}` });
            info.revert();
          },
        }
      );
    },
    [updateMutation]
  );

  // Handler para clique em evento (clique simples abre edição)
  const handleEventClick = useCallback(
    (info: any) => {
      const eventId = info.event.id;
      setSelectedEventId(parseInt(eventId));
      setClickedDate(undefined);
      setClickedTime(undefined);
      setIsModalOpen(true);
    },
    []
  );

  // Handler para clique em data vazia (clique simples abre criação)
  const handleDateClick = useCallback(
    (info: any) => {
      const clickedDateTime = new Date(info.date);
      setClickedDate(clickedDateTime);
      const hours = clickedDateTime.getHours().toString().padStart(2, "0");
      const minutes = clickedDateTime.getMinutes().toString().padStart(2, "0");
      setClickedTime(`${hours}:${minutes}`);
      setSelectedEventId(null);
      setIsModalOpen(true);
    },
    []
  );

  const handleModalSuccess = useCallback(() => {
    utils.appointments.list.invalidate();
    utils.dashboard.metrics.invalidate();
  }, [utils]);

  return (
    <div className="fullcalendar-container h-full">
      <FullCalendar
        ref={calendarRef}
        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin, multiMonthPlugin, listPlugin]}
        initialView="timeGridWeek"
        headerToolbar={{
          left: "prev,next today",
          center: "title",
          right: "timeGridDay,timeGridWeek,dayGridMonth,multiMonthYear",
        }}
        events={events}
        /* ─── Drag & Drop ─────────────────────────────────────────── */
        editable={true}
        eventStartEditable={true}
        eventDurationEditable={true}
        droppable={true}
        /* Remover constraints que bloqueiam o drag */
        eventConstraint={undefined}
        selectConstraint={undefined}
        eventOverlap={true}
        /* ─── Handlers ────────────────────────────────────────────── */
        eventDrop={handleEventDrop}
        eventResize={handleEventResize}
        eventClick={handleEventClick}
        dateClick={handleDateClick}
        /* ─── Grade de horários ───────────────────────────────────── */
        slotMinTime="07:00:00"
        slotMaxTime="23:00:00"
        slotDuration="00:15:00"
        snapDuration="00:15:00"
        slotLabelInterval="01:00:00"
        allDaySlot={false}
        height="100%"
        locale={ptBrLocale}
        /* Usar "local" para evitar conversões UTC que deslocam o horário */
        timeZone="local"
        nowIndicator={true}
        scrollTime={new Date().getHours() > 8 ? `${String(new Date().getHours() - 1).padStart(2, "0")}:00:00` : "08:00:00"}
        /* ─── Formatação ──────────────────────────────────────────── */
        buttonText={{
          today: "Hoje",
          month: "Mês",
          week: "Semana",
          day: "Dia",
          list: "Lista",
          year: "Ano",
        }}
        slotLabelFormat={{
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        }}
        eventTimeFormat={{
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        }}
        /* Tooltip ao passar o mouse */
        eventMouseEnter={(info) => {
          info.el.title = `${info.event.title}\n${info.event.startStr?.slice(11, 16) || ""}`;
        }}
      />

      <EventModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        eventId={selectedEventId}
        initialDate={clickedDate}
        initialStartTime={clickedTime}
        initialEndTime={
          clickedTime
            ? (() => {
                const [h, m] = clickedTime.split(":").map(Number);
                const endH = h + 1;
                return `${String(endH).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
              })()
            : undefined
        }
        onSuccess={handleModalSuccess}
      />
    </div>
  );
}
