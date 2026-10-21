import { formatAppointmentDateTime } from "../../shared/appointmentTime";
import { database } from "../commitments/db";
import { getClientById } from "../db";
import { firstName } from "./messagePresentation";
import { getActiveIntegration, sendAndLog } from "./service";

/** Called only after the new appointment time has been saved. Delivery is durable
 * in the normal WhatsApp queue; a delivery problem must not undo the appointment. */
export async function queueAppointmentRescheduleNotice(input: {
  studioId: number;
  appointmentId: number;
  clientId: number;
  previousDate: string;
  date: string;
  service: string;
  artist: string;
  idempotencyKey: string;
}): Promise<string | null> {
  if (input.previousDate === input.date) return null;
  try {
    const client = await getClientById(input.clientId);
    if (!client || client.studioId !== input.studioId)
      return "Horário salvo. Não foi possível identificar o cliente para enviar o aviso.";
    if (!client.phone)
      return "Horário salvo. O cliente não possui WhatsApp cadastrado.";
    const integration = await getActiveIntegration(input.studioId);
    if (!integration) throw new Error("Sem conexão");
    const [consents]: any = await database().query(
      "SELECT has_whatsapp_opt_in,opted_out_at FROM integration_contacts WHERE studio_id=? AND client_id=? AND integration_id=?",
      [input.studioId, client.id, integration.id]
    );
    if (!consents[0]?.has_whatsapp_opt_in || consents[0].opted_out_at)
      return "Horário salvo. O aviso não foi enviado porque o cliente não possui autorização ativa para receber WhatsApp.";
    const result = await sendAndLog({
      studioId: input.studioId,
      integrationId: integration.id,
      recipientType: "client",
      recipientPhone: client.phone,
      recipientName: firstName(client.name),
      clientId: client.id,
      appointmentId: input.appointmentId,
      trigger: "appointment_rescheduled",
      message: `Olá, ${firstName(client.name)}! Seu agendamento foi alterado.\nDe: ${formatAppointmentDateTime(input.previousDate)}\nPara: ${formatAppointmentDateTime(input.date)}\nServiço: ${input.service}\nArtista: ${input.artist}`,
      idempotencyKey: input.idempotencyKey,
    });
    if (!result.success) throw new Error("Fila indisponível");
    return null;
  } catch {
    return "Horário salvo. O aviso não foi enfileirado; confira a conexão do WhatsApp antes de avisar o cliente.";
  }
}
