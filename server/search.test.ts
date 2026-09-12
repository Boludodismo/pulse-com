import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
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

describe("search.global", () => {
  it("should search across clients, appointments, and transactions", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // Criar cliente de teste
    const client = await caller.clients.create({
      name: "João Silva Busca",
      email: "joao.busca@example.com",
      phone: "(11) 98765-4321",
    });

    // Criar agendamento de teste
    await caller.appointments.create({
      clientId: client.id,
      date: new Date("2025-02-15T10:00:00").toISOString(),
      duration: 120,
      service: "Tatuagem Tribal Busca",
      depositAmount: 0,
      totalAmount: 0,
      artist: "Artista Busca",
      status: "agendado",
    });

    // Criar transação de teste
    await caller.transactions.create({
      clientId: client.id,
      type: "entrada",
      category: "Tatuagem Busca",
      description: "Pagamento de tatuagem busca",
      amount: 500,
      paymentMethod: "pix",
      date: new Date("2025-02-15").toISOString(),
    });

    // Buscar por "Busca"
    const results = await caller.search.global({ term: "Busca" });

    // Verificar que encontrou resultados em todas as categorias
    expect(results.clients.length).toBeGreaterThan(0);
    expect(results.appointments.length).toBeGreaterThan(0);
    expect(results.transactions.length).toBeGreaterThan(0);

    // Verificar que o cliente foi encontrado
    const foundClient = results.clients.find((c) => c.id === client.id);
    expect(foundClient).toBeDefined();
    expect(foundClient?.name).toBe("João Silva Busca");

    // Verificar que o agendamento foi encontrado
    const foundAppointment = results.appointments.find(
      (a) => a.service === "Tatuagem Tribal Busca"
    );
    expect(foundAppointment).toBeDefined();
    expect(foundAppointment?.artist).toBe("Artista Busca");

    // Verificar que a transação foi encontrada
    const foundTransaction = results.transactions.find(
      (t) => t.category === "Tatuagem Busca"
    );
    expect(foundTransaction).toBeDefined();
    expect(foundTransaction?.amount).toBe(500);
  });

  it("should return empty results for non-existent term", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const results = await caller.search.global({
      term: "TermoQueNaoExiste123XYZ",
    });

    expect(results.clients).toEqual([]);
    expect(results.appointments).toEqual([]);
    expect(results.transactions).toEqual([]);
  });

  it("should limit results to 10 per category", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // Criar 15 clientes com termo comum
    for (let i = 0; i < 15; i++) {
      await caller.clients.create({
        name: `Cliente Limite ${i}`,
        email: `limite${i}@example.com`,
      });
    }

    const results = await caller.search.global({ term: "Limite" });

    // Verificar que retorna no máximo 10 resultados
    expect(results.clients.length).toBeLessThanOrEqual(10);
  });
});
