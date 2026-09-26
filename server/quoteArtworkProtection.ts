import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { TRPCError } from "@trpc/server";
import { allQuoteMedia, mapQuoteMedia, type QuoteStoredPayload } from "../shared/quoteProposal";
import { storageGet, storagePut } from "./storage";

const MAX_BYTES = 6 * 1024 * 1024;
const escapeXml = (text: string) => text.replace(/[<>&"']/g, c => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" })[c]!);

// Rasterize the identifying mark into the customer copy. Never return the source
// URL in the public payload, including when it is reused in an unmarked slot.
export async function watermarkQuoteArtwork(source: Buffer, artist: string, quoteNumber: string) {
  const image = sharp(source, { limitInputPixels: 40_000_000, animated: false });
  const metadata = await image.metadata();
  if (!["jpeg", "png", "webp"].includes(metadata.format || "")) throw new Error("Formato de imagem não suportado.");
  const resized = await image.rotate().resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
    .flatten({ background: "#ffffff" }).png().toBuffer({ resolveWithObject: true });
  const { width, height } = resized.info;
  const fontSize = Math.max(12, Math.round(Math.min(width, height) / 32));
  const line = escapeXml(`${artist.slice(0, 65)} · ${quoteNumber}`);
  const cellWidth = Math.max(240, Math.round(width * 0.72));
  // A bundled font keeps the identifying text visible on hosts without system fonts.
  const stamp = await sharp({ text: {
    text: `<span foreground="white">${line}\nARTE AUTORAL · PROPOSTA INDIVIDUAL</span>`,
    font: `DejaVu Sans ${fontSize}`,
    fontfile: fileURLToPath(new URL("../server/assets/DejaVuSans.ttf", import.meta.url)),
    width: cellWidth - 24, align: "center", rgba: true,
  } }).png().toBuffer({ resolveWithObject: true });
  const cellHeight = Math.max(stamp.info.height + 48, Math.round(height / 5));
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${width}" height="${height}"><defs><pattern id="mark" width="${cellWidth}" height="${cellHeight}" patternUnits="userSpaceOnUse" patternTransform="rotate(-24)"><rect x="4" y="12" width="${stamp.info.width + 16}" height="${stamp.info.height + 16}" rx="4" fill="black" opacity="0.25"/><image x="12" y="20" width="${stamp.info.width}" height="${stamp.info.height}" opacity="0.65" xlink:href="data:image/png;base64,${stamp.data.toString("base64")}"/></pattern></defs><rect width="100%" height="100%" fill="url(#mark)"/></svg>`;
  return sharp(resized.data).composite([{ input: Buffer.from(svg) }]).jpeg({ quality: 85 }).toBuffer();
}

async function readLimitedImage(url: string) {
  const response = await fetch(url, { signal: AbortSignal.timeout(20000) });
  if (!response.ok || !response.body) throw new Error("Não foi possível carregar a arte para proteção.");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = []; let bytes = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_BYTES) { await reader.cancel(); throw new Error("A arte ultrapassa 6 MB."); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  return Buffer.concat(chunks);
}

export async function prepareProtectedQuoteArtwork(payload: QuoteStoredPayload, studioId: number, artistId: number, quoteNumber: string) {
  const prefix = `quotes/${studioId}/${artistId}/media/`;
  const media = Array.from(new Map(allQuoteMedia(payload.editor).filter(m => m.protect).map(m => [m.key, m])).values());
  // Validate every key before fetching any asset; no arbitrary user-supplied URLs.
  for (const image of media) {
    const suffix = image.key.slice(prefix.length);
    if (!image.key.startsWith(prefix) || !/^[a-f0-9-]+\.(jpg|png|webp)$/.test(suffix)) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Para proteger esta arte, envie o arquivo pelo orçamento deste artista." });
    }
  }
  const protectedMedia: QuoteStoredPayload["protectedMedia"] = [];
  for (const image of media) {
    try {
      const { url } = await storageGet(image.key);
      if (!url) throw new Error("Armazenamento indisponível.");
      const buffer = await readLimitedImage(url);
      const customerCopy = await watermarkQuoteArtwork(buffer, payload.artist.name, quoteNumber);
      const uploaded = await storagePut(`quotes/${studioId}/${artistId}/protected/${randomUUID()}.jpg`, customerCopy, "image/jpeg");
      if (!uploaded.url) throw new Error("Armazenamento indisponível.");
      protectedMedia.push({ sourceKey: image.key, media: { ...image, ...uploaded, protect: true } });
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Não foi possível preparar a cópia protegida. O orçamento continua como rascunho; tente novamente." });
    }
  }
  return { ...payload, protectedMedia };
}

export function publicQuotePayload(payload: QuoteStoredPayload): QuoteStoredPayload {
  const protectedKeys = new Set(allQuoteMedia(payload.editor).filter(m => m.protect).map(m => m.key));
  const copies = new Map(payload.protectedMedia.map(p => [p.sourceKey, p.media]));
  const editor = mapQuoteMedia(payload.editor, image => {
    if (!protectedKeys.has(image.key)) return image;
    const copy = copies.get(image.key);
    if (!copy) throw new TRPCError({ code: "CONFLICT", message: "A cópia protegida desta proposta precisa ser preparada pelo artista." });
    return { ...image, key: copy.key, url: copy.url, protect: true };
  });
  return { ...payload, editor, protectedMedia: [] };
}
