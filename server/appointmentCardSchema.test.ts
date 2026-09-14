import { afterEach, describe, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({connect: vi.fn()}));
vi.mock("mysql2/promise", () => ({default: {createConnection: mock.connect}}));
import { ensureAppointmentCardSchema } from "./_core/appointmentCardSchema";
afterEach(() => {vi.unstubAllEnvs(); vi.clearAllMocks();});
describe("appointment schema compatibility", () => {
  it("adds missing column once without modifying existing appointment records", async () => {
    vi.stubEnv("RAILWAY_ENVIRONMENT_ID", "9890a3b6-7cb6-4330-abfe-d7665bbcf900");
    vi.stubEnv("RAILWAY_SERVICE_ID", "7527417a-b872-42bf-b828-e0987b805196");
    let exists = false;
    const statements: string[] = [];
    const query = vi.fn(async (sql: string) => {
      statements.push(sql);
      if (sql.includes("GET_LOCK")) return [[{acquired: 1}]];
      if (sql.startsWith("SHOW")) return [exists ? [{Field: "includeArtistCard"}] : []];
      if (sql.includes("ADD COLUMN")) exists = true;
      return [[]];
    });
    mock.connect.mockResolvedValue({query, end: vi.fn()});
    await ensureAppointmentCardSchema();
    await ensureAppointmentCardSchema();
    expect(statements.filter(s => s.includes("ADD COLUMN"))).toHaveLength(1);
    expect(statements.join("\n")).not.toMatch(/\b(DELETE|UPDATE|TRUNCATE|DROP)\b/);
  });
  it("does not touch other deployments", async () => {
    vi.stubEnv("RAILWAY_ENVIRONMENT_ID", "other");
    await ensureAppointmentCardSchema();
    expect(mock.connect).not.toHaveBeenCalled();
  });
});
