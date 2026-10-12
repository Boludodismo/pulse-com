import { beforeEach, describe, it, expect, vi } from "vitest";
const m = vi.hoisted(() => ({
  query: vi.fn(),
  ensure: vi.fn(),
  materialize: vi.fn(),
  connection: vi.fn(),
}));
vi.mock("./db", () => ({
  database: () => ({ query: m.query, getConnection: m.connection }),
  ensureCommitmentsSchema: m.ensure,
  seriesSelect: "s.id",
  occurrenceSelect: "o.id",
}));
vi.mock("./service", () => ({
  materialize: m.materialize,
  localClock: () => "2026-10-11 09:00:00",
}));
vi.mock("../saas", () => ({ isUserAccessActive: () => true }));
vi.mock("../invitedArtistAccess", () => ({
  assertInvitedArtistAccess: () => {},
}));
import { commitmentsRouter } from "./router";
const ctx = (id = 10, studioId = 7, role = "admin") =>
  ({ user: { id, studioId, role }, req: {}, res: {} }) as any;
beforeEach(() => vi.clearAllMocks());
describe("operações autenticadas de compromissos", () => {
  it("superadmin não consulta dados nem inicializa tabelas", async () => {
    await expect(
      commitmentsRouter
        .createCaller(ctx(10, 7, "superadmin"))
        .list({ from: "2026-10-01", to: "2026-10-31" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(m.query).not.toHaveBeenCalled();
    expect(m.ensure).not.toHaveBeenCalled();
  });
  it("listagem inclui estúdio e identidades da sessão", async () => {
    m.query.mockResolvedValue([[]]);
    await commitmentsRouter
      .createCaller(ctx())
      .list({ from: "2026-10-01", to: "2026-10-31" });
    expect(m.query.mock.calls[0][1]).toEqual([
      7,
      10,
      10,
      "2026-10-01",
      "2026-10-31",
    ]);
    expect(m.materialize).toHaveBeenCalledWith(
      7,
      10,
      "2026-10-01",
      "2026-10-31"
    );
  });
  it("não expõe detalhes ou anexos de outra conta", async () => {
    m.query.mockResolvedValue([
      [{ studioId: 7, ownerId: 12, assigneeId: 13, seriesId: 9 }],
    ]);
    await expect(
      commitmentsRouter.createCaller(ctx()).detail({ id: 8 })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(m.query).toHaveBeenCalledTimes(1);
  });
  it("colaborador não atribui compromisso a outra pessoa", async () => {
    await expect(
      commitmentsRouter
        .createCaller(ctx(10, 7, "collaborator"))
        .create({
          title: "Conta",
          category: "fixed",
          calendarName: "Meu",
          color: "#123456",
          amount: null,
          startDate: "2026-10-12",
          endDate: null,
          repeatKind: "monthly",
          repeatInterval: 1,
          shiftBusiness: true,
          notes: "",
          assigneeId: 11,
        })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(m.query).not.toHaveBeenCalled();
  });
  it("rejeita data impossível sem erro interno", async () => {
    await expect(
      commitmentsRouter
        .createCaller(ctx())
        .list({ from: "2026-99-99", to: "2026-10-31" })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
  it("marcar como pago modifica somente a ocorrência e registra auditoria", async () => {
    const q = vi
      .fn()
      .mockResolvedValueOnce([
        [
          {
            id: 8,
            seriesId: 2,
            studioId: 7,
            ownerId: 10,
            assigneeId: 11,
            status: "pending",
            revision: 0,
            effectiveDate: "2026-10-12",
          },
        ],
      ])
      .mockResolvedValue([{}]);
    const c = {
      query: q,
      beginTransaction: vi.fn(),
      commit: vi.fn(),
      rollback: vi.fn(),
      release: vi.fn(),
    };
    m.connection.mockResolvedValue(c);
    await commitmentsRouter
      .createCaller(ctx())
      .action({ id: 8, revision: 0, action: "paid" });
    expect(q.mock.calls[1][1]).toEqual(["paid", "2026-10-12", null, 8, 7]);
    expect(q.mock.calls[2][1].slice(0, 4)).toEqual([8, 7, 10, "paid"]);
    expect(c.commit).toHaveBeenCalled();
  });
  it("ação antiga não altera ocorrência já atualizada", async () => {
    const c = {
      query: vi
        .fn()
        .mockResolvedValue([
          [
            {
              id: 8,
              studioId: 7,
              ownerId: 10,
              assigneeId: 11,
              status: "pending",
              revision: 1,
            },
          ],
        ]),
      beginTransaction: vi.fn(),
      commit: vi.fn(),
      rollback: vi.fn(),
      release: vi.fn(),
    };
    m.connection.mockResolvedValue(c);
    await expect(
      commitmentsRouter
        .createCaller(ctx())
        .action({ id: 8, revision: 0, action: "paid" })
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(c.query).toHaveBeenCalledTimes(1);
    expect(c.rollback).toHaveBeenCalled();
  });
});
describe("preferências e adiamento", () => {
  const settings = {
    phone: "",
    consent: false,
    timezone: "America/Sao_Paulo",
    beforeTime: "09:00",
    firstTime: "09:00",
    secondTime: "16:00",
    holidays: [{ date: "2026-10-13", name: "Feriado municipal", annual: true }],
  };
  it("feriado local pode ser salvo sem cadastrar WhatsApp", async () => {
    m.query.mockResolvedValue([{}]);
    await commitmentsRouter.createCaller(ctx()).savePreferences(settings);
    expect(m.query.mock.calls[0][1].slice(0, 4)).toEqual([7, 10, "", 0]);
  });
  it("aceita WhatsApp E.164 com autorização explícita", async () => {
    m.query.mockResolvedValue([{}]);
    await commitmentsRouter
      .createCaller(ctx())
      .savePreferences({
        ...settings,
        phone: "(31) 99653-1316",
        consent: true,
      });
    expect(m.query.mock.calls[0][1].slice(0, 4)).toEqual([
      7,
      10,
      "+5531996531316",
      1,
    ]);
  });
  it("não ativa lembrete com telefone ausente", async () => {
    await expect(
      commitmentsRouter
        .createCaller(ctx())
        .savePreferences({ ...settings, consent: true })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(m.query).not.toHaveBeenCalled();
  });
  it("adiar preserva vencimento, troca revisão e pausa os slots antigos", async () => {
    const q = vi
      .fn()
      .mockResolvedValueOnce([
        [
          {
            id: 8,
            seriesId: 2,
            studioId: 7,
            ownerId: 10,
            assigneeId: 11,
            status: "pending",
            revision: 0,
            effectiveDate: "2026-10-12",
          },
        ],
      ])
      .mockResolvedValueOnce([[{ timezone: "America/Sao_Paulo" }]])
      .mockResolvedValue([{}]);
    const c = {
      query: q,
      beginTransaction: vi.fn(),
      commit: vi.fn(),
      rollback: vi.fn(),
      release: vi.fn(),
    };
    m.connection.mockResolvedValue(c);
    await commitmentsRouter
      .createCaller(ctx())
      .action({
        id: 8,
        revision: 0,
        action: "snooze",
        date: "2026-10-13",
        time: "10:00",
      });
    expect(q.mock.calls[2][1]).toEqual([
      "pending",
      "2026-10-12",
      "2026-10-13 10:00:00",
      8,
      7,
    ]);
  });
  it("reagendar modifica data desta ocorrência, sem mudar série", async () => {
    const q = vi
      .fn()
      .mockResolvedValueOnce([
        [
          {
            id: 8,
            seriesId: 2,
            studioId: 7,
            ownerId: 10,
            assigneeId: 11,
            status: "pending",
            revision: 0,
            effectiveDate: "2026-10-12",
          },
        ],
      ])
      .mockResolvedValueOnce([[{ timezone: "America/Sao_Paulo" }]])
      .mockResolvedValue([{}]);
    const c = {
      query: q,
      beginTransaction: vi.fn(),
      commit: vi.fn(),
      rollback: vi.fn(),
      release: vi.fn(),
    };
    m.connection.mockResolvedValue(c);
    await commitmentsRouter
      .createCaller(ctx())
      .action({
        id: 8,
        revision: 0,
        action: "reschedule",
        date: "2026-10-19",
        time: "10:00",
      });
    expect(q.mock.calls[2][1]).toEqual([
      "pending",
      "2026-10-19",
      "2026-10-19 10:00:00",
      8,
      7,
    ]);
  });
});
