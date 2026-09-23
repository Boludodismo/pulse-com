import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { randomBytes, randomUUID } from "node:crypto";
import { router, tenantProcedure } from "../_core/trpc";
import {
  botConfigSchema,
  botPermissionsSchema,
  botRoleIsManager,
  botVariables,
  defaultBotConfig,
  DEFAULT_BOT_PERMISSIONS,
} from "../../shared/nativeBot";
import {
  accessBot,
  assertBotManager,
  assertBotScope,
  settings,
  getProfile,
  scopedBotClient,
  scopedBotConversation,
  type BotActor,
} from "../nativeBot/access";
import {
  rows,
  exec,
  assertBotSchema,
  botAudit,
  jsonValue,
  withBotLock,
  botTransaction,
} from "../nativeBot/database";
import {
  waCredentialsSchema,
  zapi,
  getBotQr,
  safeBotError,
} from "../nativeBot/providers";
import { sealBotSecret } from "../nativeBot/crypto";
import {
  botThreadMode,
  cancelBotQueue,
  ensureBotConversation,
  nativeBotPhone,
  queueBotMessage,
  resolveBotReply,
} from "../nativeBot/service";
const ownerInput = z.object({
  artistId: z.number().int().nonnegative().optional(),
});
const base = tenantProcedure.use(async ({ ctx, next }) => {
  assertBotSchema();
  return next({ ctx });
});
const idInput = z.object({ id: z.number().int().positive() });
function publicConnection(s: Awaited<ReturnType<typeof settings>>) {
  return {
    aiConfigured: !!s.ai_secret,
    aiModel: s.ai_model,
    aiDailyLimit: s.ai_daily_limit,
    aiUsed: s.ai_used,
    aiDay: s.ai_day,
    whatsappConfigured: !!s.wa_secret,
    whatsappStatus: s.wa_status,
    whatsappPhone: s.wa_phone,
    webhookReady: !!s.webhook_ready,
    lastError: s.last_error,
  };
}
async function seedProfile(studioId: number, artistId: number) {
  await exec(
    "INSERT IGNORE INTO tatuei_bot_profiles(studio_id,artist_id,enabled,permissions,config,version) VALUES(?,?,?,?,?,0)",
    [
      studioId,
      artistId,
      artistId === 0 ? 1 : 0,
      JSON.stringify(DEFAULT_BOT_PERMISSIONS),
      JSON.stringify(defaultBotConfig()),
    ]
  );
}
async function lockThread<T>(
  id: number,
  fn: Parameters<typeof withBotLock<T>>[1]
) {
  const result = await withBotLock("tatuei_bot_thread_" + id, fn, 10);
  if (result === undefined)
    throw new TRPCError({
      code: "CONFLICT",
      message:
        "A conversa está sendo processada. Tente novamente em instantes.",
    });
  return result;
}
export const nativeBotRouter = router({
  access: base.query(async ({ ctx }) => {
    const id = assertBotScope(ctx.user);
    const s = await settings(ctx.studioId),
      p = await getProfile(ctx.studioId, id);
    const manager = botRoleIsManager(ctx.user.role);
    return {
      manager,
      enabled: !!s.enabled,
      allowed: manager || (!!s.enabled && p.enabled),
      artistId: ctx.user.artistId,
      permissions: p.permissions,
    };
  }),
  snapshot: base.input(ownerInput).query(async ({ ctx, input }) => {
    const a = await accessBot(ctx.user, input.artistId);
    const artists = await rows<{ id: number; name: string; active: number }>(
      "SELECT id,name,active FROM artists WHERE studioId=? AND active=1" +
        (a.manager ? "" : " AND id=?") +
        " ORDER BY name",
      a.manager ? [a.studioId] : [a.studioId, a.artistId]
    );
    const ownerWhere = a.manager ? "" : " AND artistId=?";
    const [count] = await rows<{ total: number }>(
      "SELECT COUNT(*) total FROM clients WHERE studioId=? AND isArchived=0" +
        ownerWhere,
      a.manager ? [a.studioId] : [a.studioId, a.artistId]
    );
    const [human] = await rows<{ total: number }>(
      "SELECT COUNT(*) total FROM tatuei_bot_conversations WHERE studio_id=? AND mode='human'" +
        (a.manager ? "" : " AND artist_id=?"),
      a.manager ? [a.studioId] : [a.studioId, a.artistId]
    );
    return {
      studioName: a.studioName,
      artistName: a.artistName,
      manager: a.manager,
      enabled: !!a.settings.enabled,
      profile: a.profile,
      artists,
      clientCount: count.total,
      humanCount: human.total,
      connection: a.manager ? publicConnection(a.settings) : null,
    };
  }),
  saveConfig: base
    .input(
      ownerInput.extend({
        section: z.enum(["assistant", "messages", "rules"]),
        config: botConfigSchema,
        version: z.number().int().nonnegative(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const a = await accessBot(ctx.user, input.artistId, input.section);
      const next = { ...a.profile.config };
      if (input.section === "messages") next.messages = input.config.messages;
      else if (input.section === "rules") next.rules = input.config.rules;
      else
        for (const key of [
          "name",
          "tone",
          "address",
          "instructions",
          "knowledge",
          "aiEnabled",
          "timezone",
          "days",
          "opens",
          "closes",
          "faqs",
        ] as const)
          (next as any)[key] = input.config[key];
      await seedProfile(a.studioId, a.artistId);
      const result = await exec(
        "UPDATE tatuei_bot_profiles SET config=?,version=version+1 WHERE studio_id=? AND artist_id=? AND version=?",
        [JSON.stringify(next), a.studioId, a.artistId, input.version]
      );
      if (result.affectedRows !== 1)
        throw new TRPCError({
          code: "CONFLICT",
          message:
            "As configurações foram alteradas em outra tela. Recarregue antes de salvar.",
        });
      await botAudit(
        a.studioId,
        a.artistId,
        "Configuração atualizada",
        input.section,
        ctx.user.id
      );
      return { ok: true };
    }),
  setEnabled: base
    .input(z.object({ enabled: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      assertBotManager(ctx.user);
      await accessBot(ctx.user);
      await seedProfile(ctx.studioId, 0);
      await exec("UPDATE tatuei_bot_settings SET enabled=? WHERE studio_id=?", [
        input.enabled ? 1 : 0,
        ctx.studioId,
      ]);
      if (!input.enabled)
        await exec(
          "UPDATE tatuei_bot_messages SET status='canceled',error='Módulo pausado pelo estúdio.' WHERE studio_id=? AND status='queued'",
          [ctx.studioId]
        );
      await botAudit(
        ctx.studioId,
        0,
        input.enabled ? "Bot ativado" : "Bot pausado",
        "",
        ctx.user.id
      );
      return { ok: true };
    }),
  team: base.query(async ({ ctx }) => {
    assertBotManager(ctx.user);
    await accessBot(ctx.user);
    const artists = await rows<{
      id: number;
      name: string;
      specialty: string | null;
    }>(
      "SELECT id,name,specialty FROM artists WHERE studioId=? AND active=1 ORDER BY name",
      [ctx.studioId]
    );
    return Promise.all(
      artists.map(async a => {
        const p = await getProfile(ctx.studioId, a.id);
        return { ...a, enabled: p.enabled, permissions: p.permissions };
      })
    );
  }),
  setArtistAccess: base
    .input(
      z.object({
        artistId: z.number().int().positive(),
        enabled: z.boolean(),
        permissions: botPermissionsSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      assertBotManager(ctx.user);
      await accessBot(ctx.user, input.artistId);
      await seedProfile(ctx.studioId, input.artistId);
      await exec(
        "UPDATE tatuei_bot_profiles SET enabled=?,permissions=?,version=version+1 WHERE studio_id=? AND artist_id=?",
        [
          input.enabled ? 1 : 0,
          JSON.stringify(input.permissions),
          ctx.studioId,
          input.artistId,
        ]
      );
      if (!input.enabled)
        await exec(
          "UPDATE tatuei_bot_messages m JOIN tatuei_bot_conversations c ON c.id=m.conversation_id SET m.status='canceled',m.error='Acesso do artista suspenso.' WHERE c.studio_id=? AND c.artist_id=? AND m.status='queued'",
          [ctx.studioId, input.artistId]
        );
      await botAudit(
        ctx.studioId,
        input.artistId,
        "Acesso do artista atualizado",
        input.enabled ? "Liberado" : "Suspenso",
        ctx.user.id
      );
      return { ok: true };
    }),
  clients: base
    .input(
      z.object({
        search: z.string().max(100).default(""),
        offset: z.number().int().min(0).default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      const a = await accessBot(ctx.user, undefined, "clients");
      const search = "%" + input.search.replace(/[\\%_]/g, "\\$&") + "%";
      return rows<{
        id: number;
        name: string;
        phone: string | null;
        artistId: number | null;
        artistName: string | null;
        birthDate: string | null;
        optIn: number;
      }>(
        `SELECT cl.id,cl.name,cl.phone,cl.artistId,ar.name artistName,cl.birthDate,COALESCE(b.enabled,0) optIn FROM clients cl LEFT JOIN artists ar ON ar.id=cl.artistId AND ar.studioId=cl.studioId LEFT JOIN tatuei_bot_consents b ON b.studio_id=cl.studioId AND b.client_id=cl.id WHERE cl.studioId=? AND cl.isArchived=0 ${a.manager ? "" : "AND cl.artistId=?"} AND (cl.name LIKE ? OR cl.phone LIKE ?) ORDER BY cl.name LIMIT 100 OFFSET ?`,
        [
          a.studioId,
          ...(a.manager ? [] : [a.artistId]),
          search,
          search,
          input.offset,
        ]
      );
    }),
  saveClient: base
    .input(
      z.object({
        id: z.number().int().positive().optional(),
        name: z.string().trim().min(2).max(150),
        phone: z.string().min(8).max(25),
        artistId: z.number().int().positive(),
        birthDate: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const a = await accessBot(ctx.user, input.artistId, "clients");
      let phone: string;
      try {
        phone = nativeBotPhone(input.phone);
      } catch {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Informe um telefone válido com DDD.",
        });
      }
      if (
        input.birthDate &&
        (!Number.isFinite(Date.parse(input.birthDate + "T12:00:00Z")) ||
          new Date(input.birthDate + "T12:00:00Z")
            .toISOString()
            .slice(0, 10) !== input.birthDate)
      )
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Data de nascimento inválida.",
        });
      let id = input.id;
      if (id) {
        const old = await scopedBotClient(ctx.user, id);
        if (old.artistId !== input.artistId)
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              "Altere o responsável pela tela principal de clientes; revise também o vínculo da conversa.",
          });
        await exec(
          "UPDATE clients SET name=?,phone=?,birthDate=? WHERE id=? AND studioId=?",
          [
            input.name,
            phone,
            input.birthDate ? input.birthDate + " 00:00:00" : null,
            id,
            a.studioId,
          ]
        );
      } else {
        const created = await exec(
          "INSERT INTO clients(name,phone,artistId,studioId,birthDate) VALUES(?,?,?,?,?)",
          [
            input.name,
            phone,
            input.artistId,
            a.studioId,
            input.birthDate ? input.birthDate + " 00:00:00" : null,
          ]
        );
        id = created.insertId;
      }
      await botAudit(
        a.studioId,
        input.artistId,
        input.id ? "Cliente atualizado" : "Cliente cadastrado",
        input.name,
        ctx.user.id
      );
      return { id };
    }),
  setConsent: base
    .input(
      z.object({ clientId: z.number().int().positive(), enabled: z.boolean() })
    )
    .mutation(async ({ ctx, input }) => {
      const a = await accessBot(ctx.user, undefined, "clients");
      const cl = await scopedBotClient(ctx.user, input.clientId);
      await exec(
        "INSERT INTO tatuei_bot_consents(studio_id,client_id,enabled,actor_id) VALUES(?,?,?,?) ON DUPLICATE KEY UPDATE enabled=VALUES(enabled),actor_id=VALUES(actor_id)",
        [a.studioId, cl.id, input.enabled ? 1 : 0, ctx.user.id]
      );
      await botAudit(
        a.studioId,
        cl.artistId || 0,
        "Autorização de automações atualizada",
        `${cl.name}: ${input.enabled ? "autorizado" : "revogado"}`,
        ctx.user.id
      );
      return { ok: true };
    }),
  preview: base
    .input(
      ownerInput.extend({
        text: z.string().trim().min(1).max(3000),
        name: z.string().trim().min(1).max(80).default("Cliente de teste"),
        outside: z.boolean().default(false),
        human: z.boolean().default(false),
        useAi: z.boolean().default(false),
        event: z
          .enum(["greeting", "reminder", "followup", "birthday"])
          .optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const a = await accessBot(ctx.user, input.artistId);
      const vars = botVariables({
        clientName: input.name,
        studioName: a.studioName,
        artistName: a.artistName,
        date: "2026-12-15 14:00:00",
      });
      const r = await resolveBotReply(
        a.settings,
        a.profile.config,
        input.text,
        vars,
        {
          outside: input.outside,
          human: input.human,
          event: input.event,
          useAi: input.useAi,
        }
      );
      return {
        ...r,
        text: r.text
          ? `${r.text}${input.event === "reminder" ? "\n\n[Os links reais de confirmação são acrescentados no envio da sessão.]" : ""}`
          : null,
        simulation: true,
      };
    }),
  conversations: base
    .input(
      z.object({
        search: z.string().max(100).default(""),
        offset: z.number().int().min(0).default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      const a = await accessBot(ctx.user);
      const pattern = "%" + input.search.replace(/[\\%_]/g, "\\$&") + "%";
      return rows<{
        id: number;
        name: string;
        phone: string;
        artist_id: number;
        client_id: number | null;
        mode: string;
        opted_out: number;
        updated_at: string;
        artistName: string | null;
        lastBody: string | null;
        lastStatus: string | null;
      }>(
        `SELECT c.*,a.name artistName,(SELECT body FROM tatuei_bot_messages m WHERE m.conversation_id=c.id AND m.studio_id=c.studio_id ORDER BY m.id DESC LIMIT 1) lastBody,(SELECT status FROM tatuei_bot_messages m WHERE m.conversation_id=c.id AND m.studio_id=c.studio_id ORDER BY m.id DESC LIMIT 1) lastStatus FROM tatuei_bot_conversations c LEFT JOIN artists a ON a.id=c.artist_id AND a.studioId=c.studio_id WHERE c.studio_id=? ${a.manager ? "" : "AND c.artist_id=? AND (c.client_id IS NULL OR EXISTS(SELECT 1 FROM clients cl WHERE cl.id=c.client_id AND cl.studioId=c.studio_id AND cl.artistId=c.artist_id AND cl.isArchived=0))"} AND (c.name LIKE ? OR c.phone LIKE ?) ORDER BY c.updated_at DESC LIMIT 60 OFFSET ?`,
        [
          a.studioId,
          ...(a.manager ? [] : [a.artistId]),
          pattern,
          pattern,
          input.offset,
        ]
      );
    }),
  thread: base.input(idInput).query(async ({ ctx, input }) => {
    const cv = await scopedBotConversation(ctx.user, input.id);
    const messages = await rows<{
      id: number;
      role: string;
      body: string;
      status: string;
      error: string | null;
      created_at: string;
      due_at: string;
    }>(
      "SELECT id,role,body,status,error,created_at,due_at FROM tatuei_bot_messages WHERE studio_id=? AND conversation_id=? ORDER BY id DESC LIMIT 150",
      [ctx.studioId, input.id]
    );
    return { conversation: cv, messages: messages.reverse() };
  }),
  openConversation: base
    .input(z.object({ clientId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      await accessBot(ctx.user, undefined, "clients");
      const cl = await scopedBotClient(ctx.user, input.clientId);
      if (!cl.phone)
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cadastre o telefone do cliente.",
        });
      const cv = await ensureBotConversation(ctx.studioId, cl as any);
      if (cv.client_id !== cl.id || Number(cl.artistId || 0) !== cv.artist_id)
        throw new TRPCError({
          code: "CONFLICT",
          message:
            "Esse telefone já tem uma conversa com outro vínculo. O gestor deve revisar o responsável em Conversas.",
        });
      await scopedBotConversation(ctx.user, cv.id);
      return { id: cv.id };
    }),
  setMode: base
    .input(idInput.extend({ mode: z.enum(["bot", "human"]) }))
    .mutation(async ({ ctx, input }) =>
      lockThread(input.id, async c => {
        const cv = await scopedBotConversation(ctx.user, input.id, c);
        if (cv.opted_out && input.mode === "bot")
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              "O cliente pode liberar o atendimento enviando: retomar atendimento. Isso não reativa autorizações de automações.",
          });
        await botThreadMode(cv, input.mode, c);
        await botAudit(
          ctx.studioId,
          cv.artist_id,
          input.mode === "human" ? "Equipe assumiu a conversa" : "Bot retomado",
          cv.name,
          ctx.user.id,
          c
        );
        return { ok: true };
      })
    ),
  send: base
    .input(
      idInput.extend({
        body: z.string().trim().min(1).max(4000),
        requestId: z.string().uuid(),
      })
    )
    .mutation(async ({ ctx, input }) =>
      lockThread(input.id, async c => {
        const cv = await scopedBotConversation(ctx.user, input.id, c),
          s = await settings(ctx.studioId, c);
        if (!s.enabled || s.wa_status !== "connected" || !s.webhook_ready)
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Ative o módulo e conecte o WhatsApp antes de enviar.",
          });
        if (cv.opted_out)
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "O cliente interrompeu as mensagens.",
          });
        if (
          (
            await rows(
              "SELECT id FROM tatuei_bot_messages WHERE studio_id=? AND event_key=?",
              [ctx.studioId, "manual:" + input.requestId],
              c
            )
          ).length
        )
          return { ok: true };
        const [consent] = cv.client_id
          ? await rows(
              "SELECT enabled FROM tatuei_bot_consents WHERE studio_id=? AND client_id=?",
              [ctx.studioId, cv.client_id],
              c
            )
          : [];
        const recent =
          cv.last_inbound_at &&
          Date.parse(cv.last_inbound_at.replace(" ", "T") + "Z") >
            Date.now() - 86400000;
        if (!consent?.enabled && !recent)
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              "Registre a autorização do cliente ou aguarde uma mensagem dele antes de iniciar o atendimento.",
          });
        const next =
          cv.mode === "human" ? cv : await botThreadMode(cv, "human", c);
        await cancelBotQueue(next, c);
        await queueBotMessage(
          next,
          input.body,
          {
            role: "staff",
            eventKey: "manual:" + input.requestId,
            origin: "manual",
          },
          c
        );
        return { ok: true };
      })
    ),
  assignConversation: base
    .input(idInput.extend({ clientId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      assertBotManager(ctx.user);
      return lockThread(input.id, async c => {
        const cv = await scopedBotConversation(ctx.user, input.id, c),
          cl = await scopedBotClient(ctx.user, input.clientId, c);
        if (nativeBotPhone(cl.phone || "") !== cv.phone)
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "O telefone do cadastro deve ser o mesmo da conversa.",
          });
        await botThreadMode(cv, "human", c);
        await exec(
          "UPDATE tatuei_bot_conversations SET client_id=?,artist_id=?,name=? WHERE id=? AND studio_id=?",
          [cl.id, cl.artistId || 0, cl.name, cv.id, ctx.studioId],
          c
        );
        await botAudit(
          ctx.studioId,
          cl.artistId || 0,
          "Conversa vinculada ao cliente",
          cl.name,
          ctx.user.id,
          c
        );
        return { ok: true };
      });
    }),
  history: base
    .input(z.object({ offset: z.number().int().min(0).default(0) }))
    .query(async ({ ctx, input }) => {
      const a = await accessBot(ctx.user);
      return rows<{
        id: number;
        artist_id: number;
        action: string;
        detail: string;
        created_at: string;
      }>(
        "SELECT id,artist_id,action,detail,created_at FROM tatuei_bot_history WHERE studio_id=?" +
          (a.manager ? "" : " AND artist_id=?") +
          " ORDER BY id DESC LIMIT 100 OFFSET ?",
        [a.studioId, ...(a.manager ? [] : [a.artistId]), input.offset]
      );
    }),
  saveAi: base
    .input(
      z.object({
        key: z.string().trim().min(15).max(1000).optional(),
        model: z
          .string()
          .trim()
          .regex(/^[A-Za-z0-9._:-]{1,100}$/),
        dailyLimit: z.number().int().min(1).max(10000),
        remove: z.boolean().default(false),
      })
    )
    .mutation(async ({ ctx, input }) => {
      assertBotManager(ctx.user);
      const a = await accessBot(ctx.user);
      let secret = a.settings.ai_secret;
      if (input.remove) secret = null;
      else if (input.key) secret = sealBotSecret(input.key, ctx.studioId);
      await exec(
        "UPDATE tatuei_bot_settings SET ai_secret=?,ai_model=?,ai_daily_limit=? WHERE studio_id=?",
        [secret, input.model, input.dailyLimit, ctx.studioId]
      );
      await botAudit(
        ctx.studioId,
        0,
        "Configuração da IA atualizada",
        "",
        ctx.user.id
      );
      return { ok: true };
    }),
  saveWhatsapp: base
    .input(waCredentialsSchema)
    .mutation(async ({ ctx, input }) => {
      assertBotManager(ctx.user);
      await accessBot(ctx.user);
      const existing = await rows(
        "SELECT id FROM whatsapp_integrations WHERE studio_id=? AND instanceId=? AND is_enabled=1",
        [ctx.studioId, input.instanceId]
      );
      if (existing.length)
        throw new TRPCError({
          code: "CONFLICT",
          message:
            "Essa instância já é utilizada pela Central de Mensagens. Use uma instância dedicada ao Bot Tatuei.",
        });
      const key = randomBytes(32).toString("base64url");
      await exec(
        "UPDATE tatuei_bot_settings SET wa_secret=?,wa_instance=?,wa_status='disconnected',wa_phone=NULL,webhook_key=?,webhook_ready=0,last_error=NULL WHERE studio_id=?",
        [
          sealBotSecret(JSON.stringify(input), ctx.studioId),
          input.instanceId,
          key,
          ctx.studioId,
        ]
      );
      await botAudit(
        ctx.studioId,
        0,
        "Credenciais de WhatsApp salvas",
        "Conexão ainda precisa ser validada.",
        ctx.user.id
      );
      return { ok: true };
    }),
  qr: base.mutation(async ({ ctx }) => {
    assertBotManager(ctx.user);
    const a = await accessBot(ctx.user);
    try {
      return await getBotQr(a.settings);
    } catch (e) {
      throw new TRPCError({ code: "BAD_REQUEST", message: safeBotError(e) });
    }
  }),
  verifyWhatsapp: base.mutation(async ({ ctx }) => {
    assertBotManager(ctx.user);
    const a = await accessBot(ctx.user);
    try {
      const status = await zapi(a.settings, "status");
      if (status.connected !== true) {
        await exec(
          "UPDATE tatuei_bot_settings SET wa_status='disconnected' WHERE studio_id=?",
          [ctx.studioId]
        );
        return { connected: false };
      }
      const baseUrl = process.env.APP_BASE_URL?.trim().replace(/\/$/, "");
      if (!baseUrl || !baseUrl.startsWith("https://"))
        throw new Error("URL do CRM indisponível.");
      const result = await zapi(a.settings, "update-webhook-received", "PUT", {
        value: `${baseUrl}/api/native-bot/webhook/${a.settings.webhook_key}`,
      });
      if (result?.value !== true) throw new Error("Webhook não confirmado.");
      await exec(
        "UPDATE tatuei_bot_settings SET wa_status='connected',webhook_ready=1,last_error=NULL WHERE studio_id=?",
        [ctx.studioId]
      );
      await botAudit(
        ctx.studioId,
        0,
        "WhatsApp validado",
        "Recebimento de mensagens configurado.",
        ctx.user.id
      );
      return { connected: true };
    } catch (e) {
      await exec(
        "UPDATE tatuei_bot_settings SET last_error=? WHERE studio_id=?",
        [safeBotError(e), ctx.studioId]
      );
      throw new TRPCError({ code: "BAD_REQUEST", message: safeBotError(e) });
    }
  }),
  removeWhatsapp: base.mutation(async ({ ctx }) => {
    assertBotManager(ctx.user);
    await accessBot(ctx.user);
    await exec(
      "UPDATE tatuei_bot_settings SET wa_secret=NULL,wa_instance=NULL,wa_status='unconfigured',wa_phone=NULL,webhook_key=NULL,webhook_ready=0 WHERE studio_id=?",
      [ctx.studioId]
    );
    await exec(
      "UPDATE tatuei_bot_messages SET status='canceled',error='Conexão removida.' WHERE studio_id=? AND status='queued'",
      [ctx.studioId]
    );
    await botAudit(ctx.studioId, 0, "Conexão removida do CRM", "", ctx.user.id);
    return { ok: true };
  }),
});
