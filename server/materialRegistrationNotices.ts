import { and, eq, isNull } from "drizzle-orm";
import {
  appointmentPlannedMaterials,
  appointments,
  clients,
} from "../drizzle/schema";
import { inventoryNotices } from "../drizzle/inventoryWorkflowSchema";
import { addInventoryNotice, leadHoursFor } from "./inventoryNotices";
import {
  formatInventoryDate,
  hoursUntil,
  utcNow,
} from "./inventoryWorkflowRules";
import type { WorkflowDb } from "./inventoryWorkflowDb";

export const registrationPlannedId = (key: string) =>
  Number(/^material-registration:(\d+):/.exec(key)?.[1] ?? 0);
export async function syncMaterialRegistrationNotices(
  db: WorkflowDb,
  studioId?: number,
  appointmentId?: number
) {
  const pending = await db
    .select({
      planned: appointmentPlannedMaterials,
      appointment: appointments,
      clientName: clients.name,
    })
    .from(appointmentPlannedMaterials)
    .innerJoin(
      appointments,
      and(
        eq(appointments.id, appointmentPlannedMaterials.appointmentId),
        eq(appointments.studioId, appointmentPlannedMaterials.studioId)
      )
    )
    .leftJoin(
      clients,
      and(
        eq(clients.id, appointments.clientId),
        eq(clients.studioId, appointments.studioId)
      )
    )
    .where(
      and(
        isNull(appointmentPlannedMaterials.tenantMaterialId),
        eq(appointmentPlannedMaterials.status, "planejado"),
        studioId ? eq(appointments.studioId, studioId) : undefined,
        appointmentId ? eq(appointments.id, appointmentId) : undefined
      )
    );
  const notices = await db
    .select()
    .from(inventoryNotices)
    .where(
      and(
        eq(inventoryNotices.kind, "material_registration"),
        studioId ? eq(inventoryNotices.studioId, studioId) : undefined,
        appointmentId
          ? eq(inventoryNotices.appointmentId, appointmentId)
          : undefined
      )
    );
  const valid = pending.filter(
    r =>
      r.appointment.artistId &&
      !["cancelado", "concluido"].includes(r.appointment.status) &&
      hoursUntil(r.appointment.date) >= 0
  );
  for (const notice of notices.filter(n => !n.resolvedAt)) {
    const row = valid.find(
      r =>
        r.planned.id === registrationPlannedId(notice.eventKey) &&
        r.appointment.artistId === notice.recipientArtistId
    );
    if (
      !row ||
      !notice.eventKey.includes(
        `:${row.appointment.date}:${row.planned.quantityPlanned}:`
      )
    )
      await db
        .update(inventoryNotices)
        .set({ resolvedAt: utcNow() })
        .where(eq(inventoryNotices.id, notice.id));
  }
  for (const row of valid) {
    const lead = await leadHoursFor(
      db,
      row.appointment.studioId,
      row.appointment.artistId
    );
    const phase = hoursUntil(row.appointment.date) <= lead ? "soon" : "initial";
    const prefix = `material-registration:${row.planned.id}:${row.appointment.date}:${row.planned.quantityPlanned}:${row.appointment.artistId}:${phase}:`;
    const history = notices.filter(
      n => registrationPlannedId(n.eventKey) === row.planned.id
    );
    if (history.some(n => !n.resolvedAt && n.eventKey.startsWith(prefix)))
      continue;
    // Resolve the early notice when the configured advance reminder takes over.
    for (const notice of history.filter(n => !n.resolvedAt))
      await db
        .update(inventoryNotices)
        .set({ resolvedAt: utcNow() })
        .where(eq(inventoryNotices.id, notice.id));
    const firstName = row.clientName?.trim().split(/\s+/)[0] || "Cliente";
    await addInventoryNotice(db, {
      studioId: row.appointment.studioId,
      recipientArtistId: row.appointment.artistId,
      appointmentId: row.appointment.id,
      kind: "material_registration",
      severity: "warning",
      eventKey: prefix + (Math.max(0, ...history.map(n => n.id)) + 1),
      title: "Material do kit pendente de cadastro",
      message: `${firstName} · ${row.appointment.artist} · ${formatInventoryDate(row.appointment.date)}. Cadastre ${row.planned.nameSnapshot} no estoque (${row.planned.quantityPlanned} ${row.planned.unitSnapshot} previstos) e vincule o material na aba Materiais / POD deste agendamento. O item ainda não representa saldo disponível.`,
    });
  }
}
