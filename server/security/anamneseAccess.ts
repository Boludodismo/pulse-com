import { TRPCError } from "@trpc/server";
import type { User } from "../../drizzle/schema";
import * as db from "../db";
export async function assertAnamneseClient(
  user: User,
  clientId: number,
  appointmentId?: number | null
) {
  if (user.role === "collaborator" && !user.artistId)
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Colaborador sem artista vinculado.",
    });
  const client = await db.getClientById(clientId);
  if (
    !client ||
    (user.role !== "superadmin" &&
      (!user.studioId || client.studioId !== user.studioId))
  )
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Ficha não encontrada neste estúdio.",
    });
  if (
    user.role === "collaborator" &&
    (!user.artistId || client.artistId !== user.artistId)
  ) {
    const appointment = appointmentId
      ? await db.getAppointmentById(appointmentId)
      : null;
    if (
      !appointment ||
      appointment.clientId !== clientId ||
      appointment.studioId !== user.studioId ||
      appointment.artistId !== user.artistId
    )
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Ficha fora dos clientes ou agendamentos do artista.",
      });
  }
  return client;
}
export async function assertAnamneseRecord(
  user: User,
  id: number,
  submission = false
) {
  const record = submission
    ? await db.getAnamneseSubmissionById(id)
    : await db.getAnamnesisById(id);
  if (!record)
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Ficha não encontrada.",
    });
  await assertAnamneseClient(user, record.clientId, record.appointmentId);
  return record;
}
