import { describe, expect, it } from "vitest";
import {
  formatMessageTimestamp,
  zonedSqlDateTime,
} from "../shared/studioClock";

describe("relógio do histórico de mensagens", () => {
  it("converte registros SQL UTC e ISO para o horário do estúdio", () => {
    expect(formatMessageTimestamp("2026-09-12 01:00:15")).toBe(
      "11/09/2026, 22:00:15"
    );
    expect(formatMessageTimestamp("2026-09-12T01:00:15Z")).toBe(
      "11/09/2026, 22:00:15"
    );
    expect(formatMessageTimestamp("2026-09-11T22:00:15-03:00")).toBe(
      "11/09/2026, 22:00:15"
    );
    expect(
      zonedSqlDateTime(new Date("2026-09-12T03:00:00Z"), "America/Sao_Paulo")
    ).toBe("2026-09-12 00:00:00");
  });
  it("usa outro fuso e trata datas ausentes ou inválidas", () => {
    expect(
      formatMessageTimestamp("2026-09-12 01:00:15", "America/Manaus")
    ).toBe("11/09/2026, 21:00:15");
    expect(formatMessageTimestamp(null)).toBe("—");
    expect(formatMessageTimestamp("invalid")).toBe("Data indisponível");
  });
});
