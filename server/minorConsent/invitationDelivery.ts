import { rows } from "./database";
import { normalizeBrazilianPhone } from "../messaging/phone";
export const invitationTrigger = (id: number, hash: string) =>
  `minor_invitation:${id}:${hash.slice(0, 16)}`;
export function invitationId(trigger: string | null | undefined) {
  const match = /^minor_invitation:([1-9]\d*):([a-f0-9]{16})$/.exec(
    trigger || ""
  );
  return match ? { id: Number(match[1]), hash: match[2] } : null;
}
/** Re-check the request and recipient immediately before delivery, also on retries. */
export async function invitationDeliveryError(
  studioId: number,
  trigger: string,
  clientId: number | undefined,
  phone: string,
  sandbox: boolean
) {
  const parsed = invitationId(trigger);
  if (!parsed) return "Convite de autorização inválido.";
  if (sandbox) return "Autorizações exigem uma conexão liberada para produção.";
  const [row] = await rows(
    `SELECT r.status,r.expires_at,r.token_hash,r.client_id,r.anamnese_request_id,c.phone,c.isArchived,a.statusRequest AS anamnese_status,a.expiresAt AS anamnese_expires FROM minor_consent_requests r INNER JOIN clients c ON c.id=r.client_id AND c.studioId=r.studio_id LEFT JOIN anamnese_requests a ON a.id=r.anamnese_request_id AND a.clientId=r.client_id WHERE r.id=? AND r.studio_id=?`,
    [parsed.id, studioId]
  );
  if (
    !row ||
    row.client_id !== clientId ||
    row.isArchived ||
    row.status !== "pending" ||
    Number(row.expires_at) <= Date.now() ||
    !row.token_hash.startsWith(parsed.hash)
  )
    return "A autorização foi concluída, cancelada, alterada ou expirou. Atualize o cadastro antes de enviar.";
  const expiry =
    row.anamnese_expires instanceof Date
      ? row.anamnese_expires.getTime()
      : Date.parse(
          String(row.anamnese_expires).replace(" ", "T").replace(/Z?$/, "Z")
        );
  if (
    !row.anamnese_request_id ||
    !["pendente", "preenchida"].includes(row.anamnese_status) ||
    !Number.isFinite(expiry) ||
    expiry <= Date.now()
  )
    return "A anamnese vinculada não está disponível. Gere um novo conjunto de fichas.";
  try {
    if (
      normalizeBrazilianPhone(row.phone || "") !==
      normalizeBrazilianPhone(phone)
    )
      return "O WhatsApp do cliente mudou. Atualize o cadastro antes de enviar.";
  } catch {
    return "Cadastre um WhatsApp válido com DDD para este cliente.";
  }
  return null;
}
