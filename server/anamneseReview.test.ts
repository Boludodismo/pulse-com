import { describe, expect, it } from "vitest";
import { buildLegacyAnamneseReviewPayload } from "./anamneseReview";

describe("revisão de anamnese legada", () => {
  it("reaproveita os campos compatíveis sem apagar a ficha original", () => {
    const payload = buildLegacyAnamneseReviewPayload(
      { name: "Gilson Carvalho", email: "gilson@example.com", phone: "+5531999999999", city: "Belo Horizonte" },
      { hasAllergies: 1, allergiesDetails: "Látex", usesMedication: 1, medicationDetails: "Antialérgico", hasKeloid: 0, acceptedTerms: 1 },
    );
    expect(payload.client_name).toBe("Gilson Carvalho");
    expect(payload.health_keloid).toBe("nao");
    expect(payload.health_additional_info).toContain("Látex");
    expect(payload.consent_terms).toBe(true);
  });
});
