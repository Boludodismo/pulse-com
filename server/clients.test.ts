import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

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


type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): { ctx: TrpcContext } {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user",
    email: "test@example.com",
    name: "Test User",
    loginMethod: "manus",
    role: "admin",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
    studioId: 1,
  };

  const ctx: TrpcContext = {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };

  return { ctx };
}

describe("clients router", () => {
  it("should list clients", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.clients.list();

    expect(Array.isArray(result)).toBe(true);
  });

  it("should create a new client", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const clientData = {
      name: "João Silva",
      email: "joao@example.com",
      phone: "(11) 98765-4321",
    };

    const result = await caller.clients.create(clientData);

    expect(result).toBeDefined();
  });

  it("should search clients by term", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.clients.search({ term: "João" });

    expect(Array.isArray(result)).toBe(true);
  });
});

describe("dashboard router", () => {
  it("should get dashboard metrics", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.dashboard.metrics();

    expect(result).toBeDefined();
    expect(typeof result.totalClients).toBe("number");
    expect(typeof result.totalAppointments).toBe("number");
    // totalRevenue pode ser string ou number dependendo do driver MySQL
    expect(["number", "string"].includes(typeof result.totalRevenue)).toBe(true);
    expect(typeof result.upcomingBirthdaysCount).toBe("number");
  });

  it("should get top clients", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.dashboard.topClients({ limit: 5 });

    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeLessThanOrEqual(5);
  });

  it("should get upcoming birthdays", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.dashboard.upcomingBirthdays({ daysAhead: 30 });

    expect(Array.isArray(result)).toBe(true);
  });
});
