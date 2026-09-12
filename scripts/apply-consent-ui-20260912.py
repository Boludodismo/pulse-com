"""One-shot, hash-guarded source update. Does not connect to any database/provider."""
from pathlib import Path
import hashlib

BASE = {
    "client/src/pages/MessagingCenter.tsx": "c31be30ffe03e6866bff0c9a142ef9f0c3484187",
    "client/src/components/EventModal.tsx": "a33e023b2318bc8d4809692f73475b947093e336",
    "server/routers/messaging.ts": "adfcc80d5e2ef87ec3248f0a9a6b03ef81cf13e0",
}
texts = {}
for name, expected in BASE.items():
    data = Path(name).read_bytes()
    actual = hashlib.sha1(b"blob " + str(len(data)).encode() + b"\0" + data).hexdigest()
    if actual != expected:
        raise RuntimeError(f"Refusing to edit changed source: {name} ({actual})")
    texts[name] = data.decode("utf-8")

def replace(name, old, new):
    if texts[name].count(old) != 1:
        raise RuntimeError(f"Expected exactly one anchor in {name}: {old[:100]}")
    texts[name] = texts[name].replace(old, new, 1)

def replace_between(name, start, end, new):
    text = texts[name]
    if text.count(start) != 1 or text.count(end) != 1:
        raise RuntimeError(f"Ambiguous section in {name}: {start}")
    a, b = text.index(start), text.index(end)
    if b <= a:
        raise RuntimeError("Invalid section order")
    texts[name] = text[:a] + new + text[b:]

new_files = {}
new_files["shared/whatsappConsentUi.ts"] = r'''/** Literal SQL LIKE search: '=' is the explicit escape character. */
export function consentSearchPattern(value: string): string {
  return `%${value.trim().replace(/[=%_]/g, match => `=${match}`)}%`;
}

export const CONSENT_PAGE_SIZE = 50;

export function canManageWhatsappConsent(role?: string | null): boolean {
  return role === "admin" || role === "superadmin";
}

export type ConsentState = {
  hasWhatsappOptIn?: number | boolean | null;
  optedOutAt?: string | null;
};

export function isWhatsappConsentEnabled(consent?: ConsentState | null): boolean {
  return Boolean(consent && (consent.hasWhatsappOptIn === 1 || consent.hasWhatsappOptIn === true) && !consent.optedOutAt);
}

export function consentStatusLabel(consent?: ConsentState | null): string {
  if (isWhatsappConsentEnabled(consent)) return "Autorizado";
  return consent?.optedOutAt ? "Autorização revogada" : "Não autorizado";
}

/** Never guess another studio or silently choose between multiple active senders. */
export function selectStudioConsentIntegration<T extends {
  id: number; studioId: number | null; status: string; isEnabled: number;
}>(integrations: T[], studioId?: number | null): T | undefined {
  if (!studioId) return undefined;
  const active = integrations.filter(item => item.studioId === studioId && item.status === "ativo" && item.isEnabled === 1);
  return active.length === 1 ? active[0] : undefined;
}
'''

new_files["client/src/components/WhatsappConsentControls.tsx"] = r'''import { useEffect, useRef, useState } from "react";
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

function ConsentAction({ contact, integrationId, canManage, busy = false, source }: {
  contact: ConsentRow; integrationId: number; canManage: boolean; busy?: boolean; source: string;
}) {
  const save = useSaveConsent();
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
export function ClientWhatsappConsent({ clientId, studioId, enabled }: {
  clientId: number; studioId: number | null; enabled: boolean;
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
        <ConsentAction contact={contact} integrationId={context.integration.id} canManage={context.canManage} busy={!enabled || loading} source="agendamento_autorizado_pelo_gestor" />
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
'''

# Replace only the consent tab; provider, template, history and automation UI remain untouched.
p = "client/src/pages/MessagingCenter.tsx"
texts[p] = 'import { WhatsappConsentManager } from "@/components/WhatsappConsentControls";\n' + texts[p]
replace(p, '  const [consentIntegrationId, setConsentIntegrationId] = useState("");\n', '')
replace_between(p, '  const activeConsentIntegrationId = ', '\n  // Mutations', '')
replace_between(p, '  const setWhatsappConsent = trpc.messaging.setWhatsappConsent.useMutation({', '  const saveTemplate = ', '')
replace_between(p, '          {/* ── ABA CONSENTIMENTO', '          {/* ── ABA HISTÓRICO', '''          {/* Autorizações sincronizadas com o cadastro e o agendamento */}
          <TabsContent value="consents" className="space-y-4">
            <WhatsappConsentManager />
          </TabsContent>

''')

# Optional search/precise-client/pagination inputs preserve the existing response shape and defaults.
p = "server/routers/messaging.ts"
texts[p] = 'import { consentSearchPattern } from "../../shared/whatsappConsentUi";\n' + texts[p]
replace(p, 'import { eq, desc, and, inArray } from "drizzle-orm";', 'import { eq, desc, and, inArray, asc, sql } from "drizzle-orm";')
replace(p, '''  listWhatsappConsents: tenantProcedure
    .input(z.object({ integrationId: z.number().int().positive() }))''', '''  listWhatsappConsents: tenantProcedure
    .input(z.object({
      integrationId: z.number().int().positive(),
      search: z.string().trim().max(120).optional(),
      clientId: z.number().int().positive().optional(),
      limit: z.number().int().min(1).max(200).default(200),
      offset: z.number().int().min(0).max(1000000).default(0),
    }))''')
replace(p, ''')).where(and(eq(clients.studioId, integration.studioId),eq(clients.isArchived,0))).limit(200);''', '''))).where(and(
        eq(clients.studioId, integration.studioId),
        eq(clients.isArchived, 0),
        input.clientId === undefined ? undefined : eq(clients.id, input.clientId),
        input.search ? sql`CONVERT(${clients.name} USING utf8mb4) COLLATE utf8mb4_unicode_ci LIKE ${consentSearchPattern(input.search)} ESCAPE '='` : undefined,
      )).orderBy(asc(clients.name), asc(clients.id)).limit(input.limit).offset(input.offset);''')

# Appointment authorization is explicit and independent of saving/editing an appointment.
p = "client/src/components/EventModal.tsx"
texts[p] = 'import { ClientWhatsappConsent, useQuickClientConsent } from "./WhatsappConsentControls";\n' + texts[p]
replace(p, '  const [recordWhatsAppConsent, setRecordWhatsAppConsent] = useState(false);\n', '')
replace(p, '  const [quickClientEmail, setQuickClientEmail] = useState("");', '''  const [quickClientEmail, setQuickClientEmail] = useState("");
  const consentStudioId = Number(selectedStudioId || currentUser?.studioId) || null;
  const quickConsent = useQuickClientConsent(consentStudioId, isOpen && showQuickClient);''')
replace(p, '''    onSuccess: async (newClient: any) => {
      await utils.clients.list.invalidate();''', '''    onSuccess: async (newClient: any) => {
      await quickConsent.afterCreated(newClient);
      await utils.clients.list.invalidate();''')
replace(p, '    onError: (e: any) => toast.error(`Erro ao cadastrar cliente: ${e.message}`),', '    onError: (e: any) => { quickConsent.clearRequest(); toast.error(`Erro ao cadastrar cliente: ${e.message}`); },')
replace(p, '''    createClientMutation.mutate({
      name: quickClientName.trim(),''', '''    if (!quickConsent.prepare(quickClientPhone)) return;
    createClientMutation.mutate({
      name: quickClientName.trim(),''')
replace(p, '    setRecordWhatsAppConsent(false);', '    quickConsent.reset();')
replace(p, '''      recordWhatsAppConsent,
''', '''      // Authorization is saved explicitly in the client controls, never inferred from scheduling.
      recordWhatsAppConsent: false,
''')
replace(p, '''  const handleSubmit = async () => {
    setSaveError(null);''', '''  const handleSubmit = async () => {
    if (createClientMutation.isPending) { toast.error("Finalize o cadastro do cliente antes de salvar o agendamento."); return; }
    setSaveError(null);''')
replace(p, '''  const handleClose = () => {
    onClose();''', '''  const handleClose = () => {
    if (createClientMutation.isPending) return;
    onClose();''')
replace(p, '''                  value={selectedStudioId}
                  onValueChange''', '''                  value={selectedStudioId}
                  disabled={createClientMutation.isPending}
                  onValueChange''')
replace(p, '''                onClick={() => {
                  setShowQuickClient((v) => !v);''', '''                disabled={createClientMutation.isPending}
                onClick={() => {
                  quickConsent.reset();
                  setShowQuickClient((v) => !v);''')
replace(p, '''                <div className="flex gap-2 pt-1">
                  <Button''', '''                <label className="flex items-start gap-2 rounded-md border border-primary/20 p-2 text-xs">
                  <input type="checkbox" className="mt-0.5" checked={quickConsent.checked}
                    disabled={!quickConsent.canAuthorize || !quickClientPhone.trim() || createClientMutation.isPending}
                    onChange={event => quickConsent.setChecked(event.target.checked)} />
                  <span><strong>O cliente autorizou receber mensagens do estúdio</strong>
                    <span className="mt-1 block text-muted-foreground">Ao salvar este cadastro, registrar a autorização no cliente criado. Nenhuma mensagem será enviada agora.</span>
                    {(!quickConsent.canAuthorize || !quickClientPhone.trim()) && <span className="mt-1 block text-muted-foreground">Informe o telefone. A autorização requer uma integração ativa deste estúdio e permissão de gestor.</span>}
                  </span>
                </label>
                <div className="flex gap-2 pt-1">
                  <Button''')
replace(p, '                    onClick={() => setShowQuickClient(false)}', '                    disabled={createClientMutation.isPending}\n                    onClick={() => { quickConsent.reset(); setShowQuickClient(false); }}')
replace(p, '<Select value={clientId} onValueChange={setClientId}>', '<Select value={clientId} onValueChange={setClientId} disabled={createClientMutation.isPending}>')
replace(p, '''          {/* Calendário */}''', '''          {clientId && !showQuickClient && (
            <ClientWhatsappConsent key={`${consentStudioId}:${clientId}`} clientId={Number(clientId)} studioId={consentStudioId} enabled={isOpen && !createClientMutation.isPending} />
          )}

          {/* Calendário */}''')
replace(p, '''              <label className={`flex items-start gap-2 text-xs text-muted-foreground ${clientId ? "cursor-pointer" : "opacity-60"}`}>
                <input type="checkbox" checked={recordWhatsAppConsent} disabled={!clientId} onChange={(event) => setRecordWhatsAppConsent(event.target.checked)} className="mt-0.5 rounded" />
                <span>Autorização do cliente para WhatsApp: ao marcar, registro o opt-in deste cliente neste estúdio para lembretes e confirmações. {clientId ? "" : "Selecione o cliente para autorizar."}</span>
              </label>''', '''              <p className="text-xs text-muted-foreground">A autorização de mensagens é gerenciada no painel do cliente acima. Programar um lembrete não concede autorização.</p>''')

new_files["server/whatsappConsentUi.test.ts"] = r'''import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { CONSENT_PAGE_SIZE, canManageWhatsappConsent, consentSearchPattern, consentStatusLabel, isWhatsappConsentEnabled, selectStudioConsentIntegration } from "../shared/whatsappConsentUi";

const integration = (id: number, studioId: number, status = "ativo", isEnabled = 1) => ({ id, studioId, status, isEnabled });

describe("consent search and authorization helpers", () => {
  it("keeps name fragments and trims only outside whitespace", () => expect(consentSearchPattern("  Ana Júlia  ")).toBe("%Ana Júlia%"));
  it("treats percent as a literal rather than match-all", () => expect(consentSearchPattern("%" )).toBe("%=%%"));
  it("escapes underscore and the explicit escape character", () => expect(consentSearchPattern("a_b=c")).toBe("%a=_b==c%"));
  it("does not turn quotes into SQL syntax", () => expect(consentSearchPattern("D'Ávila")).toBe("%D'Ávila%"));
  it("uses fifty visible rows with a separate lookahead", () => expect(CONSENT_PAGE_SIZE).toBe(50));
  it.each([undefined, null, { hasWhatsappOptIn: 0 }, { hasWhatsappOptIn: null }])("does not infer consent from missing or negative data: %s", state => expect(isWhatsappConsentEnabled(state)).toBe(false));
  it("accepts explicitly enabled consent", () => expect(isWhatsappConsentEnabled({ hasWhatsappOptIn: 1, optedOutAt: null })).toBe(true));
  it("honors revocation even when an old opt-in flag remains", () => expect(isWhatsappConsentEnabled({ hasWhatsappOptIn: 1, optedOutAt: "2026-09-12 12:00:00" })).toBe(false));
  it("distinguishes never-authorized and revoked records", () => { expect(consentStatusLabel(null)).toBe("Não autorizado"); expect(consentStatusLabel({ optedOutAt: "2026-09-12" })).toBe("Autorização revogada"); });
  it.each(["admin", "superadmin"])("preserves authorized manager role %s", role => expect(canManageWhatsappConsent(role)).toBe(true));
  it.each(["artist", "collaborator", "user", undefined])("does not grant new role permissions: %s", role => expect(canManageWhatsappConsent(role)).toBe(false));
  it("never selects a sender from another studio", () => expect(selectStudioConsentIntegration([integration(2, 22)], 11)).toBeUndefined());
  it("requires an explicitly selected studio", () => expect(selectStudioConsentIntegration([integration(2, 22)], null)).toBeUndefined());
  it("selects the single active enabled sender of the correct studio", () => expect(selectStudioConsentIntegration([integration(1, 11, "inativo"), integration(2, 22), integration(3, 11)], 11)?.id).toBe(3));
  it("does not use a disabled sender", () => expect(selectStudioConsentIntegration([integration(1, 11, "ativo", 0)], 11)).toBeUndefined());
  it("does not guess among multiple active senders", () => expect(selectStudioConsentIntegration([integration(1, 11), integration(2, 11)], 11)).toBeUndefined());
});

describe("source integration guards (not a database or browser test)", () => {
  const router = readFileSync("server/routers/messaging.ts", "utf8");
  const list = router.slice(router.indexOf("listWhatsappConsents:"), router.indexOf("setWhatsappConsent:"));
  const modal = readFileSync("client/src/components/EventModal.tsx", "utf8");
  const controls = readFileSync("client/src/components/WhatsappConsentControls.tsx", "utf8");
  it("searches inside the scoped server query before pagination", () => {
    expect(list).toContain("eq(clients.studioId, integration.studioId)");
    expect(list).toContain("eq(clients.isArchived, 0)");
    expect(list).toContain("eq(clients.id, input.clientId)");
    expect(list).toContain("COLLATE utf8mb4_unicode_ci LIKE ${consentSearchPattern(input.search)} ESCAPE '='");
    expect(list).toContain(".orderBy(asc(clients.name), asc(clients.id)).limit(input.limit).offset(input.offset)");
    expect(list.indexOf("consentSearchPattern(input.search)")).toBeLessThan(list.indexOf(".limit(input.limit)"));
  });
  it("does not weaken the existing mutation permission check", () => expect(router.slice(router.indexOf("setWhatsappConsent:"))).toContain("requireIntegrationManager(ctx)"));
  it("does not retain the hidden grant-on-schedule checkbox", () => {
    expect(modal).not.toContain("setRecordWhatsAppConsent");
    expect((modal.match(/recordWhatsAppConsent: false/g) ?? []).length).toBe(2);
    expect(modal).toContain('key={`${consentStudioId}:${clientId}`}');
  });
  it("captures quick consent before creation and saves it on the actual returned client", () => {
    expect(modal).toContain("if (!quickConsent.prepare(quickClientPhone)) return");
    expect(modal).toContain("await quickConsent.afterCreated(newClient)");
    expect(controls).toContain("clientId: client.id, hasWhatsappOptIn: true");
    expect(controls).toContain("não cadastre o cliente novamente");
  });
  it("shares the consent cache and queries selected clients beyond the old first-200 limit", () => {
    expect(controls).toContain("utils.messaging.listWhatsappConsents.invalidate()");
    expect(controls).toContain("integrationId: integrationId ?? 0, clientId, limit: 1");
  });
  it("has no message-send, provider-configuration or appointment mutation", () => {
    expect(controls).not.toMatch(/trpc\.(appointments|notifications)\./);
    expect(controls).not.toMatch(/\.(sendMessage|sendReminders|saveIntegration|activateIntegration)\./);
  });
});
'''

for name in new_files:
    if Path(name).exists():
        raise RuntimeError(f"Refusing to overwrite an existing new file: {name}")
# All assertions complete before any source is written.
for name, content in {**texts, **new_files}.items():
    path = Path(name)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")
    print(f"Updated {name}")
