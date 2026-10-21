import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getDb: vi.fn(), getClientById: vi.fn(), listClients: vi.fn(), createClient: vi.fn(),
  createAuditLog: vi.fn(), consent: vi.fn(), sync: vi.fn(),
}));
vi.mock("./db", () => mocks);
vi.mock("./saas", async original => ({ ...await original<typeof import("./saas")>(), isUserAccessActive: async () => true }));
vi.mock("./invitedArtistAccess", () => ({ assertInvitedArtistAccess: async () => {} }));
vi.mock("./attendance/consent", () => ({ recordClientRegistrationPermission: mocks.consent }));
vi.mock("./googleSheetsSync", () => ({ syncClientToSheets: mocks.sync }));
import { appRouter } from "./routers";

const user = { id: 8, studioId: 2, role: "admin", name: "Teste" };
const caller = (overrides = {}) => appRouter.createCaller({ user: { ...user, ...overrides }, req: { headers: {}, socket: {} }, res: {} } as any);
const saved = { id: 10, studioId: 2, name: "Teste", phone: "+5531999999999" };
beforeEach(() => {
  vi.clearAllMocks();
  mocks.createClient.mockResolvedValue(saved);
  mocks.getClientById.mockResolvedValue(saved);
  mocks.listClients.mockResolvedValue([]);
  mocks.getDb.mockResolvedValue({ select: () => ({ from: () => ({ where: () => ({ limit: async () => [{ id: 7 }] }) }) }) });
  mocks.consent.mockResolvedValue(true);
});

describe("Cadastro de cliente com autorização WhatsApp", () => {
  it("habilita notificações por padrão mesmo quando o chamador omite a opção", async () => {
    const result = await caller().clients.create({ name: "Teste", phone:saved.phone });
    expect(result.whatsappConsentRecorded).toBe(true);
    expect(mocks.consent).toHaveBeenCalledWith({studioId:2,clientId:10,enabled:true,actorId:8});
    expect(mocks.sync).toHaveBeenCalledOnce();
  });
  it("respeita a opção desmarcada e registra a recusa", async () => {
    const result = await caller().clients.create({name:"Teste",phone:saved.phone,recordWhatsAppConsent:false});
    expect(result.whatsappConsentRecorded).toBe(false);
    expect(result.warnings).toEqual([]);
    expect(mocks.consent).toHaveBeenCalledWith({studioId:2,clientId:10,enabled:false,actorId:8});
  });
  it("registra no mesmo cliente, estúdio e integração, com auditoria do autor", async () => {
    const result = await caller().clients.create({ name: "Teste", phone: saved.phone, quickRegistration: true, recordWhatsAppConsent: true });
    expect(result.whatsappConsentRecorded).toBe(true);
    expect(mocks.consent).toHaveBeenCalledWith({ studioId: 2, clientId: 10, enabled: true, actorId:8 });
    expect(mocks.createAuditLog).toHaveBeenCalledWith(expect.objectContaining({ userId: 8, entityId: 10, details: expect.objectContaining({ action: "whatsapp_operational_preference" }) }));
    expect(mocks.createClient.mock.calls[0][0]).not.toHaveProperty("recordWhatsAppConsent");
  });
  it("salva o cliente e informa falha do consentimento sem incentivar cadastro duplicado", async () => {
    mocks.consent.mockRejectedValueOnce(new Error("integração indisponível"));
    const result = await caller().clients.create({ name: "Teste", phone: saved.phone, recordWhatsAppConsent: true });
    expect(result.id).toBe(10);
    expect(result.whatsappConsentRecorded).toBe(false);
    expect(result.warnings[0]).toContain("não foi registrada");
    expect(mocks.createClient).toHaveBeenCalledOnce();
  });
  it("recusa telefone inválido antes de criar um cadastro com autorização", async () => {
    await expect(caller().clients.create({ name: "Teste", phone: "123", recordWhatsAppConsent: true })).rejects.toThrow("telefone brasileiro válido");
    expect(mocks.createClient).not.toHaveBeenCalled();
  });
  it("evita duplicidade de telefone formatado no cadastro rápido", async () => {
    mocks.listClients.mockResolvedValue([{ ...saved, phone: "(31) 99999-9999" }]);
    await expect(caller().clients.create({ name: "Outro", phone: saved.phone, quickRegistration: true })).rejects.toThrow("Já existe um cliente");
    expect(mocks.listClients).toHaveBeenCalledWith(2);
    expect(mocks.createClient).not.toHaveBeenCalled();
  });
  it("não permite que um administrador escolha outro estúdio", async () => {
    await caller().clients.create({ name: "Teste", studioId: 9 });
    expect(mocks.createClient).toHaveBeenCalledWith(expect.objectContaining({ studioId: 2 }));
  });
  it("permite a escolha operacional ao colaborador que já pode criar clientes", async () => {
    await caller({role:"collaborator",artistId:3}).clients.create({name:"Teste",phone:saved.phone});
    expect(mocks.createClient).toHaveBeenCalledWith(expect.objectContaining({studioId:2,artistId:3}));
    expect(mocks.consent).toHaveBeenCalledWith({studioId:2,clientId:10,enabled:true,actorId:8});
  });
  it("preserva cadastro sem telefone e informa que não pode notificar", async () => {
    mocks.consent.mockResolvedValue(false);
    const result = await caller().clients.create({name:"Teste"});
    expect(result.id).toBe(10);
    expect(result.whatsappConsentRecorded).toBe(false);
    expect(result.warnings[0]).toContain("telefone com DDD");
  });
});
