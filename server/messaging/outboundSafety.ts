/** Homologação nunca envia mensagens, mesmo com credenciais copiadas. */
export function isOutboundMessagingBlocked(): boolean {
  return process.env.OUTBOUND_MESSAGING_DISABLED === "true" ||
    process.env.RAILWAY_ENVIRONMENT_ID === "92e8281a-668a-43ed-b2ba-cac84082a91c";
}

export const OUTBOUND_BLOCKED_ERROR = "Envio de mensagens bloqueado neste ambiente de teste.";
