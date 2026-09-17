import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { BotConversaProvider } from "./messaging/providers/botconversa";
const provider = () => new BotConversaProvider({ provider: "botconversa", apiToken: "test-token", phoneNumber: "+5511999999999" });
beforeEach(() => { vi.stubEnv("OUTBOUND_MESSAGING_DISABLED", "false"); vi.stubEnv("RAILWAY_ENVIRONMENT_ID", "test"); });
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
it("responde a assinante existente mesmo com corpo de sucesso vazio", async () => {
  const fetch = vi.fn().mockResolvedValueOnce(new Response('{"id":42}')).mockResolvedValueOnce(new Response(null, { status: 204 }));
  vi.stubGlobal("fetch", fetch);
  expect(await provider().sendExistingContactReply("11999999999", "Oi")).toMatchObject({ status: "accepted" });
  expect(fetch.mock.calls[1][0]).toContain("/subscriber/42/send_message/");
  expect(fetch.mock.calls[1][1].body).toBe(JSON.stringify({ type: "text", value: "Oi" }));
});
it("não cadastra contato nem concede opt-in quando não existe assinante", async () => {
  const fetch = vi.fn().mockImplementation(async () => new Response(null, { status: 404 })); vi.stubGlobal("fetch", fetch);
  expect(await provider().sendExistingContactReply("11999999999", "Oi")).toMatchObject({ status: "failed" });
  expect(fetch.mock.calls.every(call => call[1].method === "GET")).toBe(true);
});
it("não repete POST após falha de rede e informa resultado incerto", async () => {
  const fetch = vi.fn().mockResolvedValueOnce(new Response('{"id":42}')).mockRejectedValueOnce(new Error("timeout")); vi.stubGlobal("fetch", fetch);
  expect(await provider().sendExistingContactReply("11999999999", "Oi")).toMatchObject({ status: "unknown" });
  expect(fetch).toHaveBeenCalledTimes(2);
});
