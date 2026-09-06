import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";

const STATUS_LABELS: Record<string, { label: string; emoji: string; color: string }> = {
  confirmado: { label: "Confirmado", emoji: "✅", color: "text-green-600" },
  nao_confirmado: { label: "Não confirmado", emoji: "❌", color: "text-red-600" },
  atraso: { label: "Atraso", emoji: "⏰", color: "text-yellow-600" },
  chegada_antecipada: { label: "Chegada antecipada", emoji: "🏃", color: "text-blue-600" },
  confirmed: { label: "Presença confirmada", emoji: "✅", color: "text-green-600" },
  early: { label: "Adiantamento informado", emoji: "🏃", color: "text-blue-600" },
  late: { label: "Atraso avisado", emoji: "⏰", color: "text-yellow-600" },
  reschedule_requested: { label: "Remarcação solicitada", emoji: "📅", color: "text-orange-600" },
};

export default function ConfirmAppointment() {
  const params = new URLSearchParams(window.location.search);
  const id = parseInt(params.get("id") || "0");
  const token = params.get("token") || "";
  const status = params.get("status") || "";
  const requestedAction = params.get("action") || "";

  const [done, setDone] = useState(false);
  const [completedAction, setCompletedAction] = useState("");
  const [error, setError] = useState("");

  const confirm = trpc.appointments.confirm.useMutation({
    onSuccess: () => { setCompletedAction(status); setDone(true); },
    onError: (err) => setError(err.message),
  });
  const consumeActionLink = trpc.appointments.consumeActionLink.useMutation({
    onSuccess: (result) => { setCompletedAction(result.action); setDone(true); },
    onError: (err) => setError(err.message),
  });

  useEffect(() => {
    if (id && token && status && !done && !error) {
      const validStatuses = ["confirmado", "nao_confirmado", "atraso", "chegada_antecipada"];
      if (!validStatuses.includes(status)) {
        setError("Status inválido.");
        return;
      }
      confirm.mutate({ id, token, status: status as any });
    }
  }, []);

  const info = STATUS_LABELS[completedAction || status];
  const requestedInfo = STATUS_LABELS[requestedAction];

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="max-w-md w-full rounded-2xl border bg-card p-8 shadow-lg text-center space-y-4">
        {/* Logo / título */}
        <div className="text-4xl mb-2">🎨</div>
        <h1 className="text-2xl font-bold">Confirmação de Agendamento</h1>

        {(confirm.isPending || consumeActionLink.isPending) && (
          <div className="space-y-2">
            <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-muted-foreground">Registrando sua resposta...</p>
          </div>
        )}

        {done && info && (
          <div className="space-y-3">
            <div className="text-5xl">{info.emoji}</div>
            <p className={`text-xl font-semibold ${info.color}`}>{info.label}</p>
            <p className="text-muted-foreground text-sm">
              Sua resposta foi registrada com sucesso. O estúdio já foi notificado.
            </p>
          </div>
        )}

        {error && (
          <div className="space-y-2">
            <div className="text-4xl">⚠️</div>
            <p className="text-red-600 font-semibold">Erro ao registrar resposta</p>
            <p className="text-muted-foreground text-sm">{error}</p>
          </div>
        )}

        {!done && !error && !consumeActionLink.isPending && token && !status && requestedInfo && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Você está prestes a registrar: <strong>{requestedInfo.label}</strong>.</p>
            <button
              type="button"
              onClick={() => consumeActionLink.mutate({ token })}
              className="w-full rounded-lg bg-primary px-4 py-3 font-semibold text-primary-foreground transition-opacity hover:opacity-90"
            >
              {requestedInfo.emoji} Confirmar esta ação
            </button>
            <p className="text-xs text-muted-foreground">O estúdio será avisado assim que você confirmar.</p>
          </div>
        )}

        {!token || (!status && !requestedInfo && !done && !error) ? (
          <p className="text-muted-foreground text-sm">Link inválido ou incompleto.</p>
        ) : null}
      </div>
    </div>
  );
}
