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
