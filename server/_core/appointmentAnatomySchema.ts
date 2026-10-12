import mysql, { type RowDataPacket } from "mysql2/promise";

/** Add only optional anatomy fields; never infer values or update existing rows. */
export async function ensureAppointmentAnatomySchema() {
  if (process.env.RAILWAY_ENVIRONMENT_ID !== "9890a3b6-7cb6-4330-abfe-d7665bbcf900" ||
      process.env.RAILWAY_SERVICE_ID !== "7527417a-b872-42bf-b828-e0987b805196") return;
  const connection = await mysql.createConnection(process.env.DATABASE_URL!);
  let locked = false;
  try {
    const [lock] = await connection.query<RowDataPacket[]>("SELECT GET_LOCK('tatuei_appointment_anatomy_schema',30) AS acquired");
    locked = Number(lock[0]?.acquired) === 1;
    if (!locked) throw new Error("Appointment anatomy schema lock unavailable");
    for (const [column, definition] of [
      ["bodyRegion", "varchar(100) NULL DEFAULT NULL"],
      ["bodySide", "enum('direito','esquerdo','ambos') NULL DEFAULT NULL"],
    ]) {
      const [columns] = await connection.query<RowDataPacket[]>("SHOW COLUMNS FROM appointments LIKE ?", [column]);
      if (!columns.length) await connection.query(`ALTER TABLE appointments ADD COLUMN ${column} ${definition}`);
    }
    console.log("[Appointments] Optional anatomy columns verified.");
  } finally {
    try {
      if (locked) await connection.query("SELECT RELEASE_LOCK('tatuei_appointment_anatomy_schema')");
    } finally { await connection.end(); }
  }
}
