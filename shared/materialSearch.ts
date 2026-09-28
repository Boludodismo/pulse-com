export const MATERIAL_CATEGORIES = [
  "Luvas",
  "Tintas",
  "Diluente",
  "Batoques",
  "Vaselina",
  "Cartuchos",
  "Agulhas",
  "Barreiras e descartáveis",
  "Higienização",
  "Stencil e transferência",
  "Pós-tatuagem",
  "Máquinas e alimentação",
  "Acessórios",
  "Outros",
];
export const normalizeMaterialSearch = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/,/g, ".")
    .trim();
export function materialCategory(name: string, category?: string | null) {
  const n = normalizeMaterialSearch(name),
    c = normalizeMaterialSearch(category || "");
  if (/luva|glove/.test(n + " " + c)) return "Luvas";
  if (/batoque|ink cap/.test(n + " " + c)) return "Batoques";
  if (/vaselina|petroleum jelly/.test(n + " " + c)) return "Vaselina";
  if (/cartucho|cartridge/.test(n) || c === "cartuchos") return "Cartuchos";
  if (/agulha|needle/.test(n) || c === "agulhas") return "Agulhas";
  if (c === "cartuchos e agulhas") return "Cartuchos";
  if (/diluent|mixing|solucao de mistura/.test(n + " " + c)) return "Diluente";
  if (/tinta|pigmento|^ink$/.test(c)) return "Tintas";
  if (/higieni|limpeza|processamento/.test(c)) return "Higienização";
  if (/barreira|descartav|epi/.test(c)) return "Barreiras e descartáveis";
  if (/stencil|transfer/.test(c)) return "Stencil e transferência";
  if (/pos.tatuagem|aftercare/.test(c)) return "Pós-tatuagem";
  if (/maquina|alimenta/.test(c)) return "Máquinas e alimentação";
  if (/acessorio/.test(c)) return "Acessórios";
  return !c || c.startsWith("outro") ? "Outros" : category!.trim();
}
export function matchesMaterialSearch(value: string, query: string) {
  const normalized = normalizeMaterialSearch(value);
  return normalizeMaterialSearch(query)
    .split(/\s+/)
    .filter(Boolean)
    .every(word => normalized.includes(word));
}
export function materialUiError(
  error:
    { message: string; data?: { code?: string } | null } | null | undefined,
  fallback: string
) {
  if (!error) return "";
  return error.data?.code === "INTERNAL_SERVER_ERROR" ||
    /failed query|select [`*]|insert into|doesn't exist|sqlstate/i.test(
      error.message
    )
    ? fallback
    : error.message;
}
