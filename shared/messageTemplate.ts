const tokens = /\{\{\s*(\w+)\s*\}\}|\{\s*(\w+)\s*\}/g;
export function interpolateMessage(
  template: string,
  vars: Record<string, string | undefined>
) {
  const values = { ...vars };
  const name = values.nome_cliente?.trim() || values.primeiro_nome?.trim();
  if (name && !/[{}]/.test(name)) values.primeiro_nome = name.split(/\s+/)[0];
  return template.replace(
    tokens,
    (original, double, single) =>
      values[String(double || single).toLowerCase()] ?? original
  );
}
export function hasClientNamePlaceholder(message: string) {
  return /\{\{?\s*(?:primeiro_nome|nome_cliente)\s*\}\}?/i.test(message);
}
export function personalizeClientPlaceholders(
  message: string,
  fullName?: string | null
) {
  if (!hasClientNamePlaceholder(message)) return message;
  const name = fullName?.trim();
  if (!name || !new RegExp("\\p{L}", "u").test(name) || /[{}]/.test(name))
    throw new Error(
      "O cliente precisa ter um nome válido para personalizar a mensagem."
    );
  const result = interpolateMessage(message, {
    nome_cliente: name.split(/\s+/)[0],
  });
  if (hasClientNamePlaceholder(result))
    throw new Error(
      "Não foi possível preencher o nome do cliente na mensagem."
    );
  return result;
}
