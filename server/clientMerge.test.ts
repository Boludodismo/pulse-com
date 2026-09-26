import { describe, it, expect } from "vitest";
import type { Connection } from "mysql2/promise";
import {
  duplicatePairs,
  duplicateReasons,
  mergeFields,
  automaticPairs,
  automaticMatch,
  validCpf,
} from "../shared/clientDuplicates";
import {
  loadBatch,
  confirmBatch,
  validateBatchPairs,
} from "./clientMerge/batch";
import {
  loadMerge,
  confirmMerge,
  consentPlan,
  resolvedFields,
  mergeStudio,
} from "./clientMerge/service";

type RecordRow = Record<string, any>;
const clone = <T>(value: T): T => structuredClone(value);
const pair = { targetId: 1, sourceId: 2, choices: {} };
const client = (id: number) => ({
  ...Object.fromEntries(Object.keys(mergeFields).map(k => [k, null])),
  id,
  studioId: 7,
  isArchived: 0,
  name: "Maria Souza",
  phone: "31996531316",
  docType: "cpf",
  totalSpent: id * 1000,
  appointmentCount: id,
  updatedAt: "2026-09-01 10:00:00",
});
const contact = (id: number) => ({
  id,
  studio_id: 7,
  client_id: id,
  integration_id: 9,
  normalized_phone: "+5531996531316",
  has_whatsapp_opt_in: 1,
  opted_out_at: null,
  opt_in_source: "autorizacao_cliente",
  opt_in_at: "2026-09-01 00:00:00",
});

/** Transactional connection double. Unexpected SQL fails loudly. Tests exercise the real
 * preview and commit functions, including writes after a partial failure; no production DB. */
class MemoryConnection {
  data: Record<string, RecordRow[]> = {
    clients: [client(1), client(2)],
    client_merge_audits: [],
    client_merge_batches: [],
    integration_jobs: [],
    integration_contacts: [contact(1), contact(2)],
    appointments: [
      {
        id: 10,
        clientId: 2,
        studioId: 7,
        date: "2026-10-01",
        updatedAt: "2026-09-01",
      },
    ],
    technical_procedures: [
      {
        id: 20,
        clientId: 2,
        studioId: 7,
        status: "finalizado",
        referenceImageUrl: "original.png",
        updatedAt: "2026-09-01",
      },
    ],
    procedure_inventory_consumptions: [
      {
        id: 30,
        clientId: 2,
        studioId: 7,
        procedureId: 20,
        lot: "L001",
        expiresAt: "2027-12-31",
        quantity: "0.25",
      },
    ],
    procedure_color_samples: [
      {
        id: 40,
        clientId: 2,
        studioId: 7,
        procedureId: 20,
        hex: "#aabbee",
        code: "C01",
      },
    ],
    procedure_ink_recipes: [
      {
        id: 50,
        clientId: 2,
        studioId: 7,
        procedureId: 20,
        recipeJson: '{"C01":2}',
      },
    ],
    care_tags: [
      { id: 60, client_id: 1, studio_id: 7, label: "Curvelo" },
      { id: 61, client_id: 2, studio_id: 7, label: "CURVELO" },
      { id: 62, client_id: 2, studio_id: 7, label: "Retorno" },
    ],
    care_events: [
      {
        id: 70,
        client_id: 2,
        studio_id: 7,
        status: "pending",
        token: "original-token",
      },
    ],
    message_queue: [
      {
        id: 80,
        clientId: 2,
        studio_id: 7,
        status: "enviada",
        message: "Texto original",
      },
      { id: 81, clientId: 2, studio_id: 7, status: "pendente" },
    ],
  };
  backup: typeof this.data | null = null;
  commits = 0;
  rollbacks = 0;
  failOn = "";
  asConnection() {
    return this as unknown as Connection;
  }
  async beginTransaction() {
    this.backup = clone(this.data);
  }
  async commit() {
    this.backup = null;
    this.commits++;
  }
  async rollback() {
    if (this.backup) this.data = this.backup;
    this.backup = null;
    this.rollbacks++;
  }
  async execute(sql: string, p: any[] = []): Promise<any> {
    if (this.failOn && sql.includes(this.failOn))
      throw new Error("Injected constraint failure");
    const out = (rows: any) => [clone(rows), []];
    if (sql.startsWith("SELECT id FROM studios")) return out([{ id: p[0] }]);
    if (sql.includes("SELECT id,result_json FROM client_merge_batches"))
      return out(
        this.data.client_merge_batches.filter(
          r => r.studio_id === p[0] && r.preview_hash === p[1]
        )
      );
    if (sql.startsWith("SELECT id,result_json"))
      return out(
        this.data.client_merge_audits.filter(
          r => r.studio_id === p[0] && r.preview_hash === p[1]
        )
      );
    if (sql.startsWith("SELECT * FROM clients"))
      return out(
        this.data.clients
          .filter(r => r.studioId === p[0] && p.slice(1).includes(r.id))
          .sort((a, b) => a.id - b.id)
      );
    if (sql.includes("FROM information_schema.COLUMNS c"))
      return out(
        Object.entries(this.data)
          .filter(
            ([t, rs]) =>
              t !== "clients" &&
              rs.some(
                r => r.clientId !== undefined || r.client_id !== undefined
              )
          )
          .map(([tableName, rs]) => ({
            tableName,
            columnName: rs[0].clientId !== undefined ? "clientId" : "client_id",
            studioColumn:
              rs[0].studioId !== undefined ? "studioId" : "studio_id",
            engine: "InnoDB",
          }))
          .sort((a, b) => a.tableName.localeCompare(b.tableName))
      );
    if (sql.startsWith("SELECT * FROM `")) {
      const m = /FROM `([^`]+)` WHERE `([^`]+)`/.exec(sql)!;
      return out(this.data[m[1]].filter(r => p.includes(r[m[2]])));
    }
    if (sql.startsWith("SELECT * FROM integration_jobs"))
      return out(
        this.data.integration_jobs.filter(
          r =>
            r.studio_id === p[0] &&
            ["pending", "processing", "retry"].includes(r.status)
        )
      );
    if (sql.startsWith("UPDATE integration_contacts")) {
      Object.assign(
        this.data.integration_contacts.find(
          r => r.id === p[0] && r.studio_id === p[1]
        )!,
        { has_whatsapp_opt_in: 0, opted_out_at: "now" }
      );
      return out({ affectedRows: 1 });
    }
    if (sql.startsWith("INSERT INTO care_tags")) {
      for (const row of [...this.data.care_tags].filter(
        r => r.client_id === p[3] && r.studio_id === p[2]
      ))
        if (
          !this.data.care_tags.some(
            r =>
              r.client_id === p[1] &&
              r.studio_id === p[0] &&
              r.label.toLowerCase() === row.label.toLowerCase()
          )
        )
          this.data.care_tags.push({
            ...row,
            id: row.id + 100,
            client_id: p[1],
          });
      return out({});
    }
    if (sql.startsWith("DELETE FROM care_tags")) {
      this.data.care_tags = this.data.care_tags.filter(
        r => r.studio_id !== p[0] || r.client_id !== p[1]
      );
      return out({});
    }
    if (sql.startsWith("UPDATE message_queue SET status")) {
      for (const r of this.data.message_queue)
        if (
          p.slice(0, 2).includes(r.clientId) &&
          r.studio_id === p[2] &&
          r.status === "pendente"
        )
          Object.assign(r, {
            status: "cancelada",
            errorMessage: "União de cadastros: revisar antes de reagendar.",
          });
      return out({});
    }
    if (sql.startsWith("UPDATE care_events SET status")) {
      for (const r of this.data.care_events)
        if (
          p.slice(0, 2).includes(r.client_id) &&
          r.studio_id === p[2] &&
          r.status === "pending"
        )
          r.status = "cancelled";
      return out({});
    }
    if (sql.startsWith("UPDATE `")) {
      const m = /UPDATE `([^`]+)` SET `([^`]+)`/.exec(sql)!;
      let affectedRows = 0;
      for (const r of this.data[m[1]])
        if (
          r[m[2]] === p[1] &&
          (p.length === 2 || (r.studio_id ?? r.studioId) === p[2])
        ) {
          r[m[2]] = p[0];
          affectedRows++;
        }
      return out({ affectedRows });
    }
    if (sql.startsWith("UPDATE clients SET isArchived")) {
      Object.assign(
        this.data.clients.find(r => r.id === p[0] && r.studioId === p[1])!,
        { isArchived: 1, totalSpent: 0, appointmentCount: 0 }
      );
      return out({});
    }
    if (sql.startsWith("UPDATE clients SET")) {
      const keys = Array.from(sql.matchAll(/`([^`]+)`=\?/g), m => m[1]);
      Object.assign(
        this.data.clients.find(
          r => r.id === p[p.length - 2] && r.studioId === p[p.length - 1]
        )!,
        Object.fromEntries(keys.map((k, i) => [k, p[i]]))
      );
      return out({});
    }
    if (sql.startsWith("INSERT INTO client_merge_batches")) {
      const id = this.data.client_merge_batches.length + 1;
      this.data.client_merge_batches.push({
        id,
        studio_id: p[0],
        actor_id: p[1],
        preview_hash: p[2],
        plan_json: p[3],
        result_json: p[4],
      });
      return out({ insertId: id });
    }
    if (sql.startsWith("INSERT INTO client_merge_audits")) {
      const id = this.data.client_merge_audits.length + 1;
      this.data.client_merge_audits.push({
        id,
        studio_id: p[0],
        actor_id: p[1],
        target_id: p[2],
        source_id: p[3],
        preview_hash: p[4],
        before_json: p[5],
        result_json: p[6],
      });
      return out({ insertId: id });
    }
    throw new Error(`Unhandled SQL: ${sql}`);
  }
}
async function preview(c: MemoryConnection, input = pair) {
  await c.beginTransaction();
  const p = await loadMerge(c.asConnection(), 7, input);
  await c.rollback();
  return p;
}

describe("duplicate identity and access", () => {
  it("suggests normalized pairs without assuming transitive identity", () => {
    const pairs = duplicatePairs([
      { id: 1, name: "Má ria Souza", phone: "(31) 99653-1316" },
      { id: 2, name: "Ana Lima", phone: "+55 31 99653-1316", email: "a@b.com" },
      { id: 3, name: "Paulo Lima", email: "a@b.com" },
    ]);
    expect(pairs.map(p => [p.a, p.b])).toEqual([
      [1, 2],
      [2, 3],
    ]);
    expect(
      duplicateReasons(
        {
          id: 1,
          name: "Maria Souza",
          docNumber: "111",
          birthDate: "1980-01-01",
        },
        {
          id: 2,
          name: "MARIA SOUZA",
          docNumber: "222",
          birthDate: "1990-01-01",
        }
      ).conflicts
    ).toHaveLength(2);
  });
  it("does not suggest empty or first-name-only identities", () =>
    expect(
      duplicatePairs([
        { id: 1, name: "Ana" },
        { id: 2, name: "Ana" },
      ])
    ).toEqual([]));
  it("restricts administrators to their studio and rejects collaborators", () => {
    expect(mergeStudio({ role: "admin", studioId: 7 }, 8)).toBe(7);
    expect(mergeStudio({ role: "superadmin" }, 8)).toBe(8);
    expect(() =>
      mergeStudio({ role: "collaborator", studioId: 7 }, 7)
    ).toThrow();
    expect(() => mergeStudio({ role: "superadmin" })).toThrow();
  });
  it("rejects field values sourced from an unrelated client and keeps document type paired", () => {
    expect(() =>
      resolvedFields([client(1), client(2)], { ...pair, choices: { phone: 3 } })
    ).toThrow();
    expect(
      resolvedFields(
        [client(1), { ...client(2), docNumber: "AB12", docType: "passport" }],
        { ...pair, choices: { docNumber: 2 } }
      )
    ).toMatchObject({ docNumber: "AB12", docType: "passport" });
  });
});
describe("merge consent", () => {
  it("keeps only unanimous explicit grants for the exact final number and integration", () => {
    const clients = [client(1), client(2)];
    expect(
      consentPlan(clients, [contact(1), contact(2)], 1, "31996531316").keep
    ).toBe(true);
    for (const contacts of [
      [contact(1)],
      [contact(2)],
      [contact(1), { ...contact(2), opted_out_at: "2026-09-20" }],
      [contact(1), { ...contact(2), integration_id: 10 }],
      [contact(1), { ...contact(2), normalized_phone: "+553898864916" }],
    ])
      expect(consentPlan(clients, contacts, 1, "31996531316").keep).toBe(false);
    expect(
      consentPlan(clients, [contact(1), contact(2)], 1, "3898864916").keep
    ).toBe(false);
  });
});
describe("transactional client merge", () => {
  it("preserves legacy risk and follow-up snapshots while updating only client links", async () => {
    const c = new MemoryConnection();
    c.data.anamnesis_risk_history = [
      {
        id: 90,
        studioId: 7,
        clientId: 2,
        submissionId: 12,
        eventType: "review",
        riskFactors: "original factors",
        createdAt: "2025-01-01",
      },
    ];
    c.data.post_sale_followups = [
      {
        id: 91,
        studioId: 7,
        clientId: 2,
        appointmentId: 10,
        status: "completed",
        serviceSnapshot: "original service",
        message: "original message",
        updatedAt: "2025-01-01",
      },
    ];
    const before = clone(c.data),
      p = await preview(c);
    expect(p.preview.blockers).toEqual([]);
    await confirmMerge(c.asConnection(), 7, 99, pair, p.preview.hash);
    for (const table of ["anamnesis_risk_history", "post_sale_followups"])
      expect(c.data[table][0]).toEqual({ ...before[table][0], clientId: 1 });
  });
  it("preview does not mutate data; confirmation preserves sessions, stock snapshots, recipes, messages and audit", async () => {
    const c = new MemoryConnection(),
      before = clone(c.data);
    const plan = await preview(c);
    expect(c.data).toEqual(before);
    expect(plan.preview.blockers).toEqual([]);
    const result = await confirmMerge(
      c.asConnection(),
      7,
      99,
      pair,
      plan.preview.hash
    );
    expect(c.commits).toBe(1);
    expect(result.auditId).toBe(1);
    expect(c.data.clients[0]).toMatchObject({
      totalSpent: 3000,
      appointmentCount: 3,
      isArchived: 0,
    });
    expect(c.data.clients[1]).toMatchObject({
      isArchived: 1,
      totalSpent: 0,
      appointmentCount: 0,
    });
    for (const table of [
      "appointments",
      "technical_procedures",
      "procedure_inventory_consumptions",
      "procedure_color_samples",
      "procedure_ink_recipes",
    ])
      expect(c.data[table][0]).toEqual({ ...before[table][0], clientId: 1 });
    expect(c.data.care_tags.map(r => [r.client_id, r.label])).toEqual([
      [1, "Curvelo"],
      [1, "Retorno"],
    ]);
    expect(c.data.message_queue[0]).toEqual({
      ...before.message_queue[0],
      clientId: 1,
    });
    expect(c.data.message_queue[1].status).toBe("cancelada");
    expect(c.data.care_events[0]).toMatchObject({
      client_id: 1,
      status: "cancelled",
      token: "original-token",
    });
    expect(c.data.integration_contacts[0].has_whatsapp_opt_in).toBe(1);
    expect(c.data.integration_contacts[1].has_whatsapp_opt_in).toBe(0);
    const audit = JSON.parse(c.data.client_merge_audits[0].before_json);
    expect(audit.clients).toEqual(before.clients);
    expect(
      audit.relations.find((r: any) => r.table === "integration_contacts").rows
    ).toEqual(before.integration_contacts);
    expect(c.data.client_merge_audits[0].actor_id).toBe(99);
  });
  it("repeated confirmation returns the audit without moving or adding again", async () => {
    const c = new MemoryConnection(),
      p = await preview(c);
    await confirmMerge(c.asConnection(), 7, 99, pair, p.preview.hash);
    const saved = clone(c.data);
    expect(
      (await confirmMerge(c.asConnection(), 7, 99, pair, p.preview.hash))
        .repeated
    ).toBe(true);
    expect(c.data).toEqual(saved);
  });
  it("rolls all writes back on a later SQL constraint failure", async () => {
    const c = new MemoryConnection(),
      before = clone(c.data),
      p = await preview(c);
    c.failOn = "INSERT INTO client_merge_audits";
    await expect(
      confirmMerge(c.asConnection(), 7, 99, pair, p.preview.hash)
    ).rejects.toThrow("constraint");
    expect(c.data).toEqual(before);
    expect(c.commits).toBe(0);
  });
  it("requires a new review when a record or related history changed", async () => {
    for (const change of [
      (c: MemoryConnection) => {
        c.data.clients[1].phone = "3898864916";
      },
      (c: MemoryConnection) => {
        c.data.procedure_inventory_consumptions[0].lot = "L002";
      },
      (c: MemoryConnection) => {
        c.data.integration_contacts[1].opted_out_at = "today";
      },
    ]) {
      const c = new MemoryConnection(),
        p = await preview(c);
      change(c);
      const before = clone(c.data);
      await expect(
        confirmMerge(c.asConnection(), 7, 99, pair, p.preview.hash)
      ).rejects.toThrow("mudaram");
      expect(c.data).toEqual(before);
    }
  });
  it("rejects cross-tenant clients and blocks foreign history or unknown references", async () => {
    const c = new MemoryConnection();
    c.data.clients[1].studioId = 8;
    await expect(preview(c)).rejects.toThrow("empresa");
    const d = new MemoryConnection();
    d.data.appointments[0].studioId = 8;
    expect((await preview(d)).preview.blockers.join(" ")).toContain(
      "outra empresa"
    );
    const e = new MemoryConnection();
    e.data.new_history = [{ id: 100, clientId: 2, studioId: 7 }];
    const p = await preview(e);
    expect(p.preview.blockers.join(" ")).toContain("new_history");
    const before = clone(e.data);
    await expect(
      confirmMerge(e.asConnection(), 7, 99, pair, p.preview.hash)
    ).rejects.toThrow("new_history");
    expect(e.data).toEqual(before);
  });
  it("blocks active sessions and in-flight delivery, and refuses an already archived source", async () => {
    const c = new MemoryConnection();
    c.data.technical_procedures[0].status = "em_andamento";
    expect((await preview(c)).preview.blockers.join(" ")).toContain("sessões");
    const d = new MemoryConnection();
    d.data.integration_jobs = [
      {
        id: 200,
        studio_id: 7,
        status: "processing",
        payload: JSON.stringify({ clientId: 2 }),
      },
    ];
    expect((await preview(d)).preview.blockers.join(" ")).toContain("fila");
    const e = new MemoryConnection();
    e.data.clients[1].isArchived = 1;
    await expect(preview(e)).rejects.toThrow("arquivado");
  });
  it("a revocation never becomes permission after merging, and its original evidence remains audited", async () => {
    const c = new MemoryConnection();
    c.data.integration_contacts[1].opted_out_at = "2026-09-20";
    const p = await preview(c);
    await confirmMerge(c.asConnection(), 7, 99, pair, p.preview.hash);
    expect(
      c.data.integration_contacts.every(r => r.has_whatsapp_opt_in === 0)
    ).toBe(true);
    expect(
      JSON.parse(c.data.client_merge_audits[0].before_json).relations.find(
        (r: any) => r.table === "integration_contacts"
      ).rows[1].opted_out_at
    ).toBe("2026-09-20");
  });
});

describe("automatic selection and batch confirmation", () => {
  const strong = (id: number) => ({
    ...client(id),
    docNumber: "529.982.247-25",
    birthDate: "1980-01-01",
  });
  const setup = () => {
    const c = new MemoryConnection();
    c.data.clients = [strong(1), strong(2), strong(3)];
    return c;
  };
  const selected = [
    { targetId: 1, sourceId: 2 },
    { targetId: 1, sourceId: 3 },
  ];
  async function batchPreview(c: MemoryConnection) {
    await c.beginTransaction();
    const p = await loadBatch(c.asConnection(), 7, selected);
    await c.rollback();
    return p;
  }
  it("selects one complete principal and never treats phone or name alone as identity", () => {
    expect(validCpf("529.982.247-25")).toBe(true);
    expect(validCpf("11111111111")).toBe(false);
    expect(validCpf("52998224724")).toBe(false);
    expect(
      automaticPairs([
        { ...strong(2), email: "m@example.com" },
        strong(1),
        strong(3),
      ])
    ).toEqual([
      { targetId: 2, sourceId: 1 },
      { targetId: 2, sourceId: 3 },
    ]);
    expect(automaticMatch(client(1), client(2))).toBe(false);
    expect(
      automaticMatch(strong(1), { ...strong(2), birthDate: "1981-01-01" })
    ).toBe(false);
  });
  it("does not chain groups through missing data or allow duplicate origins and cycles", () => {
    const a = { ...strong(1), email: "one@example.com" },
      b = strong(2),
      d = { ...strong(3), email: "other@example.com" };
    const planned = automaticPairs([a, b, d]);
    expect(planned).toHaveLength(1);
    expect(() =>
      validateBatchPairs([
        { targetId: 1, sourceId: 2 },
        { targetId: 3, sourceId: 2 },
      ])
    ).toThrow();
    expect(() =>
      validateBatchPairs([
        { targetId: 1, sourceId: 2 },
        { targetId: 2, sourceId: 3 },
      ])
    ).toThrow();
  });
  it("merges three copies into one in one transaction and keeps a retriable batch audit", async () => {
    const c = setup(),
      p = await batchPreview(c);
    expect(c.data.clients.every(r => !r.isArchived)).toBe(true);
    expect(p.plans.every(p => !p.preview.consent.keep)).toBe(true);
    const result = await confirmBatch(
      c.asConnection(),
      7,
      99,
      selected,
      p.hash
    );
    expect(result.count).toBe(2);
    expect(c.commits).toBe(1);
    expect(c.data.clients[0].appointmentCount).toBe(6);
    expect(c.data.clients.filter(r => r.isArchived).map(r => r.id)).toEqual([
      2, 3,
    ]);
    expect(c.data.client_merge_audits).toHaveLength(2);
    expect(c.data.integration_contacts[0].has_whatsapp_opt_in).toBe(0);
    const saved = clone(c.data);
    expect(
      (await confirmBatch(c.asConnection(), 7, 99, selected, p.hash)).repeated
    ).toBe(true);
    expect(c.data).toEqual(saved);
  });
  it("rolls back every pair when the final batch audit fails", async () => {
    const c = setup(),
      p = await batchPreview(c),
      before = clone(c.data);
    c.failOn = "INSERT INTO client_merge_batches";
    await expect(
      confirmBatch(c.asConnection(), 7, 99, selected, p.hash)
    ).rejects.toThrow();
    expect(c.data).toEqual(before);
    expect(c.commits).toBe(0);
  });
  it("rejects changed data and insufficient identity before any batch mutation", async () => {
    const c = setup(),
      p = await batchPreview(c);
    c.data.clients[2].phone = "3898864916";
    const before = clone(c.data);
    await expect(
      confirmBatch(c.asConnection(), 7, 99, selected, p.hash)
    ).rejects.toThrow("mudaram");
    expect(c.data).toEqual(before);
    const d = setup();
    d.data.clients[2].docNumber = "11144477735";
    const bad = await batchPreview(d);
    expect(bad.plans.some(p => p.preview.blockers.length)).toBe(true);
    await expect(
      confirmBatch(d.asConnection(), 7, 99, selected, bad.hash)
    ).rejects.toThrow("pendências");
  });
});
