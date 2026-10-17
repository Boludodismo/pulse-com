import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { statusLabel, MINOR_CONSENT_TERMS } from "@shared/minorConsent";

export function downloadConsentFile(file: {
  data: string;
  mime: string;
  name: string;
}) {
  const bytes = Uint8Array.from(atob(file.data), c => c.charCodeAt(0));
  const url = URL.createObjectURL(new Blob([bytes], { type: file.mime }));
  const a = document.createElement("a");
  a.href = url;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
export async function consentFileInput(file: File) {
  if (file.size > 5 * 1024 * 1024)
    throw new Error("Cada arquivo deve ter até 5 MB.");
  return {
    name: file.name,
    data: await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(",")[1]);
      reader.onerror = () =>
        reject(new Error("Não foi possível ler o arquivo."));
      reader.readAsDataURL(file);
    }),
  };
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
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
      />
    </div>
  );
}
function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-start gap-3 text-sm cursor-pointer">
      <Checkbox
        checked={checked}
        onCheckedChange={v => onChange(v === true)}
        className="mt-0.5"
      />
      <span>{label}</span>
    </label>
  );
}

export function MinorConsentComposer({
  clientId,
  onCreated,
}: {
  clientId: number;
  onCreated: (d: {
    link: string;
    anamneseLink: string | null;
    id: number;
  }) => void;
}) {
  const [artistId, setArtistId] = useState("");
  const config = trpc.minorConsent.config.useQuery(
    { clientId, artistId: artistId ? Number(artistId) : undefined },
    { refetchOnWindowFocus: false }
  );
  const [template, setTemplate] = useState<any>(null);
  const [procedure, setProcedure] = useState({
    description: "",
    bodyRegion: "",
    side: "central" as "central" | "direito" | "esquerdo" | "ambos",
    size: "",
    colors: "Preto e cinza",
    plannedDate: new Date().toLocaleDateString("en-CA", {
      timeZone: "America/Sao_Paulo",
    }),
  });
  const [includeAnamnese, setIncludeAnamnese] = useState(true);
  const [legal, setLegal] = useState(false);
  const [notifyArtist, setNotifyArtist] = useState(true);
  const [notifyStudio, setNotifyStudio] = useState(true);
  const [editTerms, setEditTerms] = useState(false);
  useEffect(() => {
    if (config.data) {
      setTemplate(config.data.template);
      setArtistId(String(config.data.artistId || ""));
    }
  }, [config.data]);
  const save = trpc.minorConsent.saveTemplate.useMutation({
    onSuccess: () =>
      toast.success(
        "Modelo salvo. Os documentos já enviados permanecem preservados."
      ),
    onError: e => toast.error(e.message),
  });
  const create = trpc.minorConsent.create.useMutation({
    onSuccess: d => {
      onCreated(d);
      toast.success("Link de autorização criado.");
    },
    onError: e => toast.error(e.message),
  });
  const patch = (key: string, value: any) =>
    setTemplate((s: any) => ({ ...s, [key]: value }));
  if (config.isLoading) return <p>Carregando modelo do estúdio…</p>;
  if (config.error)
    return (
      <p role="alert" className="text-destructive">
        {config.error.message}
      </p>
    );
  if (!template) return null;
  return (
    <div className="space-y-5 border-t pt-4">
      <div>
        <h3 className="font-semibold">Autorização para menor de idade</h3>
        <p className="text-sm text-muted-foreground">
          Revise o modelo e o procedimento antes de gerar o link. Os materiais
          podem ser registrados depois.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label>Artista responsável</Label>
          <select
            className="w-full min-h-10 rounded-md border bg-background p-2 text-sm"
            value={artistId}
            onChange={e => {
              setArtistId(e.target.value);
              const a = config.data?.artists.find(
                a => a.id === Number(e.target.value)
              );
              if (a) patch("professionalName", a.name);
            }}
          >
            <option value="">Selecione</option>
            {config.data?.artists.map(a => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>
        <Field
          label="Nome do estúdio"
          value={template.studioName}
          onChange={v => patch("studioName", v)}
        />
        <Field
          label="Nome completo do profissional"
          value={template.professionalName}
          onChange={v => patch("professionalName", v)}
        />
        <Field
          label="Documento do profissional ou CNPJ"
          value={template.professionalDocument}
          onChange={v => patch("professionalDocument", v)}
        />
        <Field
          label="Contato para dúvidas e dados pessoais"
          value={template.contact}
          onChange={v => patch("contact", v)}
        />
        <Field
          label="Cidade e estado do procedimento"
          value={template.jurisdiction}
          onChange={v => patch("jurisdiction", v)}
        />
      </div>
      <Field
        label="Endereço completo do estúdio"
        value={template.address}
        onChange={v => patch("address", v)}
      />
      <div className="space-y-2">
        <Label>Logo do modelo</Label>
        {template.logo && (
          <img
            src={template.logo}
            alt="Logo do estúdio"
            className="max-h-20 max-w-48 object-contain bg-white rounded p-2"
          />
        )}
        <Input
          type="file"
          accept="image/png,image/jpeg"
          onChange={async e => {
            const f = e.target.files?.[0];
            if (!f) return;
            try {
              if (f.size > 400000)
                throw new Error("Use logo PNG ou JPG de até 400 KB.");
              const data = await consentFileInput(f);
              patch("logo", `data:${f.type};base64,${data.data}`);
            } catch (error) {
              toast.error((error as Error).message);
            }
          }}
        />
        {template.logo && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => patch("logo", "")}
          >
            Remover logo deste modelo
          </Button>
        )}
      </div>
      <Button
        type="button"
        variant="outline"
        onClick={() => setEditTerms(!editTerms)}
      >
        {editTerms ? "Ocultar texto" : "Revisar ou alterar texto do modelo"}
      </Button>
      {editTerms && (
        <div className="space-y-2">
          <Label>Texto do consentimento</Label>
          <Textarea
            rows={12}
            value={template.terms}
            onChange={e => patch("terms", e.target.value)}
          />
          <Button
            type="button"
            variant="ghost"
            onClick={() => patch("terms", MINOR_CONSENT_TERMS)}
          >
            Restaurar texto base
          </Button>
          <p className="text-xs text-muted-foreground">
            Alterações jurídicas devem respeitar o ECA, o CDC e as regras do
            local do atendimento. O sistema registra a versão enviada.
          </p>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={save.isPending || !artistId}
          onClick={() =>
            save.mutate({
              clientId,
              artistId: Number(artistId),
              scope: "artist",
              template,
            })
          }
        >
          Salvar modelo do artista
        </Button>
        {config.data?.canSaveStudio && (
          <Button
            type="button"
            variant="outline"
            disabled={save.isPending || !artistId}
            onClick={() =>
              save.mutate({
                clientId,
                artistId: Number(artistId),
                scope: "studio",
                template,
              })
            }
          >
            Salvar modelo do estúdio
          </Button>
        )}
      </div>
      <div className="space-y-3 border-t pt-4">
        <h4 className="font-medium">Procedimento desta autorização</h4>
        <Field
          label="Desenho e textos que serão tatuados"
          value={procedure.description}
          onChange={v => setProcedure(s => ({ ...s, description: v }))}
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <Field
            label="Região do corpo"
            value={procedure.bodyRegion}
            onChange={v => setProcedure(s => ({ ...s, bodyRegion: v }))}
          />
          <div>
            <Label>Lado</Label>
            <select
              className="w-full min-h-10 rounded border bg-background p-2"
              value={procedure.side}
              onChange={e =>
                setProcedure(s => ({ ...s, side: e.target.value as any }))
              }
            >
              {["central", "direito", "esquerdo", "ambos"].map(v => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </div>
          <Field
            label="Tamanho aproximado em cm"
            value={procedure.size}
            onChange={v => setProcedure(s => ({ ...s, size: v }))}
          />
          <Field
            label="Cores"
            value={procedure.colors}
            onChange={v => setProcedure(s => ({ ...s, colors: v }))}
          />
          <Field
            label="Data prevista"
            type="date"
            value={procedure.plannedDate}
            onChange={v => setProcedure(s => ({ ...s, plannedDate: v }))}
          />
        </div>
      </div>
      <div className="space-y-3">
        <Toggle
          label="Incluir ficha de anamnese no mesmo envio"
          checked={includeAnamnese}
          onChange={setIncludeAnamnese}
        />
        <Toggle
          label="Notificar o artista pelo WhatsApp cadastrado"
          checked={notifyArtist}
          onChange={setNotifyArtist}
        />
        <Toggle
          label="Notificar o estúdio pelo WhatsApp cadastrado"
          checked={notifyStudio}
          onChange={setNotifyStudio}
        />
        <p className="text-xs text-muted-foreground">
          Os avisos dependem de integração WhatsApp ativa e das permissões
          operacionais do artista. O histórico mostra a entrega ou a pendência.
        </p>
        <Toggle
          label="Conferi a admissibilidade pela idade e as exigências legais do estado e município para este procedimento."
          checked={legal}
          onChange={setLegal}
        />
      </div>
      <Button
        type="button"
        className="w-full"
        disabled={!legal || !artistId || create.isPending}
        onClick={() =>
          create.mutate({
            clientId,
            artistId: Number(artistId),
            template,
            procedure,
            includeAnamnese,
            legalReviewDeclared: true,
            notifyArtist,
            notifyStudio,
          })
        }
      >
        {create.isPending ? "Gerando…" : "Gerar link de autorização"}
      </Button>
    </div>
  );
}

const fileLabels: Record<string, string> = {
  minor_document: "Documento do menor",
  minor_document_back: "Verso do documento do menor",
  guardian_document: "Documento do responsável",
  guardian_document_back: "Verso do documento do responsável",
  authority_document: "Comprovação da representação",
  signed_pdf: "PDF assinado externamente",
  signed_simple: "Termo com assinaturas na tela",
  unsigned_pdf: "Documento original para assinatura",
  validation_report: "Relatório de validação",
};
const emptyMaterial = () => ({
  category: "tinta" as
    "tinta" | "cartucho" | "diluente" | "descartavel" | "outro",
  name: "",
  brand: "",
  lot: "",
  expiry: "",
  anvisa: "",
  quantity: "",
});
export function MinorConsentHistory({ clientId }: { clientId: number }) {
  const list = trpc.minorConsent.list.useQuery(
    { clientId },
    { refetchInterval: 15000 }
  );
  const [id, setId] = useState<number | null>(null);
  return (
    <Card className="mb-5">
      <CardHeader>
        <CardTitle>Autorizações para menores</CardTitle>
        <CardDescription>
          Termos, documentos, assinaturas, conferência e registro dos materiais.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {list.isLoading ? (
          <p>Carregando…</p>
        ) : list.error ? (
          <p role="alert">{list.error.message}</p>
        ) : !list.data?.length ? (
          <p className="text-sm text-muted-foreground">
            Use “Enviar link” e selecione a autorização para menor para iniciar.
          </p>
        ) : (
          <div className="space-y-3">
            {list.data.map((r: any) => (
              <div
                key={r.id}
                className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border rounded-lg p-3"
              >
                <div className="min-w-0">
                  <p className="font-medium">
                    Autorização #{r.id} · {statusLabel[r.status] || r.status}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {r.submitted_at
                      ? `Recebida · Backup ${r.backup_revision >= r.revision ? "verificado" : "em processamento"}`
                      : "Link disponível por 7 dias, sujeito a cancelamento"}
                  </p>
                </div>
                <Button variant="outline" onClick={() => setId(r.id)}>
                  Abrir registro
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
      <Dialog open={id !== null} onOpenChange={open => !open && setId(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Registro da autorização #{id}</DialogTitle>
          </DialogHeader>
          {id && <MinorConsentRecord id={id} clientId={clientId} />}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
function MinorConsentRecord({
  id,
  clientId,
}: {
  id: number;
  clientId: number;
}) {
  const utils = trpc.useUtils();
  const detail = trpc.minorConsent.detail.useQuery(
    { id },
    { refetchInterval: 10000 }
  );
  const [materials, setMaterials] = useState<
    ReturnType<typeof emptyMaterial>[]
  >([]);
  const [report, setReport] = useState<File | null>(null);
  const [notes, setNotes] = useState("");
  const [checks, setChecks] = useState({
    identities: false,
    local: false,
    content: false,
    digital: false,
  });
  const [downloadBusy, setDownloadBusy] = useState(false);
  useEffect(() => {
    if (detail.data) setMaterials(detail.data.materials);
  }, [detail.data?.id]);
  const refresh = () => {
    utils.minorConsent.detail.invalidate({ id });
    utils.minorConsent.list.invalidate({ clientId });
  };
  const save = trpc.minorConsent.materials.useMutation({
    onSuccess: () => {
      toast.success("Complemento registrado sem alterar o documento assinado.");
      refresh();
    },
    onError: e => toast.error(e.message),
  });
  const review = trpc.minorConsent.review.useMutation({
    onSuccess: () => {
      toast.success("Conferência registrada.");
      refresh();
    },
    onError: e => toast.error(e.message),
  });
  const retry = trpc.minorConsent.retry.useMutation({
    onSuccess: refresh,
    onError: e => toast.error(e.message),
  });
  const cancel = trpc.minorConsent.cancel.useMutation({
    onSuccess: refresh,
    onError: e => toast.error(e.message),
  });
  const backup = trpc.minorConsent.exportBackup.useMutation({
    onSuccess: downloadConsentFile,
    onError: e => toast.error(e.message),
  });
  const download = async (fileId: string) => {
    try {
      setDownloadBusy(true);
      downloadConsentFile(await utils.minorConsent.file.fetch({ id, fileId }));
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setDownloadBusy(false);
    }
  };
  if (!detail.data)
    return <p>{detail.error?.message || "Carregando registro…"}</p>;
  const d = detail.data;
  return (
    <div className="space-y-5">
      <p>{statusLabel[d.status] || d.status}</p>
      <p className="text-sm text-muted-foreground">
        Backup:{" "}
        {d.backupRevision >= d.revision
          ? "verificado com todos os anexos"
          : "pendente de processamento"}
        . {d.backupError}
      </p>
      {d.status === "pending" && (
        <Button variant="outline" onClick={() => cancel.mutate({ id })}>
          Cancelar link ainda não preenchido
        </Button>
      )}
      <div>
        <h3 className="font-semibold">Procedimento</h3>
        <p className="text-sm">
          {d.procedure.description} · {d.procedure.bodyRegion} ·{" "}
          {d.procedure.side} · {d.procedure.size} · {d.procedure.colors}
        </p>
        <p className="text-sm">
          Responsável profissional: {d.template.professionalName}
        </p>
      </div>
      {d.submission && (
        <div className="text-sm">
          <p>
            Menor: {d.submission.minor.name} · {d.submission.minor.documentType}{" "}
            {d.submission.minor.documentNumber}
          </p>
          <p>
            Responsável: {d.submission.guardian.name} ·{" "}
            {d.submission.guardian.relationship}
          </p>
          <p>
            Modalidade:{" "}
            {d.submission.signatureMode === "external"
              ? "PDF assinado externamente; conferir assinaturas"
              : "assinaturas eletrônicas simples na tela"}
          </p>
        </div>
      )}
      <div className="space-y-2">
        <h3 className="font-semibold">Documentos e anexos privados</h3>
        {d.files.map((f: any) => (
          <Button
            disabled={downloadBusy}
            key={f.id}
            variant="outline"
            className="w-full justify-start h-auto whitespace-normal break-all text-left"
            onClick={() => download(f.id)}
          >
            {fileLabels[f.kind] || f.kind} · {f.name}
          </Button>
        ))}
      </div>
      <div className="space-y-1">
        <h3 className="font-semibold">Notificações WhatsApp</h3>
        {d.notices.map((n: any) => (
          <p key={n.recipient} className="text-sm">
            {n.recipient === "artist" ? "Artista" : "Estúdio"}:{" "}
            {n.deliveryStatus || n.status}
            {n.deliveryError || n.error_text
              ? ` · ${n.deliveryError || n.error_text}`
              : ""}
          </p>
        ))}
        {d.submission && (
          <Button
            variant="outline"
            disabled={retry.isPending}
            onClick={() => retry.mutate({ id })}
          >
            Reprocessar pendências de backup e avisos
          </Button>
        )}
      </div>
      {d.submission && (
        <>
          <div className="space-y-3 border-t pt-4">
            <h3 className="font-semibold">Conferência do profissional</h3>
            <Toggle
              label="Conferi identidade, idade, filiação ou representação e os anexos."
              checked={checks.identities}
              onChange={v => setChecks(s => ({ ...s, identities: v }))}
            />
            <Toggle
              label="Conferi as exigências legais locais para este caso."
              checked={checks.local}
              onChange={v => setChecks(s => ({ ...s, local: v }))}
            />
            <Toggle
              label="Conferi o conteúdo do termo, o procedimento e as manifestações de vontade."
              checked={checks.content}
              onChange={v => setChecks(s => ({ ...s, content: v }))}
            />
            {d.submission.signatureMode === "external" && (
              <>
                <a
                  href="https://validar.iti.gov.br"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline text-sm"
                >
                  Conferir o PDF original no VALIDAR do ITI
                </a>
                <Toggle
                  label="Conferi a integridade, a identidade dos signatários e o resultado do VALIDAR."
                  checked={checks.digital}
                  onChange={v => setChecks(s => ({ ...s, digital: v }))}
                />
                <Label>Relatório PDF da validação</Label>
                <Input
                  type="file"
                  accept="application/pdf"
                  onChange={e => setReport(e.target.files?.[0] || null)}
                />
              </>
            )}
            <Textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Resultado da conferência ou pendência encontrada"
            />
            <div className="flex flex-wrap gap-2">
              {(["approved", "rejected"] as const).map(decision => (
                <Button
                  key={decision}
                  variant={decision === "approved" ? "default" : "outline"}
                  disabled={
                    review.isPending ||
                    !checks.identities ||
                    !checks.local ||
                    !checks.content ||
                    notes.trim().length < 5
                  }
                  onClick={async () => {
                    try {
                      review.mutate({
                        id,
                        decision,
                        identitiesChecked: true,
                        localRulesChecked: true,
                        contentChecked: true,
                        digitalSignaturesChecked: checks.digital,
                        notes,
                        report: report
                          ? await consentFileInput(report)
                          : undefined,
                      });
                    } catch (e) {
                      toast.error((e as Error).message);
                    }
                  }}
                >
                  {decision === "approved"
                    ? "Registrar conferência concluída"
                    : "Registrar pendência"}
                </Button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              A conferência é declarada pelo profissional. O sistema não
              certifica automaticamente a assinatura ou a legalidade do
              procedimento.
            </p>
          </div>
          <div className="space-y-3 border-t pt-4">
            <h3 className="font-semibold">Materiais usados</h3>
            <p className="text-sm text-muted-foreground">
              Complemento técnico com histórico. O PDF assinado será preservado.
            </p>
            {materials.map((m, i) => (
              <div
                key={i}
                className="grid gap-2 sm:grid-cols-2 rounded-lg border p-3"
              >
                <div>
                  <Label>Categoria</Label>
                  <select
                    className="w-full rounded border p-2 bg-background"
                    value={m.category}
                    onChange={e =>
                      setMaterials(s =>
                        s.map((x, j) =>
                          j === i
                            ? { ...x, category: e.target.value as any }
                            : x
                        )
                      )
                    }
                  >
                    {[
                      "tinta",
                      "cartucho",
                      "diluente",
                      "descartavel",
                      "outro",
                    ].map(x => (
                      <option key={x}>{x}</option>
                    ))}
                  </select>
                </div>
                {(
                  [
                    ["name", "Produto"],
                    ["brand", "Marca fabricante"],
                    ["lot", "Lote"],
                    ["expiry", "Validade"],
                    ["anvisa", "Registro Anvisa quando exigível"],
                    ["quantity", "Quantidade"],
                  ] as const
                ).map(([key, label]) => (
                  <Field
                    key={key}
                    label={label}
                    value={m[key]}
                    onChange={v =>
                      setMaterials(s =>
                        s.map((x, j) => (j === i ? { ...x, [key]: v } : x))
                      )
                    }
                  />
                ))}
                <Button
                  variant="ghost"
                  onClick={() => setMaterials(s => s.filter((_, j) => j !== i))}
                >
                  Remover linha
                </Button>
              </div>
            ))}
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={() => setMaterials(s => [...s, emptyMaterial()])}
              >
                Adicionar material
              </Button>
              <Button
                disabled={save.isPending}
                onClick={() => save.mutate({ id, materials })}
              >
                Salvar complemento
              </Button>
            </div>
          </div>
          <Button
            variant="outline"
            disabled={backup.isPending || d.backupRevision < 0}
            onClick={() => backup.mutate({ id })}
          >
            Baixar backup criptografado · administrador
          </Button>
        </>
      )}
      <details>
        <summary className="cursor-pointer text-sm">
          Histórico de registros
        </summary>
        <div className="space-y-1 pt-2">
          {d.events.map((e: any, i: number) => (
            <p key={i} className="text-xs">
              {String(e.created_at)} · {e.action}
              {e.user_id ? ` · usuário ${e.user_id}` : ""}
            </p>
          ))}
        </div>
      </details>
    </div>
  );
}
