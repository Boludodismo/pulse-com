import { beforeEach, describe, it, expect, vi } from "vitest";
const m = vi.hoisted(() => ({
  query: vi.fn(),
  schema: vi.fn(),
  sync: vi.fn(),
}));
vi.mock("../commitments/db", () => ({ database: () => ({ query: m.query }) }));
vi.mock("./db", () => ({ ensureCalendarSyncSchema: m.schema }));
vi.mock("./service", () => ({ syncConnection: m.sync }));
vi.mock("../saas", () => ({ isUserAccessActive: () => true }));
vi.mock("../invitedArtistAccess", () => ({
  assertInvitedArtistAccess: () => {},
}));
import { calendarSyncRouter } from "./router";
const ctx = (role = "admin") =>
  ({ user: { id: 10, studioId: 7, role }, req: {}, res: {} }) as any;
beforeEach(() => {
  vi.clearAllMocks();
  m.query.mockResolvedValue([[]]);
});
describe("isolamento de conexões externas", () => {
  it("não permite conexão de superadministrador", async () => {
    await expect(
      calendarSyncRouter.createCaller(ctx("superadmin")).status()
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(m.query).not.toHaveBeenCalled();
  });
  it("status consulta apenas a sessão e não seleciona credenciais", async () => {
    await calendarSyncRouter.createCaller(ctx()).status();
    for (const call of m.query.mock.calls) {
      expect(call[1]).toEqual([7, 10]);
      expect(call[0]).not.toContain("credentials");
    }
  });
  it("não sincroniza conexão de outro usuário", async () => {
    await expect(
      calendarSyncRouter.createCaller(ctx()).sync({ id: 99 })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(m.query.mock.calls[0][1]).toEqual([99, 7, 10]);
    expect(m.sync).not.toHaveBeenCalled();
  });
  it("não usa senha enviada para conectar calendário que pertence a outra conta", async () => {
    await expect(
      calendarSyncRouter
        .createCaller(ctx())
        .appleConnect({
          calendarId: 88,
          username: "example@example.com",
          password: "abcdefghijklmnop",
        })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(m.query).toHaveBeenCalledOnce();
    expect(m.query.mock.calls[0][1]).toEqual([88, 10]);
  });
  it("não aceita calendário remoto fora das opções descobertas", async () => {
    m.query.mockResolvedValue([[{ choices_json: '[{"id":"permitido"}]' }]]);
    await expect(
      calendarSyncRouter
        .createCaller(ctx())
        .select({ id: 5, remoteId: "outro" })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(m.query).toHaveBeenCalledOnce();
  });
});
