export const personalFields = {
  name: ["client_name", 255], email: ["client_email", 320],
  phone: ["client_phone", 20], instagram: ["client_instagram", 100],
  docNumber: ["client_cpf_rg", 50], cep: ["client_cep", 10],
  street: ["client_street", 255], number: ["client_number", 20],
  complement: ["client_complement", 100], neighborhood: ["client_neighborhood", 100],
  city: ["client_city", 100], state: ["client_state", 50], country: ["client_country", 50],
} as const;

export function clientBirthDate(value: string): string {
  const raw = value.trim();
  const br = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(raw);
  const iso = br ? `${br[3]}-${br[2]}-${br[1]}` : raw.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) throw new Error("Data de nascimento inválida");
  const date = new Date(iso + "T12:00:00Z");
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== iso ||
      iso > new Date().toISOString().slice(0, 10)) throw new Error("Data de nascimento inválida");
  return iso + " 12:00:00";
}

export function clientPatchFromAnamnese(payload: Record<string, unknown>) {
  const patch: Partial<Record<keyof typeof personalFields | "birthDate", string>> = {};
  for (const [field, [key, limit]] of Object.entries(personalFields)) {
    const raw = payload[key];
    if (raw === undefined || raw === null || raw === "") continue;
    if (typeof raw !== "string") throw new Error("Dados pessoais inválidos");
    const value = raw.trim();
    if (!value) continue;
    if (value.length > limit) throw new Error("Um dos dados pessoais ultrapassa o tamanho permitido");
    if (field === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) throw new Error("E-mail inválido");
    patch[field as keyof typeof personalFields] = value;
  }
  const dob = payload.client_dob;
  if (typeof dob === "string" && dob.trim()) patch.birthDate = clientBirthDate(dob);
  else if (dob != null && typeof dob !== "string") throw new Error("Data de nascimento inválida");
  return patch;
}

export function clientPersonalPrefill(client: Record<string, unknown>) {
  const payload: Record<string, string> = {};
  for (const [field, [key]] of Object.entries(personalFields)) {
    if (typeof client[field] === "string" && client[field]) payload[key] = client[field] as string;
  }
  if (typeof client.birthDate === "string" && client.birthDate) {
    const iso = client.birthDate.slice(0, 10);
    payload.client_dob = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso.split("-").reverse().join("/") : client.birthDate;
  }
  return payload;
}
