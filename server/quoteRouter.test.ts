import { beforeEach, describe, expect, it, vi } from "vitest";
import { getTableName } from "drizzle-orm";
import { MySqlDialect } from "drizzle-orm/mysql-core";
import { buildEmptyQuoteEditorData, quoteMediaSchema } from "../shared/quoteProposal";

const mocks = vi.hoisted(() => ({ getDb: vi.fn(), artist: vi.fn(), client: vi.fn(), settings: vi.fn() }));
vi.mock("./db", () => ({ getDb: mocks.getDb, getArtistById: mocks.artist, getClientById: mocks.client, getStudioSettings: mocks.settings }));
vi.mock("./saas", () => ({ isUserAccessActive: async () => true }));
vi.mock("./invitedArtistAccess", () => ({ assertInvitedArtistAccess: async () => {} }));
import { quotesRouter } from "./routers/quotes";

describe("real quote router round-trip", () => {
  let row: any; let card: { token: string } | null; let cardQueries: { sql: string; params: unknown[] }[]; let writes: { table: string; values: any }[]; let filters: unknown[][];
  const ctx: any = { user: { id: 10, studioId: 1, role: "admin" }, req: {}, res: {} };
  beforeEach(() => {
    row = null; card = null; cardQueries = []; writes = []; filters = [];
    mocks.artist.mockImplementation(async (id: number, studioId: number) => id === 2 && studioId === 1 ? { id: 2, studioId: 1, active: 1, name: "Artista", phone: "5538999999999" } : null);
    mocks.client.mockResolvedValue({ id: 3, studioId: 1, name: "Cliente" });
    mocks.settings.mockResolvedValue({ studioName: "Estúdio", phone: "5538999990000" });
    const dialect = new MySqlDialect();
    mocks.getDb.mockResolvedValue({
      select: () => {
        let table = "";
        const query: any = { from(t: any) { table = getTableName(t); return query; }, where(c: any) { const sql = dialect.sqlToQuery(c); filters.push(sql.params); if (table === "artist_cards") cardQueries.push(sql); return query; }, orderBy() { return query; }, limit: async () => table === "quote_proposals" && row ? [row] : table === "artist_cards" && card ? [card] : [] };
        return query;
      },
      insert: (t: any) => ({ values: async (values: any) => {
        const table = getTableName(t); writes.push({ table, values });
        if (table === "quote_proposals") row = { ...values, id: 5, publicToken: null, acceptedAt: null, viewedAt: null };
        return [{ insertId: 5 }];
      } }),
      update: (t: any) => ({ set: (values: any) => ({ where: async (c: any) => { filters.push(dialect.sqlToQuery(c).params); writes.push({ table: getTableName(t), values }); row = { ...row, ...values }; return [{ affectedRows: 1 }]; } }) }),
    });
  });
  it("saves and reloads projects, attachments and payment text, finalizes, exposes and accepts the same version", async () => {
    const caller = quotesRouter.createCaller(ctx); const editor = buildEmptyQuoteEditorData();
    editor.media.clientReference = quoteMediaSchema.parse({ key: "quotes/1/2/media/a.png", url: "https://example.test/a.png", description: "Referência\nComposição inicial" });
    editor.media.suggestedArtwork = quoteMediaSchema.parse({ key: "quotes/1/2/media/c.png", url: "https://example.test/c.png", description: "Arte autoral" });
    editor.media.gallery = [quoteMediaSchema.parse({ key: "quotes/1/2/media/b.png", url: "https://example.test/b.png", alt: "Tatuagem atual", description: "Cobertura ".repeat(700).trim(), kind: "current" })];
    editor.additionalProjects = [{ id: "two", project: { ...editor.project, title: "Outro projeto", concept: "Descrição longa ".repeat(300).trim() }, images: [quoteMediaSchema.parse({ key: "quotes/1/2/media/d.png", url: "https://example.test/d.png", description: "Detalhe do segundo projeto" })] }];
    editor.pricing.depositText = "Sinal abatido do total.";
    editor.pricing.installmentInfo = "Taxa da máquina informada antes do pagamento.";
    editor.pricing.totalAmount = 250000; editor.pricing.depositAmount = 30000; editor.contactSource = "artist";
    const created = await caller.create({ clientId: 3, artistId: 2, validUntil: "2099-10-10", editor });
    const loaded = await caller.get({ id: created.id }); expect(loaded.parsedPayload?.editor).toEqual(editor);
    editor.project.concept = "Novo texto";
    editor.media.gallery[0].description += "\nTexto revisado pelo artista.";
    await caller.update({ id: created.id, validUntil: "2099-10-10", editor });
    const finalized = await caller.finalize({ id: created.id });
    expect(finalized.publicToken).toMatch(/^[a-f0-9]{48}$/);
    const customer = await caller.public.get({ token: finalized.publicToken });
    expect(customer.payload.editor).toEqual(editor); expect(customer.totalAmount).toBe(250000);
    await expect(caller.update({ id: created.id, validUntil: "2099-10-10", editor })).rejects.toThrow("finalizado");
    const accepted = await caller.public.accept({ token: finalized.publicToken });
    const repeated = await caller.public.accept({ token: finalized.publicToken });
    expect(repeated.acceptedAt).toEqual(accepted.acceptedAt); expect(row.status).toBe("approved");
    expect(writes.every(w => w.table === "quote_proposals")).toBe(true);
    expect(filters.some(params => params.includes(1) && params.includes(5))).toBe(true);
  });
  it("uses the same published artist card in editor and public quote, scoped to artist and studio", async () => {
    const caller = quotesRouter.createCaller(ctx);
    expect((await caller.branding.get({ artistId: 2 })).artistCardPath).toBeNull();
    card = { token: "public-artist-token" };
    const branding = await caller.branding.get({ artistId: 2 });
    const editor = buildEmptyQuoteEditorData();
    editor.media.clientReference = quoteMediaSchema.parse({ key: "cover", url: "https://example.test/cover.png" });
    const draft = await caller.create({ clientId: 3, artistId: 2, validUntil: "2099-10-10", editor });
    const final = await caller.finalize({ id: draft.id });
    const proposal = await caller.public.get({ token: final.publicToken });
    expect(branding.artistCardPath).toBe("/artista/public-artist-token");
    expect(proposal.artistCardPath).toBe(branding.artistCardPath);
    expect(cardQueries).toHaveLength(3);
    for (const query of cardQueries) {
      expect(query.sql).toBe("(`artist_cards`.`studio_id` = ? and `artist_cards`.`artist_id` = ? and `artist_cards`.`published` = ?)");
      expect(query.params).toEqual([1, 2, 1]);
    }
    card = null;
    expect((await caller.public.get({ token: final.publicToken })).artistCardPath).toBeNull();
    await expect(caller.branding.get({ artistId: 99 })).rejects.toThrow("Artista ativo");
    expect(writes.every(w => w.table === "quote_proposals")).toBe(true);
  });
  it("keeps drafts private and refuses other artists and studios", async () => {
    const caller = quotesRouter.createCaller(ctx); const editor = buildEmptyQuoteEditorData();
    await expect(caller.create({ clientId: 3, artistId: 99, validUntil: "2099-10-10", editor })).rejects.toThrow("Artista ativo");
    const collaborator = quotesRouter.createCaller({ ...ctx, user: { ...ctx.user, role: "collaborator", artistId: 9 } });
    await expect(collaborator.create({ clientId: 3, artistId: 2, validUntil: "2099-10-10", editor })).rejects.toThrow("próprio perfil");
    await caller.create({ clientId: 3, artistId: 2, validUntil: "2099-10-10", editor });
    await expect(caller.public.get({ token: "a".repeat(48) })).rejects.toThrow("indisponível");
    mocks.client.mockResolvedValue({ id: 3, studioId: 9, name: "Outro estúdio" });
    await expect(caller.create({ clientId: 3, artistId: 2, validUntil: "2099-10-10", editor })).rejects.toThrow("Cliente não encontrado");
  });
  it("persists quote and image preset categories up to 8000 characters without changing quote values", async () => {
    const caller = quotesRouter.createCaller(ctx);
    for (const category of ["concept", "deposit", "installment", "image"] as const) {
      await caller.presets.create({ artistId: 2, category, name: "Meu modelo", content: "x".repeat(8000) });
    }
    expect(writes).toHaveLength(4);
    expect(writes.every(w => w.table === "quote_presets" && w.values.studioId === 1 && w.values.artistId === 2)).toBe(true);
    expect(row).toBeNull();
  });
});
