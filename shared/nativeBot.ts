import { z } from "zod";
export const BOT_EVENTS = [
  "greeting",
  "reminder",
  "followup",
  "birthday",
] as const;
export const BOT_MESSAGES = [
  "greeting",
  "away",
  "handoff",
  "reminder",
  "followup",
  "birthday",
] as const;
export const BOT_EVENT_LABELS = {
  greeting: "Boas-vindas",
  reminder: "Lembrete de sessão",
  followup: "Pós-atendimento",
  birthday: "Aniversário",
};
export const BOT_MESSAGE_LABELS = {
  ...BOT_EVENT_LABELS,
  away: "Fora do horário",
  handoff: "Passagem para a equipe",
};
export const botPermissionsSchema = z.object({
  assistant: z.boolean(),
  messages: z.boolean(),
  rules: z.boolean(),
  clients: z.boolean(),
});
export type BotPermissions = z.infer<typeof botPermissionsSchema>;
export const botRuleSchema = z.object({
  event: z.enum(BOT_EVENTS),
  enabled: z.boolean(),
  delayMinutes: z.number().int().min(0).max(1440),
  days: z.number().int().min(0).max(365),
  sendTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  condition: z.enum(["always", "outside"]),
  message: z.enum(BOT_MESSAGES),
  after: z.enum(["bot", "human"]),
});
export const botConfigSchema = z
  .object({
    name: z.string().trim().min(1).max(60),
    tone: z.string().trim().max(100),
    address: z.string().trim().max(500),
    instructions: z.string().trim().max(6000),
    knowledge: z.string().trim().max(12000),
    aiEnabled: z.boolean(),
    timezone: z.literal("America/Sao_Paulo"),
    days: z.array(z.number().int().min(0).max(6)).min(1).max(7),
    opens: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    closes: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    faqs: z
      .array(
        z.object({
          keywords: z.string().trim().min(1).max(200),
          answer: z.string().trim().min(1).max(2000),
        })
      )
      .max(40),
    messages: z.object(
      Object.fromEntries(
        BOT_MESSAGES.map(key => [key, z.string().trim().min(1).max(3000)])
      ) as Record<(typeof BOT_MESSAGES)[number], z.ZodString>
    ),
    rules: z
      .array(botRuleSchema)
      .max(4)
      .refine(
        r => new Set(r.map(x => x.event)).size === r.length,
        "Use somente uma regra por evento."
      ),
  })
  .refine(
    c => c.opens < c.closes,
    "O fechamento deve ser depois da abertura no mesmo dia."
  );
export type BotConfig = z.infer<typeof botConfigSchema>;
export type BotRule = z.infer<typeof botRuleSchema>;
export function defaultBotConfig(name = "Assistente Tatuei"): BotConfig {
  return {
    name,
    tone: "Acolhedor e direto",
    address: "",
    instructions:
      "Atenda com cordialidade. Use somente as informações cadastradas e encaminhe dúvidas para a equipe.",
    knowledge: "",
    aiEnabled: false,
    timezone: "America/Sao_Paulo",
    days: [1, 2, 3, 4, 5, 6],
    opens: "10:00",
    closes: "19:00",
    faqs: [],
    messages: {
      greeting:
        "Olá, {primeiro_nome}! Sou a assistente de {artista}, no {estudio}. Como posso ajudar?",
      away: "Olá, {primeiro_nome}! Estamos fora do horário. Sua mensagem ficou registrada para a equipe continuar o atendimento.",
      handoff:
        "{primeiro_nome}, vou encaminhar sua mensagem para a equipe de {artista}. Vamos continuar o atendimento por aqui.",
      reminder:
        "Olá, {primeiro_nome}! Sua sessão com {artista} está marcada para {data}, às {hora}, no {estudio}. Confirme sua presença pelo link abaixo.",
      followup:
        "Olá, {primeiro_nome}! Como você está após sua sessão com {artista}? Se tiver dúvidas, responda por aqui para falar com a equipe.",
      birthday:
        "Feliz aniversário, {primeiro_nome}! A equipe do {estudio} deseja um dia especial para você!",
    },
    rules: BOT_EVENTS.map(event => ({
      event,
      enabled: event === "greeting",
      delayMinutes: 0,
      days: event === "reminder" ? 1 : event === "followup" ? 7 : 0,
      sendTime: "09:00",
      condition: "always",
      message: event,
      after: event === "followup" ? "human" : "bot",
    })),
  };
}
export const DEFAULT_BOT_PERMISSIONS: BotPermissions = {
  assistant: true,
  messages: true,
  rules: true,
  clients: true,
};
export function interpolateBot(text: string, vars: Record<string, string>) {
  return text.replace(/\{([a-z_]+)\}/g, (all, key) => vars[key] ?? all);
}
export const normalizeBotText = (v: string) =>
  v
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
export function containsBotPhrase(text: string, phrase: string) {
  const p = normalizeBotText(phrase);
  return !!p && (" " + normalizeBotText(text) + " ").includes(" " + p + " ");
}
export function botClock(now = new Date()) {
  const values = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    weekday: "short",
  }).formatToParts(now);
  const p = Object.fromEntries(values.map(v => [v.type, v.value]));
  return {
    date: `${p.year}-${p.month}-${p.day}`,
    time: `${p.hour}:${p.minute}`,
    day: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(p.weekday),
  };
}
export function outsideBotHours(c: BotConfig, now = new Date()) {
  const clock = botClock(now);
  return (
    !c.days.includes(clock.day) ||
    clock.time < c.opens ||
    clock.time >= c.closes
  );
}
export function botVariables(input: {
  clientName: string;
  artistName: string;
  studioName: string;
  date?: string | null;
}) {
  const d = input.date?.replace("T", " ");
  return {
    primeiro_nome: input.clientName.trim().split(/\s+/)[0] || "Olá",
    artista: input.artistName,
    estudio: input.studioName,
    data: d ? d.slice(0, 10).split("-").reverse().join("/") : "a combinar",
    hora: d?.slice(11, 16) || "a combinar",
  };
}
export function botRoleIsManager(role: string) {
  return role === "admin" || role === "superadmin";
}
