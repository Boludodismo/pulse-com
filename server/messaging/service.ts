import { getDb } from "../db";
import { whatsappIntegrations, messageQueue, messageTemplates, integrationContacts, integrationEvents, integrationJobs, appointmentReminders } from "../../drizzle/schema";
import { and, eq, inArray, lte, or, sql } from "drizzle-orm";
import type { ProviderConfig, WhatsAppProvider } from "./provider";
import { interpolateTemplate } from "./provider";
import { BotConversaProvider } from "./providers/botconversa";
import { ZApiProvider } from "./providers/zapi";
import { MetaProvider } from "./providers/meta";
import { decryptIntegrationSecret, encryptIntegrationSecret, hashIntegrationPayload } from "./crypto";
import { normalizeBrazilianPhone } from "./phone";
import { formatAppointmentActionLinks, type AppointmentActionLinks } from "../appointmentActions";
import { removeLegacyNumericReplyInstruction } from "./messagePresentation";

/** Instancia o provedor correto com base na configuração salva */
export function getProvider(config: ProviderConfig): WhatsAppProvider {
  switch (config.provider) {
    case "botconversa":
      return new BotConversaProvider(config);
    case "zapi":
      return new ZApiProvider(config);
    case "meta":
      return new MetaProvider(config);
    default:
      throw new Error(`Provedor desconhecido: ${config.provider}`);
  }
}

/** Busca a integração ativa no banco */
export async function getActiveIntegration(studioId?: number | null, integrationId?: number) {
  const db = await getDb();
  if (!db) return null;
  const conditions = [eq(whatsappIntegrations.status, "ativo")];
  if (studioId != null) conditions.push(eq(whatsappIntegrations.studioId, studioId));
  if (integrationId != null) conditions.push(eq(whatsappIntegrations.id, integrationId));
  const rows = await db
    .select()
    .from(whatsappIntegrations)
    .where(and(...conditions))
    .limit(1);
  return rows[0] ?? null;
}

/**
 * Obtém o token somente no servidor. Registros legados são criptografados na
 * primeira utilização e passam a armazenar apenas um marcador no campo antigo.
 */
export async function getIntegrationApiToken(integration: typeof whatsappIntegrations.$inferSelect): Promise<string> {
  if (integration.encryptedApiToken) return decryptIntegrationSecret(integration.encryptedApiToken);

  if (!integration.apiToken || integration.apiToken === "__encrypted_v1__") {
    throw new Error("A integração não possui uma credencial válida configurada.");
  }

  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível");
  const plaintext = integration.apiToken;
  await db.update(whatsappIntegrations).set({
    encryptedApiToken: encryptIntegrationSecret(plaintext),
    apiToken: "__encrypted_v1__",
    updatedAt: new Date().toISOString().slice(0, 19).replace("T", " "),
  }).where(eq(whatsappIntegrations.id, integration.id));
  return plaintext;
}

/** Instancia um provedor sem expor o token fora da camada do servidor. */
export async function getProviderForIntegration(integration: typeof whatsappIntegrations.$inferSelect): Promise<WhatsAppProvider> {
  return getProvider({
    provider: integration.provider,
    apiToken: await getIntegrationApiToken(integration),
    phoneNumber: integration.phoneNumber,
    instanceId: integration.instanceId ?? undefined,
  });
}

type MessageDeliveryPayload = {
  messageQueueId?: number;
  clientId?: number;
  appointmentReminderId?: number;
  recipientPhone: string;
  recipientName?: string;
  message: string;
};

type SendAndLogResult =
  | { success: true; messageId?: string; queued: boolean; duplicate: boolean }
  | { success: false; error: string };

const sqlDate = () => new Date().toISOString().slice(0, 19).replace("T", " ");

/**
 * O driver MySQL retorna atualizações como uma tupla cujo primeiro item contém
 * o cabeçalho. Mantemos compatibilidade com ambos os formatos para só processar
 * o job quando esta execução realmente tiver reservado a linha.
 */
export function getAffectedRows(result: unknown): number {
  const header = Array.isArray(result) ? result[0] : result;
  if (!header || typeof header !== "object") return 0;
  const affectedRows = (header as { affectedRows?: unknown }).affectedRows;
  return typeof affectedRows === "number" && Number.isFinite(affectedRows) ? affectedRows : 0;
}

export function getOutboundEventIdempotencyKey(jobIdempotencyKey: string): string {
  return hashIntegrationPayload(`event:${jobIdempotencyKey}`);
}

/**
 * Registra o envio no CRM e cria um job idempotente. A chamada externa não é
 * realizada na requisição do usuário, evitando que indisponibilidades bloqueiem
 * agenda, clientes e demais módulos.
 */
export async function sendAndLog(params: {
  studioId?: number | null;
  recipientPhone: string;
  recipientName?: string;
  recipientType: "client" | "artist";
  message: string;
  trigger?: string;
  appointmentId?: number;
  clientId?: number;
  integrationId?: number;
  retryOfQueueId?: number;
  appointmentReminderId?: number;
  /** Chave estável usada apenas por automações recorrentes para impedir duplicidade. */
  idempotencyKey?: string;
}): Promise<SendAndLogResult> {
  const integration = await getActiveIntegration(params.studioId, params.integrationId);
  if (!integration) {
    console.warn("[Messaging] Nenhuma integração ativa encontrada.");
    return { success: false, error: "Nenhuma integração ativa" };
  }

  const db = await getDb();
  if (!db) return { success: false, error: "Banco de dados indisponível" };

  const studioId = (params.studioId ?? integration.studioId) as number;
  try {
    return await db.transaction(async (tx) => {
      // A verificação e a escrita ocorrem na mesma transação. A restrição única
      // da fila de jobs cobre uma segunda execução concorrente do Heartbeat.
      if (params.idempotencyKey) {
        const existing = (await tx.select({ id: integrationJobs.id }).from(integrationJobs)
          .where(eq(integrationJobs.idempotencyKey, params.idempotencyKey)).limit(1))[0];
        if (existing) return { success: true, messageId: undefined, queued: false, duplicate: true };
      }

      const [queued] = await tx.insert(messageQueue).values({
        studioId,
        integrationId: integration.id,
        appointmentId: params.appointmentId,
        clientId: params.clientId,
        retryOfQueueId: params.retryOfQueueId,
        recipientPhone: params.recipientPhone,
        recipientName: params.recipientName,
        recipientType: params.recipientType,
        message: params.message,
        trigger: params.trigger,
        status: "pendente",
        scheduledAt: sqlDate(),
      });
      const queueId = (queued as any).insertId as number | undefined;
      const payload: MessageDeliveryPayload = {
        messageQueueId: queueId,
        clientId: params.clientId,
        appointmentReminderId: params.appointmentReminderId,
        recipientPhone: params.recipientPhone,
        recipientName: params.recipientName,
        message: params.message,
      };
      const payloadJson = JSON.stringify(payload);
      const idempotencyKey = params.idempotencyKey ?? hashIntegrationPayload(`message:${integration.id}:${queueId}:${payloadJson}`);

      await tx.insert(integrationJobs).values({
        studioId,
        integrationId: integration.id,
        type: "send_template",
        payload: payloadJson,
        idempotencyKey,
        status: "pending",
        nextAttemptAt: sqlDate(),
      });
      await tx.insert(integrationEvents).values({
        studioId,
        integrationId: integration.id,
        direction: "outbound",
        type: params.trigger ?? "custom",
        idempotencyKey: getOutboundEventIdempotencyKey(idempotencyKey),
        payloadHash: hashIntegrationPayload(payloadJson),
        status: "queued",
      });

      return { success: true, messageId: queueId ? String(queueId) : undefined, queued: true, duplicate: false };
    });
  } catch (error) {
    // Em corrida entre instâncias, a unicidade do job vence e a segunda tentativa
    // é tratada como já enfileirada — nunca como motivo para uma mensagem extra.
    if (params.idempotencyKey && String(error).includes("Duplicate entry")) {
      return { success: true, messageId: undefined, queued: false, duplicate: true };
    }
    throw error;
  }
}

function retryDelayMinutes(attempt: number): number {
  return [1, 5, 15, 60, 180][Math.min(attempt - 1, 4)] ?? 180;
}

/** Processa de forma limitada jobs prontos, podendo ser chamado somente pelo Heartbeat. */
export async function processPendingIntegrationJobs(limit = 10) {
  const db = await getDb();
  if (!db) return { processed: 0, completed: 0, retried: 0, failed: 0 };
  const now = sqlDate();
  const readyJobs = await db.select().from(integrationJobs).where(and(
    inArray(integrationJobs.status, ["pending", "retry"]),
    or(lte(integrationJobs.nextAttemptAt, now), sql`${integrationJobs.nextAttemptAt} IS NULL`),
  )).limit(limit);
  const result = { processed: 0, completed: 0, retried: 0, failed: 0 };

  for (const job of readyJobs) {
    const claimed = await db.update(integrationJobs).set({ status: "processing", lockedAt: now, updatedAt: now })
      .where(and(eq(integrationJobs.id, job.id), inArray(integrationJobs.status, ["pending", "retry"])));
    if (!getAffectedRows(claimed)) continue;
    result.processed += 1;

    let payload: MessageDeliveryPayload | null = null;
    try {
      const integration = (await db.select().from(whatsappIntegrations).where(and(
        eq(whatsappIntegrations.id, job.integrationId),
        eq(whatsappIntegrations.studioId, job.studioId),
      )).limit(1))[0];
      if (!integration || !integration.isEnabled || integration.status !== "ativo") {
        throw new Error("Integração inativa ou indisponível para este estúdio.");
      }
      payload = JSON.parse(job.payload) as MessageDeliveryPayload;
      if (integration.sandboxMode) {
        if (!integration.sandboxTestPhone) throw new Error("Defina o telefone de teste antes de ativar a homologação.");
        if (normalizeBrazilianPhone(payload.recipientPhone) !== integration.sandboxTestPhone) {
          throw new Error("Modo de teste: o destinatário não corresponde ao telefone de homologação.");
        }
      } else {
        if (!payload.clientId) throw new Error("Envios em produção exigem um cliente identificado e com consentimento de WhatsApp.");
        const consent = (await db.select().from(integrationContacts).where(and(
          eq(integrationContacts.studioId, job.studioId),
          eq(integrationContacts.clientId, payload.clientId),
          eq(integrationContacts.integrationId, integration.id),
        )).limit(1))[0];
        if (!consent?.hasWhatsappOptIn || consent.optedOutAt) {
          throw new Error("O cliente não possui consentimento ativo para receber WhatsApp.");
        }
      }
      const provider = await getProviderForIntegration(integration);
      const sent = await provider.sendMessage(payload.recipientPhone, payload.message);
      if (!sent.success) throw new Error(sent.error ?? "Falha desconhecida do provedor.");

      await db.update(integrationJobs).set({ status: "completed", completedAt: sqlDate(), lastError: null, updatedAt: sqlDate() })
        .where(eq(integrationJobs.id, job.id));
      if (payload.messageQueueId) await db.update(messageQueue).set({ status: "enviada", sentAt: sqlDate(), providerMessageId: sent.messageId, errorMessage: null })
        .where(eq(messageQueue.id, payload.messageQueueId));
      if (payload.appointmentReminderId) await db.update(appointmentReminders).set({ status: "sent", sentAt: sqlDate() })
        .where(eq(appointmentReminders.id, payload.appointmentReminderId));
      await db.update(integrationEvents).set({ status: "processed", processedAt: sqlDate(), errorMessage: null })
        .where(and(
          eq(integrationEvents.studioId, job.studioId),
          eq(integrationEvents.integrationId, integration.id),
          eq(integrationEvents.idempotencyKey, getOutboundEventIdempotencyKey(job.idempotencyKey)),
        ));
      await db.update(whatsappIntegrations).set({ lastSuccessAt: sqlDate(), failureCount: 0, lastErrorMessage: null })
        .where(eq(whatsappIntegrations.id, integration.id));
      result.completed += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro não identificado no processamento.";
      const nextAttempt = job.attemptCount + 1;
      const terminal = nextAttempt >= job.maxAttempts;
      const nextAttemptAt = new Date(Date.now() + retryDelayMinutes(nextAttempt) * 60_000).toISOString().slice(0, 19).replace("T", " ");
      await db.update(integrationJobs).set({
        status: terminal ? "failed" : "retry",
        attemptCount: nextAttempt,
        nextAttemptAt: terminal ? null : nextAttemptAt,
        lastError: message,
        updatedAt: sqlDate(),
      }).where(eq(integrationJobs.id, job.id));
      if (terminal) {
        if (payload?.messageQueueId) {
          await db.update(messageQueue).set({ status: "erro", errorMessage: message })
            .where(eq(messageQueue.id, payload.messageQueueId));
        }
        if (payload?.appointmentReminderId) {
          await db.update(appointmentReminders).set({ status: "failed" })
            .where(eq(appointmentReminders.id, payload.appointmentReminderId));
        }
        await db.update(integrationEvents).set({ status: "failed", errorMessage: message })
          .where(and(
            eq(integrationEvents.studioId, job.studioId),
            eq(integrationEvents.integrationId, job.integrationId),
            eq(integrationEvents.idempotencyKey, getOutboundEventIdempotencyKey(job.idempotencyKey)),
          ));
        result.failed += 1;
      } else result.retried += 1;
    }
  }
  return result;
}

/** Busca template por trigger e tipo de destinatário */
export async function getTemplate(
  trigger: string,
  recipientType: "client" | "artist",
  studioId?: number | null,
): Promise<string | null> {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select()
    .from(messageTemplates)
    .where(
      studioId != null
        ? and(eq(messageTemplates.trigger, trigger as any), eq(messageTemplates.studioId, studioId))
        : eq(messageTemplates.trigger, trigger as any),
    )
    .limit(10);

  const template = rows.find(
    (r: any) => r.recipientType === recipientType && r.isActive
  );
  return template?.message ?? null;
}

/** Dispara mensagem automática usando template + variáveis */
export async function dispatchTemplateMessage(params: {
  studioId?: number | null;
  trigger: string;
  recipientType: "client" | "artist";
  recipientPhone: string;
  recipientName?: string;
  appointmentId?: number;
  clientId?: number;
  vars: Record<string, string | undefined>;
  idempotencyKey?: string;
}): Promise<SendAndLogResult> {
  const template = await getTemplate(params.trigger, params.recipientType, params.studioId);
  if (!template) return { success: false, error: "Template não encontrado" };

  let cardLink = "";
  if (params.studioId && params.appointmentId && params.recipientType === "client" && ["appointment_created", "appointment_reminder_24h", "appointment_reminder_1h"].includes(params.trigger)) {
    try { cardLink = await (await import("./studioRelations")).artistCardLink(params.studioId, params.appointmentId); } catch { /* optional card must not block appointment confirmation */ }
  }
  const cleanedTemplate = removeLegacyNumericReplyInstruction(template);
  params.vars = {...params.vars, link_cartao_artista: cardLink};
  const interpolated = interpolateTemplate(cleanedTemplate, params.vars);
  const links = params.vars.__appointment_action_links as unknown as AppointmentActionLinks | undefined;
  const actionPlaceholders: Array<[keyof AppointmentActionLinks, string]> = [
    ["confirmed", "{link_confirmacao}"],
    ["early", "{link_adiantamento}"],
    ["late", "{link_atraso}"],
    ["reschedule_requested", "{link_remarcar}"],
  ];
  const missingActions = links
    ? actionPlaceholders.filter(([, placeholder]) => !cleanedTemplate.includes(placeholder)).map(([action]) => action)
    : [];
  let message = links && missingActions.length
    ? `${interpolated}\n\n${formatAppointmentActionLinks(links, missingActions)}`
    : interpolated;

  if (cardLink && !cleanedTemplate.includes("{link_cartao_artista}")) message += `\n\nConheça o artista e seus trabalhos: ${cardLink}`;
  return sendAndLog({
    studioId: params.studioId,
    recipientPhone: params.recipientPhone,
    recipientName: params.recipientName,
    recipientType: params.recipientType,
    message,
    trigger: params.trigger,
    appointmentId: params.appointmentId,
    clientId: params.clientId,
    idempotencyKey: params.idempotencyKey,
  });
}

/** Semeia os templates padrão se não existirem */
export async function seedDefaultTemplates(studioId = 1) {
  const db = await getDb();
  if (!db) return;
  const existing = await db
    .select({ trigger: messageTemplates.trigger, recipientType: messageTemplates.recipientType })
    .from(messageTemplates)
    .where(eq(messageTemplates.studioId, studioId));

  const defaults = [
    {
      studioId,
      name: "Confirmação de Agendamento (Cliente)",
      trigger: "appointment_created",
      recipientType: "client",
      message: "Olá, {nome_cliente}! Sua sessão no {nome_estudio} está marcada para {data} às {hora}, com {nome_artista}.\n\nUse os links abaixo para confirmar presença, avisar atraso ou solicitar remarcação.",
      isActive: 1,
    },
    {
      studioId,
      name: "Notificação de Agendamento (Tatuador)",
      trigger: "appointment_created",
      recipientType: "artist",
      message: "{nome_tatuador}, você tem um novo agendamento!\n\nCliente: {nome_cliente}\nData: {data} às {hora}\nServiço: {servico}\n\nO cliente foi notificado e aguarda confirmação.",
      isActive: 1,
    },
    {
      studioId,
      name: "Lembrete 24h (Cliente)",
      trigger: "appointment_reminder_24h",
      recipientType: "client",
      message: "Olá, {nome_cliente}! 🕐 Lembrando que sua sessão no {nome_estudio} é amanhã, {data} às {hora}, com {nome_tatuador}.\n\nEndereço: {endereco}\n\nUse os links abaixo para confirmar presença, avisar atraso ou solicitar remarcação.",
      isActive: 1,
    },
    {
      studioId,
      name: "Lembrete 24h (Tatuador)",
      trigger: "appointment_reminder_24h",
      recipientType: "artist",
      message: "{nome_tatuador}, lembrete: amanhã você tem sessão com {nome_cliente} às {hora}.\n\nServiço: {servico}",
      isActive: 1,
    },
    {
      studioId,
      name: "Confirmação pelo Cliente",
      trigger: "appointment_confirmed",
      recipientType: "artist",
      message: "{nome_tatuador}, o cliente {nome_cliente} *confirmou* o agendamento de {data} às {hora}. ✅",
      isActive: 1,
    },
    {
      studioId,
      name: "Solicitação de Remarcação",
      trigger: "appointment_rescheduled",
      recipientType: "artist",
      message: "{nome_tatuador}, o cliente {nome_cliente} *solicitou remarcação* do agendamento de {data} às {hora}. Por favor, entre em contato.",
      isActive: 1,
    },
    {
      studioId,
      name: "Lembrete 1h (Cliente)",
      trigger: "appointment_reminder_1h",
      recipientType: "client",
      message: "Olá, {nome_cliente}! Sua sessão de {servico} começa em aproximadamente 1 hora, às {hora}, com {nome_artista}.\n\nConfira seu preparo e fale conosco se precisar de ajuda.",
      isActive: 1,
    },
    {
      studioId,
      name: "Lembrete 1h (Artista)",
      trigger: "appointment_reminder_1h",
      recipientType: "artist",
      message: "{nome_artista}, sua sessão com {nome_cliente} começa em aproximadamente 1 hora, às {hora}.\n\nServiço: {servico}.",
      isActive: 1,
    },
    {
      studioId,
      name: "Orientações de Cuidados",
      trigger: "care_guide",
      recipientType: "client",
      message: "Olá, {nome_cliente}! Aqui estão suas orientações de pré e pós-procedimento.\n\nAnamnese: {link_anamnese}\nGuia de cuidados: {link_ebook}",
      isActive: 1,
    },
  ] as const;

  const missing = defaults.filter((template) => !existing.some((row) => (
    row.trigger === template.trigger && row.recipientType === template.recipientType
  )));
  if (missing.length > 0) await db.insert(messageTemplates).values(missing);
}
