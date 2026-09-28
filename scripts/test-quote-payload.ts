import assert from "node:assert/strict";
import mysql, { type RowDataPacket } from "mysql2/promise";
import { ensureStagingQuoteProposalSchema } from "../server/_core/stagingQuoteProposalSchema";
import { recordQuoteInteraction, validateAppointmentQuote, quoteHasBooking, quoteHasResponse } from "../server/quoteHistory";
import { getDb } from "../server/db";
import { quoteProposals } from "../drizzle/quoteProposalSchema";
import { and, eq, ne, sql } from "drizzle-orm";

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
  await db.query("CREATE TABLE appointments (id int PRIMARY KEY, studioId int NOT NULL, clientId int NOT NULL, artistId int, status varchar(24) NOT NULL)");
  await db.query("INSERT INTO appointments VALUES(1,1,2,3,'agendado')");
  await db.query("CREATE TABLE care_tags (id int AUTO_INCREMENT PRIMARY KEY,studio_id int NOT NULL,client_id int NOT NULL,label varchar(60) NOT NULL,UNIQUE KEY(studio_id,client_id,label))");
  await db.query("INSERT INTO care_tags(studio_id,client_id,label) VALUES(1,2,'realismo')");
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
  const [appointments] = await db.query("SELECT * FROM appointments");
  assert.deepEqual(appointments,[{id:1,studioId:1,clientId:2,artistId:3,status:'agendado',quote_id:null}]);
  const [tags] = await db.query("SELECT label FROM care_tags");
  assert.deepEqual(tags,[{label:'realismo'}]);
  const insertQuote = async (studio: number, number: string) => {
    const [result] = await db.execute<mysql.ResultSetHeader>("INSERT INTO quote_proposals(studio_id,client_id,artist_id,quote_number,created_date,valid_until,payload,created_by_user_id,status) VALUES(?,2,3,?,'2020-01-01','2099-12-31',?,4,'finalized')",[studio,number,legacy]);
    return result.insertId;
  };
  const a = await insertQuote(1,"HISTORY-A");
  const b = await insertQuote(1,"HISTORY-B");
  const otherStudio = await insertQuote(2,"HISTORY-OTHER");
  const sent = {id:a,studioId:1,kind:"sent" as const,userId:4,occurredAt:"2026-01-01T12:00:00Z"};
  await Promise.all([recordQuoteInteraction(sent),recordQuoteInteraction(sent),recordQuoteInteraction(sent)]);
  await recordQuoteInteraction({...sent,occurredAt:"2026-01-02T12:00:00Z"});
  await recordQuoteInteraction({id:a,studioId:1,kind:"public_question",text:"Qual a duração?"});
  await recordQuoteInteraction({id:a,studioId:1,kind:"public_question",text:"Retentativa não substitui a dúvida"});
  const accepted = await recordQuoteInteraction({id:a,studioId:1,kind:"public_accept"});
  const repeated = await recordQuoteInteraction({id:a,studioId:1,kind:"public_accept"});
  assert.equal(repeated.acceptedAt,accepted.acceptedAt);
  await recordQuoteInteraction({id:b,studioId:1,kind:"public_accept"});
  await recordQuoteInteraction({id:otherStudio,studioId:2,kind:"sent"});
  await assert.rejects(()=>recordQuoteInteraction({id:a,studioId:2,kind:"sent"}));
  await assert.rejects(()=>recordQuoteInteraction({id:a,studioId:1,artistId:99,kind:"manual_response"}));
  await assert.rejects(()=>recordQuoteInteraction({...sent,occurredAt:"2099-01-01T12:00:00Z"}));
  const [tracked] = await db.query<RowDataPacket[]>("SELECT CAST(sent_at AS CHAR) sent_at,response_source,response_text,question_text FROM quote_proposals WHERE id=?",[a]);
  assert.deepEqual(tracked,[{sent_at:"2026-01-01 12:00:00",response_source:"public_question",response_text:"Qual a duração?",question_text:"Qual a duração?"}]);
  const [automaticTags] = await db.query<RowDataPacket[]>("SELECT label,COUNT(*) count FROM care_tags WHERE studio_id=1 AND client_id=2 GROUP BY label ORDER BY label");
  assert.deepEqual(automaticTags,[{label:"orçamento enviado",count:1},{label:"orçamento respondido",count:1},{label:"realismo",count:1}]);
  // Two sessions count as one quote; wrong tenant/client/artist and cancelled sessions cannot count.
  await db.query("INSERT INTO appointments(id,studioId,clientId,artistId,status,quote_id) VALUES (2,1,2,3,'agendado',?),(3,1,2,3,'confirmado',?),(4,1,2,3,'cancelado',?),(5,2,2,3,'agendado',?),(6,1,99,3,'agendado',?),(7,1,2,99,'agendado',?)",[a,a,b,otherStudio,b,b]);
  const orm = (await getDb())!;
  const count = async () => (await orm.select({sent:sql<number>`SUM(${quoteProposals.sentAt} IS NOT NULL)`.mapWith(Number),responded:sql<number>`SUM(${quoteHasResponse})`.mapWith(Number),booked:sql<number>`SUM(${quoteHasBooking})`.mapWith(Number)})
    .from(quoteProposals).where(and(eq(quoteProposals.studioId,1),eq(quoteProposals.clientId,2),ne(quoteProposals.status,"draft"))))[0];
  assert.deepEqual(await count(),{sent:1,responded:2,booked:1});
  await db.query("UPDATE appointments SET status='cancelado' WHERE id=2");
  await db.query("UPDATE appointments SET status='reagendado' WHERE id=3");
  assert.equal((await count()).booked,0);
  await db.query("UPDATE appointments SET status='concluido' WHERE id=3");
  assert.equal((await count()).booked,1);
  await validateAppointmentQuote({quoteId:a,studioId:1,clientId:2,artistId:3});
  await assert.rejects(()=>validateAppointmentQuote({quoteId:a,studioId:1,clientId:99,artistId:3}));
  await db.query("UPDATE quote_proposals SET status='cancelled' WHERE id=?",[b]);
  await assert.rejects(()=>recordQuoteInteraction({id:b,studioId:1,kind:"public_accept"}));
  console.log("PASS: Real MySQL row locks, duplicate delivery/acceptance, automatic tags, tenant boundaries and distinct appointment conversion counts.");
  console.log("PASS: MySQL migration is repeatable, preserves old quotes/tokens/permissions, and stores large multi-project payloads.");
} finally {
  await db.end();
  const orm = await getDb();
  if (orm) await (orm as any).$client.end();
}
