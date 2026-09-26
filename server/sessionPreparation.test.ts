import { beforeEach, describe, expect, it, vi } from "vitest";
import { getTableName } from "drizzle-orm";
import { MySqlDialect } from "drizzle-orm/mysql-core";
import {
  emptyPreparation,
  preparationSchema,
  preparationRgb,
  validatePreparationMaterial,
} from "../shared/sessionPreparation";
const mocks = vi.hoisted(() => ({ db: vi.fn(), put: vi.fn(), get: vi.fn() }));
vi.mock("./db", () => ({ getDb: mocks.db }));
vi.mock("./saas", () => ({ isUserAccessActive: async () => true }));
vi.mock("./invitedArtistAccess", () => ({
  assertInvitedArtistAccess: async () => undefined,
}));
vi.mock("./storage", () => ({
  storagePut: mocks.put,
  storageGet: mocks.get,
  storageDelete: vi.fn(),
}));
import { proceduresRouter } from "./routers/procedures";

const requestId = "58ae1dea-d910-45d6-8526-4b94ef33164b";
const material = {
  id: 4,
  studioId: 7,
  ownerArtistId: 3,
  name: "Tinta preta",
  unit: "ml",
  category: "Tinta",
  isActive: 1,
};
const input = {
  clientId: 9,
  artistId: 3,
  title: "Sessão teste",
  requestId,
  preparation: {
    version: 1 as const,
    materials: [
      {
        tenantMaterialId: 4,
        name: "nome enviado pelo navegador",
        unit: "ml",
        quantity: "0.500",
      },
    ],
    colors: [
      {
        name: "Sombra",
        hex: "#123456",
        cupSize: "M" as const,
        dropsPerMl: 20,
        ingredients: [
          {
            tenantMaterialId: 4,
            name: "nome enviado pelo navegador",
            drops: 5,
          },
        ],
      },
    ],
  },
};
function dbDouble(
  options: {
    missingClient?: boolean;
    missingMaterial?: boolean;
    failColors?: boolean;
    foreignSource?: boolean;
  } = {}
) {
  let writes: { table: string; values: any }[] = [];
  const filters: { table: string; params: unknown[] }[] = [];
  let procedure: any;
  const db: any = {
    select: () => {
      let table = "",
        joined = false,
        params: unknown[] = [];
      const q: any = {
        from: (t: any) => {
          table = getTableName(t);
          return q;
        },
        innerJoin: () => {
          joined = true;
          return q;
        },
        where: (sql: any) => {
          params = new MySqlDialect().sqlToQuery(sql).params;
          filters.push({ table, params });
          return q;
        },
        limit: () => q,
        for: () => q,
        then: (resolve: any, reject: any) =>
          Promise.resolve(
            (() => {
              if (table === "clients")
                return options.missingClient ? [] : [{ id: 9 }];
              if (table === "artists") return [{ id: 3 }];
              if (table === "tenant_materials")
                return options.missingMaterial ? [] : [material];
              if (table === "studio_material_artists") return [];
              if (table === "technical_procedures") {
                if (joined)
                  return procedure &&
                    writes.some(
                      w =>
                        w.table === "procedure_events" &&
                        params.includes(w.values.eventType)
                    )
                    ? [{ procedure }]
                    : [];
                if (params.includes(99))
                  return options.foreignSource
                    ? []
                    : [
                        {
                          id: 99,
                          clientId: 9,
                          studioId: 7,
                          referenceImageKey: "procedures/7/old.png",
                        },
                      ];
                return procedure ? [procedure] : [];
              }
              return [];
            })()
          ).then(resolve, reject),
      };
      return q;
    },
    insert: (t: any) => ({
      values: async (values: any) => {
        const table = getTableName(t);
        if (options.failColors && table === "procedure_color_samples")
          throw new Error("simulated color write failure");
        writes.push({ table, values });
        if (table === "technical_procedures") procedure = { ...values, id: 21 };
        return [{ insertId: 21 }];
      },
    }),
    transaction: async (fn: any) => {
      const original = [...writes],
        previous = procedure;
      try {
        return await fn(db);
      } catch (e) {
        writes = original;
        procedure = previous;
        throw e;
      }
    },
  };
  mocks.db.mockResolvedValue(db);
  return {
    get writes() {
      return writes;
    },
    filters,
  };
}
const caller = () =>
  proceduresRouter.createCaller({
    user: { id: 1, role: "admin", studioId: 7 },
    req: {},
    res: {},
  } as any);
beforeEach(() => vi.clearAllMocks());
describe("preparação guiada", () => {
  it("salva planejamento e paleta na mesma transação sem movimentar estoque", async () => {
    const d = dbDouble();
    expect((await caller().create(input)).id).toBe(21);
    expect(d.writes.map(w => w.table)).toEqual([
      "technical_procedures",
      "procedure_events",
      "procedure_color_samples",
      "procedure_events",
    ]);
    const plan = JSON.parse(d.writes[1].values.payload);
    expect(plan.materials[0].name).toBe("Tinta preta");
    expect(plan.colors[0].ingredients[0].name).toBe("Tinta preta");
    expect(d.writes[2].values[0]).toMatchObject({
      code: "P01",
      clientId: 9,
      studioId: 7,
      red: 18,
    });
    expect(d.filters.find(f => f.table === "clients")?.params).toEqual([
      9, 7, 0,
    ]);
    expect(d.filters.find(f => f.table === "tenant_materials")?.params).toEqual(
      [4, 7, 1]
    );
  });
  it("reaproveita a sessão ao repetir a mesma requisição após perda de conexão", async () => {
    const d = dbDouble();
    await caller().create(input);
    expect((await caller().create(input)).id).toBe(21);
    expect(
      d.writes.filter(w => w.table === "technical_procedures")
    ).toHaveLength(1);
  });
  it("reverte a criação inteira se a paleta falhar", async () => {
    const d = dbDouble({ failColors: true });
    await expect(caller().create(input)).rejects.toThrow("simulated");
    expect(d.writes).toEqual([]);
  });
  it.each([{ missingClient: true }, { missingMaterial: true }])(
    "rejeita vínculos ausentes ou de outro estúdio",
    async options => {
      const d = dbDouble(options);
      await expect(caller().create(input)).rejects.toThrow();
      expect(d.writes).toEqual([]);
    }
  );
  it("não lê uma referência de outro cliente ou estúdio", async () => {
    const d = dbDouble({ foreignSource: true });
    await expect(
      caller().create({ ...input, referenceFromProcedureId: 99 })
    ).rejects.toThrow("referência anterior");
    expect(mocks.get).not.toHaveBeenCalled();
    expect(d.writes).toEqual([]);
    expect(
      d.filters.some(
        f =>
          f.table === "technical_procedures" &&
          JSON.stringify(f.params) === "[99,7,9]"
      )
    ).toBe(true);
  });
  it("copia a referência anterior para uma nova chave sem alterar o arquivo original", async () => {
    const d = dbDouble();
    mocks.get.mockResolvedValue({
      url: "https://storage.example.test/reference",
    });
    mocks.put.mockResolvedValue({ url: "/api/storage?key=new-reference" });
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response(new Uint8Array([1, 2, 3]), {
          headers: { "content-type": "image/png" },
        })
      );
    try {
      await caller().create({ ...input, referenceFromProcedureId: 99 });
      expect(mocks.get).toHaveBeenCalledWith("procedures/7/old.png");
      expect(mocks.put.mock.calls[0][0]).toMatch(
        /^procedures\/7\/ref-.+\.png$/
      );
      expect(d.writes[0].values.referenceImageUrl).toBe(
        "/api/storage?key=new-reference"
      );
    } finally {
      fetchMock.mockRestore();
    }
  });
  it("não cria a sessão quando o upload falha", async () => {
    const d = dbDouble();
    mocks.put.mockRejectedValueOnce(new Error("upload indisponível"));
    await expect(
      caller().create({
        ...input,
        referenceImageBase64: "AQID",
        referenceImageMime: "image/png",
      })
    ).rejects.toThrow("upload indisponível");
    expect(d.writes).toEqual([]);
  });
  it("não permite que um artista prepare uma sessão em nome de outro", async () => {
    const d = dbDouble();
    const artist = proceduresRouter.createCaller({
      user: { id: 2, role: "collaborator", studioId: 7, artistId: 8 },
      req: {},
      res: {},
    } as any);
    await expect(artist.create(input)).rejects.toThrow(
      "somente os dados do seu artista"
    );
    expect(d.writes).toEqual([]);
  });
  it("rejeita unidade alterada, fração de batoque e mistura acima da capacidade", async () => {
    const d = dbDouble();
    await expect(
      caller().create({
        ...input,
        preparation: {
          ...input.preparation,
          materials: [{ ...input.preparation.materials[0], unit: "un" }],
        },
      })
    ).rejects.toThrow("unidade");
    expect(d.writes).toEqual([]);
    expect(() =>
      validatePreparationMaterial(
        { unit: "un", quantity: "0.5" },
        { name: "Batoque P", unit: "un" }
      )
    ).toThrow("inteiras");
    expect(
      preparationSchema.safeParse({
        ...input.preparation,
        colors: [
          {
            ...input.preparation.colors[0],
            ingredients: [{ tenantMaterialId: 4, name: "Tinta", drops: 21 }],
          },
        ],
      }).success
    ).toBe(false);
    expect(preparationSchema.safeParse(emptyPreparation()).success).toBe(true);
    expect(preparationRgb("#000000")).toMatchObject({
      black: 100,
      cyan: 0,
      magenta: 0,
      yellow: 0,
    });
  });
});
