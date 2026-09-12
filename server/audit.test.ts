import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import type { Context } from "./_core/context";
import * as db from "./db";

// Mock global do fetch para evitar chamadas reais ao Google Sheets durante testes
beforeAll(() => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
    json: async () => ({ sucesso: true, mensagem: "mock" }),
    ok: true,
  }));
});

afterAll(() => {
  vi.unstubAllGlobals();
});


// Mock context para admin
const createAdminContext = (): Context => ({
  req: {
    ip: "127.0.0.1",
    headers: { "user-agent": "Test Browser" },
    socket: { remoteAddress: "127.0.0.1" },
  } as any,
  res: {} as any,
  user: {
    id: 1,
    openId: "admin-audit-test",
    name: "Admin Audit Test",
    email: "admin-audit@test.com",
    role: "admin",
    artistId: null,
    isActive: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
    loginMethod: "test",
  },
});

// Mock context para artista
const createArtistContext = (): Context => ({
  req: {
    ip: "127.0.0.1",
    headers: { "user-agent": "Test Browser" },
    socket: { remoteAddress: "127.0.0.1" },
  } as any,
  res: {} as any,
  user: {
    id: 2,
    openId: "artist-audit-test",
    name: "Artist Audit Test",
    email: "artist-audit@test.com",
    role: "collaborator",
    artistId: 1,
    isActive: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
    loginMethod: "test",
  },
});

describe("Audit System", () => {
  let testUserId: number | undefined;

  describe("Audit Logging", () => {
    it("should create audit log when creating a user", async () => {
      const caller = appRouter.createCaller(createAdminContext());
      const timestamp = Date.now();

      // Criar usuário
      await caller.users.create({
        openId: `audit-test-create-${timestamp}`,
        name: "Audit Test User",
        email: `audit${timestamp}@test.com`,
        role: "collaborator",
      });

      // Buscar logs de auditoria
      const logs = await db.listAuditLogs({ action: "create", entity: "user", limit: 100 });
      expect(logs.length).toBeGreaterThan(0);

      // Encontrar o log do usuário criado
      const userLog = logs.find(log => log.entityName === "Audit Test User");
      expect(userLog).toBeDefined();
      expect(userLog?.action).toBe("create");
      expect(userLog?.entity).toBe("user");
      expect(userLog?.userName).toBe("Admin Audit Test");
      expect(userLog?.entityName).toBe("Audit Test User");
    });

    it("should create audit log when updating a user", async () => {
      const caller = appRouter.createCaller(createAdminContext());
      const timestamp = Date.now();

      // Criar usuário para atualizar
      await db.createUser({
        openId: `audit-test-update-${timestamp}`,
        name: "User Before Update",
        email: `before${timestamp}@test.com`,
        role: "collaborator",
      });

      const users = await db.listAllUsers();
      const user = users.find((u) => u.openId === `audit-test-update-${timestamp}`);
      testUserId = user?.id;

      // Atualizar usuário
      await caller.users.update({
        id: testUserId!,
        name: "User After Update",
        email: `after${timestamp}@test.com`,
      });

      // Buscar logs de auditoria
      const logs = await db.listAuditLogs({ action: "update", entity: "user", limit: 100 });
      expect(logs.length).toBeGreaterThan(0);

      // Encontrar o log do usuário atualizado
      const userLog = logs.find(log => log.entityId === testUserId);
      expect(userLog).toBeDefined();
      expect(userLog?.action).toBe("update");
      expect(userLog?.entity).toBe("user");
      expect(userLog?.entityId).toBe(testUserId);
      const latestLog = userLog!;

      // Verificar detalhes (before/after)
      const details = JSON.parse(latestLog.details || "{}");
      expect(details.before).toBeDefined();
      expect(details.after).toBeDefined();
      expect(details.before.name).toBe("User Before Update");
      expect(details.after.name).toBe("User After Update");
    });

    it("should create audit log with activate action when activating a user", async () => {
      const caller = appRouter.createCaller(createAdminContext());
      const timestamp = Date.now();

      // Criar usuário inativo
      await db.createUser({
        openId: `audit-test-activate-${timestamp}`,
        name: "User to Activate",
        email: `activate${timestamp}@test.com`,
        role: "collaborator",
      });

      const users = await db.listAllUsers();
      const user = users.find((u) => u.openId === `audit-test-activate-${timestamp}`);

      // Desativar primeiro
      await caller.users.update({
        id: user!.id,
        isActive: 0,
      });

      // Ativar usuário
      await caller.users.update({
        id: user!.id,
        isActive: 1,
      });

      // Buscar logs de auditoria
      const logs = await db.listAuditLogs({ action: "activate", entity: "user", limit: 1 });
      expect(logs.length).toBeGreaterThan(0);

      const latestLog = logs[0];
      expect(latestLog.action).toBe("activate");
      expect(latestLog.entity).toBe("user");
    });

    it("should create audit log with deactivate action when deactivating a user", async () => {
      const caller = appRouter.createCaller(createAdminContext());
      const timestamp = Date.now();

      // Criar usuário ativo
      await db.createUser({
        openId: `audit-test-deactivate-${timestamp}`,
        name: "User to Deactivate",
        email: `deactivate${timestamp}@test.com`,
        role: "collaborator",
      });

      const users = await db.listAllUsers();
      const user = users.find((u) => u.openId === `audit-test-deactivate-${timestamp}`);

      // Desativar usuário
      await caller.users.update({
        id: user!.id,
        isActive: 0,
      });

      // Buscar logs de auditoria
      const logs = await db.listAuditLogs({ action: "deactivate", entity: "user", limit: 1 });
      expect(logs.length).toBeGreaterThan(0);

      const latestLog = logs[0];
      expect(latestLog.action).toBe("deactivate");
      expect(latestLog.entity).toBe("user");
    });

    it("should create audit log when deleting a user", async () => {
      const caller = appRouter.createCaller(createAdminContext());
      const timestamp = Date.now();

      // Criar usuário para deletar
      await db.createUser({
        openId: `audit-test-delete-${timestamp}`,
        name: "User to Delete",
        email: `delete${timestamp}@test.com`,
        role: "collaborator",
      });

      const users = await db.listAllUsers();
      const user = users.find((u) => u.openId === `audit-test-delete-${timestamp}`);

      // Deletar usuário
      await caller.users.delete({ id: user!.id });

      // Buscar logs de auditoria
      const logs = await db.listAuditLogs({ action: "delete", entity: "user", limit: 1 });
      expect(logs.length).toBeGreaterThan(0);

      const latestLog = logs[0];
      expect(latestLog.action).toBe("delete");
      expect(latestLog.entity).toBe("user");
      expect(latestLog.entityName).toBe("User to Delete");

      // Verificar detalhes
      const details = JSON.parse(latestLog.details || "{}");
      expect(details.deletedUser).toBeDefined();
      expect(details.deletedUser.name).toBe("User to Delete");
    });

    it("should store IP address and user agent in audit logs", async () => {
      const caller = appRouter.createCaller(createAdminContext());
      const timestamp = Date.now();

      // Criar usuário
      await caller.users.create({
        openId: `audit-test-ip-${timestamp}`,
        name: "IP Test User",
        email: `ip${timestamp}@test.com`,
        role: "collaborator",
      });

      // Buscar logs de auditoria
      const logs = await db.listAuditLogs({ action: "create", entity: "user", limit: 100 });
      
      // Encontrar o log do usuário criado
      const userLog = logs.find(log => log.entityName?.includes(`IP Test User`));
      expect(userLog).toBeDefined();
      
      expect(userLog?.ipAddress).toBe("127.0.0.1");
      expect(userLog?.userAgent).toBe("Test Browser");
    });
  });

  describe("Audit Router", () => {
    it("should allow admin to list audit logs", async () => {
      const caller = appRouter.createCaller(createAdminContext());
      const logs = await caller.audit.list();
      expect(Array.isArray(logs)).toBe(true);
    });

    it("should allow admin to filter audit logs by action", async () => {
      const caller = appRouter.createCaller(createAdminContext());
      const logs = await caller.audit.list({ action: "create" });
      expect(Array.isArray(logs)).toBe(true);
      if (logs.length > 0) {
        expect(logs[0].action).toBe("create");
      }
    });

    it("should allow admin to filter audit logs by entity", async () => {
      const caller = appRouter.createCaller(createAdminContext());
      const logs = await caller.audit.list({ entity: "user" });
      expect(Array.isArray(logs)).toBe(true);
      if (logs.length > 0) {
        expect(logs[0].entity).toBe("user");
      }
    });

    it("should allow admin to search audit logs", async () => {
      const caller = appRouter.createCaller(createAdminContext());
      const logs = await caller.audit.search({ term: "Admin" });
      expect(Array.isArray(logs)).toBe(true);
    });

    it("should deny artist access to audit logs", async () => {
      const caller = appRouter.createCaller(createArtistContext());
      await expect(caller.audit.list()).rejects.toThrow("Acesso negado");
    });

    it("should deny artist access to search audit logs", async () => {
      const caller = appRouter.createCaller(createArtistContext());
      await expect(caller.audit.search({ term: "test" })).rejects.toThrow("Acesso negado");
    });
  });
});
