import { rows, pool, audit } from "./database";
import { backupConsent } from "./backup";
import { sendAndLog } from "../messaging/service";
import * as db from "../db";
import { normalizeBrazilianPhone } from "../messaging/phone";

let busy = false;
export async function processMinorConsentRecords() {
  if (busy) return;
  busy = true;
  try {
    const notices = await rows(
      "SELECT n.*,r.studio_id,r.client_id,r.artist_id,r.notify_artist,r.notify_studio FROM minor_consent_notices n INNER JOIN minor_consent_requests r ON r.id=n.request_id WHERE n.status<>'queued' AND n.next_attempt<=? AND r.submitted_at IS NOT NULL LIMIT 10",
      [Date.now()]
    );
    for (const n of notices) {
      try {
        const client = await db.getClientById(n.client_id);
        const settings = await db.getStudioSettings(n.studio_id);
        let phone: string | null = null,
          name = "Estúdio";
        if (n.recipient === "artist") {
          const artist = await db.getArtistById(n.artist_id, n.studio_id);
          const [preference] = await rows(
            "SELECT whatsapp_operational_enabled AS enabled FROM artist_notification_settings WHERE studio_id=? AND artist_id=?",
            [n.studio_id, n.artist_id]
          );
          if (
            !n.notify_artist ||
            !artist?.phone ||
            artist.active !== 1 ||
            preference?.enabled !== 1
          )
            throw new Error(
              "Ative os avisos operacionais e confira o WhatsApp cadastrado do artista."
            );
          phone = artist.phone;
          name = artist.name;
        } else {
          if (!n.notify_studio || !settings?.phone)
            throw new Error(
              "Aviso ao estúdio desativado ou WhatsApp do estúdio não cadastrado."
            );
          phone = settings.phone;
          name = settings.studioName || name;
        }
        normalizeBrazilianPhone(phone);
        const result = await sendAndLog({
          studioId: n.studio_id,
          clientId: n.client_id,
          artistId: n.recipient === "artist" ? n.artist_id : undefined,
          operationalRecipient: n.recipient === "studio" ? "studio" : undefined,
          recipientPhone: phone,
          recipientName: name,
          recipientType: "artist",
          trigger: `minor_consent_completed:${n.request_id}:${n.recipient}`,
          idempotencyKey: `minor-consent:${n.studio_id}:${n.request_id}:${n.recipient}`,
          message: `Autorização recebida no Tatuei.\nCliente: ${(client?.name || "Cliente").split(" ")[0]}\nRegistro: ${n.request_id}\nA assinatura e os documentos aguardam conferência do profissional.\nAcesse o cadastro no CRM: ${process.env.APP_BASE_URL || ""}/clients/${n.client_id}`,
        });
        if (!result.success) throw new Error(result.error);
        let queueId = result.messageId ? Number(result.messageId) : null;
        if (!queueId) {
          const [existing] = await rows(
            "SELECT id FROM message_queue WHERE studio_id=? AND `trigger`=? ORDER BY id DESC LIMIT 1",
            [
              n.studio_id,
              `minor_consent_completed:${n.request_id}:${n.recipient}`,
            ]
          );
          queueId = existing?.id || null;
        }
        await pool().query(
          "UPDATE minor_consent_notices SET status='queued',queue_id=?,error_text=NULL,attempts=attempts+1 WHERE request_id=? AND recipient=?",
          [queueId, n.request_id, n.recipient]
        );
        await pool().query(
          "UPDATE minor_consent_requests SET revision=revision+1 WHERE id=?",
          [n.request_id]
        );
        await audit(n.request_id, n.studio_id, null, "notice_queued", {
          recipient: n.recipient,
        });
      } catch (e) {
        await pool().query(
          "UPDATE minor_consent_notices SET status='pending',error_text=?,attempts=attempts+1,next_attempt=? WHERE request_id=? AND recipient=?",
          [
            (e as Error).message.slice(0, 380),
            Date.now() + 5 * 60000,
            n.request_id,
            n.recipient,
          ]
        );
      }
    }
    const records = await rows(
      "SELECT id FROM minor_consent_requests WHERE submitted_at IS NOT NULL AND backup_revision<revision ORDER BY id LIMIT 3"
    );
    for (const r of records) await backupConsent(r.id);
  } catch {
    console.warn("[Consent] Registros pendentes serão processados novamente.");
  } finally {
    busy = false;
  }
}
export function startMinorConsentWorker() {
  const timer = setInterval(() => void processMinorConsentRecords(), 30_000);
  timer.unref();
  void processMinorConsentRecords();
}
