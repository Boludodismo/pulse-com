import { createHash } from "node:crypto";
import { TRPCError } from "@trpc/server";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import {
  appointmentPlannedMaterials,
  appointments,
  clients,
  tenantMaterials,
} from "../../drizzle/schema";
import {
  appointmentKitOperations,
  appointmentMaterialKits,
} from "../../drizzle/appointmentKitSchema";
import { materialUnitKey } from "../../shared/appointmentKit";
import {
  assertOwnArtist,
  isInventoryManager,
  requireMaterialForArtist,
  type InventoryDatabase,
} from "../inventoryAccess";
import { hasModulePermission } from "../saas";
import {
  workflowDb,
  type WorkflowContext,
  type WorkflowDb,
} from "../inventoryWorkflowDb";
import { quantity, units } from "../inventoryWorkflowRules";
import { syncMaterialRegistrationNotices } from "../materialRegistrationNotices";
import { queueCriticalForecastAlerts } from "../inventoryForecast";
import { router, tenantProcedure } from "../_core/trpc";

const idSchema = z.number().int().positive();
const itemSchema = z
  .object({
    tenantMaterialId: idSchema.optional(),
    name: z.string().trim().min(2).max(255).optional(),
    unit: z.string().trim().min(1).max(50).optional(),
    quantity: z
      .string()
      .regex(/^\d{1,9}(?:\.\d{1,3})?$/)
      .refine(q => Number(q) > 0),
  })
  .refine(
    i => Boolean(i.tenantMaterialId || (i.name && i.unit)),
    "Informe o material, a unidade e a quantidade."
  );
async function access(ctx: WorkflowContext, write = false) {
  if (isInventoryManager(ctx)) return;
  if (
    !(await hasModulePermission({
      userId: ctx.user.id,
      studioId: ctx.studioId,
      module: "appointments",
      write,
    }))
  )
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Você não possui permissão para este planejamento.",
    });
}
async function appointmentForKit(
  db: WorkflowDb,
  ctx: WorkflowContext,
  id: number,
  write = false
) {
  const query = db
    .select()
    .from(appointments)
    .where(
      and(eq(appointments.id, id), eq(appointments.studioId, ctx.studioId))
    )
    .limit(1);
  const [appointment] = await (write ? query.for("update") : query);
  if (!appointment)
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Agendamento não encontrado.",
    });
  assertOwnArtist(ctx, appointment.artistId);
  if (
    write &&
    (!appointment.artistId ||
      ["cancelado", "concluido"].includes(appointment.status))
  )
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Defina o artista em um agendamento ativo para preparar o kit.",
    });
  return appointment;
}
export const appointmentKitsRouter = router({
  get: tenantProcedure
    .input(z.object({ appointmentId: idSchema }))
    .query(async ({ ctx, input }) => {
      await access(ctx);
      const db = await workflowDb();
      await appointmentForKit(db, ctx, input.appointmentId);
      return (
        (
          await db
            .select()
            .from(appointmentMaterialKits)
            .where(
              and(
                eq(appointmentMaterialKits.studioId, ctx.studioId),
                eq(appointmentMaterialKits.appointmentId, input.appointmentId)
              )
            )
            .limit(1)
        )[0] ?? null
      );
    }),
  save: tenantProcedure
    .input(
      z
        .object({
          appointmentId: idSchema,
          operationKey: z.string().uuid(),
          name: z.string().trim().min(2).max(160).optional(),
          items: z.array(itemSchema).max(100),
        })
        .refine(
          i => i.name || i.items.length,
          "Informe um nome ou adicione materiais ao kit."
        )
    )
    .mutation(async ({ ctx, input }) => {
      await access(ctx, true);
      const db = await workflowDb();
      const payloadHash = createHash("sha256")
        .update(JSON.stringify(input))
        .digest("hex");
      const result = await db.transaction(async tx => {
        const appointment = await appointmentForKit(
          tx,
          ctx,
          input.appointmentId,
          true
        );
        const [operation] = await tx
          .select()
          .from(appointmentKitOperations)
          .where(
            and(
              eq(appointmentKitOperations.studioId, ctx.studioId),
              eq(appointmentKitOperations.operationKey, input.operationKey)
            )
          )
          .limit(1);
        if (operation) {
          if (
            operation.appointmentId !== appointment.id ||
            operation.payloadHash !== payloadHash
          )
            throw new TRPCError({
              code: "CONFLICT",
              message:
                "Esta gravação já foi utilizada com outros dados. Atualize o kit.",
            });
          return { appointmentId: appointment.id, alreadySaved: true };
        }
        const rows: Array<typeof appointmentPlannedMaterials.$inferInsert> = [];
        for (const item of input.items) {
          const [material] = item.tenantMaterialId
            ? await tx
                .select()
                .from(tenantMaterials)
                .where(
                  and(
                    eq(tenantMaterials.id, item.tenantMaterialId),
                    eq(tenantMaterials.studioId, ctx.studioId),
                    eq(tenantMaterials.isActive, 1)
                  )
                )
                .limit(1)
            : [];
          if (item.tenantMaterialId && !material)
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "Um material não está mais disponível. Revise o kit.",
            });
          if (material)
            await requireMaterialForArtist(
              tx as unknown as InventoryDatabase,
              ctx,
              material,
              appointment.artistId
            );
          rows.push({
            studioId: ctx.studioId,
            appointmentId: appointment.id,
            tenantMaterialId: material?.id ?? null,
            catalogItemId: material?.catalogItemId ?? null,
            nameSnapshot: material?.name ?? item.name!,
            unitSnapshot: material?.unit ?? item.unit!,
            quantityPlanned: quantity(units(item.quantity)),
            createdByUserId: ctx.user.id,
          });
        }
        const [existing] = await tx
          .select()
          .from(appointmentMaterialKits)
          .where(
            and(
              eq(appointmentMaterialKits.studioId, ctx.studioId),
              eq(appointmentMaterialKits.appointmentId, appointment.id)
            )
          )
          .limit(1);
        const [client] = await tx
          .select({ name: clients.name })
          .from(clients)
          .where(
            and(
              eq(clients.id, appointment.clientId),
              eq(clients.studioId, ctx.studioId)
            )
          )
          .limit(1);
        const name =
          input.name ??
          existing?.name ??
          `Kit de ${client?.name.trim().split(/\s+/)[0] || "cliente"}`;
        await tx
          .insert(appointmentMaterialKits)
          .values({
            studioId: ctx.studioId,
            appointmentId: appointment.id,
            name,
            createdByUserId: ctx.user.id,
          })
          .onDuplicateKeyUpdate({ set: { name } });
        if (rows.length)
          await tx.insert(appointmentPlannedMaterials).values(rows);
        await tx.insert(appointmentKitOperations).values({
          studioId: ctx.studioId,
          appointmentId: appointment.id,
          operationKey: input.operationKey,
          payloadHash,
          kind: "save",
          createdByUserId: ctx.user.id,
        });
        await syncMaterialRegistrationNotices(tx, ctx.studioId, appointment.id);
        return { appointmentId: appointment.id, alreadySaved: false };
      });
      // A provider failure must not turn a committed kit into a failed save.
      for (const id of Array.from(
        new Set(
          input.items.flatMap(i =>
            i.tenantMaterialId ? [i.tenantMaterialId] : []
          )
        )
      )) {
        try {
          await queueCriticalForecastAlerts(
            db,
            ctx.studioId,
            input.appointmentId,
            id
          );
        } catch {
          console.error(
            "[Inventory] Previsão do kit será conferida pelo próximo ciclo."
          );
        }
      }
      return result;
    }),
  linkMaterial: tenantProcedure
    .input(
      z.object({
        appointmentId: idSchema,
        plannedMaterialId: idSchema,
        tenantMaterialId: idSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      await access(ctx, true);
      const db = await workflowDb();
      await db.transaction(async tx => {
        const appointment = await appointmentForKit(
          tx,
          ctx,
          input.appointmentId,
          true
        );
        const [planned] = await tx
          .select()
          .from(appointmentPlannedMaterials)
          .where(
            and(
              eq(appointmentPlannedMaterials.id, input.plannedMaterialId),
              eq(appointmentPlannedMaterials.studioId, ctx.studioId),
              eq(appointmentPlannedMaterials.appointmentId, appointment.id)
            )
          )
          .limit(1)
          .for("update");
        if (!planned || planned.status !== "planejado")
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Item pendente não encontrado ou já utilizado.",
          });
        if (planned.tenantMaterialId === input.tenantMaterialId) return;
        if (planned.tenantMaterialId)
          throw new TRPCError({
            code: "CONFLICT",
            message: "O item já foi vinculado a outro material.",
          });
        const [material] = await tx
          .select()
          .from(tenantMaterials)
          .where(
            and(
              eq(tenantMaterials.id, input.tenantMaterialId),
              eq(tenantMaterials.studioId, ctx.studioId),
              eq(tenantMaterials.isActive, 1)
            )
          )
          .limit(1);
        if (!material)
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Material não encontrado.",
          });
        await requireMaterialForArtist(
          tx as unknown as InventoryDatabase,
          ctx,
          material,
          appointment.artistId
        );
        if (
          materialUnitKey(planned.unitSnapshot) !==
          materialUnitKey(material.unit)
        )
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              "As unidades são diferentes. Revise a quantidade e a unidade do material previsto antes de vinculá-lo.",
          });
        await tx
          .update(appointmentPlannedMaterials)
          .set({
            tenantMaterialId: material.id,
            catalogItemId: material.catalogItemId,
            nameSnapshot: material.name,
            unitSnapshot: material.unit,
          })
          .where(
            and(
              eq(appointmentPlannedMaterials.id, planned.id),
              isNull(appointmentPlannedMaterials.tenantMaterialId)
            )
          );
        await syncMaterialRegistrationNotices(tx, ctx.studioId, appointment.id);
      });
      try {
        await queueCriticalForecastAlerts(
          db,
          ctx.studioId,
          input.appointmentId,
          input.tenantMaterialId
        );
      } catch {
        console.error(
          "[Inventory] Previsão será conferida pelo próximo ciclo."
        );
      }
      return { id: input.plannedMaterialId };
    }),
});
