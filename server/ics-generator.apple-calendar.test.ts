import { describe, expect, it } from "vitest";
import { generateGoogleCalendarUrl, generateIcs } from "./icsGenerator";

describe("arquivo ICS compatível com Apple/iCloud", () => {
  it("mantém horário de São Paulo e inclui o bloco de fuso horário", () => {
    const options = {
      appointment: {
        id: 25,
        date: "2026-09-02 09:30:00",
        duration: 90,
        service: "Tatuagem teste",
        artist: "Willian",
        status: "agendado",
      },
      client: { id: 99, name: "Cliente de teste" },
      studio: { name: "Estúdio de teste" },
      baseUrl: "https://crm.example.test",
    };
    const calendar = generateIcs(options);

    expect(calendar).toContain("BEGIN:VTIMEZONE");
    expect(calendar).toContain("TZID:America/Sao_Paulo");
    expect(calendar).toContain("DTSTART;TZID=America/Sao_Paulo:20260902T093000");
    expect(calendar).toContain("DTEND;TZID=America/Sao_Paulo:20260902T110000");
    expect(calendar).toContain("BEGIN:VALARM");
    expect(calendar).toContain("METHOD:PUBLISH");
  });

  it("preserva o link de criação direta no Google Agenda", () => {
    const googleUrl = generateGoogleCalendarUrl({
      appointment: {
        id: 26,
        date: "2026-09-02 09:30:00",
        duration: 60,
        service: "Tatuagem teste",
        artist: "Willian",
        status: "agendado",
      },
      client: { id: 100, name: "Cliente de teste" },
      baseUrl: "https://crm.example.test",
    });

    expect(googleUrl).toContain("https://calendar.google.com/calendar/render?action=TEMPLATE");
    expect(googleUrl).toContain("Tatuagem%20teste");
  });
});
