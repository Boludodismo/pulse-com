import { getDb } from "../db";
import { whatsappIntegrations, messageQueue, messageTemplates } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import type { ProviderConfig, WhatsAppProvider } from "./provider";
import { interpolateTemplate } from "./provider";
import { BotConversaProvider } from "./providers/botconversa";
import { ZApiProvider } from "./providers/zapi";
import { MetaProvider } from "./providers/meta";

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
export async function getActiveIntegration() {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select()
    .from(whatsappIntegrations)
    .where(eq(whatsappIntegrations.status, "ativo"))
    .limit(1);
  return rows[0] ?? null;
}

/** Envia uma mensagem e registra na fila */
export async function sendAndLog(params: {
  recipientPhone: string;
  recipientName?: string;
  recipientType: "client" | "artist";
  message: string;
  trigger?: string;
  appointmentId?: number;
  clientId?: number;
}) {
  const integration = await getActiveIntegration();
  if (!integration) {
    console.warn("[Messaging] Nenhuma integração ativa encontrada.");
    return { success: false, error: "Nenhuma integração ativa" };
  }

  const db = await getDb();
  if (!db) return { success: false, error: "Banco de dados indisponível" };

  // Registra na fila como pendente
  const [queued] = await db.insert(messageQueue).values({
    integrationId: integration.id,
    appointmentId: params.appointmentId,
    clientId: params.clientId,
    recipientPhone: params.recipientPhone,
    recipientName: params.recipientName,
    recipientType: params.recipientType,
    message: params.message,
    trigger: params.trigger,
    status: "pendente",
    scheduledAt: new Date().toISOString().slice(0, 19).replace("T", " "),
  });

  const provider = getProvider({
    provider: integration.provider,
    apiToken: integration.apiToken,
    phoneNumber: integration.phoneNumber,
    instanceId: integration.instanceId ?? undefined,
  });

  const result = await provider.sendMessage(params.recipientPhone, params.message);

  // Atualiza status na fila
  const queueId = (queued as any).insertId;
  if (queueId) {
    await db.update(messageQueue)
      .set({
        status: result.success ? "enviada" : "erro",
        sentAt: result.success ? new Date().toISOString().slice(0, 19).replace("T", " ") : undefined,
        errorMessage: result.error,
        providerMessageId: result.messageId,
      })
      .where(eq(messageQueue.id, queueId));
  }

  return result;
}

/** Busca template por trigger e tipo de destinatário */
export async function getTemplate(
  trigger: string,
  recipientType: "client" | "artist"
): Promise<string | null> {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select()
    .from(messageTemplates)
    .where(eq(messageTemplates.trigger, trigger as any))
    .limit(10);

  const template = rows.find(
    (r: any) => r.recipientType === recipientType && r.isActive
  );
  return template?.message ?? null;
}

/** Dispara mensagem automática usando template + variáveis */
export async function dispatchTemplateMessage(params: {
  trigger: string;
  recipientType: "client" | "artist";
  recipientPhone: string;
  recipientName?: string;
  appointmentId?: number;
  clientId?: number;
  vars: Record<string, string | undefined>;
}) {
  const template = await getTemplate(params.trigger, params.recipientType);
  if (!template) return { success: false, error: "Template não encontrado" };

  const message = interpolateTemplate(template, params.vars);

  return sendAndLog({
    recipientPhone: params.recipientPhone,
    recipientName: params.recipientName,
    recipientType: params.recipientType,
    message,
    trigger: params.trigger,
    appointmentId: params.appointmentId,
    clientId: params.clientId,
  });
}

/** Semeia os templates padrão se não existirem */
export async function seedDefaultTemplates() {
  const db = await getDb();
  if (!db) return;
  const existing = await db.select().from(messageTemplates).limit(1);
  if (existing.length > 0) return;

  await db.insert(messageTemplates).values([
    {
      name: "Confirmação de Agendamento (Cliente)",
      trigger: "appointment_created",
      recipientType: "client",
      message: "Olá, {nome_cliente}! 🎨 Sua sessão no {nome_estudio} está marcada para {data} às {hora}, com {nome_tatuador}.\n\nResponda *1* para confirmar ou *2* para solicitar remarcação.",
      isActive: 1,
    },
    {
      name: "Notificação de Agendamento (Tatuador)",
      trigger: "appointment_created",
      recipientType: "artist",
      message: "{nome_tatuador}, você tem um novo agendamento!\n\nCliente: {nome_cliente}\nData: {data} às {hora}\nServiço: {servico}\n\nO cliente foi notificado e aguarda confirmação.",
      isActive: 1,
    },
    {
      name: "Lembrete 24h (Cliente)",
      trigger: "appointment_reminder_24h",
      recipientType: "client",
      message: "Olá, {nome_cliente}! 🕐 Lembrando que sua sessão no {nome_estudio} é amanhã, {data} às {hora}, com {nome_tatuador}.\n\nEndereço: {endereco}\n\nResponda *1* para confirmar presença.",
      isActive: 1,
    },
    {
      name: "Lembrete 24h (Tatuador)",
      trigger: "appointment_reminder_24h",
      recipientType: "artist",
      message: "{nome_tatuador}, lembrete: amanhã você tem sessão com {nome_cliente} às {hora}.\n\nServiço: {servico}",
      isActive: 1,
    },
    {
      name: "Confirmação pelo Cliente",
      trigger: "appointment_confirmed",
      recipientType: "artist",
      message: "{nome_tatuador}, o cliente {nome_cliente} *confirmou* o agendamento de {data} às {hora}. ✅",
      isActive: 1,
    },
    {
      name: "Solicitação de Remarcação",
      trigger: "appointment_rescheduled",
      recipientType: "artist",
      message: "{nome_tatuador}, o cliente {nome_cliente} *solicitou remarcação* do agendamento de {data} às {hora}. Por favor, entre em contato.",
      isActive: 1,
    },
  ]);
}
