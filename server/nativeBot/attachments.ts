import type { Request, Response } from "express";
import { attachmentSchema, MAX_ATTACHMENT_BYTES } from "../../shared/botInbox";
import { sdk } from "../_core/sdk";
import { isUserAccessActive } from "../saas";
import { scopedBotConversation } from "./access";
import { rows, exec, botPool, type BotConnection } from "./database";
import { openBotSecret, sealBotSecret } from "./crypto";
import type { z } from "zod";

export type BotAttachment = z.infer<typeof attachmentSchema>;
export function validateAttachment(input: BotAttachment) {
  const value = attachmentSchema.parse(input);
  const bytes = Buffer.from(value.base64, "base64");
  if (
    !bytes.length ||
    bytes.length > MAX_ATTACHMENT_BYTES ||
    bytes.toString("base64") !== value.base64
  )
    throw new Error("Arquivo inválido ou maior que 5 MB.");
  // No HTML/SVG or arbitrary executable files; downloads always use attachment disposition.
  return { ...value, name: value.name.replace(/[\x00-\x1f\x7f/\\"]/g, "_") };
}
export async function saveAttachment(
  messageId: number,
  studioId: number,
  conversationId: number,
  input: BotAttachment,
  c: BotConnection = botPool()
) {
  const a = validateAttachment(input);
  await exec(
    "INSERT IGNORE INTO tatuei_bot_attachments(message_id,studio_id,conversation_id,name,mime,encrypted_data) VALUES(?,?,?,?,?,?)",
    [
      messageId,
      studioId,
      conversationId,
      a.name,
      a.mime,
      sealBotSecret(a.base64, studioId),
    ],
    c
  );
}
export async function loadAttachment(
  messageId: number,
  studioId: number,
  c: BotConnection = botPool()
): Promise<BotAttachment | null> {
  const [a] = await rows(
    "SELECT * FROM tatuei_bot_attachments WHERE message_id=? AND studio_id=?",
    [messageId, studioId],
    c
  );
  return a
    ? {
        name: a.name,
        mime: a.mime,
        base64: openBotSecret(a.encrypted_data, studioId),
      }
    : null;
}
export async function botAttachmentDownload(req: Request, res: Response) {
  try {
    const user = await sdk.authenticateRequest(req);
    if (!user || !(await isUserAccessActive(user))) return res.sendStatus(401);
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id < 1) return res.sendStatus(400);
    const [a] = await rows(
      "SELECT conversation_id FROM tatuei_bot_attachments WHERE message_id=? AND studio_id=?",
      [id, user.studioId]
    );
    if (!a) return res.sendStatus(404);
    await scopedBotConversation(user, a.conversation_id);
    const value = await loadAttachment(id, user.studioId!);
    if (!value) return res.sendStatus(404);
    res.set({
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Type": value.mime,
      "Content-Disposition": `attachment; filename="arquivo"; filename*=UTF-8''${encodeURIComponent(value.name)}`,
    });
    res.send(Buffer.from(value.base64, "base64"));
  } catch {
    res.sendStatus(403);
  }
}
