import { z } from "zod";
import { timingSafeEqual } from "node:crypto";
import type { Request, Response } from "express";
import {
  assertBotSchema,
  rows,
  exec,
  botTransaction,
  utcSql,
  botAudit,
} from "./database";
import type { BotSettings } from "./access";
import {
  ensureBotConversation,
  nativeBotPhone,
  cancelBotQueue,
} from "./service";
export const botWebhookSchema = z.object({
  instanceId: z.string().min(1).max(100),
  messageId: z.string().min(1).max(160),
  phone: z.string().max(80),
  fromMe: z.boolean(),
  fromApi: z.boolean().optional(),
  isGroup: z.boolean().optional(),
  isNewsletter: z.boolean().optional(),
  broadcast: z.boolean().optional(),
  type: z.string().max(80).optional(),
  senderName: z.string().max(255).optional(),
  text: z.object({ message: z.string().max(12000) }).optional(),
  image: z.unknown().optional(),
  audio: z.unknown().optional(),
  video: z.unknown().optional(),
  document: z.unknown().optional(),
});
export function webhookKeyMatches(expected: string | null, actual: string) {
  return (
    !!expected &&
    expected.length === actual.length &&
    timingSafeEqual(Buffer.from(expected), Buffer.from(actual))
  );
}
export async function receiveNativeBotWebhook(req: Request, res: Response) {
  try {
    assertBotSchema();
    const key = String(req.params.key || "");
    if (!/^[A-Za-z0-9_-]{43}$/.test(key)) return res.sendStatus(404);
    const [s] = await rows<BotSettings>(
      "SELECT * FROM tatuei_bot_settings WHERE webhook_key=?",
      [key]
    );
    if (
      !s ||
      !s.wa_secret ||
      !s.webhook_ready ||
      !webhookKeyMatches(s.webhook_key, key)
    )
      return res.sendStatus(404);
    const parsed = botWebhookSchema.safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({ error: "Evento inválido." });
    const event = parsed.data;
    if (event.instanceId !== s.wa_instance) return res.sendStatus(403);
    if (
      event.isGroup ||
      event.isNewsletter ||
      event.broadcast ||
      event.fromApi === true ||
      (event.type && event.type !== "ReceivedCallback")
    )
      return res.json({ ignored: true });
    let phone: string;
    try {
      phone = nativeBotPhone(event.phone);
    } catch {
      return res.json({ ignored: true, reason: "Número não identificado." });
    }
    if (
      !event.text &&
      !event.image &&
      !event.audio &&
      !event.video &&
      !event.document
    )
      return res.json({ ignored: true });
    await botTransaction(async c => {
      if (
        (
          await rows(
            "SELECT id FROM tatuei_bot_messages WHERE studio_id=? AND external_id=?",
            [s.studio_id, event.messageId],
            c
          )
        ).length
      )
        return;
      let [cv] = await rows(
        "SELECT * FROM tatuei_bot_conversations WHERE studio_id=? AND phone=? FOR UPDATE",
        [s.studio_id, phone],
        c
      );
      if (!cv) {
        // Match only within this studio. Ambiguous shared numbers remain in the studio inbox.
        const suffix = phone.slice(-8);
        const candidates = await rows(
          "SELECT id,name,phone,artistId FROM clients WHERE studioId=? AND isArchived=0 AND phone LIKE ? LIMIT 100",
          [s.studio_id, "%" + suffix.slice(-4) + "%"],
          c
        );
        const matches = candidates.filter(cl => {
          try {
            return nativeBotPhone(cl.phone || "") === phone;
          } catch {
            return false;
          }
        });
        cv = await ensureBotConversation(
          s.studio_id,
          matches.length === 1
            ? {
                id: matches[0].id,
                name: matches[0].name,
                phone,
                artistId: matches[0].artistId,
              }
            : { name: event.senderName || phone, phone },
          c
        );
      }
      const body =
        event.text?.message ||
        "[Mídia recebida pelo WhatsApp. Consulte o aplicativo para visualizar o arquivo.]";
      const inserted = await exec(
        "INSERT IGNORE INTO tatuei_bot_messages(studio_id,conversation_id,role,body,status,external_id,origin,due_at) VALUES(?,?,?,?,?,?,?,?)",
        [
          s.studio_id,
          cv.id,
          event.fromMe ? "staff" : "client",
          body.slice(0, 12000),
          event.fromMe ? "sent" : "received",
          event.messageId,
          event.text ? "reply" : "media",
          utcSql(),
        ],
        c
      );
      if (!inserted.insertId) return;
      if (event.fromMe) {
        await exec(
          "UPDATE tatuei_bot_conversations SET mode='human',revision=revision+1,updated_at=UTC_TIMESTAMP() WHERE id=?",
          [cv.id],
          c
        );
        await cancelBotQueue(cv, c);
        await botAudit(
          s.studio_id,
          cv.artist_id,
          "Atendimento assumido no WhatsApp",
          cv.name,
          null,
          c
        );
      } else
        await exec(
          "UPDATE tatuei_bot_conversations SET last_inbound_at=UTC_TIMESTAMP(),updated_at=UTC_TIMESTAMP() WHERE id=?",
          [cv.id],
          c
        );
    });
    return res.json({ received: true });
  } catch {
    console.error("[Bot Tatuei] Incoming event could not be persisted.");
    return res.status(503).json({ error: "Tente novamente." });
  }
}
