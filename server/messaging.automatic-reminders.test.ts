import { describe, expect, it } from "vitest";
import { automaticReminderIdempotencyKey, isWithinRecentReminderWindow, oneHourReminderWindow, zonedSqlDateTime } from "./messaging/automaticReminders";

describe("automatic reminder keys", () => {
  it("mantém a mesma chave no mesmo ciclo e separa origens independentes", () => {
    const appointment = automaticReminderIdempotencyKey("appointment", 180001, 42, "2026-09-02");
    expect(automaticReminderIdempotencyKey("appointment", 180001, 42, "2026-09-02")).toBe(appointment);
    expect(automaticReminderIdempotencyKey("birthday", 180001, 42, "2026-09-02")).not.toBe(appointment);
    expect(automaticReminderIdempotencyKey("appointment", 180001, 42, "2026-09-03")).not.toBe(appointment);
  });

  it("aceita somente lembretes individuais recentes e nunca recupera os históricos", () => {
    const now = new Date("2026-09-01T12:00:00.000Z");
    expect(isWithinRecentReminderWindow("2026-09-01T11:59:00.000Z", now)).toBe(true);
    expect(isWithinRecentReminderWindow("2026-08-31T12:00:00.000Z", now)).toBe(true);
    expect(isWithinRecentReminderWindow("2026-08-31T11:59:59.000Z", now)).toBe(false);
    expect(isWithinRecentReminderWindow("2026-09-01T12:01:00.000Z", now)).toBe(false);
  });

  it("calcula a janela local de uma hora sem antecipar nem cruzar o dia incorretamente", () => {
    expect(oneHourReminderWindow("2026-09-03", "22:59")).toEqual({
      startsAt: "2026-09-03 23:58:00",
      endsAt: "2026-09-04 00:00:00",
    });
    expect(automaticReminderIdempotencyKey("one_hour_client", 180001, 42, "2026-09-03 23:59:00"))
      .not.toBe(automaticReminderIdempotencyKey("one_hour_artist", 180001, 42, "2026-09-03 23:59:00"));
  });

  it("converte a comparação de lembrete para o horário comercial de São Paulo", () => {
    expect(zonedSqlDateTime(new Date("2026-09-04T19:41:00.000Z"), "America/Sao_Paulo"))
      .toBe("2026-09-04 16:41:00");
  });
});
