import { describe, expect, it } from "vitest";
import { assessPublicAnamnese } from "./riskAssessment";

describe("assessPublicAnamnese", () => {
  it("classifica diabetes como alta e queloide como média", () => {
    const result = assessPublicAnamnese({
      health_diabetes: "sim",
      health_keloid: "sim",
    });

    expect(result.riskLevel).toBe("high");
    expect(result.riskFactors).toEqual(expect.arrayContaining([
      expect.objectContaining({ category: "Diabetes", severity: "high" }),
      expect.objectContaining({ category: "Queloide", severity: "medium" }),
    ]));
  });

  it("prioriza fatores críticos sem esconder alertas psicológicos", () => {
    const result = assessPublicAnamnese({
      health_hemophilia: "sim",
      health_depression_anxiety: "sim",
    });

    expect(result.riskLevel).toBe("critical");
    expect(result.riskFactors).toEqual(expect.arrayContaining([
      expect.objectContaining({ category: "Hemofilia", severity: "critical" }),
      expect.objectContaining({ category: "Saúde emocional", severity: "medium" }),
    ]));
  });

  it("mantém baixo risco quando nada foi relatado", () => {
    const result = assessPublicAnamnese({
      health_diabetes: "nao",
      health_keloid: "nao",
      health_depression_anxiety: "nao",
    });

    expect(result.riskLevel).toBe("low");
    expect(result.riskFactors[0]?.category).toBe("Geral");
  });
});
