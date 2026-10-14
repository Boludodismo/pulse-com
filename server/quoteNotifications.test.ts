import { beforeEach, describe, expect, it, vi } from "vitest";
import { getTableName } from "drizzle-orm";
import { MySqlDialect } from "drizzle-orm/mysql-core";
import { buildEmptyQuoteEditorData, quoteStoredPayloadSchema } from "../shared/quoteProposal";
const mocks = vi.hoisted(() => ({ db: vi.fn(), send: vi.fn() }));
vi.mock("./db", () => ({ getDb: mocks.db }));
vi.mock("./messaging/service", () => ({ sendAndLog: mocks.send }));
import { queueQuoteArtistNotification } from "./quoteNotifications";
import { publicQuotePayload } from "./quoteArtworkProtection";

const payload = () => quoteStoredPayloadSchema.parse({ version: 1, editor: buildEmptyQuoteEditorData(), client: { id: 3, name: "Ágatha Cunha", phone: null, email: null }, artist: { id: 2, name: "Artista", phone: "5538999999999", email: "private@example.test", instagram: "private", photoUrl: null, bio: null, specialty: null }, studio: { name: "Estúdio", phone: "5538999990000", email: null, instagram: null, logoUrl: null }, branding: { personalLogoKey: null, personalLogoUrl: null } });
const row = () => ({ id: 5, studioId: 1, artistId: 2, clientId: 3, quoteNumber: "ORC-5", payload: JSON.stringify(payload()) }) as any;
let artist: any; let preference: any; let filters: any[];
beforeEach(() => {
  vi.clearAllMocks(); filters = [];
  artist = { id: 2, studioId: 1, active: 1, name: "Artista", phone: "5538999998888" };
  preference = { whatsappOperationalEnabled: 1, notifyClientActionsEnabled: 1 };
  const dialect = new MySqlDialect();
  mocks.db.mockResolvedValue({ select: () => { let table = ""; const q: any = { from: (t: any) => { table = getTableName(t); return q; }, where: (condition: any) => { filters.push(dialect.sqlToQuery(condition).params); return q; }, limit: async () => table === "artists" ? (artist ? [artist] : []) : (preference ? [preference] : []) }; return q; } });
  mocks.send.mockResolvedValue({ success: true, queued: true });
});
describe("private artist quote notifications", () => {
  it("removes artist contact data from the public response when the studio is selected", () => {
    const stored = payload(); const result = publicQuotePayload(stored);
    expect(result.artist).toMatchObject({ phone: null, email: null, instagram: null });
    expect(result.studio.phone).toBe("5538999990000"); expect(stored.artist.phone).toBe("5538999999999");
    expect(result.client.name).toBe("Ágatha");
    stored.editor.contactSource = "artist"; expect(publicQuotePayload(stored).artist.phone).toBe(stored.artist.phone);
  });
  it("routes the full question to the current assigned artist, even with studio public contact", async () => {
    expect(await queueQuoteArtistNotification(row(), "question", "Posso mudar o tamanho?\nPara 20 cm.")).toBe(true);
    expect(mocks.send).toHaveBeenCalledWith(expect.objectContaining({ studioId: 1, artistId: 2, recipientType: "artist", recipientPhone: artist.phone, trigger: "quote_artist_action:5:question", message: expect.stringContaining("Posso mudar o tamanho?\nPara 20 cm.") }));
    expect(mocks.send.mock.calls[0][0].message).toContain("Ágatha"); expect(mocks.send.mock.calls[0][0].message).toContain("ORC-5");
    expect(filters).toEqual([[2, 1], [2, 1]]);
  });
  it("uses stable deduplication keys and distinguishes different questions and acceptance", async () => {
    await queueQuoteArtistNotification(row(), "question", "Pergunta A"); await queueQuoteArtistNotification(row(), "question", "Pergunta A"); await queueQuoteArtistNotification(row(), "question", "Pergunta B"); await queueQuoteArtistNotification(row(), "accepted");
    const keys = mocks.send.mock.calls.map(([p]) => p.idempotencyKey);
    expect(keys[0]).toBe(keys[1]); expect(keys[0]).not.toBe(keys[2]); expect(keys[2]).not.toBe(keys[3]);
  });
  it("does not claim a WhatsApp click is a sent message", async () => {
    await queueQuoteArtistNotification(row(), "whatsapp_opened");
    expect(mocks.send.mock.calls[0][0].message).toContain("isso não confirma o envio de mensagem");
  });
  it("respects artist authorization and unavailable recipients without changing quote responses", async () => {
    preference.notifyClientActionsEnabled = 0; expect(await queueQuoteArtistNotification(row(), "accepted")).toBe(false);
    preference.notifyClientActionsEnabled = 1; preference.whatsappOperationalEnabled = 0; expect(await queueQuoteArtistNotification(row(), "accepted")).toBe(false);
    preference.whatsappOperationalEnabled = 1; artist.active = 0; expect(await queueQuoteArtistNotification(row(), "accepted")).toBe(false);
    expect(mocks.send).not.toHaveBeenCalled();
  });
});
