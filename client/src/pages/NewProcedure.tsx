import PreparationMaterials from "@/components/PreparationMaterials";
import PreparationPalette from "@/components/PreparationPalette";
import {
  emptyPreparation,
  preparationSchema,
  type SessionPreparation,
} from "@shared/sessionPreparation";
import { draftOperation, sessionDraftKey } from "@/lib/sessionDraft";
import { useAuth } from "@/_core/hooks/useAuth";
import { z } from "zod";
import { useState, useEffect, useRef } from "react";
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
import {
  ChevronLeft,
  Stethoscope,
  Upload,
  X,
  Calendar,
  Clock,
  Link2,
  CheckCircle2,
  Package,
  Plus,
  Search,
  UserPlus,
  Phone,
} from "lucide-react";

const BODY_LOCATIONS = [
  "Braço direito",
  "Braço esquerdo",
  "Antebraço direito",
  "Antebraço esquerdo",
  "Ombro direito",
  "Ombro esquerdo",
  "Costas",
  "Peito",
  "Abdômen",
  "Perna direita",
  "Perna esquerda",
  "Panturrilha direita",
  "Panturrilha esquerda",
  "Pescoço",
  "Cabeça",
  "Rosto",
  "Mão direita",
  "Mão esquerda",
  "Pé direito",
  "Pé esquerdo",
  "Costela",
  "Nuca",
  "Outro",
];

const TATTOO_STYLES = [
  "Blackwork",
  "Realismo",
  "Realismo colorido",
  "Old School",
  "New School",
  "Aquarela",
  "Geométrico",
  "Pontilhismo",
  "Tribal",
  "Japonês",
  "Fineline",
  "Trash Polka",
  "Neotradicional",
  "Lettering",
  "Biomecânico",
  "Minimalista",
  "Mandala",
  "Outro",
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
    const [datePart, timePart] = dateStr.includes("T")
      ? dateStr.split("T")
      : dateStr.split(" ");
    const [year, month, day] = datePart.split("-");
    const time = timePart ? timePart.slice(0, 5) : "";
    return `${day}/${month}/${year}${time ? " às " + time : ""}`;
  } catch {
    return dateStr;
  }
}

const STEPS = ["Cliente", "Referência", "Materiais", "Paleta", "Revisão"];
const formSchema = z.object({
  clientId: z.number().int().min(0),
  appointmentId: z.number().int().positive().nullable(),
  title: z.string().max(255),
  bodyLocation: z.string().max(100),
  tattooStyle: z.string().max(100),
  artistName: z.string().max(255),
  artistId: z.number().int().positive().optional(),
  notes: z.string(),
  referenceImageBase64: z.string(),
  referenceImageMime: z.string(),
  referenceFromProcedureId: z.number().int().positive().optional(),
  referencePreviewUrl: z.string(),
});
const draftSchema = z.object({
  version: z.literal(1),
  form: formSchema,
  preparation: z.object({
    version: z.literal(1),
    materials: z.array(
      z.object({
        tenantMaterialId: z.number(),
        name: z.string(),
        unit: z.string(),
        quantity: z.string(),
      })
    ),
    colors: z.array(
      z.object({
        name: z.string(),
        hex: z.string(),
        cupSize: z.enum(["P", "M", "G", "GG"]),
        dropsPerMl: z.number(),
        ingredients: z.array(
          z.object({
            tenantMaterialId: z.number(),
            name: z.string(),
            drops: z.number(),
          })
        ),
      })
    ),
  }),
  step: z.number().int().min(0).max(4),
  requestId: z.string().uuid(),
});
export default function NewProcedure() {
  const { user } = useAuth();
  const search = useSearch();
  if (!user?.studioId)
    return (
      <DashboardLayout>
        <p className="p-6">Carregando estúdio…</p>
      </DashboardLayout>
    );
  return (
    <NewProcedureForm
      key={`${user.id}:${user.studioId}:${search}`}
      userId={user.id}
      studioId={user.studioId}
    />
  );
}
function NewProcedureForm({
  userId,
  studioId,
}: {
  userId: number;
  studioId: number;
}) {
  const [, navigate] = useLocation();
  const search = useSearch();
  const params = new URLSearchParams(search);
  const prefilledClientId = params.get("clientId")
    ? parseInt(params.get("clientId")!, 10)
    : null;
  const prefilledAppointmentId = params.get("appointmentId")
    ? parseInt(params.get("appointmentId")!, 10)
    : null;

  const [form, setForm] = useState<z.infer<typeof formSchema>>({
    clientId: prefilledClientId ?? 0,
    appointmentId: prefilledAppointmentId ?? (null as number | null),
    title: "",
    bodyLocation: "",
    tattooStyle: "",
    artistName: "",
    artistId: undefined as number | undefined,
    notes: "",
    referenceImageBase64: "",
    referenceImageMime: "",
    referenceFromProcedureId: undefined as number | undefined,
    referencePreviewUrl: "",
  });
  const [readingImage, setReadingImage] = useState(false);
  const previewUrl = form.referenceImageBase64
    ? `data:${form.referenceImageMime};base64,${form.referenceImageBase64}`
    : form.referencePreviewUrl || null;
  const [step, setStep] = useState(0);
  const [preparation, setPreparation] =
    useState<SessionPreparation>(emptyPreparation);
  const [ready, setReady] = useState(false);
  const [restored, setRestored] = useState(false);
  const [draftStatus, setDraftStatus] = useState("Carregando rascunho…");
  const requestId = useRef<string>(crypto.randomUUID());
  const completed = useRef(false);
  const saveRevision = useRef(0);
  const key = sessionDraftKey(
    userId,
    studioId,
    prefilledClientId,
    prefilledAppointmentId
  );
  const [sourceId, setSourceId] = useState(0);
  const [discardOpen, setDiscardOpen] = useState(false);
  useEffect(() => {
    let active = true;
    void draftOperation(key, "read")
      .then(raw => {
        if (!active) return;
        if (raw) {
          const saved = draftSchema.safeParse(raw);
          if (!saved.success) {
            setDraftStatus("O rascunho anterior não pôde ser recuperado.");
            return;
          }
          setForm(saved.data.form);
          setPreparation(saved.data.preparation);
          setStep(saved.data.step);
          requestId.current = saved.data.requestId;
          setRestored(true);
        }
        setDraftStatus("Rascunho salvo neste navegador.");
      })
      .catch(() => {
        if (active)
          setDraftStatus(
            "Não foi possível acessar o rascunho. Mantenha esta página aberta."
          );
      })
      .finally(() => {
        if (active) setReady(true);
      });
    return () => {
      active = false;
    };
  }, [key]);
  useEffect(() => {
    if (!ready || completed.current) return;
    const revision = ++saveRevision.current;
    setDraftStatus("Salvando rascunho…");
    void draftOperation(key, "write", {
      version: 1,
      form,
      preparation,
      step,
      requestId: requestId.current,
    })
      .then(() => {
        if (revision === saveRevision.current)
          setDraftStatus("Rascunho salvo neste navegador.");
      })
      .catch(() => {
        if (revision === saveRevision.current)
          setDraftStatus(
            "Não foi possível salvar o rascunho. Mantenha esta página aberta."
          );
      });
  }, [form, preparation, step, ready, key]);
  useEffect(() => {
    setSourceId(0);
  }, [form.clientId]);
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
    ? clients
        .filter(client => {
          const nameMatch = client.name
            .toLowerCase()
            .includes(clientSearchNormalized);
          const phoneDigits = (client.phone ?? "").replace(/\D/g, "");
          const phoneMatch =
            clientSearchDigits.length > 0 &&
            phoneDigits.includes(clientSearchDigits);
          return nameMatch || phoneMatch;
        })
        .slice(0, 8)
    : [];

  // Dados do cliente pré-preenchido
  const clientQuery = trpc.clients.getById.useQuery(
    { id: form.clientId },
    { enabled: form.clientId > 0 }
  );
  const selectedClient =
    clients.find(client => client.id === form.clientId) ?? clientQuery.data;

  // Agendamentos do cliente selecionado (para vincular)
  const appointmentsQuery = trpc.appointments.getByClientId.useQuery(
    { clientId: form.clientId },
    { enabled: form.clientId > 0 }
  );
  const clientAppointments = (appointmentsQuery.data ?? []).filter(
    a => a.status !== "cancelado" && a.status !== "concluido"
  );

  // Agendamento selecionado
  const selectedAppointment =
    clientAppointments.find(a => a.id === form.appointmentId) ?? null;
  const artistId = selectedAppointment?.artistId ?? form.artistId;
  const inventoryQuery = trpc.pod.inventory.list.useQuery(
    { artistId },
    { enabled: !!artistId }
  );
  const availableMaterials = artistId ? (inventoryQuery.data ?? []) : [];
  const plannedQuery = trpc.pod.planning.listByAppointment.useQuery(
    { appointmentId: form.appointmentId ?? 0 },
    { enabled: !!form.appointmentId }
  );
  const plannedMaterials = plannedQuery.data ?? [];
  const previousSessions = trpc.procedures.listByClient.useQuery(
    { clientId: form.clientId },
    { enabled: form.clientId > 0 }
  );
  const previous = trpc.procedures.getById.useQuery(
    { id: sourceId },
    { enabled: sourceId > 0 }
  );
  const previousStock = trpc.pod.session.get.useQuery(
    { procedureId: sourceId },
    { enabled: sourceId > 0 }
  );
  const previousColors = trpc.pod.session.listColorSamples.useQuery(
    { procedureId: sourceId },
    { enabled: sourceId > 0 }
  );
  const previousRecipes = trpc.pod.session.listInkRecipes.useQuery(
    { procedureId: sourceId },
    { enabled: sourceId > 0 }
  );
  const validSource =
    previous.data?.procedure.clientId === form.clientId
      ? previous.data
      : undefined;
  const invalidPreparation = !preparationSchema.safeParse(preparation).success;
  const unavailableMaterials = [
    ...preparation.materials.map(i => i.tenantMaterialId),
    ...preparation.colors.flatMap(c =>
      c.ingredients.map(i => i.tenantMaterialId)
    ),
  ].some(id => !availableMaterials.some(m => m.id === id));
  function goTo(next: number) {
    if (next <= step) {
      setStep(next);
      return;
    }
    if (
      next > 0 &&
      (!form.clientId || !selectedClient || selectedClient.isArchived)
    )
      return toast.error("Selecione um cliente ativo.");
    if (next > 1 && !form.title.trim())
      return toast.error("Informe o título do projeto.");
    if (
      next > 2 &&
      (!preparationSchema.safeParse({ ...preparation, colors: [] }).success ||
        preparation.materials.some(
          i => !availableMaterials.some(m => m.id === i.tenantMaterialId)
        ))
    )
      return toast.error("Revise os materiais antes de continuar.");
    if (next > 3 && (invalidPreparation || unavailableMaterials))
      return toast.error("Revise a paleta e as receitas antes de continuar.");
    setStep(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // Pré-preencher dados a partir do agendamento selecionado
  useEffect(() => {
    if (!ready || !selectedAppointment) return;
    setForm(f => ({
      ...f,
      title: f.title || (selectedAppointment.service ?? ""),
      artistName: selectedAppointment.artist ?? "",
      artistId: selectedAppointment.artistId ?? undefined,
    }));
  }, [selectedAppointment?.id, ready]);

  const createClientMutation = trpc.clients.create.useMutation({
    onSuccess: async client => {
      await clientsQuery.refetch();
      setForm(current => ({
        ...current,
        clientId: client.id,
        appointmentId: null,
      }));
      setClientSearch("");
      setNewClientOpen(false);
      setNewClientForm({ name: "", phone: "", email: "", instagram: "" });
      toast.success("Cliente cadastrado e selecionado para esta sessão.");
    },
    onError: error =>
      toast.error("Erro ao cadastrar cliente: " + error.message),
  });

  const createMutation = trpc.procedures.create.useMutation({
    onSuccess: data => {
      completed.current = true;
      ++saveRevision.current;
      void draftOperation(key, "delete").catch(() => undefined);
      toast.success("Preparação concluída! Abrindo a sessão...");
      navigate(`/procedures/${data.id}`);
    },
    onError: err => toast.error("Erro ao criar: " + err.message),
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 16 * 1024 * 1024) {
      toast.error("Arquivo muito grande. Máximo 16MB.");
      return;
    }
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      toast.error("Selecione uma imagem JPG, PNG ou WebP.");
      return;
    }
    setReadingImage(true);
    const reader = new FileReader();
    reader.onerror = () => {
      setReadingImage(false);
      toast.error(
        "Não foi possível ler a imagem. Selecione o arquivo novamente."
      );
    };
    reader.onabort = () => setReadingImage(false);
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(",")[1];
      setForm(f => ({
        ...f,
        referenceImageBase64: base64,
        referenceImageMime: file.type,
        referenceFromProcedureId: undefined,
        referencePreviewUrl: "",
      }));
      setReadingImage(false);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleSubmit = () => {
    if (readingImage || createMutation.isPending) return;
    if (invalidPreparation || unavailableMaterials)
      return toast.error("Revise os materiais e as misturas.");
    if (!selectedClient || selectedClient.isArchived)
      return toast.error("Selecione um cliente ativo.");
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
      referenceImageMime: (form.referenceImageMime || undefined) as
        "image/jpeg" | "image/png" | "image/webp" | undefined,
      referenceFromProcedureId: form.referenceFromProcedureId,
      preparation,
      requestId: requestId.current,
    });
  };

  if (!ready)
    return (
      <DashboardLayout>
        <p className="p-6">Recuperando preparação da sessão…</p>
      </DashboardLayout>
    );
  return (
    <DashboardLayout>
      <div className="p-4 sm:p-6 lg:p-8 max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() =>
              navigate(
                prefilledClientId
                  ? `/clients/${prefilledClientId}?tab=procedures`
                  : "/procedures"
              )
            }
          >
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <Stethoscope className="w-5 h-5 text-primary" />
              Nova Sessão Tattoo
            </h1>
            <p className="text-sm text-muted-foreground">
              Prepare a sessão, uma etapa por vez
            </p>
          </div>
        </div>

        <div className="rounded-lg border p-3 space-y-2">
          <p role="status" className="text-sm">
            {draftStatus}
          </p>
          <Button
            size="sm"
            variant="ghost"
            disabled={createMutation.isPending}
            onClick={() => setDiscardOpen(true)}
          >
            Descartar preparação
          </Button>
          {restored && (
            <p className="text-sm text-primary">
              Sua preparação anterior foi recuperada, incluindo a referência
              salva.
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            Você pode sair e voltar por este mesmo caminho, neste dispositivo e
            navegador.
          </p>
        </div>
        <nav
          aria-label="Etapas da preparação"
          className="grid grid-cols-5 gap-1"
        >
          {STEPS.map((label, index) => (
            <button
              key={label}
              type="button"
              aria-current={step === index ? "step" : undefined}
              onClick={() => goTo(index)}
              disabled={createMutation.isPending || readingImage}
              className={`min-h-14 rounded-lg border text-[10px] sm:text-sm break-words p-1 ${step === index ? "bg-primary text-primary-foreground" : "bg-muted/30"}`}
            >
              <span className="block font-bold">{index + 1}</span>
              {label}
            </button>
          ))}
        </nav>
        <fieldset disabled={createMutation.isPending} className="min-w-0">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-muted-foreground uppercase tracking-wide">
                Etapa {step + 1} de 5 · {STEPS[step]}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {step === 0 && (
                <>
                  {/* Cliente */}
                  {prefilledClientId && selectedClient ? (
                    <div>
                      <Label>Cliente</Label>
                      <div className="mt-1 flex items-center gap-3 p-3 rounded-lg bg-muted/50 border">
                        <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center text-primary font-semibold text-sm shrink-0">
                          {selectedClient.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-sm truncate">
                            {selectedClient.name}
                          </p>
                          {selectedClient.phone && (
                            <p className="text-xs text-muted-foreground">
                              {selectedClient.phone}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Label>Cliente *</Label>
                      {!form.clientId && (
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                          <Input
                            value={clientSearch}
                            onChange={event =>
                              setClientSearch(event.target.value)
                            }
                            placeholder="Buscar por nome ou telefone..."
                            inputMode="search"
                            className="pl-9"
                            autoComplete="off"
                            aria-label="Buscar cliente por nome ou telefone"
                          />
                        </div>
                      )}

                      {form.clientId > 0 && selectedClient && (
                        <div className="flex items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 p-3">
                          <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center text-primary font-semibold text-sm shrink-0">
                            {selectedClient.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">
                              {selectedClient.name}
                            </p>
                            {selectedClient.phone && (
                              <p className="text-xs text-muted-foreground flex items-center gap-1">
                                <Phone className="w-3 h-3" />{" "}
                                {selectedClient.phone}
                              </p>
                            )}
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setForm(current => ({
                                ...current,
                                clientId: 0,
                                appointmentId: null,
                                title: "",
                                bodyLocation: "",
                                tattooStyle: "",
                                notes: "",
                                referenceImageBase64: "",
                                referenceImageMime: "",
                                referenceFromProcedureId: undefined,
                                referencePreviewUrl: "",
                              }));
                              setPreparation(emptyPreparation());
                              requestId.current = crypto.randomUUID();
                              setClientSearch("");
                            }}
                          >
                            Trocar cliente
                          </Button>
                        </div>
                      )}

                      {!form.clientId && clientSearchNormalized && (
                        <div className="rounded-lg border bg-popover overflow-hidden">
                          {filteredClients.length > 0 ? (
                            <div className="max-h-64 overflow-y-auto">
                              {filteredClients.map(client => (
                                <button
                                  key={client.id}
                                  type="button"
                                  className={`w-full flex items-center gap-3 px-3 py-3 text-left hover:bg-accent transition-colors border-b last:border-b-0 ${form.clientId === client.id ? "bg-primary/10" : ""}`}
                                  onClick={() => {
                                    setForm(current => ({
                                      ...current,
                                      clientId: client.id,
                                      appointmentId: null,
                                    }));
                                    setClientSearch("");
                                  }}
                                >
                                  <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center text-primary font-semibold text-xs shrink-0">
                                    {client.name.charAt(0).toUpperCase()}
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <p className="font-medium text-sm truncate">
                                      {client.name}
                                    </p>
                                    <p className="text-xs text-muted-foreground truncate">
                                      {client.phone ||
                                        "Sem telefone cadastrado"}
                                    </p>
                                  </div>
                                  {form.clientId === client.id && (
                                    <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                                  )}
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

                      {!form.clientId && (
                        <Button
                          type="button"
                          variant="outline"
                          className="w-full gap-2 justify-center min-h-11"
                          onClick={() => {
                            setNewClientForm(current => ({
                              ...current,
                              name: current.name || clientSearch.trim(),
                            }));
                            setNewClientOpen(true);
                          }}
                        >
                          <UserPlus className="w-4 h-4" />
                          Adicionar novo cliente
                        </Button>
                      )}
                    </div>
                  )}

                  {/* Vincular a agendamento */}
                  {form.clientId > 0 && (
                    <div>
                      <Label className="flex items-center gap-2">
                        <Link2 className="w-4 h-4 text-primary" />
                        Vincular a agendamento
                        <span className="text-xs text-muted-foreground font-normal">
                          (opcional)
                        </span>
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
                            onClick={() =>
                              setForm(f => ({ ...f, appointmentId: null }))
                            }
                            className={`w-full text-left p-3 rounded-lg border transition-colors text-sm ${
                              form.appointmentId === null
                                ? "border-primary bg-primary/10"
                                : "border-border hover:border-primary/50 hover:bg-muted/50"
                            }`}
                          >
                            <span className="text-muted-foreground italic">
                              Sem vínculo com agendamento
                            </span>
                          </button>

                          {clientAppointments.map(apt => (
                            <button
                              key={apt.id}
                              type="button"
                              onClick={() =>
                                setForm(f => ({ ...f, appointmentId: apt.id }))
                              }
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
                                  <span
                                    className={`text-xs px-2 py-0.5 rounded-full border ${STATUS_COLORS[apt.status] ?? ""}`}
                                  >
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
                            <strong>
                              {formatAppointmentDate(selectedAppointment.date)}
                            </strong>
                            {selectedAppointment.service
                              ? ` — ${selectedAppointment.service}`
                              : ""}
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Artista */}
                  <div>
                    <Label>Artista responsável</Label>
                    <Select
                      value={String(
                        selectedAppointment?.artistId ?? form.artistId ?? ""
                      )}
                      disabled={!!selectedAppointment?.artistId}
                      onValueChange={value => {
                        const artist = artistsQuery.data?.find(
                          a => a.id === Number(value)
                        );
                        setForm(f => ({
                          ...f,
                          artistId: artist?.id,
                          artistName: artist?.name ?? "",
                        }));
                      }}
                    >
                      <SelectTrigger className="mt-1 w-full">
                        <SelectValue placeholder="Selecione o artista para usar o estoque" />
                      </SelectTrigger>
                      <SelectContent>
                        {artistsQuery.data?.map(a => (
                          <SelectItem key={a.id} value={String(a.id)}>
                            {a.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {selectedAppointment?.artist &&
                      form.artistName === selectedAppointment.artist && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Pré-preenchido a partir do agendamento selecionado
                        </p>
                      )}
                  </div>

                  {form.clientId > 0 && (
                    <div className="border rounded-lg p-3 space-y-3">
                      <label className="block text-sm">
                        Continuar um projeto anterior (opcional)
                        <select
                          className="w-full block bg-background border rounded p-3"
                          value={sourceId}
                          onChange={e => setSourceId(Number(e.target.value))}
                        >
                          <option value={0}>Escolher sessão anterior</option>
                          {previousSessions.data?.map(p => (
                            <option value={p.id} key={p.id}>
                              #{p.id} · {p.title} ·{" "}
                              {p.bodyLocation || "Local não informado"}
                            </option>
                          ))}
                        </select>
                      </label>
                      {previousSessions.isLoading && (
                        <p>Carregando sessões anteriores…</p>
                      )}
                      {previousSessions.error && (
                        <p role="alert">{previousSessions.error.message}</p>
                      )}
                      {sourceId > 0 && (
                        <>
                          {(previous.isLoading ||
                            previousStock.isLoading ||
                            previousColors.isLoading ||
                            previousRecipes.isLoading) && (
                            <p>Carregando referência, materiais e receitas…</p>
                          )}
                          {[
                            previous.error,
                            previousStock.error,
                            previousColors.error,
                            previousRecipes.error,
                          ]
                            .filter(Boolean)
                            .map((e, i) => (
                              <p key={i} role="alert">
                                {e?.message}
                              </p>
                            ))}
                          {validSource && (
                            <>
                              {validSource.procedure.referenceImageUrl && (
                                <img
                                  src={validSource.procedure.referenceImageUrl}
                                  alt="Referência da sessão anterior"
                                  className="h-32 max-w-full object-contain rounded"
                                />
                              )}
                              <Button
                                variant="outline"
                                className="h-auto min-h-11 whitespace-normal"
                                onClick={() => {
                                  const p = validSource.procedure;
                                  setForm(f => ({
                                    ...f,
                                    title: p.title,
                                    bodyLocation: p.bodyLocation || "",
                                    tattooStyle: p.tattooStyle || "",
                                    referenceImageBase64: "",
                                    referenceImageMime: "",
                                    referenceFromProcedureId:
                                      p.referenceImageKey ? p.id : undefined,
                                    referencePreviewUrl: p.referenceImageKey
                                      ? p.referenceImageUrl || ""
                                      : "",
                                  }));
                                  toast.success(
                                    "Referência e dados do projeto recuperados. Revise na próxima etapa."
                                  );
                                }}
                              >
                                Reutilizar referência e dados do projeto
                              </Button>
                              <Button
                                variant="outline"
                                disabled={
                                  !artistId ||
                                  previousStock.isLoading ||
                                  !!previousStock.error
                                }
                                className="h-auto min-h-11 whitespace-normal"
                                onClick={() => {
                                  const totals = new Map<number, number>();
                                  for (const item of previousStock.data
                                    ?.consumptions || [])
                                    if (item.status === "consumido")
                                      totals.set(
                                        item.tenantMaterialId,
                                        (totals.get(item.tenantMaterialId) ||
                                          0) + Number(item.quantity)
                                      );
                                  let missing = 0;
                                  const additions: SessionPreparation["materials"] =
                                    [];
                                  for (const [id, quantity] of Array.from(
                                    totals
                                  )) {
                                    const m = availableMaterials.find(
                                      m => m.id === id
                                    );
                                    if (
                                      !m ||
                                      previousStock.data?.consumptions.some(
                                        i =>
                                          i.tenantMaterialId === id &&
                                          i.unitSnapshot !== m.unit
                                      )
                                    ) {
                                      missing++;
                                      continue;
                                    }
                                    if (
                                      !preparation.materials.some(
                                        i => i.tenantMaterialId === id
                                      )
                                    )
                                      additions.push({
                                        tenantMaterialId: id,
                                        name: m.name,
                                        unit: m.unit,
                                        quantity: quantity.toFixed(3),
                                      });
                                  }
                                  setPreparation(p => ({
                                    ...p,
                                    materials: [...p.materials, ...additions],
                                  }));
                                  toast.info(
                                    `${additions.length} materiais adicionados ao planejamento.${missing ? ` ${missing} indisponíveis para este artista.` : ""} Revise as quantidades.`
                                  );
                                }}
                              >
                                Reutilizar materiais utilizados
                              </Button>
                              <Button
                                variant="outline"
                                disabled={
                                  previousColors.isLoading ||
                                  previousRecipes.isLoading ||
                                  !!previousColors.error ||
                                  !!previousRecipes.error
                                }
                                className="h-auto min-h-11 whitespace-normal"
                                onClick={() => {
                                  const colors: SessionPreparation["colors"] =
                                    [];
                                  for (const c of previousColors.data || []) {
                                    const matches =
                                      previousRecipes.data?.filter(
                                        r =>
                                          r.sampleId === c.id &&
                                          r.status !== "reverted"
                                      ) || [];
                                    if (!matches.length)
                                      colors.push({
                                        name: `Sessão #${sourceId} · ${c.code}`,
                                        hex: c.hex,
                                        cupSize: "M",
                                        dropsPerMl: 20,
                                        ingredients: [],
                                      });
                                    for (const r of matches)
                                      colors.push({
                                        name: `Sessão #${sourceId} · ${c.code} · ${r.code}`,
                                        hex: c.hex,
                                        cupSize: r.cupSize as
                                          "P" | "M" | "G" | "GG",
                                        dropsPerMl: Number(r.dropsPerMl),
                                        ingredients: r.items.map(i => ({
                                          tenantMaterialId: i.tenantMaterialId,
                                          name: i.nameSnapshot,
                                          drops: i.drops,
                                        })),
                                      });
                                  }
                                  for (const r of previousRecipes.data || [])
                                    if (
                                      !r.sampleId &&
                                      r.status !== "reverted" &&
                                      r.result
                                    )
                                      colors.push({
                                        name: `Sessão #${sourceId} · ${r.code}`,
                                        hex: r.result.hex,
                                        cupSize: r.cupSize as
                                          "P" | "M" | "G" | "GG",
                                        dropsPerMl: Number(r.dropsPerMl),
                                        ingredients: r.items.map(i => ({
                                          tenantMaterialId: i.tenantMaterialId,
                                          name: i.nameSnapshot,
                                          drops: i.drops,
                                        })),
                                      });
                                  if (
                                    preparation.colors.length + colors.length >
                                    20
                                  )
                                    return toast.error(
                                      "A paleta suporta até 20 cores. Remova cores antes de reutilizar esta paleta."
                                    );
                                  setPreparation(p => ({
                                    ...p,
                                    colors: [...p.colors, ...colors],
                                  }));
                                  toast.info(
                                    `${colors.length} cores e suas receitas recuperadas. Misturas sem referência ou resultado de cor não são copiadas. Revise as tintas antes de iniciar.`
                                  );
                                }}
                              >
                                Reutilizar paleta e receitas
                              </Button>
                            </>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </>
              )}
              {step === 1 && (
                <>
                  {/* Título */}
                  <div>
                    <Label>Projeto / título da sessão *</Label>
                    <Input
                      value={form.title}
                      maxLength={255}
                      onChange={e =>
                        setForm(f => ({ ...f, title: e.target.value }))
                      }
                      placeholder="Ex: Manga japonesa — sessão 1, Lettering costas..."
                      className="mt-1"
                    />
                    {selectedAppointment?.service &&
                      form.title === selectedAppointment.service && (
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
                        onValueChange={v =>
                          setForm(f => ({ ...f, bodyLocation: v }))
                        }
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="Selecionar..." />
                        </SelectTrigger>
                        <SelectContent>
                          {BODY_LOCATIONS.map(loc => (
                            <SelectItem key={loc} value={loc}>
                              {loc}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Estilo de tatuagem</Label>
                      <Select
                        value={form.tattooStyle}
                        onValueChange={v =>
                          setForm(f => ({ ...f, tattooStyle: v }))
                        }
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="Selecionar..." />
                        </SelectTrigger>
                        <SelectContent>
                          {TATTOO_STYLES.map(style => (
                            <SelectItem key={style} value={style}>
                              {style}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
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
                            setForm(f => ({
                              ...f,
                              referenceImageBase64: "",
                              referenceImageMime: "",
                              referenceFromProcedureId: undefined,
                              referencePreviewUrl: "",
                            }));
                          }}
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                    ) : (
                      <label className="mt-1 flex flex-col items-center justify-center border-2 border-dashed border-muted-foreground/30 rounded-lg p-6 cursor-pointer hover:border-primary/50 transition-colors">
                        <Upload className="w-8 h-8 text-muted-foreground mb-2" />
                        <span className="text-sm text-muted-foreground">
                          Clique para selecionar imagem
                        </span>
                        <span className="text-xs text-muted-foreground mt-1">
                          JPG, PNG, WebP — máx. 16MB
                        </span>
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          className="hidden"
                          onChange={handleFileChange}
                        />
                      </label>
                    )}
                  </div>

                  {/* Observações */}
                  <div>
                    <Label>Observações iniciais</Label>
                    <Textarea
                      value={form.notes}
                      onChange={e =>
                        setForm(f => ({ ...f, notes: e.target.value }))
                      }
                      placeholder="Referências do cliente, expectativas, alergias conhecidas..."
                      className="mt-1 resize-none"
                      rows={3}
                    />
                  </div>
                </>
              )}
              {step === 2 && (
                <>
                  {!artistId && (
                    <p className="text-sm">
                      Escolha o artista na etapa Cliente para pesquisar o
                      estoque.
                    </p>
                  )}
                  {inventoryQuery.isLoading && artistId && (
                    <p>Carregando materiais…</p>
                  )}
                  {inventoryQuery.error && (
                    <p role="alert">{inventoryQuery.error.message}</p>
                  )}
                  <PreparationMaterials
                    materials={availableMaterials}
                    value={preparation.materials}
                    onChange={materials =>
                      setPreparation(p => ({ ...p, materials }))
                    }
                  />
                  {plannedQuery.error && (
                    <p role="alert">{plannedQuery.error.message}</p>
                  )}
                  {plannedMaterials.some(i => i.status === "planejado") && (
                    <div className="border rounded p-3">
                      <p className="font-medium">Já previstos no agendamento</p>
                      <p className="text-xs text-muted-foreground">
                        Estes itens também estarão disponíveis na sessão.
                      </p>
                      {plannedMaterials
                        .filter(i => i.status === "planejado")
                        .map(i => (
                          <p key={i.id} className="text-sm">
                            {i.nameSnapshot} · {Number(i.quantityPlanned)}{" "}
                            {i.unitSnapshot}
                          </p>
                        ))}
                    </div>
                  )}
                </>
              )}
              {step === 3 && (
                <PreparationPalette
                  materials={availableMaterials}
                  value={preparation.colors}
                  onChange={colors => setPreparation(p => ({ ...p, colors }))}
                />
              )}
              {step === 4 && (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Confira a preparação. Você pode voltar a qualquer etapa para
                    editar.
                  </p>
                  <dl className="space-y-2 text-sm">
                    <div>
                      <dt className="text-muted-foreground">Cliente</dt>
                      <dd>{selectedClient?.name || "Selecione um cliente"}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Projeto</dt>
                      <dd>{form.title}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Artista</dt>
                      <dd>{form.artistName || "Não informado"}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Local e estilo</dt>
                      <dd>
                        {[form.bodyLocation, form.tattooStyle]
                          .filter(Boolean)
                          .join(" · ") || "Não informados"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Agendamento</dt>
                      <dd>
                        {selectedAppointment
                          ? formatAppointmentDate(selectedAppointment.date)
                          : "Sessão avulsa"}
                      </dd>
                    </div>
                  </dl>
                  {previewUrl ? (
                    <img
                      src={previewUrl}
                      alt="Referência preparada para a sessão"
                      className="max-h-64 max-w-full rounded-lg object-contain"
                    />
                  ) : (
                    <p className="text-sm">
                      Sem referência. Você pode adicionar durante a sessão.
                    </p>
                  )}
                  <div>
                    <h3 className="font-medium">Materiais previstos</h3>
                    {!preparation.materials.length &&
                      !plannedMaterials.some(i => i.status === "planejado") && (
                        <p className="text-sm">Nenhum material preparado.</p>
                      )}
                    {preparation.materials.map(i => (
                      <p key={i.tenantMaterialId} className="text-sm">
                        {i.name} · {Number(i.quantity).toLocaleString("pt-BR")}{" "}
                        {i.unit}
                      </p>
                    ))}
                    {plannedMaterials
                      .filter(i => i.status === "planejado")
                      .map(i => (
                        <p key={i.id} className="text-sm">
                          {i.nameSnapshot} · {Number(i.quantityPlanned)}{" "}
                          {i.unitSnapshot} · agendamento
                        </p>
                      ))}
                  </div>
                  <div>
                    <h3 className="font-medium">Paleta e receitas previstas</h3>
                    {!preparation.colors.length && (
                      <p className="text-sm">A definir durante a sessão.</p>
                    )}
                    {preparation.colors.map((c, i) => (
                      <div key={i} className="flex items-start gap-2 my-2">
                        <span
                          className="w-8 h-8 rounded border shrink-0"
                          style={{ backgroundColor: c.hex }}
                        />
                        <div className="text-sm">
                          <p>
                            {c.name} · {c.hex}
                          </p>
                          {c.ingredients.length > 0 && (
                            <p>
                              Batoque {c.cupSize} ·{" "}
                              {c.ingredients
                                .map(i => `${i.name}: ${i.drops} gotas`)
                                .join(" + ")}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  {form.notes && (
                    <p className="text-sm whitespace-pre-wrap">{form.notes}</p>
                  )}
                  <p className="text-sm text-primary">
                    O estoque só será baixado ao confirmar o consumo ou a
                    mistura durante a sessão.
                  </p>
                  {(invalidPreparation || unavailableMaterials) && (
                    <p role="alert">
                      Revise os materiais e as misturas antes de iniciar.
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </fieldset>
        {/* Botões */}
        <div className="sticky bottom-0 z-20 flex gap-3 bg-background/95 py-3 pb-[max(1rem,env(safe-area-inset-bottom))] border-t">
          <Button
            variant="outline"
            className="flex-1 min-h-11 h-auto whitespace-normal text-xs sm:text-sm"
            disabled={createMutation.isPending || readingImage}
            onClick={() =>
              step > 0
                ? setStep(step - 1)
                : navigate(
                    prefilledClientId
                      ? `/clients/${prefilledClientId}?tab=procedures`
                      : "/procedures"
                  )
            }
          >
            {step > 0 ? "Voltar" : "Sair e continuar depois"}
          </Button>
          <Button
            className="flex-1 min-h-11 h-auto whitespace-normal text-xs sm:text-sm"
            disabled={
              createMutation.isPending ||
              readingImage ||
              (step === 4 &&
                (invalidPreparation ||
                  unavailableMaterials ||
                  inventoryQuery.isFetching ||
                  !form.title.trim() ||
                  !form.clientId))
            }
            onClick={() => (step === 4 ? handleSubmit() : goTo(step + 1))}
          >
            {readingImage
              ? "Preparando imagem…"
              : createMutation.isPending
                ? "Criando sessão…"
                : step === 4
                  ? "Criar e abrir sessão"
                  : "Continuar"}
          </Button>
        </div>
      </div>

      <Dialog open={discardOpen} onOpenChange={setDiscardOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Descartar esta preparação?</DialogTitle>
          </DialogHeader>
          <p>
            A referência, os materiais e as cores deste rascunho serão
            removidos. Sessões existentes não serão alteradas.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDiscardOpen(false)}>
              Continuar preenchendo
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setForm({
                  clientId: prefilledClientId || 0,
                  appointmentId: prefilledAppointmentId,
                  title: "",
                  bodyLocation: "",
                  tattooStyle: "",
                  artistName: "",
                  artistId: undefined,
                  notes: "",
                  referenceImageBase64: "",
                  referenceImageMime: "",
                  referencePreviewUrl: "",
                  referenceFromProcedureId: undefined,
                });
                setPreparation(emptyPreparation());
                setStep(0);
                setSourceId(0);
                setRestored(false);
                requestId.current = crypto.randomUUID();
                setDiscardOpen(false);
              }}
            >
              Descartar rascunho
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={newClientOpen}
        onOpenChange={open => {
          if (!createClientMutation.isPending) setNewClientOpen(open);
        }}
      >
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
                onChange={event =>
                  setNewClientForm(current => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
                placeholder="Nome do cliente"
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="session-new-client-phone">
                Telefone / WhatsApp
              </Label>
              <Input
                id="session-new-client-phone"
                value={newClientForm.phone}
                onChange={event =>
                  setNewClientForm(current => ({
                    ...current,
                    phone: event.target.value,
                  }))
                }
                placeholder="(38) 99999-9999"
                inputMode="tel"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="session-new-client-email">E-mail</Label>
              <Input
                id="session-new-client-email"
                value={newClientForm.email}
                onChange={event =>
                  setNewClientForm(current => ({
                    ...current,
                    email: event.target.value,
                  }))
                }
                placeholder="cliente@email.com"
                inputMode="email"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="session-new-client-instagram">Instagram</Label>
              <Input
                id="session-new-client-instagram"
                value={newClientForm.instagram}
                onChange={event =>
                  setNewClientForm(current => ({
                    ...current,
                    instagram: event.target.value,
                  }))
                }
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
              disabled={
                createClientMutation.isPending || !newClientForm.name.trim()
              }
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
              {createClientMutation.isPending
                ? "Salvando..."
                : "Cadastrar e selecionar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
