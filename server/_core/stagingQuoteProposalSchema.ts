import mysql, { type RowDataPacket } from "mysql2/promise";

const STAGING_ENVIRONMENT_ID = "92e8281a-668a-43ed-b2ba-cac84082a91c";
const STAGING_SERVICE_ID = "7527417a-b872-42bf-b828-e0987b805196";

/**
 * Additive schema preparation for the isolated quotes staging preview.
 * Production is intentionally excluded until the feature is approved.
 */
export async function ensureStagingQuoteProposalSchema() {
  if (
    process.env.RAILWAY_ENVIRONMENT_ID !== STAGING_ENVIRONMENT_ID
    || process.env.RAILWAY_SERVICE_ID !== STAGING_SERVICE_ID
    || process.env.RUN_DB_MIGRATIONS !== "true"
  ) return;
  if (!process.env.DATABASE_URL) throw new Error("Database required for quote staging schema.");

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
      "payload text NOT NULL," +
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

    console.log("[Quotes] Staging proposal schema ready; existing CRM data preserved.");
  } finally {
    await connection.query("SELECT RELEASE_LOCK('podcrm_quote_proposal_schema_v1')").catch(() => {});
    await connection.end();
  }
}
