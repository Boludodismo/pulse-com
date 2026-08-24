import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useSyncToast } from "@/hooks/useSyncToast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Send } from "lucide-react";
import { buildWhatsAppLink } from "@shared/const";

// Máscara de data DD/MM/AAAA
function applyDateMask(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

// Converte DD/MM/AAAA → YYYY-MM-DD para salvar no banco
function parseDateToISO(masked: string): string {
  const parts = masked.split("/");
  if (parts.length !== 3 || parts[2].length !== 4) return masked;
  return `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
}

export default function NewClient() {
  const { notifySync } = useSyncToast();
  const [, setLocation] = useLocation();
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    birthDate: "",
    instagram: "",
    gender: "" as "Homem" | "Mulher" | "Outros" | "",
    docType: "cpf" as "cpf" | "passport",
    docNumber: "",
    cep: "",
    street: "",
    number: "",
    complement: "",
    reference: "",
    neighborhood: "",
    city: "",
    state: "",
    country: "Brasil",
  });

  // Máscara de CPF: 000.000.000-00
  const formatCpf = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 11);
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
    if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
  };

  const handleDocNumberChange = (value: string) => {
    if (formData.docType === "cpf") {
      setFormData((prev) => ({ ...prev, docNumber: formatCpf(value) }));
    } else {
      // Passaporte: apenas alfanumérico, máximo 20 caracteres
      setFormData((prev) => ({ ...prev, docNumber: value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 20) }));
    }
  };
  const [loadingCep, setLoadingCep] = useState(false);
  const [cepError, setCepError] = useState("");
  const [sendAnamnese, setSendAnamnese] = useState(false);
  const [anamneseChannel, setAnamneseChannel] = useState<"email" | "whatsapp">("whatsapp");

  const utils = trpc.useUtils();
  const createClient = trpc.clients.create.useMutation({
    onSuccess: async (newClient) => {
      toast.success("Cliente criado com sucesso!");
      notifySync("cliente");
      utils.clients.list.invalidate();
      
      // Se marcou para enviar anamnese, envia o link
      if (sendAnamnese && newClient.id) {
        try {
          const recipient = anamneseChannel === "email" ? formData.email : formData.phone;
          
          if (!recipient) {
            toast.error(`${anamneseChannel === "email" ? "Email" : "Telefone"} não informado. Link de anamnese não enviado.`);
            setLocation("/clients");
            return;
          }
          
          const { link } = await createAnamneseRequest.mutateAsync({
            clientId: newClient.id,
            sentVia: anamneseChannel,
            sentTo: recipient,
          });
          
          // Abrir WhatsApp ou mostrar mensagem de sucesso
          if (anamneseChannel === "whatsapp") {
            const message =
              `Olá ${formData.name}! Por favor, preencha sua ficha de anamnese através deste link: ${link}`
            ;
            window.open(buildWhatsAppLink(recipient, message), "_blank");
            toast.success("WhatsApp aberto com o link de anamnese!");
          } else {
            toast.success("Link de anamnese criado! (Email será implementado em breve)");
          }
        } catch (error: any) {
          toast.error(`Erro ao criar link de anamnese: ${error.message}`);
        }
      }
      
      setLocation("/clients");
    },
    onError: (error) => {
      toast.error(`Erro ao criar cliente: ${error.message}`);
    },
  });
  
  const createAnamneseRequest = trpc.anamnese.createRequest.useMutation();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      toast.error("O nome é obrigatório");
      return;
    }

    createClient.mutate({
      name: formData.name,
      email: formData.email || undefined,
      phone: formData.phone || undefined,
      birthDate: formData.birthDate ? parseDateToISO(formData.birthDate) : undefined,
      instagram: formData.instagram || undefined,
      gender: formData.gender || undefined,
      docType: formData.docType,
      docNumber: formData.docNumber || undefined,
      cep: formData.cep || undefined,
      street: formData.street || undefined,
      number: formData.number || undefined,
      complement: formData.complement || undefined,
      reference: formData.reference || undefined,
      neighborhood: formData.neighborhood || undefined,
      city: formData.city || undefined,
      state: formData.state || undefined,
      country: formData.country || undefined,
    });
  };

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleCepChange = async (cep: string) => {
    // Atualiza o valor do CEP no formData
    setFormData((prev) => ({ ...prev, cep }));
    setCepError("");

    // Remove caracteres não numéricos
    const cleanCep = cep.replace(/\D/g, "");

    // Verifica se o CEP tem 8 dígitos
    if (cleanCep.length !== 8) {
      return;
    }

    // Busca o CEP na API ViaCEP
    setLoadingCep(true);
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
      
      if (!response.ok) {
        throw new Error("Falha na consulta do CEP, tente novamente");
      }

      const data = await response.json();

      if (data.erro) {
        setCepError("CEP não encontrado");
        toast.error("CEP não encontrado");
        return;
      }

      // Preenche os campos automaticamente
      setFormData((prev) => ({
        ...prev,
        street: data.logradouro || prev.street,
        neighborhood: data.bairro || prev.neighborhood,
        city: data.localidade || prev.city,
        state: data.uf || prev.state,
      }));

      toast.success("Endereço preenchido automaticamente");
    } catch (error) {
      setCepError("Falha na consulta do CEP, tente novamente");
      toast.error("Falha na consulta do CEP, tente novamente");
    } finally {
      setLoadingCep(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl px-4 sm:px-0">
      {/* Header */}
      <div className="flex items-start sm:items-center gap-3 sm:gap-4 flex-col sm:flex-row">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setLocation("/clients")}
          className="self-start"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Novo Cliente</h1>
          <p className="text-muted-foreground mt-1 text-sm sm:text-base">
            Cadastre um novo cliente no sistema
          </p>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle>Informações do Cliente</CardTitle>
            <CardDescription>
              Preencha os dados do cliente. Campos marcados com * são obrigatórios.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Informações Básicas */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Informações Básicas</h3>
              
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="name">Nome Completo *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => handleChange("name", e.target.value)}
                    placeholder="Digite o nome completo"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleChange("email", e.target.value)}
                    placeholder="email@exemplo.com"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Telefone</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => handleChange("phone", e.target.value)}
                    placeholder="(00) 00000-0000"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="birthDate">Data de Nascimento</Label>
                  <Input
                    id="birthDate"
                    type="text"
                    inputMode="numeric"
                    maxLength={10}
                    value={formData.birthDate}
                    onChange={(e) => handleChange("birthDate", applyDateMask(e.target.value))}
                    placeholder="DD/MM/AAAA"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="instagram">Instagram</Label>
                  <Input
                    id="instagram"
                    value={formData.instagram}
                    onChange={(e) => handleChange("instagram", e.target.value)}
                    placeholder="@usuario"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="gender">Gênero</Label>
                  <Select
                    value={formData.gender}
                    onValueChange={(value) => handleChange("gender", value)}
                  >
                    <SelectTrigger id="gender">
                      <SelectValue placeholder="Selecione o gênero" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Homem">Homem</SelectItem>
                      <SelectItem value="Mulher">Mulher</SelectItem>
                      <SelectItem value="Outros">Outros</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <Separator />

            {/* Documento */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Documento</h3>
              <div className="grid gap-4 sm:grid-cols-2 sm:col-span-2">
                <div className="space-y-2 sm:col-span-2">
                  <Label>Tipo de Documento</Label>
                  <div className="flex gap-2 flex-col sm:flex-row">
                    <button
                      type="button"
                      onClick={() => setFormData((prev) => ({ ...prev, docType: "cpf", docNumber: "" }))}
                      className={`flex-1 py-2 px-3 rounded-md border text-xs sm:text-sm font-medium transition-colors ${
                        formData.docType === "cpf"
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-transparent border-border text-muted-foreground hover:border-primary hover:text-foreground"
                      }`}
                    >
                      CPF (Brasileiro)
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData((prev) => ({ ...prev, docType: "passport", docNumber: "" }))}
                      className={`flex-1 py-2 px-3 rounded-md border text-xs sm:text-sm font-medium transition-colors ${
                        formData.docType === "passport"
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-transparent border-border text-muted-foreground hover:border-primary hover:text-foreground"
                      }`}
                    >
                      Passaporte (Estrangeiro)
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="docNumber">
                    {formData.docType === "cpf" ? "CPF" : "Número do Passaporte"}
                  </Label>
                  <Input
                    id="docNumber"
                    value={formData.docNumber}
                    onChange={(e) => handleDocNumberChange(e.target.value)}
                    placeholder={formData.docType === "cpf" ? "000.000.000-00" : "Ex: AB1234567"}
                    maxLength={formData.docType === "cpf" ? 14 : 20}
                  />
                  {formData.docType === "cpf" && formData.docNumber.replace(/\D/g, "").length > 0 && formData.docNumber.replace(/\D/g, "").length < 11 && (
                    <p className="text-xs text-muted-foreground">Digite os 11 dígitos do CPF</p>
                  )}
                </div>
              </div>
            </div>

            <Separator />

            {/* Endereço */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Endereço</h3>
              
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="cep">CEP</Label>
                  <div className="relative">
                    <Input
                      id="cep"
                      value={formData.cep}
                      onChange={(e) => handleCepChange(e.target.value)}
                      placeholder="00000-000"
                      maxLength={9}
                      className={cepError ? "border-red-500" : ""}
                    />
                    {loadingCep && (
                      <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                    )}
                  </div>
                  {cepError && (
                    <p className="text-sm text-red-500">{cepError}</p>
                  )}
                </div>

                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="street">Logradouro</Label>
                  <Input
                    id="street"
                    value={formData.street}
                    onChange={(e) => handleChange("street", e.target.value)}
                    placeholder="Rua, Avenida, etc."
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="number">Número</Label>
                  <Input
                    id="number"
                    value={formData.number}
                    onChange={(e) => handleChange("number", e.target.value)}
                    placeholder="Número"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="complement">Complemento</Label>
                  <Input
                    id="complement"
                    value={formData.complement}
                    onChange={(e) => handleChange("complement", e.target.value)}
                    placeholder="Apto, Bloco, etc."
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="neighborhood">Bairro</Label>
                  <Input
                    id="neighborhood"
                    value={formData.neighborhood}
                    onChange={(e) => handleChange("neighborhood", e.target.value)}
                    placeholder="Nome do bairro"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="city">Cidade</Label>
                  <Input
                    id="city"
                    value={formData.city}
                    onChange={(e) => handleChange("city", e.target.value)}
                    placeholder="Nome da cidade"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="state">Estado</Label>
                  <Input
                    id="state"
                    value={formData.state}
                    onChange={(e) => handleChange("state", e.target.value)}
                    placeholder="UF"
                    maxLength={2}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="country">País</Label>
                  <Input
                    id="country"
                    value={formData.country}
                    onChange={(e) => handleChange("country", e.target.value)}
                    placeholder="Brasil"
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="reference">Ponto de Referência</Label>
                  <Input
                    id="reference"
                    value={formData.reference}
                    onChange={(e) => handleChange("reference", e.target.value)}
                    placeholder="Próximo ao mercado, em frente à praça, etc."
                  />
                </div>
              </div>
            </div>

            <Separator />

            {/* Envio de Anamnese */}
            <div className="space-y-4">
              <div className="flex items-start space-x-3">
                <Checkbox
                  id="sendAnamnese"
                  checked={sendAnamnese}
                  onCheckedChange={(checked) => setSendAnamnese(checked as boolean)}
                />
                <div className="space-y-1 leading-none">
                  <Label
                    htmlFor="sendAnamnese"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <Send className="h-4 w-4" />
                      Enviar link de anamnese após cadastro
                    </div>
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    O cliente receberá um link para preencher a ficha de anamnese
                  </p>
                </div>
              </div>

              {sendAnamnese && (
                <div className="ml-7 space-y-3 p-4 border rounded-lg bg-muted/30">
                  <Label>Canal de envio</Label>
                  <RadioGroup
                    value={anamneseChannel}
                    onValueChange={(value) => setAnamneseChannel(value as "email" | "whatsapp")}
                    className="flex gap-4"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="whatsapp" id="whatsapp" />
                      <Label htmlFor="whatsapp" className="cursor-pointer font-normal">
                        WhatsApp
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="email" id="email" />
                      <Label htmlFor="email" className="cursor-pointer font-normal">
                        Email
                      </Label>
                    </div>
                  </RadioGroup>
                  
                  {anamneseChannel === "email" && !formData.email && (
                    <p className="text-sm text-amber-600 dark:text-amber-500">
                      ⚠️ Email não informado. Preencha o campo de email acima.
                    </p>
                  )}
                  
                  {anamneseChannel === "whatsapp" && !formData.phone && (
                    <p className="text-sm text-amber-600 dark:text-amber-500">
                      ⚠️ Telefone não informado. Preencha o campo de telefone acima.
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-2 sm:gap-3 pt-4 flex-col-reverse sm:flex-row">
              <Button
                type="button"
                variant="outline"
                onClick={() => setLocation("/clients")}
                disabled={createClient.isPending}
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={createClient.isPending}
                className="flex-1"
              >
                {createClient.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Criando...
                  </>
                ) : (
                  "Criar Cliente"
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
