import { describe, expect, it } from "vitest";
import { calculatePublicAnamneseRisk } from "./riskAssessment";

describe("calculatePublicAnamneseRisk", () => {
  it("classifica diabetes como atenção alta e registra orientação", () => {
    const result = calculatePublicAnamneseRisk({ health_diabetes: "sim" });
    expect(result.riskLevel).toBe("high");
    expect(result.riskFactors).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "DIABETES", category: "Diabetes", severity: "high" }),
    ]));
  });

  it("classifica tendência a quelóide como atenção alta", () => {
    const result = calculatePublicAnamneseRisk({ health_keloid: "sim" });
    expect(result.riskLevel).toBe("high");
    expect(result.riskFactors[0].guidance).toContain("cicatrização");
  });

  it("mantém o maior nível quando existem vários fatores", () => {
    const result = calculatePublicAnamneseRisk({
      health_anemia: "sim",
      health_diabetes: "sim",
      health_hemophilia: "sim",
    });
    expect(result.riskLevel).toBe("critical");
    expect(result.riskFactors).toHaveLength(3);
  });

  it("solicita esclarecimento quando o cliente não sabe responder", () => {
    const result = calculatePublicAnamneseRisk({ health_cardiopathy: "nao_sei" });
    expect(result.riskLevel).toBe("medium");
    expect(result.riskFactors[0].code).toBe("CARDIOPATHY_UNKNOWN");
  });

  it("retorna baixo quando nenhuma condição foi declarada", () => {
    const result = calculatePublicAnamneseRisk({ health_diabetes: "nao", health_keloid: "nao" });
    expect(result.riskLevel).toBe("low");
    expect(result.riskFactors[0].code).toBe("NO_REPORTED_FACTOR");
  });
});
