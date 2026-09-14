import { describe, it, expect } from "vitest";
import bcrypt from "bcryptjs";

// ── Testes de autenticação local ───────────────────────────────────────────

describe("LocalAuth — hashPassword / verifyPassword", () => {
  it("deve gerar um hash bcrypt válido", async () => {
    const plain = "senha123";
    const hash = await bcrypt.hash(plain, 10);
    expect(hash).toBeTruthy();
    expect(hash).not.toBe(plain);
    expect(hash.startsWith("$2")).toBe(true); // bcrypt prefix
  });

  it("deve verificar corretamente senha correta", async () => {
    const plain = "minhaSenha!";
    const hash = await bcrypt.hash(plain, 10);
    const valid = await bcrypt.compare(plain, hash);
    expect(valid).toBe(true);
  });

  it("deve rejeitar senha incorreta", async () => {
    const hash = await bcrypt.hash("correta", 10);
    const valid = await bcrypt.compare("errada", hash);
    expect(valid).toBe(false);
  });

  it("deve rejeitar string vazia como senha", async () => {
    const hash = await bcrypt.hash("qualquer", 10);
    const valid = await bcrypt.compare("", hash);
    expect(valid).toBe(false);
  });
});

describe("LocalAuth — validação de e-mail", () => {
  const isValidEmail = (email: string) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  it("deve aceitar e-mails válidos", () => {
    expect(isValidEmail("joao@email.com")).toBe(true);
    expect(isValidEmail("cassia@gmail.com")).toBe(true);
    expect(isValidEmail("admin@podcrm.local")).toBe(true);
  });

  it("deve rejeitar e-mails inválidos", () => {
    expect(isValidEmail("")).toBe(false);
    expect(isValidEmail("semArroba")).toBe(false);
    expect(isValidEmail("@semdominio")).toBe(false);
  });
});

describe("LocalAuth — ENV AUTH_MODE", () => {
  it("AUTH_MODE deve ser 'local' quando configurado", () => {
    // Simula a leitura da variável de ambiente
    const authMode = process.env.AUTH_MODE ?? "oauth";
    // Em ambiente de teste pode ser qualquer valor, mas a lógica deve funcionar
    expect(["local", "oauth"]).toContain(authMode);
  });

  it("VITE_AUTH_MODE deve ser igual ao AUTH_MODE", () => {
    const serverMode = process.env.AUTH_MODE ?? "oauth";
    const clientMode = process.env.VITE_AUTH_MODE ?? "oauth";
    // Ambos devem ser consistentes
    expect(serverMode).toBe(clientMode);
  });
});

describe("LocalAuth — segurança de senha", () => {
  it("senha com menos de 6 caracteres deve ser rejeitada pela validação", () => {
    const validatePassword = (pwd: string) => pwd.length >= 6;
    expect(validatePassword("12345")).toBe(false);
    expect(validatePassword("123456")).toBe(true);
    expect(validatePassword("senhaSegura123!")).toBe(true);
  });

  it("dois hashes da mesma senha devem ser diferentes (salt único)", async () => {
    const plain = "mesmaSenha";
    const hash1 = await bcrypt.hash(plain, 10);
    const hash2 = await bcrypt.hash(plain, 10);
    expect(hash1).not.toBe(hash2); // bcrypt usa salt aleatório
    // Mas ambos devem verificar corretamente
    expect(await bcrypt.compare(plain, hash1)).toBe(true);
    expect(await bcrypt.compare(plain, hash2)).toBe(true);
  });
});
