import { describe, expect, it } from "vitest";

describe("BOTCONVERSA_ENCRYPTION_KEY", () => {
  it("é uma chave Base64 válida com 32 bytes para AES-256-GCM", () => {
    const rawKey = process.env.BOTCONVERSA_ENCRYPTION_KEY;

    expect(rawKey, "A chave de criptografia BotConversa deve estar configurada").toBeTruthy();

    const decoded = Buffer.from(rawKey!, "base64");
    expect(decoded.length).toBe(32);
    expect(decoded.toString("base64")).toBe(rawKey);
  });
});
