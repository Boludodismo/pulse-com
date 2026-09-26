import { botClock } from "../../shared/nativeBot";
import {
  rows,
  exec,
  withBotLock,
  botAudit,
  isNativeBotReady,
  type BotConnection,
} from "./database";
import { getProfile, type BotSettings } from "./access";
import {
  deliverBotMessage,
  processBotInbound,
  ensureBotConversation,
  queueScheduledBot,
} from "./service";
import { isOutboundMessagingBlocked } from "../messaging/outboundSafety";
let running = false,
  lastSweep = 0;
export function offsetBotDate(date: string, days: number) {
  return new Date(Date.parse(date + "T12:00:00Z") + days * 86400000)
    .toISOString()
    .slice(0, 10);
}
export async function scheduleNativeBot(c: BotConnection) {
  const clock = botClock();
  const studios = await rows<BotSettings>(
    "SELECT b.* FROM tatuei_bot_settings b JOIN studios s ON s.id=b.studio_id AND s.isActive=1 WHERE b.enabled=1 AND b.wa_status='connected' AND b.webhook_ready=1 AND b.wa_secret IS NOT NULL",
    [],
    c
  );
  for (const s of studios) {
    const profiles = await rows(
      "SELECT artist_id FROM tatuei_bot_profiles WHERE studio_id=? AND (artist_id=0 OR enabled=1)",
      [s.studio_id],
      c
    );
    for (const owner of profiles) {
      const profile = await getProfile(s.studio_id, owner.artist_id, c);
      for (const rule of profile.config.rules.filter(
        r => r.enabled && r.event !== "greeting" && clock.time >= r.sendTime
      )) {
        if (rule.event === "birthday") {
          const people = await rows(
            `SELECT cl.id,cl.name,cl.phone,cl.artistId FROM clients cl JOIN tatuei_bot_consents consent ON consent.studio_id=cl.studioId AND consent.client_id=cl.id AND consent.enabled=1 WHERE cl.studioId=? AND COALESCE(cl.artistId,0)=? AND cl.isArchived=0 AND DATE_FORMAT(cl.birthDate,'%m-%d')=? LIMIT 1000`,
            [s.studio_id, owner.artist_id, clock.date.slice(5)],
            c
          );
          for (const cl of people) {
            try {
              const cv = await ensureBotConversation(
                s.studio_id,
                {
                  id: cl.id,
                  name: cl.name,
                  phone: cl.phone,
                  artistId: cl.artistId,
                },
                c
              );
              if (cv.client_id !== cl.id || cv.artist_id !== owner.artist_id)
                continue;
              await queueScheduledBot(
                cv,
                profile,
                rule,
                `birthday:${clock.date}:${cl.id}`,
                undefined,
                undefined,
                c
              );
            } catch {
              await botAudit(
                s.studio_id,
                owner.artist_id,
                "Automação não agendada",
                `Cliente ${cl.id}: confira o telefone e o cadastro.`,
                null,
                c
              );
            }
          }
        } else {
          const target = offsetBotDate(
            clock.date,
            rule.event === "reminder" ? rule.days : -rule.days
          );
          const appointments = await rows(
            `SELECT a.id,a.date,a.clientId,a.artistId,cl.name,cl.phone FROM appointments a JOIN clients cl ON cl.id=a.clientId AND cl.studioId=a.studioId AND cl.isArchived=0 JOIN tatuei_bot_consents consent ON consent.studio_id=cl.studioId AND consent.client_id=cl.id AND consent.enabled=1 WHERE a.studioId=? AND COALESCE(a.artistId,0)=? AND COALESCE(cl.artistId,0)=COALESCE(a.artistId,0) AND a.date>=? AND a.date<? AND a.status IN (${rule.event === "reminder" ? "'agendado','confirmado'" : "'concluido'"}) LIMIT 1000`,
            [
              s.studio_id,
              owner.artist_id,
              target + " 00:00:00",
              offsetBotDate(target, 1) + " 00:00:00",
            ],
            c
          );
          for (const a of appointments) {
            if (
              rule.event === "reminder" &&
              new Date(a.date.replace(" ", "T") + "-03:00") <= new Date()
            )
              continue;
            try {
              const cv = await ensureBotConversation(
                s.studio_id,
                {
                  id: a.clientId,
                  name: a.name,
                  phone: a.phone,
                  artistId: a.artistId,
                },
                c
              );
              if (
                cv.client_id !== a.clientId ||
                cv.artist_id !== owner.artist_id
              )
                continue;
              await queueScheduledBot(
                cv,
                profile,
                rule,
                `${rule.event}:${a.id}:${a.date}`,
                a.date,
                { id: a.id, date: a.date },
                c
              );
            } catch {
              await botAudit(
                s.studio_id,
                owner.artist_id,
                "Automação não agendada",
                `Sessão ${a.id}: confira telefone e vínculo do artista.`,
                null,
                c
              );
            }
          }
        }
      }
    }
  }
}
export async function runNativeBotCycle() {
  if (running || !isNativeBotReady() || isOutboundMessagingBlocked()) return;
  running = true;
  try {
    // Crashed in-flight requests are never resent automatically: delivery may have happened.
    await exec(
      "UPDATE tatuei_bot_messages SET status='uncertain',error='Processamento interrompido; verifique a conversa antes de reenviar.' WHERE status IN ('sending','processing') AND updated_at<UTC_TIMESTAMP()-INTERVAL 5 MINUTE"
    );
    const inbound = await rows(
      "SELECT m.* FROM tatuei_bot_messages m WHERE m.role='client' AND m.status='received' AND NOT EXISTS(SELECT 1 FROM tatuei_bot_messages older WHERE older.conversation_id=m.conversation_id AND older.id<m.id AND older.status IN ('received','processing')) ORDER BY m.id LIMIT 30"
    );
    for (const m of inbound)
      await withBotLock(
        "tatuei_bot_thread_" + m.conversation_id,
        async c => {
          const claim = await exec(
            "UPDATE tatuei_bot_messages SET status='processing' WHERE id=? AND status='received'",
            [m.id],
            c
          );
          if (claim.affectedRows !== 1) return;
          try {
            await processBotInbound(m, c);
            await exec(
              "UPDATE tatuei_bot_messages SET status='processed' WHERE id=?",
              [m.id],
              c
            );
          } catch {
            await exec(
              "UPDATE tatuei_bot_messages SET status='failed',error='Falha no atendimento. A equipe deve revisar esta conversa.' WHERE id=?",
              [m.id],
              c
            );
            await exec(
              "UPDATE tatuei_bot_conversations SET mode='human',revision=revision+1 WHERE id=?",
              [m.conversation_id],
              c
            );
          }
        },
        0
      );
    if (Date.now() - lastSweep > 60000) {
      lastSweep = Date.now();
      await withBotLock("tatuei_bot_schedule", scheduleNativeBot, 0);
    }
    const outgoing = await rows(
      "SELECT * FROM tatuei_bot_messages WHERE status='queued' AND due_at<=UTC_TIMESTAMP() ORDER BY id LIMIT 30"
    );
    for (const m of outgoing)
      await withBotLock(
        "tatuei_bot_thread_" + m.conversation_id,
        c => deliverBotMessage(m, c),
        0
      );
  } catch {
    console.error(
      "[Bot Tatuei] Background cycle failed; pending messages remain recorded."
    );
  } finally {
    running = false;
  }
}
export function startNativeBotWorker() {
  const t = setInterval(() => void runNativeBotCycle(), 8000);
  t.unref();
  console.log(
    "[Bot Tatuei] Native worker ready; disabled studios do not send."
  );
  return () => clearInterval(t);
}
