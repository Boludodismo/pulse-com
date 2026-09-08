import { describe, expect, it } from "vitest";
import { assertRetryableMessage } from "./routers/messaging";

describe("reenvio de mensagens falhas", () => {
  it("aceita somente uma falha terminal vinculada a cliente do estúdio", () => {
    expect(() => assertRetryableMessage({ status: "erro", clientId: 42, studioId: 1 })).not.toThrow();
  });

  it("recusa mensagens de outro escopo, sem cliente ou sem falha terminal", () => {
    expect(() => assertRetryableMessage(undefined)).toThrow("Mensagem não encontrada");
    expect(() => assertRetryableMessage({ status: "enviada", clientId: 42, studioId: 1 })).toThrow("falha terminal");
    expect(() => assertRetryableMessage({ status: "erro", clientId: null, studioId: 1 })).toThrow("cliente com consentimento");
  });
});
