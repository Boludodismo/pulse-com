import { careRules } from "../../drizzle/customerCareSchema";
import { and, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { getDb } from "../db";
import { appointments, artists, clients, integrationContacts, integrationJobs, messageAutomationSettings, appointmentReminders, studios, whatsappIntegrations } from "../../drizzle/schema";
import { hashIntegrationPayload } from "./crypto";
import { dispatchTemplateMessage, sendAndLog } from "./service";
import { interpolateTemplate } from "./provider";
import { formatAppointmentActionLinks, issueAppointmentActionLinks } from "../appointmentActions";
import { firstName, formatStudioAddress, useFirstNameInGreeting } from "./messagePresentation";
import { appointmentInstant } from "../../shared/appointmentTime";
import { zonedSqlDateTime } from "../../shared/studioClock";
export { zonedSqlDateTime } from "../../shared/studioClock";

const FALLBACK_BIRTHDAY_TEMPLATE = "Bom dia, {nome_cliente}! 🎉 Feliz aniversário! Desejamos muita alegria e um novo ciclo cheio de boas histórias. Um abraço da equipe {nome_estudio}!";

export function automaticReminderIdempotencyKey(kind: "appointment" | "birthday" | "individual" | "one_hour_client" | "one_hour_artist", integrationId: number, sourceId: number, occurrence: string) {
  return hashIntegrationPayload(`automatic:${kind}:${integrationId}:${sourceId}:${occurrence}`);
}

/** Janela de dois minutos que tolera a execução do Heartbeat sem antecipar o aviso de uma hora. */
export function oneHourReminderWindow(date: string, time: string) {
  const addMinutes = (minutes: number) => {
    const [year, month, day] = date.split("-").map(Number);
    const [hour, minute] = time.split(":").map(Number);
    const local = new Date(Date.UTC(year, month - 1, day, hour, minute + minutes));
    const yyyy = String(local.getUTCFullYear());
    const mm = String(local.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(local.getUTCDate()).padStart(2, "0");
    const hh = String(local.getUTCHours()).padStart(2, "0");
    const min = String(local.getUTCMinutes()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd} ${hh}:${min}:00`;
  };
  return { startsAt: addMinutes(59), endsAt: addMinutes(61) };
}

export function isWithinRecentReminderWindow(scheduledAt: Date | string, now = new Date(), windowHours = 24) {
  const scheduled = new Date(scheduledAt);
  const earliest = new Date(now.getTime() - windowHours * 60 * 60 * 1000);
  return scheduled <= now && scheduled >= earliest;
}

function zonedNow(timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date());
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "00";
  return { date: `${get("year")}-${get("month")}-${get("day")}`, time: `${get("hour")}:${get("minute")}` };
}

function addDays(date: string, days: number) {
  const [year, month, day] = date.split("-").map(Number);
  const result = new Date(Date.UTC(year, month - 1, day + days));
  return result.toISOString().slice(0, 10);
}

function dateAndTime(value: string) {
  const parsed = appointmentInstant(value);
  return {
    date: parsed.toLocaleDateString("pt-BR", {timeZone:'UTC'}),
    time: parsed.toLocaleTimeString("pt-BR", { timeZone:'UTC', hour: "2-digit", minute: "2-digit" }),
  };
}

async function hasActiveConsent(studioId: number, integrationId: number, clientId: number) {
  const db = await getDb();
  if (!db) return false;
  const consent = (await db.select({ id: integrationContacts.id }).from(integrationContacts).where(and(
    eq(integrationContacts.studioId, studioId),
    eq(integrationContacts.integrationId, integrationId),
    eq(integrationContacts.clientId, clientId),
    eq(integrationContacts.hasWhatsappOptIn, 1),
    sql`${integrationContacts.optedOutAt} IS NULL`,
  )).limit(1))[0];
  return Boolean(consent);
}

async function alreadyQueued(integrationId: number, idempotencyKey: string) {
  const db = await getDb();
  if (!db) return false;
  const existing = (await db.select({ id: integrationJobs.id }).from(integrationJobs).where(and(
    eq(integrationJobs.integrationId, integrationId),
    eq(integrationJobs.idempotencyKey, idempotencyKey),
  )).limit(1))[0];
  return Boolean(existing);
}

/**
 * Cria somente jobs próprios de lembrete. Não consulta e não depende da
 * configuração de reenvio de mensagens falhas.
 */
export async function runAutomaticMessageCycle() {
  const db = await getDb();
  if (!db) return { appointmentsQueued: 0, birthdaysQueued: 0, customQueued: 0, oneHourClientQueued: 0, oneHourArtistQueued: 0, skipped: 0 };
  const active = await db.select({
    id: whatsappIntegrations.id,
    studioId: whatsappIntegrations.studioId,
  }).from(whatsappIntegrations).where(and(
    eq(whatsappIntegrations.status, "ativo"),
    eq(whatsappIntegrations.isEnabled, 1),
  ));

  const result = { appointmentsQueued: 0, birthdaysQueued: 0, customQueued: 0, oneHourClientQueued: 0, oneHourArtistQueued: 0, skipped: 0 };
  for (const integration of active) {
    if (!integration.studioId) continue;
    const settings = (await db.select().from(messageAutomationSettings)
      .where(eq(messageAutomationSettings.studioId, integration.studioId)).limit(1))[0];
    if (!settings) continue;
    const now = zonedNow(settings.timezone || "America/Sao_Paulo");
    const studio = (await db.select({ name: studios.name, address: studios.address, city: studios.city, state: studios.state, zipCode: studios.zipCode }).from(studios)
      .where(eq(studios.id, integration.studioId)).limit(1))[0];
    const studioName = studio?.name?.trim() || "nosso estúdio";

    if (settings.appointmentRemindersEnabled && now.time >= settings.appointmentSendTime) {
      const target = addDays(now.date, Math.max(1, settings.appointmentDaysBefore));
      const due = await db.select({
        id: appointments.id, clientId: appointments.clientId, date: appointments.date,
        service: appointments.service, artist: appointments.artist,
        clientName: clients.name, clientPhone: clients.phone,
      }).from(appointments).leftJoin(clients, eq(clients.id, appointments.clientId)).where(and(
        eq(appointments.studioId, integration.studioId),
        gte(appointments.date, `${target} 00:00:00`),
        lte(appointments.date, `${target} 23:59:59`),
        inArray(appointments.status, ["agendado", "confirmado"]),
      ));
      for (const appointment of due) {
        if (!appointment.clientPhone || !(await hasActiveConsent(integration.studioId, integration.id, appointment.clientId))) { result.skipped += 1; continue; }
        const idempotencyKey = automaticReminderIdempotencyKey("appointment", integration.id, appointment.id, target);
        if (await alreadyQueued(integration.id, idempotencyKey)) continue;
        const when = dateAndTime(appointment.date);
        const actionLinks = await issueAppointmentActionLinks({ studioId: integration.studioId, appointmentId: appointment.id });
        const dispatch = await dispatchTemplateMessage({
          studioId: integration.studioId, trigger: "appointment_reminder_24h", recipientType: "client",
          recipientPhone: appointment.clientPhone, recipientName: firstName(appointment.clientName),
          appointmentId: appointment.id, clientId: appointment.clientId,
          vars: { nome_cliente: firstName(appointment.clientName), nome_estudio: studioName, nome_artista: appointment.artist, nome_tatuador: appointment.artist, data: when.date, hora: when.time, servico: appointment.service, endereco: formatStudioAddress(studio), link_anamnese: "", link_ebook: "", link_confirmacao: actionLinks.confirmed, link_adiantamento: actionLinks.early, link_atraso: actionLinks.late, link_remarcar: actionLinks.reschedule_requested, __appointment_action_links: actionLinks as unknown as string },
          idempotencyKey,
        });
        if (dispatch.success && dispatch.queued) result.appointmentsQueued += 1;
      }
      await db.update(messageAutomationSettings).set({ lastAppointmentCycleAt: new Date().toISOString().slice(0, 19).replace("T", " "), lastError: null })
        .where(eq(messageAutomationSettings.id, settings.id));
    }

    if (settings.oneHourRemindersEnabled) {
      const window = oneHourReminderWindow(now.date, now.time);
      const dueInOneHour = await db.select({
        id: appointments.id, clientId: appointments.clientId, date: appointments.date,
        service: appointments.service, artist: appointments.artist, artistId: appointments.artistId,
        clientName: clients.name, clientPhone: clients.phone,
        artistName: artists.name, artistPhone: artists.phone,
      }).from(appointments)
        .leftJoin(clients, eq(clients.id, appointments.clientId))
        .leftJoin(artists, and(eq(artists.id, appointments.artistId), eq(artists.studioId, integration.studioId), eq(artists.active, 1)))
        .where(and(
          eq(appointments.studioId, integration.studioId),
          gte(appointments.date, window.startsAt),
          lte(appointments.date, window.endsAt),
          inArray(appointments.status, ["agendado", "confirmado"]),
        ));

      for (const appointment of dueInOneHour) {
        if (!appointment.clientPhone || !(await hasActiveConsent(integration.studioId, integration.id, appointment.clientId))) {
          result.skipped += 1;
          continue;
        }
        const when = dateAndTime(appointment.date);
        const occurrence = String(appointment.date);
        const clientKey = automaticReminderIdempotencyKey("one_hour_client", integration.id, appointment.id, occurrence);
        if (!(await alreadyQueued(integration.id, clientKey))) {
          const clientDispatch = await sendAndLog({
            studioId: integration.studioId,
            integrationId: integration.id,
            recipientType: "client",
            recipientPhone: appointment.clientPhone,
            recipientName: appointment.clientName ?? undefined,
            clientId: appointment.clientId,
            appointmentId: appointment.id,
            trigger: "appointment_reminder_1h_client",
            message: `Olá, ${appointment.clientName ?? "cliente"}! ⏰ Seu horário com ${appointment.artist} começa em aproximadamente 1 hora, às ${when.time}. Te esperamos!`,
            idempotencyKey: clientKey,
          });
          if (clientDispatch.success && clientDispatch.queued) result.oneHourClientQueued += 1;
        }

        if (!appointment.artistPhone || !appointment.artistId) {
          result.skipped += 1;
          continue;
        }
        const artistKey = automaticReminderIdempotencyKey("one_hour_artist", integration.id, appointment.id, occurrence);
        if (await alreadyQueued(integration.id, artistKey)) continue;
        const artistDispatch = await sendAndLog({
          studioId: integration.studioId,
          integrationId: integration.id,
          recipientType: "artist",
          recipientPhone: appointment.artistPhone,
          recipientName: appointment.artistName ?? appointment.artist,
          clientId: appointment.clientId,
          appointmentId: appointment.id,
          trigger: "appointment_reminder_1h_artist",
          message: `⏰ Lembrete para profissional: ${appointment.clientName ?? "Cliente"} tem ${appointment.service} às ${when.time}, daqui a aproximadamente 1 hora.`,
          idempotencyKey: artistKey,
        });
        if (artistDispatch.success && artistDispatch.queued) result.oneHourArtistQueued += 1;
      }
    }

    const careBirthday = (await db.select({ id: careRules.id }).from(careRules).where(and(eq(careRules.studioId, integration.studioId), eq(careRules.kind, "birthday"), eq(careRules.enabled, 1))).limit(1))[0];
    if (!careBirthday && settings.birthdayMessagesEnabled && now.time >= "09:00" && now.time < "10:00") {
      const allClients = await db.select({ id: clients.id, name: clients.name, phone: clients.phone, birthDate: clients.birthDate })
        .from(clients).where(and(eq(clients.studioId, integration.studioId), sql`${clients.birthDate} IS NOT NULL`));
      const birthdays = allClients.filter((client) => String(client.birthDate).slice(5, 10) === now.date.slice(5, 10));
      for (const client of birthdays) {
        if (!client.phone || !(await hasActiveConsent(integration.studioId, integration.id, client.id))) { result.skipped += 1; continue; }
        const message = interpolateTemplate(settings.birthdayMessageTemplate || FALLBACK_BIRTHDAY_TEMPLATE, { nome_cliente: firstName(client.name), nome_estudio: studioName });
        const dispatch = await sendAndLog({
          studioId: integration.studioId, integrationId: integration.id, recipientType: "client", recipientPhone: client.phone,
          recipientName: client.name ?? undefined, clientId: client.id, message, trigger: "birthday_reminder",
          idempotencyKey: automaticReminderIdempotencyKey("birthday", integration.id, client.id, now.date),
        });
        if (dispatch.success && dispatch.queued) result.birthdaysQueued += 1;
      }
      await db.update(messageAutomationSettings).set({ lastBirthdayCycleAt: new Date().toISOString().slice(0, 19).replace("T", " "), lastError: null })
        .where(eq(messageAutomationSettings.id, settings.id));
    }
  }
  return result;
}

/** Migra lembretes individuais já programados para a mesma fila segura. */
export async function enqueueDueIndividualReminders() {
  const db = await getDb();
  if (!db) return { queued: 0, skipped: 0 };
  // appointmentReminders.scheduledAt guarda o horário comercial local. Comparar
  // com UTC antecipava lembretes do Brasil em três horas no ambiente de produção.
  const now = zonedSqlDateTime(new Date(), "America/Sao_Paulo");
  const recentCutoff = zonedSqlDateTime(new Date(Date.now() - 24 * 60 * 60 * 1000), "America/Sao_Paulo");
  const due = await db.select({
    id: appointmentReminders.id, appointmentId: appointmentReminders.appointmentId, message: appointmentReminders.message,
    clientId: appointments.clientId, studioId: appointments.studioId, clientName: clients.name, clientPhone: clients.phone,
  }).from(appointmentReminders).leftJoin(appointments, eq(appointments.id, appointmentReminders.appointmentId))
    .leftJoin(clients, eq(clients.id, appointments.clientId)).where(and(
      eq(appointmentReminders.status, "pending"),
      lte(appointmentReminders.scheduledAt, now),
      gte(appointmentReminders.scheduledAt, recentCutoff),
    ));
  let queued = 0; let skipped = 0;
  for (const reminder of due) {
    if (!reminder.studioId || !reminder.clientId || !reminder.clientPhone) { skipped += 1; continue; }
    const integration = (await db.select({ id: whatsappIntegrations.id }).from(whatsappIntegrations).where(and(
      eq(whatsappIntegrations.studioId, reminder.studioId), eq(whatsappIntegrations.status, "ativo"), eq(whatsappIntegrations.isEnabled, 1),
    )).limit(1))[0];
    if (!integration || !(await hasActiveConsent(reminder.studioId, integration.id, reminder.clientId))) { skipped += 1; continue; }
    const idempotencyKey = automaticReminderIdempotencyKey("individual", integration.id, reminder.id, "once");
    if (await alreadyQueued(integration.id, idempotencyKey)) continue;
    const actionLinks = await issueAppointmentActionLinks({ studioId: reminder.studioId, appointmentId: reminder.appointmentId });
    const dispatch = await sendAndLog({
      studioId: reminder.studioId, integrationId: integration.id, recipientType: "client", recipientPhone: reminder.clientPhone,
      recipientName: firstName(reminder.clientName), clientId: reminder.clientId, appointmentId: reminder.appointmentId,
      appointmentReminderId: reminder.id, message: `${useFirstNameInGreeting(reminder.message, reminder.clientName)}\n\n${formatAppointmentActionLinks(actionLinks)}`, trigger: "scheduled_reminder",
      idempotencyKey,
    });
    if (dispatch.success && dispatch.queued) queued += 1;
  }
  return { queued, skipped };
}
