import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { toast } from "sonner";
import { formatMessageTimestamp } from "@shared/studioClock";
import { Bell } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";

export function InventoryNoticeIndicator() {
  const query = trpc.pod.inventory.notices.list.useQuery(undefined, {
    refetchInterval: 60000,
  });
  const [open, setOpen] = useState(false);
  const count = query.data?.filter(n => !n.readAt && !n.resolvedAt).length ?? 0;
  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="h-9 shrink-0 gap-1"
        onClick={() => setOpen(true)}
        aria-label={`Avisos de estoque: ${count} não lidos`}
      >
        <Bell className="h-4 w-4" />
        {count > 0 && (
          <span className="rounded-full bg-orange-500 px-1.5 text-xs font-bold text-white">
            {count}
          </span>
        )}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Avisos de materiais</DialogTitle>
          </DialogHeader>
          <InventoryNotices />
        </DialogContent>
      </Dialog>
    </>
  );
}

export default function InventoryNotices() {
  const notices = trpc.pod.inventory.notices.list.useQuery(undefined, {
    refetchInterval: 60000,
  });
  const preferences = trpc.pod.inventory.notices.preferences.useQuery();
  const [hours, setHours] = useState<string | null>(null);
  const [whatsapp, setWhatsapp] = useState<boolean | null>(null);
  const read = trpc.pod.inventory.notices.read.useMutation({
    onSuccess: () => {
      void notices.refetch();
    },
    onError: e => toast.error(e.message),
  });
  const save = trpc.pod.inventory.notices.savePreferences.useMutation({
    onSuccess: () => {
      void preferences.refetch();
      toast.success("Antecedência dos avisos atualizada.");
    },
    onError: e => toast.error(e.message),
  });
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">
          Avisos de estoque e empréstimos
        </h2>
        <p className="text-sm text-muted-foreground">
          O risco de falta é avisado assim que identificado. A previsão é
          conferida novamente antes da sessão.
        </p>
      </div>
      <form
        className="rounded-lg border p-4 space-y-2"
        onSubmit={e => {
          e.preventDefault();
          save.mutate({
            leadHours: Number(hours ?? preferences.data?.leadHours ?? 48),
            whatsappEnabled:
              whatsapp ?? preferences.data?.whatsappEnabled ?? false,
          });
        }}
      >
        <Label htmlFor="inventory-notice-hours">
          Antecedência da conferência{" "}
          {preferences.data?.scope === "studio"
            ? "padrão do estúdio"
            : "para suas sessões"}{" "}
          (horas)
        </Label>
        <label className="flex items-start gap-2 py-2 text-sm">
          <input
            type="checkbox"
            className="mt-1"
            checked={whatsapp ?? preferences.data?.whatsappEnabled ?? false}
            onChange={e => setWhatsapp(e.target.checked)}
          />
          <span>
            Ativar avisos de materiais pelo WhatsApp{" "}
            {preferences.data?.scope === "studio"
              ? "cadastrado do estúdio"
              : "do meu cadastro"}
            . Inclui avisos pendentes não lidos e os próximos avisos.
          </span>
        </label>
        <div className="flex flex-wrap gap-2">
          <Input
            id="inventory-notice-hours"
            className="w-28"
            required
            type="number"
            min={1}
            max={720}
            value={hours ?? String(preferences.data?.leadHours ?? 48)}
            onChange={e => setHours(e.target.value)}
          />
          <Button disabled={save.isPending || preferences.isLoading}>
            Salvar antecedência
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Os prazos de reposição dos empréstimos são definidos separadamente por
          quem empresta.
        </p>
        {preferences.error && <p role="alert">{preferences.error.message}</p>}
      </form>
      <p className="text-xs text-muted-foreground">
        Os avisos ficam registrados aqui. O envio por WhatsApp usa o telefone
        cadastrado e a integração de mensagens do estúdio.
      </p>
      {notices.isLoading && <p role="status">Carregando avisos…</p>}
      {notices.error && <p role="alert">{notices.error.message}</p>}
      {notices.data?.length === 0 && (
        <p className="rounded-lg border border-dashed p-5 text-muted-foreground">
          Nenhum aviso de estoque ou empréstimo.
        </p>
      )}
      {notices.data?.map(n => (
        <article
          key={n.id}
          className={`rounded-lg border p-4 space-y-2 ${n.resolvedAt ? "border-border bg-muted/20" : n.severity === "danger" ? "border-red-500/40 bg-red-500/5" : n.severity === "warning" ? "border-amber-500/40 bg-amber-500/5" : "border-border"}`}
        >
          <div className="flex flex-wrap items-start justify-between gap-2">
            <h3 className="font-semibold">
              {!n.readAt && (
                <span className="mr-2 text-xs text-primary">Novo</span>
              )}
              {n.title}
            </h3>
            {!n.readAt && (
              <Button
                size="sm"
                variant="ghost"
                disabled={read.isPending}
                onClick={() => read.mutate({ id: n.id })}
              >
                Marcar como lido
              </Button>
            )}
          </div>
          <p className="text-sm break-words">{n.message}</p>
          <p className="text-xs text-muted-foreground">
            {formatMessageTimestamp(n.createdAt)}
            {n.recipientArtistId == null
              ? " · aviso do estúdio"
              : " · aviso do artista"}
            {n.resolvedAt ? " · resolvido / atualizado" : ""}
          </p>
          <p className="text-xs text-muted-foreground">
            {n.resolvedAt
              ? "Histórico preservado."
              : n.deliveryStatus === "internal"
                ? "Disponível no sistema · WhatsApp desativado para este destinatário."
                : n.deliveryStatus === "delivered"
                  ? "WhatsApp: enviado."
                  : n.deliveryStatus === "failed"
                    ? `WhatsApp não enviado: ${n.lastError ?? "falha no envio"}`
                    : n.deliveryStatus === "queued"
                      ? "WhatsApp: encaminhado à fila de mensagens."
                      : n.lastError
                        ? `WhatsApp pendente: ${n.lastError}`
                        : "WhatsApp: aguardando envio."}
          </p>
        </article>
      ))}
    </section>
  );
}
