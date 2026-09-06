import crypto from "node:crypto";
import { and, desc, eq, gt, isNull, sql } from "drizzle-orm";
import { anamneseRequests, anamneseSubmissions, anamnesisRecords, appointmentActionAlerts, appointmentActionLinks, appointments, artists, clients } from "../drizzle/schema";
import { getDb } from "./db";
import { firstName } from "./messaging/messagePresentation";

export const APPOINTMENT_ACTIONS = ["confirmed", "early", "late", "reschedule_requested"] as const;
export type AppointmentAction = typeof APPOINTMENT_ACTIONS[number];

const actionLabels: Record<AppointmentAction, string> = {
  confirmed: "Confirmar presença",
  early: "Avisar adiantamento",
  late: "Avisar atraso",
  reschedule_requested: "Solicitar remarcação",
};

function publicBaseUrl() {
  if (process.env.APP_BASE_URL) return process.env.APP_BASE_URL.replace(/\/$/, "");
  return process.env.NODE_ENV === "production" ? "https://tatuei.com" : "http://localhost:3000";
}

function tokenHash(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function sqlDate(date = new Date()) {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).format(date).replace(",", "");
}

function saoPauloDateTime(value: string | Date) {
  if (value instanceof Date) return value;
  if (/T.*(?:Z|[+-]\d{2}:?\d{2})$/.test(value)) return new Date(value);
  const normalized = value.replace(" ", "T").replace(/Z$/, "");
  return new Date(`${normalized}-03:00`);
}

export type AppointmentActionLinks = Record<AppointmentAction, string>;

/**
 * Emite três links aleatórios sem armazenar o token puro. Todos expiram no
 * horário do agendamento e cada token só pode ser consumido uma vez.
 */
export async function issueAppointmentActionLinks(input: {
  studioId: number;
  appointmentId: number;
  expiresAt?: string;
}): Promise<AppointmentActionLinks> {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível");

  const appointment = (await db.select({ id: appointments.id, studioId: appointments.studioId, date: appointments.date })
    .from(appointments)
    .where(and(eq(appointments.id, input.appointmentId), eq(appointments.studioId, input.studioId)))
    .limit(1))[0];
  if (!appointment) throw new Error("Agendamento não encontrado para o estúdio");

  const expiresAt = input.expiresAt ?? String(appointment.date);
  const result = {} as AppointmentActionLinks;
  for (const action of APPOINTMENT_ACTIONS) {
    const rawToken = crypto.randomBytes(32).toString("base64url");
    await db.insert(appointmentActionLinks).values({
      studioId: input.studioId,
      appointmentId: input.appointmentId,
      action,
      tokenHash: tokenHash(rawToken),
      expiresAt,
    });
    result[action] = `${publicBaseUrl()}/confirmar?token=${encodeURIComponent(rawToken)}&action=${encodeURIComponent(action)}`;
  }
  return result;
}

/** Acrescenta ações quando um template personalizado não declarar os links. */
export function formatAppointmentActionLinks(links: AppointmentActionLinks, actions: readonly AppointmentAction[] = APPOINTMENT_ACTIONS) {
  return actions.map((action) => `${actionLabels[action]}: ${links[action]}`).join("\n");
}

export function isActionLinkUsable(input: { usedAt: string | Date | null; expiresAt: string | Date }, now = new Date()) {
  return !input.usedAt && saoPauloDateTime(input.expiresAt).getTime() > now.getTime();
}

/** Somente respostas que mantêm a sessão ativa recebem a ficha automaticamente. */
export function shouldQueueAnamneseAfterAction(action: AppointmentAction) {
  return action === "confirmed" || action === "early" || action === "late";
}

async function queueAnamneseAfterCustomerAction(input: {
  studioId: number;
  appointmentId: number;
  action: AppointmentAction;
}) {
  if (!shouldQueueAnamneseAfterAction(input.action)) return { queued: false, reason: "not-applicable" as const };

  const db = await getDb();
  if (!db) return { queued: false, reason: "database-unavailable" as const };

  const appointment = (await db.select({ id: appointments.id, clientId: appointments.clientId })
    .from(appointments)
    .where(and(eq(appointments.id, input.appointmentId), eq(appointments.studioId, input.studioId)))
    .limit(1))[0];
  if (!appointment) return { queued: false, reason: "appointment-not-found" as const };

  const client = (await db.select({ id: clients.id, name: clients.name, phone: clients.phone })
    .from(clients)
    .where(eq(clients.id, appointment.clientId))
    .limit(1))[0];
  if (!client?.phone) return { queued: false, reason: "client-without-phone" as const };

  const existingRequest = (await db.select({ id: anamneseRequests.id, token: anamneseRequests.token })
    .from(anamneseRequests)
    .where(and(
      eq(anamneseRequests.clientId, client.id),
      eq(anamneseRequests.appointmentId, appointment.id),
      eq(anamneseRequests.sentVia, "whatsapp"),
      eq(anamneseRequests.statusRequest, "pendente"),
    ))
    .limit(1))[0];

  const previousSubmission = (await db.select({ id: anamneseSubmissions.id })
    .from(anamneseSubmissions)
    .where(eq(anamneseSubmissions.clientId, client.id))
    .orderBy(desc(anamneseSubmissions.createdAt))
    .limit(1))[0];
  const previousLegacyRecord = previousSubmission ? undefined : (await db.select({ id: anamnesisRecords.id })
    .from(anamnesisRecords)
    .where(eq(anamnesisRecords.clientId, client.id))
    .orderBy(desc(anamnesisRecords.createdAt))
    .limit(1))[0];
  const token = existingRequest?.token ?? crypto.randomBytes(24).toString("base64url");
  const requestId = existingRequest?.id ?? Number((await db.insert(anamneseRequests).values({
    clientId: client.id,
    appointmentId: appointment.id,
    token,
    sentVia: "whatsapp",
    sentTo: client.phone,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    statusRequest: "pendente",
  }))[0].insertId);
  const { sendAndLog } = await import("./messaging/service");
  const delivery = await sendAndLog({
    studioId: input.studioId,
    clientId: client.id,
    appointmentId: appointment.id,
    recipientPhone: client.phone,
    recipientName: firstName(client.name),
    recipientType: "client",
    trigger: "appointment_anamnese_after_response",
    message: previousSubmission || previousLegacyRecord
      ? `Olá, ${firstName(client.name)}! Recebemos sua resposta sobre o agendamento. Já temos sua ficha de anamnese cadastrada. Confira seus dados e atualize somente se houve alguma mudança: ${publicBaseUrl()}/anamnese/${token}`
      : `Olá, ${firstName(client.name)}! Recebemos sua resposta sobre o agendamento. Para prosseguir, preencha sua ficha de anamnese: ${publicBaseUrl()}/anamnese/${token}`,
    idempotencyKey: `appointment-anamnese:${requestId}`,
  });
  return { queued: delivery.success && (delivery.queued || delivery.duplicate), reason: delivery.success ? "queued" as const : "delivery-rejected" as const };
}

async function queueArtistActionNotification(input: {
  studioId: number;
  appointmentId: number;
  actionLinkId: number;
  action: AppointmentAction;
}) {
  const db = await getDb();
  if (!db) return false;
  const appointment = (await db.select({
    id: appointments.id,
    clientId: appointments.clientId,
    artistId: appointments.artistId,
    date: appointments.date,
    service: appointments.service,
  }).from(appointments).where(and(
    eq(appointments.id, input.appointmentId),
    eq(appointments.studioId, input.studioId),
  )).limit(1))[0];
  if (!appointment?.artistId) return false;
  const client = (await db.select({ name: clients.name }).from(clients)
    .where(eq(clients.id, appointment.clientId)).limit(1))[0];
  const artist = (await db.select({ name: artists.name, phone: artists.phone }).from(artists).where(and(
    eq(artists.id, appointment.artistId),
    eq(artists.studioId, input.studioId),
  )).limit(1))[0];
  if (!client || !artist?.phone) return false;

  const actionText: Record<AppointmentAction, string> = {
    confirmed: "confirmou presença",
    early: "informou que chegará adiantado",
    late: "informou que terá atraso",
    reschedule_requested: "solicitou remarcação",
  };
  const when = saoPauloDateTime(String(appointment.date)).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short",
  });
  const { sendAndLog } = await import("./messaging/service");
  const delivery = await sendAndLog({
    studioId: input.studioId,
    recipientPhone: artist.phone,
    recipientName: firstName(artist.name),
    recipientType: "artist",
    clientId: appointment.clientId,
    appointmentId: appointment.id,
    trigger: `appointment_action_${input.action}`,
    message: `Olá, ${firstName(artist.name)}! ${firstName(client.name)} ${actionText[input.action]} no agendamento de ${when}. Serviço: ${appointment.service}.`,
    idempotencyKey: `appointment-action-artist:${input.actionLinkId}`,
  });
  return delivery.success && (delivery.queued || delivery.duplicate);
}

export async function consumeAppointmentActionLink(rawToken: string) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível");
  const now = sqlDate();
  const link = (await db.select().from(appointmentActionLinks).where(and(
    eq(appointmentActionLinks.tokenHash, tokenHash(rawToken)),
    isNull(appointmentActionLinks.usedAt),
    gt(appointmentActionLinks.expiresAt, now),
  )).limit(1))[0];
  if (!link || !isActionLinkUsable(link)) throw new Error("Este link é inválido, já foi usado ou expirou.");

  const reserved = await db.update(appointmentActionLinks)
    .set({ usedAt: now })
    .where(and(eq(appointmentActionLinks.id, link.id), isNull(appointmentActionLinks.usedAt)));
  const header = Array.isArray(reserved) ? reserved[0] : reserved;
  if (!header || (header as { affectedRows?: number }).affectedRows !== 1) {
    throw new Error("Esta ação já foi registrada.");
  }

  const action = link.action as AppointmentAction;
  const appointmentUpdate = action === "confirmed"
    ? { confirmationStatus: "confirmado" as const }
    : action === "early"
      ? { confirmationStatus: "chegada_antecipada" as const }
    : action === "late"
      ? { confirmationStatus: "atraso" as const }
      : { status: "reagendado" as const, confirmationStatus: "nao_confirmado" as const };
  await db.update(appointments).set(appointmentUpdate).where(and(
    eq(appointments.id, link.appointmentId),
    eq(appointments.studioId, link.studioId),
  ));
  await db.insert(appointmentActionAlerts).values({
    studioId: link.studioId,
    appointmentId: link.appointmentId,
    actionLinkId: link.id,
    action,
  });
  let anamneseQueued = false;
  let artistQueued = false;
  try {
    anamneseQueued = (await queueAnamneseAfterCustomerAction({
      studioId: link.studioId,
      appointmentId: link.appointmentId,
      action,
    })).queued;
  } catch (error) {
    // A confirmação do cliente permanece válida mesmo que o provedor esteja indisponível.
    console.error("[AppointmentActions] Não foi possível enfileirar anamnese", error);
  }
  try {
    artistQueued = await queueArtistActionNotification({
      studioId: link.studioId,
      appointmentId: link.appointmentId,
      actionLinkId: link.id,
      action,
    });
  } catch (error) {
    console.error("[AppointmentActions] Não foi possível enfileirar aviso ao artista", error);
  }
  return { action, appointmentId: link.appointmentId, anamneseQueued, artistQueued };
}

export async function listAppointmentActionAlerts(studioId: number, limit = 8) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(appointmentActionAlerts).where(and(
    eq(appointmentActionAlerts.studioId, studioId),
    eq(appointmentActionAlerts.status, "new"),
  )).orderBy(sql`${appointmentActionAlerts.createdAt} DESC`).limit(limit);
}

export async function markAppointmentActionAlertViewed(studioId: number, alertId: number) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível");
  await db.update(appointmentActionAlerts).set({ status: "viewed", viewedAt: sqlDate() }).where(and(
    eq(appointmentActionAlerts.id, alertId),
    eq(appointmentActionAlerts.studioId, studioId),
  ));
}
