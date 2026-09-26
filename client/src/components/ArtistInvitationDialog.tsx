import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { ARTIST_ACCESS_LABELS, type ArtistPermission } from "@shared/artistInvitations";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "./ui/dialog";
import { toast } from "sonner";

export default function ArtistInvitationDialog({ artistId, name }: { artistId: number; name: string }) {
  const [open, setOpen] = useState(false);
  const [permissions, setPermissions] = useState<ArtistPermission[]>(
    Object.keys(ARTIST_ACCESS_LABELS).map((module) => ({
      module: module as ArtistPermission["module"],
      canRead: false,
      canWrite: false,
    })),
  );
  const [link, setLink] = useState("");
  const list = trpc.artistInvitations.list.useQuery({ artistId }, { enabled: open });

  const issue = trpc.artistInvitations.issue.useMutation({
    onSuccess: (data) => {
      setLink(data.inviteUrl || `${window.location.origin}/convite-artista/${data.token}`);
      void list.refetch();

      if (data.delivery.status === "sent") {
        toast.success("Convite criado e enviado automaticamente pelo BotConversa.");
      } else if (data.delivery.status === "not_configured") {
        toast.warning("Convite criado. O BotConversa não está ativo neste estúdio; use o link disponível abaixo.");
      } else if (data.delivery.status === "unknown") {
        toast.warning("Convite criado. O BotConversa recebeu a tentativa, mas a entrega não pôde ser confirmada.");
      } else {
        toast.warning(`Convite criado, mas o envio automático não foi concluído: ${data.delivery.error}`);
      }
    },
    onError: (e) => toast.error(e.message),
  });

  const revoke = trpc.artistInvitations.revoke.useMutation({
    onSuccess: () => {
      setLink("");
      void list.refetch();
      toast.success("Convite revogado.");
    },
    onError: (e) => toast.error(e.message),
  });

  const change = (module: string, field: "canRead" | "canWrite", value: boolean) => {
    setLink("");
    setPermissions((old) =>
      old.map((p) =>
        p.module !== module
          ? p
          : {
              ...p,
              [field]: value,
              ...(field === "canWrite" && value ? { canRead: true } : {}),
              ...(field === "canRead" && !value ? { canWrite: false } : {}),
            },
      ),
    );
  };

  const phone = issue.data?.phone.replace(/\D/g, "") ?? "";
  const international = phone.length === 10 || phone.length === 11 ? `55${phone}` : phone;
  const manualMessage = link
    ? `Olá, ${name.split(" ")[0]}! Crie sua conta de artista no nosso estúdio pelo link: ${link}\nO link é pessoal e vale por 7 dias.`
    : "";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" onClick={(e) => e.stopPropagation()}>
          Convidar artista
        </Button>
      </DialogTrigger>

      <DialogContent onClick={(e) => e.stopPropagation()} className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Acesso de {name}</DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">
          Salve o nome, e-mail e WhatsApp no cadastro do artista. Escolha o acesso abaixo e clique em gerar.
          O Tatuei cria o link e tenta enviá-lo automaticamente pela integração BotConversa ativa deste estúdio.
          O acesso será de colaborador, limitado a este estúdio.
        </p>

        <div className="space-y-3">
          {permissions.map((p) => (
            <div key={p.module} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3">
              <span className="text-sm flex-1 min-w-36">{ARTIST_ACCESS_LABELS[p.module]}</span>
              <div className="flex gap-4 text-sm">
                <label className="flex gap-2 items-center">
                  <input
                    type="checkbox"
                    checked={p.canRead}
                    onChange={(e) => change(p.module, "canRead", e.target.checked)}
                  />
                  Ver
                </label>
                <label className="flex gap-2 items-center">
                  <input
                    type="checkbox"
                    checked={p.canWrite}
                    onChange={(e) => change(p.module, "canWrite", e.target.checked)}
                  />
                  Editar
                </label>
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-1 text-xs text-muted-foreground">
          <p>
            <strong>Agenda e calendário:</strong> mesmo com acesso para ver ou editar, o artista convidado acessa somente
            os próprios agendamentos. A agenda dos demais artistas continua privada.
          </p>
          <p>
            Sem permissões selecionadas, terá apenas o próprio perfil e cartão. A Central Inteligente permanece inativa.
            O convite vale por 7 dias; a conta não expira ao final desse prazo. Gerar outro convite revoga o anterior.
          </p>
        </div>

        <Button disabled={issue.isPending} onClick={() => issue.mutate({ artistId, permissions })}>
          {issue.isPending ? "Gerando e enviando…" : "Gerar e enviar convite"}
        </Button>

        {link && (
          <div className="space-y-3 rounded-md border p-3">
            <label className="text-sm">
              Link pessoal do artista
              <input
                readOnly
                value={link}
                className="mt-2 w-full rounded border bg-background p-2 text-sm"
                onFocus={(e) => e.target.select()}
              />
            </label>

            <p className="text-xs">Válido até {new Date(issue.data!.expiresAt).toLocaleString("pt-BR")}.</p>

            {issue.data?.delivery.status === "sent" ? (
              <p className="text-xs text-muted-foreground">
                Envio automático aceito pelo BotConversa para o WhatsApp cadastrado da artista.
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                O link continua válido. Se o envio automático não ocorrer, use uma das opções manuais abaixo.
              </p>
            )}

            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(link);
                    toast.success("Link copiado.");
                  } catch {
                    toast.error("Selecione o link e copie manualmente.");
                  }
                }}
              >
                Copiar link
              </Button>

              <Button variant="outline" asChild>
                <a
                  href={`https://wa.me/${international}?text=${encodeURIComponent(manualMessage)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Abrir manualmente no WhatsApp
                </a>
              </Button>
            </div>
          </div>
        )}

        {!!list.data?.length && (
          <div className="space-y-2">
            <h3 className="font-medium">Últimos convites</h3>
            {list.data.map((i) => (
              <div className="flex flex-wrap justify-between gap-2 text-sm border-t py-2" key={i.id}>
                <span className="break-all">
                  {i.email} —{" "}
                  {({ pending: "Pendente", accepted: "Aceito", revoked: "Revogado", expired: "Expirado" } as const)[i.status]}
                </span>
                {i.status === "pending" && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={revoke.isPending}
                    onClick={() => revoke.mutate({ id: i.id })}
                  >
                    Revogar
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
