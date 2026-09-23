import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../../../server/routers";
import { useEffect, useState, type ReactNode } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { TatueiBotIcon } from "@/components/TatueiBotIcon";
import { toast } from "sonner";
import {
  ArrowRight,
  Play,
  MessageSquare,
  Users,
  Workflow,
  Settings2,
  Plug,
  History,
  ShieldCheck,
  Plus,
  Send,
  Check,
  Clock,
  Trash2,
  Save,
  Sparkles,
  LockKeyhole,
  RefreshCw,
} from "lucide-react";
import {
  BOT_MESSAGES,
  BOT_EVENTS,
  BOT_EVENT_LABELS,
  BOT_MESSAGE_LABELS,
  botVariables,
  interpolateBot,
  defaultBotConfig,
  type BotConfig,
  type BotPermissions,
  type BotRule,
} from "@shared/nativeBot";
import "./NativeBot.css";
const sections = [
  ["overview", "Visão geral", Sparkles],
  ["conversations", "Conversas", MessageSquare],
  ["assistant", "Assistente", Settings2],
  ["messages", "Mensagens", MessageSquare],
  ["rules", "Automações", Workflow],
  ["clients", "Clientes", Users],
  ["simulator", "Simulador", Play],
  ["team", "Equipe e acesso", ShieldCheck],
  ["connections", "Conexões", Plug],
  ["history", "Histórico", History],
] as const;
type Section = (typeof sections)[number][0];
type Snapshot = inferRouterOutputs<AppRouter>["nativeBot"]["snapshot"];
const err = (e: { message: string }) => toast.error(e.message);
const when = (v: string) =>
  new Date(v.includes("T") ? v : v.replace(" ", "T") + "Z").toLocaleString(
    "pt-BR",
    {
      timeZone: "America/Sao_Paulo",
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }
  );
function Panel({
  title,
  sub,
  children,
  extra,
  className = "",
}: {
  title?: string;
  sub?: string;
  children: ReactNode;
  extra?: ReactNode;
  className?: string;
}) {
  return (
    <section className={"bot-panel " + className}>
      {title && (
        <header className="bot-panel-head">
          <div>
            <h2>{title}</h2>
            {sub && <p>{sub}</p>}
          </div>
          {extra}
        </header>
      )}
      {children}
    </section>
  );
}
function Field({
  label,
  id,
  children,
  hint,
}: {
  label: string;
  id: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <div className="bot-field">
      <label htmlFor={id}>{label}</label>
      {children}
      {hint && <p className="bot-hint">{hint}</p>}
    </div>
  );
}
function Toggle({
  label,
  value,
  onChange,
  disabled = false,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className="bot-toggle">
      <input
        type="checkbox"
        checked={value}
        onChange={e => onChange(e.target.checked)}
        disabled={disabled}
      />
      <span>{label}</span>
    </label>
  );
}
function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="bot-empty">
      <MessageSquare className="h-8 w-8" />
      <h3>{title}</h3>
      {children}
    </div>
  );
}
function Notice({ children }: { children: ReactNode }) {
  return <div className="bot-notice">{children}</div>;
}
function Pager({
  offset,
  size,
  count,
  set,
}: {
  offset: number;
  size: number;
  count: number;
  set: (n: number) => void;
}) {
  return (
    <div className="bot-actions bot-pager">
      <Button
        variant="outline"
        size="sm"
        disabled={!offset}
        onClick={() => set(Math.max(0, offset - size))}
      >
        Anterior
      </Button>
      <span>{Math.floor(offset / size) + 1}</span>
      <Button
        variant="outline"
        size="sm"
        disabled={count < size}
        onClick={() => set(offset + size)}
      >
        Próxima
      </Button>
    </div>
  );
}
export default function NativeBot() {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const [section, setSection] = useState<Section>("overview");
  const [owner, setOwner] = useState(0);
  const [selectedThread, setSelectedThread] = useState<number | null>(null);
  const access = trpc.nativeBot.access.useQuery(undefined, {
    enabled: !!user?.studioId,
    retry: false,
    refetchInterval: 15000,
  });
  const manager = !!access.data?.manager;
  const data = trpc.nativeBot.snapshot.useQuery(
    { artistId: manager ? owner : undefined },
    {
      enabled: !!access.data?.allowed,
      retry: false,
      refetchOnWindowFocus: false,
    }
  );
  const refresh = async () => {
    await Promise.all([
      utils.nativeBot.snapshot.invalidate(),
      utils.nativeBot.access.invalidate(),
    ]);
  };
  const can = (s: Section) => !["team", "connections"].includes(s) || manager;
  const canEdit = (s: Section) =>
    manager ||
    !["assistant", "messages", "rules", "clients"].includes(s) ||
    !!access.data?.permissions[s as keyof BotPermissions];
  if (!user?.studioId)
    return <p>Selecione um estúdio ativo para abrir o Bot Tatuei.</p>;
  if (access.isLoading)
    return <p role="status">Verificando seu acesso ao Bot Tatuei…</p>;
  if (access.error)
    return (
      <Notice>
        {access.error.message}{" "}
        <Button variant="outline" onClick={() => access.refetch()}>
          Tentar novamente
        </Button>
      </Notice>
    );
  if (!access.data?.allowed)
    return (
      <section className="native-bot bot-locked">
        <TatueiBotIcon hero />
        <h1>Bot Tatuei</h1>
        <p>
          O estúdio ainda não liberou o bot para seu perfil, ou o módulo está
          pausado.
        </p>
        <p>
          Peça ao gestor para conferir <strong>Equipe e acesso</strong>.
        </p>
      </section>
    );
  if (data.isLoading || !data.data)
    return (
      <div role="status">
        {data.error ? (
          <Notice>
            {data.error.message}{" "}
            <Button onClick={() => data.refetch()}>Recarregar</Button>
          </Notice>
        ) : (
          "Carregando configurações…"
        )}
      </div>
    );
  const s = data.data;
  const scoped = ["assistant", "messages", "rules", "simulator"].includes(
    section
  );
  return (
    <div className="native-bot">
      <header className="bot-heading">
        <div className="bot-heading-title">
          <TatueiBotIcon className="h-10 w-10" />
          <div>
            <h1>Bot Tatuei</h1>
            <p>{s.studioName} · Atendimento do seu estúdio</p>
          </div>
        </div>
        <Badge variant={s.enabled ? "default" : "secondary"}>
          {s.enabled ? "Módulo ativo" : "Módulo pausado"}
        </Badge>
      </header>
      <nav className="bot-tabs" aria-label="Áreas do Bot Tatuei">
        {sections
          .filter(([key]) => can(key) && canEdit(key))
          .map(([key, label, Icon]) => (
            <button
              key={key}
              onClick={() => setSection(key)}
              aria-current={section === key ? "page" : undefined}
              className={section === key ? "active" : ""}
            >
              <Icon size={15} />
              {label}
            </button>
          ))}
      </nav>
      {scoped && (
        <div className="bot-scope">
          <div>
            <strong>
              Atendimento de {s.profile.artistId ? s.artistName : s.studioName}
            </strong>
            <p>Mensagens e regras independentes para cada artista.</p>
          </div>
          {manager ? (
            <label>
              Configurar atendimento
              <select
                value={owner}
                onChange={e => setOwner(Number(e.target.value))}
              >
                <option value={0}>Geral do estúdio</option>
                {s.artists.map(a => (
                  <option value={a.id} key={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <Badge>Minhas configurações</Badge>
          )}
        </div>
      )}
      {!s.enabled && section !== "team" && (
        <Notice>
          O bot está pausado. Você pode configurar e simular; os envios externos
          só funcionam após a ativação.
        </Notice>
      )}
      {!can(section) || !canEdit(section) ? (
        <Notice>Esta área não está liberada para seu perfil.</Notice>
      ) : (
        <>
          {section === "overview" && <Overview data={s} go={setSection} />}
          {["assistant", "messages", "rules"].includes(section) && (
            <ConfigEditor
              key={s.profile.artistId + ":" + s.profile.version + ":" + section}
              data={s}
              section={section as "assistant" | "messages" | "rules"}
              done={refresh}
            />
          )}
          {section === "clients" && (
            <BotClients
              data={s}
              openThread={id => {
                setSelectedThread(id);
                setSection("conversations");
              }}
            />
          )}
          {section === "simulator" && (
            <Simulator key={s.profile.artistId} data={s} />
          )}
          {section === "team" && manager && (
            <Team enabled={s.enabled} done={refresh} />
          )}
          {section === "connections" && manager && (
            <Connections data={s} done={refresh} />
          )}
          {section === "history" && <BotHistory />}
          {section === "conversations" && (
            <Conversations
              data={s}
              selected={selectedThread}
              select={setSelectedThread}
            />
          )}
        </>
      )}
      <footer className="bot-footer">
        <span>Configurações salvas no CRM · Acesso individual por artista</span>
        <span>Bot Tatuei</span>
      </footer>
    </div>
  );
}
function Overview({
  data: s,
  go,
}: {
  data: Snapshot;
  go: (p: Section) => void;
}) {
  return (
    <div className="bot-stack">
      <div className="bot-hero">
        <div>
          <span className="bot-eyebrow">BOT NATIVO DO CRM</span>
          <h2>
            Um só estúdio.
            <br />
            Cada artista com sua voz.
          </h2>
          <p>
            Organize o atendimento, personalize as mensagens e acompanhe as
            conversas em um só lugar.
          </p>
          <Button onClick={() => go("simulator")}>
            <Play size={16} /> Testar atendimento
          </Button>
        </div>
        <TatueiBotIcon hero />
      </div>
      <div className="bot-stats">
        <Panel>
          <span>Clientes no seu acesso</span>
          <strong>{s.clientCount}</strong>
        </Panel>
        <Panel>
          <span>Com a equipe</span>
          <strong>{s.humanCount}</strong>
        </Panel>
        <Panel>
          <span>Canal do estúdio</span>
          <strong className="bot-stat-label">
            {s.connection?.whatsappStatus === "connected"
              ? "Conectado"
              : s.manager
                ? "A configurar"
                : "WhatsApp"}
          </strong>
        </Panel>
      </div>
      <div className="bot-grid">
        <Panel
          title="Comece por aqui"
          sub="Prepare o atendimento antes de ativar as automações."
        >
          {(s.manager
            ? [
                [
                  "connections",
                  "Conectar WhatsApp e IA",
                  "Cadastre as credenciais do estúdio.",
                ],
                [
                  "assistant",
                  "Personalizar a assistente",
                  "Defina informações e respostas aprovadas.",
                ],
                [
                  "team",
                  "Liberar para os artistas",
                  "Escolha quem pode usar e configurar.",
                ],
                [
                  "simulator",
                  "Testar o atendimento",
                  "Experimente suas regras sem enviar mensagens.",
                ],
              ]
            : [
                [
                  "assistant",
                  "Personalizar o atendimento",
                  "Use as configurações liberadas pelo estúdio.",
                ],
                [
                  "simulator",
                  "Testar suas respostas",
                  "Veja suas mensagens antes de ativar os envios.",
                ],
                [
                  "conversations",
                  "Acompanhar as conversas",
                  "Assuma o atendimento quando for necessário.",
                ],
              ]
          ).map(([key, title, detail], i) => (
            <button
              className="bot-step"
              key={key}
              onClick={() => go(key as Section)}
            >
              <span>{i + 1}</span>
              <div>
                <strong>{title}</strong>
                <p>{detail}</p>
              </div>
              <ArrowRight size={17} />
            </button>
          ))}
        </Panel>
        <Panel
          title="O atendimento continua com você"
          sub="O bot prepara a conversa. A equipe mantém o controle."
        >
          <div className="bot-feature">
            <ShieldCheck />
            <div>
              <h3>Liberação pelo estúdio</h3>
              <p>O gestor define o acesso e os recursos de cada artista.</p>
            </div>
          </div>
          <div className="bot-feature">
            <MessageSquare />
            <div>
              <h3>Conversa por cliente</h3>
              <p>
                Mensagens e histórico seguem o artista responsável pelo
                cadastro.
              </p>
            </div>
          </div>
          <div className="bot-feature">
            <Users />
            <div>
              <h3>Passagem para a equipe</h3>
              <p>
                Assumir o atendimento interrompe as respostas automáticas
                pendentes.
              </p>
            </div>
          </div>
          <Notice>
            O simulador usa suas configurações salvas. WhatsApp e IA reais
            exigem as credenciais do estúdio.
          </Notice>
        </Panel>
      </div>
    </div>
  );
}
function ConfigEditor({
  data: s,
  section,
  done,
}: {
  data: Snapshot;
  section: "assistant" | "messages" | "rules";
  done: () => Promise<unknown>;
}) {
  const [config, set] = useState<BotConfig>(() =>
    structuredClone(s.profile.config)
  );
  const [messageKey, setMessageKey] =
    useState<(typeof BOT_MESSAGES)[number]>("greeting");
  const save = trpc.nativeBot.saveConfig.useMutation({ onError: err });
  const edit = <K extends keyof BotConfig>(k: K, v: BotConfig[K]) =>
    set(c => ({ ...c, [k]: v }));
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await save.mutateAsync({
        artistId: s.profile.artistId,
        section,
        config,
        version: s.profile.version,
      });
      await done();
      toast.success("Configurações salvas.");
    } catch {}
  };
  const vars = botVariables({
    clientName: "Marina de exemplo",
    studioName: s.studioName,
    artistName: s.artistName,
    date: "2026-12-15 14:00:00",
  });
  return (
    <form onSubmit={submit} className="bot-stack">
      {section === "assistant" && (
        <div className="bot-grid">
          <Panel
            title="Identidade da assistente"
            sub="Informações que orientam as respostas."
          >
            <div className="bot-form-grid">
              <Field id="bot-name" label="Nome da assistente">
                <Input
                  id="bot-name"
                  required
                  maxLength={60}
                  value={config.name}
                  onChange={e => edit("name", e.target.value)}
                />
              </Field>
              <Field id="bot-tone" label="Tom de voz">
                <Input
                  id="bot-tone"
                  maxLength={100}
                  value={config.tone}
                  onChange={e => edit("tone", e.target.value)}
                />
              </Field>
            </div>
            <Field id="bot-address" label="Endereço informado ao cliente">
              <Input
                id="bot-address"
                value={config.address}
                maxLength={500}
                onChange={e => edit("address", e.target.value)}
                placeholder="Endereço do atendimento"
              />
            </Field>
            <div className="bot-form-grid">
              <Field id="bot-opens" label="Abertura">
                <Input
                  type="time"
                  id="bot-opens"
                  required
                  value={config.opens}
                  onChange={e => edit("opens", e.target.value)}
                />
              </Field>
              <Field id="bot-closes" label="Fechamento">
                <Input
                  type="time"
                  id="bot-closes"
                  required
                  value={config.closes}
                  onChange={e => edit("closes", e.target.value)}
                />
              </Field>
            </div>
            <div
              className="bot-days"
              role="group"
              aria-label="Dias de atendimento"
            >
              {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map(
                (day, i) => (
                  <label key={day}>
                    <input
                      type="checkbox"
                      checked={config.days.includes(i)}
                      onChange={e =>
                        edit(
                          "days",
                          e.target.checked
                            ? [...config.days, i].sort()
                            : config.days.filter(d => d !== i)
                        )
                      }
                    />
                    {day}
                  </label>
                )
              )}
            </div>
            <p className="bot-hint">
              Horário de Brasília. Fora desse período, o bot usa a mensagem de
              ausência.
            </p>
            <Field id="bot-instructions" label="Como a assistente deve atender">
              <Textarea
                id="bot-instructions"
                rows={4}
                maxLength={6000}
                value={config.instructions}
                onChange={e => edit("instructions", e.target.value)}
              />
            </Field>
            <Toggle
              label="Usar IA para perguntas sem resposta rápida"
              value={config.aiEnabled}
              onChange={v => edit("aiEnabled", v)}
            />
            <p className="bot-hint">
              A chave de IA é configurada pelo estúdio em Conexões. A IA não
              altera a agenda.
            </p>
          </Panel>
          <div className="bot-stack">
            <Panel
              title="Base de conhecimento"
              sub="Informações específicas deste atendimento."
            >
              <Field
                id="bot-knowledge"
                label="O que a assistente pode informar"
                hint="Inclua orientações, serviços e informações aprovadas. Quando faltar informação, o atendimento será encaminhado."
              >
                <Textarea
                  id="bot-knowledge"
                  rows={8}
                  maxLength={12000}
                  value={config.knowledge}
                  onChange={e => edit("knowledge", e.target.value)}
                  placeholder="Descreva o atendimento do artista ou do estúdio…"
                />
              </Field>
            </Panel>
            <Panel
              title="Respostas rápidas"
              sub="Palavras-chave separadas por vírgula."
              extra={
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={config.faqs.length >= 40}
                  onClick={() =>
                    edit("faqs", [...config.faqs, { keywords: "", answer: "" }])
                  }
                >
                  <Plus size={15} />
                  Adicionar
                </Button>
              }
            >
              {config.faqs.length ? (
                config.faqs.map((f, i) => (
                  <div className="bot-faq" key={i}>
                    <Field label="Palavras-chave" id={"faq-key-" + i}>
                      <Input
                        required
                        id={"faq-key-" + i}
                        value={f.keywords}
                        maxLength={200}
                        onChange={e =>
                          edit(
                            "faqs",
                            config.faqs.map((x, n) =>
                              n === i ? { ...x, keywords: e.target.value } : x
                            )
                          )
                        }
                      />
                    </Field>
                    <Field label="Resposta" id={"faq-answer-" + i}>
                      <Textarea
                        required
                        id={"faq-answer-" + i}
                        value={f.answer}
                        maxLength={2000}
                        onChange={e =>
                          edit(
                            "faqs",
                            config.faqs.map((x, n) =>
                              n === i ? { ...x, answer: e.target.value } : x
                            )
                          )
                        }
                      />
                    </Field>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        edit(
                          "faqs",
                          config.faqs.filter((_, n) => n !== i)
                        )
                      }
                    >
                      <Trash2 size={14} />
                      Remover
                    </Button>
                  </div>
                ))
              ) : (
                <p className="bot-hint">
                  Cadastre respostas para dúvidas frequentes, como
                  estacionamento e localização.
                </p>
              )}
            </Panel>
          </div>
        </div>
      )}
      {section === "messages" && (
        <>
          <div className="bot-message-tabs">
            {BOT_MESSAGES.map(key => (
              <Button
                type="button"
                size="sm"
                key={key}
                variant={messageKey === key ? "default" : "outline"}
                onClick={() => setMessageKey(key)}
              >
                {BOT_MESSAGE_LABELS[key]}
              </Button>
            ))}
          </div>
          <div className="bot-grid">
            <Panel
              title={BOT_MESSAGE_LABELS[messageKey]}
              sub="Os textos são individuais por artista."
            >
              <Field label="Mensagem" id="bot-message">
                <Textarea
                  id="bot-message"
                  rows={9}
                  required
                  maxLength={3000}
                  value={config.messages[messageKey]}
                  onChange={e =>
                    edit("messages", {
                      ...config.messages,
                      [messageKey]: e.target.value,
                    })
                  }
                />
              </Field>
              <div className="bot-tokens">
                {["primeiro_nome", "artista", "estudio", "data", "hora"].map(
                  t => (
                    <button
                      type="button"
                      key={t}
                      onClick={() => {
                        const el = document.getElementById(
                          "bot-message"
                        ) as HTMLTextAreaElement;
                        const pos =
                          el?.selectionStart ??
                          config.messages[messageKey].length;
                        const end = el?.selectionEnd ?? pos;
                        const value = config.messages[messageKey];
                        edit("messages", {
                          ...config.messages,
                          [messageKey]:
                            value.slice(0, pos) +
                            "{" +
                            t +
                            "}" +
                            value.slice(end),
                        });
                      }}
                    >
                      {"{" + t + "}"}
                    </button>
                  )
                )}
              </div>
              <p className="bot-hint">
                As automações de lembrete acrescentam os links reais de
                confirmação e remarcação da sessão.
              </p>
            </Panel>
            <Panel title="Prévia" sub="Exemplo com dados fictícios.">
              <div className="bot-preview-author">
                <TatueiBotIcon />
                <div>
                  <strong>{config.name}</strong>
                  <p>{s.artistName}</p>
                </div>
              </div>
              <div className="bot-preview-bubble">
                {interpolateBot(config.messages[messageKey], vars)}
              </div>
            </Panel>
          </div>
        </>
      )}
      {section === "rules" && (
        <>
          <Notice>
            Os eventos de hoje elegíveis entram na fila após a ativação. As
            automações exigem autorização do cliente. Todos os horários seguem
            Brasília.
          </Notice>
          <div className="bot-rules">
            {BOT_EVENTS.map(event => {
              const rule =
                config.rules.find(r => r.event === event) ||
                defaultBotConfig().rules.find(r => r.event === event)!;
              const patch = (p: Partial<BotRule>) =>
                edit("rules", [
                  ...config.rules.filter(r => r.event !== event),
                  { ...rule, ...p },
                ]);
              return (
                <Panel
                  key={event}
                  title={BOT_EVENT_LABELS[event]}
                  sub={
                    event === "greeting"
                      ? "Dispara ao receber uma saudação durante o horário de atendimento."
                      : event === "reminder"
                        ? "Antes de uma sessão agendada ou confirmada."
                        : event === "followup"
                          ? "Após uma sessão marcada como concluída."
                          : "Na data de aniversário cadastrada no cliente."
                  }
                  extra={
                    <Toggle
                      label="Ativa"
                      value={rule.enabled}
                      onChange={enabled => patch({ enabled })}
                    />
                  }
                >
                  <div className="bot-rule-fields">
                    {event !== "greeting" && (
                      <>
                        <Field label="Enviar às" id={"time-" + event}>
                          <Input
                            type="time"
                            id={"time-" + event}
                            required
                            value={rule.sendTime}
                            onChange={e => patch({ sendTime: e.target.value })}
                          />
                        </Field>
                        {event !== "birthday" && (
                          <Field
                            label={
                              event === "reminder"
                                ? "Dias antes da sessão"
                                : "Dias após a sessão"
                            }
                            id={"days-" + event}
                          >
                            <Input
                              type="number"
                              id={"days-" + event}
                              min={0}
                              max={365}
                              required
                              value={rule.days}
                              onChange={e =>
                                patch({ days: Number(e.target.value) })
                              }
                            />
                          </Field>
                        )}
                      </>
                    )}
                    <Field
                      label="Espera após o evento (min)"
                      id={"delay-" + event}
                    >
                      <Input
                        type="number"
                        id={"delay-" + event}
                        min={0}
                        max={1440}
                        required
                        value={rule.delayMinutes}
                        onChange={e =>
                          patch({ delayMinutes: Number(e.target.value) })
                        }
                      />
                    </Field>
                    <Field label="Condição" id={"condition-" + event}>
                      <select
                        id={"condition-" + event}
                        value={rule.condition}
                        onChange={e =>
                          patch({
                            condition: e.target.value as "always" | "outside",
                          })
                        }
                      >
                        <option value="always">Sempre</option>
                        <option value="outside">Somente fora do horário</option>
                      </select>
                    </Field>
                    <Field label="Mensagem" id={"message-" + event}>
                      <select
                        id={"message-" + event}
                        value={rule.message}
                        onChange={e =>
                          patch({
                            message: e.target.value as BotRule["message"],
                          })
                        }
                      >
                        {BOT_MESSAGES.map(k => (
                          <option key={k} value={k}>
                            {BOT_MESSAGE_LABELS[k]}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Depois da mensagem" id={"after-" + event}>
                      <select
                        id={"after-" + event}
                        value={rule.after}
                        onChange={e =>
                          patch({ after: e.target.value as "bot" | "human" })
                        }
                      >
                        <option value="bot">Continuar com o bot</option>
                        <option value="human">Passar para a equipe</option>
                      </select>
                    </Field>
                  </div>
                  <div className="bot-flow">
                    <span>{BOT_EVENT_LABELS[event]}</span>
                    <ArrowRight size={15} />
                    <span>
                      {rule.delayMinutes
                        ? `Aguardar ${rule.delayMinutes} min`
                        : "Sem espera"}
                    </span>
                    <ArrowRight size={15} />
                    <span>{BOT_MESSAGE_LABELS[rule.message]}</span>
                    <ArrowRight size={15} />
                    <strong>{rule.after === "human" ? "Equipe" : "Bot"}</strong>
                  </div>
                </Panel>
              );
            })}
          </div>
        </>
      )}
      <div className="bot-save">
        <p>As alterações passam a valer após salvar.</p>
        <Button type="submit" disabled={save.isPending}>
          <Save size={16} />
          {save.isPending ? "Salvando…" : "Salvar configurações"}
        </Button>
      </div>
    </form>
  );
}
function Simulator({ data: s }: { data: Snapshot }) {
  const [name, setName] = useState("Marina");
  const [text, setText] = useState("");
  const [outside, setOutside] = useState(false);
  const [ai, setAi] = useState(false);
  const [human, setHuman] = useState(false);
  const [trace, setTrace] = useState(
    "Envie uma mensagem para ver qual regra será usada."
  );
  const [messages, setMessages] = useState<{ role: string; text: string }[]>(
    []
  );
  const [pending, setPending] = useState<{
    text: string;
    handoff: boolean;
  } | null>(null);
  const preview = trpc.nativeBot.preview.useMutation({ onError: err });
  const run = async (message: string, event?: (typeof BOT_EVENTS)[number]) => {
    if (!message.trim() || preview.isPending || pending) return;
    setMessages(m => [
      ...m,
      {
        role: event ? "system" : "client",
        text: event ? "Evento: " + BOT_EVENT_LABELS[event] : message,
      },
    ]);
    setText("");
    try {
      const result = await preview.mutateAsync({
        artistId: s.profile.artistId,
        text: message,
        name,
        outside,
        human,
        useAi: ai,
        event,
      });
      setTrace(result.reason);
      if (result.text) {
        if (result.delayMinutes) {
          setPending({ text: result.text, handoff: result.handoff });
          setTrace(
            result.reason +
              ` · espera de ${result.delayMinutes} min. Use “Avançar espera”.`
          );
        } else {
          setMessages(m => [...m, { role: "bot", text: result.text! }]);
          if (result.handoff) setHuman(true);
        }
      }
    } catch {}
  };
  return (
    <div className="bot-grid bot-simulator">
      <div className="bot-stack">
        <Notice>
          <strong>Simulação.</strong> Nenhuma mensagem é enviada ao cliente. A
          opção “Testar com IA real” consulta a API do estúdio.
        </Notice>
        <Panel className="bot-chat-panel">
          <header className="bot-chat-head">
            <TatueiBotIcon />
            <div>
              <strong>{name || "Cliente de teste"}</strong>
              <p>
                {s.profile.config.name} · {human ? "Com a equipe" : "Bot"}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setMessages([]);
                setPending(null);
                setHuman(false);
                setTrace("Conversa reiniciada.");
              }}
            >
              Reiniciar
            </Button>
          </header>
          <div className="bot-chat" aria-live="polite" role="log">
            {messages.length ? (
              messages.map((m, i) => (
                <div key={i} className={"bot-bubble " + m.role}>
                  <small>
                    {m.role === "client"
                      ? "Cliente"
                      : m.role === "system"
                        ? "Simulação"
                        : s.profile.config.name}
                  </small>
                  {m.text}
                </div>
              ))
            ) : (
              <Empty title="Converse como cliente">
                <p>Comece com “Olá” ou uma pergunta da sua base.</p>
              </Empty>
            )}
          </div>
          {pending && (
            <div className="bot-pending">
              Espera simulada
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setMessages(m => [...m, { role: "bot", text: pending.text }]);
                  setHuman(pending.handoff);
                  setPending(null);
                }}
              >
                Avançar espera
              </Button>
            </div>
          )}
          <form
            className="bot-composer"
            onSubmit={e => {
              e.preventDefault();
              void run(text);
            }}
          >
            <Input
              aria-label="Mensagem de teste"
              placeholder="Escreva uma mensagem…"
              value={text}
              onChange={e => setText(e.target.value)}
              maxLength={3000}
              required
            />
            <Button
              disabled={preview.isPending || !!pending}
              aria-label="Enviar mensagem de teste"
            >
              <Send size={17} />
            </Button>
          </form>
          <div className="bot-quick">
            {[
              "Olá",
              "Qual o endereço?",
              "Qual o horário?",
              "Quero falar com alguém",
            ].map(t => (
              <button
                key={t}
                disabled={preview.isPending || !!pending}
                onClick={() => void run(t)}
              >
                {t}
              </button>
            ))}
          </div>
        </Panel>
      </div>
      <div className="bot-stack">
        <Panel title="Cenário de teste">
          <Field id="sim-name" label="Primeiro nome fictício">
            <Input
              id="sim-name"
              required
              value={name}
              onChange={e => setName(e.target.value)}
              maxLength={80}
            />
          </Field>
          <Toggle
            label="Simular fora do horário"
            value={outside}
            onChange={setOutside}
          />
          <Toggle label="Testar com IA real" value={ai} onChange={setAi} />
          <p className="bot-hint">
            A IA precisa estar habilitada nesta assistente e configurada pelo
            estúdio. O uso consome a cota da API.
          </p>
          <Button
            variant="outline"
            onClick={() => {
              setHuman(!human);
              setPending(null);
            }}
          >
            {human ? "Retomar bot" : "Assumir atendimento"}
          </Button>
        </Panel>
        <Panel title="Disparar evento">
          <div className="bot-stack">
            {BOT_EVENTS.filter(k => k !== "greeting").map(event => (
              <Button
                key={event}
                variant="outline"
                className="justify-between"
                disabled={preview.isPending || !!pending}
                onClick={() => void run("Evento de teste", event)}
              >
                {BOT_EVENT_LABELS[event]}
                <ArrowRight size={15} />
              </Button>
            ))}
          </div>
        </Panel>
        <Panel title="Por trás da resposta">
          <p className="bot-trace">
            <Check size={16} />
            {trace}
          </p>
        </Panel>
      </div>
    </div>
  );
}
function Team({
  enabled,
  done,
}: {
  enabled: boolean;
  done: () => Promise<unknown>;
}) {
  const utils = trpc.useUtils();
  const team = trpc.nativeBot.team.useQuery();
  const setEnabled = trpc.nativeBot.setEnabled.useMutation({
    onError: err,
    onSuccess: async () => {
      await done();
      toast.success("Disponibilidade do bot atualizada.");
    },
  });
  const setAccess = trpc.nativeBot.setArtistAccess.useMutation({
    onError: err,
    onSuccess: async () => {
      await Promise.all([utils.nativeBot.team.invalidate(), done()]);
      toast.success("Permissões atualizadas.");
    },
  });
  return (
    <div className="bot-stack">
      <Panel
        title="O estúdio decide quem tem acesso"
        sub="Pausar o módulo cancela mensagens pendentes e suspende novas respostas automáticas."
        extra={
          <Toggle
            label="Bot ativo no estúdio"
            value={enabled}
            disabled={setEnabled.isPending}
            onChange={v => setEnabled.mutate({ enabled: v })}
          />
        }
      >
        {setEnabled.isPending && <p role="status">Atualizando…</p>}
      </Panel>
      {team.error && <Notice>{team.error.message}</Notice>}
      {team.isLoading ? (
        <p>Carregando equipe…</p>
      ) : team.data?.length ? (
        team.data.map(a => (
          <Panel
            key={a.id}
            title={a.name}
            sub={a.specialty || "Artista do estúdio"}
            extra={
              <Toggle
                label="Bot liberado"
                value={a.enabled}
                disabled={setAccess.isPending}
                onChange={enabled =>
                  setAccess.mutate({
                    artistId: a.id,
                    enabled,
                    permissions: a.permissions,
                  })
                }
              />
            }
          >
            <div className="bot-permissions">
              {(
                [
                  ["assistant", "Editar assistente"],
                  ["messages", "Editar mensagens"],
                  ["rules", "Configurar automações"],
                  ["clients", "Gerenciar clientes"],
                ] as const
              ).map(([key, label]) => (
                <Toggle
                  key={key}
                  label={label}
                  value={a.permissions[key]}
                  disabled={!a.enabled || setAccess.isPending}
                  onChange={v =>
                    setAccess.mutate({
                      artistId: a.id,
                      enabled: a.enabled,
                      permissions: { ...a.permissions, [key]: v },
                    })
                  }
                />
              ))}
            </div>
          </Panel>
        ))
      ) : (
        <Empty title="Nenhum artista cadastrado">
          <p>Cadastre os artistas no menu Artistas do CRM.</p>
        </Empty>
      )}
      <Notice>
        Cada artista vê somente suas conversas e os clientes vinculados ao seu
        cadastro. As credenciais do estúdio ficam sob controle do gestor.
      </Notice>
    </div>
  );
}
function Connections({
  data: s,
  done,
}: {
  data: Snapshot;
  done: () => Promise<unknown>;
}) {
  const [wa, setWa] = useState({ instanceId: "", token: "", clientToken: "" });
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState(s.connection?.aiModel || "gpt-4.1-mini");
  const [limit, setLimit] = useState(s.connection?.aiDailyLimit || 200);
  const [qrImage, setQrImage] = useState<string | null>(null);
  const [replace, setReplace] = useState(false);
  const waSave = trpc.nativeBot.saveWhatsapp.useMutation({ onError: err });
  const aiSave = trpc.nativeBot.saveAi.useMutation({ onError: err });
  const qr = trpc.nativeBot.qr.useMutation({
    onError: err,
    onSuccess: r => setQrImage(r.image),
  });
  const verify = trpc.nativeBot.verifyWhatsapp.useMutation({
    onError: err,
    onSuccess: async r => {
      await done();
      if (r.connected) {
        setQrImage(null);
        toast.success("WhatsApp conectado e recebimento configurado.");
      } else
        toast.info(
          "O provedor ainda não confirmou a conexão. Leia o QR e tente novamente."
        );
    },
  });
  const remove = trpc.nativeBot.removeWhatsapp.useMutation({
    onError: err,
    onSuccess: async () => {
      await done();
      toast.success("Conexão removida do CRM.");
    },
  });
  const saveWa = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await waSave.mutateAsync(wa);
      setWa({ instanceId: "", token: "", clientToken: "" });
      setReplace(false);
      setQrImage(null);
      await done();
      toast.success("Credenciais salvas. Gere o QR para continuar.");
    } catch {}
  };
  const saveAi = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await aiSave.mutateAsync({
        key: apiKey || undefined,
        model,
        dailyLimit: limit,
      });
      setApiKey("");
      await done();
      toast.success("Configuração da IA salva.");
    } catch {}
  };
  return (
    <div className="bot-stack">
      <div className="bot-grid">
        <Panel
          title="WhatsApp do estúdio"
          sub="Conexão por QR usando uma instância Z-API."
          extra={
            <Badge
              variant={
                s.connection?.whatsappStatus === "connected"
                  ? "default"
                  : "secondary"
              }
            >
              {s.connection?.whatsappStatus === "connected"
                ? "Conectado"
                : s.connection?.whatsappConfigured
                  ? "Aguardando conexão"
                  : "Não configurado"}
            </Badge>
          }
        >
          <Notice>
            Este conector exige conta e credenciais próprias da Z-API, um
            serviço externo. Ele não é a API oficial da Meta. Use uma instância
            dedicada ao Bot Tatuei.
          </Notice>
          {!s.connection?.whatsappConfigured || replace ? (
            <form onSubmit={saveWa}>
              <Field id="wa-instance" label="ID da instância">
                <Input
                  id="wa-instance"
                  required
                  value={wa.instanceId}
                  onChange={e => setWa({ ...wa, instanceId: e.target.value })}
                  autoComplete="off"
                />
              </Field>
              <Field id="wa-token" label="Token da instância">
                <Input
                  id="wa-token"
                  type="password"
                  required
                  value={wa.token}
                  onChange={e => setWa({ ...wa, token: e.target.value })}
                  autoComplete="new-password"
                />
              </Field>
              <Field
                id="wa-client-token"
                label="Token de segurança da conta (Client-Token)"
              >
                <Input
                  id="wa-client-token"
                  type="password"
                  required
                  value={wa.clientToken}
                  onChange={e => setWa({ ...wa, clientToken: e.target.value })}
                  autoComplete="new-password"
                />
              </Field>
              <div className="bot-actions">
                <Button disabled={waSave.isPending}>
                  {waSave.isPending ? "Salvando…" : "Salvar credenciais"}
                </Button>
                {replace && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setReplace(false)}
                  >
                    Cancelar
                  </Button>
                )}
              </div>
            </form>
          ) : (
            <div className="bot-stack">
              <p className="bot-hint">
                Credenciais protegidas no servidor. O QR é solicitado
                diretamente ao provedor e expira conforme a sessão.
              </p>
              <div className="bot-actions">
                <Button onClick={() => qr.mutate()} disabled={qr.isPending}>
                  {qr.isPending ? "Solicitando QR…" : "Gerar QR de conexão"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => verify.mutate()}
                  disabled={verify.isPending}
                >
                  {verify.isPending
                    ? "Verificando…"
                    : "Validar conexão e recebimento"}
                </Button>
              </div>
              <p className="bot-hint">
                Validar configura o recebimento desta instância para o Bot
                Tatuei, substituindo seu webhook anterior.
              </p>
              <div className="bot-actions">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setReplace(true)}
                >
                  Trocar credenciais
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={remove.isPending}
                  onClick={() => {
                    if (
                      window.confirm(
                        "Remover esta conexão do CRM e cancelar os envios pendentes? A instância continuará existindo no provedor."
                      )
                    )
                      remove.mutate();
                  }}
                >
                  Remover do CRM
                </Button>
              </div>
            </div>
          )}
          {s.connection?.lastError && (
            <p role="alert" className="bot-error">
              {s.connection.lastError}
            </p>
          )}
          <div className="bot-divider" />
          <p className="bot-hint">
            Os artistas autorizados atendem pelo número do estúdio. Um número
            particular do artista precisaria de outra conexão.
          </p>
        </Panel>
        <Panel
          title="Assistente com IA"
          sub="Chave própria do estúdio · OpenAI API"
          extra={
            <Badge
              variant={s.connection?.aiConfigured ? "default" : "secondary"}
            >
              {s.connection?.aiConfigured ? "Chave configurada" : "Sem chave"}
            </Badge>
          }
        >
          <form onSubmit={saveAi}>
            <Field
              id="ai-key"
              label={
                s.connection?.aiConfigured
                  ? "Nova chave (deixe vazio para manter)"
                  : "Chave da API"
              }
            >
              <Input
                id="ai-key"
                type="password"
                autoComplete="new-password"
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                required={!s.connection?.aiConfigured}
                placeholder="Chave fornecida pela sua conta de API"
              />
            </Field>
            <Field
              id="ai-model"
              label="Modelo da API"
              hint="Use um modelo com Chat Completions e saída JSON disponível em sua conta."
            >
              <Input
                id="ai-model"
                required
                value={model}
                onChange={e => setModel(e.target.value)}
              />
            </Field>
            <Field
              id="ai-limit"
              label="Limite diário de respostas de IA"
              hint="Compartilhado pelos artistas do estúdio. Cada consulta consome a cota da API."
            >
              <Input
                id="ai-limit"
                type="number"
                min={1}
                max={10000}
                required
                value={limit}
                onChange={e => setLimit(Number(e.target.value))}
              />
            </Field>
            <div className="bot-actions">
              <Button disabled={aiSave.isPending}>
                {aiSave.isPending ? "Salvando…" : "Salvar IA"}
              </Button>
              {s.connection?.aiConfigured && (
                <Button
                  type="button"
                  variant="outline"
                  disabled={aiSave.isPending}
                  onClick={async () => {
                    if (
                      window.confirm("Remover a chave de IA deste estúdio?")
                    ) {
                      try {
                        await aiSave.mutateAsync({
                          model,
                          dailyLimit: limit,
                          remove: true,
                        });
                        await done();
                        toast.success("Chave removida.");
                      } catch {}
                    }
                  }}
                >
                  Remover chave
                </Button>
              )}
            </div>
          </form>
          <div className="bot-divider" />
          <Notice>
            Ative “Usar IA” na assistente desejada e teste no Simulador. Sem IA,
            o bot continua usando mensagens e respostas rápidas cadastradas.
          </Notice>
        </Panel>
      </div>
      <Dialog open={!!qrImage} onOpenChange={v => !v && setQrImage(null)}>
        <DialogContent className="bot-dialog">
          <DialogHeader>
            <DialogTitle>Conectar WhatsApp</DialogTitle>
            <DialogDescription>
              Abra o WhatsApp Business no celular, acesse Aparelhos conectados e
              leia este QR fornecido pela Z-API.
            </DialogDescription>
          </DialogHeader>
          {qrImage && (
            <img
              className="bot-qr"
              src={qrImage}
              alt="QR de conexão do WhatsApp fornecido pela Z-API"
            />
          )}
          <p className="bot-hint">
            Se o código expirar, solicite outro. A confirmação da conexão vem do
            provedor.
          </p>
          <div className="bot-actions">
            <Button
              variant="outline"
              onClick={() => qr.mutate()}
              disabled={qr.isPending}
            >
              Atualizar QR
            </Button>
            <Button onClick={() => verify.mutate()} disabled={verify.isPending}>
              Já li o QR · validar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
function BotClients({
  data: s,
  openThread,
}: {
  data: Snapshot;
  openThread: (id: number) => void;
}) {
  const utils = trpc.useUtils();
  const [search, setSearch] = useState("");
  const [offset, setOffset] = useState(0);
  const list = trpc.nativeBot.clients.useQuery({ search, offset });
  const [draft, setDraft] = useState<{
    id?: number;
    name: string;
    phone: string;
    artistId: number;
    birthDate: string;
  } | null>(null);
  const save = trpc.nativeBot.saveClient.useMutation({
    onError: err,
    onSuccess: async () => {
      await Promise.all([
        utils.nativeBot.clients.invalidate(),
        utils.nativeBot.snapshot.invalidate(),
      ]);
      setDraft(null);
      toast.success("Cliente salvo no CRM.");
    },
  });
  const consent = trpc.nativeBot.setConsent.useMutation({
    onError: err,
    onSuccess: () => utils.nativeBot.clients.invalidate(),
  });
  const open = trpc.nativeBot.openConversation.useMutation({
    onError: err,
    onSuccess: r => openThread(r.id),
  });
  return (
    <div className="bot-stack">
      <div className="bot-toolbar">
        <Input
          aria-label="Buscar clientes por nome ou telefone"
          placeholder="Buscar por nome ou telefone"
          value={search}
          onChange={e => {
            setSearch(e.target.value);
            setOffset(0);
          }}
        />
        <Button
          onClick={() =>
            setDraft({
              name: "",
              phone: "",
              artistId: s.manager ? s.artists[0]?.id || 0 : s.profile.artistId,
              birthDate: "",
            })
          }
          disabled={!s.artists.length}
        >
          <Plus size={16} />
          Novo cliente
        </Button>
      </div>
      <Notice>
        Estes são os cadastros reais do CRM. Marque a autorização somente quando
        o cliente tiver concordado com os envios automáticos deste bot.
      </Notice>
      <Panel>
        {list.error ? (
          <p role="alert">{list.error.message}</p>
        ) : list.isLoading ? (
          <p>Carregando clientes…</p>
        ) : (
          <div className="bot-table-wrap">
            <table className="bot-table">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Artista</th>
                  <th>Autoriza automações</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {list.data?.map(c => (
                  <tr key={c.id}>
                    <td>
                      <strong>{c.name}</strong>
                      <p>{c.phone || "Sem telefone"}</p>
                    </td>
                    <td>{c.artistName || "Não vinculado"}</td>
                    <td>
                      <Toggle
                        label={c.optIn ? "Autorizado" : "Não autorizado"}
                        value={!!c.optIn}
                        disabled={consent.isPending}
                        onChange={enabled =>
                          consent.mutate({ clientId: c.id, enabled })
                        }
                      />
                    </td>
                    <td>
                      <div className="bot-actions">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => open.mutate({ clientId: c.id })}
                          disabled={!c.phone || open.isPending}
                        >
                          <MessageSquare size={14} />
                          Conversa
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={!c.artistId}
                          onClick={() =>
                            setDraft({
                              id: c.id,
                              name: c.name,
                              phone: c.phone || "",
                              artistId: c.artistId!,
                              birthDate: c.birthDate?.slice(0, 10) || "",
                            })
                          }
                        >
                          Editar
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!list.data?.length && <Empty title="Nenhum cliente encontrado" />}
          </div>
        )}
        <Pager
          offset={offset}
          size={100}
          count={list.data?.length || 0}
          set={setOffset}
        />
      </Panel>
      <Dialog open={!!draft} onOpenChange={v => !v && setDraft(null)}>
        <DialogContent className="bot-dialog">
          <DialogHeader>
            <DialogTitle>
              {draft?.id ? "Editar cliente" : "Novo cliente"}
            </DialogTitle>
            <DialogDescription>
              O cadastro será salvo no CRM e vinculado ao artista responsável.
            </DialogDescription>
          </DialogHeader>
          {draft && (
            <form
              onSubmit={e => {
                e.preventDefault();
                save.mutate({
                  ...draft,
                  birthDate: draft.birthDate || undefined,
                });
              }}
            >
              <Field id="bot-client-name" label="Nome">
                <Input
                  id="bot-client-name"
                  required
                  maxLength={150}
                  value={draft.name}
                  onChange={e => setDraft({ ...draft, name: e.target.value })}
                />
              </Field>
              <Field id="bot-client-phone" label="Telefone com DDD">
                <Input
                  id="bot-client-phone"
                  type="tel"
                  required
                  maxLength={25}
                  value={draft.phone}
                  onChange={e => setDraft({ ...draft, phone: e.target.value })}
                />
              </Field>
              <Field id="bot-client-artist" label="Artista responsável">
                <select
                  id="bot-client-artist"
                  required
                  disabled={!s.manager || !!draft.id}
                  value={draft.artistId}
                  onChange={e =>
                    setDraft({ ...draft, artistId: Number(e.target.value) })
                  }
                >
                  <option value={0} disabled>
                    Selecione
                  </option>
                  {s.artists.map(a => (
                    <option value={a.id} key={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field
                id="bot-client-birth"
                label="Data de nascimento (opcional)"
              >
                <Input
                  type="date"
                  id="bot-client-birth"
                  value={draft.birthDate}
                  onChange={e =>
                    setDraft({ ...draft, birthDate: e.target.value })
                  }
                />
              </Field>
              <Button disabled={save.isPending}>
                {save.isPending ? "Salvando…" : "Salvar cliente"}
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
const statusLabels: Record<string, string> = {
  received: "Recebida",
  processed: "Recebida",
  processing: "Em processamento",
  queued: "Na fila",
  sending: "Enviando",
  sent: "Aceita pelo provedor",
  failed: "Falha",
  uncertain: "Envio não confirmado",
  canceled: "Cancelada",
};
function Conversations({
  data: s,
  selected,
  select,
}: {
  data: Snapshot;
  selected: number | null;
  select: (n: number) => void;
}) {
  const utils = trpc.useUtils();
  const [search, setSearch] = useState("");
  const [offset, setOffset] = useState(0);
  const [body, setBody] = useState("");
  const [assigning, setAssigning] = useState(false);
  const [clientSearch, setClientSearch] = useState("");
  const [clientId, setClientId] = useState("");
  const list = trpc.nativeBot.conversations.useQuery(
    { search, offset },
    { refetchInterval: 8000, retry: false }
  );
  const thread = trpc.nativeBot.thread.useQuery(
    { id: selected || 0 },
    { enabled: !!selected, refetchInterval: 8000, retry: false }
  );
  const clients = trpc.nativeBot.clients.useQuery(
    { search: clientSearch, offset: 0 },
    { enabled: assigning && s.manager }
  );
  const refresh = async () => {
    await Promise.all([
      utils.nativeBot.conversations.invalidate(),
      utils.nativeBot.thread.invalidate(),
      utils.nativeBot.snapshot.invalidate(),
    ]);
  };
  const mode = trpc.nativeBot.setMode.useMutation({
    onError: err,
    onSuccess: refresh,
  });
  const send = trpc.nativeBot.send.useMutation({
    onError: err,
    onSuccess: async () => {
      setBody("");
      await refresh();
      toast.success(
        "Mensagem registrada na fila. Acompanhe a confirmação do provedor."
      );
    },
  });
  const assign = trpc.nativeBot.assignConversation.useMutation({
    onError: err,
    onSuccess: async () => {
      setAssigning(false);
      await refresh();
      toast.success(
        "Conversa vinculada. O atendimento ficou com a equipe para revisão."
      );
    },
  });
  useEffect(() => {
    if (!selected && list.data?.length) select(list.data[0].id);
  }, [list.data, selected]);
  const cv = thread.data?.conversation;
  return (
    <div className="bot-conversations">
      <Panel
        title="Conversas"
        sub="Atualização automática a cada 8 segundos."
        className="bot-thread-list"
      >
        <Input
          aria-label="Buscar conversas"
          placeholder="Nome ou telefone"
          value={search}
          onChange={e => {
            setSearch(e.target.value);
            setOffset(0);
          }}
        />
        {list.error && <p role="alert">{list.error.message}</p>}
        <div className="bot-thread-items">
          {list.data?.length ? (
            list.data.map(t => (
              <button
                key={t.id}
                className={selected === t.id ? "selected" : ""}
                onClick={() => {
                  select(t.id);
                  setBody("");
                }}
              >
                <div>
                  <strong>{t.name}</strong>
                  <span>{t.mode === "human" ? "Equipe" : "Bot"}</span>
                </div>
                <p>{t.lastBody?.slice(0, 95) || "Conversa iniciada no CRM"}</p>
                <small>
                  {t.artistName || "Geral do estúdio"} · {when(t.updated_at)}
                </small>
              </button>
            ))
          ) : (
            <Empty title="Sem conversas">
              <p>
                As mensagens aparecerão aqui após conectar o WhatsApp. Você
                também pode abrir uma conversa em Clientes.
              </p>
            </Empty>
          )}
        </div>
        <Pager
          offset={offset}
          size={60}
          count={list.data?.length || 0}
          set={setOffset}
        />
      </Panel>
      <Panel className="bot-chat-panel">
        {thread.error ? (
          <Notice>{thread.error.message}</Notice>
        ) : !selected ? (
          <Empty title="Escolha uma conversa" />
        ) : !cv ? (
          <p className="p-5">Carregando conversa…</p>
        ) : (
          <>
            <header className="bot-chat-head">
              <TatueiBotIcon />
              <div>
                <strong>{cv.name}</strong>
                <p>
                  {cv.phone} ·{" "}
                  {cv.mode === "human"
                    ? "Com a equipe"
                    : "Bot ativo na conversa"}
                </p>
              </div>
              <Badge variant="secondary">
                {cv.opted_out
                  ? "Interrompido pelo cliente"
                  : cv.client_id
                    ? "Cliente vinculado"
                    : "Sem cadastro vinculado"}
              </Badge>
            </header>
            <div className="bot-conversation-actions">
              <Button
                size="sm"
                variant="outline"
                disabled={mode.isPending || !!cv.opted_out}
                onClick={() =>
                  mode.mutate({
                    id: selected,
                    mode: cv.mode === "human" ? "bot" : "human",
                  })
                }
              >
                {cv.mode === "human" ? "Retomar bot" : "Assumir atendimento"}
              </Button>
              {s.manager && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setClientSearch(cv.phone.slice(-4));
                    setClientId("");
                    setAssigning(true);
                  }}
                >
                  Vincular cadastro / artista
                </Button>
              )}
            </div>
            <div
              className="bot-chat bot-live-chat"
              aria-live="polite"
              role="log"
            >
              {thread.data?.messages.length ? (
                thread.data.messages.map(m => (
                  <div key={m.id} className={"bot-bubble " + m.role}>
                    <small>
                      {m.role === "client"
                        ? cv.name
                        : m.role === "staff"
                          ? "Equipe"
                          : "Bot Tatuei"}{" "}
                      · {when(m.created_at)}
                    </small>
                    <span>{m.body}</span>
                    <small
                      className={
                        ["failed", "uncertain"].includes(m.status)
                          ? "bot-error"
                          : ""
                      }
                    >
                      {statusLabels[m.status] || m.status}
                      {m.status === "queued" ? " · " + when(m.due_at) : ""}
                    </small>
                    {m.error && <small>{m.error}</small>}
                  </div>
                ))
              ) : (
                <Empty title="Conversa pronta para atendimento">
                  <p>Enviar uma mensagem coloca a equipe no controle.</p>
                </Empty>
              )}
            </div>
            <form
              className="bot-composer"
              onSubmit={e => {
                e.preventDefault();
                if (body.trim())
                  send.mutate({
                    id: selected,
                    body,
                    requestId: crypto.randomUUID(),
                  });
              }}
            >
              <Input
                aria-label="Resposta da equipe"
                placeholder="Resposta manual da equipe…"
                value={body}
                onChange={e => setBody(e.target.value)}
                maxLength={4000}
                required
                disabled={!!cv.opted_out}
              />
              <Button
                disabled={send.isPending || !!cv.opted_out}
                aria-label="Enviar resposta da equipe"
              >
                <Send size={16} />
              </Button>
            </form>
            <p className="bot-hint px-4 pb-4">
              Responder manualmente pausa o bot. Mensagens já em envio podem
              concluir antes da troca de atendimento.
            </p>
          </>
        )}
      </Panel>
      <Dialog open={assigning} onOpenChange={setAssigning}>
        <DialogContent className="bot-dialog">
          <DialogHeader>
            <DialogTitle>Vincular conversa ao cadastro</DialogTitle>
            <DialogDescription>
              Escolha um cliente com o mesmo telefone. O artista desse cadastro
              passará a ter acesso ao histórico desta conversa.
            </DialogDescription>
          </DialogHeader>
          <Field label="Buscar cliente" id="assign-search">
            <Input
              id="assign-search"
              value={clientSearch}
              onChange={e => setClientSearch(e.target.value)}
            />
          </Field>
          <Field label="Cliente responsável pela conversa" id="assign-client">
            <select
              id="assign-client"
              value={clientId}
              onChange={e => setClientId(e.target.value)}
            >
              <option value="">Selecione</option>
              {clients.data?.map(c => (
                <option value={c.id} key={c.id}>
                  {c.name} · {c.artistName || "Sem artista"} · {c.phone}
                </option>
              ))}
            </select>
          </Field>
          <Button
            disabled={!clientId || assign.isPending || !selected}
            onClick={() =>
              assign.mutate({ id: selected!, clientId: Number(clientId) })
            }
          >
            Vincular e manter com a equipe
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
function BotHistory() {
  const [offset, setOffset] = useState(0);
  const h = trpc.nativeBot.history.useQuery(
    { offset },
    { refetchInterval: 15000 }
  );
  return (
    <Panel
      title="Histórico do Bot Tatuei"
      sub="Alterações, envios e passagens de atendimento visíveis para o seu perfil."
    >
      {h.error ? (
        <p role="alert">{h.error.message}</p>
      ) : h.isLoading ? (
        <p>Carregando histórico…</p>
      ) : h.data?.length ? (
        h.data.map(r => (
          <div className="bot-history" key={r.id}>
            <Clock size={16} />
            <div>
              <strong>{r.action}</strong>
              <p>{r.detail}</p>
            </div>
            <time>{when(r.created_at)}</time>
          </div>
        ))
      ) : (
        <Empty title="Nenhuma atividade registrada">
          <p>As ações feitas neste módulo aparecerão aqui.</p>
        </Empty>
      )}
      <Pager
        offset={offset}
        size={100}
        count={h.data?.length || 0}
        set={setOffset}
      />
    </Panel>
  );
}
