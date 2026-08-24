import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from '@shared/const';
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;

const requireUser = t.middleware(async opts => {
  const { ctx, next } = opts;

  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

export const protectedProcedure = t.procedure.use(requireUser);

// Middleware para SUPER ADMIN (acesso global a todos os estúdios)
export const superAdminProcedure = t.procedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;

    if (!ctx.user || ctx.user.role !== 'superadmin') {
      throw new TRPCError({ code: "FORBIDDEN", message: "Acesso negado. Apenas super administradores." });
    }

    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
        studioId: null, // Super admin não tem restrição de estúdio
        artistId: null,
      },
    });
  }),
);

// Middleware para ADMIN DO ESTÚDIO (acesso total ao próprio estúdio)
export const adminProcedure = t.procedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;

    if (!ctx.user) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
    }

    if (ctx.user.role !== 'admin') {
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }

    if (!ctx.user.studioId) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Administrador não vinculado a um estúdio." });
    }

    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
        studioId: ctx.user.studioId,
        artistId: null, // Admin vê todos os artistas do estúdio
      },
    });
  }),
);

// Middleware para COLABORADOR (acesso restrito aos próprios dados)
export const collaboratorProcedure = t.procedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;

    if (!ctx.user) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
    }

    if (ctx.user.role !== 'collaborator') {
      throw new TRPCError({ code: "FORBIDDEN", message: "Acesso negado. Apenas colaboradores." });
    }

    if (!ctx.user.studioId) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Colaborador não vinculado a um estúdio." });
    }

    if (!ctx.user.artistId) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Colaborador não vinculado a um artista." });
    }

    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
        studioId: ctx.user.studioId,
        artistId: ctx.user.artistId,
      },
    });
  }),
);

// Middleware legado: artistProcedure agora aceita admin e collaborator
// Admin vê tudo do estúdio, collaborator vê apenas seus dados
export const artistProcedure = t.procedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;

    if (!ctx.user) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
    }

    // Aceita admin, collaborator e superadmin
    if (ctx.user.role !== 'admin' && ctx.user.role !== 'collaborator' && ctx.user.role !== 'superadmin') {
      throw new TRPCError({ code: "FORBIDDEN", message: "Acesso negado. Apenas administradores e colaboradores." });
    }

    // Validar studioId (exceto para superadmin)
    if (!ctx.user.studioId && ctx.user.role !== 'superadmin') {
      throw new TRPCError({ code: "FORBIDDEN", message: "Usuário não vinculado a um estúdio." });
    }

    // Colaboradores devem ter artistId vinculado
    if (ctx.user.role === 'collaborator' && !ctx.user.artistId) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Colaborador não vinculado a um artista." });
    }

    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
        studioId: ctx.user.studioId || null,
        // Passa o artistId para contexto (null para admins = acesso total ao estúdio)
        artistId: ctx.user.role === 'admin' ? null : ctx.user.artistId,
      },
    });
  }),
);
