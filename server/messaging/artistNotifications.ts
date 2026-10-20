import { randomUUID } from "node:crypto";
import { and, asc, eq } from "drizzle-orm";
import {
  appointments,
  artists,
  artistNotificationSettings,
  clients,
  users,
  whatsappIntegrations,
} from "../../drizzle/schema";
import { getDb } from "../db";
import { normalizeBrazilianPhone } from "./phone";
import { firstName } from "./messagePresentation";
import { quoteProposals } from "../../drizzle/quoteProposalSchema";
import { selectArtistNotificationRecipient } from "../appointmentActions";

/** Only these operational events use the studio fallback; manual reminders retain their opt-in. */
export function isCoreArtistNotice(trigger?: string | null) {
  return (
    !!trigger &&
    ([
      "artist_appointment_created",
      "artist_appointment_updated",
      "artist_customer_reply",
    ].includes(trigger) ||
      /^appointment_action_(confirmed|early|late|reschedule_requested)$/.test(
        trigger
      ) ||
      /^quote_artist_action:\d+:(accepted|question|whatsapp_opened)$/.test(
        trigger
      ))
  );
}

export type ArtistNoticeChannel = {
  id: number;
  ownerArtistId: number | null;
  ownerRole: string | null;
};
export function selectArtistNoticeChannel(
  channels: ArtistNoticeChannel[],
  artistId: number
) {
  // A collaborator's activated connection is personal. Never borrow another artist's channel.
  const own = channels.find(
    channel =>
      channel.ownerRole === "collaborator" && channel.ownerArtistId === artistId
  );
  const studio = channels.find(channel => channel.ownerRole !== "collaborator");
  return own
    ? { integrationId: own.id, viaStudio: false }
    : studio
      ? { integrationId: studio.id, viaStudio: true }
      : null;
}

export async function artistNotificationRoute(
  studioId: number,
  artistId: number,
  trigger: string
) {
  const db = await getDb();
  if (!db) return null;
  const [artist] = await db
    .select({ id: artists.id, name: artists.name, phone: artists.phone })
    .from(artists)
    .where(
      and(
        eq(artists.id, artistId),
        eq(artists.studioId, studioId),
        eq(artists.active, 1)
      )
    )
    .limit(1);
  if (!artist?.phone) return null;
  let phone: string;
  try {
    phone = normalizeBrazilianPhone(artist.phone);
  } catch {
    return null;
  }
  const channels = await db
    .select({
      id: whatsappIntegrations.id,
      ownerArtistId: users.artistId,
      ownerRole: users.role,
    })
    .from(whatsappIntegrations)
    .leftJoin(
      users,
      and(
        eq(users.id, whatsappIntegrations.productionActivatedByUserId),
        eq(users.studioId, studioId)
      )
    )
    .where(
      and(
        eq(whatsappIntegrations.studioId, studioId),
        eq(whatsappIntegrations.status, "ativo"),
        eq(whatsappIntegrations.isEnabled, 1),
        eq(whatsappIntegrations.sandboxMode, 0)
      )
    )
    .orderBy(asc(whatsappIntegrations.id));
  const route = selectArtistNoticeChannel(channels, artistId);
  if (!route) return null;
  // The approved studio fallback is automatic for scheduling and customer replies.
  if (!(route.viaStudio && isCoreArtistNotice(trigger))) {
    const [preference] = await db
      .select()
      .from(artistNotificationSettings)
      .where(
        and(
          eq(artistNotificationSettings.studioId, studioId),
          eq(artistNotificationSettings.artistId, artistId)
        )
      )
      .limit(1);
    if (
      preference?.whatsappOperationalEnabled !== 1 ||
      preference.notifyClientActionsEnabled !== 1
    )
      return null;
  }
  return { ...route, artist, phone };
}

export async function queueArtistOperationalNotice(input: {
  studioId: number;
  artistId: number;
  clientId?: number;
  appointmentId?: number;
  trigger: string;
  message: string;
  idempotencyKey: string;
}) {
  try {
    const route = await artistNotificationRoute(
      input.studioId,
      input.artistId,
      input.trigger
    );
    if (!route) return false;
    const { sendAndLog } = await import("./service");
    const result = await sendAndLog({
      ...input,
      integrationId: route.integrationId,
      recipientType: "artist",
      recipientPhone: route.phone,
      recipientName: firstName(route.artist.name),
    });
    return result.success && (result.queued || result.duplicate);
  } catch {
    console.warn("[Artists] Aviso operacional não enfileirado.", {
      studioId: input.studioId,
      artistId: input.artistId,
      trigger: input.trigger,
    });
    return false;
  }
}

/** Recheck ownership immediately before delivery, in case an appointment/client was reassigned while queued. */
export async function artistNoticeContextError(input: {
  studioId: number;
  artistId: number;
  clientId?: number;
  appointmentId?: number | null;
  trigger: string;
}) {
  const db = await getDb();
  if (!db || !input.clientId) return "Aviso sem cliente identificado.";
  const quoteId = /^quote_artist_action:(\d+):/.exec(input.trigger)?.[1];
  if (quoteId) {
    const [quote] = await db
      .select({
        artistId: quoteProposals.artistId,
        clientId: quoteProposals.clientId,
      })
      .from(quoteProposals)
      .where(
        and(
          eq(quoteProposals.id, Number(quoteId)),
          eq(quoteProposals.studioId, input.studioId)
        )
      )
      .limit(1);
    return quote?.artistId === input.artistId &&
      quote.clientId === input.clientId
      ? null
      : "O artista responsável pelo orçamento mudou ou não está disponível.";
  }
  if (input.appointmentId) {
    const [appointment] = await db
      .select({
        artistId: appointments.artistId,
        artist: appointments.artist,
        clientId: appointments.clientId,
      })
      .from(appointments)
      .where(
        and(
          eq(appointments.id, input.appointmentId),
          eq(appointments.studioId, input.studioId)
        )
      )
      .limit(1);
    if (!appointment || appointment.clientId !== input.clientId)
      return "O vínculo do cliente com o agendamento mudou.";
    if (appointment.artistId != null)
      return appointment.artistId === input.artistId
        ? null
        : "O artista responsável pelo agendamento mudou.";
    const candidates = await db
      .select({ id: artists.id, name: artists.name, phone: artists.phone })
      .from(artists)
      .where(and(eq(artists.studioId, input.studioId), eq(artists.active, 1)));
    return selectArtistNotificationRecipient(appointment.artist, candidates)
      ?.id === input.artistId
      ? null
      : "Artista do agendamento antigo não identificado com segurança.";
  }
  const [client] = await db
    .select({ artistId: clients.artistId })
    .from(clients)
    .where(
      and(
        eq(clients.id, input.clientId),
        eq(clients.studioId, input.studioId),
        eq(clients.isArchived, 0)
      )
    )
    .limit(1);
  return client?.artistId === input.artistId
    ? null
    : "O artista responsável pelo atendimento mudou.";
}

function appointmentWhen(value: string) {
  // MySQL datetime is already the studio's wall clock: avoid the server's timezone.
  const match = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}:\d{2})/.exec(value);
  return match ? `${match[3]}/${match[2]}/${match[1]} às ${match[4]}` : value;
}

export async function queueArtistAppointmentNotice(input: {
  studioId: number;
  appointmentId: number;
  change: "created" | "updated";
}) {
  try {
    const db = await getDb();
    if (!db) return false;
    const [appointment] = await db
      .select()
      .from(appointments)
      .where(
        and(
          eq(appointments.id, input.appointmentId),
          eq(appointments.studioId, input.studioId)
        )
      )
      .limit(1);
    if (!appointment?.artistId) return false;
    const [client] = await db
      .select({ name: clients.name })
      .from(clients)
      .where(
        and(
          eq(clients.id, appointment.clientId),
          eq(clients.studioId, input.studioId)
        )
      )
      .limit(1);
    if (!client) return false;
    return await queueArtistOperationalNotice({
      ...input,
      artistId: appointment.artistId,
      clientId: appointment.clientId,
      trigger: `artist_appointment_${input.change}`,
      idempotencyKey: `artist-appointment:${input.studioId}:${appointment.id}:${input.change}:${input.change === "created" ? "new" : randomUUID()}`,
      message: `Agendamento ${input.change === "created" ? "criado" : "atualizado"} no Tatuei\n\nArtista: ${appointment.artist}\nCliente: ${client.name}\nData: ${appointmentWhen(appointment.date)}\nServiço: ${appointment.service}\nStatus: ${appointment.status}\n\nAcompanhe os detalhes na sua agenda do CRM.`,
    });
  } catch {
    console.warn("[Artists] Falha no aviso de agendamento.", {
      studioId: input.studioId,
      appointmentId: input.appointmentId,
    });
    return false;
  }
}

/** Resolve only a verified client and explicit appointment context in the authenticated tenant. */
export async function queueArtistCustomerReply(input: {
  studioId: number;
  phone: string;
  text: string;
  eventKey?: string;
  appointmentId?: number;
}) {
  try {
    if (!input.eventKey) return false; // An unidentifiable provider event cannot be deduplicated safely.
    const db = await getDb();
    if (!db) return false;
    const phone = normalizeBrazilianPhone(input.phone);
    const candidates = await db
      .select({
        id: clients.id,
        name: clients.name,
        phone: clients.phone,
        artistId: clients.artistId,
      })
      .from(clients)
      .where(
        and(eq(clients.studioId, input.studioId), eq(clients.isArchived, 0))
      );
    const matches = candidates.filter(client => {
      try {
        return (
          !!client.phone && normalizeBrazilianPhone(client.phone) === phone
        );
      } catch {
        return false;
      }
    });
    if (matches.length !== 1) return false;
    const client = matches[0];
    const [appointment] = input.appointmentId
      ? await db
          .select()
          .from(appointments)
          .where(
            and(
              eq(appointments.id, input.appointmentId),
              eq(appointments.studioId, input.studioId),
              eq(appointments.clientId, client.id)
            )
          )
          .limit(1)
      : [];
    if (input.appointmentId && !appointment) return false;
    const artistId = appointment?.artistId ?? client.artistId;
    if (!artistId) return false;
    return await queueArtistOperationalNotice({
      studioId: input.studioId,
      artistId,
      clientId: client.id,
      appointmentId: appointment?.id,
      trigger: "artist_customer_reply",
      idempotencyKey: `artist-reply:${input.studioId}:${input.eventKey}`,
      message: `Nova resposta de cliente no Tatuei\n\nCliente: ${client.name}${appointment ? `\nAgendamento: ${appointmentWhen(appointment.date)}\nServiço: ${appointment.service}` : ""}\n\nMensagem recebida:\n${input.text.trim().slice(0, 2000)}\n\nAcompanhe o atendimento no CRM.`,
    });
  } catch {
    console.warn("[Artists] Falha no aviso de resposta.", {
      studioId: input.studioId,
    });
    return false;
  }
}
