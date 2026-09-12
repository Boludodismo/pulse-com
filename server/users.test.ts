import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import type { Context } from "./_core/context";
import * as db from "./db";

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


// Mock context para admin
const createAdminContext = (): Context => ({
  req: {} as any,
  res: {} as any,
  user: {
    id: 1,
    openId: "admin-test",
    name: "Admin Test",
    email: "admin@test.com",
    role: "admin",
    artistId: null,
    isActive: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
    loginMethod: "test",
  },
});

// Mock context para artista
const createArtistContext = (): Context => ({
  req: {} as any,
  res: {} as any,
  user: {
    id: 2,
    openId: "artist-test",
    name: "Artist Test",
    email: "artist@test.com",
    role: "collaborator",
    artistId: 1,
    isActive: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
    loginMethod: "test",
  },
});

describe("Users Router", () => {
  let testUserId: number | undefined;

  describe("Admin Access", () => {
    it("should allow admin to list all users", async () => {
      const caller = appRouter.createCaller(createAdminContext());
      const users = await caller.users.list();
      expect(Array.isArray(users)).toBe(true);
    });

    it("should allow admin to create a new user", async () => {
      const caller = appRouter.createCaller(createAdminContext());
      const timestamp = Date.now();
      const result = await caller.users.create({
        openId: `test-user-${timestamp}`,
        name: "Test User",
        email: `test${timestamp}@example.com`,
        role: "collaborator",
      });

      expect(result).toBeDefined();

      // Buscar o usuário criado para pegar o ID
      const users = await db.listAllUsers();
      const createdUser = users.find((u) => u.openId === `test-user-${timestamp}`);
      if (createdUser) {
        testUserId = createdUser.id;
      }
    });

    it("should allow admin to create an artist user with artistId", async () => {
      const caller = appRouter.createCaller(createAdminContext());
      const timestamp = Date.now();

      // Criar um artista primeiro
      const artist = await db.createArtist({
        name: `Test Artist ${timestamp}`,
        email: `artist${timestamp}@example.com`,
        phone: "11999999999",
      });

      // Criar usuário vinculado ao artista
      const result = await caller.users.create({
        openId: `test-artist-user-${timestamp}`,
        name: "Test Artist User",
        email: `artistuser${timestamp}@example.com`,
        role: "collaborator",
        artistId: artist.insertId as number,
      });

      expect(result).toBeDefined();
    });

    it("should allow admin to update a user", async () => {
      if (!testUserId) {
        // Criar usuário para teste se não existe
        const timestamp = Date.now();
        await db.createUser({
          openId: `test-update-${timestamp}`,
          name: "User to Update",
          email: `update${timestamp}@example.com`,
          role: "collaborator",
        });
        const users = await db.listAllUsers();
        const user = users.find((u) => u.openId === `test-update-${timestamp}`);
        testUserId = user?.id;
      }

      const caller = appRouter.createCaller(createAdminContext());
      const result = await caller.users.update({
        id: testUserId!,
        name: "Updated Name",
        email: "updated@example.com",
      });

      expect(result).toBeDefined();

      // Verificar se foi atualizado
      const updatedUser = await db.getUserById(testUserId!);
      expect(updatedUser?.name).toBe("Updated Name");
      expect(updatedUser?.email).toBe("updated@example.com");
    });

    it("should allow admin to toggle user status", async () => {
      if (!testUserId) {
        const timestamp = Date.now();
        await db.createUser({
          openId: `test-status-${timestamp}`,
          name: "User for Status Test",
          email: `status${timestamp}@example.com`,
          role: "collaborator",
        });
        const users = await db.listAllUsers();
        const user = users.find((u) => u.openId === `test-status-${timestamp}`);
        testUserId = user?.id;
      }

      const caller = appRouter.createCaller(createAdminContext());

      // Desativar usuário
      await caller.users.update({
        id: testUserId!,
        isActive: 0,
      });

      let user = await db.getUserById(testUserId!);
      expect(user?.isActive).toBe(0);

      // Reativar usuário
      await caller.users.update({
        id: testUserId!,
        isActive: 1,
      });

      user = await db.getUserById(testUserId!);
      expect(user?.isActive).toBe(1);
    });

    it("should allow admin to delete a user", async () => {
      const timestamp = Date.now();
      await db.createUser({
        openId: `test-delete-${timestamp}`,
        name: "User to Delete",
        email: `delete${timestamp}@example.com`,
        role: "collaborator",
      });

      const users = await db.listAllUsers();
      const userToDelete = users.find((u) => u.openId === `test-delete-${timestamp}`);
      expect(userToDelete).toBeDefined();

      const caller = appRouter.createCaller(createAdminContext());
      await caller.users.delete({ id: userToDelete!.id });

      // Verificar se foi deletado
      const deletedUser = await db.getUserById(userToDelete!.id);
      expect(deletedUser).toBeUndefined();
    });
  });

  describe("Artist Access Restrictions", () => {
    it("should deny artist access to list users", async () => {
      const caller = appRouter.createCaller(createArtistContext());
      await expect(caller.users.list()).rejects.toThrow("Acesso negado");
    });

    it("should deny artist access to create users", async () => {
      const caller = appRouter.createCaller(createArtistContext());
      await expect(
        caller.users.create({
          openId: "test-denied",
          name: "Denied User",
          email: "denied@example.com",
          role: "collaborator",
        })
      ).rejects.toThrow("Acesso negado");
    });

    it("should deny artist access to update users", async () => {
      const caller = appRouter.createCaller(createArtistContext());
      await expect(
        caller.users.update({
          id: 1,
          name: "Denied Update",
        })
      ).rejects.toThrow("Acesso negado");
    });

    it("should deny artist access to delete users", async () => {
      const caller = appRouter.createCaller(createArtistContext());
      await expect(caller.users.delete({ id: 1 })).rejects.toThrow("Acesso negado");
    });
  });
});
