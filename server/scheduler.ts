/**
 * scheduler.ts
 * Cron jobs automáticos para lembretes de aniversário, agendamentos e WhatsApp.
 * Iniciado pelo server/_core/index.ts após o servidor estar pronto.
 */

import { createHash } from "crypto";
import * as db from "./db";
import { notifyOwner } from "./_core/notification";
import { normalizeWhatsAppNumber } from "../shared/const";
import { buildPostSaleMessage } from "../shared/postSale";
import { sendAndLog } from "./messaging/service";

// ── Tipos ─────────────────────────────────────────────────────────────────────
interface WhatsAppSchedulerStatus {
  enabled: boolean;
  daysBefore: number;
  sendTime: string;
  resendEnabled: boolean;
  resendTime: string;
  lastRunPrimary: string | null;
  lastRunResend: string | null;
  nextRunPrimary: string | null;
  nextRunResend: string | null;
}

// ── Estado interno do scheduler ───────────────────────────────────────────────
const lastRun: Record<string, string> = {};

// Estado exportável para a UI
export const whatsAppSchedulerStatus: WhatsAppSchedulerStatus = {
  enabled: false,
  daysBefore: 1,
  sendTime: "09:00",
  resendEnabled: false,
  resendTime: "18:00",
  lastRunPrimary: null,
  lastRunResend: null,
  nextRunPrimary: null,
  nextRunResend: null,
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function todayStr() {
  return new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
}

/** Retorna "HH:MM" no horário local do servidor */
function currentTimeStr() {
  const now = new Date();
  const h = String(now.getHours()).padStart(2, "0");
  const m = String(now.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

/** Gera token de confirmação SHA-256 (16 hex chars) */
function generateConfirmToken(id: number, date: string): string {
  const secret = process.env.JWT_SECRET || "secret";
  return createHash("sha256")
    .update(`${id}:${date}:${secret}`)
    .digest("hex")
    .slice(0, 16);
}

/** Monta link WhatsApp com opções de confirmação */
function buildWhatsAppMessage(
  apt: { id: number; clientName: string | null; date: string; service: string; artist: string },
  baseUrl: string
): string {
  const token = generateConfirmToken(apt.id, apt.date);
  const confirmUrl = `${baseUrl}/confirmar?id=${apt.id}&token=${token}`;

  const date = new Date(apt.date);
  const dateStr = date.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "2-digit" });
  const timeStr = date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  return (
    `Olá ${apt.clientName || "cliente"}! 👋\n\n` +
    `Lembramos que você tem um agendamento:\n` +
    `📅 ${dateStr} às ${timeStr}\n` +
    `✏️ ${apt.service} com ${apt.artist}\n\n` +
    `Responda sobre seu horário de forma rápida:\n${confirmUrl}\n\n` +
    `Você poderá confirmar, avisar atraso, informar ausência ou solicitar reagendamento.`
  );
}

/** Monta URL base do servidor (usa VITE_APP_ID para identificar o domínio, ou fallback) */
function getBaseUrl(): string {
  // Em produção o servidor conhece seu próprio domínio pelo header Host
  // Como fallback usamos o domínio público do projeto
  return process.env.PUBLIC_URL || "https://tatuei.com";
}

// ── Lembrete WhatsApp Automático ──────────────────────────────────────────────
async function runWhatsAppReminders(logType: "whatsapp_primary" | "whatsapp_resend") {
  const key = `${logType}_${todayStr()}`;
  if (lastRun[key]) return; // já rodou hoje para este tipo

  try {
    const settings = await db.getStudioSettings();
    if (!settings?.enableAppointmentReminders) return;

    const daysBefore = settings.reminderDaysBefore ?? 1;
    const appointments = await db.getAppointmentsForWhatsAppReminder(daysBefore, logType);

    if (appointments.length === 0) {
      console.log(`[Scheduler] WhatsApp (${logType}): nenhum agendamento pendente.`);
      lastRun[key] = todayStr();
      return;
    }

    const baseUrl = getBaseUrl();
    let sent = 0;
    let failed = 0;

    for (const apt of appointments) {
      if (!apt.clientPhone) {
        // Sem telefone: registrar como falha e pular
        await db.logWhatsAppReminder({
          appointmentId: apt.id,
          clientId: apt.clientId,
          logType,
          message: "Cliente sem telefone cadastrado",
          status: "failed",
        });
        failed++;
        continue;
      }

      try {
        const message = buildWhatsAppMessage(apt, baseUrl);

        // Registrar como enviado (o link será aberto pelo dono do estúdio via notificação)
        await db.logWhatsAppReminder({
          appointmentId: apt.id,
          clientId: apt.clientId,
          logType,
          message,
          status: "sent",
        });

        sent++;
      } catch (err) {
        await db.logWhatsAppReminder({
          appointmentId: apt.id,
          clientId: apt.clientId,
          logType,
          message: `Erro: ${err}`,
          status: "failed",
        });
        failed++;
      }
    }

    // Notificar o dono do estúdio com resumo + links
    const aptsWithPhone = appointments.filter((a) => a.clientPhone);
    if (aptsWithPhone.length > 0) {
      const baseUrl = getBaseUrl();
      const lines = aptsWithPhone.map((apt) => {
        const token = generateConfirmToken(apt.id, apt.date);
        const timeStr = new Date(apt.date).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
        const withCountry = normalizeWhatsAppNumber(apt.clientPhone!);
        const confirmUrl = `${baseUrl}/confirmar?id=${apt.id}&token=${token}`;
        const msg = buildWhatsAppMessage(apt, baseUrl);
        const waLink = `https://wa.me/${withCountry}?text=${encodeURIComponent(msg)}`;
        return `• ${timeStr} — ${apt.clientName} | ${apt.service}\n  📱 ${waLink}`;
      });

      const title = `📱 ${aptsWithPhone.length} lembrete(s) WhatsApp para enviar`;
      const content =
        `Clique nos links abaixo para enviar os lembretes:\n\n${lines.join("\n\n")}`;

      await notifyOwner({ title, content });
    }

    console.log(`[Scheduler] WhatsApp (${logType}): enviados=${sent}, falhas=${failed}`);
    lastRun[key] = todayStr();

    // Atualizar status exportável
    if (logType === "whatsapp_primary") {
      whatsAppSchedulerStatus.lastRunPrimary = new Date().toISOString();
    } else {
      whatsAppSchedulerStatus.lastRunResend = new Date().toISOString();
    }
  } catch (err) {
    console.error(`[Scheduler] Erro no WhatsApp (${logType}):`, err);
  }
}

// ── Verificação horária de WhatsApp ──────────────────────────────────────────
async function checkWhatsAppSchedule() {
  try {
    const settings = await db.getStudioSettings();
    if (!settings?.enableAppointmentReminders) return;

    const now = currentTimeStr();
    const sendTime = settings.reminderSendTime || "09:00";
    const resendTime = settings.reminderResendTime || "18:00";
    const resendEnabled = settings.reminderResend === 1;

    // Atualizar status exportável
    whatsAppSchedulerStatus.enabled = true;
    whatsAppSchedulerStatus.daysBefore = settings.reminderDaysBefore ?? 1;
    whatsAppSchedulerStatus.sendTime = sendTime;
    whatsAppSchedulerStatus.resendEnabled = resendEnabled;
    whatsAppSchedulerStatus.resendTime = resendTime;

    // Calcular próximos envios
    const todayDate = todayStr();
    whatsAppSchedulerStatus.nextRunPrimary = `${todayDate} ${sendTime}`;
    if (resendEnabled) {
      whatsAppSchedulerStatus.nextRunResend = `${todayDate} ${resendTime}`;
    }

    // Verificar se é hora do envio primário (janela de 5 minutos)
    if (now >= sendTime && now <= addMinutes(sendTime, 5)) {
      await runWhatsAppReminders("whatsapp_primary");
    }

    // Verificar se é hora do reenvio
    if (resendEnabled && now >= resendTime && now <= addMinutes(resendTime, 5)) {
      await runWhatsAppReminders("whatsapp_resend");
    }
  } catch (err) {
    console.error("[Scheduler] Erro ao verificar horário WhatsApp:", err);
  }
}

/** Adiciona N minutos a um horário "HH:MM" e retorna "HH:MM" */
function addMinutes(time: string, minutes: number): string {
  const [h, m] = time.split(":").map(Number);
  const total = h * 60 + m + minutes;
  const newH = Math.floor(total / 60) % 24;
  const newM = total % 60;
  return `${String(newH).padStart(2, "0")}:${String(newM).padStart(2, "0")}`;
}

// ── Lembrete de Agendamentos (notifyOwner — mantido) ──────────────────────────
async function runAppointmentReminders() {
  const key = "appointment";
  const today = todayStr();
  if (lastRun[key] === today) return;

  try {
    const settings = await db.getStudioSettings();
    if (!settings?.enableAppointmentReminders) return;

    const result = await db.sendAppointmentReminders();
    console.log(`[Scheduler] Lembretes de agendamento: enviados=${result.sent}, falhas=${result.failed}`);
    lastRun[key] = today;
  } catch (err) {
    console.error("[Scheduler] Erro ao enviar lembretes de agendamento:", err);
  }
}

// ── Lembrete de Aniversários ──────────────────────────────────────────────────
async function runBirthdayReminders() {
  const key = "birthday";
  const today = todayStr();
  if (lastRun[key] === today) return;

  try {
    const settings = await db.getStudioSettings();
    if (!settings?.enableBirthdayReminders) return;

    const upcoming = await db.getUpcomingBirthdays(0);
    if (upcoming.length === 0) {
      lastRun[key] = today;
      return;
    }

    const names = upcoming.map((c) => c.name).join(", ");
    const title = `🎂 Aniversariante(s) hoje: ${upcoming.length}`;
    const content = `Parabéns para: ${names}\n\nAcesse o CRM para enviar uma mensagem especial!`;

    const success = await notifyOwner({ title, content });
    console.log(`[Scheduler] Lembrete de aniversário: ${success ? "enviado" : "falhou"} (${names})`);
    lastRun[key] = today;
  } catch (err) {
    console.error("[Scheduler] Erro ao enviar lembretes de aniversário:", err);
  }
}

// ── Lembretes Individuais por Agendamento ────────────────────────────────────────────────────────────────────────────────────────
async function runIndividualReminders() {
  try {
    const pending = await db.getPendingRemindersToSend();
    if (pending.length === 0) return;

    console.log(`[Scheduler] Lembretes individuais: ${pending.length} para disparar.`);
    const baseUrl = getBaseUrl();

    for (const reminder of pending) {
      try {
        if (!reminder.clientPhone) {
          // Sem telefone: marcar como falhou
          await db.markReminderFailed(reminder.id);
          console.warn(`[Scheduler] Lembrete #${reminder.id}: cliente sem telefone.`);
          continue;
        }

        // Substituir variáveis na mensagem
        const token = generateConfirmToken(reminder.appointmentId, reminder.appointmentDate);
        const confirmUrl = `${baseUrl}/confirmar?id=${reminder.appointmentId}&token=${token}`;
        const dateObj = new Date(reminder.appointmentDate);
        const dateStr = dateObj.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "2-digit" });
        const timeStr = dateObj.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

        const message = reminder.message
          .replace(/\{nome\}/g, reminder.clientName || "cliente")
          .replace(/\{data\}/g, dateStr)
          .replace(/\{horário\}/g, timeStr)
          .replace(/\{serviço\}/g, reminder.service)
          .replace(/\{artista\}/g, reminder.artist)
          + `\n\nResponda sobre seu horário de forma rápida: ${confirmUrl}`;

        // Montar link WhatsApp
        const withCountry = normalizeWhatsAppNumber(reminder.clientPhone);
        const waLink = `https://wa.me/${withCountry}?text=${encodeURIComponent(message)}`;

        // Marcar como enviado
        await db.markReminderSent(reminder.id);

        // Notificar o dono do estúdio com o link para clicar
        await notifyOwner({
          title: `📱 Lembrete para ${reminder.clientName || "cliente"} — ${timeStr}`,
          content: `Clique para enviar o lembrete WhatsApp:\n\n${waLink}\n\nMensagem:\n${message}`,
        });

        console.log(`[Scheduler] Lembrete #${reminder.id} disparado para ${reminder.clientName}.`);
      } catch (err) {
        await db.markReminderFailed(reminder.id);
        console.error(`[Scheduler] Erro no lembrete #${reminder.id}:`, err);
      }
    }
  } catch (err) {
    console.error("[Scheduler] Erro ao processar lembretes individuais:", err);
  }
}

// ── Pós-venda automático ────────────────────────────────────────────────────
async function runPostSaleFollowups() {
  try {
    const followups = await db.listDueAutomaticPostSaleFollowups();
    for (const followup of followups) {
      if (!followup.clientPhone) {
        await db.updatePostSaleFollowup(followup.id, { status: "failed", lastError: "Cliente sem WhatsApp cadastrado" });
        continue;
      }
      const message = followup.message || buildPostSaleMessage({
        stage: followup.stage,
        clientName: followup.clientName,
        artistName: followup.artistName,
        service: followup.service,
      });
      const result = await sendAndLog({
        recipientPhone: followup.clientPhone,
        recipientName: followup.clientName || undefined,
        recipientType: "client",
        message,
        trigger: `post_sale_${followup.stage}`,
        appointmentId: followup.appointmentId,
        clientId: followup.clientId,
      });
      await db.updatePostSaleFollowup(followup.id, result.success ? {
        status: "sent", sentAt: db.toDateStr(new Date()), lastError: null,
      } : {
        status: "failed", lastError: result.error || "Falha no envio automático",
      });
    }
  } catch (error) {
    console.error("[Scheduler] Erro no pós-venda automático:", error);
  }
}

// ── Inicialização ────────────────────────────────────────────────────────────────────────────────────────
export function startScheduler() {
  console.log("[Scheduler] Iniciando cron jobs de notificações...");

  // Executar imediatamente na inicialização (com delay de 10s para o servidor estar pronto)
  setTimeout(() => {
    runAppointmentReminders();
    runBirthdayReminders();
    checkWhatsAppSchedule();
    runIndividualReminders();
    db.backfillPostSaleFollowups()
      .then(runPostSaleFollowups)
      .catch((error) => console.error("[Scheduler] Erro ao preparar pós-venda:", error));
  }, 10_000);

  // Verificar WhatsApp a cada 5 minutos
  setInterval(checkWhatsAppSchedule, 5 * 60 * 1000);

  // Verificar lembretes individuais a cada minuto
  setInterval(runIndividualReminders, 60 * 1000);

  // Verificar aniversários e lembretes gerais a cada hora
  setInterval(runAppointmentReminders, 60 * 60 * 1000);
  setInterval(runBirthdayReminders, 60 * 60 * 1000);
  setInterval(runPostSaleFollowups, 15 * 60 * 1000);

  console.log("[Scheduler] Cron jobs registrados: WhatsApp (5min), pós-venda (15min), lembretes individuais (1min), lembretes (1h), aniversários (1h)");
}
