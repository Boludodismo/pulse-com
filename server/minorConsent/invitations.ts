import {
  createCipheriv,
  createDecipheriv,
  hkdfSync,
  randomBytes,
} from "node:crypto";
import { TRPCError } from "@trpc/server";
import { ENV } from "../_core/env";
import { rows } from "./database";
import { sha } from "./backup";
import { assertPrivateConnectionAccess } from "../messaging/privateConnectionAccess";
import { getActiveIntegration, sendAndLog } from "../messaging/service";
import {
  isOutboundMessagingBlocked,
  OUTBOUND_BLOCKED_ERROR,
} from "../messaging/outboundSafety";
import { normalizeBrazilianPhone } from "../messaging/phone";
import { minorConsentInvitationMessage } from "../../shared/minorConsent";
import {
  invitationDeliveryError,
  invitationTrigger,
} from "./invitationDelivery";
import type { User } from "../../drizzle/schema";
import * as db from "../db";
function invitationKey() {
  if (Buffer.byteLength(ENV.authSecurityKey) < 32)
    throw new Error("Chave de proteção dos links indisponível.");
  return Buffer.from(
    hkdfSync(
      "sha256",
      ENV.authSecurityKey,
      "tatuei-minor-invitation-v1",
      "token-storage",
      32
    )
  );
}
export function sealInvitationToken(
  token: string,
  studioId: number,
  requestId: number
) {
  const iv = randomBytes(12),
    cipher = createCipheriv("aes-256-gcm", invitationKey(), iv);
  cipher.setAAD(Buffer.from(`${studioId}:${requestId}`));
  const bytes = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), bytes]).toString("base64");
}
export function openInvitationToken(
  value: string,
  studioId: number,
  requestId: number
) {
  const bytes = Buffer.from(value, "base64"),
    cipher = createDecipheriv(
      "aes-256-gcm",
      invitationKey(),
      bytes.subarray(0, 12)
    );
  cipher.setAAD(Buffer.from(`${studioId}:${requestId}`));
  cipher.setAuthTag(bytes.subarray(12, 28));
  return Buffer.concat([
    cipher.update(bytes.subarray(28)),
    cipher.final(),
  ]).toString("utf8");
}
export async function invitationLinks(r: any) {
  if (r.status !== "pending" || Number(r.expires_at) <= Date.now())
    throw new TRPCError({
      code: "BAD_REQUEST",
      message:
        "Esta autorização foi concluída, cancelada ou expirou. Gere um novo conjunto de fichas.",
    });
  const [i] = await rows(
    "SELECT encrypted_token FROM minor_consent_invitations WHERE request_id=? AND studio_id=?",
    [r.id, r.studio_id]
  );
  const [a] = await rows(
    "SELECT token,statusRequest FROM anamnese_requests WHERE id=? AND clientId=?",
    [r.anamnese_request_id, r.client_id]
  );
  if (!i || !a || !["pendente", "preenchida"].includes(a.statusRequest))
    throw new TRPCError({
      code: "BAD_REQUEST",
      message:
        "Gere uma nova autorização para disponibilizar os dois links neste painel.",
    });
  const token = openInvitationToken(i.encrypted_token, r.studio_id, r.id);
  if (sha(token) !== r.token_hash)
    throw new TRPCError({
      code: "CONFLICT",
      message: "Os links foram alterados. Atualize o cadastro.",
    });
  const base = ENV.appBaseUrl.replace(/\/$/, "");
  return {
    link: `${base}/autorizacao/${token}`,
    anamneseLink: `${base}/anamnese/${a.token}?autorizacao=${token}`,
    anamneseCompleted: a.statusRequest === "preenchida",
  };
}
export async function invitationDeliveryDetails(user: User, r: any) {
  await assertPrivateConnectionAccess(user, r.studio_id);
  const integration = await getActiveIntegration(r.studio_id);
  const client = await db.getClientById(r.client_id);
  const trigger = invitationTrigger(r.id, r.token_hash);
  const [lastDelivery] = await rows(
    "SELECT id,status,errorMessage AS error,sentAt FROM message_queue WHERE studio_id=? AND clientId=? AND `trigger`=? ORDER BY id DESC LIMIT 1",
    [r.studio_id, r.client_id, trigger]
  );
  let reason: string | null = null,
    phone = "";
  try {
    phone = normalizeBrazilianPhone(client?.phone || "");
  } catch {
    reason = "Cadastre um WhatsApp válido com DDD para este cliente.";
  }
  if (isOutboundMessagingBlocked()) reason = OUTBOUND_BLOCKED_ERROR;
  else if (!integration)
    reason = "Conecte e ative o WhatsApp cadastrado no CRM antes de enviar.";
  else if (integration.sandboxMode)
    reason = "Libere a conexão para produção antes de enviar as fichas.";
  else if (!reason) {
    reason = await invitationDeliveryError(
      r.studio_id,
      trigger,
      r.client_id,
      phone,
      false
    );
    const [consent] = await rows(
      "SELECT has_whatsapp_opt_in AS enabled,opted_out_at AS optedOutAt,normalized_phone AS phone FROM integration_contacts WHERE studio_id=? AND integration_id=? AND client_id=?",
      [r.studio_id, integration.id, r.client_id]
    );
    if (
      !reason &&
      (!consent?.enabled || consent.optedOutAt || consent.phone !== phone)
    )
      reason =
        "Registre a autorização de WhatsApp para o número atual deste cliente antes de enviar pelo sistema.";
  }
  return {
    integration,
    phone,
    clientName: client?.name || "",
    lastDelivery: lastDelivery || null,
    reason,
    trigger,
  };
}
export async function queueConsentInvitation(user: User, r: any) {
  const links = await invitationLinks(r);
  const d = await invitationDeliveryDetails(user, r);
  if (d.reason || !d.integration)
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: d.reason || "Conexão indisponível.",
    });
  if (d.lastDelivery && !["erro", "cancelada"].includes(d.lastDelivery.status))
    return { queued: d.lastDelivery.status === "pendente", duplicate: true };
  const result = await sendAndLog({
    studioId: r.studio_id,
    integrationId: d.integration.id,
    clientId: r.client_id,
    artistId: r.artist_id,
    recipientPhone: d.phone,
    recipientName: d.clientName,
    recipientType: "client",
    message: minorConsentInvitationMessage(
      d.clientName,
      links.link,
      links.anamneseLink
    ),
    trigger: d.trigger,
    idempotencyKey: `minor-invitation:${r.studio_id}:${r.id}:${r.token_hash.slice(0, 16)}:after-${d.lastDelivery?.id || 0}`,
  });
  if (!result.success)
    throw new TRPCError({
      code: "SERVICE_UNAVAILABLE",
      message: result.error || "Não foi possível enfileirar o envio.",
    });
  return { queued: result.queued, duplicate: result.duplicate };
}
