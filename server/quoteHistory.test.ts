import { describe, it, expect, vi, beforeEach } from "vitest";
import { buildEmptyQuoteEditorData, quoteClientFirstName, quoteMediaSchema, quoteStoredPayloadSchema } from "../shared/quoteProposal";
import { quoteHistoryText, quoteHistoryDate } from "../shared/quoteHistory";
import { quoteDeliveryMessage, quoteDeliveryError, quoteIdFromTrigger } from "./quoteDelivery";
import { validateAppointmentQuote } from "./quoteHistory";

const mocks = vi.hoisted(() => ({ getDb: vi.fn() }));
vi.mock("./db", () => ({ getDb: mocks.getDb }));
function database(row: unknown) {
  const chain: any = { from: () => chain, innerJoin: () => chain, where: () => chain, limit: async () => row ? [row] : [] };
  mocks.getDb.mockResolvedValue({ select: () => chain });
}
function payload() {
  const editor = buildEmptyQuoteEditorData();
  const media = quoteMediaSchema.parse({ key: "private-key", url: "https://example.test/private.png", alt: "Imagem atual", description: "Descrição de cobertura" });
  editor.media.clientReference = media;
  editor.additionalProjects = [{ id: "second", project: { ...editor.project, title: "Segundo projeto", concept: "Texto do outro projeto" }, images: [{ ...media, description: "Legenda complementar" }] }];
  editor.pricing.depositText = "Reserva e planejamento.";
  editor.pricing.installmentInfo = "Taxa informada previamente.";
  return quoteStoredPayloadSchema.parse({ version: 1, editor, client: { id: 3, name: "  João   da Silva  ", phone: "5538999999999", email: null }, artist: { id: 2, name: "Artista", bio: "Biografia", specialty: "Realismo", photoUrl: "https://example.test/photo.png", phone: null, email: null, instagram: null }, studio: { name: "Estúdio", logoUrl: "https://example.test/logo.png", phone: null, email: null, instagram: null }, branding: { personalLogoKey: null, personalLogoUrl: null } });
}
beforeEach(() => vi.clearAllMocks());
describe("histórico de orçamentos", () => {
  it("preserves every project, caption and payment text without media URLs or keys", () => {
    const p = payload(); const text = quoteHistoryText(JSON.stringify(p))!;
    expect(text.projects).toHaveLength(2); expect(text.projects[0].captions[0].description).toBe("Descrição de cobertura");
    expect(text.projects[1].concept).toBe("Texto do outro projeto"); expect(text.projects[1].captions[0].description).toBe("Legenda complementar");
    expect(text.pricing).toEqual(p.editor.pricing); expect(text.terms).toBe(p.editor.terms);
    expect(JSON.stringify(text)).not.toMatch(/https:|private-key|logoUrl|photoUrl|protectedMedia/);
    expect(quoteHistoryText("invalid")).toBeNull();
  });
  it("uses a first name in the message without modifying the persisted client or quote snapshot", () => {
    const p = payload(); const raw = JSON.stringify(p);
    const message = quoteDeliveryMessage({ payload: raw, publicToken: "a".repeat(48), quoteNumber: "ORC-1", validUntil: "2026-10-10 23:59:59" } as any);
    expect(message).toContain("Olá, João!"); expect(message).not.toContain("da Silva"); expect(message).not.toContain("ORC-1");
    expect(message).toContain(`/proposta/${"a".repeat(48)}`); expect(message).toContain("10/10/2026");
    expect(JSON.parse(raw).client.name).toBe("  João   da Silva  "); expect(quoteClientFirstName("  Maria\nClara ")).toBe("Maria");
    expect(quoteClientFirstName(null)).toBe("");
  });
  it("formats UTC event timestamps in Brasília and preserves calendar-only validity", () => {
    expect(quoteHistoryDate("2026-09-26 02:30:00")).toContain("25/09/2026");
    expect(quoteHistoryDate("2026-09-26 23:59:59", true)).toBe("26/09/2026");
    expect(quoteHistoryDate(null)).toBe("Não registrado");
  });
  it("rejects appointment links belonging to other tenants, clients, artists or drafts", async () => {
    const input = { quoteId: 5, studioId: 1, clientId: 3, artistId: 2, userArtistId: 2 };
    const valid = { id: 5, studioId: 1, clientId: 3, artistId: 2, status: "approved" };
    for (const patch of [{ studioId: 8 }, { clientId: 8 }, { artistId: 8 }, { status: "draft" }, { status: "cancelled" }, { status: "rejected" }]) {
      database({ ...valid, ...patch }); await expect(validateAppointmentQuote(input)).rejects.toThrow();
    }
    database(valid); await expect(validateAppointmentQuote(input)).resolves.toBeUndefined();
    await expect(validateAppointmentQuote({ ...input, userArtistId: 9 })).rejects.toThrow();
  });
  it("revalidates queued proposals before the provider is called", async () => {
    const row = { clientId: 3, status: "finalized", validUntil: "2099-10-10 23:59:59", phone: "5538999999999" };
    database(row); expect(await quoteDeliveryError(1, 5, 3, row.phone, false)).toBeNull();
    expect(await quoteDeliveryError(1, 5, 4, row.phone, false)).toContain("cliente");
    expect(await quoteDeliveryError(1, 5, 3, row.phone, true)).toContain("produção");
    expect(await quoteDeliveryError(1, 5, 3, "5511999999999", false)).toContain("telefone");
    database({ ...row, status: "cancelled" }); expect(await quoteDeliveryError(1, 5, 3, row.phone, false)).toContain("disponível");
    database({ ...row, validUntil: "2020-01-01 23:59:59" }); expect(await quoteDeliveryError(1, 5, 3, row.phone, false)).toContain("venceu");
  });
  it("only identifies explicit quote message triggers, leaving unrelated messaging unchanged", () => {
    expect(quoteIdFromTrigger("quote_proposal:125")).toBe(125);
    for (const value of ["appointment_reminder_24h", "custom", "quote_proposal:0", "quote_proposal:-1", "quote_proposal:2:extra", null]) expect(quoteIdFromTrigger(value)).toBeNull();
  });
});
