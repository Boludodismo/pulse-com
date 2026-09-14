import { describe, expect, it } from "vitest";
import { assertProductionReleaseReadiness } from "./routers/messaging";

const readyIntegration = {
  encryptedApiToken: "encrypted-token",
  isEnabled: 1,
  status: "ativo",
  lastTestedAt: "2026-09-01 04:08:03",
  lastSuccessAt: "2026-09-01 04:36:18",
};

describe("liberação de integração para produção", () => {
  it("aceita somente uma integração ativa e homologada", () => {
    expect(() => assertProductionReleaseReadiness(readyIntegration)).not.toThrow();
  });

  it("recusa integração sem credencial protegida", () => {
    expect(() => assertProductionReleaseReadiness({ ...readyIntegration, encryptedApiToken: null }))
      .toThrow("credencial protegida");
  });

  it("recusa integração inativa ou sem teste de homologação", () => {
    expect(() => assertProductionReleaseReadiness({ ...readyIntegration, isEnabled: 0 }))
      .toThrow("Ative a integração");
    expect(() => assertProductionReleaseReadiness({ ...readyIntegration, lastSuccessAt: null }))
      .toThrow("testes de conexão e homologação");
  });
});
