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
    openId: "admin-dashboard-test",
    name: "Admin Dashboard Test",
    email: "admin-dashboard@test.com",
    role: "admin",
    artistId: null,
    isActive: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
    loginMethod: "test",
  },
});

describe("Audit Dashboard", () => {
  describe("Statistics Endpoint", () => {
    it("should return audit statistics", async () => {
      const caller = appRouter.createCaller(createAdminContext());

      const stats = await caller.audit.statistics();

      expect(stats).toBeDefined();
      expect(typeof stats.totalActions).toBe("number");
      expect(typeof stats.actionsLast24h).toBe("number");
      expect(stats.totalActions).toBeGreaterThanOrEqual(0);
      expect(stats.actionsLast24h).toBeGreaterThanOrEqual(0);
    });

    it("should return most active user when available", async () => {
      const caller = appRouter.createCaller(createAdminContext());

      const stats = await caller.audit.statistics();

      if (stats.mostActiveUser) {
        expect(stats.mostActiveUser).toHaveProperty("name");
        expect(stats.mostActiveUser).toHaveProperty("count");
        expect(typeof stats.mostActiveUser.name).toBe("string");
        expect(typeof stats.mostActiveUser.count).toBe("number");
      }
    });

    it("should return most modified entity when available", async () => {
      const caller = appRouter.createCaller(createAdminContext());

      const stats = await caller.audit.statistics();

      if (stats.mostModifiedEntity) {
        expect(stats.mostModifiedEntity).toHaveProperty("entity");
        expect(stats.mostModifiedEntity).toHaveProperty("count");
        expect(typeof stats.mostModifiedEntity.entity).toBe("string");
        expect(typeof stats.mostModifiedEntity.count).toBe("number");
      }
    });
  });

  describe("Actions By Day Endpoint", () => {
    it("should return actions grouped by day", async () => {
      const caller = appRouter.createCaller(createAdminContext());
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 7);

      const actionsByDay = await caller.audit.actionsByDay({ startDate, endDate });

      expect(Array.isArray(actionsByDay)).toBe(true);
      if (actionsByDay.length > 0) {
        actionsByDay.forEach((item) => {
          expect(item).toHaveProperty("date");
          expect(item).toHaveProperty("count");
          expect(typeof item.date).toBe("string");
          expect(typeof item.count).toBe("number");
        });
      }
    });
  });

  describe("Actions By Type Endpoint", () => {
    it("should return actions grouped by type", async () => {
      const caller = appRouter.createCaller(createAdminContext());

      const actionsByType = await caller.audit.actionsByType();

      expect(Array.isArray(actionsByType)).toBe(true);
      if (actionsByType.length > 0) {
        actionsByType.forEach((item) => {
          expect(item).toHaveProperty("action");
          expect(item).toHaveProperty("count");
          expect(typeof item.action).toBe("string");
          expect(typeof item.count).toBe("number");
          expect(item.count).toBeGreaterThan(0);
        });
      }
    });

    it("should filter by date range", async () => {
      const caller = appRouter.createCaller(createAdminContext());
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 30);

      const actionsByType = await caller.audit.actionsByType({ startDate, endDate });

      expect(Array.isArray(actionsByType)).toBe(true);
    });
  });

  describe("Actions By Entity Endpoint", () => {
    it("should return actions grouped by entity", async () => {
      const caller = appRouter.createCaller(createAdminContext());

      const actionsByEntity = await caller.audit.actionsByEntity();

      expect(Array.isArray(actionsByEntity)).toBe(true);
      if (actionsByEntity.length > 0) {
        actionsByEntity.forEach((item) => {
          expect(item).toHaveProperty("entity");
          expect(item).toHaveProperty("count");
          expect(typeof item.entity).toBe("string");
          expect(typeof item.count).toBe("number");
          expect(item.count).toBeGreaterThan(0);
        });
      }
    });

    it("should filter by date range", async () => {
      const caller = appRouter.createCaller(createAdminContext());
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 30);

      const actionsByEntity = await caller.audit.actionsByEntity({ startDate, endDate });

      expect(Array.isArray(actionsByEntity)).toBe(true);
    });
  });

  describe("Top Active Users Endpoint", () => {
    it.skip("should return top active users", async () => {
      const caller = appRouter.createCaller(createAdminContext());

      const topUsers = await caller.audit.topActiveUsers({ limit: 5 });

      expect(Array.isArray(topUsers)).toBe(true);
      if (topUsers.length > 0) {
        expect(topUsers.length).toBeLessThanOrEqual(5);
        topUsers.forEach((user) => {
          expect(user).toHaveProperty("userName");
          expect(user).toHaveProperty("count");
          expect(typeof user.userName).toBe("string");
          expect(typeof user.count).toBe("number");
          expect(user.count).toBeGreaterThan(0);
        });

        // Verificar ordem decrescente
        for (let i = 0; i < topUsers.length - 1; i++) {
          expect(topUsers[i].count).toBeGreaterThanOrEqual(topUsers[i + 1].count);
        }
      }
    });

    it.skip("should respect limit parameter", async () => {
      const caller = appRouter.createCaller(createAdminContext());

      const topUsers = await caller.audit.topActiveUsers({ limit: 3 });

      expect(Array.isArray(topUsers)).toBe(true);
      expect(topUsers.length).toBeLessThanOrEqual(3);
    });
  });

  describe("Heatmap Endpoint", () => {
    it("should return heatmap data", async () => {
      const caller = appRouter.createCaller(createAdminContext());

      const heatmap = await caller.audit.heatmap();

      expect(Array.isArray(heatmap)).toBe(true);
      if (heatmap.length > 0) {
        heatmap.forEach((item) => {
          expect(item).toHaveProperty("hour");
          expect(item).toHaveProperty("dayOfWeek");
          expect(item).toHaveProperty("count");
          expect(typeof item.hour).toBe("number");
          expect(typeof item.dayOfWeek).toBe("number");
          expect(typeof item.count).toBe("number");
          expect(item.hour).toBeGreaterThanOrEqual(0);
          expect(item.hour).toBeLessThanOrEqual(23);
          expect(item.dayOfWeek).toBeGreaterThanOrEqual(1);
          expect(item.dayOfWeek).toBeLessThanOrEqual(7);
          expect(item.count).toBeGreaterThan(0);
        });
      }
    });
  });

  describe("Permission Tests", () => {
    it("should deny access to non-admin users", async () => {
      const userContext: Context = {
        req: {
          ip: "127.0.0.1",
          headers: { "user-agent": "Test Browser" },
          socket: { remoteAddress: "127.0.0.1" },
        } as any,
        res: {} as any,
        user: {
          id: 2,
          openId: "regular-user",
          name: "Regular User",
          email: "user@test.com",
          role: "collaborator",
          artistId: null,
          isActive: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
          lastSignedIn: new Date(),
          loginMethod: "test",
        },
      };

      const caller = appRouter.createCaller(userContext);

      await expect(caller.audit.statistics()).rejects.toThrow("Acesso negado");
      await expect(
        caller.audit.actionsByDay({ startDate: new Date(), endDate: new Date() })
      ).rejects.toThrow("Acesso negado");
      await expect(caller.audit.actionsByType()).rejects.toThrow("Acesso negado");
      await expect(caller.audit.actionsByEntity()).rejects.toThrow("Acesso negado");
      await expect(caller.audit.topActiveUsers()).rejects.toThrow("Acesso negado");
      await expect(caller.audit.heatmap()).rejects.toThrow("Acesso negado");
    });
  });
});
