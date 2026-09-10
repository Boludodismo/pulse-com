import { describe, expect, it } from "vitest";
import { podSaasInternals } from "./routers/podSaas";

describe("previsão de estoque por agendamentos", () => {
  it("soma a demanda futura sem alterar o saldo atual", () => {
    expect(
      podSaasInternals.calculateProjectedStock(
        "20.000",
        ["2.000", "3.500"],
        "5.000"
      )
    ).toEqual({
      plannedDemand: 5.5,
      projectedQuantity: 14.5,
      critical: false,
    });
  });

  it("marca como crítico ao atingir o estoque mínimo", () => {
    expect(
      podSaasInternals.calculateProjectedStock(
        "10.000",
        ["3.000", "2.000"],
        "5.000"
      ).critical
    ).toBe(true);
  });

  it("não trata estoque mínimo zero como alerta configurado", () => {
    expect(
      podSaasInternals.calculateProjectedStock("1.000", ["2.000"], "0.000")
        .critical
    ).toBe(false);
  });
});
