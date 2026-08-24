/**
 * Interface comum para todos os provedores de WhatsApp.
 * Para adicionar um novo provedor, implemente esta interface
 * e registre-o em getProvider().
 */

export interface SendMessageResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface TestConnectionResult {
  success: boolean;
  error?: string;
  details?: string;
}

export interface WhatsAppProvider {
  sendMessage(to: string, message: string): Promise<SendMessageResult>;
  testConnection(): Promise<TestConnectionResult>;
}

export interface ProviderConfig {
  provider: 'botconversa' | 'zapi' | 'meta';
  apiToken: string;
  phoneNumber: string;
  instanceId?: string; // Z-API
}

/**
 * Substitui variáveis de template na mensagem.
 * Variáveis suportadas: {nome_cliente}, {nome_tatuador}, {nome_estudio},
 * {data}, {hora}, {servico}, {endereco}, {valor_sinal}, {status_sinal}
 */
export function interpolateTemplate(
  template: string,
  vars: Record<string, string | undefined>
): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? `{${key}}`);
}
