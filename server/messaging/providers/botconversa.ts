import type { WhatsAppProvider, SendMessageResult, TestConnectionResult, ProviderConfig } from "../provider";

/**
 * Provedor BotConversa
 * Docs: https://docs.botconversa.com.br/
 * Endpoint base: https://backend.botconversa.com.br/api/v1
 */
export class BotConversaProvider implements WhatsAppProvider {
  private apiToken: string;
  private baseUrl = "https://backend.botconversa.com.br/api/v1";

  constructor(config: ProviderConfig) {
    this.apiToken = config.apiToken;
  }

  async sendMessage(to: string, message: string): Promise<SendMessageResult> {
    try {
      // Normaliza número: remove +, espaços, traços
      const phone = to.replace(/[\s\-\+\(\)]/g, "");

      const res = await fetch(`${this.baseUrl}/webhook/send-text/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "api-token": this.apiToken,
        },
        body: JSON.stringify({ phone, message }),
      });

      if (!res.ok) {
        const body = await res.text();
        return { success: false, error: `HTTP ${res.status}: ${body}` };
      }

      const data = await res.json() as any;
      return {
        success: true,
        messageId: data?.id?.toString() ?? data?.message_id?.toString(),
      };
    } catch (err: any) {
      return { success: false, error: err?.message ?? "Erro desconhecido" };
    }
  }

  async testConnection(): Promise<TestConnectionResult> {
    try {
      const res = await fetch(`${this.baseUrl}/webhook/subscriber/`, {
        method: "GET",
        headers: { "api-token": this.apiToken },
      });

      if (res.ok) {
        return { success: true, details: "Conexão com BotConversa estabelecida com sucesso." };
      }
      const body = await res.text();
      return { success: false, error: `HTTP ${res.status}: ${body}` };
    } catch (err: any) {
      return { success: false, error: err?.message ?? "Falha ao conectar com BotConversa" };
    }
  }
}
