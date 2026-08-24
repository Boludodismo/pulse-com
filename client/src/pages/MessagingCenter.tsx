import { useState } from "react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
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
  AlertTriangle, RefreshCw
} from "lucide-react";
import { toast } from "sonner";

// ─── Tipos ───────────────────────────────────────────────────────────────────

type Provider = "botconversa" | "zapi" | "meta";
type TriggerType =
  | "appointment_created"
  | "appointment_confirmed"
  | "appointment_reminder_24h"
  | "appointment_reminder_2h"
  | "appointment_cancelled"
  | "appointment_rescheduled"
  | "custom";

const PROVIDER_LABELS: Record<Provider, string> = {
  botconversa: "BotConversa",
  zapi: "Z-API",
  meta: "WhatsApp Business (Meta)",
};

const PROVIDER_DESCRIPTIONS: Record<Provider, string> = {
  botconversa: "Integração simples via API REST. Recomendado para começar.",
  zapi: "Baseado em WhatsApp Web. Sem aprovação da Meta.",
  meta: "API oficial do WhatsApp Business. Exige aprovação da Meta e CNPJ.",
};

const TRIGGER_LABELS: Record<TriggerType, string> = {
  appointment_created: "Agendamento criado",
  appointment_confirmed: "Agendamento confirmado",
  appointment_reminder_24h: "Lembrete 24h antes",
  appointment_reminder_2h: "Lembrete 2h antes",
  appointment_cancelled: "Agendamento cancelado",
  appointment_rescheduled: "Agendamento reagendado",
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

// ─── Variáveis disponíveis ────────────────────────────────────────────────────

const AVAILABLE_VARS = [
  { key: "{nome_cliente}", desc: "Nome do cliente" },
  { key: "{nome_tatuador}", desc: "Nome do artista" },
  { key: "{nome_estudio}", desc: "Nome do estúdio" },
  { key: "{data}", desc: "Data do agendamento" },
  { key: "{hora}", desc: "Hora do agendamento" },
  { key: "{servico}", desc: "Tipo de serviço" },
  { key: "{endereco}", desc: "Endereço do estúdio" },
  { key: "{valor_sinal}", desc: "Valor do sinal" },
  { key: "{status_sinal}", desc: "Status do sinal" },
];

// ─── Componente Principal ─────────────────────────────────────────────────────

export default function MessagingCenter() {
  const utils = trpc.useUtils();

  // Queries
  const { data: integrations = [], isLoading: loadingIntegrations } = trpc.messaging.listIntegrations.useQuery();
  const { data: templates = [], isLoading: loadingTemplates } = trpc.messaging.listTemplates.useQuery();
  const { data: queue = [], isLoading: loadingQueue } = trpc.messaging.listQueue.useQuery({ limit: 100 });

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
  const saveTemplate = trpc.messaging.saveTemplate.useMutation({
    onSuccess: () => { utils.messaging.listTemplates.invalidate(); toast.success("Template salvo!"); setTemplateDialog(false); },
    onError: (e) => toast.error(e.message),
  });
  const deleteTemplate = trpc.messaging.deleteTemplate.useMutation({
    onSuccess: () => { utils.messaging.listTemplates.invalidate(); toast.success("Template removido."); },
    onError: (e) => toast.error(e.message),
  });

  // ─── Estado local ─────────────────────────────────────────────────────────

  const [integrationDialog, setIntegrationDialog] = useState(false);
  const [editingIntegration, setEditingIntegration] = useState<any>(null);
  const [integrationForm, setIntegrationForm] = useState({
    name: "", provider: "botconversa" as Provider,
    phoneNumber: "", apiToken: "", instanceId: "",
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
    setIntegrationForm({ name: "", provider: "botconversa", phoneNumber: "", apiToken: "", instanceId: "" });
    setIntegrationDialog(true);
  }

  function openEditIntegration(item: any) {
    setEditingIntegration(item);
    setIntegrationForm({
      name: item.name, provider: item.provider,
      phoneNumber: item.phoneNumber, apiToken: item.apiToken,
      instanceId: item.instanceId ?? "",
    });
    setIntegrationDialog(true);
  }

  function submitIntegration() {
    saveIntegration.mutate({
      id: editingIntegration?.id,
      ...integrationForm,
      instanceId: integrationForm.instanceId || undefined,
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
      <div className="p-6 space-y-6">
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

        {/* Aviso de webhook */}
        <Card className="bg-zinc-900 border-orange-500/30">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-start gap-3">
              <Zap className="h-5 w-5 text-orange-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm text-white font-medium">URL do Webhook para respostas automáticas</p>
                <code className="text-xs text-orange-400 bg-zinc-800 px-2 py-1 rounded mt-1 block select-all">
                  {window.location.origin}/api/webhook/whatsapp
                </code>
                <p className="text-xs text-zinc-400 mt-1">
                  Configure esta URL no painel do seu provedor para receber confirmações (1 = confirmar, 2 = cancelar).
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
            <TabsTrigger value="history" className="flex-1 text-white data-[state=active]:bg-zinc-700 data-[state=active]:text-white text-xs sm:text-sm">
              <History className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" /><span className="hidden sm:inline">Histórico</span><span className="sm:hidden">Hist.</span>
            </TabsTrigger>
          </TabsList>

          {/* ── ABA PROVEDORES ─────────────────────────────────────────────── */}
          <TabsContent value="integrations" className="space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0">
              <p className="text-zinc-400 text-xs sm:text-sm">Conecte o número do estúdio a um provedor de WhatsApp.</p>
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
                      <div className="flex items-start justify-between gap-4">
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
                          {item.lastErrorMessage && (
                            <p className="text-red-400 text-xs mt-1 flex items-center gap-1">
                              <AlertTriangle className="h-3 w-3" /> {item.lastErrorMessage}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
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

          {/* ── ABA HISTÓRICO ──────────────────────────────────────────────── */}
          <TabsContent value="history" className="space-y-4">
            <p className="text-zinc-400 text-sm">Histórico de todas as mensagens enviadas pelo sistema.</p>

            {loadingQueue ? (
              <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-orange-500" /></div>
            ) : queue.length === 0 ? (
              <Card className="bg-zinc-900 border-zinc-700">
                <CardContent className="py-12 text-center">
                  <History className="h-10 w-10 text-zinc-600 mx-auto mb-3" />
                  <p className="text-zinc-400">Nenhuma mensagem enviada ainda.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-2">
                {queue.map((msg: any) => (
                  <Card key={msg.id} className="bg-zinc-900 border-zinc-700">
                    <CardContent className="pt-3 pb-3">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-white text-sm font-medium">{msg.recipientName ?? msg.recipientPhone}</span>
                            <span className="text-zinc-500 text-xs">{msg.recipientPhone}</span>
                            <Badge className={`text-xs ${MSG_STATUS_COLORS[msg.status] ?? "bg-zinc-700 text-zinc-400"}`}>
                              {msg.status}
                            </Badge>
                            {msg.trigger && (
                              <Badge variant="outline" className="text-xs text-zinc-400 border-zinc-700">
                                {TRIGGER_LABELS[msg.trigger as TriggerType] ?? msg.trigger}
                              </Badge>
                            )}
                          </div>
                          <p className="text-zinc-400 text-xs mt-1 line-clamp-2">{msg.message}</p>
                          {msg.errorMessage && (
                            <p className="text-red-400 text-xs mt-1 flex items-center gap-1">
                              <AlertTriangle className="h-3 w-3" /> {msg.errorMessage}
                            </p>
                          )}
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-zinc-500 text-xs">
                            {msg.sentAt
                              ? new Date(msg.sentAt).toLocaleString("pt-BR")
                              : new Date(msg.createdAt).toLocaleString("pt-BR")}
                          </p>
                          {msg.clientResponse && (
                            <p className="text-blue-400 text-xs mt-1">Resposta: {msg.clientResponse}</p>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

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
                placeholder="Cole o token aqui"
                type="password"
                className="bg-zinc-800 border-zinc-600 text-white"
                value={integrationForm.apiToken}
                onChange={e => setIntegrationForm(f => ({ ...f, apiToken: e.target.value }))}
              />
            </div>

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
              disabled={saveIntegration.isPending}
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
