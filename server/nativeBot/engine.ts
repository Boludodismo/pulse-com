import {
  containsBotPhrase,
  interpolateBot,
  outsideBotHours,
  type BotConfig,
  type BotRule,
} from "../../shared/nativeBot";
export type BotDecision = {
  text: string | null;
  handoff: boolean;
  reason: string;
  delayMinutes: number;
  useAi?: boolean;
  rule?: BotRule;
};
export function decideBot(
  c: BotConfig,
  text: string,
  vars: Record<string, string>,
  opts: {
    human?: boolean;
    outside?: boolean;
    event?: BotRule["event"];
    now?: Date;
  } = {}
): BotDecision {
  const reply = (
    key: keyof BotConfig["messages"],
    reason: string,
    handoff = false
  ): BotDecision => ({
    text: interpolateBot(c.messages[key], vars),
    handoff,
    reason,
    delayMinutes: 0,
  });
  if (opts.human)
    return {
      text: null,
      handoff: false,
      reason: "A equipe está no atendimento.",
      delayMinutes: 0,
    };
  if (
    [
      "humano",
      "pessoa",
      "falar com alguem",
      "atendente",
      "reagendar",
      "cancelar sessao",
      "preco",
      "valor",
      "quanto custa",
    ].some(k => containsBotPhrase(text, k))
  )
    return reply("handoff", "Cliente solicitou atendimento humano.", true);
  const outside = opts.outside ?? outsideBotHours(c, opts.now);

  const event =
    opts.event ||
    (["oi", "ola", "bom dia", "boa tarde", "boa noite"].some(k =>
      containsBotPhrase(text, k)
    )
      ? "greeting"
      : undefined);
  if (
    !opts.event &&
    outside &&
    (event !== "greeting" ||
      c.rules.find(r => r.event === "greeting")?.condition !== "outside")
  )
    return reply("away", "Mensagem recebida fora do horário.");
  if (event) {
    const rule = c.rules.find(r => r.event === event);
    if (!rule?.enabled || (rule.condition === "outside" && !outside))
      return {
        text: null,
        handoff: false,
        reason: "Regra desativada ou condição não atendida.",
        delayMinutes: 0,
      };
    return {
      ...reply(rule.message, "Automação: " + event, rule.after === "human"),
      delayMinutes: rule.delayMinutes,
      rule,
    };
  }
  if (
    ["endereco", "localizacao", "onde fica"].some(k =>
      containsBotPhrase(text, k)
    )
  )
    return c.address
      ? {
          text: c.address,
          handoff: false,
          reason: "Endereço cadastrado.",
          delayMinutes: 0,
        }
      : reply("handoff", "Endereço ainda não cadastrado.", true);
  if (
    ["horario", "horarios", "funcionamento"].some(k =>
      containsBotPhrase(text, k)
    )
  ) {
    const days = [
      "domingo",
      "segunda",
      "terça",
      "quarta",
      "quinta",
      "sexta",
      "sábado",
    ];
    return {
      text: `Atendemos ${c.days.map(d => days[d]).join(", ")}, das ${c.opens} às ${c.closes} (horário de Brasília).`,
      handoff: false,
      reason: "Horário cadastrado.",
      delayMinutes: 0,
    };
  }
  const faq = c.faqs.find(f =>
    f.keywords.split(",").some(k => containsBotPhrase(text, k))
  );
  if (faq)
    return {
      text: interpolateBot(faq.answer, vars),
      handoff: false,
      reason: "Resposta rápida cadastrada.",
      delayMinutes: 0,
    };
  if (c.aiEnabled)
    return {
      text: null,
      handoff: false,
      useAi: true,
      reason: "Consulta à assistente com IA.",
      delayMinutes: 0,
    };
  return reply(
    "handoff",
    "Não existe resposta cadastrada para a pergunta.",
    true
  );
}
