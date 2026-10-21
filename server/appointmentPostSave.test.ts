vi.mock("./messaging/appointmentRescheduleNotice", () => ({ queueAppointmentRescheduleNotice: vi.fn().mockResolvedValue(null) }));
import { queueAppointmentRescheduleNotice } from "./messaging/appointmentRescheduleNotice";
vi.mock("./messaging/artistNotifications", () => ({ queueArtistAppointmentNotice: vi.fn().mockResolvedValue(true) }));
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
  it('cria outra sessão vinculada ao atendimento original sem atualizar nem mover a anterior',async()=>{
    const original={...saved,status:'concluido'};const nextDate='2026-09-17 14:00:00';mock.getAppointmentById.mockResolvedValue(original);
    mock.createAppointment.mockImplementation(async data=>({...data,id:88}));
    const result=await appRouter.createCaller(ctx).appointments.create({clientId:1,artistId:2,artist:saved.artist,date:nextDate,duration:90,service:saved.service,continuationOfAppointmentId:77,status:'concluido'});
    expect(result.id).toBe(88);expect(mock.createAppointment).toHaveBeenCalledWith(expect.objectContaining({continuationOfAppointmentId:77,date:nextDate,status:'agendado'}));
    expect(mock.updateAppointment).not.toHaveBeenCalled();expect(original).toMatchObject({id:77,date:saved.date,status:'concluido'});
  });
  it('não aceita origem de outra empresa, cliente ou artista nem uma data anterior à origem',async()=>{
    const input={clientId:1,artistId:2,artist:saved.artist,date:'2026-09-17 14:00:00',duration:60,service:saved.service,continuationOfAppointmentId:77};
    for(const patch of [{studioId:9},{clientId:9},{artistId:9}]){mock.getAppointmentById.mockResolvedValue({...saved,...patch});await expect(appRouter.createCaller(ctx).appointments.create(input)).rejects.toMatchObject({code:'FORBIDDEN'});}
    mock.getAppointmentById.mockResolvedValue(saved);await expect(appRouter.createCaller(ctx).appointments.create({...input,date:'2026-09-09 14:00:00'})).rejects.toMatchObject({code:'BAD_REQUEST'});
    expect(mock.createAppointment).not.toHaveBeenCalled();expect(mock.updateAppointment).not.toHaveBeenCalled();
  });
  it("salva região e lado opcionais sem inferir ou alterar outros dados", async () => {
    await appRouter.createCaller(ctx).appointments.create({ clientId: 1, artistId: 2, artist: saved.artist, date: saved.date, duration: 60, service: "Teste", bodyRegion: " Antebraço ", bodySide: "esquerdo" });
    expect(mock.createAppointment).toHaveBeenCalledWith(expect.objectContaining({ bodyRegion: "Antebraço", bodySide: "esquerdo", date: saved.date, duration: 60 }));
  });
  it("permite apagar a região e o lado ao editar", async () => {
    await appRouter.createCaller(ctx).appointments.update({ id: 77, data: { bodyRegion: null, bodySide: null } });
    expect(mock.updateAppointment).toHaveBeenCalledWith(77, { bodyRegion: null, bodySide: null });
  });
  it("preserva campos anatômicos quando uma edição antiga não os envia", async () => {
    await appRouter.createCaller(ctx).appointments.update({ id: 77, data: { notes: "Teste" } });
    expect(mock.updateAppointment.mock.calls[0][1]).not.toHaveProperty("bodyRegion");
    expect(mock.updateAppointment.mock.calls[0][1]).not.toHaveProperty("bodySide");
  });
  it("recusa lados inválidos e regiões maiores que 100 caracteres", async () => {
    await expect(appRouter.createCaller(ctx).appointments.update({ id: 77, data: { bodySide: "inferido" as any } })).rejects.toThrow();
    await expect(appRouter.createCaller(ctx).appointments.update({ id: 77, data: { bodyRegion: "a".repeat(101) } })).rejects.toThrow();
    expect(mock.updateAppointment).not.toHaveBeenCalled();
  });
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
  it("avisa o cliente depois de salvar uma mudança de dia e hora no formulário",async()=>{
    const after={...saved,date:"2026-09-11 15:45:00"};
    mock.getAppointmentById.mockResolvedValueOnce(saved).mockResolvedValueOnce(after);
    const result=await appRouter.createCaller(ctx).appointments.update({id:77,data:{date:after.date}});
    expect(result).toEqual({success:true,warnings:[]});
    expect(queueAppointmentRescheduleNotice).toHaveBeenCalledWith(expect.objectContaining({studioId:1,appointmentId:77,clientId:1,previousDate:saved.date,date:after.date}));
    expect(mock.updateAppointment.mock.invocationCallOrder[0]).toBeLessThan(vi.mocked(queueAppointmentRescheduleNotice).mock.invocationCallOrder[0]);
  });
  it("mostra problema no WhatsApp sem desfazer o horário salvo",async()=>{
    const after={...saved,date:"2026-09-11 15:45:00"};
    mock.getAppointmentById.mockResolvedValueOnce(saved).mockResolvedValueOnce(after);
    vi.mocked(queueAppointmentRescheduleNotice).mockResolvedValueOnce("Horário salvo. WhatsApp indisponível.");
    expect(await appRouter.createCaller(ctx).appointments.update({id:77,data:{date:after.date}})).toEqual({success:true,warnings:["Horário salvo. WhatsApp indisponível."]});
  });
  it("não avisa em edições sem mudança de horário ou que não foram salvas",async()=>{
    await appRouter.createCaller(ctx).appointments.update({id:77,data:{notes:"Anotação"}});
    await appRouter.createCaller(ctx).appointments.update({id:77,data:{date:saved.date}});
    mock.checkAppointmentConflicts.mockResolvedValueOnce({hasConflict:true,conflicts:[]});
    await expect(appRouter.createCaller(ctx).appointments.update({id:77,data:{date:"2026-09-11 15:45:00"}})).rejects.toMatchObject({code:"CONFLICT"});
    mock.updateAppointment.mockRejectedValueOnce(new Error("database offline"));
    await expect(appRouter.createCaller(ctx).appointments.update({id:77,data:{date:"2026-09-11 15:45:00"}})).rejects.toThrow("database offline");
    expect(queueAppointmentRescheduleNotice).not.toHaveBeenCalled();
  });
  it("falha real na gravação continua sendo um erro, sem indicar sucesso", async () => {
    mock.updateAppointment.mockRejectedValueOnce(new Error("database offline"));
    await expect(appRouter.createCaller(ctx).appointments.update({ id: 77, data: { notes: "Teste" } })).rejects.toThrow("database offline");
  });
});
