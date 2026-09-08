import { describe, it, expect } from "vitest";
import { appointmentInstant, appointmentsOverlap } from "../shared/appointmentTime";
describe("Agenda e calendário", () => {
  it("preserva horário local em datas SQL e ISO e identifica sobreposição na virada do dia", () => {
    expect(appointmentInstant("2026-09-08 14:00:00").toISOString()).toBe("2026-09-08T14:00:00.000Z");
    expect(appointmentsOverlap("2026-09-08 23:30:00", 120, "2026-09-09T00:30:00", 60)).toBe(true);
    expect(appointmentsOverlap("2026-09-08 14:00:00", 60, "2026-09-08 15:00:00", 60)).toBe(false);
    expect(() => appointmentInstant("not a date")).toThrow();
  });
});
