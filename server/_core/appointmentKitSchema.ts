import mysql, { type Connection, type RowDataPacket } from "mysql2/promise";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

export async function upgradeAppointmentKits(connection: Connection) {
  const [lock] = await connection.query<RowDataPacket[]>(
    "SELECT GET_LOCK('tatuei_appointment_kits', 30) AS acquired"
  );
  if (Number(lock[0]?.acquired) !== 1)
    throw new Error("Appointment kit migration lock unavailable");
  try {
    // Imported databases may have skipped the historical template migration.
    const templates = await readFile(
      resolve(process.cwd(), "drizzle/0053_session_inventory_kits.sql"),
      "utf8"
    );
    for (const statement of templates
      .split(";")
      .map(s => s.trim())
      .filter(Boolean)) {
      if (!/^CREATE TABLE IF NOT EXISTS /i.test(statement))
        throw new Error("Unexpected kit schema statement");
      await connection.query(statement);
    }
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
    await connection.query(`CREATE TABLE IF NOT EXISTS inventory_material_registrations (
      id INT AUTO_INCREMENT PRIMARY KEY, studioId INT NOT NULL,
      registrationKey VARCHAR(36) NOT NULL, payloadHash VARCHAR(64) NOT NULL,
      tenantMaterialId INT NOT NULL, createdByUserId INT NOT NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY inventory_material_registration_unique(studioId,registrationKey)
    ) ENGINE=InnoDB`);
    // Verify the columns used by the failing live query, without reading client data.
    await connection.query(
      "SELECT id, studioId, name, description, isActive, createdByUserId, createdAt, updatedAt FROM inventory_kits LIMIT 0"
    );
    await connection.query(
      "SELECT id, studioId, kitId, tenantMaterialId, quantity FROM inventory_kit_items LIMIT 0"
    );
  } finally {
    await connection.query("SELECT RELEASE_LOCK('tatuei_appointment_kits')");
  }
}
export async function ensureAppointmentKitSchema() {
  if (!process.env.DATABASE_URL) return;
  const connection = await mysql.createConnection(process.env.DATABASE_URL);
  try {
    await upgradeAppointmentKits(connection);
    console.log(
      "[Inventory] Saved kits, client kits and material registrations verified."
    );
  } finally {
    await connection.end();
  }
}
