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
