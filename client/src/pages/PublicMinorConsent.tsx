import { useEffect, useRef, useState } from "react";
import { useRoute } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  consentFileInput,
  downloadConsentFile,
} from "@/components/MinorConsentPanel";
import {
  submissionSchema,
  personSchema,
  validateSubmission,
  ageAtDate,
  validCpf,
} from "@shared/minorConsent";
import { toast } from "sonner";

export function ConsentSignaturePad({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const moved = useRef(false);
  useEffect(() => {
    const c = canvas.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, c.width, c.height);
    if (value) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0, c.width, c.height);
      img.src = value;
    }
  }, [value]);
  const point = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const c = e.currentTarget;
    const r = c.getBoundingClientRect();
    return [
      ((e.clientX - r.left) * c.width) / r.width,
      ((e.clientY - r.top) * c.height) / r.height,
    ];
  };
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <canvas
        ref={canvas}
        width={1000}
        height={250}
        aria-label={label}
        className="w-full h-36 rounded-lg border border-slate-400 bg-white touch-none"
        onPointerDown={e => {
          const ctx = e.currentTarget.getContext("2d");
          if (!ctx) return;
          e.currentTarget.setPointerCapture(e.pointerId);
          drawing.current = true;
          moved.current = false;
          const [x, y] = point(e);
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.strokeStyle = "#111827";
          ctx.lineWidth = 3.2;
          ctx.lineCap = "round";
        }}
        onPointerMove={e => {
          if (!drawing.current) return;
          const [x, y] = point(e);
          const ctx = e.currentTarget.getContext("2d");
          ctx?.lineTo(x, y);
          ctx?.stroke();
          moved.current = true;
        }}
        onPointerUp={e => {
          drawing.current = false;
          if (moved.current) onChange(e.currentTarget.toDataURL("image/png"));
        }}
        onPointerCancel={() => {
          drawing.current = false;
        }}
      />
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-slate-600">
          Assine com o dedo ou mouse. Esta é uma assinatura eletrônica simples.
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onChange("")}
        >
          Limpar
        </Button>
      </div>
    </div>
  );
}
function Field({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      <Input
        required
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
      />
    </div>
  );
}
function Choice({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: [string, string][];
}) {
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      <select
        className="w-full min-h-11 rounded-md border bg-white p-2 text-sm"
        value={value}
        onChange={e => onChange(e.target.value)}
      >
        <option value="">Selecione</option>
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </div>
  );
}
const documentOptions: [string, string][] = [
  ["CPF", "CPF"],
  ["CIN", "Carteira de Identidade Nacional"],
  ["RG", "RG"],
  ["passaporte", "Passaporte"],
];
export default function PublicMinorConsent() {
  const [, params] = useRoute("/autorizacao/:token");
  const token = params?.token || "";
  const query = trpc.minorConsent.publicGet.useQuery(
    { token },
    { retry: false, enabled: !!token, refetchOnWindowFocus: true }
  );
  const [step, setStep] = useState(0);
  const [received, setReceived] = useState(false);
  const [busy, setBusy] = useState(false);
  const sending = useRef(false);
  const [uploading, setUploading] = useState("");
  const initialized = useRef(false);
  const [sameAddress, setSameAddress] = useState(true);
  const [minor, setMinor] = useState({
    name: "",
    birthDate: "",
    documentType: "CPF",
    documentNumber: "",
    sex: "",
    address: "",
  });
  const [guardian, setGuardian] = useState({
    name: "",
    documentType: "CPF",
    documentNumber: "",
    relationship: "mae",
    address: "",
    phone: "",
  });
  const [signatureMode, setSignatureMode] = useState<"simple" | "external">(
    "simple"
  );
  const [minorSignature, setMinorSignature] = useState("");
  const [guardianSignature, setGuardianSignature] = useState("");
  const [consent, setConsent] = useState(false);
  const [assent, setAssent] = useState(false);
  const [authorityDeclaration, setAuthority] = useState(false);
  const [privacyAcknowledged, setPrivacy] = useState(false);
  const [files, setFiles] = useState<Record<string, string>>({});
  const [preparedFingerprint, setPreparedFingerprint] = useState("");
  const submit = trpc.minorConsent.submit.useMutation();
  const prepare = trpc.minorConsent.prepare.useMutation();
  const upload = trpc.minorConsent.publicUpload.useMutation();
  const data = query.data as any;
  useEffect(() => {
    if (data?.client && !initialized.current) {
      initialized.current = true;
      setMinor(s => ({ ...s, ...data.client }));
      setFiles(
        Object.fromEntries((data.files || []).map((f: any) => [f.kind, f.name]))
      );
    }
  }, [data]);
  const rawSubmission = () => ({
    minor,
    guardian: {
      ...guardian,
      address: sameAddress ? minor.address : guardian.address,
    },
    signatureMode,
    minorSignature,
    guardianSignature: signatureMode === "simple" ? guardianSignature : "",
    consent,
    assent,
    authorityDeclaration,
    privacyAcknowledged,
  });
  const validated = () => {
    const parsed = submissionSchema.safeParse(rawSubmission());
    if (!parsed.success)
      throw new Error(
        "Complete os dados, as assinaturas e todas as confirmações antes de continuar."
      );
    validateSubmission(parsed.data, data.procedure.plannedDate);
    return parsed.data;
  };
  const next = () => {
    try {
      if (step === 0) {
        const parsed = personSchema.safeParse(minor);
        if (!parsed.success)
          throw new Error(
            "Complete os dados do menor, incluindo nascimento e documento."
          );
        const age = ageAtDate(minor.birthDate, data.procedure.plannedDate);
        if (age >= 18)
          throw new Error(
            "Esta autorização é específica para menores na data do procedimento. Avise o estúdio."
          );
        if (
          !guardian.name.trim() ||
          !guardian.phone.trim() ||
          !guardian.documentNumber.trim()
        )
          throw new Error("Complete os dados do responsável.");
        for (const p of [minor, guardian])
          if (
            ["CPF", "CIN"].includes(p.documentType) &&
            !validCpf(p.documentNumber)
          )
            throw new Error(
              "Confira o CPF/CIN informado: os dígitos não conferem."
            );
      }
      if (step === 1) {
        if (!files.minor_document || !files.guardian_document)
          throw new Error("Anexe o documento do menor e do responsável.");
        if (
          ["tutor", "guardiao_judicial"].includes(guardian.relationship) &&
          !files.authority_document
        )
          throw new Error("Anexe a comprovação da representação legal.");
        if (data.anamneseLink && !data.anamneseCompleted)
          throw new Error(
            "Conclua a anamnese vinculada e atualize o status para continuar."
          );
      }
      if (step === 2) validated();
      setStep(s => Math.min(s + 1, 3));
    } catch (e) {
      toast.error((e as Error).message);
    }
  };
  const chooseFile = async (kind: string, file?: File) => {
    if (!file) return;
    setUploading(kind);
    try {
      await upload.mutateAsync({
        token,
        kind: kind as any,
        file: await consentFileInput(file),
      });
      setFiles(s => ({ ...s, [kind]: file.name }));
      if (kind !== "signed_pdf") setPreparedFingerprint("");
      toast.success("Arquivo recebido com segurança.");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploading("");
    }
  };
  const send = async () => {
    if (sending.current) return;
    sending.current = true;
    setBusy(true);
    try {
      await submit.mutateAsync({ token, submission: validated() });
      setReceived(true);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      sending.current = false;
      setBusy(false);
    }
  };
  if (query.isLoading)
    return (
      <main className="min-h-screen grid place-items-center bg-slate-50 text-slate-900">
        Carregando autorização…
      </main>
    );
  if (query.error)
    return (
      <main className="min-h-screen grid place-items-center bg-slate-50 text-slate-900 p-6">
        <Card className="max-w-lg">
          <CardHeader>
            <CardTitle>Não foi possível abrir a autorização</CardTitle>
          </CardHeader>
          <CardContent>
            <p>{query.error.message}</p>
          </CardContent>
        </Card>
      </main>
    );
  if (!data) return null;
  if (received || data.received)
    return (
      <main className="min-h-screen grid place-items-center bg-slate-50 text-slate-900 p-5">
        <Card className="max-w-xl">
          <CardHeader>
            <CardTitle>Autorização recebida</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p>
              O documento e os anexos foram enviados ao sistema. Registro #
              {data.id}.
            </p>
            <p>
              O profissional conferirá as identidades, a autorização e as
              assinaturas antes de concluir a análise.
            </p>
            <p className="text-sm text-slate-600">
              O backup e os avisos internos são processados em seguida. O
              recebimento da ficha não confirma a realização do procedimento.
            </p>
          </CardContent>
        </Card>
      </main>
    );
  const t = data.template,
    p = data.procedure;
  const UploadField = ({
    kind,
    label,
    required = false,
  }: {
    kind: string;
    label: string;
    required?: boolean;
  }) => (
    <div className="space-y-2">
      <Label>
        {label}
        {required ? " *" : ""}
      </Label>
      <Input
        type="file"
        accept={
          kind === "signed_pdf"
            ? "application/pdf"
            : "image/jpeg,image/png,application/pdf"
        }
        disabled={!!uploading || busy}
        onChange={e => chooseFile(kind, e.target.files?.[0])}
      />
      <p className="text-xs text-slate-600">
        {uploading === kind
          ? "Enviando…"
          : files[kind]
            ? `Recebido: ${files[kind]}`
            : "JPG, PNG ou PDF. Até 5 MB por arquivo."}
      </p>
    </div>
  );
  const Confirm = ({
    label,
    value,
    onChange,
  }: {
    label: string;
    value: boolean;
    onChange: (v: boolean) => void;
  }) => (
    <label className="flex gap-3 items-start cursor-pointer text-sm">
      <Checkbox
        className="mt-0.5"
        checked={value}
        onCheckedChange={v => onChange(v === true)}
      />
      <span>{label}</span>
    </label>
  );
  return (
    <main className="min-h-screen min-w-0 overflow-x-hidden bg-slate-50 text-slate-900 px-3 py-4 sm:px-4 sm:py-9">
      <div className="mx-auto w-full min-w-0 max-w-3xl space-y-5">
        <header className="flex min-w-0 flex-col items-start gap-3 sm:flex-row sm:items-center sm:gap-4">
          {t.logo && (
            <img
              src={t.logo}
              className="h-14 w-14 shrink-0 object-contain sm:h-16 sm:w-16"
              alt={`Logo ${t.studioName}`}
            />
          )}
          <div className="min-w-0 w-full [overflow-wrap:anywhere]">
            <p className="text-sm font-medium">{t.studioName}</p>
            <h1 className="text-xl sm:text-2xl font-bold">
              Autorização para menor de idade
            </h1>
            <p className="text-sm text-slate-600">
              Profissional: {t.professionalName}
            </p>
          </div>
        </header>
        <nav className="grid min-w-0 grid-cols-2 gap-2 text-xs sm:grid-cols-4" aria-label="Etapas da autorização">
          {[
            "Identificação",
            "Documentos",
            "Consentimento",
            "Revisão e envio",
          ].map((label, i) => (
            <div
              key={label}
              className={`min-w-0 rounded-md px-2 py-2.5 text-center leading-snug [overflow-wrap:anywhere] sm:px-3 ${i === step ? "bg-slate-900 text-white" : "bg-slate-200"}`}
              aria-current={i === step ? "step" : undefined}
            >
              {i + 1}. {label}
            </div>
          ))}
        </nav>
        <Card className="min-w-0 bg-white text-slate-900">
          <CardHeader className="min-w-0">
            <CardTitle className="break-words text-lg sm:text-xl">
              {
                [
                  "Dados do menor e do responsável",
                  "Anamnese e documentos de identificação",
                  "Leitura e assinaturas",
                  "Revise antes de enviar",
                ][step]
              }
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {step === 0 && (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field
                    label="Nome completo do menor"
                    value={minor.name}
                    onChange={v => setMinor(s => ({ ...s, name: v }))}
                  />
                  <Field
                    label="Nascimento do menor"
                    type="date"
                    value={minor.birthDate}
                    onChange={v => setMinor(s => ({ ...s, birthDate: v }))}
                  />
                  <Choice
                    label="Documento do menor"
                    value={minor.documentType}
                    onChange={v => setMinor(s => ({ ...s, documentType: v }))}
                    options={documentOptions}
                  />
                  <Field
                    label="Número do documento"
                    value={minor.documentNumber}
                    onChange={v => setMinor(s => ({ ...s, documentNumber: v }))}
                  />
                  <Choice
                    label="Sexo para cadastro"
                    value={minor.sex}
                    onChange={v => setMinor(s => ({ ...s, sex: v }))}
                    options={[
                      ["feminino", "Feminino"],
                      ["masculino", "Masculino"],
                      ["intersexo", "Intersexo"],
                      ["outro", "Outro"],
                    ]}
                  />
                </div>
                <Field
                  label="Endereço completo do menor"
                  value={minor.address}
                  onChange={v => setMinor(s => ({ ...s, address: v }))}
                />
                <h3 className="font-semibold border-t pt-4">
                  Responsável legal
                </h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field
                    label="Nome completo do responsável"
                    value={guardian.name}
                    onChange={v => setGuardian(s => ({ ...s, name: v }))}
                  />
                  <Choice
                    label="Vínculo com o menor"
                    value={guardian.relationship}
                    onChange={v =>
                      setGuardian(s => ({ ...s, relationship: v }))
                    }
                    options={[
                      ["mae", "Mãe"],
                      ["pai", "Pai"],
                      ["tutor", "Tutor"],
                      ["guardiao_judicial", "Guardião judicial"],
                    ]}
                  />
                  <Choice
                    label="Documento do responsável"
                    value={guardian.documentType}
                    onChange={v =>
                      setGuardian(s => ({ ...s, documentType: v }))
                    }
                    options={documentOptions}
                  />
                  <Field
                    label="Número do documento do responsável"
                    value={guardian.documentNumber}
                    onChange={v =>
                      setGuardian(s => ({ ...s, documentNumber: v }))
                    }
                  />
                  <Field
                    label="Telefone do responsável"
                    value={guardian.phone}
                    onChange={v => setGuardian(s => ({ ...s, phone: v }))}
                  />
                </div>
                <Confirm
                  label="O responsável reside no mesmo endereço do menor."
                  value={sameAddress}
                  onChange={setSameAddress}
                />
                {!sameAddress && (
                  <Field
                    label="Endereço completo do responsável"
                    value={guardian.address}
                    onChange={v => setGuardian(s => ({ ...s, address: v }))}
                  />
                )}
              </>
            )}
            {step === 1 && (
              <>
                {data.anamneseLink && (
                  <div className="space-y-2">
                    <h3 className="font-semibold">Anamnese vinculada</h3>
                    <p className="text-sm">
                      {data.anamneseCompleted
                        ? "Anamnese recebida pelo sistema."
                        : "Preencha também as informações de saúde antes de enviar esta autorização."}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Button asChild>
                        <a
                          href={data.anamneseLink}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {data.anamneseCompleted
                            ? "Consultar anamnese"
                            : "Preencher anamnese"}
                        </a>
                      </Button>
                      <Button variant="outline" onClick={() => query.refetch()}>
                        Atualizar status
                      </Button>
                    </div>
                  </div>
                )}
                <p className="text-sm text-slate-600">
                  Envie imagens legíveis. Inclua o verso quando necessário para
                  ler a identidade ou a filiação. Os anexos ficam restritos ao
                  atendimento no sistema.
                </p>
                <p className="text-sm text-slate-600">
                  {t.professionalName}, em {t.address}, usará os documentos para
                  identificar o menor e seu responsável, registrar o
                  consentimento e atender às obrigações legais. O acesso será
                  restrito ao atendimento. Para exercer direitos sobre seus
                  dados, entre em contato por {t.contact}. Leia o consentimento
                  completo na próxima etapa antes de assinar e enviar a ficha.
                </p>
                <UploadField
                  kind="minor_document"
                  label="Documento do menor com identificação e filiação"
                  required
                />
                <UploadField
                  kind="minor_document_back"
                  label="Verso do documento do menor"
                />
                <UploadField
                  kind="guardian_document"
                  label="Documento do responsável legal"
                  required
                />
                <UploadField
                  kind="guardian_document_back"
                  label="Verso do documento do responsável"
                />
                {["tutor", "guardiao_judicial"].includes(
                  guardian.relationship
                ) && (
                  <UploadField
                    kind="authority_document"
                    label="Documento judicial de tutela ou guarda"
                    required
                  />
                )}
              </>
            )}
            {step === 2 && (
              <>
                <div>
                  <h3 className="font-semibold">
                    Tatuagem descrita pelo profissional
                  </h3>
                  <p className="text-sm whitespace-pre-wrap">{p.description}</p>
                  <p className="text-sm">
                    {p.bodyRegion} · {p.side} · {p.size} · {p.colors} ·{" "}
                    {p.plannedDate.split("-").reverse().join("/")}
                  </p>
                  <p className="text-sm text-slate-600 mt-2">
                    Se alguma informação estiver incorreta, peça a correção ao
                    estúdio antes de assinar.
                  </p>
                </div>
                <div className="space-y-4 text-sm leading-relaxed">
                  {t.terms
                    .split(/\n\s*\n/)
                    .map((paragraph: string, i: number) => (
                      <p key={i}>{paragraph}</p>
                    ))}
                </div>
                <div className="space-y-3">
                  <Confirm
                    label="O responsável leu, compreendeu os esclarecimentos e autoriza exclusivamente o procedimento descrito."
                    value={consent}
                    onChange={setConsent}
                  />
                  <Confirm
                    label="O menor compreendeu os esclarecimentos e manifesta sua vontade livre de realizar o procedimento."
                    value={assent}
                    onChange={setAssent}
                  />
                  <Confirm
                    label="O responsável declara exercer legitimamente a responsabilidade indicada, sem impedimento ou restrição judicial para este ato."
                    value={authorityDeclaration}
                    onChange={setAuthority}
                  />
                  <Confirm
                    label="Li as informações sobre guarda dos dados e anexos, evidências da assinatura e meus direitos de privacidade."
                    value={privacyAcknowledged}
                    onChange={setPrivacy}
                  />
                </div>
                <ConsentSignaturePad
                  label="Assentimento do menor"
                  value={minorSignature}
                  onChange={setMinorSignature}
                />
                <Choice
                  label="Assinatura do responsável"
                  value={signatureMode}
                  onChange={v => setSignatureMode(v as any)}
                  options={[
                    ["simple", "Assinar na tela"],
                    [
                      "external",
                      "Devolver PDF assinado com gov.br ou ICP-Brasil",
                    ],
                  ]}
                />
                {signatureMode === "simple" ? (
                  <ConsentSignaturePad
                    label="Assinatura do responsável legal"
                    value={guardianSignature}
                    onChange={setGuardianSignature}
                  />
                ) : (
                  <div className="space-y-3">
                    <p className="text-sm">
                      Baixe o PDF depois de conferir os dados. O responsável
                      deverá assiná-lo no portal gov.br ou com certificado
                      ICP-Brasil e enviar o arquivo original assinado abaixo. O
                      assentimento do menor já estará no PDF. O profissional
                      conferirá o conteúdo e a assinatura.
                    </p>
                    <Button
                      disabled={prepare.isPending || !!uploading}
                      onClick={async () => {
                        try {
                          const s = validated();
                          const doc = await prepare.mutateAsync({
                            token,
                            submission: s,
                          });
                          downloadConsentFile(doc);
                          setPreparedFingerprint(JSON.stringify(s));
                          toast.success(
                            "PDF preparado. Preserve este arquivo ao assinar."
                          );
                        } catch (e) {
                          toast.error((e as Error).message);
                        }
                      }}
                    >
                      {prepare.isPending
                        ? "Preparando…"
                        : "Baixar PDF para assinatura digital"}
                    </Button>
                    <a
                      className="block underline text-sm"
                      href="https://assinador.iti.br"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Abrir portal oficial de assinatura gov.br
                    </a>
                    <UploadField
                      kind="signed_pdf"
                      label="PDF original assinado pelo responsável"
                      required
                    />
                    {preparedFingerprint && (
                      <p className="text-xs text-slate-600">
                        Se alterar dados ou anexos após preparar, gere e assine
                        um novo PDF.
                      </p>
                    )}
                  </div>
                )}
              </>
            )}
            {step === 3 && (
              <div className="space-y-4">
                <p>
                  <strong>Menor:</strong> {minor.name}
                </p>
                <p>
                  <strong>Responsável:</strong> {guardian.name} ·{" "}
                  {guardian.relationship}
                </p>
                <p>
                  <strong>Procedimento:</strong> {p.description} ·{" "}
                  {p.bodyRegion} · {p.size}
                </p>
                <p>
                  <strong>Assinatura do responsável:</strong>{" "}
                  {signatureMode === "external"
                    ? "PDF assinado externamente, sujeito à conferência"
                    : "Assinatura eletrônica simples na tela"}
                </p>
                <p>
                  <strong>Anexos:</strong> {Object.values(files).join(", ")}
                </p>
                <p className="text-sm text-slate-600">
                  O envio preserva os dados e encerra a edição deste link. O
                  profissional receberá a ficha e os documentos para
                  conferência. O recebimento não equivale a autorização legal
                  automática nem confirma que o procedimento foi realizado.
                </p>
              </div>
            )}
            <div className="flex justify-between gap-3 border-t pt-4">
              <Button
                variant="outline"
                disabled={step === 0 || busy || !!uploading}
                onClick={() => setStep(s => s - 1)}
              >
                Voltar
              </Button>
              {step < 3 ? (
                <Button disabled={!!uploading || busy} onClick={next}>
                  Continuar
                </Button>
              ) : (
                <Button disabled={busy || !!uploading} onClick={send}>
                  {busy ? "Enviando…" : "Enviar autorização e anexos"}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
        <footer className="text-xs text-slate-600 space-y-1">
          <p>
            {t.studioName} · {t.address}
          </p>
          <p>Contato para dúvidas: {t.contact}</p>
        </footer>
      </div>
    </main>
  );
}
