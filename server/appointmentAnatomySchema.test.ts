import { afterEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ connect: vi.fn() }));
vi.mock("mysql2/promise", () => ({ default: { createConnection: mocks.connect } }));
import { ensureAppointmentAnatomySchema } from "./_core/appointmentAnatomySchema";
afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });
const production = () => {
  vi.stubEnv("RAILWAY_ENVIRONMENT_ID", "9890a3b6-7cb6-4330-abfe-d7665bbcf900");
  vi.stubEnv("RAILWAY_SERVICE_ID", "7527417a-b872-42bf-b828-e0987b805196");
};
describe("optional appointment anatomy migration", () => {
  it("adds only missing nullable columns once without modifying row data", async () => {
    production();
    const existing = new Set<string>();
    const statements: string[] = [];
    const query = vi.fn(async (sql: string, params?: string[]) => {
      statements.push(sql);
      if (sql.includes("GET_LOCK")) return [[{ acquired: 1 }]];
      if (sql.startsWith("SHOW")) return [existing.has(params![0]) ? [{ Field: params![0] }] : []];
      if (sql.includes("ADD COLUMN")) existing.add(sql.split("ADD COLUMN ")[1].split(" ")[0]);
      return [[]];
    });
    const end = vi.fn();
    mocks.connect.mockResolvedValue({ query, end });
    await ensureAppointmentAnatomySchema();
    await ensureAppointmentAnatomySchema();
    const additions = statements.filter(s => s.includes("ADD COLUMN"));
    expect(additions).toHaveLength(2);
    expect(additions.every(s => s.includes("NULL DEFAULT NULL"))).toBe(true);
    expect(statements.join("\n")).not.toMatch(/\b(UPDATE|DELETE|DROP|TRUNCATE)\b/);
    expect(end).toHaveBeenCalledTimes(2);
  });
  it("fails closed and closes the connection if the lock cannot be acquired", async () => {
    production();
    const query = vi.fn().mockResolvedValue([[{ acquired: 0 }]]);
    const end = vi.fn();
    mocks.connect.mockResolvedValue({ query, end });
    await expect(ensureAppointmentAnatomySchema()).rejects.toThrow("lock unavailable");
    expect(query).toHaveBeenCalledTimes(1);
    expect(end).toHaveBeenCalledOnce();
  });
  it("does not touch an unrelated Railway service", async () => {
    production(); vi.stubEnv("RAILWAY_SERVICE_ID", "other");
    await ensureAppointmentAnatomySchema();
    expect(mocks.connect).not.toHaveBeenCalled();
  });
});
