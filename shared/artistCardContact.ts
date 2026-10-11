import { safePublicUrl } from "./studioRelations";

type ContactCard = {
  name: string;
  headline: string;
  links: { label: string; url: string }[];
  presentation?: { contact?: { phone: string; email: string } } | null;
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
  compact = false
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
  if (c?.phone) lines.push(`TEL;TYPE=CELL:${c.phone.replace(/[^\d+]/g, "")}`);
  if (c?.email) lines.push(`EMAIL;TYPE=INTERNET:${escapeText(c.email)}`);
  lines.push(`URL:${escapeText(profileUrl)}`);
  if (!compact)
    for (const link of card.links.filter(l => safePublicUrl(l.url))) {
      lines.push(`URL:${escapeText(link.url)}`);
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
