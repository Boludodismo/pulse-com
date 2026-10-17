import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  notices: [] as any[],
  send: vi.fn(),
  backup: vi.fn(),
  enabled: 1,
  queries: [] as any[],
}));
vi.mock("./backup", () => ({ backupConsent: mocks.backup }));
vi.mock("../messaging/service", () => ({ sendAndLog: mocks.send }));
vi.mock("../db", () => ({
  getClientById: async () => ({ name: "Cliente Teste Confidencial" }),
  getStudioSettings: async () => ({
    studioName: "Estúdio",
    phone: "31988888888",
  }),
  getArtistById: async () => ({
    id: 9,
    active: 1,
    name: "Artista",
    phone: "31999999999",
  }),
}));
vi.mock("./database", () => ({
  rows: async (sql: string) => {
    if (sql.includes("backup_revision<revision")) return [{ id: 11 }];
    if (sql.includes("FROM minor_consent_notices"))
      return mocks.notices.filter(n => !n.queued);
    if (sql.includes("FROM artist_notification_settings"))
      return [{ enabled: mocks.enabled }];
    return [];
  },
  pool: () => ({
    query: async (sql: string, params: any[]) => {
      mocks.queries.push([sql, params]);
      if (sql.includes("SET status='queued'")) {
        const n = mocks.notices.find(n => n.recipient === params[2]);
        if (n) n.queued = true;
      }
      return [{ affectedRows: 1 }];
    },
  }),
  audit: async () => {},
}));
import { processMinorConsentRecords } from "./worker";
beforeEach(() => {
  vi.clearAllMocks();
  mocks.queries = [];
  mocks.enabled = 1;
  mocks.notices = ["artist", "studio"].map(recipient => ({
    request_id: 11,
    recipient,
    studio_id: 1,
    client_id: 7,
    artist_id: 9,
    notify_artist: 1,
    notify_studio: 1,
  }));
  mocks.send.mockResolvedValue({
    success: true,
    queued: true,
    duplicate: false,
    messageId: "42",
  });
});
describe("consent completion notices", () => {
  it("queues one notice for each configured role, with no documents, CPF or health data", async () => {
    await processMinorConsentRecords();
    expect(mocks.backup).toHaveBeenCalledWith(11);
    expect(mocks.send).toHaveBeenCalledTimes(2);
    const [artist, studio] = mocks.send.mock.calls.map(c => c[0]);
    expect(artist).toMatchObject({
      studioId: 1,
      artistId: 9,
      recipientPhone: "31999999999",
    });
    expect(studio).toMatchObject({
      studioId: 1,
      operationalRecipient: "studio",
      recipientPhone: "31988888888",
    });
    expect(studio.message).not.toMatch(
      /CPF|documento.*http|base64|health|Confidencial/
    );
    expect(studio.message).toContain("Cliente: Cliente");
    await processMinorConsentRecords();
    expect(mocks.send).toHaveBeenCalledTimes(2);
  });
  it("keeps an integration failure pending without claiming delivery", async () => {
    mocks.send.mockResolvedValue({
      success: false,
      error: "Nenhuma integração ativa",
    });
    await processMinorConsentRecords();
    expect(
      mocks.queries.some(([sql]) => sql.includes("SET status='queued'"))
    ).toBe(false);
    expect(
      mocks.queries.filter(([sql]) => sql.includes("error_text=?"))
    ).toHaveLength(2);
  });
  it("respects artist operational preferences and still handles the studio notice", async () => {
    mocks.enabled = 0;
    await processMinorConsentRecords();
    expect(mocks.send).toHaveBeenCalledTimes(1);
    expect(mocks.send.mock.calls[0][0].operationalRecipient).toBe("studio");
  });
});
