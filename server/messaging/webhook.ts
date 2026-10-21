import { recordCareWhatsappReply } from "./customerCare";
import { getDb } from "../db";
import { messageQueue, appointments } from "../../drizzle/schema";
import { and, eq, desc, or } from "drizzle-orm";
import { normalizeBrazilianPhone } from "./phone";
import { queueArtistCustomerReply } from "./artistNotifications";
import { queueArtistActionNotification } from "../appointmentActions";

/** Preserve legacy numeric confirmation while notifying the assigned artist on ordinary replies too. */
export async function handleWebhookReply(
  phone: string,
  message: string,
  studioId?: number,
  eventKey?: string,
  integrationId?: number
) {
  if (!studioId) throw new Error("Empresa obrigatória para receber mensagens.");
  const notifyReply = (appointmentId?: number) =>
    queueArtistCustomerReply({
      studioId,
      phone,
      text: message,
      eventKey,
      appointmentId,
    });
  if (await recordCareWhatsappReply(studioId, phone, message, eventKey)) {
    // The care handler queues the exact event context and its assigned artist.
    return true;
  }
  const db = await getDb();
  if (!db) return;
  let normalizedPhone: string;
  try {
    normalizedPhone = normalizeBrazilianPhone(phone);
  } catch {
    return;
  }
  const reply = message.trim();
  const recentMessages = await db
    .select()
    .from(messageQueue)
    .where(
      and(
        eq(messageQueue.studioId, studioId),
        eq(messageQueue.recipientType, "client"),
        or(
          eq(messageQueue.recipientPhone, normalizedPhone),
          eq(messageQueue.recipientPhone, normalizedPhone.slice(1)),
          eq(messageQueue.recipientPhone, phone)
        ),
        ...(integrationId
          ? [eq(messageQueue.integrationId, integrationId)]
          : [])
      )
    )
    .orderBy(desc(messageQueue.createdAt))
    .limit(5);
  const lastMsg = recentMessages.find(
    m => m.appointmentId && ["enviada", "respondida"].includes(m.status)
  );
  if (!lastMsg?.appointmentId) {
    await notifyReply();
    return;
  }
  const [apt] = await db
    .select()
    .from(appointments)
    .where(
      and(
        eq(appointments.id, lastMsg.appointmentId),
        eq(appointments.studioId, studioId)
      )
    )
    .limit(1);
  if (!apt || apt.clientId !== lastMsg.clientId) return;
  if (reply !== "1" && reply !== "2") {
    await notifyReply(apt.id);
    return false;
  }
  await db
    .update(appointments)
    .set(
      reply === "1"
        ? { confirmationStatus: "confirmado" }
        : { status: "reagendado", confirmationStatus: "nao_confirmado" }
    )
    .where(
      and(eq(appointments.id, apt.id), eq(appointments.studioId, studioId))
    );
  await db
    .update(messageQueue)
    .set({ status: "respondida" })
    .where(
      and(eq(messageQueue.id, lastMsg.id), eq(messageQueue.studioId, studioId))
    );
  try {
    await queueArtistActionNotification({
      studioId,
      appointmentId: apt.id,
      action: reply === "1" ? "confirmed" : "reschedule_requested",
      actionEventKey: `webhook:${eventKey ?? `${lastMsg.id}:${reply}`}`,
    });
  } catch {
    // A failed internal notification never undoes the customer's recorded decision.
    console.warn("[Webhook] Aviso ao artista indisponível.", {
      studioId,
      appointmentId: apt.id,
    });
  }
  return true;
}
