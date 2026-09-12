import { TRPCError } from "@trpc/server";
import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function createContextWithoutStudio(): TrpcContext {
  return {
    user: {
      id: 999999,
      openId: "admin-without-studio",
      email: "admin-without-studio@example.test",
      name: "Admin sem empresa",
      loginMethod: "local",
      role: "admin",
      studioId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

function createSuperadminContextWithoutStudio(): TrpcContext {
  const ctx = createContextWithoutStudio();
  return {
    ...ctx,
    user: {
      ...ctx.user!,
      id: 999998,
      openId: "superadmin-without-studio",
      role: "superadmin",
    },
  };
}

describe("clients.list tenant protection", () => {
  it("rejeita uma sessão administrativa sem empresa em vez de listar clientes de outro estúdio", async () => {
    const caller = appRouter.createCaller(createContextWithoutStudio());

    await expect(caller.clients.list()).rejects.toMatchObject<Partial<TRPCError>>({
      code: "FORBIDDEN",
      message: "Usuário não vinculado a um estúdio.",
    });
  });

  it("exige a escolha explícita da empresa para superadmin sem empresa ativa persistida", async () => {
    const caller = appRouter.createCaller(createSuperadminContextWithoutStudio());

    await expect(caller.clients.list()).rejects.toMatchObject<Partial<TRPCError>>({
      code: "FORBIDDEN",
      message: "Selecione a empresa para consultar os clientes.",
    });
  });

});
