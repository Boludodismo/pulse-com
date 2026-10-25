import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({
  rows: vi.fn(),
  exec: vi.fn(),
  settings: vi.fn(),
  socket: vi.fn(),
  changed: vi.fn(),
}));
vi.mock("./database", () => ({
  rows: mock.rows,
  exec: mock.exec,
  botAudit: vi.fn(),
  withBotLock: vi.fn(),
  isNativeBotReady: () => true,
  utcSql: (d = new Date()) => d.toISOString().slice(0, 19).replace("T", " "),
}));
vi.mock("./access", () => ({ settings: mock.settings }));
vi.mock("./events", () => ({ inboxChanged: mock.changed }));
vi.mock("./webhook", () => ({ persistBotInbound: vi.fn() }));
vi.mock("./providers", () => ({ BotProviderError: class extends Error {} }));
vi.mock("@whiskeysockets/baileys", () => ({
  default: mock.socket,
  BufferJSON: {},
  DisconnectReason: {},
  initAuthCreds: vi.fn(),
  normalizeMessageContent: vi.fn(),
  downloadContentFromMessage: vi.fn(),
  proto: {},
}));
import { isQrBot, qrSnapshot, startQr, sendQr } from "./qr";
import { sealBotSecret } from "./crypto";
beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-25T01:00:00Z"));
  vi.stubEnv(
    "NATIVE_BOT_ENCRYPTION_KEY",
    Buffer.alloc(32, 7).toString("base64")
  );
  vi.stubEnv("NATIVE_BOT_QR_ENABLED", "true");
  vi.stubEnv("OUTBOUND_MESSAGING_DISABLED", "false");
  vi.stubEnv("RAILWAY_ENVIRONMENT_ID", "test");
  mock.settings.mockResolvedValue({
    studio_id: 7,
    wa_instance: "qr:7:session",
    wa_status: "awaiting_qr",
  });
  mock.rows.mockResolvedValue([]);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});
describe("pareamento próprio por QR", () => {
  it("não abre conexão se o serviço estiver desabilitado", async () => {
    vi.stubEnv("NATIVE_BOT_QR_ENABLED", "false");
    await expect(startQr(7)).rejects.toThrow("habilitada");
    expect(mock.socket).not.toHaveBeenCalled();
  });
  it("respeita o bloqueio de mensagens do ambiente de teste", async () => {
    vi.stubEnv("OUTBOUND_MESSAGING_DISABLED", "true");
    await expect(startQr(7)).rejects.toThrow("bloqueada");
    expect(mock.socket).not.toHaveBeenCalled();
  });
  it("não mostra QR expirado nem sessão de outro tipo", async () => {
    mock.rows.mockResolvedValue([
      {
        qr_image: sealBotSecret("imagem", 7),
        qr_expires: "2026-10-25 00:59:59",
      },
    ]);
    expect((await qrSnapshot(7)).image).toBeNull();
    mock.settings.mockResolvedValue({
      studio_id: 7,
      wa_instance: "meta:12345",
      wa_status: "connected",
    });
    mock.rows.mockResolvedValue([
      {
        qr_image: sealBotSecret("imagem", 7),
        qr_expires: "2026-10-25 01:00:20",
      },
    ]);
    expect((await qrSnapshot(7)).image).toBeNull();
  });
  it("entrega o QR temporário apenas com a chave do próprio estúdio", async () => {
    mock.rows.mockResolvedValue([
      {
        qr_image: sealBotSecret("data:image/png;base64,aGVsbG8=", 7),
        qr_expires: "2026-10-25 01:00:20",
      },
    ]);
    expect((await qrSnapshot(7)).image).toBe("data:image/png;base64,aGVsbG8=");
    mock.settings.mockResolvedValue({
      studio_id: 9,
      wa_instance: "qr:9:session",
      wa_status: "awaiting_qr",
    });
    await expect(qrSnapshot(9)).rejects.toThrow();
  });
  it("não tenta enviar por um processo sem a posse da sessão", async () => {
    await expect(
      sendQr(
        { studio_id: 7, wa_status: "connected" } as any,
        "5538999999999",
        "Olá"
      )
    ).rejects.toThrow("Sessão QR indisponível");
    expect(mock.socket).not.toHaveBeenCalled();
  });
  it("distingue QR próprio de Meta e canais legados", () => {
    expect(isQrBot({ wa_instance: "qr:7:session" })).toBe(true);
    expect(isQrBot({ wa_instance: "meta:12345" })).toBe(false);
    expect(isQrBot({ wa_instance: null })).toBe(false);
  });
});
