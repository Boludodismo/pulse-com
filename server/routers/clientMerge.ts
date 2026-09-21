import mysql from "mysql2/promise";
import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import {
  mergeStudio,
  rows,
  loadMerge,
  confirmMerge,
} from "../clientMerge/service";
import { ensureClientMergeSchema } from "../clientMerge/schema";
import { duplicatePairs, mergeFields } from "../../shared/clientDuplicates";

const scopeInput = z.object({
  studioId: z.number().int().positive().optional(),
});
const pairInput = scopeInput.extend({
  targetId: z.number().int().positive(),
  sourceId: z.number().int().positive(),
  choices: z
    .partialRecord(
      z.enum(
        Object.keys(mergeFields) as [
          keyof typeof mergeFields,
          ...(keyof typeof mergeFields)[],
        ]
      ),
      z.number().int().positive()
    )
    .default({}),
});
function scope(ctx: any, input?: { studioId?: number }) {
  return mergeStudio(ctx.user, input?.studioId);
}
async function connect() {
  return mysql.createConnection({
    uri: process.env.DATABASE_URL!,
    dateStrings: true,
  });
}
export const clientMergeRouter = router({
  candidates: protectedProcedure
    .input(scopeInput.optional())
    .query(async ({ ctx, input }) => {
      const studioId = scope(ctx, input),
        c = await connect();
      try {
        const clients = await rows(
          c,
          "SELECT id,name,phone,email,docNumber,docType,birthDate,createdAt,totalSpent,appointmentCount FROM clients WHERE studioId=? AND isArchived=0 ORDER BY name,id",
          [studioId]
        );
        const tags = await rows(
          c,
          "SELECT client_id,label FROM care_tags WHERE studio_id=?",
          [studioId]
        );
        return {
          clients: clients.map(client => ({
            id: Number(client.id),
            name: String(client.name),
            phone: client.phone as string | null,
            email: client.email as string | null,
            appointmentCount: Number(client.appointmentCount),
            totalSpent: Number(client.totalSpent),
            tags: tags
              .filter(t => Number(t.client_id) === Number(client.id))
              .map(t => String(t.label)),
          })),
          pairs: duplicatePairs(clients as any),
        };
      } finally {
        await c.end();
      }
    }),
  preview: protectedProcedure.input(pairInput).query(async ({ ctx, input }) => {
    const studioId = scope(ctx, input),
      c = await connect();
    try {
      await c.beginTransaction();
      const { preview } = await loadMerge(c, studioId, input);
      await c.rollback();
      return preview;
    } catch (error) {
      await c.rollback();
      throw error;
    } finally {
      await c.end();
    }
  }),
  confirm: protectedProcedure
    .input(
      pairInput.extend({
        hash: z.string().regex(/^[a-f0-9]{64}$/),
        samePerson: z.literal(true),
        reviewed: z.literal(true),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const studioId = scope(ctx, input),
        c = await connect();
      // The confirmation booleans and hash are intentionally excluded from the preview fingerprint.
      const { hash, samePerson, reviewed, ...pair } = input;
      try {
        await ensureClientMergeSchema(c);
        return await confirmMerge(c, studioId, ctx.user.id, pair, hash);
      } finally {
        await c.end();
      }
    }),
  history: protectedProcedure
    .input(scopeInput.optional())
    .query(async ({ ctx, input }) => {
      const studioId = scope(ctx, input),
        c = await connect();
      try {
        const tables = await rows(
          c,
          "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='client_merge_audits'"
        );
        if (!tables.length) return [];
        return await rows(
          c,
          `SELECT a.id,a.actor_id,a.target_id,a.source_id,a.created_at,c.name AS target_name,s.name AS source_name
        FROM client_merge_audits a LEFT JOIN clients c ON c.id=a.target_id AND c.studioId=a.studio_id
        LEFT JOIN clients s ON s.id=a.source_id AND s.studioId=a.studio_id WHERE a.studio_id=? ORDER BY a.id DESC LIMIT 100`,
          [studioId]
        );
      } finally {
        await c.end();
      }
    }),
});
