import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { sql } from 'drizzle-orm';
import { router, protectedProcedure } from '../_core/trpc';
import { getDb } from '../db';
import { isLegacyArchiveTable } from '../../shared/legacyArchive';
export const legacyArchiveRouter = router({
  list: protectedProcedure.input(z.object({ table:z.string().refine(isLegacyArchiveTable), offset:z.number().int().min(0).default(0) })).query(async ({ctx,input}) => {
    // Global legacy tables can only be read by the platform superadministrator.
    if (ctx.user.role !== 'superadmin') throw new TRPCError({code:'FORBIDDEN'});
    const db = await getDb();
    if (!db) throw new TRPCError({code:'INTERNAL_SERVER_ERROR'});
    const [exists] = await db.execute(sql`SELECT TABLE_NAME FROM information_schema.tables WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=${input.table}`);
    if (!(exists as unknown as unknown[]).length) return {rows:[],total:0};
    // Identifier is restricted to the immutable server-side allowlist above.
    const table = sql.raw('`'+input.table+'`');
    const [rows] = await db.execute(sql`SELECT * FROM ${table} ORDER BY id LIMIT 50 OFFSET ${input.offset}`);
    const [counts] = await db.execute(sql`SELECT COUNT(*) AS total FROM ${table}`);
    return { rows: rows as unknown as Record<string,unknown>[], total: Number((counts as unknown as {total:number}[])[0].total) };
  }),
});
