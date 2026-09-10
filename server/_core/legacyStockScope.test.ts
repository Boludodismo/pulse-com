import { beforeEach, describe, expect, it, vi } from "vitest";
const db = vi.hoisted(() => ({ query: vi.fn(), execute: vi.fn(), beginTransaction: vi.fn(), commit: vi.fn(), rollback: vi.fn(), end: vi.fn() }));
vi.mock("mysql2/promise", () => ({ default: { createConnection: async () => db } }));
import { ensureLegacyStockScope } from "./legacyStockScope";
let pending = 5;
let origin: { studioId: number }[] = [];
beforeEach(() => {
  vi.clearAllMocks(); vi.stubEnv("DATABASE_URL", "mysql://test.invalid/test"); vi.stubEnv("LEGACY_STOCK_STUDIO_ID", "");
  pending = 5; origin = [{ studioId: 101 }];
  db.rollback.mockResolvedValue(undefined);
  db.commit.mockResolvedValue(undefined);
  db.beginTransaction.mockResolvedValue(undefined);
  db.end.mockResolvedValue(undefined);
  db.query.mockImplementation(async (sql: string) => {
    if (sql.includes("GET_LOCK")) return [[{ acquired: 1 }]];
    if (sql.includes("SHOW COLUMNS") || sql.includes("SHOW INDEX")) return [[]];
    if (sql.includes(" AS total")) return [[{ total: pending }]];
    if (sql.includes("FROM crm_studio_identity_backup")) return [origin];
    return [[]];
  });
  db.execute.mockImplementation(async (sql: string) => sql.startsWith("SELECT id") ? [[{ id: 101 }]] : [{}]);
});
describe("migração aditiva de fornecedores e estoque", () => {
  it("preserva registros antigos no estúdio comprovado pelo backup anterior ao SaaS", async () => {
    await ensureLegacyStockScope();
    const updates = db.execute.mock.calls.filter(([sql]) => sql.startsWith("UPDATE"));
    expect(updates).toHaveLength(3);
    for (const [sql, params] of updates) { expect(sql).toContain("WHERE studioId IS NULL"); expect(params).toEqual([101]); }
    expect(db.execute.mock.calls.filter(([sql]) => sql.startsWith("INSERT IGNORE"))).toHaveLength(3);
    expect(db.commit).toHaveBeenCalledTimes(1);
  });
  it.each([{ rows: [] }, { rows: [{ studioId: 101 }, { studioId: 202 }] }])("recusa origem ausente ou ambígua", async ({ rows }) => {
    origin = rows;
    await expect(ensureLegacyStockScope()).rejects.toThrow("ambiguous");
    expect(db.execute.mock.calls.filter(([sql]) => sql.startsWith("UPDATE"))).toHaveLength(0);
    expect(db.rollback).toHaveBeenCalled();
  });
  it("não reatribui dados após a primeira execução", async () => {
    pending = 0;
    await ensureLegacyStockScope(); await ensureLegacyStockScope();
    expect(db.execute).not.toHaveBeenCalled();
    expect(db.commit).toHaveBeenCalledTimes(2);
  });
  it("aceita apenas mapeamento explícito válido e existente", async () => {
    origin = []; vi.stubEnv("LEGACY_STOCK_STUDIO_ID", "202");
    await ensureLegacyStockScope();
    expect(db.execute).toHaveBeenCalledWith("SELECT id FROM studios WHERE id=?", [202]);
    vi.stubEnv("LEGACY_STOCK_STUDIO_ID", "NaN");
    await expect(ensureLegacyStockScope()).rejects.toThrow("ambiguous");
  });
  it("mantém os dados se o estúdio configurado não existir", async () => {
    db.execute.mockResolvedValue([[]]);
    await expect(ensureLegacyStockScope()).rejects.toThrow("does not exist");
    expect(db.execute.mock.calls.filter(([sql]) => sql.startsWith("UPDATE"))).toHaveLength(0);
  });
});
