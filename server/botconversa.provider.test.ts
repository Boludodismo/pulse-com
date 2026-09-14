import { afterEach, describe, expect, it, vi } from "vitest";
import { BotConversaProvider } from "./messaging/providers/botconversa";

describe("BotConversaProvider.testConnection", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("usa a consulta de assinantes sem efeito para validar a credencial", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ results: [] }), { status: 200 }));
    global.fetch = fetchMock as unknown as typeof fetch;
    const provider = new BotConversaProvider({ apiToken: "token-de-teste" });

    await expect(provider.testConnection()).resolves.toEqual({
      success: true,
      details: "Conexão com BotConversa estabelecida com sucesso.",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://backend.botconversa.com.br/api/v1/webhook/subscribers/",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({ "API-KEY": "token-de-teste" }),
      }),
    );
  });

  it("informa a etapa de envio recusada sem expor o telefone ou a resposta do provedor", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 42 }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ detail: "dado sensível" }), { status: 400 }));
    global.fetch = fetchMock as unknown as typeof fetch;
    const provider = new BotConversaProvider({ apiToken: "token-de-teste" });

    await expect(provider.sendMessage("31999999999", "Lembrete de teste")).resolves.toEqual({
      success: false,
      error: "O BotConversa recusou o envio ao assinante (A operação foi recusada pelo BotConversa (HTTP 400).).",
    });
  });

  it("consulta o formato sem sinal de adição antes de cadastrar um novo assinante", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 404 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 99 }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "message-99" }), { status: 200 }));
    global.fetch = fetchMock as unknown as typeof fetch;
    const provider = new BotConversaProvider({ apiToken: "token-de-teste" });

    await expect(provider.sendMessage("31999999999", "Lembrete de teste")).resolves.toEqual({
      success: true,
      messageId: "message-99",
    });

    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://backend.botconversa.com.br/api/v1/webhook/subscriber/get_by_phone/5531999999999/",
      expect.objectContaining({ method: "GET" }),
    );
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("tenta o cadastro sem sinal somente após a API recusar o formato com sinal", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 404 }))
      .mockResolvedValueOnce(new Response(null, { status: 404 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ error_message: "Invalid data" }), { status: 400 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({}), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 71 }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "message-71" }), { status: 200 }));
    global.fetch = fetchMock as unknown as typeof fetch;
    const provider = new BotConversaProvider({ apiToken: "token-de-teste" });

    await expect(provider.sendMessage("31999999999", "Lembrete de teste")).resolves.toEqual({
      success: true,
      messageId: "message-71",
    });

    expect(fetchMock).toHaveBeenNthCalledWith(
      4,
      "https://backend.botconversa.com.br/api/v1/webhook/subscriber/",
      expect.objectContaining({ body: JSON.stringify({ phone: "5531999999999", first_name: "Contato", last_name: "CRM", has_opt_in_whatsapp: true }) }),
    );
  });
});
