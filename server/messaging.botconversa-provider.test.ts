import { afterEach, describe, expect, it, vi } from "vitest";
import { BotConversaProvider } from "./messaging/providers/botconversa";

const provider = () => new BotConversaProvider({
  provider: "botconversa",
  apiToken: "token-de-teste",
  phoneNumber: "5511999999999",
});

afterEach(() => vi.unstubAllGlobals());

describe("BotConversaProvider.sendMessage", () => {
  it("localiza o assinante e usa o endpoint oficial de mensagem individual", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 42 }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "provider-message-1" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await provider().sendMessage("+55 (11) 99999-9999", "Mensagem de teste");

    expect(result).toEqual({ success: true, messageId: "provider-message-1" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://backend.botconversa.com.br/api/v1/webhook/subscriber/get_by_phone/%2B5511999999999/");
    expect(fetchMock.mock.calls[1]?.[0]).toBe("https://backend.botconversa.com.br/api/v1/webhook/subscriber/42/send_message/");
    expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({
      method: "POST",
      body: JSON.stringify({ type: "text", value: "Mensagem de teste" }),
    });
  });

  it("cria o assinante com opt-in e então envia quando a busca inicial não o encontra", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response("", { status: 404 }))
      .mockResolvedValueOnce(new Response("{}", { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 43 }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "provider-message-2" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await provider().sendMessage("5511999999999", "Mensagem de teste");

    expect(result).toEqual({ success: true, messageId: "provider-message-2" });
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(fetchMock.mock.calls[1]?.[0]).toBe("https://backend.botconversa.com.br/api/v1/webhook/subscriber/");
    expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({
      method: "POST",
      body: JSON.stringify({ phone: "+5511999999999", first_name: "Contato CRM", has_opt_in_whatsapp: true }),
    });
  });

  it("normaliza um telefone brasileiro local antes de buscar o assinante", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 44 }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "provider-message-3" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await provider().sendMessage("31 99653-1316", "Mensagem de teste");

    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://backend.botconversa.com.br/api/v1/webhook/subscriber/get_by_phone/%2B5531996531316/");
  });
});
