import { and, asc, desc, eq, isNull, lte, or } from "drizzle-orm";
import { z } from "zod";
import { artists, studios } from "../drizzle/schema";
import {
  inventoryAlertPreferences,
  inventoryLoans,
  inventoryNotices,
} from "../drizzle/inventoryWorkflowSchema";
import { isInventoryManager } from "./inventoryAccess";
import {
  stockAccess,
  workflowDb,
  type WorkflowDb,
} from "./inventoryWorkflowDb";
import {
  formatInventoryDate,
  hoursUntil,
  utcNow,
} from "./inventoryWorkflowRules";
import { router, tenantProcedure } from "./_core/trpc";
import { sendAndLog } from "./messaging/service";

export const recipientKey = (artistId: number | null) =>
  artistId == null ? "studio" : `artist:${artistId}`;
export async function addInventoryNotice(
  db: WorkflowDb,
  input: Omit<typeof inventoryNotices.$inferInsert, "recipientKey">
) {
  await db
    .insert(inventoryNotices)
    .values({
      ...input,
      recipientKey: recipientKey(input.recipientArtistId ?? null),
    })
    .onDuplicateKeyUpdate({ set: { eventKey: input.eventKey } });
}
export async function loanNotice(
  db: WorkflowDb,
  loan: typeof inventoryLoans.$inferSelect,
  event: string,
  title: string,
  message: string,
  severity = "info"
) {
  const names = await db
    .select({ id: artists.id, name: artists.name })
    .from(artists)
    .where(eq(artists.studioId, loan.studioId));
  const lender =
    loan.lenderArtistId == null
      ? "Estúdio"
      : (names.find(a => a.id === loan.lenderArtistId)?.name ?? "Artista");
  const borrower =
    names.find(a => a.id === loan.borrowerArtistId)?.name ?? "Artista";
  message = `${lender} → ${borrower}. ${message}`;
  for (const artistId of Array.from(
    new Set([loan.lenderArtistId, loan.borrowerArtistId])
  )) {
    await addInventoryNotice(db, {
      studioId: loan.studioId,
      recipientArtistId: artistId,
      eventKey: `loan:${loan.id}:${event}`,
      kind: "loan",
      severity,
      loanId: loan.id,
      appointmentId: loan.appointmentId,
      materialId: loan.sourceMaterialId,
      title,
      message,
    });
  }
}
export async function leadHoursFor(
  db: WorkflowDb,
  studioId: number,
  artistId: number | null
) {
  const rows = await db
    .select()
    .from(inventoryAlertPreferences)
    .where(eq(inventoryAlertPreferences.studioId, studioId));
  return (
    rows.find(p => p.recipientKey === recipientKey(artistId))?.leadHours ??
    rows.find(p => p.recipientKey === "studio")?.leadHours ??
    48
  );
}
export const inventoryNoticesRouter = router({
  list: tenantProcedure.query(async ({ ctx }) => {
    await stockAccess(ctx);
    const db = await workflowDb();
    return db
      .select()
      .from(inventoryNotices)
      .where(
        and(
          eq(inventoryNotices.studioId, ctx.studioId),
          isInventoryManager(ctx)
            ? undefined
            : eq(inventoryNotices.recipientKey, recipientKey(ctx.artistId))
        )
      )
      .orderBy(desc(inventoryNotices.id))
      .limit(100);
  }),
  read: tenantProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      await stockAccess(ctx);
      const db = await workflowDb();
      await db
        .update(inventoryNotices)
        .set({ readAt: utcNow() })
        .where(
          and(
            eq(inventoryNotices.studioId, ctx.studioId),
            eq(inventoryNotices.id, input.id),
            isInventoryManager(ctx)
              ? undefined
              : eq(inventoryNotices.recipientKey, recipientKey(ctx.artistId))
          )
        );
      return { ok: true };
    }),
  preferences: tenantProcedure.query(async ({ ctx }) => {
    await stockAccess(ctx);
    const db = await workflowDb();
    const [preference] = await db
      .select()
      .from(inventoryAlertPreferences)
      .where(
        and(
          eq(inventoryAlertPreferences.studioId, ctx.studioId),
          eq(inventoryAlertPreferences.recipientKey, recipientKey(ctx.artistId))
        )
      )
      .limit(1);
    return {
      whatsappEnabled: preference?.whatsappEnabled === 1,
      leadHours: await leadHoursFor(
        await workflowDb(),
        ctx.studioId,
        ctx.artistId
      ),
      scope: isInventoryManager(ctx) ? "studio" : "artist",
    };
  }),
  savePreferences: tenantProcedure
    .input(
      z.object({
        leadHours: z.number().int().min(1).max(720),
        whatsappEnabled: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await stockAccess(ctx, true);
      const db = await workflowDb();
      await db
        .insert(inventoryAlertPreferences)
        .values({
          studioId: ctx.studioId,
          recipientKey: recipientKey(ctx.artistId),
          leadHours: input.leadHours,
          whatsappEnabled: input.whatsappEnabled ? 1 : 0,
          whatsappOptedInAt: input.whatsappEnabled ? utcNow() : null,
          updatedByUserId: ctx.user.id,
        })
        .onDuplicateKeyUpdate({
          set: {
            leadHours: input.leadHours,
            updatedByUserId: ctx.user.id,
            ...(input.whatsappEnabled == null
              ? {}
              : {
                  whatsappEnabled: input.whatsappEnabled ? 1 : 0,
                  whatsappOptedInAt: input.whatsappEnabled ? utcNow() : null,
                }),
          },
        });
      if (input.whatsappEnabled)
        await db
          .update(inventoryNotices)
          .set({
            deliveryStatus: "pending",
            nextAttemptAt: null,
            lastError: null,
          })
          .where(
            and(
              eq(inventoryNotices.studioId, ctx.studioId),
              eq(inventoryNotices.recipientKey, recipientKey(ctx.artistId)),
              eq(inventoryNotices.deliveryStatus, "internal"),
              isNull(inventoryNotices.readAt),
              isNull(inventoryNotices.resolvedAt)
            )
          );
      return input;
    }),
});

export async function createLoanDeadlineNotices(
  db: WorkflowDb,
  now = new Date()
) {
  const loans = await db
    .select()
    .from(inventoryLoans)
    .where(eq(inventoryLoans.status, "delivered"));
  for (const loan of loans) {
    if (!loan.dueAt) continue;
    const hours = hoursUntil(loan.dueAt, now);
    if (hours > loan.reminderHours) continue;
    const overdue = hours < 0;
    await loanNotice(
      db,
      loan,
      `deadline:${loan.dueAt}:${loan.quantitySettled}:${overdue ? "overdue" : "soon"}`,
      overdue
        ? "Reposição de empréstimo atrasada"
        : "Prazo de reposição próximo",
      `${loan.materialName}: faltam ${(Number(loan.quantityApproved) - Number(loan.quantitySettled)).toFixed(3)} ${loan.unit} para devolver ou repor. Prazo: ${formatInventoryDate(loan.dueAt)}. O proprietário deve confirmar o recebimento na aba Empréstimos.`,
      overdue ? "danger" : "warning"
    );
  }
}
export async function deliverInventoryNotices(db: WorkflowDb) {
  const notices = await db
    .select()
    .from(inventoryNotices)
    .where(
      and(
        eq(inventoryNotices.deliveryStatus, "pending"),
        isNull(inventoryNotices.resolvedAt),
        or(
          isNull(inventoryNotices.nextAttemptAt),
          lte(inventoryNotices.nextAttemptAt, utcNow())
        )
      )
    )
    .orderBy(asc(inventoryNotices.id))
    .limit(50);
  for (const notice of notices) {
    const [preference] = await db
      .select()
      .from(inventoryAlertPreferences)
      .where(
        and(
          eq(inventoryAlertPreferences.studioId, notice.studioId),
          eq(inventoryAlertPreferences.recipientKey, notice.recipientKey)
        )
      )
      .limit(1);
    if (!preference?.whatsappEnabled) {
      await db
        .update(inventoryNotices)
        .set({ deliveryStatus: "internal", lastError: null })
        .where(eq(inventoryNotices.id, notice.id));
      continue;
    }
    const [recipient] =
      notice.recipientArtistId == null
        ? await db
            .select({ name: studios.name, phone: studios.phone })
            .from(studios)
            .where(eq(studios.id, notice.studioId))
            .limit(1)
        : await db
            .select({ name: artists.name, phone: artists.phone })
            .from(artists)
            .where(
              and(
                eq(artists.id, notice.recipientArtistId),
                eq(artists.studioId, notice.studioId),
                eq(artists.active, 1)
              )
            )
            .limit(1);
    try {
      const result = recipient?.phone
        ? await sendAndLog({
            studioId: notice.studioId,
            recipientType: "artist",
            recipientPhone: recipient.phone,
            recipientName: recipient.name,
            appointmentId: notice.appointmentId ?? undefined,
            trigger: `inventory_${notice.kind}`,
            message: `${notice.title}\n${notice.message}`,
            idempotencyKey: `inventory-notice:${notice.id}`,
          })
        : {
            success: false as const,
            error:
              "Telefone não cadastrado ou artista inativo. Aviso disponível no sistema.",
          };
      await db
        .update(inventoryNotices)
        .set({
          deliveryStatus: result.success ? "queued" : "pending",
          attempts: notice.attempts + 1,
          lastError: result.success ? null : result.error.slice(0, 500),
          nextAttemptAt: new Date(Date.now() + 3600000)
            .toISOString()
            .slice(0, 19)
            .replace("T", " "),
        })
        .where(
          and(
            eq(inventoryNotices.id, notice.id),
            eq(inventoryNotices.deliveryStatus, "pending")
          )
        );
    } catch {
      await db
        .update(inventoryNotices)
        .set({
          attempts: notice.attempts + 1,
          lastError:
            "Falha ao enfileirar. Nova tentativa automática em uma hora.",
          nextAttemptAt: new Date(Date.now() + 3600000)
            .toISOString()
            .slice(0, 19)
            .replace("T", " "),
        })
        .where(eq(inventoryNotices.id, notice.id));
    }
  }
}
