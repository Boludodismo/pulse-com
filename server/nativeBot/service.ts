import { randomBytes } from "node:crypto";
import {
  botConfigSchema,
  botVariables,
  interpolateBot,
  normalizeBotText,
  type BotConfig,
  type BotRule,
} from "../../shared/nativeBot";
import {
  botPool,
  rows,
  exec,
  utcSql,
  botAudit,
  type BotConnection,
} from "./database";
import { settings, getProfile, type BotSettings } from "./access";
import { decideBot, type BotDecision } from "./engine";
import { askBotAi, BotProviderError, safeBotError, zapi } from "./providers";
import { normalizeBrazilianPhone } from "../messaging/phone";
import {
  issueAppointmentActionLinks,
  formatAppointmentActionLinks,
} from "../appointmentActions";
export function nativeBotPhone(value: string) {
  if (!/^[+\d\s().-]{8,25}$/.test(value)) throw new Error("Telefone inválido.");
  const phone = normalizeBrazilianPhone(value).replace(/^\+/, "");
  if (!/^\d{10,15}$/.test(phone)) throw new Error("Telefone inválido.");
  return phone;
}
export async function ensureBotConversation(
  studioId: number,
  client: {
    id?: number;
    name: string;
    phone: string;
    artistId?: number | null;
  },
  c: BotConnection = botPool()
) {
  const phone = nativeBotPhone(client.phone);
  await exec(
    "INSERT IGNORE INTO tatuei_bot_conversations(studio_id,artist_id,client_id,phone,name) VALUES(?,?,?,?,?)",
    [
      studioId,
      client.artistId || 0,
      client.id || null,
      phone,
      client.name.slice(0, 255),
    ],
    c
  );
  return (
    await rows(
      "SELECT * FROM tatuei_bot_conversations WHERE studio_id=? AND phone=?",
      [studioId, phone],
      c
    )
  )[0];
}
export async function queueBotMessage(
  cv: any,
  body: string,
  opts: {
    role?: "bot" | "staff";
    eventKey: string;
    origin?: string;
    delayMinutes?: number;
    profileVersion?: number;
    ruleEvent?: string;
    after?: string;
    appointment?: { id: number; date: string };
  },
  c: BotConnection = botPool()
) {
  if (!body.trim()) return null;
  const result = await exec(
    `INSERT IGNORE INTO tatuei_bot_messages(studio_id,conversation_id,role,body,status,event_key,origin,expected_revision,profile_version,rule_event,after_mode,due_at,appointment_id,appointment_date) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      cv.studio_id,
      cv.id,
      opts.role || "bot",
      body.slice(0, 8000),
      "queued",
      opts.eventKey,
      opts.origin || "reply",
      cv.revision,
      opts.profileVersion ?? null,
      opts.ruleEvent ?? null,
      opts.after || "bot",
      utcSql(new Date(Date.now() + (opts.delayMinutes || 0) * 60000)),
      opts.appointment?.id ?? null,
      opts.appointment?.date ?? null,
    ],
    c
  );
  return result.insertId || null;
}
export async function cancelBotQueue(cv: any, c: BotConnection = botPool()) {
  await exec(
    "UPDATE tatuei_bot_messages SET status='canceled',error='Atendimento ou configuração alterados.' WHERE studio_id=? AND conversation_id=? AND role='bot' AND status='queued'",
    [cv.studio_id, cv.id],
    c
  );
}
export async function botThreadMode(
  cv: any,
  mode: "bot" | "human",
  c: BotConnection = botPool()
) {
  await exec(
    "UPDATE tatuei_bot_conversations SET mode=?,revision=revision+1 WHERE id=? AND studio_id=?",
    [mode, cv.id, cv.studio_id],
    c
  );
  await cancelBotQueue(cv, c);
  return { ...cv, mode, revision: cv.revision + 1 };
}
export async function contextForConversation(
  cv: any,
  c: BotConnection = botPool()
) {
  const [studio] = await rows(
    "SELECT name FROM studios WHERE id=? AND isActive=1",
    [cv.studio_id],
    c
  );
  if (!studio) return null;
  const profile = await getProfile(cv.studio_id, cv.artist_id, c);
  let artistName = "nossa equipe";
  if (cv.artist_id) {
    const [a] = await rows(
      "SELECT name FROM artists WHERE id=? AND studioId=? AND active=1",
      [cv.artist_id, cv.studio_id],
      c
    );
    if (!a || !profile.enabled) return null;
    artistName = a.name;
  }
  if (cv.client_id) {
    const [cl] = await rows(
      "SELECT artistId FROM clients WHERE id=? AND studioId=? AND isArchived=0",
      [cv.client_id, cv.studio_id],
      c
    );
    if (!cl || Number(cl.artistId || 0) !== cv.artist_id) return null;
  }
  return {
    profile,
    vars: botVariables({
      clientName: cv.name,
      studioName: studio.name,
      artistName,
    }),
  };
}
export async function resolveBotReply(
  s: BotSettings,
  config: BotConfig,
  text: string,
  vars: Record<string, string>,
  opts: {
    outside?: boolean;
    event?: BotRule["event"];
    human?: boolean;
    useAi?: boolean;
    history?: { role: string; body: string }[];
  } = {},
  c: BotConnection = botPool()
): Promise<BotDecision> {
  const result = decideBot(config, text, vars, opts);
  if (!result.useAi) return result;
  if (!opts.useAi)
    return {
      text: interpolateBot(config.messages.handoff, vars),
      handoff: true,
      reason:
        "IA não consultada neste teste. A pergunta seria encaminhada para a equipe.",
      delayMinutes: 0,
    };
  try {
    const answer = await askBotAi(s, config, opts.history || [], text, vars, c);
    return {
      ...result,
      ...answer,
      useAi: false,
      reason: "Resposta da IA com a base deste atendimento.",
    };
  } catch (e) {
    return {
      text: interpolateBot(config.messages.handoff, vars),
      handoff: true,
      reason: safeBotError(e),
      delayMinutes: 0,
    };
  }
}
export async function processBotInbound(message: any, c: BotConnection) {
  let [cv] = await rows(
    "SELECT * FROM tatuei_bot_conversations WHERE id=? AND studio_id=?",
    [message.conversation_id, message.studio_id],
    c
  );
  if (!cv) return;
  const n = normalizeBotText(message.body);
  if (
    [
      "parar",
      "sair",
      "parar mensagens",
      "cancelar mensagens",
      "nao quero receber mensagens",
    ].includes(n)
  ) {
    await exec(
      "UPDATE tatuei_bot_conversations SET opted_out=1,mode='human',revision=revision+1 WHERE id=?",
      [cv.id],
      c
    );
    if (cv.client_id)
      await exec(
        "UPDATE tatuei_bot_consents SET enabled=0 WHERE studio_id=? AND client_id=?",
        [cv.studio_id, cv.client_id],
        c
      );
    await cancelBotQueue(cv, c);
    await botAudit(
      cv.studio_id,
      cv.artist_id,
      "Cliente interrompeu as mensagens",
      cv.name,
      null,
      c
    );
    return;
  }
  const resumed = cv.opted_out && n === "retomar atendimento";
  if (resumed) {
    await exec(
      "UPDATE tatuei_bot_conversations SET opted_out=0 WHERE id=? AND studio_id=?",
      [cv.id, cv.studio_id],
      c
    );
    cv = await botThreadMode({ ...cv, opted_out: 0 }, "bot", c);
    await botAudit(
      cv.studio_id,
      cv.artist_id,
      "Cliente retomou o atendimento",
      cv.name,
      null,
      c
    );
  }
  const s = await settings(cv.studio_id, c);
  if (!s.enabled || cv.mode === "human" || cv.opted_out) return;
  const ctx = await contextForConversation(cv, c);
  if (!ctx) {
    await botThreadMode(cv, "human", c);
    await botAudit(
      cv.studio_id,
      cv.artist_id,
      "Conversa precisa de revisão",
      "Vínculo do cliente ou acesso do artista mudou.",
      null,
      c
    );
    return;
  }
  const [recent] = await rows<{ total: number }>(
    "SELECT COUNT(*) total FROM tatuei_bot_messages WHERE conversation_id=? AND role='client' AND created_at>UTC_TIMESTAMP()-INTERVAL 1 MINUTE",
    [cv.id],
    c
  );
  if (recent.total > 15) {
    await botThreadMode(cv, "human", c);
    await botAudit(
      cv.studio_id,
      cv.artist_id,
      "Limite de mensagens por minuto",
      cv.name,
      null,
      c
    );
    return;
  }
  const history = await rows<{ role: string; body: string }>(
    "SELECT role,body FROM tatuei_bot_messages WHERE conversation_id=? AND studio_id=? AND id<? ORDER BY id DESC LIMIT 8",
    [cv.id, cv.studio_id, message.id],
    c
  );
  const result =
    message.origin === "media"
      ? {
          text: interpolateBot(ctx.profile.config.messages.handoff, ctx.vars),
          handoff: true,
          reason: "Mídia recebida; equipe precisa avaliar o conteúdo.",
          delayMinutes: 0,
        }
      : await resolveBotReply(
          s,
          ctx.profile.config,
          resumed ? "oi" : message.body,
          ctx.vars,
          { useAi: true, history: history.reverse() },
          c
        );
  // Recheck after the AI call, because the manager may have disabled the module in the meantime.
  const latest = await settings(cv.studio_id, c);
  if (!latest.enabled) return;
  const [current] = await rows(
    "SELECT revision,mode,opted_out FROM tatuei_bot_conversations WHERE id=?",
    [cv.id],
    c
  );
  if (
    current.revision !== cv.revision ||
    current.mode !== "bot" ||
    current.opted_out
  )
    return;
  const next = result.handoff ? await botThreadMode(cv, "human", c) : cv;
  if (result.text)
    await queueBotMessage(
      next,
      result.text,
      {
        eventKey: "reply:" + message.id,
        delayMinutes: result.delayMinutes,
        profileVersion: ctx.profile.version,
        ruleEvent: result.rule?.event,
        after: result.handoff ? "human" : "bot",
      },
      c
    );
  if (result.handoff) {
    await exec(
      "UPDATE tatuei_bot_conversations SET mode='human' WHERE id=?",
      [cv.id],
      c
    );
    await botAudit(
      cv.studio_id,
      cv.artist_id,
      "Atendimento encaminhado",
      `${cv.name} · ${result.reason}`,
      null,
      c
    );
  }
}
export async function validateBotDelivery(
  m: any,
  cv: any,
  s: BotSettings,
  c: BotConnection
) {
  if (
    !s.enabled ||
    !s.wa_secret ||
    s.wa_status !== "connected" ||
    !s.webhook_ready
  )
    return "Bot pausado ou WhatsApp não conectado.";
  if (cv.opted_out) return "Cliente interrompeu as mensagens.";
  if (m.expected_revision !== cv.revision)
    return "O responsável ou modo de atendimento mudou.";
  const ctx = await contextForConversation(cv, c);
  if (!ctx) return "O acesso do artista ou cadastro mudou.";
  if (m.role === "bot") {
    if (m.profile_version !== null && ctx.profile.version !== m.profile_version)
      return "As configurações foram alteradas após o agendamento.";
    if (
      m.rule_event &&
      !ctx.profile.config.rules.some(r => r.event === m.rule_event && r.enabled)
    )
      return "Automação desativada.";
  }
  if (m.origin === "scheduled") {
    const [consent] = await rows(
      "SELECT enabled FROM tatuei_bot_consents WHERE studio_id=? AND client_id=?",
      [cv.studio_id, cv.client_id],
      c
    );
    if (!consent?.enabled) return "Cliente sem autorização para automações.";
    if (m.appointment_id) {
      const [a] = await rows(
        "SELECT date,status,clientId,artistId FROM appointments WHERE id=? AND studioId=?",
        [m.appointment_id, cv.studio_id],
        c
      );
      if (
        !a ||
        a.clientId !== cv.client_id ||
        Number(a.artistId || 0) !== cv.artist_id ||
        String(a.date) !== String(m.appointment_date) ||
        (["reminder"].includes(m.rule_event)
          ? !["agendado", "confirmado"].includes(a.status)
          : a.status !== "concluido")
      )
        return "A sessão foi alterada ou cancelada.";
      if (
        m.rule_event === "reminder" &&
        new Date(String(a.date).replace(" ", "T") + "-03:00") <= new Date()
      )
        return "Horário da sessão já passou.";
    }
  }
  return null;
}
export async function deliverBotMessage(m: any, c: BotConnection) {
  const [cv] = await rows(
    "SELECT * FROM tatuei_bot_conversations WHERE id=? AND studio_id=?",
    [m.conversation_id, m.studio_id],
    c
  );
  if (!cv) return;
  const s = await settings(m.studio_id, c);
  const reason = await validateBotDelivery(m, cv, s, c);
  if (reason) {
    await exec(
      "UPDATE tatuei_bot_messages SET status='canceled',error=? WHERE id=? AND status='queued'",
      [reason, m.id],
      c
    );
    return;
  }
  const claim = await exec(
    "UPDATE tatuei_bot_messages SET status='sending' WHERE id=? AND status='queued'",
    [m.id],
    c
  );
  if (claim.affectedRows !== 1) return;
  try {
    const response = await zapi(s, "send-text", "POST", {
      phone: cv.phone,
      message: m.body,
    });
    const id = response?.messageId || response?.zaapId;
    if (typeof id !== "string" || !id)
      throw new BotProviderError(
        "O provedor não confirmou o identificador da mensagem.",
        true
      );
    await exec(
      "UPDATE tatuei_bot_messages SET status='sent',external_id=?,error=NULL WHERE id=?",
      [id.slice(0, 160), m.id],
      c
    );
    if (m.after_mode === "human" && cv.mode !== "human")
      await botThreadMode(cv, "human", c);
    await botAudit(
      cv.studio_id,
      cv.artist_id,
      m.role === "staff"
        ? "Equipe enviou uma mensagem"
        : "Bot enviou uma mensagem",
      cv.name,
      null,
      c
    );
  } catch (e) {
    const uncertain = e instanceof BotProviderError ? e.uncertain : true;
    await exec(
      "UPDATE tatuei_bot_messages SET status=?,error=? WHERE id=?",
      [uncertain ? "uncertain" : "failed", safeBotError(e), m.id],
      c
    );
    await botAudit(
      cv.studio_id,
      cv.artist_id,
      uncertain ? "Envio sem confirmação" : "Falha no envio",
      cv.name,
      null,
      c
    );
  }
}
export async function queueScheduledBot(
  cv: any,
  profile: Awaited<ReturnType<typeof getProfile>>,
  rule: BotRule,
  eventKey: string,
  date?: string,
  appointment?: { id: number; date: string },
  c: BotConnection = botPool()
) {
  if (cv.mode !== "bot" || cv.opted_out) return;
  const ctx = await contextForConversation(cv, c);
  if (!ctx) return;
  const vars = {
    ...ctx.vars,
    ...(date
      ? {
          data: date.slice(0, 10).split("-").reverse().join("/"),
          hora: date.slice(11, 16),
        }
      : {}),
  };
  const r = decideBot(profile.config, "", vars, { event: rule.event });
  if (!r.text) return;
  if (
    (
      await rows(
        "SELECT id FROM tatuei_bot_messages WHERE studio_id=? AND event_key=?",
        [cv.studio_id, eventKey],
        c
      )
    ).length
  )
    return;
  let body = r.text;
  if (rule.event === "reminder" && appointment) {
    const links = await issueAppointmentActionLinks({
      studioId: cv.studio_id,
      appointmentId: appointment.id,
    });
    body += "\n\n" + formatAppointmentActionLinks(links);
  }
  await queueBotMessage(
    cv,
    body,
    {
      eventKey,
      origin: "scheduled",
      profileVersion: profile.version,
      ruleEvent: rule.event,
      delayMinutes: r.delayMinutes,
      after: r.handoff ? "human" : "bot",
      appointment,
    },
    c
  );
}
