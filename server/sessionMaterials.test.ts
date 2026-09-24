import { describe, expect, it } from "vitest";
import { readSessionMaterials, snapshotSessionMaterials } from "./sessionMaterials";
import { getTableName } from "drizzle-orm";
import { emptyPreparation, preparationSchema, validateRecipeMaterial } from "../shared/sessionPreparation";
import { isSessionInk, isSessionDiluent, SESSION_CUP_ML, sessionCupSize, validateSessionUnit } from "../shared/sessionInkQuantity";

const material = { tenantMaterialId: 7, name: "Vaselina Electric Ink", unit: "g", quantity: "20.000" };
const procedure = { id: 12, studioId: 4, appointmentId: 15 };
function database(events: any[], appointmentRows: any[] = []) {
  const writes: any[] = [];
  let appointmentReads = 0;
  const db: any = {
    select: () => {
      let table = "";
      const query: any = {
        from: (t: any) => { table = getTableName(t); return query; },
        where: () => query, orderBy: () => query, for: () => query,
        then: (resolve: any) => {
          if (table === "appointment_planned_materials") appointmentReads++;
          return Promise.resolve(table === "procedure_events" ? events : appointmentRows).then(resolve);
        },
      };
      return query;
    },
    insert: (t: any) => ({ values: async (v: any) => { writes.push({ table: getTableName(t), ...v }); events.push(v); } }),
  };
  return { db, writes, get appointmentReads() { return appointmentReads; } };
}
describe("materiais oficiais da sessão", () => {
  it("uses the persisted session and exact quantities, ignoring appointment extras", async () => {
    const d = database([{ eventType: "prepared:request", payload: JSON.stringify({ ...emptyPreparation(), materials: [material] }) }], [{ tenantMaterialId: 88 }]);
    expect((await readSessionMaterials(d.db, procedure)).materials).toEqual([material]);
    expect(d.appointmentReads).toBe(0);
    expect(d.writes).toEqual([]);
  });
  it("reads a preparation saved without a request token", async () => {
    const d = database([{ eventType: "created", payload: JSON.stringify({ ...emptyPreparation(), materials: [material] }) }]);
    expect((await readSessionMaterials(d.db, procedure)).materials).toEqual([material]);
  });
  it("keeps empty preparation empty; adds only explicitly persisted items", async () => {
    const events = [{ eventType: "prepared:request", payload: JSON.stringify(emptyPreparation()) }];
    const d = database(events, [{ tenantMaterialId: 88 }]);
    expect((await readSessionMaterials(d.db, procedure)).materials).toEqual([]);
    events.push({ eventType: "session_material_added", payload: JSON.stringify(material) });
    events.push({ eventType: "session_material_added", payload: JSON.stringify(material) });
    expect((await readSessionMaterials(d.db, procedure)).materials).toEqual([material]);
  });
  it("freezes legacy appointment quantities once without stock writes", async () => {
    const rows = [{ tenantMaterialId: 7, nameSnapshot: material.name, unitSnapshot: "g", quantityPlanned: "20.000", status: "planejado" }];
    const d = database([], rows);
    await snapshotSessionMaterials(d.db, procedure);
    rows[0].quantityPlanned = "999.000";
    await snapshotSessionMaterials(d.db, procedure);
    expect((await readSessionMaterials(d.db, procedure)).materials[0].quantity).toBe("20.000");
    expect(d.writes).toHaveLength(1);
    expect(d.writes[0].table).toBe("procedure_events");
  });
  it("does not fall back to unrelated materials after malformed preparation", async () => {
    const d = database([{ eventType: "prepared:request", payload: "broken" }]);
    await expect(readSessionMaterials(d.db, procedure)).rejects.toThrow("persistidos");
  });
  it("distinguishes vaseline from its brand and diluent from pigment", () => {
    expect(sessionCupSize({ name: "Batoque P", configuration: "G", unit: "un" })).toBe("G");
    expect(sessionCupSize({ name: "Batoque P", configuration: "PP", unit: "un" })).toBeUndefined();
    expect(isSessionInk(material)).toBe(false);
    expect(() => validateSessionUnit(material)).not.toThrow();
    expect(() => validateSessionUnit({ ...material, unit: "gotas" })).toThrow("gramas");
    const diluent = { name: "Diluente", unit: "ml" };
    expect(isSessionDiluent(diluent)).toBe(true);
    expect(() => validateRecipeMaterial(diluent)).not.toThrow();
    expect(() => validateRecipeMaterial(material)).toThrow();
  });
  it("allows independent mixtures and checks capacity only when a cup is chosen", () => {
    const color = { name: "Composição", hex: "#333333", cupSize: null, dropsPerMl: 20, ingredients: [{ tenantMaterialId: 1, name: "Tinta", drops: 30 }, { tenantMaterialId: 2, name: "Diluente", drops: 1 }] };
    expect(preparationSchema.safeParse({ ...emptyPreparation(), colors: [color] }).success).toBe(true);
    expect(preparationSchema.safeParse({ ...emptyPreparation(), colors: [{ ...color, cupSize: "P" }] }).success).toBe(false);
    expect(Object.values(SESSION_CUP_ML).map(ml => ml * 20)).toEqual([10, 20, 40, 80]);
    expect(sessionCupSize({ name: "Batoque PP", unit: "un" })).toBeUndefined();
  });
});
