import { describe, expect, it, vi } from "vitest";
import ICAL from "ical.js";
import { generateIcs, generateGoogleCalendarUrl } from "./icsGenerator";

const unfold = (value: string) => value.replace(/\r\n /g, "");

describe("apresentação das exportações sem alterar metadados", () => {
  for (const notes of [null, "Região: antebraço\nLado: esquerdo", "Observação; com vírgula, e barra \\"]) {
    it(`preserva os dados cadastrados: ${notes ?? "sem região"}`, () => {
      vi.stubEnv("TZ", "UTC");
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-10-11T04:00:00Z"));
      try {
        const opts = {
          appointment: { id: 25, date: "2026-10-12 23:30:00", duration: 90, service: "Tatuagem", artist: "Willian", status: "agendado", notes },
          client: { id: 99, name: "João, Silva", phone: "123" },
          studio: { address: "Endereço de teste" },
          confirmationLink: "https://example.test/confirmar?id=25",
          baseUrl: "https://example.test",
        };
        const ics = generateIcs(opts);
        const unfolded = unfold(ics);
        expect(unfolded).toContain("SUMMARY:João\\, Silva — Tatuagem (Willian)");
        expect(unfolded).toContain("DESCRIPTION:Serviço: Tatuagem\\n\\n");
        expect(unfolded).toContain("DTSTART;TZID=America/Sao_Paulo:20261012T233000");
        expect(unfolded).toContain("DTEND;TZID=America/Sao_Paulo:20261013T010000");
        expect(unfolded).toContain("TRIGGER:-PT24H");
        expect(unfolded).toContain("TRIGGER:-PT2H");
        expect(unfolded).toContain("LOCATION:Endereço de teste");
        expect(unfolded).toContain("UID:appointment-25@tatuei.com");
        expect(generateIcs(opts)).toBe(ics);
        const url = new URL(generateGoogleCalendarUrl(opts));
        expect(url.searchParams.get("text")).toBe("João, Silva — Tatuagem");
        expect(url.searchParams.get("details")).toMatch(/^Serviço: Tatuagem\n\n/);
        expect(url.searchParams.get("action")).toBe("TEMPLATE");
        expect(url.searchParams.get("dates")).toBe("20261013T023000/20261013T040000");
        expect(url.searchParams.get("location")).toBe("Endereço de teste");
        if (notes) {
          expect(url.searchParams.get("details")).toContain(notes);
          const escaped = notes.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
          expect(unfolded).toContain(escaped);
        } else {
          expect(unfolded).not.toContain("Região:");
          expect(url.searchParams.get("details")).not.toContain("Lado:");
        }
      } finally { vi.useRealTimers(); vi.unstubAllEnvs(); }
    });
  }
});

describe("campos anatômicos opcionais nas duas exportações", () => {
  it("permite ler o ICS com acentos, quebras de linha e caracteres especiais", () => {
    const calendar = generateIcs({
      appointment: { id: 41, date: "2026-10-12 23:30:00", duration: 90, service: "Retrato; colorido", artist: "Willian", status: "agendado", bodyRegion: "Antebraço", bodySide: "esquerdo", notes: "Linha 1, detalhe\\referência\nLinha 2" },
      client: { id: 1, name: "Ágatha, João 🖋️" },
      baseUrl: "https://example.test",
    });
    const root = new ICAL.Component(ICAL.parse(calendar));
    const event = new ICAL.Event(root.getFirstSubcomponent("vevent")!);
    expect(event.summary).toBe("Ágatha, João 🖋️ — Retrato; colorido (Willian)");
    expect(event.uid).toBe("appointment-41@tatuei.com");
    expect(event.description).toMatch(/^Serviço: Retrato; colorido\nRegião do corpo: Antebraço\nLado do corpo: Esquerdo\n\n/);
    expect(event.description).toContain("Linha 1, detalhe\\referência\nLinha 2");
    expect(event.startDate.toString()).toBe("2026-10-12T23:30:00");
    expect(event.endDate.toString()).toBe("2026-10-13T01:00:00");
    expect(root.getFirstSubcomponent("vevent")!.getAllSubcomponents("valarm")).toHaveLength(2);
  });
  for (const side of [null, "direito", "esquerdo", "ambos"] as const) {
    it(`exporta somente os campos preenchidos: ${side}`, () => {
      const opts = {
        appointment: { id: 31, date: "2026-10-12 09:00:00", duration: 60, service: "Tatuagem", artist: "Willian", status: "confirmado", bodyRegion: side ? "Antebraço" : null, bodySide: side },
        client: { id: 99, name: "Cliente Teste" }, baseUrl: "https://example.test",
      };
      const ics = unfold(generateIcs(opts));
      const google = new URL(generateGoogleCalendarUrl(opts)).searchParams.get("details")!;
      const label = { direito: "Direito", esquerdo: "Esquerdo", ambos: "Ambos" };
      const start = side ? `Serviço: Tatuagem\nRegião do corpo: Antebraço\nLado do corpo: ${label[side]}\n\n` : "Serviço: Tatuagem\n\n";
      expect(google.startsWith(start)).toBe(true);
      expect(ics).toContain(`DESCRIPTION:${start.replace(/\n/g, "\\n")}`);
      if (!side) { expect(google).not.toContain("Lado do corpo"); expect(ics).not.toContain("Região do corpo"); }
    });
  }
  it("dobra linhas por octetos UTF-8 e mantém o nome completo", () => {
    const name = "Ágatha João 🖋️ ".repeat(10);
    const ics = generateIcs({ appointment: { id: 1, date: "2026-10-12 09:00:00", duration: 60, service: "Teste", artist: "Willian", status: "agendado" }, client: { id: 1, name }, baseUrl: "https://example.test" });
    expect(ics.split("\r\n").every(line => Buffer.byteLength(line, "utf8") <= 75)).toBe(true);
    expect(unfold(ics)).toContain(`SUMMARY:${name} — Teste (Willian)`);
  });
});
