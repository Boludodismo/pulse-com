import { and, eq } from "drizzle-orm";
import { clients, whatsappIntegrations } from "../drizzle/schema";
import { getDb } from "../server/db";
import { getIntegrationApiToken } from "../server/messaging/service";
import { normalizeBrazilianPhone } from "../server/messaging/phone";

async function main() {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível.");

  const integration = (await db.select().from(whatsappIntegrations).where(and(
    eq(whatsappIntegrations.id, 180001),
    eq(whatsappIntegrations.studioId, 1),
  )).limit(1))[0];
  const client = (await db.select({ phone: clients.phone }).from(clients).where(and(
    eq(clients.id, 2250001),
    eq(clients.studioId, 1),
  )).limit(1))[0];
  if (!integration || !client?.phone) throw new Error("Integração ou cliente diagnóstico não encontrado no estúdio correto.");

  const phone = normalizeBrazilianPhone(client.phone);
  const headers = { "API-KEY": await getIntegrationApiToken(integration) };
  const withPlus = await fetch(
    `https://backend.botconversa.com.br/api/v1/webhook/subscriber/get_by_phone/${encodeURIComponent(phone)}/`,
    { headers },
  );
  const withoutPlus = withPlus.status === 404
    ? await fetch(`https://backend.botconversa.com.br/api/v1/webhook/subscriber/get_by_phone/${encodeURIComponent(phone.slice(1))}/`, { headers })
    : undefined;
  const nationalPhone = phone.startsWith("+55") ? phone.slice(3) : phone;
  const national = withPlus.status === 404 && withoutPlus?.status === 404
    ? await fetch(`https://backend.botconversa.com.br/api/v1/webhook/subscriber/get_by_phone/${encodeURIComponent(nationalPhone)}/`, { headers })
    : undefined;

  console.log(JSON.stringify({
    stage: "subscriber_lookup",
    withPlusStatus: withPlus.status,
    withoutPlusStatus: withoutPlus?.status ?? null,
    nationalStatus: national?.status ?? null,
    found: withPlus.ok || Boolean(withoutPlus?.ok) || Boolean(national?.ok),
  }));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
