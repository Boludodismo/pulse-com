import { parseQuotePayload, type QuoteMedia } from "./quoteProposal";

export const QUOTE_SENT_TAG = "orçamento enviado";
export const QUOTE_RESPONDED_TAG = "orçamento respondido";
export const QUOTE_AUTOMATIC_TAGS = [QUOTE_SENT_TAG, QUOTE_RESPONDED_TAG];
export const isAutomaticQuoteTag = (label: string) => QUOTE_AUTOMATIC_TAGS.includes(label.trim().toLowerCase());

/** Explicit projection: no image URLs, storage keys or protected copies leave this endpoint. */
export function quoteHistoryText(raw: string) {
  const payload = parseQuotePayload(raw);
  if (!payload) return null;
  const { editor, artist, client, studio } = payload;
  const captions = (images: (QuoteMedia | null)[]) => images.filter((image): image is QuoteMedia => Boolean(image))
    .map(({ alt, description, kind }) => ({ alt, description, kind }));
  return {
    clientName: client.name,
    artist: { id: artist.id, name: artist.name, bio: artist.bio, specialty: artist.specialty, phone: artist.phone, email: artist.email, instagram: artist.instagram },
    studio: { name: studio.name, phone: studio.phone, email: studio.email, instagram: studio.instagram },
    contactSource: editor.contactSource,
    projects: [{ ...editor.project, captions: captions([editor.media.clientReference, editor.media.suggestedArtwork, ...editor.media.gallery]) },
      ...editor.additionalProjects.map(({ project, images }) => ({ ...project, captions: captions(images) }))],
    pricing: editor.pricing,
    terms: editor.terms,
  };
}

export function quoteHistoryDate(value: string | null | undefined, dateOnly = false) {
  if (!value) return "Não registrado";
  if (dateOnly) return value.slice(0, 10).split("-").reverse().join("/");
  const utc = /[Zz]|[+-]\d\d:\d\d$/.test(value) ? value : value.replace(" ", "T") + "Z";
  return new Date(utc).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });
}
