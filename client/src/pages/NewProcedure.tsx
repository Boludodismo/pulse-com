import { defaultSessionQuantity } from "@shared/sessionMaterialDefaults";
import { useState, useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { ChevronLeft, Stethoscope, Upload, X, Calendar, Clock, Link2, CheckCircle2, Package, Plus, Search, UserPlus, Phone } from "lucide-react";

const BODY_LOCATIONS = [
  "Braço direito", "Braço esquerdo", "Antebraço direito", "Antebraço esquerdo",
  "Ombro direito", "Ombro esquerdo", "Costas", "Peito", "Abdômen",
  "Perna direita", "Perna esquerda", "Panturrilha direita", "Panturrilha esquerda",
  "Pescoço", "Cabeça", "Rosto", "Mão direita", "Mão esquerda",
  "Pé direito", "Pé esquerdo", "Costela", "Nuca", "Outro",
];

const TATTOO_STYLES = [
  "Blackwork", "Realismo", "Realismo colorido", "Old School", "New School",
  "Aquarela", "Geométrico", "Pontilhismo", "Tribal", "Japonês",
  "Fineline", "Trash Polka", "Neotradicional", "Lettering", "Biomecânico",
  "Minimalista", "Mandala", "Outro",
];

const STATUS_LABELS: Record<string, string> = {
  agendado: "Agendado",
  confirmado: "Confirmado",
  concluido: "Concluído",
  cancelado: "Cancelado",
  reagendado: "Reagendado",
};

const STATUS_COLORS: Record<string, string> = {
  agendado: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  confirmado: "bg-green-500/20 text-green-400 border-green-500/30",
  concluido: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  cancelado: "bg-red-500/20 text-red-400 border-red-500/30",
  reagendado: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
};

function formatAppointmentDate(dateStr: string): string {
  try {
    const [datePart, timePart] = dateStr.includes("T") ? dateStr.split("T") : dateStr.split(" ");
    const [year, month, day] = datePart.split("-");
    const time = timePart ? timePart.slice(0, 5) : "";
    return `${day}/${month}/${year}${time ? " às " + time : ""}`;
  } catch {
    return dateStr;
  }
}

export default function NewProcedure() {
  const [, navigate] = useLocation();
  const search = useSearch();
  const params = new URLSearchParams(search);
  const prefilledClientId = params.get("clientId") ? parseInt(params.get("clientId")!, 10) : null;
  const prefilledAppointmentId = params.get("appointmentId") ? parseInt(params.get("appointmentId")!, 10) : null;

  const [form, setForm] = useState({
    clientId: prefilledClientId ?? 0,
    appointmentId: prefilledAppointmentId ?? null as number | null,
    title: "",
    bodyLocation: "",
    tattooStyle: "",
    artistName: "",
    artistId: undefined as number | undefined,
    notes: "",
    referenceImageBase64: "",
    referenceImageMime: "",
  });
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [plannedMaterialId, setPlannedMaterialId] = useState<string | undefined>();
  const [plannedQuantity, setPlannedQuantity] = useState("1");
  const [clientSearch, setClientSearch] = useState("");
  const [newClientOpen, setNewClientOpen] = useState(false);
  const [newClientForm, setNewClientForm] = useState({
    name: "",
    phone: "",
    email: "",
    instagram: "",
  });

  const artistsQuery = trpc.artists.list.useQuery();
  const clientsQuery = trpc.clients.list.useQuery();
  const clients = clientsQuery.data ?? [];
  const clientSearchNormalized = clientSearch.trim().toLowerCase();
  const clientSearchDigits = clientSearch.replace(/\D/g, "");
  const filteredClients = clientSearchNormalized
    ? clients.filter((client) => {
        const nameMatch = client.name.toLowerCase().includes(clientSearchNormalized);
        const phoneDigits = (client.phone ?? "").replace(/\D/g, "");
        const phoneMatch = clientSearchDigits.length > 0 && phoneDigits.includes(clientSearchDigits);
        return nameMatch || phoneMatch;
      }).slice(0, 8)
    : [];

  // Dados do cliente pré-preenchido
  const clientQuery = trpc.clients.getById.useQuery(
    { id: form.clientId },
    { enabled: form.clientId > 0 }
  );
  const selectedClient = clientQuery.data;

  // Agendamentos do cliente selecionado (para vincular)
  const appointmentsQuery = trpc.appointments.getByClientId.useQuery(
    { clientId: form.clientId },
    { enabled: form.clientId > 0 }
  );
  const clientAppointments = (appointmentsQuery.data ?? []).filter(
    (a) => a.status !== "cancelado" && a.status !== "concluido"
  );

  // Agendamento selecionado
  const selectedAppointment = clientAppointments.find((a) => a.id === form.appointmentId) ?? null;
  const { data: availableMaterials = [] } = trpc.pod.inventory.list.useQuery({ artistId: selectedAppointment?.artistId ?? undefined }, { enabled: Boolean(selectedAppointment) });
  const { data: plannedMaterials = [], refetch: refetchPlannedMaterials } = trpc.pod.planning.listByAppointment.useQuery({ appointmentId: form.appointmentId ?? 0 }, { enabled: Boolean(form.appointmentId) });
  const addPlannedMaterialMutation = trpc.pod.planning.add.useMutation({ onSuccess: result => { setPlannedMaterialId(undefined); setPlannedQuantity("1"); void refetchPlannedMaterials(); if (result.forecast?.critical) toast.warning(`${result.forecast.materialName} ficará em nível crítico. O aviso foi enviado ao estúdio e ao artista.`, { duration: 10000 }); else toast.success("Material vinculado à sessão sem baixar o estoque."); }, onError: error => toast.error(`Não foi possível adicionar o material: ${error.message}`) });

  // Pré-preencher dados a partir do agendamento selecionado
  useEffect(() => {
    if (!selectedAppointment) return;
    setForm((f) => ({
      ...f,
      title: f.title || (selectedAppointment.service ?? ""),
      artistName: selectedAppointment.artist ?? "",
      artistId: selectedAppointment.artistId ?? undefined,
    }));
  }, [selectedAppointment?.id]);

  const createClientMutation = trpc.clients.create.useMutation({
    onSuccess: async (client) => {
      await clientsQuery.refetch();
      setForm((current) => ({
        ...current,
        clientId: client.id,
        appointmentId: null,
      }));
      setClientSearch(client.name);
      setNewClientOpen(false);
      setNewClientForm({ name: "", phone: "", email: "", instagram: "" });
      toast.success("Cliente cadastrado e selecionado para esta sessão.");
    },
    onError: (error) => toast.error("Erro ao cadastrar cliente: " + error.message),
  });

  const createMutation = trpc.procedures.create.useMutation({
    onSuccess: (data) => {
      toast.success("Procedimento criado! Iniciando sessão...");
      navigate(`/procedures/${data.id}`);
    },
    onError: (err) => toast.error("Erro ao criar: " + err.message),
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 16 * 1024 * 1024) {
      toast.error("Arquivo muito grande. Máximo 16MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(",")[1];
      setForm((f) => ({ ...f, referenceImageBase64: base64, referenceImageMime: file.type }));
      setPreviewUrl(result);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleSubmit = () => {
    if (!form.clientId || form.clientId <= 0) {
      toast.error("Selecione um cliente.");
      return;
    }
    if (!form.title.trim()) {
      toast.error("Informe o título do procedimento.");
      return;
    }
    createMutation.mutate({
      clientId: form.clientId,
      appointmentId: form.appointmentId ?? undefined,
      artistId: selectedAppointment?.artistId ?? form.artistId,
      title: form.title.trim(),
      bodyLocation: form.bodyLocation || undefined,
      tattooStyle: form.tattooStyle || undefined,
      artistName: form.artistName || undefined,
      notes: form.notes || undefined,
      referenceImageBase64: form.referenceImageBase64 || undefined,
      referenceImageMime: form.referenceImageMime || undefined,
    });
  };

  return (
    <DashboardLayout>
      <div className="p-4 sm:p-6 lg:p-8 max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(prefilledClientId ? `/clients/${prefilledClientId}?tab=procedures` : "/procedures")}
          >
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <Stethoscope className="w-5 h-5 text-primary" />
              Nova Sessão Tattoo
            </h1>
            <p className="text-sm text-muted-foreground">Prepare a referência e inicie a sessão</p>
          </div>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-muted-foreground uppercase tracking-wide">
              Dados da sessão
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Cliente */}
            {prefilledClientId && selectedClient ? (
              <div>
                <Label>Cliente</Label>
                <div className="mt-1 flex items-center gap-3 p-3 rounded-lg bg-muted/50 border">
                  <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center text-primary font-semibold text-sm shrink-0">
                    {selectedClient.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{selectedClient.name}</p>
                    {selectedClient.phone && (
                      <p className="text-xs text-muted-foreground">{selectedClient.phone}</p>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <Label>Cliente *</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                  <Input
                    value={clientSearch}
                    onChange={(event) => setClientSearch(event.target.value)}
                    placeholder="Buscar por nome ou telefone..."
                    inputMode="search"
                    className="pl-9"
                    autoComplete="off"
                  />
                </div>

                {form.clientId > 0 && selectedClient && (
                  <div className="flex items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 p-3">
                    <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center text-primary font-semibold text-sm shrink-0">
                      {selectedClient.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{selectedClient.name}</p>
                      {selectedClient.phone && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Phone className="w-3 h-3" /> {selectedClient.phone}
                        </p>
                      )}
                    </div>
                    <CheckCircle2 className="w-5 h-5 text-primary shrink-0" />
                  </div>
                )}

                {clientSearchNormalized && (
                  <div className="rounded-lg border bg-popover overflow-hidden">
                    {filteredClients.length > 0 ? (
                      <div className="max-h-64 overflow-y-auto">
                        {filteredClients.map((client) => (
                          <button
                            key={client.id}
                            type="button"
                            className={`w-full flex items-center gap-3 px-3 py-3 text-left hover:bg-accent transition-colors border-b last:border-b-0 ${form.clientId === client.id ? "bg-primary/10" : ""}`}
                            onClick={() => {
                              setForm((current) => ({
                                ...current,
                                clientId: client.id,
                                appointmentId: null,
                              }));
                              setClientSearch(client.name);
                            }}
                          >
                            <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center text-primary font-semibold text-xs shrink-0">
                              {client.name.charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="font-medium text-sm truncate">{client.name}</p>
                              <p className="text-xs text-muted-foreground truncate">
                                {client.phone || "Sem telefone cadastrado"}
                              </p>
                            </div>
                            {form.clientId === client.id && <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="px-3 py-3 text-sm text-muted-foreground">
                        Nenhum cliente encontrado com “{clientSearch}”.
                      </div>
                    )}
                  </div>
                )}

                <Button
                  type="button"
                  variant="outline"
                  className="w-full gap-2 justify-center min-h-11"
                  onClick={() => {
                    setNewClientForm((current) => ({
                      ...current,
                      name: current.name || clientSearch.trim(),
                    }));
                    setNewClientOpen(true);
                  }}
                >
                  <UserPlus className="w-4 h-4" />
                  Adicionar novo cliente
                </Button>
              </div>
            )}

            {/* Vincular a agendamento */}
            {form.clientId > 0 && (
              <div>
                <Label className="flex items-center gap-2">
                  <Link2 className="w-4 h-4 text-primary" />
                  Vincular a agendamento
                  <span className="text-xs text-muted-foreground font-normal">(opcional)</span>
                </Label>

                {clientAppointments.length === 0 ? (
                  <p className="mt-1 text-sm text-muted-foreground italic">
                    Nenhum agendamento ativo encontrado para este cliente.
                  </p>
                ) : (
                  <div className="mt-2 space-y-2 max-h-48 overflow-y-auto pr-1">
                    {/* Opção: sem vínculo */}
                    <button
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, appointmentId: null }))}
                      className={`w-full text-left p-3 rounded-lg border transition-colors text-sm ${
                        form.appointmentId === null
                          ? "border-primary bg-primary/10"
                          : "border-border hover:border-primary/50 hover:bg-muted/50"
                      }`}
                    >
                      <span className="text-muted-foreground italic">Sem vínculo com agendamento</span>
                    </button>

                    {clientAppointments.map((apt) => (
                      <button
                        key={apt.id}
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, appointmentId: apt.id }))}
                        className={`w-full text-left p-3 rounded-lg border transition-colors ${
                          form.appointmentId === apt.id
                            ? "border-primary bg-primary/10"
                            : "border-border hover:border-primary/50 hover:bg-muted/50"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">
                              {apt.service || "Serviço não especificado"}
                            </p>
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Calendar className="w-3 h-3" />
                                {formatAppointmentDate(apt.date)}
                              </span>
                              {apt.duration && (
                                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                  <Clock className="w-3 h-3" />
                                  {apt.duration}min
                                </span>
                              )}
                              {apt.artist && (
                                <span className="text-xs text-muted-foreground">
                                  · {apt.artist}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className={`text-xs px-2 py-0.5 rounded-full border ${STATUS_COLORS[apt.status] ?? ""}`}>
                              {STATUS_LABELS[apt.status] ?? apt.status}
                            </span>
                            {form.appointmentId === apt.id && (
                              <CheckCircle2 className="w-4 h-4 text-primary" />
                            )}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {/* Card de confirmação do agendamento selecionado */}
                {selectedAppointment && (
                  <div className="mt-2 p-3 rounded-lg bg-primary/5 border border-primary/20 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                    <p className="text-xs text-primary">
                      Sessão será vinculada ao agendamento de{" "}
                      <strong>{formatAppointmentDate(selectedAppointment.date)}</strong>
                      {selectedAppointment.service ? ` — ${selectedAppointment.service}` : ""}
                    </p>
                  </div>
                )}
                {selectedAppointment && <div className="mt-3 space-y-2 rounded-lg border p-3">
                  <Label className="flex items-center gap-2"><Package className="h-4 w-4 text-primary" />Materiais da sessão (opcional)</Label>
                  <p className="text-xs text-muted-foreground">A seleção apenas prepara a sessão; o estoque será baixado quando o artista confirmar o uso.</p>
                  <div className="grid grid-cols-[minmax(0,1fr)_auto] sm:grid-cols-[minmax(0,1fr)_80px_auto] gap-2"><Select value={plannedMaterialId} onValueChange={id => {setPlannedMaterialId(id);setPlannedQuantity(defaultSessionQuantity(availableMaterials.find(m=>String(m.id)===id)));}}><SelectTrigger className="col-span-2 sm:col-span-1 w-full min-w-0 [&>span]:truncate"><SelectValue placeholder="Material" /></SelectTrigger><SelectContent>{availableMaterials.map(material => <SelectItem key={material.id} value={String(material.id)}>{material.name} · {Number(material.currentQuantity).toLocaleString("pt-BR")} {material.unit}</SelectItem>)}</SelectContent></Select><Input value={plannedQuantity} inputMode="decimal" onChange={event => setPlannedQuantity(event.target.value.replace(",", "."))} aria-label="Quantidade prevista" /><Button type="button" size="icon" disabled={!plannedMaterialId || addPlannedMaterialMutation.isPending} onClick={() => addPlannedMaterialMutation.mutate({ appointmentId: selectedAppointment.id, tenantMaterialId: Number(plannedMaterialId), quantityPlanned: plannedQuantity })}><Plus className="h-4 w-4" /></Button></div>
                  {plannedMaterials.filter(item => item.status === "planejado").map(item => <div key={item.id} className="rounded-md bg-muted/40 px-2 py-1.5 text-xs">{item.nameSnapshot} · {Number(item.quantityPlanned).toLocaleString("pt-BR")} {item.unitSnapshot}</div>)}
                </div>}
              </div>
            )}

            {/* Título */}
            <div>
              <Label>Projeto / título da sessão *</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="Ex: Manga japonesa — sessão 1, Lettering costas..."
                className="mt-1"
              />
              {selectedAppointment?.service && form.title === selectedAppointment.service && (
                <p className="text-xs text-muted-foreground mt-1">
                  Pré-preenchido a partir do agendamento selecionado
                </p>
              )}
            </div>

            {/* Localização + Estilo */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>Localização no corpo</Label>
                <Select
                  value={form.bodyLocation}
                  onValueChange={(v) => setForm((f) => ({ ...f, bodyLocation: v }))}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Selecionar..." />
                  </SelectTrigger>
                  <SelectContent>
                    {BODY_LOCATIONS.map((loc) => (
                      <SelectItem key={loc} value={loc}>{loc}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Estilo de tatuagem</Label>
                <Select
                  value={form.tattooStyle}
                  onValueChange={(v) => setForm((f) => ({ ...f, tattooStyle: v }))}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Selecionar..." />
                  </SelectTrigger>
                  <SelectContent>
                    {TATTOO_STYLES.map((style) => (
                      <SelectItem key={style} value={style}>{style}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Artista */}
            <div>
              <Label>Artista responsável</Label>
              <Select value={String(selectedAppointment?.artistId ?? form.artistId ?? "")} disabled={!!selectedAppointment?.artistId} onValueChange={value => {
                const artist = artistsQuery.data?.find(a => a.id === Number(value));
                setForm(f => ({ ...f, artistId: artist?.id, artistName: artist?.name ?? "" }));
              }}>
                <SelectTrigger className="mt-1 w-full"><SelectValue placeholder="Selecione o artista para usar o estoque" /></SelectTrigger>
                <SelectContent>{artistsQuery.data?.map(a => <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>)}</SelectContent>
              </Select>
              {selectedAppointment?.artist && form.artistName === selectedAppointment.artist && (
                <p className="text-xs text-muted-foreground mt-1">
                  Pré-preenchido a partir do agendamento selecionado
                </p>
              )}
            </div>

            {/* Imagem de referência */}
            <div>
              <Label>Imagem de referência</Label>
              {previewUrl ? (
                <div className="mt-1 relative inline-block">
                  <img
                    src={previewUrl}
                    alt="Referência"
                    className="h-40 w-auto rounded-lg border object-cover"
                  />
                  <Button
                    size="icon"
                    variant="destructive"
                    className="absolute -top-2 -right-2 h-6 w-6"
                    onClick={() => {
                      setPreviewUrl(null);
                      setForm((f) => ({ ...f, referenceImageBase64: "", referenceImageMime: "" }));
                    }}
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              ) : (
                <label className="mt-1 flex flex-col items-center justify-center border-2 border-dashed border-muted-foreground/30 rounded-lg p-6 cursor-pointer hover:border-primary/50 transition-colors">
                  <Upload className="w-8 h-8 text-muted-foreground mb-2" />
                  <span className="text-sm text-muted-foreground">Clique para selecionar imagem</span>
                  <span className="text-xs text-muted-foreground mt-1">JPG, PNG, WebP — máx. 16MB</span>
                  <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
                </label>
              )}
            </div>

            {/* Observações */}
            <div>
              <Label>Observações iniciais</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder="Referências do cliente, expectativas, alergias conhecidas..."
                className="mt-1 resize-none"
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        {/* Botões */}
        <div className="flex gap-3 pb-8">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => navigate(prefilledClientId ? `/clients/${prefilledClientId}?tab=procedures` : "/procedures")}
          >
            Cancelar
          </Button>
          <Button
            className="flex-1 gap-2"
            onClick={handleSubmit}
            disabled={createMutation.isPending}
          >
            <Stethoscope className="w-4 h-4" />
            {createMutation.isPending ? "Criando..." : "Criar e iniciar sessão"}
          </Button>
        </div>
      </div>

      <Dialog open={newClientOpen} onOpenChange={(open) => {
        if (!createClientMutation.isPending) setNewClientOpen(open);
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Novo cliente</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="session-new-client-name">Nome *</Label>
              <Input
                id="session-new-client-name"
                value={newClientForm.name}
                onChange={(event) => setNewClientForm((current) => ({ ...current, name: event.target.value }))}
                placeholder="Nome do cliente"
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="session-new-client-phone">Telefone / WhatsApp</Label>
              <Input
                id="session-new-client-phone"
                value={newClientForm.phone}
                onChange={(event) => setNewClientForm((current) => ({ ...current, phone: event.target.value }))}
                placeholder="(38) 99999-9999"
                inputMode="tel"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="session-new-client-email">E-mail</Label>
              <Input
                id="session-new-client-email"
                value={newClientForm.email}
                onChange={(event) => setNewClientForm((current) => ({ ...current, email: event.target.value }))}
                placeholder="cliente@email.com"
                inputMode="email"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="session-new-client-instagram">Instagram</Label>
              <Input
                id="session-new-client-instagram"
                value={newClientForm.instagram}
                onChange={(event) => setNewClientForm((current) => ({ ...current, instagram: event.target.value }))}
                placeholder="@usuario"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={createClientMutation.isPending}
              onClick={() => setNewClientOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={createClientMutation.isPending || !newClientForm.name.trim()}
              onClick={() => {
                if (!newClientForm.name.trim()) {
                  toast.error("Informe o nome do cliente.");
                  return;
                }
                createClientMutation.mutate({
                  name: newClientForm.name.trim(),
                  phone: newClientForm.phone.trim() || undefined,
                  email: newClientForm.email.trim(),
                  instagram: newClientForm.instagram.trim() || undefined,
                });
              }}
            >
              {createClientMutation.isPending ? "Salvando..." : "Cadastrar e selecionar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
