import type { WhatsAppProvider, SendMessageResult, TestConnectionResult, ProviderConfig } from "../provider";

/**
 * Provedor WhatsApp Business API (Meta oficial)
 * Docs: https://developers.facebook.com/docs/whatsapp/cloud-api
 * Requer: Phone Number ID (instanceId) + Access Token (apiToken)
 */
export class MetaProvider implements WhatsAppProvider {
  private accessToken: string;
  private phoneNumberId: string;
  private baseUrl = "https://graph.facebook.com/v19.0";

  constructor(config: ProviderConfig) {
    this.accessToken = config.apiToken;
    this.phoneNumberId = config.instanceId ?? "";
  }

  async sendMessage(to: string, message: string): Promise<SendMessageResult> {
    try {
      // Meta exige número com código do país, sem +
      const phone = to.replace(/[\s\-\+\(\)]/g, "");

      const res = await fetch(
        `${this.baseUrl}/${this.phoneNumberId}/messages`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.accessToken}`,
          },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            to: phone,
            type: "text",
            text: { body: message },
          }),
        }
      );

      if (!res.ok) {
        const body = await res.text();
        return { success: false, error: `HTTP ${res.status}: ${body}` };
      }

      const data = await res.json() as any;
      return {
        success: true,
        messageId: data?.messages?.[0]?.id,
      };
    } catch (err: any) {
      return { success: false, error: err?.message ?? "Erro desconhecido" };
    }
  }

  async testConnection(): Promise<TestConnectionResult> {
    try {
      const res = await fetch(
        `${this.baseUrl}/${this.phoneNumberId}?fields=display_phone_number,verified_name`,
        {
          headers: { Authorization: `Bearer ${this.accessToken}` },
        }
      );

      if (!res.ok) {
        const body = await res.text();
        return { success: false, error: `HTTP ${res.status}: ${body}` };
      }

      const data = await res.json() as any;
      return {
        success: true,
        details: `Meta API conectada. Número: ${data?.display_phone_number ?? "N/A"} (${data?.verified_name ?? ""})`,
      };
    } catch (err: any) {
      return { success: false, error: err?.message ?? "Falha ao conectar com Meta API" };
    }
  }
}
