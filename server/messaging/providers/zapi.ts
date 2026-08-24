import type { WhatsAppProvider, SendMessageResult, TestConnectionResult, ProviderConfig } from "../provider";

/**
 * Provedor Z-API
 * Docs: https://developer.z-api.io/
 * Endpoint base: https://api.z-api.io/instances/{instanceId}/token/{token}
 */
export class ZApiProvider implements WhatsAppProvider {
  private apiToken: string;
  private instanceId: string;
  private baseUrl: string;

  constructor(config: ProviderConfig) {
    this.apiToken = config.apiToken;
    this.instanceId = config.instanceId ?? "";
    this.baseUrl = `https://api.z-api.io/instances/${this.instanceId}/token/${this.apiToken}`;
  }

  async sendMessage(to: string, message: string): Promise<SendMessageResult> {
    try {
      const phone = to.replace(/[\s\-\+\(\)]/g, "");

      const res = await fetch(`${this.baseUrl}/send-text`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, message }),
      });

      if (!res.ok) {
        const body = await res.text();
        return { success: false, error: `HTTP ${res.status}: ${body}` };
      }

      const data = await res.json() as any;
      return {
        success: true,
        messageId: data?.zaapId ?? data?.messageId,
      };
    } catch (err: any) {
      return { success: false, error: err?.message ?? "Erro desconhecido" };
    }
  }

  async testConnection(): Promise<TestConnectionResult> {
    try {
      const res = await fetch(`${this.baseUrl}/status`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });

      if (!res.ok) {
        const body = await res.text();
        return { success: false, error: `HTTP ${res.status}: ${body}` };
      }

      const data = await res.json() as any;
      const connected = data?.connected === true || data?.status === "connected";
      if (connected) {
        return { success: true, details: `Z-API conectado. Número: ${data?.phone ?? "N/A"}` };
      }
      return { success: false, error: `Instância não conectada. Status: ${data?.status ?? "desconhecido"}` };
    } catch (err: any) {
      return { success: false, error: err?.message ?? "Falha ao conectar com Z-API" };
    }
  }
}
