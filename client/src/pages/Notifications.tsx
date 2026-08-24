import { trpc } from "@/lib/trpc";
import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Bell, Send, CheckCircle, XCircle, Calendar, Clock, User, Loader2,
  MessageSquare, Zap, ExternalLink, Pencil, Trash2, AlertCircle
} from "lucide-react";
import { toast } from "sonner";
import { buildWhatsAppLink } from "../../../shared/const";

function formatDate(date: Date | string) {
  return new Date(date).toLocaleDateString("pt-BR");
}

function formatTime(date: Date | string) {
  return new Date(date).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function formatDateTime(date: Date | string) {
  return new Date(date).toLocaleString("pt-BR");
}

// Converte "YYYY-MM-DD HH:MM:SS" → "YYYY-MM-DDTHH:MM" para input datetime-local
function toInputDatetime(val: string | null | undefined): string {
  if (!val) return "";
  return val.slice(0, 16).replace(" ", "T");
}

// Converte "YYYY-MM-DDTHH:MM" → "YYYY-MM-DD HH:MM:00" para o backend
function fromInputDatetime(val: string): string {
  return val.replace("T", " ") + ":00";
}

export default function Notifications() {
  const utils = trpc.useUtils();
  const baseUrl = window.location.origin;

  // Estado para modal de edição de lembrete
  const [editReminder, setEditReminder] = useState<{
    id: number;
    scheduledAt: string;
    message: string;
    clientName: string | null;
    appointmentDate: string | null;
    service: string | null;
    artist: string | null;
    clientPhone: string | null;
  } | null>(null);
  const [editScheduledAt, setEditScheduledAt] = useState("");
  const [editMessage, setEditMessage] = useState("");

  // Estado para link WhatsApp gerado (envio imediato)
  const [whatsAppLinks, setWhatsAppLinks] = useState<Record<number, string>>({});
  const [generatingLink, setGeneratingLink] = useState<number | null>(null);

  // Queries
  const { data: upcomingAppointments, isLoading: loadingAppointments } = trpc.notifications.getUpcomingAppointments.useQuery();
  const { data: notificationLogs, isLoading: loadingLogs } = trpc.notifications.getNotificationLogs.useQuery({ limit: 50 });
  const { data: schedulerStatus, isLoading: loadingScheduler } = trpc.notifications.getWhatsAppSchedulerStatus.useQuery(
    undefined,
    { refetchInterval: 30_000 }
  );
  const { data: pendingReminders, isLoading: loadingPending, refetch: refetchPending } =
    trpc.notifications.getPendingReminders.useQuery(undefined, { refetchInterval: 60_000 });

  // Mutations
  const sendReminders = trpc.notifications.sendReminders.useMutation({
    onSuccess: (result) => {
      if (result.success) {
        toast.success(`${result.sent} lembrete(s) enviado(s), ${result.failed} falha(s).`);
        utils.notifications.getNotificationLogs.invalidate();
      } else {
        toast.error("Erro ao enviar lembretes");
      }
    },
    onError: () => toast.error("Erro ao enviar lembretes"),
  });

  const updateReminder = trpc.notifications.updateReminder.useMutation({
    onSuccess: () => {
      toast.success("Lembrete atualizado!");
      setEditReminder(null);
      refetchPending();
    },
    onError: () => toast.error("Erro ao atualizar lembrete"),
  });

  const deleteReminder = trpc.notifications.deleteReminder.useMutation({
    onSuccess: () => {
      toast.success("Lembrete removido.");
      setEditReminder(null);
      refetchPending();
    },
    onError: () => toast.error("Erro ao remover lembrete"),
  });

  // Gerar link WhatsApp imediato para um agendamento (sem criar lembrete)
  async function handleSendNow(appointment: {
    id: number;
    clientName: string | null;
    clientPhone: string | null;
    date: string | Date;
    service: string;
    artist: string;
  }) {
    if (!appointment.clientPhone) {
      toast.error("Cliente sem telefone cadastrado");
      return;
    }
    setGeneratingLink(appointment.id);
    try {
      const result = await utils.appointments.generateWhatsAppLink.fetch({ id: appointment.id });
      const token = result.token;
      const confirmUrl = `${baseUrl}/confirmar?id=${appointment.id}&token=${token}`;
      const msg =
        `Olá ${appointment.clientName || "cliente"}! ` +
        `Seu agendamento é dia ${formatDate(appointment.date)} às ${formatTime(appointment.date)} ` +
        `(${appointment.service} com ${appointment.artist}).\n\n` +
        `Por favor, confirme sua presença:\n` +
        `✅ Confirmado: ${confirmUrl}&status=confirmado\n` +
        `❌ Não confirmado: ${confirmUrl}&status=nao_confirmado\n` +
        `⏰ Atraso: ${confirmUrl}&status=atraso\n` +
        `🏃 Chegada antecipada: ${confirmUrl}&status=chegada_antecipada`;
      const link = buildWhatsAppLink(appointment.clientPhone, msg);
      setWhatsAppLinks((prev) => ({ ...prev, [appointment.id]: link }));
      window.open(link, "_blank");
    } catch {
      toast.error("Erro ao gerar link WhatsApp");
    } finally {
      setGeneratingLink(null);
    }
  }

  // Gerar link WhatsApp para um lembrete agendado (com a mensagem já definida)
  function handleOpenReminderLink(reminder: {
    clientPhone: string | null;
    message: string;
  }) {
    if (!reminder.clientPhone) {
      toast.error("Cliente sem telefone cadastrado");
      return;
    }
    const link = buildWhatsAppLink(reminder.clientPhone, reminder.message);
    window.open(link, "_blank");
  }

  // Abrir modal de edição de lembrete
  function openEditReminder(r: typeof pendingReminders extends (infer T)[] | undefined ? T : never) {
    if (!r) return;
    setEditReminder(r as any);
    setEditScheduledAt(toInputDatetime((r as any).scheduledAt));
    setEditMessage((r as any).message);
  }

  function handleSaveReminder() {
    if (!editReminder) return;
    updateReminder.mutate({
      id: editReminder.id,
      scheduledAt: fromInputDatetime(editScheduledAt),
      message: editMessage,
    });
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "agendado": return <Badge variant="secondary">Agendado</Badge>;
      case "confirmado": return <Badge className="bg-blue-500">Confirmado</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getNotificationStatusBadge = (status: string) => {
    if (status === "sent") {
      return (
        <Badge className="bg-green-500">
          <CheckCircle className="mr-1 h-3 w-3" />Enviado
        </Badge>
      );
    }
    return (
      <Badge variant="destructive">
        <XCircle className="mr-1 h-3 w-3" />Falhou
      </Badge>
    );
  };

  return (
    <DashboardLayout>
      <div className="space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0">
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl sm:text-3xl font-bold">Notificações</h1>
            <p className="text-muted-foreground text-xs sm:text-sm">Gerencie lembretes automáticos de agendamentos</p>
          </div>
          <Button
            onClick={() => sendReminders.mutate()}
            disabled={sendReminders.isPending || !upcomingAppointments || upcomingAppointments.length === 0}
            size="sm" className="sm:size-default w-full sm:w-auto text-xs sm:text-sm"
          >
            {sendReminders.isPending ? (
              <><Loader2 className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4 animate-spin" /><span className="hidden sm:inline">Enviando...</span><span className="sm:hidden">Env...</span></>
            ) : (
              <><Send className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" /><span className="hidden sm:inline">Enviar Lembretes Agora</span><span className="sm:hidden">Enviar</span></>
            )}
          </Button>
        </div>

        {/* Status do Scheduler WhatsApp Automático */}
        <Card className="border-green-500/30 bg-green-500/5">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Zap className="h-4 w-4 text-green-500" />
              Lembrete WhatsApp Automático
            </CardTitle>
            <CardDescription>
              O sistema verifica a cada minuto e envia links WhatsApp no horário configurado em Configurações
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loadingScheduler ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
              </div>
            ) : schedulerStatus ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 text-xs sm:text-sm">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Envio principal</p>
                  <p className="font-semibold flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {schedulerStatus.daysBefore} dia(s) antes às {schedulerStatus.sendTime}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Reenvio</p>
                  <p className="font-semibold">
                    {schedulerStatus.resendEnabled ? `✅ Ativo às ${schedulerStatus.resendTime}` : "❌ Desativado"}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Último envio principal</p>
                  <p className="font-semibold text-xs">
                    {schedulerStatus.lastRunPrimary
                      ? new Date(schedulerStatus.lastRunPrimary).toLocaleString("pt-BR")
                      : "Ainda não executado"}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Último reenvio</p>
                  <p className="font-semibold text-xs">
                    {schedulerStatus.lastRunResend
                      ? new Date(schedulerStatus.lastRunResend).toLocaleString("pt-BR")
                      : "Ainda não executado"}
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Configurações não encontradas. Acesse Configurações &gt; Notificações para ativar.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Agendamentos Próximos — envio imediato */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Agendamentos Próximos (24h)
            </CardTitle>
            <CardDescription>
              Clique em "Enviar Agora" para gerar e abrir o link WhatsApp imediatamente
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loadingAppointments ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : !upcomingAppointments || upcomingAppointments.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                Nenhum agendamento nas próximas 24 horas
              </div>
            ) : (
              <div className="space-y-4">
                {upcomingAppointments.map((appointment) => (
                  <div key={appointment.id} className="rounded-lg border p-4 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{appointment.clientName}</span>
                          {getStatusBadge(appointment.status)}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          <div className="flex items-center gap-2">
                            <Calendar className="h-3 w-3" />
                            {formatDate(appointment.date)} às {formatTime(appointment.date)}
                          </div>
                          <div className="mt-1">
                            Serviço: {appointment.service} • Artista: {appointment.artist}
                          </div>
                          {appointment.clientPhone && (
                            <div className="mt-1">Telefone: {appointment.clientPhone}</div>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col gap-2 shrink-0">
                        {appointment.clientPhone ? (
                          <Button
                            size="sm"
                            className="bg-green-600 hover:bg-green-700 text-white"
                            disabled={generatingLink === appointment.id}
                            onClick={() => handleSendNow(appointment)}
                          >
                            {generatingLink === appointment.id ? (
                              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                            ) : (
                              <MessageSquare className="mr-1 h-4 w-4" />
                            )}
                            Enviar Agora
                          </Button>
                        ) : (
                          <Badge variant="outline" className="text-xs text-muted-foreground">
                            <AlertCircle className="mr-1 h-3 w-3" />Sem telefone
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* Link gerado — aparece após clicar em Enviar Agora */}
                    {whatsAppLinks[appointment.id] && (
                      <div className="rounded-md bg-green-500/10 border border-green-500/30 p-3 text-sm">
                        <p className="text-xs text-muted-foreground mb-1">Link gerado — clique para abrir novamente:</p>
                        <a
                          href={whatsAppLinks[appointment.id]}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-green-600 hover:text-green-500 font-medium break-all"
                        >
                          <ExternalLink className="h-3 w-3 shrink-0" />
                          Abrir WhatsApp
                        </a>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Lembretes Agendados — clicáveis para editar */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Lembretes Agendados
              {pendingReminders && pendingReminders.length > 0 && (
                <Badge className="ml-1">{pendingReminders.length}</Badge>
              )}
            </CardTitle>
            <CardDescription>
              Lembretes individuais pendentes. Clique em um lembrete para editar data, horário ou mensagem, ou para enviar agora.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loadingPending ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : !pendingReminders || pendingReminders.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                Nenhum lembrete agendado pendente. Crie lembretes na aba "Lembretes" de cada agendamento.
              </div>
            ) : (
              <div className="space-y-3">
                {pendingReminders.map((r: any, index: number) => (
                  <div key={r.id}>
                    <div
                      className="flex items-start justify-between py-3 px-2 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                      onClick={() => openEditReminder(r)}
                    >
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{r.clientName || "Cliente"}</span>
                          <Badge variant="secondary" className="text-xs">
                            <Clock className="mr-1 h-3 w-3" />
                            Enviar em {formatDateTime(r.scheduledAt)}
                          </Badge>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {r.appointmentDate && (
                            <div>Agendamento: {formatDate(r.appointmentDate)} às {formatTime(r.appointmentDate)}</div>
                          )}
                          {r.service && <div>Serviço: {r.service} • Artista: {r.artist}</div>}
                          <div className="mt-1 line-clamp-2 text-xs opacity-70">{r.message}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 ml-3 shrink-0">
                        {r.clientPhone && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-green-600 border-green-600 hover:bg-green-50"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenReminderLink(r);
                            }}
                          >
                            <ExternalLink className="mr-1 h-3 w-3" />
                            Enviar
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            openEditReminder(r);
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    {index < pendingReminders.length - 1 && <Separator />}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Histórico de Notificações */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5" />
              Histórico de Notificações
            </CardTitle>
            <CardDescription>
              Últimas 50 notificações enviadas (inclui WhatsApp automático)
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loadingLogs ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : !notificationLogs || notificationLogs.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                Nenhuma notificação enviada ainda
              </div>
            ) : (
              <div className="space-y-3">
                {notificationLogs.map((log: any, index: number) => (
                  <div key={log.id}>
                    <div className="flex items-start justify-between py-3">
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium">{log.title}</span>
                          {getNotificationStatusBadge(log.status)}
                          {(log.type === "whatsapp_primary" || log.type === "whatsapp_resend") && (
                            <Badge variant="outline" className="text-green-600 border-green-600 text-xs">
                              <MessageSquare className="mr-1 h-3 w-3" />
                              {log.type === "whatsapp_primary" ? "WhatsApp Auto" : "WhatsApp Reenvio"}
                            </Badge>
                          )}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {log.clientName && (
                            <div className="flex items-center gap-1">
                              <User className="h-3 w-3" />{log.clientName}
                            </div>
                          )}
                          <div className="mt-1 flex items-center gap-1">
                            <Clock className="h-3 w-3" />{formatDateTime(log.sentAt)}
                          </div>
                        </div>
                      </div>
                    </div>
                    {index < notificationLogs.length - 1 && <Separator />}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Modal de edição de lembrete agendado */}
      <Dialog open={!!editReminder} onOpenChange={(open) => !open && setEditReminder(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Editar Lembrete Agendado
            </DialogTitle>
          </DialogHeader>

          {editReminder && (
            <div className="space-y-4">
              {/* Info do agendamento */}
              <div className="rounded-md bg-muted/50 p-3 text-sm space-y-1">
                <div className="font-medium">{editReminder.clientName || "Cliente"}</div>
                {editReminder.appointmentDate && (
                  <div className="text-muted-foreground">
                    Agendamento: {formatDate(editReminder.appointmentDate)} às {formatTime(editReminder.appointmentDate)}
                    {editReminder.service && ` — ${editReminder.service}`}
                  </div>
                )}
                {editReminder.clientPhone && (
                  <div className="text-muted-foreground">Telefone: {editReminder.clientPhone}</div>
                )}
              </div>

              {/* Data e hora de envio */}
              <div className="space-y-2">
                <Label htmlFor="edit-scheduled-at">Data e horário de envio</Label>
                <Input
                  id="edit-scheduled-at"
                  type="datetime-local"
                  value={editScheduledAt}
                  onChange={(e) => setEditScheduledAt(e.target.value)}
                />
              </div>

              {/* Mensagem */}
              <div className="space-y-2">
                <Label htmlFor="edit-message">Mensagem</Label>
                <Textarea
                  id="edit-message"
                  rows={5}
                  value={editMessage}
                  onChange={(e) => setEditMessage(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Variáveis: {"{nome}"}, {"{data}"}, {"{horário}"}, {"{serviço}"}, {"{artista}"}
                </p>
              </div>

              {/* Link WhatsApp direto */}
              {editReminder.clientPhone && (
                <div className="rounded-md bg-green-500/10 border border-green-500/30 p-3">
                  <p className="text-xs text-muted-foreground mb-2">Enviar agora sem esperar o horário agendado:</p>
                  <Button
                    size="sm"
                    className="bg-green-600 hover:bg-green-700 text-white w-full"
                    onClick={() => handleOpenReminderLink({ clientPhone: editReminder.clientPhone, message: editMessage })}
                  >
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Abrir WhatsApp e Enviar Agora
                  </Button>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="flex items-center justify-between gap-2">
            <Button
              variant="destructive"
              size="sm"
              disabled={deleteReminder.isPending}
              onClick={() => editReminder && deleteReminder.mutate({ id: editReminder.id })}
            >
              {deleteReminder.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              <span className="ml-1">Remover</span>
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setEditReminder(null)}>Cancelar</Button>
              <Button
                disabled={updateReminder.isPending || !editScheduledAt}
                onClick={handleSaveReminder}
              >
                {updateReminder.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Salvar
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
