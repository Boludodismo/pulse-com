import { describe, expect, it } from "vitest";
import { buildFinancialReportCSV } from "../client/src/lib/exportCSV";

describe("buildFinancialReportCSV", () => {
  it("gera CSV em pt-BR com escape de aspas e separador compatível com planilhas", () => {
    const csv = buildFinancialReportCSV({
      period: "Mês Atual",
      summary: { totalRevenue: 12345, totalExpenses: 4500, balance: 7845, transactionCount: 1 },
      categoryBreakdown: [{ category: "Tatuagem", total: 12345, count: 1 }],
      paymentMethodBreakdown: [{ paymentMethod: "pix", total: 12345, count: 1 }],
      transactions: [{ id: 1, type: "entrada", category: "Tatuagem", amount: 12345, paymentMethod: "pix", date: "2026-08-26", description: 'Cliente "VIP"' }],
    });

    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv).toContain('"Receita total";"123,45"');
    expect(csv).toContain('"PIX"');
    expect(csv).toContain('"Cliente ""VIP"""');
  });
});
