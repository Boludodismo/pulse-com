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
    openId: "sample-user",
    email: "sample@example.com",
    name: "Sample User",
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

describe("search with period filters", () => {
  it("should filter clients by creation date", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // Criar cliente recente (hoje)
    const recentClient = await caller.clients.create({
      name: "Cliente Recente Período",
      email: "recente.periodo@example.com",
    });

    // Buscar sem filtro de período
    const allResults = await caller.search.global({ term: "Período" });
    expect(allResults.clients.length).toBeGreaterThan(0);

    // Buscar apenas hoje
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);

    const todayResults = await caller.search.global({
      term: "Período",
      startDate: today,
      endDate: tomorrow,
    });

    expect(todayResults.clients.length).toBeGreaterThan(0);
    const foundClient = todayResults.clients.find((c) => c.id === recentClient.id);
    expect(foundClient).toBeDefined();
  });

  it.skip("should filter appointments by date", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // Criar cliente
    const client = await caller.clients.create({
      name: "Cliente Agendamento Período",
      email: "agendamento.periodo@example.com",
    });

    // Criar agendamento futuro
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 30);

    await caller.appointments.create({
      clientId: client.id,
      date: futureDate.toISOString(),
      duration: 60,
      service: "Tatuagem Período Teste",
      depositAmount: 0,
      totalAmount: 0,
      artist: "Artista Período",
      status: "agendado",
    });

    // Buscar sem filtro
    const allResults = await caller.search.global({ term: "Período Teste" });
    expect(allResults.appointments.length).toBeGreaterThan(0);

    // Buscar com filtro de período futuro (próximos 60 dias)
    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 60);

    const futureResults = await caller.search.global({
      term: "Período Teste",
      startDate,
      endDate,
    });

    expect(futureResults.appointments.length).toBeGreaterThan(0);
  });

  it("should filter transactions by date", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // Criar cliente
    const client = await caller.clients.create({
      name: "Cliente Transação Período",
      email: "transacao.periodo@example.com",
    });

    // Criar transação de hoje
    await caller.transactions.create({
      clientId: client.id,
      type: "entrada",
      category: "Tatuagem Período Transação",
      description: "Pagamento teste período",
      amount: 300,
      paymentMethod: "pix",
      date: new Date().toISOString(),
    });

    // Buscar sem filtro
    const allResults = await caller.search.global({ term: "Período Transação" });
    expect(allResults.transactions.length).toBeGreaterThan(0);

    // Buscar apenas hoje
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);

    const todayResults = await caller.search.global({
      term: "Período Transação",
      startDate: today,
      endDate: tomorrow,
    });

    expect(todayResults.transactions.length).toBeGreaterThan(0);
  });

  it("should return empty results when period filter excludes all data", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // Buscar com período muito antigo (ano 2000)
    const veryOldStart = new Date("2000-01-01");
    const veryOldEnd = new Date("2000-12-31");

    const results = await caller.search.global({
      term: "Período",
      startDate: veryOldStart,
      endDate: veryOldEnd,
    });

    // Não deve encontrar nada no ano 2000
    expect(results.clients).toEqual([]);
    expect(results.appointments).toEqual([]);
    expect(results.transactions).toEqual([]);
  });
});
