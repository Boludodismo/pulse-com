import { describe, expect, it } from "vitest";
import {
  formatInventoryDate,
  hoursUntil,
  quantity,
  specificationOf,
  stockProjection,
  units,
} from "./inventoryWorkflowRules";

describe("regras de materiais e prazos", () => {
  it("mantém quantidades fracionárias exatas e rejeita saldo negativo", () => {
    expect(quantity(units("0.100") + units("0.200"))).toBe("0.300");
    expect(() => quantity(-1)).toThrow();
    expect(() => units("1.0001")).toThrow();
  });
  it("distingue disponibilidade, mínimo e falta sem mínimo configurado", () => {
    expect(stockProjection("5", ["2"], "1").level).toBe("available");
    expect(stockProjection("5", ["4"], "1").level).toBe("attention");
    expect(stockProjection("1", ["2"], "0")).toMatchObject({
      level: "shortage",
      shortageQuantity: 1,
      replenishmentQuantity: 1,
    });
  });
  it("compara o prazo no relógio do estúdio, inclusive na virada UTC", () => {
    expect(
      hoursUntil("2026-09-14 22:00:00", new Date("2026-09-15T00:00:00Z"))
    ).toBe(1);
    expect(formatInventoryDate("2026-09-14 22:00:00")).toBe(
      "14/09/2026 às 22:00"
    );
  });
  it("não trata materiais de unidades ou especificações distintas como reposição equivalente", () => {
    expect(
      specificationOf({ name: " Cartucho ", unit: "UN", diameter: "0.25" })
    ).toBe(specificationOf({ name: "cartucho", unit: "un", diameter: "0.25" }));
    expect(specificationOf({ name: "Tinta", unit: "ml" })).not.toBe(
      specificationOf({ name: "Tinta", unit: "frasco" })
    );
    expect(
      specificationOf({ name: "Cartucho", unit: "un", needleCount: 3 })
    ).not.toBe(
      specificationOf({ name: "Cartucho", unit: "un", needleCount: 5 })
    );
  });
});
