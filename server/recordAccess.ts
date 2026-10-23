import { TRPCError } from "@trpc/server";
import { and, eq, sql, SQL } from "drizzle-orm";
import * as schema from "../drizzle/schema";
import { getDb } from "./db";
import { hasModulePermission, type SaasModule } from "./saas";
import type { User } from "../drizzle/schema";

type RecordActor = { role: string; studioId: number | null; artistId: number | null };
type Database = NonNullable<Awaited<ReturnType<typeof getDb>>>;
const denied = () => new TRPCError({ code: "FORBIDDEN", message: "Registro fora do seu estúdio ou artista autorizado." });
const object = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
function id(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value <= 0)
    throw new TRPCError({ code: "BAD_REQUEST", message: "Identificador inválido." });
  return value;
}

/** No global fallback: these are tenant operations, including for superadmins. */
export async function requireRecordScope(user: User, module: SaasModule, write: boolean) {
  if (!user.studioId) throw denied();
  if (user.role === "collaborator") {
    if (!user.artistId || !(await hasModulePermission({ userId: user.id, studioId: user.studioId, module, write }))) throw denied();
    const database = await getDb();
    const artist = database && (await database.select({ id: schema.artists.id }).from(schema.artists)
      .where(and(eq(schema.artists.id, user.artistId), eq(schema.artists.studioId, user.studioId))).limit(1))[0];
    if (!artist) throw denied();
  } else if (user.role !== "admin" && user.role !== "superadmin") throw denied();
}

async function clientInStudio(database: Database, user: RecordActor, clientId: number) {
  const [client] = await database.select().from(schema.clients)
    .where(and(eq(schema.clients.id, clientId), eq(schema.clients.studioId, user.studioId!))).limit(1);
  if (!client) throw denied();
  return client;
}

async function artistInStudio(database: Database, user: RecordActor, artistId: number | null) {
  if (artistId == null) return;
  const [artist] = await database.select({ id: schema.artists.id }).from(schema.artists)
    .where(and(eq(schema.artists.id, artistId), eq(schema.artists.studioId, user.studioId!))).limit(1);
  if (!artist) throw denied();
}

async function appointmentInStudio(database: Database, user: RecordActor, appointmentId: number) {
  const [appointment] = await database.select().from(schema.appointments)
    .where(and(eq(schema.appointments.id, appointmentId), eq(schema.appointments.studioId, user.studioId!))).limit(1);
  if (!appointment) throw denied();
  await clientInStudio(database, user, appointment.clientId);
  await artistInStudio(database, user, appointment.artistId);
  return appointment;
}

/** Authorize the persisted parent, not a caller-supplied studio/artist ID. */
export async function requireSessionRecord(database: Database, user: RecordActor, procedureId: number) {
  if (!user.studioId) throw denied();
  const [procedure] = await database.select().from(schema.technicalProcedures)
    .where(and(eq(schema.technicalProcedures.id, procedureId), eq(schema.technicalProcedures.studioId, user.studioId))).limit(1);
  if (!procedure) throw denied();
  await assertSessionLinks(database, user, procedure);
  return procedure;
}

export async function assertSessionLinks(database: Database, user: RecordActor, record: {
  clientId: number; appointmentId?: number | null; artistId?: number | null;
}) {
  await clientInStudio(database, user, record.clientId);
  await artistInStudio(database, user, record.artistId ?? null);
  if (user.role === "collaborator" && (!record.artistId || record.artistId !== user.artistId)) throw denied();
  if (record.appointmentId) {
    const appointment = await appointmentInStudio(database, user, record.appointmentId);
    if (appointment.clientId !== record.clientId ||
        (record.artistId != null && appointment.artistId != null && appointment.artistId !== record.artistId)) throw denied();
  }
}

/** Existing owner/appointment links only; no implicit client-sharing grants. */
async function clientRecord(database: Database, user: RecordActor, clientId: number | null, appointmentId: number | null = null) {
  const client = clientId ? await clientInStudio(database, user, clientId) : null;
  const appointment = appointmentId ? await appointmentInStudio(database, user, appointmentId) : null;
  if (appointment && (!client || appointment.clientId !== client.id)) throw denied();
  if (user.role === "collaborator" &&
      (!client || (appointment ? appointment.artistId !== user.artistId : client.artistId !== user.artistId))) throw denied();
}

/** Runs before legacy handlers can read files or write any rows. */
export async function assertRecordAccess(user: User, path: string, type: string, rawInput: unknown) {
  const root = path.split(".")[0];
  const session = root === "procedures" || path.startsWith("pod.session.") || path === "quickConsume";
  if (!session && !["transactions", "notes", "gallery"].includes(root)) return false;
  const module: SaasModule = session ? (path === "procedures.listLinkedAppointmentIds" ? "appointments" : "pod")
    : root === "transactions" ? "finance" : "clients";
  await requireRecordScope(user, module, type === "mutation");
  const database = await getDb();
  if (!database) throw new TRPCError({ code: "SERVICE_UNAVAILABLE" });
  const input = object(rawInput);
  if (input.studioId != null && input.studioId !== user.studioId) throw denied();
  if (input.artistId != null) {
    await artistInStudio(database, user, id(input.artistId));
    if (user.role === "collaborator" && input.artistId !== user.artistId) throw denied();
  }

  if (session) {
    let procedureId = id(input.procedureId);
    if (root === "procedures" && !procedureId && input.id != null) procedureId = id(input.id);
    // Resolve child-only mutations to their actual session before authorizing.
    if (input.recipeId != null) {
      const [recipe] = await database.select().from(schema.procedureInkRecipes)
        .where(and(eq(schema.procedureInkRecipes.id, id(input.recipeId)!), eq(schema.procedureInkRecipes.studioId, user.studioId!))).limit(1);
      if (!recipe || (procedureId && recipe.procedureId !== procedureId)) throw denied();
      procedureId = recipe.procedureId;
    }
    if (input.consumptionId != null) {
      const [consumption] = await database.select().from(schema.procedureInventoryConsumptions)
        .where(and(eq(schema.procedureInventoryConsumptions.id, id(input.consumptionId)!), eq(schema.procedureInventoryConsumptions.studioId, user.studioId!))).limit(1);
      if (!consumption || (procedureId && consumption.procedureId !== procedureId)) throw denied();
      procedureId = consumption.procedureId;
    }
    const existing = procedureId ? await requireSessionRecord(database, user, procedureId) : null;
    if (existing && ["procedures.updateConsumable", "procedures.removeConsumable"].includes(path)) {
      const [child] = await database.select({ id: schema.procedureConsumables.id }).from(schema.procedureConsumables)
        .where(and(eq(schema.procedureConsumables.id, id(input.id)!), eq(schema.procedureConsumables.procedureId, existing.id))).limit(1);
      if (!child) throw denied();
    }
    if (existing && path === "procedures.update") {
      await assertSessionLinks(database, user, {
        clientId: existing.clientId,
        appointmentId: input.appointmentId === undefined ? existing.appointmentId : id(input.appointmentId),
        artistId: input.artistId === undefined ? existing.artistId : id(input.artistId),
      });
    }
    if (path === "procedures.create" || path === "pod.session.create") {
      if (id(input.clientId) == null) throw denied();
      // A new session must not turn self-assignment into an implicit client-sharing grant.
      await clientRecord(database, user, id(input.clientId), id(input.appointmentId));
      await assertSessionLinks(database, user, { clientId: id(input.clientId)!, appointmentId: id(input.appointmentId), artistId: id(input.artistId) });
    } else {
      if (input.clientId != null) await clientInStudio(database, user, id(input.clientId)!);
      if (input.appointmentId != null) {
        const appointment = await appointmentInStudio(database, user, id(input.appointmentId)!);
        if (user.role === "collaborator" && appointment.artistId !== user.artistId) throw denied();
      }
    }
    if (input.referenceFromProcedureId != null) {
      const source = await requireSessionRecord(database, user, id(input.referenceFromProcedureId)!);
      if (source.clientId !== input.clientId) throw denied();
    }
    if (input.inventoryItemId != null) {
      const [material] = await database.select({ id: schema.materials.id }).from(schema.materials)
        .where(and(eq(schema.materials.id, id(input.inventoryItemId)!), eq(schema.materials.studioId, user.studioId!))).limit(1);
      if (!material) throw denied();
    }
    return true;
  }

  let record: { clientId: number | null; appointmentId?: number | null } | undefined;
  if (input.id != null) {
    const recordId = id(input.id)!;
    if (root === "transactions") {
      [record] = await database.select().from(schema.transactions)
        .where(and(eq(schema.transactions.id, recordId), eq(schema.transactions.studioId, user.studioId!))).limit(1);
    } else if (root === "notes") {
      [record] = await database.select().from(schema.clientNotes).where(eq(schema.clientNotes.id, recordId)).limit(1);
    } else {
      [record] = await database.select().from(schema.galleryImages).where(eq(schema.galleryImages.id, recordId)).limit(1);
    }
    if (!record) throw denied();
    await clientRecord(database, user, record.clientId, record.appointmentId);
  }
  if (user.role === "collaborator" && path === "transactions.createWithMaterials" && Array.isArray(input.materials) && input.materials.length) throw denied();
  const changes = path === "transactions.update" ? object(input.data) : input;
  // Unknown fields are stripped by the route schema AFTER this middleware.
  // They must never manufacture an appointment-based access grant here.
  const acceptsAppointment = root !== "notes" &&
    ["transactions.create", "transactions.createWithMaterials", "transactions.update", "gallery.create", "gallery.uploadImage"].includes(path);
  if (record || changes.clientId != null || changes.appointmentId != null || type === "mutation") {
    await clientRecord(database, user,
      changes.clientId === undefined ? record?.clientId ?? null : id(changes.clientId),
      !acceptsAppointment || changes.appointmentId === undefined ? record?.appointmentId ?? null : id(changes.appointmentId));
  }
  return true;
}

/** Match the same parent-link checks for lists and aggregates, without inferring artists. */
export function sessionAccessScope(user: RecordActor): SQL | undefined {
  const procedure = schema.technicalProcedures;
  return and(
    eq(procedure.studioId, user.studioId ?? -1),
    user.role === "collaborator" ? eq(procedure.artistId, user.artistId ?? -1) : undefined,
    sql`EXISTS (SELECT 1 FROM clients c WHERE c.id = ${procedure.clientId} AND c.studioId = ${procedure.studioId})`,
    sql`(${procedure.artistId} IS NULL OR EXISTS (SELECT 1 FROM artists a WHERE a.id = ${procedure.artistId} AND a.studioId = ${procedure.studioId}))`,
    sql`(${procedure.appointmentId} IS NULL OR EXISTS (SELECT 1 FROM appointments ap WHERE ap.id = ${procedure.appointmentId}
      AND ap.studioId = ${procedure.studioId} AND ap.clientId = ${procedure.clientId}
      AND (${procedure.artistId} IS NULL OR ap.artistId IS NULL OR ap.artistId = ${procedure.artistId})))`,
  );
}
export function sessionReview<T extends { artistId: number | null }>(procedure: T) {
  return { ...procedure, requiresArtistReview: procedure.artistId == null };
}
