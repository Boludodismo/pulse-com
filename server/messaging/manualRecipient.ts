import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { appointments, clients } from "../../drizzle/schema";
import { getDb } from "../db";
import { normalizeBrazilianPhone } from "./phone";

/** Resolve a identidade no servidor, sem confiar no vínculo enviado pelo navegador. */
export async function resolveManualRecipient(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
  studioId: number,
  input: { appointmentId?: number; clientId?: number; recipientPhone: string },
) {
  let clientId = input.clientId;
  if (input.appointmentId != null) {
    const appointment = (await db.select({ clientId: appointments.clientId }).from(appointments)
      .where(and(eq(appointments.id, input.appointmentId), eq(appointments.studioId, studioId))).limit(1))[0];
    if (!appointment) throw new TRPCError({ code: "NOT_FOUND", message: "Agendamento não encontrado nesta empresa." });
    if (clientId != null && clientId !== appointment.clientId) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "O cliente não corresponde ao agendamento." });
    }
    clientId = appointment.clientId;
  }
  if (!clientId) throw new TRPCError({ code: "BAD_REQUEST", message: "Selecione um cliente cadastrado para enviar pela integração." });
  const client = (await db.select({ id: clients.id, name: clients.name, phone: clients.phone }).from(clients)
    .where(and(eq(clients.id, clientId), eq(clients.studioId, studioId))).limit(1))[0];
  if (!client) throw new TRPCError({ code: "NOT_FOUND", message: "Cliente não encontrado nesta empresa." });
  let recipientPhone: string;
  let requestedPhone: string;
  try {
    recipientPhone = normalizeBrazilianPhone(client.phone ?? "");
    requestedPhone = normalizeBrazilianPhone(input.recipientPhone);
  } catch {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Informe um telefone brasileiro válido com DDD no cadastro do cliente." });
  }
  if (recipientPhone !== requestedPhone) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "O telefone não corresponde ao cadastro atual do cliente. Atualize o agendamento e tente novamente." });
  }
  return { clientId: client.id, recipientPhone, recipientName: client.name };
}
