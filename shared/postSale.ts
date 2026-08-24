export type PostSaleStage = "healing_7d" | "healed_60d" | "feedback_180d" | "anniversary_365d";

export const POST_SALE_STAGES: Array<{ stage: PostSaleStage; days: number; label: string }> = [
  { stage: "healing_7d", days: 7, label: "Cicatrização — 7 dias" },
  { stage: "healed_60d", days: 60, label: "Resultado cicatrizado — 60 dias" },
  { stage: "feedback_180d", days: 180, label: "Relacionamento — 6 meses" },
  { stage: "anniversary_365d", days: 365, label: "Aniversário da tattoo — 1 ano" },
];

export function postSaleFirstName(name?: string | null) {
  return (name || "cliente").trim().split(/\s+/)[0];
}

export function buildPostSaleMessage(input: {
  stage: PostSaleStage;
  clientName?: string | null;
  artistName?: string | null;
  service?: string | null;
}) {
  const name = postSaleFirstName(input.clientName);
  const artist = input.artistName ? ` — ${input.artistName}` : "";
  const service = input.service ? ` sobre ${input.service}` : "";

  const messages: Record<PostSaleStage, string> = {
    healing_7d:
      `Olá, ${name}! Tudo bem? Já faz uma semana da sua sessão${artist}. Como está a cicatrização? ` +
      `Se quiser, envie uma foto para acompanharmos. Responda: 1) Está tudo bem  2) Quero enviar uma foto  3) Tenho uma dúvida.`,
    healed_60d:
      `Olá, ${name}! Passaram cerca de 60 dias da sua sessão${service}. Como ficou o resultado depois da cicatrização? ` +
      `Queremos saber se você está satisfeito e se precisa de alguma orientação ou avaliação.`,
    feedback_180d:
      `Olá, ${name}! Esperamos que esteja tudo bem. Já faz cerca de seis meses da sua tattoo${artist}. ` +
      `Como ela está? Se tiver uma nova ideia, será um prazer conversar e planejar seu próximo projeto.`,
    anniversary_365d:
      `Olá, ${name}! Hoje celebramos um ano da sua tattoo${artist}. Muito obrigado pela confiança no nosso trabalho! ` +
      `Como ela está? Quando quiser criar uma nova arte, estaremos por aqui para cuidar de cada detalhe.`,
  };
  return messages[input.stage];
}

export function buildPostSaleWhatsAppLink(phone: string | null | undefined, message: string) {
  const digits = (phone || "").replace(/\D/g, "");
  const normalized = digits.length === 10 || digits.length === 11 ? `55${digits}` : digits;
  return normalized ? `https://wa.me/${normalized}?text=${encodeURIComponent(message)}` : "";
}
