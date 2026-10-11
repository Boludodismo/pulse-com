import { personalizeClientPlaceholders } from '../../shared/messageTemplate';
/** Mantém a comunicação com o cliente pessoal e evita expor nomes completos desnecessariamente. */
export function firstName(fullName?: string | null) {
  return fullName?.trim().split(/\s+/)[0] || "cliente";
}

/** Remove instruções legadas de resposta numérica quando as ações são links públicos clicáveis. */
export function removeLegacyNumericReplyInstruction(message: string) {
  return message
    .split(/\r?\n/)
    .filter((line) => !/^\s*responda\s+\*?(?:1|2)\*?\b/i.test(line))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Atualiza uma saudação já persistida para o primeiro nome do cliente. */
export function useFirstNameInGreeting(message: string, fullName?: string | null) {
  const name = firstName(fullName);
  return message.replace(/^(Olá,?\s+)([^!\n]+)(!)/i, `$1${name}$3`);
}

export function formatStudioAddress(studio?: {
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zipCode?: string | null;
}) {
  if (!studio) return "";
  const locality = [studio.city, studio.state].filter(Boolean).join(" - ");
  return [studio.address, locality, studio.zipCode].filter(Boolean).join(", ");
}

/** Personaliza mensagens ao cliente, incluindo texto já materializado na fila.
 * Só substitui o nome completo conhecido; preserva links e nomes de terceiros.
 */
export function useClientFirstName(message: string, fullName?: string | null) {
  const personalized = personalizeClientPlaceholders(message, fullName);
  const parts = fullName?.trim().split(/\s+/);
  if (!parts || parts.length < 2 || /[{}]/.test(fullName!)) return personalized;
  const escaped = parts.map(part => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const pattern = new RegExp("(^|[^\\p{L}\\p{N}_])(" + escaped.join("\\s+") + ")(?=$|[^\\p{L}\\p{N}_])", "giu");
  return personalized.split(/(https?:\/\/\S+)/gi).map((part, index) =>
    index % 2 ? part : part.replace(pattern, (_match, prefix) => prefix + parts[0])
  ).join("");
}
