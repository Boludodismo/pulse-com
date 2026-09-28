import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import {
  channelBotSettings,
  resolveBotChannel,
  saveChannel,
  bindBotChannel,
  migrateLegacyBotChannels,
  channelForWebhook,
  deleteUnusedChannel,
} from "./channels";
import { encryptIntegrationSecret, decryptIntegrationSecret } from "./crypto";
import { openBotSecret, sealBotSecret } from "../nativeBot/crypto";
const db = vi.hoisted(() => ({
  rows: vi.fn(),
  exec: vi.fn(),
  begin: vi.fn(),
  commit: vi.fn(),
  rollback: vi.fn(),
}));
vi.mock("../nativeBot/database", () => ({
  rows: db.rows,
  exec: db.exec,
  botPool: () => ({}),
  withBotLock: async (_: string, fn: any) =>
    fn({
      beginTransaction: db.begin,
      commit: db.commit,
      rollback: db.rollback,
    }),
}));
let channel: any, bot: any;
beforeEach(() => {
  vi.stubEnv(
    "NATIVE_BOT_ENCRYPTION_KEY",
    Buffer.alloc(32, 8).toString("base64")
  );
  vi.stubEnv(
    "BOTCONVERSA_ENCRYPTION_KEY",
    Buffer.alloc(32, 9).toString("base64")
  );
  channel = {
    id: 19,
    studio_id: 7,
    name: "Principal",
    provider: "meta",
    phoneNumber: "5511999998888",
    instanceId: "1234567890",
    encrypted_api_token: encryptIntegrationSecret(
      "meta-token-for-testing-only"
    ),
    encrypted_provider_config: encryptIntegrationSecret(
      JSON.stringify({ appSecret: "a".repeat(32) })
    ),
    connection_key: "x".repeat(43),
    connection_state: "connected",
    webhook_ready: 1,
    sandbox_mode: 1,
    sandbox_test_phone: "5511999998888",
    is_enabled: 0,
    status: "inativo",
  };
  bot = {
    studio_id: 7,
    enabled: 0,
    wa_integration_id: 19,
    wa_secret: null,
    wa_instance: null,
    webhook_key: null,
    webhook_ready: 0,
  };
  db.rows.mockResolvedValue([]);
  db.exec.mockResolvedValue({ insertId: 19, affectedRows: 1 });
});
afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});
describe("canal compartilhado", () => {
  it("lê credenciais, número, status e homologação da Central sem gravar outra cópia", async () => {
    db.rows.mockResolvedValue([channel]);
    const first = await resolveBotChannel(bot);
    expect(first.wa_phone).toBe(channel.phoneNumber);
    expect(first.wa_status).toBe("connected");
    expect(first.channelSandbox).toBe(true);
    expect(JSON.parse(openBotSecret(first.wa_secret!, 7)).accessToken).toBe(
      "meta-token-for-testing-only"
    );
    channel = {
      ...channel,
      encrypted_api_token: encryptIntegrationSecret(
        "another-token-for-testing-only"
      ),
      connection_state: "disconnected",
    };
    db.rows.mockResolvedValue([channel]);
    const next = await resolveBotChannel(bot);
    expect(JSON.parse(openBotSecret(next.wa_secret!, 7)).accessToken).toBe(
      "another-token-for-testing-only"
    );
    expect(next.wa_status).toBe("disconnected");
    expect(db.exec).not.toHaveBeenCalled();
  });
  it("recusa canal de outro estúdio e não usa credencial legada se vínculo sumiu", async () => {
    expect(() => channelBotSettings({ ...bot, studio_id: 8 }, channel)).toThrow(
      "outro estúdio"
    );
    db.rows.mockResolvedValue([]);
    expect(
      (await resolveBotChannel({ ...bot, wa_secret: "legacy" })).wa_secret
    ).toBeNull();
  });
  it("recusa duplicidade sem sobrescrever conexão existente", async () => {
    db.rows.mockResolvedValue([channel]);
    await expect(
      saveChannel(7, {
        provider: "meta",
        name: "Novo",
        phoneNumber: "5511999998888",
        instanceId: channel.instanceId,
        apiToken: "another-test-token-value",
        providerSecret: "b".repeat(32),
        sandboxMode: true,
      })
    ).rejects.toThrow("já está cadastrado");
    expect(db.exec).not.toHaveBeenCalled();
    expect(db.rollback).toHaveBeenCalled();
  });
  it("edita canal existente preservando seu ID e não grava token em claro", async () => {
    db.rows.mockImplementation(async (sql: string) =>
      sql.includes("AND id=?") ? [channel] : []
    );
    await saveChannel(7, {
      id: 19,
      provider: "meta",
      name: "Renomeado",
      phoneNumber: channel.phoneNumber,
      instanceId: channel.instanceId,
      sandboxMode: true,
    });
    const update = db.exec.mock.calls.find(([sql]) =>
      sql.startsWith("UPDATE whatsapp_integrations")
    )!;
    expect(update[1]).not.toContain("meta-token-for-testing-only");
    expect(decryptIntegrationSecret(update[1][2])).toBe(
      "meta-token-for-testing-only"
    );
    expect(update[1].slice(-2)).toEqual([19, 7]);
    expect(
      db.exec.mock.calls.some(([sql]) =>
        sql.includes("UPDATE tatuei_bot_messages")
      )
    ).toBe(false);
    expect(db.commit).toHaveBeenCalled();
  });
  it("vincula sem ativar bot, sem trocar canal padrão da Central e sem copiar segredo", async () => {
    db.rows.mockImplementation(async (sql: string) =>
      sql.includes("tatuei_bot_settings")
        ? [{ ...bot, wa_integration_id: null }]
        : [channel]
    );
    await bindBotChannel(7, 19);
    const sql = db.exec.mock.calls.map(([q]) => q).join("\n");
    expect(sql).toContain("wa_secret=NULL");
    expect(sql).not.toContain("enabled=1");
    expect(sql).not.toContain("UPDATE whatsapp_integrations");
    expect(sql).toContain("status='canceled'");
  });
  it("vincular novamente o mesmo canal não cancela mensagens", async () => {
    db.rows.mockResolvedValue([bot]);
    await bindBotChannel(7, 19);
    expect(db.exec).not.toHaveBeenCalled();
  });
  it("migra legado mantendo chave de webhook e não ativa a Central", async () => {
    const legacy = {
      ...bot,
      wa_integration_id: null,
      enabled: 1,
      wa_status: "connected",
      wa_phone: channel.phoneNumber,
      webhook_key: "k".repeat(43),
      webhook_ready: 1,
      wa_instance: "meta:" + channel.instanceId,
      wa_secret: sealBotSecret(
        JSON.stringify({
          phoneNumberId: channel.instanceId,
          accessToken: "meta-token-for-testing-only",
          appSecret: "a".repeat(32),
        }),
        7
      ),
    };
    db.rows.mockImplementation(async (sql: string) =>
      sql.includes("wa_secret IS NOT NULL") ? [legacy] : []
    );
    await migrateLegacyBotChannels({} as any);
    const create = db.exec.mock.calls.find(([sql]) =>
      sql.startsWith("INSERT INTO whatsapp_integrations")
    )!;
    expect(create[1]).toContain(legacy.webhook_key);
    expect(create[1]).not.toContain("meta-token-for-testing-only");
    expect(create[0]).toContain("0,'inativo'");
    expect(db.exec.mock.calls[1][1]).toEqual([19, 7]);
  });
  it("não sobrescreve uma identidade em conflito durante a migração", async () => {
    const legacy = {
      ...bot,
      wa_integration_id: null,
      wa_instance: "meta:" + channel.instanceId,
      wa_secret: sealBotSecret(
        JSON.stringify({
          phoneNumberId: channel.instanceId,
          accessToken: "old-token-for-testing-only",
          appSecret: "a".repeat(32),
        }),
        7
      ),
    };
    db.rows.mockImplementation(async (sql: string) =>
      sql.includes("tatuei_bot_settings") ? [legacy] : [channel]
    );
    await migrateLegacyBotChannels({} as any);
    expect(db.exec.mock.calls).toHaveLength(1);
    expect(db.exec.mock.calls[0][0]).toContain("last_error=");
  });
  it("não exclui canal vinculado ao Bot", async () => {
    db.rows.mockImplementation(async (sql: string) =>
      sql.includes("whatsapp_integrations") ? [channel] : [{ studio_id: 7 }]
    );
    await expect(deleteUnusedChannel(7, 19)).rejects.toThrow("Desvincule");
    expect(db.exec).not.toHaveBeenCalled();
  });
  it("credencial legada incompleta não impede inicialização nem é apagada", async () => {
    db.rows.mockResolvedValue([
      { ...bot, wa_instance: "meta:123", wa_secret: sealBotSecret("{}", 7) },
    ]);
    await migrateLegacyBotChannels({} as any);
    expect(db.exec.mock.calls).toHaveLength(1);
    expect(db.exec.mock.calls[0][0]).toContain("last_error=");
  });
  it("canal não vinculado recebe eventos sem habilitar o Bot", async () => {
    db.rows.mockImplementation(async (sql: string) =>
      sql.includes("whatsapp_integrations")
        ? [channel]
        : [{ ...bot, enabled: 1, wa_integration_id: 25 }]
    );
    const inbound = await channelForWebhook(channel.connection_key);
    expect(inbound?.linked).toBe(false);
    expect(inbound?.settings.enabled).toBe(0);
  });
});
