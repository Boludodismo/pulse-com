import { getDb } from "../db";
import { messageQueue, appointments } from "../../drizzle/schema";
import { eq, desc } from "drizzle-orm";
import { dispatchTemplateMessage } from "./service";

/**
 * Processa respostas recebidas via webhook.
 * - "1" → confirma agendamento
 * - "2" → solicita remarcação
 */
export async function handleWebhookReply(phone: string, message: string) {
  const db = await getDb();
  if (!db) return;

  // Normaliza número
  const normalizedPhone = phone.replace(/[\s\-\+\(\)]/g, "");
  const reply = message.trim();

  // Busca a última mensagem enviada para este número (para saber qual agendamento)
  const recentMessages = await db
    .select()
    .from(messageQueue)
    .where(eq(messageQueue.recipientPhone, normalizedPhone))
    .orderBy(desc(messageQueue.createdAt))
    .limit(5);

  const lastMsg = recentMessages.find((m) => m.appointmentId && m.recipientType === "client");
  if (!lastMsg?.appointmentId) {
    console.log(`[Webhook] Nenhum agendamento encontrado para ${normalizedPhone}`);
    return;
  }

  const appointmentId = lastMsg.appointmentId;
  const clientId = lastMsg.clientId;

  // Busca o agendamento para obter dados do tatuador
  const aptRows = await db
    .select()
    .from(appointments)
    .where(eq(appointments.id, appointmentId))
    .limit(1);

  const apt = aptRows[0];
  if (!apt) return;

  const aptDate = new Date(apt.date.replace(" ", "T"));
  const dataFormatada = aptDate.toLocaleDateString("pt-BR");
  const horaFormatada = aptDate.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  if (reply === "1") {
    // Cliente confirmou
    await db.update(appointments)
      .set({ confirmationStatus: "confirmado" })
      .where(eq(appointments.id, appointmentId));

    // Marca mensagem como respondida
    await db.update(messageQueue)
      .set({ status: "respondida" })
      .where(eq(messageQueue.id, lastMsg.id));

    // Notifica o tatuador (busca o número do artista se disponível)
    // Por ora, dispara template para o artista responsável
    console.log(`[Webhook] Cliente ${normalizedPhone} CONFIRMOU agendamento #${appointmentId}`);

    // Tenta notificar o tatuador se tiver número cadastrado
    await notifyArtistAboutReply(apt, "appointment_confirmed", {
      nome_tatuador: apt.artist,
      nome_cliente: (apt as any).clientName ?? "Cliente",
      data: dataFormatada,
      hora: horaFormatada,
    });

  } else if (reply === "2") {
    // Cliente solicitou remarcação
    await db.update(appointments)
      .set({ status: "reagendado", confirmationStatus: "nao_confirmado" })
      .where(eq(appointments.id, appointmentId));

    await db.update(messageQueue)
      .set({ status: "respondida" })
      .where(eq(messageQueue.id, lastMsg.id));

    console.log(`[Webhook] Cliente ${normalizedPhone} SOLICITOU REMARCAÇÃO do agendamento #${appointmentId}`);

    await notifyArtistAboutReply(apt, "appointment_rescheduled", {
      nome_tatuador: apt.artist,
      nome_cliente: (apt as any).clientName ?? "Cliente",
      data: dataFormatada,
      hora: horaFormatada,
    });
  }
}

async function notifyArtistAboutReply(
  apt: any,
  trigger: string,
  vars: Record<string, string>
) {
  // Busca o número do artista na tabela artists
  try {
    const db = await getDb();
    if (!db || !apt.artistId) return;

    const { artists } = await import("../../drizzle/schema");
    const artistRows = await db
      .select()
      .from(artists)
      .where(eq(artists.id, apt.artistId))
      .limit(1);

    const artist = artistRows[0];
    if (!artist?.phone) return;

    await dispatchTemplateMessage({
      trigger,
      recipientType: "artist",
      recipientPhone: artist.phone,
      recipientName: artist.name,
      appointmentId: apt.id,
      vars,
    });
  } catch (err) {
    console.error("[Webhook] Erro ao notificar artista:", err);
  }
}
