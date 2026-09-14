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

describe("anamnesis router", () => {
  it("should create a new anamnesis record with consent", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // Criar um cliente
    const client = await caller.clients.create({
      name: "Teste Anamnese",
      email: "anamnese@example.com",
    });

    // Criar ficha de anamnese
    const anamnesis = await caller.anamnesis.create({
      clientId: client.id,
      hasAllergies: true,
      allergiesDetails: "Alergia a látex e penicilina",
      hasDiseases: false,
      usesMedication: true,
      medicationDetails: "Anticoncepcional diário",
      isPregnant: false,
      hasKeloid: false,
      acceptedTerms: true,
    });

    expect(anamnesis).toBeDefined();
    expect(anamnesis.hasAllergies).toBeTruthy();
    expect(anamnesis.allergiesDetails).toBe("Alergia a látex e penicilina");
    expect(anamnesis.usesMedication).toBeTruthy();
    expect(anamnesis.acceptedTerms).toBeTruthy();
  });

  it("should create anamnesis with minimal required fields", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // Criar um cliente
    const client = await caller.clients.create({
      name: "Cliente Simples",
      email: "simples@example.com",
    });

    // Criar ficha mínima
    const anamnesis = await caller.anamnesis.create({
      clientId: client.id,
      hasAllergies: false,
      hasDiseases: false,
      usesMedication: false,
      isPregnant: false,
      hasKeloid: false,
      acceptedTerms: true,
    });

    expect(anamnesis).toBeDefined();
    expect(anamnesis.hasAllergies).toBeFalsy();
    expect(anamnesis.acceptedTerms).toBeTruthy();
  });

  it("should list anamnesis records by client", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // Criar um cliente
    const client = await caller.clients.create({
      name: "Cliente Histórico",
      email: "historico@example.com",
    });

    // Criar primeira ficha
    await caller.anamnesis.create({
      clientId: client.id,
      hasAllergies: false,
      hasDiseases: false,
      usesMedication: false,
      isPregnant: false,
      hasKeloid: false,
      acceptedTerms: true,
    });

    // Criar segunda ficha (atualização)
    await caller.anamnesis.create({
      clientId: client.id,
      hasAllergies: true,
      allergiesDetails: "Desenvolveu alergia recente",
      hasDiseases: false,
      usesMedication: false,
      isPregnant: false,
      hasKeloid: false,
      acceptedTerms: true,
    });

    // Buscar histórico
    const records = await caller.anamnesis.getByClientId({
      clientId: client.id,
    });

    expect(Array.isArray(records)).toBeTruthy();
    expect(records.length).toBe(2);
    // Mais recente primeiro (desc por id): 2a ficha (hasAllergies=true) vem antes
    expect(records[0]?.hasAllergies).toBeTruthy();
    expect(records[1]?.hasAllergies).toBeFalsy();
  });

  it("should handle keloid and pregnancy flags correctly", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // Criar um cliente
    const client = await caller.clients.create({
      name: "Cliente Especial",
      email: "especial@example.com",
    });

    // Criar ficha com quelóide e gravidez
    const anamnesis = await caller.anamnesis.create({
      clientId: client.id,
      hasAllergies: false,
      hasDiseases: false,
      usesMedication: false,
      isPregnant: true,
      hasKeloid: true,
      acceptedTerms: true,
    });

    expect(anamnesis.isPregnant).toBeTruthy();
    expect(anamnesis.hasKeloid).toBeTruthy();
  });
});
