import { describe, it, expect, vi } from "vitest";
import { getTableName } from "drizzle-orm";
import { MySqlDialect } from "drizzle-orm/mysql-core";
import {
  parseMoneyCents,
  settlement,
  effectiveMinutes,
} from "../shared/sessionFinalization";
vi.mock("./db", () => ({ getDb: vi.fn() }));
import { finalizationPreview, finalizeSession } from "./sessionFinalization";

const ctx = { studioId: 7, artistId: null, user: { id: 1, role: "admin" } };
const input = {
  procedureId: 21,
  requestId: "ad23c1e0-0c0a-4c39-960f-48e24df2657a",
  totalCents: 180000,
  receivedCents: 60000,
  receiptIds: [4],
  paymentMethod: "pix" as const,
  notes: "Sessão concluída",
  nextSteps: "Continuar fundo",
  reviewed: true as const,
};
function database(failTable?: string) {
  let rows: Record<string, any[]> = {
    technical_procedures: [
      {
        id: 21,
        studioId: 7,
        clientId: 9,
        appointmentId: 3,
        artistId: 2,
        title: "Retrato",
        status: "pausado",
        chargedAmount: 180000,
        startedAt: "2026-09-21 09:00:00",
        finishedAt: null,
        notes: "Observação anterior",
      },
    ],
    appointments: [
      {
        id: 3,
        studioId: 7,
        clientId: 9,
        artistId: 2,
        totalAmount: 180000,
        status: "confirmado",
      },
    ],
    clients: [{ id: 9, name: "Cliente Teste", phone: null }],
    transactions: [
      {
        id: 4,
        clientId: 9,
        studioId: 7,
        type: "entrada",
        amount: 30000,
        description: "Sinal",
        appointmentId: 3,
      },
    ],
    procedure_inventory_consumptions: [
      {
        id: 8,
        studioId: 7,
        procedureId: 21,
        nameSnapshot: "Cartucho",
        quantity: "1",
        status: "consumido",
        lotSnapshot: "L01",
        expiresAtSnapshot: "2027-10-01 00:00:00",
      },
    ],
    procedure_pauses: [
      {
        id: 2,
        studioId: 7,
        procedureId: 21,
        startedAt: "2026-09-21 10:00:00",
        endedAt: null,
      },
    ],
  };
  let writes: { table: string; values: any }[] = [];
  const filters: { table: string; params: unknown[] }[] = [];
  const db: any = {
    select: () => {
      let table = "",
        joined = false;
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
          filters.push({
            table,
            params: new MySqlDialect().sqlToQuery(sql).params,
          });
          return q;
        },
        limit: () => q,
        for: () => q,
        orderBy: () => q,
        then: (resolve: any, reject: any) =>
          Promise.resolve(
            joined
              ? (rows[table] || [])
                  .filter(r => r.eventType === "finalization")
                  .map(r => ({ payload: r.payload, procedureId: 21 }))
              : structuredClone(rows[table] || [])
          ).then(resolve, reject),
      };
      return q;
    },
    update: (t: any) => ({
      set: (values: any) => ({
        where: async () => {
          const table = getTableName(t);
          writes.push({ table, values });
          rows[table] = (rows[table] || []).map(r => ({ ...r, ...values }));
          return [{ affectedRows: 1 }];
        },
      }),
    }),
    insert: (t: any) => ({
      values: (values: any) => {
        const table = getTableName(t);
        const run = async () => {
          if (table === failTable) throw new Error("simulated failure");
          writes.push({ table, values });
          rows[table] = [...(rows[table] || []), { ...values, id: 50 }];
          return [{ insertId: 50 }];
        };
        return {
          then: (resolve: any, reject: any) => run().then(resolve, reject),
          onDuplicateKeyUpdate: () => run(),
        };
      },
    }),
    transaction: async (fn: any) => {
      const snapshot = structuredClone(rows),
        original = [...writes];
      try {
        return await fn(db);
      } catch (e) {
        rows = snapshot;
        writes = original;
        throw e;
      }
    },
  };
  return {
    db,
    filters,
    get writes() {
      return writes;
    },
    get rows() {
      return rows;
    },
  };
}
describe("valores e duração da conclusão", () => {
  it("converte reais para centavos sem multiplicação dupla", () => {
    expect(parseMoneyCents("1.800,50")).toBe(180050);
    expect(parseMoneyCents("1800.50")).toBe(180050);
    expect(parseMoneyCents("0,01")).toBe(1);
    expect(parseMoneyCents("1800,501")).toBeNull();
    expect(parseMoneyCents("-10")).toBeNull();
    expect(parseMoneyCents("")).toBeNull();
  });
  it("separa sinal, recebimento atual e saldo sem replicar o pagamento", () => {
    expect(settlement(180000, 60000, [4], [{ id: 4, amount: 30000 }])).toEqual({
      totalCents: 180000,
      previousCents: 30000,
      receivedCents: 60000,
      outstandingCents: 90000,
    });
    expect(() =>
      settlement(180000, 0, [4, 4], [{ id: 4, amount: 30000 }])
    ).toThrow("repetidos");
    expect(() => settlement(100, 101, [], [])).toThrow("ultrapassam");
    expect(() => settlement(100, 0, [4], [])).toThrow("não está disponível");
  });
  it("encerra pausas abertas e não desconta intervalos sobrepostos duas vezes", () => {
    expect(
      effectiveMinutes("2026-09-21 09:00:00", "2026-09-21 11:00:00", [
        { startedAt: "2026-09-21 09:30:00", endedAt: "2026-09-21 10:15:00" },
        { startedAt: "2026-09-21 10:00:00", endedAt: null },
      ])
    ).toBe(30);
    expect(effectiveMinutes(null, "2026-09-21 11:00:00", [])).toBe(0);
  });
});
describe("gravação da finalização", () => {
  it("grava somente o novo recebimento, preserva estoque/lotes e mantém observações", async () => {
    const d = database(),
      preview = await finalizationPreview(d.db, ctx, 21);
    const result = await finalizeSession(d.db, ctx, {
      ...input,
      previewHash: preview.hash,
    });
    expect(result.outstandingCents).toBe(90000);
    expect(d.rows.technical_procedures[0]).toMatchObject({
      status: "finalizado",
      chargedAmount: 180000,
    });
    expect(d.rows.technical_procedures[0].notes).toContain(
      "Observação anterior"
    );
    expect(d.rows.technical_procedures[0].notes).toContain("Continuar fundo");
    expect(
      d.writes.filter(w => w.table === "transactions").map(w => w.values.amount)
    ).toEqual([60000]);
    expect(d.writes.some(w => /inventory|recipe|color/.test(w.table))).toBe(
      false
    );
    expect(d.rows.procedure_inventory_consumptions[0].lotSnapshot).toBe("L01");
    expect(d.rows.care_sessions[0].sourceKey).toBe("appointment:3");
    expect(d.rows.procedure_pauses[0].endedAt).toBeTruthy();
    expect(
      d.filters.some(
        f =>
          f.table === "technical_procedures" &&
          JSON.stringify(f.params) === "[21,7]"
      )
    ).toBe(true);
  });
  it("permite concluir sem entrada financeira e preserva o saldo pendente", async () => {
    const d = database(),
      preview = await finalizationPreview(d.db, ctx, 21);
    const result = await finalizeSession(d.db, ctx, {
      ...input,
      receivedCents: 0,
      receiptIds: [],
      previewHash: preview.hash,
    });
    expect(result.outstandingCents).toBe(180000);
    expect(d.writes.some(w => w.table === "transactions")).toBe(false);
  });
  it("repetir a requisição após perda de conexão não duplica entrada nem acompanhamento", async () => {
    const d = database(),
      preview = await finalizationPreview(d.db, ctx, 21);
    await finalizeSession(d.db, ctx, { ...input, previewHash: preview.hash });
    const result = await finalizeSession(d.db, ctx, {
      ...input,
      previewHash: preview.hash,
    });
    expect(result.replayed).toBe(true);
    expect(d.writes.filter(w => w.table === "transactions")).toHaveLength(1);
    expect(d.writes.filter(w => w.table === "care_sessions")).toHaveLength(1);
  });
  it("rejeita uma revisão desatualizada antes de qualquer gravação", async () => {
    const d = database(),
      preview = await finalizationPreview(d.db, ctx, 21);
    d.rows.transactions[0].amount = 50000;
    await expect(
      finalizeSession(d.db, ctx, { ...input, previewHash: preview.hash })
    ).rejects.toThrow("mudaram");
    expect(d.writes).toEqual([]);
  });
  it("reverte fechamento e financeiro se o registro do acompanhamento falhar", async () => {
    const d = database("care_sessions"),
      preview = await finalizationPreview(d.db, ctx, 21);
    await expect(
      finalizeSession(d.db, ctx, { ...input, previewHash: preview.hash })
    ).rejects.toThrow("simulated");
    expect(d.writes).toEqual([]);
    expect(d.rows.technical_procedures[0].status).toBe("pausado");
    expect(d.rows.transactions).toHaveLength(1);
  });
  it("não oferece um recebimento já atribuído a outra sessão", async () => {
    const d = database();
    d.rows.procedure_events = [
      {
        eventType: "finalization",
        payload: JSON.stringify({
          version: 1,
          totalCents: 30000,
          allocatedReceiptIds: [4],
        }),
      },
    ];
    expect((await finalizationPreview(d.db, ctx, 21)).receipts).toEqual([]);
  });
  it("nega a revisão a um artista diferente", async () => {
    const d = database();
    await expect(
      finalizationPreview(
        d.db,
        { ...ctx, artistId: 6, user: { role: "collaborator" } },
        21
      )
    ).rejects.toThrow("somente os dados do seu artista");
  });
});
