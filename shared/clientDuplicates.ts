export const mergeFields = {
  name: "Nome",
  phone: "Telefone",
  email: "E-mail",
  birthDate: "Nascimento",
  instagram: "Instagram",
  docNumber: "Documento",
  gender: "Gênero",
  cep: "CEP",
  street: "Rua",
  number: "Número",
  complement: "Complemento",
  reference: "Referência",
  neighborhood: "Bairro",
  city: "Cidade",
  state: "Estado",
  country: "País",
  artistId: "Artista responsável",
} as const;
export type MergeField = keyof typeof mergeFields;
export type DuplicateClient = {
  id: number;
  name: string;
  phone?: string | null;
  email?: string | null;
  docNumber?: string | null;
  docType?: string | null;
  birthDate?: string | null;
};
export function identityText(value?: string | null) {
  return (value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}
export function identityPhone(value?: string | null) {
  const digits = (value || "").replace(/\D/g, "");
  return digits.length === 10 || digits.length === 11 ? `55${digits}` : digits;
}
function documentKey(client: DuplicateClient) {
  const value = (client.docNumber || "")
    .replace(/[^a-z0-9]/gi, "")
    .toUpperCase();
  return value ? `${client.docType || "cpf"}:${value}` : "";
}
export function duplicateReasons(a: DuplicateClient, b: DuplicateClient) {
  const reasons: string[] = [],
    conflicts: string[] = [];
  const name = identityText(a.name);
  if (name.includes(" ") && name === identityText(b.name))
    reasons.push("Mesmo nome completo");
  if (
    identityPhone(a.phone).length >= 10 &&
    identityPhone(a.phone) === identityPhone(b.phone)
  )
    reasons.push("Mesmo telefone");
  if (a.email?.includes("@") && identityText(a.email) === identityText(b.email))
    reasons.push("Mesmo e-mail");
  if (documentKey(a) && documentKey(a) === documentKey(b))
    reasons.push("Mesmo documento");
  if (documentKey(a) && documentKey(b) && documentKey(a) !== documentKey(b))
    conflicts.push("Documentos diferentes");
  if (
    a.birthDate &&
    b.birthDate &&
    a.birthDate.slice(0, 10) !== b.birthDate.slice(0, 10)
  )
    conflicts.push("Nascimentos diferentes");
  if (a.phone && b.phone && identityPhone(a.phone) !== identityPhone(b.phone))
    conflicts.push("Telefones diferentes");
  return { reasons, conflicts };
}
// Suggestions are pairs, never transitive groups: a shared family phone is not proof of identity.
export function duplicatePairs(clients: DuplicateClient[]) {
  const buckets = new Map<string, DuplicateClient[]>(),
    pairs = new Map<
      string,
      { a: number; b: number; reasons: string[]; conflicts: string[] }
    >();
  for (const client of clients) {
    const keys = [
      identityText(client.name).includes(" ")
        ? `n:${identityText(client.name)}`
        : "",
      identityPhone(client.phone).length >= 10
        ? `p:${identityPhone(client.phone)}`
        : "",
      client.email?.includes("@") ? `e:${identityText(client.email)}` : "",
      documentKey(client) ? `d:${documentKey(client)}` : "",
    ].filter(Boolean);
    for (const key of keys) {
      for (const other of buckets.get(key) || []) {
        const a = Math.min(other.id, client.id),
          b = Math.max(other.id, client.id);
        pairs.set(`${a}:${b}`, { a, b, ...duplicateReasons(other, client) });
      }
      buckets.set(key, [...(buckets.get(key) || []), client]);
    }
  }
  return Array.from(pairs.values()).sort(
    (a, b) => b.reasons.length - a.reasons.length || a.a - b.a || a.b - b.b
  );
}

export function validCpf(value?: string | null) {
  if (value && /[^\d.\-\s]/.test(value)) return false;
  const digits = (value || "").replace(/\D/g, "");
  if (!/^\d{11}$/.test(digits) || /^(\d)\1{10}$/.test(digits)) return false;
  for (let length = 9; length <= 10; length++) {
    let sum = 0;
    for (let i = 0; i < length; i++)
      sum += Number(digits[i]) * (length + 1 - i);
    const digit = (sum * 10) % 11;
    if ((digit === 10 ? 0 : digit) !== Number(digits[length])) return false;
  }
  return true;
}
export function automaticMatch(a: DuplicateClient, b: DuplicateClient) {
  const { reasons, conflicts } = duplicateReasons(a, b);
  if (!reasons.includes("Mesmo nome completo") || conflicts.length)
    return false;
  if (a.email && b.email && identityText(a.email) !== identityText(b.email))
    return false;
  const cpf =
    (a.docType || "cpf") === "cpf" &&
    (b.docType || "cpf") === "cpf" &&
    validCpf(a.docNumber) &&
    reasons.includes("Mesmo documento");
  const corroborated =
    reasons.includes("Mesmo telefone") &&
    reasons.includes("Mesmo e-mail") &&
    !!a.birthDate &&
    !!b.birthDate &&
    a.birthDate.slice(0, 10) === b.birthDate.slice(0, 10);
  return cpf || corroborated;
}
export type AutomaticPair = { targetId: number; sourceId: number };
export function automaticPairs(
  clients: (DuplicateClient & Record<string, any>)[]
): AutomaticPair[] {
  const score = (c: Record<string, any>) =>
    Object.keys(mergeFields).filter(
      k => c[k] != null && String(c[k]).trim() !== ""
    ).length;
  const sorted = [...clients].sort(
    (a, b) => score(b) - score(a) || a.id - b.id
  );
  const groups: (typeof clients)[] = [];
  for (const client of sorted) {
    // Every member must agree with every other member, including missing-data bridges.
    const group = groups.find(g =>
      g.every(member => automaticMatch(member, client))
    );
    if (group) group.push(client);
    else groups.push([client]);
  }
  return groups.flatMap(group =>
    group
      .slice(1)
      .map(source => ({ targetId: group[0].id, sourceId: source.id }))
  );
}
