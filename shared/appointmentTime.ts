// Appointment DATETIME values represent the studio's displayed wall clock.
// Use UTC only as a neutral arithmetic axis, never convert the displayed hour.
export function appointmentInstant(value: string | Date): Date {
  if (value instanceof Date) return new Date(value);
  if (!/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2})?(\.\d+)?Z?$/.test(value)) throw new Error("Data de agendamento inválida.");
  const parsed = new Date(value.replace(" ", "T").replace(/Z$/, "") + "Z");
  if (!Number.isFinite(parsed.getTime())) throw new Error("Data de agendamento inválida.");
  return parsed;
}
export function appointmentsOverlap(start: string | Date, duration: number, other: string | Date, otherDuration: number) {
  const a = appointmentInstant(start).getTime();
  const b = appointmentInstant(other).getTime();
  return a < b + otherDuration * 60000 && a + duration * 60000 > b;
}

export function formatAppointmentInterval(date: string | Date, duration: number) {
  const start = appointmentInstant(date);
  const end = new Date(start.getTime() + duration * 60000);
  const day = (value: Date) => value.toLocaleDateString("pt-BR", {timeZone:"UTC"});
  const time = (value: Date) => value.toLocaleTimeString("pt-BR", {timeZone:"UTC",hour:"2-digit",minute:"2-digit"});
  return day(start) === day(end)
    ? `${day(start)}, das ${time(start)} às ${time(end)}`
    : `${day(start)} às ${time(start)} até ${day(end)} às ${time(end)}`;
}

export function formatAppointmentConflictMessage(artist: string, conflicts: Array<{
  id: number; clientId: number; clientName?: string | null; date: string; duration: number; service: string;
}>) {
  const details = conflicts.map(conflict => {
    const client = conflict.clientName || `Cliente #${conflict.clientId}`;
    return `• ${client} — ${formatAppointmentInterval(conflict.date, conflict.duration)}. ${conflict.service} (agendamento #${conflict.id}).`;
  });
  return [`Conflito de horário para ${artist}:`, ...details, "Escolha um intervalo livre ou edite o agendamento existente."].join("\n");
}
