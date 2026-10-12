import { beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({
  get: vi.fn(),
  client: vi.fn(),
  conflict: vi.fn(),
  audit: vi.fn(),
  query: vi.fn(),
  sql: vi.fn(),
  commit: vi.fn(),
  rollback: vi.fn(),
  send: vi.fn(),
  integration: vi.fn(),
  permission: vi.fn(),
  sheets: vi.fn(),
}));
vi.mock("./db", () => ({
  getAppointmentById: m.get,
  getClientById: m.client,
  checkAppointmentConflicts: m.conflict,
  createAuditLog: m.audit,
}));
vi.mock("./commitments/db", () => ({
  ensureCommitmentsSchema: async () => {},
  database: () => ({
    query: m.sql,
    getConnection: async () => ({
      query: m.query,
      beginTransaction: async () => {},
      commit: m.commit,
      rollback: m.rollback,
      release: () => {},
    }),
  }),
}));
vi.mock("./saas", () => ({
  hasModulePermission: m.permission,
  isUserAccessActive: () => true,
}));
vi.mock("./invitedArtistAccess", () => ({
  assertInvitedArtistAccess: () => {},
}));
vi.mock("./googleSheetsSync", () => ({ syncAppointmentToSheets: m.sheets }));
vi.mock("./messaging/service", () => ({
  getActiveIntegration: m.integration,
  sendAndLog: m.send,
}));
import { moveAppointment } from "./agendaMoves";
const ctx = { user: { id: 10, studioId: 7, role: "admin", name: "Maria" } };
const input = {
  id: 8,
  expectedDate: "2026-10-12 10:00:00",
  date: "2026-10-13 14:35:00",
  notify: false,
  requestId: "d087aacf-1ca0-42fb-940e-6e22965c7a43",
};
beforeEach(() => {
  vi.clearAllMocks();
  m.get.mockResolvedValue({
    id: 8,
    studioId: 7,
    date: input.expectedDate,
    duration: 90,
    artistId: 4,
    artist: "Artista",
    clientId: 5,
    service: "Tattoo",
    status: "agendado",
  });
  m.client.mockResolvedValue({
    id: 5,
    name: "Ana Flávia Santos",
    phone: "5531999999999",
  });
  m.conflict.mockResolvedValue({ hasConflict: false });
  m.permission.mockResolvedValue(true);
  m.query.mockImplementation(async (sql: string) =>
    sql.startsWith("SELECT date")
      ? [[{ date: input.expectedDate }]]
      : sql.startsWith("SELECT id,message")
        ? [[]]
        : [{ affectedRows: 1 }]
  );
  m.sql.mockResolvedValue([[{ has_whatsapp_opt_in: 1, opted_out_at: null }]]);
  m.integration.mockResolvedValue({ id: 3 });
  m.send.mockResolvedValue({ success: true });
});
describe("reagendamento visual seguro", () => {
  it("preserva duração e não envia sem autorização", async () => {
    await moveAppointment(ctx, input);
    expect(m.conflict).toHaveBeenCalledWith("Artista", input.date, 90, 8, 7);
    expect(
      m.query.mock.calls.find(c => c[0].startsWith("UPDATE appointments"))?.[1]
    ).toEqual([input.date, 90, 8, 7]);
    expect(m.commit).toHaveBeenCalledOnce();
    expect(m.send).not.toHaveBeenCalled();
    expect(m.sheets).toHaveBeenCalledOnce();
  });
  it("bloqueia outro estúdio e artista de outro colaborador", async () => {
    await expect(
      moveAppointment({ user: { ...ctx.user, studioId: 9 } }, input)
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      moveAppointment(
        { user: { ...ctx.user, role: "collaborator", artistId: 6 } },
        input
      )
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(m.query).not.toHaveBeenCalled();
  });
  it("bloqueia superadministrador e horário ocupado", async () => {
    await expect(
      moveAppointment({ user: { ...ctx.user, role: "superadmin" } }, input)
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    m.conflict.mockResolvedValue({ hasConflict: true });
    await expect(moveAppointment(ctx, input)).rejects.toMatchObject({
      code: "CONFLICT",
    });
    expect(m.commit).not.toHaveBeenCalled();
  });
  it("revalida concorrência dentro da transação", async () => {
    m.query.mockResolvedValue([[{ date: "2026-10-14 10:00:00" }]]);
    await expect(moveAppointment(ctx, input)).rejects.toMatchObject({
      code: "CONFLICT",
    });
    expect(m.rollback).toHaveBeenCalledOnce();
    expect(m.commit).not.toHaveBeenCalled();
  });
  it("envia primeiro nome com autorização e consentimento, usando chave idempotente", async () => {
    await moveAppointment(ctx, { ...input, notify: true });
    const p = m.send.mock.calls[0][0];
    expect(p.message).toContain("Olá, Ana!");
    expect(p.message).toContain("14:35");
    expect(p.message).not.toContain("Flávia");
    expect(p.idempotencyKey).toBe(`visual-move:7:${input.requestId}`);
  });
  it("salva horário mas não envia quando cliente não consentiu", async () => {
    m.sql.mockResolvedValue([[{ has_whatsapp_opt_in: 0 }]]);
    const r = await moveAppointment(ctx, { ...input, notify: true });
    expect(r.warnings).toHaveLength(1);
    expect(m.send).not.toHaveBeenCalled();
    expect(m.commit).toHaveBeenCalledOnce();
  });
  it("repetir confirmação já aplicada não reenfileira aviso", async () => {
    m.get.mockResolvedValue({ ...(await m.get()), date: input.date });
    await expect(
      moveAppointment(ctx, { ...input, notify: true })
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(m.send).not.toHaveBeenCalled();
  });
});
