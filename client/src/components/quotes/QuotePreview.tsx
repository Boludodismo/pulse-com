import type { QuoteEditorData, QuoteMedia } from "@shared/quoteProposal";
import React, { useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

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
  artistCardUrl?: string | null;
  className?: string;
};

function formatCurrency(cents: number) {
  const hasCents = Math.abs(cents % 100) > 0;
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: hasCents ? 2 : 0,
    maximumFractionDigits: hasCents ? 2 : 0,
  }).format((cents || 0) / 100);
}

function formatDate(value: string) {
  const datePart = value.slice(0, 10);
  const [year, month, day] = datePart.split("-");
  return year && month && day ? `${day}/${month}/${year}` : value;
}

function activeLogo(editor: QuoteEditorData, identity: QuotePreviewIdentity) {
  if (editor.logoSource === "none") return null;
  if (editor.logoSource === "personal") {
    return identity.personalLogoUrl ?? identity.studio.logoUrl ?? null;
  }
  return identity.studio.logoUrl ?? identity.personalLogoUrl ?? null;
}

function MediaImage({
  media,
  className = "",
  watermarkUrl,
  watermarkOpacity = 70,
}: {
  media: QuoteMedia | null;
  className?: string;
  watermarkUrl?: string | null;
  watermarkOpacity?: number;
}) {
  const [expanded, setExpanded] = useState(false);
  if (!media) {
    return (
      <div className={`quote-media-placeholder ${className}`}>
        <span>Imagem do projeto</span>
      </div>
    );
  }
  return (
    <><button type="button" className={`quote-media-frame ${className}`} onClick={() => setExpanded(true)} aria-label={`Ampliar: ${media.alt || "Imagem do projeto"}`} onContextMenu={e => { if (media.protect) e.preventDefault(); }}>
      <img
        className="quote-media-main"
        src={media.url}
        alt={media.alt || "Imagem do projeto"}
        loading="lazy"
        draggable={false}
      />
      {watermarkUrl && (
        <img
          className="quote-project-watermark"
          src={watermarkUrl}
          alt=""
          style={{ opacity: watermarkOpacity / 100 }}
        />
      )}
    </button><Dialog open={expanded} onOpenChange={setExpanded}><DialogContent className="max-h-[90dvh] max-w-5xl overflow-y-auto"><DialogTitle>{media.alt || "Imagem do projeto"}</DialogTitle><img src={media.url} alt={media.alt || "Imagem do projeto"} draggable={false} onContextMenu={e => { if (media.protect) e.preventDefault(); }} className="max-h-[75dvh] w-full object-contain" />{media.description && <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{media.description}</p>}{media.protect && <p className="text-xs text-muted-foreground">Arte autoral identificada para esta proposta.</p>}</DialogContent></Dialog></>
  );
}

function Footer({
  page,
  identity,
  createdDate,
  logoUrl,
}: {
  page: number;
  identity: QuotePreviewIdentity;
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
        <small>{formatDate(createdDate)}</small>
      </div>
      <div className="quote-footer-page">{String(page).padStart(2, "0")}</div>
    </footer>
  );
}

function CoverPage(props: Props) {
  const { editor, identity, createdDate, validUntil } = props;
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
        </div>
      </div>

      <div className="quote-cover-art" aria-label="Imagem da capa">
        <div className="quote-cover-frame">
          <div className="quote-cover-frame-inner">
            {cover ? (
              <img
                className="quote-cover-image"
                src={cover.url}
                alt={cover.alt || "Imagem principal da proposta"}
                style={{
                  objectPosition: `${cover.x}% ${cover.y}%`,
                  transform: `scale(${cover.zoom})`,
                }}
              />
            ) : (
              <div className="quote-glass-empty">IMAGEM DA CAPA</div>
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
        createdDate={createdDate}
        logoUrl={logoUrl}
      />
    </section>
  );
}

function ArtistPage(props: Props) {
  const { editor, identity, createdDate } = props;
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

      {props.artistCardUrl && (
        <a
          className="quote-artist-card-link"
          href={props.artistCardUrl}
          target="_blank"
          rel="noreferrer"
        >
          Acessar cartão virtual do artista
          <span aria-hidden="true">→</span>
        </a>
      )}

      <blockquote>
        <span>“</span>
        <p>Arte, técnica e identidade para transformar uma ideia em algo que permanece.</p>
      </blockquote>

      <Footer
        page={2}
        identity={identity}
        createdDate={createdDate}
        logoUrl={logoUrl}
      />
    </section>
  );
}

function ImageDescription({ media }: { media: QuoteMedia }) {
  return media.description ? <p className="quote-image-description">{media.description}</p> : null;
}

function ImageGallery({ images }: { images: QuoteMedia[] }) {
  const labels = { reference: "Referência", current: "Tatuagem atual", artwork: "Arte desenvolvida", detail: "Detalhe" };
  if (!images.length) return null;
  return <div className="quote-extra-gallery">{images.map((media, i) => <figure key={media.key + i}><h4>{labels[media.kind]}</h4><MediaImage media={media} /><figcaption>{media.alt}{media.protect && <span> · Arte protegida</span>}</figcaption><ImageDescription media={media} /></figure>)}</div>;
}

function ProjectDetails({ project }: { project: QuoteEditorData["project"] }) {
  return <div className="quote-details"><h3>DETALHES DO PROJETO</h3><ul>
    {project.style && <li><b>Estilo:</b> {project.style}</li>}
    {project.bodyRegion && <li><b>Região:</b> {project.bodyRegion}</li>}
    {project.sizeText && <li><b>Tamanho:</b> {project.sizeText}</li>}
    {project.durationText && <li><b>Tempo estimado:</b> {project.durationText}</li>}
    <li><b>Sessões:</b> {project.sessions}</li>
  </ul></div>;
}

function SummaryPage(props: Props) {
  const { editor, identity, quoteNumber, createdDate } = props;
  const logoUrl = activeLogo(editor, identity);
  const balance = Math.max(0, editor.pricing.totalAmount - editor.pricing.depositAmount);
  const contact = editor.contactSource === "artist" ? identity.artist : identity.studio;
  const contactPhone = contact.phone;
  const contactInstagram = contact.instagram;
  const contactEmail = contact.email;

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
      <h3 className="quote-project-title">{editor.project.title}</h3>

      <div className="quote-project-overview">
        {editor.media.clientReference && <div className="quote-project-image">
          <h4>REFERÊNCIA DO CLIENTE</h4>
          <MediaImage media={editor.media.clientReference} />
          <ImageDescription media={editor.media.clientReference} />
        </div>}
        {editor.media.suggestedArtwork && <div className="quote-project-image">
          <h4 className="orange">ARTE SUGERIDA</h4>
          <MediaImage
            media={editor.media.suggestedArtwork}
            watermarkUrl={logoUrl}
            watermarkOpacity={editor.watermarkOpacity}
          />
          <ImageDescription media={editor.media.suggestedArtwork} />
        </div>}
        {editor.project.concept && <div className="quote-concept">
          <h3>CONCEITO</h3>
          <p>{editor.project.concept || "Descreva o conceito artístico do projeto."}</p>
        </div>}
      </div>
      <ImageGallery images={editor.media.gallery} />

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

      {editor.additionalProjects.map((item, index) => <section key={item.id} className="quote-additional-project"><h3 className="quote-project-title">PROJETO {index + 2} · {item.project.title}</h3>{item.project.concept && <div className="quote-concept"><p>{item.project.concept}</p></div>}<ProjectDetails project={item.project} /><ImageGallery images={item.images} /></section>)}

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
        {editor.pricing.showDeposit && editor.pricing.showDepositText && editor.pricing.depositText && <div className="quote-payment-info"><h3>SINAL E RESERVA</h3><p>{editor.pricing.depositText}</p></div>}
        {editor.pricing.showInstallmentInfo && editor.pricing.installmentInfo && <div className="quote-payment-info"><h3>PARCELAMENTO NO CARTÃO</h3><p>{editor.pricing.installmentInfo}</p></div>}
        <div className="quote-total">
          <span>TOTAL DO INVESTIMENTO</span>
          <strong>{formatCurrency(editor.pricing.totalAmount)}</strong>
        </div>
      </div>

      <div className="quote-summary-bottom">
        {editor.terms && <div>
          <h3>OBSERVAÇÕES</h3>
          <p>{editor.terms || "Condições e observações do orçamento."}</p>
        </div>}
        <div className="quote-contact">
          <h3>CONTATO</h3>
          {contactPhone && <span>WhatsApp: {contactPhone}</span>}
          {contactInstagram && <span>Instagram: @{contactInstagram.replace(/^@/, "")}</span>}
          {contactEmail && <span>E-mail: {contactEmail}</span>}
          {!contactPhone && !contactInstagram && !contactEmail && (
            <span>Contato do estúdio não informado.</span>
          )}
        </div>
      </div>

      <Footer
        page={3}
        identity={identity}
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
