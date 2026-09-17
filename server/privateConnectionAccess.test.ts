import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ getDb: vi.fn(), getUserByEmail: vi.fn(), getUserByOpenId: vi.fn() }));
vi.mock("./db", () => mocks);
vi.mock("./saas", () => ({ isUserAccessActive: async () => true }));
import { messagingRouter } from "./routers/messaging";
import { assertPrivateConnectionAccess } from "./messaging/privateConnectionAccess";
import { isPrivateInboxOwner } from "./intelligentInbox/access";
import { ENV } from "./_core/env";
const owner = { id: 1, role: "superadmin", studioId: 10, email: "owner@example.test", openId: "owner" };
beforeEach(() => {
  vi.resetAllMocks(); ENV.authMode = "local";
  vi.stubEnv("LOCAL_ADMIN_EMAIL", owner.email);
  mocks.getUserByEmail.mockResolvedValue(owner);
});
describe("conexão privada", () => {
  it("aplica a proteção nas APIs de conexão, histórico e configurações", async () => {
    const caller = messagingRouter.createCaller({user:{...owner, id:2, role:"admin",email:"other@example.test"}} as any);
    for (const call of [() => caller.listIntegrations(), () => caller.listMessageHistory({limit:10}),
      () => caller.listQueue({limit:10}), () => caller.getAutomationSettings(),
      () => caller.testConnection({id:1}), () => caller.activateIntegration({id:1})]) {
      await expect(call()).rejects.toMatchObject({code:"FORBIDDEN"});
    }
    expect(mocks.getDb).not.toHaveBeenCalled();
  });
  it("reconhece a conta, não apenas a função", () => {
    expect(isPrivateInboxOwner(owner)).toBe(true);
    expect(isPrivateInboxOwner({...owner, role: "admin"})).toBe(false);
    expect(isPrivateInboxOwner({...owner, email: "other@example.test"})).toBe(false);
    expect(isPrivateInboxOwner({...owner, id: -1})).toBe(false);
  });
  it.each(["admin", "collaborator", "superadmin"])("impede %s do mesmo estúdio de usar a conexão", async role => {
    await expect(assertPrivateConnectionAccess({...owner, id: 2, email: "other@example.test", role}, 10)).rejects.toMatchObject({code: "FORBIDDEN"});
    expect(mocks.getDb).not.toHaveBeenCalled();
  });
  it("preserva o acesso do dono", async () => {
    await expect(assertPrivateConnectionAccess(owner, 10)).resolves.toBeUndefined();
  });
  it("não revela integrações quando o proprietário não pode ser resolvido", async () => {
    mocks.getUserByEmail.mockResolvedValue(undefined);
    await expect(assertPrivateConnectionAccess({...owner, email:"other@example.test"}, 20)).rejects.toMatchObject({code:"FORBIDDEN"});
  });
  it.each([true, false])("verifica vínculo da conexão em outro estúdio, protegida=%s", async protectedConnection => {
    const q: any = { from: () => q, where: () => q, limit: async () => protectedConnection ? [{id: 3}] : [] };
    mocks.getDb.mockResolvedValue({select: () => q});
    const operation = assertPrivateConnectionAccess({...owner, id:2, email:"other@example.test",role:"admin"},20);
    if (protectedConnection) await expect(operation).rejects.toMatchObject({code:"FORBIDDEN"});
    else await expect(operation).resolves.toBeUndefined();
  });
});
