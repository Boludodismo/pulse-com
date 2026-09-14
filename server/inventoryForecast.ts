import { syncMaterialRegistrationNotices } from "./materialRegistrationNotices";
import { and, asc, eq, gte, inArray, isNull, lte } from "drizzle-orm";
import {
  appointmentPlannedMaterials,
  appointments,
  inventoryBatches,
  tenantMaterials,
  studioMaterialArtists,
} from "../drizzle/schema";
import { inventoryNotices } from "../drizzle/inventoryWorkflowSchema";
import { canUseMaterial } from "./inventoryAccess";
import {
  addInventoryNotice,
  createLoanDeadlineNotices,
  deliverInventoryNotices,
  leadHoursFor,
} from "./inventoryNotices";
import {
  formatInventoryDate,
  hoursUntil,
  quantity,
  stockProjection,
  studioNow,
  units,
  utcNow,
} from "./inventoryWorkflowRules";
import { workflowDb, type WorkflowDb } from "./inventoryWorkflowDb";

export async function materialForecast(
  db: WorkflowDb,
  studioId: number,
  date: string,
  materialId: number,
  extra: string[] = [],
  artistId: number | null = null
) {
  const [material] = await db
    .select()
    .from(tenantMaterials)
    .where(
      and(
        eq(tenantMaterials.id, materialId),
        eq(tenantMaterials.studioId, studioId)
      )
    )
    .limit(1);
  if (!material) return null;
  const demand = await db
    .select({ quantity: appointmentPlannedMaterials.quantityPlanned })
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
        eq(appointmentPlannedMaterials.studioId, studioId),
        eq(appointmentPlannedMaterials.tenantMaterialId, materialId),
        eq(appointmentPlannedMaterials.status, "planejado"),
        inArray(appointments.status, ["agendado", "confirmado", "reagendado"]),
        gte(appointments.date, studioNow()),
        lte(appointments.date, date)
      )
    );
  const batches = await db
    .select()
    .from(inventoryBatches)
    .where(
      and(
        eq(inventoryBatches.studioId, studioId),
        eq(inventoryBatches.tenantMaterialId, materialId)
      )
    );
  const tracked = batches.reduce((n, b) => n + units(b.remainingQuantity), 0);
  const expired =
    batches.reduce(
      (n, b) =>
        n +
        (b.expiresAt && b.expiresAt < date ? units(b.remainingQuantity) : 0),
      0
    ) +
    (material.expiresAt && material.expiresAt < date
      ? Math.max(0, units(material.currentQuantity) - tracked)
      : 0);
  const allocations = await db
    .select({ artistId: studioMaterialArtists.artistId })
    .from(studioMaterialArtists)
    .where(
      and(
        eq(studioMaterialArtists.studioId, studioId),
        eq(studioMaterialArtists.tenantMaterialId, materialId)
      )
    );
  const authorized =
    material.isActive === 1 &&
    canUseMaterial(
      material.ownerArtistId,
      allocations.map(a => a.artistId),
      artistId
    );
  const available = authorized
    ? Math.max(0, units(material.currentQuantity) - expired)
    : 0;
  return {
    material,
    availableQuantity: available / 1000,
    expiredQuantity: expired / 1000,
    authorized,
    ...stockProjection(
      quantity(available),
      [...demand.map(r => r.quantity), ...extra],
      material.minimumQuantity
    ),
  };
}
export async function forecastAppointmentMaterial(
  db: WorkflowDb,
  studioId: number,
  appointmentId: number,
  materialId: number
) {
  const [appointment] = await db
    .select({
      id: appointments.id,
      date: appointments.date,
      artistId: appointments.artistId,
      artist: appointments.artist,
      status: appointments.status,
    })
    .from(appointments)
    .where(
      and(
        eq(appointments.id, appointmentId),
        eq(appointments.studioId, studioId)
      )
    )
    .limit(1);
  if (
    !appointment ||
    ["concluido", "cancelado"].includes(appointment.status) ||
    hoursUntil(appointment.date) < 0
  )
    return null;
  const forecast = await materialForecast(
    db,
    studioId,
    appointment.date,
    materialId,
    [],
    appointment.artistId
  );
  return forecast ? { appointment, ...forecast } : null;
}
export async function queueCriticalForecastAlerts(
  db: WorkflowDb,
  studioId: number,
  appointmentId: number,
  materialId: number
) {
  const forecast = await forecastAppointmentMaterial(
    db,
    studioId,
    appointmentId,
    materialId
  );
  const existing = await db
    .select()
    .from(inventoryNotices)
    .where(
      and(
        eq(inventoryNotices.studioId, studioId),
        eq(inventoryNotices.appointmentId, appointmentId),
        eq(inventoryNotices.materialId, materialId),
        eq(inventoryNotices.kind, "forecast")
      )
    );
  const planned = await db
    .select({ id: appointmentPlannedMaterials.id })
    .from(appointmentPlannedMaterials)
    .where(
      and(
        eq(appointmentPlannedMaterials.studioId, studioId),
        eq(appointmentPlannedMaterials.appointmentId, appointmentId),
        eq(appointmentPlannedMaterials.tenantMaterialId, materialId),
        eq(appointmentPlannedMaterials.status, "planejado")
      )
    )
    .limit(1);
  const leadHours = forecast
    ? await leadHoursFor(db, studioId, forecast.appointment.artistId)
    : 48;
  const phase =
    forecast && hoursUntil(forecast.appointment.date) <= leadHours
      ? "soon"
      : "initial";
  const state = forecast
    ? `${forecast.appointment.date}:${forecast.level}:${phase}:${forecast.appointment.artistId}`
    : "resolved";
  const active = existing.filter(n => !n.resolvedAt);
  for (const n of active) {
    if (!forecast?.critical || !planned.length || !n.eventKey.includes(state))
      await db
        .update(inventoryNotices)
        .set({ resolvedAt: utcNow() })
        .where(eq(inventoryNotices.id, n.id));
  }
  if (
    !forecast?.critical ||
    !planned.length ||
    active.some(n => n.eventKey.includes(state))
  )
    return forecast;
  const generation = Math.max(0, ...existing.map(n => n.id)) + 1;
  const when = formatInventoryDate(forecast.appointment.date);
  const title =
    forecast.level === "shortage"
      ? "Material insuficiente para a sessão"
      : "Atenção à reposição antes da sessão";
  const message = `${forecast.material.name} · ${forecast.appointment.artist || "Artista"} · ${when}. Saldo previsto: ${forecast.projectedQuantity.toFixed(3)} ${forecast.material.unit}. Reposição sugerida: ${forecast.replenishmentQuantity.toFixed(3)} ${forecast.material.unit}.${!forecast.authorized ? " Material inativo ou não disponibilizado para este artista: revise o planejamento." : ""}${forecast.expiredQuantity > 0 ? " Materiais vencidos até a sessão foram desconsiderados." : ""} Confira o planejamento e os empréstimos no estoque.`;
  // Shared studio supplies must warn every affected artist, not just the first appointment.
  for (const artistId of Array.from(new Set([null, forecast.appointment.artistId])))
    await addInventoryNotice(db, {
      studioId,
      recipientArtistId: artistId,
      eventKey: `forecast:${appointmentId}:${materialId}:${state}:${generation}`,
      kind: "forecast",
      severity: forecast.level === "shortage" ? "danger" : "warning",
      appointmentId,
      materialId,
      title,
      message,
    });
  return forecast;
}
export async function runCriticalInventoryForecastCycle() {
  const db = await workflowDb();
  const rows = await db
    .select({
      studioId: appointmentPlannedMaterials.studioId,
      appointmentId: appointmentPlannedMaterials.appointmentId,
      materialId: appointmentPlannedMaterials.tenantMaterialId,
    })
    .from(appointmentPlannedMaterials)
    .innerJoin(
      appointments,
      and(
        eq(appointments.id, appointmentPlannedMaterials.appointmentId),
        eq(appointments.studioId, appointmentPlannedMaterials.studioId)
      )
    )
    .where(
      and(
        eq(appointmentPlannedMaterials.status, "planejado"),
        inArray(appointments.status, ["agendado", "confirmado", "reagendado"]),
        gte(appointments.date, studioNow())
      )
    )
    .orderBy(asc(appointments.date));
  const pending = await db
    .select({
      studioId: inventoryNotices.studioId,
      appointmentId: inventoryNotices.appointmentId,
      materialId: inventoryNotices.materialId,
    })
    .from(inventoryNotices)
    .where(
      and(
        eq(inventoryNotices.kind, "forecast"),
        isNull(inventoryNotices.resolvedAt)
      )
    );
  const unique = new Map(
    [...rows, ...pending]
      .filter(r => r.appointmentId && r.materialId)
      .map(r => [`${r.studioId}:${r.appointmentId}:${r.materialId}`, r])
  );
  for (const row of Array.from(unique.values()))
    await queueCriticalForecastAlerts(
      db,
      row.studioId,
      row.appointmentId!,
      row.materialId!
    );
  await syncMaterialRegistrationNotices(db);
  await createLoanDeadlineNotices(db);
  await deliverInventoryNotices(db);
  return { checked: unique.size };
}
