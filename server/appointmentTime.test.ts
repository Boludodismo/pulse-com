import { describe, it, expect } from "vitest";
import { appointmentInstant, appointmentsOverlap, formatAppointmentInterval, formatAppointmentConflictMessage } from "../shared/appointmentTime";
describe("Agenda e calendário", () => {
  it("preserva horário local em datas SQL e ISO e identifica sobreposição na virada do dia", () => {
    expect(appointmentInstant("2026-09-08 14:00:00").toISOString()).toBe("2026-09-08T14:00:00.000Z");
    expect(appointmentsOverlap("2026-09-08 23:30:00", 120, "2026-09-09T00:30:00", 60)).toBe(true);
    expect(appointmentsOverlap("2026-09-08 14:00:00", 60, "2026-09-08 15:00:00", 60)).toBe(false);
    expect(() => appointmentInstant("not a date")).toThrow();
  });
  it("compara 01:05–02:05 com sessões na madrugada e durante o dia", () => {
    expect(appointmentsOverlap("2026-09-12 01:05:00", 60, "2026-09-12 14:00:00", 180)).toBe(false);
    expect(appointmentsOverlap("2026-09-12 01:05:00", 60, "2026-09-11 23:45:00", 120)).toBe(true);
    expect(appointmentsOverlap("2026-09-12 01:05:00", 60, "2026-09-12 00:05:00", 60)).toBe(false);
    expect(appointmentsOverlap("2026-09-12 01:05:00", 60, "2026-09-12 02:05:00", 60)).toBe(false);
  });
  it("mostra datas e horários completos quando a sessão atravessa a meia-noite", () => {
    expect(formatAppointmentInterval("2026-09-12 01:05:00", 60)).toBe("12/09/2026, das 01:05 às 02:05");
    expect(formatAppointmentInterval("2026-09-11 23:45:00", 120)).toBe("11/09/2026 às 23:45 até 12/09/2026 às 01:45");
    const message = formatAppointmentConflictMessage("Artista Exemplo", [{id:7, clientId:4, clientName:"Cliente Exemplo", date:"2026-09-11 23:45:00", duration:120, service:"Sessão exemplo"}]);
    expect(message).toContain("Cliente Exemplo — 11/09/2026 às 23:45 até 12/09/2026 às 01:45");
    expect(message).toContain("agendamento #7");
  });
});
