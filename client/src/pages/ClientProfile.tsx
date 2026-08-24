import { useState, useRef, DragEvent, ChangeEvent } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { SkeletonCard } from "@/components/SkeletonCard";
import { SkeletonTable } from "@/components/SkeletonTable";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { EventModal } from "@/components/EventModal";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, Mail, Phone, Instagram, Cake, Calendar, DollarSign, Users, Plus, Loader2, AlertCircle, Upload, X, Image as ImageIcon, Clock, FileText, FileDown, Pencil, Trash2, CreditCard, Package, ChevronDown, Stethoscope, Play, CheckCircle2, MapPin, Palette } from "lucide-react";
import { useLocation, useParams } from "wouter";
import { toast } from "sonner";
import SendAnamneseDialog from "@/components/SendAnamneseDialog";
import { AnamneseSubmissionView } from "@/pages/AnamneseView";

export default function ClientProfile() {
  const [, setLocation] = useLocation();
  const params = useParams<{ id: string }>();
  const clientId = parseInt(params.id || "0");

  const { data: client, isLoading } = trpc.clients.getById.useQuery({ id: clientId });
  const { data: appointments } = trpc.appointments.getByClientId.useQuery({ clientId });
  const { data: anamnesis } = trpc.anamnesis.getByClientId.useQuery({ clientId });
  const { data: anamneseSubmissions } = trpc.anamnese.getRequestsByClientId.useQuery({ clientId });
  const { data: transactions } = trpc.transactions.getByClientId.useQuery({ clientId });
  const { data: availableMaterials } = trpc.stock.listMaterials.useQuery({ activeOnly: true });
  const { data: gallery } = trpc.gallery.getByClientId.useQuery({ clientId });
  const { data: notes } = trpc.notes.getByClientId.useQuery({ clientId });

  // Estados para formulários
  // appointmentDialogOpen removido (CORREÇÃO 6b: órfão após migração para EventModal)
  const [eventModalOpen, setEventModalOpen] = useState(false);
  const [transactionDialogOpen, setTransactionDialogOpen] = useState(false);
  const [noteDialogOpen, setNoteDialogOpen] = useState(false);
  const [anamnesisDialogOpen, setAnamnesisDialogOpen] = useState(false);
  const [sendLinkDialogOpen, setSendLinkDialogOpen] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);

  // Estados para upload de imagem
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadDescription, setUploadDescription] = useState("");
  const [uploadTags, setUploadTags] = useState("");
  const [uploadAppointmentId, setUploadAppointmentId] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // CORREÇÃO 6: appointmentData, conflictCheck e createAppointment removidos (eram órfãos após migração para EventModal)

  const [transactionData, setTransactionData] = useState({
    type: "entrada" as "entrada" | "saida",
    category: "",
    description: "",
    amount: "",
    paymentMethod: "dinheiro" as "dinheiro" | "pix" | "credito" | "debito" | "transferencia",
    date: new Date().toISOString().split('T')[0],
  });

  // Materiais selecionados para baixa no estoque
  const [selectedMaterials, setSelectedMaterials] = useState<Array<{
    materialId: number;
    materialName: string;
    unit: string;
    currentStock: number;
    quantity: string;
  }>>([]);

  const [noteContent, setNoteContent] = useState("");

  const [anamnesisData, setAnamnesisData] = useState({
    hasAllergies: false,
    allergiesDetails: "",
    hasDiseases: false,
    diseasesDetails: "",
    usesMedication: false,
    medicationDetails: "",
    isPregnant: false,
    hasKeloid: false,
    consentAccepted: false,
  });

  const utils = trpc.useUtils();

  // Mutations
  const createTransaction = trpc.transactions.createWithMaterials.useMutation({
    onSuccess: (data) => {
      const stockMsg = data.stockMovements.length > 0
        ? ` | Baixa em ${data.stockMovements.length} material(is) realizada.`
        : "";
      toast.success(`Transação registrada com sucesso!${stockMsg}`);
      utils.transactions.getByClientId.invalidate({ clientId });
      utils.clients.getById.invalidate({ id: clientId });
      utils.dashboard.metrics.invalidate();
      utils.dashboard.topClients.invalidate();
      utils.stock.listMaterials.invalidate();
      setTransactionDialogOpen(false);
      setTransactionData({
        type: "entrada",
        category: "",
        description: "",
        amount: "",
        paymentMethod: "dinheiro",
        date: new Date().toISOString().split('T')[0],
      });
      setSelectedMaterials([]);
    },
    onError: (error) => {
      toast.error(`Erro ao registrar transação: ${error.message}`);
    },
  });

  const createNote = trpc.notes.create.useMutation({
    onSuccess: () => {
      toast.success("Nota adicionada com sucesso!");
      utils.notes.getByClientId.invalidate({ clientId });
      setNoteDialogOpen(false);
      setNoteContent("");
    },
    onError: (error) => {
      toast.error(`Erro ao adicionar nota: ${error.message}`);
    },
  });

  // Estados para edição/exclusão de fichas de anamnese
  const [editRecordDialogOpen, setEditRecordDialogOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<any>(null);
  const [editRecordData, setEditRecordData] = useState({
    hasAllergies: false, allergiesDetails: "",
    hasDiseases: false, diseasesDetails: "",
    usesMedication: false, medicationDetails: "",
    isPregnant: false, hasKeloid: false, acceptedTerms: false, notes: "",
  });
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deletingItem, setDeletingItem] = useState<{ type: 'record' | 'submission'; id: number } | null>(null);

  const createAnamnesis = trpc.anamnesis.create.useMutation({
    onSuccess: () => {
      toast.success("Ficha de anamnese criada com sucesso!");
      utils.anamnesis.getByClientId.invalidate({ clientId });
      setAnamnesisDialogOpen(false);
      setAnamnesisData({
        hasAllergies: false, allergiesDetails: "",
        hasDiseases: false, diseasesDetails: "",
        usesMedication: false, medicationDetails: "",
        isPregnant: false, hasKeloid: false, consentAccepted: false,
      });
    },
    onError: (error) => {
      toast.error(`Erro ao criar ficha de anamnese: ${error.message}`);
    },
  });

  const updateRecord = trpc.anamnese.updateRecord.useMutation({
    onSuccess: () => {
      toast.success("Ficha atualizada com sucesso!");
      utils.anamnesis.getByClientId.invalidate({ clientId });
      setEditRecordDialogOpen(false);
      setEditingRecord(null);
    },
    onError: (error) => toast.error(`Erro ao atualizar ficha: ${error.message}`),
  });

  const deleteRecord = trpc.anamnese.deleteRecord.useMutation({
    onSuccess: () => {
      toast.success("Ficha excluída com sucesso!");
      utils.anamnesis.getByClientId.invalidate({ clientId });
      setDeleteConfirmOpen(false); setDeletingItem(null);
    },
    onError: (error) => toast.error(`Erro ao excluir ficha: ${error.message}`),
  });

  const deleteSubmission = trpc.anamnese.deleteSubmission.useMutation({
    onSuccess: () => {
      toast.success("Ficha excluída com sucesso!");
      utils.anamnese.getRequestsByClientId.invalidate({ clientId });
      setDeleteConfirmOpen(false); setDeletingItem(null);
    },
    onError: (error) => toast.error(`Erro ao excluir ficha: ${error.message}`),
  });

  const handleOpenEditRecord = (record: any) => {
    setEditingRecord(record);
    setEditRecordData({
      hasAllergies: !!record.hasAllergies, allergiesDetails: record.allergiesDetails || "",
      hasDiseases: !!record.hasDiseases, diseasesDetails: record.diseasesDetails || "",
      usesMedication: !!record.usesMedication, medicationDetails: record.medicationDetails || "",
      isPregnant: !!record.isPregnant, hasKeloid: !!record.hasKeloid,
      acceptedTerms: !!record.acceptedTerms, notes: record.notes || "",
    });
    setEditRecordDialogOpen(true);
  };

  const handleConfirmDelete = () => {
    if (!deletingItem) return;
    if (deletingItem.type === 'record') deleteRecord.mutate({ id: deletingItem.id });
    else deleteSubmission.mutate({ id: deletingItem.id });
  };

  const uploadImage = trpc.gallery.uploadImage.useMutation({
    onSuccess: () => {
      toast.success("Imagem enviada com sucesso!");
      utils.gallery.getByClientId.invalidate({ clientId });
    },
    onError: (error) => {
      toast.error(`Erro ao enviar imagem: ${error.message}`);
    },
  });

  // Handlers de upload
  const handleFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    processFiles(files);
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = Array.from(e.dataTransfer.files);
    processFiles(files);
  };

  const processFiles = (files: File[]) => {
    // Filtrar apenas imagens
    const imageFiles = files.filter(file => file.type.startsWith('image/'));
    
    if (imageFiles.length === 0) {
      toast.error("Por favor, selecione apenas arquivos de imagem");
      return;
    }

    // Validar tamanho (máximo 5MB por imagem)
    const maxSize = 5 * 1024 * 1024; // 5MB
    const oversizedFiles = imageFiles.filter(file => file.size > maxSize);
    
    if (oversizedFiles.length > 0) {
      toast.error("Algumas imagens excedem o tamanho máximo de 5MB");
      return;
    }

    setSelectedFiles(imageFiles);

    // Criar previews
    const urls: string[] = [];
    imageFiles.forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        urls.push(reader.result as string);
        if (urls.length === imageFiles.length) {
          setPreviewUrls(urls);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
    setPreviewUrls(prev => prev.filter((_, i) => i !== index));
  };

  const handleUploadImages = async () => {
    if (selectedFiles.length === 0) {
      toast.error("Selecione pelo menos uma imagem");
      return;
    }

    try {
      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        const reader = new FileReader();
        
        await new Promise<void>((resolve, reject) => {
          reader.onloadend = async () => {
            try {
              await uploadImage.mutateAsync({
                clientId,
                imageBase64: reader.result as string,
                fileName: file.name,
                mimeType: file.type,
                description: uploadDescription || undefined,
                tags: uploadTags || undefined,
                appointmentId: uploadAppointmentId ? parseInt(uploadAppointmentId) : undefined,
              });
              resolve();
            } catch (error) {
              reject(error);
            }
          };
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
      }

      toast.success(`${selectedFiles.length} imagem(ns) enviada(s) com sucesso!`);
      setUploadDialogOpen(false);
      setSelectedFiles([]);
      setPreviewUrls([]);
      setUploadDescription("");
      setUploadTags("");
      setUploadAppointmentId("");
    } catch (error) {
      console.error("Erro no upload:", error);
    }
  };

  // Handlers
  const handleCreateTransaction = () => {
    if (!transactionData.category || !transactionData.amount) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    const amountInCents = Math.round(parseFloat(transactionData.amount) * 100);

    if (isNaN(amountInCents) || amountInCents <= 0) {
      toast.error("Valor inválido");
      return;
    }

    // Validar quantidades dos materiais selecionados
    for (const mat of selectedMaterials) {
      const qty = parseFloat(mat.quantity);
      if (isNaN(qty) || qty <= 0) {
        toast.error(`Informe uma quantidade válida para "${mat.materialName}"`);
        return;
      }
    }

    createTransaction.mutate({
      clientId,
      type: transactionData.type,
      category: transactionData.category,
      description: transactionData.description || undefined,
      amount: amountInCents,
      paymentMethod: transactionData.paymentMethod,
      date: transactionData.date,
      materials: selectedMaterials
        .filter(m => parseFloat(m.quantity) > 0)
        .map(m => ({
          materialId: m.materialId,
          quantity: parseFloat(m.quantity),
          reason: `Usado em ${transactionData.category} - ${transactionData.date}`,
        })),
    });
  };

  const handleAddMaterial = (materialId: number) => {
    if (!availableMaterials) return;
    const mat = availableMaterials.find(m => m.id === materialId);
    if (!mat) return;
    if (selectedMaterials.some(m => m.materialId === materialId)) {
      toast.error("Material já adicionado");
      return;
    }
    setSelectedMaterials(prev => [...prev, {
      materialId: mat.id,
      materialName: mat.name,
      unit: mat.unit || "un",
      currentStock: parseFloat(String(mat.currentStock)) || 0,
      quantity: "1",
    }]);
  };

  const handleRemoveMaterial = (materialId: number) => {
    setSelectedMaterials(prev => prev.filter(m => m.materialId !== materialId));
  };

  const handleMaterialQtyChange = (materialId: number, qty: string) => {
    setSelectedMaterials(prev => prev.map(m =>
      m.materialId === materialId ? { ...m, quantity: qty } : m
    ));
  };

  const handleCreateNote = () => {
    if (!noteContent.trim()) {
      toast.error("Digite o conteúdo da nota");
      return;
    }

    createNote.mutate({
      clientId,
      content: noteContent,
    });
  };

  const handleCreateAnamnesis = () => {
    if (!anamnesisData.consentAccepted) {
      toast.error("É necessário aceitar os termos de consentimento");
      return;
    }

    if (anamnesisData.hasAllergies && !anamnesisData.allergiesDetails.trim()) {
      toast.error("Descreva as alergias");
      return;
    }

    if (anamnesisData.hasDiseases && !anamnesisData.diseasesDetails.trim()) {
      toast.error("Descreva as doenças");
      return;
    }

    if (anamnesisData.usesMedication && !anamnesisData.medicationDetails.trim()) {
      toast.error("Descreva os medicamentos");
      return;
    }

    createAnamnesis.mutate({
      clientId,
      hasAllergies: anamnesisData.hasAllergies,
      allergiesDetails: anamnesisData.hasAllergies ? anamnesisData.allergiesDetails : undefined,
      hasDiseases: anamnesisData.hasDiseases,
      diseasesDetails: anamnesisData.hasDiseases ? anamnesisData.diseasesDetails : undefined,
      usesMedication: anamnesisData.usesMedication,
      medicationDetails: anamnesisData.usesMedication ? anamnesisData.medicationDetails : undefined,
      isPregnant: anamnesisData.isPregnant,
      hasKeloid: anamnesisData.hasKeloid,
      acceptedTerms: anamnesisData.consentAccepted,
    });
  };

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(cents / 100);
  };

  // Bug 5: usar timezone America/Sao_Paulo para evitar deslocamento UTC
  const formatDate = (date: Date | string | null) => {
    if (!date) return "-";
    return new Date(date).toLocaleDateString('pt-BR', { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric',
      timeZone: 'America/Sao_Paulo'
    });
  };

  const formatDateTime = (date: Date | string | null) => {
    if (!date) return "-";
    return new Date(date).toLocaleString('pt-BR', { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'America/Sao_Paulo'
    });
  };

  const getLoyaltyBadgeClass = (level: string) => {
    switch (level) {
      case "Ouro":
        return "bg-yellow-500/10 text-yellow-600 border-yellow-500/20";
      case "Prata":
        return "bg-gray-400/10 text-gray-600 border-gray-400/20";
      case "Bronze":
      default:
        return "bg-amber-700/10 text-amber-700 border-amber-700/20";
    }
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case "concluido":
        return "bg-green-500/10 text-green-600 border-green-500/20";
      case "confirmado":
        return "bg-blue-500/10 text-blue-600 border-blue-500/20";
      case "cancelado":
        return "bg-red-500/10 text-red-600 border-red-500/20";
      case "reagendado":
        return "bg-orange-500/10 text-orange-600 border-orange-500/20";
      case "agendado":
      default:
        return "bg-gray-400/10 text-gray-600 border-gray-400/20";
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!client) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground text-lg">Cliente não encontrado</p>
        <Button onClick={() => setLocation("/clients")} className="mt-4">
          Voltar para Clientes
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setLocation("/clients")}
          className="shrink-0"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl sm:text-3xl font-bold tracking-tight truncate">{client.name}</h1>
        </div>
        <Badge variant="outline" className={`${getLoyaltyBadgeClass(client.loyaltyLevel)} text-xs sm:text-sm px-2 sm:px-4 py-1 sm:py-2 shrink-0`}>
          {client.loyaltyLevel}
        </Badge>
      </div>

      {/* Client Info */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              {client.email && (
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span>{client.email}</span>
                </div>
              )}
              {client.phone && (
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span>{client.phone}</span>
                </div>
              )}
              {client.instagram && (
                <div className="flex items-center gap-2 text-sm">
                  <Instagram className="h-4 w-4 text-muted-foreground" />
                  <span>{client.instagram}</span>
                </div>
              )}
              {client.birthDate && (
                <div className="flex items-center gap-2 text-sm">
                  <Cake className="h-4 w-4 text-muted-foreground" />
                  <span>{formatDate(client.birthDate)}</span>
                </div>
              )}
              {client.docNumber && (
                <div className="flex items-center gap-2 text-sm">
                  <CreditCard className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground text-xs">{client.docType === 'passport' ? 'Passaporte' : 'CPF'}:</span>
                  <span>{client.docNumber}</span>
                </div>
              )}
            </div>

            <Card className="bg-accent/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  Total Gasto
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{formatCurrency(client.totalSpent)}</p>
              </CardContent>
            </Card>

            <Card className="bg-accent/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Agendamentos
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{client.appointmentCount}</p>
              </CardContent>
            </Card>

            <Card className="bg-accent/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Cliente desde
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">
                  {new Date(client.createdAt).toLocaleDateString('pt-BR', { 
                    month: 'short', 
                    year: 'numeric' 
                  })}
                </p>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="appointments" className="w-full">
        <TabsList className="flex w-full bg-zinc-800 rounded-lg p-1 min-h-[44px] overflow-x-auto">
          <TabsTrigger value="appointments" className="flex-1 min-w-fit text-xs sm:text-sm py-2">
            <span className="hidden sm:inline">Agendamentos</span>
            <span className="sm:hidden text-[11px]">Agenda</span>
            {(appointments?.length ?? 0) > 0 && (
              <span className="ml-1.5 inline-flex items-center justify-center rounded-full bg-orange-500 text-white text-[10px] font-bold min-w-[18px] h-[18px] px-1">
                {appointments!.length > 99 ? '99+' : appointments!.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="anamnesis" className="flex-1 text-xs sm:text-sm py-2">
            Anamnese
            {((anamneseSubmissions?.length ?? 0) + (anamnesis?.length ?? 0)) > 0 && (
              <span className="ml-1.5 inline-flex items-center justify-center rounded-full bg-orange-500 text-white text-[10px] font-bold min-w-[18px] h-[18px] px-1">
                {Math.min((anamneseSubmissions?.length ?? 0) + (anamnesis?.length ?? 0), 99)}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="transactions" className="flex-1 text-xs sm:text-sm py-2">
            <span className="hidden sm:inline">Financeiro</span>
            <span className="sm:hidden">R$</span>
            {(transactions?.length ?? 0) > 0 && (
              <span className="ml-1.5 inline-flex items-center justify-center rounded-full bg-orange-500 text-white text-[10px] font-bold min-w-[18px] h-[18px] px-1">
                {transactions!.length > 99 ? '99+' : transactions!.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="gallery" className="flex-1 text-xs sm:text-sm py-2">
            Galeria
            {(gallery?.length ?? 0) > 0 && (
              <span className="ml-1.5 inline-flex items-center justify-center rounded-full bg-orange-500 text-white text-[10px] font-bold min-w-[18px] h-[18px] px-1">
                {gallery!.length > 99 ? '99+' : gallery!.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="notes" className="flex-1 text-xs sm:text-sm py-2">
            Notas
            {(notes?.length ?? 0) > 0 && (
              <span className="ml-1.5 inline-flex items-center justify-center rounded-full bg-orange-500 text-white text-[10px] font-bold min-w-[18px] h-[18px] px-1">
                {notes!.length > 99 ? '99+' : notes!.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="procedures" className="flex-1 text-xs sm:text-sm py-2">
            <span className="hidden sm:inline-flex items-center gap-1"><Stethoscope className="w-3 h-3" />POD</span>
            <span className="sm:hidden">POD</span>
          </TabsTrigger>
        </TabsList>

        {/* Agendamentos Tab */}
        <TabsContent value="appointments">
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0">
                <div className="flex-1 min-w-0">
                  <CardTitle className="text-base sm:text-lg">Agendamentos</CardTitle>
                  <CardDescription className="text-xs sm:text-sm">Histórico de agendamentos do cliente</CardDescription>
                </div>
                {/* Bug 2: Substituído pelo EventModal unificado */}
                <Button onClick={() => setEventModalOpen(true)} className="w-full sm:w-auto text-xs sm:text-sm">
                  <Plus className="h-3 w-3 sm:h-4 sm:w-4 mr-2" />
                  Novo Agendamento
                </Button>
                <EventModal
                  isOpen={eventModalOpen}
                  onClose={() => setEventModalOpen(false)}
                  initialClientId={clientId}
                  onSuccess={() => {
                    utils.appointments.getByClientId.invalidate({ clientId });
                    utils.clients.getById.invalidate({ id: clientId });
                    utils.dashboard.metrics.invalidate();
                  }}
                />
              </div>
            </CardHeader>
            <CardContent>
              {appointments && appointments.length > 0 ? (
                <div className="space-y-4">
                  {appointments.map((appointment) => (
                    <Card key={appointment.id}>
                      <CardContent className="pt-6">
                        <div className="flex items-start justify-between">
                          <div className="space-y-2">
                            <p className="font-semibold text-lg">{appointment.service}</p>
                            <p className="text-sm text-muted-foreground">
                              {formatDateTime(appointment.date)} • {appointment.duration} minutos
                            </p>
                            <p className="text-sm">
                              <span className="text-muted-foreground">Artista:</span> {appointment.artist}
                            </p>
                            {appointment.notes && (
                              <p className="text-sm text-muted-foreground mt-2">{appointment.notes}</p>
                            )}
                          </div>
                          <Badge variant="outline" className={getStatusBadgeClass(appointment.status)}>
                            {appointment.status}
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhum agendamento encontrado
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Anamnese Tab */}
        <TabsContent value="anamnesis">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Fichas de Anamnese</CardTitle>
                  <CardDescription>Histórico de fichas preenchidas</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button onClick={() => setSendLinkDialogOpen(true)}>
                    <Mail className="h-4 w-4 mr-2" />
                    Enviar Link
                  </Button>
                  <Dialog open={anamnesisDialogOpen} onOpenChange={setAnamnesisDialogOpen}>
                    <DialogTrigger asChild>
                      <Button variant="outline">
                        <Plus className="h-4 w-4 mr-2" />
                        Nova Ficha
                      </Button>
                    </DialogTrigger>
                  <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>Ficha de Anamnese</DialogTitle>
                      <DialogDescription>
                        Preencha as informações de saúde de {client.name}
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-6 py-4">
                      {/* Alergias */}
                      <div className="space-y-3">
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="hasAllergies"
                            checked={anamnesisData.hasAllergies}
                            onCheckedChange={(checked) => 
                              setAnamnesisData({ ...anamnesisData, hasAllergies: checked as boolean })
                            }
                          />
                          <Label htmlFor="hasAllergies" className="font-semibold cursor-pointer">
                            Possui alergias?
                          </Label>
                        </div>
                        {anamnesisData.hasAllergies && (
                          <Textarea
                            placeholder="Descreva as alergias..."
                            value={anamnesisData.allergiesDetails}
                            onChange={(e) => setAnamnesisData({ ...anamnesisData, allergiesDetails: e.target.value })}
                            rows={3}
                          />
                        )}
                      </div>

                      {/* Doenças */}
                      <div className="space-y-3">
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="hasDiseases"
                            checked={anamnesisData.hasDiseases}
                            onCheckedChange={(checked) => 
                              setAnamnesisData({ ...anamnesisData, hasDiseases: checked as boolean })
                            }
                          />
                          <Label htmlFor="hasDiseases" className="font-semibold cursor-pointer">
                            Possui doenças ou condições médicas?
                          </Label>
                        </div>
                        {anamnesisData.hasDiseases && (
                          <Textarea
                            placeholder="Descreva as doenças ou condições médicas..."
                            value={anamnesisData.diseasesDetails}
                            onChange={(e) => setAnamnesisData({ ...anamnesisData, diseasesDetails: e.target.value })}
                            rows={3}
                          />
                        )}
                      </div>

                      {/* Medicamentos */}
                      <div className="space-y-3">
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="usesMedication"
                            checked={anamnesisData.usesMedication}
                            onCheckedChange={(checked) => 
                              setAnamnesisData({ ...anamnesisData, usesMedication: checked as boolean })
                            }
                          />
                          <Label htmlFor="usesMedication" className="font-semibold cursor-pointer">
                            Faz uso de medicamentos?
                          </Label>
                        </div>
                        {anamnesisData.usesMedication && (
                          <Textarea
                            placeholder="Liste os medicamentos em uso..."
                            value={anamnesisData.medicationDetails}
                            onChange={(e) => setAnamnesisData({ ...anamnesisData, medicationDetails: e.target.value })}
                            rows={3}
                          />
                        )}
                      </div>

                      {/* Gravidez */}
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="isPregnant"
                          checked={anamnesisData.isPregnant}
                          onCheckedChange={(checked) => 
                            setAnamnesisData({ ...anamnesisData, isPregnant: checked as boolean })
                          }
                        />
                        <Label htmlFor="isPregnant" className="font-semibold cursor-pointer">
                          Está grávida?
                        </Label>
                      </div>

                      {/* Quelóide */}
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="hasKeloid"
                          checked={anamnesisData.hasKeloid}
                          onCheckedChange={(checked) => 
                            setAnamnesisData({ ...anamnesisData, hasKeloid: checked as boolean })
                          }
                        />
                        <Label htmlFor="hasKeloid" className="font-semibold cursor-pointer">
                          Possui tendência a quelóide?
                        </Label>
                      </div>

                      {/* Termo de Consentimento */}
                      <div className="border-t pt-6 space-y-4">
                        <div className="bg-muted/50 p-4 rounded-lg space-y-2">
                          <div className="flex items-start gap-2">
                            <AlertCircle className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                            <div className="space-y-2 text-sm">
                              <p className="font-semibold">Termo de Consentimento e Responsabilidade</p>
                              <p className="text-muted-foreground">
                                Declaro que as informações prestadas acima são verdadeiras e estou ciente de que a omissão de dados pode comprometer o resultado do procedimento e minha saúde. 
                              </p>
                              <p className="text-muted-foreground">
                                Autorizo a realização do procedimento de tatuagem e me comprometo a seguir todas as orientações de cuidados pós-procedimento fornecidas pelo profissional.
                              </p>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-start space-x-2">
                          <Checkbox
                            id="consentAccepted"
                            checked={anamnesisData.consentAccepted}
                            onCheckedChange={(checked) => 
                              setAnamnesisData({ ...anamnesisData, consentAccepted: checked as boolean })
                            }
                          />
                          <Label htmlFor="consentAccepted" className="font-medium cursor-pointer leading-relaxed">
                            Li e aceito os termos de consentimento e responsabilidade *
                          </Label>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <Button
                        onClick={handleCreateAnamnesis}
                        disabled={createAnamnesis.isPending || !anamnesisData.consentAccepted}
                        className="flex-1"
                      >
                        {createAnamnesis.isPending ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Salvando...
                          </>
                        ) : (
                          "Salvar Ficha"
                        )}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => setAnamnesisDialogOpen(false)}
                        disabled={createAnamnesis.isPending}
                      >
                        Cancelar
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
                </div>
                <SendAnamneseDialog
                  open={sendLinkDialogOpen}
                  onOpenChange={setSendLinkDialogOpen}
                  clientId={clientId}
                  clientName={client.name}
                  clientEmail={client.email || undefined}
                  clientPhone={client.phone || undefined}
                />
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {/* Fichas enviadas via link (novo fluxo — 39 campos) */}
                {anamneseSubmissions && anamneseSubmissions.length > 0 && (
                  <div className="space-y-4">
                    <h3 className="text-sm font-semibold text-orange-400 uppercase tracking-wider flex items-center gap-2">
                      <Mail className="h-4 w-4" />
                      Fichas via link ({anamneseSubmissions.length})
                    </h3>
                    {anamneseSubmissions
                      .map((req: any) => {
                        const isCompleted = !!req.completedAt;
                        const isExpired = !isCompleted && req.expiresAt && new Date(req.expiresAt) < new Date();
                        const isPending = !isCompleted && !isExpired;
                        return (
                        <Card key={`req-${req.id}`} className={`border ${isCompleted ? 'border-orange-500/20' : isExpired ? 'border-zinc-700/40' : 'border-yellow-500/20'}`}>
                          <CardContent className="pt-4">
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-2 flex-wrap">
                                {isCompleted && (
                                  <Badge variant="outline" className="bg-green-500/10 text-green-400 border-green-500/30 text-xs">Preenchida</Badge>
                                )}
                                {isPending && (
                                  <Badge variant="outline" className="bg-yellow-500/10 text-yellow-400 border-yellow-500/30 text-xs">Aguardando</Badge>
                                )}
                                {isExpired && (
                                  <Badge variant="outline" className="bg-zinc-500/10 text-zinc-400 border-zinc-500/30 text-xs">Expirada</Badge>
                                )}
                                <span className="text-xs text-muted-foreground">
                                  Enviado em {formatDate(req.createdAt)}
                                  {req.completedAt && ` · Preenchido em ${formatDate(req.completedAt)}`}
                                  {isPending && req.expiresAt && ` · Expira em ${formatDate(req.expiresAt)}`}
                                </span>
                                <Badge variant="outline" className="text-xs text-zinc-400 border-zinc-600">
                                  {req.sentVia === 'whatsapp' ? '📱 WhatsApp' : '✉️ E-mail'}
                                </Badge>
                              </div>
                              <div className="flex gap-1">
                                {(req.submissionId || req.id) && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 w-7 p-0 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                                    onClick={() => { setDeletingItem({ type: 'submission', id: req.submissionId || req.id }); setDeleteConfirmOpen(true); }}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                )}
                              </div>
                            </div>
                            {/* Exibe o payload JSON com os 39 campos */}
                            {req.payloadJson ? (
                              <AnamneseSubmissionView
                                payload={(() => { try { return JSON.parse(req.payloadJson); } catch { return {}; } })()} 
                                submittedAt={req.completedAt}
                              />
                            ) : (
                              <p className="text-xs text-muted-foreground">
                                {isPending ? 'Aguardando preenchimento pelo cliente.' : isExpired ? 'Link expirado sem preenchimento.' : ''}
                              </p>
                            )}
                          </CardContent>
                        </Card>
                        );
                      })}
                  </div>
                )}

                {/* Fichas criadas manualmente (fluxo antigo) */}
                {anamnesis && anamnesis.length > 0 && (
                  <div className="space-y-4">
                    <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      Fichas criadas manualmente
                    </h3>
                    {anamnesis.map((record) => (
                      <Card key={record.id}>
                        <CardContent className="pt-6">
                          <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                              <p className="text-sm text-muted-foreground">
                                Preenchido em {formatDate(record.createdAt)}
                              </p>
                              {record.riskLevel && (
                                <Badge
                                  variant="outline"
                                  className={
                                    record.riskLevel === "critical"
                                      ? "bg-red-500/10 text-red-500 border-red-500/50"
                                      : record.riskLevel === "high"
                                      ? "bg-orange-500/10 text-orange-500 border-orange-500/50"
                                      : record.riskLevel === "medium"
                                      ? "bg-yellow-500/10 text-yellow-500 border-yellow-500/50"
                                      : "bg-green-500/10 text-green-500 border-green-500/50"
                                  }
                                >
                                  {record.riskLevel === "critical"
                                    ? "🚨 Risco Crítico"
                                    : record.riskLevel === "high"
                                    ? "⚠️ Risco Alto"
                                    : record.riskLevel === "medium"
                                    ? "⚠️ Risco Médio"
                                    : "✅ Baixo Risco"}
                                </Badge>
                              )}
                            </div>
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => window.open(`/anamnese/view/${record.id}`, '_blank')}
                              >
                                <FileText className="h-4 w-4 mr-2" />
                                Visualizar
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => window.open(`/anamnese/pdf/${record.id}`, '_blank')}
                              >
                                <FileDown className="h-4 w-4 mr-2" />
                                PDF
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleOpenEditRecord(record)}
                              >
                                <Pencil className="h-4 w-4 mr-2" />
                                Editar
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-red-400 hover:text-red-300 hover:bg-red-500/10 border-red-500/30"
                                onClick={() => { setDeletingItem({ type: 'record', id: record.id }); setDeleteConfirmOpen(true); }}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Excluir
                              </Button>
                            </div>
                          </div>
                          <div className="grid gap-3 text-sm">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">Alergias:</span>
                              <span>{record.hasAllergies ? `Sim - ${record.allergiesDetails}` : "Não"}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium">Doenças:</span>
                              <span>{record.hasDiseases ? `Sim - ${record.diseasesDetails}` : "Não"}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium">Medicamentos:</span>
                              <span>{record.usesMedication ? `Sim - ${record.medicationDetails}` : "Não"}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium">Grávida:</span>
                              <span>{record.isPregnant ? "Sim" : "Não"}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium">Quelóide:</span>
                              <span>{record.hasKeloid ? "Sim" : "Não"}</span>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}

                {/* Estado vazio */}
                {(!anamnesis || anamnesis.length === 0) &&
                  (!anamneseSubmissions || anamneseSubmissions.length === 0) && (
                  <div className="text-center py-8 text-muted-foreground">
                    Nenhuma ficha de anamnese encontrada.
                    <br />
                    <span className="text-sm">Envie um link para o cliente ou crie uma ficha manualmente.</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Financeiro Tab */}
        <TabsContent value="transactions">
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0">
                <div className="flex-1 min-w-0">
                  <CardTitle className="text-base sm:text-lg">Transações Financeiras</CardTitle>
                  <CardDescription className="text-xs sm:text-sm">Histórico de transações do cliente</CardDescription>
                </div>
                <Dialog open={transactionDialogOpen} onOpenChange={setTransactionDialogOpen}>
                  <DialogTrigger asChild>
                    <Button className="w-full sm:w-auto text-xs sm:text-sm">
                      <Plus className="h-3 w-3 sm:h-4 sm:w-4 mr-2" />
                      Nova Transação
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl">
                    <DialogHeader>
                      <DialogTitle>Registrar Nova Transação</DialogTitle>
                      <DialogDescription>
                        Registre uma transação financeira para {client.name}
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="type" className="text-xs sm:text-sm">Tipo *</Label>
                          <Select
                            value={transactionData.type}
                            onValueChange={(value: "entrada" | "saida") => 
                              setTransactionData({ ...transactionData, type: value })
                            }
                          >
                            <SelectTrigger className="text-xs sm:text-sm">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="entrada">Entrada</SelectItem>
                              <SelectItem value="saida">Saída</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="category" className="text-xs sm:text-sm">Categoria *</Label>
                          <Input
                            id="category"
                            value={transactionData.category}
                            onChange={(e) => setTransactionData({ ...transactionData, category: e.target.value })}
                            placeholder="Ex: Tatuagem, Material, Aluguel"
                            className="text-xs sm:text-sm"
                          />
                        </div>
                      </div>
                      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="amount">Valor (R$) *</Label>
                          <Input
                            id="amount"
                            type="number"
                            step="0.01"
                            min="0"
                            value={transactionData.amount}
                            onChange={(e) => setTransactionData({ ...transactionData, amount: e.target.value })}
                            placeholder="0.00"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="paymentMethod">Método de Pagamento *</Label>
                          <Select
                            value={transactionData.paymentMethod}
                            onValueChange={(value: any) => 
                              setTransactionData({ ...transactionData, paymentMethod: value })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="dinheiro">Dinheiro</SelectItem>
                              <SelectItem value="pix">PIX</SelectItem>
                              <SelectItem value="credito">Crédito</SelectItem>
                              <SelectItem value="debito">Débito</SelectItem>
                              <SelectItem value="transferencia">Transferência</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="transaction-date">Data *</Label>
                        <Input
                          id="transaction-date"
                          type="date"
                          value={transactionData.date}
                          onChange={(e) => setTransactionData({ ...transactionData, date: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="description">Descrição</Label>
                        <Textarea
                          id="description"
                          value={transactionData.description}
                          onChange={(e) => setTransactionData({ ...transactionData, description: e.target.value })}
                          placeholder="Detalhes da transação..."
                          rows={3}
                        />
                      </div>

                      {/* Seção de Materiais do Estoque */}
                      <div className="space-y-3 border border-border rounded-lg p-3">
                        <div className="flex items-center gap-2">
                          <Package className="h-4 w-4 text-muted-foreground" />
                          <Label className="text-sm font-medium">Materiais Utilizados (opcional)</Label>
                        </div>
                        <p className="text-xs text-muted-foreground">Selecione materiais do estoque para dar baixa automática ao registrar esta transação.</p>

                        {/* Dropdown para adicionar material */}
                        {availableMaterials && availableMaterials.length > 0 && (
                          <Select
                            value=""
                            onValueChange={(val) => val && handleAddMaterial(parseInt(val))}
                          >
                            <SelectTrigger className="h-8 text-sm">
                              <SelectValue placeholder="+ Adicionar material do estoque" />
                            </SelectTrigger>
                            <SelectContent>
                              {availableMaterials
                                .filter(m => !selectedMaterials.some(s => s.materialId === m.id))
                                .map(m => (
                                  <SelectItem key={m.id} value={String(m.id)}>
                                    {m.name} — {parseFloat(String(m.currentStock)).toFixed(0)} {m.unit || "un"} em estoque
                                  </SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                        )}

                        {/* Lista de materiais selecionados */}
                        {selectedMaterials.length > 0 && (
                          <div className="space-y-2">
                            {selectedMaterials.map(mat => (
                              <div key={mat.materialId} className="flex items-center gap-2 bg-muted/40 rounded px-2 py-1">
                                <span className="flex-1 text-sm truncate">{mat.materialName}</span>
                                <span className="text-xs text-muted-foreground">{mat.unit}</span>
                                <Input
                                  type="number"
                                  step="0.1"
                                  min="0.1"
                                  max={mat.currentStock}
                                  value={mat.quantity}
                                  onChange={(e) => handleMaterialQtyChange(mat.materialId, e.target.value)}
                                  className="w-20 h-7 text-sm px-2"
                                />
                                <span className="text-xs text-muted-foreground">/ {mat.currentStock.toFixed(0)}</span>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                                  onClick={() => handleRemoveMaterial(mat.materialId)}
                                >
                                  <X className="h-3 w-3" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        )}

                        {availableMaterials && availableMaterials.length === 0 && (
                          <p className="text-xs text-muted-foreground italic">Nenhum material cadastrado no estoque.</p>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <Button
                        onClick={handleCreateTransaction}
                        disabled={createTransaction.isPending}
                        className="flex-1"
                      >
                        {createTransaction.isPending ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Registrando...
                          </>
                        ) : (
                          selectedMaterials.length > 0
                            ? `Registrar + Baixar ${selectedMaterials.length} material(is)`
                            : "Registrar Transação"
                        )}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => { setTransactionDialogOpen(false); setSelectedMaterials([]); }}
                        disabled={createTransaction.isPending}
                      >
                        Cancelar
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              {transactions && transactions.length > 0 ? (
                <div className="space-y-4">
                  {transactions.map((transaction) => (
                    <Card key={transaction.id}>
                      <CardContent className="pt-6">
                        <div className="flex items-start justify-between">
                          <div className="space-y-2">
                            <p className="font-semibold">{transaction.category}</p>
                            {transaction.description && (
                              <p className="text-sm text-muted-foreground">{transaction.description}</p>
                            )}
                            <p className="text-sm text-muted-foreground">
                              {formatDate(transaction.date)} • {transaction.paymentMethod}
                            </p>
                          </div>
                          <p className={`text-lg font-bold ${transaction.type === "entrada" ? "text-green-600" : "text-red-600"}`}>
                            {transaction.type === "entrada" ? "+" : "-"}{formatCurrency(transaction.amount)}
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhuma transação encontrada
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Galeria Tab */}
        <TabsContent value="gallery">
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0">
                <div className="flex-1 min-w-0">
                  <CardTitle className="text-base sm:text-lg">Galeria de Trabalhos</CardTitle>
                  <CardDescription className="text-xs sm:text-sm">Portfólio de tatuagens realizadas</CardDescription>
                </div>
                <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
                  <DialogTrigger asChild>
                    <Button className="w-full sm:w-auto text-xs sm:text-sm">
                      <Upload className="h-3 w-3 sm:h-4 sm:w-4 mr-2" />
                      Adicionar Imagens
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>Upload de Imagens</DialogTitle>
                      <DialogDescription>
                        Adicione fotos dos trabalhos realizados para {client.name}
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-6 py-4">
                      {/* Área de Drop */}
                      <div
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        onClick={() => fileInputRef.current?.click()}
                        className={`
                          border-2 border-dashed rounded-lg p-6 sm:p-12 text-center cursor-pointer transition-colors
                          ${isDragging 
                            ? 'border-primary bg-primary/5' 
                            : 'border-muted-foreground/25 hover:border-primary/50 hover:bg-accent/50'
                          }
                        `}
                      >
                        <div className="flex flex-col items-center gap-4">
                          <div className="rounded-full bg-primary/10 p-4">
                            <ImageIcon className="h-8 w-8 text-primary" />
                          </div>
                          <div className="space-y-2">
                            <p className="text-lg font-medium">
                              {isDragging ? 'Solte as imagens aqui' : 'Arraste imagens ou clique para selecionar'}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              Formatos aceitos: JPG, PNG, GIF • Máximo 5MB por imagem
                            </p>
                          </div>
                        </div>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          multiple
                          onChange={handleFileSelect}
                          className="hidden"
                        />
                      </div>

                      {/* Preview das imagens selecionadas */}
                      {previewUrls.length > 0 && (
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <Label className="text-base font-semibold">
                              {previewUrls.length} imagem(ns) selecionada(s)
                            </Label>
                          </div>
                          <div className="grid grid-cols-3 gap-4">
                            {previewUrls.map((url, index) => (
                              <div key={index} className="relative group">
                                <img
                                  src={url}
                                  alt={`Preview ${index + 1}`}
                                  className="w-full h-32 object-cover rounded-lg"
                                />
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    removeFile(index);
                                  }}
                                  className="absolute top-2 right-2 bg-destructive text-destructive-foreground rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                  <X className="h-4 w-4" />
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Campos adicionais */}
                      {previewUrls.length > 0 && (
                        <div className="space-y-4 border-t pt-4">
                          <div className="space-y-2">
                            <Label htmlFor="upload-description">Descrição</Label>
                            <Textarea
                              id="upload-description"
                              value={uploadDescription}
                              onChange={(e) => setUploadDescription(e.target.value)}
                              placeholder="Descreva o trabalho realizado..."
                              rows={3}
                            />
                          </div>
                          <div className="grid gap-4 md:grid-cols-2">
                            <div className="space-y-2">
                              <Label htmlFor="upload-tags">Tags</Label>
                              <Input
                                id="upload-tags"
                                value={uploadTags}
                                onChange={(e) => setUploadTags(e.target.value)}
                                placeholder="Ex: realista, colorido, braço"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="upload-appointment">Vincular a Agendamento (opcional)</Label>
                              <Select
                                value={uploadAppointmentId}
                                onValueChange={setUploadAppointmentId}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Selecione um agendamento" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="none">Nenhum</SelectItem>
                                  {appointments?.map((apt) => (
                                    <SelectItem key={apt.id} value={apt.id.toString()}>
                                      {apt.service} - {formatDate(apt.date)}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="flex gap-3">
                      <Button
                        onClick={handleUploadImages}
                        disabled={uploadImage.isPending || selectedFiles.length === 0}
                        className="flex-1"
                      >
                        {uploadImage.isPending ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Enviando...
                          </>
                        ) : (
                          `Enviar ${selectedFiles.length > 0 ? `(${selectedFiles.length})` : ''}`
                        )}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setUploadDialogOpen(false);
                          setSelectedFiles([]);
                          setPreviewUrls([]);
                          setUploadDescription("");
                          setUploadTags("");
                          setUploadAppointmentId("");
                        }}
                        disabled={uploadImage.isPending}
                      >
                        Cancelar
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              {gallery && gallery.length > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {gallery.map((image) => (
                    <div key={image.id} className="relative aspect-square rounded-lg overflow-hidden group">
                      <img
                        src={image.imageUrl}
                        alt={image.description || "Tatuagem"}
                        className="w-full h-full object-cover transition-transform group-hover:scale-110"
                      />
                      {image.description && (
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-3">
                          <p className="text-white text-sm">{image.description}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <ImageIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Nenhuma imagem na galeria</p>
                  <p className="text-sm mt-2">Adicione fotos dos trabalhos realizados</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notas Tab */}
        <TabsContent value="notes">
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0">
                <div className="flex-1 min-w-0">
                  <CardTitle className="text-base sm:text-lg">Notas do Tatuador</CardTitle>
                  <CardDescription className="text-xs sm:text-sm">Observações e anotações sobre o cliente</CardDescription>
                </div>
                <Dialog open={noteDialogOpen} onOpenChange={setNoteDialogOpen}>
                  <DialogTrigger asChild>
                    <Button className="w-full sm:w-auto text-xs sm:text-sm">
                      <Plus className="h-3 w-3 sm:h-4 sm:w-4 mr-2" />
                      Nova Nota
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Adicionar Nova Nota</DialogTitle>
                      <DialogDescription>
                        Adicione uma observação sobre {client.name}
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="note-content">Conteúdo da Nota *</Label>
                        <Textarea
                          id="note-content"
                          value={noteContent}
                          onChange={(e) => setNoteContent(e.target.value)}
                          placeholder="Digite suas observações sobre o cliente..."
                          rows={6}
                        />
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <Button
                        onClick={handleCreateNote}
                        disabled={createNote.isPending}
                        className="flex-1"
                      >
                        {createNote.isPending ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Adicionando...
                          </>
                        ) : (
                          "Adicionar Nota"
                        )}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => setNoteDialogOpen(false)}
                        disabled={createNote.isPending}
                      >
                        Cancelar
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              {notes && notes.length > 0 ? (
                <div className="space-y-4">
                  {notes.map((note) => (
                    <Card key={note.id}>
                      <CardContent className="pt-6">
                        <p className="text-sm text-muted-foreground mb-2">
                          {formatDateTime(note.createdAt)}
                        </p>
                        <p className="whitespace-pre-wrap">{note.content}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhuma nota encontrada
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Prontuário Técnico (POD Session) ── */}
        <TabsContent value="procedures">
          <ProceduresTab clientId={clientId} clientName={client?.name ?? ""} />
        </TabsContent>
      </Tabs>

      {/* Dialog de Edição de Ficha Manual */}
      <Dialog open={editRecordDialogOpen} onOpenChange={setEditRecordDialogOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Ficha de Anamnese</DialogTitle>
            <DialogDescription>Atualize as informações de saúde do cliente</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Checkbox id="edit-hasAllergies" checked={editRecordData.hasAllergies}
                  onCheckedChange={(c) => setEditRecordData({ ...editRecordData, hasAllergies: !!c })} />
                <Label htmlFor="edit-hasAllergies">Possui alergias?</Label>
              </div>
              {editRecordData.hasAllergies && (
                <Textarea placeholder="Descreva as alergias..." value={editRecordData.allergiesDetails}
                  onChange={(e) => setEditRecordData({ ...editRecordData, allergiesDetails: e.target.value })} rows={2} />
              )}
            </div>
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Checkbox id="edit-hasDiseases" checked={editRecordData.hasDiseases}
                  onCheckedChange={(c) => setEditRecordData({ ...editRecordData, hasDiseases: !!c })} />
                <Label htmlFor="edit-hasDiseases">Possui doenças ou condições médicas?</Label>
              </div>
              {editRecordData.hasDiseases && (
                <Textarea placeholder="Descreva as doenças..." value={editRecordData.diseasesDetails}
                  onChange={(e) => setEditRecordData({ ...editRecordData, diseasesDetails: e.target.value })} rows={2} />
              )}
            </div>
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Checkbox id="edit-usesMedication" checked={editRecordData.usesMedication}
                  onCheckedChange={(c) => setEditRecordData({ ...editRecordData, usesMedication: !!c })} />
                <Label htmlFor="edit-usesMedication">Faz uso de medicamentos?</Label>
              </div>
              {editRecordData.usesMedication && (
                <Textarea placeholder="Liste os medicamentos..." value={editRecordData.medicationDetails}
                  onChange={(e) => setEditRecordData({ ...editRecordData, medicationDetails: e.target.value })} rows={2} />
              )}
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox id="edit-isPregnant" checked={editRecordData.isPregnant}
                onCheckedChange={(c) => setEditRecordData({ ...editRecordData, isPregnant: !!c })} />
              <Label htmlFor="edit-isPregnant">Está grávida?</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox id="edit-hasKeloid" checked={editRecordData.hasKeloid}
                onCheckedChange={(c) => setEditRecordData({ ...editRecordData, hasKeloid: !!c })} />
              <Label htmlFor="edit-hasKeloid">Possui tendência a quelóide?</Label>
            </div>
            <div className="space-y-2">
              <Label>Observações adicionais</Label>
              <Textarea placeholder="Observações..." value={editRecordData.notes}
                onChange={(e) => setEditRecordData({ ...editRecordData, notes: e.target.value })} rows={3} />
            </div>
          </div>
          <div className="flex gap-3">
            <Button onClick={() => updateRecord.mutate({ id: editingRecord?.id, ...editRecordData })} disabled={updateRecord.isPending} className="flex-1">
              {updateRecord.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Salvando...</> : "Salvar Alterações"}
            </Button>
            <Button variant="outline" onClick={() => setEditRecordDialogOpen(false)} disabled={updateRecord.isPending}>Cancelar</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog de Confirmação de Exclusão */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-red-400">Excluir Ficha de Anamnese</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir esta ficha? Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-3 pt-4">
            <Button
              variant="destructive"
              onClick={handleConfirmDelete}
              disabled={deleteRecord.isPending || deleteSubmission.isPending}
              className="flex-1"
            >
              {(deleteRecord.isPending || deleteSubmission.isPending) ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Excluindo...</> : "Sim, Excluir"}
            </Button>
            <Button variant="outline" onClick={() => { setDeleteConfirmOpen(false); setDeletingItem(null); }}>Cancelar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Aba Prontuário Técnico (POD Session) ──────────────────────────────────

const STATUS_LABELS_POD: Record<string, { label: string; color: string }> = {
  em_andamento: { label: "Em andamento", color: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  pausado: { label: "Pausado", color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
  finalizado: { label: "Finalizado", color: "bg-green-500/20 text-green-400 border-green-500/30" },
  retorno: { label: "Retorno", color: "bg-purple-500/20 text-purple-400 border-purple-500/30" },
  retoque: { label: "Retoque", color: "bg-orange-500/20 text-orange-400 border-orange-500/30" },
};

function ProceduresTab({ clientId, clientName }: { clientId: number; clientName: string }) {
  const [, navigate] = useLocation();

  const proceduresQuery = trpc.procedures.listByClient.useQuery(
    { clientId },
    { enabled: clientId > 0, staleTime: 30_000 }
  );

  const utils = trpc.useUtils();

  const deleteMutation = trpc.procedures.delete.useMutation({
    onSuccess: () => {
      utils.procedures.listByClient.invalidate({ clientId });
      toast.success("Procedimento excluído.");
    },
    onError: (err) => toast.error("Erro: " + err.message),
  });

  const procedures = proceduresQuery.data ?? [];

  const formatDuration = (minutes: number | null) => {
    if (!minutes) return null;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h === 0) return `${m}min`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}min`;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Stethoscope className="w-5 h-5 text-primary" />
              Prontuário Técnico
            </CardTitle>
            <CardDescription>Sessões de execução de tatuagem com timer, insumos e fotos</CardDescription>
          </div>
          <Button
            size="sm"
            className="gap-1.5"
            onClick={() => navigate(`/procedures/new?clientId=${clientId}`)}
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Nova Sessão</span>
            <span className="sm:hidden">Nova</span>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {proceduresQuery.isLoading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-20 rounded-lg bg-muted animate-pulse" />
            ))}
          </div>
        ) : procedures.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Stethoscope className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="font-medium">Nenhuma sessão registrada</p>
            <p className="text-sm mt-1">Clique em "Nova Sessão" para iniciar o prontuário técnico</p>
          </div>
        ) : (
          <div className="space-y-3">
            {procedures.map((p) => {
              const statusInfo = STATUS_LABELS_POD[p.status] ?? STATUS_LABELS_POD.em_andamento;
              const duration = formatDuration(p.totalDurationMinutes);
              return (
                <div
                  key={p.id}
                  className="flex items-start gap-3 p-4 rounded-lg border bg-card hover:border-primary/40 transition-colors"
                >
                  {/* Imagem de referência miniatura */}
                  {p.referenceImageUrl ? (
                    <img
                      src={p.referenceImageUrl}
                      alt="ref"
                      className="w-12 h-12 rounded-lg object-cover border shrink-0"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center shrink-0">
                      <Stethoscope className="w-5 h-5 text-muted-foreground" />
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{p.title}</p>
                        <div className="flex flex-wrap items-center gap-2 mt-1">
                          <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-4 ${statusInfo.color}`}>
                            {statusInfo.label}
                          </Badge>
                          {p.bodyLocation && (
                            <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                              <MapPin className="w-2.5 h-2.5" />
                              {p.bodyLocation}
                            </span>
                          )}
                          {p.tattooStyle && (
                            <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                              <Palette className="w-2.5 h-2.5" />
                              {p.tattooStyle}
                            </span>
                          )}
                          {duration && (
                            <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                              <Clock className="w-2.5 h-2.5" />
                              {duration}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs gap-1 px-2"
                          onClick={() => navigate(`/procedures/${p.id}`)}
                        >
                          <Play className="w-3 h-3" />
                          <span className="hidden sm:inline">Sessão</span>
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                          onClick={() => {
                            if (confirm("Excluir este procedimento? Esta ação não pode ser desfeita.")) {
                              deleteMutation.mutate({ id: p.id });
                            }
                          }}
                          disabled={deleteMutation.isPending}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                    {p.artistName && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Artista: {p.artistName}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
