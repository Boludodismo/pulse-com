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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { ChevronLeft, Stethoscope, Upload, X, Calendar, Clock, Link2, CheckCircle2 } from "lucide-react";

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
    notes: "",
    referenceImageBase64: "",
    referenceImageMime: "",
  });
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const clientsQuery = trpc.clients.list.useQuery();
  const clients = clientsQuery.data ?? [];

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

  // Pré-preencher dados a partir do agendamento selecionado
  useEffect(() => {
    if (!selectedAppointment) return;
    setForm((f) => ({
      ...f,
      title: f.title || (selectedAppointment.service ?? ""),
      artistName: f.artistName || (selectedAppointment.artist ?? ""),
    }));
  }, [selectedAppointment?.id]);

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
              Novo Procedimento
            </h1>
            <p className="text-sm text-muted-foreground">Prontuário técnico de execução</p>
          </div>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-muted-foreground uppercase tracking-wide">
              Dados do procedimento
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Cliente */}
            {prefilledClientId && selectedClient ? (
              <div>
                <Label>Cliente</Label>
                <div className="mt-1 flex items-center gap-3 p-3 rounded-lg bg-muted/50 border">
                  <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-semibold text-sm">
                    {selectedClient.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-medium text-sm">{selectedClient.name}</p>
                    {selectedClient.phone && (
                      <p className="text-xs text-muted-foreground">{selectedClient.phone}</p>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div>
                <Label>Cliente *</Label>
                <Select
                  value={form.clientId > 0 ? String(form.clientId) : ""}
                  onValueChange={(v) => {
                    const newClientId = parseInt(v, 10);
                    setForm((f) => ({ ...f, clientId: newClientId, appointmentId: null }));
                  }}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Selecionar cliente..." />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map((c) => (
                      <SelectItem key={c.id} value={String(c.id)}>
                        {c.name} {c.phone ? `· ${c.phone}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
              </div>
            )}

            {/* Título */}
            <div>
              <Label>Título do procedimento *</Label>
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
              <Input
                value={form.artistName}
                onChange={(e) => setForm((f) => ({ ...f, artistName: e.target.value }))}
                placeholder="Nome do tatuador"
                className="mt-1"
              />
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
    </DashboardLayout>
  );
}
