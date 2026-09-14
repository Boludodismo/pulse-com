import { randomUUID } from "node:crypto";
import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq, inArray, isNull, or } from "drizzle-orm";
import { z } from "zod";
import {
  appointments,
  artists,
  inventoryBatches,
  tenantInventoryMovements,
  tenantMaterials,
} from "../../drizzle/schema";
import {
  inventoryLoans,
  inventoryLoanEvents,
  inventoryNotices,
} from "../../drizzle/inventoryWorkflowSchema";
import { materialDescription } from "../../shared/materialDescription";
import {
  assertOwnArtist,
  isInventoryManager,
  requireInventoryArtist,
} from "../inventoryAccess";
import {
  assertNotLoanStock,
  stockAccess,
  workflowDb,
  type WorkflowContext,
  type WorkflowDb,
} from "../inventoryWorkflowDb";
import {
  formatInventoryDate,
  hoursUntil,
  isStudioDate,
  quantity,
  specificationOf,
  studioNow,
  units,
  utcNow,
} from "../inventoryWorkflowRules";
import { loanNotice } from "../inventoryNotices";
import { router, tenantProcedure } from "../_core/trpc";

const positiveQuantity = z
  .string()
  .regex(/^\d{1,9}(?:\.\d{1,3})?$/)
  .refine(v => Number(v) > 0, "A quantidade deve ser maior que zero.");
const idSchema = z.number().int().positive();
const dueSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)
  .refine(
    v => isStudioDate(v) && hoursUntil(v) > 0,
    "Informe um prazo futuro no horário do estúdio."
  );
const notesSchema = z.string().trim().max(2000).optional();
type Loan = typeof inventoryLoans.$inferSelect;
type Material = typeof tenantMaterials.$inferSelect;
type Batch = typeof inventoryBatches.$inferSelect;
function bad(message: string): never {
  throw new TRPCError({ code: "BAD_REQUEST", message });
}
function forbidden(): never {
  throw new TRPCError({
    code: "FORBIDDEN",
    message: "Somente as partes deste empréstimo podem acessar este registro.",
  });
}
function party(ctx: WorkflowContext, loan: Loan, side?: "lender" | "borrower") {
  if (isInventoryManager(ctx)) return;
  if (
    !ctx.artistId ||
    (side === "lender"
      ? loan.lenderArtistId !== ctx.artistId
      : side === "borrower"
        ? loan.borrowerArtistId !== ctx.artistId
        : loan.lenderArtistId !== ctx.artistId &&
          loan.borrowerArtistId !== ctx.artistId)
  )
    forbidden();
}
async function getLoan(
  db: WorkflowDb,
  ctx: WorkflowContext,
  id: number,
  lock = false
) {
  const query = db
    .select()
    .from(inventoryLoans)
    .where(
      and(eq(inventoryLoans.id, id), eq(inventoryLoans.studioId, ctx.studioId))
    )
    .limit(1);
  const [loan] = await (lock ? query.for("update") : query);
  if (!loan)
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Empréstimo não encontrado.",
    });
  party(ctx, loan);
  return loan;
}
async function event(
  db: WorkflowDb,
  ctx: WorkflowContext,
  loan: Loan,
  kind: string,
  extra: Partial<typeof inventoryLoanEvents.$inferInsert> = {}
) {
  await db.insert(inventoryLoanEvents).values({
    studioId: ctx.studioId,
    loanId: loan.id,
    operationKey: randomUUID(),
    kind,
    createdByUserId: ctx.user.id,
    ...extra,
  });
}
async function materialBatches(db: WorkflowDb, studioId: number, id: number) {
  return db
    .select()
    .from(inventoryBatches)
    .where(
      and(
        eq(inventoryBatches.studioId, studioId),
        eq(inventoryBatches.tenantMaterialId, id)
      )
    )
    .orderBy(asc(inventoryBatches.id))
    .for("update");
}
function selectedBatch(
  material: Material,
  batches: Batch[],
  batchId: number | undefined,
  amount: number,
  allowExpired = false
) {
  const batch = batchId ? batches.find(b => b.id === batchId) : undefined;
  if (batchId && !batch) bad("O lote não pertence ao material selecionado.");
  const available = batch
    ? units(batch.remainingQuantity)
    : units(material.currentQuantity) -
      batches.reduce((n, b) => n + units(b.remainingQuantity), 0);
  if (amount > units(material.currentQuantity) || amount > available)
    bad("Quantidade indisponível. Confira o saldo e selecione o lote correto.");
  const expiry = batch ? batch.expiresAt : material.expiresAt;
  if (!allowExpired && expiry && expiry < studioNow())
    bad("Este material está vencido e não pode ser entregue para uso.");
  return batch;
}
async function changeBalance(
  db: WorkflowDb,
  ctx: WorkflowContext,
  loan: Loan,
  material: Material,
  delta: number,
  reason: string,
  batch?: Batch
) {
  const next = quantity(units(material.currentQuantity) + delta);
  await db
    .update(tenantMaterials)
    .set({ currentQuantity: next })
    .where(
      and(
        eq(tenantMaterials.id, material.id),
        eq(tenantMaterials.studioId, ctx.studioId)
      )
    );
  if (batch)
    await db
      .update(inventoryBatches)
      .set({
        remainingQuantity: quantity(units(batch.remainingQuantity) + delta),
      })
      .where(
        and(
          eq(inventoryBatches.id, batch.id),
          eq(inventoryBatches.studioId, ctx.studioId)
        )
      );
  await db.insert(tenantInventoryMovements).values({
    studioId: ctx.studioId,
    tenantMaterialId: material.id,
    type: delta < 0 ? "ajuste" : "entrada",
    quantity: quantity(Math.abs(delta)),
    previousQuantity: material.currentQuantity,
    newQuantity: next,
    sourceType: "inventory_loan",
    sourceId: loan.id,
    reason,
    createdByUserId: ctx.user.id,
  });
}
async function copyBatch(
  db: WorkflowDb,
  ctx: WorkflowContext,
  materialId: number,
  source: Batch,
  amount: number
) {
  const {
    id,
    tenantMaterialId,
    receiptKey,
    receivedAt,
    createdByUserId,
    ...snapshot
  } = source;
  const [inserted] = await db.insert(inventoryBatches).values({
    ...snapshot,
    tenantMaterialId: materialId,
    receiptKey: randomUUID(),
    receivedQuantity: quantity(amount),
    remainingQuantity: quantity(amount),
    receivedAt: utcNow(),
    createdByUserId: ctx.user.id,
  });
  return inserted.insertId;
}
async function resolveDeadlineNotices(db: WorkflowDb, loan: Loan) {
  // Previous deadline notices must stop retrying after a settlement or extension.
  const notices = await db
    .select()
    .from(inventoryNotices)
    .where(
      and(
        eq(inventoryNotices.studioId, loan.studioId),
        eq(inventoryNotices.loanId, loan.id)
      )
    );
  for (const n of notices.filter(n => n.eventKey.includes(":deadline:")))
    await db
      .update(inventoryNotices)
      .set({ resolvedAt: utcNow() })
      .where(eq(inventoryNotices.id, n.id));
}

export const inventoryLoansRouter = router({
  catalog: tenantProcedure
    .input(z.object({ borrowerArtistId: idSchema }))
    .query(async ({ ctx, input }) => {
      await stockAccess(ctx);
      const db = await workflowDb();
      assertOwnArtist(ctx, input.borrowerArtistId);
      await requireInventoryArtist(db, ctx.studioId, input.borrowerArtistId);
      const borrowed = await db
        .select({ id: inventoryLoans.receivedMaterialId })
        .from(inventoryLoans)
        .where(eq(inventoryLoans.studioId, ctx.studioId));
      const rows = await db
        .select({
          id: tenantMaterials.id,
          name: tenantMaterials.name,
          unit: tenantMaterials.unit,
          ownerArtistId: tenantMaterials.ownerArtistId,
          ownerName: artists.name,
          brand: tenantMaterials.brand,
          model: tenantMaterials.model,
          configuration: tenantMaterials.configuration,
          diameter: tenantMaterials.diameter,
          needleCount: tenantMaterials.needleCount,
          gauge: tenantMaterials.gauge,
          taper: tenantMaterials.taper,
        })
        .from(tenantMaterials)
        .leftJoin(
          artists,
          and(
            eq(artists.id, tenantMaterials.ownerArtistId),
            eq(artists.studioId, ctx.studioId)
          )
        )
        .where(
          and(
            eq(tenantMaterials.studioId, ctx.studioId),
            eq(tenantMaterials.isActive, 1),
            or(eq(artists.active, 1), isNull(tenantMaterials.ownerArtistId))
          )
        );
      return rows
        .filter(
          m =>
            m.ownerArtistId !== input.borrowerArtistId &&
            !borrowed.some(l => l.id === m.id)
        )
        .map(m => ({
          ...m,
          description: materialDescription(m),
          ownerName: m.ownerArtistId == null ? "Estúdio" : m.ownerName,
        }));
    }),
  list: tenantProcedure.query(async ({ ctx }) => {
    await stockAccess(ctx);
    const db = await workflowDb();
    const rows = await db
      .select()
      .from(inventoryLoans)
      .where(
        and(
          eq(inventoryLoans.studioId, ctx.studioId),
          isInventoryManager(ctx)
            ? undefined
            : or(
                eq(inventoryLoans.borrowerArtistId, ctx.artistId!),
                eq(inventoryLoans.lenderArtistId, ctx.artistId!)
              )
        )
      )
      .orderBy(desc(inventoryLoans.id))
      .limit(200);
    const names = await db
      .select({ id: artists.id, name: artists.name })
      .from(artists)
      .where(eq(artists.studioId, ctx.studioId));
    return rows.map(l => ({
      ...l,
      lenderName:
        l.lenderArtistId == null
          ? "Estúdio"
          : (names.find(a => a.id === l.lenderArtistId)?.name ?? "Artista"),
      borrowerName:
        names.find(a => a.id === l.borrowerArtistId)?.name ?? "Artista",
      canLend: isInventoryManager(ctx) || ctx.artistId === l.lenderArtistId,
      canBorrow: isInventoryManager(ctx) || ctx.artistId === l.borrowerArtistId,
    }));
  }),
  detail: tenantProcedure
    .input(z.object({ loanId: idSchema }))
    .query(async ({ ctx, input }) => {
      await stockAccess(ctx);
      const db = await workflowDb();
      const loan = await getLoan(db, ctx, input.loanId);
      const events = await db
        .select()
        .from(inventoryLoanEvents)
        .where(
          and(
            eq(inventoryLoanEvents.studioId, ctx.studioId),
            eq(inventoryLoanEvents.loanId, loan.id)
          )
        )
        .orderBy(desc(inventoryLoanEvents.id));
      const canLend =
        isInventoryManager(ctx) || ctx.artistId === loan.lenderArtistId;
      const rows = await db
        .select()
        .from(tenantMaterials)
        .where(
          and(
            eq(tenantMaterials.studioId, ctx.studioId),
            eq(tenantMaterials.ownerArtistId, loan.borrowerArtistId),
            eq(tenantMaterials.isActive, 1)
          )
        );
      const borrowed = await db
        .select({ id: inventoryLoans.receivedMaterialId })
        .from(inventoryLoans)
        .where(eq(inventoryLoans.studioId, ctx.studioId));
      const candidates = rows.filter(
        m =>
          m.id === loan.receivedMaterialId ||
          (!borrowed.some(l => l.id === m.id) &&
            specificationOf(m) === loan.specification)
      );
      const ids = [
        ...candidates.map(m => m.id),
        ...(canLend ? [loan.sourceMaterialId] : []),
      ];
      const batches = ids.length
        ? await db
            .select()
            .from(inventoryBatches)
            .where(
              and(
                eq(inventoryBatches.studioId, ctx.studioId),
                inArray(inventoryBatches.tenantMaterialId, ids)
              )
            )
            .orderBy(asc(inventoryBatches.expiresAt))
        : [];
      return {
        loan,
        events,
        candidates: candidates.map(m => ({
          id: m.id,
          name: m.name,
          currentQuantity: m.currentQuantity,
          unit: m.unit,
          isReturn: m.id === loan.receivedMaterialId,
        })),
        batches: batches.map(b => ({
          id: b.id,
          tenantMaterialId: b.tenantMaterialId,
          lot: b.lot,
          expiresAt: b.expiresAt,
          remainingQuantity: b.remainingQuantity,
        })),
      };
    }),
  request: tenantProcedure
    .input(
      z.object({
        requestKey: z.string().uuid(),
        borrowerArtistId: idSchema,
        sourceMaterialId: idSchema,
        appointmentId: idSchema.optional(),
        quantity: positiveQuantity,
        notes: notesSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      await stockAccess(ctx, true);
      const db = await workflowDb();
      assertOwnArtist(ctx, input.borrowerArtistId);
      await requireInventoryArtist(db, ctx.studioId, input.borrowerArtistId);
      return db.transaction(async tx => {
        const [material] = await tx
          .select()
          .from(tenantMaterials)
          .where(
            and(
              eq(tenantMaterials.id, input.sourceMaterialId),
              eq(tenantMaterials.studioId, ctx.studioId),
              eq(tenantMaterials.isActive, 1)
            )
          )
          .limit(1)
          .for("update");
        if (!material || material.ownerArtistId === input.borrowerArtistId)
          bad("Selecione um material do estúdio ou de outro artista.");
        await assertNotLoanStock(tx, ctx.studioId, material.id);
        if (material.ownerArtistId)
          await requireInventoryArtist(
            db,
            ctx.studioId,
            material.ownerArtistId
          );
        if (input.appointmentId) {
          const [a] = await tx
            .select()
            .from(appointments)
            .where(
              and(
                eq(appointments.id, input.appointmentId),
                eq(appointments.studioId, ctx.studioId)
              )
            )
            .limit(1);
          if (
            !a ||
            a.artistId !== input.borrowerArtistId ||
            ["cancelado", "concluido"].includes(a.status)
          )
            bad(
              "Selecione um agendamento ativo do artista que receberá o material."
            );
        }
        const [existing] = await tx
          .select()
          .from(inventoryLoans)
          .where(
            and(
              eq(inventoryLoans.studioId, ctx.studioId),
              eq(inventoryLoans.requestKey, input.requestKey)
            )
          )
          .limit(1);
        if (existing) {
          if (
            existing.borrowerArtistId !== input.borrowerArtistId ||
            existing.sourceMaterialId !== material.id ||
            units(existing.quantityRequested) !== units(input.quantity) ||
            existing.appointmentId !== (input.appointmentId ?? null) ||
            existing.notes !== (input.notes ?? null)
          )
            bad("Solicitação já utilizada com outros dados.");
          return { id: existing.id };
        }
        const [inserted] = await tx.insert(inventoryLoans).values({
          studioId: ctx.studioId,
          requestKey: input.requestKey,
          lenderArtistId: material.ownerArtistId,
          borrowerArtistId: input.borrowerArtistId,
          appointmentId: input.appointmentId ?? null,
          sourceMaterialId: material.id,
          materialName: material.name,
          unit: material.unit,
          specification: specificationOf(material),
          quantityRequested: quantity(units(input.quantity)),
          notes: input.notes ?? null,
          createdByUserId: ctx.user.id,
        });
        const loan = await getLoan(tx, ctx, inserted.insertId);
        await event(tx, ctx, loan, "requested", {
          quantity: loan.quantityRequested,
          notes: input.notes,
        });
        await loanNotice(
          tx,
          loan,
          "requested",
          "Solicitação de empréstimo",
          `${loan.quantityRequested} ${loan.unit} de ${loan.materialName}. Aguarda aprovação e definição do prazo pelo proprietário.`
        );
        return { id: loan.id };
      });
    }),
  approve: tenantProcedure
    .input(
      z.object({
        loanId: idSchema,
        quantity: positiveQuantity,
        dueAt: dueSchema,
        reminderHours: z.number().int().min(1).max(720).default(24),
        notes: notesSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      await stockAccess(ctx, true);
      const db = await workflowDb();
      return db.transaction(async tx => {
        const loan = await getLoan(tx, ctx, input.loanId, true);
        party(ctx, loan, "lender");
        if (
          loan.status === "approved" &&
          units(loan.quantityApproved!) === units(input.quantity) &&
          loan.dueAt === input.dueAt &&
          loan.reminderHours === input.reminderHours
        )
          return { id: loan.id };
        if (
          loan.status !== "requested" ||
          units(input.quantity) > units(loan.quantityRequested)
        )
          bad("Confira o estado do pedido e a quantidade solicitada.");
        await tx
          .update(inventoryLoans)
          .set({
            status: "approved",
            quantityApproved: input.quantity,
            dueAt: input.dueAt,
            reminderHours: input.reminderHours,
            approvedAt: utcNow(),
            approvedByUserId: ctx.user.id,
            decisionNotes: input.notes ?? null,
          })
          .where(eq(inventoryLoans.id, loan.id));
        await event(tx, ctx, loan, "approved", {
          quantity: input.quantity,
          notes: `Prazo: ${input.dueAt}. ${input.notes ?? ""}`,
        });
        await loanNotice(
          tx,
          loan,
          "approved",
          "Empréstimo aprovado",
          `${input.quantity} ${loan.unit} de ${loan.materialName}. Reposição até ${formatInventoryDate(input.dueAt)}. O saldo será transferido quando o proprietário confirmar a entrega.`
        );
        return { id: loan.id };
      });
    }),
  closeRequest: tenantProcedure
    .input(
      z.object({
        loanId: idSchema,
        action: z.enum(["reject", "cancel"]),
        notes: z.string().trim().min(2).max(2000),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await stockAccess(ctx, true);
      const db = await workflowDb();
      return db.transaction(async tx => {
        const loan = await getLoan(tx, ctx, input.loanId, true);
        party(ctx, loan, input.action === "reject" ? "lender" : "borrower");
        const status = input.action === "reject" ? "rejected" : "cancelled";
        if (loan.status === status) return { id: loan.id };
        if (!["requested", "approved"].includes(loan.status))
          bad(
            "A entrega já foi realizada. Registre a devolução na aba Empréstimos."
          );
        await tx
          .update(inventoryLoans)
          .set({ status, decisionNotes: input.notes })
          .where(eq(inventoryLoans.id, loan.id));
        await event(tx, ctx, loan, status, { notes: input.notes });
        await loanNotice(
          tx,
          loan,
          status,
          status === "rejected"
            ? "Empréstimo recusado"
            : "Empréstimo cancelado",
          `${loan.materialName}: ${input.notes}`
        );
        return { id: loan.id };
      });
    }),
  deliver: tenantProcedure
    .input(z.object({ loanId: idSchema, batchId: idSchema.optional() }))
    .mutation(async ({ ctx, input }) => {
      await stockAccess(ctx, true);
      const db = await workflowDb();
      return db.transaction(async tx => {
        const loan = await getLoan(tx, ctx, input.loanId, true);
        party(ctx, loan, "lender");
        if (["delivered", "settled"].includes(loan.status)) {
          if (loan.sourceBatchId !== (input.batchId ?? null))
            bad("Entrega já registrada com outro lote.");
          return { id: loan.id, materialId: loan.receivedMaterialId };
        }
        if (
          loan.status !== "approved" ||
          !loan.dueAt ||
          hoursUntil(loan.dueAt) <= 0
        )
          bad("Aprove o pedido com um prazo futuro antes de entregar.");
        const [source] = await tx
          .select()
          .from(tenantMaterials)
          .where(
            and(
              eq(tenantMaterials.id, loan.sourceMaterialId),
              eq(tenantMaterials.studioId, ctx.studioId)
            )
          )
          .limit(1)
          .for("update");
        if (
          !source?.isActive ||
          source.ownerArtistId !== loan.lenderArtistId ||
          specificationOf(source) !== loan.specification
        )
          bad("O material mudou desde o pedido. Cancele e solicite novamente.");
        const amount = units(loan.quantityApproved!);
        const batches = await materialBatches(tx, ctx.studioId, source.id);
        const batch = selectedBatch(source, batches, input.batchId, amount);
        const {
          id,
          createdAt,
          updatedAt,
          legacyMaterialId,
          ownerArtistId,
          ...spec
        } = source;
        const [inserted] = await tx.insert(tenantMaterials).values({
          ...spec,
          ownerArtistId: loan.borrowerArtistId,
          currentQuantity: "0.000",
          minimumQuantity: "0.000",
          notes: `Recebido no empréstimo #${loan.id}`,
          lot: batch?.lot ?? source.lot,
          expiresAt: batch ? batch.expiresAt : source.expiresAt,
          unitCost: batch?.unitCost ?? source.unitCost,
          supplierId: batch?.supplierId ?? source.supplierId,
          createdByUserId: ctx.user.id,
        });
        const [received] = await tx
          .select()
          .from(tenantMaterials)
          .where(eq(tenantMaterials.id, inserted.insertId));
        await changeBalance(
          tx,
          ctx,
          loan,
          source,
          -amount,
          "Entrega de material emprestado",
          batch
        );
        await changeBalance(
          tx,
          ctx,
          loan,
          received,
          amount,
          "Recebimento de material emprestado"
        );
        const receivedBatchId = batch
          ? await copyBatch(tx, ctx, received.id, batch, amount)
          : null;
        await tx
          .update(inventoryLoans)
          .set({
            status: "delivered",
            sourceBatchId: batch?.id ?? null,
            receivedMaterialId: received.id,
            receivedBatchId,
            deliveredAt: utcNow(),
            deliveredByUserId: ctx.user.id,
          })
          .where(eq(inventoryLoans.id, loan.id));
        await event(tx, ctx, loan, "delivered", {
          quantity: quantity(amount),
          sourceMaterialId: source.id,
          sourceBatchId: batch?.id,
          targetBatchId: receivedBatchId,
        });
        await loanNotice(
          tx,
          loan,
          "delivered",
          "Material emprestado entregue",
          `${quantity(amount)} ${loan.unit} de ${loan.materialName} transferidos para o estoque do artista. Reposição até ${formatInventoryDate(loan.dueAt)}. Selecione o material recebido no planejamento ou no consumo da sessão.`
        );
        return { id: loan.id, materialId: received.id };
      });
    }),
  settle: tenantProcedure
    .input(
      z.object({
        loanId: idSchema,
        operationKey: z.string().uuid(),
        sourceMaterialId: idSchema,
        batchId: idSchema.optional(),
        quantity: positiveQuantity,
        notes: notesSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      await stockAccess(ctx, true);
      const db = await workflowDb();
      return db.transaction(async tx => {
        const loan = await getLoan(tx, ctx, input.loanId, true);
        party(ctx, loan, "lender");
        const [existing] = await tx
          .select()
          .from(inventoryLoanEvents)
          .where(
            and(
              eq(inventoryLoanEvents.studioId, ctx.studioId),
              eq(inventoryLoanEvents.operationKey, input.operationKey)
            )
          )
          .limit(1);
        if (existing) {
          if (
            existing.loanId !== loan.id ||
            existing.sourceMaterialId !== input.sourceMaterialId ||
            existing.sourceBatchId !== (input.batchId ?? null) ||
            units(existing.quantity ?? "0") !== units(input.quantity)
          )
            bad("Esta confirmação já foi utilizada com outros dados.");
          return { id: loan.id };
        }
        const amount = units(input.quantity);
        const outstanding =
          units(loan.quantityApproved ?? "0") - units(loan.quantitySettled);
        if (loan.status !== "delivered" || amount > outstanding)
          bad("A quantidade excede o saldo pendente de reposição.");
        const materials = await tx
          .select()
          .from(tenantMaterials)
          .where(
            and(
              eq(tenantMaterials.studioId, ctx.studioId),
              inArray(tenantMaterials.id, [
                loan.sourceMaterialId,
                input.sourceMaterialId,
              ])
            )
          )
          .orderBy(asc(tenantMaterials.id))
          .for("update");
        const source = materials.find(m => m.id === input.sourceMaterialId);
        const target = materials.find(m => m.id === loan.sourceMaterialId);
        if (
          !source?.isActive ||
          !target?.isActive ||
          source.ownerArtistId !== loan.borrowerArtistId ||
          target.ownerArtistId !== loan.lenderArtistId ||
          specificationOf(source) !== loan.specification ||
          specificationOf(target) !== loan.specification
        )
          bad(
            "Escolha um material equivalente, da mesma unidade e especificação, no estoque de quem recebeu o empréstimo."
          );
        const isReturn = source.id === loan.receivedMaterialId;
        if (!isReturn) await assertNotLoanStock(tx, ctx.studioId, source.id);
        const batches = await materialBatches(tx, ctx.studioId, source.id);
        const batch = selectedBatch(
          source,
          batches,
          input.batchId,
          amount,
          isReturn
        );
        if (isReturn && (batch?.id ?? null) !== loan.receivedBatchId)
          bad("Selecione o lote originalmente emprestado.");
        // A replacement needs its own lot so it never inherits the original lot's expiry/cost.
        if (!isReturn && !batch)
          bad(
            "Cadastre a reposição em Receber material, com fornecedor e lote, antes de confirmar."
          );
        await changeBalance(
          tx,
          ctx,
          loan,
          source,
          -amount,
          isReturn
            ? "Devolução de material emprestado"
            : "Reposição de empréstimo",
          batch
        );
        let targetBatch: Batch | undefined;
        if (isReturn && loan.sourceBatchId) {
          targetBatch = (
            await materialBatches(tx, ctx.studioId, target.id)
          ).find(b => b.id === loan.sourceBatchId);
          if (!targetBatch) bad("Lote original indisponível.");
        }
        await changeBalance(
          tx,
          ctx,
          loan,
          target,
          amount,
          "Recebimento confirmado pelo proprietário",
          targetBatch
        );
        const targetBatchId =
          !isReturn && batch
            ? await copyBatch(tx, ctx, target.id, batch, amount)
            : (targetBatch?.id ?? null);
        const settled = units(loan.quantitySettled) + amount;
        const complete = settled === units(loan.quantityApproved!);
        await tx
          .update(inventoryLoans)
          .set({
            quantitySettled: quantity(settled),
            status: complete ? "settled" : "delivered",
            settledAt: complete ? utcNow() : null,
          })
          .where(eq(inventoryLoans.id, loan.id));
        await event(tx, ctx, loan, isReturn ? "returned" : "replaced", {
          operationKey: input.operationKey,
          quantity: input.quantity,
          sourceMaterialId: source.id,
          sourceBatchId: batch?.id,
          targetBatchId,
          notes: input.notes,
        });
        await resolveDeadlineNotices(tx, loan);
        await loanNotice(
          tx,
          loan,
          `settled:${input.operationKey}`,
          complete ? "Empréstimo quitado" : "Reposição parcial confirmada",
          `${input.quantity} ${loan.unit} de ${loan.materialName} recebidos pelo proprietário. Pendente: ${quantity(outstanding - amount)} ${loan.unit}.`
        );
        return { id: loan.id };
      });
    }),
  extend: tenantProcedure
    .input(
      z.object({
        loanId: idSchema,
        dueAt: dueSchema,
        reminderHours: z.number().int().min(1).max(720),
        notes: z.string().trim().min(2).max(2000),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await stockAccess(ctx, true);
      const db = await workflowDb();
      return db.transaction(async tx => {
        const loan = await getLoan(tx, ctx, input.loanId, true);
        party(ctx, loan, "lender");
        if (!["approved", "delivered"].includes(loan.status))
          bad("Este empréstimo não está aberto.");
        if (
          loan.dueAt === input.dueAt &&
          loan.reminderHours === input.reminderHours
        )
          return { id: loan.id };
        await tx
          .update(inventoryLoans)
          .set({ dueAt: input.dueAt, reminderHours: input.reminderHours })
          .where(eq(inventoryLoans.id, loan.id));
        await resolveDeadlineNotices(tx, loan);
        await event(tx, ctx, loan, "deadline_changed", {
          notes: `Prazo anterior: ${loan.dueAt}. Novo: ${input.dueAt}. ${input.notes}`,
        });
        await loanNotice(
          tx,
          loan,
          `extended:${input.dueAt}`,
          "Prazo do empréstimo atualizado",
          `${loan.materialName}: reposição até ${formatInventoryDate(input.dueAt)}. ${input.notes}`
        );
        return { id: loan.id };
      });
    }),
});
