import { firstName } from "./messagePresentation";

export type AutomaticReminderTiming = "same_day" | "day_before";

function formatLocalDate(date: Date) {
  const year = String(date.getUTCFullYear());
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function formatBrazilianAppointmentDate(appointmentDate: string) {
  const datePart = appointmentDate.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(datePart)) return datePart;
  const [year, month, day] = datePart.split("-");
  return `${day}/${month}/${year}`;
}

/**
 * Mantém a data do agendamento como hora local do estúdio. O banco armazena
 * lembretes nesse formato e o ciclo automático os compara no fuso do estúdio.
 */
export function scheduleAutomaticAppointmentReminder(
  appointmentDate: string,
  timing: AutomaticReminderTiming,
  sendTime: string,
) {
  const datePart = appointmentDate.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
    throw new Error("Data do agendamento inválida para o lembrete automático.");
  }
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(sendTime)) {
    throw new Error("Horário do lembrete automático inválido.");
  }

  const [year, month, day] = datePart.split("-").map(Number);
  const occurrence = new Date(Date.UTC(year, month - 1, day));
  if (timing === "day_before") occurrence.setUTCDate(occurrence.getUTCDate() - 1);
  return `${formatLocalDate(occurrence)} ${sendTime}:00`;
}

export function buildAutomaticAppointmentReminderMessage(params: {
  clientName: string;
  appointmentDate: string;
  service: string;
  artist: string;
}) {
  const [, time = ""] = params.appointmentDate.split(" ");
  return [
    `Olá, ${firstName(params.clientName)}! 👋`,
    "",
    `Lembramos que você tem um agendamento em ${formatBrazilianAppointmentDate(params.appointmentDate)} às ${time.slice(0, 5)}.`,
    `Serviço: ${params.service} com ${params.artist}.`,
    "",
    "Por favor, confirme sua presença ou nos avise se precisar remarcar.",
  ].join("\n");
}
