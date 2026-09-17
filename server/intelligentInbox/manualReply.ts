import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { clients, inboxConversations, inboxMessages, inboxSyncState, integrationContacts, whatsappIntegrations } from "../../drizzle/schema";
import { getDb } from "../db";
import { getIntegrationApiToken } from "../messaging/service";
import { BotConversaProvider } from "../messaging/providers/botconversa";
import { isOutboundMessagingBlocked, OUTBOUND_BLOCKED_ERROR } from "../messaging/outboundSafety";
import { normalizeBrazilianPhone } from "../messaging/phone";
import { privateConversationScope } from "./service";

const timestamp = () => new Date().toISOString().slice(0, 19).replace("T", " ");
const fail = (message: string): never => { throw new TRPCError({ code: "BAD_REQUEST", message }); };

/** The router authenticates the owner; every lookup also checks their exact connection. */
export async function sendManualInboxReply(studioId: number, ownerUserId: number, input: { conversationId: number; text: string; requestId: string }) {
  if (isOutboundMessagingBlocked()) fail(OUTBOUND_BLOCKED_ERROR);
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível." });
  const conversation = (await db.select().from(inboxConversations).where(and(
    privateConversationScope(db, studioId, ownerUserId), eq(inboxConversations.id, input.conversationId),
  )).limit(1))[0];
  if (!conversation) throw new TRPCError({ code: "NOT_FOUND", message: "Conversa indisponível para esta conta." });
  const sync = (await db.select().from(inboxSyncState).where(and(eq(inboxSyncState.studioId, studioId), eq(inboxSyncState.id, conversation.syncStateId))).limit(1))[0];
  const integration = sync?.integrationId ? (await db.select().from(whatsappIntegrations).where(and(
    eq(whatsappIntegrations.id, sync.integrationId), eq(whatsappIntegrations.studioId, studioId),
    eq(whatsappIntegrations.productionActivatedByUserId, ownerUserId), eq(whatsappIntegrations.provider, "botconversa"),
    eq(whatsappIntegrations.isEnabled, 1), eq(whatsappIntegrations.status, "ativo"),
  )).limit(1))[0] : null;
  if (!integration || !conversation.phone) fail("Conexão ou telefone indisponível.");
  const phone = normalizeBrazilianPhone(conversation.phone!);
  const key = `manual:${input.requestId}`;
  const scope = and(eq(inboxMessages.studioId, studioId), eq(inboxMessages.conversationId, conversation.id), eq(inboxMessages.externalMessageId, key));
  const existing = async () => (await db.select().from(inboxMessages).where(scope).limit(1))[0];
  const replay = (message: typeof inboxMessages.$inferSelect) => {
    if (message.textContent !== input.text) fail("Esta tentativa já foi usada para outra mensagem.");
    return { status: message.processingStatus, duplicate: true };
  };
  const previous = await existing();
  if (previous) return replay(previous);

  const inbound = (await db.select({ id: inboxMessages.id }).from(inboxMessages).where(and(
    eq(inboxMessages.studioId, studioId), eq(inboxMessages.conversationId, conversation.id), eq(inboxMessages.direction, "inbound"),
  )).limit(1))[0];
  if (!inbound) fail("A resposta manual exige uma mensagem recebida nesta conversa.");
  // Preserve the connection's existing production consent and test-recipient rules.
  if (integration!.sandboxMode) {
    if (!integration!.sandboxTestPhone || normalizeBrazilianPhone(integration!.sandboxTestPhone) !== phone) fail("Modo de teste: o destinatário não corresponde ao telefone de homologação.");
  } else {
    const consent = (await db.select().from(integrationContacts).where(and(
      eq(integrationContacts.studioId, studioId), eq(integrationContacts.integrationId, integration!.id), eq(integrationContacts.normalizedPhone, phone),
    )).limit(1))[0];
    if (!consent?.hasWhatsappOptIn || consent.optedOutAt) fail("O cliente não possui consentimento ativo. Confira Central de Mensagens → Consentimento.");
    const client = (await db.select().from(clients).where(and(eq(clients.studioId, studioId), eq(clients.id, consent!.clientId))).limit(1))[0];
    if (!client?.phone || normalizeBrazilianPhone(client.phone) !== phone) fail("Confira o telefone do cliente e registre o consentimento em Central de Mensagens → Consentimento.");
  }
  const provider = new BotConversaProvider({ provider: "botconversa", apiToken: await getIntegrationApiToken(integration!), phoneNumber: integration!.phoneNumber });
  // The unique key is a durable claim, across double clicks, tabs and processes.
  // Never reset a claimed attempt: a crash can happen after WhatsApp accepted it.
  try {
    await db.insert(inboxMessages).values({ studioId, conversationId: conversation.id, externalMessageId: key,
      direction: "outbound", actor: "attendant", messageType: "text", textContent: input.text,
      messageAt: timestamp(), processingStatus: "sending", metadata: JSON.stringify({ ownerUserId, integrationId: integration!.id }),
    });
  } catch (error) {
    const claimed = await existing();
    if (claimed) return replay(claimed);
    throw error;
  }
  const result = await provider.sendExistingContactReply(phone, input.text);
  await db.update(inboxMessages).set({ processingStatus: result.status, processedAt: timestamp(),
    metadata: JSON.stringify({ ownerUserId, integrationId: integration!.id, providerMessageId: result.messageId, error: result.error }),
  }).where(scope);
  // Do not change reminders, bot flows, opt-in or classification of a concurrent inbound message.
  return { status: result.status, duplicate: false };
}
