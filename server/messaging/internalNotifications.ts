import { createHash } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { anamneseRequests, anamneseSubmissions, clients, integrationJobs } from "../../drizzle/schema";
import { getDb } from "../db";
import type { AppointmentAction } from "../appointmentActions";
import { sendAndLog } from "./service";
import { internalRecipients, loadInternalNotificationContext, safeNotificationPhone, type NotificationContext } from "./internalRecipient";
import { internalDeliveryTrigger } from "./internalDelivery";

const digest = (value: string) => createHash("sha256").update(value).digest("hex");
export function canonicalNotificationRevision(value: unknown): string {
  const stable = (v: any): any => Array.isArray(v) ? v.map(stable) : v && typeof v === "object"
    ? Object.fromEntries(Object.keys(v).sort().map(k => [k, stable(v[k])])) : v;
  return digest(JSON.stringify(stable(value)) ?? "null");
}
export function notificationClock(value: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/.exec(value);
  if (!m) throw new Error("Data de agendamento inválida.");
  return `${m[3]}/${m[2]}/${m[1]} às ${m[4]}:${m[5]}`;
}
async function hasLegacyArtistJob(studioId: number, key: string, phone: string) {
  const db = await getDb();
  if (!db) return false;
  const [row] = await db.select({payload: integrationJobs.payload}).from(integrationJobs)
    .where(and(eq(integrationJobs.studioId, studioId), eq(integrationJobs.idempotencyKey, key))).limit(1);
  if (!row) return false;
  try { return safeNotificationPhone(JSON.parse(row.payload).recipientPhone) === phone; } catch { return false; }
}
/** Cada destino possui seu próprio job; falha de um não impede o outro. */
export async function queueInternalFanout(context: NotificationContext, input: {
  trigger: string; eventKey: string; message: string; submissionId?: number; legacyArtistKey?: string;
}) {
  const result = {studioQueued: false, artistQueued: false};
  if (!context.studio || !context.client) return result;
  for (const recipient of internalRecipients(context)) {
    try {
      let accepted = false;
      if (input.legacyArtistKey && recipient.role !== "studio") {
        accepted = await hasLegacyArtistJob(context.studio.id, input.legacyArtistKey, recipient.phone);
      }
      if (!accepted) {
        const sent = await sendAndLog({studioId: context.studio.id, clientId: context.client.id,
          appointmentId: context.appointment?.id, recipientPhone: recipient.phone, recipientName: recipient.name,
          recipientType: "artist", trigger: internalDeliveryTrigger(input.trigger, recipient.role), message: input.message,
          internalRecipient: {role: recipient.role, artistId: recipient.artistId, submissionId: input.submissionId},
          idempotencyKey: digest(`staff:v1:${context.studio.id}:${input.trigger}:${input.eventKey}:${recipient.role}:${recipient.phone}`),
        });
        accepted = Boolean(sent.success && (sent.queued || sent.duplicate));
      }
      if (recipient.role !== "artist") result.studioQueued = accepted;
      if (recipient.role !== "studio") result.artistQueued = accepted;
      if (!accepted) console.warn("[StaffNotifications] Enfileiramento recusado", {studioId: context.studio.id, role: recipient.role, trigger: input.trigger});
    } catch {
      console.warn("[StaffNotifications] Falha ao enfileirar destinatário", {studioId: context.studio.id, role: recipient.role, trigger: input.trigger});
    }
  }
  return result;
}
export async function queueAppointmentStaffAction(input: {studioId: number; appointmentId: number; actionEventKey: string; action: AppointmentAction}) {
  const context = await loadInternalNotificationContext(input);
  if (!context.appointment || !context.client) return {studioQueued: false, artistQueued: false};
  const label: Record<AppointmentAction, string> = {confirmed: "confirmou presença", early: "avisou que chegará adiantado", late: "avisou que chegará atrasado", reschedule_requested: "solicitou remarcação"};
  const message = `Atualização do agendamento\n\n${context.client.name} ${label[input.action]}.\nData: ${notificationClock(context.appointment.date)}\nServiço: ${context.appointment.service}\nArtista: ${context.artist?.name || context.appointment.artist}`;
  return queueInternalFanout(context, {trigger: `appointment_action_${input.action}`, eventKey: input.actionEventKey, message,
    legacyArtistKey: `appointment-action-artist:${input.actionEventKey}`});
}
/** Só recebe ID retornado pela gravação; os vínculos e a versão vêm do banco. */
export async function queueAnamneseCompletion(submissionId: number) {
  const none = {studioQueued: false, artistQueued: false};
  const db = await getDb();
  if (!db) return none;
  const [submission] = await db.select({id: anamneseSubmissions.id, requestId: anamneseSubmissions.requestId, clientId: anamneseSubmissions.clientId, appointmentId: anamneseSubmissions.appointmentId, payloadJson: anamneseSubmissions.payloadJson})
    .from(anamneseSubmissions).where(eq(anamneseSubmissions.id, submissionId)).limit(1);
  if (!submission) return none;
  const [request] = await db.select({clientId: anamneseRequests.clientId, appointmentId: anamneseRequests.appointmentId, status: anamneseRequests.statusRequest})
    .from(anamneseRequests).where(eq(anamneseRequests.id, submission.requestId)).limit(1);
  if (!request || request.clientId !== submission.clientId || (request.appointmentId ?? null) !== (submission.appointmentId ?? null) || request.status !== "preenchida") return none;
  const [owner] = await db.select({studioId: clients.studioId}).from(clients).where(eq(clients.id, submission.clientId)).limit(1);
  if (!owner) return none;
  const context = await loadInternalNotificationContext({studioId: owner.studioId, clientId: submission.clientId, appointmentId: submission.appointmentId});
  if (!context.client || (submission.appointmentId && !context.appointment)) return none;
  const revision = canonicalNotificationRevision(JSON.parse(submission.payloadJson));
  const when = context.appointment ? `\nAgendamento: ${notificationClock(context.appointment.date)}` : "";
  const message = `Ficha de anamnese recebida\n\n${context.client.name} enviou ou atualizou a ficha de anamnese.${when}\nConsulte a ficha no CRM antes do atendimento.`;
  return queueInternalFanout(context, {trigger: "anamnese_completed", eventKey: `${submissionId}:${revision}`, message, submissionId});
}
