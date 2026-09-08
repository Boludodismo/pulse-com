import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  INBOX_METRICS,
  type InboxModule,
} from "../../../shared/intelligentInbox";
import { Inbox, Settings, Clock } from "lucide-react";
const sections: [string, string, InboxModule][] = [
  ["overview", "Visão geral", "intelligent_inbox"],
  ["conversations", "Conversas", "inbox_conversations"],
  ["waiting", "Aguardando resposta", "inbox_conversations"],
  ["quotes", "Novos orçamentos", "inbox_conversations"],
  ["opportunities", "Oportunidades", "inbox_opportunities"],
  ["priorities", "Prioridades", "inbox_priorities"],
  ["resolved", "Resolvidos", "inbox_conversations"],
  ["history", "Histórico de resumos", "inbox_summaries"],
  ["settings", "Configuração da integração", "inbox_settings"],
];
export default function IntelligentInbox() {
  const { user } = useAuth();
  const [section, setSection] = useState("overview");
  const access = trpc.intelligentInbox.access.useQuery(undefined, {
    enabled: !!user?.studioId,
    refetchInterval: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: false,
  });
  const can = (module: InboxModule) =>
    !!access.data?.permissions.find(p => p.module === module)?.canRead;
  if (!user?.studioId)
    return (
      <p className="p-4">
        Selecione uma empresa ativa para abrir a Central Inteligente.
      </p>
    );
  if (access.isLoading)
    return (
      <p role="status" className="p-4">
        Verificando acesso…
      </p>
    );
  if (access.error || !can("intelligent_inbox"))
    return (
      <section className="p-4 space-y-2">
        <h1 className="text-2xl font-bold">Central Inteligente</h1>
        <p role="alert">
          Você não tem acesso à Central Inteligente deste estúdio. Consulte o
          administrador.
        </p>
      </section>
    );
  const active =
    sections.find(s => s[0] === section && can(s[2])) || sections[0];
  return (
    <main className="w-full min-w-0 max-w-7xl mx-auto p-3 sm:p-6 space-y-5 break-words">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold flex gap-2 items-start">
            <Inbox className="shrink-0 mt-1" />
            Central Inteligente de Atendimentos
          </h1>
          <p className="text-muted-foreground mt-2">
            Seus atendimentos reunidos em uma visão organizada.
          </p>
        </div>
        <Badge variant="outline" className="w-fit whitespace-normal shrink-0">
          Em preparação · desativada
        </Badge>
      </header>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Integração não configurada</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p>
            Esta funcionalidade permitirá reunir, organizar e resumir
            automaticamente os atendimentos recebidos pelo BotConversa. A
            conexão e os recursos inteligentes serão disponibilizados em uma
            próxima etapa.
          </p>
          <p className="text-sm text-muted-foreground">
            Nenhuma mensagem está sendo recebida, analisada ou enviada por esta
            Central. Não é necessário configurar nada para continuar usando o
            CRM.
          </p>
          {can("inbox_settings") && (
            <Button
              variant="outline"
              className="whitespace-normal h-auto min-h-10"
              onClick={() => setSection("settings")}
            >
              <Settings className="shrink-0 mr-2 h-4 w-4" />
              Configurar integração
            </Button>
          )}
        </CardContent>
      </Card>
      <nav
        aria-label="Seções da Central Inteligente"
        className="flex flex-wrap gap-2"
      >
        {sections
          .filter(s => can(s[2]))
          .map(([key, label]) => (
            <Button
              key={key}
              variant={active[0] === key ? "default" : "outline"}
              aria-pressed={active[0] === key}
              className="h-auto min-h-10 whitespace-normal text-left"
              onClick={() => setSection(key)}
            >
              {label}
            </Button>
          ))}
      </nav>
      {active[0] === "settings" ? (
        <Card>
          <CardHeader>
            <CardTitle>Configuração futura · BotConversa</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p>
              Integração não configurada. Não são solicitados tokens, chaves de
              API ou webhook nesta etapa.
            </p>
            <dl className="grid gap-3 sm:grid-cols-2">
              {[
                ["Nome da integração", "Não definido"],
                ["Identificador externo", "Não definido"],
                ["Data da conexão", "Nunca conectado"],
                ["Última sincronização", "Nunca sincronizado"],
                ["Webhook", "Não configurado"],
                ["Sincronização", "Desativada"],
                ["Resumo inteligente", "Desativado"],
                [
                  "Periodicidade futura",
                  "A cada 60 minutos — rotina não criada",
                ],
              ].map(([label, value]) => (
                <div key={label} className="rounded-lg border p-3 min-w-0">
                  <dt className="text-sm text-muted-foreground">{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
            <Button disabled className="whitespace-normal h-auto min-h-10">
              Conexão disponível em uma próxima etapa
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {INBOX_METRICS.filter(([key]) =>
              key === "opportunities"
                ? can("inbox_opportunities")
                : key === "highPriority"
                  ? can("inbox_priorities")
                  : true
            ).map(([key, label]) => (
              <Card key={key}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">{label}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-semibold text-muted-foreground">
                    0
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Dados disponíveis após conectar o BotConversa.
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
          <Card>
            <CardHeader>
              <CardTitle>{active[1]}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <label className="text-sm">
                  Buscar atendimento
                  <Input
                    disabled
                    placeholder="Nome, telefone, cliente ou assunto"
                  />
                </label>
                <label className="text-sm">
                  Período
                  <select
                    disabled
                    className="w-full min-w-0 rounded-md border bg-background p-2"
                  >
                    <option>Hoje</option>
                    <option>Última hora</option>
                    <option>Últimas 24 horas</option>
                  </select>
                </label>
                <label className="text-sm">
                  Tipo de atendimento
                  <select
                    disabled
                    className="w-full min-w-0 rounded-md border bg-background p-2"
                  >
                    {[
                      "Todos",
                      "Aguardando resposta",
                      "Urgentes",
                      "Orçamentos",
                      "Reagendamentos",
                      "Cancelamentos",
                      "Oportunidades",
                      "Resolvidos",
                    ].map(x => (
                      <option key={x}>{x}</option>
                    ))}
                  </select>
                </label>
                <label className="text-sm">
                  Artista responsável
                  <Input disabled placeholder="Todos os artistas" />
                </label>
                <label className="text-sm">
                  Atendente responsável
                  <Input disabled placeholder="Todos os atendentes" />
                </label>
              </div>
              <div className="rounded-lg border border-dashed p-5 text-center space-y-2">
                <Clock className="mx-auto text-muted-foreground" />
                <p>Nenhum atendimento ou resumo disponível.</p>
                <p className="text-sm text-muted-foreground">
                  Nenhum dado de demonstração foi inserido. Os filtros estarão
                  disponíveis após a integração.
                </p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Detalhe do atendimento · estrutura futura</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                O atendimento será relacionado ao cadastro atual do cliente, sem
                criar outra ficha.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  "Resumo atual",
                  "Última interação",
                  "Tempo aguardando resposta",
                  "Classificação",
                  "Prioridade",
                  "Intenção de compra",
                  "Pendências",
                  "Próxima ação recomendada",
                  "Histórico de resumos",
                ].map(label => (
                  <div className="border rounded p-3" key={label}>
                    <p className="text-sm text-muted-foreground">{label}</p>
                    <p>Sem dados</p>
                  </div>
                ))}
              </div>
              <div
                className="flex flex-wrap gap-2"
                aria-label="Participantes futuros da conversa"
              >
                {["Cliente", "Atendente", "Automação", "IA"].map(label => (
                  <Badge key={label} variant="outline">
                    {label}
                  </Badge>
                ))}
              </div>
              {can("inbox_suggestions") && (
                <div>
                  <Button
                    disabled
                    className="whitespace-normal h-auto min-h-10"
                  >
                    Gerar resposta sugerida
                  </Button>
                  <p className="text-sm text-muted-foreground mt-2">
                    IA não configurada. Nenhuma resposta será gerada.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </main>
  );
}
