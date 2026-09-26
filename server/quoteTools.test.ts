import { beforeEach, describe, expect, it, vi } from "vitest";
import sharp from "sharp";
import { allQuoteMedia, buildEmptyQuoteEditorData, DEFAULT_CONCEPT_PRESETS, DEFAULT_DEPOSIT_PRESETS, DEFAULT_INSTALLMENT_PRESETS, parseQuotePayload, quoteEditorDataSchema, quoteMediaSchema, quoteStoredPayloadSchema } from "../shared/quoteProposal";

const storage = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn() }));
vi.mock("./storage", () => ({ storageGet: storage.get, storagePut: storage.put }));
import { prepareProtectedQuoteArtwork, publicQuotePayload, watermarkQuoteArtwork } from "./quoteArtworkProtection";

export function fixture() {
  return quoteStoredPayloadSchema.parse({
    version: 1, editor: buildEmptyQuoteEditorData(),
    client: { id: 3, name: "Cliente de teste", email: null, phone: null },
    artist: { id: 2, name: "Artista de teste", bio: "Bio", specialty: null, photoUrl: null, phone: "5538999999999", email: null, instagram: null },
    studio: { name: "Estúdio", logoUrl: null, phone: "5538999990000", email: null, instagram: null },
    branding: { personalLogoUrl: null, personalLogoKey: null },
  });
}
const media = (n: number, protect = false) => quoteMediaSchema.parse({ key: `quotes/1/2/media/abc-${n}.png`, url: `https://example.test/private-${n}?token=original`, protect });

describe("quote data compatibility and presets", () => {
  it("reads old snapshots without losing their images, amounts or text", () => {
    const p: any = fixture(); p.editor.media.clientReference = media(1);
    p.editor.pricing.totalAmount = 180000;
    delete p.protectedMedia; delete p.editor.additionalProjects; delete p.editor.media.gallery;
    delete p.editor.media.clientReference.protect; delete p.editor.media.clientReference.kind;
    delete p.editor.pricing.depositText; delete p.editor.pricing.installmentInfo;
    const read = parseQuotePayload(JSON.stringify(p))!;
    expect(read.editor.media.clientReference?.url).toContain("private-1");
    expect(read.editor.media.clientReference?.protect).toBe(false);
    expect(read.editor.pricing.totalAmount).toBe(180000);
    expect(read.editor.additionalProjects).toEqual([]);
    expect(read.editor.pricing.depositText).toBe("");
  });
  it("round-trips multiple projects, ordered images and all payment texts", () => {
    const p = fixture();
    p.editor.project.concept = "á".repeat(8000); p.editor.terms = "b".repeat(8000);
    p.editor.media.gallery = [media(2), media(1)];
    p.editor.additionalProjects = [{ id: "second", project: { ...p.editor.project, title: "Segundo projeto" }, images: [media(3, true)] }];
    p.editor.pricing.depositText = DEFAULT_DEPOSIT_PRESETS[0].content;
    p.editor.pricing.installmentInfo = DEFAULT_INSTALLMENT_PRESETS[2].content;
    expect(parseQuotePayload(JSON.stringify(p))).toEqual(p);
    expect(allQuoteMedia(p.editor)).toHaveLength(3);
  });
  it("has eight descriptions and three distinct models for each payment field", () => {
    expect(DEFAULT_CONCEPT_PRESETS).toHaveLength(8);
    expect(DEFAULT_DEPOSIT_PRESETS).toHaveLength(3);
    expect(DEFAULT_INSTALLMENT_PRESETS).toHaveLength(3);
    expect(new Set(DEFAULT_DEPOSIT_PRESETS.map(p => p.content)).size).toBe(3);
  });
  it("rejects text and image excess without truncation", () => {
    const p = fixture(); p.editor.project.concept = "x".repeat(8001);
    expect(quoteEditorDataSchema.safeParse(p.editor).success).toBe(false);
    p.editor.project.concept = "ok";
    p.editor.media.gallery = Array.from({ length: 40 }, (_, i) => media(i));
    p.editor.media.clientReference = media(99);
    expect(quoteEditorDataSchema.safeParse(p.editor).success).toBe(false);
  });
});

describe("quote artwork customer copy", () => {
  beforeEach(() => { vi.restoreAllMocks(); storage.get.mockReset(); storage.put.mockReset(); });
  it("removes source URLs and keys from every occurrence, including the cover", () => {
    const p = fixture(); const source = media(1, true);
    p.editor.media.suggestedArtwork = source; p.editor.media.coverSource = "suggested";
    p.editor.media.gallery = [{ ...source, protect: false }];
    p.editor.additionalProjects = [{ id: "two", project: p.editor.project, images: [source] }];
    p.protectedMedia = [{ sourceKey: source.key, media: { ...source, key: "quotes/1/2/protected/copy.jpg", url: "https://example.test/watermarked" } }];
    const customer = publicQuotePayload(p); const serialized = JSON.stringify(customer);
    expect(serialized).not.toContain("private-1"); expect(serialized).not.toContain(source.key);
    expect(allQuoteMedia(customer.editor).every(m => m.url === "https://example.test/watermarked")).toBe(true);
    expect(p.editor.media.suggestedArtwork.url).toContain("private-1");
    expect(customer.protectedMedia).toEqual([]);
  });
  it("never falls back to the original if a protected copy is missing", () => {
    const p = fixture(); p.editor.media.clientReference = media(1, true);
    expect(() => publicQuotePayload(p)).toThrow("protegida");
  });
  it("does not touch unprotected legacy media", async () => {
    const p = fixture(); p.editor.media.clientReference = media(1);
    expect(await prepareProtectedQuoteArtwork(p, 1, 2, "ORC-1")).toEqual(p);
    expect(publicQuotePayload(p)).toEqual(p); expect(storage.get).not.toHaveBeenCalled();
  });
  it("rejects cross-tenant, cross-artist and arbitrary source URLs before I/O", async () => {
    for (const key of ["quotes/9/2/media/abc.png", "quotes/1/9/media/abc.png", "quotes/1/2/media/../../abc.png", "https://evil.test/asset"]) {
      const p = fixture(); p.editor.media.suggestedArtwork = { ...media(1, true), key };
      await expect(prepareProtectedQuoteArtwork(p, 1, 2, "ORC-1")).rejects.toThrow("artista");
    }
    expect(storage.get).not.toHaveBeenCalled(); expect(storage.put).not.toHaveBeenCalled();
  });
  it("burns a visible mark into raster pixels and reduces oversized images", async () => {
    const source = await sharp({ create: { width: 2200, height: 1800, channels: 3, background: "#aaa" } }).png().toBuffer();
    const out = await watermarkQuoteArtwork(source, "Artista & <teste>", "ORC-2026-123");
    const meta = await sharp(out).metadata(); const stats = await sharp(out).stats();
    expect(meta.format).toBe("jpeg"); expect(meta.width).toBe(1600);
    expect(stats.channels[0].stdev).toBeGreaterThan(2);
    expect(meta.exif).toBeUndefined();
  });
  it("deduplicates protected originals and uploads only a marked customer copy", async () => {
    const p = fixture(); p.editor.media.suggestedArtwork = media(1, true); p.editor.media.gallery = [media(1, true)];
    const source = await sharp({ create: { width: 600, height: 800, channels: 3, background: "#ddd" } }).png().toBuffer();
    storage.get.mockResolvedValue({ url: "https://storage.test/signed" });
    vi.stubGlobal("fetch", vi.fn().mockImplementation(async () => new Response(new Uint8Array(source))));
    storage.put.mockImplementation(async (key: string) => ({ key, url: "https://example.test/marked" }));
    const result = await prepareProtectedQuoteArtwork(p, 1, 2, "ORC-123");
    expect(storage.get).toHaveBeenCalledTimes(1); expect(storage.put).toHaveBeenCalledTimes(1);
    expect(storage.put.mock.calls[0][0]).toMatch(/^quotes\/1\/2\/protected\/.*\.jpg$/);
    expect(result.protectedMedia).toHaveLength(1);
    expect(JSON.stringify(publicQuotePayload(result))).not.toContain("private-1");
    vi.unstubAllGlobals();
  });
  it("fails closed if storage cannot create a protected copy", async () => {
    const p = fixture(); p.editor.media.suggestedArtwork = media(1, true);
    storage.get.mockRejectedValue(new Error("offline"));
    await expect(prepareProtectedQuoteArtwork(p, 1, 2, "ORC-1")).rejects.toThrow("rascunho");
    expect(storage.put).not.toHaveBeenCalled();
  });
});
