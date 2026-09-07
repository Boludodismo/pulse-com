import { beforeEach, describe, expect, it, vi } from "vitest";
import { MySqlDialect } from "drizzle-orm/mysql-core";
import {
  tenantMaterials,
  tenantInventoryMovements,
  procedureInventoryConsumptions,
} from "../drizzle/schema";
const mocks = vi.hoisted(() => ({ getDb: vi.fn() }));
vi.mock("./db", () => ({ getDb: mocks.getDb }));
vi.mock("./saas", () => ({
  hasModulePermission: vi.fn(async () => true),
  isUserAccessActive: vi.fn(async () => true),
}));
import { assertOwnArtist, canUseMaterial } from "./inventoryAccess";
import { podSaasRouter } from "./routers/podSaas";

const admin = {
  user: { id: 1, role: "admin", studioId: 10, artistId: null, isActive: 1 },
} as any;
const artistContext = {
  user: { ...admin.user, id: 2, role: "collaborator", artistId: 20 },
} as any;
const material = {
  id: 50,
  studioId: 10,
  ownerArtistId: null,
  isActive: 1,
  name: "Luva de teste",
  currentQuantity: "10.000",
  minimumQuantity: "0.000",
  unitCost: "2.0000",
  unit: "par",
  lot: null,
  expiresAt: null,
};
// Mock I/O only: real router validation, authorization, decimal arithmetic and Drizzle predicates run.
function database(reads: any[][]) {
  const writes: Array<{ table: unknown; values: any; where?: any }> = [];
  const predicates: any[] = [];
  const db: any = {
    select: vi.fn(() => {
      const rows = reads.shift() ?? [];
      const chain: any = {
        from: () => chain,
        where: (predicate: any) => {
          predicates.push(predicate);
          return chain;
        },
        limit: () => chain,
        orderBy: () => chain,
        for: () => chain,
        then: (resolve: any, reject: any) =>
          Promise.resolve(rows).then(resolve, reject),
      };
      return chain;
    }),
    insert: (table: any) => ({
      values: async (values: any) => {
        writes.push({ table, values });
        return [{ insertId: 75, affectedRows: 1 }];
      },
    }),
    update: (table: any) => ({
      set: (values: any) => ({
        where: async (where: any) => {
          writes.push({ table, values, where });
          return [{ affectedRows: 1 }];
        },
      }),
    }),
    delete: (table: any) => ({
      where: async (where: any) => {
        writes.push({ table, values: "delete", where });
        return [{ affectedRows: 1 }];
      },
    }),
    transaction: async (callback: any) => callback(db),
  };
  mocks.getDb.mockResolvedValue(db);
  return { writes, predicates, db };
}
beforeEach(() => vi.clearAllMocks());
describe("Estoque individual e fornecimento", () => {
  it("nega acesso sem artista vinculado e ao estoque de outro artista", () => {
    expect(() =>
      assertOwnArtist({ ...artistContext, studioId: 10, artistId: null }, null)
    ).toThrow();
    expect(() =>
      assertOwnArtist({ ...artistContext, studioId: 10, artistId: 20 }, 21)
    ).toThrow();
    expect(canUseMaterial(20, [], 20)).toBe(true);
    expect(canUseMaterial(21, [20], 20)).toBe(false);
    expect(canUseMaterial(null, [], 20)).toBe(false);
    expect(canUseMaterial(null, [20], 20)).toBe(true);
    expect(canUseMaterial(null, [], null)).toBe(false);
  });
  it("não permite que um colaborador conceda fornecimento", async () => {
    const { writes } = database([]);
    await expect(
      podSaasRouter
        .createCaller(artistContext)
        .inventory.setSuppliedArtists({ tenantMaterialId: 50, artistIds: [20] })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(writes).toHaveLength(0);
  });
  it("não cadastra estoque de outro artista", async () => {
    const { writes } = database([]);
    await expect(
      podSaasRouter
        .createCaller(artistContext)
        .inventory.create({
          ownerArtistId: 21,
          name: "Luva",
          currentQuantity: "2",
          unitCost: "1",
        })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(writes).toHaveLength(0);
  });
  it("não altera saldo de material disponibilizado pelo estúdio", async () => {
    const { writes } = database([[material]]);
    await expect(
      podSaasRouter
        .createCaller(artistContext)
        .inventory.adjustBalance({
          tenantMaterialId: 50,
          newQuantity: "100",
          reason: "Conferência",
        })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(writes).toHaveLength(0);
  });
  it("cadastra material e saldo inicial usando o insertId real do mysql2", async () => {
    const { writes } = database([]);
    await expect(
      podSaasRouter
        .createCaller(admin)
        .inventory.create({
          name: "Luva",
          currentQuantity: "2.5",
          unitCost: "1",
        })
    ).resolves.toEqual({ id: 75 });
    expect(writes[0]).toMatchObject({
      table: tenantMaterials,
      values: { studioId: 10, ownerArtistId: null, currentQuantity: "2.500" },
    });
    expect(writes[1]).toMatchObject({
      table: tenantInventoryMovements,
      values: { tenantMaterialId: 75, newQuantity: "2.500" },
    });
  });
  it("nega artista de outro estúdio antes de conceder material", async () => {
    const { writes } = database([[material], []]);
    await expect(
      podSaasRouter
        .createCaller(admin)
        .inventory.setSuppliedArtists({ tenantMaterialId: 50, artistIds: [99] })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(writes).toHaveLength(0);
  });
  it("lista somente estoque próprio e materiais do estúdio autorizados", async () => {
    const { predicates } = database([
      [{ id: 20 }],
      [{ tenantMaterialId: 50, artistId: 20 }],
      [
        material,
        { ...material, id: 51 },
        { ...material, id: 52, ownerArtistId: 20 },
        { ...material, id: 53, ownerArtistId: 21 },
      ],
    ]);
    const result = await podSaasRouter
      .createCaller(artistContext)
      .inventory.list();
    expect(result.map(m => m.id)).toEqual([50, 52]);
    const queries = predicates.map(sql => new MySqlDialect().sqlToQuery(sql));
    expect(queries.every(query => query.params.includes(10))).toBe(true);
  });
  it("nega consumo quando o estúdio não fornece o material ao artista", async () => {
    const { writes } = database([
      [{ id: 60, studioId: 10, artistId: 20, status: "em_andamento" }],
      [material],
      [{ id: 20 }],
      [],
    ]);
    await expect(
      podSaasRouter
        .createCaller(artistContext)
        .session.consume({
          procedureId: 60,
          tenantMaterialId: 50,
          quantity: "2",
        })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(writes).toHaveLength(0);
  });
  it("baixa somente na origem autorizada e mantém o custo do consumo", async () => {
    const { writes } = database([
      [
        {
          id: 60,
          studioId: 10,
          artistId: 20,
          clientId: 30,
          status: "em_andamento",
        },
      ],
      [material],
      [{ id: 20 }],
      [{ artistId: 20 }],
    ]);
    await expect(
      podSaasRouter
        .createCaller(artistContext)
        .session.consume({
          procedureId: 60,
          tenantMaterialId: 50,
          quantity: "2.5",
        })
    ).resolves.toMatchObject({ remainingQuantity: "7.500" });
    expect(writes[0]).toMatchObject({
      table: tenantMaterials,
      values: { currentQuantity: "7.500" },
    });
    expect(writes[1]).toMatchObject({
      table: procedureInventoryConsumptions,
      values: {
        tenantMaterialId: 50,
        artistId: 20,
        quantity: "2.500",
        totalCostSnapshot: "5.0000",
      },
    });
    expect(writes[2]).toMatchObject({
      table: tenantInventoryMovements,
      values: { tenantMaterialId: 50, type: "consumo", newQuantity: "7.500" },
    });
  });
  it("não permite saldo negativo", async () => {
    const { writes } = database([
      [{ id: 60, studioId: 10, artistId: 20, status: "em_andamento" }],
      [material],
      [{ id: 20 }],
      [{ artistId: 20 }],
    ]);
    await expect(
      podSaasRouter
        .createCaller(artistContext)
        .session.consume({
          procedureId: 60,
          tenantMaterialId: 50,
          quantity: "11",
        })
    ).rejects.toThrow("Saldo insuficiente");
    expect(writes).toHaveLength(0);
  });
  it("reverte para a origem mesmo que o fornecimento tenha sido revogado", async () => {
    const { writes } = database([
      [
        {
          id: 75,
          artistId: 20,
          tenantMaterialId: 50,
          status: "consumido",
          quantity: "2.500",
        },
      ],
      [{ ...material, currentQuantity: "7.500" }],
    ]);
    await expect(
      podSaasRouter
        .createCaller(artistContext)
        .session.revertConsumption({
          consumptionId: 75,
          reason: "Material não utilizado",
        })
    ).resolves.toMatchObject({ status: "revertido" });
    expect(writes[0]).toMatchObject({
      table: tenantMaterials,
      values: { currentQuantity: "10.000" },
    });
  });
});
