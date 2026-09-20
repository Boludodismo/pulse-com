import type { QuoteEditorData, QuoteMedia } from "@shared/quoteProposal";

export type QuotePreviewIdentity = {
  client: {
    name: string;
    email?: string | null;
    phone?: string | null;
  };
  artist: {
    name: string;
    bio?: string | null;
    specialty?: string | null;
    photoUrl?: string | null;
    phone?: string | null;
    email?: string | null;
    instagram?: string | null;
  };
  studio: {
    name?: string | null;
    logoUrl?: string | null;
    phone?: string | null;
    email?: string | null;
    instagram?: string | null;
  };
  personalLogoUrl?: string | null;
};

type Props = {
  editor: QuoteEditorData;
  identity: QuotePreviewIdentity;
  quoteNumber: string;
  createdDate: string;
  validUntil: string;
  className?: string;
};

const GLASS_POLYGON = "polygon(80% 9%, 66% 49%, 53% 88%, 33% 56%, 24% 30%)";

function formatCurrency(cents: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format((cents || 0) / 100);
}

function formatDate(value: string) {
  const datePart = value.slice(0, 10);
  const [year, month, day] = datePart.split("-");
  return year && month && day ? `${day}/${month}/${year}` : value;
}

function activeLogo(editor: QuoteEditorData, identity: QuotePreviewIdentity) {
  if (editor.logoSource === "none") return null;
  if (editor.logoSource === "personal") return identity.personalLogoUrl ?? null;
  return identity.studio.logoUrl ?? null;
}

function MediaImage({ media, className = "" }: { media: QuoteMedia | null; className?: string }) {
  if (!media) {
    return (
      <div className={`quote-media-placeholder ${className}`}>
        <span>Imagem do projeto</span>
      </div>
    );
  }
  return (
    <div className={`quote-media-frame ${className}`}>
      <img
        src={media.url}
        alt={media.alt || "Imagem do projeto"}
        style={{
          objectPosition: `${media.x}% ${media.y}%`,
          transform: `scale(${media.zoom})`,
        }}
      />
    </div>
  );
}

function Footer({
  page,
  identity,
  quoteNumber,
  createdDate,
  logoUrl,
}: {
  page: number;
  identity: QuotePreviewIdentity;
  quoteNumber: string;
  createdDate: string;
  logoUrl: string | null;
}) {
  return (
    <footer className={"quote-doc-footer" + (logoUrl ? "" : " quote-doc-footer-no-logo")}>
      {logoUrl && (
        <div className="quote-footer-brand">
          <img src={logoUrl} alt="" />
        </div>
      )}
      <div className="quote-footer-copy">
        <strong>{identity.artist.name || "Artista"}</strong>
        <span>Cliente: {identity.client.name || "—"}</span>
        <small>{quoteNumber || "Rascunho"} · {formatDate(createdDate)}</small>
      </div>
      <div className="quote-footer-page">{String(page).padStart(2, "0")} / 03</div>
    </footer>
  );
}

function CoverPage(props: Props) {
  const { editor, identity, quoteNumber, createdDate, validUntil } = props;
  const cover = editor.media.coverSource === "suggested"
    ? editor.media.suggestedArtwork
    : editor.media.clientReference;
  const logoUrl = activeLogo(editor, identity);

  return (
    <section className="quote-page quote-cover-page" data-quote-page="1">
      <div className="quote-topline">
        <div>
          <b>{identity.artist.name || "ARTISTA"}</b>
          <span>TATTOO ARTIST</span>
        </div>
        <div className="quote-topline-tag">ARTE · HISTÓRIA · IDENTIDADE</div>
      </div>

      <div className="quote-cover-copy">
        <h1>Orçamento</h1>
        <p className="quote-kicker">ARTE QUE PERMANECE</p>
        <div className="quote-client-block">
          <strong>Cliente: {identity.client.name || "Nome do cliente"}</strong>
          <span>Criado em: {formatDate(createdDate)}</span>
          <span>Válido até: {formatDate(validUntil)}</span>
          <span>Nº: {quoteNumber || "RASCUNHO"}</span>
        </div>
      </div>

      <div className="quote-cover-art" aria-label="Imagem da capa">
        <img
          className="quote-cover-reference-base"
          src="/quote-cover-reference.jpg"
          alt=""
          aria-hidden="true"
        />
        <div className="quote-cover-reference-text-mask" aria-hidden="true" />
        <div className="quote-glass-border" style={{ clipPath: GLASS_POLYGON }}>
          <div className="quote-glass-inner" style={{ clipPath: GLASS_POLYGON }}>
            {cover ? (
              <img
                src={cover.url}
                alt={cover.alt || "Referência visual"}
                style={{
                  objectPosition: `${cover.x}% ${cover.y}%`,
                  transform: `scale(${cover.zoom})`,
                }}
              />
            ) : (
              <div className="quote-glass-empty">REFERÊNCIA / ARTE</div>
            )}
            {logoUrl && (
              <img
                className="quote-watermark"
                src={logoUrl}
                alt=""
                style={{ opacity: editor.watermarkOpacity / 100 }}
              />
            )}
          </div>
        </div>
      </div>

      <div className="quote-cover-manifesto">
        <span>MAIS QUE TATUAGENS</span>
        <b>HISTÓRIAS NA PELE</b>
      </div>

      <Footer
        page={1}
        identity={identity}
        quoteNumber={quoteNumber}
        createdDate={createdDate}
        logoUrl={logoUrl}
      />
    </section>
  );
}

function ArtistPage(props: Props) {
  const { editor, identity, quoteNumber, createdDate } = props;
  const logoUrl = activeLogo(editor, identity);
  const specialties = (identity.artist.specialty || editor.project.style || "")
    .split(/[,;\n]/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 5);

  return (
    <section className="quote-page quote-artist-page" data-quote-page="2">
      <div className="quote-topline">
        <div>
          <b>{identity.artist.name || "ARTISTA"}</b>
          <span>TATTOO ARTIST</span>
        </div>
        <div className="quote-topline-tag">DISCIPLINA · ARTE · EVOLUÇÃO</div>
      </div>

      <div className="quote-artist-copy">
        <h2>SOBRE<br />O ARTISTA</h2>
        <div className="quote-accent-line" />
        <p>
          {identity.artist.bio ||
            "A apresentação profissional cadastrada no perfil do artista aparecerá aqui automaticamente."}
        </p>
        <h3>ESPECIALIDADES</h3>
        <ul>
          {(specialties.length ? specialties : ["Projeto autoral", "Direção estética personalizada"]).map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>

      <div className="quote-artist-photo">
        {identity.artist.photoUrl ? (
          <img src={identity.artist.photoUrl} alt={identity.artist.name} />
        ) : (
          <div className="quote-portrait-placeholder">
            <span>FOTO DO ARTISTA</span>
          </div>
        )}
        <div className="quote-photo-gradient" />
      </div>

      <blockquote>
        <span>“</span>
        <p>Arte, técnica e identidade para transformar uma ideia em algo que permanece.</p>
      </blockquote>

      <Footer
        page={2}
        identity={identity}
        quoteNumber={quoteNumber}
        createdDate={createdDate}
        logoUrl={logoUrl}
      />
    </section>
  );
}

function SummaryPage(props: Props) {
  const { editor, identity, quoteNumber, createdDate } = props;
  const logoUrl = activeLogo(editor, identity);
  const balance = Math.max(0, editor.pricing.totalAmount - editor.pricing.depositAmount);
  const contactPhone = identity.artist.phone || identity.studio.phone;
  const contactInstagram = identity.artist.instagram || identity.studio.instagram;
  const contactEmail = identity.artist.email || identity.studio.email;

  return (
    <section className="quote-page quote-summary-page" data-quote-page="3">
      <div className="quote-topline">
        <div>
          <b>{identity.artist.name || "ARTISTA"}</b>
          <span>TATTOO ARTIST</span>
        </div>
        <div className="quote-topline-tag">IDEIAS · PESSOAS · ARTE REAL</div>
      </div>

      <h2>RESUMO DO PROJETO</h2>
      <div className="quote-accent-line" />

      <div className="quote-project-overview">
        <div className="quote-project-image">
          <h4>REFERÊNCIA DO CLIENTE</h4>
          <MediaImage media={editor.media.clientReference} />
        </div>
        <div className="quote-project-image">
          <h4 className="orange">ARTE SUGERIDA</h4>
          <MediaImage media={editor.media.suggestedArtwork} />
        </div>
        <div className="quote-concept">
          <h3>CONCEITO</h3>
          <p>{editor.project.concept || "Descreva o conceito artístico do projeto."}</p>
        </div>
      </div>

      <div className="quote-details">
        <h3>DETALHES DO PROJETO</h3>
        <ul>
          {editor.project.style && <li><b>Estilo:</b> {editor.project.style}</li>}
          {editor.project.bodyRegion && <li><b>Região:</b> {editor.project.bodyRegion}</li>}
          {editor.project.sizeText && <li><b>Tamanho:</b> {editor.project.sizeText}</li>}
          {editor.project.durationText && <li><b>Tempo estimado:</b> {editor.project.durationText}</li>}
          <li><b>Sessões:</b> {editor.project.sessions}</li>
        </ul>
      </div>

      <div className="quote-investment">
        <h3>INVESTIMENTO</h3>
        <div className="quote-money-row">
          <span>{editor.pricing.mainLabel || "Projeto e execução"}</span>
          <b>{formatCurrency(editor.pricing.totalAmount)}</b>
        </div>
        {editor.pricing.showDeposit && editor.pricing.depositAmount > 0 && (
          <>
            <div className="quote-money-row">
              <span>Sinal para reserva</span>
              <b>{formatCurrency(editor.pricing.depositAmount)}</b>
            </div>
            <div className="quote-money-row">
              <span>Saldo</span>
              <b>{formatCurrency(balance)}</b>
            </div>
          </>
        )}
        {editor.pricing.installmentText && (
          <div className="quote-installments">{editor.pricing.installmentText}</div>
        )}
        <div className="quote-total">
          <span>TOTAL DO INVESTIMENTO</span>
          <strong>{formatCurrency(editor.pricing.totalAmount)}</strong>
        </div>
      </div>

      <div className="quote-summary-bottom">
        <div>
          <h3>OBSERVAÇÕES</h3>
          <p>{editor.terms || "Condições e observações do orçamento."}</p>
        </div>
        <div className="quote-contact">
          <h3>CONTATO</h3>
          {contactPhone && <span>WhatsApp: {contactPhone}</span>}
          {contactInstagram && <span>Instagram: @{contactInstagram.replace(/^@/, "")}</span>}
          {contactEmail && <span>E-mail: {contactEmail}</span>}
        </div>
      </div>

      <Footer
        page={3}
        identity={identity}
        quoteNumber={quoteNumber}
        createdDate={createdDate}
        logoUrl={logoUrl}
      />
    </section>
  );
}

export default function QuotePreview(props: Props) {
  return (
    <div className={`quote-document ${props.className || ""}`}>
      <CoverPage {...props} />
      <ArtistPage {...props} />
      <SummaryPage {...props} />
    </div>
  );
}
