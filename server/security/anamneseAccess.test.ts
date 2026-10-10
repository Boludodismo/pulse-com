import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  getClientById: vi.fn(),
  getAnamnesisById: vi.fn(),
  getAnamneseSubmissionById: vi.fn(),
  getAppointmentById: vi.fn(),
  getAnamneseRequestByToken: vi.fn(),
  getAnamneseSubmissionByRequestId: vi.fn(),
  updateAnamneseSubmission: vi.fn(),
  deleteAnamneseSubmission: vi.fn(),
  getAnamneseSubmissionsByClientId: vi.fn(),
  getAnamneseRequestsByClientId: vi.fn(),
}));
vi.mock("../db", () => mocks);
vi.mock("../invitedArtistAccess", () => ({
  assertInvitedArtistAccess: async () => {},
}));
import { appRouter } from "../routers";
import { artistRouteModule } from "../../shared/artistInvitations";
const actor = {
  id: 5,
  name: "Fictício",
  role: "admin",
  studioId: 2,
  isActive: 1,
  accessStatus: "active",
};
const caller = (overrides = {}) =>
  appRouter.createCaller({
    user: { ...actor, ...overrides },
    req: { headers: {} },
    res: {},
  } as any);
beforeEach(() => {
  vi.resetAllMocks();
  mocks.getClientById.mockResolvedValue({ id: 10, studioId: 3, artistId: 7 });
  mocks.getAnamneseSubmissionById.mockResolvedValue({
    id: 20,
    clientId: 10,
    appointmentId: null,
  });
  mocks.getAnamnesisById.mockResolvedValue({
    id: 21,
    clientId: 10,
    appointmentId: null,
  });
});
describe("Anamnese access via actual tRPC routes", () => {
  it("allows invited artists to open their own security screen", () => {
    expect(artistRouteModule("/account/security")).toBe("self");
  });
  it("rejects collaborators without an artist before reading medical data", async () => {
    await expect(
      caller({ role: "collaborator", artistId: null }).anamnese.getByClientId({
        clientId: 10,
      })
    ).rejects.toThrow();
    expect(mocks.getAnamneseSubmissionsByClientId).not.toHaveBeenCalled();
  });
  it("rejects public enumeration without a link token", async () => {
    const publicCaller = appRouter.createCaller({
      user: null,
      req: {},
      res: {},
    } as any);
    await expect(
      publicCaller.anamnese.getSubmissionByRequestId({ requestId: 4 } as any)
    ).rejects.toThrow();
    expect(mocks.getAnamneseSubmissionByRequestId).not.toHaveBeenCalled();
  });
  it.each(["getByClientId", "getRequestsByClientId"] as const)(
    "rejects other tenant in %s before reading medical data",
    async route => {
      await expect(caller().anamnese[route]({ clientId: 10 })).rejects.toThrow(
        "Ficha não encontrada"
      );
      expect(mocks.getAnamneseSubmissionsByClientId).not.toHaveBeenCalled();
      expect(mocks.getAnamneseRequestsByClientId).not.toHaveBeenCalled();
    }
  );
  it("blocks cross-tenant modifications", async () => {
    await expect(
      caller().anamnese.updateSubmission({ id: 20, payload: {} })
    ).rejects.toThrow();
    await expect(
      caller().anamnese.deleteSubmission({ id: 20 })
    ).rejects.toThrow();
    expect(mocks.updateAnamneseSubmission).not.toHaveBeenCalled();
    expect(mocks.deleteAnamneseSubmission).not.toHaveBeenCalled();
  });
  it("blocks legacy export and record reads outside tenant", async () => {
    await expect(caller().anamnesis.exportPdf({ id: 21 })).rejects.toThrow();
    await expect(caller().anamnesis.getById({ id: 21 })).rejects.toThrow();
  });
  it("preserves global superadministrator access", async () => {
    await caller({ role: "superadmin" }).anamnese.deleteSubmission({ id: 20 });
    expect(mocks.deleteAnamneseSubmission).toHaveBeenCalledWith(20);
  });
  it("blocks suspended or expired admin accounts", async () => {
    await expect(
      caller({ accessStatus: "suspended" }).saas.metrics()
    ).rejects.toThrow();
    await expect(
      caller({ role: "superadmin", isActive: 0 }).saas.metrics()
    ).rejects.toThrow("Acesso suspenso");
  });
  it("rejects mismatched and expired public links", async () => {
    mocks.getAnamneseRequestByToken.mockResolvedValue({
      id: 8,
      expiresAt: "2099-01-01",
      statusRequest: "pendente",
    });
    await expect(
      caller().anamnese.getSubmissionByRequestId({
        requestId: 4,
        token: "valid-link-token",
      })
    ).rejects.toThrow("Link inválido");
    mocks.getAnamneseRequestByToken.mockResolvedValue({
      id: 4,
      expiresAt: "2000-01-01",
      statusRequest: "preenchida",
    });
    await expect(
      caller().anamnese.getSubmissionByRequestId({
        requestId: 4,
        token: "valid-link-token",
      })
    ).rejects.toThrow("Link inválido");
    expect(mocks.getAnamneseSubmissionByRequestId).not.toHaveBeenCalled();
  });
  it("rejects links with an invalid expiry date", async () => {
    mocks.getAnamneseRequestByToken.mockResolvedValue({
      id: 4,
      expiresAt: "invalid-date",
      statusRequest: "preenchida",
    });
    await expect(
      caller().anamnese.getSubmissionByRequestId({
        requestId: 4,
        token: "valid-link-token",
      })
    ).rejects.toThrow();
    expect(mocks.getAnamneseSubmissionByRequestId).not.toHaveBeenCalled();
  });
  it("lets the matching unexpired token prefill only its request", async () => {
    mocks.getAnamneseRequestByToken.mockResolvedValue({
      id: 4,
      expiresAt: "2099-01-01",
      statusRequest: "preenchida",
    });
    mocks.getAnamneseSubmissionByRequestId.mockResolvedValue({
      id: 20,
      requestId: 4,
      payloadJson: '{"fixture":true}',
    });
    const result = await caller().anamnese.getSubmissionByRequestId({
      requestId: 4,
      token: "valid-link-token",
    });
    expect(result?.payload.fixture).toBe(true);
  });
});
