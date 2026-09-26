import { useEffect, useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { toast } from "sonner";
import {
  consentActive,
  consentTags,
  matchesConsent,
} from "@shared/consentSearch";
export function ClientConsentButton({
  clientId,
  name,
}: {
  clientId: number;
  name: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <span onClick={e => e.stopPropagation()}>
      <Button
        size="sm"
        variant="outline"
        aria-label={`Autorização de mensagens de ${name}`}
        onClick={() => setOpen(true)}
      >
        Mensagens
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Autorização de mensagens · {name}</DialogTitle>
          </DialogHeader>
          {open && <WhatsappConsentPanel clientId={clientId} />}
        </DialogContent>
      </Dialog>
    </span>
  );
}
export default function WhatsappConsentPanel({
  clientId,
}: {
  clientId?: number;
}) {
  const { user } = useAuth();
  const manager = user?.role === "admin" || user?.role === "superadmin";
  const utils = trpc.useUtils();
  const integrations = trpc.messaging.listIntegrations.useQuery();
  const [integrationId, setIntegrationId] = useState(""),
    [search, setSearch] = useState(""),
    [tag, setTag] = useState(""),
    [status, setStatus] = useState(clientId ? "all" : "pending"),
    [selected, setSelected] = useState<number[]>([]),
    [page, setPage] = useState(0),
    [running, setRunning] = useState(false),
    [progress, setProgress] = useState("");
  const lock = useRef(false);
  const [errors, setErrors] = useState<Record<number, string>>({});
  const active = integrationId
    ? Number(integrationId)
    : integrations.data?.[0]?.id;
  const contacts = trpc.messaging.listWhatsappConsents.useQuery(
    { integrationId: active || 0, clientId },
    { enabled: !!active }
  );
  const mutation = trpc.messaging.setWhatsappConsent.useMutation();
  useEffect(() => {
    setSelected([]);
    setPage(0);
  }, [active, search, tag, status]);
  const all = Array.from(
    new Map((contacts.data || []).map(c => [c.clientId, c])).values()
  );
  const tags = Array.from(
    new Set(all.flatMap(c => consentTags(c.tags)))
  ).sort();
  const filtered = all.filter(
    c =>
      matchesConsent(c, search, tag) &&
      (status === "all" ||
        (status === "pending" ? !consentActive(c) : consentActive(c)))
  );
  const eligible = filtered.filter(c => c.phone && !consentActive(c));
  async function save(ids: number[], enabled: boolean) {
    if (!active || lock.current || !ids.length) return;
    if (
      !window.confirm(
        enabled
          ? `Registrar autorização para ${ids.length} cliente(s)? Confirme somente se todos já autorizaram receber mensagens. Nenhuma mensagem será enviada.`
          : "Revogar a autorização deste cliente?"
      )
    )
      return;
    lock.current = true;
    setRunning(true);
    setErrors({});
    const failed: number[] = [];
    let success = 0;
    try {
      for (const id of ids) {
        try {
          await mutation.mutateAsync({
            integrationId: active,
            clientId: id,
            hasWhatsappOptIn: enabled,
            source: clientId
              ? "painel_do_cliente"
              : "central_consentimentos_lote",
          });
          success++;
        } catch (e) {
          failed.push(id);
          setErrors(old => ({ ...old, [id]: (e as Error).message }));
        }
        setProgress(`${success} atualizados · ${failed.length} falhas`);
      }
      setSelected(failed);
      await utils.messaging.listWhatsappConsents.invalidate();
      if (failed.length)
        toast.error(
          `${failed.length} cliente(s) não atualizados. Os demais foram salvos; tente novamente os que falharam.`
        );
      else
        toast.success(
          "Autorizações atualizadas. Nenhuma mensagem foi enviada."
        );
    } finally {
      setRunning(false);
      lock.current = false;
    }
  }
  const input = "w-full rounded border bg-background p-2 text-base min-h-11";
  return (
    <section className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Registre a autorização já fornecida pelo cliente. O consentimento vale
        para a conexão selecionada e pode ser revogado aqui.
      </p>
      {integrations.isLoading && <p>Carregando conexões…</p>}
      {integrations.error && <p role="alert">{integrations.error.message}</p>}
      {integrations.data?.length === 0 && (
        <p>Cadastre uma conexão de WhatsApp na central de mensagens.</p>
      )}
      {!!integrations.data?.length && (
        <>
          <label className="block text-sm">
            Conexão de WhatsApp
            <select
              className={input}
              value={active}
              disabled={running}
              onChange={e => setIntegrationId(e.target.value)}
            >
              {integrations.data.map(i => (
                <option key={i.id} value={i.id}>
                  {i.name}
                </option>
              ))}
            </select>
          </label>
          {!clientId && (
            <div className="grid gap-2 sm:grid-cols-3">
              <label>
                Buscar nome, telefone ou etiqueta
                <input
                  className={input}
                  value={search}
                  disabled={running}
                  onChange={e => setSearch(e.target.value)}
                />
              </label>
              <label>
                Etiqueta
                <select
                  className={input}
                  value={tag}
                  disabled={running}
                  onChange={e => setTag(e.target.value)}
                >
                  <option value="">Todas as etiquetas</option>
                  {tags.map(t => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </label>
              <label>
                Autorização
                <select
                  className={input}
                  value={status}
                  disabled={running}
                  onChange={e => setStatus(e.target.value)}
                >
                  <option value="pending">Sem consentimento</option>
                  <option value="active">Autorizados</option>
                  <option value="all">Todos</option>
                </select>
              </label>
            </div>
          )}
          {!manager && (
            <p>Somente administradores podem alterar autorizações.</p>
          )}
          {contacts.isLoading && <p>Carregando clientes…</p>}
          {contacts.error && <p role="alert">{contacts.error.message}</p>}
          {!clientId && manager && (
            <div className="flex flex-wrap gap-2 items-center">
              <Button
                variant="outline"
                disabled={running || !eligible.length}
                onClick={() => setSelected(eligible.map(c => c.clientId))}
              >
                Selecionar todos os {eligible.length} sem consentimento
                filtrados
              </Button>
              <Button
                variant="ghost"
                disabled={running || !selected.length}
                onClick={() => setSelected([])}
              >
                Limpar seleção
              </Button>
              <Button
                disabled={running || !selected.length}
                onClick={() => void save(selected, true)}
              >
                Registrar autorização ({selected.length})
              </Button>
            </div>
          )}
          <p className="text-sm">{filtered.length} cliente(s) encontrado(s)</p>
          {filtered.slice(page * 100, page * 100 + 100).map(c => (
            <article
              key={c.clientId}
              className="rounded border p-3 flex flex-wrap items-center gap-3"
            >
              {!clientId && manager && (
                <input
                  type="checkbox"
                  aria-label={`Selecionar ${c.clientName} #${c.clientId}`}
                  checked={selected.includes(c.clientId)}
                  disabled={running || !c.phone || consentActive(c)}
                  onChange={e =>
                    setSelected(ids =>
                      e.target.checked
                        ? [...ids, c.clientId]
                        : ids.filter(id => id !== c.clientId)
                    )
                  }
                />
              )}
              <div className="flex-1 min-w-0">
                <p className="font-medium break-words">{c.clientName}</p>
                <p className="text-sm text-muted-foreground">
                  {c.phone || "Sem telefone"} ·{" "}
                  {consentActive(c)
                    ? "Autorizado"
                    : c.optedOutAt
                      ? "Autorização revogada"
                      : "Sem consentimento"}
                </p>
                {consentTags(c.tags).length > 0 && (
                  <p className="text-xs">{consentTags(c.tags).join(" · ")}</p>
                )}
                {c.optInSource && (
                  <p className="text-xs text-muted-foreground">
                    Registro: {c.optInSource} ·{" "}
                    {c.optInAt || "data não informada"}
                  </p>
                )}
              </div>
              {errors[c.clientId] && (
                <p role="alert" className="text-sm text-red-500">
                  {errors[c.clientId]}
                </p>
              )}
              <Button
                variant="outline"
                disabled={!manager || running || !c.phone}
                onClick={() => void save([c.clientId], !consentActive(c))}
              >
                {consentActive(c)
                  ? "Revogar autorização"
                  : "Autorizar mensagens"}
              </Button>
            </article>
          ))}
          {filtered.length > 100 && (
            <div className="flex gap-2">
              <Button
                disabled={running || page === 0}
                onClick={() => setPage(p => p - 1)}
              >
                Anterior
              </Button>
              <span>
                Página {page + 1} de {Math.ceil(filtered.length / 100)}
              </span>
              <Button
                disabled={running || (page + 1) * 100 >= filtered.length}
                onClick={() => setPage(p => p + 1)}
              >
                Próxima
              </Button>
            </div>
          )}
          <p role="status">{progress}</p>
        </>
      )}
    </section>
  );
}
