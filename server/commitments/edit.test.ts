import { beforeEach, describe, it, expect, vi } from "vitest";
const m = vi.hoisted(() => ({ query: vi.fn(), connection: vi.fn() }));
vi.mock("./db", () => ({
  database: () => ({ query: m.query, getConnection: m.connection }),
  ensureCommitmentsSchema: vi.fn(),
  seriesSelect: "s.id",
  occurrenceSelect: "o.id",
}));
vi.mock("../saas", () => ({ isUserAccessActive: () => true }));
vi.mock("../invitedArtistAccess", () => ({
  assertInvitedArtistAccess: () => {},
}));
import { commitmentsRouter } from "./router";
const context = {
  user: { id: 10, studioId: 7, role: "admin" },
  req: {},
  res: {},
} as any;
const original = {
  id: 8,
  seriesId: 2,
  studioId: 7,
  ownerId: 10,
  assigneeId: 11,
  revision: 0,
  title: "Conta",
  amount: 5000,
  notes: "Original",
  customColor: null,
};
const input = {
  id: 8,
  revision: 0,
  title: "Editada",
  amount: 6000,
  notes: "Nova",
  customColor: "#123456",
  attachments: [],
  removeAttachmentIds: [20],
  expectedAttachmentIds: [20],
  expected: {
    title: "Conta",
    amount: 5000,
    notes: "Original",
    customColor: null,
  },
};
const pdf = {
  name: "boleto.pdf",
  mime: "application/pdf" as const,
  data: Buffer.from("%PDF-1.4\n%%EOF").toString("base64"),
};
function connection(row = original, files = [{ id: 20 }]) {
  const c = {
    query: vi
      .fn()
      .mockResolvedValueOnce([[row]])
      .mockResolvedValueOnce([files])
      .mockResolvedValue([{}]),
    beginTransaction: vi.fn(),
    commit: vi.fn(),
    rollback: vi.fn(),
    release: vi.fn(),
  };
  m.connection.mockResolvedValue(c);
  return c;
}
beforeEach(() => vi.clearAllMocks());
describe("edição atômica de contas e anexos", () => {
  it("salva cor própria, notas e anexos sem modificar datas, recorrência ou pagamento", async () => {
    const c = connection();
    await commitmentsRouter
      .createCaller(context)
      .save({ ...input, attachments: [pdf] });
    expect(c.commit).toHaveBeenCalledOnce();
    expect(c.query.mock.calls[2][1]).toEqual([
      "Editada",
      6000,
      "Nova",
      "#123456",
      2,
      7,
      10,
    ]);
    expect(c.query.mock.calls[3][1]).toEqual([20, 2, 7]);
    expect(c.query.mock.calls[4][1]).toEqual([
      2,
      7,
      pdf.name,
      pdf.mime,
      pdf.data,
    ]);
    expect(c.query.mock.calls.map(c => c[0]).join("\n")).not.toMatch(
      /UPDATE commitment_occurrences|repeat_kind=|effective_date=/
    );
  });
  it("não permite ao responsável editar a série de outro criador", async () => {
    const c = connection({ ...original, ownerId: 12, assigneeId: 10 });
    await expect(
      commitmentsRouter.createCaller(context).save(input)
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(c.rollback).toHaveBeenCalledOnce();
    expect(c.commit).not.toHaveBeenCalled();
  });
  it("recusa sobrescrever uma edição concorrente", async () => {
    const c = connection({ ...original, title: "Outra edição" });
    await expect(
      commitmentsRouter.createCaller(context).save(input)
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(c.query).toHaveBeenCalledTimes(1);
  });
  it("recusa remover anexo de outra série", async () => {
    const c = connection();
    await expect(
      commitmentsRouter
        .createCaller(context)
        .save({ ...input, removeAttachmentIds: [99] })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(c.query).toHaveBeenCalledTimes(2);
  });
  it("limita o total de arquivos existentes e novos", async () => {
    const c = connection(
      original,
      [1, 2, 3, 4, 5].map(id => ({ id }))
    );
    await expect(
      commitmentsRouter
        .createCaller(context)
        .save({
          ...input,
          removeAttachmentIds: [],
          expectedAttachmentIds: [1, 2, 3, 4, 5],
          attachments: [pdf],
        })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(c.query).toHaveBeenCalledTimes(2);
  });
  it("desfaz toda a transação se um anexo não puder ser gravado", async () => {
    const c = connection();
    c.query
      .mockResolvedValueOnce([{}])
      .mockResolvedValueOnce([{}])
      .mockRejectedValueOnce(new Error("Database failure"));
    // The injected error cannot cause a partial commit.
    await expect(
      commitmentsRouter
        .createCaller(context)
        .save({ ...input, attachments: [pdf] })
    ).rejects.toThrow();
    expect(c.rollback).toHaveBeenCalledOnce();
    expect(c.commit).not.toHaveBeenCalled();
    expect(c.release).toHaveBeenCalledOnce();
  });
  it("valida o conteúdo e o tamanho antes de abrir a transação", async () => {
    await expect(
      commitmentsRouter
        .createCaller(context)
        .save({
          ...input,
          attachments: [
            { ...pdf, data: Buffer.from("not a PDF").toString("base64") },
          ],
        })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      commitmentsRouter
        .createCaller(context)
        .save({
          ...input,
          attachments: [
            {
              ...pdf,
              data: Buffer.concat([
                Buffer.from("%PDF-"),
                Buffer.alloc(2 * 1024 * 1024),
              ]).toString("base64"),
            },
          ],
        })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(m.connection).not.toHaveBeenCalled();
  });
  it("cria conta e anexos na mesma transação, mantendo a cor do calendário como alternativa", async () => {
    m.query
      .mockResolvedValueOnce([[{ id: 10 }]])
      .mockResolvedValueOnce([[{ id: 1, name: "Meu", color: "#FF9500" }]]);
    const c = {
      query: vi
        .fn()
        .mockResolvedValueOnce([{ insertId: 50 }])
        .mockResolvedValue([{}]),
      beginTransaction: vi.fn(),
      commit: vi.fn(),
      rollback: vi.fn(),
      release: vi.fn(),
    };
    m.connection.mockResolvedValue(c);
    const result = await commitmentsRouter
      .createCaller(context)
      .create({
        title: "Conta",
        category: "fixed",
        calendarId: 1,
        calendarName: "Meu",
        color: "#FF9500",
        customColor: "#123456",
        attachments: [pdf],
        amount: null,
        startDate: "2026-10-12",
        endDate: null,
        repeatKind: "monthly",
        repeatInterval: 1,
        shiftBusiness: true,
        notes: "",
        assigneeId: 10,
      });
    expect(result.id).toBe(50);
    expect(c.query.mock.calls[0][1][16]).toBe("#123456");
    expect(c.query.mock.calls[1][1][0]).toBe(50);
    expect(c.commit).toHaveBeenCalledOnce();
  });
});
