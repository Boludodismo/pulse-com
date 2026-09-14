import { describe, expect, it } from "vitest";
import { createWebhookSignature, isWebhookSignatureValid } from "./messaging/crypto";

describe("autenticação do webhook BotConversa", () => {
  const secret = "segredo-de-homologacao-com-24-caracteres";
  const payload = JSON.stringify({ id: "evt-1", phone: "+5531996531316", text: { message: "CONFIRMAR" } });

  it("aceita a assinatura SHA-256 calculada sobre o payload", () => {
    expect(isWebhookSignatureValid(payload, secret, createWebhookSignature(payload, secret))).toBe(true);
  });

  it("aceita o segredo estático enviado pelo Bloco de Integração", () => {
    expect(isWebhookSignatureValid(payload, secret, secret)).toBe(true);
  });

  it("rejeita cabeçalho estático diferente do segredo da conexão", () => {
    expect(isWebhookSignatureValid(payload, secret, "segredo-incorreto")).toBe(false);
  });
});
