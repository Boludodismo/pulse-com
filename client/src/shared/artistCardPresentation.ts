import { z } from "zod";

// Single media item stored (includes key for server ownership)
export const storedMediaSchema = z.object({
  key: z.string(),
  url: z.string().url(),
  alt: z.string().max(200),
  x: z.number().min(0).max(100),
  y: z.number().min(0).max(100),
});

export type StoredMedia = z.infer<typeof storedMediaSchema>;

// Public media response (omits key for security)
export const publicMediaSchema = storedMediaSchema.omit({ key: true });
export type PublicMedia = z.infer<typeof publicMediaSchema>;

// Full editorial presentation stored in DB
export const artistCardPresentationStorageSchema = z.object({
  version: z.literal(1),
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
});

export type ArtistCardPresentationStorage = z.infer<
  typeof artistCardPresentationStorageSchema
>;

// Patch schema for saveCard (no defaults, preserves omitted fields)
export const artistCardPresentationPatchSchema = z.object({
  quote: z.string().max(180).optional(),
  tagline: z.string().max(180).optional(),
  specialties: z.string().max(500).optional(),
  techniques: z.string().max(500).optional(),
  education: z.string().max(1200).optional(),
  experience: z.string().max(700).optional(),
  location: z.string().max(200).optional(),
});

export type ArtistCardPresentationPatch = z.infer<
  typeof artistCardPresentationPatchSchema
>;

// Public response schema (omits server-owned keys)
export const artistCardPresentationPublicSchema = artistCardPresentationStorageSchema
  .omit({
    cover: true,
    about: true,
    process: true,
  })
  .extend({
    cover: publicMediaSchema.nullish(),
    about: publicMediaSchema.nullish(),
    process: publicMediaSchema.nullish(),
  });

export type ArtistCardPresentationPublic = z.infer<
  typeof artistCardPresentationPublicSchema
>;

/**
 * Parse stored presentation JSON safely.
 * Returns null for missing/invalid data (not default values).
 * Logs version mismatches but doesn't fail.
 */
export function parsePresentation(
  json?: string | null
): ArtistCardPresentationStorage | null {
  if (!json) return null;
  try {
    const parsed = JSON.parse(json);
    const result = artistCardPresentationStorageSchema.safeParse(parsed);
    if (!result.success) {
      console.warn(
        "[ArtistCard] Invalid presentation JSON:",
        result.error.issues
      );
      return null;
    }
    return result.data;
  } catch (e) {
    console.warn("[ArtistCard] Failed to parse presentation:", e);
    return null;
  }
}

/**
 * Convert stored presentation to public (omit keys).
 */
export function toPublicPresentation(
  stored: ArtistCardPresentationStorage | null
): ArtistCardPresentationPublic | null {
  if (!stored) return null;
  return {
    version: stored.version,
    quote: stored.quote,
    tagline: stored.tagline,
    specialties: stored.specialties,
    techniques: stored.techniques,
    education: stored.education,
    experience: stored.experience,
    location: stored.location,
    cover: stored.cover
      ? { url: stored.cover.url, alt: stored.cover.alt, x: stored.cover.x, y: stored.cover.y }
      : null,
    about: stored.about
      ? { url: stored.about.url, alt: stored.about.alt, x: stored.about.x, y: stored.about.y }
      : null,
    process: stored.process
      ? { url: stored.process.url, alt: stored.process.alt, x: stored.process.x, y: stored.process.y }
      : null,
  };
}

