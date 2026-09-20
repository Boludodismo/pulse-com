import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { useIsMobile } from "@/hooks/useMobile";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ArrowLeft, CheckCircle2, Copy, ExternalLink, Eye, FileText, Image as ImageIcon, Plus, Save, Search, Share2, Trash2, Upload } from "lucide-react";
import { DEFAULT_CONCEPT_PRESETS, DEFAULT_TERMS_PRESETS, buildEmptyQuoteEditorData, type QuoteEditorData, type QuoteMedia, type QuoteStoredPayload } from "@shared/quoteProposal";
import QuotePreview, { type QuotePreviewIdentity } from "@/components/quotes/QuotePreview";
import "@/styles/quotes.css";

const STATUS_LABELS: Record<string, string> = {
  draft: "Rascunho", finalized: "Finalizado", sent: "Enviado", approved: "Aprovado",
  rejected: "Recusado", expired: "Expirado", cancelled: "Cancelado",
};

function isoToday() { return new Date().toISOString().slice(0, 10); }
function addDaysIso(days: number) { const d = new Date(); d.setDate(d.getDate() + days); return d.toISOString().slice(0, 10); }
function brlValue(cents: number) {
  if (!cents) return "";
  const whole = Math.trunc(cents / 100);
  const decimals = Math.abs(cents % 100);
  return decimals ? whole + "," + String(decimals).padStart(2, "0") : String(whole);
}
function toCents(value: string) {
  const raw = value.trim().replace(/\s/g, "").replace(/[^\d,.-]/g, "");
  if (!raw) return 0;
  let normalized = raw;
  if (raw.includes(",")) {
    normalized = raw.replace(/\./g, "").replace(",", ".");
  } else if ((raw.match(/\./g) || []).length > 1) {
    normalized = raw.replace(/\./g, "");
  }
  const n = Number(normalized);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : 0;
}
function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Não foi possível ler o arquivo."));
    reader.readAsDataURL(file);
  });
}
function statusClass(status: string) {
  if (status === "approved") return "bg-emerald-500/15 text-emerald-300 border-emerald-500/25";
  if (status === "finalized" || status === "sent") return "bg-blue-500/15 text-blue-300 border-blue-500/25";
  if (status === "rejected" || status === "cancelled") return "bg-red-500/15 text-red-300 border-red-500/25";
  if (status === "expired") return "bg-amber-500/15 text-amber-300 border-amber-500/25";
  return "bg-muted text-muted-foreground border-border";
}
type PresetOption = { id?: number; name: string; content: string };

function PresetPicker(props: {
  title: string; value: string; options: PresetOption[]; disabled?: boolean;
  onChange: (value: string) => void; onSave: (name: string) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  return <div className="space-y-3">
    <Label>{props.title}</Label>
    <div className="grid grid-cols-2 gap-2">
      {props.options.slice(0, 4).map((item) => <button
        key={(item.id || "d") + "-" + item.name}
        type="button" disabled={props.disabled} onClick={() => props.onChange(item.content)}
        className={"rounded-lg border p-3 text-left disabled:opacity-50 " + (props.value === item.content ? "border-primary bg-primary/10" : "border-border bg-card hover:border-primary/50")}
      >
        <span className="text-[10px] uppercase tracking-wide text-primary">Modelo</span>
        <strong className="mt-1 block text-sm">{item.name}</strong>
      </button>)}
    </div>
    <Textarea value={props.value} onChange={(e) => props.onChange(e.target.value)} rows={6} disabled={props.disabled} />
    <div className="flex flex-col gap-2 sm:flex-row">
      <Input value={name} onChange={(e) => setName(e.target.value)} disabled={props.disabled} placeholder="Nome para salvar este texto" />
      <Button type="button" variant="outline" disabled={props.disabled || saving || name.trim().length < 2 || props.value.trim().length < 2}
        onClick={async () => { setSaving(true); try { await props.onSave(name.trim()); setName(""); } finally { setSaving(false); } }}>
        <Save className="mr-2 h-4 w-4" />Salvar como modelo
      </Button>
    </div>
  </div>;
}

function MediaAdjuster(props: {
  label: string; media: QuoteMedia | null; disabled?: boolean; uploading?: boolean;
  onUpload: (file: File) => void; onChange: (patch: Partial<QuoteMedia>) => void;
}) {
  return <div className="rounded-xl border bg-card/40 p-4 space-y-3">
    <div className="flex items-center justify-between gap-3">
      <div><Label>{props.label}</Label><p className="mt-1 text-xs text-muted-foreground">JPG, PNG ou WebP · até 6 MB</p></div>
      <label className="inline-flex min-h-10 cursor-pointer items-center rounded-md border border-input px-3 text-sm font-medium hover:bg-accent">
        <Upload className="mr-2 h-4 w-4" />{props.uploading ? "Enviando…" : props.media ? "Trocar" : "Enviar"}
        <input className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" disabled={props.disabled || props.uploading}
          onChange={(e) => { const f = e.target.files?.[0]; if (f) props.onUpload(f); e.currentTarget.value = ""; }} />
      </label>
    </div>
    {props.media && <>
      <div className="aspect-[4/5] max-h-44 overflow-hidden rounded-lg border bg-black">
        <img src={props.media.url} alt={props.media.alt || props.label} className="h-full w-full object-cover"
          style={{ objectPosition: props.media.x + "% " + props.media.y + "%", transform: "scale(" + props.media.zoom + ")" }} />
      </div>
      <label className="block text-xs">Horizontal · {Math.round(props.media.x)}%
        <input className="mt-1 w-full accent-orange-500" type="range" min={0} max={100} value={props.media.x} disabled={props.disabled} onChange={(e) => props.onChange({ x: Number(e.target.value) })} />
      </label>
      <label className="block text-xs">Vertical · {Math.round(props.media.y)}%
        <input className="mt-1 w-full accent-orange-500" type="range" min={0} max={100} value={props.media.y} disabled={props.disabled} onChange={(e) => props.onChange({ y: Number(e.target.value) })} />
      </label>
      <label className="block text-xs">Zoom · {props.media.zoom.toFixed(1)}x
        <input className="mt-1 w-full accent-orange-500" type="range" min={1} max={3} step={0.1} value={props.media.zoom} disabled={props.disabled} onChange={(e) => props.onChange({ zoom: Number(e.target.value) })} />
      </label>
    </>}
  </div>;
}


function MoneyInput(props: {
  valueCents: number;
  placeholder?: string;
  onCommit: (valueCents: number) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [rawValue, setRawValue] = useState(() => brlValue(props.valueCents));

  useEffect(() => {
    if (document.activeElement !== inputRef.current) {
      setRawValue(brlValue(props.valueCents));
    }
  }, [props.valueCents]);

  const commit = () => {
    const cents = toCents(rawValue);
    props.onCommit(cents);
    setRawValue(brlValue(cents));
  };

  return (
    <div className="money-input-wrap">
      <span className="money-input-prefix">R$</span>
      <input
        ref={inputRef}
        className="money-input-field"
        inputMode="decimal"
        value={rawValue}
        placeholder={props.placeholder}
        onChange={(event) => {
          const next = event.target.value.replace(/[^\d,.-]/g, "");
          setRawValue(next);
        }}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            inputRef.current?.blur();
          }
        }}
      />
    </div>
  );
}

export default function Quotes() {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const utils = trpc.useUtils();
  const [mode, setMode] = useState<"list" | "editor">("list");
  const [mobileTab, setMobileTab] = useState<"edit" | "preview">("edit");
  const [searchTerm, setSearchTerm] = useState("");
  const [clientFilter, setClientFilter] = useState("");
  const [quoteId, setQuoteId] = useState<number | null>(null);
  const [quoteNumber, setQuoteNumber] = useState("RASCUNHO");
  const [quoteStatus, setQuoteStatus] = useState("draft");
  const [publicToken, setPublicToken] = useState<string | null>(null);
  const [createdDate, setCreatedDate] = useState(isoToday());
  const [validUntil, setValidUntil] = useState(addDaysIso(15));
  const [clientId, setClientId] = useState(0);
  const [artistId, setArtistId] = useState(user?.artistId || 0);
  const [editor, setEditor] = useState<QuoteEditorData>(() => buildEmptyQuoteEditorData());
  const [snapshot, setSnapshot] = useState<QuoteStoredPayload | null>(null);
  const [uploadingSlot, setUploadingSlot] = useState<"clientReference" | "suggestedArtwork" | null>(null);
  const brandingAppliedRef = useRef<number | null>(null);

  const quotesQuery = trpc.quotes.list.useQuery();
  const clientsQuery = trpc.clients.list.useQuery({});
  const artistsQuery = trpc.artists.list.useQuery();
  const queryArtistId = artistId || 1;
  const brandingQuery = trpc.quotes.branding.get.useQuery({ artistId: queryArtistId }, { enabled: artistId > 0 });
  const conceptPresetsQuery = trpc.quotes.presets.list.useQuery({ artistId: queryArtistId, category: "concept" }, { enabled: artistId > 0 });
  const termsPresetsQuery = trpc.quotes.presets.list.useQuery({ artistId: queryArtistId, category: "terms" }, { enabled: artistId > 0 });

  const createMutation = trpc.quotes.create.useMutation();
  const updateMutation = trpc.quotes.update.useMutation();
  const finalizeMutation = trpc.quotes.finalize.useMutation();
  const ensurePublicLinkMutation = trpc.quotes.ensurePublicLink.useMutation();
  const deleteMutation = trpc.quotes.deleteDraft.useMutation();
  const uploadMediaMutation = trpc.quotes.uploadMedia.useMutation();
  const savePresetMutation = trpc.quotes.presets.create.useMutation();
  const uploadLogoMutation = trpc.quotes.branding.uploadPersonalLogo.useMutation();
  const saveBrandingMutation = trpc.quotes.branding.saveSettings.useMutation();

  const artists = artistsQuery.data || [];
  const clients = clientsQuery.data || [];

  useEffect(() => {
    if (!artistId && artists.length) {
      const own = user?.artistId && artists.some((a) => a.id === user.artistId) ? user.artistId : artists[0].id;
      setArtistId(own || 0);
    }
  }, [artistId, artists, user?.artistId]);

  useEffect(() => {
    if (mode === "editor" && !quoteId && artistId > 0 && brandingQuery.data && brandingAppliedRef.current !== artistId) {
      brandingAppliedRef.current = artistId;
      setEditor((v) => ({ ...v, logoSource: brandingQuery.data.defaultLogoSource, watermarkOpacity: brandingQuery.data.watermarkOpacity }));
    }
  }, [artistId, brandingQuery.data, mode, quoteId]);

  const currentClient = clients.find((c) => c.id === clientId);
  const currentArtist = artists.find((a) => a.id === artistId);

  const identity = useMemo<QuotePreviewIdentity>(() => {
    if (snapshot) return { client: snapshot.client, artist: snapshot.artist, studio: snapshot.studio, personalLogoUrl: snapshot.branding.personalLogoUrl };
    return {
      client: { name: currentClient?.name || "", email: currentClient?.email || null, phone: currentClient?.phone || null },
      artist: {
        name: currentArtist?.name || user?.name || "", bio: currentArtist?.bio || null, specialty: currentArtist?.specialty || null,
        photoUrl: currentArtist?.photoUrl || null, phone: currentArtist?.phone || null, email: currentArtist?.email || null, instagram: currentArtist?.instagram || null,
      },
      studio: { name: brandingQuery.data?.studioName || user?.studioName || null, logoUrl: brandingQuery.data?.studioLogoUrl || null },
      personalLogoUrl: brandingQuery.data?.personalLogoUrl || null,
    };
  }, [snapshot, currentClient, currentArtist, user?.name, user?.studioName, brandingQuery.data]);

  function combinePresets(saved: Array<{ id: number; name: string; content: string }> | undefined, defaults: readonly PresetOption[]) {
    const all: PresetOption[] = [...(saved || []).map((p) => ({ id: p.id, name: p.name, content: p.content })), ...defaults.map((p) => ({ name: p.name, content: p.content }))];
    return all.filter((p, i) => all.findIndex((x) => x.name === p.name) === i).slice(0, 4);
  }
  const conceptOptions = useMemo(() => combinePresets(conceptPresetsQuery.data, DEFAULT_CONCEPT_PRESETS), [conceptPresetsQuery.data]);
  const termsOptions = useMemo(() => combinePresets(termsPresetsQuery.data, DEFAULT_TERMS_PRESETS), [termsPresetsQuery.data]);

  const filteredQuotes = (quotesQuery.data || []).filter((q) => {
    const text = [q.quoteNumber, q.parsedPayload?.client.name, q.parsedPayload?.artist.name, q.parsedPayload?.editor.project.title].filter(Boolean).join(" ").toLowerCase();
    return text.includes(searchTerm.trim().toLowerCase());
  });
  const filteredClients = clients.filter((c) => {
    if (!clientFilter.trim()) return true;
    const t = clientFilter.toLowerCase();
    return [c.name, c.phone, c.email].filter(Boolean).join(" ").toLowerCase().includes(t);
  });
  const locked = quoteStatus !== "draft";
  const saving = createMutation.isPending || updateMutation.isPending;

  function resetEditor() {
    const preferred = user?.artistId && artists.some((a) => a.id === user.artistId) ? user.artistId : (artists[0]?.id || 0);
    setQuoteId(null); setQuoteNumber("RASCUNHO"); setQuoteStatus("draft"); setPublicToken(null); setCreatedDate(isoToday()); setValidUntil(addDaysIso(15));
    setClientId(0); setArtistId(preferred); setEditor(buildEmptyQuoteEditorData()); setSnapshot(null); setClientFilter(""); setMobileTab("edit");
    brandingAppliedRef.current = null; setMode("editor");
  }

  function loadQuote(row: NonNullable<typeof quotesQuery.data>[number]) {
    if (!row.parsedPayload) { toast.error("Não foi possível ler este orçamento."); return; }
    setQuoteId(row.id); setQuoteNumber(row.quoteNumber); setQuoteStatus(row.status); setPublicToken(row.publicToken || null); setCreatedDate(row.createdDate.slice(0, 10));
    setValidUntil(row.validUntil.slice(0, 10)); setClientId(row.clientId); setArtistId(row.artistId); setEditor(row.parsedPayload.editor);
    setSnapshot(row.parsedPayload); setMobileTab("edit"); setMode("editor");
  }

  async function saveDraft() {
    if (!clientId) { toast.error("Selecione o cliente."); return null; }
    if (!artistId) { toast.error("Selecione o artista responsável."); return null; }
    try {
      if (quoteId) {
        await updateMutation.mutateAsync({ id: quoteId, validUntil, editor });
        await utils.quotes.list.invalidate(); toast.success("Rascunho atualizado."); return quoteId;
      }
      const result = await createMutation.mutateAsync({ clientId, artistId, validUntil, editor });
      setQuoteId(result.id); setQuoteNumber(result.quoteNumber); setQuoteStatus(result.status);
      await utils.quotes.list.invalidate(); toast.success("Orçamento salvo como rascunho."); return result.id;
    } catch (e) { toast.error(e instanceof Error ? e.message : "Não foi possível salvar."); return null; }
  }

  async function finalizeQuote() {
    const id = await saveDraft(); if (!id) return;
    try { const result = await finalizeMutation.mutateAsync({ id }); setQuoteStatus("finalized"); setPublicToken(result.publicToken); await utils.quotes.list.invalidate(); toast.success("Proposta finalizada. O link individual já está pronto para envio."); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Não foi possível finalizar."); }
  }

  async function removeDraft() {
    if (!quoteId || quoteStatus !== "draft" || !window.confirm("Excluir este rascunho?")) return;
    try { await deleteMutation.mutateAsync({ id: quoteId }); await utils.quotes.list.invalidate(); setMode("list"); toast.success("Rascunho excluído."); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Não foi possível excluir."); }
  }

  async function uploadMedia(slot: "clientReference" | "suggestedArtwork", file: File) {
    if (!artistId) { toast.error("Selecione o artista."); return; }
    if (file.size > 6 * 1024 * 1024) { toast.error("A imagem deve ter no máximo 6 MB."); return; }
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) { toast.error("Use JPG, PNG ou WebP."); return; }
    setUploadingSlot(slot);
    try {
      const result = await uploadMediaMutation.mutateAsync({ artistId, fileName: file.name, imageBase64: await fileToDataUrl(file), mimeType: file.type as "image/jpeg" | "image/png" | "image/webp" });
      setEditor((v) => ({ ...v, media: { ...v.media, [slot]: result } })); setSnapshot(null); toast.success("Imagem adicionada.");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Falha no envio."); } finally { setUploadingSlot(null); }
  }

  function updateMedia(slot: "clientReference" | "suggestedArtwork", patch: Partial<QuoteMedia>) {
    setEditor((v) => {
      const media = v.media[slot]; if (!media) return v;
      return { ...v, media: { ...v.media, [slot]: { ...media, ...patch } } };
    });
    setSnapshot(null);
  }

  async function savePreset(category: "concept" | "terms", name: string, value: string) {
    if (!artistId) return;
    try { await savePresetMutation.mutateAsync({ artistId, category, name, content: value, scope: "artist" }); await utils.quotes.presets.list.invalidate(); toast.success("Modelo salvo."); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Não foi possível salvar o modelo."); }
  }

  async function uploadLogo(file: File) {
    if (!artistId) return;
    if (file.type !== "image/png") { toast.error("A logo pessoal deve ser PNG."); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error("A logo deve ter no máximo 5 MB."); return; }
    try {
      await uploadLogoMutation.mutateAsync({ artistId, fileName: file.name, imageBase64: await fileToDataUrl(file), mimeType: "image/png" });
      await utils.quotes.branding.get.invalidate({ artistId }); setEditor((v) => ({ ...v, logoSource: "personal" })); setSnapshot(null); toast.success("Logo pessoal salva.");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Não foi possível salvar a logo."); }
  }

  async function saveBranding() {
    if (!artistId) return;
    try { await saveBrandingMutation.mutateAsync({ artistId, defaultLogoSource: editor.logoSource, watermarkOpacity: editor.watermarkOpacity }); await utils.quotes.branding.get.invalidate({ artistId }); toast.success("Identidade salva como padrão."); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Não foi possível salvar a identidade."); }
  }

  const proposalUrl = publicToken && typeof window !== "undefined"
    ? window.location.origin + "/proposta/" + publicToken
    : "";

  async function ensureProposalLink() {
    if (!quoteId) return;
    try {
      const result = await ensurePublicLinkMutation.mutateAsync({ id: quoteId });
      setPublicToken(result.publicToken);
      await utils.quotes.list.invalidate();
      toast.success("Link da proposta criado.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível criar o link.");
    }
  }

  async function copyProposalLink() {
    if (!proposalUrl) return;
    try {
      await navigator.clipboard.writeText(proposalUrl);
      toast.success("Link copiado.");
    } catch {
      toast.error("Não foi possível copiar o link automaticamente.");
    }
  }

  async function shareProposalLink() {
    if (!proposalUrl) return;
    const title = "Proposta " + quoteNumber;
    const text = "Olá! Segue sua proposta personalizada.";
    try {
      if (navigator.share) {
        await navigator.share({ title, text, url: proposalUrl });
      } else {
        await navigator.clipboard.writeText(proposalUrl);
        toast.success("Link copiado para você compartilhar.");
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      toast.error("Não foi possível compartilhar o link.");
    }
  }


  function showPreview() {
    setMobileTab("preview");
    window.setTimeout(() => {
      document.querySelector(".quote-preview-stage")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 0);
  }

  function renderActionButtons(location: "top" | "bottom") {
    return (
      <div className="quote-editor-actions">
        {location === "top" && quoteStatus === "draft" && quoteId && (
          <Button variant="outline" onClick={removeDraft}>
            <Trash2 className="mr-2 h-4 w-4" />
            Excluir
          </Button>
        )}

        {quoteStatus === "draft" && (
          <Button variant="outline" onClick={() => void saveDraft()} disabled={saving}>
            <Save className="mr-2 h-4 w-4" />
            Salvar
          </Button>
        )}

        <Button variant="secondary" onClick={showPreview}>
          <Eye className="mr-2 h-4 w-4" />
          Visualizar
        </Button>

        {quoteStatus === "draft" && (
          <Button onClick={() => void finalizeQuote()} disabled={saving || finalizeMutation.isPending}>
            <CheckCircle2 className="mr-2 h-4 w-4" />
            Finalizar e criar link
          </Button>
        )}

        {quoteStatus !== "draft" && !publicToken && (
          <Button onClick={() => void ensureProposalLink()} disabled={ensurePublicLinkMutation.isPending}>
            <ExternalLink className="mr-2 h-4 w-4" />
            Criar link
          </Button>
        )}

        {publicToken && (
          <Button variant="outline" onClick={() => void copyProposalLink()}>
            <Copy className="mr-2 h-4 w-4" />
            Copiar link
          </Button>
        )}

        {publicToken && (
          <Button onClick={() => void shareProposalLink()}>
            <Share2 className="mr-2 h-4 w-4" />
            Compartilhar
          </Button>
        )}

        {publicToken && (
          <Button
            variant="secondary"
            onClick={() => window.open(proposalUrl, "_blank", "noopener,noreferrer")}
          >
            <ExternalLink className="mr-2 h-4 w-4" />
            Abrir proposta
          </Button>
        )}
      </div>
    );
  }

  if (mode === "list") return <div className="space-y-5">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div><h1 className="text-2xl font-bold">Orçamentos</h1><p className="mt-1 text-sm text-muted-foreground">Propostas verticais, com identidade do artista e link individual para o cliente.</p></div>
      <Button onClick={resetEditor}><Plus className="mr-2 h-4 w-4" />Novo orçamento</Button>
    </div>
    <div className="relative max-w-xl"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input className="pl-9" placeholder="Buscar por número, cliente, artista ou projeto" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
    </div>
    {quotesQuery.isLoading ? <div className="rounded-xl border p-8 text-center text-muted-foreground">Carregando…</div> :
      filteredQuotes.length === 0 ? <div className="rounded-xl border border-dashed p-10 text-center"><FileText className="mx-auto h-9 w-9 text-primary" /><h2 className="mt-3 font-semibold">Nenhum orçamento encontrado</h2><Button className="mt-4" onClick={resetEditor}><Plus className="mr-2 h-4 w-4" />Criar orçamento</Button></div> :
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{filteredQuotes.map((q) => <button key={q.id} type="button" onClick={() => loadQuote(q)} className="rounded-xl border bg-card p-4 text-left transition hover:border-primary/50">
        <div className="flex items-start justify-between gap-3"><div><span className="text-xs font-semibold uppercase text-primary">{q.quoteNumber}</span><h2 className="mt-1 font-semibold">{q.parsedPayload?.client.name || "Cliente"}</h2></div><span className={"rounded-full border px-2 py-1 text-[11px] " + statusClass(q.status)}>{q.acceptedAt ? "Aceita" : q.viewedAt ? "Visualizada" : (STATUS_LABELS[q.status] || q.status)}</span></div>
        <p className="mt-3 truncate text-sm text-muted-foreground">{q.parsedPayload?.editor.project.title || "Projeto de tatuagem"}</p>
        <div className="mt-4 flex items-end justify-between"><span className="text-xs text-muted-foreground">{q.parsedPayload?.artist.name || "Artista"}</span><strong className="text-primary">{new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(q.totalAmount / 100)}</strong></div>
      </button>)}</div>}
  </div>;

  const editorVisible = !isMobile || mobileTab === "edit";
  const previewVisible = !isMobile || mobileTab === "preview";

  return <>
    <div className="quote-screen-only space-y-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex items-center gap-3"><Button variant="outline" size="icon" onClick={() => setMode("list")}><ArrowLeft className="h-4 w-4" /></Button>
          <div><div className="flex flex-wrap items-center gap-2"><h1 className="text-xl font-bold">Editor de orçamento</h1><span className={"rounded-full border px-2 py-1 text-[11px] " + statusClass(quoteStatus)}>{STATUS_LABELS[quoteStatus] || quoteStatus}</span></div><p className="mt-1 text-sm text-muted-foreground">{quoteNumber} · vertical 9:16 · smartphone + link</p></div>
        </div>
        {renderActionButtons("top")}
      </div>
      {locked && <div className="rounded-lg border border-blue-500/20 bg-blue-500/10 px-4 py-3 text-sm text-blue-100">Proposta finalizada: conteúdo bloqueado para preservar exatamente a versão compartilhada com o cliente.</div>}
      {isMobile && <div className="grid grid-cols-2 rounded-lg border bg-card p-1"><button type="button" onClick={() => setMobileTab("edit")} className={"rounded-md px-3 py-2 text-sm " + (mobileTab === "edit" ? "bg-primary text-primary-foreground" : "")}>Editar</button><button type="button" onClick={() => setMobileTab("preview")} className={"rounded-md px-3 py-2 text-sm " + (mobileTab === "preview" ? "bg-primary text-primary-foreground" : "")}>Visualizar</button></div>}

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)]">
        {editorVisible && <div className="min-w-0 space-y-5">
          <fieldset disabled={locked} className="min-w-0 space-y-5 disabled:opacity-80">
          <section className="rounded-xl border bg-card p-4 sm:p-5 space-y-4">
            <h2 className="font-semibold">1. Cliente e identificação</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2"><Label>Buscar cliente</Label><Input value={clientFilter} onChange={(e) => setClientFilter(e.target.value)} disabled={Boolean(quoteId)} placeholder="Nome, telefone ou e-mail" />
                <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={clientId || ""} disabled={Boolean(quoteId)} onChange={(e) => { setClientId(Number(e.target.value)); setSnapshot(null); }}><option value="">Selecione o cliente</option>{filteredClients.slice(0, 120).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
              <div className="space-y-2"><Label>Artista</Label><select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={artistId || ""} disabled={Boolean(quoteId) || Boolean(user?.artistId)} onChange={(e) => { setArtistId(Number(e.target.value)); setSnapshot(null); brandingAppliedRef.current = null; }}><option value="">Selecione</option>{artists.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></div>
              <div className="space-y-2"><Label>Validade</Label><Input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} /></div>
              <div className="space-y-2"><Label>Data de criação</Label><Input value={createdDate.split("-").reverse().join("/")} readOnly /></div>
              <div className="space-y-2"><Label>Número</Label><Input value={quoteNumber} readOnly /></div>
            </div>
          </section>

          <section className="rounded-xl border bg-card p-4 sm:p-5 space-y-4">
            <h2 className="font-semibold">2. Projeto</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2"><Label>Título</Label><Input value={editor.project.title} onChange={(e) => setEditor((v) => ({ ...v, project: { ...v.project, title: e.target.value } }))} /></div>
              <div className="space-y-2"><Label>Estilo</Label><Input value={editor.project.style} placeholder="Realismo preto e cinza" onChange={(e) => setEditor((v) => ({ ...v, project: { ...v.project, style: e.target.value } }))} /></div>
              <div className="space-y-2"><Label>Região</Label><Input value={editor.project.bodyRegion} placeholder="Antebraço esquerdo" onChange={(e) => setEditor((v) => ({ ...v, project: { ...v.project, bodyRegion: e.target.value } }))} /></div>
              <div className="space-y-2"><Label>Tamanho</Label><Input value={editor.project.sizeText} placeholder="aproximadamente 18 cm" onChange={(e) => setEditor((v) => ({ ...v, project: { ...v.project, sizeText: e.target.value } }))} /></div>
              <div className="space-y-2"><Label>Tempo estimado</Label><Input value={editor.project.durationText} placeholder="4 a 5 horas" onChange={(e) => setEditor((v) => ({ ...v, project: { ...v.project, durationText: e.target.value } }))} /></div>
              <div className="space-y-2"><Label>Sessões</Label><Input type="number" min={1} max={30} value={editor.project.sessions} onChange={(e) => setEditor((v) => ({ ...v, project: { ...v.project, sessions: Math.max(1, Number(e.target.value) || 1) } }))} /></div>
            </div>
          </section>

          <section className="rounded-xl border bg-card p-4 sm:p-5 space-y-4">
            <div className="flex items-center gap-2"><ImageIcon className="h-4 w-4 text-primary" /><h2 className="font-semibold">3. Imagens e capa</h2></div>
            <div className="grid gap-4 sm:grid-cols-2">
              <MediaAdjuster label="Referência do cliente" media={editor.media.clientReference} uploading={uploadingSlot === "clientReference"} onUpload={(f) => void uploadMedia("clientReference", f)} onChange={(p) => updateMedia("clientReference", p)} />
              <MediaAdjuster label="Arte sugerida" media={editor.media.suggestedArtwork} uploading={uploadingSlot === "suggestedArtwork"} onUpload={(f) => void uploadMedia("suggestedArtwork", f)} onChange={(p) => updateMedia("suggestedArtwork", p)} />
            </div>
            <div className="space-y-2"><Label>Imagem principal da capa</Label><div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setEditor((v) => ({ ...v, media: { ...v.media, coverSource: "reference" } }))} className={"rounded-lg border p-3 text-sm " + (editor.media.coverSource === "reference" ? "border-primary bg-primary/10" : "border-border")}>Referência</button>
              <button type="button" onClick={() => setEditor((v) => ({ ...v, media: { ...v.media, coverSource: "suggested" } }))} className={"rounded-lg border p-3 text-sm " + (editor.media.coverSource === "suggested" ? "border-primary bg-primary/10" : "border-border")}>Arte sugerida</button>
            </div></div>
          </section>

          <section className="rounded-xl border bg-card p-4 sm:p-5"><PresetPicker title="4. Conceito artístico" value={editor.project.concept} options={conceptOptions} onChange={(concept) => setEditor((v) => ({ ...v, project: { ...v.project, concept } }))} onSave={(name) => savePreset("concept", name, editor.project.concept)} /></section>

          <section className="rounded-xl border bg-card p-4 sm:p-5 space-y-4">
            <h2 className="font-semibold">5. Investimento</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2"><Label>Descrição</Label><Input value={editor.pricing.mainLabel} onChange={(e) => setEditor((v) => ({ ...v, pricing: { ...v.pricing, mainLabel: e.target.value } }))} /></div>
              <div className="space-y-2">
                <Label>Valor total</Label>
                <MoneyInput
                  valueCents={editor.pricing.totalAmount}
                  placeholder="1800"
                  onCommit={(totalAmount) => setEditor((v) => ({ ...v, pricing: { ...v.pricing, totalAmount } }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Sinal</Label>
                <MoneyInput
                  valueCents={editor.pricing.depositAmount}
                  placeholder="500"
                  onCommit={(depositAmount) => setEditor((v) => ({ ...v, pricing: { ...v.pricing, depositAmount } }))}
                />
              </div>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={editor.pricing.showDeposit} onChange={(e) => setEditor((v) => ({ ...v, pricing: { ...v.pricing, showDeposit: e.target.checked } }))} />Mostrar sinal e saldo</label>
              <div className="space-y-2"><Label>Parcelamento</Label><Input value={editor.pricing.installmentText} placeholder="até 3x no cartão" onChange={(e) => setEditor((v) => ({ ...v, pricing: { ...v.pricing, installmentText: e.target.value } }))} /></div>
            </div>
          </section>

          <section className="rounded-xl border bg-card p-4 sm:p-5"><PresetPicker title="6. Condições e observações" value={editor.terms} options={termsOptions} onChange={(terms) => setEditor((v) => ({ ...v, terms }))} onSave={(name) => savePreset("terms", name, editor.terms)} /></section>

          <section className="rounded-xl border bg-card p-4 sm:p-5 space-y-4">
            <h2 className="font-semibold">7. Identidade do documento</h2>
            <div className="grid gap-2 sm:grid-cols-3">{(["personal", "studio", "none"] as const).map((source) => <button key={source} type="button" disabled={source === "personal" && !brandingQuery.data?.personalLogoUrl} onClick={() => { setEditor((v) => ({ ...v, logoSource: source })); setSnapshot(null); }} className={"rounded-lg border p-3 text-sm disabled:opacity-40 " + (editor.logoSource === source ? "border-primary bg-primary/10" : "border-border")}>{source === "personal" ? "Logo pessoal" : source === "studio" ? "Logo do estúdio" : "Sem logo"}</button>)}</div>
            <div className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">{brandingQuery.data?.personalLogoUrl ? <img src={brandingQuery.data.personalLogoUrl} alt="Logo pessoal" className="h-12 w-20 object-contain" /> : <div className="grid h-12 w-20 place-items-center rounded border border-dashed text-xs text-muted-foreground">PNG</div>}<div><strong className="text-sm">Logo pessoal</strong><p className="text-xs text-muted-foreground">Fica salva para novos orçamentos</p></div></div>
              <label className="inline-flex min-h-10 cursor-pointer items-center rounded-md border border-input px-3 text-sm font-medium hover:bg-accent"><Upload className="mr-2 h-4 w-4" />{uploadLogoMutation.isPending ? "Enviando…" : "Enviar PNG"}<input className="sr-only" type="file" accept="image/png" onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadLogo(f); e.currentTarget.value = ""; }} /></label>
            </div>
            <div className="space-y-2"><Label>Opacidade da marca d’água · {editor.watermarkOpacity}%</Label><input className="w-full accent-orange-500" type="range" min={20} max={100} value={editor.watermarkOpacity} onChange={(e) => setEditor((v) => ({ ...v, watermarkOpacity: Number(e.target.value) }))} /></div>
            <Button type="button" variant="outline" onClick={() => void saveBranding()}><Save className="mr-2 h-4 w-4" />Salvar identidade como padrão</Button>
          </section>
          </fieldset>

          <section className="quote-editor-bottom-actions">
            <div className="quote-editor-bottom-actions-title">Ações da proposta</div>
            {renderActionButtons("bottom")}
          </section>
        </div>}

        {previewVisible && <aside className="min-w-0 lg:sticky lg:top-20"><div className="mb-2 flex items-center gap-2 text-sm font-medium"><Eye className="h-4 w-4 text-primary" />Pré-visualização da proposta</div><div className="quote-preview-stage"><QuotePreview editor={editor} identity={identity} quoteNumber={quoteNumber} createdDate={createdDate} validUntil={validUntil} /></div></aside>}
      </div>
    </div>

  </>;
}
