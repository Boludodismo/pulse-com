import { useEffect, useMemo } from "react";
import { useRoute } from "wouter";
import { CheckCircle2, Clock3, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import QuotePreview from "@/components/quotes/QuotePreview";
import "@/styles/quotes.css";

function whatsappLink(phone?: string | null, clientName?: string) {
  const digits = (phone || "").replace(/\D/g, "");
  if (!digits) return null;
  const normalized = digits.startsWith("55") ? digits : "55" + digits;
  const message = encodeURIComponent(
    "Olá! Estou falando sobre minha proposta" + (clientName ? " para " + clientName : "") + ".",
  );
  return "https://wa.me/" + normalized + "?text=" + message;
}

export default function PublicProposal() {
  const [, params] = useRoute("/proposta/:token");
  const token = params?.token || "";
  const valid = /^[a-f0-9]{48}$/.test(token);
  const query = trpc.quotes.public.get.useQuery({ token }, { enabled: valid, retry: false });
  const viewed = trpc.quotes.public.markViewed.useMutation();
  const accept = trpc.quotes.public.accept.useMutation({
    onSuccess: () => {
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
    return whatsappLink(
      payload.studio.phone,
      payload.client.name,
    );
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
          quoteNumber=""
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
            onClick={() => accept.mutate({ token })}
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
      </div>

      <footer className="proposal-public-legal">
        Este link é individual e acompanha a validade registrada na proposta.
      </footer>
    </main>
  );
}
