import { randomBytes, randomUUID } from "node:crypto";
import { TRPCError } from "@trpc/server";
import { and, desc, eq, isNull, or } from "drizzle-orm";
import { z } from "zod";
import { publicProcedure, router, tenantProcedure } from "../_core/trpc";
import * as dbHelpers from "../db";
import { storagePut } from "../storage";
import { artistQuoteBranding, quotePresets, quoteProposals } from "../../drizzle/quoteProposalSchema";
import {
  QUOTE_PRESET_CATEGORIES,
  parseQuotePayload,
  quoteEditorDataSchema,
  quoteStoredPayloadSchema,
  type QuoteEditorData,
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
  const payload = parseQuotePayload(row.payload);
  if (!payload) {
    throw new TRPCError({ code: "CONFLICT", message: "Esta proposta precisa ser atualizada pelo estúdio." });
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

export const quotesRouter = router({
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
      await db.update(quoteProposals).set({
        status: "finalized",
        publicToken,
        finalizedAt: nowSql(),
      }).where(and(eq(quoteProposals.id, current.id), eq(quoteProposals.studioId, ctx.studioId)));
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
      return {
        key,
        url: uploaded.url,
        alt: input.fileName.replace(/\.[^.]+$/, ""),
        x: 50,
        y: 50,
        zoom: 1,
      };
    }),

  public: router({
    get: publicProcedure
      .input(z.object({ token: publicTokenSchema }))
      .query(async ({ input }) => {
        const { row, payload, expired } = await publicQuoteByToken(input.token);
        return {
          quoteNumber: row.quoteNumber,
          status: row.status,
          createdDate: row.createdDate,
          validUntil: row.validUntil,
          totalAmount: row.totalAmount,
          viewedAt: row.viewedAt,
          acceptedAt: row.acceptedAt,
          expired,
          payload,
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
        const acceptedAt = row.acceptedAt || nowSql();
        const db = await connection();
        await db.update(quoteProposals)
          .set({ status: "approved", acceptedAt, viewedAt: row.viewedAt || acceptedAt })
          .where(eq(quoteProposals.id, row.id));
        return { ok: true, acceptedAt };
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
        content: z.string().trim().min(2).max(1800),
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
        const [branding, settings] = await Promise.all([
          brandingRow(ctx.studioId, input.artistId),
          dbHelpers.getStudioSettings(ctx.studioId),
        ]);
        return {
          personalLogoUrl: branding?.personalLogoUrl ?? null,
          personalLogoKey: branding?.personalLogoKey ?? null,
          defaultLogoSource: logoSourceSchema.catch("studio").parse(branding?.defaultLogoSource ?? "studio"),
          watermarkOpacity: Math.min(100, Math.max(20, branding?.watermarkOpacity ?? 70)),
          studioLogoUrl: settings?.logoUrl ?? null,
          studioName: settings?.studioName ?? null,
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
