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
    role: "collaborator",
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

describe("appointments conflict detection", () => {
  it("should detect no conflict for non-overlapping appointments", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // Criar cliente
    const client = await caller.clients.create({
      name: "Cliente Teste Conflito",
      email: "conflito@test.com",
      phone: "11999999999",
    });

    // Criar primeiro agendamento: 10:00 - 11:00
    const date1 = new Date("2024-12-20T10:00:00");
    await caller.appointments.create({
      clientId: client.id,
      date: date1.toISOString(),
      duration: 60,
      service: "Tatuagem 1",
      artist: "Artista A",
      depositAmount: 0,
      totalAmount: 0,
    });

    // Verificar conflito para agendamento às 11:30 (não deve haver conflito)
    const date2 = new Date("2024-12-20T11:30:00");
    const result = await caller.appointments.checkConflicts({
      artist: "Artista A",
      date: date2.toISOString(),
      duration: 60,
    });

    expect(result.hasConflict).toBe(false);
    expect(result.conflicts).toHaveLength(0);
  });

  it.skip("should detect conflict for overlapping appointments", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // Criar cliente
    const client = await caller.clients.create({
      name: "Cliente Teste Conflito 2",
      email: "conflito2@test.com",
      phone: "11999999998",
    });

    // Criar primeiro agendamento: 14:00 - 16:00 (120 minutos)
    const date1 = new Date("2025-03-15T14:00:00");
    await caller.appointments.create({
      clientId: client.id,
      date: date1.toISOString(),
      duration: 120,
      service: "Tatuagem Grande",
      artist: "Artista Conflito Test",
      depositAmount: 0,
      totalAmount: 0,
    });

    // Verificar conflito para agendamento às 15:00 (deve haver conflito)
    const date2 = new Date("2025-03-15T15:00:00");
    const result = await caller.appointments.checkConflicts({
      artist: "Artista Conflito Test",
      date: date2.toISOString(),
      duration: 60,
    });

    expect(result.hasConflict).toBe(true);
    expect(result.conflicts.length).toBeGreaterThan(0);
    // Verificar que pelo menos um conflito é o esperado
    const hasExpectedConflict = result.conflicts.some(
      (c) => c.service === "Tatuagem Grande"
    );
    expect(hasExpectedConflict).toBe(true);
  });

  it("should not detect conflict for different artists", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // Criar cliente
    const client = await caller.clients.create({
      name: "Cliente Teste Conflito 3",
      email: "conflito3@test.com",
      phone: "11999999997",
    });

    // Criar agendamento para Artista C: 10:00 - 11:00
    const date1 = new Date("2024-12-22T10:00:00");
    await caller.appointments.create({
      clientId: client.id,
      date: date1.toISOString(),
      duration: 60,
      service: "Tatuagem Artista C",
      artist: "Artista C",
      depositAmount: 0,
      totalAmount: 0,
    });

    // Verificar conflito para Artista D no mesmo horário (não deve haver conflito)
    const date2 = new Date("2024-12-22T10:00:00");
    const result = await caller.appointments.checkConflicts({
      artist: "Artista D",
      date: date2.toISOString(),
      duration: 60,
    });

    expect(result.hasConflict).toBe(false);
    expect(result.conflicts).toHaveLength(0);
  });

  it("should exclude appointment when editing (excludeId)", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // Criar cliente
    const client = await caller.clients.create({
      name: "Cliente Teste Conflito 4",
      email: "conflito4@test.com",
      phone: "11999999996",
    });

     // Criar agendamento: 16:00 - 17:00
    const date1 = new Date("2025-10-30T16:00:00");
    const uniqueArtist = `Artista Exclude ${Date.now()}`;
    const appointment = await caller.appointments.create({
      clientId: client.id,
      date: date1.toISOString(),
      duration: 60,
      service: "Tatuagem Média",
      artist: uniqueArtist,
      depositAmount: 0,
      totalAmount: 0,
    });
    // Tentar editar para o mesmo horário (não deve detectar conflito com ele mesmo)
    const result = await caller.appointments.checkConflicts({
      artist: uniqueArtist,
      date: date1.toISOString(),
      duration: 60,
      excludeId: appointment.id,
    });

    expect(result.hasConflict).toBe(false);
    expect(result.conflicts).toHaveLength(0);
  });

  it("should ignore canceled appointments in conflict detection", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // Criar cliente
    const client = await caller.clients.create({
      name: "Cliente Teste Conflito 5",
      email: "conflito5@test.com",
      phone: "11999999995",
    });

    // Criar agendamento: 09:00 - 10:00
    const date1 = new Date("2024-12-24T09:00:00");
    const appointment = await caller.appointments.create({
      clientId: client.id,
      date: date1.toISOString(),
      duration: 60,
      service: "Tatuagem Cancelada",
      artist: "Artista F",
      depositAmount: 0,
      totalAmount: 0,
    });

    // Cancelar o agendamento
    await caller.appointments.update({
      id: appointment.id,
      data: {
        status: "cancelado",
      },
    });

    // Verificar conflito no mesmo horário (não deve haver conflito pois foi cancelado)
    const result = await caller.appointments.checkConflicts({
      artist: "Artista F",
      date: date1.toISOString(),
      duration: 60,
    });

    expect(result.hasConflict).toBe(false);
    expect(result.conflicts).toHaveLength(0);
  });
});
