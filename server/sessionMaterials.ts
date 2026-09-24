import { and, asc, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { appointmentPlannedMaterials, procedureEvents } from "../drizzle/schema";
import { preparationMaterial, readPreparation } from "../shared/sessionPreparation";
import { z } from "zod";
import type { getDb } from "./db";

type Database = NonNullable<Awaited<ReturnType<typeof getDb>>>;
type Procedure = { id: number; studioId: number; appointmentId: number | null };
const selection = z.array(preparationMaterial);

/** A prepared session wins even when its persisted selection is empty. */
export async function readSessionMaterials(db: Database, procedure: Procedure, lock = false) {
  const eventQuery = db.select().from(procedureEvents)
    .where(eq(procedureEvents.procedureId, procedure.id)).orderBy(asc(procedureEvents.id));
  const events = await (lock ? eventQuery.for("update") : eventQuery);
  const snapshot = events.find(e => e.eventType === "session_materials");
  const preparedEvent = events.find(e => e.eventType.startsWith("prepared:") || (e.eventType === "created" && readPreparation(e.payload)));
  // Older callers could use requestId without a preparation payload.
  const prepared = preparedEvent && !/^\{\s*"createdBy"\s*:/.test(preparedEvent.payload || "") ? preparedEvent : undefined;
  let items: z.infer<typeof selection>;
  try {
    if (snapshot) items = selection.parse(JSON.parse(snapshot.payload || "null"));
    else if (prepared) {
      const plan = readPreparation(prepared.payload);
      if (!plan) throw new Error("invalid preparation");
      items = plan.materials;
    } else {
      const rows = procedure.appointmentId ? await db.select().from(appointmentPlannedMaterials)
        .where(and(eq(appointmentPlannedMaterials.studioId, procedure.studioId), eq(appointmentPlannedMaterials.appointmentId, procedure.appointmentId))) : [];
      items = rows.filter(r => r.tenantMaterialId && r.status !== "nao_utilizado").map(r => ({
        tenantMaterialId: r.tenantMaterialId!, name: r.nameSnapshot, unit: r.unitSnapshot, quantity: r.quantityPlanned,
      }));
    }
    for (const event of events.filter(e => e.eventType === "session_material_added")) {
      const item = preparationMaterial.parse(JSON.parse(event.payload || "null"));
      if (!items.some(i => i.tenantMaterialId === item.tenantMaterialId)) items = [...items, item];
    }
  } catch {
    throw new TRPCError({ code: "CONFLICT", message: "Não foi possível ler os materiais persistidos desta sessão. Revise a preparação antes de registrar consumo." });
  }
  // Legacy appointment rows may repeat an item; preserve their combined quantity.
  const unique = new Map<number, typeof items[number]>();
  for (const item of items) {
    const prior = unique.get(item.tenantMaterialId);
    if (prior && prior.unit !== item.unit) throw new TRPCError({ code: "CONFLICT", message: "O planejamento contém unidades divergentes para o mesmo material." });
    unique.set(item.tenantMaterialId, prior ? { ...prior, quantity: (Number(prior.quantity) + Number(item.quantity)).toFixed(3) } : item);
  }
  return { materials: Array.from(unique.values()), hasSnapshot: Boolean(snapshot || prepared) };
}

/** Caller holds the procedure row lock. Selection alone never consumes stock. */
export async function snapshotSessionMaterials(db: Database, procedure: Procedure) {
  const result = await readSessionMaterials(db, procedure, true);
  if (!result.hasSnapshot) await db.insert(procedureEvents).values({
    procedureId: procedure.id, eventType: "session_materials", payload: JSON.stringify(result.materials),
  });
  return result.materials;
}
