import assert from "node:assert/strict";
import mysql, { type RowDataPacket } from "mysql2/promise";
import { ensureStagingQuoteProposalSchema } from "../server/_core/stagingQuoteProposalSchema";

// This integration test is restricted to a disposable local database.
const url = new URL(process.env.DATABASE_URL || "");
assert(["localhost", "127.0.0.1"].includes(url.hostname));
assert.equal(url.pathname, "/quote_release_test");
process.env.RAILWAY_ENVIRONMENT_ID = "92e8281a-668a-43ed-b2ba-cac84082a91c";
process.env.RAILWAY_SERVICE_ID = "7527417a-b872-42bf-b828-e0987b805196";
process.env.RUN_DB_MIGRATIONS = "true";

const db = await mysql.createConnection(process.env.DATABASE_URL!);
try {
  await db.query("CREATE TABLE user_module_permissions (id int PRIMARY KEY, module ENUM('quotes','clients') NOT NULL)");
  await db.query("INSERT INTO user_module_permissions VALUES (1,'clients')");
  await ensureStagingQuoteProposalSchema();
  await db.query("ALTER TABLE quote_proposals MODIFY COLUMN payload TEXT NOT NULL");
  const legacy = JSON.stringify({ version: 1, text: "Descrição original preservada" });
  await db.query("INSERT INTO quote_proposals (studio_id,client_id,artist_id,quote_number,created_date,valid_until,payload,created_by_user_id,public_token,status) VALUES (1,2,3,'OLD-1',NOW(),NOW(),?,4,?,'finalized')", [legacy, "a".repeat(48)]);
  const [before] = await db.query("SELECT * FROM quote_proposals");
  await ensureStagingQuoteProposalSchema();
  await ensureStagingQuoteProposalSchema();
  const [after] = await db.query("SELECT * FROM quote_proposals");
  assert.deepEqual(after, before);
  const [columns] = await db.query<RowDataPacket[]>("SHOW COLUMNS FROM quote_proposals LIKE 'payload'");
  assert.equal(columns[0].Type, "mediumtext");
  const large = JSON.stringify({ projects: Array.from({ length: 20 }, () => ({ description: "á".repeat(8000) })) });
  assert(Buffer.byteLength(large) > 65535);
  await db.query("INSERT INTO quote_proposals (studio_id,client_id,artist_id,quote_number,created_date,valid_until,payload,created_by_user_id) VALUES (1,2,3,'NEW-1',NOW(),NOW(),?,4)", [large]);
  const [saved] = await db.query<RowDataPacket[]>("SELECT payload FROM quote_proposals WHERE quote_number='NEW-1'");
  assert.equal(saved[0].payload, large);
  const [permissions] = await db.query("SELECT * FROM user_module_permissions");
  assert.deepEqual(permissions, [{ id: 1, module: "clients" }]);
  console.log("PASS: MySQL migration is repeatable, preserves old quotes/tokens/permissions, and stores large multi-project payloads.");
} finally {
  await db.end();
}
