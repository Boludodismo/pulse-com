import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getDb: vi.fn(), getClientById: vi.fn(), listClients: vi.fn(), createClient: vi.fn(),
  createAuditLog: vi.fn(), consent: vi.fn(), sync: vi.fn(),
}));
vi.mock("./db", () => mocks);
vi.mock("./saas", async original => ({ ...await original<typeof import("./saas")>(), isUserAccessActive: async () => true }));
vi.mock("./invitedArtistAccess", () => ({ assertInvitedArtistAccess: async () => {} }));
vi.mock("./messaging/consent", () => ({ saveWhatsappConsent: mocks.consent }));
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
  mocks.consent.mockResolvedValue({ ok: true });
});

describe("Cadastro de cliente com autorização WhatsApp", () => {
  it("preserva cadastro comum sem consultar ou alterar consentimento", async () => {
    const result = await caller().clients.create({ name: "Teste" });
    expect(result.id).toBe(10);
    expect(result.warnings).toEqual([]);
    expect(mocks.consent).not.toHaveBeenCalled();
    expect(mocks.getDb).not.toHaveBeenCalled();
    expect(mocks.sync).toHaveBeenCalledOnce();
  });
  it("registra no mesmo cliente, estúdio e integração, com auditoria do autor", async () => {
    const result = await caller().clients.create({ name: "Teste", phone: saved.phone, quickRegistration: true, recordWhatsAppConsent: true });
    expect(result.whatsappConsentRecorded).toBe(true);
    expect(mocks.consent).toHaveBeenCalledWith({ studioId: 2, clientId: 10, integrationId: 7, enabled: true, source: "cadastro_rapido_orcamento" });
    expect(mocks.createAuditLog).toHaveBeenCalledWith(expect.objectContaining({ userId: 8, entityId: 10, details: expect.objectContaining({ action: "whatsapp_consent_granted" }) }));
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
  it("mantém a permissão administrativa existente para registrar autorização", async () => {
    await expect(caller({ role: "collaborator", artistId: 3 }).clients.create({ name: "Teste", phone: saved.phone, recordWhatsAppConsent: true })).rejects.toThrow("Apenas administradores");
    expect(mocks.consent).not.toHaveBeenCalled();
    expect(mocks.createClient).not.toHaveBeenCalled();
  });
  it("informa falta de integração ativa sem perder o cliente", async () => {
    mocks.getDb.mockResolvedValue(null);
    const result = await caller().clients.create({ name: "Teste", phone: saved.phone, recordWhatsAppConsent: true });
    expect(result.id).toBe(10);
    expect(result.whatsappConsentRecorded).toBe(false);
    expect(result.warnings).toHaveLength(1);
  });
});
