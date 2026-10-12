import { TRPCError } from "@trpc/server";
import { and, asc, eq, gte, lt, ne, sql } from "drizzle-orm";
import {
  appointments,
  artists,
  clients,
  collaboratorRates,
  technicalProcedures,
  procedureConsumables,
} from "../drizzle/schema";
import { getDb } from "./db";
import { listUserPermissions } from "./saas";
import { router, tenantProcedure } from "./_core/trpc";

export function artistDashboardScope(user: {
  role: string;
  studioId?: number | null;
  artistId?: number | null;
}) {
  if (
    user.role !== "collaborator" ||
    !Number.isSafeInteger(user.studioId) ||
    !user.studioId ||
    user.studioId < 1 ||
    !Number.isSafeInteger(user.artistId) ||
    !user.artistId ||
    user.artistId < 1
  ) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Conta sem artista e estúdio vinculados.",
    });
  }
  return { studioId: user.studioId, artistId: user.artistId };
}
export function upcomingArtistBirthdays(
  rows: Array<{ id: number; name: string; birthDate: string | null }>,
  today: string
) {
  const start = new Date(today + "T12:00:00Z");
  return rows
    .flatMap(row => {
      if (!row.birthDate) return [];
      const suffix = row.birthDate.slice(5, 10);
      let date = new Date(`${start.getUTCFullYear()}-${suffix}T12:00:00Z`);
      if (date < start)
        date = new Date(`${start.getUTCFullYear() + 1}-${suffix}T12:00:00Z`);
      const days = Math.round((date.getTime() - start.getTime()) / 86400000);
      return days >= 0 && days <= 30
        ? [
            {
              id: row.id,
              name: row.name,
              date: date.toISOString().slice(0, 10),
              days,
            },
          ]
        : [];
    })
    .sort((a, b) => a.days - b.days);
}
export async function getArtistDashboard(user: {
  id: number;
  role: string;
  studioId?: number | null;
  artistId?: number | null;
}) {
  const { studioId, artistId } = artistDashboardScope(user);
  const database = await getDb();
  if (!database)
    throw new TRPCError({
      code: "SERVICE_UNAVAILABLE",
      message: "Não foi possível carregar o painel.",
    });
  const permissions = await listUserPermissions(user.id, studioId);
  const can = (module: string) =>
    permissions.some(p => p.module === module && !!p.canRead);
  const [artist] = await database
    .select({
      name: artists.name,
      photoUrl: artists.photoUrl,
      specialty: artists.specialty,
    })
    .from(artists)
    .where(and(eq(artists.studioId, studioId), eq(artists.id, artistId)))
    .limit(1);
  if (!artist)
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Artista não encontrado neste estúdio.",
    });
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const monthStart = today.slice(0, 7) + "-01 00:00:00";
  const next = new Date(today.slice(0, 7) + "-01T12:00:00Z");
  next.setUTCMonth(next.getUTCMonth() + 1);
  const monthEnd = next.toISOString().slice(0, 10) + " 00:00:00";
  const ownAppointments = and(
    eq(appointments.studioId, studioId),
    eq(appointments.artistId, artistId)
  );
  const monthAppointments = and(
    ownAppointments,
    gte(appointments.date, monthStart),
    lt(appointments.date, monthEnd),
    ne(appointments.status, "cancelado")
  );
  const ownClients = and(
    eq(clients.studioId, studioId),
    eq(clients.artistId, artistId),
    eq(clients.isArchived, 0)
  );
  const [clientRows, appointmentStats, upcoming, financial, pod] =
    await Promise.all([
      can("clients")
        ? database
            .select({
              id: clients.id,
              name: clients.name,
              birthDate: clients.birthDate,
            })
            .from(clients)
            .where(ownClients)
        : null,
      can("appointments")
        ? database
            .select({
              count: sql<number>`count(*)`,
              completed: sql<number>`sum(case when ${appointments.status} = 'concluido' then 1 else 0 end)`,
            })
            .from(appointments)
            .where(monthAppointments)
        : null,
      can("appointments")
        ? database
            .select({
              id: appointments.id,
              clientName: clients.name,
              date: appointments.date,
              service: appointments.service,
              status: appointments.status,
            })
            .from(appointments)
            .leftJoin(
              clients,
              and(
                eq(clients.id, appointments.clientId),
                eq(clients.studioId, studioId)
              )
            )
            .where(
              and(
                ownAppointments,
                gte(appointments.date, today + " 00:00:00"),
                ne(appointments.status, "cancelado"),
                ne(appointments.status, "concluido")
              )
            )
            .orderBy(asc(appointments.date))
            .limit(6)
        : null,
      can("finance")
        ? database
            .select({
              paid: sql<number>`coalesce(sum(${appointments.totalAmount}), 0)`,
            })
            .from(appointments)
            .where(
              and(monthAppointments, eq(appointments.paymentStatus, "pago"))
            )
        : null,
      can("pod")
        ? database
            .select({ sessions: sql<number>`count(*)` })
            .from(technicalProcedures)
            .where(
              and(
                eq(technicalProcedures.studioId, studioId),
                eq(technicalProcedures.artistId, artistId),
                gte(technicalProcedures.createdAt, monthStart),
                lt(technicalProcedures.createdAt, monthEnd)
              )
            )
        : null,
    ]);
  let finance = null;
  if (financial) {
    const [rate] = await database
      .select({ percentage: collaboratorRates.percentage })
      .from(collaboratorRates)
      .where(
        and(
          eq(collaboratorRates.studioId, studioId),
          eq(collaboratorRates.artistId, artistId)
        )
      )
      .limit(1);
    const paid = Number(financial[0]?.paid ?? 0);
    const percentage = rate?.percentage ?? 50;
    finance = {
      paid,
      percentage,
      earnings: Math.round((paid * percentage) / 100),
    };
  }
  let consumables = null;
  if (pod) {
    const [cost] = await database
      .select({
        total: sql<number>`coalesce(sum(${procedureConsumables.estimatedTotalCost}), 0)`,
      })
      .from(procedureConsumables)
      .innerJoin(
        technicalProcedures,
        eq(procedureConsumables.procedureId, technicalProcedures.id)
      )
      .where(
        and(
          eq(technicalProcedures.studioId, studioId),
          eq(technicalProcedures.artistId, artistId),
          gte(technicalProcedures.createdAt, monthStart),
          lt(technicalProcedures.createdAt, monthEnd)
        )
      );
    consumables = {
      sessions: Number(pod[0]?.sessions ?? 0),
      estimatedCost: Number(cost?.total ?? 0),
    };
  }
  const birthdays = clientRows
    ? upcomingArtistBirthdays(clientRows, today)
    : null;
  return {
    artist,
    today,
    totalClients: clientRows?.length ?? null,
    appointments: appointmentStats
      ? {
          count: Number(appointmentStats[0]?.count ?? 0),
          completed: Number(appointmentStats[0]?.completed ?? 0),
        }
      : null,
    upcoming,
    birthdays,
    finance,
    consumables,
  };
}
export const artistDashboardRouter = router({
  overview: tenantProcedure.query(({ ctx }) => getArtistDashboard(ctx.user)),
});
