import { afterEach, describe, expect, it } from "vitest";
import {
  createWebhookSignature,
  decryptIntegrationSecret,
  encryptIntegrationSecret,
  isWebhookSignatureValid,
} from "./messaging/crypto";

const previousKey = process.env.BOTCONVERSA_ENCRYPTION_KEY;
const testKey = Buffer.alloc(32, 7).toString("base64");

afterEach(() => {
  process.env.BOTCONVERSA_ENCRYPTION_KEY = previousKey;
});

describe("credenciais de integração criptografadas", () => {
  it("usa AES-GCM e não mantém o segredo em texto simples", () => {
    process.env.BOTCONVERSA_ENCRYPTION_KEY = testKey;
    const encrypted = encryptIntegrationSecret("token-de-teste-ultra-secreto");
    expect(encrypted).toMatch(/^v1\./);
    expect(encrypted).not.toContain("token-de-teste-ultra-secreto");
    expect(decryptIntegrationSecret(encrypted)).toBe("token-de-teste-ultra-secreto");
  });

  it("aceita somente a assinatura correspondente ao corpo recebido", () => {
    const body = JSON.stringify({ id: "evt_1", subscriber: { phone: "+5511999999999" } });
    const secret = "segredo-de-webhook-com-mais-de-24-caracteres";
    const signature = createWebhookSignature(body, secret);
    expect(isWebhookSignatureValid(body, secret, signature)).toBe(true);
    expect(isWebhookSignatureValid(`${body}alterado`, secret, signature)).toBe(false);
    expect(isWebhookSignatureValid(body, "outro-segredo", signature)).toBe(false);
  });
});
