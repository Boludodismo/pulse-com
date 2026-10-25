import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ exec: vi.fn(), rows: vi.fn() }));
vi.mock("./database", () => ({ ...mocks, botPool: () => ({}) }));
vi.mock("./events", () => ({ inboxChanged: vi.fn() }));
import { downloadMetaAttachment, sendMetaAttachment } from "./metaMedia";
import { sealBotSecret } from "./crypto";
import { applyDeliveryStatus } from "./receipts";
let s: any;
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv(
    "NATIVE_BOT_ENCRYPTION_KEY",
    Buffer.alloc(32, 7).toString("base64")
  );
  vi.stubEnv("OUTBOUND_MESSAGING_DISABLED", "false");
  vi.stubEnv("RAILWAY_ENVIRONMENT_ID", "test");
  s = {
    studio_id: 7,
    wa_instance: "meta:123456",
    wa_secret: sealBotSecret(
      JSON.stringify({
        phoneNumberId: "123456",
        accessToken: "test-token-never-real-1234",
        appSecret: "a".repeat(32),
      }),
      7
    ),
  };
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
describe("mídias e recibos oficiais", () => {
  it("não encaminha o token da Meta para uma URL arbitrária", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            url: "https://attacker.example/file",
            file_size: 100,
          }),
          { status: 200 }
        )
      );
    vi.stubGlobal("fetch", fetch);
    await expect(downloadMetaAttachment(s, "123456")).rejects.toThrow("Origem");
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("recusa mídia excessiva antes de baixar os bytes", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            url: "https://lookaside.fbsbx.com/file",
            file_size: 6000000,
          }),
          { status: 200 }
        )
      );
    vi.stubGlobal("fetch", fetch);
    await expect(downloadMetaAttachment(s, "123456")).rejects.toThrow("5 MB");
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("bloqueia anexos fora da janela da Meta antes de fazer upload", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    await expect(
      sendMetaAttachment(s, "5538999999999", "", null, {
        name: "x.pdf",
        mime: "application/pdf",
        base64: "JVBERi0=",
      })
    ).rejects.toThrow("24 horas");
    expect(fetch).not.toHaveBeenCalled();
  });
  it("bloqueia envios no ambiente de teste", async () => {
    vi.stubEnv("OUTBOUND_MESSAGING_DISABLED", "true");
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    await expect(
      sendMetaAttachment(s, "5538999999999", "", new Date().toISOString(), {
        name: "x.pdf",
        mime: "application/pdf",
        base64: "JVBERi0=",
      })
    ).rejects.toThrow("bloqueado");
    expect(fetch).not.toHaveBeenCalled();
  });
  it("recibo atrasado de enviada não rebaixa mensagem já lida", async () => {
    await applyDeliveryStatus(7, "external-1", "sent");
    const update = mocks.exec.mock.calls.at(-1)!;
    expect(update[1]).toEqual([
      "sent",
      7,
      "external-1",
      "sending",
      "uncertain",
    ]);
    expect(update[1]).not.toContain("read");
    expect(update[1]).not.toContain("delivered");
  });
});
