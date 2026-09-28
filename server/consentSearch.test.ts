import { describe, it, expect } from "vitest";
import {
  consentActive,
  consentTags,
  matchesConsent,
} from "../shared/consentSearch";
describe("consent client filters", () => {
  const c = {
    clientName: "João da Silva",
    phone: "+55 (31) 99999-1234",
    tags: ["Realismo", "Retorno"],
  };
  it("finds names regardless of accents and phone formatting", () => {
    expect(matchesConsent(c, "joao", "")).toBe(true);
    expect(matchesConsent(c, "(31) 99999-1234", "")).toBe(true);
    expect(matchesConsent(c, "777777", "")).toBe(false);
  });
  it("combines label and search filters", () => {
    expect(matchesConsent(c, "realismo", "Retorno")).toBe(true);
    expect(matchesConsent(c, "Joao", "Fine line")).toBe(false);
  });
  it("only considers non-revoked opt-ins active", () => {
    expect(consentActive({ hasWhatsappOptIn: 1 })).toBe(true);
    expect(
      consentActive({ hasWhatsappOptIn: 1, optedOutAt: "2026-09-21" })
    ).toBe(false);
    expect(consentActive({ hasWhatsappOptIn: null })).toBe(false);
  });
  it("accepts stored tag arrays without rendering objects", () => {
    expect(consentTags('[{"label":"Retorno"},"Realismo"]')).toEqual([
      "Retorno",
      "Realismo",
    ]);
    expect(consentTags(null)).toEqual([]);
  });
});
