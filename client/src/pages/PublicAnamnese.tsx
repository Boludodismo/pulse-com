import { useState, useEffect, useCallback } from "react";
import { useRoute } from "wouter";
import { trpc } from "@/lib/trpc";
import { useSyncToast } from "@/hooks/useSyncToast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, CheckCircle2, ChevronLeft, ChevronRight, AlertCircle, MapPin } from "lucide-react";
import { toast } from "sonner";
import anamneseSchema from "@shared/anamnese.schema.json";

type FieldDef = {
  key: string;
  type: "text" | "textarea" | "radio" | "checkbox" | "cep";
  label: string;
  required?: boolean;
  placeholder?: string;
  options?: { value: string; label: string }[];
  conditionalOn?: { key: string; value: string };
};

type StepDef = {
  id: string;
  title: string;
  fields: FieldDef[];
};

// ─── Date mask helper ────────────────────────────────────────────────────────
// Accepts raw digits (e.g. "29121982") or already-masked ("29/12/1982")
// and always returns "DD/MM/YYYY" format.
function applyDateMask(raw: string): string {
  // Strip everything that is not a digit
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

// Normalise an existing saved value that may lack separators
function normaliseDateValue(value: string): string {
  if (!value) return "";
  // Already masked
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(value)) return value;
  // Raw 8-digit string
  if (/^\d{8}$/.test(value)) return applyDateMask(value);
  // ISO date (YYYY-MM-DD or timestamp)
  const d = new Date(value);
  if (!isNaN(d.getTime())) return d.toLocaleDateString("pt-BR");
  return value;
}

// ─── CEP mask helper ─────────────────────────────────────────────────────────
function applyCepMask(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

export default function PublicAnamnese() {
  const [, params] = useRoute("/anamnese/:token");
  const token = params?.token || "";

  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [attemptedNext, setAttemptedNext] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [cepLoading, setCepLoading] = useState(false);

  const { data, isLoading, error } = trpc.anamnese.getRequestByToken.useQuery(
    { token },
    { enabled: !!token, retry: false }
  );

  const { notifySync } = useSyncToast();

  const submitMutation = trpc.anamnese.submitAnamnese.useMutation({
    onSuccess: () => {
      // setIsCompleted primeiro para desmontar o formulário, depois toast
      // no próximo tick para evitar o erro removeChild durante reconciliação do React
      setIsCompleted(true);
      notifySync("anamnese");
      setTimeout(() => {
        toast.success("Anamnese enviada com sucesso!", {
          description: "Obrigado por preencher. O estúdio receberá suas informações.",
        });
      }, 0);
    },
    onError: (err) => {
      setIsSubmitting(false);
      setTimeout(() => {
        toast.error("Erro ao enviar", { description: err.message });
      }, 0);
    },
  });

  // Pré-preencher dados do cliente ou payload existente em modo edição
  useEffect(() => {
    if (data?.client) {
      const today = new Date();
      const months = [
        "janeiro","fevereiro","março","abril","maio","junho",
        "julho","agosto","setembro","outubro","novembro","dezembro",
      ];
      const dateStr = `${today.getDate()} de ${months[today.getMonth()]} de ${today.getFullYear()}`;

      if (data.isEditing && data.existingPayload) {
        setIsEditMode(true);
        const payload = data.existingPayload as Record<string, any>;
        // Normalise date field in existing payload
        if (payload.client_dob) {
          payload.client_dob = normaliseDateValue(String(payload.client_dob));
        }
        setFormData({
          ...payload,
          consent_date: payload.consent_date || dateStr,
        });
      } else {
        const rawDob = data.client.birthDate
          ? new Date(data.client.birthDate).toLocaleDateString("pt-BR")
          : "";
        setFormData({
          client_name: data.client.name || "",
          client_dob: normaliseDateValue(rawDob),
          client_phone: data.client.phone || "",
          client_email: data.client.email || "",
          consent_date: dateStr,
          client_country: "Brasil",
        });
      }
    }
  }, [data]);

  // ─── CEP auto-fill via ViaCEP ─────────────────────────────────────────────
  const lookupCep = useCallback(async (cep: string) => {
    const digits = cep.replace(/\D/g, "");
    if (digits.length !== 8) return;
    setCepLoading(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      const json = await res.json();
      if (!json.erro) {
        setFormData((prev) => ({
          ...prev,
          client_street: json.logradouro || prev.client_street || "",
          client_neighborhood: json.bairro || prev.client_neighborhood || "",
          client_city: json.localidade || prev.client_city || "",
          client_state: json.uf || prev.client_state || "",
          client_country: "Brasil",
        }));
        toast.success("Endereço preenchido automaticamente!");
      }
    } catch {
      // Silently fail — user can still type manually
    } finally {
      setCepLoading(false);
    }
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950">
        <div className="text-center space-y-4">
          <Loader2 className="h-10 w-10 animate-spin text-orange-500 mx-auto" />
          <p className="text-zinc-400 text-sm">Carregando ficha...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950 p-4">
        <Card className="max-w-md w-full border-zinc-800 bg-zinc-900">
          <CardHeader className="text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-3" />
            <CardTitle className="text-red-400">Link inválido ou expirado</CardTitle>
            <CardDescription className="text-zinc-400">{error.message}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (isCompleted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950 p-4">
        <Card className="max-w-md w-full border-zinc-800 bg-zinc-900 text-center">
          <CardHeader>
            <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <CardTitle className="text-white text-xl">
              {isEditMode ? "Ficha atualizada!" : "Ficha enviada!"}
            </CardTitle>
            <CardDescription className="text-zinc-400 mt-2">
              {isEditMode
                ? "Suas informações foram atualizadas com sucesso. O estúdio já pode visualizar os dados atualizados."
                : "Obrigado por preencher sua ficha de anamnese. O estúdio receberá suas informações com segurança."}
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const steps = anamneseSchema.steps as StepDef[];
  const currentStepData = steps[currentStep];

  const handleFieldChange = (key: string, value: any) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const isFieldVisible = (field: FieldDef): boolean => {
    if (!field.conditionalOn) return true;
    return formData[field.conditionalOn.key] === field.conditionalOn.value;
  };

  const getInvalidFields = (): string[] => {
    return currentStepData.fields
      .filter((f) => f.required && isFieldVisible(f))
      .filter((f) => {
        const value = formData[f.key];
        if (f.type === "checkbox") return value !== true;
        return !value || value === "";
      })
      .map((f) => f.key);
  };

  const canGoNext = () => getInvalidFields().length === 0;

  const handleNext = () => {
    setAttemptedNext(true);
    if (!canGoNext()) {
      toast.error("Campos obrigatórios", {
        description: "Preencha todos os campos obrigatórios antes de continuar.",
      });
      return;
    }
    setAttemptedNext(false);
    setCurrentStep((prev) => prev + 1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handlePrev = () => {
    setAttemptedNext(false);
    setCurrentStep((prev) => prev - 1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSubmit = async () => {
    setAttemptedNext(true);
    if (!canGoNext()) {
      toast.error("Campos obrigatórios", {
        description: "Preencha todos os campos obrigatórios antes de enviar.",
      });
      return;
    }
    setIsSubmitting(true);
    await submitMutation.mutateAsync({
      token,
      payload: formData,
      // null (sem submissão anterior) deve virar undefined para não acionar o modo edição
      submissionId: data?.existingSubmissionId != null ? data.existingSubmissionId : undefined,
    });
  };

  const invalidFields = attemptedNext ? getInvalidFields() : [];

  const inputClass = (key: string) =>
    `bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500 focus:border-orange-500 ${
      invalidFields.includes(key) ? "border-red-500 focus:border-red-500" : ""
    }`;

  const renderField = (field: FieldDef) => {
    if (!isFieldVisible(field)) return null;

    const value = formData[field.key] ?? "";
    const isInvalid = invalidFields.includes(field.key);

    const errorMsg = (
      <p className="text-red-400 text-xs flex items-center gap-1">
        <AlertCircle className="h-3 w-3" /> Campo obrigatório
      </p>
    );

    switch (field.type) {
      // ── Plain text ──────────────────────────────────────────────────────────
      case "text":
        // Special handling for date-of-birth field
        if (field.key === "client_dob") {
          return (
            <div key={field.key} className="space-y-1.5">
              <Label className="text-zinc-300 text-sm">
                {field.label}
                {field.required && <span className="text-orange-400 ml-1">*</span>}
              </Label>
              <Input
                value={value}
                inputMode="numeric"
                maxLength={10}
                placeholder="DD/MM/AAAA"
                onChange={(e) => {
                  const masked = applyDateMask(e.target.value);
                  handleFieldChange(field.key, masked);
                }}
                className={inputClass(field.key)}
              />
              {isInvalid && errorMsg}
            </div>
          );
        }
        return (
          <div key={field.key} className="space-y-1.5">
            <Label className="text-zinc-300 text-sm">
              {field.label}
              {field.required && <span className="text-orange-400 ml-1">*</span>}
            </Label>
            <Input
              value={value}
              onChange={(e) => handleFieldChange(field.key, e.target.value)}
              placeholder={field.placeholder || field.label}
              className={inputClass(field.key)}
            />
            {isInvalid && errorMsg}
          </div>
        );

      // ── CEP with ViaCEP auto-fill ────────────────────────────────────────
      case "cep":
        return (
          <div key={field.key} className="space-y-1.5">
            <Label className="text-zinc-300 text-sm">
              {field.label}
              {field.required && <span className="text-orange-400 ml-1">*</span>}
            </Label>
            <div className="relative">
              <Input
                value={value}
                inputMode="numeric"
                maxLength={9}
                placeholder="00000-000"
                onChange={(e) => {
                  const masked = applyCepMask(e.target.value);
                  handleFieldChange(field.key, masked);
                  // Trigger lookup when 8 digits are complete
                  if (masked.replace(/\D/g, "").length === 8) {
                    lookupCep(masked);
                  }
                }}
                className={`${inputClass(field.key)} pr-10`}
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                {cepLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin text-orange-400" />
                ) : (
                  <MapPin className="h-4 w-4 text-zinc-500" />
                )}
              </div>
            </div>
            {isInvalid && errorMsg}
          </div>
        );

      // ── Textarea ────────────────────────────────────────────────────────────
      case "textarea":
        return (
          <div key={field.key} className="space-y-1.5">
            <Label className="text-zinc-300 text-sm">
              {field.label}
              {field.required && <span className="text-orange-400 ml-1">*</span>}
            </Label>
            <Textarea
              value={value}
              onChange={(e) => handleFieldChange(field.key, e.target.value)}
              placeholder={field.placeholder || field.label}
              rows={3}
              className={`bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500 focus:border-orange-500 resize-none ${
                isInvalid ? "border-red-500 focus:border-red-500" : ""
              }`}
            />
            {isInvalid && errorMsg}
          </div>
        );

      // ── Radio ───────────────────────────────────────────────────────────────
      case "radio":
        return (
          <div key={field.key} className="space-y-2">
            <Label className="text-zinc-300 text-sm">
              {field.label}
              {field.required && <span className="text-orange-400 ml-1">*</span>}
            </Label>
            <RadioGroup
              value={value}
              onValueChange={(val) => handleFieldChange(field.key, val)}
              className="space-y-1"
            >
              {field.options?.map((opt) => (
                <div
                  key={opt.value}
                  className={`flex items-center space-x-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                    value === opt.value
                      ? "border-orange-500 bg-orange-500/10"
                      : "border-zinc-700 bg-zinc-800/50 hover:border-zinc-600"
                  }`}
                  onClick={() => handleFieldChange(field.key, opt.value)}
                >
                  <RadioGroupItem
                    value={opt.value}
                    id={`${field.key}-${opt.value}`}
                    className="border-zinc-500 text-orange-500"
                  />
                  <Label
                    htmlFor={`${field.key}-${opt.value}`}
                    className="font-normal cursor-pointer text-zinc-200"
                  >
                    {opt.label}
                  </Label>
                </div>
              ))}
            </RadioGroup>
            {isInvalid && errorMsg}
          </div>
        );

      // ── Checkbox ────────────────────────────────────────────────────────────
      case "checkbox":
        return (
          <div key={field.key} className="space-y-2">
            <div
              className={`flex items-start space-x-3 rounded-lg border p-4 cursor-pointer transition-colors ${
                value === true
                  ? "border-orange-500 bg-orange-500/10"
                  : isInvalid
                  ? "border-red-500 bg-red-500/5"
                  : "border-zinc-700 bg-zinc-800/50"
              }`}
            >
              <Checkbox
                id={field.key}
                checked={value === true}
                onCheckedChange={(checked) => handleFieldChange(field.key, checked)}
                className="mt-0.5 border-zinc-500 data-[state=checked]:bg-orange-500 data-[state=checked]:border-orange-500"
              />
              <Label
                htmlFor={field.key}
                className="font-normal cursor-pointer leading-relaxed text-zinc-300 text-sm"
              >
                {field.label}
                {field.required && <span className="text-orange-400 ml-1">*</span>}
              </Label>
            </div>
            {isInvalid && (
              <p className="text-red-400 text-xs flex items-center gap-1">
                <AlertCircle className="h-3 w-3" /> Você precisa aceitar os termos para continuar
              </p>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  const progressPercent = Math.round(((currentStep + 1) / steps.length) * 100);

  return (
    <div className="min-h-screen bg-zinc-950 p-4 py-8">
      {/* Header */}
      <div className="max-w-2xl mx-auto mb-6 text-center">
        <h1 className="text-2xl font-bold text-white tracking-tight">
          {anamneseSchema.title}
        </h1>
        <p className="text-zinc-400 text-sm mt-1">{anamneseSchema.subtitle}</p>
        {isEditMode && (
          <div className="mt-3 inline-flex items-center gap-2 bg-orange-500/10 border border-orange-500/30 text-orange-400 text-xs px-3 py-1.5 rounded-full">
            <span className="h-1.5 w-1.5 rounded-full bg-orange-400 animate-pulse" />
            Modo Edição — seus dados estão pré-preenchidos. Corrija o que precisar e envie novamente.
          </div>
        )}
      </div>

      <div className="max-w-2xl mx-auto">
        {/* Progress bar */}
        <div className="mb-4">
          <div className="flex justify-between text-xs text-zinc-500 mb-1.5">
            <span>Etapa {currentStep + 1} de {steps.length}</span>
            <span>{progressPercent}% concluído</span>
          </div>
          <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-orange-500 rounded-full transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <div className="flex gap-1 mt-2">
            {steps.map((step, idx) => (
              <div
                key={step.id}
                className={`flex-1 h-1 rounded-full transition-colors ${
                  idx < currentStep
                    ? "bg-orange-500"
                    : idx === currentStep
                    ? "bg-orange-400"
                    : "bg-zinc-800"
                }`}
              />
            ))}
          </div>
        </div>

        <Card className="border-zinc-800 bg-zinc-900 shadow-xl">
          <CardHeader className="pb-4 border-b border-zinc-800">
            <CardTitle className="text-white text-lg">{currentStepData.title}</CardTitle>
            <CardDescription className="text-zinc-400 text-sm">
              {currentStep === steps.length - 1
                ? "Leia atentamente e confirme o termo abaixo para enviar sua ficha."
                : "Preencha os campos abaixo. Campos marcados com * são obrigatórios."}
            </CardDescription>
          </CardHeader>

          <CardContent className="pt-6 space-y-5">
            {currentStepData.fields.map(renderField)}

            <div className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-0 sm:justify-between pt-4 border-t border-zinc-800">
              <Button
                variant="outline"
                onClick={handlePrev}
                disabled={currentStep === 0 || isSubmitting}
                className="border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-white text-xs sm:text-sm"
              >
                <ChevronLeft className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                Anterior
              </Button>

              {currentStep < steps.length - 1 ? (
                <Button
                  onClick={handleNext}
                  disabled={isSubmitting}
                  className="bg-orange-500 hover:bg-orange-600 text-white text-xs sm:text-sm"
                >
                  Próximo
                  <ChevronRight className="h-3 w-3 sm:h-4 sm:w-4 ml-1" />
                </Button>
              ) : (
                <Button
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className="bg-orange-500 hover:bg-orange-600 text-white text-xs sm:text-sm w-full sm:w-auto"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-3 w-3 sm:h-4 sm:w-4 mr-2 animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    "Enviar Ficha"
                  )}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        <p className="text-center text-zinc-600 text-xs mt-4">
          Suas informações são protegidas e utilizadas apenas pelo estúdio.
        </p>
      </div>
    </div>
  );
}
