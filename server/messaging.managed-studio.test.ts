import { describe, expect, it } from "vitest";
import { getManagedStudioId } from "./routers/messaging";

describe("getManagedStudioId", () => {
  it("exige uma empresa explicitamente selecionada para o Superadministrador", () => {
    expect(() => getManagedStudioId({ user: { role: "superadmin", studioId: null }, studioId: null }))
      .toThrow("Selecione uma empresa antes de configurar uma integração.");
  });

  it("permite ao Superadministrador configurar a empresa escolhida", () => {
    expect(getManagedStudioId({ user: { role: "superadmin", studioId: null }, studioId: null }, 30001)).toBe(30001);
  });

  it("impede que administrador configure uma empresa diferente da sua", () => {
    expect(() => getManagedStudioId({ user: { role: "admin", studioId: 1 }, studioId: 1 }, 30001))
      .toThrow("Não é permitido configurar uma integração para outra empresa.");
  });
});
