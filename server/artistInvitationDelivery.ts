import { and, eq } from "drizzle-orm";
import { studios, whatsappIntegrations } from "../drizzle/schema";
import { getDb } from "./db";
import { getProviderForIntegration } from "./messaging/service";
import { BotConversaProvider } from "./messaging/providers/botconversa";

export type ArtistInvitationDelivery =
  | { status: "sent"; provider: "botconversa"; inviteUrl: string }
  | { status: "not_configured"; provider: "botconversa"; inviteUrl: string; error: string }
  | { status: "failed"; provider: "botconversa"; inviteUrl: string; error: string }
  | { status: "unknown"; provider: "botconversa"; inviteUrl: string; error: string };

export function artistInvitationUrl(token: string, baseUrl = process.env.APP_BASE_URL) {
  const base = (baseUrl?.trim() || "https://crm.tatuei.com").replace(/\/+$/, "");
  return `${base}/convite-artista/${token}`;
}

export function artistInvitationMessage(params: { artistName: string; studioName?: string | null; inviteUrl: string }) {
  const firstName = params.artistName.trim().split(/\s+/)[0] || "artista";
  const studio = params.studioName?.trim() || "seu estúdio";
  return [
    `Olá, ${firstName}! Você recebeu um convite para acessar o Tatuei como artista do ${studio}.`,
    "",
    "Crie sua conta e defina sua senha pelo link:",
    params.inviteUrl,
    "",
    "Este link é pessoal e válido por 7 dias.",
  ].join("\n");
}

/**
 * Envia o convite somente por uma integração BotConversa ativa do mesmo estúdio.
 * Para não criar opt-in de WhatsApp em nome do destinatário, o envio automático
 * usa apenas um assinante que já exista no BotConversa. Se ele ainda não existir,
 * o convite continua válido e a interface mantém as opções de cópia/envio manual.
 */
export async function sendArtistInvitationByBotConversa(params: {
  studioId: number;
  artistId: number;
  artistName: string;
  phone: string;
  token: string;
}): Promise<ArtistInvitationDelivery> {
  const inviteUrl = artistInvitationUrl(params.token);
  const db = await getDb();
  if (!db) {
    return { status: "failed", provider: "botconversa", inviteUrl, error: "Banco temporariamente indisponível para localizar a integração." };
  }

  const [integration] = await db.select().from(whatsappIntegrations).where(and(
    eq(whatsappIntegrations.studioId, params.studioId),
    eq(whatsappIntegrations.provider, "botconversa"),
    eq(whatsappIntegrations.status, "ativo"),
    eq(whatsappIntegrations.isEnabled, 1),
  )).limit(1);

  if (!integration) {
    return { status: "not_configured", provider: "botconversa", inviteUrl, error: "Nenhuma integração BotConversa ativa foi encontrada neste estúdio." };
  }

  const [studio] = await db.select({ name: studios.name }).from(studios)
    .where(eq(studios.id, params.studioId)).limit(1);
  const message = artistInvitationMessage({ artistName: params.artistName, studioName: studio?.name, inviteUrl });

  try {
    const provider = await getProviderForIntegration(integration);
    if (!(provider instanceof BotConversaProvider)) {
      return { status: "failed", provider: "botconversa", inviteUrl, error: "A integração ativa não pôde ser aberta como BotConversa." };
    }
    const sent = await provider.sendExistingContactReply(params.phone, message);
    if (sent.status === "accepted") {
      return { status: "sent", provider: "botconversa", inviteUrl };
    }
    return {
      status: sent.status === "unknown" ? "unknown" : "failed",
      provider: "botconversa",
      inviteUrl,
      error: sent.error || (sent.status === "unknown"
        ? "O BotConversa recebeu a tentativa, mas não foi possível confirmar a entrega."
        : "Não foi possível enviar o convite pelo BotConversa."),
    };
  } catch {
    return { status: "failed", provider: "botconversa", inviteUrl, error: "Não foi possível enviar o convite pelo BotConversa agora." };
  }
}
