import { channelForWebhook } from "../messaging/channels";
import type { Request, Response } from "express";
import { z } from "zod";
import { assertBotSchema, rows, exec, utcSql } from "./database";
import type { BotSettings } from "./access";
import { metaCredentials, isMetaBot, validMetaSignature } from "./meta";
import { persistBotInbound, webhookKeyMatches } from "./webhook";
import { nativeBotPhone } from "./service";

const payloadSchema = z.object({
  object: z.literal("whatsapp_business_account"),
  entry: z
    .array(
      z.object({
        changes: z
          .array(
            z.object({
              field: z.string(),
              value: z
                .object({
                  metadata: z.object({ phone_number_id: z.string() }),
                  contacts: z
                    .array(
                      z.object({
                        wa_id: z.string(),
                        profile: z.object({ name: z.string() }).optional(),
                      })
                    )
                    .optional(),
                  messages: z
                    .array(
                      z.object({
                        id: z.string().min(1).max(160),
                        from: z.string(),
                        timestamp: z.string().regex(/^\d+$/),
                        type: z.string(),
                        text: z
                          .object({ body: z.string().max(12000) })
                          .optional(),
                        button: z
                          .object({ text: z.string().max(12000) })
                          .optional(),
                        interactive: z
                          .object({
                            button_reply: z
                              .object({ title: z.string().max(12000) })
                              .optional(),
                            list_reply: z
                              .object({ title: z.string().max(12000) })
                              .optional(),
                          })
                          .optional(),
                      })
                    )
                    .optional(),
                })
                .passthrough(),
            })
          )
          .max(100),
      })
    )
    .max(100),
});
async function connection(req: Request) {
  assertBotSchema();
  const key = String(req.params.key || "");
  if (!/^[A-Za-z0-9_-]{43}$/.test(key)) return null;
  const shared=await channelForWebhook(key);
  if(shared) return isMetaBot(shared.settings)&&shared.settings.wa_secret?shared.settings:null;
  const [s] = await rows<BotSettings>(
    "SELECT * FROM tatuei_bot_settings WHERE webhook_key=?",
    [key]
  );
  if (
    !s ||
    !s.wa_secret ||
    !isMetaBot(s) ||
    !webhookKeyMatches(s.webhook_key, key)
  )
    return null;
  return s;
}
export async function verifyMetaWebhook(req: Request, res: Response) {
  try {
    const s = await connection(req);
    if (!s) return res.sendStatus(404);
    const challenge = req.query["hub.challenge"];
    const token = req.query["hub.verify_token"];
    if (
      req.query["hub.mode"] !== "subscribe" ||
      typeof challenge !== "string" ||
      !/^\d{1,100}$/.test(challenge) ||
      typeof token !== "string" ||
      !webhookKeyMatches(s.webhook_key, token)
    )
      return res.sendStatus(403);
    if(s.wa_integration_id) await exec("UPDATE whatsapp_integrations SET webhook_ready=1 WHERE id=? AND studio_id=? AND connection_key=?",[s.wa_integration_id,s.studio_id,s.webhook_key]);
    else await exec(
      "UPDATE tatuei_bot_settings SET webhook_ready=1 WHERE studio_id=? AND webhook_key=?",
      [s.studio_id, s.webhook_key]
    );
    return res.status(200).type("text/plain").send(challenge);
  } catch {
    return res.sendStatus(503);
  }
}
export async function receiveMetaWebhook(req: Request, res: Response) {
  try {
    const s = await connection(req);
    if (!s) return res.sendStatus(404);
    const credentials = metaCredentials(s);
    if (
      !validMetaSignature(
        (req as Request & { metaRawBody?: Buffer }).metaRawBody,
        req.get("x-hub-signature-256"),
        credentials.appSecret
      )
    )
      return res.sendStatus(403);
    const parsed = payloadSchema.safeParse(req.body);
    if (!parsed.success) return res.sendStatus(400);
    for (const entry of parsed.data.entry)
      for (const change of entry.changes) {
        const value = change.value;
        if (
          change.field !== "messages" ||
          value.metadata.phone_number_id !== credentials.phoneNumberId
        )
          continue;
        for (const message of value.messages || []) {
          const timestamp = Number(message.timestamp) * 1000;
          if (
            !Number.isFinite(timestamp) ||
            timestamp <= 0 ||
            timestamp > Date.now() + 60000
          )
            continue;
          let phone: string;
          try {
            phone = nativeBotPhone(message.from);
          } catch {
            continue;
          }
          const text =
            message.type === "text"
              ? message.text?.body
              : message.type === "button"
                ? message.button?.text
                : message.type === "interactive"
                  ? message.interactive?.button_reply?.title ||
                    message.interactive?.list_reply?.title
                  : undefined;
          const media = [
            "image",
            "audio",
            "video",
            "document",
            "sticker",
          ].includes(message.type);
          if (!text && !media) continue;
          await persistBotInbound(
            s,
            {
              instanceId: s.wa_instance!,
              messageId: message.id,
              phone,
              fromMe: false,
              senderName: value.contacts
                ?.find(c => c.wa_id === message.from)
                ?.profile?.name?.slice(0, 255),
              ...(text ? { text: { message: text } } : { document: true }),
            },
            phone,
            utcSql(new Date(Math.min(timestamp, Date.now())))
          );
        }
      }
    return res.json({ received: true });
  } catch {
    console.error("[Bot Tatuei] Meta event could not be persisted.");
    return res.sendStatus(503);
  }
}
