import type { WhatsAppProvider, SendMessageResult, TestConnectionResult, ProviderConfig } from "../provider";
import { normalizeBrazilianPhone } from "../phone";

/**
 * Provedor BotConversa
 * Docs: https://docs.botconversa.com.br/
 * Endpoint base: https://backend.botconversa.com.br/api/v1
 */
export class BotConversaProvider implements WhatsAppProvider {
  private apiToken: string;
  private baseUrl = "https://backend.botconversa.com.br/api/v1";
  private readonly timeoutMs = 10_000;

  constructor(config: ProviderConfig) {
    this.apiToken = config.apiToken.trim();
  }

  private async request(path: string, init: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      return await fetch(`${this.baseUrl}${path}`, {
        ...init,
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          "API-KEY": this.apiToken,
          ...(init.headers ?? {}),
        },
      });
    } finally {
      clearTimeout(timeout);
    }
  }

  private toSafeError(status: number): string {
    if (status === 401 || status === 403) return `BotConversa recusou a chave de API (HTTP ${status}). Confira o API Token da conta em Configurações > Integrações no BotConversa. O segredo do webhook é uma credencial separada.`;
    if (status === 429) return "O limite temporário do BotConversa foi atingido; a operação será tentada novamente.";
    if (status >= 500) return "O BotConversa está temporariamente indisponível.";
    return `A operação foi recusada pelo BotConversa (HTTP ${status}).`;
  }

  async sendMessage(to: string, message: string): Promise<SendMessageResult> {
    try {
      // A API do BotConversa recebe E.164 completo, incluindo o sinal de +.
      const normalizedDigits = normalizeBrazilianPhone(to).replace(/\D/g, "");
      const phone = `+${normalizedDigits}`;
      const lookupPhones = [phone, normalizedDigits];

      // A API oficial envia mensagens para um assinante já identificado, e não
      // diretamente para o telefone. Primeiro localizamos o assinante pelo
      // número e então usamos seu identificador no endpoint de envio.
      let subscriberResponse: Response | undefined;
      for (const lookupPhone of lookupPhones) {
        const response = await this.request(`/webhook/subscriber/get_by_phone/${encodeURIComponent(lookupPhone)}/`, {
          method: "GET",
        });
        subscriberResponse = response;
        if (response.ok || response.status !== 404) break;
      }
      if (!subscriberResponse) return { success: false, error: "Não foi possível consultar o assinante no BotConversa." };
      if (subscriberResponse.status === 404) {
        // O CRM só chega aqui depois de validar cliente e opt-in. O cadastro
        // evita exigir uma automação paralela no BotConversa para cada contato.
        let createResponse = await this.request("/webhook/subscriber/", {
          method: "POST",
          body: JSON.stringify({ phone, first_name: "Contato", last_name: "CRM", has_opt_in_whatsapp: true }),
        });
        // A Swagger permite busca com ou sem '+'. Algumas contas legadas
        // também aceitam o cadastro apenas no formato sem sinal; tentamos
        // esse formato somente quando o primeiro corpo foi recusado, nunca
        // depois de sucesso ou conflito de assinante existente.
        if (createResponse.status === 400) {
          createResponse = await this.request("/webhook/subscriber/", {
            method: "POST",
            body: JSON.stringify({ phone: normalizedDigits, first_name: "Contato", last_name: "CRM", has_opt_in_whatsapp: true }),
          });
        }
        // 401 pode ocorrer em uma corrida caso o assinante seja criado entre
        // a busca inicial e o POST; em ambos os casos, consultamos novamente.
        if (!createResponse.ok && createResponse.status !== 401) {
          return {
            success: false,
            error: `O BotConversa recusou o cadastro do assinante (${this.toSafeError(createResponse.status)}).`,
          };
        }
        for (const lookupPhone of lookupPhones) {
          const response = await this.request(`/webhook/subscriber/get_by_phone/${encodeURIComponent(lookupPhone)}/`, { method: "GET" });
          subscriberResponse = response;
          if (response.ok || response.status !== 404) break;
        }
      }
      if (!subscriberResponse.ok) {
        return {
          success: false,
          error: subscriberResponse.status === 404
            ? "O contato não está disponível como assinante no BotConversa."
            : `O BotConversa recusou a consulta do assinante (${this.toSafeError(subscriberResponse.status)}).`,
        };
      }
      const subscriber = await subscriberResponse.json() as { id?: string | number };
      if (!subscriber?.id) {
        return { success: false, error: "O BotConversa não retornou um assinante válido para o telefone informado." };
      }

      const res = await this.request(`/webhook/subscriber/${encodeURIComponent(String(subscriber.id))}/send_message/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ type: "text", value: message }),
      });

      if (!res.ok) {
        return {
          success: false,
          error: `O BotConversa recusou o envio ao assinante (${this.toSafeError(res.status)}).`,
        };
      }

      const data = await res.json() as any;
      return {
        success: true,
        messageId: data?.id?.toString() ?? data?.message_id?.toString(),
      };
    } catch (err: any) {
      const timedOut = err?.name === "AbortError";
      return { success: false, error: timedOut ? "Tempo limite excedido ao comunicar com o BotConversa." : "Falha ao comunicar com o BotConversa." };
    }
  }

  async testConnection(): Promise<TestConnectionResult> {
    try {
      // Consulta paginada sem efeito: a rota singular /subscriber/ só aceita POST.
      const res = await this.request(`/webhook/subscribers/`, {
        method: "GET",
      });

      if (res.ok) {
        return { success: true, details: "Conexão com BotConversa estabelecida com sucesso." };
      }
      return { success: false, error: this.toSafeError(res.status) };
    } catch (err: any) {
      const timedOut = err?.name === "AbortError";
      return { success: false, error: timedOut ? "Tempo limite excedido ao testar a conexão." : "Falha ao conectar com o BotConversa." };
    }
  }
}
