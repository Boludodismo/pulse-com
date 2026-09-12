import { and, desc, eq } from "drizzle-orm";
import { clients, inboxConversations, inboxMessages, inboxSyncState, whatsappIntegrations } from "../../drizzle/schema";
import { emptyInboxMetrics } from "../../shared/intelligentInbox";
import { getDb } from "../db";
import { normalizeBrazilianPhone } from "../messaging/phone";

const now = () => new Date().toISOString().slice(0, 19).replace("T", " ");

export function inboxStatus(connected = false) {
  return { requestedEnabled: true, operational: connected, status: connected ? "connected" as const : "not_configured" as const, phase: "readonly" as const, botConversaConnected: connected, aiConnected: false, webhookActive: connected, syncActive: connected, summaryJobActive: false, readOnly: true as const };
}

async function activeIntegration(studioId: number) {
  const db = await getDb();
  if (!db) return null;
  return (await db.select().from(whatsappIntegrations).where(and(eq(whatsappIntegrations.studioId, studioId), eq(whatsappIntegrations.provider, "botconversa"), eq(whatsappIntegrations.isEnabled, 1), eq(whatsappIntegrations.status, "ativo"))).orderBy(desc(whatsappIntegrations.updatedAt)).limit(1))[0] ?? null;
}

export async function readonlyInboxStatus(studioId: number) { return inboxStatus(!!(await activeIntegration(studioId))); }

function classify(text: string) {
  const value = text.toLocaleLowerCase("pt-BR");
  if (/reclama|insatisfeit|problema|péssim|pessim/.test(value)) return { classification: "complaint", priority: "HIGH", purchaseIntent: "UNKNOWN", status: "open" };
  if (/urgente|hoje|agora|socorro/.test(value)) return { classification: "needs_reply", priority: "URGENT", purchaseIntent: "UNKNOWN", status: "open" };
  if (/orçamento|orcamento|valor|preço|preco|quanto custa/.test(value)) return { classification: "quote_request", priority: "NORMAL", purchaseIntent: "HIGH_INTENT", status: "open" };
  if (/reagend|remarc|outro dia|outra data/.test(value)) return { classification: "reschedule", priority: "NORMAL", purchaseIntent: "UNKNOWN", status: "open" };
  if (/cancel|não vou|nao vou|desist/.test(value)) return { classification: "cancellation", priority: "HIGH", purchaseIntent: "LOW_INTENT", status: "open" };
  if (/referência|referencia|imagem|foto|desenho/.test(value)) return { classification: "reference_received", priority: "NORMAL", purchaseIntent: "MEDIUM_INTENT", status: "open" };
  if (/fechar|quero fazer|pode agendar|qual data|sinal/.test(value)) return { classification: "high_purchase_intent", priority: "HIGH", purchaseIntent: "READY_TO_CLOSE", status: "open" };
  if (/confirmo|confirmado|obrigad|resolvido|tudo certo/.test(value)) return { classification: "resolved", priority: "LOW", purchaseIntent: "UNKNOWN", status: "resolved" };
  return { classification: "needs_reply", priority: "NORMAL", purchaseIntent: "UNKNOWN", status: "open" };
}

export async function ingestReadonlyMessage(input: { studioId: number; integrationId: number; eventId: string; phone: string; text: string; clientName?: string; messageAt?: string }) {
  const db = await getDb();
  if (!db) return { stored: false };
  const phone = normalizeBrazilianPhone(input.phone);
  const timestamp = input.messageAt ?? now();
  let sync = (await db.select().from(inboxSyncState).where(and(eq(inboxSyncState.studioId, input.studioId), eq(inboxSyncState.integrationId, input.integrationId))).limit(1))[0];
  if (!sync) {
    const inserted = await db.insert(inboxSyncState).values({ studioId: input.studioId, integrationId: input.integrationId, name: "CRM Tatuei · somente leitura", provider: "botconversa", status: "connected", connectedAt: timestamp, webhookConfigured: 1, syncEnabled: 1, summaryEnabled: 0, syncStatus: "webhook", lastSyncAt: timestamp, lastMessageAt: timestamp });
    const id = Number((inserted as any)[0]?.insertId);
    sync = (await db.select().from(inboxSyncState).where(and(eq(inboxSyncState.studioId, input.studioId), eq(inboxSyncState.id, id))).limit(1))[0];
  }
  if (!sync) throw new Error("Não foi possível iniciar a leitura da Central Inteligente.");
  const studioClients = await db.select({ id: clients.id, name: clients.name, phone: clients.phone, artistId: clients.artistId }).from(clients).where(eq(clients.studioId, input.studioId));
  const client = studioClients.find(item => { if (!item.phone) return false; try { return normalizeBrazilianPhone(item.phone) === phone; } catch { return false; } });
  const analysis = classify(input.text);
  let conversation = (await db.select().from(inboxConversations).where(and(eq(inboxConversations.studioId, input.studioId), eq(inboxConversations.syncStateId, sync.id), eq(inboxConversations.externalConversationId, phone))).limit(1))[0];
  if (!conversation) {
    const inserted = await db.insert(inboxConversations).values({ studioId: input.studioId, syncStateId: sync.id, clientId: client?.id ?? null, externalContactId: phone, externalConversationId: phone, clientName: client?.name ?? input.clientName ?? phone, phone, source: "botconversa_webhook", channel: "whatsapp", artistId: client?.artistId ?? null, lastInteractionAt: timestamp, waitingSince: analysis.status === "open" ? timestamp : null, status: analysis.status, priority: analysis.priority, classification: analysis.classification, summary: input.text.slice(0, 500), purchaseIntent: analysis.purchaseIntent, processingStatus: "rules_processed", lastProcessedAt: timestamp });
    const id = Number((inserted as any)[0]?.insertId);
    conversation = (await db.select().from(inboxConversations).where(and(eq(inboxConversations.studioId, input.studioId), eq(inboxConversations.id, id))).limit(1))[0];
  } else {
    await db.update(inboxConversations).set({ clientId: conversation.clientId ?? client?.id ?? null, clientName: client?.name ?? input.clientName ?? conversation.clientName, artistId: conversation.artistId ?? client?.artistId ?? null, lastInteractionAt: timestamp, waitingSince: analysis.status === "open" ? timestamp : conversation.waitingSince, status: analysis.status, priority: analysis.priority, classification: analysis.classification, summary: input.text.slice(0, 500), purchaseIntent: analysis.purchaseIntent, processingStatus: "rules_processed", lastProcessedAt: timestamp }).where(and(eq(inboxConversations.studioId, input.studioId), eq(inboxConversations.id, conversation.id)));
  }
  if (!conversation) throw new Error("Não foi possível registrar a conversa.");
  const duplicate = (await db.select({ id: inboxMessages.id }).from(inboxMessages).where(and(eq(inboxMessages.studioId, input.studioId), eq(inboxMessages.conversationId, conversation.id), eq(inboxMessages.externalMessageId, input.eventId))).limit(1))[0];
  if (!duplicate) await db.insert(inboxMessages).values({ studioId: input.studioId, conversationId: conversation.id, externalMessageId: input.eventId, messageType: "text", direction: "inbound", actor: "customer", textContent: input.text, messageAt: timestamp, processedAt: timestamp, processingStatus: "rules_processed" });
  await db.update(inboxSyncState).set({ lastSyncAt: timestamp, lastMessageAt: timestamp, lastProcessedAt: timestamp, syncStatus: "webhook", lastError: null }).where(and(eq(inboxSyncState.studioId, input.studioId), eq(inboxSyncState.id, sync.id)));
  return { stored: !duplicate, conversationId: conversation.id };
}

export async function inboxDashboard(studioId: number) {
  const db = await getDb(); const status = await readonlyInboxStatus(studioId); const metrics = emptyInboxMetrics();
  if (!db || !status.operational) return { status, metrics, period: null, lastProcessedAt: null };
  const rows = await db.select().from(inboxConversations).where(eq(inboxConversations.studioId, studioId)); metrics.moved = rows.length;
  for (const row of rows) { if (row.classification === "needs_reply") metrics.needsReply++; if (row.classification === "quote_request") metrics.quotes++; if (row.classification === "reschedule") metrics.reschedules++; if (row.classification === "cancellation") metrics.cancellations++; if (row.classification === "waiting_information") metrics.waitingInformation++; if (row.classification === "reference_received") metrics.references++; if (row.classification === "high_purchase_intent") metrics.opportunities++; if (row.classification === "complaint") metrics.complaints++; if (row.priority === "HIGH" || row.priority === "URGENT") metrics.highPriority++; if (row.status === "resolved") metrics.resolved++; }
  return { status, metrics, period: "all", lastProcessedAt: rows.map(r => r.lastProcessedAt).filter(Boolean).sort().at(-1) ?? null };
}

export async function listInboxConversations(studioId: number, filters: { limit: number; cursor?: number; search?: string; classification?: string; priority?: string; clientId?: number }) {
  const db = await getDb(); if (!db) return { items: [], nextCursor: null, status: inboxStatus(false) };
  let rows = await db.select().from(inboxConversations).where(eq(inboxConversations.studioId, studioId)).orderBy(desc(inboxConversations.lastInteractionAt), desc(inboxConversations.id)).limit(500);
  if (filters.cursor) rows = rows.filter(row => row.id < filters.cursor!);
  if (filters.search) { const q = filters.search.toLocaleLowerCase("pt-BR"); rows = rows.filter(row => `${row.clientName ?? ""} ${row.phone ?? ""} ${row.summary ?? ""}`.toLocaleLowerCase("pt-BR").includes(q)); }
  if (filters.classification) rows = rows.filter(row => row.classification === filters.classification); if (filters.priority) rows = rows.filter(row => row.priority === filters.priority); if (filters.clientId) rows = rows.filter(row => row.clientId === filters.clientId);
  const items = rows.slice(0, filters.limit); return { items, nextCursor: rows.length > filters.limit ? items.at(-1)?.id ?? null : null, status: await readonlyInboxStatus(studioId) };
}

export async function listInboxMessages(studioId: number, conversationId: number, limit: number, cursor?: number) {
  const db = await getDb(); if (!db) return { items: [], nextCursor: null, status: inboxStatus(false) };
  const conversation = (await db.select({ id: inboxConversations.id }).from(inboxConversations).where(and(eq(inboxConversations.studioId, studioId), eq(inboxConversations.id, conversationId))).limit(1))[0];
  if (!conversation) return { items: [], nextCursor: null, status: await readonlyInboxStatus(studioId) };
  let rows = await db.select().from(inboxMessages).where(and(eq(inboxMessages.studioId, studioId), eq(inboxMessages.conversationId, conversationId))).orderBy(desc(inboxMessages.id)).limit(500); if (cursor) rows = rows.filter(row => row.id < cursor);
  const items = rows.slice(0, limit); return { items, nextCursor: rows.length > limit ? items.at(-1)?.id ?? null : null, status: await readonlyInboxStatus(studioId) };
}

export async function inboxSettings(studioId: number) {
  const integration = await activeIntegration(studioId); const db = await getDb(); const sync = db && integration ? (await db.select().from(inboxSyncState).where(and(eq(inboxSyncState.studioId, studioId), eq(inboxSyncState.integrationId, integration.id))).limit(1))[0] : null;
  return { provider: "BotConversa", name: integration?.name ?? null, status: integration ? "connected" : "not_configured", externalId: integration ? String(integration.id) : null, connectedAt: sync?.connectedAt ?? null, lastSyncAt: sync?.lastSyncAt ?? null, webhookConfigured: !!integration, syncActive: !!integration, intelligentSummaryActive: false, summaryIntervalMinutes: 60, editable: false, readOnly: true };
}

export function disabledInboxOperation() { return { accepted: false as const, reason: "read_only" as const, message: "Central em modo somente leitura. Nenhuma resposta será enviada." }; }
