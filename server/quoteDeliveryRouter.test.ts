import { beforeEach, describe, expect, it, vi } from "vitest";
import { getTableName } from "drizzle-orm";
import { MySqlDialect } from "drizzle-orm/mysql-core";
import { buildEmptyQuoteEditorData, quoteStoredPayloadSchema } from "../shared/quoteProposal";
import { TRPCError } from "@trpc/server";
const mocks = vi.hoisted(() => ({ getDb: vi.fn(), client: vi.fn(), privateAccess: vi.fn(), integration: vi.fn(), send: vi.fn() }));
vi.mock("./db", () => ({ getDb: mocks.getDb, getClientById: mocks.client }));
vi.mock("./saas", () => ({ isUserAccessActive: async () => true }));
vi.mock("./invitedArtistAccess", () => ({ assertInvitedArtistAccess: async () => {} }));
vi.mock("./messaging/privateConnectionAccess", () => ({ assertPrivateConnectionAccess: mocks.privateAccess }));
vi.mock("./messaging/service", () => ({ getActiveIntegration: mocks.integration, sendAndLog: mocks.send }));
import { quotesRouter } from "./routers/quotes";

describe("envio de orçamento pela integração existente", () => {
  let row: any; let consent: any; let delivery: any; let queries: { table: string; params: unknown[] }[];
  const ctx: any = { user: { id: 10, studioId: 1, role: "admin", openId: "owner" }, req: {}, res: {} };
  beforeEach(() => {
    vi.clearAllMocks(); vi.stubEnv("OUTBOUND_MESSAGING_DISABLED", "false"); vi.stubEnv("RAILWAY_ENVIRONMENT_ID", "");
    const payload = quoteStoredPayloadSchema.parse({ version: 1, editor: buildEmptyQuoteEditorData(), client: { id: 3, name: "João da Silva", phone: "5538999999999", email: null }, artist: { id: 2, name: "Artista", bio: null, specialty: null, photoUrl: null, phone: null, email: null, instagram: null }, studio: { name: "Estúdio", logoUrl: null, phone: null, email: null, instagram: null }, branding: { personalLogoUrl: null, personalLogoKey: null } });
    row = { id: 5, studioId: 1, clientId: 3, artistId: 2, version: 1, quoteNumber: "ORC-2026-00005", publicToken: "a".repeat(48), payload: JSON.stringify(payload), status: "finalized", validUntil: "2099-10-10 23:59:59", phone: "5538999999999", sentAt: null };
    consent = { enabled: 1, optedOutAt: null }; delivery = null; queries = [];
    mocks.client.mockResolvedValue({ id: 3, studioId: 1, name: "João da Silva", phone: row.phone });
    mocks.privateAccess.mockResolvedValue(undefined);
    mocks.integration.mockResolvedValue({ id: 7, studioId: 1, provider: "botconversa", sandboxMode: 0 });
    mocks.send.mockResolvedValue({ success: true, queued: true, duplicate: false });
    const dialect = new MySqlDialect();
    mocks.getDb.mockResolvedValue({ select: () => {
      let table = "";
      const chain: any = { from(t: any) { table = getTableName(t); return chain; }, innerJoin: () => chain, orderBy: () => chain,
        where(condition: any) { queries.push({ table, params: dialect.sqlToQuery(condition).params }); return chain; },
        limit: async () => table === "quote_proposals" ? [row] : table === "integration_contacts" ? consent ? [consent] : [] : delivery ? [delivery] : [] };
      return chain;
    } });
  });
  it("enqueues only the selected client's quote, without recording a sent timestamp before provider success", async () => {
    const caller = quotesRouter.createCaller(ctx);
    const info = await caller.deliveryInfo({ id: 5 });
    expect(info.available).toBe(true); expect(info.provider).toBe("botconversa");
    expect(info.message).toContain("Olá, João!"); expect(info.message).not.toMatch(/ORC-|da Silva/);
    expect(info.message).toContain(`/proposta/${row.publicToken}`);
    await Promise.all([caller.sendViaIntegration({ id: 5 }), caller.sendViaIntegration({ id: 5 })]);
    const [first, second] = mocks.send.mock.calls.map(call => call[0]);
    expect(first).toMatchObject({ studioId: 1, integrationId: 7, clientId: 3, artistId: 2, recipientType: "client", recipientName: "João", trigger: "quote_proposal:5" });
    expect(first.idempotencyKey).toBe(second.idempotencyKey); expect(row.sentAt).toBeNull();
    expect(mocks.privateAccess).toHaveBeenCalledWith(ctx.user, 1);
    expect(queries.filter(q => q.table === "message_queue").every(q => q.params.includes(1) && q.params.includes(3) && q.params.includes("quote_proposal:5"))).toBe(true);
  });
  it("shows queued and failed delivery without sending the same quote again", async () => {
    for (const status of ["pendente", "erro", "enviada"]) {
      delivery = { id: 99, status, sentAt: null, error: status === "erro" ? "Falha no provedor" : null };
      expect((await quotesRouter.createCaller(ctx).sendViaIntegration({ id: 5 })).duplicate).toBe(true);
    }
    expect(mocks.send).not.toHaveBeenCalled();
  });
  it("preserves private connection boundaries even when quote access is allowed", async () => {
    mocks.privateAccess.mockRejectedValue(new TRPCError({ code: "FORBIDDEN", message: "Conexão privada" }));
    const caller = quotesRouter.createCaller(ctx);
    expect(await caller.deliveryInfo({ id: 5 })).toMatchObject({ available: false, provider: null, phone: "", message: "" });
    await expect(caller.sendViaIntegration({ id: 5 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(mocks.integration).not.toHaveBeenCalled(); expect(mocks.send).not.toHaveBeenCalled();
  });
  it("blocks revoked consent, sandbox, missing integration and cancelled/expired proposals", async () => {
    const caller = quotesRouter.createCaller(ctx);
    consent = null; await expect(caller.sendViaIntegration({ id: 5 })).rejects.toThrow("autorização");
    consent = { enabled: 1, optedOutAt: "2026-09-26" }; await expect(caller.sendViaIntegration({ id: 5 })).rejects.toThrow("autorização");
    consent = { enabled: 1, optedOutAt: null };
    mocks.integration.mockResolvedValue({ id: 7, studioId: 1, provider: "botconversa", sandboxMode: 1 }); await expect(caller.sendViaIntegration({ id: 5 })).rejects.toThrow("produção");
    mocks.integration.mockResolvedValue(null); await expect(caller.sendViaIntegration({ id: 5 })).rejects.toThrow("Conecte");
    mocks.integration.mockResolvedValue({ id: 7, studioId: 1, provider: "botconversa", sandboxMode: 0 });
    row.status = "cancelled"; await expect(caller.sendViaIntegration({ id: 5 })).rejects.toThrow("disponível");
    row.status = "finalized"; row.validUntil = "2020-01-01 23:59:59"; await expect(caller.sendViaIntegration({ id: 5 })).rejects.toThrow("venceu");
    expect(mocks.send).not.toHaveBeenCalled();
  });
  it("keeps test environments unable to send", async () => {
    vi.stubEnv("OUTBOUND_MESSAGING_DISABLED", "true");
    await expect(quotesRouter.createCaller(ctx).sendViaIntegration({ id: 5 })).rejects.toThrow("bloqueado");
    expect(mocks.send).not.toHaveBeenCalled();
  });
});
