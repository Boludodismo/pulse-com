import { parsePhoneNumberFromString } from "libphonenumber-js";
import type { ArtistCardPublicContact } from "./artistCardPresentation";
import { safePublicUrl } from "./studioRelations";

type ContactCard = {
  name: string;
  headline: string;
  links: { label: string; url: string }[];
  presentation?: { contact?: ArtistCardPublicContact } | null;
};
const escapeText = (value: string) =>
  value
    .replace(/\\/g, "\\\\")
    .replace(/\r\n|\r|\n/g, "\\n")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,");
// vCard folds at 75 UTF-8 octets without cutting an accented character.
function fold(line: string) {
  let result = "",
    part = "",
    size = 0;
  const encoder = new TextEncoder();
  for (const char of line) {
    const bytes = encoder.encode(char).length;
    if (size + bytes > 75) {
      result += part + "\r\n";
      part = " ";
      size = 1;
    }
    part += char;
    size += bytes;
  }
  return result + part;
}
export function buildArtistVCard(
  card: ContactCard,
  profileUrl: string,
  compact = false,
  photoJpegBase64?: string
) {
  const parsed = new URL(profileUrl);
  const localDevelopment =
    parsed.protocol === "http:" &&
    ["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname) &&
    !parsed.username &&
    !parsed.password;
  if (!safePublicUrl(profileUrl) && !localDevelopment)
    throw new Error("Endereço público inválido.");
  const words = card.name.trim().split(/\s+/);
  const c = card.presentation?.contact;
  const lines = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `N:${escapeText(words.slice(1).join(" "))};${escapeText(words[0] || "Artista")};;;`,
    `FN:${escapeText(card.name)}`,
  ];
  if (card.headline) lines.push(`TITLE:${escapeText(card.headline)}`);
  const normalizePhone = (value: string) =>
    parsePhoneNumberFromString(value, "BR")?.number ??
    value.replace(/[^\d+]/g, "");
  if (c?.phone) lines.push(`TEL;TYPE=CELL:${normalizePhone(c.phone)}`);
  if (c?.studioPhone)
    lines.push(`TEL;TYPE=WORK,VOICE:${normalizePhone(c.studioPhone)}`);
  if (c?.studioName) lines.push(`ORG:${escapeText(c.studioName)}`);
  if (c && [c.address, c.city, c.state, c.zipCode, c.country].some(Boolean)) {
    lines.push(
      `ADR;TYPE=WORK:;;${[c.address, c.city, c.state, c.zipCode, c.country].map(v => escapeText(v ?? "")).join(";")}`
    );
  }
  if (c?.email) lines.push(`EMAIL;TYPE=INTERNET:${escapeText(c.email)}`);
  const links = [
    { label: "Meu perfil digital", url: parsed.href },
    ...card.links.filter(l => safePublicUrl(l.url)),
  ];
  const phone = normalizePhone(c?.phone || c?.studioPhone || "").replace(
    /[^\d]/g,
    ""
  );
  if (
    phone &&
    !links.some(
      l =>
        /whats.?app/i.test(l.label) ||
        /^(?:api\.)?whatsapp\.com$|^wa\.me$/.test(new URL(l.url).hostname)
    )
  ) {
    links.splice(1, 0, { label: "WhatsApp", url: `https://wa.me/${phone}` });
  }
  links.forEach((link, index) => {
    const group = `item${index + 1}`;
    lines.push(`${group}.URL:${new URL(link.url).href}`);
    lines.push(`${group}.X-ABLabel:${escapeText(link.label)}`);
  });
  if (!compact && links.length)
    lines.push(
      `NOTE:${escapeText(links.map(l => `${l.label}: ${l.url}`).join("\n"))}`
    );
  if (
    !compact &&
    photoJpegBase64 &&
    /^[A-Za-z0-9+/]+={0,2}$/.test(photoJpegBase64) &&
    photoJpegBase64.length <= 200000
  ) {
    lines.push(`PHOTO;ENCODING=b;TYPE=JPEG:${photoJpegBase64}`);
  }
  lines.push("END:VCARD");
  return lines.map(fold).join("\r\n") + "\r\n";
}
export function cardFileName(name: string) {
  return (
    name
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9_-]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 80) || "artista"
  );
}
