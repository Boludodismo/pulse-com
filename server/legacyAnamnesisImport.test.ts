import { describe, expect, it } from "vitest";
import { nextAnnualFollowup, parseCsvRfc4180, previewLegacyAnamnesisCsv } from "./legacyAnamnesisImport";

describe("legacy anamnesis CSV", () => {
  it("preserves commas and line breaks inside quoted fields", () => {
    expect(parseCsvRfc4180('nome,observacao\r\n"Ana, Maria","linha 1\nlinha 2"\r\n')).toEqual([
      ["nome", "observacao"],
      ["Ana, Maria", "linha 1\nlinha 2"],
    ]);
  });

  it("rejects malformed quoted CSV", () => {
    expect(() => parseCsvRfc4180('nome\n"sem fim')).toThrow(/aspas/);
  });

  it("calculates the next anniversary without creating an appointment", () => {
    expect(nextAnnualFollowup("2024-10-15 10:00:00", new Date(2026, 7, 25))).toEqual({
      scheduledAt: "2026-10-15 10:00:00",
      anniversaryYears: 2,
    });
    expect(nextAnnualFollowup("2024-02-10 10:00:00", new Date(2026, 7, 25))).toEqual({
      scheduledAt: "2027-02-10 10:00:00",
      anniversaryYears: 3,
    });
  });

  it("fails preview when the CSV is not the expected form", () => {
    expect(() => previewLegacyAnamnesisCsv("nome,email\nAna,a@b.com", ["Willian"])).toThrow(/não corresponde/);
  });
});
