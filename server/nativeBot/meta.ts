import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import type { BotSettings } from "./access";
import { openBotSecret } from "./crypto";
import { BotProviderError } from "./providers";
import { isOutboundMessagingBlocked } from "../messaging/outboundSafety";

// Namespaced in the existing connection slot; legacy Z-API records need no migration.
export const isMetaBot = (s: Pick<BotSettings, "wa_instance">) =>
  !!s.wa_instance?.startsWith("meta:");
export const metaCredentialsSchema = z.object({
  phoneNumberId: z
    .string()
    .trim()
    .regex(/^\d{5,30}$/),
  accessToken: z.string().trim().min(20).max(4096).regex(/^\S+$/),
  appSecret: z
    .string()
    .trim()
    .regex(/^[a-fA-F0-9]{32}$/),
});
export function metaCredentials(s: BotSettings) {
  if (!isMetaBot(s) || !s.wa_secret)
    throw new BotProviderError("Configure a conexão oficial da Meta.");
  const credentials = metaCredentialsSchema.parse(
    JSON.parse(openBotSecret(s.wa_secret, s.studio_id))
  );
  if (s.wa_instance !== `meta:${credentials.phoneNumberId}`)
    throw new BotProviderError("A identificação do número Meta não confere.");
  return credentials;
}
export function metaWebhookUrl(s: BotSettings) {
  const base = process.env.APP_BASE_URL?.trim().replace(/\/$/, "");
  if (!base?.startsWith("https://") || !s.webhook_key) return null;
  return `${base}/api/native-bot/meta/webhook/${s.webhook_key}`;
}
export function metaWindowOpen(lastInbound: string | null, now = Date.now()) {
  if (!lastInbound) return false;
  const timestamp = Date.parse(
    /(?:Z|[+-]\d{2}:\d{2})$/.test(lastInbound)
      ? lastInbound
      : lastInbound.replace(" ", "T") + "Z"
  );
  return (
    Number.isFinite(timestamp) && timestamp <= now && timestamp > now - 86400000
  );
}
export const META_WINDOW_ERROR =
  "A janela de 24 horas da Meta está encerrada. Aguarde uma mensagem do cliente. Envio por modelo aprovado não está disponível neste conector do bot.";

async function metaRequest(
  s: BotSettings,
  message?: { to: string; body: string }
) {
  const credentials = metaCredentials(s);
  if (message && isOutboundMessagingBlocked())
    throw new BotProviderError(
      "Ações externas bloqueadas neste ambiente de teste."
    );
  let response: Response;
  try {
    response = await fetch(
      `https://graph.facebook.com/v23.0/${credentials.phoneNumberId}${message ? "/messages" : "?fields=id,display_phone_number,verified_name"}`,
      {
        method: message ? "POST" : "GET",
        headers: {
          Authorization: `Bearer ${credentials.accessToken}`,
          "Content-Type": "application/json",
        },
        ...(message
          ? {
              body: JSON.stringify({
                messaging_product: "whatsapp",
                recipient_type: "individual",
                to: message.to,
                type: "text",
                text: { body: message.body },
              }),
            }
          : {}),
        signal: AbortSignal.timeout(15000),
        redirect: "error",
      }
    );
  } catch {
    throw new BotProviderError(
      "A Meta não confirmou o resultado. Verifique a conexão antes de reenviar.",
      !!message
    );
  }
  const data = (await response.json().catch(() => null)) as any;
  if (!response.ok || data?.error) {
    const code = Number(data?.error?.code);
    throw new BotProviderError(
      code === 131047
        ? META_WINDOW_ERROR
        : response.status === 401 || response.status === 403 || code === 190
          ? "A Meta não aceitou o token ou as permissões. Confira a credencial e o acesso ao número."
          : `Não foi possível concluir a solicitação à Meta (HTTP ${response.status}${Number.isFinite(code) ? `, código ${code}` : ""}).`,
      !!message && response.status >= 500
    );
  }
  if (!data)
    throw new BotProviderError("Resposta inesperada da Meta.", !!message);
  return data;
}
export async function verifyMetaBot(s: BotSettings) {
  const data = await metaRequest(s);
  if (
    String(data.id) !== metaCredentials(s).phoneNumberId ||
    typeof data.display_phone_number !== "string"
  )
    throw new BotProviderError("A Meta não confirmou o número informado.");
  return {
    phone: data.display_phone_number.replace(/[^\d+]/g, "").slice(0, 24),
  };
}
export async function sendMetaBot(
  s: BotSettings,
  to: string,
  body: string,
  lastInbound: string | null
) {
  if (!metaWindowOpen(lastInbound))
    throw new BotProviderError(META_WINDOW_ERROR);
  const data = await metaRequest(s, { to, body });
  const messageId = data?.messages?.[0]?.id;
  if (typeof messageId !== "string" || !messageId)
    throw new BotProviderError(
      "A Meta não confirmou o identificador da mensagem.",
      true
    );
  return { messageId };
}
export function validMetaSignature(
  raw: Buffer | undefined,
  signature: string | undefined,
  appSecret: string
) {
  if (!raw || !signature || !/^sha256=[a-fA-F0-9]{64}$/.test(signature))
    return false;
  const expected = createHmac("sha256", appSecret).update(raw).digest();
  return timingSafeEqual(expected, Buffer.from(signature.slice(7), "hex"));
}
