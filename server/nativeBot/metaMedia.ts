import { metaCredentials, metaWindowOpen, META_WINDOW_ERROR } from "./meta";
import type { BotSettings } from "./access";
import type { BotAttachment } from "./attachments";
import { BotProviderError } from "./providers";
import { isOutboundMessagingBlocked } from "../messaging/outboundSafety";
import { MAX_ATTACHMENT_BYTES } from "../../shared/botInbox";

const graph = "https://graph.facebook.com/v23.0";
async function request(
  s: BotSettings,
  path: string,
  body?: BodyInit,
  json = false
) {
  const credentials = metaCredentials(s);
  let response: Response;
  try {
    response = await fetch(`${graph}/${path}`, {
      method: body ? "POST" : "GET",
      headers: {
        Authorization: `Bearer ${credentials.accessToken}`,
        ...(json ? { "Content-Type": "application/json" } : {}),
      },
      body,
      signal: AbortSignal.timeout(20000),
      redirect: "error",
    });
  } catch {
    throw new BotProviderError(
      "A Meta não confirmou a operação.",
      !!body && json
    );
  }
  const data = (await response.json().catch(() => null)) as any;
  if (!response.ok || !data || data.error)
    throw new BotProviderError(
      "Não foi possível transferir a mídia pela Meta.",
      !!body && json && response.status >= 500
    );
  return data;
}
export async function sendMetaAttachment(
  s: BotSettings,
  phone: string,
  caption: string,
  inbound: string | null,
  a: BotAttachment
) {
  if (isOutboundMessagingBlocked())
    throw new BotProviderError("Envio bloqueado neste ambiente.");
  if (!metaWindowOpen(inbound)) throw new BotProviderError(META_WINDOW_ERROR);
  const credentials = metaCredentials(s);
  const form = new FormData();
  form.set("messaging_product", "whatsapp");
  form.set("type", a.mime);
  form.set(
    "file",
    new Blob([new Uint8Array(Buffer.from(a.base64, "base64"))], {
      type: a.mime,
    }),
    a.name
  );
  const uploaded = await request(s, `${credentials.phoneNumberId}/media`, form);
  if (!/^\d+$/.test(String(uploaded.id)))
    throw new BotProviderError("A Meta não confirmou o arquivo.");
  const type = a.mime.startsWith("image/")
    ? "image"
    : a.mime.startsWith("audio/")
      ? "audio"
      : a.mime.startsWith("video/")
        ? "video"
        : "document";
  const result = await request(
    s,
    `${credentials.phoneNumberId}/messages`,
    JSON.stringify({
      messaging_product: "whatsapp",
      to: phone,
      type,
      [type]: {
        id: uploaded.id,
        ...(type !== "audio" && caption ? { caption } : {}),
        ...(type === "document" ? { filename: a.name } : {}),
      },
    }),
    true
  );
  if (!result.messages?.[0]?.id)
    throw new BotProviderError("Envio sem confirmação da Meta.", true);
  return { messageId: result.messages[0].id as string };
}
export async function downloadMetaAttachment(
  s: BotSettings,
  id: string
): Promise<Buffer> {
  if (!/^\d{1,40}$/.test(id)) throw new Error("Mídia inválida.");
  const data = await request(s, id);
  if (Number(data.file_size) > MAX_ATTACHMENT_BYTES)
    throw new Error("Mídia maior que 5 MB.");
  const url = new URL(data.url);
  if (
    url.protocol !== "https:" ||
    url.hostname !== "lookaside.fbsbx.com" ||
    url.username ||
    url.password ||
    url.port
  )
    throw new Error("Origem de mídia não permitida.");
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${metaCredentials(s).accessToken}` },
    redirect: "error",
    signal: AbortSignal.timeout(15000),
  });
  if (
    !response.ok ||
    !response.body ||
    Number(response.headers.get("content-length")) > MAX_ATTACHMENT_BYTES
  )
    throw new Error("Mídia indisponível.");
  const reader = response.body.getReader();
  const chunks: Buffer[] = [];
  let size = 0;
  try {
    for (;;) {
      const item = await reader.read();
      if (item.done) break;
      size += item.value.length;
      if (size > MAX_ATTACHMENT_BYTES) throw new Error("Mídia maior que 5 MB.");
      chunks.push(Buffer.from(item.value));
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
  return Buffer.concat(chunks);
}
