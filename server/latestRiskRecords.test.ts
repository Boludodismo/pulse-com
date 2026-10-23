import { describe, it, expect } from "vitest";
import { latestRiskRecords } from "./latestRiskRecords";
describe("risk record deduplication only", () => {
  const old = { clientId: 1, createdAt: "2026-01-01", source: "legacy", riskLevel: "high" };
  const recent = { ...old, createdAt: "2026-02-01", source: "public", riskLevel: "low" };
  it("keeps the newer record independently of input order, source and risk", () => {
    expect(latestRiskRecords([old, recent])).toEqual([recent]);
    expect(latestRiskRecords([recent, old])).toEqual([recent]);
  });
  it("preserves equal-date behavior and does not mutate history", () => {
    const tie = { ...recent, source: "legacy" };
    const input = [recent, tie, old];
    expect(latestRiskRecords(input)).toEqual([tie]);
    expect(input).toEqual([recent, tie, old]);
  });
  it("retains separate clients", () => {
    expect(latestRiskRecords([old, recent, { ...old, clientId: 2 }])).toHaveLength(2);
  });
});
