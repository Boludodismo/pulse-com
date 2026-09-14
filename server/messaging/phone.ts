import { parsePhoneNumberFromString } from "libphonenumber-js";

/** Normaliza telefones brasileiros para E.164, sem heurísticas de DDD. */
export function normalizeBrazilianPhone(value: string): string {
  const phone = parsePhoneNumberFromString(value, "BR");
  if (!phone?.isValid() || phone.country !== "BR") {
    throw new Error("Informe um telefone brasileiro válido com DDD.");
  }
  return phone.number;
}
