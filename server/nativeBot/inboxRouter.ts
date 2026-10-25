import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { tenantProcedure } from "../_core/trpc";
import { assistantSchema, pauseMinutesSchema } from "../../shared/botInbox";
import { accessBot, assertBotManager, scopedBotConversation } from "./access";
import {
  assertBotSchema,
  rows,
  exec,
  botAudit,
  withBotLock,
  utcSql,
} from "./database";
import { botThreadMode } from "./service";
import { inboxChanged } from "./events";
import { assertPrivateConnectionAccess } from "../messaging/privateConnectionAccess";
import { selectQr, disconnectQr, qrSnapshot, isQrBot } from "./qr";

const idSchema = z.object({ id: z.number().int().positive() });
const base = tenantProcedure.use(async ({ ctx, next, type, path }) => {
  assertBotSchema();
  const result = await next({ ctx });
  if (type === "mutation" && result.ok && !path.endsWith("markRead"))
    inboxChanged(ctx.studioId);
  return result;
});
async function locked<T>(id: number, fn: Parameters<typeof withBotLock<T>>[1]) {
  const result = await withBotLock(
    "tatuei_bot_thread_" + id,
    async c => {
      await c.beginTransaction();
      try {
        const result = await fn(c);
        await c.commit();
        return result;
      } catch (e) {
        await c.rollback();
        throw e;
      }
    },
    10
  );
  if (result === undefined)
    throw new TRPCError({
      code: "CONFLICT",
      message: "Conversa em processamento. Tente novamente.",
    });
  return result;
}
export const inboxProcedures = {
  qrState: base.query(async ({ ctx }) => {
    assertBotManager(ctx.user);
    await assertPrivateConnectionAccess(ctx.user, ctx.studioId);
    await accessBot(ctx.user);
    return qrSnapshot(ctx.studioId);
  }),
  connectQr: base.mutation(async ({ ctx }) => {
    assertBotManager(ctx.user);
    await assertPrivateConnectionAccess(ctx.user, ctx.studioId);
    await accessBot(ctx.user);
    try {
      await selectQr(ctx.studioId, ctx.user.id);
      return { ok: true };
    } catch {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message:
          "Não foi possível iniciar a conexão QR. Confira a habilitação do serviço e a proteção das credenciais no servidor.",
      });
    }
  }),
  renewQr: base.mutation(async ({ ctx }) => {
    assertBotManager(ctx.user);
    await assertPrivateConnectionAccess(ctx.user, ctx.studioId);
    const a = await accessBot(ctx.user);
    if (!isQrBot(a.settings))
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Selecione a conexão por QR primeiro.",
      });
    await disconnectQr(ctx.studioId);
    await selectQr(ctx.studioId, ctx.user.id);
    return { ok: true };
  }),
  disconnectOwnQr: base.mutation(async ({ ctx }) => {
    assertBotManager(ctx.user);
    await assertPrivateConnectionAccess(ctx.user, ctx.studioId);
    await accessBot(ctx.user);
    await disconnectQr(ctx.studioId);
    await botAudit(
      ctx.studioId,
      0,
      "WhatsApp QR desconectado",
      "",
      ctx.user.id
    );
    return { ok: true };
  }),
  pauseConversation: base
    .input(idSchema.extend({ minutes: pauseMinutesSchema }))
    .mutation(async ({ ctx, input }) =>
      locked(input.id, async c => {
        const cv = await scopedBotConversation(ctx.user, input.id, c);
        if (cv.closed_at || cv.opted_out)
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Reabra o atendimento antes de definir uma pausa.",
          });
        await botThreadMode(cv, "human", c);
        const until =
          input.minutes === null
            ? null
            : utcSql(new Date(Date.now() + input.minutes * 60000));
        await exec(
          "UPDATE tatuei_bot_conversations SET pause_until=?,paused_by=? WHERE id=? AND studio_id=?",
          [until, ctx.user.id, cv.id, ctx.studioId],
          c
        );
        await botAudit(
          ctx.studioId,
          cv.artist_id,
          "Automação pausada",
          input.minutes === null
            ? "Até retomada manual."
            : `Por ${input.minutes} minutos.`,
          ctx.user.id,
          c
        );
        return { ok: true };
      })
    ),
  closeConversation: base
    .input(idSchema.extend({ closed: z.boolean() }))
    .mutation(async ({ ctx, input }) =>
      locked(input.id, async c => {
        const cv = await scopedBotConversation(ctx.user, input.id, c);
        await botThreadMode(cv, "human", c);
        await exec(
          "UPDATE tatuei_bot_conversations SET closed_at=? WHERE id=? AND studio_id=?",
          [input.closed ? utcSql() : null, cv.id, ctx.studioId],
          c
        );
        await botAudit(
          ctx.studioId,
          cv.artist_id,
          input.closed
            ? "Atendimento encerrado"
            : "Atendimento reaberto com a equipe",
          cv.name,
          ctx.user.id,
          c
        );
        return { ok: true };
      })
    ),
  markRead: base
    .input(idSchema.extend({ messageId: z.number().int().nonnegative() }))
    .mutation(async ({ ctx, input }) => {
      await scopedBotConversation(ctx.user, input.id);
      const [message] = await rows(
        "SELECT id FROM tatuei_bot_messages WHERE id=? AND studio_id=? AND conversation_id=?",
        [input.messageId, ctx.studioId, input.id]
      );
      if (message)
        await exec(
          "INSERT INTO tatuei_bot_reads(studio_id,conversation_id,user_id,message_id) VALUES(?,?,?,?) ON DUPLICATE KEY UPDATE message_id=GREATEST(message_id,VALUES(message_id))",
          [ctx.studioId, input.id, ctx.user.id, input.messageId]
        );
      return { ok: true };
    }),
  inboxDetails: base.input(idSchema).query(async ({ ctx, input }) => {
    const cv = await scopedBotConversation(ctx.user, input.id);
    const notes = await rows<{
      id: number;
      body: string;
      author: string | null;
      created_at: string;
    }>(
      "SELECT n.id,n.body,n.created_at,u.name author FROM tatuei_bot_notes n LEFT JOIN users u ON u.id=n.actor_id AND u.studioId=n.studio_id WHERE n.studio_id=? AND n.conversation_id=? ORDER BY n.id DESC LIMIT 50",
      [ctx.studioId, cv.id]
    );
    const staff = await rows<{ id: number; name: string | null }>(
      "SELECT id,name FROM users WHERE studioId=? AND isActive=1 AND accessStatus='active' AND (accessExpiresAt IS NULL OR accessExpiresAt>UTC_TIMESTAMP()) AND (role IN ('admin','superadmin') OR artistId=?) ORDER BY name",
      [ctx.studioId, cv.artist_id]
    );
    const client = cv.client_id
      ? (
          await rows<{
            id: number;
            name: string;
            phone: string;
            birthDate: string | null;
          }>(
            "SELECT id,name,phone,birthDate FROM clients WHERE id=? AND studioId=? AND isArchived=0",
            [cv.client_id, ctx.studioId]
          )
        )[0]
      : null;
    return { notes, staff, client };
  }),
  saveConversationDetails: base
    .input(
      idSchema.extend({
        labels: z.array(z.string().trim().min(1).max(40)).max(12),
        assignedUserId: z.number().int().positive().nullable(),
      })
    )
    .mutation(async ({ ctx, input }) =>
      locked(input.id, async c => {
        const cv = await scopedBotConversation(ctx.user, input.id, c);
        if (input.assignedUserId) {
          const [staff] = await rows(
            "SELECT id FROM users WHERE id=? AND studioId=? AND isActive=1 AND accessStatus='active' AND (accessExpiresAt IS NULL OR accessExpiresAt>UTC_TIMESTAMP()) AND (role IN ('admin','superadmin') OR artistId=?)",
            [input.assignedUserId, ctx.studioId, cv.artist_id],
            c
          );
          if (!staff)
            throw new TRPCError({
              code: "BAD_REQUEST",
              message:
                "Escolha um atendente autorizado a acessar essa conversa.",
            });
        }
        if (cv.assigned_user_id !== input.assignedUserId)
          await botThreadMode(cv, "human", c);
        await exec(
          "UPDATE tatuei_bot_conversations SET labels=?,assigned_user_id=? WHERE id=? AND studio_id=?",
          [
            JSON.stringify([...new Set(input.labels)]),
            input.assignedUserId,
            cv.id,
            ctx.studioId,
          ],
          c
        );
        await botAudit(
          ctx.studioId,
          cv.artist_id,
          "Responsável e etiquetas atualizados",
          cv.name,
          ctx.user.id,
          c
        );
        return { ok: true };
      })
    ),
  addNote: base
    .input(idSchema.extend({ body: z.string().trim().min(1).max(4000) }))
    .mutation(async ({ ctx, input }) => {
      await scopedBotConversation(ctx.user, input.id);
      await exec(
        "INSERT INTO tatuei_bot_notes(studio_id,conversation_id,actor_id,body) VALUES(?,?,?,?)",
        [ctx.studioId, input.id, ctx.user.id, input.body]
      );
      return { ok: true };
    }),
  assistants: base.query(async ({ ctx }) => {
    const a = await accessBot(ctx.user);
    return rows<{
      id: number;
      name: string;
      instructions: string;
      knowledge: string;
      enabled: number;
      version: number;
    }>(
      "SELECT id,name,instructions,knowledge,enabled,version FROM tatuei_bot_assistants WHERE studio_id=?" +
        (a.manager ? "" : " AND enabled=1") +
        " ORDER BY name",
      [ctx.studioId]
    );
  }),
  saveAssistant: base
    .input(assistantSchema)
    .mutation(async ({ ctx, input }) => {
      assertBotManager(ctx.user);
      await accessBot(ctx.user);
      if (input.id) {
        const result = await exec(
          "UPDATE tatuei_bot_assistants SET name=?,instructions=?,knowledge=?,enabled=?,version=version+1 WHERE id=? AND studio_id=? AND version=?",
          [
            input.name,
            input.instructions,
            input.knowledge,
            input.enabled ? 1 : 0,
            input.id,
            ctx.studioId,
            input.version,
          ]
        );
        if (!result.affectedRows)
          throw new TRPCError({
            code: "CONFLICT",
            message:
              "Assistente alterado em outra tela. Recarregue antes de salvar.",
          });
        // Bump the conversation revision before canceling queued output; in-flight AI rechecks it.
        await exec(
          "UPDATE tatuei_bot_conversations SET revision=revision+1 WHERE studio_id=? AND assistant_id=?",
          [ctx.studioId, input.id]
        );
        await exec(
          "UPDATE tatuei_bot_messages m JOIN tatuei_bot_conversations c ON c.id=m.conversation_id AND c.studio_id=m.studio_id SET m.status='canceled',m.error='Assistente atualizado.' WHERE c.studio_id=? AND c.assistant_id=? AND m.role='bot' AND m.status='queued'",
          [ctx.studioId, input.id]
        );
      } else {
        await exec(
          "INSERT INTO tatuei_bot_assistants(studio_id,name,instructions,knowledge,enabled) VALUES(?,?,?,?,?)",
          [
            ctx.studioId,
            input.name,
            input.instructions,
            input.knowledge,
            input.enabled ? 1 : 0,
          ]
        );
      }
      await botAudit(
        ctx.studioId,
        0,
        "Assistente atualizado",
        input.name,
        ctx.user.id
      );
      return { ok: true };
    }),
  selectAssistant: base
    .input(
      idSchema.extend({ assistantId: z.number().int().positive().nullable() })
    )
    .mutation(async ({ ctx, input }) =>
      locked(input.id, async c => {
        const cv = await scopedBotConversation(ctx.user, input.id, c);
        if (input.assistantId) {
          const [assistant] = await rows(
            "SELECT id FROM tatuei_bot_assistants WHERE id=? AND studio_id=? AND enabled=1",
            [input.assistantId, ctx.studioId],
            c
          );
          if (!assistant)
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "Assistente indisponível neste estúdio.",
            });
        }
        await botThreadMode(cv, "human", c);
        await exec(
          "UPDATE tatuei_bot_conversations SET assistant_id=? WHERE id=? AND studio_id=?",
          [input.assistantId, cv.id, ctx.studioId],
          c
        );
        await botAudit(
          ctx.studioId,
          cv.artist_id,
          "Assistente da conversa alterado",
          "Ative a automação para iniciar com o novo assistente.",
          ctx.user.id,
          c
        );
        return { ok: true };
      })
    ),
};
