import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
export function CalendarConnections({
  calendars,
}: {
  calendars: { id: number; name: string }[];
}) {
  const utils = trpc.useUtils(),
    status = trpc.calendarSync.status.useQuery(undefined, {
      refetchInterval: 30000,
    });
  const [calendarId, setCalendarId] = useState(0),
    [apple, setApple] = useState({ username: "", password: "" });
  const [choices, setChoices] = useState<Record<number, string>>({});
  const refresh = () => {
    utils.calendarSync.status.invalidate();
    utils.commitments.list.invalidate();
    utils.appointments.list.invalidate();
  };
  const google = trpc.calendarSync.googleStart.useMutation({
    onSuccess: r => window.location.assign(r.url),
    onError: e => toast.error(e.message),
  });
  const connect = trpc.calendarSync.appleConnect.useMutation({
    onSuccess: () => {
      setApple({ ...apple, password: "" });
      refresh();
      toast.success("Conta conectada. Escolha o calendário externo.");
    },
    onError: e => toast.error(e.message),
  });
  const select = trpc.calendarSync.select.useMutation({
    onSuccess: () => {
      refresh();
      toast.success("Sincronização ativada para este calendário.");
    },
    onError: e => toast.error(e.message),
  });
  const sync = trpc.calendarSync.sync.useMutation({
    onSuccess: () => {
      refresh();
      toast.success(
        "Lote de sincronização processado. Confira possíveis conflitos."
      );
    },
    onError: e => toast.error(e.message),
  });
  const resolve = trpc.calendarSync.resolve.useMutation({
    onSuccess: () => {
      refresh();
      toast.success("Escolha processada. Confira o estado do evento.");
    },
    onError: e => toast.error(e.message),
  });
  const disconnect = trpc.calendarSync.disconnect.useMutation({
    onSuccess: () => {
      refresh();
      toast.success("Conexão removida. Os eventos externos foram preservados.");
    },
    onError: e => toast.error(e.message),
  });
  return (
    <div className="space-y-4 [overflow-wrap:anywhere]">
      <h3 className="font-semibold">Google Agenda e iCloud</h3>
      <p className="text-sm">
        Cada conexão pertence à sua conta e a um calendário seu. Somente sessões
        e compromissos vinculados a esse calendário são sincronizados.
        Alterações externas não enviam avisos WhatsApp sem uma confirmação no
        CRM.
      </p>
      <label className="block">
        Calendário do CRM
        <select
          className="block w-full rounded border bg-background p-2"
          value={calendarId || calendars[0]?.id || ""}
          onChange={e => setCalendarId(Number(e.target.value))}
        >
          {calendars.map(c => (
            <option value={c.id} key={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      {status.error && (
        <p role="alert">Não foi possível carregar as conexões.</p>
      )}
      <Button
        disabled={
          !status.data?.googleConfigured ||
          google.isPending ||
          !calendars.length
        }
        onClick={() =>
          google.mutate({ calendarId: calendarId || calendars[0].id })
        }
      >
        Conectar Google Agenda
      </Button>
      {status.data && !status.data.googleConfigured && (
        <p className="text-sm">
          Google aguarda configuração do aplicativo OAuth no servidor.
          Redirecionamento para configurar: {status.data.googleCallback}
        </p>
      )}
      <details className="rounded border p-3">
        <summary>Conectar iCloud</summary>
        <form
          className="space-y-3 mt-3"
          onSubmit={e => {
            e.preventDefault();
            connect.mutate({
              calendarId: calendarId || calendars[0].id,
              ...apple,
            });
          }}
        >
          <label className="block">
            Apple ID
            <Input
              type="email"
              value={apple.username}
              onChange={e => setApple({ ...apple, username: e.target.value })}
            />
          </label>
          <label className="block">
            Senha específica de aplicativo
            <Input
              type="password"
              autoComplete="new-password"
              value={apple.password}
              onChange={e => setApple({ ...apple, password: e.target.value })}
            />
          </label>
          <p className="text-sm">
            Crie uma senha específica de aplicativo na sua conta Apple. A senha
            principal do Apple ID não deve ser usada aqui. A credencial será
            armazenada com criptografia no servidor.
          </p>
          <Button disabled={connect.isPending || !calendars.length}>
            Conectar conta iCloud
          </Button>
        </form>
      </details>
      <p className="text-sm">
        Atualizações são consultadas periodicamente em lotes. Datas são
        interpretadas no fuso da conexão (padrão Brasília). Nenhum evento
        externo é excluído ao desconectar.
      </p>
      {status.data?.connections.map((c: any) => (
        <section key={c.id} className="rounded border p-3 space-y-2">
          <h4>
            {c.provider === "google" ? "Google Agenda" : "iCloud"} ·{" "}
            {calendars.find(x => x.id === c.calendarId)?.name ||
              "Meu calendário"}
          </h4>
          <p>
            {c.status === "connected"
              ? "Conectado"
              : c.status === "select"
                ? "Escolha um calendário externo"
                : "Requer atenção"}
            {c.lastSync ? " · Último lote: " + c.lastSync + " UTC" : ""}
          </p>
          {c.lastError && <p role="alert">{c.lastError}</p>}
          {c.status === "select" && (
            <>
              <select
                aria-label="Calendário externo"
                className="block w-full min-w-0 rounded border bg-background p-2"
                value={choices[c.id] || ""}
                onChange={e =>
                  setChoices({ ...choices, [c.id]: e.target.value })
                }
              >
                <option value="">Selecione o calendário</option>
                {c.choices.map((choice: any) => (
                  <option key={choice.id} value={choice.id}>
                    {choice.name}
                  </option>
                ))}
              </select>
              <Button
                disabled={!choices[c.id] || select.isPending}
                onClick={() =>
                  select.mutate({ id: c.id, remoteId: choices[c.id] })
                }
              >
                Ativar sincronização
              </Button>
            </>
          )}
          <div className="flex flex-wrap gap-2">
            {c.status !== "select" && (
              <Button
                variant="outline"
                disabled={sync.isPending}
                onClick={() => sync.mutate({ id: c.id })}
              >
                Sincronizar agora
              </Button>
            )}
            <Button
              variant="outline"
              disabled={disconnect.isPending}
              onClick={() => {
                if (
                  confirm(
                    "Desconectar esta conta? Os eventos externos serão mantidos."
                  )
                )
                  disconnect.mutate({ id: c.id });
              }}
            >
              Desconectar
            </Button>
          </div>
        </section>
      ))}
      {status.data?.conflicts.map((c: any) => (
        <section
          key={c.id}
          className="rounded border border-orange-500 p-3 space-y-2"
        >
          <h4>{c.title || "Evento requer revisão"}</h4>
          <p>{c.reason}</p>
          <p>
            CRM: {c.local}
            {c.remote ? " · Externo: " + c.remote : ""}
          </p>
          {c.version !== "unreadable" && (
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                disabled={resolve.isPending}
                onClick={() =>
                  resolve.mutate({
                    linkId: c.id,
                    choice: "local",
                    version: c.version,
                  })
                }
              >
                Manter data do CRM
              </Button>
              {c.remote && (
                <Button
                  variant="outline"
                  disabled={resolve.isPending}
                  onClick={() =>
                    resolve.mutate({
                      linkId: c.id,
                      choice: "remote",
                      version: c.version,
                    })
                  }
                >
                  Usar data externa
                </Button>
              )}
            </div>
          )}
        </section>
      ))}
    </div>
  );
}
