import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { clients, messageQueue } from "../drizzle/schema";
import { quoteProposals } from "../drizzle/quoteProposalSchema";
import { quoteClientFirstName, parseQuotePayload } from "../shared/quoteProposal";
import { ENV } from "./_core/env";
import { getDb } from "./db";
import { normalizeBrazilianPhone } from "./messaging/phone";
import { recordQuoteInteraction } from "./quoteHistory";

export const quoteDeliveryTrigger = (id: number) => `quote_proposal:${id}`;
export const quoteIdFromTrigger = (trigger: string | null | undefined) => {
  const matched = /^quote_proposal:([1-9]\d*)$/.exec(trigger || "");
  return matched ? Number(matched[1]) : null;
};

export function quoteDeliveryMessage(quote: typeof quoteProposals.$inferSelect) {
  const payload = parseQuotePayload(quote.payload);
  if (!payload || !quote.publicToken) throw new Error("Finalize o orçamento e gere o link antes de enviar.");
  const configured = new URL(ENV.appBaseUrl || "https://crm.tatuei.com");
  const url = `${configured.origin}/proposta/${quote.publicToken}`;
  const name = quoteClientFirstName(payload.client.name) || "cliente";
  return `Olá, ${name}! Segue sua proposta de tatuagem com ${payload.artist.name}.\n\n${url}\n\nVálida até ${quote.validUntil.slice(0, 10).split("-").reverse().join("/")}. Pelo link, você pode consultar os detalhes, aceitar a proposta ou enviar uma dúvida.`;
}

/** Revalidate the quote and recipient just before delivery, including retries from Messaging. */
export async function quoteDeliveryError(studioId: number, quoteId: number, clientId: number | undefined, phone: string, sandbox: boolean) {
  const db = await getDb();
  if (!db) return "Banco indisponível para conferir o orçamento.";
  const [row] = await db.select({ clientId: quoteProposals.clientId, status: quoteProposals.status, validUntil: quoteProposals.validUntil, phone: clients.phone })
    .from(quoteProposals).innerJoin(clients, and(eq(clients.id, quoteProposals.clientId), eq(clients.studioId, quoteProposals.studioId)))
    .where(and(eq(quoteProposals.id, quoteId), eq(quoteProposals.studioId, studioId), eq(clients.isArchived, 0))).limit(1);
  if (sandbox) return "Orçamentos exigem uma conexão liberada para envio em produção.";
  if (!row || row.clientId !== clientId || ["draft", "cancelled", "rejected"].includes(row.status)) return "O orçamento não está disponível para este cliente.";
  if (row.validUntil.replace(" ", "T") < new Date().toISOString().slice(0, 19)) return "O orçamento venceu antes do envio. Prepare uma nova versão.";
  try { if (normalizeBrazilianPhone(row.phone || "") !== normalizeBrazilianPhone(phone)) return "O telefone do cliente mudou. Confira o cadastro antes de enviar."; }
  catch { return "O cliente precisa de um WhatsApp válido com DDD."; }
  return null;
}

export async function recordDeliveredQuote(id: number, studioId: number, sentAt: string) {
  await recordQuoteInteraction({ id, studioId, kind: "sent", sentSource: "integration", occurredAt: sentAt.replace(" ", "T").replace(/Z$/, "") + "Z" });
}

/** Repair bookkeeping only: never resends a message already accepted by the provider. */
export async function reconcileDeliveredQuotes() {
  const db = await getDb();
  if (!db) return;
  const rows = await db.select({ id: quoteProposals.id, studioId: quoteProposals.studioId, sentAt: sql<string>`MIN(${messageQueue.sentAt})` })
    .from(quoteProposals).innerJoin(messageQueue, and(eq(messageQueue.studioId, quoteProposals.studioId), eq(messageQueue.clientId, quoteProposals.clientId),
      sql`${messageQueue.trigger} = CONCAT('quote_proposal:', ${quoteProposals.id})`, inArray(messageQueue.status, ["enviada", "respondida"])))
    .where(isNull(quoteProposals.sentAt)).groupBy(quoteProposals.id, quoteProposals.studioId).limit(20);
  for (const row of rows) if (row.sentAt) await recordDeliveredQuote(row.id, row.studioId, row.sentAt);
}
