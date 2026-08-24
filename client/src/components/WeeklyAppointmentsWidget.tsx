import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { CalendarDays } from "lucide-react";

const STATUS_LABELS: Record<string, string> = {
  agendado: "Agendado",
  confirmado: "Confirmado",
  concluido: "Concluído",
  cancelado: "Cancelado",
  reagendado: "Reagendado",
};

const STATUS_CLASSES: Record<string, string> = {
  agendado: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  confirmado: "bg-green-500/10 text-green-600 border-green-500/20",
  concluido: "bg-gray-400/10 text-gray-500 border-gray-400/20",
  cancelado: "bg-red-500/10 text-red-600 border-red-500/20",
  reagendado: "bg-amber-500/10 text-amber-600 border-amber-500/20",
};

function isSameLocalDay(dateStr: string, ref: Date): boolean {
  // dateStr vem como "YYYY-MM-DD HH:MM:SS" do MySQL
  const d = new Date(dateStr.replace(" ", "T"));
  return (
    d.getFullYear() === ref.getFullYear() &&
    d.getMonth() === ref.getMonth() &&
    d.getDate() === ref.getDate()
  );
}

function formatAppointmentDate(dateStr: string): string {
  const d = new Date(dateStr.replace(" ", "T"));
  return d.toLocaleDateString("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
  });
}

function formatAppointmentTime(dateStr: string): string {
  const d = new Date(dateStr.replace(" ", "T"));
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export default function WeeklyAppointmentsWidget() {
  const { data, isLoading } = trpc.dashboard.weeklyAppointments.useQuery(undefined, {
    refetchInterval: 5 * 60 * 1000, // revalida a cada 5 min
  });

  // Hoje em horário local
  const today = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <div>
          <CardTitle className="text-base font-semibold">Agenda da Semana</CardTitle>
          <CardDescription>Segunda a domingo — horário de Brasília</CardDescription>
        </div>
        <CalendarDays className="h-5 w-5 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-lg" />
                <div className="flex-1 space-y-1">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-20" />
                </div>
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
            ))}
          </div>
        ) : data && data.length > 0 ? (
          <div className="space-y-2">
            {data.map((appt) => {
              const isToday = isSameLocalDay(appt.date, today);
              return (
                <div
                  key={appt.id}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors ${
                    isToday
                      ? "bg-primary/8 border border-primary/20"
                      : "hover:bg-accent/40"
                  }`}
                >
                  {/* Bloco de data/hora */}
                  <div
                    className={`flex flex-col items-center justify-center h-10 w-12 rounded-lg shrink-0 text-center ${
                      isToday
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    <span className="text-[10px] font-medium leading-none uppercase">
                      {formatAppointmentDate(appt.date).split(",")[0]}
                    </span>
                    <span className="text-xs font-bold leading-tight">
                      {formatAppointmentTime(appt.date)}
                    </span>
                  </div>

                  {/* Informações */}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">
                      {appt.clientName || "Cliente sem nome"}
                      {isToday && (
                        <span className="ml-1.5 text-[10px] font-semibold text-primary uppercase tracking-wide">
                          hoje
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {appt.service}
                      {appt.artist ? ` · ${appt.artist}` : ""}
                    </p>
                  </div>

                  {/* Status */}
                  <Badge
                    variant="outline"
                    className={`text-[10px] shrink-0 ${STATUS_CLASSES[appt.status] || ""}`}
                  >
                    {STATUS_LABELS[appt.status] || appt.status}
                  </Badge>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground gap-2">
            <CalendarDays className="h-8 w-8 opacity-30" />
            <p className="text-sm">Nenhum agendamento nesta semana</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
