import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { Badge } from "./ui/badge";
import { Textarea } from "./ui/textarea";
import { trpc } from "../lib/trpc";
import { toast } from "sonner";
import { useSyncToast } from "../hooks/useSyncToast";
import { Bell, Plus, Trash2, Send, Clock, CheckCircle, XCircle, MessageSquare, ExternalLink, Loader2, Share2, Copy, CheckCheck, CalendarPlus, Download, TriangleAlert } from "lucide-react";
import { buildWhatsAppLink } from "../../../shared/const";

interface EventModalProps {
  isOpen: boolean;
  onClose: () => void;
  eventId?: number | null;
  initialDate?: Date;
  initialStartTime?: string;
  initialEndTime?: string;
  initialClientId?: number | null;
  onSuccess?: () => void;
}

export function EventModal({
  isOpen,
  onClose,
  eventId,
  initialDate,
  initialStartTime,
  initialEndTime,
  initialClientId,
  onSuccess,
}: EventModalProps) {
  const { notifySync } = useSyncToast();
  const [clientId, setClientId] = useState<string>("");
  const [calendarId, setCalendarId] = useState<string>("");
  const [date, setDate] = useState<string>("");
  const [startTime, setStartTime] = useState<string>("");
  const [endTime, setEndTime] = useState<string>("");
  const [sessionDuration, setSessionDuration] = useState<number>(60); // minutos
  const [service, setService] = useState<string>("");
  const [artist, setArtist] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [depositPaid, setDepositPaid] = useState<boolean>(false);
  const [depositAmount, setDepositAmount] = useState<string>("");
  const [totalAmount, setTotalAmount] = useState<string>("");

  // Estado do link WhatsApp imediato
  const [whatsAppLink, setWhatsAppLink] = useState<string | null>(null);
  const [generatingWhatsApp, setGeneratingWhatsApp] = useState(false);

  // Estado do método de pagamento do sinal (Bug 10)
  const [depositPaymentMethod, setDepositPaymentMethod] = useState<string>("pix");

  // Novos campos: status de sinal e pagamento
  const [signalStatus, setSignalStatus] = useState<"aguardando_sinal" | "sinal_confirmado">("aguardando_sinal");
  const [paymentStatus, setPaymentStatus] = useState<"pendente" | "pago">("pendente");
  const [paymentMethod, setPaymentMethod] = useState<string>("");
  // Tipo de procedimento para anamnese
  const [procedureType, setProcedureType] = useState<string>("");
  const [procedureTypeOther, setProcedureTypeOther] = useState<string>("");

  // Estado da aba de lembretes
  const [activeTab, setActiveTab] = useState<"info" | "reminders" | "export">("info");
  const [copiedLink, setCopiedLink] = useState<string | null>(null);
  const [newReminderDate, setNewReminderDate] = useState<string>("");
  const [newReminderTime, setNewReminderTime] = useState<string>("09:00");
  const [newReminderMessage, setNewReminderMessage] = useState<string>("");
  const [editingReminderId, setEditingReminderId] = useState<number | null>(null);
  const [editDate, setEditDate] = useState<string>("");
  const [editTime, setEditTime] = useState<string>("");
  const [editMessage, setEditMessage] = useState<string>("");
  // Bug 1: lembretes pendentes para salvar após criar o agendamento
  const [pendingReminders, setPendingReminders] = useState<Array<{date: string; time: string; message: string}>>([]);

  // Buscar dados
  const { data: clientsData, isLoading: clientsLoading, error: clientsError } = trpc.clients.list.useQuery();
  const clients = Array.isArray(clientsData)
    ? clientsData
    : Array.isArray((clientsData as any)?.clients)
      ? (clientsData as any).clients
      : [];

  // Busca de cliente dentro do Select
  const [clientSearch, setClientSearch] = useState<string>("");

  // Mini-formulário de cadastro rápido de cliente
  const [showQuickClient, setShowQuickClient] = useState(false);
  const [quickClientName, setQuickClientName] = useState("");
  const [quickClientPhone, setQuickClientPhone] = useState("");
  const [quickClientEmail, setQuickClientEmail] = useState("");
  const CLIENTS_VISIBLE_LIMIT = 50;
  const filteredClients = useMemo(() => {
    const search = clientSearch.toLowerCase().trim();
    const filtered = search
      ? clients.filter((client: any) => {
          const name = String(client.name || client.nome || "").toLowerCase();
          const phone = String(client.phone || client.telefone || "");
          return name.includes(search) || phone.includes(search);
        })
      : clients;
    return filtered.slice(0, CLIENTS_VISIBLE_LIMIT);
  }, [clients, clientSearch]);
  const totalClientsFiltered = useMemo(() => {
    const search = clientSearch.toLowerCase().trim();
    if (!search) return clients.length;
    return clients.filter((client: any) => {
      const name = String(client.name || client.nome || "").toLowerCase();
      const phone = String(client.phone || client.telefone || "");
      return name.includes(search) || phone.includes(search);
    }).length;
  }, [clients, clientSearch]);
  const { data: calendars = [] } = trpc.calendars.list.useQuery();
  const { data: artists = [] } = trpc.artists.list.useQuery();
  // Buscar evento existente via lista (já está em cache)
  // CORREÇÃO 5: buscar apenas o agendamento específico em vez de carregar toda a lista
  // Reutiliza o cache já existente de appointments.list (sem nova requisição de rede)
  const { data: allAppointmentsCache = [] } = trpc.appointments.list.useQuery(undefined, {
    staleTime: Infinity, // não refetch aqui; o pai já gerencia o cache
  });
  const existingEvent = eventId ? allAppointmentsCache.find(apt => apt.id === eventId) : null;

  // Buscar lembretes do agendamento (só quando editando)
  const { data: reminders = [], refetch: refetchReminders } = trpc.appointments.reminders.list.useQuery(
    { appointmentId: eventId! },
    { enabled: !!eventId && isOpen }
  );

  // Utils para invalidar cache
  const utils = trpc.useUtils();

  // Mutations de lembretes
  const createReminderMutation = trpc.appointments.reminders.create.useMutation({
    onSuccess: () => {
      toast.success("Lembrete agendado!");
      setNewReminderDate("");
      setNewReminderTime("09:00");
      setNewReminderMessage("");
      refetchReminders();
    },
    onError: (e) => toast.error(`Erro: ${e.message}`),
  });

  const updateReminderMutation = trpc.appointments.reminders.update.useMutation({
    onSuccess: () => {
      toast.success("Lembrete atualizado!");
      setEditingReminderId(null);
      refetchReminders();
    },
    onError: (e) => toast.error(`Erro: ${e.message}`),
  });

  const deleteReminderMutation = trpc.appointments.reminders.delete.useMutation({
    onSuccess: () => {
      toast.success("Lembrete removido!");
      refetchReminders();
    },
    onError: (e) => toast.error(`Erro: ${e.message}`),
  });

  // Atalho de teclado para deletar (Bug 7: ignorar quando foco em input/textarea)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignorar se o foco estiver em um campo de texto
      const target = e.target as HTMLElement;
      const isInputFocused =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable;
      if ((e.key === 'Delete' || e.key === 'Backspace') && eventId && isOpen && !isInputFocused) {
        e.preventDefault();
        if (confirm("Tem certeza que deseja deletar este agendamento?")) {
          deleteMutation.mutate({ id: eventId });
        }
      }
    };

    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [eventId, isOpen]);

  // Mutation para deletar
  const deleteMutation = trpc.appointments.delete.useMutation({
    onSuccess: () => {
      toast.success("Agendamento deletado com sucesso!");
      utils.appointments.list.invalidate();
      onSuccess?.();
      onClose();
    },
    onError: (error) => {
      toast.error(`Erro ao deletar: ${error.message}`);
    },
  });

  // Mutation para upload de imagem
  const uploadImageMutation = trpc.appointments.uploadImage.useMutation();

  // Mutation de cadastro rápido de cliente
  const createClientMutation = trpc.clients.create.useMutation({
    onSuccess: (newClient: any) => {
      utils.clients.list.invalidate();
      if (newClient?.id) {
        setClientId(String(newClient.id));
      }
      setShowQuickClient(false);
      setQuickClientName("");
      setQuickClientPhone("");
      setQuickClientEmail("");
      setClientSearch("");
      toast.success(`Cliente "${newClient?.name}" cadastrado e selecionado!`);
      notifySync("cliente");
    },
    onError: (e: any) => toast.error(`Erro ao cadastrar cliente: ${e.message}`),
  });

  const handleQuickClientSave = () => {
    if (!quickClientName.trim()) {
      toast.error("Nome do cliente é obrigatório");
      return;
    }
    createClientMutation.mutate({
      name: quickClientName.trim(),
      phone: quickClientPhone.trim() || undefined,
      email: quickClientEmail.trim() || undefined,
    });
  };

  // Mutations
  const createMutation = trpc.appointments.create.useMutation({
    onSuccess: async (result) => {
      // Bug 1: salvar lembretes pendentes após criar o agendamento
      if (pendingReminders.length > 0 && result?.id) {
        for (const r of pendingReminders) {
          try {
            await createReminderMutation.mutateAsync({
              appointmentId: result.id,
              scheduledAt: `${r.date} ${r.time}:00`,
              message: r.message,
            });
          } catch {
            // ignorar erros individuais de lembrete
          }
        }
      }
      toast.success("Evento criado com sucesso!");
      notifySync("agendamento");
      // Invalidar cache para sincronização imediata
      utils.appointments.list.invalidate();
      onSuccess?.();
      onClose();
      resetForm();
    },
    onError: (error) => {
      toast.error(`Erro ao criar evento: ${error.message}`);
    },
  });

  const updateMutation = trpc.appointments.update.useMutation({
    onSuccess: () => {
      toast.success("Evento atualizado com sucesso!");
      notifySync("agendamento");
      // Invalidar cache para sincronização imediata
      utils.appointments.list.invalidate();
      onSuccess?.();
      onClose();
      resetForm();
    },
    onError: (error) => {
      toast.error(`Erro ao atualizar evento: ${error.message}`);
    },
  });

  const resolveAttentionMutation = trpc.appointments.resolveConfirmationAttention.useMutation({
    onSuccess: () => {
      toast.success("Alerta do agendamento atualizado!");
      utils.appointments.list.invalidate();
      onSuccess?.();
    },
    onError: (error) => toast.error(`Erro ao atualizar alerta: ${error.message}`),
  });

  // Preencher formulário ao editar
  useEffect(() => {
    if (existingEvent) {
      setClientId(existingEvent.clientId.toString());
      setCalendarId(existingEvent.calendarId?.toString() || "");
      
      // CORREÇÃO TZ-1: usar split direto na string do banco (YYYY-MM-DD HH:mm:ss)
      // evita conversão UTC que pode dar dia errado em fusos UTC+
      const [datePart, timePart] = existingEvent.date.split(" ");
      setDate(datePart || "");
      const startH = timePart ? timePart.slice(0, 5) : "09:00";
      setStartTime(startH);
      
      // Calcular hora final adicionando duração em minutos
      const [sh, sm] = startH.split(":").map(Number);
      const totalEnd = (sh ?? 9) * 60 + (sm ?? 0) + existingEvent.duration;
      const endH = String(Math.floor(totalEnd / 60) % 24).padStart(2, "0");
      const endM = String(totalEnd % 60).padStart(2, "0");
      setEndTime(`${endH}:${endM}`);
      
      setService(existingEvent.service);
      setArtist(existingEvent.artist);
      setNotes(existingEvent.notes || "");
      setImagePreview(existingEvent.referenceImageUrl || null);
      // Propriedades financeiras (Bug 6: banco armazena em centavos → dividir por 100 ao exibir)
      setDepositPaid(existingEvent.depositPaid ? true : false);
      setDepositAmount(existingEvent.depositAmount != null ? (existingEvent.depositAmount / 100).toFixed(2) : "");
      setTotalAmount(existingEvent.totalAmount != null ? (existingEvent.totalAmount / 100).toFixed(2) : "");
      setSignalStatus((existingEvent as any).signalStatus || "aguardando_sinal");
      setPaymentStatus((existingEvent as any).paymentStatus || "pendente");
      setPaymentMethod((existingEvent as any).paymentMethod || "");
      setProcedureType((existingEvent as any).procedureType || "");
      setProcedureTypeOther((existingEvent as any).procedureTypeOther || "");
    } else if (initialDate || initialClientId) {
      // Preencher com dados iniciais ao criar
      if (initialDate) {
        setDate(initialDate.toISOString().split("T")[0]);
      }
      setStartTime(initialStartTime || "09:00");
      setEndTime(initialEndTime || "10:00");
      if (initialClientId) {
        setClientId(initialClientId.toString());
      }
    }
  }, [existingEvent, initialDate, initialStartTime, initialEndTime, initialClientId]);

  const resetForm = () => {
    setClientId("");
    setCalendarId("");
    setDate("");
    setStartTime("");
    setEndTime("");
    setService("");
    setArtist("");
    setNotes("");
    setImageFile(null);
    setImagePreview(null);
    setDepositPaid(false);
    setDepositAmount("");
    setTotalAmount("");
    setDepositPaymentMethod("pix");
    setSignalStatus("aguardando_sinal");
    setPaymentStatus("pendente");
    setPaymentMethod("");
    setProcedureType("");
    setProcedureTypeOther("");
    setActiveTab("info");
    setCopiedLink(null);
    setNewReminderDate("");
    setNewReminderTime("09:00");
    setNewReminderMessage("");
    setEditingReminderId(null);
    setWhatsAppLink(null);
    setPendingReminders([]);
  };

  // Gerar e abrir link WhatsApp imediato
  const handleSendWhatsAppNow = async () => {
    if (!eventId) return;
    const client = clients.find((c: any) => c.id.toString() === clientId);
    if (!client?.phone) {
      toast.error("Cliente sem telefone cadastrado");
      return;
    }
    setGeneratingWhatsApp(true);
    try {
      const result = await utils.appointments.generateWhatsAppLink.fetch({ id: eventId });
      const token = result.token;
      const baseUrl = window.location.origin;
      const confirmUrl = `${baseUrl}/confirmar?id=${eventId}&token=${token}`;
      const dateStr = date ? new Date(date + "T12:00:00").toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "2-digit" }) : "";
      const msg =
        `Olá ${client.name}! 👋\n\n` +
        `Lembramos que você tem um agendamento:\n` +
        `📅 ${dateStr} às ${startTime}\n` +
        `✏️ ${service} com ${artist}\n\n` +
        `Responda sobre seu horário de forma rápida:\n${confirmUrl}\n\n` +
        `Opções disponíveis: confirmar, avisar atraso, informar que não poderá comparecer ou solicitar reagendamento.`;
      const link = buildWhatsAppLink(client.phone, msg);
      setWhatsAppLink(link);
      window.open(link, "_blank");
      toast.success("Link WhatsApp gerado e aberto!");
    } catch {
      toast.error("Erro ao gerar link WhatsApp");
    } finally {
      setGeneratingWhatsApp(false);
    }
  };

  // Helpers para lembretes
  const getDefaultReminderMessage = () => {
    const clientName = clients.find((c: any) => c.id.toString() === clientId)?.name || "{nome}";
    const dateStr = date ? new Date(date + "T12:00:00").toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "2-digit" }) : "{data}";
    const timeStr = startTime || "{horário}";
    return `Olá ${clientName}! 👋\n\nLembramos que você tem um agendamento:\n📅 ${dateStr} às ${timeStr}\n✏️ ${service || "{serviço}"} com ${artist || "{artista}"}\n\nPor favor, confirme sua presença ou nos avise se precisar reagendar. Obrigado! 🙏`;
  };

  const handleAddReminder = () => {
    if (!newReminderDate || !newReminderTime) {
      toast.error("Defina a data e o horário do lembrete");
      return;
    }
    if (!newReminderMessage.trim()) {
      toast.error("Digite a mensagem do lembrete");
      return;
    }

    // Bug 1: Se ainda não há eventId (novo agendamento), salvar na fila pendente
    if (!eventId) {
      setPendingReminders(prev => [...prev, {
        date: newReminderDate,
        time: newReminderTime,
        message: newReminderMessage.trim(),
      }]);
      toast.success("Lembrete adicionado! Será salvo ao criar o agendamento.");
      setNewReminderDate("");
      setNewReminderTime("09:00");
      setNewReminderMessage("");
      return;
    }

    const scheduledAt = `${newReminderDate} ${newReminderTime}:00`;
    createReminderMutation.mutate({
      appointmentId: eventId,
      scheduledAt,
      message: newReminderMessage.trim(),
    });
  };

  const handleSaveEdit = (id: number) => {
    if (!editDate || !editTime || !editMessage.trim()) {
      toast.error("Preencha todos os campos");
      return;
    }
    updateReminderMutation.mutate({
      id,
      scheduledAt: `${editDate} ${editTime}:00`,
      message: editMessage.trim(),
    });
  };

  const startEditing = (r: typeof reminders[0]) => {
    setEditingReminderId(r.id);
    setEditDate(r.scheduledAt.slice(0, 10));
    setEditTime(r.scheduledAt.slice(11, 16));
    setEditMessage(r.message);
  };

  const reminderStatusBadge = (status: string) => {
    if (status === "sent") return <Badge variant="outline" className="text-green-600 border-green-600 text-xs"><CheckCircle className="mr-1 h-3 w-3" />Enviado</Badge>;
    if (status === "failed") return <Badge variant="outline" className="text-red-600 border-red-600 text-xs"><XCircle className="mr-1 h-3 w-3" />Falhou</Badge>;
    return <Badge variant="outline" className="text-yellow-600 border-yellow-600 text-xs"><Clock className="mr-1 h-3 w-3" />Pendente</Badge>;
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveImage = () => {
    setImageFile(null);
    setImagePreview(null);
  };

  const handleSubmit = async () => {
    if (!clientId || !date || !startTime || !endTime || !service || !artist) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    // Calcular duração em minutos
    const [startHour, startMin] = startTime.split(":").map(Number);
    const [endHour, endMin] = endTime.split(":").map(Number);
    const duration = (endHour * 60 + endMin) - (startHour * 60 + startMin);

    if (duration <= 0) {
      toast.error("Hora final deve ser maior que hora inicial");
      return;
    }

    // Formatar como string local YYYY-MM-DD HH:mm:ss (sem conversão UTC)
    const eventDateTime = `${date} ${startTime}:00`;

    // Upload de imagem se houver
    let imageUrl: string | undefined;
    let imageKey: string | undefined;
    
    if (imageFile) {
      try {
        const reader = new FileReader();
        const base64Promise = new Promise<string>((resolve) => {
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(imageFile);
        });
        const base64 = await base64Promise;
        
        // Fazer upload via endpoint tRPC
        const uploadResult = await uploadImageMutation.mutateAsync({
          fileName: imageFile.name,
          fileData: base64,
          contentType: imageFile.type,
        });
        
        imageUrl = uploadResult.url;
        imageKey = uploadResult.key;
      } catch (error) {
        toast.error("Erro ao fazer upload da imagem");
        return;
      }
    }

    const eventData: any = {
      clientId: parseInt(clientId),
      calendarId: calendarId ? parseInt(calendarId) : undefined,
      date: eventDateTime,  // String local: YYYY-MM-DD HH:mm:ss
      service,
      artist,
      duration,
      notes: notes || undefined,
      status: "agendado" as const,
      depositPaid,
      // Bug 6: converter reais → centavos antes de enviar ao backend
      depositAmount: depositAmount ? Math.round(parseFloat(depositAmount) * 100) : 0,
      totalAmount: totalAmount ? Math.round(parseFloat(totalAmount) * 100) : 0,
      depositPaymentMethod: depositPaymentMethod || "pix",
      signalStatus,
      paymentStatus,
      paymentMethod: paymentMethod || undefined,
      procedureType: procedureType || undefined,
      procedureTypeOther: procedureType === "outro" ? procedureTypeOther || undefined : undefined,
    };
    
    if (imageUrl && imageKey) {
      eventData.referenceImageUrl = imageUrl;
      eventData.referenceImageKey = imageKey;
    }

    if (eventId) {
      // Ao editar, incluir clientId se foi alterado
      const updateData: any = {
        date: eventDateTime,  // String local: YYYY-MM-DD HH:mm:ss
        service,
        artist,
        duration,
        notes: notes || undefined,
        depositPaid,
        // Bug 6: converter reais → centavos antes de enviar ao backend
        depositAmount: depositAmount ? Math.round(parseFloat(depositAmount) * 100) : 0,
        totalAmount: totalAmount ? Math.round(parseFloat(totalAmount) * 100) : 0,
        depositPaymentMethod: depositPaymentMethod || "pix",
        signalStatus,
        paymentStatus,
        paymentMethod: paymentMethod || undefined,
        procedureType: procedureType || undefined,
        procedureTypeOther: procedureType === "outro" ? procedureTypeOther || undefined : undefined,
      };
      
      // Adicionar calendarId se foi definido
      if (calendarId) {
        updateData.calendarId = parseInt(calendarId);
      }
      
      // Adicionar imagem se foi feito upload
      if (imageUrl && imageKey) {
        updateData.referenceImageUrl = imageUrl;
        updateData.referenceImageKey = imageKey;
      }
      
      updateMutation.mutate({
        id: eventId,
        data: updateData,
      });
    } else {
      createMutation.mutate(eventData);
    }
  };

  const handleClose = () => {
    onClose();
    resetForm();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="w-[calc(100vw-1rem)] sm:w-full max-w-lg max-h-[92dvh] sm:max-h-[90vh] flex flex-col p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {eventId ? "Editar Agendamento" : "Novo Agendamento"}
            {eventId && reminders.length > 0 && (
              <Badge variant="secondary" className="text-xs">
                <Bell className="mr-1 h-3 w-3" />
                {reminders.filter(r => r.status === "pending").length} lembrete(s)
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "info" | "reminders" | "export")} className="flex-1 flex flex-col min-h-0">
          <TabsList className="grid w-full grid-cols-3 gap-0">
            <TabsTrigger value="info" className="text-xs sm:text-sm">Informações</TabsTrigger>
            <TabsTrigger value="reminders" className="text-xs sm:text-sm flex items-center justify-center gap-1">
              <Bell className="h-3 w-3 flex-shrink-0" />
              <span className="hidden sm:inline">Lembretes</span>
              <span className="sm:hidden">Lem.</span>
              {eventId && reminders.length > 0 ? `(${reminders.length})` : !eventId && pendingReminders.length > 0 ? `(${pendingReminders.length})` : ""}
            </TabsTrigger>
            <TabsTrigger value="export" disabled={!eventId} className="text-xs sm:text-sm flex items-center justify-center gap-1">
              <Share2 className="h-3 w-3 flex-shrink-0" />
              <span className="hidden sm:inline">Compartilhar</span>
              <span className="sm:hidden">Comp.</span>
            </TabsTrigger>
          </TabsList>

          {/* ABA: INFORMAÇÕES */}
          <TabsContent value="info" className="flex-1 overflow-y-auto">
        <div className="space-y-4 pr-2">
          {/* Cliente */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <Label htmlFor="client">Cliente *</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs text-primary hover:text-primary gap-1"
                onClick={() => {
                  setShowQuickClient((v) => !v);
                  if (!showQuickClient) {
                    setQuickClientName(clientSearch); // pré-preenche com o que foi buscado
                  }
                }}
              >
                <Plus className="h-3 w-3" />
                Novo Cliente
              </Button>
            </div>

            {/* Mini-formulário de cadastro rápido */}
            {showQuickClient && (
              <div className="mb-3 p-3 rounded-lg border border-primary/30 bg-primary/5 space-y-2">
                <p className="text-xs font-semibold text-primary">Cadastro Rápido de Cliente</p>
                <div className="space-y-1.5">
                  <Input
                    placeholder="Nome completo *"
                    value={quickClientName}
                    onChange={(e) => setQuickClientName(e.target.value)}
                    className="h-8 text-sm"
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleQuickClientSave(); } }}
                  />
                  <Input
                    placeholder="Telefone / WhatsApp"
                    value={quickClientPhone}
                    onChange={(e) => setQuickClientPhone(e.target.value)}
                    className="h-8 text-sm"
                  />
                  <Input
                    placeholder="E-mail (opcional)"
                    type="email"
                    value={quickClientEmail}
                    onChange={(e) => setQuickClientEmail(e.target.value)}
                    className="h-8 text-sm"
                  />
                </div>
                <div className="flex gap-2 pt-1">
                  <Button
                    type="button"
                    size="sm"
                    className="h-7 text-xs flex-1"
                    onClick={handleQuickClientSave}
                    disabled={createClientMutation.isPending}
                  >
                    {createClientMutation.isPending ? (
                      <><Loader2 className="h-3 w-3 mr-1 animate-spin" />Salvando...</>
                    ) : (
                      "Salvar e Selecionar"
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => setShowQuickClient(false)}
                  >
                    Cancelar
                  </Button>
                </div>
              </div>
            )}

            <Select value={clientId} onValueChange={setClientId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o cliente" />
              </SelectTrigger>
              <SelectContent>
                {/* Campo de busca */}
                <div className="p-2 pb-1">
                  <Input
                    placeholder="Buscar cliente por nome..."
                    value={clientSearch}
                    onChange={(e) => setClientSearch(e.target.value)}
                    onKeyDown={(e) => e.stopPropagation()}
                    className="h-8 text-sm"
                  />
                </div>
                {clientsLoading ? (
                  <div className="px-3 py-2 text-sm text-muted-foreground">Carregando clientes...</div>
                ) : clientsError ? (
                  <div className="px-3 py-2 text-sm text-red-500">Erro ao carregar clientes</div>
                ) : filteredClients.length === 0 ? (
                  <div className="px-3 py-2 text-sm text-muted-foreground">Nenhum cliente encontrado</div>
                ) : (
                  filteredClients.map((client: any) => (
                    <SelectItem key={String(client.id)} value={String(client.id)}>
                      <div className="flex flex-col">
                        <span>{client.name || client.nome || "Cliente sem nome"}</span>
                        {client.phone && <span className="text-xs text-muted-foreground">{client.phone}</span>}
                      </div>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            {/* Painel de informações do cliente selecionado */}
            {clientId && (() => {
              const selectedClient = clients.find((c: any) => c.id.toString() === clientId);
              if (!selectedClient) return null;
              return (
                <div className="mt-2 p-3 rounded-lg bg-muted/40 border border-border/50 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-foreground">{selectedClient.name}</span>
                    {selectedClient.loyaltyLevel && (
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        (selectedClient.loyaltyLevel as string) === 'Ouro' ? 'bg-yellow-500/20 text-yellow-600' :
                        (selectedClient.loyaltyLevel as string) === 'Prata' ? 'bg-gray-400/20 text-gray-400' :
                        (selectedClient.loyaltyLevel as string) === 'Platina' ? 'bg-purple-500/20 text-purple-400' :
                        'bg-amber-700/20 text-amber-700'
                      }`}>{selectedClient.loyaltyLevel}</span>
                    )}
                  </div>
                  {selectedClient.phone && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                      {selectedClient.phone}
                    </div>
                  )}
                  {selectedClient.email && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                      {selectedClient.email}
                    </div>
                  )}
                  {selectedClient.instagram && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
                      @{selectedClient.instagram}
                    </div>
                  )}
                  {selectedClient.birthDate && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                      {new Date(selectedClient.birthDate).toLocaleDateString('pt-BR')}
                    </div>
                  )}
                </div>
              );
            })()}
          </div>

          {/* Calendário */}
          <div>
            <Label htmlFor="calendar">Calendário</Label>
            <Select value={calendarId} onValueChange={setCalendarId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o calendário" />
              </SelectTrigger>
              <SelectContent>
                {calendars.map((calendar) => (
                  <SelectItem key={calendar.id} value={calendar.id.toString()}>
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: calendar.color }}
                      />
                      {calendar.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Data */}
          <div>
            <Label htmlFor="date">Data *</Label>
            <Input
              id="date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>

          {/* Horários */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div>
              <Label htmlFor="startTime" className="text-xs sm:text-sm">Hora Inicial *</Label>
              <Input
                id="startTime"
                type="time"
                value={startTime}
                className="text-xs sm:text-sm"
                onChange={(e) => {
                  setStartTime(e.target.value);
                  // Recalcular hora final ao mudar hora inicial
                  if (e.target.value) {
                    const [h, m] = e.target.value.split(":").map(Number);
                    const endMins = h * 60 + m + sessionDuration;
                    const eh = Math.floor(endMins / 60) % 24;
                    const em = endMins % 60;
                    setEndTime(`${String(eh).padStart(2,'0')}:${String(em).padStart(2,'0')}`);
                  }
                }}
              />
            </div>
            <div>
              <Label htmlFor="sessionDuration" className="text-xs sm:text-sm">Duração *</Label>
              <Select
                value={String(sessionDuration)}
                onValueChange={(v) => {
                  const mins = Number(v);
                  setSessionDuration(mins);
                  if (startTime) {
                    const [h, m] = startTime.split(":").map(Number);
                    const endMins = h * 60 + m + mins;
                    const eh = Math.floor(endMins / 60) % 24;
                    const em = endMins % 60;
                    setEndTime(`${String(eh).padStart(2,'0')}:${String(em).padStart(2,'0')}`);
                  }
                }}
              >
                <SelectTrigger id="sessionDuration" className="text-xs sm:text-sm">
                  <SelectValue placeholder="Duração" />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 16 }, (_, i) => (i + 1) * 30).map((mins) => {
                    const h = Math.floor(mins / 60);
                    const m = mins % 60;
                    const label = h > 0 ? (m > 0 ? `${h}h${String(m).padStart(2,'0')}` : `${h}h`) : `${m}min`;
                    return <SelectItem key={mins} value={String(mins)}>{label}</SelectItem>;
                  })}
                </SelectContent>
              </Select>
              {endTime && <p className="text-xs text-muted-foreground mt-1">Término: {endTime}</p>}
            </div>
          </div>

          {/* Serviço/Tipo */}
          <div>
            <Label htmlFor="service">Serviço/Tipo *</Label>
            <Input
              id="service"
              value={service}
              onChange={(e) => setService(e.target.value)}
              placeholder="Ex: Tatuagem, Piercing, Consulta"
            />
          </div>

          {/* Tipo de Procedimento para Anamnese */}
          <div>
            <Label htmlFor="procedureType">Tipo de Procedimento</Label>
            <Select value={procedureType} onValueChange={setProcedureType}>
              <SelectTrigger id="procedureType">
                <SelectValue placeholder="Selecione o tipo de procedimento" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="tatuagem">Tatuagem</SelectItem>
                <SelectItem value="piercing">Piercing</SelectItem>
                <SelectItem value="micropigmentacao">Micropigmentação</SelectItem>
                <SelectItem value="laser">Laser</SelectItem>
                <SelectItem value="consulta">Consulta</SelectItem>
                <SelectItem value="retoque">Retoque</SelectItem>
                <SelectItem value="outro">Outro</SelectItem>
              </SelectContent>
            </Select>
            {procedureType === "outro" && (
              <Input
                className="mt-2"
                value={procedureTypeOther}
                onChange={(e) => setProcedureTypeOther(e.target.value)}
                placeholder="Especifique o tipo de procedimento"
              />
            )}
          </div>

          {/* Artista */}
          <div>
            <Label htmlFor="artist">Artista *</Label>
            {artists.length > 0 ? (
              <Select value={artist} onValueChange={setArtist}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o artista" />
                </SelectTrigger>
                <SelectContent>
                  {artists
                    .filter((a) => a.active === 1)
                    .map((a) => (
                      <SelectItem key={a.id} value={a.name}>
                        <div className="flex items-center gap-2">
                          <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary">
                            {a.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <span>{a.name}</span>
                            {a.specialty && (
                              <span className="ml-1 text-xs text-muted-foreground">({a.specialty})</span>
                            )}
                          </div>
                        </div>
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                id="artist"
                value={artist}
                onChange={(e) => setArtist(e.target.value)}
                placeholder="Nome do artista"
              />
            )}
          </div>

          {/* Observações */}
          <div>
            <Label htmlFor="notes">Observações</Label>
            <Input
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Observações adicionais"
            />
          </div>

          {/* Campos Financeiros */}
          <div className="border-t pt-4 mt-4 space-y-4">
            <p className="text-sm font-semibold text-foreground">Financeiro</p>

            {/* Status do Sinal */}
            <div>
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">Status do Sinal</Label>
              <div className="flex gap-2 mt-1.5">
                <button
                  type="button"
                  onClick={() => setSignalStatus("aguardando_sinal")}
                  className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium border transition-all ${
                    signalStatus === "aguardando_sinal"
                      ? "bg-yellow-500/20 border-yellow-500 text-yellow-400"
                      : "bg-transparent border-border text-muted-foreground hover:border-yellow-500/50"
                  }`}
                >
                  ⏳ Aguardando Sinal
                </button>
                <button
                  type="button"
                  onClick={() => { setSignalStatus("sinal_confirmado"); setDepositPaid(true); }}
                  className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium border transition-all ${
                    signalStatus === "sinal_confirmado"
                      ? "bg-green-500/20 border-green-500 text-green-400"
                      : "bg-transparent border-border text-muted-foreground hover:border-green-500/50"
                  }`}
                >
                  ✅ Sinal Confirmado
                </button>
              </div>
            </div>

            {/* Status do Pagamento */}
            <div>
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">Pagamento da Tattoo</Label>
              <div className="flex gap-2 mt-1.5">
                <button
                  type="button"
                  onClick={() => setPaymentStatus("pendente")}
                  className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium border transition-all ${
                    paymentStatus === "pendente"
                      ? "bg-orange-500/20 border-orange-500 text-orange-400"
                      : "bg-transparent border-border text-muted-foreground hover:border-orange-500/50"
                  }`}
                >
                  💳 Pendente
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentStatus("pago")}
                  className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium border transition-all ${
                    paymentStatus === "pago"
                      ? "bg-green-500/20 border-green-500 text-green-400"
                      : "bg-transparent border-border text-muted-foreground hover:border-green-500/50"
                  }`}
                >
                  ✅ Pago
                </button>
              </div>
            </div>

            {/* Forma de pagamento da tattoo (aparece quando pago) */}
            {paymentStatus === "pago" && (
              <div>
                <Label className="text-xs text-muted-foreground uppercase tracking-wide">Como foi pago</Label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger className="mt-1.5">
                    <SelectValue placeholder="Selecione a forma de pagamento" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="dinheiro">💵 Dinheiro</SelectItem>
                    <SelectItem value="pix">📱 Pix</SelectItem>
                    <SelectItem value="cartao_credito">💳 Cartão de Crédito</SelectItem>
                    <SelectItem value="cartao_debito">💳 Cartão de Débito</SelectItem>
                    <SelectItem value="transferencia">🏦 Transferência</SelectItem>
                    <SelectItem value="outro">❓ Outro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Sinal pago (checkbox legado) */}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="depositPaid"
                checked={depositPaid}
                onChange={(e) => setDepositPaid(e.target.checked)}
                className="rounded"
              />
              <Label htmlFor="depositPaid" className="cursor-pointer">Sinal Pago</Label>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div>
                <Label htmlFor="depositAmount" className="text-xs sm:text-sm">Valor do Sinal (R$)</Label>
                <Input
                  id="depositAmount"
                  type="number"
                  step="0.01"
                  min="0"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  placeholder="0.00"
                  className="text-xs sm:text-sm"
                />
              </div>
              <div>
                <Label htmlFor="totalAmount" className="text-xs sm:text-sm">Valor Total (R$)</Label>
                <Input
                  id="totalAmount"
                  type="number"
                  step="0.01"
                  min="0"
                  value={totalAmount}
                  onChange={(e) => setTotalAmount(e.target.value)}
                  placeholder="0.00"
                  className="text-xs sm:text-sm"
                />
              </div>
            </div>
            
            {/* Bug 10: Forma de pagamento do sinal */}
            {depositPaid && (
              <div className="mt-3">
                <Label htmlFor="depositPaymentMethod" className="text-sm">Forma de Pagamento do Sinal</Label>
                <Select value={depositPaymentMethod} onValueChange={setDepositPaymentMethod}>
                  <SelectTrigger id="depositPaymentMethod" className="mt-1">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pix">Pix</SelectItem>
                    <SelectItem value="dinheiro">Dinheiro</SelectItem>
                    <SelectItem value="credito">Cartão de Crédito</SelectItem>
                    <SelectItem value="debito">Cartão de Débito</SelectItem>
                    <SelectItem value="transferencia">Transferência</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {depositAmount && totalAmount && (
              <div className="mt-2 text-sm text-muted-foreground">
                Restante: R$ {(parseFloat(totalAmount) - parseFloat(depositAmount)).toFixed(2)}
              </div>
            )}
          </div>

          {/* Resposta de Confirmação do Cliente */}
          {eventId && existingEvent && (existingEvent as any).confirmationStatus && (existingEvent as any).confirmationStatus !== 'pendente' && (
            <div className={`rounded-lg border p-3 space-y-3 ${(existingEvent as any).confirmationAttention === 'pending' ? 'border-amber-500 bg-amber-500/10' : 'bg-muted/30'}`}>
              <p className="text-xs text-muted-foreground mb-1">Resposta do cliente</p>
              <div className="flex items-center gap-2">
                {(existingEvent as any).confirmationAttention === 'pending' && <TriangleAlert className="h-5 w-5 text-amber-500 shrink-0" />}
                {(existingEvent as any).confirmationStatus === 'confirmado' && <span className="text-green-600 font-semibold">✅ Confirmado</span>}
                {(existingEvent as any).confirmationStatus === 'nao_confirmado' && <span className="text-red-600 font-semibold">❌ Não confirmado</span>}
                {(existingEvent as any).confirmationStatus === 'atraso' && <span className="text-yellow-600 font-semibold">⏰ Atraso de aproximadamente {(existingEvent as any).confirmationDelayMinutes || '?'} minutos</span>}
                {(existingEvent as any).confirmationStatus === 'chegada_antecipada' && <span className="text-blue-600 font-semibold">🏃 Chegada antecipada</span>}
                {(existingEvent as any).confirmationStatus === 'reagendar' && <span className="text-blue-600 font-semibold">🔄 Solicitou reagendamento</span>}
              </div>
              {(existingEvent as any).confirmationAttention === 'pending' && (
                <div className="space-y-2">
                  <p className="text-xs text-amber-700 dark:text-amber-300">Este agendamento precisa da atenção do artista.</p>
                  <div className="flex flex-col sm:flex-row gap-2">
                    {(existingEvent as any).confirmationStatus === 'atraso' && (
                      <Button type="button" size="sm" variant="outline" disabled={resolveAttentionMutation.isPending}
                        onClick={() => resolveAttentionMutation.mutate({ id: eventId!, decision: 'accept_delay' })}>
                        <CheckCircle className="h-4 w-4 mr-1" /> Ainda consigo atender
                      </Button>
                    )}
                    <Button type="button" size="sm" variant="outline" disabled={resolveAttentionMutation.isPending}
                      onClick={() => resolveAttentionMutation.mutate({ id: eventId!, decision: 'reschedule' })}>
                      <CalendarPlus className="h-4 w-4 mr-1" /> Marcar para reagendamento
                    </Button>
                    <Button type="button" size="sm" variant="ghost" disabled={resolveAttentionMutation.isPending}
                      onClick={() => resolveAttentionMutation.mutate({ id: eventId!, decision: 'resolved' })}>
                      Alerta revisado
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Envio Imediato WhatsApp — só aparece ao editar agendamento existente */}
          {eventId && (
            <div className="rounded-lg border border-green-500/40 bg-green-500/5 p-3 space-y-2">
              <p className="text-sm font-medium flex items-center gap-2 text-green-700 dark:text-green-400">
                <MessageSquare className="h-4 w-4" />
                Lembrete WhatsApp
              </p>
              <p className="text-xs text-muted-foreground">
                Envie agora uma mensagem de confirmação para o cliente, sem esperar o agendamento automático.
              </p>
              <Button
                type="button"
                size="sm"
                className="w-full bg-green-600 hover:bg-green-700 text-white"
                disabled={generatingWhatsApp || !clients.find((c: any) => c.id.toString() === clientId)?.phone}
                onClick={handleSendWhatsAppNow}
              >
                {generatingWhatsApp ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Gerando link...</>
                ) : (
                  <><MessageSquare className="mr-2 h-4 w-4" />Enviar WhatsApp Agora</>
                )}
              </Button>
              {!clients.find((c: any) => c.id.toString() === clientId)?.phone && (
                <p className="text-xs text-red-500">Cliente sem telefone cadastrado</p>
              )}
              {whatsAppLink && (
                <div className="rounded-md bg-green-500/10 border border-green-500/20 p-2">
                  <p className="text-xs text-muted-foreground mb-1">Link gerado — clique para abrir novamente:</p>
                  <a
                    href={whatsAppLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-green-600 hover:text-green-500 text-xs font-medium"
                  >
                    <ExternalLink className="h-3 w-3 shrink-0" />
                    Abrir WhatsApp
                  </a>
                </div>
              )}
            </div>
          )}

          {/* Upload de Imagem de Referência */}
          <div>
            <Label htmlFor="image">Imagem de Referência</Label>
            {imagePreview ? (
              <div className="mt-2 space-y-2">
                <div className="relative w-full h-48 rounded-lg overflow-hidden border border-border">
                  <img
                    src={imagePreview}
                    alt="Preview"
                    className="w-full h-full object-contain bg-muted"
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleRemoveImage}
                  className="w-full"
                >
                  Remover Imagem
                </Button>
              </div>
            ) : (
              <div className="mt-2">
                <Input
                  id="image"
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="cursor-pointer"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Anexe uma foto da tatuagem/procedimento desejado
                </p>
              </div>
            )}
          </div>

          {/* Botões */}
          <div className="flex justify-between pt-4">
            {eventId && (
              <Button 
                variant="destructive" 
                onClick={() => {
                  if (confirm("Tem certeza que deseja deletar este agendamento?")) {
                    deleteMutation.mutate({ id: eventId });
                  }
                }}
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? "Deletando..." : "Deletar"}
              </Button>
            )}
            <div className="flex gap-2 ml-auto">
              <Button variant="outline" onClick={handleClose}>
                Cancelar
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                {createMutation.isPending || updateMutation.isPending
                  ? "Salvando..."
                  : eventId
                  ? "Atualizar"
                  : "Criar"}
              </Button>
            </div>
          </div>
        </div>
          </TabsContent>  {/* fim TabsContent info */}

          {/* ABA: LEMBRETES */}
          <TabsContent value="reminders" className="flex-1 overflow-y-auto">
            <div className="space-y-4 pr-2 py-2">
              {/* Adicionar novo lembrete */}
              <div className="rounded-lg border p-4 space-y-3 bg-muted/20">
                <p className="text-sm font-medium flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  Novo Lembrete
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Data do envio</Label>
                    <Input
                      type="date"
                      value={newReminderDate}
                      onChange={(e) => setNewReminderDate(e.target.value)}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Horário do envio</Label>
                    <Input
                      type="time"
                      value={newReminderTime}
                      onChange={(e) => setNewReminderTime(e.target.value)}
                      className="h-8 text-sm"
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-xs mb-2 block">Mensagem</Label>
                  {/* Templates de mensagem */}
                  <div className="grid grid-cols-2 gap-1.5 mb-2">
                    {[
                      { label: "Confirmação", fn: () => {
                        const cn = clients.find((c: any) => c.id.toString() === clientId)?.name || "{nome}";
                        const ds = date ? new Date(date + "T12:00:00").toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "2-digit" }) : "{data}";
                        return `Olá ${cn}! 👋\n\nLembramos que você tem um agendamento:\n📅 ${ds} às ${startTime || "{horário}"}\n✏️ ${service || "{serviço}"} com ${artist || "{artista}"}\n\nPor favor, confirme sua presença ou nos avise se precisar reagendar. Obrigado! 🙏`;
                      }},
                      { label: "Véspera", fn: () => {
                        const cn = clients.find((c: any) => c.id.toString() === clientId)?.name || "{nome}";
                        const ds = date ? new Date(date + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) : "{data}";
                        return `Oi ${cn}! 😊\n\nAmanhã é o seu dia! 🎨\n📅 ${ds} às ${startTime || "{horário}"}\n\nNão esqueça:\n• Venha bem alimentado(a)\n• Use roupa confortável\n• Traga documento com foto\n\nTe esperamos! ✨`;
                      }},
                      { label: "Sinal pendente", fn: () => {
                        const cn = clients.find((c: any) => c.id.toString() === clientId)?.name || "{nome}";
                        return `Olá ${cn}! 👋\n\nPassando para lembrar que o sinal do seu agendamento ainda está pendente.\n\nPara garantir sua vaga, por favor realize o pagamento o quanto antes.\n\nQualquer dúvida, estamos à disposição! 🙏`;
                      }},
                      { label: "Pós-sessão", fn: () => {
                        const cn = clients.find((c: any) => c.id.toString() === clientId)?.name || "{nome}";
                        return `Olá ${cn}! 😊\n\nEsperamos que esteja gostando da sua nova tatuagem! 🎨\n\nLembre-se dos cuidados:\n• Mantenha limpa e hidratada\n• Evite sol direto por 30 dias\n• Não arranhe nem descasque\n\nQualquer dúvida, nos chame! 💪`;
                      }},
                    ].map(({ label, fn }) => (
                      <button
                        key={label}
                        type="button"
                        onClick={() => setNewReminderMessage(fn())}
                        className="text-left text-xs px-2 py-1.5 rounded border border-border bg-muted/20 hover:bg-orange-500/10 hover:border-orange-500/50 hover:text-orange-400 transition-colors truncate"
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <Textarea
                    value={newReminderMessage}
                    onChange={(e) => setNewReminderMessage(e.target.value)}
                    placeholder="Selecione um modelo acima ou escreva sua mensagem..."
                    rows={4}
                    className="text-sm"
                  />
                </div>
                <Button
                  onClick={handleAddReminder}
                  disabled={createReminderMutation.isPending}
                  className="w-full"
                  size="sm"
                >
                  <Bell className="mr-2 h-4 w-4" />
                  {createReminderMutation.isPending ? "Agendando..." : "Agendar Lembrete"}
                </Button>
              </div>

              {/* Bug 1: lista de lembretes pendentes ao criar novo agendamento */}
              {!eventId && pendingReminders.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Lembretes a salvar ({pendingReminders.length})</p>
                  {pendingReminders.map((r, i) => (
                    <div key={i} className="rounded-lg border p-3 flex items-start justify-between gap-2 bg-muted/20">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium">{r.date} às {r.time}</p>
                        <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{r.message}</p>
                      </div>
                      <button
                        type="button"
                        className="text-red-500 hover:text-red-700 p-1 shrink-0"
                        onClick={() => setPendingReminders(prev => prev.filter((_, idx) => idx !== i))}
                        title="Remover"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Lista de lembretes existentes */}
              {reminders.length === 0 && (!pendingReminders.length || eventId) ? (
                <div className="text-center py-8 text-sm text-muted-foreground">
                  <Bell className="mx-auto h-8 w-8 mb-2 opacity-30" />
                  Nenhum lembrete agendado.
                  <br />
                  Adicione acima para notificar o cliente automaticamente.
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Lembretes agendados</p>
                  {reminders.map((r) => (
                    <div key={r.id} className="rounded-lg border p-3 space-y-2">
                      {editingReminderId === r.id ? (
                        // Modo edição
                        <div className="space-y-2">
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <Label className="text-xs">Data</Label>
                              <Input type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} className="h-7 text-xs" />
                            </div>
                            <div>
                              <Label className="text-xs">Horário</Label>
                              <Input type="time" value={editTime} onChange={(e) => setEditTime(e.target.value)} className="h-7 text-xs" />
                            </div>
                          </div>
                          <Textarea value={editMessage} onChange={(e) => setEditMessage(e.target.value)} rows={3} className="text-xs" />
                          <div className="flex gap-2">
                            <Button size="sm" className="flex-1 h-7 text-xs" onClick={() => handleSaveEdit(r.id)} disabled={updateReminderMutation.isPending}>
                              Salvar
                            </Button>
                            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setEditingReminderId(null)}>
                              Cancelar
                            </Button>
                          </div>
                        </div>
                      ) : (
                        // Modo visualização
                        <div>
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                {reminderStatusBadge(r.status)}
                                <span className="text-xs text-muted-foreground">
                                  {new Date(r.scheduledAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                                </span>
                              </div>
                              <p className="text-xs text-muted-foreground line-clamp-2 whitespace-pre-wrap">{r.message}</p>
                            </div>
                            <div className="flex gap-1 shrink-0">
                              {r.status === "pending" && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                                  onClick={() => startEditing(r)}
                                  title="Editar"
                                >
                                  <Send className="h-3 w-3" />
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 p-0 text-red-500 hover:text-red-700"
                                onClick={() => {
                                  if (confirm("Remover este lembrete?")) {
                                    deleteReminderMutation.mutate({ id: r.id });
                                  }
                                }}
                                disabled={deleteReminderMutation.isPending}
                                title="Remover"
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          {/* ABA: COMPARTILHAR / EXPORTAR */}
          {eventId && (
            <TabsContent value="export" className="flex-1 overflow-y-auto">
              <ExportTab eventId={eventId} copiedLink={copiedLink} setCopiedLink={setCopiedLink} />
            </TabsContent>
          )}
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

// Componente separado para a aba de exportação
function ExportTab({ eventId, copiedLink, setCopiedLink }: { eventId: number; copiedLink: string | null; setCopiedLink: (v: string | null) => void }) {
  const { data: links, isLoading } = trpc.appointments.getCalendarLinks.useQuery(
    { id: eventId },
    { enabled: !!eventId }
  );

  const copyToClipboard = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedLink(key);
      setTimeout(() => setCopiedLink(null), 2000);
    } catch {
      // fallback
      const el = document.createElement("textarea");
      el.value = text;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      setCopiedLink(key);
      setTimeout(() => setCopiedLink(null), 2000);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">Gerando links...</span>
      </div>
    );
  }

  if (!links) return null;

  return (
    <div className="space-y-4 pr-2 py-2">
      {/* Adicionar ao Calendário */}
      <div className="rounded-lg border p-4 space-y-3">
        <p className="text-sm font-semibold flex items-center gap-2">
          <CalendarPlus className="h-4 w-4 text-primary" />
          Adicionar ao Calendário
        </p>
        <div className="grid grid-cols-1 gap-2">
          {/* iCloud */}
          <a
            href={links.icsUrl}
            download
            className="flex items-center gap-3 rounded-lg border p-3 hover:bg-muted/50 transition-colors cursor-pointer"
          >
            <div className="w-9 h-9 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center shrink-0">
              <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
                <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">iCloud Calendar</p>
              <p className="text-xs text-muted-foreground">Baixar arquivo .ics para importar</p>
            </div>
            <Download className="h-4 w-4 text-muted-foreground shrink-0" />
          </a>

          {/* Google Calendar */}
          <a
            href={links.googleCalendarUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 rounded-lg border p-3 hover:bg-muted/50 transition-colors cursor-pointer"
          >
            <div className="w-9 h-9 rounded-lg bg-blue-50 dark:bg-blue-950 flex items-center justify-center shrink-0">
              <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">Google Calendar</p>
              <p className="text-xs text-muted-foreground">Abrir no Google Calendar</p>
            </div>
            <ExternalLink className="h-4 w-4 text-muted-foreground shrink-0" />
          </a>
        </div>
      </div>

      {/* Confirmação de Horário */}
      <div className="rounded-lg border p-4 space-y-3">
        <p className="text-sm font-semibold flex items-center gap-2">
          <CheckCircle className="h-4 w-4 text-green-500" />
          Confirmação de Horário
        </p>
        <p className="text-xs text-muted-foreground">Link para o cliente confirmar a presença</p>
        <div className="flex gap-2">
          <Input
            value={links.confirmationLink}
            readOnly
            className="text-xs h-8 font-mono"
          />
          <Button
            size="sm"
            variant="outline"
            className="h-8 shrink-0"
            onClick={() => copyToClipboard(links.confirmationLink, "confirm")}
          >
            {copiedLink === "confirm" ? <CheckCheck className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
          </Button>
        </div>
      </div>

      {/* WhatsApp */}
      <div className="rounded-lg border p-4 space-y-3">
        <p className="text-sm font-semibold flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-green-600" />
          Enviar via WhatsApp
        </p>
        <p className="text-xs text-muted-foreground">
          Mensagem com todos os detalhes do agendamento e link de confirmação
          {links.clientPhone ? ` para ${links.clientPhone}` : " (cliente sem telefone)"}
        </p>
        <div className="flex gap-2">
          <a
            href={links.whatsappLink}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1"
          >
            <Button className="w-full bg-green-600 hover:bg-green-700 text-white h-9">
              <MessageSquare className="mr-2 h-4 w-4" />
              Abrir WhatsApp
            </Button>
          </a>
          <Button
            size="sm"
            variant="outline"
            className="h-9 shrink-0"
            onClick={() => copyToClipboard(links.whatsappLink, "whatsapp")}
          >
            {copiedLink === "whatsapp" ? <CheckCheck className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
          </Button>
        </div>
      </div>

      {/* Anamnese */}
      {links.hasAnamnesis && links.anamnesisLink ? (
        <div className="rounded-lg border p-4 space-y-3 border-amber-500/30 bg-amber-500/5">
          <p className="text-sm font-semibold flex items-center gap-2">
            <span className="text-amber-500">⚠️</span>
            Ficha de Anamnese
          </p>
          <p className="text-xs text-muted-foreground">Este cliente possui ficha de anamnese preenchida</p>
          <div className="flex gap-2">
            <a href={links.anamnesisLink} target="_blank" rel="noopener noreferrer" className="flex-1">
              <Button variant="outline" className="w-full h-8 text-xs border-amber-500/50 text-amber-600 hover:bg-amber-500/10">
                <ExternalLink className="mr-2 h-3 w-3" />
                Ver Ficha de Anamnese
              </Button>
            </a>
            <Button
              size="sm"
              variant="outline"
              className="h-8 shrink-0"
              onClick={() => copyToClipboard(links.anamnesisLink!, "anamnesis")}
            >
              {copiedLink === "anamnesis" ? <CheckCheck className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
            </Button>
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-dashed p-4 text-center">
          <p className="text-xs text-muted-foreground">Este cliente ainda não possui ficha de anamnese preenchida.</p>
        </div>
      )}
    </div>
  );
}
