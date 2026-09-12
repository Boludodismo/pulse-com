import CustomerCarePanel from "@/components/CustomerCarePanel";
import { formatMessageTimestamp } from '@shared/studioClock';
import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { downloadMessageHistoryCSV } from "@/lib/messagingHistoryCsv";
import DashboardLayout from "@/components/DashboardLayout";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  MessageSquare, Plug, FileText, History, Plus, Pencil, Trash2,
  CheckCircle, XCircle, Clock, Loader2, Send, Eye, Zap, Phone,
  AlertTriangle, RefreshCw, ShieldCheck, ListFilter, Download, RotateCcw
} from "lucide-react";
import { toast } from "sonner";

// ─── Tipos ───────────────────────────────────────────────────────────────────

type Provider = "botconversa" | "zapi" | "meta";
type TriggerType =
  | "appointment_created"
  | "appointment_confirmed"
  | "appointment_reminder_24h"
  | "appointment_reminder_2h"
  | "appointment_reminder_1h"
  | "appointment_cancelled"
  | "appointment_rescheduled"
  | "care_guide"
  | "custom";

const PROVIDER_LABELS: Record<Provider, string> = {
  botconversa: "BotConversa",
  zapi: "Z-API",
  meta: "WhatsApp Business (API da Meta)",
};

const PROVIDER_DESCRIPTIONS: Record<Provider, string> = {
  botconversa: "Use a conta e a chave de API do próprio estúdio.",
  zapi: "Use a instância e o token Z-API do próprio estúdio.",
  meta: "Use a configuração de API WhatsApp Business do próprio estúdio.",
};

const TRIGGER_LABELS: Record<TriggerType, string> = {
  appointment_created: "Agendamento criado",
  appointment_confirmed: "Agendamento confirmado",
  appointment_reminder_24h: "Lembrete 24h antes",
  appointment_reminder_2h: "Lembrete 2h antes",
  appointment_reminder_1h: "Lembrete 1h antes",
  appointment_cancelled: "Agendamento cancelado",
  appointment_rescheduled: "Agendamento reagendado",
  care_guide: "Orientações de cuidados",
  custom: "Mensagem manual",
};

const STATUS_COLORS: Record<string, string> = {
  ativo: "bg-green-500/20 text-green-400 border-green-500/30",
  inativo: "bg-zinc-500/20 text-zinc-400 border-zinc-500/30",
  erro: "bg-red-500/20 text-red-400 border-red-500/30",
  aguardando: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
};

const MSG_STATUS_COLORS: Record<string, string> = {
  enviada: "bg-green-500/20 text-green-400",
  pendente: "bg-yellow-500/20 text-yellow-400",
  erro: "bg-red-500/20 text-red-400",
  cancelada: "bg-zinc-500/20 text-zinc-400",
  respondida: "bg-blue-500/20 text-blue-400",
};

const DELIVERY_STATUS: Record<string, { label: string; className: string }> = {
  pending: { label: "Na fila", className: "bg-yellow-500/20 text-yellow-300" },
  processing: { label: "Processando", className: "bg-blue-500/20 text-blue-300" },
  completed: { label: "Enviada", className: "bg-green-500/20 text-green-300" },
  retry: { label: "Nova tentativa", className: "bg-amber-500/20 text-amber-300" },
  failed: { label: "Erro", className: "bg-red-500/20 text-red-300" },
  cancelled: { label: "Cancelada", className: "bg-zinc-500/20 text-zinc-300" },
  pendente: { label: "Na fila", className: "bg-yellow-500/20 text-yellow-300" },
  enviada: { label: "Enviada", className: "bg-green-500/20 text-green-300" },
  erro: { label: "Erro", className: "bg-red-500/20 text-red-300" },
  cancelada: { label: "Cancelada", className: "bg-zinc-500/20 text-zinc-300" },
  respondida: { label: "Respondida", className: "bg-blue-500/20 text-blue-300" },
};

function maskPhone(phone?: string | null) {
  if (!phone) return "Telefone não informado";
  const digits = phone.replace(/\D/g, "");
  return digits.length > 4 ? `•••• ${digits.slice(-4)}` : phone;
}

// ─── Variáveis disponíveis ────────────────────────────────────────────────────

const AVAILABLE_VARS = [
  { key: "{nome_cliente}", desc: "Nome do cliente" },
  { key: "{nome_artista}", desc: "Nome do artista" },
  { key: "{nome_tatuador}", desc: "Nome do artista" },
  { key: "{nome_estudio}", desc: "Nome do estúdio" },
  { key: "{data}", desc: "Data do agendamento" },
  { key: "{hora}", desc: "Hora do agendamento" },
  { key: "{servico}", desc: "Tipo de serviço" },
  { key: "{endereco}", desc: "Endereço do estúdio" },
  { key: "{valor_sinal}", desc: "Valor do sinal" },
  { key: "{status_sinal}", desc: "Status do sinal" },
  { key: "{link_anamnese}", desc: "Link da anamnese" },
  { key: "{link_ebook}", desc: "Link do e-book de cuidados" },
];

// ─── Componente Principal ─────────────────────────────────────────────────────

export default function MessagingCenter() {
  const utils = trpc.useUtils();
  const { user } = useAuth();
  const isSuperadmin = user?.role === "superadmin";
  const [historyIntegrationId, setHistoryIntegrationId] = useState("all");
  const [historyStatus, setHistoryStatus] = useState("all");
  const [productionDialog, setProductionDialog] = useState(false);
  const [productionTarget, setProductionTarget] = useState<any>(null);
  const [productionConfirmation, setProductionConfirmation] = useState("");
  const [retryDialog, setRetryDialog] = useState(false);
  const [retryTarget, setRetryTarget] = useState<any>(null);
  const [retryConfirmation, setRetryConfirmation] = useState("");
  const [consentIntegrationId, setConsentIntegrationId] = useState("");
  const {data:automationSettings}=trpc.messaging.getAutomationSettings.useQuery();
  const historyQueryInput = useMemo(() => ({
    limit: 100,
    integrationId: historyIntegrationId === "all" ? undefined : Number(historyIntegrationId),
    status: historyStatus === "all" ? undefined : historyStatus as "pendente" | "enviada" | "erro" | "cancelada" | "respondida",
  }), [historyIntegrationId, historyStatus]);

  // Queries
  const { data: integrations = [], isLoading: loadingIntegrations } = trpc.messaging.listIntegrations.useQuery();
  const { data: studios = [], isLoading: loadingStudios } = trpc.saas.studios.useQuery(undefined, { enabled: isSuperadmin });
  const { data: templates = [], isLoading: loadingTemplates } = trpc.messaging.listTemplates.useQuery();
  const { data: messageHistory = [], isLoading: loadingHistory } = trpc.messaging.listMessageHistory.useQuery(historyQueryInput);
  const activeConsentIntegrationId = consentIntegrationId ? Number(consentIntegrationId) : integrations[0]?.id;
  const { data: whatsappConsents = [], isLoading: loadingConsents } = trpc.messaging.listWhatsappConsents.useQuery(
    { integrationId: activeConsentIntegrationId ?? 0 },
    { enabled: Boolean(activeConsentIntegrationId) },
  );

  // Mutations
  const saveIntegration = trpc.messaging.saveIntegration.useMutation({
    onSuccess: () => { utils.messaging.listIntegrations.invalidate(); toast.success("Integração salva!"); setIntegrationDialog(false); },
    onError: (e) => toast.error(e.message),
  });
  const activateIntegration = trpc.messaging.activateIntegration.useMutation({
    onSuccess: () => { utils.messaging.listIntegrations.invalidate(); toast.success("Integração ativada!"); },
    onError: (e) => toast.error(e.message),
  });
  const deleteIntegration = trpc.messaging.deleteIntegration.useMutation({
    onSuccess: () => { utils.messaging.listIntegrations.invalidate(); toast.success("Integração removida."); },
    onError: (e) => toast.error(e.message),
  });
  const testConnection = trpc.messaging.testConnection.useMutation({
    onSuccess: (r) => {
      utils.messaging.listIntegrations.invalidate();
      if (r.success) toast.success("Conexão bem-sucedida!");
      else toast.error(`Falha: ${r.error}`);
    },
    onError: (e) => toast.error(e.message),
  });
  const releaseProduction = trpc.messaging.releaseProduction.useMutation({
    onSuccess: (result) => {
      utils.messaging.listIntegrations.invalidate();
      utils.messaging.listMessageHistory.invalidate();
      setProductionDialog(false);
      setProductionConfirmation("");
      setProductionTarget(null);
      toast.success(result.alreadyProduction ? "A integração já está em produção." : "Produção liberada com opt-in obrigatório.");
    },
    onError: (e) => toast.error(e.message),
  });
  const retryFailedMessage = trpc.messaging.retryFailedMessage.useMutation({
    onSuccess: () => {
      utils.messaging.listMessageHistory.invalidate();
      setRetryDialog(false);
      setRetryTarget(null);
      setRetryConfirmation("");
      toast.success("Nova tentativa criada na fila. O envio ocorrerá após o processamento seguro.");
    },
    onError: (e) => toast.error(e.message),
  });
  const setWhatsappConsent = trpc.messaging.setWhatsappConsent.useMutation({
    onSuccess: () => {
      utils.messaging.listWhatsappConsents.invalidate();
      toast.success("Consentimento de WhatsApp atualizado. Nenhuma mensagem foi enviada.");
    },
    onError: (error) => toast.error(error.message),
  });
  const saveTemplate = trpc.messaging.saveTemplate.useMutation({
    onSuccess: () => { utils.messaging.listTemplates.invalidate(); toast.success("Template salvo!"); setTemplateDialog(false); },
    onError: (e) => toast.error(e.message),
  });
  const deleteTemplate = trpc.messaging.deleteTemplate.useMutation({
    onSuccess: () => { utils.messaging.listTemplates.invalidate(); toast.success("Template removido."); },
    onError: (e) => toast.error(e.message),
  });

  const exportMessageHistory = () => {
    if (messageHistory.length === 0) {
      toast.error("Não há mensagens para exportar com os filtros atuais.");
      return;
    }
    const integrationNames = new Map(integrations.map((integration: any) => [integration.id, integration.name]));
    downloadMessageHistoryCSV(messageHistory.map((message: any) => {
      const delivery = DELIVERY_STATUS[message.deliveryStatus] ?? { label: message.deliveryStatus };
      return {
        createdAt: message.createdAt,
        sentAt: message.sentAt,
        integrationName: integrationNames.get(message.integrationId) ?? `Integração #${message.integrationId}`,
        recipientName: message.recipientName,
        recipientPhoneMasked: maskPhone(message.recipientPhone),
        message: message.message,
        deliveryStatus: delivery.label,
        attemptCount: message.attemptCount,
        maxAttempts: message.maxAttempts,
        eventStatus: message.eventStatus,
        error: message.errorMessage ?? message.jobError,
      };
    }));
    toast.success("Histórico exportado em CSV.");
  };

  // ─── Estado local ─────────────────────────────────────────────────────────

  const [integrationDialog, setIntegrationDialog] = useState(false);
  const [editingIntegration, setEditingIntegration] = useState<any>(null);
  const [integrationForm, setIntegrationForm] = useState({
    name: "", provider: "botconversa" as Provider,
    phoneNumber: "", apiToken: "", instanceId: "", studioId: "", sandboxMode: true, sandboxTestPhone: "", webhookSecret: "",
  });

  const [templateDialog, setTemplateDialog] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<any>(null);
  const [templateForm, setTemplateForm] = useState({
    name: "", trigger: "appointment_created" as TriggerType,
    recipientType: "client" as "client" | "artist",
    message: "", isActive: true,
  });
  const [previewText, setPreviewText] = useState("");

  const previewQuery = trpc.messaging.previewTemplate.useQuery(
    { message: templateForm.message },
    { enabled: templateDialog && templateForm.message.length > 0 }
  );

  // ─── Handlers de integração ───────────────────────────────────────────────

  function openNewIntegration() {
    setEditingIntegration(null);
    setIntegrationForm({ name: "", provider: "botconversa", phoneNumber: "", apiToken: "", instanceId: "", studioId: "", sandboxMode: true, sandboxTestPhone: "", webhookSecret: "" });
    setIntegrationDialog(true);
  }

  function openEditIntegration(item: any) {
    setEditingIntegration(item);
    setIntegrationForm({
      name: item.name, provider: item.provider,
      phoneNumber: item.phoneNumber, apiToken: "",
      instanceId: item.instanceId ?? "",
      studioId: item.studioId ? String(item.studioId) : "",
      sandboxMode: item.sandboxMode !== 0,
      sandboxTestPhone: item.sandboxTestPhone ?? "",
      webhookSecret: "",
    });
    setIntegrationDialog(true);
  }

  function submitIntegration() {
    if (isSuperadmin && !integrationForm.studioId) {
      toast.error("Selecione a empresa que usará esta integração.");
      return;
    }
    saveIntegration.mutate({
      id: editingIntegration?.id,
      ...integrationForm,
      studioId: isSuperadmin ? Number(integrationForm.studioId) : undefined,
      apiToken: integrationForm.apiToken || undefined,
      instanceId: integrationForm.instanceId || undefined,
      sandboxTestPhone: integrationForm.sandboxTestPhone || undefined,
      webhookSecret: integrationForm.webhookSecret || undefined,
    });
  }

  // ─── Handlers de template ─────────────────────────────────────────────────

  function openNewTemplate() {
    setEditingTemplate(null);
    setTemplateForm({ name: "", trigger: "appointment_created", recipientType: "client", message: "", isActive: true });
    setTemplateDialog(true);
  }

  function openEditTemplate(item: any) {
    setEditingTemplate(item);
    setTemplateForm({
      name: item.name, trigger: item.trigger,
      recipientType: item.recipientType, message: item.message,
      isActive: item.isActive === 1 || item.isActive === true,
    });
    setTemplateDialog(true);
  }

  function submitTemplate() {
    saveTemplate.mutate({ id: editingTemplate?.id, ...templateForm });
  }

  function insertVar(v: string) {
    setTemplateForm(f => ({ ...f, message: f.message + v }));
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <DashboardLayout>
      <div className="space-y-6 p-4 sm:p-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <MessageSquare className="h-6 w-6 text-orange-500" />
              Central de Mensagens
            </h1>
            <p className="text-zinc-400 text-sm mt-1">
              Gerencie integrações WhatsApp, templates automáticos e histórico de envios
            </p>
          </div>
        </div>

        <CustomerCarePanel />
        {/* Aviso de webhook */}
        <Card className="bg-zinc-900 border-orange-500/30">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-start gap-3">
              <Zap className="h-5 w-5 text-orange-500 mt-0.5 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="break-words text-sm font-medium text-white">URL do Webhook para respostas automáticas</p>
                <code className="mt-1 block break-all whitespace-normal rounded bg-zinc-800 px-2 py-1 text-xs text-orange-400 select-all">
                  Webhook legado: {window.location.origin}/api/webhook/whatsapp
                </code>
                <p className="text-xs text-zinc-400 mt-1">
                  Para BotConversa, use a URL exclusiva exibida em cada conexão e informe a assinatura configurada. O endpoint legado permanece para integrações existentes.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabs principais */}
        <Tabs defaultValue="integrations" className="space-y-4">
          <TabsList className="flex w-full h-auto sm:h-12 bg-zinc-800 rounded-lg p-1 flex-wrap sm:flex-nowrap">
            <TabsTrigger value="integrations" className="flex-1 text-white data-[state=active]:bg-zinc-700 data-[state=active]:text-white text-xs sm:text-sm">
              <Plug className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" /><span className="hidden sm:inline">Provedores</span><span className="sm:hidden">Prov.</span>
            </TabsTrigger>
            <TabsTrigger value="templates" className="flex-1 text-white data-[state=active]:bg-zinc-700 data-[state=active]:text-white text-xs sm:text-sm">
              <FileText className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" /><span className="hidden sm:inline">Templates</span><span className="sm:hidden">Temp.</span>
            </TabsTrigger>
            <TabsTrigger value="consents" className="flex-1 text-white data-[state=active]:bg-zinc-700 data-[state=active]:text-white text-xs sm:text-sm">
              <ShieldCheck className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" /><span className="hidden sm:inline">Consentimento</span><span className="sm:hidden">Opt-in</span>
            </TabsTrigger>
            <TabsTrigger value="history" className="flex-1 text-white data-[state=active]:bg-zinc-700 data-[state=active]:text-white text-xs sm:text-sm">
              <History className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" /><span className="hidden sm:inline">Histórico</span><span className="sm:hidden">Hist.</span>
            </TabsTrigger>
          </TabsList>

          {/* ── ABA PROVEDORES ─────────────────────────────────────────────── */}
          <TabsContent value="integrations" className="space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0">
              <p className="text-zinc-400 text-xs sm:text-sm">Cada estúdio escolhe seu provedor e usa seu próprio número e credenciais. As opções disponíveis são WhatsApp Business (API da Meta), BotConversa e Z-API. Outros bots precisam de uma integração compatível antes de serem conectados.</p>
              <Button onClick={openNewIntegration} className="bg-orange-600 hover:bg-orange-700 text-white w-full sm:w-auto text-xs sm:text-sm">
                <Plus className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" /><span className="hidden sm:inline">Nova Integração</span><span className="sm:hidden">Nova</span>
              </Button>
            </div>

            {loadingIntegrations ? (
              <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-orange-500" /></div>
            ) : integrations.length === 0 ? (
              <Card className="bg-zinc-900 border-zinc-700">
                <CardContent className="py-12 text-center">
                  <Plug className="h-10 w-10 text-zinc-600 mx-auto mb-3" />
                  <p className="text-zinc-400">Nenhuma integração cadastrada.</p>
                  <p className="text-zinc-500 text-sm mt-1">Clique em "Nova Integração" para conectar o WhatsApp do estúdio.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {integrations.map((item: any) => (
                  <Card key={item.id} className="bg-zinc-900 border-zinc-700">
                    <CardContent className="pt-4 pb-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-white font-semibold">{item.name}</span>
                            <Badge className={`text-xs border ${STATUS_COLORS[item.status] ?? STATUS_COLORS.aguardando}`}>
                              {item.status}
                            </Badge>
                            <Badge variant="outline" className="text-xs text-zinc-400 border-zinc-600">
                              {PROVIDER_LABELS[item.provider as Provider]}
                            </Badge>
                          </div>
                          <p className="text-zinc-400 text-sm mt-1 flex items-center gap-1">
                            <Phone className="h-3 w-3" /> {item.phoneNumber}
                          </p>
                          <div className="mt-2 space-y-1 text-xs text-zinc-400">
                            <p>{item.sandboxMode ? "Homologação segura ativa" : "Produção liberada com opt-in obrigatório"}{item.sandboxTestPhone ? ` · teste: ${maskPhone(item.sandboxTestPhone)}` : ""}</p>
                            {item.provider === "botconversa" && item.connectionKey && (
                              <code className="block break-all rounded bg-zinc-800 px-2 py-1 text-[11px] text-orange-300">
                                {window.location.origin}/api/webhook/botconversa/{item.connectionKey}
                              </code>
                            )}
                          </div>
                          {item.lastErrorMessage && (
                            <p className="text-red-400 text-xs mt-1 flex items-center gap-1">
                              <AlertTriangle className="h-3 w-3" /> {item.lastErrorMessage}
                            </p>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-2 shrink-0">
                          {item.status !== "ativo" && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-green-600 text-green-400 hover:bg-green-600/10"
                              onClick={() => activateIntegration.mutate({ id: item.id })}
                              disabled={activateIntegration.isPending}
                            >
                              <CheckCircle className="mr-1 h-3 w-3" /> Ativar
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-zinc-600 text-zinc-300 hover:bg-zinc-700"
                            onClick={() => testConnection.mutate({ id: item.id })}
                            disabled={testConnection.isPending}
                          >
                            {testConnection.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                          </Button>
                          {item.sandboxMode ? (
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-amber-600 text-amber-300 hover:bg-amber-600/10"
                              onClick={() => { setProductionTarget(item); setProductionConfirmation(""); setProductionDialog(true); }}
                            >
                              <ShieldCheck className="mr-1 h-3 w-3" /> Produção
                            </Button>
                          ) : (
                            <Badge className="border border-green-500/30 bg-green-500/10 text-green-300">Produção</Badge>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-zinc-600 text-zinc-300 hover:bg-zinc-700"
                            onClick={() => openEditIntegration(item)}
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-red-700 text-red-400 hover:bg-red-700/10"
                            onClick={() => deleteIntegration.mutate({ id: item.id })}
                            disabled={deleteIntegration.isPending}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {/* Guias dos provedores */}
            <div className="grid md:grid-cols-3 gap-4 mt-4">
              {(Object.keys(PROVIDER_LABELS) as Provider[]).map(p => (
                <Card key={p} className="bg-zinc-900/50 border-zinc-800">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-white">{PROVIDER_LABELS[p]}</CardTitle>
                    <CardDescription className="text-xs">{PROVIDER_DESCRIPTIONS[p]}</CardDescription>
                  </CardHeader>
                  <CardContent className="text-xs text-zinc-500 space-y-1">
                    {p === "botconversa" && <>
                      <p>1. Acesse <span className="text-orange-400">botconversa.com.br</span></p>
                      <p>2. Crie uma conta e conecte seu número</p>
                      <p>3. Copie o Token da API em Configurações</p>
                      <p>4. Configure a URL do webhook acima</p>
                    </>}
                    {p === "zapi" && <>
                      <p>1. Acesse <span className="text-orange-400">z-api.io</span></p>
                      <p>2. Crie uma instância e conecte via QR Code</p>
                      <p>3. Copie o Instance ID e o Token</p>
                      <p>4. Configure a URL do webhook acima</p>
                    </>}
                    {p === "meta" && <>
                      <p>1. Acesse <span className="text-orange-400">developers.facebook.com</span></p>
                      <p>2. Crie um App e configure o WhatsApp Business</p>
                      <p>3. Obtenha o Token permanente e o Phone Number ID</p>
                      <p>4. Configure o webhook no painel da Meta</p>
                    </>}
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* ── ABA TEMPLATES ──────────────────────────────────────────────── */}
          <TabsContent value="templates" className="space-y-4">
            <div className="flex justify-between items-center">
              <p className="text-zinc-400 text-sm">Crie mensagens automáticas com variáveis dinâmicas.</p>
              <Button onClick={openNewTemplate} className="bg-orange-600 hover:bg-orange-700 text-white">
                <Plus className="mr-2 h-4 w-4" /> Novo Template
              </Button>
            </div>

            {loadingTemplates ? (
              <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-orange-500" /></div>
            ) : templates.length === 0 ? (
              <Card className="bg-zinc-900 border-zinc-700">
                <CardContent className="py-12 text-center">
                  <FileText className="h-10 w-10 text-zinc-600 mx-auto mb-3" />
                  <p className="text-zinc-400">Nenhum template cadastrado.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-3">
                {templates.map((t: any) => (
                  <Card key={t.id} className="bg-zinc-900 border-zinc-700">
                    <CardContent className="pt-4 pb-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-white font-medium">{t.name}</span>
                            <Badge variant="outline" className="text-xs text-orange-400 border-orange-500/30">
                              {TRIGGER_LABELS[t.trigger as TriggerType] ?? t.trigger}
                            </Badge>
                            <Badge variant="outline" className="text-xs text-zinc-400 border-zinc-600">
                              {t.recipientType === "client" ? "Cliente" : "Artista"}
                            </Badge>
                            {(t.isActive === 0 || t.isActive === false) && (
                              <Badge className="text-xs bg-zinc-700 text-zinc-400">Inativo</Badge>
                            )}
                          </div>
                          <p className="text-zinc-400 text-xs mt-2 line-clamp-2">{t.message}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Button size="sm" variant="outline" className="border-zinc-600 text-zinc-300 hover:bg-zinc-700" onClick={() => openEditTemplate(t)}>
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button size="sm" variant="outline" className="border-red-700 text-red-400 hover:bg-red-700/10" onClick={() => deleteTemplate.mutate({ id: t.id })} disabled={deleteTemplate.isPending}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* ── ABA CONSENTIMENTO ───────────────────────────────────────────── */}
          <TabsContent value="consents" className="space-y-4">
            <Card className="border-zinc-700 bg-zinc-900">
              <CardHeader className="space-y-2">
                <CardTitle className="flex items-center gap-2 text-white"><ShieldCheck className="h-5 w-5 text-green-400" /> Consentimento de WhatsApp</CardTitle>
                <CardDescription className="text-zinc-400">Registre somente clientes que autorizaram receber mensagens. Esta ação não envia WhatsApp.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {integrations.length === 0 ? <p className="text-sm text-zinc-400">Cadastre uma integração ativa antes de gerenciar consentimentos.</p> : <>
                  <Select value={String(activeConsentIntegrationId ?? "")} onValueChange={setConsentIntegrationId}>
                    <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white"><SelectValue placeholder="Selecione a integração" /></SelectTrigger>
                    <SelectContent className="bg-zinc-800 border-zinc-700">
                      {integrations.map((integration: any) => <SelectItem key={integration.id} value={String(integration.id)} className="text-white hover:bg-zinc-700">{integration.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-zinc-300">Sem opt-in ativo, o CRM mantém o cliente fora dos lembretes automáticos, mesmo quando a integração está em produção.</div>
                  {loadingConsents ? <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-orange-500" /></div> : (
                    <div className="grid gap-2">
                      {whatsappConsents.map((contact: any) => {
                        const optedIn = contact.hasWhatsappOptIn === 1 && !contact.optedOutAt;
                        return <div key={contact.clientId} className="flex flex-col gap-2 rounded-lg border border-zinc-800 bg-zinc-950/30 p-3 sm:flex-row sm:items-center sm:justify-between">
                          <div className="min-w-0"><p className="truncate text-sm font-medium text-white">{contact.clientName}</p><p className="text-xs text-zinc-500">{maskPhone(contact.phone)} · {optedIn ? "Opt-in ativo" : "Sem opt-in"} · <a href={`/clients/${contact.clientId}`} className="underline">Cadastro #{contact.clientId}</a></p></div>
                          <Button aria-label={`${optedIn?'Revogar':'Registrar'} opt-in para ${contact.clientName} (#${contact.clientId})`} size="sm" variant="outline" className={optedIn ? "border-red-800 text-red-300" : "border-green-700 text-green-300"} disabled={setWhatsappConsent.isPending || !contact.phone} onClick={() => {
                            const action = optedIn ? "revogar" : "registrar";
                            if (!window.confirm(`Confirma ${action} o consentimento de WhatsApp deste cliente? Registre opt-in somente quando houver autorização comprovada.`)) return;
                            if (activeConsentIntegrationId) setWhatsappConsent.mutate({ integrationId: activeConsentIntegrationId, clientId: contact.clientId, hasWhatsappOptIn: !optedIn });
                          }}>{optedIn ? "Revogar" : "Registrar opt-in"}</Button>
                        </div>;
                      })}
                      {whatsappConsents.length === 0 && <p className="py-6 text-center text-sm text-zinc-400">Nenhum cliente encontrado neste estúdio.</p>}
                    </div>
                  )}
                </>}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── ABA HISTÓRICO ──────────────────────────────────────────────── */}
          <TabsContent value="history" className="space-y-4">
            <div className="flex flex-col gap-3 rounded-lg border border-zinc-800 bg-zinc-900/60 p-3 sm:p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="flex items-center gap-2 text-sm font-semibold text-white"><ListFilter className="h-4 w-4 text-orange-400" /> Histórico operacional</h2>
                  <p className="mt-1 text-xs text-zinc-400">Acompanhe entregas, fila, tentativas e retornos do BotConversa.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" className="border-zinc-600 text-zinc-300" onClick={exportMessageHistory} disabled={messageHistory.length === 0}>
                    <Download className="mr-1 h-3 w-3" /> Exportar CSV
                  </Button>
                  <Button size="sm" variant="outline" className="border-zinc-600 text-zinc-300" onClick={() => utils.messaging.listMessageHistory.invalidate()}>
                    <RefreshCw className="mr-1 h-3 w-3" /> Atualizar
                  </Button>
                </div>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <Select value={historyIntegrationId} onValueChange={setHistoryIntegrationId}>
                  <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white"><SelectValue placeholder="Todas as integrações" /></SelectTrigger>
                  <SelectContent className="bg-zinc-800 border-zinc-700">
                    <SelectItem value="all" className="text-white hover:bg-zinc-700">Todas as integrações</SelectItem>
                    {integrations.map((integration: any) => <SelectItem key={integration.id} value={String(integration.id)} className="text-white hover:bg-zinc-700">{integration.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={historyStatus} onValueChange={setHistoryStatus}>
                  <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white"><SelectValue placeholder="Todos os status" /></SelectTrigger>
                  <SelectContent className="bg-zinc-800 border-zinc-700">
                    <SelectItem value="all" className="text-white hover:bg-zinc-700">Todos os status</SelectItem>
                    <SelectItem value="enviada" className="text-white hover:bg-zinc-700">Enviadas</SelectItem>
                    <SelectItem value="pendente" className="text-white hover:bg-zinc-700">Na fila</SelectItem>
                    <SelectItem value="erro" className="text-white hover:bg-zinc-700">Com erro</SelectItem>
                    <SelectItem value="respondida" className="text-white hover:bg-zinc-700">Respondidas</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {loadingHistory ? (
              <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-orange-500" /></div>
            ) : messageHistory.length === 0 ? (
              <Card className="bg-zinc-900 border-zinc-700">
                <CardContent className="py-12 text-center">
                  <History className="h-10 w-10 text-zinc-600 mx-auto mb-3" />
                  <p className="text-zinc-400">Nenhuma mensagem encontrada com os filtros atuais.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-2">
                {messageHistory.map((msg: any) => {
                  const delivery = DELIVERY_STATUS[msg.deliveryStatus] ?? { label: msg.deliveryStatus, className: "bg-zinc-700 text-zinc-300" };
                  return (
                    <Card key={msg.id} className="bg-zinc-900 border-zinc-700">
                      <CardContent className="pt-3 pb-3">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-white text-sm font-medium">{msg.recipientName ?? "Destinatário"}</span>
                              <span className="text-zinc-500 text-xs">{maskPhone(msg.recipientPhone)}</span>
                              <Badge className={`text-xs ${delivery.className}`}>{delivery.label}</Badge>
                              {msg.eventStatus && <Badge variant="outline" className="border-zinc-600 text-xs text-zinc-300">Auditoria: {msg.eventStatus === "processed" ? "processada" : msg.eventStatus}</Badge>}
                              {msg.trigger && <Badge variant="outline" className="text-xs text-zinc-400 border-zinc-700">{TRIGGER_LABELS[msg.trigger as TriggerType] ?? msg.trigger}</Badge>}
                            </div>
                            <p className="text-zinc-400 text-xs mt-1 line-clamp-2">{msg.message}</p>
                            {(msg.errorMessage || msg.jobError) && <p className="text-red-400 text-xs mt-1 flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> {msg.errorMessage ?? msg.jobError}</p>}
                          </div>
                          <div className="flex items-center justify-between gap-3 text-xs sm:block sm:text-right shrink-0">
                            <p className="text-zinc-500">{formatMessageTimestamp(msg.sentAt||msg.createdAt,automationSettings?.timezone)}</p>
                            <p className="mt-1 text-zinc-400">Tentativas: {msg.attemptCount}/{msg.maxAttempts || 5}</p>
                            {msg.status === "erro" && msg.deliveryStatus === "failed" && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="mt-2 border-amber-600 text-amber-300 hover:bg-amber-600/10"
                                onClick={() => { setRetryTarget(msg); setRetryConfirmation(""); setRetryDialog(true); }}
                              >
                                <RotateCcw className="mr-1 h-3 w-3" /> Reenviar
                              </Button>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={productionDialog} onOpenChange={setProductionDialog}>
        <DialogContent className="bg-zinc-900 border-zinc-700 text-white max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-amber-300" /> Liberar integração para produção</DialogTitle>
            <DialogDescription className="text-zinc-400">
              A limitação ao telefone de homologação será removida. O CRM continuará exigindo cliente identificado e consentimento ativo de WhatsApp antes de qualquer envio.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-sm text-zinc-300 space-y-1">
            <p><strong className="text-white">Integração:</strong> {productionTarget?.name}</p>
            <p>Esta ação não dispara mensagens nem cria destinatários.</p>
          </div>
          <div className="space-y-2">
            <Label className="text-zinc-300">Digite <span className="font-mono text-amber-300">LIBERAR PRODUCAO</span> para confirmar</Label>
            <Input
              value={productionConfirmation}
              onChange={e => setProductionConfirmation(e.target.value)}
              className="bg-zinc-800 border-zinc-600 text-white"
              autoComplete="off"
            />
          </div>
          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
            <Button variant="outline" className="border-zinc-600 text-zinc-300" onClick={() => setProductionDialog(false)}>Cancelar</Button>
            <Button
              className="bg-amber-600 hover:bg-amber-700 text-white"
              disabled={productionConfirmation !== "LIBERAR PRODUCAO" || releaseProduction.isPending}
              onClick={() => productionTarget && releaseProduction.mutate({ id: productionTarget.id, confirmation: "LIBERAR PRODUCAO" })}
            >
              {releaseProduction.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Liberar produção
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={retryDialog} onOpenChange={setRetryDialog}>
        <DialogContent className="bg-zinc-900 border-zinc-700 text-white max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><RotateCcw className="h-5 w-5 text-amber-300" /> Criar nova tentativa</DialogTitle>
            <DialogDescription className="text-zinc-400">
              O CRM criará uma única nova tentativa para esta falha. A mensagem passará novamente pela validação de cliente, empresa e consentimento antes de qualquer chamada ao BotConversa.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-sm text-zinc-300 space-y-1">
            <p><strong className="text-white">Destinatário:</strong> {retryTarget?.recipientName ?? "Cliente"} · {maskPhone(retryTarget?.recipientPhone)}</p>
            <p>O conteúdo será o mesmo da mensagem que falhou. Não será criado um envio em lote.</p>
          </div>
          <div className="space-y-2">
            <Label className="text-zinc-300">Digite <span className="font-mono text-amber-300">REENVIAR MENSAGEM</span> para confirmar</Label>
            <Input
              value={retryConfirmation}
              onChange={event => setRetryConfirmation(event.target.value)}
              className="bg-zinc-800 border-zinc-600 text-white"
              autoComplete="off"
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" className="border-zinc-600 text-zinc-300" onClick={() => setRetryDialog(false)}>Cancelar</Button>
            <Button
              className="bg-amber-600 hover:bg-amber-700 text-white"
              disabled={retryConfirmation !== "REENVIAR MENSAGEM" || retryFailedMessage.isPending}
              onClick={() => retryTarget && retryFailedMessage.mutate({ messageId: retryTarget.id, confirmation: "REENVIAR MENSAGEM" })}
            >
              {retryFailedMessage.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Criar nova tentativa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── DIALOG: Nova / Editar Integração ─────────────────────────────────── */}
      <Dialog open={integrationDialog} onOpenChange={setIntegrationDialog}>
        <DialogContent className="bg-zinc-900 border-zinc-700 text-white max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingIntegration ? "Editar Integração" : "Nova Integração WhatsApp"}</DialogTitle>
            <DialogDescription className="text-zinc-400">
              Configure o provedor que o estúdio usará para enviar mensagens.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Nome */}
            <div className="space-y-1">
              <Label className="text-zinc-300">Nome da integração</Label>
              <Input
                placeholder="Ex: WhatsApp Principal"
                className="bg-zinc-800 border-zinc-600 text-white"
                value={integrationForm.name}
                onChange={e => setIntegrationForm(f => ({ ...f, name: e.target.value }))}
              />
            </div>

            {/* Provedor */}
            <div className="space-y-1">
              <Label className="text-zinc-300">Provedor</Label>
              <Select
                value={integrationForm.provider}
                onValueChange={v => setIntegrationForm(f => ({ ...f, provider: v as Provider }))}
              >
                <SelectTrigger className="bg-zinc-800 border-zinc-600 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-zinc-800 border-zinc-700">
                  {(Object.keys(PROVIDER_LABELS) as Provider[]).map(p => (
                    <SelectItem key={p} value={p} className="text-white hover:bg-zinc-700">
                      {PROVIDER_LABELS[p]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-zinc-500">{PROVIDER_DESCRIPTIONS[integrationForm.provider]}</p>
            </div>

            {/* Número */}
            {isSuperadmin && (
              <div className="space-y-1">
                <Label className="text-zinc-300">Empresa da integração</Label>
                <Select
                  value={integrationForm.studioId}
                  onValueChange={studioId => setIntegrationForm(f => ({ ...f, studioId }))}
                  disabled={loadingStudios}
                >
                  <SelectTrigger className="bg-zinc-800 border-zinc-600 text-white">
                    <SelectValue placeholder={loadingStudios ? "Carregando empresas..." : "Selecione a empresa"} />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-800 border-zinc-700">
                    {studios.map((studio: any) => (
                      <SelectItem key={studio.id} value={String(studio.id)} className="text-white hover:bg-zinc-700">
                        {studio.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-zinc-500">A conexão, o webhook e os envios ficarão restritos à empresa selecionada.</p>
              </div>
            )}

            <div className="space-y-1">
              <Label className="text-zinc-300">Número do WhatsApp</Label>
              <Input
                placeholder="5511999999999 (com DDI)"
                className="bg-zinc-800 border-zinc-600 text-white"
                value={integrationForm.phoneNumber}
                onChange={e => setIntegrationForm(f => ({ ...f, phoneNumber: e.target.value }))}
              />
            </div>

            {/* Token */}
            <div className="space-y-1">
              <Label className="text-zinc-300">
                {integrationForm.provider === "meta" ? "Token de Acesso" : "API Token"}
              </Label>
              <Input
                placeholder={editingIntegration ? "Deixe em branco para manter o token protegido" : "Cole o token aqui"}
                type="password"
                className="bg-zinc-800 border-zinc-600 text-white"
                value={integrationForm.apiToken}
                onChange={e => setIntegrationForm(f => ({ ...f, apiToken: e.target.value }))}
              />
              {editingIntegration && <p className="text-xs text-zinc-500">O token é armazenado criptografado e não pode ser exibido novamente.</p>}
            </div>

            <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <Label className="text-amber-200">Modo de homologação segura</Label>
                  <p className="mt-1 text-xs text-zinc-400">Enquanto ativo, o sistema só entrega mensagens ao telefone de teste definido abaixo.</p>
                </div>
                <Switch checked={integrationForm.sandboxMode} onCheckedChange={v => setIntegrationForm(f => ({ ...f, sandboxMode: v }))} />
              </div>
              {integrationForm.sandboxMode && (
                <div className="space-y-1">
                  <Label className="text-zinc-300">Telefone de homologação</Label>
                  <Input
                    placeholder="(11) 99999-9999"
                    className="bg-zinc-800 border-zinc-600 text-white"
                    value={integrationForm.sandboxTestPhone}
                    onChange={e => setIntegrationForm(f => ({ ...f, sandboxTestPhone: e.target.value }))}
                  />
                </div>
              )}
            </div>

            {integrationForm.provider === "botconversa" && (
              <div className="space-y-1">
                <Label className="text-zinc-300">Segredo de assinatura do webhook</Label>
                <Input
                  type="password"
                  placeholder={editingIntegration ? "Deixe em branco para manter o segredo atual" : "Mínimo de 24 caracteres"}
                  className="bg-zinc-800 border-zinc-600 text-white"
                  value={integrationForm.webhookSecret}
                  onChange={e => setIntegrationForm(f => ({ ...f, webhookSecret: e.target.value }))}
                />
                <p className="text-xs text-zinc-500">Use o mesmo segredo no webhook do BotConversa. Ele é criptografado e nunca volta a ser exibido.</p>
              </div>
            )}

            {/* Instance ID (Z-API e Meta) */}
            {(integrationForm.provider === "zapi" || integrationForm.provider === "meta") && (
              <div className="space-y-1">
                <Label className="text-zinc-300">
                  {integrationForm.provider === "zapi" ? "Instance ID" : "Phone Number ID"}
                </Label>
                <Input
                  placeholder={integrationForm.provider === "zapi" ? "ID da instância Z-API" : "Phone Number ID da Meta"}
                  className="bg-zinc-800 border-zinc-600 text-white"
                  value={integrationForm.instanceId}
                  onChange={e => setIntegrationForm(f => ({ ...f, instanceId: e.target.value }))}
                />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" className="border-zinc-600 text-zinc-300" onClick={() => setIntegrationDialog(false)}>
              Cancelar
            </Button>
            <Button
              className="bg-orange-600 hover:bg-orange-700 text-white"
              onClick={submitIntegration}
              disabled={saveIntegration.isPending || (isSuperadmin && (loadingStudios || studios.length === 0))}
            >
              {saveIntegration.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── DIALOG: Novo / Editar Template ───────────────────────────────────── */}
      <Dialog open={templateDialog} onOpenChange={setTemplateDialog}>
        <DialogContent className="bg-zinc-900 border-zinc-700 text-white max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingTemplate ? "Editar Template" : "Novo Template de Mensagem"}</DialogTitle>
            <DialogDescription className="text-zinc-400">
              Use variáveis entre chaves para personalizar a mensagem automaticamente.
            </DialogDescription>
          </DialogHeader>

          <div className="grid md:grid-cols-2 gap-4">
            {/* Coluna esquerda */}
            <div className="space-y-4">
              <div className="space-y-1">
                <Label className="text-zinc-300">Nome do template</Label>
                <Input
                  placeholder="Ex: Confirmação de agendamento"
                  className="bg-zinc-800 border-zinc-600 text-white"
                  value={templateForm.name}
                  onChange={e => setTemplateForm(f => ({ ...f, name: e.target.value }))}
                />
              </div>

              <div className="space-y-1">
                <Label className="text-zinc-300">Gatilho automático</Label>
                <Select value={templateForm.trigger} onValueChange={v => setTemplateForm(f => ({ ...f, trigger: v as TriggerType }))}>
                  <SelectTrigger className="bg-zinc-800 border-zinc-600 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-800 border-zinc-700">
                    {(Object.keys(TRIGGER_LABELS) as TriggerType[]).map(t => (
                      <SelectItem key={t} value={t} className="text-white hover:bg-zinc-700">
                        {TRIGGER_LABELS[t]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-zinc-300">Destinatário</Label>
                <Select value={templateForm.recipientType} onValueChange={v => setTemplateForm(f => ({ ...f, recipientType: v as "client" | "artist" }))}>
                  <SelectTrigger className="bg-zinc-800 border-zinc-600 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-800 border-zinc-700">
                    <SelectItem value="client" className="text-white hover:bg-zinc-700">Cliente</SelectItem>
                    <SelectItem value="artist" className="text-white hover:bg-zinc-700">Artista / Tatuador</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-2">
                <Switch
                  checked={templateForm.isActive}
                  onCheckedChange={v => setTemplateForm(f => ({ ...f, isActive: v }))}
                />
                <Label className="text-zinc-300">Template ativo</Label>
              </div>

              {/* Variáveis disponíveis */}
              <div className="space-y-2">
                <Label className="text-zinc-300 text-xs">Variáveis disponíveis (clique para inserir)</Label>
                <div className="flex flex-wrap gap-1">
                  {AVAILABLE_VARS.map(v => (
                    <button
                      key={v.key}
                      type="button"
                      title={v.desc}
                      onClick={() => insertVar(v.key)}
                      className="text-xs bg-zinc-800 hover:bg-zinc-700 text-orange-400 border border-zinc-700 rounded px-2 py-0.5 transition-colors"
                    >
                      {v.key}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Coluna direita */}
            <div className="space-y-4">
              <div className="space-y-1">
                <Label className="text-zinc-300">Mensagem</Label>
                <Textarea
                  rows={8}
                  placeholder="Olá {nome_cliente}, seu agendamento para {data} às {hora} está confirmado!"
                  className="bg-zinc-800 border-zinc-600 text-white resize-none"
                  value={templateForm.message}
                  onChange={e => setTemplateForm(f => ({ ...f, message: e.target.value }))}
                />
              </div>

              {/* Preview */}
              {previewQuery.data && (
                <div className="space-y-1">
                  <Label className="text-zinc-300 text-xs flex items-center gap-1">
                    <Eye className="h-3 w-3" /> Preview (com dados de exemplo)
                  </Label>
                  <div className="bg-zinc-800 border border-zinc-700 rounded p-3 text-sm text-zinc-300 whitespace-pre-wrap">
                    {previewQuery.data.preview}
                  </div>
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" className="border-zinc-600 text-zinc-300" onClick={() => setTemplateDialog(false)}>
              Cancelar
            </Button>
            <Button
              className="bg-orange-600 hover:bg-orange-700 text-white"
              onClick={submitTemplate}
              disabled={saveTemplate.isPending}
            >
              {saveTemplate.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Salvar Template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
