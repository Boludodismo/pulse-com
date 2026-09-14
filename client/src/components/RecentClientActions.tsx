import {
  CalendarClock,
  CalendarX2,
  CheckCircle2,
  Clock,
  BellRing,
} from "lucide-react";
import { appointmentInstant } from "@shared/appointmentTime";

type ActionAlert = { id: number; appointmentId: number; action: string };
type AppointmentSummary = {
  id: number;
  clientName: string | null;
  artist: string | null;
  date: string;
  status: string;
};

const ACTIONS = {
  confirmed: { label: "Confirmou presença", tone: "green", Icon: CheckCircle2 },
  early: { label: "Avisou adiantamento", tone: "yellow", Icon: Clock },
  late: { label: "Avisou atraso", tone: "yellow", Icon: Clock },
  reschedule_requested: {
    label: "Solicitou remarcação",
    tone: "red",
    Icon: CalendarClock,
  },
} as const;

const TONES = {
  green:
    "border-green-400/40 border-l-green-400 bg-green-500/10 text-green-200 hover:bg-green-500/20 focus-visible:ring-green-300",
  yellow:
    "border-yellow-400/40 border-l-yellow-400 bg-yellow-500/10 text-yellow-200 hover:bg-yellow-500/20 focus-visible:ring-yellow-300",
  red: "border-red-400/40 border-l-red-400 bg-red-500/10 text-red-200 hover:bg-red-500/20 focus-visible:ring-red-300",
  neutral:
    "border-gray-400/40 border-l-gray-400 bg-white/5 text-gray-200 hover:bg-white/10 focus-visible:ring-gray-300",
} as const;

function appointmentWhen(value: string | undefined) {
  if (!value) return "Data e horário indisponíveis";
  try {
    // The stored DATETIME is the agenda's wall clock, not a UTC timestamp.
    const date = appointmentInstant(value);
    return `${date.toLocaleDateString("pt-BR", { timeZone: "UTC" })} · ${date.toLocaleTimeString("pt-BR", { timeZone: "UTC", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })}`;
  } catch {
    return "Data e horário indisponíveis";
  }
}

export function RecentClientActions({
  alerts,
  appointments,
  onSelect,
}: {
  alerts: readonly ActionAlert[];
  appointments: readonly AppointmentSummary[];
  onSelect: (alertId: number, appointmentId: number) => void;
}) {
  if (!alerts.length) return null;

  return (
    <section
      aria-label="Ações recentes de clientes"
      className="min-w-0 border-b border-white/10 bg-white/[0.02] px-3 py-2 sm:px-5"
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-2">
        <h2 className="flex items-center gap-1.5 text-xs font-semibold text-gray-200">
          <BellRing className="h-3.5 w-3.5" aria-hidden="true" /> Ações recentes
          de clientes
        </h2>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {alerts.map(alert => {
            // Resolve by appointment ID using the same permission-scoped data as the calendar.
            const appointment = appointments.find(
              item => item.id === alert.appointmentId
            );
            const response = ACTIONS[alert.action as keyof typeof ACTIONS];
            const cancelled = appointment?.status === "cancelado";
            // Cancellation is the current appointment state, not an invented customer response.
            const label = cancelled
              ? "Desmarcado"
              : (response?.label ?? "Nova ação do cliente");
            const tone = cancelled ? "red" : (response?.tone ?? "neutral");
            const Icon = cancelled ? CalendarX2 : (response?.Icon ?? BellRing);
            const clientName = appointment?.clientName?.trim();
            const firstName =
              clientName?.split(/\s+/)[0] || "Cliente não identificado";
            const artist = appointment?.artist?.trim() || "Não informado";
            const when = appointmentWhen(appointment?.date);
            const previousResponse =
              cancelled && response
                ? `Resposta anterior: ${response.label}`
                : null;
            const description = [
              `${clientName || firstName} — ${label}`,
              `Artista: ${artist}`,
              `Agendamento: ${when}`,
              previousResponse,
              appointment
                ? "Abrir agendamento e marcar aviso como visualizado"
                : "Agendamento indisponível. Marcar aviso como visualizado",
            ]
              .filter(Boolean)
              .join("\n");

            return (
              <button
                key={alert.id}
                type="button"
                onClick={() => onSelect(alert.id, alert.appointmentId)}
                className={`flex w-64 shrink-0 flex-col gap-1 rounded-lg border border-l-[3px] px-3 py-2 text-left text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset sm:w-72 ${TONES[tone]}`}
                title={description}
                aria-label={description}
              >
                <span className="flex w-full items-start gap-1.5 font-semibold">
                  <Icon
                    className="mt-0.5 h-3.5 w-3.5 shrink-0"
                    aria-hidden="true"
                  />
                  <span className="min-w-0 break-words">
                    {firstName} · {label}
                  </span>
                </span>
                <span className="w-full truncate text-gray-200">
                  Artista: {artist}
                </span>
                <span className="tabular-nums text-gray-200">
                  Agendamento: {when}
                </span>
                {previousResponse && (
                  <span className="text-gray-300">{previousResponse}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
