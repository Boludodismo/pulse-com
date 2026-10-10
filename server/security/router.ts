import { sdk } from "../_core/sdk";
import { getSessionCookieOptions } from "../_core/cookies";
import { COOKIE_NAME } from "../../shared/const";
import { credentialVersion } from "./crypto";
import { SESSION_MS } from "./service";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import type { RowDataPacket } from "mysql2/promise";
import * as db from "../db";
import { router, protectedProcedure } from "../_core/trpc";
import { getSecurity, securityPool } from "./database";
import { emailAvailable } from "./email";
import {
  activateFactor,
  createChallenge,
  disableFactor,
  proveCurrentFactor,
  revokeSession,
} from "./service";
import { enforceRateLimit } from "./rateLimit";
import type { TrpcContext } from "../_core/context";
import { ENV } from "../_core/env";
const proof = z.object({
  password: z.string().min(1).max(256),
  currentCode: z.string().max(64).default(""),
  currentChallenge: z.string().max(64).optional(),
});
async function reauthenticate(
  ctx: TrpcContext,
  input: z.infer<typeof proof>,
  factor = true
) {
  if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED" });
  await enforceRateLimit(ctx.req, "security-manage", String(ctx.user.id), 10);
  const user = await db.getUserById(ctx.user.id);
  if (
    !user?.passwordHash ||
    !(await bcrypt.compare(input.password, user.passwordHash))
  )
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Senha ou código inválido.",
    });
  if (
    factor &&
    !(await proveCurrentFactor(user, input.currentCode, input.currentChallenge))
  )
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Senha ou código inválido.",
    });
  return user;
}
async function refreshSession(
  ctx: TrpcContext,
  user: NonNullable<TrpcContext["user"]>
) {
  const state = await getSecurity(user.id);
  const token = await sdk.createSessionToken(user.openId, {
    name: user.name || user.email || "Usuário",
    authVersion: credentialVersion(user, state.version),
    device: ctx.req.headers["user-agent"],
  });
  ctx.res.cookie(COOKIE_NAME, token, {
    ...getSessionCookieOptions(ctx.req),
    maxAge: SESSION_MS,
  });
}
async function audit(ctx: TrpcContext, action: string) {
  await db
    .createAuditLog({
      userId: ctx.user!.id,
      userName: ctx.user!.name || "Usuário",
      action: "update",
      entity: "user",
      entityId: ctx.user!.id,
      details: { action, studioId: ctx.user!.studioId },
      ipAddress: ctx.req.ip,
      userAgent: ctx.req.headers["user-agent"],
    })
    .catch(() => console.error("[Security] Audit unavailable"));
}
export const securityRouter = router({
  status: protectedProcedure.query(async ({ ctx }) => {
    const state = await getSecurity(ctx.user.id);
    const [codes] = await securityPool().query<RowDataPacket[]>(
      "SELECT COUNT(*) AS total FROM auth_recovery_codes WHERE userId=?",
      [ctx.user.id]
    );
    return {
      method: state.method,
      emailAvailable: emailAvailable() && ctx.user.role !== "superadmin",
      email: ctx.user.email,
      superadmin: ctx.user.role === "superadmin",
      local: ENV.authMode === "local",
      recoveryCodesRemaining: Number(codes[0]?.total ?? 0),
    };
  }),
  beginEnrollment: protectedProcedure
    .input(proof.extend({ method: z.enum(["totp", "email"]) }))
    .mutation(async ({ ctx, input }) => {
      if (ENV.authMode !== "local")
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Configure a segurança no provedor de login.",
        });
      const user = await reauthenticate(ctx, input);
      const challenge = await createChallenge(user, "enroll", input.method);
      await audit(ctx, "mfa_enrollment_started");
      return challenge;
    }),
  confirmEnrollment: protectedProcedure
    .input(
      z.object({
        challenge: z.string().length(64),
        code: z.string().regex(/^\d{6}$/, "Informe os 6 dígitos."),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await enforceRateLimit(
        ctx.req,
        "security-confirm",
        String(ctx.user.id),
        10
      );
      const user = await db.getUserById(ctx.user.id);
      if (!user) throw new TRPCError({ code: "UNAUTHORIZED" });
      const codes = await activateFactor(user, input.challenge, input.code);
      if (!codes)
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Código inválido ou expirado. Reinicie a configuração.",
        });
      await refreshSession(ctx, user);
      await audit(ctx, "mfa_enabled");
      return { codes };
    }),
  sendManagementCode: protectedProcedure
    .input(proof)
    .mutation(async ({ ctx, input }) => {
      const user = await reauthenticate(ctx, input, false);
      if ((await getSecurity(user.id)).method !== "email")
        throw new TRPCError({ code: "BAD_REQUEST" });
      await enforceRateLimit(
        ctx.req,
        "security-email",
        String(user.id),
        3,
        5 * 60000
      );
      return createChallenge(user, "manage", "email");
    }),
  disable: protectedProcedure.input(proof).mutation(async ({ ctx, input }) => {
    const user = await reauthenticate(ctx, input, false);
    if (!(await disableFactor(user, input.currentCode, input.currentChallenge)))
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Código inválido ou expirado.",
      });
    await refreshSession(ctx, user);
    await audit(ctx, "mfa_disabled");
    return { success: true };
  }),
  sessions: protectedProcedure.query(async ({ ctx }) => {
    const [rows] = await securityPool().query<
      (RowDataPacket & {
        tokenHash: string;
        lastSeen: number;
        expiresAt: number;
        device: string;
      })[]
    >(
      "SELECT tokenHash,lastSeen,expiresAt,device FROM auth_sessions WHERE userId=? AND expiresAt>? AND lastSeen>? ORDER BY lastSeen DESC",
      [ctx.user.id, Date.now(), Date.now() - 30 * 60000]
    );
    return rows.map(row => ({
      id: row.tokenHash,
      device: row.device,
      lastSeen: Number(row.lastSeen),
      expiresAt: Number(row.expiresAt),
    }));
  }),
  revokeSession: protectedProcedure
    .input(
      z.object({
        id: z
          .string()
          .regex(/^[a-f0-9]{64}$/)
          .optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await revokeSession(ctx.user.id, input.id);
      await audit(ctx, "sessions_revoked");
      return { success: true };
    }),
});
