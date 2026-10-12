import assert from "node:assert/strict";
import mysql, { type RowDataPacket } from "mysql2/promise";
import { ensureAppointmentAnatomySchema } from "../server/_core/appointmentAnatomySchema";

// This test may only touch the disposable database provisioned by CI.
const url = new URL(process.env.DATABASE_URL || "");
assert.equal(process.env.CI, "true", "Run only in the disposable CI database");
assert.equal(url.hostname, "127.0.0.1");
assert.equal(url.pathname, "/agenda_validation");
process.env.RAILWAY_ENVIRONMENT_ID = "9890a3b6-7cb6-4330-abfe-d7665bbcf900";
process.env.RAILWAY_SERVICE_ID = "7527417a-b872-42bf-b828-e0987b805196";

const connection = await mysql.createConnection(process.env.DATABASE_URL!);
try {
  await connection.query(`CREATE TABLE appointments (
    id int PRIMARY KEY, date datetime NOT NULL, duration int NOT NULL,
    service varchar(255) NOT NULL, notes text NULL
  )`);
  await connection.execute(
    "INSERT INTO appointments VALUES (?, ?, ?, ?, ?)",
    [1, "2026-10-12 09:30:00", 90, "Tatuagem", "Preservar este registro"]
  );
  const [before] = await connection.query<RowDataPacket[]>(
    "SELECT id, CAST(date AS CHAR) AS date, duration, service, notes FROM appointments"
  );
  await ensureAppointmentAnatomySchema();
  await ensureAppointmentAnatomySchema();
  const [after] = await connection.query<RowDataPacket[]>(
    "SELECT id, CAST(date AS CHAR) AS date, duration, service, notes FROM appointments"
  );
  assert.deepEqual(after, before, "Existing appointment data must be preserved");
  const [rows] = await connection.query<RowDataPacket[]>(
    "SELECT bodyRegion, bodySide FROM appointments WHERE id=1"
  );
  assert.deepEqual({ ...rows[0] }, { bodyRegion: null, bodySide: null });
  await connection.execute(
    "UPDATE appointments SET bodyRegion=?, bodySide=? WHERE id=1",
    ["Antebraço", "esquerdo"]
  );
  const [saved] = await connection.query<RowDataPacket[]>(
    "SELECT bodyRegion, bodySide FROM appointments WHERE id=1"
  );
  assert.equal(saved[0].bodyRegion, "Antebraço");
  assert.equal(saved[0].bodySide, "esquerdo");
  await connection.query("UPDATE appointments SET bodyRegion=NULL, bodySide=NULL WHERE id=1");
  const [cleared] = await connection.query<RowDataPacket[]>(
    "SELECT bodyRegion, bodySide FROM appointments WHERE id=1"
  );
  assert.deepEqual({ ...cleared[0] }, { bodyRegion: null, bodySide: null });
  console.log("Agenda migration: real MySQL passed; original data preserved; repeat, save and clear passed.");
} finally {
  await connection.end();
}
