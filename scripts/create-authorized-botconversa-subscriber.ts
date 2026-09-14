import { and, eq } from "drizzle-orm";
import { clients, whatsappIntegrations } from "../drizzle/schema";
import { getDb } from "../server/db";
import { getIntegrationApiToken } from "../server/messaging/service";
import { normalizeBrazilianPhone } from "../server/messaging/phone";

function classifyProviderError(payload: unknown) {
  const message = typeof payload === "object" && payload && "error_message" in payload
    ? String((payload as { error_message?: unknown }).error_message ?? "")
    : "";
  if (/phone|telefone|ddd|number/i.test(message)) return "invalid_phone";
  if (/opt.?in|consent/i.test(message)) return "missing_consent";
  if (/exist|already/i.test(message)) return "already_exists";
  if (/required|obrigat/i.test(message)) return "missing_required_field";
  return "invalid_data";
}

function getValidationFields(payload: unknown) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return [];
  return Object.keys(payload)
    .filter((key) => ["phone", "first_name", "last_name", "has_opt_in_whatsapp", "error_message", "detail"].includes(key))
    .sort();
}

async function postSubscriber(phone: string, apiToken: string) {
  const response = await fetch("https://backend.botconversa.com.br/api/v1/webhook/subscriber/", {
    method: "POST",
    headers: { "Content-Type": "application/json", "API-KEY": apiToken },
    body: JSON.stringify({ phone, first_name: "Contato", last_name: "CRM", has_opt_in_whatsapp: true }),
  });
  const payload = await response.json().catch(() => null);
  return {
    status: response.status,
    ok: response.ok,
    category: response.ok ? null : classifyProviderError(payload),
    validationFields: response.ok ? [] : getValidationFields(payload),
  };
}

async function main() {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível.");
  const [integration] = await db.select().from(whatsappIntegrations).where(and(
    eq(whatsappIntegrations.id, 180001), eq(whatsappIntegrations.studioId, 1),
  )).limit(1);
  const [client] = await db.select({ phone: clients.phone }).from(clients).where(and(
    eq(clients.id, 2250001), eq(clients.studioId, 1),
  )).limit(1);
  if (!integration || !client?.phone) throw new Error("Escopo autorizado não encontrado.");

  const plusPhone = normalizeBrazilianPhone(client.phone);
  const apiToken = await getIntegrationApiToken(integration);
  const withPlus = await postSubscriber(plusPhone, apiToken);
  const withoutPlus = withPlus.status === 400
    ? await postSubscriber(plusPhone.slice(1), apiToken)
    : null;

  console.log(JSON.stringify({
    authorizedReminderId: 1020001,
    withPlus,
    withoutPlus,
    created: withPlus.ok || Boolean(withoutPlus?.ok),
  }));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
