import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { getTableConfig } from "drizzle-orm/mysql-core";
const mocks = vi.hoisted(() => ({
  getDb: vi.fn(),
  getUserById: vi.fn(),
  hasModulePermission: vi.fn(),
  listUserPermissions: vi.fn(),
}));
vi.mock("./db", () => ({ getDb: mocks.getDb, getUserById: mocks.getUserById }));
vi.mock("./saas", () => ({
  isUserAccessActive: vi.fn(async () => true),
  hasModulePermission: mocks.hasModulePermission,
  listUserPermissions: mocks.listUserPermissions,
}));
import { intelligentInboxRouter } from "./routers/intelligentInbox";
import { inboxStatus } from "./intelligentInbox/service";
import { ENV } from "./_core/env";
import {
  inboxSyncState,
  inboxConversations,
  inboxMessages,
  inboxSummaries,
} from "../drizzle/intelligentInboxSchema";
const ctx = (studioId = 10, role = "superadmin") =>
  ({
    user: { id: 5, openId: "owner", email: "owner@example.test", role, studioId, isActive: 1, artistId: 7 },
    studioId: 999,
  }) as any;
beforeEach(() => {
  vi.clearAllMocks();
  ENV.authMode = "local";
  vi.stubEnv("LOCAL_ADMIN_EMAIL", "owner@example.test");
  mocks.listUserPermissions.mockResolvedValue([]);
  mocks.hasModulePermission.mockResolvedValue(false);
});
describe("Central Inteligente privada", () => {
  it("retorna indicadores zerados quando não há banco ou integração", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const result = await intelligentInboxRouter.createCaller(ctx()).dashboard();
    expect(Object.values(result.metrics).every(v => v === 0)).toBe(true);
    expect(result.status.operational).toBe(false);
    expect(mocks.getDb).toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
  it("continua não operacional mesmo se alguém ligar a flag por engano", () => {
    const previous = ENV.intelligentInboxEnabled;
    try {
      ENV.intelligentInboxEnabled = true;
      expect(inboxStatus()).toMatchObject({
        requestedEnabled: true,
        operational: false,
        webhookActive: false,
        summaryJobActive: false,
        aiConnected: false,
      });
    } finally {
      ENV.intelligentInboxEnabled = previous;
    }
  });
  it("exige login", async () => {
    await expect(
      intelligentInboxRouter.createCaller({ user: null } as any).dashboard()
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
  it("exige um estúdio ativo inclusive para superadministrador", async () => {
    await expect(
      intelligentInboxRouter
        .createCaller(ctx(null as any, "superadmin"))
        .status()
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
  it("não aceita tenant fornecido no payload", async () => {
    await expect(
      intelligentInboxRouter
        .createCaller(ctx())
        .conversations({ limit: 25, studioId: 20 } as any)
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
  it.each(["admin", "collaborator", "user"])("nega %s mesmo com todas as permissões RBAC", async role => {
    mocks.hasModulePermission.mockResolvedValue(true);
    mocks.listUserPermissions.mockResolvedValue([{module: "intelligent_inbox", canRead: 1, canWrite: 1}]);
    const c = intelligentInboxRouter.createCaller(ctx(10, role));
    const calls = [() => c.access(), () => c.status(), () => c.dashboard(),
      () => c.conversations({limit: 10}), () => c.messages({conversationId: 1, limit: 10}),
      () => c.settings(), () => c.summaries({limit: 10}), () => c.priorities({limit: 10}),
      () => c.opportunities({limit: 10}), () => c.clientContext({clientId: 1}),
      () => c.suggestedReply({conversationId: 1}), () => c.configure(),
      () => c.generateSuggestedReply({conversationId: 1}),
      () => c.sendReply({conversationId: 1, text: "Oi", requestId: "550e8400-e29b-41d4-a716-446655440000"})];
    for (const call of calls) await expect(call()).rejects.toMatchObject({code: "FORBIDDEN"});
    expect(mocks.getDb).not.toHaveBeenCalled();
  });
  it("nega outro superadmin e permite apenas resposta manual ao proprietário", async () => {
    const other = ctx(); other.user.email = "other@example.test";
    await expect(intelligentInboxRouter.createCaller(other).dashboard()).rejects.toMatchObject({code: "FORBIDDEN"});
    const access = await intelligentInboxRouter.createCaller(ctx()).access();
    expect(access.permissions.filter(p => p.canWrite).map(p => p.module)).toEqual(["inbox_conversations"]);
  });
  it("nega se a identidade proprietária não estiver configurada", async () => {
    vi.stubEnv("LOCAL_ADMIN_EMAIL", "");
    await expect(intelligentInboxRouter.createCaller(ctx()).status()).rejects.toMatchObject({code: "FORBIDDEN"});
  });
  it("ler sugestões não permite gerá-las", async () => {
    mocks.hasModulePermission.mockImplementation(async p => !p.write);
    await expect(
      intelligentInboxRouter
        .createCaller(ctx(10, "collaborator"))
        .generateSuggestedReply({ conversationId: 1 })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
  it("nem administrador consegue configurar envio ou gerar resposta nesta etapa", async () => {
    const c = intelligentInboxRouter.createCaller(ctx());
    expect(await c.configure()).toMatchObject({
      accepted: false,
      reason: "read_only",
    });
    expect(await c.generateSuggestedReply({ conversationId: 1 })).toMatchObject(
      { accepted: false }
    );
    expect(mocks.getDb).not.toHaveBeenCalled();
  });
  it("retorna páginas vazias e não lê cliente de outro estúdio", async () => {
    const c = intelligentInboxRouter.createCaller(ctx());
    expect(await c.messages({ conversationId: 999, limit: 10 })).toMatchObject({
      items: [],
      nextCursor: null,
    });
    expect(await c.clientContext({ clientId: 999 })).toMatchObject({
      currentSummary: null,
    });
    expect(mocks.getDb).toHaveBeenCalled();
  });
  it("limita tamanho de página e busca", async () => {
    const c = intelligentInboxRouter.createCaller(ctx());
    await expect(c.conversations({ limit: 101 })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    await expect(
      c.conversations({ limit: 10, search: "x".repeat(151) })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
  it("mantém todas as novas tabelas com tenant obrigatório e índices", () => {
    for (const table of [
      inboxSyncState,
      inboxConversations,
      inboxMessages,
      inboxSummaries,
    ]) {
      const config = getTableConfig(table);
      expect(config.columns.find(c => c.name === "studio_id")?.notNull).toBe(
        true
      );
      expect(config.indexes.length).toBeGreaterThan(0);
    }
    for (const table of [inboxConversations, inboxMessages, inboxSummaries]) {
      const fk = getTableConfig(table).foreignKeys[0].reference();
      expect(fk.columns.map(c => c.name)[0]).toBe("studio_id");
      expect(fk.foreignColumns.map(c => c.name)[0]).toBe("studio_id");
    }
  });
  it("migration nova não apaga registros nem cria credenciais e contém quatro tabelas", () => {
    const sql = readFileSync("drizzle/0055_intelligent_inbox.sql", "utf8");
    expect(sql.match(/CREATE TABLE IF NOT EXISTS/g)).toHaveLength(4);
    expect(sql).not.toMatch(/\b(DROP|DELETE|TRUNCATE|INSERT)\b/i);
    expect(sql).not.toMatch(/api_key|secret|access_token/i);
    expect(sql).toContain(
      "'clients','appointments','stock','finance','anamnesis','pod','reports'"
    );
  });
  it("não registra a Central no scheduler nem cria rota webhook", () => {
    expect(readFileSync("server/scheduler.ts", "utf8")).not.toMatch(
      /intelligentInbox|inboxSummary/i
    );
    const router = readFileSync("server/routers/intelligentInbox.ts", "utf8");
    expect(router).not.toMatch(/publicProcedure|setInterval|fetch\(/);
  });
});
