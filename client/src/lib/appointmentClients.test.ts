import { describe, expect, it } from "vitest";
import { shouldShowClientLoadError } from "./appointmentClients";

describe("shouldShowClientLoadError", () => {
  it("mostra erro quando a consulta falhou sem qualquer cliente disponível", () => {
    expect(shouldShowClientLoadError(true, 0)).toBe(true);
  });

  it("preserva clientes já carregados quando uma atualização posterior falha", () => {
    expect(shouldShowClientLoadError(true, 1)).toBe(false);
    expect(shouldShowClientLoadError(false, 0)).toBe(false);
  });
});
