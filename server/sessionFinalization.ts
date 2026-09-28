import { normalizeBrazilianPhone } from "./messaging/phone";
import { readPreparation } from "../shared/sessionPreparation";
import { createHash } from "node:crypto";
import { and, eq, desc, isNull, inArray, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  technicalProcedures,
  procedureEvents,
  procedureImages,
  procedureConsumables,
  procedurePauses,
  procedureInventoryConsumptions,
  procedureColorSamples,
  procedureInkRecipes,
  procedureInkRecipeItems,
  procedureInkRecipeResults,
  appointments,
  appointmentPlannedMaterials,
  transactions,
  clients,
  whatsappIntegrations,
  integrationContacts,
  messageAutomationSettings,
} from "../drizzle/schema";
import { careRules, careSessions } from "../drizzle/customerCareSchema";
import {
  type InventoryDatabase,
  type InventoryContext,
  assertOwnArtist,
} from "./inventoryAccess";
import { resolveProcedureArtist } from "./procedureArtist";
import {
  finalizeSessionInput,
  settlement,
  effectiveMinutes,
  readFinalization,
} from "../shared/sessionFinalization";
import { careDueDate } from "../shared/customerCare";

export async function finalizationPreview(
  db: InventoryDatabase,
  ctx: InventoryContext,
  procedureId: number
) {
  const proc = (
    await db
      .select()
      .from(technicalProcedures)
      .where(
        and(
          eq(technicalProcedures.id, procedureId),
          eq(technicalProcedures.studioId, ctx.studioId)
        )
      )
      .limit(1)
  )[0];
  if (!proc)
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Sessão não encontrada.",
    });
  const procedure = { ...proc, ...(await resolveProcedureArtist(db, proc)) };
  assertOwnArtist(ctx, procedure.artistId ?? null);
  const appointment = procedure.appointmentId
    ? (
        await db
          .select()
          .from(appointments)
          .where(
            and(
              eq(appointments.id, procedure.appointmentId),
              eq(appointments.studioId, ctx.studioId),
              eq(appointments.clientId, procedure.clientId)
            )
          )
          .limit(1)
      )[0]
    : null;
  if (procedure.appointmentId && !appointment)
    throw new TRPCError({
      code: "CONFLICT",
      message: "O vínculo do agendamento mudou. Revise a sessão.",
    });
  const scope = (table: { studioId: any; procedureId: any }) =>
    and(eq(table.studioId, ctx.studioId), eq(table.procedureId, procedureId));
  const consumptions = await db
    .select()
    .from(procedureInventoryConsumptions)
    .where(scope(procedureInventoryConsumptions))
    .orderBy(procedureInventoryConsumptions.id);
  const samples = await db
    .select()
    .from(procedureColorSamples)
    .where(scope(procedureColorSamples))
    .orderBy(procedureColorSamples.id);
  const recipes = await db
    .select()
    .from(procedureInkRecipes)
    .where(scope(procedureInkRecipes))
    .orderBy(procedureInkRecipes.id);
  const recipeItems = recipes.length
    ? await db
        .select()
        .from(procedureInkRecipeItems)
        .where(
          and(
            eq(procedureInkRecipeItems.studioId, ctx.studioId),
            inArray(
              procedureInkRecipeItems.recipeId,
              recipes.map(r => r.id)
            )
          )
        )
        .orderBy(procedureInkRecipeItems.id)
    : [];
  const results = await db
    .select()
    .from(procedureInkRecipeResults)
    .where(scope(procedureInkRecipeResults))
    .orderBy(procedureInkRecipeResults.id);
  const images = await db
    .select()
    .from(procedureImages)
    .where(eq(procedureImages.procedureId, procedureId))
    .orderBy(procedureImages.id);
  const legacy = await db
    .select()
    .from(procedureConsumables)
    .where(eq(procedureConsumables.procedureId, procedureId))
    .orderBy(procedureConsumables.id);
  const pauses = await db
    .select()
    .from(procedurePauses)
    .where(scope(procedurePauses))
    .orderBy(procedurePauses.id);
  const planned = appointment
    ? await db
        .select()
        .from(appointmentPlannedMaterials)
        .where(
          and(
            eq(appointmentPlannedMaterials.studioId, ctx.studioId),
            eq(appointmentPlannedMaterials.appointmentId, appointment.id)
          )
        )
        .orderBy(appointmentPlannedMaterials.id)
    : [];
  const receipts = await db
    .select()
    .from(transactions)
    .where(
      and(
        eq(transactions.studioId, ctx.studioId),
        eq(transactions.clientId, procedure.clientId),
        eq(transactions.type, "entrada")
      )
    )
    .orderBy(desc(transactions.date), desc(transactions.id))
    .limit(200);
  const previous = await db
    .select({
      payload: procedureEvents.payload,
      procedureId: technicalProcedures.id,
    })
    .from(procedureEvents)
    .innerJoin(
      technicalProcedures,
      eq(technicalProcedures.id, procedureEvents.procedureId)
    )
    .where(
      and(
        eq(technicalProcedures.studioId, ctx.studioId),
        eq(technicalProcedures.clientId, procedure.clientId),
        eq(procedureEvents.eventType, "finalization")
      )
    );
  const used = new Set(
    previous.flatMap(
      p => readFinalization(p.payload)?.allocatedReceiptIds || []
    )
  );
  const availableReceipts = receipts.filter(
    r => r.amount > 0 && !used.has(r.id)
  );
  const existing = readFinalization(
    previous.find(p => p.procedureId === procedureId)?.payload
  );
  const rules = await db
    .select()
    .from(careRules)
    .where(
      and(
        eq(careRules.studioId, ctx.studioId),
        eq(careRules.kind, "session"),
        eq(careRules.enabled, 1)
      )
    )
    .orderBy(careRules.id);
  const client = (
    await db
      .select({ name: clients.name, phone: clients.phone })
      .from(clients)
      .where(
        and(
          eq(clients.id, procedure.clientId),
          eq(clients.studioId, ctx.studioId)
        )
      )
      .limit(1)
  )[0];
  const integrations = await db
    .select({ id: whatsappIntegrations.id })
    .from(whatsappIntegrations)
    .where(
      and(
        eq(whatsappIntegrations.studioId, ctx.studioId),
        eq(whatsappIntegrations.status, "ativo"),
        eq(whatsappIntegrations.isEnabled, 1)
      )
    );
  const consent = await db
    .select({ integrationId: integrationContacts.integrationId, normalizedPhone: integrationContacts.normalizedPhone })
    .from(integrationContacts)
    .where(
      and(
        eq(integrationContacts.studioId, ctx.studioId),
        eq(integrationContacts.clientId, procedure.clientId),
        eq(integrationContacts.hasWhatsappOptIn, 1),
        isNull(integrationContacts.optedOutAt)
      )
    );
  let canMessage = false;
  try {
    const phone = normalizeBrazilianPhone(client?.phone || "");
    canMessage = integrations.some(i => consent.some(c => c.integrationId === i.id && c.normalizedPhone === phone));
  } catch { /* An invalid or missing phone cannot receive automated follow-up. */ }
  const preparedEvent = (
    await db
      .select({ payload: procedureEvents.payload })
      .from(procedureEvents)
      .where(
        and(
          eq(procedureEvents.procedureId, procedureId),
          sql`${procedureEvents.eventType} LIKE 'prepared:%'`
        )
      )
      .limit(1)
  )[0];
  const preparation = readPreparation(preparedEvent?.payload);
  const base = {
    preparation,
    procedure,
    appointment,
    consumptions,
    samples,
    recipes,
    recipeItems,
    results,
    images,
    legacy,
    pauses,
    planned,
    receipts: availableReceipts,
  };
  const hash = createHash("sha256").update(JSON.stringify(base)).digest("hex");
  const sourceKey = procedure.appointmentId
    ? `appointment:${procedure.appointmentId}`
    : `procedure:${procedure.id}`;
  const anchor = (
    await db
      .select()
      .from(careSessions)
      .where(
        and(
          eq(careSessions.studioId, ctx.studioId),
          eq(careSessions.sourceKey, sourceKey)
        )
      )
      .limit(1)
  )[0];
  const settings = (
    await db
      .select({ timezone: messageAutomationSettings.timezone })
      .from(messageAutomationSettings)
      .where(eq(messageAutomationSettings.studioId, ctx.studioId))
      .limit(1)
  )[0];
  const today = new Intl.DateTimeFormat("sv-SE", {
    timeZone: settings?.timezone || "America/Sao_Paulo",
  }).format(
    anchor ? new Date(anchor.completedAt.replace(" ", "T") + "Z") : new Date()
  );
  return {
    ...base,
    hash,
    existing,
    clientName: client?.name || "Cliente",
    canMessage,
    followUp: rules.map(r => ({
      id: r.id,
      name: r.name,
      dueDate: careDueDate(today, r.amount, r.unit),
    })),
  };
}

export async function finalizeSession(
  db: InventoryDatabase,
  ctx: InventoryContext & { user: { id: number; role: string } },
  input: z.infer<typeof finalizeSessionInput>
) {
  return db.transaction(async tx => {
    const database = tx as unknown as InventoryDatabase;
    // A client lock also serializes receipt allocation across this client's sessions.
    const target = (
      await tx
        .select({ clientId: technicalProcedures.clientId })
        .from(technicalProcedures)
        .where(
          and(
            eq(technicalProcedures.id, input.procedureId),
            eq(technicalProcedures.studioId, ctx.studioId)
          )
        )
        .limit(1)
        .for("update")
    )[0];
    if (!target)
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Sessão não encontrada.",
      });
    await tx
      .select({ id: clients.id })
      .from(clients)
      .where(
        and(eq(clients.id, target.clientId), eq(clients.studioId, ctx.studioId))
      )
      .for("update");
    const proc = (
      await tx
        .select()
        .from(technicalProcedures)
        .where(
          and(
            eq(technicalProcedures.id, input.procedureId),
            eq(technicalProcedures.studioId, ctx.studioId)
          )
        )
        .limit(1)
        .for("update")
    )[0];
    if (proc.appointmentId)
      await tx
        .select({ id: appointments.id })
        .from(appointments)
        .where(
          and(
            eq(appointments.id, proc.appointmentId),
            eq(appointments.studioId, ctx.studioId)
          )
        )
        .for("update");
    await tx
      .select({ id: transactions.id })
      .from(transactions)
      .where(
        and(
          eq(transactions.studioId, ctx.studioId),
          eq(transactions.clientId, proc.clientId)
        )
      )
      .for("update");
    const preview = await finalizationPreview(database, ctx, input.procedureId);
    if (proc.status === "finalizado") {
      if (preview.existing?.requestId === input.requestId)
        return { ...preview.existing, replayed: true };
      throw new TRPCError({
        code: "CONFLICT",
        message: "Esta sessão já foi finalizada. Atualize a página.",
      });
    }
    if (preview.hash !== input.previewHash)
      throw new TRPCError({
        code: "CONFLICT",
        message:
          "A sessão ou os recebimentos mudaram. Atualize a revisão antes de confirmar.",
      });
    let amounts;
    try {
      amounts = settlement(
        input.totalCents,
        input.receivedCents,
        input.receiptIds,
        preview.receipts
      );
    } catch (e) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: (e as Error).message,
      });
    }
    const now = new Date().toISOString().slice(0, 19).replace("T", " ");
    const finalNotes = [
      proc.notes,
      input.notes && `Observações finais: ${input.notes}`,
      input.nextSteps && `Próxima sessão: ${input.nextSteps}`,
    ]
      .filter(Boolean)
      .join("\n\n");
    await tx
      .update(technicalProcedures)
      .set({
        status: "finalizado",
        finishedAt: now,
        pausedAt: null,
        chargedAmount: input.totalCents,
        notes: finalNotes || null,
        totalDurationMinutes: effectiveMinutes(
          proc.startedAt,
          now,
          preview.pauses
        ),
        updatedAt: now,
      })
      .where(
        and(
          eq(technicalProcedures.id, proc.id),
          eq(technicalProcedures.studioId, ctx.studioId)
        )
      );
    await tx
      .update(procedurePauses)
      .set({ endedAt: now })
      .where(
        and(
          eq(procedurePauses.studioId, ctx.studioId),
          eq(procedurePauses.procedureId, proc.id),
          isNull(procedurePauses.endedAt)
        )
      );
    if (preview.appointment)
      await tx
        .update(appointments)
        .set({ status: "concluido", updatedAt: now })
        .where(
          and(
            eq(appointments.id, preview.appointment.id),
            eq(appointments.studioId, ctx.studioId)
          )
        );
    let transactionId: number | null = null;
    if (input.receivedCents > 0) {
      const [r] = await tx
        .insert(transactions)
        .values({
          studioId: ctx.studioId,
          clientId: proc.clientId,
          appointmentId: proc.appointmentId,
          type: "entrada",
          category: "servico",
          description: `Sessão POD #${proc.id}: ${proc.title}`,
          amount: input.receivedCents,
          paymentMethod: input.paymentMethod,
          date: now,
        });
      transactionId = (r as any).insertId;
    }
    const result = {
      version: 1,
      requestId: input.requestId,
      ...amounts,
      allocatedReceiptIds: [
        ...input.receiptIds,
        ...(transactionId ? [transactionId] : []),
      ],
      transactionId,
      notes: input.notes,
      nextSteps: input.nextSteps,
      closedAt: now,
      closedBy: ctx.user.id,
      success: true,
      appointmentUpdated: !!preview.appointment,
      transactionCreated: !!transactionId,
      followUp: preview.followUp,
      messagingEligibleAtClosure: preview.canMessage,
    };
    await tx
      .insert(procedureEvents)
      .values({
        procedureId: proc.id,
        eventType: "finalization",
        payload: JSON.stringify(result),
      });
    await tx
      .insert(procedureEvents)
      .values({
        procedureId: proc.id,
        eventType: "finish",
        payload: JSON.stringify({ at: now, createdBy: ctx.user.id }),
      });
    // The existing scheduler generates messages and rechecks consent at delivery.
    const sourceKey = proc.appointmentId
      ? `appointment:${proc.appointmentId}`
      : `procedure:${proc.id}`;
    await tx
      .insert(careSessions)
      .values({
        studioId: ctx.studioId,
        clientId: proc.clientId,
        artistId: preview.procedure.artistId,
        appointmentId: proc.appointmentId,
        sourceKey,
        completedAt: now,
      })
      .onDuplicateKeyUpdate({ set: { sourceKey } });
    return result;
  });
}
