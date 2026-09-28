import mysql, { type RowDataPacket } from "mysql2/promise";

const STAGING_ENVIRONMENT_ID = "92e8281a-668a-43ed-b2ba-cac84082a91c";
const PRODUCTION_ENVIRONMENT_ID = "9890a3b6-7cb6-4330-abfe-d7665bbcf900";
const QUOTES_SERVICE_ID = "7527417a-b872-42bf-b828-e0987b805196";

/**
 * Additive schema preparation for quotes in the controlled CRM service.
 * Runs only in the known staging/production environments after explicit release approval.
 * Existing CRM rows are preserved: tables/columns/indexes are created only when absent.
 */
export async function ensureStagingQuoteProposalSchema() {
  const environmentId = process.env.RAILWAY_ENVIRONMENT_ID;
  const allowedEnvironment =
    environmentId === STAGING_ENVIRONMENT_ID || environmentId === PRODUCTION_ENVIRONMENT_ID;
  const isStaging = environmentId === STAGING_ENVIRONMENT_ID;
  if (
    !allowedEnvironment
    || process.env.RAILWAY_SERVICE_ID !== QUOTES_SERVICE_ID
    || (isStaging && process.env.RUN_DB_MIGRATIONS !== "true")
  ) return;
  if (!process.env.DATABASE_URL) throw new Error("Database required for quote proposal schema.");

  const connection = await mysql.createConnection(process.env.DATABASE_URL);
  try {
    const [lock] = await connection.query<RowDataPacket[]>(
      "SELECT GET_LOCK('podcrm_quote_proposal_schema_v1',30) AS acquired",
    );
    if (Number(lock[0]?.acquired) !== 1) throw new Error("Quote proposal schema lock unavailable.");

    await connection.query(
      "CREATE TABLE IF NOT EXISTS quote_proposals (" +
      "id int NOT NULL AUTO_INCREMENT," +
      "studio_id int NOT NULL," +
      "client_id int NOT NULL," +
      "artist_id int NOT NULL," +
      "quote_number varchar(48) NOT NULL," +
      "version int NOT NULL DEFAULT 1," +
      "status varchar(24) NOT NULL DEFAULT 'draft'," +
      "created_date datetime NOT NULL," +
      "valid_until datetime NOT NULL," +
      "total_amount int NOT NULL DEFAULT 0," +
      "payload mediumtext NOT NULL," +
      "created_by_user_id int NOT NULL," +
      "finalized_at datetime NULL," +
      "created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP," +
      "updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP," +
      "PRIMARY KEY (id)," +
      "UNIQUE KEY quote_proposals_number_version_unique (studio_id, quote_number, version)," +
      "KEY quote_proposals_studio_updated_idx (studio_id, updated_at)," +
      "KEY quote_proposals_client_idx (studio_id, client_id, id)," +
      "KEY quote_proposals_artist_idx (studio_id, artist_id, id)" +
      ")"
    );

    await connection.query(
      "CREATE TABLE IF NOT EXISTS quote_presets (" +
      "id int NOT NULL AUTO_INCREMENT," +
      "studio_id int NOT NULL," +
      "artist_id int NULL," +
      "category varchar(32) NOT NULL," +
      "name varchar(120) NOT NULL," +
      "content text NOT NULL," +
      "is_active tinyint NOT NULL DEFAULT 1," +
      "created_by_user_id int NOT NULL," +
      "created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP," +
      "updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP," +
      "PRIMARY KEY (id)," +
      "KEY quote_presets_studio_category_idx (studio_id, category, is_active)," +
      "KEY quote_presets_artist_idx (studio_id, artist_id, category)" +
      ")"
    );

    await connection.query(
      "CREATE TABLE IF NOT EXISTS artist_quote_branding (" +
      "id int NOT NULL AUTO_INCREMENT," +
      "studio_id int NOT NULL," +
      "artist_id int NOT NULL," +
      "personal_logo_url varchar(3000) NULL," +
      "personal_logo_key varchar(500) NULL," +
      "default_logo_source varchar(16) NOT NULL DEFAULT 'studio'," +
      "watermark_opacity int NOT NULL DEFAULT 70," +
      "created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP," +
      "updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP," +
      "PRIMARY KEY (id)," +
      "UNIQUE KEY artist_quote_branding_artist_unique (studio_id, artist_id)" +
      ")"
    );

    const ensureQuoteColumn = async (name: string, definition: string) => {
      const [columns] = await connection.query<RowDataPacket[]>(
        "SHOW COLUMNS FROM quote_proposals LIKE ?",
        [name],
      );
      if (!columns.length) await connection.query("ALTER TABLE quote_proposals ADD COLUMN " + definition);
    };
    await ensureQuoteColumn("public_token", "public_token varchar(64) NULL AFTER payload");
    await ensureQuoteColumn("viewed_at", "viewed_at datetime NULL AFTER public_token");
    await ensureQuoteColumn("accepted_at", "accepted_at datetime NULL AFTER viewed_at");
    for (const [name, type] of [
      ["sent_at", "datetime"], ["sent_by_user_id", "int"],
      ["sent_source", "varchar(24)"],
      ["responded_at", "datetime"], ["response_source", "varchar(24)"],
      ["response_text", "text"], ["response_by_user_id", "int"],
      ["question_at", "datetime"], ["question_text", "text"],
    ]) await ensureQuoteColumn(name, `${name} ${type} NULL`);
    const [appointmentColumns] = await connection.query<RowDataPacket[]>("SHOW COLUMNS FROM appointments LIKE 'quote_id'");
    if (!appointmentColumns.length) await connection.query("ALTER TABLE appointments ADD COLUMN quote_id int NULL");
    const [appointmentIndexes] = await connection.query<RowDataPacket[]>("SHOW INDEX FROM appointments WHERE Key_name='appointments_quote_idx'");
    if (!appointmentIndexes.length) await connection.query("CREATE INDEX appointments_quote_idx ON appointments (studioId, quote_id, clientId, artistId, status)");
    // Preserve prior acceptances; never infer sending from creation, sharing or viewing.
    await connection.query("INSERT IGNORE INTO care_tags (studio_id,client_id,label) SELECT DISTINCT studio_id,client_id,'orçamento respondido' FROM quote_proposals WHERE accepted_at IS NOT NULL OR responded_at IS NOT NULL");
    await connection.query("INSERT IGNORE INTO care_tags (studio_id,client_id,label) SELECT DISTINCT studio_id,client_id,'orçamento enviado' FROM quote_proposals WHERE sent_at IS NOT NULL");

    // Widen only the existing quote payload; no data is rewritten or removed.
    const [payloadColumns] = await connection.query<RowDataPacket[]>(
      "SHOW COLUMNS FROM quote_proposals LIKE 'payload'",
    );
    if (String(payloadColumns[0]?.Type).toLowerCase() === "text") {
      await connection.query("ALTER TABLE quote_proposals MODIFY COLUMN payload MEDIUMTEXT NOT NULL");
    }

    const [tokenIndexes] = await connection.query<RowDataPacket[]>(
      "SHOW INDEX FROM quote_proposals WHERE Key_name='quote_proposals_public_token_unique'",
    );
    if (!tokenIndexes.length) {
      await connection.query(
        "ALTER TABLE quote_proposals ADD UNIQUE KEY quote_proposals_public_token_unique (public_token)",
      );
    }

    const [moduleColumn] = await connection.query<RowDataPacket[]>(
      "SHOW COLUMNS FROM user_module_permissions LIKE 'module'",
    );
    const moduleType = String(moduleColumn[0]?.Type || "");
    if (moduleType.startsWith("enum(") && !moduleType.includes("'quotes'")) {
      const values = Array.from(moduleType.matchAll(/'((?:[^']|'')*)'/g)).map((match) =>
        match[1].replace(/''/g, "'"),
      );
      if (!values.length) throw new Error("Could not inspect user_module_permissions.module enum.");
      const escaped = [...values, "quotes"]
        .map((value) => "'" + value.replace(/'/g, "''") + "'")
        .join(",");
      await connection.query(
        "ALTER TABLE user_module_permissions MODIFY COLUMN module ENUM(" + escaped + ") NOT NULL",
      );
    }

    console.log("[Quotes] Proposal schema ready; existing CRM data preserved.");
  } finally {
    await connection.query("SELECT RELEASE_LOCK('podcrm_quote_proposal_schema_v1')").catch(() => {});
    await connection.end();
  }
}
