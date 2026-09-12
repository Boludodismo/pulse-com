import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, tenantProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { saveWhatsappConsent } from "../messaging/consent";
import {
  whatsappIntegrations,
  messageQueue,
  messageTemplates,
  studios,
  integrationEvents,
  integrationJobs,
  messageAutomationSettings,
  integrationContacts,
  clients,
} from "../../drizzle/schema";
import { eq, desc, and, inArray } from "drizzle-orm";
import { interpolateTemplate } from "../messaging/provider";
import { getOutboundEventIdempotencyKey, getProviderForIntegration, sendAndLog, seedDefaultTemplates } from "../messaging/service";
import { createConnectionKey, encryptIntegrationSecret, maskSecret } from "../messaging/crypto";
import { normalizeBrazilianPhone } from "../messaging/phone";
import { resolveManualRecipient } from "../messaging/manualRecipient";

function requireIntegrationManager(ctx: { user?: { role?: string } | null }) {
  if (ctx.user?.role !== "admin" && ctx.user?.role !== "superadmin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Você não tem permissão para gerenciar integrações." });
  }
}

export function getManagedStudioId(ctx: { user?: { role?: string; studioId?: number | null } | null; studioId?: number | null }, requestedStudioId?: number) {
  if (ctx.user?.role === "superadmin" && requestedStudioId) return requestedStudioId;
  const studioId = ctx.studioId ?? ctx.user?.studioId;
  if (!studioId) throw new TRPCError({ code: "BAD_REQUEST", message: "Selecione uma empresa antes de configurar uma integração." });
  if (requestedStudioId && requestedStudioId !== studioId) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Não é permitido configurar uma integração para outra empresa." });
  }
  return studioId;
}

async function findScopedIntegration(db: NonNullable<Awaited<ReturnType<typeof getDb>>>, id: number, studioId: number | null) {
  const condition = studioId == null
    ? eq(whatsappIntegrations.id, id)
    : and(eq(whatsappIntegrations.id, id), eq(whatsappIntegrations.studioId, studioId));
  const integration = (await db.select().from(whatsappIntegrations).where(condition).limit(1))[0];
  if (!integration) throw new TRPCError({ code: "NOT_FOUND", message: "Integração não encontrada nesta empresa." });
  return integration;
}

export function assertProductionReleaseReadiness(integration: {
  encryptedApiToken: string | null;
  isEnabled: number;
  status: string;
  lastTestedAt: string | null;
  lastSuccessAt: string | null;
}) {
  if (!integration.encryptedApiToken) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "A integração não possui uma credencial protegida configurada." });
  }
  if (!integration.isEnabled || integration.status !== "ativo") {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Ative a integração antes de liberar o modo de produção." });
  }
  if (!integration.lastTestedAt || !integration.lastSuccessAt) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Conclua os testes de conexão e homologação antes de liberar a produção." });
  }
}

export function assertRetryableMessage<T extends { status: string; clientId: number | null; studioId: number | null }>(source: T | undefined): asserts source is T & { clientId: number; studioId: number } {
  if (!source || source.studioId == null) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Mensagem não encontrada nesta empresa." });
  }
  if (source.status !== "erro") {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Somente mensagens com falha terminal podem ser reenviadas." });
  }
  if (!source.clientId) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "O reenvio em produção exige uma mensagem vinculada a um cliente com consentimento." });
  }
}

export const messagingRouter = router({
  /** Lista clientes do estúdio e seu opt-in na integração selecionada. */
  listWhatsappConsents: tenantProcedure
    .input(z.object({ integrationId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const integration = await findScopedIntegration(db, input.integrationId, ctx.studioId);
      if (!integration.studioId) throw new TRPCError({ code: "BAD_REQUEST", message: "A integração não está vinculada a uma empresa." });
      return await db.select({
        clientId: clients.id, clientName: clients.name, phone: clients.phone,
        hasWhatsappOptIn: integrationContacts.hasWhatsappOptIn,
        optInAt: integrationContacts.optInAt, optInSource: integrationContacts.optInSource,
        optedOutAt: integrationContacts.optedOutAt,
      }).from(clients).leftJoin(integrationContacts, and(
        eq(integrationContacts.clientId, clients.id),
        eq(integrationContacts.studioId, integration.studioId),
        eq(integrationContacts.integrationId, integration.id),
      )).where(and(eq(clients.studioId, integration.studioId),eq(clients.isArchived,0))).limit(200);
    }),

  /** Registra revogação ou opt-in informado pelo gestor; não envia mensagens. */
  setWhatsappConsent: tenantProcedure
    .input(z.object({
      integrationId: z.number().int().positive(),
      clientId: z.number().int().positive(),
      hasWhatsappOptIn: z.boolean(),
      source: z.string().min(3).max(100).default("painel_do_estudio"),
    }))
    .mutation(async ({ ctx, input }) => {
      requireIntegrationManager(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const integration = await findScopedIntegration(db, input.integrationId, ctx.studioId);
      if (!integration.studioId) throw new TRPCError({ code: "BAD_REQUEST", message: "A integração não está vinculada a uma empresa." });
      const client = (await db.select({ id: clients.id, phone: clients.phone }).from(clients).where(and(
        eq(clients.id, input.clientId), eq(clients.studioId, integration.studioId),
      )).limit(1))[0];
      if (!client?.phone) throw new TRPCError({ code: "BAD_REQUEST", message: "O cliente precisa ter telefone cadastrado antes do consentimento." });
      return await saveWhatsappConsent({studioId:integration.studioId,integrationId:integration.id,clientId:client.id,enabled:input.hasWhatsappOptIn,source:input.source});
    }),

  /** Preferências de disparos automáticos, limitadas ao estúdio da sessão. */
  getAutomationSettings: tenantProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const studioId = getManagedStudioId(ctx);
    return (await db.select().from(messageAutomationSettings)
      .where(eq(messageAutomationSettings.studioId, studioId)).limit(1))[0] ?? {
      studioId, appointmentRemindersEnabled: 0, appointmentDaysBefore: 1,
      appointmentSendTime: "10:00", oneHourRemindersEnabled: 0, birthdayMessagesEnabled: 0,
      birthdaySendTime: "09:00", birthdayMessageTemplate: null,
      timezone: "America/Sao_Paulo", lastAppointmentCycleAt: null,
      lastBirthdayCycleAt: null, lastError: null,
    };
  }),

  updateAutomationSettings: tenantProcedure
    .input(z.object({
      appointmentRemindersEnabled: z.boolean(),
      appointmentDaysBefore: z.number().int().min(1).max(7),
      appointmentSendTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
      oneHourRemindersEnabled: z.boolean(),
      birthdayMessagesEnabled: z.boolean(),
      birthdaySendTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
      birthdayMessageTemplate: z.string().min(1).max(1500).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      requireIntegrationManager(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const studioId = getManagedStudioId(ctx);
      await db.insert(messageAutomationSettings).values({
        studioId,
        appointmentRemindersEnabled: input.appointmentRemindersEnabled ? 1 : 0,
        appointmentDaysBefore: input.appointmentDaysBefore,
        appointmentSendTime: input.appointmentSendTime,
        oneHourRemindersEnabled: input.oneHourRemindersEnabled ? 1 : 0,
        birthdayMessagesEnabled: input.birthdayMessagesEnabled ? 1 : 0,
        birthdaySendTime: "09:00",
        birthdayMessageTemplate: input.birthdayMessageTemplate,
      }).onDuplicateKeyUpdate({ set: {
        appointmentRemindersEnabled: input.appointmentRemindersEnabled ? 1 : 0,
        appointmentDaysBefore: input.appointmentDaysBefore,
        appointmentSendTime: input.appointmentSendTime,
        oneHourRemindersEnabled: input.oneHourRemindersEnabled ? 1 : 0,
        birthdayMessagesEnabled: input.birthdayMessagesEnabled ? 1 : 0,
        birthdaySendTime: "09:00",
        birthdayMessageTemplate: input.birthdayMessageTemplate,
      }});
      return { ok: true };
    }),

  // ── Integração (configuração do provedor) ──────────────────────────────────

  /** Lista todas as integrações cadastradas */
  listIntegrations: tenantProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return [];
    const query = db.select({
      id: whatsappIntegrations.id,
      studioId: whatsappIntegrations.studioId,
      name: whatsappIntegrations.name,
      provider: whatsappIntegrations.provider,
      phoneNumber: whatsappIntegrations.phoneNumber,
      instanceId: whatsappIntegrations.instanceId,
      status: whatsappIntegrations.status,
      sandboxMode: whatsappIntegrations.sandboxMode,
      sandboxTestPhone: whatsappIntegrations.sandboxTestPhone,
      isEnabled: whatsappIntegrations.isEnabled,
      connectionKey: whatsappIntegrations.connectionKey,
      webhookUrl: whatsappIntegrations.webhookUrl,
      lastTestedAt: whatsappIntegrations.lastTestedAt,
      lastSuccessAt: whatsappIntegrations.lastSuccessAt,
      lastErrorMessage: whatsappIntegrations.lastErrorMessage,
      failureCount: whatsappIntegrations.failureCount,
      encryptedApiToken: whatsappIntegrations.encryptedApiToken,
      createdAt: whatsappIntegrations.createdAt,
      updatedAt: whatsappIntegrations.updatedAt,
    }).from(whatsappIntegrations);
    if (ctx.studioId != null) query.where(eq(whatsappIntegrations.studioId, ctx.studioId));
    const rows = await query.orderBy(desc(whatsappIntegrations.createdAt));
    return rows.map(({ encryptedApiToken, ...integration }) => ({ ...integration, tokenMasked: maskSecret(encryptedApiToken) }));
  }),

  /** Salva ou atualiza uma integração */
  saveIntegration: tenantProcedure
    .input(
      z.object({
        id: z.number().optional(),
        name: z.string().min(1),
        provider: z.enum(["botconversa", "zapi", "meta"]),
        phoneNumber: z.string().min(8),
        apiToken: z.string().min(1).optional(),
        instanceId: z.string().optional(),
        studioId: z.number().optional(),
        sandboxMode: z.boolean().default(true),
        sandboxTestPhone: z.string().optional(),
        webhookSecret: z.string().min(24).max(256).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      requireIntegrationManager(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const studioId = getManagedStudioId(ctx, input.studioId);
      const targetStudio = (await db.select({ id: studios.id }).from(studios).where(eq(studios.id, studioId)).limit(1))[0];
      if (!targetStudio) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "A empresa selecionada não existe ou não está disponível." });
      }
      const sandboxTestPhone = input.sandboxTestPhone ? normalizeBrazilianPhone(input.sandboxTestPhone) : null;

      if (input.id) {
        const existing = await findScopedIntegration(db, input.id, ctx.studioId);
        if (existing.studioId !== studioId) {
          throw new TRPCError({ code: "FORBIDDEN", message: "A integração não pode ser movida entre empresas." });
        }
        await db
          .update(whatsappIntegrations)
          .set({
            name: input.name,
            provider: input.provider,
            phoneNumber: input.phoneNumber,
            ...(input.apiToken ? { encryptedApiToken: encryptIntegrationSecret(input.apiToken), apiToken: "__encrypted_v1__" } : {}),
            ...(input.webhookSecret ? { encryptedWebhookSecret: encryptIntegrationSecret(input.webhookSecret) } : {}),
            instanceId: input.instanceId,
            sandboxMode: input.sandboxMode ? 1 : 0,
            sandboxTestPhone,
            studioId: existing.studioId ?? studioId,
            updatedAt: new Date().toISOString().slice(0, 19).replace("T", " "),
          })
          .where(eq(whatsappIntegrations.id, existing.id));
        return { ok: true };
      }
      if (!input.apiToken) throw new TRPCError({ code: "BAD_REQUEST", message: "Informe o token para criar a integração." });

      await db.insert(whatsappIntegrations).values({
        studioId,
        name: input.name,
        provider: input.provider,
        phoneNumber: input.phoneNumber,
        apiToken: "__encrypted_v1__",
        encryptedApiToken: encryptIntegrationSecret(input.apiToken),
        encryptedWebhookSecret: encryptIntegrationSecret(input.webhookSecret ?? createConnectionKey()),
        connectionKey: createConnectionKey(),
        sandboxMode: input.sandboxMode ? 1 : 0,
        sandboxTestPhone,
        isEnabled: 0,
        instanceId: input.instanceId,
        status: "aguardando",
      });
      return { ok: true };
    }),

  /** Ativa uma integração e desativa as demais */
  activateIntegration: tenantProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      requireIntegrationManager(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const integration = await findScopedIntegration(db, input.id, ctx.studioId);
      const studioId = integration.studioId ?? getManagedStudioId(ctx);
      if (!integration.encryptedApiToken) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Defina e teste o token da integração antes de ativá-la." });
      }
      if (integration.sandboxMode && !integration.sandboxTestPhone) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Defina o telefone de homologação antes de ativar o modo seguro." });
      }

      // Desativa somente as conexões do mesmo estúdio.
      await db.update(whatsappIntegrations).set({ status: "inativo", isEnabled: 0 })
        .where(eq(whatsappIntegrations.studioId, studioId));
      await db
        .update(whatsappIntegrations)
        .set({ status: "ativo", isEnabled: 1 })
        .where(eq(whatsappIntegrations.id, integration.id));
      return { ok: true };
    }),

  /** Remove uma integração */
  deleteIntegration: tenantProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      requireIntegrationManager(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const integration = await findScopedIntegration(db, input.id, ctx.studioId);
      await db
        .delete(whatsappIntegrations)
        .where(eq(whatsappIntegrations.id, integration.id));
      return { ok: true };
    }),

  /** Testa a conexão com o provedor */
  testConnection: tenantProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      requireIntegrationManager(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const integration = await findScopedIntegration(db, input.id, ctx.studioId);
      const provider = await getProviderForIntegration(integration);

      const result = await provider.testConnection();

      // Atualiza status e última data de teste
      await db
        .update(whatsappIntegrations)
        .set({
          status: result.success ? (integration.isEnabled ? "ativo" : "inativo") : "erro",
          lastTestedAt: new Date().toISOString().slice(0, 19).replace("T", " "),
          lastSuccessAt: result.success ? new Date().toISOString().slice(0, 19).replace("T", " ") : integration.lastSuccessAt,
          failureCount: result.success ? 0 : integration.failureCount + 1,
          lastErrorMessage: result.error ?? null,
          updatedAt: new Date().toISOString().slice(0, 19).replace("T", " "),
        })
        .where(eq(whatsappIntegrations.id, input.id));

      return result;
    }),

  /** Remove somente a limitação de sandbox depois de validações operacionais. */
  releaseProduction: tenantProcedure
    .input(z.object({ id: z.number(), confirmation: z.literal("LIBERAR PRODUCAO") }))
    .mutation(async ({ input, ctx }) => {
      requireIntegrationManager(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const integration = await findScopedIntegration(db, input.id, ctx.studioId);
      const studioId = integration.studioId ?? getManagedStudioId(ctx);

      if (!integration.sandboxMode) return { ok: true, alreadyProduction: true };
      assertProductionReleaseReadiness(integration);

      const pendingJob = (await db.select({ id: integrationJobs.id }).from(integrationJobs).where(and(
        eq(integrationJobs.studioId, studioId),
        eq(integrationJobs.integrationId, integration.id),
        inArray(integrationJobs.status, ["pending", "processing", "retry"]),
      )).limit(1))[0];
      if (pendingJob) {
        throw new TRPCError({ code: "CONFLICT", message: "Aguarde a conclusão da fila de mensagens antes de liberar a produção." });
      }

      const now = new Date().toISOString().slice(0, 19).replace("T", " ");
      await db.update(whatsappIntegrations).set({
        sandboxMode: 0,
        sandboxTestPhone: null,
        productionActivatedAt: now,
        productionActivatedByUserId: ctx.user!.id,
        updatedAt: now,
      }).where(eq(whatsappIntegrations.id, integration.id));

      return { ok: true, alreadyProduction: false, activatedAt: now };
    }),

  // ── Templates de mensagem ──────────────────────────────────────────────────

  /** Lista todos os templates */
  listTemplates: tenantProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return [];
    if (ctx.studioId != null) await seedDefaultTemplates(ctx.studioId);
    const query = db.select().from(messageTemplates);
    if (ctx.studioId != null) query.where(eq(messageTemplates.studioId, ctx.studioId));
    return query.orderBy(messageTemplates.trigger as any);
  }),

  /** Salva ou atualiza um template */
  saveTemplate: tenantProcedure
    .input(
      z.object({
        id: z.number().optional(),
        name: z.string().min(1),
        trigger: z.enum([
          "appointment_created",
          "appointment_confirmed",
          "appointment_reminder_24h",
          "appointment_reminder_2h",
          "appointment_reminder_1h",
          "appointment_cancelled",
          "appointment_rescheduled",
          "care_guide",
          "custom",
        ]),
        recipientType: z.enum(["client", "artist"]),
        message: z.string().min(1),
        isActive: z.boolean().default(true),
      })
    )
    .mutation(async ({ input, ctx }) => {
      requireIntegrationManager(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const studioId = getManagedStudioId(ctx);

      if (input.id) {
        const condition = ctx.studioId == null
          ? eq(messageTemplates.id, input.id)
          : and(eq(messageTemplates.id, input.id), eq(messageTemplates.studioId, studioId));
        await db
          .update(messageTemplates)
          .set({
            name: input.name,
            trigger: input.trigger,
            recipientType: input.recipientType,
            message: input.message,
            isActive: input.isActive ? 1 : 0,
            updatedAt: new Date().toISOString().slice(0, 19).replace("T", " "),
          })
          .where(condition);
      } else {
        await db.insert(messageTemplates).values({
          studioId,
          name: input.name,
          trigger: input.trigger,
          recipientType: input.recipientType,
          message: input.message,
          isActive: input.isActive ? 1 : 0,
        });
      }
      return { ok: true };
    }),

  /** Remove um template */
  deleteTemplate: tenantProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      requireIntegrationManager(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const studioId = getManagedStudioId(ctx);
      const condition = ctx.studioId == null
        ? eq(messageTemplates.id, input.id)
        : and(eq(messageTemplates.id, input.id), eq(messageTemplates.studioId, studioId));
      await db.delete(messageTemplates).where(condition);
      return { ok: true };
    }),

  // ── Fila / Histórico de mensagens ──────────────────────────────────────────

  /** Lista o histórico de mensagens enviadas */
  listQueue: tenantProcedure
    .input(
      z.object({
        limit: z.number().default(50),
        status: z
          .enum(["pendente", "enviada", "erro", "cancelada", "respondida"])
          .optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) return [];
      const filters = [] as any[];
      if (ctx.studioId != null) filters.push(eq(messageQueue.studioId, ctx.studioId));
      if (input.status) filters.push(eq(messageQueue.status, input.status));
      return db.select().from(messageQueue)
        .where(filters.length ? and(...filters) : undefined)
        .orderBy(desc(messageQueue.createdAt))
        .limit(Math.min(input.limit, 100));
    }),

  /** Indicadores compactos de lembretes já entregues, sempre isolados por estúdio. */
  getReminderIndicators: tenantProcedure
    .input(z.object({ appointmentIds: z.array(z.number().int().positive()).max(500) }))
    .query(async ({ input, ctx }) => {
      if (input.appointmentIds.length === 0) return {} as Record<number, { sentAt: string | null; types: string[] }>;
      const db = await getDb();
      if (!db) return {} as Record<number, { sentAt: string | null; types: string[] }>;
      const filters = [
        inArray(messageQueue.appointmentId, input.appointmentIds),
        eq(messageQueue.status, "enviada"),
        inArray(messageQueue.trigger, ["appointment_reminder", "appointment_reminder_1h_client"]),
      ];
      if (ctx.studioId != null) filters.push(eq(messageQueue.studioId, ctx.studioId));
      const rows = await db.select({
        appointmentId: messageQueue.appointmentId,
        trigger: messageQueue.trigger,
        sentAt: messageQueue.sentAt,
      }).from(messageQueue).where(and(...filters)).orderBy(desc(messageQueue.sentAt));
      const indicators: Record<number, { sentAt: string | null; types: string[] }> = {};
      for (const row of rows) {
        if (!row.appointmentId) continue;
        const current = indicators[row.appointmentId] ?? { sentAt: row.sentAt, types: [] };
        if (row.trigger && !current.types.includes(row.trigger)) current.types.push(row.trigger);
        indicators[row.appointmentId] = current;
      }
      return indicators;
    }),

  /** Histórico operacional para monitorar fila, tentativas, retorno e auditoria por empresa. */
  listMessageHistory: tenantProcedure
    .input(z.object({
      limit: z.number().min(1).max(100).default(50),
      integrationId: z.number().optional(),
      status: z.enum(["pendente", "enviada", "erro", "cancelada", "respondida"]).optional(),
    }))
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) return [];
      const queueFilters = [] as any[];
      const jobFilters = [] as any[];
      const eventFilters = [] as any[];
      if (ctx.studioId != null) {
        queueFilters.push(eq(messageQueue.studioId, ctx.studioId));
        jobFilters.push(eq(integrationJobs.studioId, ctx.studioId));
        eventFilters.push(eq(integrationEvents.studioId, ctx.studioId));
      }
      if (input.integrationId != null) {
        queueFilters.push(eq(messageQueue.integrationId, input.integrationId));
        jobFilters.push(eq(integrationJobs.integrationId, input.integrationId));
        eventFilters.push(eq(integrationEvents.integrationId, input.integrationId));
      }
      if (input.status) queueFilters.push(eq(messageQueue.status, input.status));

      const messages = await db.select().from(messageQueue)
        .where(queueFilters.length ? and(...queueFilters) : undefined)
        .orderBy(desc(messageQueue.createdAt))
        .limit(input.limit);
      const jobs = await db.select().from(integrationJobs)
        .where(jobFilters.length ? and(...jobFilters) : undefined)
        .orderBy(desc(integrationJobs.createdAt))
        .limit(300);
      const events = await db.select().from(integrationEvents)
        .where(eventFilters.length ? and(...eventFilters) : undefined)
        .orderBy(desc(integrationEvents.receivedAt))
        .limit(300);

      const jobByQueueId = new Map<number, typeof jobs[number]>();
      for (const job of jobs) {
        try {
          const payload = JSON.parse(job.payload) as { messageQueueId?: number };
          if (payload.messageQueueId != null && !jobByQueueId.has(payload.messageQueueId)) jobByQueueId.set(payload.messageQueueId, job);
        } catch {
          // Um payload legado inválido não impede a exibição das demais mensagens.
        }
      }
      const eventsByKey = new Map(events.map(event => [event.idempotencyKey, event]));

      return messages.map(message => {
        const job = jobByQueueId.get(message.id);
        const event = job ? eventsByKey.get(getOutboundEventIdempotencyKey(job.idempotencyKey)) : undefined;
        return {
          ...message,
          deliveryStatus: job?.status ?? message.status,
          attemptCount: job?.attemptCount ?? 0,
          maxAttempts: job?.maxAttempts ?? 0,
          nextAttemptAt: job?.nextAttemptAt ?? null,
          jobError: job?.lastError ?? null,
          eventStatus: event?.status ?? null,
          eventProcessedAt: event?.processedAt ?? null,
        };
      });
    }),

  /** Envia uma mensagem manual */
  sendManual: tenantProcedure
    .input(
      z.object({
        recipientPhone: z.string().min(8),
        recipientName: z.string().optional(),
        message: z.string().min(1),
        clientId: z.number().optional(),
        appointmentId: z.number().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      requireIntegrationManager(ctx);
      const studioId = getManagedStudioId(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível" });
      const recipient = await resolveManualRecipient(db, studioId, input);
      const result = await sendAndLog({
        studioId,
        ...recipient,
        recipientType: "client",
        message: input.message,
        trigger: "custom",
        appointmentId: input.appointmentId,
      });

      if (!result.success) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: result.error ?? "Falha ao enviar mensagem",
        });
      }

      return result;
    }),

  /** Cria uma nova tentativa para uma falha terminal sem reenviar automaticamente. */
  retryFailedMessage: tenantProcedure
    .input(z.object({ messageId: z.number(), confirmation: z.literal("REENVIAR MENSAGEM") }))
    .mutation(async ({ input, ctx }) => {
      requireIntegrationManager(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const sourceCondition = ctx.studioId == null
        ? eq(messageQueue.id, input.messageId)
        : and(eq(messageQueue.id, input.messageId), eq(messageQueue.studioId, ctx.studioId));
      const source = (await db.select().from(messageQueue).where(sourceCondition).limit(1))[0];
      assertRetryableMessage(source);
      const integration = await findScopedIntegration(db, source.integrationId, ctx.studioId);
      if (integration.studioId !== source.studioId || !integration.isEnabled || integration.status !== "ativo") {
        throw new TRPCError({ code: "FORBIDDEN", message: "A integração original não está disponível para reenvio nesta empresa." });
      }
      const activeRetry = (await db.select({ id: messageQueue.id }).from(messageQueue).where(and(
        eq(messageQueue.studioId, source.studioId),
        eq(messageQueue.retryOfQueueId, source.id),
        eq(messageQueue.status, "pendente"),
      )).limit(1))[0];
      if (activeRetry) {
        throw new TRPCError({ code: "CONFLICT", message: "Já existe uma nova tentativa pendente para esta mensagem." });
      }
      const result = await sendAndLog({
        studioId: source.studioId,
        integrationId: source.integrationId,
        retryOfQueueId: source.id,
        recipientPhone: source.recipientPhone,
        recipientName: source.recipientName ?? undefined,
        recipientType: source.recipientType,
        message: source.message,
        trigger: "retry",
        clientId: source.clientId,
        appointmentId: source.appointmentId ?? undefined,
      });
      if (!result.success) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: result.error ?? "Não foi possível criar a nova tentativa." });
      return { ...result, sourceMessageId: source.id };
    }),

  /** Preview de um template com variáveis de exemplo */
  previewTemplate: protectedProcedure
    .input(
      z.object({
        message: z.string(),
        vars: z.record(z.string(), z.string()).optional(),
      })
    )
    .query(({ input }) => {
      const defaultVars: Record<string, string> = {
        nome_cliente: "João Silva",
        nome_tatuador: "Artista",
        nome_artista: "Artista",
        nome_estudio: "POD Estúdio",
        data: "15/06/2026",
        hora: "14:00",
        servico: "Tatuagem",
        endereco: "Rua Exemplo, 123",
        valor_sinal: "R$ 150,00",
        status_sinal: "Confirmado",
        link_anamnese: "https://exemplo.com/anamnese",
        link_ebook: "https://exemplo.com/cuidados",
        ...input.vars,
      };
      return { preview: interpolateTemplate(input.message, defaultVars) };
    }),
});
