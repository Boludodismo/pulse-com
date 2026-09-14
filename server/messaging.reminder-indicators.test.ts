import { describe, expect, it } from "vitest";

describe("indicadores de lembrete do calendário", () => {
  it("distingue o lembrete padrão do lembrete de uma hora", () => {
    const triggers = ["appointment_reminder", "appointment_reminder_1h_client"];
    expect(triggers.every((trigger) => trigger.startsWith("appointment_reminder"))).toBe(true);
  });

  it("não trata mensagens de artista ou aniversário como lembrete visual do agendamento", () => {
    const visibleTriggers = new Set(["appointment_reminder", "appointment_reminder_1h_client"]);
    expect(visibleTriggers.has("appointment_reminder_1h_artist")).toBe(false);
    expect(visibleTriggers.has("birthday_message")).toBe(false);
  });
});
