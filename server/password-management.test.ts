import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import * as db from "./db";
import { hashPassword } from "./_core/localAuth";

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


// Helper para criar contexto de teste
function makeCtx(user: { id: number; role: string; name: string; email: string; studioId?: number | null; artistId?: number | null }) {
  return {
    user: { ...user, studioId: user.studioId ?? null, artistId: user.artistId ?? null },
    req: { ip: "127.0.0.1", socket: {}, headers: {} } as any,
    res: { clearCookie: () => {} } as any,
  };
}

describe("Password Management", () => {
  let testUserId: number;
  const testEmail = `pwd-test-${Date.now()}@example.com`;
  const initialPassword = "senha123";

  beforeAll(async () => {
    // Criar usuário de teste com senha
    const passwordHash = await hashPassword(initialPassword);
    await db.createUser({
      openId: `local-pwd-test-${Date.now()}`,
      name: "Pwd Test User",
      email: testEmail,
      role: "collaborator",
      studioId: null,
      artistId: null,
      passwordHash,
    });
    // Buscar o usuário pelo email para obter o ID correto
    const user = await db.getUserByEmail(testEmail);
    if (!user) throw new Error("Falha ao criar usuário de teste");
    testUserId = user.id;
  });

  afterAll(async () => {
    // Limpar usuário de teste
    if (testUserId) {
      await db.deleteUser(testUserId);
    }
  });

  describe("users.changePassword", () => {
    it("deve trocar a senha com sucesso quando a senha atual está correta", async () => {
      const caller = appRouter.createCaller(makeCtx({
        id: testUserId,
        role: "collaborator",
        name: "Pwd Test User",
        email: testEmail,
      }));

      const result = await caller.users.changePassword({
        currentPassword: initialPassword,
        newPassword: "novaSenha456",
      });

      expect(result.success).toBe(true);

      // Restaurar senha original para outros testes
      const passwordHash = await hashPassword(initialPassword);
      await db.updateUser(testUserId, { passwordHash });
    });

    it("deve rejeitar quando a senha atual está incorreta", async () => {
      const caller = appRouter.createCaller(makeCtx({
        id: testUserId,
        role: "collaborator",
        name: "Pwd Test User",
        email: testEmail,
      }));

      await expect(
        caller.users.changePassword({
          currentPassword: "senhaErrada",
          newPassword: "novaSenha456",
        })
      ).rejects.toThrow("Senha atual incorreta");
    });

    it("deve rejeitar nova senha com menos de 6 caracteres", async () => {
      const caller = appRouter.createCaller(makeCtx({
        id: testUserId,
        role: "collaborator",
        name: "Pwd Test User",
        email: testEmail,
      }));

      await expect(
        caller.users.changePassword({
          currentPassword: initialPassword,
          newPassword: "123",
        })
      ).rejects.toThrow();
    });
  });

  describe("auth.requestPasswordReset", () => {
    it("deve retornar sucesso mesmo para e-mail inexistente (segurança)", async () => {
      const caller = appRouter.createCaller({
        user: null,
        req: { ip: "127.0.0.1", socket: {}, headers: {} } as any,
        res: { clearCookie: () => {} } as any,
      });

      const result = await caller.auth.requestPasswordReset({
        email: "naoexiste@example.com",
      });

      expect(result.success).toBe(true);
    });

    it("deve retornar sucesso para e-mail existente", async () => {
      const caller = appRouter.createCaller({
        user: null,
        req: { ip: "127.0.0.1", socket: {}, headers: {} } as any,
        res: { clearCookie: () => {} } as any,
      });

      const result = await caller.auth.requestPasswordReset({
        email: testEmail,
      });

      expect(result.success).toBe(true);
    });
  });

  describe("auth.verifyResetToken", () => {
    it("deve retornar valid: false para token inválido", async () => {
      const caller = appRouter.createCaller({
        user: null,
        req: { ip: "127.0.0.1", socket: {}, headers: {} } as any,
        res: { clearCookie: () => {} } as any,
      });

      const result = await caller.auth.verifyResetToken({
        token: "token-invalido-123",
      });

      expect(result.valid).toBe(false);
    });
  });

  describe("auth.resetPassword", () => {
    it("deve rejeitar token inválido", async () => {
      const caller = appRouter.createCaller({
        user: null,
        req: { ip: "127.0.0.1", socket: {}, headers: {} } as any,
        res: { clearCookie: () => {} } as any,
      });

      await expect(
        caller.auth.resetPassword({
          token: "token-invalido-xyz",
          newPassword: "novaSenha789",
        })
      ).rejects.toThrow("Token inválido ou já utilizado");
    });
  });
});
