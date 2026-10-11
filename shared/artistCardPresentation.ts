import { z } from "zod";
import { parsePhoneNumberFromString } from "libphonenumber-js";
import { cardImageEditSchema } from "./artistCardImage";
const mediaUrl = z
  .string()
  .max(3000)
  .refine(value => {
    if (value.startsWith("/api/storage?")) return true;
    try {
      const u = new URL(value);
      return u.protocol === "https:" && !u.username && !u.password;
    } catch {
      return false;
    }
  }, "Endereço de imagem inválido.");
export const storedMediaSchema = z.object({
  key: z.string().min(1).max(500),
  url: mediaUrl,
  alt: z.string().max(200),
  x: z.number().min(0).max(100),
  y: z.number().min(0).max(100),
  appearance: z.enum(["color", "bw"]).optional(),
  edit: cardImageEditSchema.optional(),
  original: z
    .object({ key: z.string().min(1).max(500), url: mediaUrl })
    .optional(),
});
export type StoredMedia = z.infer<typeof storedMediaSchema>;
export const publicMediaSchema = storedMediaSchema.omit({
  key: true,
  original: true,
  edit: true,
});
const publicPhone = z
  .string()
  .trim()
  .max(40)
  .regex(/^[+\d\s().-]*$/, "Informe apenas o telefone com DDD.")
  .refine(
    value => !value || !!parsePhoneNumberFromString(value, "BR")?.isValid(),
    "Informe um telefone válido com DDD."
  )
  .transform(value =>
    value ? parsePhoneNumberFromString(value, "BR")!.number : ""
  );
export const cardContactSchema = z
  .object({
    phone: publicPhone,
    email: z.union([z.literal(""), z.string().trim().email().max(254)]),
    studioPhone: publicPhone.optional(),
    studioName: z.string().trim().max(255).optional(),
    address: z.string().trim().max(500).optional(),
    city: z.string().trim().max(100).optional(),
    state: z.string().trim().max(50).optional(),
    zipCode: z.string().trim().max(20).optional(),
    country: z.string().trim().max(100).optional(),
  })
  .strict();
export type ArtistCardPublicContact = z.infer<typeof cardContactSchema>;
export type PublicMedia = z.infer<typeof publicMediaSchema>;
export const artistCardPresentationStorageSchema = z
  .object({
    version: z.literal(1),
    contact: cardContactSchema.optional(),
    quote: z.string().max(180).nullish(),
    tagline: z.string().max(180).nullish(),
    specialties: z.string().max(500).nullish(),
    techniques: z.string().max(500).nullish(),
    education: z.string().max(1200).nullish(),
    experience: z.string().max(700).nullish(),
    location: z.string().max(200).nullish(),
    cover: storedMediaSchema.nullish(),
    about: storedMediaSchema.nullish(),
    process: storedMediaSchema.nullish(),
  })
  .strict();
export type ArtistCardPresentationStorage = z.infer<
  typeof artistCardPresentationStorageSchema
>;
// No defaults: an older client omitting these fields must not erase them.
export const artistCardPresentationPatchSchema = z
  .object({
    contact: cardContactSchema.optional(),
    quote: z.string().trim().max(180).optional(),
    tagline: z.string().trim().max(180).optional(),
    specialties: z.string().trim().max(500).optional(),
    techniques: z.string().trim().max(500).optional(),
    education: z.string().trim().max(1200).optional(),
    experience: z.string().trim().max(700).optional(),
    location: z.string().trim().max(200).optional(),
  })
  .strict();
export type ArtistCardPresentationPatch = z.infer<
  typeof artistCardPresentationPatchSchema
>;
export const artistCardPresentationPublicSchema =
  artistCardPresentationStorageSchema
    .omit({ cover: true, about: true, process: true })
    .extend({
      cover: publicMediaSchema.nullish(),
      about: publicMediaSchema.nullish(),
      process: publicMediaSchema.nullish(),
    });
export type ArtistCardPresentationPublic = z.infer<
  typeof artistCardPresentationPublicSchema
>;
export function parsePresentation(
  json?: string | null
): ArtistCardPresentationStorage | null {
  if (!json) return null;
  try {
    const parsed = artistCardPresentationStorageSchema.safeParse(
      JSON.parse(json)
    );
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
function publicMedia(media?: StoredMedia | null): PublicMedia | null {
  return media
    ? {
        url: media.url,
        alt: media.alt,
        x: media.x,
        y: media.y,
        ...(media.appearance ? { appearance: media.appearance } : {}),
      }
    : null;
}
export function toPublicPresentation(
  stored: ArtistCardPresentationStorage | null
): ArtistCardPresentationPublic | null {
  if (!stored) return null;
  return {
    version: stored.version,
    ...(stored.contact ? { contact: stored.contact } : {}),
    quote: stored.quote,
    tagline: stored.tagline,
    specialties: stored.specialties,
    techniques: stored.techniques,
    education: stored.education,
    experience: stored.experience,
    location: stored.location,
    cover: publicMedia(stored.cover),
    about: publicMedia(stored.about),
    process: publicMedia(stored.process),
  };
}
