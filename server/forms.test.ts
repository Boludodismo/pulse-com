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

describe("appointments router", () => {
  it("should create a new appointment", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // Primeiro cria um cliente
    const client = await caller.clients.create({
      name: "Maria Santos",
      email: "maria@example.com",
      phone: "(11) 99999-9999",
    });

    // Cria um agendamento para o cliente
    const appointment = await caller.appointments.create({
      clientId: client.id,
      date: new Date("2024-12-20T14:00:00").toISOString(),
      duration: 120,
      service: "Tatuagem colorida no braço",
      depositAmount: 0,
      totalAmount: 0,
      artist: "Carlos Tattoo",
      notes: "Cliente prefere cores vibrantes",
    });

    expect(appointment).toBeDefined();
    expect(appointment.service).toBe("Tatuagem colorida no braço");
    expect(appointment.artist).toBe("Carlos Tattoo");
  });

  it("should list appointments by client", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // Cria um cliente
    const client = await caller.clients.create({
      name: "Pedro Costa",
      email: "pedro@example.com",
    });

    // Busca agendamentos do cliente
    const appointments = await caller.appointments.getByClientId({
      clientId: client.id,
    });

    expect(Array.isArray(appointments)).toBe(true);
  });
});

describe("transactions router", () => {
  it("should create a new transaction", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // Cria um cliente
    const client = await caller.clients.create({
      name: "Ana Lima",
      email: "ana@example.com",
    });

    // Cria uma transação
    const transaction = await caller.transactions.create({
      clientId: client.id,
      type: "entrada",
      category: "Tatuagem",
      description: "Pagamento de tatuagem realista",
      amount: 50000, // R$ 500,00 em centavos
      paymentMethod: "pix",
      date: new Date().toISOString(),
    });

    expect(transaction).toBeDefined();
    expect(transaction.type).toBe("entrada");
    expect(transaction.amount).toBe(50000);
  });

  it("should list transactions by client", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // Cria um cliente
    const client = await caller.clients.create({
      name: "Lucas Oliveira",
      email: "lucas@example.com",
    });

    // Busca transações do cliente
    const transactions = await caller.transactions.getByClientId({
      clientId: client.id,
    });

    expect(Array.isArray(transactions)).toBe(true);
  });
});

describe("notes router", () => {
  it("should create a new note", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // Cria um cliente
    const client = await caller.clients.create({
      name: "Fernanda Souza",
      email: "fernanda@example.com",
    });

    // Cria uma nota
    const note = await caller.notes.create({
      clientId: client.id,
      content: "Cliente muito comunicativa, gosta de conversar durante a sessão",
    });

    expect(note).toBeDefined();
    expect(note.content).toContain("comunicativa");
  });

  it("should list notes by client", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // Cria um cliente
    const client = await caller.clients.create({
      name: "Roberto Alves",
      email: "roberto@example.com",
    });

    // Busca notas do cliente
    const notes = await caller.notes.getByClientId({
      clientId: client.id,
    });

    expect(Array.isArray(notes)).toBe(true);
  });

  it("should delete a note", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // Cria um cliente
    const client = await caller.clients.create({
      name: "Juliana Martins",
      email: "juliana@example.com",
    });

    // Cria uma nota
    const note = await caller.notes.create({
      clientId: client.id,
      content: "Nota temporária para teste",
    });

    // Deleta a nota
    const result = await caller.notes.delete({
      id: note.id,
    });

    expect(result.success).toBe(true);
  });
});
