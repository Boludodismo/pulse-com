import { useEffect, useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Search, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { CONSENT_PAGE_SIZE, canManageWhatsappConsent, consentStatusLabel, isWhatsappConsentEnabled, selectStudioConsentIntegration } from "@shared/whatsappConsentUi";

type ConsentRow = {
  clientId: number;
  clientName: string;
  phone: string | null;
  hasWhatsappOptIn: number | null;
  optedOutAt: string | null;
};

function useSaveConsent() {
  const utils = trpc.useUtils();
  return trpc.messaging.setWhatsappConsent.useMutation({
    onSuccess: async () => {
      toast.success("Autorização salva no cadastro. Nenhuma mensagem foi enviada.");
      await Promise.all([
        utils.messaging.listWhatsappConsents.invalidate(),
        utils.clients.list.invalidate(),
      ]);
    },
    onError: error => toast.error(`Não foi possível salvar a autorização: ${error.message}`),
  });
}

function ConsentAction({ contact, integrationId, canManage, busy = false, source, onBusyChange }: {
  contact: ConsentRow; integrationId: number; canManage: boolean; busy?: boolean; source: string; onBusyChange?: (busy: boolean) => void;
}) {
  const save = useSaveConsent();
  useEffect(() => {
    onBusyChange?.(save.isPending);
    return () => onBusyChange?.(false);
  }, [save.isPending, onBusyChange]);
  const enabled = isWhatsappConsentEnabled(contact);
  return <Button type="button" size="sm" variant="outline"
    aria-label={`${enabled ? "Revogar" : "Autorizar"} mensagens para ${contact.clientName}, cadastro ${contact.clientId}`}
    disabled={!canManage || busy || save.isPending || !contact.phone}
    onClick={() => {
      const question = enabled
        ? `Revogar a autorização de mensagens de ${contact.clientName} (cadastro #${contact.clientId})?`
        : `Confirmo que ${contact.clientName} (cadastro #${contact.clientId}) autorizou receber mensagens deste estúdio. Registrar essa autorização?`;
      if (!window.confirm(question)) return;
      save.mutate({ integrationId, clientId: contact.clientId, hasWhatsappOptIn: !enabled, source });
    }}>
    {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
    {enabled ? "Revogar autorização" : "Autorizar mensagens"}
  </Button>;
}

export function useStudioConsentIntegration(studioId: number | null, enabled: boolean) {
  const { data: user } = trpc.auth.me.useQuery();
  const query = trpc.messaging.listIntegrations.useQuery(undefined, { enabled: enabled && Boolean(studioId) });
  const integration = selectStudioConsentIntegration(query.data ?? [], studioId);
  const canManage = canManageWhatsappConsent(user?.role);
  return { integration, canManage, query, canAuthorize: enabled && canManage && Boolean(integration) && !query.isFetching && !query.isError };
}

/** Saved clients use the exact same persisted consent as the messaging directory. */
export function ClientWhatsappConsent({ clientId, studioId, enabled, onBusyChange }: {
  clientId: number; studioId: number | null; enabled: boolean; onBusyChange?: (busy: boolean) => void;
}) {
  const context = useStudioConsentIntegration(studioId, enabled);
  const integrationId = context.integration?.id;
  const query = trpc.messaging.listWhatsappConsents.useQuery(
    { integrationId: integrationId ?? 0, clientId, limit: 1 },
    { enabled: enabled && Boolean(integrationId) && clientId > 0 },
  );
  const contact = query.data?.find(row => row.clientId === clientId);
  const loading = context.query.isFetching || (Boolean(integrationId) && query.isFetching);
  return <section className="mt-3 rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-2" aria-label="Autorização de mensagens do cliente">
    <p className="flex items-center gap-2 text-sm font-semibold"><ShieldCheck className="h-4 w-4" /> Recebimento de mensagens</p>
    {!studioId ? <p className="text-xs text-muted-foreground">Selecione o estúdio antes de registrar uma autorização.</p>
      : context.query.isError || query.isError ? <div role="alert" className="text-xs space-y-2">
        <p>Não foi possível consultar a autorização. Nenhuma permissão foi alterada.</p>
        <Button type="button" variant="outline" size="sm" onClick={() => { void context.query.refetch(); if (integrationId) void query.refetch(); }}>Tentar novamente</Button>
      </div>
      : loading ? <p role="status" className="flex items-center gap-2 text-xs"><Loader2 className="h-3 w-3 animate-spin" /> Consultando autorização…</p>
      : !context.integration ? <p className="text-xs text-muted-foreground">Não há uma única integração ativa neste estúdio. Gerencie a integração em Mensagens. O agendamento pode ser salvo sem autorizar mensagens.</p>
      : !contact ? <p className="text-xs text-muted-foreground">Não foi possível localizar este cliente na lista de autorizações do estúdio.</p>
      : <>
        <div className="flex flex-wrap items-center gap-2"><Badge variant="outline">{consentStatusLabel(contact)}</Badge><span className="text-xs text-muted-foreground">{context.integration.name}</span></div>
        <ConsentAction contact={contact} integrationId={context.integration.id} canManage={context.canManage} busy={!enabled || loading} source="agendamento_autorizado_pelo_gestor" onBusyChange={onBusyChange} />
        {!contact.phone && <p className="text-xs text-muted-foreground">Cadastre o telefone do cliente antes de autorizar.</p>}
        {!context.canManage && <p className="text-xs text-muted-foreground">Somente um gestor autorizado pode alterar essa permissão.</p>}
      </>}
    <p className="text-xs text-muted-foreground">A alteração é salva no cadastro do cliente, independentemente de salvar ou cancelar este agendamento. Autorizar não envia mensagens agora.</p>
  </section>;
}

/** Captures authorization for the actual new client, not whichever client is selected later. */
export function useQuickClientConsent(studioId: number | null, enabled: boolean) {
  const context = useStudioConsentIntegration(studioId, enabled);
  const save = useSaveConsent();
  const [checked, setChecked] = useState(false);
  const request = useRef<{ integrationId: number; studioId: number } | null>(null);
  useEffect(() => { setChecked(false); }, [studioId, enabled]);
  return {
    checked, setChecked, canAuthorize: context.canAuthorize,
    reset: () => { setChecked(false); request.current = null; },
    clearRequest: () => { request.current = null; },
    prepare: (phone: string) => {
      request.current = null;
      if (!checked) return true;
      if (!context.canAuthorize || !context.integration || !studioId || !phone.trim()) {
        toast.error("Para autorizar, informe o telefone e verifique a integração e a permissão do gestor.");
        return false;
      }
      request.current = { integrationId: context.integration.id, studioId };
      return true;
    },
    afterCreated: async (client: { id?: number; studioId?: number | null }) => {
      const captured = request.current;
      request.current = null;
      setChecked(false);
      if (!captured) return;
      if (!client.id || (client.studioId != null && client.studioId !== captured.studioId)) {
        toast.warning("Cliente cadastrado, mas a autorização não foi salva. Confira o cliente selecionado abaixo.");
        return;
      }
      try {
        await save.mutateAsync({ integrationId: captured.integrationId, clientId: client.id, hasWhatsappOptIn: true, source: "cadastro_rapido_autorizado_pelo_gestor" });
      } catch {
        toast.warning("Cliente cadastrado, mas a autorização não foi salva. Use o botão Autorizar mensagens abaixo; não cadastre o cliente novamente.", { duration: 10000 });
      }
    },
  };
}

export function WhatsappConsentManager() {
  const { data: user } = trpc.auth.me.useQuery();
  const studioId = user?.studioId;
  const integrationsQuery = trpc.messaging.listIntegrations.useQuery(undefined, { enabled: Boolean(studioId) });
  const integrations = (integrationsQuery.data ?? []).filter(item => item.studioId === studioId);
  const [selected, setSelected] = useState("");
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [page, setPage] = useState(0);
  const integrationId = integrations.find(item => String(item.id) === selected)?.id
    ?? selectStudioConsentIntegration(integrations, studioId)?.id ?? integrations[0]?.id;
  useEffect(() => {
    const timer = setTimeout(() => { setAppliedSearch(search.trim()); setPage(0); }, 250);
    return () => clearTimeout(timer);
  }, [search]);
  useEffect(() => { setPage(0); }, [integrationId, studioId]);
  const query = trpc.messaging.listWhatsappConsents.useQuery({
    integrationId: integrationId ?? 0, search: appliedSearch,
    offset: page * CONSENT_PAGE_SIZE, limit: CONSENT_PAGE_SIZE + 1,
  }, { enabled: Boolean(studioId && integrationId) });
  const rows = query.data ?? [];
  const busy = query.isFetching || search.trim() !== appliedSearch;
  const canManage = canManageWhatsappConsent(user?.role);
  return <Card>
    <CardHeader>
      <CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5" /> Autorizações de mensagens</CardTitle>
      <CardDescription>Busque pelo nome e registre somente a autorização informada pelo cliente. Esta ação não envia WhatsApp.</CardDescription>
    </CardHeader>
    <CardContent className="space-y-4">
      {!studioId ? <p className="text-sm text-muted-foreground">Selecione um estúdio para consultar seus clientes.</p>
        : integrationsQuery.isError ? <div role="alert"><p>Não foi possível carregar as integrações.</p><Button type="button" variant="outline" onClick={() => void integrationsQuery.refetch()}>Tentar novamente</Button></div>
        : integrationsQuery.isLoading ? <p role="status">Carregando integrações…</p>
        : integrations.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma integração cadastrada neste estúdio.</p>
        : <>
          <Label htmlFor="consent-integration">Integração do estúdio</Label>
          <Select value={String(integrationId ?? "")} onValueChange={value => { setSelected(value); setPage(0); }}>
            <SelectTrigger id="consent-integration"><SelectValue placeholder="Selecione a integração" /></SelectTrigger>
            <SelectContent>{integrations.map(item => <SelectItem key={item.id} value={String(item.id)}>{item.name}</SelectItem>)}</SelectContent>
          </Select>
          <div className="space-y-2">
            <Label htmlFor="consent-client-search">Buscar cliente pelo nome</Label>
            <div className="flex gap-2">
              <div className="relative flex-1"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" aria-hidden="true" /><Input id="consent-client-search" type="search" maxLength={120} autoComplete="off" className="pl-9" placeholder="Digite o nome ou parte do nome…" value={search} onChange={event => { setSearch(event.target.value); setPage(0); }} /></div>
              {search && <Button type="button" variant="outline" onClick={() => { setSearch(""); setAppliedSearch(""); setPage(0); }}>Limpar</Button>}
            </div>
            <p className="text-xs text-muted-foreground">A pesquisa consulta todos os clientes não arquivados do estúdio, não apenas a página atual.</p>
          </div>
          {!canManage && <p className="text-xs text-muted-foreground">Você pode consultar os clientes. A alteração de permissões é reservada aos gestores.</p>}
          {query.isError ? <div role="alert" className="space-y-2"><p>Não foi possível consultar os clientes. Nenhuma autorização foi alterada.</p><Button type="button" variant="outline" onClick={() => void query.refetch()}>Tentar novamente</Button></div>
            : busy ? <p role="status" className="flex items-center gap-2 py-6"><Loader2 className="h-4 w-4 animate-spin" /> Buscando clientes…</p>
            : <div className="space-y-2">
              {rows.slice(0, CONSENT_PAGE_SIZE).map(contact => <div key={`${integrationId}:${contact.clientId}`} className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 space-y-1"><p className="break-words text-sm font-medium">{contact.clientName}</p><p className="text-xs text-muted-foreground">Cadastro #{contact.clientId}{contact.phone ? ` · Telefone final ${contact.phone.replace(/\D/g, "").slice(-4)}` : " · Sem telefone"}</p><Badge variant="outline">{consentStatusLabel(contact)}</Badge></div>
                {integrationId && <ConsentAction contact={contact} integrationId={integrationId} canManage={canManage} busy={integrationsQuery.isFetching} source="painel_do_estudio" />}
              </div>)}
              {rows.length === 0 && <p className="py-6 text-sm text-muted-foreground">{appliedSearch ? `Nenhum cliente encontrado para “${appliedSearch}”.` : "Nenhum cliente encontrado neste estúdio."}</p>}
            </div>}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">Página {page + 1}</p>
            <div className="flex gap-2"><Button type="button" size="sm" variant="outline" disabled={page === 0 || busy || query.isError} onClick={() => setPage(value => Math.max(0, value - 1))}>Anterior</Button><Button type="button" size="sm" variant="outline" disabled={rows.length <= CONSENT_PAGE_SIZE || busy || query.isError} onClick={() => setPage(value => value + 1)}>Próxima</Button></div>
          </div>
        </>}
    </CardContent>
  </Card>;
}
