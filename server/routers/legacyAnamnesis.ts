import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import * as db from "../db";
import {
  importLegacyAnamnesisCsv,
  confirmLegacyProcedureDate,
  listLegacyImportBatches,
  previewLegacyAnamnesisCsv,
} from "../legacyAnamnesisImport";

const csvInput = z.object({
  content: z.string().min(1).max(15_000_000),
  selectedArtists: z.array(z.string().min(1).max(255)).min(1),
});

async function studioIdFor(user: { role: string; studioId?: number | null }) {
  if (!['admin', 'superadmin'].includes(user.role)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "A importação histórica é restrita a administradores." });
  }
  if (user.studioId) return user.studioId;
  const studio = await db.getFirstStudio();
  if (!studio) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Nenhum estúdio cadastrado." });
  return studio.id;
}

export const legacyAnamnesisRouter = router({
  preview: protectedProcedure
    .input(csvInput)
    .mutation(async ({ input, ctx }) => {
      await studioIdFor(ctx.user);
      try {
        return previewLegacyAnamnesisCsv(input.content, input.selectedArtists);
      } catch (error) {
        throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "CSV inválido" });
      }
    }),

  import: protectedProcedure
    .input(csvInput.extend({ fileName: z.string().min(1).max(255), targetArtistId: z.number().int().positive() }))
    .mutation(async ({ input, ctx }) => {
      const studioId = await studioIdFor(ctx.user);
      try {
        return await importLegacyAnamnesisCsv({ ...input, studioId, userId: ctx.user.id });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Falha na importação";
        throw new TRPCError({ code: message.includes("já foi importado") ? "CONFLICT" : "BAD_REQUEST", message });
      }
    }),

  batches: protectedProcedure.query(async ({ ctx }) => {
    const studioId = await studioIdFor(ctx.user);
    return listLegacyImportBatches(studioId);
  }),

  confirmProcedureDate: protectedProcedure
    .input(z.object({ requestId: z.number().int().positive(), procedureDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }))
    .mutation(async ({ input, ctx }) => {
      const studioId = await studioIdFor(ctx.user);
      try {
        return await confirmLegacyProcedureDate({ ...input, studioId });
      } catch (error) {
        throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "Não foi possível confirmar a data." });
      }
    }),
});
