import { createHash } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { artists } from "../drizzle/schema";
import { quoteProposals } from "../drizzle/quoteProposalSchema";
import { parseQuotePayload, quoteClientFirstName } from "../shared/quoteProposal";
import { getDb } from "./db";
import { queueArtistOperationalNotice } from "./messaging/artistNotifications";

export type QuoteClientAction = "accepted" | "question" | "whatsapp_opened";

/** The recipient is resolved server-side from the quote's current assigned artist. */
export async function queueQuoteArtistNotification(row: typeof quoteProposals.$inferSelect, action: QuoteClientAction, text = "") {
  try {
    const db = await getDb();
    if (!db) return false;
    const [artist] = await db.select().from(artists).where(and(eq(artists.id, row.artistId), eq(artists.studioId, row.studioId))).limit(1);
    if (!artist || artist.active !== 1 || !artist.phone) return false;
    const payload = parseQuotePayload(row.payload);
    if (!payload) return false;
    const label: Record<QuoteClientAction, string> = {
      accepted: "Aceitou a proposta",
      question: "Enviou uma dúvida",
      whatsapp_opened: "Abriu o contato no WhatsApp (isso não confirma o envio de mensagem)",
    };
    const fingerprint = createHash("sha256").update(text.trim()).digest("hex").slice(0, 32);
    return await queueArtistOperationalNotice({
      studioId: row.studioId, artistId: row.artistId, clientId: row.clientId,
      trigger: `quote_artist_action:${row.id}:${action}`,
      idempotencyKey: `quote-artist:${row.studioId}:${row.id}:${action}:${fingerprint}`,
      message: `Olá, ${quoteClientFirstName(artist.name)}!\n\nCliente: ${quoteClientFirstName(payload.client.name)}\nOrçamento: ${row.quoteNumber}\nProjeto: ${payload.editor.project.title}\nAção: ${label[action]}${action === "question" ? `\n\nDúvida do cliente:\n${text.trim()}` : ""}\n\nConsulte o orçamento no CRM para acompanhar e responder pelo contato escolhido.`,
    });
  } catch {
    // A delivery problem must not undo a recorded acceptance/question.
    console.warn("[Quotes] Falha ao enfileirar aviso interno", { studioId: row.studioId, quoteId: row.id, action });
    return false;
  }
}
