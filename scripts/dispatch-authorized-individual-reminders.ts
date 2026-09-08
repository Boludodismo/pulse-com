import { and, eq, gte, inArray, isNull, lte, or } from "drizzle-orm";
import { appointmentReminders, integrationJobs } from "../drizzle/schema";
import { getDb } from "../server/db";
import { enqueueDueIndividualReminders } from "../server/messaging/automaticReminders";
import { processPendingIntegrationJobs } from "../server/messaging/service";

const AUTHORIZED_REMINDER_IDS = [1020001, 1050001] as const;

function sqlDate(date = new Date()) {
  return date.toISOString().slice(0, 19).replace("T", " ");
}

async function main() {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível.");

  const now = sqlDate();
  const recentCutoff = sqlDate(new Date(Date.now() - 24 * 60 * 60 * 1000));
  const due = await db.select({ id: appointmentReminders.id })
    .from(appointmentReminders)
    .where(and(
      eq(appointmentReminders.status, "pending"),
      lte(appointmentReminders.scheduledAt, now),
      gte(appointmentReminders.scheduledAt, recentCutoff),
    ));
  const dueIds = due.map((reminder) => reminder.id).sort((left, right) => left - right);
  const expectedIds = [...AUTHORIZED_REMINDER_IDS].sort((left, right) => left - right);
  if (dueIds.length !== expectedIds.length || dueIds.some((id, index) => id !== expectedIds[index])) {
    throw new Error(`Execução bloqueada: lembretes vencidos atuais não correspondem ao escopo autorizado (${dueIds.join(",") || "nenhum"}).`);
  }

  const readyJobs = await db.select({ id: integrationJobs.id })
    .from(integrationJobs)
    .where(and(
      inArray(integrationJobs.status, ["pending", "retry"]),
      or(lte(integrationJobs.nextAttemptAt, now), isNull(integrationJobs.nextAttemptAt)),
    ));
  if (readyJobs.length > 0) {
    throw new Error(`Execução bloqueada: há ${readyJobs.length} job(s) prontos fora do lote autorizado.`);
  }

  const enqueueResult = await enqueueDueIndividualReminders();
  if (enqueueResult.queued !== AUTHORIZED_REMINDER_IDS.length || enqueueResult.skipped !== 0) {
    throw new Error(`Execução bloqueada após enfileiramento: esperado ${AUTHORIZED_REMINDER_IDS.length} jobs sem ignorados; recebido ${enqueueResult.queued} enfileirados e ${enqueueResult.skipped} ignorados.`);
  }

  const processingResult = await processPendingIntegrationJobs(AUTHORIZED_REMINDER_IDS.length);
  if (processingResult.processed !== AUTHORIZED_REMINDER_IDS.length) {
    throw new Error(`Processamento incompleto: esperado ${AUTHORIZED_REMINDER_IDS.length} jobs, recebido ${processingResult.processed}.`);
  }

  console.log(JSON.stringify({ dueIds, enqueueResult, processingResult }));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
