import { describe, expect, it } from "vitest";
import { formatAppointmentActionLinks, isActionLinkUsable, shouldQueueAnamneseAfterAction } from "./appointmentActions";

describe("links públicos de ação de agendamento", () => {
  const links = {
    confirmed: "https://tatuei.com/confirmar?token=confirm",
    early: "https://tatuei.com/confirmar?token=early",
    late: "https://tatuei.com/confirmar?token=late",
    reschedule_requested: "https://tatuei.com/confirmar?token=reschedule",
  };

  it("apresenta as quatro ações solicitadas ao cliente", () => {
    const text = formatAppointmentActionLinks(links);
    expect(text).toContain("Confirmar presença");
    expect(text).toContain("Avisar adiantamento");
    expect(text).toContain("Avisar atraso");
    expect(text).toContain("Solicitar remarcação");
  });

  it("permite acrescentar somente as ações ausentes de um template personalizado", () => {
    const text = formatAppointmentActionLinks(links, ["late", "reschedule_requested"]);
    expect(text).not.toContain("Confirmar presença");
    expect(text).toContain("Avisar atraso");
    expect(text).toContain("Solicitar remarcação");
  });

  it("aceita somente tokens não usados e ainda não expirados", () => {
    const now = new Date("2026-09-01T12:00:00.000Z");
    expect(isActionLinkUsable({ usedAt: null, expiresAt: "2026-09-01T12:01:00.000Z" }, now)).toBe(true);
    expect(isActionLinkUsable({ usedAt: null, expiresAt: "2026-09-01T12:00:00.000Z" }, now)).toBe(false);
    expect(isActionLinkUsable({ usedAt: "2026-09-01T11:59:00.000Z", expiresAt: "2026-09-01T12:01:00.000Z" }, now)).toBe(false);
  });

  it("interpreta a expiração de um agendamento no fuso de São Paulo", () => {
    expect(isActionLinkUsable(
      { usedAt: null, expiresAt: "2026-09-03 08:30:00" },
      new Date("2026-09-03T11:00:00.000Z"),
    )).toBe(true);
    expect(isActionLinkUsable(
      { usedAt: null, expiresAt: "2026-09-03 08:30:00" },
      new Date("2026-09-03T11:31:00.000Z"),
    )).toBe(false);
  });

  it("envia anamnese após ações que mantêm a sessão ativa", () => {
    expect(shouldQueueAnamneseAfterAction("confirmed")).toBe(true);
    expect(shouldQueueAnamneseAfterAction("early")).toBe(true);
    expect(shouldQueueAnamneseAfterAction("late")).toBe(true);
    expect(shouldQueueAnamneseAfterAction("reschedule_requested")).toBe(false);
  });
});
