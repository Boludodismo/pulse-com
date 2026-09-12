import { describe, expect, it } from "vitest";
import { buildAutomaticAppointmentReminderMessage, formatBrazilianAppointmentDate, scheduleAutomaticAppointmentReminder } from "./appointmentReminderSchedule";

describe("scheduleAutomaticAppointmentReminder", () => {
  it("mantém o dia escolhido para lembrete no mesmo dia", () => {
    expect(scheduleAutomaticAppointmentReminder("2026-09-08 09:00:00", "same_day", "08:30"))
      .toBe("2026-09-08 08:30:00");
  });

  it("volta um dia corretamente na mudança de mês", () => {
    expect(scheduleAutomaticAppointmentReminder("2026-10-01 09:00:00", "day_before", "09:00"))
      .toBe("2026-09-30 09:00:00");
  });

  it("mantém a mensagem vinculada ao agendamento selecionado", () => {
    const message = buildAutomaticAppointmentReminderMessage({
      clientName: "Cliente", appointmentDate: "2026-09-08 09:00:00", service: "Tatuagem", artist: "Artista",
    });
    expect(message).toContain("Cliente");
    expect(message).toContain("09:00");
    expect(message).toContain("Tatuagem");
    expect(message).toContain("08/09/2026");
    expect(message).not.toContain("2026-09-08");
  });

  it("formata a data de agendamento no padrão brasileiro", () => {
    expect(formatBrazilianAppointmentDate("2026-09-04 19:30:00")).toBe("04/09/2026");
  });
});
