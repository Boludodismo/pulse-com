import { useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, FileDown, Printer, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import anamneseSchema from "@shared/anamnese.schema.json";

type FieldDef = {
  key: string;
  type: string;
  label: string;
  required?: boolean;
  options?: { value: string; label: string }[];
  conditionalOn?: { key: string; value: string };
};

type StepDef = {
  id: string;
  title: string;
  fields: FieldDef[];
};

// Mapeia value para label legível
function resolveLabel(field: FieldDef, value: any): string {
  if (value === undefined || value === null || value === "") return "—";
  if (field.type === "radio" && field.options) {
    const opt = field.options.find((o) => o.value === value);
    return opt ? opt.label : String(value);
  }
  if (field.type === "checkbox") {
    return value === true ? "Sim — Aceito" : "Não aceito";
  }
  return String(value);
}

// Ícone para respostas Sim/Não
function YesNoIcon({ value }: { value: string }) {
  if (value === "sim") return <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />;
  if (value === "nao") return <XCircle className="h-4 w-4 text-zinc-500 shrink-0" />;
  if (value === "nao_sei") return <AlertCircle className="h-4 w-4 text-yellow-500 shrink-0" />;
  return null;
}

export default function AnamneseView() {
  const params = useParams<{ id: string }>();
  const submissionId = parseInt(params.id || "0");

  // Tenta primeiro como submissão do novo fluxo (payload JSON)
  const { data: submissions, isLoading: loadingSubmissions } =
    trpc.anamnese.getByClientId.useQuery(
      { clientId: 0 },
      { enabled: false } // desabilitado — usamos getById abaixo
    );

  // Busca a submissão pelo ID via anamnesis.getById (fluxo antigo)
  const { data: oldAnamnese, isLoading: loadingOld } = trpc.anamnesis.getById.useQuery(
    { id: submissionId },
    { retry: false }
  );

  const isLoading = loadingOld;

  const formatDate = (date: Date | string | null | undefined) => {
    if (!date) return "—";
    return new Date(date).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-zinc-950 p-8">
        <div className="max-w-4xl mx-auto space-y-4">
          <Skeleton className="h-10 w-48 bg-zinc-800" />
          <Skeleton className="h-96 w-full bg-zinc-800" />
        </div>
      </div>
    );
  }

  // ── Renderização do fluxo ANTIGO (campos fixos) ───────────────────────────
  if (oldAnamnese) {
    return (
      <div className="min-h-screen bg-zinc-950 p-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <Button
              variant="ghost"
              onClick={() => window.close()}
              className="text-zinc-400 hover:text-white"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Fechar
            </Button>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => window.print()}
                className="border-zinc-700 text-zinc-300"
              >
                <Printer className="h-4 w-4 mr-2" />
                Imprimir
              </Button>
              <Button
                onClick={() => window.open(`/anamnese/pdf/${submissionId}`, "_blank")}
                className="bg-orange-500 hover:bg-orange-600 text-white"
              >
                <FileDown className="h-4 w-4 mr-2" />
                Exportar PDF
              </Button>
            </div>
          </div>

          <Card className="border-zinc-800 bg-zinc-900">
            <CardHeader className="border-b border-zinc-800">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-white text-xl">Ficha de Anamnese</CardTitle>
                  <CardDescription className="text-zinc-400 mt-1">
                    Preenchida em {formatDate(oldAnamnese.createdAt)}
                  </CardDescription>
                </div>
                {oldAnamnese.riskLevel && (
                  <Badge
                    className={
                      oldAnamnese.riskLevel === "critical"
                        ? "bg-red-500/20 text-red-400 border-red-500/50"
                        : oldAnamnese.riskLevel === "high"
                        ? "bg-orange-500/20 text-orange-400 border-orange-500/50"
                        : oldAnamnese.riskLevel === "medium"
                        ? "bg-yellow-500/20 text-yellow-400 border-yellow-500/50"
                        : "bg-green-500/20 text-green-400 border-green-500/50"
                    }
                  >
                    {oldAnamnese.riskLevel === "critical"
                      ? "🚨 Risco Crítico"
                      : oldAnamnese.riskLevel === "high"
                      ? "⚠️ Risco Alto"
                      : oldAnamnese.riskLevel === "medium"
                      ? "⚠️ Risco Médio"
                      : "✅ Baixo Risco"}
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              {[
                { label: "Possui alergias?", value: oldAnamnese.hasAllergies ? "Sim" : "Não", detail: oldAnamnese.allergiesDetails },
                { label: "Possui doenças ou condições médicas?", value: oldAnamnese.hasDiseases ? "Sim" : "Não", detail: oldAnamnese.diseasesDetails },
                { label: "Faz uso de medicamentos?", value: oldAnamnese.usesMedication ? "Sim" : "Não", detail: oldAnamnese.medicationDetails },
                { label: "Está grávida?", value: oldAnamnese.isPregnant ? "Sim" : "Não" },
                { label: "Possui tendência a quelóide?", value: oldAnamnese.hasKeloid ? "Sim" : "Não" },
              ].map((item) => (
                <div key={item.label} className="flex flex-col gap-1 py-3 border-b border-zinc-800 last:border-0">
                  <span className="text-zinc-400 text-sm">{item.label}</span>
                  <span className="text-white font-medium">{item.value}</span>
                  {item.detail && (
                    <span className="text-zinc-300 text-sm pl-2 border-l-2 border-orange-500/50">{item.detail}</span>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // ── Sem dados ─────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
      <Card className="max-w-md w-full border-zinc-800 bg-zinc-900">
        <CardContent className="pt-6 text-center">
          <AlertCircle className="h-12 w-12 text-zinc-600 mx-auto mb-3" />
          <p className="text-zinc-400">Ficha de anamnese não encontrada.</p>
          <Button
            variant="ghost"
            onClick={() => window.close()}
            className="mt-4 text-zinc-400"
          >
            Fechar
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Componente para exibir ficha do novo fluxo (payload JSON) ─────────────────
export function AnamneseSubmissionView({ payload, submittedAt }: { payload: Record<string, any>; submittedAt?: string | null }) {
  const steps = anamneseSchema.steps as StepDef[];

  const formatDate = (date: string | null | undefined) => {
    if (!date) return "—";
    return new Date(date).toLocaleDateString("pt-BR", {
      day: "2-digit", month: "long", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  };

  return (
    <div className="space-y-6">
      {submittedAt && (
        <p className="text-zinc-400 text-sm">Preenchida em {formatDate(submittedAt)}</p>
      )}
      {steps.map((step) => {
        // Filtra campos que têm valor preenchido
        const filledFields = step.fields.filter((f) => {
          const val = payload[f.key];
          return val !== undefined && val !== null && val !== "";
        });
        if (filledFields.length === 0) return null;

        return (
          <div key={step.id}>
            <h3 className="text-sm font-semibold text-orange-400 uppercase tracking-wider mb-3 pb-2 border-b border-zinc-800">
              {step.title}
            </h3>
            <div className="space-y-3">
              {filledFields.map((field) => {
                const value = payload[field.key];
                const label = resolveLabel(field, value);
                const isYesNo = field.type === "radio" && field.options?.some((o) => ["sim", "nao", "nao_sei"].includes(o.value));
                const rawValue = typeof value === "string" ? value : "";

                return (
                  <div key={field.key} className="flex flex-col gap-0.5">
                    <span className="text-zinc-500 text-xs">{field.label}</span>
                    <div className="flex items-center gap-2">
                      {isYesNo && <YesNoIcon value={rawValue} />}
                      <span className={`text-sm font-medium ${
                        field.type === "checkbox" && value === true
                          ? "text-green-400"
                          : "text-zinc-200"
                      }`}>
                        {label}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
