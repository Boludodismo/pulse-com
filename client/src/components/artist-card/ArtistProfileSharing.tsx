import { useEffect, useState } from "react";
import {
  artistCardShareMessage,
  artistCardWhatsAppShareUrl,
} from "../../../../shared/artistCardSharing";
import styles from "./ArtistProfileSharing.module.css";

export default function ArtistProfileSharing({
  name,
  profileUrl,
}: {
  name: string;
  profileUrl: string;
}) {
  const [qr, setQr] = useState("");
  const [qrFailed, setQrFailed] = useState(false);
  const [feedback, setFeedback] = useState("");
  useEffect(() => {
    let current = true;
    setQr("");
    setQrFailed(false);
    import("qrcode")
      .then(({ default: QRCode }) =>
        QRCode.toDataURL(profileUrl, {
          width: 320,
          margin: 4,
          errorCorrectionLevel: "M",
        })
      )
      .then(value => {
        if (current) setQr(value);
      })
      .catch(() => {
        if (current) setQrFailed(true);
      });
    return () => {
      current = false;
    };
  }, [profileUrl]);
  async function copy() {
    try {
      await navigator.clipboard.writeText(profileUrl);
      setFeedback("Link copiado para compartilhar.");
    } catch {
      setFeedback("Selecione e copie o link exibido abaixo.");
    }
  }
  async function share() {
    try {
      if (navigator.share)
        await navigator.share({
          title: name,
          text: artistCardShareMessage(name, profileUrl),
        });
      else await copy();
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError"))
        setFeedback("Não foi possível compartilhar. Use o botão Copiar link.");
    }
  }
  return (
    <section className={styles.panel} aria-label="Compartilhe este artista">
      <div className={styles.content}>
        <h2>Compartilhe este artista</h2>
        <p>
          Gostou do trabalho de {name}? Apresente esse talento aos seus amigos e
          conhecidos. Compartilhe o cartão pelo WhatsApp ou mostre o QR Code
          para que outras pessoas também conheçam seu trabalho.
        </p>
        <div className={styles.actions}>
          <a
            className={styles.whatsapp}
            href={artistCardWhatsAppShareUrl(name, profileUrl)}
            target="_blank"
            rel="noopener noreferrer"
          >
            Compartilhar no WhatsApp
          </a>
          <button type="button" onClick={copy}>
            Copiar link
          </button>
          <button type="button" onClick={share}>
            Compartilhar cartão
          </button>
        </div>
        <label className={styles.link}>
          Link do cartão
          <input
            aria-label="Link público do cartão"
            readOnly
            value={profileUrl}
            onFocus={e => e.currentTarget.select()}
          />
        </label>
        <p className={styles.feedback} role="status">
          {feedback}
        </p>
      </div>
      <figure className={styles.qr}>
        {qr ? (
          <img
            src={qr}
            width={192}
            height={192}
            alt={`QR Code para abrir o cartão de ${name}`}
          />
        ) : (
          <p role="status">
            {qrFailed
              ? "Não foi possível carregar o QR Code. Compartilhe pelo link."
              : "Preparando QR Code…"}
          </p>
        )}
        <figcaption>Escaneie para conhecer o perfil de {name}.</figcaption>
      </figure>
    </section>
  );
}
