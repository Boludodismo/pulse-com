import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Bell, Clock, CalendarCheck, AlertCircle } from "lucide-react";

interface Reminder {
  type: "today" | "next24h" | "next" | "info";
  icon: React.ReactNode;
  message: string;
  className: string;
}

function parseDate(dateStr: string): Date {
  return new Date(dateStr.replace(" ", "T"));
}

function buildReminders(
  appointments: Array<{ id: number; date: string; clientName: string | null; status: string }>,
  now: Date
): Reminder[] {
  const reminders: Reminder[] = [];

  // Filtrar apenas agendamentos ativos (não cancelados/concluídos)
  const active = appointments.filter(
    (a) => a.status !== "cancelado" && a.status !== "concluido"
  );

  // Agendamentos de hoje
  const todayAppts = active.filter((a) => {
    const d = parseDate(a.date);
    return (
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate()
    );
  });

  if (todayAppts.length > 0) {
    reminders.push({
      type: "today",
      icon: <CalendarCheck className="h-4 w-4" />,
      message:
        todayAppts.length === 1
          ? `Você tem 1 atendimento hoje`
          : `Você tem ${todayAppts.length} atendimentos hoje`,
      className:
        "bg-primary/8 border border-primary/20 text-primary",
    });
  }

  // Próximo agendamento futuro
  const upcoming = active
    .map((a) => ({ ...a, dateObj: parseDate(a.date) }))
    .filter((a) => a.dateObj > now)
    .sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime());

  if (upcoming.length > 0) {
    const next = upcoming[0];
    const diffMs = next.dateObj.getTime() - now.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);
    const diffMins = Math.round(diffMs / (1000 * 60));

    let timeLabel: string;
    if (diffMins < 60) {
      timeLabel = `em ${diffMins} minuto${diffMins !== 1 ? "s" : ""}`;
    } else if (diffHours < 24) {
      const h = Math.floor(diffHours);
      timeLabel = `em ${h} hora${h !== 1 ? "s" : ""}`;
    } else {
      const days = Math.ceil(diffHours / 24);
      timeLabel = `em ${days} dia${days !== 1 ? "s" : ""}`;
    }

    const isUrgent = diffHours <= 24;

    reminders.push({
      type: isUrgent ? "next24h" : "next",
      icon: <Clock className="h-4 w-4" />,
      message: `Próximo atendimento ${timeLabel}: ${next.clientName || "cliente"}`,
      className: isUrgent
        ? "bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400"
        : "bg-muted border border-border text-muted-foreground",
    });
  }

  // Agendamentos nas próximas 24h (excluindo o "próximo" já listado)
  const next24h = active.filter((a) => {
    const d = parseDate(a.date);
    const diffMs = d.getTime() - now.getTime();
    return diffMs > 0 && diffMs <= 24 * 60 * 60 * 1000;
  });

  if (next24h.length > 1) {
    reminders.push({
      type: "next24h",
      icon: <AlertCircle className="h-4 w-4" />,
      message: `${next24h.length} atendimento${next24h.length !== 1 ? "s" : ""} nas próximas 24h`,
      className:
        "bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400",
    });
  }

  if (reminders.length === 0) {
    reminders.push({
      type: "info",
      icon: <Bell className="h-4 w-4" />,
      message: "Nenhum atendimento próximo esta semana",
      className: "bg-muted border border-border text-muted-foreground",
    });
  }

  return reminders;
}

export default function RemindersWidget() {
  const { data, isLoading } = trpc.dashboard.weeklyAppointments.useQuery(undefined, {
    refetchInterval: 5 * 60 * 1000,
  });

  const now = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  const reminders = data ? buildReminders(data, now) : [];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <div>
          <CardTitle className="text-base font-semibold">Lembretes</CardTitle>
          <CardDescription>Gerados automaticamente pelos agendamentos</CardDescription>
        </div>
        <Bell className="h-5 w-5 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-10 w-full rounded-lg" />
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {reminders.map((r, i) => (
              <div
                key={i}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium ${r.className}`}
              >
                <span className="shrink-0">{r.icon}</span>
                <span>{r.message}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
