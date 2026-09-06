import { and, eq } from "drizzle-orm";
import { integrationEvents, whatsappIntegrations } from "../../drizzle/schema";
import { getDb } from "../db";
import { decryptIntegrationSecret, hashIntegrationPayload, isWebhookSignatureValid } from "./crypto";
import { handleWebhookReply } from "./webhook";

type InboundMessage = { phone?: string; text?: string; eventId?: string };

function extractInboundMessage(payload: unknown): InboundMessage {
  const body = payload as any;
  if (body?.subscriber?.phone && body?.last_message?.text) {
    return { phone: String(body.subscriber.phone), text: String(body.last_message.text).trim(), eventId: body.id ? String(body.id) : undefined };
  }
  if (body?.phone && body?.text?.message) {
    return { phone: String(body.phone), text: String(body.text.message).trim(), eventId: body.messageId ? String(body.messageId) : undefined };
  }
  return { eventId: body?.id ? String(body.id) : undefined };
}

/**
 * Processa somente eventos autenticados na URL exclusiva da conexão.
 * O payload completo não é persistido: mantemos hash e metadados para auditoria.
 */
export async function receiveBotConversaWebhook(input: {
  connectionKey: string;
  rawBody: string;
  signature?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível");
  const integration = (await db.select().from(whatsappIntegrations)
    .where(and(eq(whatsappIntegrations.connectionKey, input.connectionKey), eq(whatsappIntegrations.provider, "botconversa")))
    .limit(1))[0];
  if (!integration?.studioId || !integration.encryptedWebhookSecret) {
    throw new Error("Conexão de webhook não encontrada.");
  }
  const secret = decryptIntegrationSecret(integration.encryptedWebhookSecret);
  if (!isWebhookSignatureValid(input.rawBody, secret, input.signature)) {
    throw new Error("Assinatura do webhook inválida.");
  }

  let payload: unknown;
  try {
    payload = JSON.parse(input.rawBody);
  } catch {
    throw new Error("Payload JSON inválido.");
  }
  const inbound = extractInboundMessage(payload);
  const payloadHash = hashIntegrationPayload(input.rawBody);
  const idempotencyKey = hashIntegrationPayload(`inbound:${integration.id}:${inbound.eventId ?? payloadHash}`);
  const known = await db.select({ id: integrationEvents.id }).from(integrationEvents)
    .where(eq(integrationEvents.idempotencyKey, idempotencyKey)).limit(1);
  if (known[0]) return { accepted: true, duplicate: true };

  await db.insert(integrationEvents).values({
    studioId: integration.studioId,
    integrationId: integration.id,
    direction: "inbound",
    type: "webhook_message",
    idempotencyKey,
    providerEventId: inbound.eventId,
    payloadHash,
    status: "received",
  });

  if (!inbound.phone || !inbound.text) {
    await db.update(integrationEvents).set({ status: "ignored", processedAt: new Date().toISOString().slice(0, 19).replace("T", " ") })
      .where(eq(integrationEvents.idempotencyKey, idempotencyKey));
    return { accepted: true, ignored: true };
  }

  try {
    await handleWebhookReply(inbound.phone, inbound.text, integration.studioId);
    await db.update(integrationEvents).set({ status: "processed", processedAt: new Date().toISOString().slice(0, 19).replace("T", " ") })
      .where(eq(integrationEvents.idempotencyKey, idempotencyKey));
    return { accepted: true, duplicate: false };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao processar mensagem recebida.";
    await db.update(integrationEvents).set({ status: "failed", errorMessage: message, processedAt: new Date().toISOString().slice(0, 19).replace("T", " ") })
      .where(eq(integrationEvents.idempotencyKey, idempotencyKey));
    throw error;
  }
}
