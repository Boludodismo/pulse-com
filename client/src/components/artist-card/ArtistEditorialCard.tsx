import { useId, useState, useRef, useEffect } from "react";
import type { ArtistCardPresentationPublic } from "../../../shared/artistCardPresentation";
import styles from "./ArtistEditorialCard.module.css";

export interface ArtistEditorialCardProps {
  name: string;
  photo?: string;
  headline: string;
  description: string;
  links: Array<{ label: string; url: string }>;
  images: Array<{ url: string; caption: string }>;
  presentation?: ArtistCardPresentationPublic | null;
  idPrefix?: string; // For avoiding focus trap conflicts in modals
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

function LightboxDialog({
  isOpen,
  images,
  initialIndex,
  onClose,
  idPrefix,
}: {
  isOpen: boolean;
  images: Array<{ url: string; caption: string }>;
  initialIndex: number;
  onClose: () => void;
  idPrefix: string;
}) {
  const [current, setCurrent] = useState(initialIndex);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isOpen) {
      dialogRef.current?.showModal();
    } else {
      dialogRef.current?.close();
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "ArrowRight") {
        setCurrent((i) => (i + 1) % images.length);
      } else if (e.key === "ArrowLeft") {
        setCurrent((i) => (i - 1 + images.length) % images.length);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, images.length, onClose]);

  const handleClose = () => {
    dialogRef.current?.close();
    onClose();
  };

  return (
    <dialog
      ref={dialogRef}
      className={styles.lightboxDialog}
      onClick={(e) => {
        if (e.target === dialogRef.current) handleClose();
      }}
      onCancel={handleClose}
      aria-labelledby={`${idPrefix}-lightbox-title`}
    >
      <div className={styles.lightboxContent}>
        <button
          ref={closeButtonRef}
          className={styles.lightboxClose}
          onClick={handleClose}
          aria-label="Fechar"
        >
          ✕
        </button>
        <img
          src={images[current].url}
          alt={images[current].caption || "Trabalho do artista"}
          className={styles.lightboxImage}
          onError={(e) => {
            (e.target as HTMLImageElement).src =
              "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 400'%3E%3Crect fill='%23222' width='400' height='400'/%3E%3Ctext x='50%25' y='50%25' text-anchor='middle' dy='.3em' fill='%23666' font-family='Helvetica' font-size='16'%3EImage unavailable%3C/text%3E%3C/svg%3E";
          }}
        />
        {images[current].caption && (
          <figcaption className={styles.lightboxCaption}>
            {images[current].caption}
          </figcaption>
        )}
        <div className={styles.lightboxControls}>
          <button
            onClick={() => setCurrent((i) => (i - 1 + images.length) % images.length)}
            aria-label="Anterior"
          >
            ←
          </button>
          <span className={styles.lightboxCounter}>
            {current + 1} / {images.length}
          </span>
          <button
            onClick={() => setCurrent((i) => (i + 1) % images.length)}
            aria-label="Próxima"
          >
            →
          </button>
        </div>
      </div>
    </dialog>
  );
}

export default function ArtistEditorialCard(
  props: ArtistEditorialCardProps
) {
  const {
    name,
    photo,
    headline,
    description,
    links,
    images,
    presentation,
    idPrefix: providedPrefix,
  } = props;

  const generatedPrefix = useId();
  const idPrefix = providedPrefix || generatedPrefix;

  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  // Section visibility
  const hasAbout = presentation?.about || photo || description;
  const hasFormation = !!(
    presentation?.specialties ||
    presentation?.techniques ||
    presentation?.education ||
    presentation?.experience ||
    presentation?.location
  );
  const hasWorks = images.length > 0;
  const hasLinks = links.length > 0;

  const openLightbox = (index: number) => {
    setLightboxIndex(index);
    setLightboxOpen(true);
  };

  return (
    <article className={styles.artistCard} id={`${idPrefix}-card`}>
      {/* HERO */}
      <section className={styles.hero}>
        <div className={styles.heroContent}>
          <div className={styles.heroLeft}>
            <div className={styles.monogram}>{initials(name)}</div>
            <div className={styles.heroTitle}>{name}</div>
            {headline && <div className={styles.heroHeadline}>{headline}</div>}
            {presentation?.tagline && (
              <div className={styles.heroTagline}>
                <span className={styles.orangeBar} />
                {presentation.tagline}
              </div>
            )}
          </div>

          <div className={styles.heroRight}>
            {photo ? (
              <img
                src={photo}
                alt={name}
                className={styles.heroPhoto}
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
            ) : presentation?.cover ? (
              <img
                src={presentation.cover.url}
                alt={presentation.cover.alt}
                className={styles.heroPhoto}
                style={{
                  objectPosition: `${presentation.cover.x}% ${presentation.cover.y}%`,
                }}
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
            ) : (
              <div className={styles.heroPhotoPlaceholder} />
            )}
          </div>
        </div>

        {hasFormation || hasWorks || hasLinks ? (
          <nav className={styles.heroNav}>
            {hasAbout && (
              <a href={`#${idPrefix}-about`} className={styles.navLink}>
                SOBRE
              </a>
            )}
            {hasFormation && (
              <a href={`#${idPrefix}-formation`} className={styles.navLink}>
                FORMAÇÃO
              </a>
            )}
            {hasWorks && (
              <a href={`#${idPrefix}-works`} className={styles.navLink}>
                TRABALHOS
              </a>
            )}
            {hasLinks && (
              <a href={`#${idPrefix}-links`} className={styles.navLink}>
                REDES
              </a>
            )}
          </nav>
        ) : null}
      </section>

      {/* SOBRE O ARTISTA */}
      {hasAbout && (
        <section
          className={styles.section}
          id={`${idPrefix}-about`}
          key="about"
        >
          <div className={styles.sectionNumber}>01</div>
          <h2 className={styles.sectionTitle}>Sobre o Artista</h2>

          <div className={styles.aboutGrid}>
            {presentation?.about && (
              <figure className={styles.aboutPhoto}>
                <img
                  src={presentation.about.url}
                  alt={presentation.about.alt}
                  style={{
                    objectPosition: `${presentation.about.x}% ${presentation.about.y}%`,
                  }}
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
              </figure>
            )}

            <div className={styles.aboutText}>
              {presentation?.quote && (
                <blockquote className={styles.quote}>
                  {presentation.quote}
                  <span className={styles.quoteBar} />
                </blockquote>
              )}
              <p className={styles.bio}>{description}</p>
            </div>
          </div>
        </section>
      )}

      {/* FORMAÇÃO E ATUAÇÃO */}
      {hasFormation && (
        <section
          className={styles.section}
          id={`${idPrefix}-formation`}
          key="formation"
        >
          <div className={styles.sectionNumber}>02</div>
          <h2 className={styles.sectionTitle}>Formação e Atuação</h2>

          <div className={styles.formationGrid}>
            {presentation?.process && (
              <figure className={styles.formationPhoto}>
                <img
                  src={presentation.process.url}
                  alt={presentation.process.alt}
                  style={{
                    objectPosition: `${presentation.process.x}% ${presentation.process.y}%`,
                  }}
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
              </figure>
            )}

            <ul className={styles.formationList}>
              {presentation?.specialties && (
                <li className={styles.formationItem}>
                  <span className={styles.formationLabel}>Especialidades</span>
                  <p>{presentation.specialties}</p>
                </li>
              )}
              {presentation?.techniques && (
                <li className={styles.formationItem}>
                  <span className={styles.formationLabel}>Técnicas</span>
                  <p>{presentation.techniques}</p>
                </li>
              )}
              {presentation?.education && (
                <li className={styles.formationItem}>
                  <span className={styles.formationLabel}>Formação</span>
                  <p>{presentation.education}</p>
                </li>
              )}
              {presentation?.experience && (
                <li className={styles.formationItem}>
                  <span className={styles.formationLabel}>Experiência</span>
                  <p>{presentation.experience}</p>
                </li>
              )}
              {presentation?.location && (
                <li className={styles.formationItem}>
                  <span className={styles.formationLabel}>Local de Atuação</span>
                  <p>{presentation.location}</p>
                </li>
              )}
            </ul>
          </div>
        </section>
      )}

      {/* TRABALHOS SELECIONADOS */}
      {hasWorks && (
        <section
          className={styles.section}
          id={`${idPrefix}-works`}
          key="works"
        >
          <div className={styles.sectionNumber}>03</div>
          <h2 className={styles.sectionTitle}>Trabalhos Selecionados</h2>

          <div className={styles.worksStrip}>
            {images.map((img, i) => (
              <figure
                key={i}
                className={styles.workItem}
                onClick={() => openLightbox(i)}
              >
                <img
                  src={img.url}
                  alt={img.caption || "Trabalho do artista"}
                  className={styles.workImage}
                  onError={(e) => {
                    (e.target as HTMLImageElement).src =
                      "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 300 400'%3E%3Crect fill='%23222' width='300' height='400'/%3E%3Ctext x='50%25' y='50%25' text-anchor='middle' dy='.3em' fill='%23666' font-family='Helvetica' font-size='12'%3EImage unavailable%3C/text%3E%3C/svg%3E";
                  }}
                />
                {img.caption && (
                  <figcaption className={styles.workCaption}>
                    {img.caption}
                  </figcaption>
                )}
              </figure>
            ))}
          </div>

          <LightboxDialog
            isOpen={lightboxOpen}
            images={images}
            initialIndex={lightboxIndex}
            onClose={() => setLightboxOpen(false)}
            idPrefix={idPrefix}
          />
        </section>
      )}

      {/* REDES E LINKS */}
      {hasLinks && (
        <section
          className={styles.section}
          id={`${idPrefix}-links`}
          key="links"
        >
          <div className={styles.sectionNumber}>04</div>
          <h2 className={styles.sectionTitle}>Redes e Links</h2>

          <ul className={styles.linksList}>
            {links.map((link, i) => (
              <li key={i} className={styles.linkItem}>
                <a href={link.url} target="_blank" rel="noopener noreferrer">
                  <span className={styles.linkIcon}>🔗</span>
                  <span className={styles.linkLabel}>{link.label}</span>
                  <span className={styles.linkArrow}>→</span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* FOOTER */}
      <footer className={styles.footer}>
        <p className={styles.footerName}>{name}</p>
        {hasFormation || hasWorks || hasLinks ? (
          <nav className={styles.footerNav}>
            {hasAbout && (
              <a href={`#${idPrefix}-about`} className={styles.footerNavLink}>
                Sobre
              </a>
            )}
            {hasFormation && (
              <a href={`#${idPrefix}-formation`} className={styles.footerNavLink}>
                Formação
              </a>
            )}
            {hasWorks && (
              <a href={`#${idPrefix}-works`} className={styles.footerNavLink}>
                Trabalhos
              </a>
            )}
            {hasLinks && (
              <a href={`#${idPrefix}-links`} className={styles.footerNavLink}>
                Redes
              </a>
            )}
          </nav>
        ) : null}
      </footer>
    </article>
  );
}

