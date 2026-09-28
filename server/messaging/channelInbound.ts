import type { BotSettings } from "../nativeBot/access";
import { rows, exec, withBotLock } from "../nativeBot/database";
import { persistBotInbound, type botWebhookSchema } from "../nativeBot/webhook";
import type { z } from "zod";
import { hashIntegrationPayload } from "./crypto";
import { handleWebhookReply } from "./webhook";
import { ingestReadonlyMessage } from "../intelligentInbox/service";

/** One authenticated provider event, one CRM dispatch; the Bot only answers unhandled messages. */
export async function dispatchChannelInbound(
  s: BotSettings,
  event: z.infer<typeof botWebhookSchema>,
  phone: string,
  inboundAt?: string
) {
  const id = s.wa_integration_id!;
  const key = hashIntegrationPayload(`channel:${id}:${event.messageId}`);
  const completed = await withBotLock(
    "channel_event_" + key.slice(0, 40),
    async c => {
      const [known] = await rows(
        "SELECT status FROM integration_events WHERE idempotency_key=?",
        [key],
        c
      );
      if (known?.status === "processed") return true;
      if (known)
        throw new Error("Evento em revisão; não repetir efeitos externos.");
      await exec(
        "INSERT INTO integration_events(studio_id,integration_id,direction,type,idempotency_key,provider_event_id,payload_hash,status) VALUES(?,?,'inbound','webhook_message',?,?,?,'received')",
        [
          s.studio_id,
          id,
          key,
          event.messageId,
          hashIntegrationPayload(JSON.stringify(event)),
        ],
        c
      );
      try {
        let handled = false;
        if (!event.fromMe && event.text?.message) {
          const [active] = await rows(
            "SELECT id FROM whatsapp_integrations WHERE id=? AND studio_id=? AND is_enabled=1 AND status='ativo'",
            [id, s.studio_id],
            c
          );
          if (active)
            handled = !!(await handleWebhookReply(
              phone,
              event.text.message,
              s.studio_id,
              key
            ));
          try {
            await ingestReadonlyMessage({
              studioId: s.studio_id,
              integrationId: id,
              eventId: event.messageId,
              phone,
              text: event.text.message,
              clientName: event.senderName,
              messageAt: inboundAt,
            });
          } catch {
            console.warn(
              "[Canais] Registro na Central Inteligente indisponível."
            );
          }
        }
        const [current] = await rows(
          "SELECT wa_integration_id FROM tatuei_bot_settings WHERE studio_id=?",
          [s.studio_id],
          c
        );
        if (current?.wa_integration_id === id)
          await persistBotInbound(s, event, phone, inboundAt, true, handled);
        await exec(
          "UPDATE integration_events SET status='processed',processed_at=UTC_TIMESTAMP() WHERE idempotency_key=?",
          [key],
          c
        );
        return true;
      } catch (e) {
        await exec(
          "UPDATE integration_events SET status='failed',error_message='Falha no recebimento compartilhado; revisar antes de repetir.' WHERE idempotency_key=?",
          [key],
          c
        );
        throw e;
      }
    }
  );
  if (!completed) throw new Error("Evento em processamento.");
}
