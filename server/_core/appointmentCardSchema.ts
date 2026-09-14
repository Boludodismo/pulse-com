import mysql, { type RowDataPacket } from "mysql2/promise";

/** Targeted, restart-safe compatibility repair for the deployed appointment feature. */
export async function ensureAppointmentCardSchema() {
  if (process.env.RAILWAY_ENVIRONMENT_ID !== "9890a3b6-7cb6-4330-abfe-d7665bbcf900" ||
      process.env.RAILWAY_SERVICE_ID !== "7527417a-b872-42bf-b828-e0987b805196") return;
  const connection = await mysql.createConnection(process.env.DATABASE_URL!);
  try {
    const [lock] = await connection.query<RowDataPacket[]>("SELECT GET_LOCK('tatuei_appointment_card_schema',30) AS acquired");
    if (Number(lock[0]?.acquired) !== 1) throw new Error("Appointment schema lock unavailable");
    const [columns] = await connection.query<RowDataPacket[]>("SHOW COLUMNS FROM appointments LIKE 'includeArtistCard'");
    if (!columns.length) {
      // The first default preserves the old behavior for existing rows without an UPDATE.
      await connection.query("ALTER TABLE appointments ADD COLUMN includeArtistCard tinyint NOT NULL DEFAULT 1 AFTER artistId");
      console.log("[Appointments] Added missing includeArtistCard column; existing appointments preserved.");
    }
    await connection.query("ALTER TABLE appointments ALTER COLUMN includeArtistCard SET DEFAULT 0");
    console.log("[Appointments] Card schema verified.");
  } finally {
    await connection.query("SELECT RELEASE_LOCK('tatuei_appointment_card_schema')");
    await connection.end();
  }
}
