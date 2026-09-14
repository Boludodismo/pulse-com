import mysql, { type Connection, type RowDataPacket } from "mysql2/promise";

export async function upgradeAppointmentKits(connection: Connection) {
  const [lock] = await connection.query<RowDataPacket[]>(
    "SELECT GET_LOCK('tatuei_appointment_kits', 30) AS acquired"
  );
  if (Number(lock[0]?.acquired) !== 1)
    throw new Error("Appointment kit migration lock unavailable");
  try {
    await connection.query(`CREATE TABLE IF NOT EXISTS appointment_material_kits (
      id INT AUTO_INCREMENT PRIMARY KEY, studioId INT NOT NULL, appointmentId INT NOT NULL,
      name VARCHAR(160) NOT NULL, createdByUserId INT NOT NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY appointment_material_kit_unique(studioId,appointmentId)
    ) ENGINE=InnoDB`);
    await connection.query(`CREATE TABLE IF NOT EXISTS appointment_kit_operations (
      id INT AUTO_INCREMENT PRIMARY KEY, studioId INT NOT NULL, appointmentId INT NOT NULL,
      operationKey VARCHAR(36) NOT NULL, payloadHash VARCHAR(64) NOT NULL,
      kind VARCHAR(32) NOT NULL, createdByUserId INT NOT NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY appointment_kit_operation_unique(studioId,operationKey)
    ) ENGINE=InnoDB`);
  } finally {
    await connection.query("SELECT RELEASE_LOCK('tatuei_appointment_kits')");
  }
}
export async function ensureAppointmentKitSchema() {
  if (!process.env.DATABASE_URL) return;
  const connection = await mysql.createConnection(process.env.DATABASE_URL);
  try {
    await upgradeAppointmentKits(connection);
  } finally {
    await connection.end();
  }
}
