import { and, eq } from "drizzle-orm";
import { anamneseRequests, anamneseSubmissions } from "../../drizzle/schema";
import { getDb } from "../db";
import { loadInternalNotificationContext, type InternalRecipient } from "./internalRecipient";
import { normalizeBrazilianPhone } from "./phone";
export type InternalDeliveryMetadata = { role: InternalRecipient["role"]; artistId?: number; submissionId?: number };
export type AppointmentNotificationSnapshot = { date: string; clientId: number; artistId: number | null; artist: string };
const actions = new Set(["appointment_action_confirmed", "appointment_action_early", "appointment_action_late", "appointment_action_reschedule_requested"]);
const validId = (n: unknown): n is number => typeof n === "number" && Number.isInteger(n) && n > 0;
function phone(value: string | null | undefined) {try {return value ? normalizeBrazilianPhone(value) : null;} catch {return null;}}
function triggerScope(trigger: string | null | undefined): {kind: "action" | "reminder" | "anamnese"; role: InternalRecipient["role"]} | null {
  if (trigger === "appointment_reminder_1h_artist") return {kind: "reminder", role: "artist"};
  let base = trigger || "";
  let role: InternalRecipient["role"] = "artist";
  if (base.endsWith("_studio_artist")) {role = "studio_artist"; base = base.slice(0, -14);}
  else if (base.endsWith("_studio")) {role = "studio"; base = base.slice(0, -7);}
  if (actions.has(base)) return {kind: "action", role};
  if (base === "anamnese_completed") return {kind: "anamnese", role};
  return null;
}
export function isInternalDeliveryTrigger(trigger: string | null | undefined) {return triggerScope(trigger) !== null;}
export function internalDeliveryTrigger(base: string, role: InternalRecipient["role"]) {return role === "artist" ? base : `${base}_${role}`;}
export function matchesAppointmentSnapshot(current: AppointmentNotificationSnapshot, expected: AppointmentNotificationSnapshot) {
  return current.date === expected.date && current.clientId === expected.clientId &&
    (current.artistId ?? null) === (expected.artistId ?? null) && current.artist === expected.artist;
}
/** Só valida o vínculo persistido e o telefone interno atual; não efetua envios. */
export async function validateInternalDelivery(input: {
  studioId: number; clientId: number | null; appointmentId: number | null;
  recipientPhone: string; recipientType: string; trigger: string | null;
  metadata?: InternalDeliveryMetadata;
}): Promise<boolean> {
  const scope = triggerScope(input.trigger);
  if (!scope || input.recipientType !== "artist" || !validId(input.studioId) || !validId(input.clientId)) return false;
  if (input.metadata && input.metadata.role !== scope.role) return false;
  if (!input.metadata && (scope.role !== "artist" || scope.kind === "anamnese")) return false;
  if (scope.kind !== "anamnese" && !validId(input.appointmentId)) return false;
  if (input.metadata && scope.role !== "studio" && !validId(input.metadata.artistId)) return false;
  if (scope.kind === "anamnese") {
    const db = await getDb();
    if (!db || !validId(input.metadata?.submissionId)) return false;
    const [submission] = await db.select({id: anamneseSubmissions.id, requestId: anamneseSubmissions.requestId, clientId: anamneseSubmissions.clientId, appointmentId: anamneseSubmissions.appointmentId})
      .from(anamneseSubmissions).where(and(eq(anamneseSubmissions.id, input.metadata!.submissionId!), eq(anamneseSubmissions.clientId, input.clientId))).limit(1);
    if (!submission || submission.id !== input.metadata!.submissionId || submission.clientId !== input.clientId || (submission.appointmentId ?? null) !== (input.appointmentId ?? null)) return false;
    const [request] = await db.select({clientId: anamneseRequests.clientId, appointmentId: anamneseRequests.appointmentId, status: anamneseRequests.statusRequest})
      .from(anamneseRequests).where(eq(anamneseRequests.id, submission.requestId)).limit(1);
    if (!request || request.clientId !== input.clientId || (request.appointmentId ?? null) !== (input.appointmentId ?? null) || request.status !== "preenchida") return false;
  }
  const context = await loadInternalNotificationContext(input);
  if (!context.studio || context.studio.id !== input.studioId || context.studio.isActive !== 1 ||
      !context.client || context.client.id !== input.clientId || context.client.studioId !== input.studioId ||
      (input.appointmentId && (!context.appointment || context.appointment.id !== input.appointmentId || context.appointment.clientId !== input.clientId))) return false;
  const normalized = phone(input.recipientPhone);
  if (!normalized) return false;
  const studioMatches = phone(context.studio.phone) === normalized;
  const artistMatches = !!context.artist && context.artist.active === 1 && context.artist.studioId === input.studioId &&
    phone(context.artist.phone) === normalized && (!input.metadata || input.metadata.artistId === context.artist.id);
  return scope.role === "studio" ? studioMatches : scope.role === "artist" ? artistMatches : studioMatches && artistMatches;
}
