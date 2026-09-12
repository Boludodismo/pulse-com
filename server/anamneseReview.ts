type ClientSource = {
  name?: string | null;
  birthDate?: string | Date | null;
  docNumber?: string | null;
  email?: string | null;
  cep?: string | null;
  street?: string | null;
  number?: string | null;
  neighborhood?: string | null;
  complement?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  phone?: string | null;
  instagram?: string | null;
};

type LegacyAnamnesisSource = {
  hasAllergies?: number | boolean | null;
  allergiesDetails?: string | null;
  hasDiseases?: number | boolean | null;
  diseasesDetails?: string | null;
  usesMedication?: number | boolean | null;
  medicationDetails?: string | null;
  isPregnant?: number | boolean | null;
  hasKeloid?: number | boolean | null;
  acceptedTerms?: number | boolean | null;
  createdAt?: string | Date | null;
};

function yesNo(value: number | boolean | null | undefined) {
  return value ? "sim" : "nao";
}

/**
 * Converte apenas os dados compatíveis da ficha legada para a ficha pública.
 * Campos não existentes no modelo antigo seguem em branco para confirmação do cliente.
 */
export function buildLegacyAnamneseReviewPayload(client: ClientSource, record: LegacyAnamnesisSource) {
  const healthNotes = [
    record.hasAllergies ? `Alergias: ${record.allergiesDetails || "informadas anteriormente"}` : "",
    record.usesMedication ? `Medicamentos: ${record.medicationDetails || "informados anteriormente"}` : "",
  ].filter(Boolean).join("\n");

  return {
    client_name: client.name || "",
    client_dob: client.birthDate ? String(client.birthDate) : "",
    client_cpf_rg: client.docNumber || "",
    client_email: client.email || "",
    client_cep: client.cep || "",
    client_street: client.street || "",
    client_number: client.number || "",
    client_neighborhood: client.neighborhood || "",
    client_complement: client.complement || "",
    client_city: client.city || "",
    client_state: client.state || "",
    client_country: client.country || "Brasil",
    client_phone: client.phone || "",
    client_instagram: client.instagram || "",
    health_medical_treatment: yesNo(record.hasDiseases),
    health_medical_treatment_detail: record.diseasesDetails || "",
    health_pregnant: yesNo(record.isPregnant),
    health_keloid: yesNo(record.hasKeloid),
    health_additional_info: healthNotes,
    consent_terms: Boolean(record.acceptedTerms),
    consent_date: record.createdAt ? String(record.createdAt) : "",
  };
}
