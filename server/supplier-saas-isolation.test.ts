import { beforeEach, describe, expect, it, vi } from "vitest";
import { MySqlDialect } from "drizzle-orm/mysql-core";
const state = vi.hoisted(() => ({
  select: vi.fn(), update: vi.fn(), delete: vi.fn(), insert: vi.fn(), transaction: vi.fn(),
  queries: [] as { sql: string; params: unknown[] }[], rows: [] as any[][], values: [] as any[],
}));
vi.mock("drizzle-orm/mysql2", () => ({ drizzle: () => state }));
import { appRouter } from "./routers";

beforeEach(() => {
  vi.stubEnv("DATABASE_URL", "mysql://test.invalid/test");
  state.queries = []; state.rows = []; state.values = [];
  const capture = (sql: any) => { if (sql) state.queries.push(new MySqlDialect().sqlToQuery(sql)); };
  state.select.mockImplementation(() => {
    const rows = state.rows.shift() ?? [];
    const q: any = { from: () => q, leftJoin: (_: any, condition: any) => { capture(condition); return q; },
      where: (condition: any) => { capture(condition); return q; }, orderBy: () => q, limit: () => q, for: () => q,
      then: (resolve: any) => Promise.resolve(rows).then(resolve) };
    return q;
  });
  state.update.mockImplementation(() => ({ set: (data: any) => { state.values.push(data); return { where: async (condition: any) => { capture(condition); return [{ affectedRows: 0 }]; } }; } }));
  state.delete.mockImplementation(() => ({ where: async (condition: any) => { capture(condition); return [{ affectedRows: 0 }]; } }));
  state.insert.mockImplementation(() => ({ values: async (data: any) => { state.values.push(data); return [{ insertId: 77 }]; } }));
  state.transaction.mockImplementation(async fn => fn(state));
});
const caller = (studioId: number | null, role = "admin") => appRouter.createCaller({
  user: { id: 1, openId: "pilot:test", name: "Nome pessoal", role, studioId, isActive: 1, accessStatus: "active" },
  req: { headers: {} }, res: {},
} as any);

const expectScope = (id: number) => {
  expect(state.queries.length).toBeGreaterThan(0);
  for (const query of state.queries) { expect(query.sql).toContain("studioId"); expect(query.params).toContain(id); }
};
describe("fornecedores e pedidos isolados", () => {
  it.each([101, 202])("lista apenas registros do estúdio %i, inclusive inativos", async id => {
    const api = caller(id);
    await expect(api.suppliers.list({ activeOnly: false })).resolves.toEqual([]);
    await expect(api.stock.listMaterials({ activeOnly: false })).resolves.toEqual([]);
    await expect(api.stock.listOrders()).resolves.toEqual([]);
    await expect(api.stock.getLowStock()).resolves.toEqual([]);
    await expect(api.stock.listMovements({})).resolves.toEqual([]);
    expectScope(id);
  });
  it("usa a sessão ao criar, ignorando studioId forjado", async () => {
    await caller(202).suppliers.create({ name: "Fornecedor próprio", studioId: 101 } as any);
    expect(state.values).toEqual([expect.objectContaining({ name: "Fornecedor próprio", studioId: 202 })]);
  });
  it("recusa leitura, edição e exclusão de fornecedor de outra empresa", async () => {
    const api = caller(202);
    await expect(api.suppliers.getById({ id: 999 })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(api.suppliers.update({ id: 999, name: "Invasão" })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(api.suppliers.delete({ id: 999 })).rejects.toMatchObject({ code: "NOT_FOUND" });
    expectScope(202);
  });
  it("bloqueia pedido e link WhatsApp de outra empresa", async () => {
    const api = caller(202);
    await expect(api.stock.getOrder({ id: 999 })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(api.stock.getWhatsAppLink({ orderId: 999 })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(api.stock.updateOrderStatus({ id: 999, status: "enviado" })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(api.stock.deleteOrder({ id: 999 })).rejects.toMatchObject({ code: "NOT_FOUND" });
    expectScope(202);
    expect(state.delete).not.toHaveBeenCalled();
  });
  it("não vincula fornecedor alheio a material ou pedido", async () => {
    const api = caller(202);
    await expect(api.stock.createMaterial({ name: "Tinta", category: "Tintas", unit: "ml", supplierId: 999 })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(api.stock.createOrder({ supplierId: 999, items: [{ materialId: 8, quantity: 1 }] })).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(state.values).toEqual([]); expectScope(202);
  });
  it("não consome nem altera material alheio", async () => {
    const api = caller(202);
    await expect(api.stock.addMovement({ materialId: 999, type: "saida", quantity: 1 })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(api.stock.updateMaterial({ id: 999, name: "Invasão" })).rejects.toMatchObject({ code: "NOT_FOUND" });
    expectScope(202);
  });
  it.each(["admin", "superadmin"])("recusa %s sem estúdio ativo", async role => {
    const api = caller(null, role);
    await expect(api.suppliers.list({})).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(api.suppliers.create({ name: "Teste" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(api.stock.listOrders()).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(state.queries).toEqual([]); expect(state.values).toEqual([]);
  });
});
describe("gestão SaaS e identidade", () => {
  it.each(["admin", "collaborator", "user"])("bloqueia gestão SaaS para %s pelo servidor", async role => {
    const api = caller(202, role);
    for (const operation of [() => api.saas.studios(), () => api.saas.metrics(), () => api.saas.listInvitations(),
      () => api.saas.listStudioInvitations(), () => api.saas.teamAccess(), () => api.saas.permissions({ userId: 1 }),
      () => api.saas.setPermissions({ userId: 1, permissions: [] }), () => api.saas.revokeInvitation({ id: 1 }),
      () => api.saas.createInvitation({ studioId: 202, role: "admin", email: "x@example.test" }),
      () => api.saas.issuePilot({ email: "x@example.test", studioName: "Teste" })]) {
      await expect(operation()).rejects.toMatchObject({ code: "FORBIDDEN" });
    }
    expect(state.queries).toEqual([]); expect(state.values).toEqual([]);
  });
  it("mantém gestão acessível ao superadmin", async () => {
    await expect(caller(101, "superadmin").saas.studios()).resolves.toEqual([]);
    await expect(caller(101, "superadmin").saas.listStudioInvitations()).resolves.toEqual([]);
  });
  it("resolve o nome do estúdio pela sessão, sem usar nome pessoal", async () => {
    state.rows = [[{ id: 202, name: "Estúdio Assinante" }]];
    const user = await caller(202).auth.me();
    expect(user?.studioName).toBe("Estúdio Assinante");
    expect(state.queries[0].params).toEqual([202]);
  });
  it("não escolhe um estúdio arbitrário se não houver vínculo", async () => {
    expect((await caller(null).auth.me())?.studioName).toBeNull();
    expect(state.queries).toEqual([]);
  });
});
