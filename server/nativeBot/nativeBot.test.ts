import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  defaultBotConfig,
  botConfigSchema,
  botClock,
  outsideBotHours,
  botVariables,
  containsBotPhrase,
} from "../../shared/nativeBot";
import { decideBot } from "./engine";
import { sealBotSecret, openBotSecret } from "./crypto";
import { assertBotScope, assertBotManager } from "./access";
import { nativeBotPhone } from "./service";
import { getBotQr, zapi, askBotAi, safeBotError } from "./providers";
import type { BotSettings } from "./access";
import { webhookKeyMatches } from "./webhook";

const db = vi.hoisted(() => ({ exec: vi.fn(), rows: vi.fn() }));
vi.mock("./database", () => ({
  ...db,
  botPool: () => ({}),
  assertBotSchema: () => {},
  botAudit: vi.fn(),
  jsonValue: (v: any, f: any) => v ?? f,
  utcSql: () => "",
  botTransaction: vi.fn(),
}));
const vars = botVariables({
  clientName: "Ana Maria",
  artistName: "Lia",
  studioName: "Estúdio teste",
});
beforeEach(() => {
  vi.stubEnv(
    "NATIVE_BOT_ENCRYPTION_KEY",
    Buffer.alloc(32, 7).toString("base64")
  );
  vi.stubEnv("OUTBOUND_MESSAGING_DISABLED", "false");
  vi.stubEnv("RAILWAY_ENVIRONMENT_ID", "unit-test");
  db.exec.mockResolvedValue({ affectedRows: 1 });
  db.rows.mockResolvedValue([]);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});
describe("decisões do atendimento", () => {
  it("usa os dados do responsável e preserva o primeiro nome", () => {
    const r = decideBot(defaultBotConfig(), "olá", vars, { outside: false });
    expect(r.text).toBe(
      "Olá, Ana! Sou a assistente de Lia, no Estúdio teste. Como posso ajudar?"
    );
  });
  it.each([
    "Quero falar com alguém",
    "Qual o preço?",
    "Quanto custa uma tattoo?",
    "Quero reagendar",
  ])("encaminha %s para pessoa, sem inventar resposta", text => {
    expect(
      decideBot(defaultBotConfig(), text, vars, { outside: false }).handoff
    ).toBe(true);
  });
  it("não responde durante atendimento humano", () => {
    expect(
      decideBot(defaultBotConfig(), "oi", vars, { human: true }).text
    ).toBeNull();
  });
  it("não cria resposta para pergunta desconhecida", () => {
    const r = decideBot(defaultBotConfig(), "Vocês fazem retratos?", vars, {
      outside: false,
    });
    expect(r.handoff).toBe(true);
    expect(r.useAi).toBeUndefined();
  });
  it("consulta IA apenas quando habilitada", () => {
    expect(
      decideBot(
        { ...defaultBotConfig(), aiEnabled: true },
        "Dúvida específica",
        vars,
        { outside: false }
      ).useAi
    ).toBe(true);
  });
  it("respeita regra desligada e atraso configurado", () => {
    const c = defaultBotConfig();
    c.rules[0].enabled = false;
    expect(decideBot(c, "oi", vars, { outside: false }).text).toBeNull();
    c.rules[0].enabled = true;
    c.rules[0].delayMinutes = 12;
    expect(decideBot(c, "oi", vars, { outside: false }).delayMinutes).toBe(12);
  });
  it("evita palavras parcialmente coincidentes", () => {
    expect(containsBotPhrase("Gostei do valoroso trabalho", "valor")).toBe(
      false
    );
  });
  it("não permite eventos duplicados nem horário invertido", () => {
    const c = defaultBotConfig();
    expect(botConfigSchema.safeParse({ ...c, closes: "09:00" }).success).toBe(
      false
    );
    expect(
      botConfigSchema.safeParse({ ...c, rules: [c.rules[0], c.rules[0]] })
        .success
    ).toBe(false);
  });
  it("aplica data e horário de Brasília, inclusive virada de dia", () => {
    expect(botClock(new Date("2026-09-24T02:30:00Z"))).toEqual({
      date: "2026-09-23",
      time: "23:30",
      day: 3,
    });
    expect(
      outsideBotHours(defaultBotConfig(), new Date("2026-09-23T22:00:00Z"))
    ).toBe(true);
    expect(
      outsideBotHours(defaultBotConfig(), new Date("2026-09-23T13:00:00Z"))
    ).toBe(false);
  });
  it("responde somente o FAQ cadastrado", () => {
    const c = defaultBotConfig();
    c.faqs = [
      {
        keywords: "estacionamento, carro",
        answer: "{primeiro_nome}, consulte a equipe sobre vagas.",
      },
    ];
    expect(
      decideBot(c, "Tem estacionamento?", vars, { outside: false }).text
    ).toBe("Ana, consulte a equipe sobre vagas.");
  });
});
describe("isolamento e credenciais", () => {
  it("impede artista de escolher outro artista ou o perfil geral", () => {
    const actor = { id: 1, role: "collaborator", studioId: 2, artistId: 3 };
    expect(assertBotScope(actor)).toBe(3);
    expect(() => assertBotScope(actor, 4)).toThrow();
    expect(() => assertBotScope(actor, 0)).toThrow();
    expect(() => assertBotManager(actor)).toThrow();
  });
  it("exige estúdio mesmo para gestor", () => {
    expect(() =>
      assertBotScope({ id: 1, role: "admin", studioId: null, artistId: null })
    ).toThrow();
  });
  it("não permite reutilizar a credencial criptografada em outro estúdio", () => {
    const sealed = sealBotSecret("secret-unit-test", 2);
    expect(sealed).not.toContain("secret-unit-test");
    expect(openBotSecret(sealed, 2)).toBe("secret-unit-test");
    expect(() => openBotSecret(sealed, 3)).toThrow();
    expect(() => openBotSecret(sealed.slice(0, -4) + "abcd", 2)).toThrow();
  });
  it("valida o segredo do webhook", () => {
    expect(webhookKeyMatches("test-token", "test-token")).toBe(true);
    expect(webhookKeyMatches("test-token", "other")).toBe(false);
    expect(webhookKeyMatches(null, "")).toBe(false);
  });
  it("normaliza números brasileiros e rejeita endereços de grupo", () => {
    expect(nativeBotPhone("(11) 99999-8888")).toBe("5511999998888");
    expect(nativeBotPhone("+55 11 99999-8888")).toBe("5511999998888");
    expect(() => nativeBotPhone("123@g.us")).toThrow();
  });
});
function settings(): BotSettings {
  return {
    studio_id: 2,
    enabled: 1,
    ai_secret: sealBotSecret("test-key-only", 2),
    ai_model: "gpt-4.1-mini",
    ai_daily_limit: 20,
    ai_day: null,
    ai_used: 0,
    wa_secret: sealBotSecret(
      JSON.stringify({
        instanceId: "instance-test",
        token: "token-test",
        clientToken: "client-token-test",
      }),
      2
    ),
    wa_instance: "instance-test",
    wa_status: "connected",
    wa_phone: null,
    webhook_key: null,
    webhook_ready: 1,
    last_error: null,
  };
}
describe("conectores externos sem chamadas reais", () => {
  it("exibe somente QR devolvido pelo provedor", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({ value: "data:image/png;base64,aGVsbG8=" }),
          { status: 200 }
        )
      );
    vi.stubGlobal("fetch", fetch);
    expect(await getBotQr(settings())).toEqual({
      image: "data:image/png;base64,aGVsbG8=",
    });
    expect(fetch.mock.calls[0][0]).toContain(
      "api.z-api.io/instances/instance-test/token/token-test/qr-code"
    );
    expect(fetch.mock.calls[0][1].headers["Client-Token"]).toBe(
      "client-token-test"
    );
  });
  it("recusa HTML ou QR inventado", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ value: "<svg>invalid</svg>" }))
        )
    );
    await expect(getBotQr(settings())).rejects.toThrow("QR válido");
  });
  it("não envia mensagens no ambiente de homologação", async () => {
    vi.stubEnv("OUTBOUND_MESSAGING_DISABLED", "true");
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    await expect(zapi(settings(), "send-text", "POST", {})).rejects.toThrow(
      "bloqueadas"
    );
    expect(fetch).not.toHaveBeenCalled();
  });
  it("falha de rede no envio tem resultado incerto e não expõe segredos", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("token-test")));
    await expect(
      zapi(settings(), "send-text", "POST", {})
    ).rejects.toMatchObject({ uncertain: true });
    expect(safeBotError(new Error("token-test"))).not.toContain("token-test");
  });
  it("não chama IA após atingir limite diário", async () => {
    db.exec.mockResolvedValue({ affectedRows: 0 });
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    await expect(
      askBotAi(settings(), defaultBotConfig(), [], "oi", vars)
    ).rejects.toThrow("Limite diário");
    expect(fetch).not.toHaveBeenCalled();
  });
  it("limita histórico e valida a resposta estruturada da IA", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    text: "Vou chamar a equipe.",
                    handoff: true,
                  }),
                },
              },
            ],
          })
        )
      );
    vi.stubGlobal("fetch", fetch);
    const reply = await askBotAi(
      settings(),
      defaultBotConfig(),
      Array.from({ length: 20 }, () => ({ role: "client", body: "oi" })),
      "pergunta",
      vars
    );
    expect(reply.handoff).toBe(true);
    const body = JSON.parse(fetch.mock.calls[0][1].body);
    expect(body.store).toBe(false);
    expect(body.messages).toHaveLength(10);
    expect(body.response_format.type).toBe("json_object");
  });
  it("recusa resposta de IA incompleta", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(
            JSON.stringify({
              choices: [{ message: { content: '{"text":"???"}' } }],
            })
          )
        )
    );
    await expect(
      askBotAi(settings(), defaultBotConfig(), [], "oi", vars)
    ).rejects.toThrow("resposta inválida");
  });
});
