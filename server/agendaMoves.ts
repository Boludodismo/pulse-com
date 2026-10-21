import { syncAppointmentToSheets } from "./googleSheetsSync";
import {APPOINTMENT_HISTORY_MESSAGE} from '../shared/appointmentHistory';
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, tenantProcedure } from "./_core/trpc";
import * as db from "./db";
import { database, ensureCommitmentsSchema } from "./commitments/db";
import { hasModulePermission } from "./saas";
import { queueAppointmentRescheduleNotice } from "./messaging/appointmentRescheduleNotice";
import { buildAutomaticAppointmentReminderMessage } from "./messaging/appointmentReminderSchedule";
const localDate = z
  .string()
  .regex(/^20\d{2}-\d{2}-\d{2} ([01]\d|2[0-3]):[0-5]\d:00$/)
  .refine(v => {
    const d = new Date(v.replace(" ", "T") + "Z");
    return (
      !Number.isNaN(d.getTime()) &&
      d.toISOString().slice(0, 19).replace("T", " ") === v
    );
  }, "Data inválida");
export async function moveAppointment(
  ctx: any,
  input: {
    id: number;
    expectedDate: string;
    date: string;
    notify?: boolean;
    requestId: string;
    duration?: number;
  }
) {
  if (!ctx.user.studioId)
    throw new TRPCError({ code: "FORBIDDEN" });
  const studioId = ctx.user.studioId;
  await ensureCommitmentsSchema();
  const before = await db.getAppointmentById(input.id);
  if (!before || before.studioId !== studioId)
    throw new TRPCError({ code: "NOT_FOUND" });
  if (
    ctx.user.role === "collaborator" &&
    (before.artistId !== ctx.user.artistId ||
      !(await hasModulePermission({
        userId: ctx.user.id,
        studioId,
        module: "appointments",
        write: true,
      })))
  )
    throw new TRPCError({ code: "FORBIDDEN" });
  if (before.status === "cancelado" || before.status === "concluido")
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Este agendamento está encerrado.",
    });
  if (before.date !== input.expectedDate)
    throw new TRPCError({
      code: "CONFLICT",
      message: "O agendamento mudou. Atualize a agenda antes de confirmar.",
    });
  const duration = input.duration ?? before.duration;
  if (before.date === input.date && duration === before.duration)
    return { success: true, warnings: [] };
  const availability = await db.checkAppointmentConflicts(
    before.artist,
    input.date,
    duration,
    input.id,
    studioId
  );
  if (availability.hasConflict)
    throw new TRPCError({
      code: "CONFLICT",
      message: "O novo horário conflita com outro agendamento do profissional.",
    });
  const client = before.clientId
    ? await db.getClientById(before.clientId)
    : null;
  const c = await database().getConnection();
  let customReminders = false;
  try {
    await c.beginTransaction();
    const [rows]: any = await c.query(
      "SELECT date,status FROM appointments WHERE id=? AND studioId=? FOR UPDATE",
      [input.id, studioId]
    );
    if (rows[0]?.date !== input.expectedDate)
      throw new TRPCError({
        code: "CONFLICT",
        message: "O agendamento mudou. Recarregue a agenda.",
      });
    const [history]:any=await c.query('SELECT appointment_id FROM appointment_attendance WHERE appointment_id=? AND studio_id=? LIMIT 1',[input.id,studioId]);
    if(history.length||rows[0]?.status==='concluido')throw new TRPCError({code:'BAD_REQUEST',message:APPOINTMENT_HISTORY_MESSAGE});
    await c.query(
      "UPDATE appointments SET date=?,duration=? WHERE id=? AND studioId=?",
      [input.date, duration, input.id, studioId]
    );
    const [reminders]: any = await c.query(
      "SELECT id,message FROM appointmentReminders WHERE appointmentId=? AND status='pending'",
      [input.id]
    );
    const previousDefault = buildAutomaticAppointmentReminderMessage({
      clientName: client?.name || "cliente",
      appointmentDate: before.date,
      service: before.service,
      artist: before.artist,
    });
    const nextDefault = buildAutomaticAppointmentReminderMessage({
      clientName: client?.name || "cliente",
      appointmentDate: input.date,
      service: before.service,
      artist: before.artist,
    });
    for (const r of reminders) {
      customReminders ||= r.message !== previousDefault;
      await c.query(
        "UPDATE appointmentReminders SET scheduledAt=DATE_ADD(scheduledAt,INTERVAL TIMESTAMPDIFF(MINUTE,?,?) MINUTE),message=? WHERE id=? AND appointmentId=?",
        [
          before.date,
          input.date,
          r.message === previousDefault ? nextDefault : r.message,
          r.id,
          input.id,
        ]
      );
    }
    await c.query(
      "UPDATE integration_jobs j JOIN message_queue q ON q.id=CAST(JSON_UNQUOTE(JSON_EXTRACT(j.payload,'$.messageQueueId')) AS UNSIGNED) AND q.studio_id=j.studio_id SET j.status='cancelled',q.status='cancelada' WHERE q.appointmentId=? AND q.studio_id=? AND q.trigger LIKE 'appointment_reminder_%' AND q.status='pendente' AND j.status IN ('pending','retry')",
      [input.id, studioId]
    );
    await c.commit();
  } catch (e) {
    await c.rollback();
    throw e;
  } finally {
    c.release();
  }
  const warnings: string[] = [];
  if (customReminders)
    warnings.push(
      "Lembretes personalizados mantiveram o texto. Confira suas datas no conteúdo."
    );
  if (input.notify !== false) {
    const warning = await queueAppointmentRescheduleNotice({
      studioId, appointmentId: input.id, clientId: before.clientId,
      previousDate: before.date, date: input.date, service: before.service,
      artist: before.artist, idempotencyKey: `visual-move:${studioId}:${input.requestId}`,
    });
    if (warning) warnings.push(warning);
  }
  await db.createAuditLog({
    userId: ctx.user.id,
    userName: ctx.user.name || "Usuário",
    action: "update",
    entity: "appointment",
    entityId: input.id,
    details: {
      source: "visual_reschedule",
      before: before.date,
      after: input.date,
      duration,
      notifyAuthorized: input.notify !== false,
    },
  });
  syncAppointmentToSheets({
    id: before.id,
    clientId: before.clientId,
    clientName: client?.name,
    clientPhone: client?.phone,
    artistName: before.artist,
    startTime: new Date(input.date.replace(" ", "T")),
    service: before.service,
    status: before.status,
    depositPaid: before.depositPaid === 1,
    depositAmount: before.depositAmount
      ? Number(before.depositAmount)
      : undefined,
    totalPrice: before.totalAmount ? Number(before.totalAmount) : undefined,
    notes: before.notes,
  });
  return { success: true, warnings };
}
export const agendaMovesRouter = router({
  move: tenantProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        expectedDate: localDate,
        date: localDate,
        notify: z.literal(true).default(true),
        requestId: z.string().uuid(),
      })
    )
    .mutation(({ ctx, input }) => moveAppointment(ctx, input)),
});
