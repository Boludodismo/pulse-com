import { TRPCError } from "@trpc/server";
import { and, eq, sql } from "drizzle-orm";
import { quoteProposals } from "../drizzle/quoteProposalSchema";
import { careTags } from "../drizzle/customerCareSchema";
import { appointments } from "../drizzle/schema";
import { QUOTE_RESPONDED_TAG, QUOTE_SENT_TAG } from "../shared/quoteHistory";
import { getDb } from "./db";

export const quoteHasResponse = sql`(${quoteProposals.respondedAt} IS NOT NULL OR ${quoteProposals.acceptedAt} IS NOT NULL)`;
export const quoteHasBooking = sql`EXISTS (SELECT 1 FROM ${appointments} WHERE
  ${appointments.quoteId} = ${quoteProposals.id} AND ${appointments.studioId} = ${quoteProposals.studioId}
  AND ${appointments.clientId} = ${quoteProposals.clientId} AND ${appointments.artistId} = ${quoteProposals.artistId}
  AND ${appointments.status} IN ('agendado', 'confirmado', 'concluido'))`;

type Interaction = {
  id: number; studioId: number; artistId?: number | null; userId?: number;
  kind: "sent" | "manual_response" | "public_question" | "public_accept";
  text?: string; occurredAt?: string; status?: "approved" | "rejected";
  sentSource?: "integration" | "manual";
};

/** Row lock + tag upsert keep retries/concurrent acceptance idempotent. No messaging side effects. */
export async function recordQuoteInteraction(input: Interaction) {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "SERVICE_UNAVAILABLE" });
  return db.transaction(async tx => {
    const [row] = await tx.select().from(quoteProposals).where(and(
      eq(quoteProposals.id, input.id), eq(quoteProposals.studioId, input.studioId),
    )).limit(1).for("update");
    if (!row || (input.artistId != null && row.artistId !== input.artistId)) throw new TRPCError({ code: "NOT_FOUND", message: "Orçamento não encontrado." });
    if (row.status === "draft" || (row.status === "cancelled" && input.sentSource !== "integration")) throw new TRPCError({ code: "CONFLICT", message: "Este orçamento não está disponível para registro." });
    const now = new Date().toISOString().slice(0, 19).replace("T", " ");
    const occurredAt = input.occurredAt ? new Date(input.occurredAt).toISOString().slice(0, 19).replace("T", " ") : now;
    if (occurredAt > now || occurredAt.slice(0, 10) < row.createdDate.slice(0, 10)) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Informe uma data entre a criação do orçamento e o momento atual." });
    }
    if (input.kind === "public_accept") {
      // Recheck after acquiring the lock: cancellation/expiration must win over a stale public read.
      if (row.status === "rejected") throw new TRPCError({ code: "CONFLICT", message: "Esta proposta já foi recusada." });
      if (row.validUntil.replace(" ", "T") < new Date().toISOString().slice(0, 19)) throw new TRPCError({ code: "BAD_REQUEST", message: "Esta proposta está vencida. Fale com o estúdio." });
    }
    const changes: Partial<typeof quoteProposals.$inferInsert> = {};
    if (input.kind === "sent") {
      if (!row.sentAt) {
        changes.sentAt = occurredAt;
        changes.sentByUserId = input.userId;
        changes.sentSource = input.sentSource || "manual";
        if (row.status === "finalized") changes.status = "sent";
      }
    } else {
      if (!row.respondedAt) {
        changes.respondedAt = row.acceptedAt || occurredAt;
        changes.responseSource = row.acceptedAt ? "public_accept" : input.kind;
        changes.responseText = row.acceptedAt ? null : input.text || null;
        changes.responseByUserId = row.acceptedAt ? null : input.userId || null;
      }
      if (input.kind === "public_question" && !row.questionAt) {
        changes.questionAt = now;
        changes.questionText = input.text;
      }
      if (input.kind === "public_accept") {
        changes.status = "approved";
        changes.acceptedAt = row.acceptedAt || now;
        changes.viewedAt = row.viewedAt || now;
      } else if (input.status) changes.status = input.status;
    }
    if (Object.keys(changes).length) await tx.update(quoteProposals).set(changes).where(and(eq(quoteProposals.id, row.id), eq(quoteProposals.studioId, row.studioId)));
    const label = input.kind === "sent" ? QUOTE_SENT_TAG : QUOTE_RESPONDED_TAG;
    await tx.insert(careTags).values({ studioId: row.studioId, clientId: row.clientId, label }).onDuplicateKeyUpdate({ set: { label } });
    return { ok: true, acceptedAt: changes.acceptedAt || row.acceptedAt, sentAt: changes.sentAt || row.sentAt, respondedAt: changes.respondedAt || row.respondedAt || row.acceptedAt };
  });
}

export async function validateAppointmentQuote(input: { quoteId: number; studioId: number; clientId: number; artistId: number | null; userArtistId?: number | null }) {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "SERVICE_UNAVAILABLE" });
  const [quote] = await db.select().from(quoteProposals).where(and(eq(quoteProposals.id, input.quoteId), eq(quoteProposals.studioId, input.studioId))).limit(1);
  if (!quote || quote.studioId !== input.studioId || quote.clientId !== input.clientId || quote.artistId !== input.artistId
    || (input.userArtistId != null && quote.artistId !== input.userArtistId)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Escolha um orçamento deste cliente, artista e estúdio." });
  }
  if (["draft", "rejected", "cancelled"].includes(quote.status)) throw new TRPCError({ code: "CONFLICT", message: "Não é possível agendar um orçamento em rascunho, recusado ou cancelado." });
}
