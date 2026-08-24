import { useState } from "react";
import { trpc } from "@/lib/trpc";

const OPTIONS = [
  { status: "confirmado", label: "Confirmo o horário", emoji: "✅", classes: "border-green-500/40 hover:bg-green-500/10" },
  { status: "atraso", label: "Vou atrasar", emoji: "⏰", classes: "border-yellow-500/40 hover:bg-yellow-500/10" },
  { status: "nao_confirmado", label: "Não vou conseguir comparecer", emoji: "❌", classes: "border-red-500/40 hover:bg-red-500/10" },
  { status: "reagendar", label: "Preciso reagendar", emoji: "🔄", classes: "border-blue-500/40 hover:bg-blue-500/10" },
] as const;

type ResponseStatus = typeof OPTIONS[number]["status"];

function formatAppointmentDate(value: string) {
  const normalized = value.includes("T") ? value : value.replace(" ", "T");
  return new Date(normalized).toLocaleString("pt-BR", {
    weekday: "long", day: "2-digit", month: "long", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export default function ConfirmAppointment() {
  const params = new URLSearchParams(window.location.search);
  const id = Number(params.get("id") || 0);
  const token = params.get("token") || "";
  const [selected, setSelected] = useState<ResponseStatus | null>(null);
  const [showDelaySelector, setShowDelaySelector] = useState(false);
  const [delayMinutes, setDelayMinutes] = useState(15);

  const details = trpc.appointments.getConfirmationDetails.useQuery(
    { id, token },
    { enabled: id > 0 && token.length > 0, retry: false },
  );
  const respond = trpc.appointments.confirm.useMutation({
    onSuccess: (_result, variables) => setSelected(variables.status),
  });

  const selectedOption = OPTIONS.find((option) => option.status === selected);
  const invalidLink = !id || !token;
  const errorMessage = respond.error?.message || details.error?.message;

  return (
    <main className="min-h-screen flex items-center justify-center bg-background p-4">
      <section className="max-w-lg w-full rounded-2xl border bg-card p-6 sm:p-8 shadow-xl space-y-6">
        <header className="text-center space-y-2">
          <div className="text-4xl">🎨</div>
          <h1 className="text-2xl font-bold">Confirmação de agendamento</h1>
          <p className="text-sm text-muted-foreground">Escolha uma opção. Sua resposta será enviada ao estúdio e ao artista.</p>
        </header>

        {details.isLoading && (
          <div className="py-10 text-center space-y-3">
            <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-sm text-muted-foreground">Carregando seu agendamento...</p>
          </div>
        )}

        {details.data && !selected && (
          <>
            <div className="rounded-xl bg-muted/50 border p-4 space-y-2">
              <p className="font-semibold">Olá, {details.data.clientName}!</p>
              <p className="text-sm"><span className="text-muted-foreground">Data:</span> {formatAppointmentDate(details.data.date)}</p>
              <p className="text-sm"><span className="text-muted-foreground">Procedimento:</span> {details.data.service}</p>
              <p className="text-sm"><span className="text-muted-foreground">Artista:</span> {details.data.artist}</p>
            </div>

            <div className="grid gap-3">
              {OPTIONS.map((option) => (
                <button
                  key={option.status}
                  type="button"
                  disabled={respond.isPending}
                  onClick={() => {
                    if (option.status === "atraso") setShowDelaySelector(true);
                    else respond.mutate({ id, token, status: option.status });
                  }}
                  className={`w-full min-h-14 rounded-xl border px-4 py-3 flex items-center gap-3 text-left font-medium transition-colors disabled:opacity-50 ${option.classes}`}
                >
                  <span className="text-2xl" aria-hidden>{option.emoji}</span>
                  <span>{option.label}</span>
                </button>
              ))}
            </div>

            {showDelaySelector && (
              <div className="rounded-xl border border-yellow-500/40 bg-yellow-500/5 p-4 space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold">Tempo aproximado de atraso</p>
                    <p className="text-xs text-muted-foreground">Arraste a barra para informar o artista.</p>
                  </div>
                  <span className="text-xl font-bold text-yellow-500 whitespace-nowrap">{delayMinutes} min</span>
                </div>
                <input
                  aria-label="Tempo aproximado de atraso"
                  type="range"
                  min="5"
                  max="120"
                  step="5"
                  value={delayMinutes}
                  onChange={(event) => setDelayMinutes(Number(event.target.value))}
                  className="w-full accent-yellow-500"
                />
                <div className="flex justify-between text-[11px] text-muted-foreground"><span>5 min</span><span>2 horas</span></div>
                <button
                  type="button"
                  disabled={respond.isPending}
                  onClick={() => respond.mutate({ id, token, status: "atraso", delayMinutes })}
                  className="w-full rounded-lg bg-yellow-500 px-4 py-3 font-semibold text-black hover:bg-yellow-400 disabled:opacity-50"
                >
                  Confirmar atraso de {delayMinutes} minutos
                </button>
              </div>
            )}
          </>
        )}

        {respond.isPending && <p className="text-center text-sm text-muted-foreground">Registrando sua resposta...</p>}

        {selectedOption && (
          <div className="text-center py-6 space-y-3">
            <div className="text-6xl">{selectedOption.emoji}</div>
            <h2 className="text-xl font-semibold">Resposta enviada</h2>
            <p className="font-medium">{selectedOption.label}</p>
            {selected === "atraso" && <p className="text-sm font-medium">Atraso informado: aproximadamente {delayMinutes} minutos.</p>}
            <p className="text-sm text-muted-foreground">O estúdio e o artista já podem visualizar sua resposta.</p>
          </div>
        )}

        {(invalidLink || errorMessage) && !selected && (
          <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-center space-y-2">
            <div className="text-3xl">⚠️</div>
            <p className="font-semibold text-red-500">Não foi possível abrir o agendamento</p>
            <p className="text-sm text-muted-foreground">{errorMessage || "O link está incompleto. Solicite um novo link ao estúdio."}</p>
          </div>
        )}
      </section>
    </main>
  );
}
