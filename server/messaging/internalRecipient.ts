import { and, eq } from "drizzle-orm";
import { appointments, artists, clients, studios } from "../../drizzle/schema";
import { getDb } from "../db";
import { normalizeBrazilianPhone } from "./phone";

export interface NotificationContext {
  studio: { id: number; name: string; phone: string | null; isActive: number } | null;
  client: { id: number; studioId: number; name: string; artistId: number | null; phone: string | null } | null;
  appointment: { id: number; studioId: number; clientId: number; artistId: number | null; artist: string; date: string; service: string; status: string } | null;
  artist: { id: number; studioId: number; name: string; phone: string | null; active: number } | null;
}
export interface InternalRecipient {
  phone: string;
  name: string;
  role: "studio" | "artist" | "studio_artist";
  artistId?: number;
}
const empty = (): NotificationContext => ({ studio: null, client: null, appointment: null, artist: null });
const validId = (n: unknown): n is number => typeof n === "number" && Number.isInteger(n) && n > 0;
const comparableName = (name: string) => name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().replace(/\s+/g, " ").toLocaleLowerCase("pt-BR");
export function safeNotificationPhone(phone: string | null | undefined): string | null {
  try { return phone ? normalizeBrazilianPhone(phone) : null; } catch { return null; }
}
export function selectAssignedArtist(
  ref: { artistId: number | null; artist: string },
  candidates: Array<NonNullable<NotificationContext["artist"]>>,
  studioId: number,
): NotificationContext["artist"] {
  const eligible = candidates.filter(a => validId(a.id) && a.studioId === studioId && a.active === 1);
  if (ref.artistId != null) {
    return validId(ref.artistId) ? eligible.find(a => a.id === ref.artistId) ?? null : null;
  }
  const name = comparableName(ref.artist);
  if (!name) return null;
  const matches = eligible.filter(a => comparableName(a.name) === name);
  return matches.length === 1 ? matches[0] : null;
}

/** Resolve apenas vínculos persistidos dentro de um único estúdio. */
export async function loadInternalNotificationContext(input: {
  studioId: number; appointmentId?: number | null; clientId?: number | null;
}): Promise<NotificationContext> {
  if (!validId(input.studioId) || (input.appointmentId != null && !validId(input.appointmentId)) ||
      (input.clientId != null && !validId(input.clientId))) return empty();
  const db = await getDb();
  if (!db) return empty();
  const [studio] = await db.select({id: studios.id, name: studios.name, phone: studios.phone, isActive: studios.isActive})
    .from(studios).where(and(eq(studios.id, input.studioId), eq(studios.isActive, 1))).limit(1);
  if (!studio || studio.id !== input.studioId || studio.isActive !== 1) return empty();
  let appointment: NotificationContext["appointment"] = null;
  if (input.appointmentId != null) {
    const [row] = await db.select({id: appointments.id, studioId: appointments.studioId, clientId: appointments.clientId,
      artistId: appointments.artistId, artist: appointments.artist, date: appointments.date, service: appointments.service, status: appointments.status})
      .from(appointments).where(and(eq(appointments.id, input.appointmentId), eq(appointments.studioId, input.studioId))).limit(1);
    if (!row || row.id !== input.appointmentId || row.studioId !== input.studioId ||
        (input.clientId != null && row.clientId !== input.clientId)) return empty();
    appointment = row;
  }
  const clientId = input.clientId ?? appointment?.clientId;
  if (!validId(clientId)) return empty();
  const [client] = await db.select({id: clients.id, studioId: clients.studioId, name: clients.name, artistId: clients.artistId, phone: clients.phone})
    .from(clients).where(and(eq(clients.id, clientId), eq(clients.studioId, input.studioId))).limit(1);
  if (!client || client.id !== clientId || client.studioId !== input.studioId) return empty();
  const ref = appointment ? {artistId: appointment.artistId, artist: appointment.artist} : {artistId: client.artistId, artist: ""};
  let artist: NotificationContext["artist"] = null;
  if (ref.artistId != null || ref.artist.trim()) {
    const fields = {id: artists.id, studioId: artists.studioId, name: artists.name, phone: artists.phone, active: artists.active};
    if (ref.artistId != null) {
      if (validId(ref.artistId)) {
        const candidates = await db.select(fields).from(artists).where(and(eq(artists.id, ref.artistId), eq(artists.studioId, input.studioId), eq(artists.active, 1))).limit(1);
        artist = selectAssignedArtist(ref, candidates, input.studioId);
      }
    } else {
      const candidates = await db.select(fields).from(artists).where(and(eq(artists.studioId, input.studioId), eq(artists.active, 1)));
      artist = selectAssignedArtist(ref, candidates, input.studioId);
    }
  }
  return {studio, client, appointment, artist};
}

/** A igualdade de telefone cobre os dois papéis com uma única mensagem. */
export function internalRecipients(context: NotificationContext): InternalRecipient[] {
  const {studio, client, artist} = context;
  if (!studio || studio.isActive !== 1 || !client || client.studioId !== studio.id) return [];
  const studioPhone = safeNotificationPhone(studio.phone);
  const artistPhone = artist?.active === 1 && artist.studioId === studio.id ? safeNotificationPhone(artist.phone) : null;
  if (studioPhone && artistPhone === studioPhone) return [{phone: studioPhone, name: artist!.name, role: "studio_artist", artistId: artist!.id}];
  const result: InternalRecipient[] = [];
  if (studioPhone) result.push({phone: studioPhone, name: studio.name, role: "studio"});
  if (artistPhone && artist) result.push({phone: artistPhone, name: artist.name, role: "artist", artistId: artist.id});
  return result;
}
