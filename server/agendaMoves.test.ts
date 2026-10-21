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
import { moveAppointment, agendaMovesRouter } from "./agendaMoves";
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
    studioId: 7,
    name: "Ana Flávia Santos",
    phone: "5531999999999",
  });
  m.conflict.mockResolvedValue({ hasConflict: false });
  m.permission.mockResolvedValue(true);
  m.query.mockImplementation(async (sql: string) =>
    sql.startsWith("SELECT date")
      ? [[{ date: input.expectedDate }]]
      : sql.startsWith('SELECT appointment_id')||sql.startsWith("SELECT id,message")
        ? [[]]
        : [{ affectedRows: 1 }]
  );
  m.sql.mockResolvedValue([[{ has_whatsapp_opt_in: 1, opted_out_at: null }]]);
  m.integration.mockResolvedValue({ id: 3 });
  m.send.mockResolvedValue({ success: true });
});
describe("reagendamento visual seguro", () => {
  it('preserva o dia e horário do atendimento quando já existe presença, atraso ou falta registrada',async()=>{
    const original=m.query.getMockImplementation()!;
    m.query.mockImplementation((sql:string,...args:any[])=>sql.startsWith('SELECT appointment_id')?Promise.resolve([[{appointment_id:8}]]):original(sql,...args));
    await expect(moveAppointment(ctx,input)).rejects.toMatchObject({code:'BAD_REQUEST',message:expect.stringContaining('histórico')});
    expect(m.query.mock.calls.some(([sql])=>sql.startsWith('UPDATE appointments'))).toBe(false);expect(m.commit).not.toHaveBeenCalled();expect(m.rollback).toHaveBeenCalledOnce();
  });
  it('reconfere a conclusão dentro do bloqueio para não mover um atendimento encerrado em outra tela',async()=>{
    const original=m.query.getMockImplementation()!;
    m.query.mockImplementation((sql:string,...args:any[])=>sql.startsWith('SELECT date')?Promise.resolve([[{date:input.expectedDate,status:'concluido'}]]):original(sql,...args));
    await expect(moveAppointment(ctx,input)).rejects.toMatchObject({code:'BAD_REQUEST'});expect(m.query.mock.calls.some(([sql])=>sql.startsWith('UPDATE appointments'))).toBe(false);
  });
  it("preserva duração e permite sincronização interna sem aviso", async () => {
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
  it("permite superadministrador somente dentro da empresa ativa", async () => {
    await moveAppointment({ user: { ...ctx.user, role: "superadmin" } }, input);
    expect(m.commit).toHaveBeenCalledOnce();
    await expect(moveAppointment({ user: { ...ctx.user, role: "superadmin", studioId: 9 } }, input)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(moveAppointment({ user: { ...ctx.user, role: "superadmin", studioId: null } }, input)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
  it("recusa horário ocupado sem salvar nem avisar", async () => {
    m.conflict.mockResolvedValue({ hasConflict: true });
    await expect(moveAppointment(ctx, {...input, notify: true})).rejects.toMatchObject({ code: "CONFLICT" });
    expect(m.commit).not.toHaveBeenCalled();
    expect(m.send).not.toHaveBeenCalled();
  });
  it("a API avisa automaticamente e não aceita desabilitar o aviso", async () => {
    const {notify, ...data} = input;
    await agendaMovesRouter.createCaller(ctx as any).move(data);
    expect(m.send).toHaveBeenCalledOnce();
    await expect(agendaMovesRouter.createCaller(ctx as any).move({...input, notify: false} as any)).rejects.toMatchObject({code: "BAD_REQUEST"});
    expect(m.send).toHaveBeenCalledOnce();
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
    expect(p.message).toContain("De: 12/10/2026 às 10:00");
    expect(p.message).toContain("Para: 13/10/2026 às 14:35");
    expect(p).toMatchObject({recipientPhone:"5531999999999",clientId:5,appointmentId:8,studioId:7});
    expect(m.commit.mock.invocationCallOrder[0]).toBeLessThan(m.send.mock.invocationCallOrder[0]);
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
  it.each(["sem conexão", "fila indisponível", "erro na fila"])("não desfaz a alteração se houver %s", async failure => {
    if(failure === "sem conexão") m.integration.mockResolvedValue(null);
    else if(failure === "fila indisponível") m.send.mockResolvedValue({success:false});
    else m.send.mockRejectedValueOnce(new Error("provider offline"));
    const result=await moveAppointment(ctx,{...input,notify:true});
    expect(result.success).toBe(true);expect(result.warnings[0]).toContain("aviso não foi enfileirado");
    expect(m.commit).toHaveBeenCalledOnce();expect(m.rollback).not.toHaveBeenCalled();
  });
  it("não envia para cliente de outra empresa nem sem telefone",async()=>{
    m.client.mockResolvedValue({id:5,studioId:9,phone:"5531999999999"});
    expect((await moveAppointment(ctx,{...input,notify:true})).warnings).toHaveLength(1);
    m.client.mockResolvedValue({id:5,studioId:7,phone:null});
    expect((await moveAppointment(ctx,{...input,notify:true})).warnings[0]).toContain("não possui WhatsApp");
    expect(m.send).not.toHaveBeenCalled();
  });
  it("não reenvia ao salvar o mesmo horário",async()=>{
    const result=await moveAppointment(ctx,{...input,date:input.expectedDate,notify:true});
    expect(result.warnings).toEqual([]);expect(m.commit).not.toHaveBeenCalled();expect(m.send).not.toHaveBeenCalled();
  });
  it("repetir confirmação já aplicada não reenfileira aviso", async () => {
    m.get.mockResolvedValue({ ...(await m.get()), date: input.date });
    await expect(
      moveAppointment(ctx, { ...input, notify: true })
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(m.send).not.toHaveBeenCalled();
  });
});
