import { randomBytes, randomUUID } from "node:crypto";
import sharp from "sharp";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, publicProcedure } from "../_core/trpc";
import { assertAnamneseClient } from "../security/anamneseAccess";
import { enforceRateLimit } from "../security/rateLimit";
import { ENV } from "../_core/env";
import * as db from "../db";
import { storagePut, storageReadBuffer } from "../storage";
import {
  FILE_KINDS,
  MINOR_CONSENT_TERMS,
  MINOR_CONSENT_VERSION,
  templateSchema,
  procedureSchema,
  submissionSchema,
  validateSubmission,
  materialSchema,
  type ConsentSubmission,
} from "../../shared/minorConsent";
import { rows, pool, audit } from "./database";
import { sha, backupConsent } from "./backup";
import { consentPdf } from "./pdf";
import {
  invitationLinks,
  invitationDeliveryDetails,
  queueConsentInvitation,
  sealInvitationToken,
} from "./invitations";
import { minorConsentInvitationMessage } from "../../shared/minorConsent";
import type { User } from "../../drizzle/schema";

const tokenSchema = z.string().regex(/^[a-f0-9]{64}$/);
const uploadSchema = z.object({
  name: z.string().min(1).max(180),
  data: z
    .string()
    .max(7_100_000)
    .regex(/^[A-Za-z0-9+/=]+$/),
});
const bad = (message: string) =>
  new TRPCError({ code: "BAD_REQUEST", message });
const baseUrl = () => ENV.appBaseUrl.replace(/\/$/, "");
export async function scopedRequest(user: User, id: number) {
  const [r] = await rows("SELECT * FROM minor_consent_requests WHERE id=?", [
    id,
  ]);
  if (!r)
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Autorização não encontrada.",
    });
  await assertAnamneseClient(user, r.client_id);
  if (user.role === "collaborator" && r.artist_id !== user.artistId)
    throw new TRPCError({ code: "FORBIDDEN" });
  return r;
}
async function tokenRequest(token: string, pending = false, connection?: any) {
  const [r] = await rows(
    "SELECT * FROM minor_consent_requests WHERE token_hash=?",
    [sha(token)],
    connection
  );
  if (!r || r.status === "cancelled" || Number(r.expires_at) <= Date.now())
    throw new TRPCError({
      code: "NOT_FOUND",
      message:
        "Link inválido, cancelado ou expirado. Solicite um novo link ao estúdio.",
    });
  if (pending && r.status !== "pending")
    throw bad(
      "Esta autorização já foi enviada. Alterações exigem nova solicitação do profissional."
    );
  return r;
}
async function image(data: string, max = 500_000) {
  const bytes = Buffer.from(data.split(",")[1] || "", "base64");
  if (bytes.length > max) throw bad("Imagem maior que o limite.");
  const meta = await sharp(bytes, { limitInputPixels: 8_000_000 }).metadata();
  if (
    !["png", "jpeg"].includes(meta.format || "") ||
    (meta.width || 0) > 2500 ||
    (meta.height || 0) > 2500
  )
    throw bad("Use imagem PNG ou JPG de até 2500 pixels.");
  return bytes;
}
async function normalizeLogo(template: z.infer<typeof templateSchema>) {
  if (!template.logo) return;
  const bytes = await image(template.logo, 450_000);
  const png = await sharp(bytes)
    .rotate()
    .resize({
      width: 600,
      height: 360,
      fit: "inside",
      withoutEnlargement: true,
    })
    .png()
    .toBuffer();
  template.logo = `data:image/png;base64,${png.toString("base64")}`;
  if (template.logo.length > 600_000)
    throw bad("Use uma logo com arquivo menor.");
}
async function validateText(r: any, input: ConsentSubmission) {
  const submission = submissionSchema.parse(input),
    procedure = procedureSchema.parse(JSON.parse(r.procedure_json));
  try {
    validateSubmission(submission, procedure.plannedDate);
  } catch (e) {
    throw bad((e as Error).message);
  }
  await image(submission.minorSignature);
  if (submission.guardianSignature) await image(submission.guardianSignature);
  return submission;
}
async function persistFile(
  r: any,
  kind: string,
  name: string,
  bytes: Buffer,
  mime: string,
  documentHash: string | null = null,
  connection?: any
) {
  const key = `minor-consents/${r.studio_id}/${r.id}/${randomUUID()}`;
  const saved = await storagePut(key, bytes, mime);
  if (!saved.url)
    throw new TRPCError({
      code: "SERVICE_UNAVAILABLE",
      message: "Armazenamento de documentos indisponível. Nada foi confirmado.",
    });
  const id = randomUUID();
  await (connection || pool()).query(
    `INSERT INTO minor_consent_files(id,request_id,studio_id,kind,name,mime,bytes,sha256,storage_key,document_hash) VALUES(?,?,?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE id=VALUES(id),name=VALUES(name),mime=VALUES(mime),bytes=VALUES(bytes),sha256=VALUES(sha256),storage_key=VALUES(storage_key),document_hash=VALUES(document_hash)`,
    [
      id,
      r.id,
      r.studio_id,
      kind,
      name,
      mime,
      bytes.length,
      sha(bytes),
      key,
      documentHash,
    ]
  );
  return { id, key, sha256: sha(bytes) };
}
async function uploadFile(
  r: any,
  kind: string,
  input: z.infer<typeof uploadSchema>,
  connection?: any
) {
  const bytes = Buffer.from(input.data, "base64");
  if (!bytes.length || bytes.length > 5 * 1024 * 1024)
    throw bad("Cada arquivo deve ter até 5 MB.");
  let mime = "";
  if (bytes.subarray(0, 5).toString() === "%PDF-") mime = "application/pdf";
  else {
    const m = await sharp(bytes, { limitInputPixels: 20_000_000 }).metadata();
    if (m.format === "jpeg") mime = "image/jpeg";
    if (m.format === "png") mime = "image/png";
  }
  if (
    !mime ||
    (["signed_pdf", "validation_report"].includes(kind) &&
      mime !== "application/pdf")
  )
    throw bad(
      "Use PDF, JPG ou PNG. Documento assinado e relatório devem ser PDF."
    );
  if (kind === "signed_pdf" && !r.prepared_hash)
    throw bad("Prepare e baixe o documento antes de assinar e devolver o PDF.");
  const [size] = await rows(
    "SELECT COALESCE(SUM(bytes),0) AS total FROM minor_consent_files WHERE request_id=? AND kind<>?",
    [r.id, kind],
    connection
  );
  if (Number(size.total) + bytes.length > 22 * 1024 * 1024)
    throw bad("Os anexos desta autorização ultrapassam 22 MB.");
  const cleanName = input.name
    .replace(/[\u0000-\u001f\u007f/\\]/g, "_")
    .slice(0, 160);
  return persistFile(
    r,
    kind,
    cleanName,
    bytes,
    mime,
    kind === "signed_pdf" ? r.prepared_hash : null,
    connection
  );
}
async function documentContext(
  r: any,
  submission: ConsentSubmission,
  connection?: any
) {
  const manifest = await rows(
    "SELECT kind,sha256 FROM minor_consent_files WHERE request_id=? AND kind NOT IN ('unsigned_pdf','signed_pdf','signed_simple','validation_report') ORDER BY kind",
    [r.id],
    connection
  );
  let anamneseSnapshot: any = null;
  if (r.anamnese_request_id) {
    const [a] = await rows(
      "SELECT s.id,s.payloadJson FROM anamnese_submissions s INNER JOIN anamnese_requests a ON a.id=s.requestId WHERE a.id=? AND a.statusRequest='preenchida' ORDER BY s.id DESC LIMIT 1",
      [r.anamnese_request_id],
      connection
    );
    if (!a)
      throw bad(
        "Conclua a anamnese vinculada antes de preparar ou enviar o termo."
      );
    anamneseSnapshot = {
      submissionId: a.id,
      payload: JSON.parse(a.payloadJson),
    };
  }
  return {
    hash: sha(
      JSON.stringify({
        id: r.id,
        template: JSON.parse(r.template_json),
        procedure: JSON.parse(r.procedure_json),
        submission,
        manifest,
        anamneseSnapshot,
      })
    ),
    manifest,
    anamneseSnapshot,
  };
}
async function defaultConfig(
  user: User,
  clientId: number,
  requestedArtistId?: number
) {
  const client = await assertAnamneseClient(user, clientId);
  const settings = await db.getStudioSettings(client.studioId);
  const artists = (await db.listArtists(client.studioId)).filter(
    a =>
      a.active === 1 && (user.role !== "collaborator" || a.id === user.artistId)
  );
  const artistId =
    requestedArtistId ||
    user.artistId ||
    client.artistId ||
    artists[0]?.id ||
    null;
  if (requestedArtistId && !artists.some(a => a.id === requestedArtistId))
    throw new TRPCError({ code: "FORBIDDEN" });
  const artist = artists.find((a: any) => a.id === artistId);
  const saved = await rows(
    "SELECT * FROM tattoo_consent_templates WHERE studio_id=? AND artist_id IN (0,?) ORDER BY artist_id DESC",
    [client.studioId, artistId || 0]
  );
  const defaults = {
    studioName: settings?.studioName || "",
    address: [settings?.address, settings?.city, settings?.state]
      .filter(Boolean)
      .join(", "),
    professionalName: artist?.name || user.name || "",
    professionalDocument: "",
    contact: settings?.phone || settings?.email || "",
    jurisdiction: [settings?.city, settings?.state].filter(Boolean).join(" / "),
    terms: MINOR_CONSENT_TERMS,
    logo: "",
  };
  if (
    settings?.logoKey &&
    !/^(minor-consents\/|_backups\/)/.test(settings.logoKey)
  ) {
    try {
      const b = await storageReadBuffer(settings.logoKey, 400_000);
      const img = await sharp(b)
        .resize(320, 200, { fit: "inside" })
        .png()
        .toBuffer();
      defaults.logo = `data:image/png;base64,${img.toString("base64")}`;
    } catch {}
  }
  return {
    client,
    artists,
    artistId,
    template: saved.length
      ? { ...defaults, ...JSON.parse(saved[0].template_json) }
      : defaults,
    canSaveStudio: user.role === "admin" || user.role === "superadmin",
    modelVersion: MINOR_CONSENT_VERSION,
  };
}

export const minorConsentRouter = router({
  config: protectedProcedure
    .input(
      z.object({
        clientId: z.number().int().positive(),
        artistId: z.number().int().positive().optional(),
      })
    )
    .query(({ ctx, input }) =>
      defaultConfig(ctx.user, input.clientId, input.artistId)
    ),
  saveTemplate: protectedProcedure
    .input(
      z.object({
        clientId: z.number(),
        artistId: z.number().int().positive(),
        scope: z.enum(["artist", "studio"]),
        template: templateSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      const client = await assertAnamneseClient(ctx.user, input.clientId);
      const artist = await db.getArtistById(input.artistId, client.studioId);
      if (
        !artist ||
        (ctx.user.role === "collaborator" && artist.id !== ctx.user.artistId)
      )
        throw new TRPCError({ code: "FORBIDDEN" });
      if (
        input.scope === "studio" &&
        !["admin", "superadmin"].includes(ctx.user.role)
      )
        throw new TRPCError({ code: "FORBIDDEN" });
      await normalizeLogo(input.template);
      await pool().query(
        `INSERT INTO tattoo_consent_templates(studio_id,artist_id,template_json,updated_by) VALUES(?,?,?,?) ON DUPLICATE KEY UPDATE template_json=VALUES(template_json),revision=revision+1,updated_by=VALUES(updated_by)`,
        [
          client.studioId,
          input.scope === "studio" ? 0 : artist.id,
          JSON.stringify(input.template),
          ctx.user.id,
        ]
      );
      return { saved: true };
    }),
  create: protectedProcedure
    .input(
      z.object({
        clientId: z.number().int().positive(),
        artistId: z.number().int().positive(),
        template: templateSchema,
        procedure: procedureSchema,
        includeAnamnese: z.literal(true).default(true),
        legalReviewDeclared: z.literal(true),
        notifyStudio: z.boolean().default(true),
        notifyArtist: z.boolean().default(true),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const client = await assertAnamneseClient(ctx.user, input.clientId);
      const artist = await db.getArtistById(input.artistId, client.studioId);
      if (
        !artist ||
        artist.active !== 1 ||
        (ctx.user.role === "collaborator" && artist.id !== ctx.user.artistId)
      )
        throw bad("Selecione um artista ativo deste estúdio.");
      await normalizeLogo(input.template);
      const token = randomBytes(32).toString("hex"),
        expires = Date.now() + 7 * 86400000;
      const at = randomBytes(32).toString("hex"),
        connection = await pool().getConnection();
      try {
        await connection.beginTransaction();
        const [anamnese]: any = await connection.query(
          "INSERT INTO anamnese_requests(clientId,token,sentVia,sentTo,expiresAt,statusRequest) VALUES(?,?,'whatsapp',?,?,'pendente')",
          [
            client.id,
            at,
            client.phone || "link",
            new Date(expires).toISOString().slice(0, 19).replace("T", " "),
          ]
        );
        const anamneseId = anamnese.insertId;
        const [result]: any = await connection.query(
          `INSERT INTO minor_consent_requests(studio_id,client_id,artist_id,created_by,token_hash,template_json,procedure_json,anamnese_request_id,expires_at,notify_studio,notify_artist,legal_review_declared) VALUES(?,?,?,?,?,?,?,?,?,?,?,1)`,
          [
            client.studioId,
            client.id,
            artist.id,
            ctx.user.id,
            sha(token),
            JSON.stringify({
              ...input.template,
              modelVersion: MINOR_CONSENT_VERSION,
            }),
            JSON.stringify(input.procedure),
            anamneseId,
            expires,
            input.notifyStudio ? 1 : 0,
            input.notifyArtist ? 1 : 0,
          ]
        );
        await connection.query(
          "INSERT INTO minor_consent_invitations(request_id,studio_id,encrypted_token) VALUES(?,?,?)",
          [
            result.insertId,
            client.studioId,
            sealInvitationToken(token, client.studioId, result.insertId),
          ]
        );
        await audit(
          result.insertId,
          client.studioId,
          ctx.user.id,
          "created",
          {
            legalReviewDeclared: true,
            templateVersion: MINOR_CONSENT_VERSION,
          },
          connection
        );
        await connection.commit();
        return {
          id: result.insertId as number,
          link: `${baseUrl()}/autorizacao/${token}`,
          anamneseLink: `${baseUrl()}/anamnese/${at}?autorizacao=${token}`,
          expiresAt: expires,
        };
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    }),
  invitation: protectedProcedure
    .input(
      z.object({
        clientId: z.number().int().positive(),
        id: z.number().int().positive().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const client = await assertAnamneseClient(ctx.user, input.clientId);
      const [latest] = input.id
        ? [{ id: input.id }]
        : await rows(
            `SELECT r.id FROM minor_consent_requests r INNER JOIN minor_consent_invitations i ON i.request_id=r.id AND i.studio_id=r.studio_id WHERE r.client_id=? AND r.studio_id=? AND r.status='pending' AND r.expires_at>? ${ctx.user.role === "collaborator" ? "AND r.artist_id=?" : ""} ORDER BY r.id DESC LIMIT 1`,
            ctx.user.role === "collaborator"
              ? [client.id, client.studioId, Date.now(), ctx.user.artistId]
              : [client.id, client.studioId, Date.now()]
          );
      if (!latest) return null;
      const r = await scopedRequest(ctx.user, latest.id);
      if (r.client_id !== client.id) throw new TRPCError({ code: "FORBIDDEN" });
      if (r.status !== "pending" || Number(r.expires_at) <= Date.now())
        return null;
      const links = await invitationLinks(r);
      let delivery;
      try {
        delivery = await invitationDeliveryDetails(ctx.user, r);
      } catch (error) {
        if (!(error instanceof TRPCError) || error.code !== "FORBIDDEN")
          throw error;
        delivery = {
          reason: error.message,
          integration: null,
          lastDelivery: null,
        };
      }
      return {
        id: r.id,
        ...links,
        expiresAt: Number(r.expires_at),
        message: minorConsentInvitationMessage(
          client.name,
          links.link,
          links.anamneseLink
        ),
        phone: client.phone || "",
        canSend: !delivery.reason,
        reason: delivery.reason,
        lastDelivery: delivery.lastDelivery,
        integration: delivery.integration
          ? {
              id: delivery.integration.id,
              name: delivery.integration.name,
              phoneNumber: delivery.integration.phoneNumber,
            }
          : null,
      };
    }),
  sendInvitation: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const r = await scopedRequest(ctx.user, input.id);
      const result = await queueConsentInvitation(ctx.user, r);
      if (!result.duplicate)
        await audit(r.id, r.studio_id, ctx.user.id, "invitation_queued");
      return result;
    }),
  list: protectedProcedure
    .input(z.object({ clientId: z.number() }))
    .query(async ({ ctx, input }) => {
      await assertAnamneseClient(ctx.user, input.clientId);
      return rows(
        `SELECT id,artist_id,status,created_at,submitted_at,expires_at,revision,backup_revision,backup_error,review_json,EXISTS(SELECT 1 FROM minor_consent_invitations i WHERE i.request_id=minor_consent_requests.id) AS has_invitation FROM minor_consent_requests WHERE client_id=? ${ctx.user.role === "collaborator" ? "AND artist_id=?" : ""} ORDER BY id DESC`,
        ctx.user.role === "collaborator"
          ? [input.clientId, ctx.user.artistId]
          : [input.clientId]
      );
    }),
  detail: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const r = await scopedRequest(ctx.user, input.id);
      const files = await rows(
        "SELECT id,kind,name,mime,bytes,sha256 FROM minor_consent_files WHERE request_id=?",
        [r.id]
      );
      const notices = await rows(
        "SELECT n.recipient,n.status,n.error_text,q.status AS deliveryStatus,q.errorMessage AS deliveryError FROM minor_consent_notices n LEFT JOIN message_queue q ON q.id=n.queue_id WHERE n.request_id=?",
        [r.id]
      );
      const events = await rows(
        "SELECT action,user_id,details_json,created_at FROM minor_consent_events WHERE request_id=? ORDER BY id",
        [r.id]
      );
      return {
        id: r.id,
        status: r.status,
        template: JSON.parse(r.template_json),
        procedure: JSON.parse(r.procedure_json),
        submission: r.submission_json ? JSON.parse(r.submission_json) : null,
        materials: r.materials_json ? JSON.parse(r.materials_json) : [],
        review: r.review_json ? JSON.parse(r.review_json) : null,
        revision: r.revision,
        backupRevision: r.backup_revision,
        backupError: r.backup_error,
        files,
        notices,
        events,
      };
    }),
  file: protectedProcedure
    .input(z.object({ id: z.number(), fileId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const r = await scopedRequest(ctx.user, input.id);
      const [f] = await rows(
        "SELECT * FROM minor_consent_files WHERE request_id=? AND id=?",
        [r.id, input.fileId]
      );
      if (!f) throw new TRPCError({ code: "NOT_FOUND" });
      const data = await storageReadBuffer(f.storage_key, 6 * 1024 * 1024);
      if (sha(data) !== f.sha256)
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Integridade do arquivo divergente.",
        });
      await audit(r.id, r.studio_id, ctx.user.id, "file_downloaded", {
        fileId: f.id,
      });
      return { name: f.name, mime: f.mime, data: data.toString("base64") };
    }),
  cancel: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const r = await scopedRequest(ctx.user, input.id);
      if (r.status !== "pending")
        throw bad(
          "Uma autorização recebida deve ser preservada. Registre uma pendência ou emita outra versão."
        );
      const [updated]: any = await pool().query(
        "UPDATE minor_consent_requests SET status='cancelled' WHERE id=? AND status='pending'",
        [r.id]
      );
      if (updated.affectedRows !== 1)
        throw bad("A ficha já foi recebida ou alterada. Atualize o registro.");
      await audit(r.id, r.studio_id, ctx.user.id, "cancelled");
      return { cancelled: true };
    }),
  materials: protectedProcedure
    .input(
      z.object({ id: z.number(), materials: z.array(materialSchema).max(100) })
    )
    .mutation(async ({ ctx, input }) => {
      const r = await scopedRequest(ctx.user, input.id);
      if (!r.submitted_at)
        throw bad(
          "Os materiais serão complementados após o recebimento da ficha."
        );
      await pool().query(
        "UPDATE minor_consent_requests SET materials_json=?,revision=revision+1 WHERE id=?",
        [JSON.stringify(input.materials), r.id]
      );
      await audit(r.id, r.studio_id, ctx.user.id, "materials_added", {
        materials: input.materials,
      });
      return { saved: true };
    }),
  review: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        decision: z.enum(["approved", "rejected"]),
        identitiesChecked: z.literal(true),
        localRulesChecked: z.literal(true),
        contentChecked: z.literal(true),
        digitalSignaturesChecked: z.boolean(),
        notes: z.string().trim().min(5).max(2500),
        report: uploadSchema.optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const r = await scopedRequest(ctx.user, input.id);
      if (!r.submitted_at) throw bad("Ficha ainda não recebida.");
      const s = JSON.parse(r.submission_json);
      if (
        input.decision === "approved" &&
        s.signatureMode === "external" &&
        (!input.digitalSignaturesChecked || !input.report)
      )
        throw bad(
          "Confira o PDF original e as assinaturas no VALIDAR/ITI e anexe o relatório PDF antes de concluir a conferência."
        );
      if (input.report) await uploadFile(r, "validation_report", input.report);
      const review = {
        decision: input.decision,
        identitiesChecked: true,
        localRulesChecked: true,
        contentChecked: true,
        digitalSignaturesChecked: input.digitalSignaturesChecked,
        notes: input.notes,
        reviewerId: ctx.user.id,
        reviewedAt: new Date().toISOString(),
        validation: "manual_by_professional",
      };
      await pool().query(
        "UPDATE minor_consent_requests SET status=?,review_json=?,revision=revision+1 WHERE id=?",
        [input.decision, JSON.stringify(review), r.id]
      );
      await audit(r.id, r.studio_id, ctx.user.id, "reviewed", review);
      return { saved: true };
    }),
  retry: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const r = await scopedRequest(ctx.user, input.id);
      await pool().query(
        "UPDATE minor_consent_notices SET status='pending',next_attempt=0 WHERE request_id=? AND status<>'queued'",
        [r.id]
      );
      await backupConsent(r.id);
      return { scheduled: true };
    }),
  exportBackup: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const r = await scopedRequest(ctx.user, input.id);
      if (!["admin", "superadmin"].includes(ctx.user.role))
        throw new TRPCError({ code: "FORBIDDEN" });
      if (!r.backup_key) throw bad("Backup ainda em processamento.");
      const data = await storageReadBuffer(r.backup_key, 55 * 1024 * 1024);
      await audit(r.id, r.studio_id, ctx.user.id, "backup_exported", {
        revision: r.backup_revision,
      });
      return {
        name: `autorizacao-${r.id}-backup.enc`,
        mime: "application/octet-stream",
        data: data.toString("base64"),
      };
    }),
  publicGet: publicProcedure
    .input(z.object({ token: tokenSchema }))
    .query(async ({ ctx, input }) => {
      await enforceRateLimit(
        ctx.req,
        "minor-consent-read",
        sha(input.token),
        100
      );
      const r = await tokenRequest(input.token);
      if (r.status !== "pending")
        return { received: true, id: r.id, status: r.status };
      const client = await db.getClientById(r.client_id);
      if (!client) throw new TRPCError({ code: "NOT_FOUND" });
      const anamnese = r.anamnese_request_id
        ? await rows(
            "SELECT token,statusRequest FROM anamnese_requests WHERE id=?",
            [r.anamnese_request_id]
          )
        : [];
      const files = await rows(
        "SELECT kind,name FROM minor_consent_files WHERE request_id=? AND kind<>'unsigned_pdf'",
        [r.id]
      );
      return {
        received: false,
        id: r.id,
        status: r.status,
        template: JSON.parse(r.template_json),
        procedure: JSON.parse(r.procedure_json),
        client: {
          name: client.name,
          birthDate: String(client.birthDate || "").slice(0, 10),
          documentType: client.docType === "passport" ? "passaporte" : "CPF",
          documentNumber: client.docNumber || "",
          address: [
            client.street,
            client.number,
            client.complement,
            client.neighborhood,
            client.city,
            client.state,
            client.country,
          ]
            .filter(Boolean)
            .join(", "),
        },
        anamneseLink: anamnese[0]
          ? `${baseUrl()}/anamnese/${anamnese[0].token}?autorizacao=${input.token}`
          : null,
        anamneseCompleted: anamnese[0]?.statusRequest === "preenchida",
        files,
      };
    }),
  publicUpload: publicProcedure
    .input(
      z.object({
        token: tokenSchema,
        kind: z.enum(FILE_KINDS),
        file: uploadSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      await enforceRateLimit(
        ctx.req,
        "minor-consent-upload",
        sha(input.token),
        35
      );
      const r = await tokenRequest(input.token, true);
      const connection = await pool().getConnection();
      try {
        const [lock] = await rows(
          "SELECT GET_LOCK(?,15) AS ok",
          [`minor-upload:${r.id}`],
          connection
        );
        if (Number(lock?.ok) !== 1)
          throw bad(
            "Outro envio está em processamento. Aguarde e tente novamente."
          );
        const fresh = await tokenRequest(input.token, true, connection);
        const f = await uploadFile(fresh, input.kind, input.file, connection);
        await audit(
          r.id,
          r.studio_id,
          null,
          "public_file_uploaded",
          { kind: input.kind, sha256: f.sha256 },
          connection
        );
        return { uploaded: true, name: input.file.name };
      } finally {
        await connection.query("SELECT RELEASE_LOCK(?)", [
          `minor-upload:${r.id}`,
        ]);
        connection.release();
      }
    }),
  prepare: publicProcedure
    .input(z.object({ token: tokenSchema, submission: submissionSchema }))
    .mutation(async ({ ctx, input }) => {
      await enforceRateLimit(
        ctx.req,
        "minor-consent-prepare",
        sha(input.token),
        12
      );
      const r = await tokenRequest(input.token, true);
      const s = await validateText(r, input.submission);
      if (s.signatureMode !== "external")
        throw bad("Use esta opção para assinar o PDF externamente.");
      const connection = await pool().getConnection();
      try {
        const [lock] = await rows(
          "SELECT GET_LOCK(?,15) AS ok",
          [`minor-upload:${r.id}`],
          connection
        );
        if (Number(lock?.ok) !== 1)
          throw bad("Há outro envio em processamento.");
        const fresh = await tokenRequest(input.token, true, connection);
        const { hash } = await documentContext(fresh, s, connection);
        const bytes = consentPdf({
          id: r.id,
          template: JSON.parse(r.template_json),
          procedure: JSON.parse(r.procedure_json),
          submission: s,
          hash,
        });
        const f = await persistFile(
          r,
          "unsigned_pdf",
          `autorizacao-${r.id}-para-assinar.pdf`,
          bytes,
          "application/pdf",
          hash,
          connection
        );
        await connection.query(
          "UPDATE minor_consent_requests SET prepared_hash=?,prepared_pdf_key=? WHERE id=? AND status='pending'",
          [hash, f.key, r.id]
        );
        await audit(r.id, r.studio_id, null, "prepared", { hash }, connection);
        return {
          name: `autorizacao-${r.id}-para-assinar.pdf`,
          mime: "application/pdf",
          data: bytes.toString("base64"),
        };
      } finally {
        await connection.query("SELECT RELEASE_LOCK(?)", [
          `minor-upload:${r.id}`,
        ]);
        connection.release();
      }
    }),
  submit: publicProcedure
    .input(z.object({ token: tokenSchema, submission: submissionSchema }))
    .mutation(async ({ ctx, input }) => {
      await enforceRateLimit(
        ctx.req,
        "minor-consent-submit",
        sha(input.token),
        12
      );
      const r = await tokenRequest(input.token, true);
      const submission = await validateText(r, input.submission);
      const connection = await pool().getConnection();
      try {
        const [lock] = await rows(
          "SELECT GET_LOCK(?,15) AS ok",
          [`minor-upload:${r.id}`],
          connection
        );
        if (Number(lock?.ok) !== 1)
          throw bad("Há outro envio em processamento.");
        await connection.beginTransaction();
        const [fresh] = await rows(
          "SELECT * FROM minor_consent_requests WHERE id=? FOR UPDATE",
          [r.id],
          connection
        );
        if (
          fresh.status !== "pending" ||
          Number(fresh.expires_at) <= Date.now()
        )
          throw bad("Esta autorização não está mais disponível para envio.");
        const files = await rows(
          "SELECT kind,document_hash FROM minor_consent_files WHERE request_id=?",
          [r.id],
          connection
        );
        const kinds = new Set(files.map(f => f.kind));
        const context = await documentContext(fresh, submission, connection);
        const hash = context.hash;
        if (!kinds.has("minor_document") || !kinds.has("guardian_document"))
          throw bad("Anexe o documento do menor e do responsável.");
        if (
          ["tutor", "guardiao_judicial"].includes(
            submission.guardian.relationship
          ) &&
          !kinds.has("authority_document")
        )
          throw bad("Anexe o documento que comprove a representação legal.");
        if (r.anamnese_request_id) {
          const [a] = await rows(
            "SELECT statusRequest FROM anamnese_requests WHERE id=?",
            [r.anamnese_request_id],
            connection
          );
          if (a?.statusRequest !== "preenchida")
            throw bad(
              "Conclua a anamnese vinculada antes de enviar a autorização."
            );
        }
        if (submission.signatureMode === "external") {
          if (
            fresh.prepared_hash !== hash ||
            !files.some(
              f => f.kind === "signed_pdf" && f.document_hash === hash
            )
          )
            throw bad(
              "Os dados mudaram ou falta o PDF assinado correspondente. Prepare e assine novamente o documento correto."
            );
        } else {
          const bytes = consentPdf({
            id: r.id,
            template: JSON.parse(r.template_json),
            procedure: JSON.parse(r.procedure_json),
            submission,
            hash,
            submittedAt: new Date().toISOString(),
          });
          const f = await persistFile(
            r,
            "signed_simple",
            `autorizacao-${r.id}-assinada.pdf`,
            bytes,
            "application/pdf",
            hash,
            connection
          );
          await audit(
            r.id,
            r.studio_id,
            null,
            "simple_pdf_stored",
            { sha256: f.sha256 },
            connection
          );
        }
        const record = {
          ...submission,
          modelVersion: MINOR_CONSENT_VERSION,
          receivedAt: new Date().toISOString(),
          anamneseSnapshot: context.anamneseSnapshot,
          documentManifest: context.manifest,
          evidence: {
            ip: ctx.req.ip || ctx.req.socket.remoteAddress || "",
            userAgent: String(ctx.req.headers["user-agent"] || "").slice(
              0,
              500
            ),
          },
        };
        await connection.query(
          "UPDATE minor_consent_requests SET status='received',submission_json=?,submission_hash=?,submitted_at=CURRENT_TIMESTAMP,revision=revision+1 WHERE id=?",
          [JSON.stringify(record), hash, r.id]
        );
        for (const recipient of ["artist", "studio"])
          if (
            recipient === "artist" ? fresh.notify_artist : fresh.notify_studio
          )
            await connection.query(
              "INSERT IGNORE INTO minor_consent_notices(request_id,recipient) VALUES(?,?)",
              [r.id, recipient]
            );
        await audit(
          r.id,
          r.studio_id,
          null,
          "submitted",
          { hash, signatureMode: submission.signatureMode },
          connection
        );
        await connection.commit();
        return {
          received: true,
          id: r.id,
          verification: "pending",
          backup: "pending",
        };
      } catch (e) {
        await connection.rollback();
        throw e;
      } finally {
        await connection.query("SELECT RELEASE_LOCK(?)", [
          `minor-upload:${r.id}`,
        ]);
        connection.release();
      }
    }),
});
