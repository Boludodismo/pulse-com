import { and, eq } from "drizzle-orm";
import {
  artists,
  studios,
  appointmentPlannedMaterials,
  appointments,
} from "../drizzle/schema";
import { hoursUntil } from "./inventoryWorkflowRules";
import {
  inventoryAlertPreferences,
  inventoryLoans,
  inventoryNotices,
} from "../drizzle/inventoryWorkflowSchema";
import type { WorkflowDb } from "./inventoryWorkflowDb";
import { normalizeBrazilianPhone } from "./messaging/phone";

/** Staff notifications have an explicit recipient opt-in; client consent is never reused. */
export async function inventoryNoticeDeliveryError(
  db: WorkflowDb,
  studioId: number,
  noticeId: number,
  phone: string,
  message: string
) {
  const [notice] = await db
    .select()
    .from(inventoryNotices)
    .where(
      and(
        eq(inventoryNotices.id, noticeId),
        eq(inventoryNotices.studioId, studioId)
      )
    )
    .limit(1);
  if (
    !notice ||
    notice.resolvedAt ||
    message !== `${notice.title}\n${notice.message}`
  )
    return "Aviso de materiais inexistente, atualizado ou resolvido.";
  const [preference] = await db
    .select()
    .from(inventoryAlertPreferences)
    .where(
      and(
        eq(inventoryAlertPreferences.studioId, studioId),
        eq(inventoryAlertPreferences.recipientKey, notice.recipientKey)
      )
    )
    .limit(1);
  if (preference?.whatsappEnabled !== 1 || !preference.whatsappOptedInAt)
    return "O destinatário não ativou os avisos de materiais por WhatsApp.";
  const [recipient] =
    notice.recipientArtistId == null
      ? await db
          .select({ phone: studios.phone })
          .from(studios)
          .where(eq(studios.id, studioId))
          .limit(1)
      : await db
          .select({ phone: artists.phone })
          .from(artists)
          .where(
            and(
              eq(artists.id, notice.recipientArtistId),
              eq(artists.studioId, studioId),
              eq(artists.active, 1)
            )
          )
          .limit(1);
  if (
    !recipient?.phone ||
    normalizeBrazilianPhone(recipient.phone) !== normalizeBrazilianPhone(phone)
  )
    return "O telefone do destinatário foi alterado ou o artista está inativo.";
  if (notice.kind === "forecast") {
    const { forecastAppointmentMaterial } = await import("./inventoryForecast");
    const forecast =
      notice.appointmentId && notice.materialId
        ? await forecastAppointmentMaterial(
            db,
            studioId,
            notice.appointmentId,
            notice.materialId
          )
        : null;
    if (
      !forecast?.critical ||
      !notice.eventKey.includes(forecast.appointment.date) ||
      (notice.recipientArtistId != null &&
        notice.recipientArtistId !== forecast.appointment.artistId)
    )
      return "A previsão foi resolvida ou o agendamento mudou.";
  }
  if (notice.kind === "material_registration") {
    const plannedId = Number(
      /^material-registration:(\d+):/.exec(notice.eventKey)?.[1] ?? 0
    );
    const [row] = await db
      .select({
        materialId: appointmentPlannedMaterials.tenantMaterialId,
        quantity: appointmentPlannedMaterials.quantityPlanned,
        plannedStatus: appointmentPlannedMaterials.status,
        artistId: appointments.artistId,
        date: appointments.date,
        status: appointments.status,
      })
      .from(appointmentPlannedMaterials)
      .innerJoin(
        appointments,
        and(
          eq(appointments.id, appointmentPlannedMaterials.appointmentId),
          eq(appointments.studioId, studioId)
        )
      )
      .where(
        and(
          eq(appointmentPlannedMaterials.id, plannedId),
          eq(appointmentPlannedMaterials.studioId, studioId)
        )
      )
      .limit(1);
    if (
      !row ||
      row.materialId != null ||
      row.plannedStatus !== "planejado" ||
      ["cancelado", "concluido"].includes(row.status) ||
      hoursUntil(row.date) < 0 ||
      row.artistId !== notice.recipientArtistId ||
      !notice.eventKey.includes(`:${row.date}:${row.quantity}:`)
    )
      return "A pendência de material foi resolvida ou o agendamento mudou.";
  }
  if (notice.loanId) {
    const [loan] = await db
      .select()
      .from(inventoryLoans)
      .where(
        and(
          eq(inventoryLoans.id, notice.loanId),
          eq(inventoryLoans.studioId, studioId)
        )
      )
      .limit(1);
    if (!loan) return "Empréstimo não encontrado.";
    if (
      notice.eventKey.includes(":deadline:") &&
      (loan.status !== "delivered" ||
        !notice.eventKey.includes(`:${loan.dueAt}:${loan.quantitySettled}:`))
    )
      return "O prazo ou a reposição do empréstimo já foi atualizado.";
    if (
      (notice.eventKey.endsWith(":requested") && loan.status !== "requested") ||
      (notice.eventKey.endsWith(":approved") && loan.status !== "approved")
    )
      return "A solicitação de empréstimo já avançou para outra etapa.";
  }
  return null;
}
