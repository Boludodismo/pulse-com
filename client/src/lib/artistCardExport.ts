import {
  buildArtistVCard,
  cardFileName,
} from "../../../shared/artistCardContact";
import type { ArtistEditorialCardProps } from "../components/artist-card/ArtistEditorialCard";

import { sessionImageSource } from "./sessionImageSource";

export function downloadCardBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
export function downloadArtistContact(
  card: ArtistEditorialCardProps,
  profileUrl: string
) {
  downloadCardBlob(
    new Blob([buildArtistVCard(card, profileUrl)], {
      type: "text/vcard;charset=utf-8",
    }),
    `${cardFileName(card.name)}.vcf`
  );
}
export async function downloadArtistQr(
  card: ArtistEditorialCardProps,
  profileUrl: string,
  contact = false
) {
  const { default: QRCode } = await import("qrcode");
  const data = contact ? buildArtistVCard(card, profileUrl, true) : profileUrl;
  const url = await QRCode.toDataURL(data, {
    width: 1024,
    margin: 4,
    errorCorrectionLevel: "M",
  });
  const response = await fetch(url);
  downloadCardBlob(
    await response.blob(),
    `${cardFileName(card.name)}-qr-${contact ? "contato" : "perfil"}.png`
  );
}

export async function downloadArtistPdf(
  card: ArtistEditorialCardProps,
  profileUrl: string
) {
  const [{ jsPDF }, { default: QRCode }] = await Promise.all([
    import("jspdf"),
    import("qrcode"),
  ]);
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  let y = 22,
    missing = 0;
  const ensure = (height: number) => {
    if (y + height > 277) {
      pdf.addPage();
      y = 22;
    }
  };
  const paragraph = (text: string, size = 11) => {
    if (!text.trim()) return;
    pdf.setFontSize(size);
    const lines = pdf.splitTextToSize(text, 170);
    for (const line of lines) {
      ensure(size * 0.45 + 2);
      pdf.text(line, 20, y);
      y += size * 0.45 + 2;
    }
    y += 4;
  };
  const heading = (text: string) => {
    ensure(20);
    pdf.setTextColor(200, 80, 0);
    paragraph(text, 15);
    pdf.setTextColor(25, 25, 25);
  };
  const image = async (
    url: string,
    caption: string,
    appearance?: "color" | "bw"
  ) => {
    try {
      const response = await fetch(sessionImageSource(url) ?? url, {
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) throw new Error();
      const blob = await response.blob();
      if (blob.size > 10 * 1024 * 1024) throw new Error();
      const bitmap = await createImageBitmap(blob);
      const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        bitmap.close();
        throw new Error();
      }
      ctx.fillStyle = "white";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.filter = appearance === "bw" ? "grayscale(1)" : "none";
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      bitmap.close();
      const height = Math.min(150, (170 * canvas.height) / canvas.width),
        width = (height * canvas.width) / canvas.height;
      ensure(height + 18);
      pdf.addImage(
        canvas.toDataURL("image/jpeg", 0.9),
        "JPEG",
        20,
        y,
        width,
        height
      );
      y += height + 7;
      paragraph(caption, 10);
    } catch {
      missing++;
    }
  };
  heading(card.name);
  paragraph(card.headline, 12);
  if (card.presentation?.cover)
    await image(
      card.presentation.cover.url,
      "",
      card.presentation.cover.appearance ?? "bw"
    );
  else if (card.photo) await image(card.photo, "", "bw");
  if (card.description) {
    heading("Sobre o artista");
    paragraph(card.description);
  }
  if (card.presentation?.about)
    await image(
      card.presentation.about.url,
      "",
      card.presentation.about.appearance ?? "bw"
    );
  if (card.presentation?.quote) paragraph(card.presentation.quote, 13);
  for (const [title, value] of [
    ["Especialidades", card.presentation?.specialties],
    ["Técnicas", card.presentation?.techniques],
    ["Formação", card.presentation?.education],
    ["Experiência", card.presentation?.experience],
    ["Local de atuação", card.presentation?.location],
  ])
    if (value) {
      heading(title!);
      paragraph(value);
    }
  if (card.presentation?.process)
    await image(
      card.presentation.process.url,
      "",
      card.presentation.process.appearance ?? "bw"
    );
  if (card.images.length) {
    heading("Portfólio");
    for (const work of card.images)
      await image(work.url, work.caption, work.appearance);
  }
  heading("Contato e links");
  if (card.presentation?.contact?.phone)
    paragraph(`Telefone: ${card.presentation.contact.phone}`);
  if (card.presentation?.contact?.email)
    paragraph(`E-mail: ${card.presentation.contact.email}`);
  for (const link of card.links) {
    ensure(18);
    paragraph(link.label, 11);
    pdf.setFontSize(9);
    const lines = pdf.splitTextToSize(link.url, 170);
    for (const line of lines) {
      ensure(8);
      pdf.textWithLink(line, 20, y, { url: link.url });
      y += 6;
    }
    y += 3;
  }
  ensure(50);
  const qr = await QRCode.toDataURL(profileUrl, {
    margin: 4,
    errorCorrectionLevel: "M",
  });
  pdf.addImage(qr, "PNG", 20, y, 35, 35);
  pdf.setFontSize(10);
  pdf.textWithLink("Abrir cartão atualizado", 60, y + 14, { url: profileUrl });
  y += 42;
  if (missing)
    paragraph(
      `${missing} imagem(ns) não pôde(ram) ser incluída(s). Consulte o cartão online.`,
      9
    );
  downloadCardBlob(pdf.output("blob"), `${cardFileName(card.name)}-cartao.pdf`);
  return { missingImages: missing };
}
