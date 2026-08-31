/**
 * POD Session — Módulo de Execução Técnica da Tatuagem
 * Router tRPC isolado. Não altera nenhum router existente.
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";

import { drizzle } from "drizzle-orm/mysql2";

async function requireDb(): Promise<ReturnType<typeof drizzle>> {
  const db = await getDb();
  if (!db)
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Banco de dados indisponível.",
    });
  return db as ReturnType<typeof drizzle>;
}
import {
  technicalProcedures,
  procedureConsumables,
  procedureImages,
  procedureEvents,
  materials,
  materialLots,
  stockMovements,
  appointments,
  transactions,
} from "../../drizzle/schema";
import {
  eq,
  and,
  desc,
  isNotNull,
  gte,
  lte,
  sql,
  inArray,
  type InferSelectModel,
} from "drizzle-orm";
import { storagePut } from "../storage";
// notifyOwner é importado dinamicamente para compatibilidade com o bundler Vite ESM

// ─── helpers ────────────────────────────────────────────────────────────────

function randomSuffix() {
  return Math.random().toString(36).substring(2, 10);
}

function assertProcedureOwner(
  procedure: { studioId: number } | undefined | null,
  studioId: number | null | undefined,
  procedureId: number,
) {
  if (!procedure) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Procedimento não encontrado.",
    });
  }
  if (studioId && procedure.studioId !== studioId) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Acesso negado a este procedimento.",
    });
  }
}

// ─── router ─────────────────────────────────────────────────────────────────

export const proceduresRouter = router({
  // ── Listar procedimentos de um cliente ──────────────────────────────────
  listByClient: protectedProcedure
    .input(z.object({ clientId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const studioId = ctx.user.studioId ?? 1;
      const db = await requireDb();
      const rows = await db
        .select()
        .from(technicalProcedures)
        .where(
          and(
            eq(technicalProcedures.clientId, input.clientId),
            eq(technicalProcedures.studioId, studioId),
          ),
        )
        .orderBy(desc(technicalProcedures.createdAt));
      if (!rows.length) return [];
      const consumables = await db
        .select()
        .from(procedureConsumables)
        .where(
          inArray(
            procedureConsumables.procedureId,
            rows.map((row) => row.id),
          ),
        )
        .orderBy(procedureConsumables.category, procedureConsumables.name);
      const byProcedure = new Map<number, typeof consumables>();
      for (const consumable of consumables) {
        const current = byProcedure.get(consumable.procedureId) ?? [];
        current.push(consumable);
        byProcedure.set(consumable.procedureId, current);
      }
      return rows.map((row) => ({
        ...row,
        consumables: byProcedure.get(row.id) ?? [],
      }));
    }),

  // ── Buscar procedimento por ID ───────────────────────────────────────────
  getById: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const studioId = ctx.user.studioId ?? 1;
      const db = await requireDb();
      const [procedure] = await db
        .select()
        .from(technicalProcedures)
        .where(eq(technicalProcedures.id, input.id))
        .limit(1);
      assertProcedureOwner(procedure, studioId, input.id);

      const consumables = await db
        .select()
        .from(procedureConsumables)
        .where(eq(procedureConsumables.procedureId, input.id))
        .orderBy(procedureConsumables.category, procedureConsumables.name);

      const images = await db
        .select()
        .from(procedureImages)
        .where(eq(procedureImages.procedureId, input.id))
        .orderBy(procedureImages.createdAt);

      return { procedure, consumables, images };
    }),

  // ── Criar novo procedimento ──────────────────────────────────────────────
  create: protectedProcedure
    .input(
      z.object({
        clientId: z.number().int().positive(),
        appointmentId: z.number().int().positive().optional().nullable(),
        artistId: z.number().int().positive().optional().nullable(),
        artistName: z.string().max(255).optional(),
        title: z.string().min(1).max(255),
        description: z.string().optional(),
        bodyLocation: z.string().max(100).optional(),
        tattooStyle: z.string().max(100).optional(),
        chargedAmount: z.number().int().min(0).optional(), // centavos
        notes: z.string().optional(),
        // Imagem de referência em base64 (opcional na criação)
        referenceImageBase64: z.string().optional(),
        referenceImageMime: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const studioId = ctx.user.studioId ?? 1;
      const db = await requireDb();
      let referenceImageUrl: string | undefined;
      let referenceImageKey: string | undefined;

      if (input.referenceImageBase64 && input.referenceImageMime) {
        const buffer = Buffer.from(input.referenceImageBase64, "base64");
        const ext = input.referenceImageMime.split("/")[1] || "jpg";
        const key = `procedures/${studioId}/ref-${randomSuffix()}.${ext}`;
        const { url } = await storagePut(key, buffer, input.referenceImageMime);
        referenceImageUrl = url;
        referenceImageKey = key;
      }

      const [result] = await db.insert(technicalProcedures).values({
        studioId,
        clientId: input.clientId,
        appointmentId: input.appointmentId ?? null,
        artistId: input.artistId ?? null,
        artistName: input.artistName ?? null,
        title: input.title,
        description: input.description ?? null,
        bodyLocation: input.bodyLocation ?? null,
        tattooStyle: input.tattooStyle ?? null,
        chargedAmount: input.chargedAmount ?? 0,
        notes: input.notes ?? null,
        referenceImageUrl: referenceImageUrl ?? null,
        referenceImageKey: referenceImageKey ?? null,
        status: "em_andamento",
      });

      const insertId = (result as any).insertId as number;

      // Registrar evento de criação
      await db.insert(procedureEvents).values({
        procedureId: insertId,
        eventType: "created",
        payload: JSON.stringify({
          createdBy: ctx.user.id,
          artistName: input.artistName,
        }),
      });

      const [created] = await db
        .select()
        .from(technicalProcedures)
        .where(eq(technicalProcedures.id, insertId))
        .limit(1);

      return created;
    }),

  // ── Atualizar dados gerais do procedimento ───────────────────────────────
  update: protectedProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        appointmentId: z.number().int().positive().optional().nullable(),
        title: z.string().min(1).max(255).optional(),
        description: z.string().optional(),
        bodyLocation: z.string().max(100).optional(),
        tattooStyle: z.string().max(100).optional(),
        chargedAmount: z.number().int().min(0).optional(),
        notes: z.string().optional(),
        artistId: z.number().int().positive().optional().nullable(),
        artistName: z.string().max(255).optional().nullable(),
        status: z
          .enum(["em_andamento", "pausado", "finalizado", "retorno", "retoque"])
          .optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const studioId = ctx.user.studioId ?? 1;
      const db = await requireDb();
      const [existing] = await db
        .select({ studioId: technicalProcedures.studioId })
        .from(technicalProcedures)
        .where(eq(technicalProcedures.id, input.id))
        .limit(1);
      assertProcedureOwner(existing, studioId, input.id);

      const { id, ...fields } = input;
      await db
        .update(technicalProcedures)
        .set(fields as any)
        .where(eq(technicalProcedures.id, id));

      const [updated] = await db
        .select()
        .from(technicalProcedures)
        .where(eq(technicalProcedures.id, id))
        .limit(1);
      return updated;
    }),

  // ── Controle de timer (iniciar / pausar / retomar / finalizar) ───────────
  timerAction: protectedProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        action: z.enum(["start", "pause", "resume", "finish"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const studioId = ctx.user.studioId ?? 1;
      const db = await requireDb();
      const [existing] = await db
        .select()
        .from(technicalProcedures)
        .where(eq(technicalProcedures.id, input.id))
        .limit(1);
      assertProcedureOwner(existing, studioId, input.id);

      const now = new Date().toISOString().slice(0, 19).replace("T", " ");
      const updates: Record<string, any> = {};

      if (input.action === "start") {
        updates.startedAt = now;
        updates.status = "em_andamento";
      } else if (input.action === "pause") {
        updates.pausedAt = now;
        updates.status = "pausado";
      } else if (input.action === "resume") {
        updates.pausedAt = null;
        updates.status = "em_andamento";
      } else if (input.action === "finish") {
        updates.finishedAt = now;
        updates.status = "finalizado";
        // Calcular duração total em minutos
        if (existing.startedAt) {
          const start = new Date(existing.startedAt).getTime();
          const end = new Date(now).getTime();
          updates.totalDurationMinutes = Math.round((end - start) / 60000);
        }
      }

      await db
        .update(technicalProcedures)
        .set(updates)
        .where(eq(technicalProcedures.id, input.id));

      // Registrar evento
      await db.insert(procedureEvents).values({
        procedureId: input.id,
        eventType: input.action,
        payload: JSON.stringify({ at: now }),
      });

      const [updated] = await db
        .select()
        .from(technicalProcedures)
        .where(eq(technicalProcedures.id, input.id))
        .limit(1);
      return updated;
    }),

  // ── Adicionar insumo ─────────────────────────────────────────────────────
  addConsumable: protectedProcedure
    .input(
      z.object({
        procedureId: z.number().int().positive(),
        category: z.enum([
          "ink",
          "cartridge",
          "disposable",
          "liquid",
          "protection",
          "stencil",
          "aftercare",
          "other",
        ]),
        name: z.string().min(1).max(255),
        unit: z
          .enum([
            "drop",
            "ml",
            "unit",
            "pair",
            "gram",
            "portion",
            "roll_fraction",
          ])
          .default("unit"),
        quantity: z.number().min(0),
        estimatedUnitCost: z.number().min(0).optional(), // em reais
        notes: z.string().optional(),
        inventoryItemId: z.number().int().positive().optional(),
        materialLotId: z.number().int().positive().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const studioId = ctx.user.studioId ?? 1;
      const db = await requireDb();
      const [proc] = await db
        .select({ studioId: technicalProcedures.studioId })
        .from(technicalProcedures)
        .where(eq(technicalProcedures.id, input.procedureId))
        .limit(1);
      assertProcedureOwner(proc, studioId, input.procedureId);

      return db.transaction(async (tx) => {
        let inventoryMaterial: typeof materials.$inferSelect | undefined;
        let selectedLot: typeof materialLots.$inferSelect | undefined;

        if (input.inventoryItemId) {
          [inventoryMaterial] = await tx
            .select()
            .from(materials)
            .where(
              and(
                eq(materials.id, input.inventoryItemId),
                eq(materials.isActive, 1),
              ),
            )
            .limit(1);
          if (!inventoryMaterial)
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "Material de estoque não encontrado.",
            });
          if (Number(inventoryMaterial.currentStock || 0) < input.quantity) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: `Estoque insuficiente para ${inventoryMaterial.name}.`,
            });
          }
        }

        if (input.materialLotId) {
          if (!input.inventoryItemId)
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "Selecione o material antes do lote.",
            });
          [selectedLot] = await tx
            .select()
            .from(materialLots)
            .where(
              and(
                eq(materialLots.id, input.materialLotId),
                eq(materialLots.materialId, input.inventoryItemId),
                eq(materialLots.isActive, 1),
              ),
            )
            .limit(1);
          if (!selectedLot)
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "Lote não encontrado para este material.",
            });
          if (Number(selectedLot.currentQuantity || 0) < input.quantity) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: `Saldo insuficiente no lote ${selectedLot.lotNumber}.`,
            });
          }
          if (
            selectedLot.expiresAt &&
            new Date(selectedLot.expiresAt).getTime() < Date.now()
          ) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: `O lote ${selectedLot.lotNumber} está vencido e não pode ser utilizado.`,
            });
          }
        }

        const unitCost =
          input.estimatedUnitCost ?? Number(inventoryMaterial?.avgPrice || 0);
        const totalCost = unitCost * input.quantity;
        const [result] = await tx.insert(procedureConsumables).values({
          procedureId: input.procedureId,
          inventoryItemId: input.inventoryItemId ?? null,
          materialLotId: selectedLot?.id ?? null,
          lotNumber: selectedLot?.lotNumber ?? null,
          expiresAt: selectedLot?.expiresAt ?? null,
          category: input.category,
          name: input.name,
          unit: input.unit,
          quantity: String(input.quantity),
          estimatedUnitCost: String(unitCost),
          estimatedTotalCost: String(totalCost),
          notes: input.notes ?? null,
        });
        const insertId = (result as any).insertId as number;

        if (inventoryMaterial) {
          const previousStock = Number(inventoryMaterial.currentStock || 0);
          const newStock = previousStock - input.quantity;
          await tx
            .update(materials)
            .set({ currentStock: String(newStock), updatedAt: Date.now() })
            .where(eq(materials.id, inventoryMaterial.id));
          if (selectedLot) {
            await tx
              .update(materialLots)
              .set({
                currentQuantity: String(
                  Number(selectedLot.currentQuantity) - input.quantity,
                ),
                updatedAt: Date.now(),
              })
              .where(eq(materialLots.id, selectedLot.id));
          }
          await tx.insert(stockMovements).values({
            materialId: inventoryMaterial.id,
            type: "saida",
            quantity: String(input.quantity),
            inputQuantity: String(input.quantity),
            inputUnit: inventoryMaterial.baseUnit || inventoryMaterial.unit,
            conversionFactor: "1",
            previousStock: String(previousStock),
            newStock: String(newStock),
            reason: `Utilizado na POD Session #${input.procedureId}`,
            lotNumber: selectedLot?.lotNumber,
            expiresAt: selectedLot?.expiresAt,
            source: "procedimento",
            createdBy: ctx.user.id,
            createdAt: Date.now(),
          });
        }

        await tx.insert(procedureEvents).values({
          procedureId: input.procedureId,
          eventType: "consumable_added",
          payload: JSON.stringify({
            name: input.name,
            quantity: input.quantity,
            unit: input.unit,
            lotNumber: selectedLot?.lotNumber,
          }),
        });
        const [created] = await tx
          .select()
          .from(procedureConsumables)
          .where(eq(procedureConsumables.id, insertId))
          .limit(1);
        return created;
      });
    }),

  // ── Atualizar quantidade de insumo ───────────────────────────────────────
  updateConsumable: protectedProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        procedureId: z.number().int().positive(),
        quantity: z.number().min(0),
        estimatedUnitCost: z.number().min(0).optional(),
        notes: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const studioId = ctx.user.studioId ?? 1;
      const db = await requireDb();
      const [proc] = await db
        .select({ studioId: technicalProcedures.studioId })
        .from(technicalProcedures)
        .where(eq(technicalProcedures.id, input.procedureId))
        .limit(1);
      assertProcedureOwner(proc, studioId, input.procedureId);

      const [existing] = await db
        .select()
        .from(procedureConsumables)
        .where(eq(procedureConsumables.id, input.id))
        .limit(1);

      if (!existing)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Insumo não encontrado.",
        });

      const unitCost =
        input.estimatedUnitCost ?? Number(existing.estimatedUnitCost ?? 0);
      const totalCost = unitCost * input.quantity;
      const quantityDelta = input.quantity - Number(existing.quantity || 0);

      if (existing.inventoryItemId && quantityDelta !== 0) {
        const [material] = await db
          .select()
          .from(materials)
          .where(eq(materials.id, existing.inventoryItemId))
          .limit(1);
        if (!material)
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Material de estoque não encontrado.",
          });
        const previousStock = Number(material.currentStock || 0);
        const newStock = previousStock - quantityDelta;
        if (newStock < 0)
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Estoque insuficiente para ${material.name}.`,
          });

        if (existing.materialLotId) {
          const [lot] = await db
            .select()
            .from(materialLots)
            .where(eq(materialLots.id, existing.materialLotId))
            .limit(1);
          if (!lot)
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "Lote do insumo não encontrado.",
            });
          const newLotStock = Number(lot.currentQuantity || 0) - quantityDelta;
          if (newLotStock < 0)
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: `Saldo insuficiente no lote ${lot.lotNumber}.`,
            });
          await db
            .update(materialLots)
            .set({
              currentQuantity: String(newLotStock),
              updatedAt: Date.now(),
            })
            .where(eq(materialLots.id, lot.id));
        }

        await db
          .update(materials)
          .set({ currentStock: String(newStock), updatedAt: Date.now() })
          .where(eq(materials.id, material.id));
        await db.insert(stockMovements).values({
          materialId: material.id,
          type: quantityDelta > 0 ? "saida" : "entrada",
          quantity: String(Math.abs(quantityDelta)),
          inputQuantity: String(Math.abs(quantityDelta)),
          inputUnit: material.baseUnit || material.unit,
          conversionFactor: "1",
          previousStock: String(previousStock),
          newStock: String(newStock),
          reason: `Ajuste de insumo na POD Session #${input.procedureId}`,
          lotNumber: existing.lotNumber,
          expiresAt: existing.expiresAt,
          source: "procedimento",
          createdBy: ctx.user.id,
          createdAt: Date.now(),
        });
      }

      await db
        .update(procedureConsumables)
        .set({
          quantity: String(input.quantity),
          estimatedUnitCost: String(unitCost),
          estimatedTotalCost: String(totalCost),
          notes: input.notes ?? existing.notes,
        })
        .where(eq(procedureConsumables.id, input.id));

      const [updated] = await db
        .select()
        .from(procedureConsumables)
        .where(eq(procedureConsumables.id, input.id))
        .limit(1);
      return updated;
    }),

  // ── Remover insumo ───────────────────────────────────────────────────────
  removeConsumable: protectedProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        procedureId: z.number().int().positive(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const studioId = ctx.user.studioId ?? 1;
      const db = await requireDb();
      const [proc] = await db
        .select({ studioId: technicalProcedures.studioId })
        .from(technicalProcedures)
        .where(eq(technicalProcedures.id, input.procedureId))
        .limit(1);
      assertProcedureOwner(proc, studioId, input.procedureId);

      const [existing] = await db
        .select()
        .from(procedureConsumables)
        .where(eq(procedureConsumables.id, input.id))
        .limit(1);
      if (!existing)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Insumo não encontrado.",
        });
      if (existing.inventoryItemId) {
        const [material] = await db
          .select()
          .from(materials)
          .where(eq(materials.id, existing.inventoryItemId))
          .limit(1);
        if (material) {
          const restoredQuantity = Number(existing.quantity || 0);
          const previousStock = Number(material.currentStock || 0);
          const newStock = previousStock + restoredQuantity;
          await db
            .update(materials)
            .set({ currentStock: String(newStock), updatedAt: Date.now() })
            .where(eq(materials.id, material.id));
          if (existing.materialLotId) {
            const [lot] = await db
              .select()
              .from(materialLots)
              .where(eq(materialLots.id, existing.materialLotId))
              .limit(1);
            if (lot)
              await db
                .update(materialLots)
                .set({
                  currentQuantity: String(
                    Number(lot.currentQuantity || 0) + restoredQuantity,
                  ),
                  updatedAt: Date.now(),
                })
                .where(eq(materialLots.id, lot.id));
          }
          await db.insert(stockMovements).values({
            materialId: material.id,
            type: "entrada",
            quantity: String(restoredQuantity),
            inputQuantity: String(restoredQuantity),
            inputUnit: material.baseUnit || material.unit,
            conversionFactor: "1",
            previousStock: String(previousStock),
            newStock: String(newStock),
            reason: `Estorno de insumo removido da POD Session #${input.procedureId}`,
            lotNumber: existing.lotNumber,
            expiresAt: existing.expiresAt,
            source: "procedimento",
            createdBy: ctx.user.id,
            createdAt: Date.now(),
          });
        }
      }

      await db
        .delete(procedureConsumables)
        .where(eq(procedureConsumables.id, input.id));

      return { success: true };
    }),

  // ── Upload de imagem do procedimento ────────────────────────────────────
  uploadImage: protectedProcedure
    .input(
      z.object({
        procedureId: z.number().int().positive(),
        imageBase64: z.string(),
        mimeType: z.string(),
        imageType: z
          .enum([
            "reference",
            "stencil",
            "progress",
            "final",
            "healed",
            "other",
          ])
          .default("other"),
        description: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const studioId = ctx.user.studioId ?? 1;
      const db = await requireDb();
      const [proc] = await db
        .select({ studioId: technicalProcedures.studioId })
        .from(technicalProcedures)
        .where(eq(technicalProcedures.id, input.procedureId))
        .limit(1);
      assertProcedureOwner(proc, studioId, input.procedureId);

      const buffer = Buffer.from(input.imageBase64, "base64");
      const ext = input.mimeType.split("/")[1] || "jpg";
      const key = `procedures/${studioId}/${input.procedureId}/${input.imageType}-${randomSuffix()}.${ext}`;
      const { url } = await storagePut(key, buffer, input.mimeType);

      const [result] = await db.insert(procedureImages).values({
        procedureId: input.procedureId,
        imageUrl: url,
        imageKey: key,
        imageType: input.imageType,
        description: input.description ?? null,
      });

      const insertId = (result as any).insertId as number;

      // Atualizar URL na tabela principal se for imagem de referência ou final
      if (input.imageType === "reference") {
        await db
          .update(technicalProcedures)
          .set({ referenceImageUrl: url, referenceImageKey: key })
          .where(eq(technicalProcedures.id, input.procedureId));
      } else if (input.imageType === "final") {
        await db
          .update(technicalProcedures)
          .set({ finalImageUrl: url, finalImageKey: key })
          .where(eq(technicalProcedures.id, input.procedureId));
      } else if (input.imageType === "healed") {
        await db
          .update(technicalProcedures)
          .set({ healedImageUrl: url, healedImageKey: key })
          .where(eq(technicalProcedures.id, input.procedureId));
      } else if (input.imageType === "stencil") {
        await db
          .update(technicalProcedures)
          .set({ stencilImageUrl: url, stencilImageKey: key })
          .where(eq(technicalProcedures.id, input.procedureId));
      }

      const [created] = await db
        .select()
        .from(procedureImages)
        .where(eq(procedureImages.id, insertId))
        .limit(1);
      return created;
    }),

  // ── Deletar procedimento ─────────────────────────────────────────────────
  delete: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const studioId = ctx.user.studioId ?? 1;
      const db = await requireDb();
      const [existing] = await db
        .select({ studioId: technicalProcedures.studioId })
        .from(technicalProcedures)
        .where(eq(technicalProcedures.id, input.id))
        .limit(1);
      assertProcedureOwner(existing, studioId, input.id);

      // Deletar dependentes primeiro
      await db
        .delete(procedureConsumables)
        .where(eq(procedureConsumables.procedureId, input.id));
      await db
        .delete(procedureImages)
        .where(eq(procedureImages.procedureId, input.id));
      await db
        .delete(procedureEvents)
        .where(eq(procedureEvents.procedureId, input.id));
      await db
        .delete(technicalProcedures)
        .where(eq(technicalProcedures.id, input.id));

      return { success: true };
    }),
  // ── Buscar procedimento por appointmentId ───────────────────────────────────────
  getByAppointment: protectedProcedure
    .input(z.object({ appointmentId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const studioId = ctx.user.studioId ?? 1;
      const db = await requireDb();
      const rows = await db
        .select()
        .from(technicalProcedures)
        .where(
          and(
            eq(technicalProcedures.appointmentId, input.appointmentId),
            eq(technicalProcedures.studioId, studioId),
          ),
        )
        .orderBy(desc(technicalProcedures.createdAt));
      return rows;
    }),
  // Resumo financeiro do procedimento
  getSummary: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const studioId = ctx.user.studioId ?? 1;
      const db = await requireDb();
      const [procedure] = await db
        .select()
        .from(technicalProcedures)
        .where(eq(technicalProcedures.id, input.id))
        .limit(1);
      assertProcedureOwner(procedure, studioId, input.id);

      const consumables = await db
        .select()
        .from(procedureConsumables)
        .where(eq(procedureConsumables.procedureId, input.id));

      type Consumable = (typeof consumables)[number];
      // Agrupar por categoria
      const byCategory: Record<
        string,
        { totalCost: number; items: Consumable[] }
      > = {};
      let totalMaterialCost = 0;

      for (const c of consumables) {
        const cat = c.category;
        if (!byCategory[cat]) byCategory[cat] = { totalCost: 0, items: [] };
        const cost = Number(c.estimatedTotalCost ?? 0);
        byCategory[cat].totalCost += cost;
        byCategory[cat].items.push(c);
        totalMaterialCost += cost;
      }

      const chargedAmount = (procedure.chargedAmount ?? 0) / 100; // converter centavos para reais
      const grossMargin = chargedAmount - totalMaterialCost;

      return {
        procedure,
        consumables,
        byCategory,
        totalMaterialCost,
        chargedAmount,
        grossMargin,
        isEstimated: consumables.some(
          (c) =>
            c.unit === "drop" ||
            c.unit === "portion" ||
            c.unit === "roll_fraction",
        ),
      };
    }),

  // ── Finalizar sessão POD: fechar procedimento + concluir agendamento + registrar transação ──────────────────
  finalize: protectedProcedure
    .input(
      z.object({
        procedureId: z.number(),
        chargedAmount: z.number().min(0),
        paymentMethod: z.enum([
          "dinheiro",
          "pix",
          "credito",
          "debito",
          "transferencia",
        ]),
        notes: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const studioId = ctx.user.studioId ?? 1;
      const db = await requireDb();

      // 1. Buscar o procedimento e verificar ownership
      const [proc] = await db
        .select()
        .from(technicalProcedures)
        .where(
          and(
            eq(technicalProcedures.id, input.procedureId),
            eq(technicalProcedures.studioId, studioId),
          ),
        )
        .limit(1);

      if (!proc)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Procedimento não encontrado.",
        });
      if (proc.status === "finalizado")
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Procedimento já finalizado.",
        });

      const now = new Date().toISOString().slice(0, 19).replace("T", " ");

      // 2. Fechar o procedimento
      await db
        .update(technicalProcedures)
        .set({
          status: "finalizado",
          finishedAt: now,
          chargedAmount: input.chargedAmount,
          notes: input.notes ?? proc.notes,
          updatedAt: now,
        })
        .where(eq(technicalProcedures.id, input.procedureId));

      // 3. Marcar agendamento vinculado como concluído (se houver)
      if (proc.appointmentId) {
        await db
          .update(appointments)
          .set({ status: "concluido", updatedAt: now })
          .where(
            and(
              eq(appointments.id, proc.appointmentId),
              eq(appointments.studioId, studioId),
            ),
          );
      }

      // 4. Registrar transação financeira
      const amountCents = Math.round(input.chargedAmount * 100);
      if (amountCents > 0) {
        await db.insert(transactions).values({
          studioId,
          clientId: proc.clientId ?? null,
          appointmentId: proc.appointmentId ?? null,
          type: "entrada",
          category: "servico",
          description: `Sessão POD: ${proc.title}`,
          amount: amountCents,
          paymentMethod: input.paymentMethod,
          date: now,
        });
      }

      // 5. Notificar o dono do estúdio
      try {
        const duracaoMin =
          proc.startedAt && proc.finishedAt
            ? Math.round(
                (new Date(proc.finishedAt.replace(" ", "T")).getTime() -
                  new Date(proc.startedAt.replace(" ", "T")).getTime()) /
                  60000,
              )
            : null;
        const valorFmt = new Intl.NumberFormat("pt-BR", {
          style: "currency",
          currency: "BRL",
        }).format(input.chargedAmount);
        const duracaoFmt = duracaoMin != null ? `${duracaoMin} min` : "n/d";
        const { notifyOwner } = await import("../_core/notification");
        await notifyOwner({
          title: `✅ Sessão POD Finalizada: ${proc.title}`,
          content: [
            `**Procedimento:** ${proc.title}`,
            `**Artista:** ${proc.artistName || "N/A"}`,
            `**Duração:** ${duracaoFmt}`,
            `**Valor cobrado:** ${valorFmt}`,
            `**Método:** ${input.paymentMethod}`,
            proc.appointmentId
              ? `**Agendamento #${proc.appointmentId}:** marcado como concluído`
              : "",
            amountCents > 0 ? `**Transação registrada:** ${valorFmt}` : "",
            input.notes ? `**Obs:** ${input.notes}` : "",
          ]
            .filter(Boolean)
            .join("\n"),
        });
      } catch (_e) {
        // Não bloquear a finalização se a notificação falhar
      }

      return {
        success: true,
        appointmentUpdated: !!proc.appointmentId,
        transactionCreated: amountCents > 0,
      };
    }),

  // ── Listar todos os appointmentIds que têm sessão POD vinculada ────────────────────────────────────────────────
  // ── Relatório de insumos por artista/período ─────────────────────────────────────────────────────────────────
  consumableReport: protectedProcedure
    .input(
      z.object({
        startDate: z.string().optional(), // 'YYYY-MM-DD'
        endDate: z.string().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const studioId = ctx.user.studioId ?? 1;
      const db = await requireDb();

      // Buscar procedimentos finalizados no período
      const procWhere = [eq(technicalProcedures.studioId, studioId)];
      if (input.startDate)
        procWhere.push(
          gte(technicalProcedures.createdAt, `${input.startDate} 00:00:00`),
        );
      if (input.endDate)
        procWhere.push(
          lte(technicalProcedures.createdAt, `${input.endDate} 23:59:59`),
        );

      const procs = await db
        .select({
          id: technicalProcedures.id,
          artistName: technicalProcedures.artistName,
          title: technicalProcedures.title,
          chargedAmount: technicalProcedures.chargedAmount,
          createdAt: technicalProcedures.createdAt,
        })
        .from(technicalProcedures)
        .where(and(...procWhere))
        .orderBy(desc(technicalProcedures.createdAt));

      if (procs.length === 0)
        return { byArtist: [], totalCost: 0, totalSessions: 0 };

      const procIds = procs.map((p) => p.id);

      // Buscar todos os insumos e filtrar em JS pelos procedimentos do período
      const consumablesAll = await db.select().from(procedureConsumables);

      const filteredConsumables = consumablesAll.filter((c) =>
        procIds.includes(c.procedureId),
      );

      // Agrupar por artista
      const artistMap: Record<
        string,
        {
          artistName: string;
          sessions: number;
          totalCost: number;
          totalRevenue: number;
          consumablesByCategory: Record<string, { qty: number; cost: number }>;
        }
      > = {};

      for (const proc of procs) {
        const artist = proc.artistName || "Sem artista";
        if (!artistMap[artist]) {
          artistMap[artist] = {
            artistName: artist,
            sessions: 0,
            totalCost: 0,
            totalRevenue: 0,
            consumablesByCategory: {},
          };
        }
        artistMap[artist].sessions++;
        // chargedAmount está em centavos → converter para reais
        artistMap[artist].totalRevenue += (proc.chargedAmount ?? 0) / 100;

        const procConsumables = filteredConsumables.filter(
          (c) => c.procedureId === proc.id,
        );
        for (const c of procConsumables) {
          const unitCost = parseFloat(c.estimatedUnitCost ?? "0");
          const qty = parseFloat(c.quantity ?? "0");
          const cost = unitCost * qty;
          artistMap[artist].totalCost += cost;
          const cat = c.category || "outros";
          if (!artistMap[artist].consumablesByCategory[cat]) {
            artistMap[artist].consumablesByCategory[cat] = { qty: 0, cost: 0 };
          }
          artistMap[artist].consumablesByCategory[cat].qty += qty;
          artistMap[artist].consumablesByCategory[cat].cost += cost;
        }
      }

      const byArtist = Object.values(artistMap).sort(
        (a, b) => b.totalCost - a.totalCost,
      );
      const totalCost = byArtist.reduce((s, a) => s + a.totalCost, 0);
      const totalSessions = byArtist.reduce((s, a) => s + a.sessions, 0);

      return { byArtist, totalCost, totalSessions };
    }),

  // ── Resumo mensal de insumos para o widget do Dashboard ─────────────────────────────────────────────────────
  consumableSummary: protectedProcedure.query(async ({ ctx }) => {
    const studioId = ctx.user.studioId ?? 1;
    const db = await requireDb();
    const now = new Date();
    // Mês atual
    const startOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01 00:00:00`;
    const endOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()).padStart(2, "0")} 23:59:59`;
    // Mês anterior
    const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const startOfPrevMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, "0")}-01 00:00:00`;
    const endOfPrevMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, "0")}-${String(new Date(prevDate.getFullYear(), prevDate.getMonth() + 1, 0).getDate()).padStart(2, "0")} 23:59:59`;

    const getMonthData = async (start: string, end: string) => {
      const procs = await db
        .select({
          id: technicalProcedures.id,
          chargedAmount: technicalProcedures.chargedAmount,
        })
        .from(technicalProcedures)
        .where(
          and(
            eq(technicalProcedures.studioId, studioId),
            gte(technicalProcedures.createdAt, start),
            lte(technicalProcedures.createdAt, end),
          ),
        );
      if (procs.length === 0)
        return {
          totalCost: 0,
          totalRevenue: 0,
          sessions: 0,
          avgGrossMargin: 0,
        };
      const procIds = procs.map((p) => p.id);
      const allConsumables = await db.select().from(procedureConsumables);
      const filtered = allConsumables.filter((c) =>
        procIds.includes(c.procedureId),
      );
      let totalCost = 0;
      for (const c of filtered) {
        totalCost +=
          parseFloat(c.estimatedUnitCost ?? "0") *
          parseFloat(c.quantity ?? "0");
      }
      // chargedAmount está em centavos → converter para reais para comparar com estimatedUnitCost (reais)
      const totalRevenue =
        procs.reduce((s, p) => s + (p.chargedAmount ?? 0), 0) / 100;
      const sessions = procs.length;
      const avgGrossMargin =
        sessions > 0 ? (totalRevenue - totalCost) / sessions : 0;
      return { totalCost, totalRevenue, sessions, avgGrossMargin };
    };

    const [current, previous] = await Promise.all([
      getMonthData(startOfMonth, endOfMonth),
      getMonthData(startOfPrevMonth, endOfPrevMonth),
    ]);

    const costVariation =
      previous.totalCost > 0
        ? ((current.totalCost - previous.totalCost) / previous.totalCost) * 100
        : null;
    const marginVariation =
      previous.avgGrossMargin > 0
        ? ((current.avgGrossMargin - previous.avgGrossMargin) /
            previous.avgGrossMargin) *
          100
        : null;

    return {
      current: {
        ...current,
        label: now.toLocaleDateString("pt-BR", {
          month: "long",
          year: "numeric",
        }),
      },
      previous: {
        ...previous,
        label: prevDate.toLocaleDateString("pt-BR", {
          month: "long",
          year: "numeric",
        }),
      },
      costVariation,
      marginVariation,
    };
  }),

  listLinkedAppointmentIds: protectedProcedure.query(async ({ ctx }) => {
    const studioId = ctx.user.studioId ?? 1;
    const db = await requireDb();
    const rows = await db
      .select({
        appointmentId: technicalProcedures.appointmentId,
        id: technicalProcedures.id,
      })
      .from(technicalProcedures)
      .where(
        and(
          eq(technicalProcedures.studioId, studioId),
          isNotNull(technicalProcedures.appointmentId),
        ),
      );
    // Retorna mapa appointmentId -> procedureId
    const map: Record<number, number> = {};
    for (const r of rows) {
      if (r.appointmentId != null) map[r.appointmentId] = r.id;
    }
    return map;
  }),
});
