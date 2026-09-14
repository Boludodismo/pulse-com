import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { podSaasInternals } from "./podSaas";
import { proceduresInternals } from "./procedures";

describe("POD SaaS — cálculos determinísticos", () => {
  it("calcula custo de consumo sem ponto flutuante", () => {
    expect(podSaasInternals.multiplyQuantityByCost("0.125", "19.9900")).toBe("2.4988");
    expect(podSaasInternals.multiplyQuantityByCost("2.500", "0.3333")).toBe("0.8333");
  });

  it("mantém a escala decimal de estoque de forma estável", () => {
    const quantity = podSaasInternals.decimalToScaled("12.375", 3);
    expect(podSaasInternals.scaledToDecimal(quantity, 3)).toBe("12.375");
  });

  it("desconta pausas fechadas ao calcular o tempo efetivo", () => {
    const timing = podSaasInternals.calculateTiming(
      "2026-09-06 10:00:00",
      "2026-09-06 12:00:00",
      [{ startedAt: "2026-09-06 10:30:00", endedAt: "2026-09-06 10:45:00" }],
    );
    expect(timing).toEqual({ totalMinutes: 120, pausedMinutes: 15, effectiveMinutes: 105 });
  });

  it("nega acesso a um procedimento pertencente a outra empresa", () => {
    expect(() => proceduresInternals.assertProcedureOwner({ studioId: 30001 }, 1, 42))
      .toThrow("Acesso negado a este procedimento.");
  });

  it("não permite reintroduzir fallback para o primeiro estúdio no router legado", () => {
    const routerPath = fileURLToPath(new URL("./procedures.ts", import.meta.url));
    const routerSource = readFileSync(routerPath, "utf8");
    expect(routerSource).not.toContain("ctx.user.studioId ?? 1");
    expect(routerSource.match(/tenantProcedure/g)?.length).toBeGreaterThanOrEqual(16);
  });
});
