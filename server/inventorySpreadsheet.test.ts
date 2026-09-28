import { describe, it, expect } from "vitest";
import {
  INVENTORY_COLUMNS,
  receiptQuantity,
  receiptCost,
  importDate,
  materialFields,
  cleanCell,
} from "../shared/inventorySpreadsheet";
const row = (v: Record<string, string>) => ({
  ...Object.fromEntries(INVENTORY_COLUMNS.map(k => [k, ""])),
  ...v,
});
describe("inventory spreadsheet validation", () => {
  it("adds only purchased boxes and loose units", () => {
    expect(
      receiptQuantity(
        row({
          unidade_base: "un",
          quantidade_embalagens_recebidas: "2",
          itens_por_embalagem: "20",
          quantidade_avulsa_recebida: "10",
        })
      )
    ).toBe("50.000");
    expect(
      receiptQuantity(
        row({ unidade_base: "un", quantidade_avulsa_recebida: "10" })
      )
    ).toBe("10.000");
  });
  it("converts volumes and weights without interchanging them", () => {
    expect(
      receiptQuantity(
        row({
          unidade_base: "ml",
          quantidade_embalagens_recebidas: "2",
          volume_por_embalagem_ml: "30",
        })
      )
    ).toBe("60.000");
    expect(
      receiptQuantity(
        row({
          unidade_base: "g",
          quantidade_embalagens_recebidas: "1",
          peso_por_embalagem_g: "500",
        })
      )
    ).toBe("500.000");
    expect(() =>
      receiptQuantity(
        row({
          unidade_base: "g",
          quantidade_embalagens_recebidas: "1",
          volume_por_embalagem_ml: "500",
        })
      )
    ).toThrow();
  });
  it("blocks inconsistent totals and partial units", () => {
    expect(() =>
      receiptQuantity(
        row({
          unidade_base: "un",
          quantidade_embalagens_recebidas: "1",
          itens_por_embalagem: "20",
          quantidade_recebida_base: "5",
        })
      )
    ).toThrow();
    expect(() =>
      receiptQuantity(
        row({ unidade_base: "un", quantidade_recebida_base: "1,5" })
      )
    ).toThrow();
  });
  it("requires known cost, accepts free items, and checks unit price", () => {
    expect(receiptCost(row({ custo_total_da_entrada: "60" }), "20")).toBe(
      "3.0000"
    );
    expect(receiptCost(row({ custo_por_unidade_base: "0" }), "20")).toBe(
      "0.0000"
    );
    expect(() => receiptCost(row({}), "20")).toThrow();
    expect(() =>
      receiptCost(
        row({ custo_por_unidade_base: "3", custo_total_da_entrada: "30" }),
        "20"
      )
    ).toThrow();
  });
  it("preserves dates without inventing days", () => {
    expect(importDate("15/10/2028")).toBe("2028-10-15");
    expect(importDate("")).toBeUndefined();
    for (const d of ["10/2028", "2028-02-30", "2028-13-01"])
      expect(() => importDate(d)).toThrow();
  });
  it("does not turn blanks into updates or erase code zeros", () => {
    const f = materialFields(
      row({
        nome: "Cartucho",
        unidade_base: "un",
        marca: "",
        calibre_fabricante: "08",
      })
    );
    expect(f).not.toHaveProperty("brand");
    expect(f.gauge).toBe("08");
    expect(cleanCell(null)).toBe("");
    expect(cleanCell("00123")).toBe("00123");
    expect(f).not.toHaveProperty("currentQuantity");
  });
});
