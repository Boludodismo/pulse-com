import { afterEach, describe, expect, it, vi } from "vitest";
import { isOutboundMessagingBlocked } from "./outboundSafety";
import { BotConversaProvider } from "./providers/botconversa";
import { MetaProvider } from "./providers/meta";
import { ZApiProvider } from "./providers/zapi";
vi.mock("../db", () => ({ getDb: vi.fn() }));
import { getDb } from "../db";
import { processPendingIntegrationJobs } from "./service";

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.clearAllMocks(); });
describe("isolamento de envios em homologação", () => {
  it.each([BotConversaProvider, MetaProvider, ZApiProvider])("bloqueia %s antes de qualquer chamada externa", async Provider => {
    vi.stubEnv("RAILWAY_ENVIRONMENT_ID", "92e8281a-668a-43ed-b2ba-cac84082a91c");
    vi.stubEnv("OUTBOUND_MESSAGING_DISABLED", "false");
    const network = vi.fn(); vi.stubGlobal("fetch", network);
    const result = await new Provider({ provider: "botconversa", apiToken: "test-only", phoneNumber: "", instanceId: "test" }).sendMessage("5531999999999", "Teste");
    expect(result.success).toBe(false);
    expect(result.error).toContain("bloqueado");
    expect(network).not.toHaveBeenCalled();
  });
  it("preserva a fila sem consultar ou modificar o banco", async () => {
    vi.stubEnv("RAILWAY_ENVIRONMENT_ID", "92e8281a-668a-43ed-b2ba-cac84082a91c");
    expect(await processPendingIntegrationJobs()).toEqual({ processed: 0, completed: 0, retried: 0, failed: 0 });
    expect(getDb).not.toHaveBeenCalled();
  });
  it("permite bloquear explicitamente outro ambiente", () => {
    vi.stubEnv("RAILWAY_ENVIRONMENT_ID", "production-test");
    vi.stubEnv("OUTBOUND_MESSAGING_DISABLED", "true");
    expect(isOutboundMessagingBlocked()).toBe(true);
  });
  it("preserva comportamento de produção quando bloqueio não configurado", () => {
    vi.stubEnv("RAILWAY_ENVIRONMENT_ID", "9890a3b6-7cb6-4330-abfe-d7665bbcf900");
    vi.stubEnv("OUTBOUND_MESSAGING_DISABLED", "");
    expect(isOutboundMessagingBlocked()).toBe(false);
  });
});
