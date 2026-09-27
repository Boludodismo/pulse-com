import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createHmac } from "node:crypto";
import { nativeBotRouter } from "../routers/nativeBot";
import { sealBotSecret, openBotSecret } from "./crypto";
import type { BotSettings } from "./access";
import { getBotQr, safeBotError, zapi } from "./providers";
import {
  isMetaBot,
  metaCredentialsSchema,
  metaWindowOpen,
  sendMetaBot,
  verifyMetaBot,
  validMetaSignature,
} from "./meta";
import { receiveMetaWebhook, verifyMetaWebhook } from "./metaWebhook";
import { receiveNativeBotWebhook } from "./webhook";

vi.mock("../saas", () => ({ isUserAccessActive: async () => true }));
vi.mock("../invitedArtistAccess", () => ({
  assertInvitedArtistAccess: async () => {},
}));
const db = vi.hoisted(() => ({ rows: vi.fn(), exec: vi.fn(), audit: vi.fn() }));
vi.mock("./database", () => ({
  rows: db.rows,
  exec: db.exec,
  botAudit: db.audit,
  botPool: () => ({}),
  assertBotSchema: () => {},
  botTransaction: async (fn: any) => fn({}),
  withBotLock: async (_name: string, fn: any) => fn({}),
  jsonValue: (v: any, fallback: any) => v ?? fallback,
  utcSql: (date = new Date()) =>
    date.toISOString().slice(0, 19).replace("T", " "),
}));
const credentials = {
  phoneNumberId: "12345678901",
  accessToken: "meta-test-token-not-a-real-token",
  appSecret: "a".repeat(32),
};
let settings: BotSettings;
beforeEach(() => {
  vi.stubEnv(
    "NATIVE_BOT_ENCRYPTION_KEY",
    Buffer.alloc(32, 5).toString("base64")
  );
  vi.stubEnv("OUTBOUND_MESSAGING_DISABLED", "false");
  vi.stubEnv("RAILWAY_ENVIRONMENT_ID", "unit-test");
  settings = {
    studio_id: 7,
    enabled: 1,
    ai_secret: null,
    ai_model: "",
    ai_daily_limit: 1,
    ai_used: 0,
    ai_day: null,
    wa_secret: sealBotSecret(JSON.stringify(credentials), 7),
    wa_instance: `meta:${credentials.phoneNumberId}`,
    wa_phone: null,
    wa_status: "connected",
    webhook_key: "x".repeat(43),
    webhook_ready: 1,
    last_error: null,
  };
  db.exec.mockResolvedValue({ affectedRows: 1, insertId: 5 });
  db.rows.mockImplementation(async (sql: string) => {
    if (sql.includes("WHERE webhook_key=")) return [settings];
    if (sql.includes("FOR UPDATE"))
      return [
        {
          id: 11,
          studio_id: 7,
          artist_id: 8,
          name: "Cliente",
          phone: "5511999998888",
        },
      ];
    return [];
  });
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});
const recent = () => new Date(Date.now() - 60000).toISOString();
const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });

describe("conector oficial Meta", () => {
  it("reconhece registros legados como Z-API e exige campos Meta válidos", () => {
    expect(isMetaBot({ wa_instance: "old-zapi-instance" })).toBe(false);
    expect(metaCredentialsSchema.safeParse(credentials).success).toBe(true);
    expect(
      metaCredentialsSchema.safeParse({
        ...credentials,
        phoneNumberId: "https://evil.test",
      }).success
    ).toBe(false);
    expect(
      metaCredentialsSchema.safeParse({ ...credentials, appSecret: "" }).success
    ).toBe(false);
  });
  it("valida o número com Bearer token sem enviar mensagens", async () => {
    const fetch = vi.fn().mockResolvedValue(
      reply({
        id: credentials.phoneNumberId,
        display_phone_number: "+55 11 99999-8888",
      })
    );
    vi.stubGlobal("fetch", fetch);
    expect(await verifyMetaBot(settings)).toEqual({ phone: "+5511999998888" });
    expect(fetch.mock.calls[0][0]).toContain(
      "graph.facebook.com/v23.0/12345678901?"
    );
    expect(fetch.mock.calls[0][0]).not.toContain(credentials.accessToken);
    expect(fetch.mock.calls[0][1].method).toBe("GET");
    expect(fetch.mock.calls[0][1].headers.Authorization).toBe(
      `Bearer ${credentials.accessToken}`
    );
  });
  it("não aceita identidade de outro número nem status de sucesso vazio", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          reply({ id: "999999", display_phone_number: "+5511999998888" })
        )
    );
    await expect(verifyMetaBot(settings)).rejects.toThrow("não confirmou");
  });
  it("envia pelo endpoint Meta e exige identificação da mensagem", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(reply({ messages: [{ id: "wamid.test" }] }));
    vi.stubGlobal("fetch", fetch);
    expect(
      await sendMetaBot(settings, "5511999998888", "Olá", recent())
    ).toEqual({ messageId: "wamid.test" });
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toMatchObject({
      messaging_product: "whatsapp",
      to: "5511999998888",
      type: "text",
      text: { body: "Olá" },
    });
    fetch.mockResolvedValue(reply({ messages: [] }));
    await expect(
      sendMetaBot(settings, "5511999998888", "Olá", recent())
    ).rejects.toMatchObject({ uncertain: true });
  });
  it("recusa janela vencida, ausente ou futura antes de chamar a Meta", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    for (const value of [
      null,
      "invalid",
      new Date(Date.now() - 86400000).toISOString(),
      new Date(Date.now() + 60000).toISOString(),
    ]) {
      expect(metaWindowOpen(value)).toBe(false);
      await expect(
        sendMetaBot(settings, "5511999998888", "Olá", value)
      ).rejects.toThrow("24 horas");
    }
    expect(fetch).not.toHaveBeenCalled();
    expect(metaWindowOpen(recent())).toBe(true);
  });
  it("bloqueia envio em homologação", async () => {
    vi.stubEnv("OUTBOUND_MESSAGING_DISABLED", "true");
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    await expect(
      sendMetaBot(settings, "5511999998888", "Olá", recent())
    ).rejects.toThrow("bloqueadas");
    expect(fetch).not.toHaveBeenCalled();
  });
  it("não expõe token, App Secret ou corpo de erro da Meta", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          reply({ error: { code: 190, message: credentials.accessToken } }, 401)
        )
    );
    await expect(verifyMetaBot(settings)).rejects.toThrow("não aceitou");
    try {
      await verifyMetaBot(settings);
    } catch (e) {
      expect(safeBotError(e)).not.toContain(credentials.accessToken);
    }
  });
  it("marca timeout como incerto e não tenta reenviar", async () => {
    const fetch = vi.fn().mockRejectedValue(new Error(credentials.accessToken));
    vi.stubGlobal("fetch", fetch);
    await expect(
      sendMetaBot(settings, "5511999998888", "Olá", recent())
    ).rejects.toMatchObject({ uncertain: true });
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("não gera QR para Meta e preserva o endpoint Z-API", async () => {
    const fetch = vi.fn().mockResolvedValue(reply({ connected: true }));
    vi.stubGlobal("fetch", fetch);
    await expect(getBotQr(settings)).rejects.toThrow("sem QR");
    expect(fetch).not.toHaveBeenCalled();
    const legacy = {
      ...settings,
      wa_instance: "instance-test",
      wa_secret: sealBotSecret(
        JSON.stringify({
          instanceId: "instance-test",
          token: "token-test",
          clientToken: "client-token-test",
        }),
        7
      ),
    };
    await zapi(legacy, "status");
    expect(fetch.mock.calls[0][0]).toContain(
      "api.z-api.io/instances/instance-test/token/token-test/status"
    );
  });
});
function response() {
  const res: any = { statusCode: 200, content: null };
  res.status = (code: number) => {
    res.statusCode = code;
    return res;
  };
  res.sendStatus = (code: number) => {
    res.statusCode = code;
    return res;
  };
  res.json = res.send = (body: any) => {
    res.content = body;
    return res;
  };
  res.type = () => res;
  return res;
}
function payload() {
  return {
    object: "whatsapp_business_account",
    entry: [
      {
        changes: [
          {
            field: "messages",
            value: {
              metadata: { phone_number_id: credentials.phoneNumberId },
              contacts: [
                { wa_id: "5511999998888", profile: { name: "Cliente" } },
              ],
              messages: [
                {
                  id: "wamid.inbound",
                  from: "5511999998888",
                  timestamp: String(Math.floor(Date.now() / 1000)),
                  type: "text",
                  text: { body: "Olá" },
                },
              ],
            },
          },
        ],
      },
    ],
  };
}
function request(body: any) {
  const metaRawBody = Buffer.from(JSON.stringify(body));
  const signature =
    "sha256=" +
    createHmac("sha256", credentials.appSecret)
      .update(metaRawBody)
      .digest("hex");
  return {
    params: { key: settings.webhook_key },
    body,
    metaRawBody,
    get: () => signature,
  } as any;
}
describe("recebimento oficial Meta", () => {
  it("valida o desafio sem depender do bot estar habilitado", async () => {
    settings.enabled = 0;
    settings.webhook_ready = 0;
    const res = response();
    await verifyMetaWebhook(
      {
        params: { key: settings.webhook_key },
        query: {
          "hub.mode": "subscribe",
          "hub.verify_token": settings.webhook_key,
          "hub.challenge": "12345",
        },
      } as any,
      res
    );
    expect(res.statusCode).toBe(200);
    expect(res.content).toBe("12345");
    expect(db.exec.mock.calls[0][1]).toEqual([7, settings.webhook_key]);
  });
  it("rejeita token de verificação incorreto", async () => {
    const res = response();
    await verifyMetaWebhook(
      {
        params: { key: settings.webhook_key },
        query: {
          "hub.mode": "subscribe",
          "hub.verify_token": "wrong",
          "hub.challenge": "12345",
        },
      } as any,
      res
    );
    expect(res.statusCode).toBe(403);
    expect(db.exec).not.toHaveBeenCalled();
  });
  it("recusa assinatura inválida ou corpo bruto ausente", async () => {
    for (const patch of [
      { get: () => "sha256=" + "0".repeat(64) },
      { metaRawBody: undefined },
    ]) {
      const res = response();
      await receiveMetaWebhook({ ...request(payload()), ...patch }, res);
      expect(res.statusCode).toBe(403);
    }
    expect(db.exec).not.toHaveBeenCalled();
    expect(
      validMetaSignature(Buffer.from("x"), "sha256=xx", credentials.appSecret)
    ).toBe(false);
  });
  it("não aceita evento Meta na rota legada da Z-API", async () => {
    const res = response();
    await receiveNativeBotWebhook(request(payload()), res);
    expect(res.statusCode).toBe(404);
    expect(db.exec).not.toHaveBeenCalled();
  });
  it("ignora eventos de outro número e notificações sem mensagem", async () => {
    const p = payload();
    p.entry[0].changes[0].value.metadata.phone_number_id = "99999999999";
    const res = response();
    await receiveMetaWebhook(request(p), res);
    expect(res.statusCode).toBe(200);
    expect(db.exec).not.toHaveBeenCalled();
    p.entry[0].changes[0].value.metadata.phone_number_id =
      credentials.phoneNumberId;
    p.entry[0].changes[0].value.messages = [];
    await receiveMetaWebhook(request(p), response());
    expect(db.exec).not.toHaveBeenCalled();
  });
  it("persiste mensagem no estúdio correto usando horário original da Meta", async () => {
    const p = payload();
    p.entry[0].changes[0].value.messages[0].timestamp = String(
      Math.floor((Date.now() - 90000000) / 1000)
    );
    const res = response();
    await receiveMetaWebhook(request(p), res);
    expect(res.statusCode).toBe(200);
    const insert = db.exec.mock.calls.find(c =>
      c[0].startsWith("INSERT IGNORE")
    );
    expect(insert?.[1].slice(0, 6)).toEqual([
      7,
      11,
      "client",
      "Olá",
      "received",
      "wamid.inbound",
    ]);
    const update = db.exec.mock.calls.find(c =>
      c[0].includes("last_inbound_at=")
    );
    expect(update?.[0]).toContain("GREATEST");
    expect(metaWindowOpen(update?.[1][0])).toBe(false);
  });
  it("não duplica mensagem entregue novamente pela Meta", async () => {
    db.rows.mockImplementation(async (sql: string) =>
      sql.includes("WHERE webhook_key=")
        ? [settings]
        : sql.includes("external_id=")
          ? [{ id: 5 }]
          : []
    );
    const res = response();
    await receiveMetaWebhook(request(payload()), res);
    expect(res.statusCode).toBe(200);
    expect(db.exec).not.toHaveBeenCalled();
  });
  it("retorna erro recuperável se não conseguir persistir", async () => {
    db.exec.mockRejectedValueOnce(new Error("database unavailable"));
    const res = response();
    await receiveMetaWebhook(request(payload()), res);
    expect(res.statusCode).toBe(503);
  });
});

function caller(role = "admin") {
  return nativeBotRouter.createCaller({
    user: { id: 12, studioId: 7, artistId: role === "admin" ? null : 8, role },
    req: {},
    res: {},
  } as any);
}
describe("configuração Meta pelo CRM", () => {
  beforeEach(() => {
    vi.stubEnv("APP_BASE_URL", "https://crm.example.test");
    db.rows.mockImplementation(async (sql: string) => {
      if (sql.includes("FROM studios"))
        return [{ id: 7, name: "Estúdio teste" }];
      if (sql.includes("FROM tatuei_bot_settings WHERE studio_id="))
        return [settings];
      if (sql.includes("COUNT(*)")) return [{ total: 0 }];
      return [];
    });
  });
  it("salva credenciais criptografadas e não as devolve no painel", async () => {
    await expect(caller().saveMetaWhatsapp(credentials)).resolves.toEqual({
      ok: true,
    });
    const saved = db.exec.mock.calls.find(c => c[0].includes("SET wa_secret="));
    expect(saved?.[1][0]).not.toContain(credentials.accessToken);
    expect(JSON.parse(openBotSecret(saved?.[1][0], 7))).toEqual(credentials);
    expect(() => openBotSecret(saved?.[1][0], 8)).toThrow();
    const snapshot = await caller().snapshot({});
    expect(snapshot.connection?.whatsappProvider).toBe("meta");
    expect(snapshot.connection?.metaWebhookUrl).toContain(
      "/api/native-bot/meta/webhook/"
    );
    expect(JSON.stringify(snapshot)).not.toContain(credentials.accessToken);
    expect(JSON.stringify(snapshot)).not.toContain(credentials.appSecret);
  });
  it("não permite ao artista modificar as credenciais", async () => {
    await expect(
      caller("collaborator").saveMetaWhatsapp(credentials)
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(db.exec).not.toHaveBeenCalled();
  });
  it("recusa número ocupado na Central sem modificar a conexão", async () => {
    db.rows.mockImplementation(async (sql: string) => {
      if (sql.includes("FROM studios"))
        return [{ id: 7, name: "Estúdio teste" }];
      if (sql.includes("FROM tatuei_bot_settings WHERE studio_id="))
        return [settings];
      if (sql.includes("FROM whatsapp_integrations")) return [{ id: 123 }];
      return [];
    });
    await expect(caller().saveMetaWhatsapp(credentials)).rejects.toMatchObject({
      code: "CONFLICT",
    });
    expect(db.exec.mock.calls.some(c => c[0].includes("SET wa_secret="))).toBe(
      false
    );
  });
});
