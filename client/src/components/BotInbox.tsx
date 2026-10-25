import { useEffect, useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  MessageSquare,
  Send,
  Paperclip,
  Pause,
  Play,
  CheckCheck,
  Search,
  Bot,
  X,
  ArrowLeft,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { MAX_ATTACHMENT_BYTES, type attachmentSchema } from "@shared/botInbox";
import type { z } from "zod";
import "./BotInbox.css";

const error = (e: { message: string }) => toast.error(e.message);
const date = (s?: string | null) =>
  s
    ? new Date(
        /(?:Z|[+-]\d{2}:\d{2})$/.test(s) ? s : s.replace(" ", "T") + "Z"
      ).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })
    : "";
const statuses: Record<string, string> = {
  queued: "Na fila",
  sending: "Enviando",
  sent: "Enviada",
  delivered: "Entregue",
  read: "Lida",
  failed: "Falhou",
  uncertain: "Sem confirmação",
  canceled: "Cancelada",
  received: "Recebida",
  processed: "Recebida",
  processing: "Recebida",
};
type Filter = "all" | "bot" | "human" | "unread" | "mine" | "closed";
type Attachment = z.infer<typeof attachmentSchema>;

export function BotInbox({
  manager,
  selected,
  select,
}: {
  manager: boolean;
  selected: number | null;
  select: (id: number) => void;
}) {
  const utils = trpc.useUtils();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [offset, setOffset] = useState(0);
  const [draft, setDraft] = useState("");
  const [note, setNote] = useState("");
  const [labels, setLabels] = useState("");
  const [assignee, setAssignee] = useState("");
  const [minutes, setMinutes] = useState("30");
  const [attachment, setAttachment] = useState<Attachment | undefined>();
  const [showDetails, setShowDetails] = useState(false);
  const [showList, setShowList] = useState(true);
  const [older, setOlder] = useState<any[]>([]);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasOlder, setHasOlder] = useState(true);
  const [push, setPush] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const selectedRef = useRef(selected);
  selectedRef.current = selected;
  const lastRead = useRef("");
  const scrollThread = useRef<number | null>(null);
  const request = useRef<{ fingerprint: string; id: string } | null>(null);
  const log = useRef<HTMLDivElement>(null);
  const list = trpc.nativeBot.conversations.useQuery(
    { search, offset, filter },
    { refetchInterval: push ? 30000 : 5000 }
  );
  const thread = trpc.nativeBot.thread.useQuery(
    { id: selected || 0 },
    { enabled: !!selected, refetchInterval: push ? 30000 : 5000 }
  );
  const details = trpc.nativeBot.inboxDetails.useQuery(
    { id: selected || 0 },
    { enabled: !!selected }
  );
  const assistants = trpc.nativeBot.assistants.useQuery();
  const refresh = async () => {
    await Promise.all([
      utils.nativeBot.conversations.invalidate(),
      utils.nativeBot.thread.invalidate(),
      utils.nativeBot.inboxDetails.invalidate(),
      utils.nativeBot.snapshot.invalidate(),
    ]);
  };
  useEffect(() => {
    const stream = new EventSource("/api/native-bot/events");
    const changed = () => {
      void refresh();
    };
    stream.addEventListener("changed", changed);
    stream.onopen = () => setPush(true);
    stream.onerror = () => setPush(false);
    return () => {
      stream.close();
    };
  }, []);
  const mode = trpc.nativeBot.setMode.useMutation({
    onSuccess: refresh,
    onError: error,
  });
  const pause = trpc.nativeBot.pauseConversation.useMutation({
    onSuccess: refresh,
    onError: error,
  });
  const close = trpc.nativeBot.closeConversation.useMutation({
    onSuccess: refresh,
    onError: error,
  });
  const assign = trpc.nativeBot.saveConversationDetails.useMutation({
    onSuccess: refresh,
    onError: error,
  });
  const assistant = trpc.nativeBot.selectAssistant.useMutation({
    onSuccess: refresh,
    onError: error,
  });
  const read = trpc.nativeBot.markRead.useMutation({ onError: () => {} });
  const addNote = trpc.nativeBot.addNote.useMutation({
    onError: error,
    onSuccess: async () => {
      setNote("");
      await refresh();
    },
  });
  const send = trpc.nativeBot.send.useMutation({
    onError: error,
    onSuccess: async (_data, input) => {
      if (selectedRef.current === input.id) {
        setDraft("");
        setAttachment(undefined);
        request.current = null;
      }
      await refresh();
      toast.success("Mensagem na fila. A confirmação aparecerá na conversa.");
    },
  });
  const cv = thread.data?.conversation;
  const allMessages = [
    ...new Map(
      [...older, ...(thread.data?.messages || [])].map(m => [m.id, m])
    ).values(),
  ].sort((a, b) => a.id - b.id);
  const lastId = thread.data?.messages.at(-1)?.id;
  useEffect(() => {
    setDraft("");
    setAttachment(undefined);
    setNote("");
    setOlder([]);
    setHasOlder(true);
    request.current = null;
  }, [selected]);
  useEffect(() => {
    const values =
      typeof cv?.labels === "string"
        ? JSON.parse(cv.labels || "[]")
        : cv?.labels || [];
    setLabels(Array.isArray(values) ? values.join(", ") : "");
    setAssignee(String(cv?.assigned_user_id || ""));
  }, [cv?.id, cv?.labels, cv?.assigned_user_id]);
  useEffect(() => {
    if (!selected || !lastId || document.visibilityState !== "visible") return;
    const key = selected + ":" + lastId;
    if (lastRead.current !== key) {
      lastRead.current = key;
      read.mutate({ id: selected, messageId: lastId });
    }
    const el = log.current;
    if (
      el &&
      (scrollThread.current !== selected ||
        el.scrollHeight - el.scrollTop - el.clientHeight < 280)
    )
      el.scrollTop = el.scrollHeight;
    scrollThread.current = selected;
  }, [selected, lastId]);
  async function pickFile(file?: File) {
    if (!file) return;
    if (file.size > MAX_ATTACHMENT_BYTES) {
      toast.error("Escolha um arquivo de até 5 MB.");
      return;
    }
    const conversationId = selected;
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(",")[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    if (selectedRef.current === conversationId)
      setAttachment({
        name: file.name,
        mime: file.type as Attachment["mime"],
        base64,
      });
  }
  async function loadOlder() {
    if (!selected || !allMessages.length) return;
    const conversationId = selected;
    setLoadingOlder(true);
    try {
      const result = await utils.client.nativeBot.thread.query({
        id: selected,
        beforeId: allMessages[0].id,
      });
      if (selectedRef.current === conversationId) {
        setOlder(value => [...result.messages, ...value]);
        setHasOlder(result.messages.length === 150);
      }
    } catch (e) {
      error(e as Error);
    } finally {
      setLoadingOlder(false);
    }
  }
  return (
    <div className={`tatuei-inbox ${showList ? "show-list" : "show-chat"}`}>
      <aside className="inbox-list">
        <header>
          <div>
            <small>WHATSAPP · TATUEI</small>
            <h2>Atendimento</h2>
          </div>
          <MessageSquare size={22} />
        </header>
        <label className="inbox-search">
          <Search size={16} />
          <Input
            aria-label="Buscar conversa"
            placeholder="Nome ou telefone"
            value={search}
            onChange={e => {
              setSearch(e.target.value);
              setOffset(0);
            }}
          />
        </label>
        <div className="inbox-filters">
          {(
            [
              ["all", "Abertas"],
              ["unread", "Não lidas"],
              ["mine", "Minhas"],
              ["human", "Equipe"],
              ["bot", "Bot"],
              ["closed", "Encerradas"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              className={filter === key ? "active" : ""}
              onClick={() => {
                setFilter(key);
                setOffset(0);
              }}
            >
              {label}
            </button>
          ))}
        </div>
        {list.error && <p role="alert">{list.error.message}</p>}
        <div className="inbox-threads">
          {list.isLoading ? (
            <p>Carregando conversas…</p>
          ) : list.data?.length ? (
            list.data.map(t => (
              <button
                key={t.id}
                className={selected === t.id ? "active" : ""}
                onClick={() => {
                  select(t.id);
                  setShowList(false);
                }}
              >
                <div className="inbox-avatar">
                  {t.name.slice(0, 2).toUpperCase()}
                </div>
                <div className="inbox-thread-copy">
                  <strong>{t.name}</strong>
                  <p>{t.lastBody?.slice(0, 90) || "Sem mensagens"}</p>
                  <small>
                    {t.artistName || "Estúdio"} ·{" "}
                    {t.closed_at
                      ? "Encerrada"
                      : t.mode === "bot"
                        ? "Bot ativo"
                        : "Equipe"}
                  </small>
                </div>
                {t.unread > 0 && (
                  <span className="inbox-unread">{t.unread}</span>
                )}
              </button>
            ))
          ) : (
            <div className="inbox-empty">
              <MessageSquare />
              <p>Nenhuma conversa neste filtro.</p>
              <small>As mensagens chegam aqui após conectar o WhatsApp.</small>
            </div>
          )}
        </div>
        <footer>
          <Button
            variant="ghost"
            size="sm"
            disabled={!offset}
            onClick={() => setOffset(Math.max(0, offset - 60))}
          >
            Anterior
          </Button>
          <span>{push ? "● Ao vivo" : "Atualização automática"}</span>
          <Button
            variant="ghost"
            size="sm"
            disabled={(list.data?.length || 0) < 60}
            onClick={() => setOffset(offset + 60)}
          >
            Próxima
          </Button>
        </footer>
      </aside>
      <section className="inbox-conversation">
        {thread.error ? (
          <p role="alert">{thread.error.message}</p>
        ) : !cv ? (
          <div className="inbox-empty">
            <Bot size={42} />
            <h3>Sua central de conversas</h3>
            <p>Escolha um cliente para acompanhar ou responder.</p>
          </div>
        ) : (
          <>
            <header className="inbox-chat-header">
              <Button
                className="inbox-mobile-back"
                variant="ghost"
                size="icon"
                onClick={() => setShowList(true)}
                aria-label="Voltar para conversas"
              >
                <ArrowLeft />
              </Button>
              <div className="inbox-avatar">
                {cv.name.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <h3>{cv.name}</h3>
                <small>{cv.phone}</small>
              </div>
              <span className={`inbox-state ${cv.mode}`}>
                {cv.closed_at
                  ? "Encerrada"
                  : cv.opted_out
                    ? "Mensagens interrompidas"
                    : cv.mode === "bot"
                      ? "Bot ativo"
                      : cv.pause_until
                        ? `Pausa até ${date(cv.pause_until)}`
                        : "Atendimento humano"}
              </span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowDetails(!showDetails)}
              >
                Ficha
              </Button>
            </header>
            <div className="inbox-controls">
              {cv.closed_at ? (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={close.isPending}
                  onClick={() => close.mutate({ id: cv.id, closed: false })}
                >
                  Reabrir com a equipe
                </Button>
              ) : (
                <>
                  <Button
                    size="sm"
                    disabled={
                      mode.isPending || pause.isPending || !!cv.opted_out
                    }
                    onClick={() =>
                      mode.mutate({
                        id: cv.id,
                        mode: cv.mode === "bot" ? "human" : "bot",
                      })
                    }
                  >
                    {cv.mode === "bot" ? (
                      <Pause size={14} />
                    ) : (
                      <Play size={14} />
                    )}
                    {cv.mode === "bot"
                      ? "Assumir atendimento"
                      : "Ativar automação"}
                  </Button>
                  <select
                    aria-label="Duração da pausa"
                    value={minutes}
                    onChange={e => setMinutes(e.target.value)}
                  >
                    <option value="15">15 minutos</option>
                    <option value="30">30 minutos</option>
                    <option value="60">1 hora</option>
                    <option value="custom">Personalizar</option>
                    <option value="manual">Até eu ativar</option>
                  </select>
                  {minutes === "custom" && (
                    <Input
                      aria-label="Minutos de pausa personalizada"
                      type="number"
                      min={1}
                      max={10080}
                      defaultValue={120}
                      id="inbox-custom-pause"
                    />
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={pause.isPending || !!cv.opted_out}
                    onClick={() => {
                      const value =
                        minutes === "manual"
                          ? null
                          : minutes === "custom"
                            ? Number(
                                (
                                  document.getElementById(
                                    "inbox-custom-pause"
                                  ) as HTMLInputElement
                                )?.value
                              )
                            : Number(minutes);
                      pause.mutate({ id: cv.id, minutes: value });
                    }}
                  >
                    Pausar
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={close.isPending}
                    onClick={() => close.mutate({ id: cv.id, closed: true })}
                  >
                    <CheckCheck size={15} />
                    Encerrar
                  </Button>
                </>
              )}
            </div>
            <div
              ref={log}
              className="inbox-messages"
              role="log"
              aria-live="polite"
              aria-label="Histórico de mensagens"
            >
              {hasOlder && allMessages.length >= 150 && (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={loadingOlder}
                  onClick={loadOlder}
                >
                  {loadingOlder
                    ? "Carregando…"
                    : "Carregar mensagens anteriores"}
                </Button>
              )}
              {!allMessages.length && (
                <div className="inbox-empty">
                  <p>Conversa pronta para atendimento.</p>
                </div>
              )}
              {allMessages.map(m => (
                <article key={m.id} className={`inbox-message ${m.role}`}>
                  <small>
                    {m.role === "client"
                      ? cv.name
                      : m.role === "staff"
                        ? "Equipe"
                        : "Assistente"}
                  </small>
                  <p>{m.body}</p>
                  {!m.attachmentName &&
                    m.body === "[Mídia recebida pelo WhatsApp.]" && (
                      <small>
                        Anexo indisponível no CRM. Consulte o WhatsApp.
                      </small>
                    )}
                  {m.attachmentName && (
                    <div className="inbox-attachment">
                      {m.attachmentMime?.startsWith("image/") && (
                        <img
                          src={`/api/native-bot/attachments/${m.id}`}
                          alt={m.attachmentName}
                          loading="lazy"
                        />
                      )}
                      {m.attachmentMime?.startsWith("audio/") && (
                        <audio
                          controls
                          preload="none"
                          src={`/api/native-bot/attachments/${m.id}`}
                        />
                      )}
                      {m.attachmentMime?.startsWith("video/") && (
                        <video
                          controls
                          preload="none"
                          src={`/api/native-bot/attachments/${m.id}`}
                        />
                      )}
                      <a
                        href={`/api/native-bot/attachments/${m.id}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {m.attachmentName}
                      </a>
                    </div>
                  )}
                  <footer>
                    <time>{date(m.created_at)}</time>
                    <span
                      className={
                        ["failed", "uncertain"].includes(m.status)
                          ? "inbox-error"
                          : ""
                      }
                    >
                      {statuses[m.status] || m.status}
                    </span>
                  </footer>
                  {m.error && <small className="inbox-error">{m.error}</small>}
                </article>
              ))}
            </div>
            <form
              className="inbox-composer"
              onSubmit={e => {
                e.preventDefault();
                if ((!draft.trim() && !attachment) || send.isPending) return;
                const fingerprint = JSON.stringify([cv.id, draft, attachment]);
                if (request.current?.fingerprint !== fingerprint)
                  request.current = { fingerprint, id: crypto.randomUUID() };
                send.mutate({
                  id: cv.id,
                  body: draft.trim(),
                  attachment,
                  requestId: request.current.id,
                });
              }}
            >
              {attachment && (
                <div className="inbox-file-chip">
                  {attachment.name}
                  <button
                    type="button"
                    aria-label="Remover anexo"
                    onClick={() => setAttachment(undefined)}
                  >
                    <X size={16} />
                  </button>
                </div>
              )}
              <div>
                <input
                  ref={fileRef}
                  type="file"
                  hidden
                  accept="image/jpeg,image/png,image/webp,application/pdf,audio/ogg,audio/mpeg,audio/mp4,video/mp4"
                  onChange={e => {
                    void pickFile(e.target.files?.[0]).catch(() =>
                      toast.error("Não foi possível ler o arquivo.")
                    );
                    e.target.value = "";
                  }}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Anexar arquivo de até 5 MB"
                  disabled={!!cv.opted_out || !!cv.closed_at || send.isPending}
                  onClick={() => fileRef.current?.click()}
                >
                  <Paperclip size={18} />
                </Button>
                <Textarea
                  aria-label="Mensagem para o cliente"
                  placeholder="Escreva sua resposta…"
                  maxLength={4000}
                  value={draft}
                  onChange={e => setDraft(e.target.value)}
                  disabled={!!cv.opted_out || !!cv.closed_at || send.isPending}
                />
                <Button
                  type="submit"
                  aria-label="Enviar mensagem"
                  disabled={
                    send.isPending ||
                    !!cv.opted_out ||
                    !!cv.closed_at ||
                    (!draft.trim() && !attachment)
                  }
                >
                  <Send size={18} />
                </Button>
              </div>
              <small>
                Responder assume o atendimento e pausa o bot até você ativá-lo
                novamente.
              </small>
            </form>
          </>
        )}
      </section>
      {cv && (
        <aside className={`inbox-details ${showDetails ? "visible" : ""}`}>
          <header>
            <h3>Ficha do atendimento</h3>
            <Button
              size="icon"
              variant="ghost"
              aria-label="Fechar ficha"
              onClick={() => setShowDetails(false)}
            >
              <X size={16} />
            </Button>
          </header>
          {details.error && <p role="alert">{details.error.message}</p>}
          <p>
            <strong>{details.data?.client?.name || cv.name}</strong>
            <br />
            <small>
              {cv.client_id
                ? `Cadastro #${cv.client_id}`
                : "Contato ainda sem cadastro vinculado"}
            </small>
          </p>
          {cv.client_id && <a href="/clients">Abrir clientes no CRM</a>}
          {manager && (
            <LinkInboxClient
              conversationId={cv.id}
              phone={cv.phone}
              done={refresh}
            />
          )}
          <label>
            Responsável
            <select
              value={assignee}
              onChange={e => setAssignee(e.target.value)}
            >
              <option value="">Não atribuído</option>
              {details.data?.staff.map(u => (
                <option key={u.id} value={u.id}>
                  {u.name || `Usuário ${u.id}`}
                </option>
              ))}
            </select>
          </label>
          <label>
            Etiquetas
            <Input
              value={labels}
              onChange={e => setLabels(e.target.value)}
              placeholder="Orçamento, Realismo"
            />
          </label>
          <Button
            size="sm"
            variant="outline"
            disabled={assign.isPending}
            onClick={() =>
              assign.mutate({
                id: cv.id,
                assignedUserId: assignee ? Number(assignee) : null,
                labels: labels
                  .split(",")
                  .map(s => s.trim())
                  .filter(Boolean),
              })
            }
          >
            Salvar ficha / transferir
          </Button>
          <label>
            Assistente
            <select
              value={cv.assistant_id || ""}
              disabled={assistant.isPending}
              onChange={e =>
                assistant.mutate({
                  id: cv.id,
                  assistantId: e.target.value ? Number(e.target.value) : null,
                })
              }
            >
              <option value="">Assistente padrão do responsável</option>
              {assistants.data
                ?.filter(a => a.enabled)
                .map(a => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
            </select>
          </label>
          <small>Trocar o assistente pausa a automação para sua revisão.</small>
          <h4>Notas internas</h4>
          <form
            onSubmit={e => {
              e.preventDefault();
              if (note.trim()) addNote.mutate({ id: cv.id, body: note });
            }}
          >
            <Textarea
              aria-label="Nota interna"
              value={note}
              onChange={e => setNote(e.target.value)}
              maxLength={4000}
              placeholder="Visível apenas para a equipe autorizada"
            />
            <Button
              size="sm"
              variant="outline"
              disabled={addNote.isPending || !note.trim()}
            >
              Adicionar nota
            </Button>
          </form>
          {details.data?.notes.map(n => (
            <div className="inbox-note" key={n.id}>
              <p>{n.body}</p>
              <small>
                {n.author || "Equipe"} · {date(n.created_at)}
              </small>
            </div>
          ))}
        </aside>
      )}
    </div>
  );
}

function LinkInboxClient({
  conversationId,
  phone,
  done,
}: {
  conversationId: number;
  phone: string;
  done: () => Promise<unknown>;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState(phone.slice(-4));
  const [clientId, setClientId] = useState("");
  const clients = trpc.nativeBot.clients.useQuery(
    { search, offset: 0 },
    { enabled: open }
  );
  const link = trpc.nativeBot.assignConversation.useMutation({
    onError: error,
    onSuccess: async () => {
      setOpen(false);
      await done();
      toast.success("Conversa vinculada. A equipe permanece no atendimento.");
    },
  });
  useEffect(() => {
    setOpen(false);
    setClientId("");
    setSearch(phone.slice(-4));
  }, [conversationId, phone]);
  return (
    <div className="inbox-link-client">
      <Button size="sm" variant="outline" onClick={() => setOpen(!open)}>
        Vincular cadastro / artista
      </Button>
      {open && (
        <>
          <small>
            O cadastro precisa ter o mesmo telefone. O artista vinculado passará
            a ter acesso ao histórico.
          </small>
          <Input
            aria-label="Buscar cadastro para vincular"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <select
            aria-label="Cadastro do cliente"
            value={clientId}
            onChange={e => setClientId(e.target.value)}
          >
            <option value="">Escolha o cadastro</option>
            {clients.data?.map(c => (
              <option key={c.id} value={c.id}>
                {c.name} · {c.artistName || "Sem artista"} · {c.phone}
              </option>
            ))}
          </select>
          {clients.error && <p role="alert">{clients.error.message}</p>}
          <Button
            size="sm"
            disabled={!clientId || link.isPending}
            onClick={() =>
              link.mutate({ id: conversationId, clientId: Number(clientId) })
            }
          >
            Vincular e manter com a equipe
          </Button>
        </>
      )}
    </div>
  );
}

export function OwnWhatsAppConnection({
  done,
}: {
  done: () => Promise<unknown>;
}) {
  const state = trpc.nativeBot.qrState.useQuery(undefined, {
    refetchInterval: 3000,
    retry: false,
  });
  const utils = trpc.useUtils();
  const refresh = async () => {
    await utils.nativeBot.qrState.invalidate();
    await done();
  };
  const connect = trpc.nativeBot.connectQr.useMutation({
    onSuccess: refresh,
    onError: error,
  });
  const disconnect = trpc.nativeBot.disconnectOwnQr.useMutation({
    onSuccess: refresh,
    onError: error,
  });
  const renew = trpc.nativeBot.renewQr.useMutation({
    onSuccess: refresh,
    onError: error,
  });
  const s = state.data;
  return (
    <section className="inbox-connect">
      <div>
        <small>ESCOLHA COMO CONECTAR</small>
        <h2>WhatsApp do estúdio</h2>
        <p>O número conectado atende na mesma caixa de conversas do Tatuei.</p>
      </div>
      <div className="inbox-connect-grid">
        <article>
          <Bot />
          <h3>QR Code próprio</h3>
          <p>
            Vincule seu WhatsApp como um aparelho conectado. Conector não
            oficial, operado pelo Tatuei.
          </p>
          <strong>
            {s?.selected
              ? s.status === "connected"
                ? `Conectado · ${s.phone}`
                : s.status === "awaiting_qr"
                  ? "Aguardando leitura"
                  : "Aguardando conexão"
              : "Não selecionado"}
          </strong>
          {state.error && <p role="alert">{state.error.message}</p>}
          {s?.error && <p role="alert">{s.error}</p>}
          {s?.image && (
            <div className="inbox-qr">
              <img
                src={s.image}
                alt="QR Code para conectar o WhatsApp do estúdio"
              />
              <p>No WhatsApp: Aparelhos conectados → Conectar um aparelho.</p>
              <small>O código é temporário e atualiza automaticamente.</small>
            </div>
          )}
          {!s?.available && (
            <p>
              O administrador do servidor precisa habilitar este conector para
              iniciar o pareamento.
            </p>
          )}
          <div className="inbox-connect-actions">
            <Button
              disabled={!s?.available || connect.isPending || s?.selected}
              onClick={() => connect.mutate()}
            >
              Conectar por QR Code
            </Button>
            {s?.selected && (
              <>
                <Button
                  variant="outline"
                  disabled={disconnect.isPending}
                  onClick={() => disconnect.mutate()}
                >
                  Desconectar
                </Button>
                {s.status !== "connected" && (
                  <Button
                    variant="ghost"
                    disabled={renew.isPending}
                    onClick={() => renew.mutate()}
                  >
                    <RefreshCw size={14} />
                    Gerar nova sessão
                  </Button>
                )}
              </>
            )}
          </div>
        </article>
        <article>
          <CheckCheck />
          <h3>API oficial da Meta</h3>
          <p>
            Use a conexão oficial do WhatsApp Business Platform. Configure o
            número, as credenciais e o webhook em Canais conectados abaixo.
          </p>
          <p>
            A coexistência depende da habilitação e elegibilidade da sua conta
            na Meta.
          </p>
          <a href="#tatuei-official-channels">Configurar conexão oficial ↓</a>
          <small>
            As regras de envio da Meta continuam valendo. Um canal responde pelo
            bot de cada vez.
          </small>
        </article>
      </div>
    </section>
  );
}

export function BotAssistants() {
  const utils = trpc.useUtils();
  const list = trpc.nativeBot.assistants.useQuery();
  const empty = {
    name: "",
    instructions: "",
    knowledge: "",
    enabled: false,
    version: 0,
  };
  const [draft, setDraft] = useState<typeof empty & { id?: number }>(empty);
  const save = trpc.nativeBot.saveAssistant.useMutation({
    onError: error,
    onSuccess: async () => {
      setDraft(empty);
      await utils.nativeBot.assistants.invalidate();
      toast.success("Assistente salvo.");
    },
  });
  return (
    <section className="inbox-assistants">
      <header>
        <div>
          <small>INTELIGÊNCIA DO ATENDIMENTO</small>
          <h2>Assistentes do estúdio</h2>
          <p>
            Crie especialistas e escolha um na ficha de cada conversa. A chave e
            o limite de IA são os configurados pelo estúdio.
          </p>
        </div>
        <Button variant="outline" onClick={() => setDraft(empty)}>
          Novo assistente
        </Button>
      </header>
      <div className="inbox-assistant-grid">
        <aside>
          {list.error && <p role="alert">{list.error.message}</p>}
          {list.data?.map(a => (
            <button
              key={a.id}
              className={draft.id === a.id ? "active" : ""}
              onClick={() => setDraft({ ...a, enabled: !!a.enabled })}
            >
              <Bot size={18} />
              <strong>{a.name}</strong>
              <small>{a.enabled ? "Disponível" : "Desativado"}</small>
            </button>
          ))}
          {!list.data?.length && (
            <p>
              Nenhum assistente adicional. O perfil padrão continua disponível.
            </p>
          )}
        </aside>
        <form
          onSubmit={e => {
            e.preventDefault();
            save.mutate(draft);
          }}
        >
          <label>
            Nome
            <Input
              required
              maxLength={100}
              value={draft.name}
              onChange={e => setDraft({ ...draft, name: e.target.value })}
              placeholder="Ex.: Recepção do estúdio"
            />
          </label>
          <label>
            Instruções
            <Textarea
              value={draft.instructions}
              maxLength={12000}
              onChange={e =>
                setDraft({ ...draft, instructions: e.target.value })
              }
              placeholder="Objetivo, comportamento e quando encaminhar para a equipe"
            />
          </label>
          <label>
            Base de conhecimento
            <Textarea
              value={draft.knowledge}
              maxLength={30000}
              onChange={e => setDraft({ ...draft, knowledge: e.target.value })}
              placeholder="Informações aprovadas para o atendimento"
            />
          </label>
          <label className="inbox-checkbox">
            <input
              type="checkbox"
              checked={draft.enabled}
              onChange={e => setDraft({ ...draft, enabled: e.target.checked })}
            />
            Disponível para vincular às conversas
          </label>
          <p>
            Ações de agenda e pagamento dependem das ferramentas do CRM. Este
            cadastro configura o conhecimento e o comportamento do assistente.
          </p>
          <Button disabled={save.isPending}>
            {draft.id ? "Salvar alterações" : "Criar assistente"}
          </Button>
        </form>
      </div>
    </section>
  );
}
