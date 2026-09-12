import mysql, { type RowDataPacket } from "mysql2/promise";
import { TRPCError } from "@trpc/server";
import { normalizeBrazilianPhone } from "./phone";

/** Explicit permission belongs to a client, even when another client shares the phone. */
export async function saveWhatsappConsent(input: {
  studioId: number;
  integrationId: number;
  clientId: number;
  enabled: boolean;
  source: string;
}) {
  const c = await mysql.createConnection({
    uri: process.env.DATABASE_URL!,
    dateStrings: true,
  });
  try {
    const [clients] = await c.execute<RowDataPacket[]>(
      "SELECT id,phone FROM clients WHERE id=? AND studioId=?",
      [input.clientId, input.studioId]
    );
    const [integrations] = await c.execute<RowDataPacket[]>(
      "SELECT id FROM whatsapp_integrations WHERE id=? AND studio_id=?",
      [input.integrationId, input.studioId]
    );
    if (!clients[0] || !integrations[0])
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Cliente ou integração não encontrado neste estúdio.",
      });
    if (!clients[0].phone)
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "O cliente precisa ter telefone cadastrado.",
      });
    const phone = normalizeBrazilianPhone(clients[0].phone);
    // Old phone uniqueness made ON DUPLICATE KEY UPDATE silently change a different client's row.
    // Keep the unique (studio, client) key. This only changes an index; it grants no permissions.
    const [lock] = await c.query<RowDataPacket[]>(
      "SELECT GET_LOCK('tatuei-client-consent-index',10) AS acquired"
    );
    if (Number(lock[0]?.acquired) !== 1)
      throw new Error(
        "Não foi possível preparar a autorização. Tente novamente."
      );
    try {
      const [indexes] = await c.query<RowDataPacket[]>(
        "SHOW INDEX FROM integration_contacts WHERE Key_name='integration_contacts_studio_phone_unique'"
      );
      if (indexes.length) {
        const columns = indexes
          .sort((a, b) => Number(a.Seq_in_index) - Number(b.Seq_in_index))
          .map(row => row.Column_name);
        if (columns.join(",") !== "studio_id,normalized_phone")
          throw new Error("Índice de autorização diferente do esperado.");
        await c.query(
          "ALTER TABLE integration_contacts DROP INDEX integration_contacts_studio_phone_unique, ADD INDEX integration_contacts_studio_phone_lookup (studio_id,normalized_phone)"
        );
      }
    } finally {
      await c.query("SELECT RELEASE_LOCK('tatuei-client-consent-index')");
    }
    const timestamp = new Date().toISOString().slice(0, 19).replace("T", " ");
    await c.beginTransaction();
    await c.execute(
      "INSERT INTO integration_contacts(studio_id,integration_id,client_id,normalized_phone,has_whatsapp_opt_in,opt_in_at,opt_in_source,opted_out_at) VALUES(?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE integration_id=VALUES(integration_id),normalized_phone=VALUES(normalized_phone),has_whatsapp_opt_in=VALUES(has_whatsapp_opt_in),opt_in_at=VALUES(opt_in_at),opt_in_source=VALUES(opt_in_source),opted_out_at=VALUES(opted_out_at)",
      [
        input.studioId,
        input.integrationId,
        input.clientId,
        phone,
        input.enabled ? 1 : 0,
        input.enabled ? timestamp : null,
        input.enabled ? input.source : null,
        input.enabled ? null : timestamp,
      ]
    );
    const [saved] = await c.execute<RowDataPacket[]>(
      "SELECT client_id,normalized_phone,has_whatsapp_opt_in FROM integration_contacts WHERE studio_id=? AND integration_id=? AND client_id=?",
      [input.studioId, input.integrationId, input.clientId]
    );
    if (
      saved.length !== 1 ||
      saved[0].normalized_phone !== phone ||
      Number(saved[0].has_whatsapp_opt_in) !== (input.enabled ? 1 : 0)
    )
      throw new Error("A autorização não foi salva no cliente selecionado.");
    await c.commit();
    return { ok: true };
  } catch (error) {
    await c.rollback();
    throw error;
  } finally {
    await c.end();
  }
}
