import { and, eq } from "drizzle-orm";
import { appointments, artists } from "../drizzle/schema";
import type { InventoryDatabase } from "./inventoryAccess";

// Older sessions stored only a display name. Resolve only an explicit,
// tenant-scoped appointment relationship; never guess from a person's name.
export async function resolveProcedureArtist(db: InventoryDatabase, procedure: {
  studioId: number; clientId: number; appointmentId?: number | null;
  artistId?: number | null; artistName?: string | null;
}) {
  if (procedure.artistId || !procedure.appointmentId) return procedure;
  const [linked] = await db.select({ artistId: artists.id, artistName: artists.name })
    .from(appointments).innerJoin(artists, and(eq(artists.id, appointments.artistId), eq(artists.studioId, procedure.studioId)))
    .where(and(eq(appointments.id, procedure.appointmentId), eq(appointments.studioId, procedure.studioId), eq(appointments.clientId, procedure.clientId))).limit(1);
  return linked ? { ...procedure, ...linked } : procedure;
}
