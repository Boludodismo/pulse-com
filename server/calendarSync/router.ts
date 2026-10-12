import { randomBytes, createHash } from "node:crypto";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, tenantProcedure } from "../_core/trpc";
import { sdk } from "../_core/sdk";
import { isUserAccessActive } from "../saas";
import { database } from "../commitments/db";
import { ensureCalendarSyncSchema } from "./db";
import { appleClient, appleUrl, googleFetch } from "./providers";
import { encryptIntegrationSecret } from "../messaging/crypto";
import { syncConnection } from "./service";
const callbackUrl = () =>
  `${(process.env.APP_BASE_URL || "https://crm.tatuei.com").replace(/\/$/, "")}/api/calendar-sync/google/callback`;
const configured = () =>
  !!process.env.GOOGLE_CALENDAR_CLIENT_ID &&
  !!process.env.GOOGLE_CALENDAR_CLIENT_SECRET;
const procedure = tenantProcedure.use(async ({ ctx, next }) => {
  if (ctx.user.role === "superadmin")
    throw new TRPCError({ code: "FORBIDDEN" });
  await ensureCalendarSyncSchema();
  return next({ ctx });
});
async function ownCalendar(ctx: any, id: number) {
  const [rows]: any = await database().query(
    "SELECT id FROM calendars WHERE id=? AND userId=?",
    [id, ctx.user.id]
  );
  if (!rows[0]) throw new TRPCError({ code: "NOT_FOUND" });
}
async function connection(ctx: any, id: number) {
  const [rows]: any = await database().query(
    "SELECT * FROM calendar_sync_connections WHERE id=? AND studio_id=? AND user_id=?",
    [id, ctx.studioId, ctx.user.id]
  );
  if (!rows[0]) throw new TRPCError({ code: "NOT_FOUND" });
  return rows[0];
}
export const calendarSyncRouter = router({
  status: procedure.query(async ({ ctx }) => {
    const [rows]: any = await database().query(
      "SELECT id,calendar_id AS calendarId,provider,status,timezone,last_sync AS lastSync,last_error AS lastError,choices_json FROM calendar_sync_connections WHERE studio_id=? AND user_id=?",
      [ctx.studioId, ctx.user.id]
    );
    const [conflicts]: any = await database().query(
      "SELECT l.id,l.connection_id AS connectionId,l.kind,l.local_id AS localId,l.conflict_json FROM calendar_sync_links l JOIN calendar_sync_connections c ON c.id=l.connection_id WHERE c.studio_id=? AND c.user_id=? AND l.conflict_json IS NOT NULL",
      [ctx.studioId, ctx.user.id]
    );
    return {
      googleConfigured: configured(),
      googleCallback: callbackUrl(),
      connections: rows.map((r: any) => ({
        ...r,
        choices: r.choices_json ? JSON.parse(r.choices_json) : [],
        choices_json: undefined,
      })),
      conflicts: conflicts.map((c: any) => ({
        ...c,
        ...JSON.parse(c.conflict_json),
        conflict_json: undefined,
      })),
    };
  }),
  googleStart: procedure
    .input(z.object({ calendarId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      await ownCalendar(ctx, input.calendarId);
      const [existing]: any = await database().query(
        "SELECT id FROM calendar_sync_connections WHERE studio_id=? AND user_id=? AND calendar_id=? AND provider='google'",
        [ctx.studioId, ctx.user.id, input.calendarId]
      );
      if (existing.length)
        throw new TRPCError({
          code: "CONFLICT",
          message:
            "Desconecte a conta Google atual antes de conectar novamente.",
        });
      if (!configured())
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message:
            "Configure o aplicativo OAuth Google no servidor antes de conectar.",
        });
      const state = randomBytes(32).toString("base64url"),
        verifier = randomBytes(48).toString("base64url");
      await database().query(
        "INSERT INTO calendar_sync_oauth(state_hash,studio_id,user_id,calendar_id,expires_at,verifier) VALUES(?,?,?,?,DATE_ADD(UTC_TIMESTAMP(),INTERVAL 10 MINUTE),?)",
        [
          createHash("sha256").update(state).digest("hex"),
          ctx.studioId,
          ctx.user.id,
          input.calendarId,
          verifier,
        ]
      );
      const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
      for (const [k, v] of Object.entries({
        client_id: process.env.GOOGLE_CALENDAR_CLIENT_ID!,
        redirect_uri: callbackUrl(),
        response_type: "code",
        scope:
          "https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.calendarlist.readonly",
        access_type: "offline",
        prompt: "consent",
        state,
        code_challenge: createHash("sha256")
          .update(verifier)
          .digest("base64url"),
        code_challenge_method: "S256",
      }))
        url.searchParams.set(k, v);
      return { url: url.href };
    }),
  appleConnect: procedure
    .input(
      z.object({
        calendarId: z.number().int().positive(),
        username: z.string().email().max(320),
        password: z.string().min(16).max(128),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await ownCalendar(ctx, input.calendarId);
      const [existing]: any = await database().query(
        "SELECT id FROM calendar_sync_connections WHERE studio_id=? AND user_id=? AND calendar_id=? AND provider='icloud'",
        [ctx.studioId, ctx.user.id, input.calendarId]
      );
      if (existing.length)
        throw new TRPCError({
          code: "CONFLICT",
          message:
            "Desconecte a conta iCloud atual antes de conectar novamente.",
        });
      const secret = encryptIntegrationSecret(
        JSON.stringify({ username: input.username, password: input.password })
      );
      try {
        const client = await appleClient(secret);
        const calendars = await client.fetchCalendars();
        const choices = calendars.map(c => ({
          id: appleUrl(c.url),
          name:
            typeof c.displayName === "string"
              ? c.displayName
              : "Calendário iCloud",
        }));
        if (!choices.length) throw new Error("Nenhum calendário");
        await database().query(
          "INSERT INTO calendar_sync_connections(studio_id,user_id,calendar_id,provider,credentials,choices_json,status) VALUES(?,?,?,'icloud',?,?,'select')",
          [
            ctx.studioId,
            ctx.user.id,
            input.calendarId,
            secret,
            JSON.stringify(choices),
          ]
        );
        return { success: true };
      } catch {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "Não foi possível conectar ao iCloud. Confira Apple ID e senha específica de aplicativo.",
        });
      }
    }),
  select: procedure
    .input(
      z.object({
        id: z.number().int().positive(),
        remoteId: z.string().min(1).max(1000),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const c = await connection(ctx, input.id);
      const choices = c.choices_json ? JSON.parse(c.choices_json) : [];
      if (!choices.some((r: any) => r.id === input.remoteId))
        throw new TRPCError({ code: "BAD_REQUEST" });
      if (c.remote_calendar && c.remote_calendar !== input.remoteId)
        throw new TRPCError({
          code: "CONFLICT",
          message: "Desconecte antes de trocar o calendário externo.",
        });
      await database().query(
        "UPDATE calendar_sync_connections SET remote_calendar=?,status='connected',last_sync=NULL WHERE id=? AND studio_id=? AND user_id=?",
        [input.remoteId, input.id, ctx.studioId, ctx.user.id]
      );
      return { success: true };
    }),
  sync: procedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const c = await connection(ctx, input.id);
      if (!c.remote_calendar)
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Selecione o calendário externo.",
        });
      try {
        await syncConnection(input.id);
        return { success: true };
      } catch {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "Sincronização indisponível ou já em andamento. Confira o estado da conexão.",
        });
      }
    }),
  resolve: procedure
    .input(
      z.object({
        linkId: z.number().int().positive(),
        choice: z.enum(["local", "remote"]),
        version: z.string().max(200),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [rows]: any = await database().query(
        "SELECT c.id FROM calendar_sync_links l JOIN calendar_sync_connections c ON c.id=l.connection_id WHERE l.id=? AND c.studio_id=? AND c.user_id=? AND l.conflict_json IS NOT NULL",
        [input.linkId, ctx.studioId, ctx.user.id]
      );
      if (!rows[0]) throw new TRPCError({ code: "NOT_FOUND" });
      try {
        await syncConnection(rows[0].id, { ...input });
        return { success: true };
      } catch {
        throw new TRPCError({
          code: "CONFLICT",
          message:
            "Não foi possível resolver. Atualize os dados antes de tentar novamente.",
        });
      }
    }),
  disconnect: procedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const owned = await connection(ctx, input.id);
      if (
        owned.lease_until &&
        Date.parse(owned.lease_until.replace(" ", "T") + "Z") > Date.now()
      )
        throw new TRPCError({
          code: "CONFLICT",
          message: "Aguarde o lote em andamento antes de desconectar.",
        });
      const c = await database().getConnection();
      try {
        await c.beginTransaction();
        await c.query("DELETE FROM calendar_sync_links WHERE connection_id=?", [
          input.id,
        ]);
        await c.query(
          "DELETE FROM calendar_sync_connections WHERE id=? AND studio_id=? AND user_id=?",
          [input.id, ctx.studioId, ctx.user.id]
        );
        await c.commit();
        return { success: true };
      } catch (e) {
        await c.rollback();
        throw e;
      } finally {
        c.release();
      }
    }),
});
export function registerGoogleCallback(app: any) {
  app.get("/api/calendar-sync/google/callback", async (req: any, res: any) => {
    try {
      if (!configured()) throw new Error("Não configurado");
      const user = await sdk.authenticateRequest(req);
      if (
        !user.studioId ||
        user.role === "superadmin" ||
        !(await isUserAccessActive(user))
      )
        throw new Error("Sessão inválida");
      const state = String(req.query.state || ""),
        code = String(req.query.code || "");
      if (!state || !code) throw new Error("Retorno inválido");
      const hash = createHash("sha256").update(state).digest("hex");
      const [states]: any = await database().query(
        "SELECT * FROM calendar_sync_oauth WHERE state_hash=? AND user_id=? AND studio_id=? AND expires_at>UTC_TIMESTAMP()",
        [hash, user.id, user.studioId]
      );
      const pending = states[0];
      if (!pending) throw new Error("Retorno expirado");
      const [used]: any = await database().query(
        "DELETE FROM calendar_sync_oauth WHERE state_hash=? AND user_id=? AND studio_id=?",
        [hash, user.id, user.studioId]
      );
      if (!used.affectedRows) throw new Error("Retorno consumido");
      const tokens = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        signal: AbortSignal.timeout(20000),
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code,
          redirect_uri: callbackUrl(),
          client_id: process.env.GOOGLE_CALENDAR_CLIENT_ID!,
          client_secret: process.env.GOOGLE_CALENDAR_CLIENT_SECRET!,
          code_verifier: pending.verifier,
        }),
      });
      if (!tokens.ok) throw new Error("Token inválido");
      const data = await tokens.json();
      if (!data.refresh_token) throw new Error("Autorização offline ausente");
      const credentials = encryptIntegrationSecret(
        JSON.stringify({
          accessToken: data.access_token,
          refreshToken: data.refresh_token,
          expires: Date.now() + data.expires_in * 1000,
        })
      );
      const temporary = {
        credentials,
        studio_id: user.studioId,
        user_id: user.id,
      };
      const r = await googleFetch(
        temporary,
        "users/me/calendarList?minAccessRole=writer"
      );
      if (!r.ok) throw new Error("Lista indisponível");
      const list = await r.json();
      const choices = (list.items || []).map((c: any) => ({
        id: c.id,
        name: c.summary || "Google Agenda",
      }));
      await database().query(
        "INSERT INTO calendar_sync_connections(studio_id,user_id,calendar_id,provider,credentials,choices_json,status) VALUES(?,?,?,'google',?,?,'select')",
        [
          user.studioId,
          user.id,
          pending.calendar_id,
          credentials,
          JSON.stringify(choices),
        ]
      );
      res.redirect("/commitments?connected=google");
    } catch {
      res
        .status(400)
        .type("html")
        .send(
          '<p>Não foi possível concluir a conexão. Entre no CRM e tente conectar novamente.</p><a href="/commitments">Voltar aos compromissos</a>'
        );
    }
  });
}
