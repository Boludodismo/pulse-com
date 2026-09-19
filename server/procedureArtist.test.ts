import { describe, expect, it, vi } from "vitest";
import { MySqlDialect } from "drizzle-orm/mysql-core";
import { resolveProcedureArtist } from "./procedureArtist";
import type { InventoryDatabase } from "./inventoryAccess";

describe("session artist from appointment", () => {
  const procedure = { studioId: 4, clientId: 8, appointmentId: 12, artistId: null, artistName: "Nome antigo" };
  it("preserves explicit artists and does not infer a link from a name", async () => {
    const db = { select: vi.fn() };
    expect((await resolveProcedureArtist(db as unknown as InventoryDatabase, { ...procedure, artistId: 20 })).artistId).toBe(20);
    expect((await resolveProcedureArtist(db as unknown as InventoryDatabase, { ...procedure, appointmentId: null })).artistId).toBeNull();
    expect(db.select).not.toHaveBeenCalled();
  });
  it("resolves the linked artist with studio, client and appointment scoping", async () => {
    let query: any;
    const chain: any = { from: () => chain, innerJoin: () => chain, where: (value: any) => { query = value; return chain; }, limit: async () => [{ artistId: 20, artistName: "Artista vinculado" }] };
    const db = { select: () => chain } as unknown as InventoryDatabase;
    expect((await resolveProcedureArtist(db, procedure)).artistId).toBe(20);
    const sql = new MySqlDialect().sqlToQuery(query);
    expect(sql.params).toEqual([12,4,8]);
    expect(sql.sql).toContain('`appointments`.`studioId`');
    expect(sql.sql).toContain('`appointments`.`clientId`');
  });
});
