import { beforeEach, describe, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({
  getDb: vi.fn(), getClientById: vi.fn(), getArtistById: vi.fn(), getStudioSettings: vi.fn(),
  checkAppointmentConflicts: vi.fn(), createAppointment: vi.fn(), getAppointmentById: vi.fn(),
  updateAppointment: vi.fn(), createAuditLog: vi.fn(), createAppointmentReminder: vi.fn(),
}));
vi.mock("./db", () => mock);
vi.mock("./saas", async importOriginal => ({ ...await importOriginal<typeof import("./saas")>(), isUserAccessActive: vi.fn(async () => true) }));
vi.mock("./googleSheetsSync", () => ({ syncAppointmentToSheets: vi.fn() }));
import { appRouter } from "./routers";
const ctx = { user: { id: 1, studioId: 1, role: "admin" }, req: { headers: {}, socket: {} }, res: {} } as any;
const saved = { id: 77, clientId: 1, studioId: 1, artistId: 2, artist: "Artista fictício", date: "2026-09-10 08:30:00", duration: 60, service: "Teste", status: "agendado", depositPaid: 0 };
beforeEach(() => {
  vi.clearAllMocks();
  mock.getClientById.mockResolvedValue({ id: 1, studioId: 1, name: "Cliente fictício", phone: "5500000000000" });
  mock.getArtistById.mockResolvedValue({ id: 2, studioId: 1 });
  mock.getStudioSettings.mockResolvedValue(null);
  mock.checkAppointmentConflicts.mockResolvedValue({ hasConflict: false, conflicts: [] });
  mock.createAppointment.mockResolvedValue(saved);
  mock.getAppointmentById.mockResolvedValue(saved);
  mock.updateAppointment.mockResolvedValue({ success: true });
  mock.getDb.mockResolvedValue({ select: () => { throw new Error("Unknown column studio_id in whatsapp_integrations"); } });
});
describe("Falha do WhatsApp após salvar agendamento", () => {
  it("criação retorna o agendamento salvo e aviso, sem falso erro nem lembrete após falha do consentimento", async () => {
    const result = await appRouter.createCaller(ctx).appointments.create({ clientId: 1, artistId: 2, artist: saved.artist, date: saved.date, duration: 60, service: "Teste", recordWhatsAppConsent: true, autoReminder: { timing: "day_before", sendTime: "09:00" } });
    expect(result.id).toBe(77);
    expect(result.warnings[0]).toContain("Agendamento salvo");
    expect(result.automaticReminder.scheduled).toBe(false);
    expect(mock.createAppointment).toHaveBeenCalledTimes(1);
    expect(mock.createAppointmentReminder).not.toHaveBeenCalled();
    expect(mock.createAuditLog).toHaveBeenCalledTimes(1);
  });
  it("edição permanece bem-sucedida se um cliente antigo ainda enviar consentimento", async () => {
    const result = await appRouter.createCaller(ctx).appointments.update({ id: 77, data: { notes: "Teste de edição", recordWhatsAppConsent: true } });
    expect(result.success).toBe(true);
    expect(result.warnings[0]).toContain("Agendamento atualizado");
    expect(mock.updateAppointment).toHaveBeenCalledTimes(1);
    expect(mock.createAuditLog).toHaveBeenCalledTimes(1);
  });
  it("edição comum não consulta nem altera consentimento do WhatsApp", async () => {
    const result = await appRouter.createCaller(ctx).appointments.update({ id: 77, data: { notes: "Teste de edição", recordWhatsAppConsent: false } });
    expect(result).toEqual({ success: true, warnings: [] });
    expect(mock.getDb).not.toHaveBeenCalled();
  });
  it("falha ao programar lembrete não desfaz o resultado do salvamento", async () => {
    mock.createAppointmentReminder.mockRejectedValueOnce(new Error("reminder database unavailable"));
    const result = await appRouter.createCaller(ctx).appointments.create({ clientId: 1, artistId: 2, artist: saved.artist, date: saved.date, duration: 60, service: "Teste", recordWhatsAppConsent: false, autoReminder: { timing: "day_before", sendTime: "09:00" } });
    expect(result.id).toBe(77);
    expect(result.warnings).toHaveLength(1);
    expect(result.automaticReminder.scheduled).toBe(false);
  });
  it("falha real na gravação continua sendo um erro, sem indicar sucesso", async () => {
    mock.updateAppointment.mockRejectedValueOnce(new Error("database offline"));
    await expect(appRouter.createCaller(ctx).appointments.update({ id: 77, data: { notes: "Teste" } })).rejects.toThrow("database offline");
  });
});
