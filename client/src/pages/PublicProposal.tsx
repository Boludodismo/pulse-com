import { useEffect, useMemo, useState } from "react";
import { useRoute } from "wouter";
import { CheckCircle2, Clock3, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import QuotePreview from "@/components/quotes/QuotePreview";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { parsePhoneNumberFromString } from "libphonenumber-js";
import "@/styles/quotes.css";

function whatsappLink(phone: string | null | undefined, clientName: string, quoteNumber: string, question = false) {
  const parsed = parsePhoneNumberFromString(phone || "", "BR");
  if (!parsed?.isPossible()) return null;
  const normalized = parsed.number.replace(/\D/g, "");
  const message = encodeURIComponent(
    `Olá! ${question ? "Tenho uma dúvida sobre" : "Gostaria de conversar sobre"} a proposta ${quoteNumber} para ${clientName}.\n${window.location.origin}${window.location.pathname}`,
  );
  return "https://wa.me/" + normalized + "?text=" + message;
}

export default function PublicProposal() {
  const [confirming, setConfirming] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [, params] = useRoute("/proposta/:token");
  const token = params?.token || "";
  const valid = /^[a-f0-9]{48}$/.test(token);
  const query = trpc.quotes.public.get.useQuery({ token }, { enabled: valid, retry: false });
  const viewed = trpc.quotes.public.markViewed.useMutation();
  const accept = trpc.quotes.public.accept.useMutation({
    onSuccess: () => {
      setConfirming(false); setAgreed(false);
      toast.success("Proposta aceita. O estúdio poderá acompanhar essa confirmação.");
      query.refetch();
    },
    onError: (error) => toast.error(error.message),
  });

  useEffect(() => {
    if (valid && query.data && !query.data.viewedAt && !viewed.isPending) {
      viewed.mutate({ token });
    }
  }, [valid, query.data, token]);

  const whatsapp = useMemo(() => {
    const payload = query.data?.payload;
    if (!payload) return null;
    const phone = payload.editor.contactSource === "artist" ? payload.artist.phone : payload.studio.phone;
    return whatsappLink(phone, payload.client.name, query.data!.quoteNumber);
  }, [query.data]);
  const questionLink = useMemo(() => {
    const payload = query.data?.payload;
    if (!payload) return null;
    return whatsappLink(payload.editor.contactSource === "artist" ? payload.artist.phone : payload.studio.phone, payload.client.name, query.data!.quoteNumber, true);
  }, [query.data]);

  if (valid && query.isLoading) {
    return (
      <main className="proposal-public-shell">
        <div className="proposal-public-message" role="status">
          <Clock3 className="h-6 w-6" />
          <h1>Carregando sua proposta…</h1>
        </div>
      </main>
    );
  }

  if (!valid || !query.data) {
    return (
      <main className="proposal-public-shell">
        <div className="proposal-public-message">
          <h1>Proposta indisponível</h1>
          <p>O link pode estar incorreto, cancelado ou não ter sido publicado.</p>
        </div>
      </main>
    );
  }

  const { payload } = query.data;
  const accepted = query.data.status === "approved" || Boolean(query.data.acceptedAt);
  const validUntilLabel = new Date(String(query.data.validUntil).replace(" ", "T")).toLocaleDateString("pt-BR");

  return (
    <main className="proposal-public-shell">
      <header className="proposal-public-header">
        <div>
          <span className="proposal-public-eyebrow">Proposta profissional</span>
          <strong>{payload.artist.name}</strong>
        </div>
        <div className="proposal-public-meta">
          <span>{query.data.expired ? "Prazo encerrado" : "Válida até " + validUntilLabel}</span>
        </div>
      </header>

      {accepted && (
        <div className="proposal-status-card proposal-status-approved">
          <CheckCircle2 className="h-5 w-5" />
          <div>
            <strong>Proposta aceita</strong>
            <span>Obrigado. O estúdio já pode visualizar sua confirmação.</span>
          </div>
        </div>
      )}

      {query.data.expired && !accepted && (
        <div className="proposal-status-card proposal-status-expired">
          <Clock3 className="h-5 w-5" />
          <div>
            <strong>Validade encerrada</strong>
            <span>Entre em contato com o estúdio para receber uma proposta atualizada.</span>
          </div>
        </div>
      )}

      <section className="proposal-public-document" aria-label="Proposta de tatuagem">
        <QuotePreview
          editor={payload.editor}
          identity={{
            client: payload.client,
            artist: payload.artist,
            studio: payload.studio,
            personalLogoUrl: payload.branding.personalLogoUrl,
          }}
          quoteNumber={query.data.quoteNumber}
          createdDate={String(query.data.createdDate)}
          validUntil={String(query.data.validUntil)}
          artistCardUrl={query.data.artistCardPath}
        />
      </section>

      <div className="proposal-public-actions">
        {!accepted && !query.data.expired && (
          <button
            type="button"
            className="proposal-action-primary"
            disabled={accept.isPending}
            onClick={() => { setAgreed(false); setConfirming(true); }}
          >
            <CheckCircle2 className="h-5 w-5" />
            {accept.isPending ? "Confirmando…" : "Aceitar proposta"}
          </button>
        )}
        {whatsapp && (
          <a className="proposal-action-secondary" href={whatsapp} target="_blank" rel="noreferrer">
            <MessageCircle className="h-5 w-5" />
            Falar no WhatsApp
          </a>
        )}
        {questionLink && <a className="proposal-action-secondary" href={questionLink} target="_blank" rel="noreferrer"><MessageCircle className="h-5 w-5" />Tirar uma dúvida</a>}
      </div>
      <Dialog open={confirming} onOpenChange={setConfirming}><DialogContent className="max-h-[90dvh] overflow-auto"><DialogTitle>Confirmar aceite da proposta</DialogTitle><p>{query.data.quoteNumber} · {payload.editor.project.title}</p>{payload.editor.additionalProjects.map(p => <p key={p.id}>{p.project.title}</p>)}<strong>{new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(query.data.totalAmount / 100)}</strong>{payload.editor.pricing.showDeposit && payload.editor.pricing.depositAmount > 0 && <p>Sinal: {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(payload.editor.pricing.depositAmount / 100)}</p>}{[payload.editor.pricing.installmentText, payload.editor.pricing.showDeposit && payload.editor.pricing.showDepositText ? payload.editor.pricing.depositText : "", payload.editor.pricing.showInstallmentInfo ? payload.editor.pricing.installmentInfo : "", payload.editor.terms].filter(Boolean).map((text, i) => <p key={i} className="whitespace-pre-wrap text-sm">{text}</p>)}<label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)} />Li e concordo com os projetos, valores e condições desta proposta.</label><p className="text-xs text-muted-foreground">O aceite não registra pagamento nem reserva automaticamente um horário.</p><button type="button" className="proposal-action-primary" disabled={!agreed || accept.isPending} onClick={() => accept.mutate({ token })}>{accept.isPending ? "Confirmando…" : "Confirmar aceite"}</button></DialogContent></Dialog>

      <footer className="proposal-public-legal">
        Este link é individual e acompanha a validade registrada na proposta.
      </footer>
    </main>
  );
}
