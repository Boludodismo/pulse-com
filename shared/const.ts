export const COOKIE_NAME = "app_session_id";
export const ONE_YEAR_MS = 1000 * 60 * 60 * 24 * 365;
export const AXIOS_TIMEOUT_MS = 30_000;
export const UNAUTHED_ERR_MSG = 'Please login (10001)';
export const NOT_ADMIN_ERR_MSG = 'You do not have required permission (10002)';

/**
 * Normaliza um número de telefone brasileiro para o formato esperado pelo wa.me.
 * Regras:
 *  - Remove tudo que não é dígito
 *  - Se começar com "55" e tiver 12 ou 13 dígitos → já está correto (ex: 5511987654321)
 *  - Se começar com "55" e tiver menos de 12 dígitos → remove o "55" e reprocessa
 *  - Se tiver 10 dígitos (DDD + 8 dígitos fixo) → adiciona "9" no celular e "55" na frente
 *  - Se tiver 11 dígitos (DDD + 9 dígitos celular) → adiciona "55" na frente
 *  - Qualquer outro caso → adiciona "55" na frente sem modificar
 *
 * Exemplos:
 *  "(11) 98765-4321"  → "5511987654321"
 *  "11987654321"      → "5511987654321"
 *  "5511987654321"    → "5511987654321"
 *  "+55 11 98765-4321"→ "5511987654321"
 *  "11 8765-4321"     → "55119876 54321" (fixo, mantém como está)
 */
export function normalizeWhatsAppNumber(phone: string): string {
  // Remove tudo que não é dígito
  let digits = phone.replace(/\D/g, "");

  // Remove o "55" inicial se o resultado ficar com menos de 10 dígitos
  // (ex: "55" + "987654321" = 11 dígitos → ok; "55" + "98765" = 7 dígitos → remove)
  if (digits.startsWith("55") && digits.length >= 12 && digits.length <= 13) {
    // Já está no formato correto: 55 + DDD(2) + número(8 ou 9)
    return digits;
  }

  if (digits.startsWith("55") && digits.length < 12) {
    // Remove o "55" espúrio e reprocessa
    digits = digits.slice(2);
  }

  // Agora digits deve ter 10 ou 11 dígitos (DDD + número)
  if (digits.length === 10) {
    // DDD(2) + 8 dígitos → pode ser celular sem o "9" ou fixo
    // Para celular: insere "9" após o DDD
    const ddd = digits.slice(0, 2);
    const num = digits.slice(2);
    // Se o número começa com 6, 7, 8 ou 9 → é celular, adiciona o "9"
    if (["6", "7", "8", "9"].includes(num[0])) {
      return `55${ddd}9${num}`;
    }
    // Fixo: mantém como está
    return `55${digits}`;
  }

  if (digits.length === 11) {
    // DDD(2) + 9 dígitos → formato correto de celular
    return `55${digits}`;
  }

  // Fallback: apenas adiciona "55" na frente
  return `55${digits}`;
}

/** Monta o link wa.me com número normalizado e mensagem codificada */
export function buildWhatsAppLink(phone: string, message: string): string {
  const normalized = normalizeWhatsAppNumber(phone);
  return `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`;
}
