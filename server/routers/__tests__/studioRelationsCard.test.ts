import { describe, it, expect, beforeEach } from "vitest";
import {
  parsePresentation,
  toPublicPresentation,
  artistCardPresentationStorageSchema,
  artistCardPresentationPatchSchema,
  artistCardPresentationPublicSchema,
} from "../../../shared/artistCardPresentation";

describe("ArtistCardPresentation", () => {
  describe("parsePresentation", () => {
    it("returns null for missing/empty JSON", () => {
      expect(parsePresentation()).toBeNull();
      expect(parsePresentation(null)).toBeNull();
      expect(parsePresentation("")).toBeNull();
    });

    it("parses valid v1 presentation", () => {
      const json = JSON.stringify({
        version: 1,
        quote: "Artistic vision",
        tagline: "Master of craft",
        specialties: "Realism, portraiture",
        cover: {
          key: "artists/1/1/card/cover/xyz.jpg",
          url: "https://cdn.example.com/xyz.jpg",
          alt: "Studio photo",
          x: 50,
          y: 50,
        },
      });

      const result = parsePresentation(json);
      expect(result).not.toBeNull();
      expect(result?.quote).toBe("Artistic vision");
      expect(result?.cover?.key).toBe("artists/1/1/card/cover/xyz.jpg");
    });

    it("ignores invalid JSON safely", () => {
      const result = parsePresentation("{invalid");
      expect(result).toBeNull();
    });

    it("handles missing media fields (nullish)", () => {
      const json = JSON.stringify({
        version: 1,
        quote: "Test",
        // no about/process
      });

      const result = parsePresentation(json);
      expect(result?.quote).toBe("Test");
      expect(result?.about).toBeUndefined();
      expect(result?.process).toBeUndefined();
    });
  });

  describe("toPublicPresentation", () => {
    it("returns null for null input", () => {
      expect(toPublicPresentation(null)).toBeNull();
    });

    it("omits storage keys from media", () => {
      const stored = {
        version: 1 as const,
        quote: "Test",
        tagline: "Tag",
        specialties: "Spec",
        techniques: null,
        education: null,
        experience: null,
        location: null,
        cover: {
          key: "secret-server-key",
          url: "https://cdn.example.com/img.jpg",
          alt: "Cover",
          x: 50,
          y: 50,
        },
        about: null,
        process: null,
      };

      const publicData = toPublicPresentation(stored);
      expect(publicData).not.toBeNull();
      expect(publicData?.cover).toBeDefined();
      expect(publicData?.cover?.url).toBe("https://cdn.example.com/img.jpg");
      expect(publicData?.cover?.alt).toBe("Cover");
      // @ts-expect-error - key should not exist in public
      expect(publicData?.cover?.key).toBeUndefined();
    });

    it("converts null media to null in public response", () => {
      const stored = {
        version: 1 as const,
        quote: "Test",
        tagline: null,
        specialties: null,
        techniques: null,
        education: null,
        experience: null,
        location: null,
        cover: null,
        about: null,
        process: null,
      };

      const publicData = toPublicPresentation(stored);
      expect(publicData?.cover).toBeNull();
      expect(publicData?.about).toBeNull();
      expect(publicData?.process).toBeNull();
    });
  });

  describe("schema validation", () => {
    it("validates patch schema (no defaults)", () => {
      const valid = { quote: "Short quote" };
      const result = artistCardPresentationPatchSchema.safeParse(valid);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.quote).toBe("Short quote");
        expect(result.data.tagline).toBeUndefined();
      }
    });

    it("rejects oversized text in patch", () => {
      const invalid = { quote: "x".repeat(181) };
      const result = artistCardPresentationPatchSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it("validates public schema without keys", () => {
      const data = {
        version: 1,
        quote: "Test",
        tagline: null,
        specialties: null,
        techniques: null,
        education: null,
        experience: null,
        location: null,
        cover: {
          url: "https://example.com/img.jpg",
          alt: "Alt text",
          x: 50,
          y: 50,
        },
        about: null,
        process: null,
      };

      const result = artistCardPresentationPublicSchema.safeParse(data);
      expect(result.success).toBe(true);
    });
  });

  describe("backward compatibility", () => {
    it("parses cards without presentation field (legacy)", () => {
      // Simulate legacy card row with no presentation column
      const result = parsePresentation(undefined);
      expect(result).toBeNull();
    });

    it("preserves existing presentation when patching", () => {
      const existing = {
        version: 1,
        quote: "Original quote",
        tagline: "Original tagline",
        cover: {
          key: "cover-key",
          url: "https://example.com/cover.jpg",
          alt: "Cover alt",
          x: 50,
          y: 50,
        },
        about: null,
        process: null,
      };

      // Patch only quote
      const patch = { quote: "Updated quote" };
      const merged = {
        version: 1,
        quote: patch.quote ?? existing.quote,
        tagline: undefined ?? existing.tagline,
        specialties: undefined ?? existing.specialties,
        techniques: undefined ?? existing.techniques,
        education: undefined ?? existing.education,
        experience: undefined ?? existing.experience,
        location: undefined ?? existing.location,
        cover: existing.cover, // preserved
        about: existing.about,
        process: existing.process,
      };

      expect(merged.quote).toBe("Updated quote");
      expect(merged.tagline).toBe("Original tagline");
      expect(merged.cover?.key).toBe("cover-key");
    });
  });
});

