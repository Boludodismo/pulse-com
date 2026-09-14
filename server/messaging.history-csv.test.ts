import { describe, expect, it } from "vitest";
import { buildMessageHistoryCSV } from "../client/src/lib/messagingHistoryCsv";

describe("buildMessageHistoryCSV", () => {
  it("gera CSV UTF-8 separado por ponto e vírgula sem expor telefone completo", () => {
    const csv = buildMessageHistoryCSV([{
      createdAt: "2026-09-01T10:00:00.000Z",
      integrationName: "BotConversa",
      recipientName: "Ana \"Silva\"",
      recipientPhoneMasked: "•••• 1234",
      message: "Olá; tudo bem?",
      deliveryStatus: "Erro",
      attemptCount: 5,
      maxAttempts: 5,
      eventStatus: "failed",
      error: "Falha do provedor",
    }]);

    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv).toContain('"•••• 1234"');
    expect(csv).not.toContain("5511999991234");
    expect(csv).toContain('"Ana ""Silva"""');
    expect(csv).toContain('"Olá; tudo bem?"');
  });
});
