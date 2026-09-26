import mysql, { type RowDataPacket } from "mysql2/promise";

/**
 * Additive, restart-safe schema for artist operational WhatsApp preferences.
 * Defaults keep every existing artist unchanged until the feature is explicitly enabled.
 */
export async function ensureArtistNotificationSchema() {
  if (!process.env.DATABASE_URL) return;
  const connection = await mysql.createConnection(process.env.DATABASE_URL);
  try {
    const [lock] = await connection.query<RowDataPacket[]>(
      "SELECT GET_LOCK('tatuei_artist_notification_settings', 30) AS acquired"
    );
    if (Number(lock[0]?.acquired) !== 1) throw new Error("Artist notification schema lock unavailable");
    try {
      await connection.query(`CREATE TABLE IF NOT EXISTS artist_notification_settings (
        id INT AUTO_INCREMENT PRIMARY KEY,
        studio_id INT NOT NULL,
        artist_id INT NOT NULL,
        whatsapp_operational_enabled TINYINT NOT NULL DEFAULT 0,
        manual_client_reminder_enabled TINYINT NOT NULL DEFAULT 0,
        notify_client_actions_enabled TINYINT NOT NULL DEFAULT 1,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY artist_notification_settings_studio_artist_unique (studio_id, artist_id),
        KEY artist_notification_settings_enabled_idx (studio_id, whatsapp_operational_enabled, manual_client_reminder_enabled)
      ) ENGINE=InnoDB`);
      console.log("[Artists] Operational WhatsApp preferences schema verified.");
    } finally {
      await connection.query("SELECT RELEASE_LOCK('tatuei_artist_notification_settings')");
    }
  } finally {
    await connection.end();
  }
}
