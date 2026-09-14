import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { INBOX_METRICS, type InboxModule } from "../../../shared/intelligentInbox";
import { Inbox, Settings, Clock, MessageSquare, ShieldCheck } from "lucide-react";

const sections: [string, string, InboxModule][] = [
  ["overview", "Visão geral", "intelligent_inbox"], ["conversations", "Conversas", "inbox_conversations"],
  ["waiting", "Aguardando resposta", "inbox_conversations"], ["quotes", "Novos orçamentos", "inbox_conversations"],
  ["opportunities", "Oportunidades", "inbox_opportunities"], ["priorities", "Prioridades", "inbox_priorities"],
  ["resolved", "Resolvidos", "inbox_conversations"], ["history", "Histórico de resumos", "inbox_summaries"],
  ["settings", "Configuração da integração", "inbox_settings"],
];

const labels: Record<string, string> = {
  needs_reply: "Aguardando resposta", quote_request: "Novo orçamento", waiting_information: "Aguardando informação",
  reschedule: "Reagendamento", cancellation: "Cancelamento", reference_received: "Referência recebida",
  high_purchase_intent: "Possível fechamento", complaint: "Reclamação", resolved: "Resolvido", other: "Outro",
};

const filterFor = (section: string) => {
  if (section === "waiting") return { classification: "needs_reply" };
  if (section === "quotes") return { classification: "quote_request" };
  if (section === "opportunities") return { classification: "high_purchase_intent" };
  if (section === "priorities") return { priority: "HIGH" };
  if (section === "resolved") return { classification: "resolved" };
  return {};
};

const formatDate = (value?: string | null) => value ? new Date(value.replace(" ", "T")).toLocaleString("pt-BR") : "—";

export default function IntelligentInbox() {
  const { user } = useAuth();
  const [section, setSection] = useState("overview");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const access = trpc.intelligentInbox.access.useQuery(undefined, { enabled: !!user?.studioId, retry: false });
  const can = (module: InboxModule) => !!access.data?.permissions.find(p => p.module === module)?.canRead;
  const dashboard = trpc.intelligentInbox.dashboard.useQuery(undefined, { enabled: !!user?.studioId, refetchInterval: 30000 });
  const settings = trpc.intelligentInbox.settings.useQuery(undefined, { enabled: !!user?.studioId && section === "settings" });
  const filters = filterFor(section);
  const conversations = trpc.intelligentInbox.conversations.useQuery({ limit: 50, search: search || undefined, ...filters }, { enabled: !!user?.studioId && !!access.data && can("inbox_conversations") && !["settings", "history"].includes(section), refetchInterval: 15000 });
  const messages = trpc.intelligentInbox.messages.useQuery({ conversationId: selectedId ?? 0, limit: 50 }, { enabled: !!selectedId });

  if (!user?.studioId) return <p className="p-4">Selecione uma empresa ativa para abrir a Central Inteligente.</p>;
  if (access.isLoading) return <p role="status" className="p-4">Verificando acesso…</p>;
  if (access.error || !can("intelligent_inbox")) return <section className="p-4"><h1 className="text-2xl font-bold">Central Inteligente</h1><p role="alert">Você não tem acesso à Central Inteligente deste estúdio.</p></section>;
  const active = sections.find(s => s[0] === section && can(s[2])) || sections[0];
  const selected = conversations.data?.items.find(item => item.id === selectedId);
  const operational = !!dashboard.data?.status.operational;

  return <main className="mx-auto w-full min-w-0 max-w-7xl space-y-5 p-3 sm:p-6">
    <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div><h1 className="flex items-center gap-2 text-2xl font-bold"><Inbox />Central Inteligente de Atendimentos</h1><p className="mt-2 text-muted-foreground">Novas mensagens do BotConversa organizadas em modo somente leitura.</p></div>
      <Badge variant="outline" className={operational ? "w-fit border-emerald-600 text-emerald-500" : "w-fit"}>{operational ? "Conectada · somente leitura" : "Aguardando integração"}</Badge>
    </header>

    <Card><CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between"><div className="flex gap-3"><ShieldCheck className={operational ? "text-emerald-500" : "text-muted-foreground"}/><div><p className="font-semibold">{operational ? "Leitura segura ativada" : "Integração BotConversa não encontrada"}</p><p className="text-sm text-muted-foreground">Nenhuma resposta é gerada ou enviada por esta Central.</p></div></div>{can("inbox_settings") && <Button variant="outline" onClick={() => setSection("settings")}><Settings className="mr-2 h-4 w-4"/>Ver integração</Button>}</CardContent></Card>

    <nav aria-label="Seções da Central Inteligente" className="flex flex-wrap gap-2">{sections.filter(s => can(s[2])).map(([key,label]) => <Button key={key} variant={active[0] === key ? "default" : "outline"} onClick={() => { setSection(key); setSelectedId(null); }}>{label}</Button>)}</nav>

    {active[0] === "settings" ? <Card><CardHeader><CardTitle>BotConversa · somente leitura</CardTitle></CardHeader><CardContent className="space-y-4"><div className="grid gap-3 sm:grid-cols-2">{[
      ["Nome da integração", settings.data?.name ?? "Não definida"], ["Identificador", settings.data?.externalId ?? "Não definido"],
      ["Data da conexão", formatDate(settings.data?.connectedAt)], ["Última mensagem recebida", formatDate(settings.data?.lastSyncAt)],
      ["Webhook", settings.data?.webhookConfigured ? "Ativo" : "Não configurado"], ["Captura", settings.data?.syncActive ? "Ativa" : "Desativada"],
      ["Respostas automáticas", "Desativadas"], ["Resumo com IA", "Desativado"],
    ].map(([label,value]) => <div key={label} className="rounded-lg border p-3"><p className="text-sm text-muted-foreground">{label}</p><p>{value}</p></div>)}</div><p className="text-sm text-muted-foreground">A Central apenas recebe e organiza. Não existe botão de resposta nem rotina de disparo nesta versão.</p></CardContent></Card>
    : active[0] === "history" ? <Card><CardContent className="p-8 text-center"><Clock className="mx-auto mb-2 text-muted-foreground"/><p>Resumos automáticos permanecem desativados.</p><p className="text-sm text-muted-foreground">O histórico será ativado em uma etapa futura, sem interferir na leitura atual.</p></CardContent></Card>
    : <>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{INBOX_METRICS.map(([key,label]) => <Card key={key}><CardHeader className="pb-2"><CardTitle className="text-sm">{label}</CardTitle></CardHeader><CardContent><p className="text-3xl font-semibold">{dashboard.data?.metrics[key] ?? 0}</p></CardContent></Card>)}</div>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.8fr)]">
        <Card><CardHeader><CardTitle>{active[1]}</CardTitle></CardHeader><CardContent className="space-y-3"><Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nome, telefone ou mensagem"/>
          {!conversations.data?.items.length ? <div className="rounded-lg border border-dashed p-7 text-center"><MessageSquare className="mx-auto mb-2 text-muted-foreground"/><p>Nenhuma mensagem recebida nesta seção.</p><p className="text-sm text-muted-foreground">Novas mensagens aparecerão aqui após passarem pelo webhook do BotConversa.</p></div>
          : <div className="space-y-2">{conversations.data.items.map(item => <button key={item.id} type="button" onClick={() => setSelectedId(item.id)} className={`w-full rounded-lg border p-3 text-left transition hover:border-primary ${selectedId === item.id ? "border-primary bg-primary/5" : ""}`}><div className="flex flex-wrap items-center justify-between gap-2"><strong>{item.clientName ?? item.phone}</strong><span className="text-xs text-muted-foreground">{formatDate(item.lastInteractionAt)}</span></div><p className="mt-1 line-clamp-2 text-sm">{item.summary}</p><div className="mt-2 flex flex-wrap gap-2"><Badge variant="outline">{labels[item.classification] ?? item.classification}</Badge><Badge variant="outline">{item.priority}</Badge>{item.clientId && <Badge>Cliente vinculado</Badge>}</div></button>)}</div>}
        </CardContent></Card>
        <Card><CardHeader><CardTitle>Detalhe da conversa</CardTitle></CardHeader><CardContent>{!selected ? <p className="text-sm text-muted-foreground">Selecione uma conversa para visualizar as mensagens.</p> : <div className="space-y-4"><div><p className="font-semibold">{selected.clientName}</p><p className="text-sm text-muted-foreground">{selected.phone} · {labels[selected.classification] ?? selected.classification}</p></div><div className="max-h-[500px] space-y-2 overflow-y-auto">{messages.data?.items.slice().reverse().map(message => <div key={message.id} className="rounded-lg border bg-muted/30 p-3"><p className="text-sm">{message.textContent}</p><p className="mt-1 text-[11px] text-muted-foreground">Recebida em {formatDate(message.messageAt)}</p></div>)}</div><div className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">Somente leitura — responda diretamente pelo BotConversa.</div></div>}</CardContent></Card>
      </div>
    </>}
  </main>;
}
