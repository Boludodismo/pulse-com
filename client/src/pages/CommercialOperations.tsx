import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertTriangle, CalendarClock, CheckCircle2, Clock3, DollarSign, ListPlus,
  MessageCircle, Plus, RefreshCw, Sparkles, Trash2, UserRound, UsersRound,
} from "lucide-react";
import { useLocation } from "wouter";

const LEAD_STAGES = [
  ["new", "Novo contato"],
  ["awaiting_info", "Coletando informações"],
  ["preparing_quote", "Preparar orçamento"],
  ["quote_sent", "Orçamento enviado"],
  ["awaiting_reply", "Aguardando resposta"],
  ["awaiting_deposit", "Aguardando sinal"],
  ["scheduled", "Agendado"],
] as const;

type LeadStage = typeof LEAD_STAGES[number][0] | "lost" | "archived";

const DAYS = [
  ["segunda", "Seg"], ["terca", "Ter"], ["quarta", "Qua"], ["quinta", "Qui"],
  ["sexta", "Sex"], ["sabado", "Sáb"], ["domingo", "Dom"],
] as const;

const PERIODS = [["manha", "Manhã"], ["tarde", "Tarde"], ["noite", "Noite"]] as const;

const STAGE_LABEL = Object.fromEntries([
  ...LEAD_STAGES,
  ["lost", "Perdido"],
  ["archived", "Arquivado"],
]);

const WAITLIST_STATUS: Record<string, string> = {
  active: "Ativo", contacted: "Contatado", booked: "Agendado", paused: "Pausado", cancelled: "Cancelado",
};

const FOLLOWUP_STAGE: Record<string, string> = {
  healing_7d: "Cicatrização — 7 dias",
  healed_60d: "Resultado — 60 dias",
  feedback_180d: "Relacionamento — 6 meses",
  anniversary_365d: "Aniversário — 1 ano",
};

function whatsappUrl(phone: string | null | undefined, message: string) {
  const digits = (phone || "").replace(/\D/g, "");
  if (!digits) return null;
  const number = digits.startsWith("55") ? digits : `55${digits}`;
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}

function openWhatsApp(phone: string | null | undefined, message: string) {
  const url = whatsappUrl(phone, message);
  if (!url) return toast.error("Este contato não possui WhatsApp cadastrado.");
  window.open(url, "_blank", "noopener,noreferrer");
}

function formatDate(value: string | Date | null | undefined, withTime = true) {
  if (!value) return "Sem data";
  const date = typeof value === "string" ? new Date(value.replace(" ", "T")) : value;
  return new Intl.DateTimeFormat("pt-BR", withTime
    ? { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }
    : { day: "2-digit", month: "2-digit", year: "numeric" }).format(date);
}

function money(cents: number | null | undefined) {
  if (cents == null) return null;
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

const emptyLead = {
  name: "", phone: "", email: "", service: "", artistId: "none", estimatedValue: "",
  stage: "new" as LeadStage, nextFollowupAt: "", description: "",
};

const emptyWaitlist = {
  clientId: "", artistId: "none", service: "", preferredDays: [] as string[],
  preferredPeriods: [] as string[], minDuration: "60", maxDuration: "480", priority: "0", notes: "",
};

export default function CommercialOperations() {
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const [leadOpen, setLeadOpen] = useState(false);
  const [waitlistOpen, setWaitlistOpen] = useState(false);
  const [leadForm, setLeadForm] = useState(emptyLead);
  const [waitlistForm, setWaitlistForm] = useState(emptyWaitlist);

  const today = trpc.commercial.today.useQuery(undefined, { refetchInterval: 60_000 });
  const leads = trpc.commercial.leads.list.useQuery();
  const waitlist = trpc.commercial.waitlist.list.useQuery();
  const suggestions = trpc.commercial.waitlist.suggestions.useQuery();
  const clients = trpc.clients.list.useQuery();
  const artists = trpc.artists.list.useQuery();

  const invalidate = async () => {
    await Promise.all([
      utils.commercial.today.invalidate(), utils.commercial.leads.list.invalidate(),
      utils.commercial.waitlist.list.invalidate(), utils.commercial.waitlist.suggestions.invalidate(),
    ]);
  };

  const createLead = trpc.commercial.leads.create.useMutation({
    onSuccess: async () => {
      toast.success("Oportunidade adicionada ao funil.");
      setLeadOpen(false); setLeadForm(emptyLead); await invalidate();
    },
    onError: error => toast.error(error.message),
  });

  const updateLead = trpc.commercial.leads.update.useMutation({
    onSuccess: invalidate,
    onError: error => toast.error(error.message),
  });

  const deleteLead = trpc.commercial.leads.delete.useMutation({
    onSuccess: async () => { toast.success("Oportunidade removida."); await invalidate(); },
    onError: error => toast.error(error.message),
  });

  const createWaitlist = trpc.commercial.waitlist.create.useMutation({
    onSuccess: async () => {
      toast.success("Cliente adicionado à lista de encaixe.");
      setWaitlistOpen(false); setWaitlistForm(emptyWaitlist); await invalidate();
    },
    onError: error => toast.error(error.message),
  });

  const updateWaitlist = trpc.commercial.waitlist.update.useMutation({
    onSuccess: invalidate,
    onError: error => toast.error(error.message),
  });

  const deleteWaitlist = trpc.commercial.waitlist.delete.useMutation({
    onSuccess: async () => { toast.success("Cliente removido da lista."); await invalidate(); },
    onError: error => toast.error(error.message),
  });

  const activeLeads = useMemo(() => (leads.data || []).filter(item => item.stage !== "lost" && item.stage !== "archived"), [leads.data]);
  const pipelineValue = activeLeads.reduce((sum, item) => sum + (item.estimatedValue || 0), 0);
  const summary = today.data?.summary;

  const submitLead = () => {
    createLead.mutate({
      name: leadForm.name,
      phone: leadForm.phone || null,
      email: leadForm.email || null,
      service: leadForm.service || null,
      artistId: leadForm.artistId === "none" ? null : Number(leadForm.artistId),
      estimatedValue: leadForm.estimatedValue ? Math.round(Number(leadForm.estimatedValue.replace(",", ".")) * 100) : null,
      stage: leadForm.stage,
      nextFollowupAt: leadForm.nextFollowupAt || null,
      description: leadForm.description || null,
    });
  };

  const submitWaitlist = () => {
    createWaitlist.mutate({
      clientId: Number(waitlistForm.clientId),
      artistId: waitlistForm.artistId === "none" ? null : Number(waitlistForm.artistId),
      service: waitlistForm.service || null,
      preferredDays: waitlistForm.preferredDays as ("domingo" | "segunda" | "terca" | "quarta" | "quinta" | "sexta" | "sabado")[],
      preferredPeriods: waitlistForm.preferredPeriods as ("manha" | "tarde" | "noite")[],
      minDuration: Number(waitlistForm.minDuration),
      maxDuration: Number(waitlistForm.maxDuration),
      priority: Number(waitlistForm.priority),
      notes: waitlistForm.notes || null,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Operação Comercial</h1>
          <p className="mt-1 text-sm text-muted-foreground">O que precisa de atenção hoje, oportunidades e encaixes em uma única tela.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => { today.refetch(); leads.refetch(); waitlist.refetch(); suggestions.refetch(); }}>
            <RefreshCw className="mr-2 h-4 w-4" /> Atualizar
          </Button>
          <Button variant="outline" onClick={() => setWaitlistOpen(true)}><ListPlus className="mr-2 h-4 w-4" /> Lista de encaixe</Button>
          <Button onClick={() => setLeadOpen(true)}><Plus className="mr-2 h-4 w-4" /> Nova oportunidade</Button>
        </div>
      </div>

      <section className="space-y-3">
        <div className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary" /><h2 className="text-xl font-semibold">Hoje no estúdio</h2></div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
          {[
            { label: "Sessões", value: summary?.appointmentsToday || 0, icon: CalendarClock },
            { label: "Confirmar", value: summary?.pendingConfirmation || 0, icon: Clock3 },
            { label: "Pagamentos", value: summary?.pendingPayments || 0, icon: DollarSign },
            { label: "Alertas", value: summary?.delayedAttention || 0, icon: AlertTriangle },
            { label: "Retornos", value: summary?.leadsDue || 0, icon: MessageCircle },
            { label: "Pós-venda", value: summary?.postSaleDue || 0, icon: CheckCircle2 },
          ].map(item => {
            const Icon = item.icon;
            return (
            <Card key={item.label} className={item.value > 0 && ["Alertas", "Retornos"].includes(item.label) ? "border-amber-500/50" : ""}>
              <CardContent className="p-4"><div className="flex items-center justify-between"><span className="text-xs text-muted-foreground">{item.label}</span><Icon className="h-4 w-4 text-muted-foreground" /></div><p className="mt-2 text-2xl font-bold">{item.value}</p></CardContent>
            </Card>
          )})}
        </div>

        <div className="grid gap-4 xl:grid-cols-3">
          <Card className="xl:col-span-2">
            <CardHeader><CardTitle className="text-base">Agenda de hoje</CardTitle><CardDescription>Sessões em ordem de horário e pendências operacionais.</CardDescription></CardHeader>
            <CardContent className="space-y-2">
              {(today.data?.appointments || []).length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">Nenhuma sessão agendada para hoje.</p>}
              {(today.data?.appointments || []).map(item => (
                <div key={item.id} className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 gap-3"><div className="rounded-md bg-primary/10 px-2 py-1 text-sm font-bold text-primary">{formatDate(item.date).split(" ")[1]}</div><div className="min-w-0"><p className="truncate font-medium">{item.clientName || "Cliente"} · {item.service}</p><p className="text-xs text-muted-foreground">{item.artist} · {item.duration} min</p></div></div>
                  <div className="flex flex-wrap items-center gap-2">
                    {item.confirmationStatus === "pendente" && <Badge variant="outline">Aguardando confirmação</Badge>}
                    {(item.confirmationStatus === "atraso" || item.confirmationAttention === "pending") && <Badge className="bg-amber-500 text-black"><AlertTriangle className="mr-1 h-3 w-3" /> Atenção</Badge>}
                    {item.paymentStatus !== "pago" && <Badge variant="secondary">Pagamento pendente</Badge>}
                    <Button size="sm" variant="ghost" onClick={() => openWhatsApp(item.clientPhone, `Olá, ${(item.clientName || "").split(" ")[0]}! Tudo bem? Estou entrando em contato sobre seu horário de hoje às ${formatDate(item.date).split(" ")[1]}.`)}><MessageCircle className="h-4 w-4" /></Button>
                  </div>
                </div>
              ))}
              <Button variant="outline" className="w-full" onClick={() => setLocation("/schedule")}>Abrir agenda completa</Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Ações pendentes</CardTitle><CardDescription>Retornos comerciais e pós-venda vencendo.</CardDescription></CardHeader>
            <CardContent className="max-h-[390px] space-y-2 overflow-y-auto">
              {[...(today.data?.followups || []).map(item => ({ id: `l${item.id}`, name: item.name, phone: item.phone, label: `Retorno: ${STAGE_LABEL[item.stage]}`, date: item.nextFollowupAt, message: `Olá, ${item.name.split(" ")[0]}! Tudo bem? Estou passando para dar continuidade ao seu atendimento sobre ${item.service || "seu projeto"}. Posso ajudar em alguma informação?` })), ...(today.data?.postSale || []).map(item => ({ id: `p${item.id}`, name: item.clientName || "Cliente", phone: item.clientPhone, label: FOLLOWUP_STAGE[item.stage] || "Pós-venda", date: item.scheduledAt, message: item.message || `Olá, ${(item.clientName || "").split(" ")[0]}! Tudo bem? Como você está se sentindo após sua sessão?` }))].map(item => (
                <div key={item.id} className="rounded-lg border p-3"><div className="flex items-start justify-between gap-2"><div><p className="text-sm font-medium">{item.name}</p><p className="text-xs text-muted-foreground">{item.label} · {formatDate(item.date)}</p></div><Button size="sm" variant="ghost" onClick={() => openWhatsApp(item.phone, item.message)}><MessageCircle className="h-4 w-4" /></Button></div></div>
              ))}
              {(today.data?.followups.length || 0) + (today.data?.postSale.length || 0) === 0 && <p className="py-8 text-center text-sm text-muted-foreground">Tudo em dia por aqui.</p>}
            </CardContent>
          </Card>
        </div>
      </section>

      <Tabs defaultValue="pipeline" className="space-y-4">
        <TabsList><TabsTrigger value="pipeline">Funil de vendas</TabsTrigger><TabsTrigger value="waitlist">Lista inteligente de encaixe</TabsTrigger></TabsList>
        <TabsContent value="pipeline" className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Oportunidades ativas</p><p className="mt-1 text-2xl font-bold">{activeLeads.length}</p></CardContent></Card>
            <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Valor potencial</p><p className="mt-1 text-2xl font-bold">{money(pipelineValue)}</p></CardContent></Card>
            <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Orçamentos enviados</p><p className="mt-1 text-2xl font-bold">{activeLeads.filter(item => ["quote_sent", "awaiting_reply", "awaiting_deposit"].includes(item.stage)).length}</p></CardContent></Card>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-3">
            {LEAD_STAGES.map(([stage, label]) => {
              const stageItems = activeLeads.filter(item => item.stage === stage);
              return <div key={stage} className="w-[285px] shrink-0 rounded-xl bg-muted/35 p-3"><div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-semibold">{label}</h3><Badge variant="secondary">{stageItems.length}</Badge></div><div className="space-y-2">{stageItems.map(item => (
                <Card key={item.id}><CardContent className="space-y-3 p-3"><div><p className="font-medium">{item.name}</p><p className="text-xs text-muted-foreground">{item.service || "Serviço a definir"}{item.artistName ? ` · ${item.artistName}` : ""}</p></div>{item.estimatedValue != null && <p className="text-sm font-semibold text-primary">{money(item.estimatedValue)}</p>}{item.nextFollowupAt && <p className="text-xs text-muted-foreground"><Clock3 className="mr-1 inline h-3 w-3" /> Retorno {formatDate(item.nextFollowupAt)}</p>}<Select value={item.stage} onValueChange={value => updateLead.mutate({ id: item.id, stage: value as LeadStage })}><SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger><SelectContent>{LEAD_STAGES.map(([value, text]) => <SelectItem key={value} value={value}>{text}</SelectItem>)}<SelectItem value="lost">Perdido</SelectItem><SelectItem value="archived">Arquivado</SelectItem></SelectContent></Select><div className="flex justify-end gap-1"><Button size="sm" variant="ghost" onClick={() => openWhatsApp(item.phone, `Olá, ${item.name.split(" ")[0]}! Tudo bem? Estou dando continuidade ao seu atendimento sobre ${item.service || "seu projeto"}. Como posso ajudar?`)}><MessageCircle className="h-4 w-4" /></Button><Button size="sm" variant="ghost" className="text-destructive" onClick={() => confirm("Remover esta oportunidade?") && deleteLead.mutate({ id: item.id })}><Trash2 className="h-4 w-4" /></Button></div></CardContent></Card>
              ))}{stageItems.length === 0 && <p className="py-6 text-center text-xs text-muted-foreground">Nenhuma oportunidade</p>}</div></div>;
            })}
          </div>
        </TabsContent>

        <TabsContent value="waitlist" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Sparkles className="h-4 w-4 text-primary" /> Encaixes sugeridos</CardTitle><CardDescription>O sistema compara horários cancelados dos próximos 60 dias com preferências, artista e duração.</CardDescription></CardHeader>
            <CardContent className="space-y-3">
              {(suggestions.data || []).map(slot => <div key={slot.id} className="rounded-xl border p-4"><div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-semibold">Horário liberado · {formatDate(slot.date)}</p><p className="text-sm text-muted-foreground">{slot.artist} · {slot.duration} min · {slot.service}</p></div><Badge variant="outline">{slot.matches.length} compatíveis</Badge></div><div className="mt-3 grid gap-2 lg:grid-cols-2">{slot.matches.map(match => <div key={match.id} className="flex items-center justify-between rounded-lg bg-muted/40 p-3"><div><p className="text-sm font-medium">{match.clientName}</p><p className="text-xs text-muted-foreground">Compatibilidade {Math.min(match.score, 100)}% · {match.service || "Serviço flexível"}</p></div><Button size="sm" onClick={() => { openWhatsApp(match.clientPhone, `Olá, ${(match.clientName || "").split(" ")[0]}! Tudo bem? Surgiu um horário disponível com ${slot.artist} no dia ${formatDate(slot.date)} para ${slot.service}. Você gostaria de aproveitar este encaixe?`); updateWaitlist.mutate({ id: match.id, status: "contacted" }); }}><MessageCircle className="mr-1 h-4 w-4" /> Convidar</Button></div>)}</div>{slot.matches.length === 0 && <p className="mt-3 text-sm text-muted-foreground">Nenhum cliente compatível encontrado.</p>}</div>)}
              {(suggestions.data || []).length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">Não há horários cancelados futuros aguardando encaixe.</p>}
            </CardContent>
          </Card>

          <div className="grid gap-3 lg:grid-cols-2">
            {(waitlist.data || []).map(item => <Card key={item.id}><CardContent className="p-4"><div className="flex items-start justify-between gap-3"><div className="flex gap-3"><div className="rounded-full bg-primary/10 p-2"><UserRound className="h-4 w-4 text-primary" /></div><div><p className="font-medium">{item.clientName}</p><p className="text-sm text-muted-foreground">{item.service || "Qualquer serviço"} · {item.artistName || "Qualquer artista"}</p><p className="mt-1 text-xs text-muted-foreground">Duração: {item.minDuration}–{item.maxDuration} min · Prioridade {item.priority}</p></div></div><Badge variant={item.status === "active" ? "default" : "secondary"}>{WAITLIST_STATUS[item.status]}</Badge></div><div className="mt-3 flex items-center justify-end gap-2"><Select value={item.status} onValueChange={value => updateWaitlist.mutate({ id: item.id, status: value as "active" | "contacted" | "booked" | "paused" | "cancelled" })}><SelectTrigger className="h-8 w-[135px] text-xs"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(WAITLIST_STATUS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select><Button size="sm" variant="ghost" onClick={() => openWhatsApp(item.clientPhone, `Olá, ${(item.clientName || "").split(" ")[0]}! Tudo bem? Estamos verificando possibilidades de encaixe para você.`)}><MessageCircle className="h-4 w-4" /></Button><Button size="sm" variant="ghost" className="text-destructive" onClick={() => confirm("Remover da lista de encaixe?") && deleteWaitlist.mutate({ id: item.id })}><Trash2 className="h-4 w-4" /></Button></div></CardContent></Card>)}
            {(waitlist.data || []).length === 0 && <Card className="lg:col-span-2"><CardContent className="py-10 text-center"><UsersRound className="mx-auto mb-2 h-8 w-8 text-muted-foreground" /><p className="text-sm text-muted-foreground">A lista de encaixe ainda está vazia.</p></CardContent></Card>}
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={leadOpen} onOpenChange={setLeadOpen}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl"><DialogHeader><DialogTitle>Nova oportunidade</DialogTitle></DialogHeader><div className="grid gap-4 py-2"><div className="grid gap-2"><Label>Nome *</Label><Input value={leadForm.name} onChange={e => setLeadForm({ ...leadForm, name: e.target.value })} placeholder="Nome do contato" /></div><div className="grid gap-3 sm:grid-cols-2"><div className="grid gap-2"><Label>WhatsApp</Label><Input value={leadForm.phone} onChange={e => setLeadForm({ ...leadForm, phone: e.target.value })} placeholder="(00) 00000-0000" /></div><div className="grid gap-2"><Label>E-mail</Label><Input type="email" value={leadForm.email} onChange={e => setLeadForm({ ...leadForm, email: e.target.value })} /></div></div><div className="grid gap-3 sm:grid-cols-2"><div className="grid gap-2"><Label>Serviço ou projeto</Label><Input value={leadForm.service} onChange={e => setLeadForm({ ...leadForm, service: e.target.value })} placeholder="Ex.: fechamento de braço" /></div><div className="grid gap-2"><Label>Valor estimado (R$)</Label><Input inputMode="decimal" value={leadForm.estimatedValue} onChange={e => setLeadForm({ ...leadForm, estimatedValue: e.target.value })} placeholder="0,00" /></div></div><div className="grid gap-3 sm:grid-cols-2"><div className="grid gap-2"><Label>Artista</Label><Select value={leadForm.artistId} onValueChange={artistId => setLeadForm({ ...leadForm, artistId })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">A definir</SelectItem>{(artists.data || []).filter(a => a.active).map(a => <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>)}</SelectContent></Select></div><div className="grid gap-2"><Label>Próximo retorno</Label><Input type="datetime-local" value={leadForm.nextFollowupAt} onChange={e => setLeadForm({ ...leadForm, nextFollowupAt: e.target.value })} /></div></div><div className="grid gap-2"><Label>Etapa</Label><Select value={leadForm.stage} onValueChange={stage => setLeadForm({ ...leadForm, stage: stage as LeadStage })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{LEAD_STAGES.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></div><div className="grid gap-2"><Label>Descrição</Label><Textarea value={leadForm.description} onChange={e => setLeadForm({ ...leadForm, description: e.target.value })} placeholder="Estilo, tamanho, local do corpo e demais detalhes" /></div></div><DialogFooter><Button variant="outline" onClick={() => setLeadOpen(false)}>Cancelar</Button><Button disabled={leadForm.name.trim().length < 2 || createLead.isPending} onClick={submitLead}>Salvar oportunidade</Button></DialogFooter></DialogContent></Dialog>

      <Dialog open={waitlistOpen} onOpenChange={setWaitlistOpen}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl"><DialogHeader><DialogTitle>Adicionar à lista de encaixe</DialogTitle></DialogHeader><div className="grid gap-4 py-2"><div className="grid gap-2"><Label>Cliente *</Label><Select value={waitlistForm.clientId} onValueChange={clientId => setWaitlistForm({ ...waitlistForm, clientId })}><SelectTrigger><SelectValue placeholder="Selecione um cliente" /></SelectTrigger><SelectContent>{(clients.data || []).map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}{c.phone ? ` · ${c.phone}` : ""}</SelectItem>)}</SelectContent></Select></div><div className="grid gap-3 sm:grid-cols-2"><div className="grid gap-2"><Label>Artista preferido</Label><Select value={waitlistForm.artistId} onValueChange={artistId => setWaitlistForm({ ...waitlistForm, artistId })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Qualquer artista</SelectItem>{(artists.data || []).filter(a => a.active).map(a => <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>)}</SelectContent></Select></div><div className="grid gap-2"><Label>Serviço</Label><Input value={waitlistForm.service} onChange={e => setWaitlistForm({ ...waitlistForm, service: e.target.value })} /></div></div><div className="grid gap-2"><Label>Dias preferidos</Label><div className="flex flex-wrap gap-3">{DAYS.map(([value, label]) => <label key={value} className="flex items-center gap-1.5 text-sm"><Checkbox checked={waitlistForm.preferredDays.includes(value)} onCheckedChange={checked => setWaitlistForm({ ...waitlistForm, preferredDays: checked ? [...waitlistForm.preferredDays, value] : waitlistForm.preferredDays.filter(item => item !== value) })} />{label}</label>)}</div></div><div className="grid gap-2"><Label>Períodos preferidos</Label><div className="flex flex-wrap gap-4">{PERIODS.map(([value, label]) => <label key={value} className="flex items-center gap-1.5 text-sm"><Checkbox checked={waitlistForm.preferredPeriods.includes(value)} onCheckedChange={checked => setWaitlistForm({ ...waitlistForm, preferredPeriods: checked ? [...waitlistForm.preferredPeriods, value] : waitlistForm.preferredPeriods.filter(item => item !== value) })} />{label}</label>)}</div></div><div className="grid grid-cols-3 gap-3"><div className="grid gap-2"><Label>Duração mín.</Label><Input type="number" value={waitlistForm.minDuration} onChange={e => setWaitlistForm({ ...waitlistForm, minDuration: e.target.value })} /></div><div className="grid gap-2"><Label>Duração máx.</Label><Input type="number" value={waitlistForm.maxDuration} onChange={e => setWaitlistForm({ ...waitlistForm, maxDuration: e.target.value })} /></div><div className="grid gap-2"><Label>Prioridade</Label><Input type="number" min="0" max="100" value={waitlistForm.priority} onChange={e => setWaitlistForm({ ...waitlistForm, priority: e.target.value })} /></div></div><div className="grid gap-2"><Label>Observações</Label><Textarea value={waitlistForm.notes} onChange={e => setWaitlistForm({ ...waitlistForm, notes: e.target.value })} /></div></div><DialogFooter><Button variant="outline" onClick={() => setWaitlistOpen(false)}>Cancelar</Button><Button disabled={!waitlistForm.clientId || createWaitlist.isPending} onClick={submitWaitlist}>Adicionar à lista</Button></DialogFooter></DialogContent></Dialog>
    </div>
  );
}
