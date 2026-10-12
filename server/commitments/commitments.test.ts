import { describe, it, expect } from "vitest";
import {
  nationalHolidays,
  businessDay,
  recurrenceDate,
  occurrences,
  canReadCommitment,
} from "../../shared/commitments";
import { commitmentIcs, foldIcsLine } from "./export";
import { localClock } from "./service";
describe("recorrência e feriados", () => {
  it("inclui datas nacionais e calcula Paixão de Cristo por ano", () => {
    expect(nationalHolidays(2026)).toContainEqual({
      date: "2026-04-03",
      name: "Paixão de Cristo",
      annual: false,
    });
    expect(nationalHolidays(2027).some(h => h.date === "2027-03-26")).toBe(
      true
    );
    expect(nationalHolidays(2026).some(h => h.date === "2026-11-20")).toBe(
      true
    );
    expect(nationalHolidays(2026)).toHaveLength(10);
  });
  it("desloca final de semana, feriado nacional e local consecutivos", () => {
    expect(
      businessDay("2026-10-10", [
        { date: "2026-10-13", name: "Municipal", annual: false },
      ])
    ).toBe("2026-10-14");
  });
  it("feriado local é opcional e não transforma ponto facultativo em nacional", () => {
    expect(businessDay("2026-02-17")).toBe("2026-02-17");
    expect(
      businessDay("2026-02-17", [
        { date: "2025-02-17", name: "Local", annual: true },
      ])
    ).toBe("2026-02-18");
  });
  it("meses curtos preservam âncora 31, sem deriva para 28", () => {
    expect(recurrenceDate("2026-01-31", "monthly", 1)).toBe("2026-02-28");
    expect(recurrenceDate("2026-01-31", "monthly", 2)).toBe("2026-03-31");
  });
  it("trata ano bissexto, intervalos semanais e fim da série", () => {
    expect(recurrenceDate("2024-02-29", "yearly", 1)).toBe("2025-02-28");
    expect(recurrenceDate("2024-02-29", "yearly", 4)).toBe("2028-02-29");
    expect(recurrenceDate("2026-10-05", "weekly", 1, 2)).toBe("2026-10-19");
    expect(
      occurrences(
        "2026-10-05",
        "weekly",
        1,
        "2026-10-13",
        "2026-10-01",
        "2026-10-31",
        false
      )
    ).toHaveLength(2);
  });
  it("não duplica nem altera âncora de dias deslocados", () => {
    expect(
      occurrences(
        "2026-10-10",
        "daily",
        1,
        "2026-10-12",
        "2026-10-01",
        "2026-10-31",
        true
      )
    ).toEqual([
      { originalDate: "2026-10-10", effectiveDate: "2026-10-13" },
      { originalDate: "2026-10-11", effectiveDate: "2026-10-13" },
      { originalDate: "2026-10-12", effectiveDate: "2026-10-13" },
    ]);
  });
  it("datas e avisos usam o fuso da preferência", () => {
    expect(
      localClock("America/Sao_Paulo", new Date("2026-10-12T01:00:00Z"))
    ).toBe("2026-10-11 22:00:00");
  });
});
describe("isolamento de acesso", () => {
  const row = { studioId: 7, ownerId: 10, assigneeId: 11 };
  it("permite somente proprietário e responsável no mesmo estúdio", () => {
    expect(
      canReadCommitment(row, { studioId: 7, userId: 10, role: "admin" })
    ).toBe(true);
    expect(
      canReadCommitment(row, { studioId: 7, userId: 11, role: "collaborator" })
    ).toBe(true);
    expect(
      canReadCommitment(row, { studioId: 7, userId: 12, role: "admin" })
    ).toBe(false);
    expect(
      canReadCommitment(row, { studioId: 8, userId: 10, role: "admin" })
    ).toBe(false);
    expect(
      canReadCommitment(row, { studioId: 7, userId: 10, role: "superadmin" })
    ).toBe(false);
  });
});
describe("exportação de calendário", () => {
  it("exporta série recorrente e exceções de dia inteiro com UID estável", () => {
    const rows = [
      {
        seriesId: 2,
        originalDate: "2026-10-10",
        effectiveDate: "2026-10-13",
        title: "Aluguel; Loja",
        notes: "linha\nsegunda",
        status: "pending",
        revision: 0,
      },
      {
        seriesId: 2,
        originalDate: "2026-11-10",
        effectiveDate: "2026-11-10",
        title: "Aluguel; Loja",
        notes: "",
        status: "paid",
        revision: 1,
      },
    ];
    const ics = commitmentIcs(rows, 7, new Date("2026-10-01T00:00:00Z"));
    expect(ics).toContain("RDATE;VALUE=DATE:20261110");
    expect(ics).toContain("RECURRENCE-ID;VALUE=DATE:20261010");
    expect(ics).toContain("DTSTART;VALUE=DATE:20261013");
    expect(ics).toContain("DTEND;VALUE=DATE:20261014");
    expect(ics).toContain("UID:commitment-series-7-2@tatuei.com");
    expect(ics).toContain("SUMMARY:Aluguel\\; Loja");
  });
  it("folding UTF-8 preserva nomes e limite de linha", () => {
    const line = "SUMMARY:" + "São João ".repeat(30);
    const folded = foldIcsLine(line);
    expect(folded.replace(/\r\n /g, "")).toBe(line);
    expect(folded.split("\r\n").every(l => Buffer.byteLength(l) <= 75)).toBe(
      true
    );
  });
});
