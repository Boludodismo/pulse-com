import { randomBytes, randomUUID } from "node:crypto";
import { TRPCError } from "@trpc/server";
import { and, desc, eq, isNull, isNotNull, ne, not, lt, or, sql } from "drizzle-orm";
import { z } from "zod";
import { publicProcedure, router, tenantProcedure } from "../_core/trpc";
import * as dbHelpers from "../db";
import { storagePut } from "../storage";
import { prepareProtectedQuoteArtwork, publicQuotePayload } from "../quoteArtworkProtection";
import { artistQuoteBranding, quotePresets, quoteProposals } from "../../drizzle/quoteProposalSchema";
import { artistCards } from "../../drizzle/studioRelationsSchema";
import { appointments, integrationContacts, messageQueue } from "../../drizzle/schema";
import { quoteHistoryText } from "../../shared/quoteHistory";
import { quoteHasBooking, quoteHasResponse, recordQuoteInteraction } from "../quoteHistory";
import { getActiveIntegration, sendAndLog } from "../messaging/service";
import { assertPrivateConnectionAccess } from "../messaging/privateConnectionAccess";
import { normalizeBrazilianPhone } from "../messaging/phone";
import { isOutboundMessagingBlocked, OUTBOUND_BLOCKED_ERROR } from "../messaging/outboundSafety";
import { quoteDeliveryTrigger, quoteDeliveryMessage, quoteDeliveryError } from "../quoteDelivery";
import {
  QUOTE_PRESET_CATEGORIES,
  parseQuotePayload,
  quoteEditorDataSchema,
  quoteStoredPayloadSchema,
  quoteMediaSchema,
  QUOTE_TEXT_LIMIT,
  type QuoteEditorData,
  quoteClientFirstName,
} from "../../shared/quoteProposal";

const idSchema = z.number().int().positive();
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida.");
const quoteStatusSchema = z.enum(["draft", "finalized", "sent", "approved", "rejected", "expired", "cancelled"]);
const logoSourceSchema = z.enum(["personal", "studio", "none"]);
const publicTokenSchema = z.string().regex(/^[a-f0-9]{48}$/, "Link inválido.");

async function connection() {
  const db = await dbHelpers.getDb();
  if (!db) throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "Banco de dados indisponível." });
  return db;
}

function sqlDate(date: string, endOfDay = false) {
  return `${date} ${endOfDay ? "23:59:59" : "00:00:00"}`;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function nowSql() {
  return new Date().toISOString().slice(0, 19).replace("T", " ");
}

function proposalExpired(validUntil: string | Date) {
  const raw = validUntil instanceof Date ? validUntil.toISOString() : String(validUntil);
  const normalized = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(raw) ? raw.replace(" ", "T") : raw;
  return Date.parse(normalized) < Date.now();
}

function imageExtension(mimeType: string) {
  if (mimeType === "image/jpeg") return "jpg";
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/webp") return "webp";
  throw new TRPCError({ code: "BAD_REQUEST", message: "Formato de imagem não suportado." });
}

function decodeImage(input: { imageBase64: string; mimeType: string }, maxBytes = 6 * 1024 * 1024) {
  const encoded = input.imageBase64.includes(",") ? input.imageBase64.split(",")[1] : input.imageBase64;
  let buffer: Buffer;
  try {
    buffer = Buffer.from(encoded || "", "base64");
  } catch {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Não foi possível ler a imagem." });
  }
  if (!buffer.length || buffer.length > maxBytes) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "A imagem deve ter no máximo 6 MB." });
  }
  return buffer;
}

async function resolveArtist(ctx: { studioId: number; artistId: number | null }, requestedArtistId: number) {
  if (ctx.artistId != null && ctx.artistId !== requestedArtistId) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Este orçamento precisa estar vinculado ao seu próprio perfil de artista." });
  }
  const artist = await dbHelpers.getArtistById(requestedArtistId, ctx.studioId);
  if (!artist || artist.studioId !== ctx.studioId || artist.active !== 1) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Artista ativo não encontrado neste estúdio." });
  }
  return artist;
}

async function resolveClient(studioId: number, clientId: number) {
  const client = await dbHelpers.getClientById(clientId);
  if (!client || client.studioId !== studioId) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Cliente não encontrado neste estúdio." });
  }
  return client;
}

async function brandingRow(studioId: number, artistId: number) {
  const db = await connection();
  return (await db.select().from(artistQuoteBranding)
    .where(and(eq(artistQuoteBranding.studioId, studioId), eq(artistQuoteBranding.artistId, artistId)))
    .limit(1))[0] ?? null;
}

async function publishedArtistCardPath(studioId: number, artistId: number) {
  const db = await connection();
  const card = (await db.select({ token: artistCards.token }).from(artistCards)
    .where(and(eq(artistCards.studioId, studioId), eq(artistCards.artistId, artistId), eq(artistCards.published, 1)))
    .limit(1))[0];
  return card ? `/artista/${card.token}` : null;
}

async function buildStoredPayload(input: {
  studioId: number;
  clientId: number;
  artistId: number;
  editor: QuoteEditorData;
}) {
  const [client, artist, settings, branding] = await Promise.all([
    resolveClient(input.studioId, input.clientId),
    dbHelpers.getArtistById(input.artistId, input.studioId),
    dbHelpers.getStudioSettings(input.studioId),
    brandingRow(input.studioId, input.artistId),
  ]);
  if (!artist || artist.studioId !== input.studioId) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Artista não encontrado neste estúdio." });
  }
  return quoteStoredPayloadSchema.parse({
    version: 1,
    editor: input.editor,
    client: {
      id: client.id,
      name: client.name,
      email: client.email ?? null,
      phone: client.phone ?? null,
    },
    artist: {
      id: artist.id,
      name: artist.name,
      bio: artist.bio ?? null,
      specialty: artist.specialty ?? null,
      photoUrl: artist.photoUrl ?? null,
      phone: artist.phone ?? null,
      email: artist.email ?? null,
      instagram: artist.instagram ?? null,
    },
    studio: {
      name: settings?.studioName ?? null,
      logoUrl: settings?.logoUrl ?? null,
      phone: settings?.phone ?? null,
      email: settings?.email ?? null,
      instagram: settings?.instagram ?? null,
    },
    branding: {
      personalLogoUrl: branding?.personalLogoUrl ?? null,
      personalLogoKey: branding?.personalLogoKey ?? null,
    },
  });
}

async function publicQuoteByToken(token: string) {
  const db = await connection();
  const row = (await db.select().from(quoteProposals)
    .where(eq(quoteProposals.publicToken, token))
    .limit(1))[0];
  if (!row || row.status === "draft" || row.status === "cancelled") {
    throw new TRPCError({ code: "NOT_FOUND", message: "Proposta não encontrada ou indisponível." });
  }
  let payload = parseQuotePayload(row.payload);
  if (!payload) {
    throw new TRPCError({ code: "CONFLICT", message: "Esta proposta precisa ser atualizada pelo estúdio." });
  }
  // Older copies contained an internal quote number. Regenerate only image protection,
  // preserving the finalized texts, amounts, token and original artwork.
  if (payload.protectedMedia.some(copy => copy.markVersion !== 2)) {
    payload = await prepareProtectedQuoteArtwork(payload, row.studioId, row.artistId, row.quoteNumber);
    await db.update(quoteProposals).set({payload:JSON.stringify(payload)})
      .where(and(eq(quoteProposals.id,row.id),eq(quoteProposals.studioId,row.studioId),eq(quoteProposals.payload,row.payload)));
  }
  return { row, payload, expired: proposalExpired(row.validUntil) };
}

async function accessibleQuote(ctx: { studioId: number; artistId: number | null }, id: number) {
  const db = await connection();
  const row = (await db.select().from(quoteProposals)
    .where(and(eq(quoteProposals.id, id), eq(quoteProposals.studioId, ctx.studioId)))
    .limit(1))[0];
  if (!row || (ctx.artistId != null && row.artistId !== ctx.artistId)) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Orçamento não encontrado." });
  }
  return row;
}

function requireHistoryArtist(ctx: { user: { role: string }; artistId: number | null }) {
  if (ctx.user.role === "collaborator" && !ctx.artistId) throw new TRPCError({ code: "FORBIDDEN" });
}

async function deliveryDetails(ctx: Parameters<typeof assertPrivateConnectionAccess>[0] & { studioId: number }, row: typeof quoteProposals.$inferSelect) {
  await assertPrivateConnectionAccess(ctx, row.studioId);
  const db = await connection();
  const [integration, client, deliveries] = await Promise.all([
    getActiveIntegration(row.studioId), resolveClient(row.studioId, row.clientId),
    db.select({ id: messageQueue.id, status: messageQueue.status, sentAt: messageQueue.sentAt, error: messageQueue.errorMessage })
      .from(messageQueue).where(and(eq(messageQueue.studioId, row.studioId), eq(messageQueue.clientId, row.clientId), eq(messageQueue.trigger, quoteDeliveryTrigger(row.id)))).orderBy(desc(messageQueue.id)).limit(1),
  ]);
  let reason: string | null = null;
  let phone = "";
  try { phone = normalizeBrazilianPhone(client.phone || ""); } catch { reason = "Cadastre um WhatsApp válido com DDD para este cliente."; }
  if (isOutboundMessagingBlocked()) reason = OUTBOUND_BLOCKED_ERROR;
  else if (!integration) reason = "Conecte e ative o WhatsApp do CRM em Mensagens.";
  else if (integration.sandboxMode) reason = "Libere a integração para produção em Mensagens antes de enviar orçamentos.";
  else if (!reason) {
    reason = await quoteDeliveryError(row.studioId, row.id, row.clientId, phone, false);
    const [consent] = await db.select({ enabled: integrationContacts.hasWhatsappOptIn, optedOutAt: integrationContacts.optedOutAt })
      .from(integrationContacts).where(and(eq(integrationContacts.studioId, row.studioId), eq(integrationContacts.integrationId, integration.id), eq(integrationContacts.clientId, row.clientId))).limit(1);
    if (!reason && (!consent?.enabled || consent.optedOutAt)) reason = "Registre a autorização de WhatsApp deste cliente em Mensagens antes de enviar.";
  }
  return { integration, phone, clientName: quoteClientFirstName(client.name), lastDelivery: deliveries[0] || null, reason, message: row.publicToken ? quoteDeliveryMessage(row) : "" };
}

export const quotesRouter = router({
  deliveryInfo: tenantProcedure.input(z.object({ id: idSchema })).query(async ({ ctx, input }) => {
    requireHistoryArtist(ctx);
    const row = await accessibleQuote(ctx, input.id);
    try {
      const details = await deliveryDetails(ctx.user as typeof ctx.user & { studioId: number }, row);
      return { available: !details.reason, reason: details.reason, provider: details.integration?.provider || null, phone: details.phone,
        clientName: details.clientName, lastDelivery: details.lastDelivery, message: details.message, sentAt: row.sentAt, sentSource: row.sentSource };
    } catch (error) {
      if (!(error instanceof TRPCError) || error.code !== "FORBIDDEN") throw error;
      return { available: false, reason: error.message, provider: null, phone: "", clientName: "", lastDelivery: null, message: "", sentAt: row.sentAt, sentSource: row.sentSource };
    }
  }),
  sendViaIntegration: tenantProcedure.input(z.object({ id: idSchema })).mutation(async ({ ctx, input }) => {
    requireHistoryArtist(ctx);
    const row = await accessibleQuote(ctx, input.id);
    const details = await deliveryDetails(ctx.user as typeof ctx.user & { studioId: number }, row);
    if (details.reason || !details.integration) throw new TRPCError({ code: "PRECONDITION_FAILED", message: details.reason || "Integração indisponível." });
    // A stable key prevents double-clicks/concurrent sessions from sending this version twice.
    if (details.lastDelivery) return { queued: details.lastDelivery.status === "pendente", duplicate: true };
    const result = await sendAndLog({ studioId: ctx.studioId, integrationId: details.integration.id,
      clientId: row.clientId, artistId: row.artistId, recipientType: "client", recipientPhone: details.phone,
      recipientName: details.clientName, message: details.message, trigger: quoteDeliveryTrigger(row.id),
      idempotencyKey: `quote-proposal:${ctx.studioId}:${row.id}:v${row.version}` });
    if (!result.success) throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: result.error });
    return { queued: result.queued, duplicate: result.duplicate };
  }),
  clientHistory: tenantProcedure
    .input(z.object({ clientId: idSchema, cursor: idSchema.optional(), artistId: idSchema.optional(), filter: z.enum(["all", "sent", "waiting", "responded", "booked"]).default("all") }))
    .query(async ({ ctx, input }) => {
      requireHistoryArtist(ctx);
      await resolveClient(ctx.studioId, input.clientId);
      const db = await connection();
      const scope = and(eq(quoteProposals.studioId, ctx.studioId), eq(quoteProposals.clientId, input.clientId), ne(quoteProposals.status, "draft"),
        ctx.artistId != null ? eq(quoteProposals.artistId, ctx.artistId) : input.artistId ? eq(quoteProposals.artistId, input.artistId) : undefined);
      const filter = input.filter === "sent" ? isNotNull(quoteProposals.sentAt)
        : input.filter === "responded" ? quoteHasResponse : input.filter === "booked" ? quoteHasBooking
        : input.filter === "waiting" ? and(isNotNull(quoteProposals.sentAt), not(quoteHasResponse), not(quoteHasBooking), ne(quoteProposals.status, "cancelled"), ne(quoteProposals.status, "rejected")) : undefined;
      const [totals] = await db.select({
        total: sql<number>`COUNT(*)`.mapWith(Number),
        sent: sql<number>`COALESCE(SUM(${quoteProposals.sentAt} IS NOT NULL),0)`.mapWith(Number),
        responded: sql<number>`COALESCE(SUM(${quoteHasResponse}),0)`.mapWith(Number),
        booked: sql<number>`COALESCE(SUM(${quoteHasBooking}),0)`.mapWith(Number),
      }).from(quoteProposals).where(scope);
      const rows = await db.select({ id: quoteProposals.id, quoteNumber: quoteProposals.quoteNumber, version: quoteProposals.version,
        artistId: quoteProposals.artistId, status: quoteProposals.status, createdDate: quoteProposals.createdDate, validUntil: quoteProposals.validUntil,
        totalAmount: quoteProposals.totalAmount, sentAt: quoteProposals.sentAt, respondedAt: quoteProposals.respondedAt,
        acceptedAt: quoteProposals.acceptedAt, responseSource: quoteProposals.responseSource, payload: quoteProposals.payload,
        booked: sql<number>`${quoteHasBooking}`.mapWith(Number),
      }).from(quoteProposals).where(and(scope, filter, input.cursor ? lt(quoteProposals.id, input.cursor) : undefined)).orderBy(desc(quoteProposals.id)).limit(21);
      const hasMore = rows.length > 20;
      const items = rows.slice(0, 20).map(({ payload, ...row }) => {
        const text = quoteHistoryText(payload);
        return { ...row, respondedAt: row.respondedAt || row.acceptedAt, artistName: text?.artist.name || "Artista", title: text?.projects[0]?.title || row.quoteNumber };
      });
      return { totals, items, nextCursor: hasMore ? items[items.length - 1].id : undefined };
    }),

  historyDetail: tenantProcedure.input(z.object({ id: idSchema })).query(async ({ ctx, input }) => {
    requireHistoryArtist(ctx);
    const row = await accessibleQuote(ctx, input.id);
    const db = await connection();
    const bookings = await db.select({ id: appointments.id, date: appointments.date, status: appointments.status, service: appointments.service })
      .from(appointments).where(and(eq(appointments.quoteId, row.id), eq(appointments.studioId, ctx.studioId), eq(appointments.clientId, row.clientId), eq(appointments.artistId, row.artistId))).orderBy(desc(appointments.date));
    return { id: row.id, quoteNumber: row.quoteNumber, version: row.version, status: row.status, createdDate: row.createdDate, validUntil: row.validUntil,
      sentAt: row.sentAt, sentSource: row.sentSource, respondedAt: row.respondedAt || row.acceptedAt, acceptedAt: row.acceptedAt, responseSource: row.responseSource || (row.acceptedAt ? "public_accept" : null),
      responseText: row.responseText, questionAt: row.questionAt, questionText: row.questionText,
      text: quoteHistoryText(row.payload), bookings };
  }),

  schedulingOptions: tenantProcedure.input(z.object({ clientId: idSchema, artistId: idSchema })).query(async ({ ctx, input }) => {
    requireHistoryArtist(ctx);
    await resolveArtist(ctx, input.artistId);
    await resolveClient(ctx.studioId, input.clientId);
    const db = await connection();
    return db.select({ id: quoteProposals.id, quoteNumber: quoteProposals.quoteNumber, totalAmount: quoteProposals.totalAmount, validUntil: quoteProposals.validUntil })
      .from(quoteProposals).where(and(eq(quoteProposals.studioId, ctx.studioId), eq(quoteProposals.clientId, input.clientId), eq(quoteProposals.artistId, input.artistId),
        ne(quoteProposals.status, "draft"), ne(quoteProposals.status, "cancelled"), ne(quoteProposals.status, "rejected"))).orderBy(desc(quoteProposals.id));
  }),

  recordSent: tenantProcedure.input(z.object({ id: idSchema, occurredAt: z.string().datetime().optional() })).mutation(async ({ ctx, input }) => {
    requireHistoryArtist(ctx);
    return recordQuoteInteraction({ ...input, studioId: ctx.studioId, artistId: ctx.artistId, userId: ctx.user.id, kind: "sent" });
  }),
  recordResponse: tenantProcedure.input(z.object({ id: idSchema, text: z.string().trim().min(2).max(2000), occurredAt: z.string().datetime().optional() })).mutation(async ({ ctx, input }) => {
    requireHistoryArtist(ctx);
    return recordQuoteInteraction({ ...input, studioId: ctx.studioId, artistId: ctx.artistId, userId: ctx.user.id, kind: "manual_response" });
  }),
  list: tenantProcedure.query(async ({ ctx }) => {
    const db = await connection();
    const condition = ctx.artistId != null
      ? and(eq(quoteProposals.studioId, ctx.studioId), eq(quoteProposals.artistId, ctx.artistId))
      : eq(quoteProposals.studioId, ctx.studioId);
    const rows = await db.select().from(quoteProposals)
      .where(condition)
      .orderBy(desc(quoteProposals.updatedAt), desc(quoteProposals.id))
      .limit(150);
    return rows.map((row) => ({ ...row, parsedPayload: parseQuotePayload(row.payload) }));
  }),

  get: tenantProcedure
    .input(z.object({ id: idSchema }))
    .query(async ({ ctx, input }) => {
      const row = await accessibleQuote(ctx, input.id);
      return { ...row, parsedPayload: parseQuotePayload(row.payload) };
    }),

  create: tenantProcedure
    .input(z.object({
      clientId: idSchema,
      artistId: idSchema,
      validUntil: dateSchema,
      editor: quoteEditorDataSchema,
    }))
    .mutation(async ({ ctx, input }) => {
      await resolveArtist(ctx, input.artistId);
      await resolveClient(ctx.studioId, input.clientId);
      const editor = quoteEditorDataSchema.parse(input.editor);
      const payload = await buildStoredPayload({
        studioId: ctx.studioId,
        clientId: input.clientId,
        artistId: input.artistId,
        editor,
      });
      const db = await connection();
      const temporaryNumber = `TMP-${randomUUID()}`;
      const created = today();
      const result = await db.insert(quoteProposals).values({
        studioId: ctx.studioId,
        clientId: input.clientId,
        artistId: input.artistId,
        quoteNumber: temporaryNumber,
        version: 1,
        status: "draft",
        createdDate: sqlDate(created),
        validUntil: sqlDate(input.validUntil, true),
        totalAmount: editor.pricing.totalAmount,
        payload: JSON.stringify(payload),
        createdByUserId: ctx.user.id,
      });
      const id = Number(result[0].insertId);
      const quoteNumber = `ORC-${created.slice(0, 4)}-${String(id).padStart(5, "0")}`;
      await db.update(quoteProposals).set({ quoteNumber }).where(eq(quoteProposals.id, id));
      return { id, quoteNumber, status: "draft" as const };
    }),

  update: tenantProcedure
    .input(z.object({
      id: idSchema,
      validUntil: dateSchema,
      editor: quoteEditorDataSchema,
    }))
    .mutation(async ({ ctx, input }) => {
      const current = await accessibleQuote(ctx, input.id);
      if (current.status !== "draft") {
        throw new TRPCError({ code: "CONFLICT", message: "Este orçamento já foi finalizado. Crie uma nova versão para alterar o conteúdo." });
      }
      const editor = quoteEditorDataSchema.parse(input.editor);
      const payload = await buildStoredPayload({
        studioId: ctx.studioId,
        clientId: current.clientId,
        artistId: current.artistId,
        editor,
      });
      const db = await connection();
      await db.update(quoteProposals).set({
        validUntil: sqlDate(input.validUntil, true),
        totalAmount: editor.pricing.totalAmount,
        payload: JSON.stringify(payload),
      }).where(and(eq(quoteProposals.id, current.id), eq(quoteProposals.studioId, ctx.studioId)));
      return { ok: true, quoteNumber: current.quoteNumber };
    }),

  finalize: tenantProcedure
    .input(z.object({ id: idSchema }))
    .mutation(async ({ ctx, input }) => {
      const current = await accessibleQuote(ctx, input.id);
      if (current.status !== "draft") {
        throw new TRPCError({ code: "CONFLICT", message: "Somente rascunhos podem ser finalizados." });
      }
      const payload = parseQuotePayload(current.payload);
      if (!payload) {
        throw new TRPCError({ code: "CONFLICT", message: "Os dados deste orçamento precisam ser salvos novamente antes da finalização." });
      }
      const cover = payload.editor.media.coverSource === "reference"
        ? payload.editor.media.clientReference
        : payload.editor.media.suggestedArtwork;
      if (!cover) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Adicione a imagem que será usada na capa antes de finalizar." });
      }
      const db = await connection();
      const publicToken = current.publicToken || randomBytes(24).toString("hex");
      const protectedPayload = await prepareProtectedQuoteArtwork(payload, ctx.studioId, current.artistId, current.quoteNumber);
      const result = await db.update(quoteProposals).set({
        status: "finalized",
        publicToken,
        payload: JSON.stringify(protectedPayload),
        finalizedAt: nowSql(),
      }).where(and(eq(quoteProposals.id, current.id), eq(quoteProposals.studioId, ctx.studioId), eq(quoteProposals.status, "draft"), eq(quoteProposals.payload, current.payload)));
      if (!result[0].affectedRows) throw new TRPCError({ code: "CONFLICT", message: "Este orçamento mudou durante a finalização. Reabra o rascunho e tente novamente." });
      return { ok: true, status: "finalized" as const, publicToken, publicPath: `/proposta/${publicToken}` };
    }),

  ensurePublicLink: tenantProcedure
    .input(z.object({ id: idSchema }))
    .mutation(async ({ ctx, input }) => {
      const current = await accessibleQuote(ctx, input.id);
      if (current.status === "draft") {
        throw new TRPCError({ code: "CONFLICT", message: "Finalize a proposta antes de gerar o link." });
      }
      const publicToken = current.publicToken || randomBytes(24).toString("hex");
      if (!current.publicToken) {
        const db = await connection();
        await db.update(quoteProposals)
          .set({ publicToken })
          .where(and(eq(quoteProposals.id, current.id), eq(quoteProposals.studioId, ctx.studioId)));
      }
      return { publicToken, publicPath: `/proposta/${publicToken}` };
    }),

  setStatus: tenantProcedure
    .input(z.object({
      id: idSchema,
      status: quoteStatusSchema.exclude(["draft"]),
    }))
    .mutation(async ({ ctx, input }) => {
      const current = await accessibleQuote(ctx, input.id);
      if (current.status === "draft") {
        throw new TRPCError({ code: "CONFLICT", message: "Finalize o orçamento antes de alterar seu status." });
      }
      if (["sent", "approved", "rejected"].includes(input.status)) {
        requireHistoryArtist(ctx);
        await recordQuoteInteraction({ id: current.id, studioId: ctx.studioId, artistId: ctx.artistId, userId: ctx.user.id,
          kind: input.status === "sent" ? "sent" : "manual_response", status: input.status === "sent" ? undefined : input.status as "approved" | "rejected" });
        return { ok: true };
      }
      const db = await connection();
      await db.update(quoteProposals).set({ status: input.status })
        .where(and(eq(quoteProposals.id, current.id), eq(quoteProposals.studioId, ctx.studioId)));
      return { ok: true };
    }),

  deleteDraft: tenantProcedure
    .input(z.object({ id: idSchema }))
    .mutation(async ({ ctx, input }) => {
      const current = await accessibleQuote(ctx, input.id);
      if (current.status !== "draft") {
        throw new TRPCError({ code: "CONFLICT", message: "Somente rascunhos podem ser excluídos." });
      }
      const db = await connection();
      await db.delete(quoteProposals).where(and(eq(quoteProposals.id, current.id), eq(quoteProposals.studioId, ctx.studioId)));
      return { ok: true };
    }),

  uploadMedia: tenantProcedure
    .input(z.object({
      artistId: idSchema,
      fileName: z.string().min(1).max(180),
      imageBase64: z.string().min(1).max(9_000_000),
      mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]),
    }))
    .mutation(async ({ ctx, input }) => {
      await resolveArtist(ctx, input.artistId);
      const buffer = decodeImage(input);
      const ext = imageExtension(input.mimeType);
      const key = `quotes/${ctx.studioId}/${input.artistId}/media/${randomUUID()}.${ext}`;
      const uploaded = await storagePut(key, buffer, input.mimeType);
      if (!uploaded.url) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "O armazenamento de imagens está indisponível." });
      return quoteMediaSchema.parse({
        key,
        url: uploaded.url,
        alt: input.fileName.replace(/\.[^.]+$/, ""),
        x: 50,
        y: 50,
        zoom: 1,
      });
    }),

  public: router({
    get: publicProcedure
      .input(z.object({ token: publicTokenSchema }))
      .query(async ({ input }) => {
        const { row, payload, expired } = await publicQuoteByToken(input.token);
        const artistCardPath = await publishedArtistCardPath(row.studioId, payload.artist.id);
        return {
          status: row.status,
          createdDate: row.createdDate,
          validUntil: row.validUntil,
          totalAmount: row.totalAmount,
          viewedAt: row.viewedAt,
          acceptedAt: row.acceptedAt,
          questionReceived: Boolean(row.questionAt),
          expired,
          artistCardPath,
          payload: publicQuotePayload(payload),
        };
      }),

    markViewed: publicProcedure
      .input(z.object({ token: publicTokenSchema }))
      .mutation(async ({ input }) => {
        const { row } = await publicQuoteByToken(input.token);
        if (!row.viewedAt) {
          const db = await connection();
          await db.update(quoteProposals)
            .set({ viewedAt: nowSql() })
            .where(eq(quoteProposals.id, row.id));
        }
        return { ok: true };
      }),

    accept: publicProcedure
      .input(z.object({ token: publicTokenSchema }))
      .mutation(async ({ input }) => {
        const { row, expired } = await publicQuoteByToken(input.token);
        if (expired) throw new TRPCError({ code: "BAD_REQUEST", message: "Esta proposta está vencida. Fale com o estúdio para receber uma nova versão." });
        if (row.status === "rejected") throw new TRPCError({ code: "CONFLICT", message: "Esta proposta já foi recusada." });
        const recorded = await recordQuoteInteraction({ id: row.id, studioId: row.studioId, kind: "public_accept" });
        return { ok: true, acceptedAt: recorded.acceptedAt };
      }),
    question: publicProcedure.input(z.object({ token: publicTokenSchema, text: z.string().trim().min(2).max(2000) })).mutation(async ({ input }) => {
      const { row } = await publicQuoteByToken(input.token);
      await recordQuoteInteraction({ id: row.id, studioId: row.studioId, kind: "public_question", text: input.text });
      return { ok: true };
    }),
  }),

  presets: router({
    list: tenantProcedure
      .input(z.object({
        artistId: idSchema,
        category: z.enum(QUOTE_PRESET_CATEGORIES).optional(),
      }))
      .query(async ({ ctx, input }) => {
        await resolveArtist(ctx, input.artistId);
        const db = await connection();
        const ownership = or(isNull(quotePresets.artistId), eq(quotePresets.artistId, input.artistId));
        const condition = input.category
          ? and(
              eq(quotePresets.studioId, ctx.studioId),
              ownership,
              eq(quotePresets.category, input.category),
              eq(quotePresets.isActive, 1),
            )
          : and(eq(quotePresets.studioId, ctx.studioId), ownership, eq(quotePresets.isActive, 1));
        return db.select().from(quotePresets).where(condition).orderBy(desc(quotePresets.id)).limit(100);
      }),

    create: tenantProcedure
      .input(z.object({
        artistId: idSchema,
        category: z.enum(QUOTE_PRESET_CATEGORIES),
        name: z.string().trim().min(2).max(120),
        content: z.string().trim().min(2).max(QUOTE_TEXT_LIMIT),
        scope: z.enum(["artist", "studio"]).default("artist"),
      }))
      .mutation(async ({ ctx, input }) => {
        await resolveArtist(ctx, input.artistId);
        if (input.scope === "studio" && ctx.user.role === "collaborator") {
          throw new TRPCError({ code: "FORBIDDEN", message: "Somente o administrador pode criar modelos para todo o estúdio." });
        }
        const db = await connection();
        const result = await db.insert(quotePresets).values({
          studioId: ctx.studioId,
          artistId: input.scope === "artist" ? input.artistId : null,
          category: input.category,
          name: input.name,
          content: input.content,
          isActive: 1,
          createdByUserId: ctx.user.id,
        });
        return { id: Number(result[0].insertId) };
      }),
  }),

  branding: router({
    get: tenantProcedure
      .input(z.object({ artistId: idSchema }))
      .query(async ({ ctx, input }) => {
        await resolveArtist(ctx, input.artistId);
        const [branding, settings, artistCardPath] = await Promise.all([
          brandingRow(ctx.studioId, input.artistId),
          dbHelpers.getStudioSettings(ctx.studioId),
          publishedArtistCardPath(ctx.studioId, input.artistId),
        ]);
        return {
          artistCardPath,
          personalLogoUrl: branding?.personalLogoUrl ?? null,
          personalLogoKey: branding?.personalLogoKey ?? null,
          defaultLogoSource: logoSourceSchema.catch("studio").parse(branding?.defaultLogoSource ?? "studio"),
          watermarkOpacity: Math.min(100, Math.max(20, branding?.watermarkOpacity ?? 70)),
          studioLogoUrl: settings?.logoUrl ?? null,
          studioName: settings?.studioName ?? null,
          studioPhone: settings?.phone ?? null,
        };
      }),

    uploadPersonalLogo: tenantProcedure
      .input(z.object({
        artistId: idSchema,
        fileName: z.string().min(1).max(180),
        imageBase64: z.string().min(1).max(9_000_000),
        mimeType: z.literal("image/png"),
      }))
      .mutation(async ({ ctx, input }) => {
        await resolveArtist(ctx, input.artistId);
        const buffer = decodeImage(input, 5 * 1024 * 1024);
        const key = `artists/${ctx.studioId}/${input.artistId}/quote-branding/${randomUUID()}.png`;
        const uploaded = await storagePut(key, buffer, input.mimeType);
        if (!uploaded.url) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "O armazenamento de imagens está indisponível." });
        const db = await connection();
        await db.insert(artistQuoteBranding).values({
          studioId: ctx.studioId,
          artistId: input.artistId,
          personalLogoUrl: uploaded.url,
          personalLogoKey: key,
          defaultLogoSource: "personal",
          watermarkOpacity: 70,
        }).onDuplicateKeyUpdate({
          set: {
            personalLogoUrl: uploaded.url,
            personalLogoKey: key,
          },
        });
        return { url: uploaded.url, key };
      }),

    saveSettings: tenantProcedure
      .input(z.object({
        artistId: idSchema,
        defaultLogoSource: logoSourceSchema,
        watermarkOpacity: z.number().int().min(20).max(100),
      }))
      .mutation(async ({ ctx, input }) => {
        await resolveArtist(ctx, input.artistId);
        const db = await connection();
        await db.insert(artistQuoteBranding).values({
          studioId: ctx.studioId,
          artistId: input.artistId,
          defaultLogoSource: input.defaultLogoSource,
          watermarkOpacity: input.watermarkOpacity,
        }).onDuplicateKeyUpdate({
          set: {
            defaultLogoSource: input.defaultLogoSource,
            watermarkOpacity: input.watermarkOpacity,
          },
        });
        return { ok: true };
      }),
  }),
});
