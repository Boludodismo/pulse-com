import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { readFile } from "node:fs/promises";
import type { Server } from "node:http";
import mysql, { type Connection, type RowDataPacket } from "mysql2/promise";
import express from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import superjson from "superjson";

// Opt-in, pinned loopback port/database; never fall back to DATABASE_URL.
const url = process.env.STAGE1A_TEST_DATABASE_URL;
const enabled = !!url && /^mysql:\/\/[^@]+@127\.0\.0\.1:33181\/stage1a_test$/.test(url);
if (url && !enabled) throw new Error("Stage 1A tests require the dedicated loopback database on port 33181.");
const tables = ["stock_movements","procedure_ink_recipe_items", "procedure_ink_recipe_results", "procedure_pauses", "procedure_color_samples", "procedure_visual_layers", "tenant_inventory_movements", "tenant_materials", "artist_session_appearance", "appointment_planned_materials", "procedure_ink_recipes", "procedure_inventory_consumptions", "procedure_consumables", "procedure_images", "procedure_events", "technical_procedures", "galleryImages", "clientNotes", "transactions", "appointments", "calendars", "materials", "user_module_permissions", "clients", "users", "artists", "studios", "auditLogs"];
let database: Connection;
let http: Server;
let base: string;
let users: Map<number, any>;
let pool: any;

async function request(userId: number, path: string, input?: unknown, mutation = false) {
  const body = JSON.stringify(superjson.serialize(input));
  const response = await fetch(`${base}/${path}${mutation ? "" : `?input=${encodeURIComponent(body)}`}`, {
    method: mutation ? "POST" : "GET",
    headers: { "content-type": "application/json", "x-fixture-user": String(userId) },
    ...(mutation ? { body } : {}),
  });
  const envelope = await response.json();
  return { status: response.status, data: envelope.result ? superjson.deserialize(envelope.result.data) as any : undefined,
    error: envelope.error ? superjson.deserialize(envelope.error) as any : undefined };
}
async function snapshot() {
  return JSON.stringify(await Promise.all(tables.map(async table => (await database.query(`SELECT * FROM \`${table}\` ORDER BY id`))[0])));
}
async function denied(userId: number, path: string, input?: unknown, mutation = false) {
  const before = await snapshot();
  const result = await request(userId, path, input, mutation);
  expect(result.status, JSON.stringify(result)).toBe(403);
  expect(result.error?.data?.code).toBe("FORBIDDEN");
  expect(result.data).toBeUndefined();
  expect(await snapshot()).toBe(before);
}

describe.skipIf(!enabled)("Stage 1A: actual tRPC HTTP + disposable MySQL (synthetic identities)", () => {
  beforeAll(async () => {
    vi.stubEnv("DATABASE_URL", url!);
    vi.stubEnv("AUTH_MODE", "local");
    vi.stubEnv("STORAGE_PROVIDER", "disabled");
    vi.stubEnv("OUTBOUND_MESSAGING_DISABLED", "true");
    vi.stubEnv("SCHEDULER_MODE", "disabled");
    database = await mysql.createConnection(url!);
    const [existing] = await database.query<RowDataPacket[]>("SHOW TABLES");
    if (!existing.length) {
      // Reproduce the existing schema in this NEW database; no application migration.
      const source = await readFile(new URL("../ops/demo/schema/0000_synthetic.sql", import.meta.url), "utf8");
      for (const part of source.split("--> statement-breakpoint")) {
        let statement = part.trim().replace(/;$/, "").replace(/DEFAULT\s+'CURRENT_TIMESTAMP'/gi, "DEFAULT CURRENT_TIMESTAMP");
        if (/^CREATE TABLE/i.test(statement) && /AUTO_INCREMENT/.test(statement) && !/PRIMARY KEY/.test(statement))
          statement = statement.replace(/(`[^`]+`[^,\n]*AUTO_INCREMENT[^,\n]*)/, "$1 PRIMARY KEY");
        if (statement) await database.query(statement);
      }
    } else {
      const [studios] = await database.query<RowDataPacket[]>("SELECT name FROM studios");
      if (!studios.every(row => row.name.startsWith("STAGE1A FICTION"))) throw new Error("Not a disposable Stage 1A fixture");
    }
    // Existing attendance schema is initialized by real app startup, outside reservation transactions.
    await database.query("CREATE TABLE IF NOT EXISTS appointment_attendance (appointment_id INT PRIMARY KEY,studio_id INT NOT NULL,client_id INT NOT NULL,artist_id INT,attendance VARCHAR(12) NOT NULL,session VARCHAR(16) NOT NULL,needs_more TINYINT NOT NULL)");
    const { appRouter } = await import("./routers");
    const { getDb } = await import("./db");
    pool = (await getDb())!.$client;
    const app = express();
    // Deliberate test-only identity injection: exercise authorization via HTTP,
    // without starting the real app, workers, external services or login bootstrap.
    app.use("/api/trpc", createExpressMiddleware({ router: appRouter,
      createContext: ({ req, res }) => ({ req, res, user: users.get(Number(req.get("x-fixture-user"))) ?? null }),
    }));
    http = app.listen(0, "127.0.0.1");
    await new Promise<void>(resolve => http.once("listening", resolve));
    base = `http://127.0.0.1:${(http.address() as any).port}/api/trpc`;
  }, 120_000);

  beforeEach(async () => {
    await database.query("SET FOREIGN_KEY_CHECKS=0");
    for (const table of tables) await database.query(`DELETE FROM \`${table}\``);
    await database.query("SET FOREIGN_KEY_CHECKS=1");
    for (const studio of [1, 2]) {
      await database.query("INSERT INTO studios(id,name,masterKey) VALUES(?,?,?)", [studio, `STAGE1A FICTION ${studio}`, `fiction-master-${studio}`]);
      for (const index of [1, 2]) {
        const artist = studio * 10 + index;
        const client = studio * 100 + index;
        const appointment = studio * 1000 + index;
        await database.query("INSERT INTO artists(id,name,studioId) VALUES(?,?,?)", [artist, `Fiction Artist ${artist}`, studio]);
        await database.query("INSERT INTO clients(id,name,studioId,artistId) VALUES(?,?,?,?)", [client, `Fiction Client ${client}`, studio, artist]);
        await database.query("INSERT INTO appointments(id,studioId,clientId,artistId,artist,date,duration,service) VALUES(?,?,?,?,?,'2030-01-01 10:00:00',60,'Fiction')", [appointment, studio, client, artist, `Fiction Artist ${artist}`]);
        await database.query("INSERT INTO technical_procedures(id,studioId,clientId,artistId,appointmentId,title) VALUES(?,?,?,?,?,?)", [appointment, studio, client, artist, appointment, `Fiction Session ${appointment}`]);
      }
      await database.query("INSERT INTO materials(id,name,studioId,currentStock,unit) VALUES(?,?,?,100,'un')", [9000 + studio, "Fiction Material", studio]);
    }
    // A shared client's session has its OWN explicit artist, not a client-sharing grant.
    await database.query("INSERT INTO technical_procedures(id,studioId,clientId,artistId,appointmentId,title) VALUES (1003,1,101,NULL,1001,'Unassigned'),(1004,1,101,12,NULL,'Explicit other artist'),(1005,1,201,11,NULL,'Wrong client studio'),(1006,1,101,11,1002,'Wrong appointment client'),(1007,1,101,21,NULL,'Wrong artist studio')");
    const identities = [
      [1, "admin", 1, null, "admin-1"], [2, "admin", 2, null, "admin-2"],
      [11, "collaborator", 1, 11, "regular-11"], [12, "collaborator", 1, 12, "regular-12"],
      [21, "collaborator", 2, 21, "regular-21"], [22, "collaborator", 2, 22, "regular-22"],
      [111, "collaborator", 1, 11, "artist-invite:11"], [112, "collaborator", 1, 12, "artist-invite:12"],
      [121, "collaborator", 2, 21, "artist-invite:21"], [122, "collaborator", 2, 22, "artist-invite:22"],
      [9, "superadmin", 1, null, "super-1"], [10, "superadmin", null, null, "global-no-studio"],
      [13, "collaborator", 1, null, "missing-artist"], [14, "collaborator", 1, 21, "wrong-studio-artist"],
    ];
    for (const [userId, role, studio, artist, openId] of identities) {
      await database.query("INSERT INTO users(id,openId,name,role,studioId,artistId,isActive,accessStatus) VALUES(?,?,?,?,?,?,1,'active')", [userId, openId, `Fiction ${userId}`, role, studio, artist]);
      if (role === "collaborator" && studio) for (const module of ["clients", "pod", "finance", "appointments", "stock"])
        await database.query("INSERT INTO user_module_permissions(userId,studioId,module,canRead,canWrite) VALUES(?,?,?,1,1)", [userId, studio, module]);
    }
    const [rows] = await database.query<RowDataPacket[]>("SELECT * FROM users");
    users = new Map(rows.map(user => [user.id, user]));
    await database.query("INSERT INTO clientNotes(id,clientId,authorId,content) VALUES(5001,101,1,'Fiction own'),(5002,201,2,'Fiction foreign'),(5003,102,1,'Fiction other artist')");
    await database.query("INSERT INTO galleryImages(id,clientId,appointmentId,imageUrl,imageKey) VALUES(6001,101,1001,'/fiction','client-101/gallery/fiction'),(6002,201,2001,'/fiction','client-201/gallery/fiction')");
    await database.query("INSERT INTO transactions(id,studioId,clientId,appointmentId,type,category,amount,paymentMethod,date) VALUES(8001,1,101,1001,'entrada','Fiction',100,'pix','2030-01-01'),(8002,2,201,2001,'entrada','Fiction',100,'pix','2030-01-01'),(8003,1,102,1002,'entrada','Fiction',100,'pix','2030-01-01')");
    await database.query("UPDATE clients SET totalSpent=100 WHERE id IN (101,102,201)");
    await database.query("INSERT INTO procedure_consumables(id,procedureId,category,name,unit,quantity) VALUES(7001,1001,'ink','Fiction','ml','1'),(7002,2001,'ink','Fiction','ml','1'),(7003,1002,'ink','Fiction','ml','1')");
    await database.query("INSERT INTO procedure_inventory_consumptions(id,procedureId,studioId,clientId,artistId,tenantMaterialId,nameSnapshot,unitSnapshot,quantity,unitCostSnapshot,totalCostSnapshot,consumedAt,status) VALUES(7101,2001,2,201,11,1,'Fiction','ml',1,1,1,'2030-01-01','revertido'),(7102,1002,1,102,11,1,'Fiction','ml',1,1,1,'2030-01-01','revertido')");
    await database.query("INSERT INTO procedure_ink_recipes(id,studioId,procedureId,clientId,artistId,code,dropsPerMl,totalDrops,estimatedMl,createdByUserId) VALUES(7201,2,2001,201,21,'M1',20,1,0.05,2),(7202,1,1002,102,11,'M2',20,1,0.05,1)");
  }, 30_000);

  afterAll(async () => {
    if (http) await new Promise<void>(resolve => http.close(() => resolve()));
    await pool?.end();
    await database?.end();
    vi.unstubAllEnvs();
  });

  it.each([1, 9])("tenant manager %i cannot reach foreign notes/gallery/finance", async user => {
    await denied(user, "notes.getByClientId", { clientId: 201 });
    await denied(user, "notes.delete", { id: 5002 }, true);
    await denied(user, "gallery.getByClientId", { clientId: 201 });
    await denied(user, "gallery.delete", { id: 6002 }, true);
    await denied(user, "transactions.getByClientId", { clientId: 201 });
    await denied(user, "transactions.update", { id: 8002, data: { amount: 999 } }, true);
    await denied(user, "transactions.delete", { id: 8002 }, true);
  });

  it.each([11, 12, 21, 22, 111, 112, 121, 122])("artist %i can read own session but not another artist or tenant", async user => {
    const artist = users.get(user).artistId;
    const own = artist < 20 ? 1000 + artist % 10 : 2000 + artist % 10;
    const other = own % 10 === 1 ? own + 1 : own - 1;
    const foreign = own < 2000 ? 2001 : 1001;
    expect((await request(user, "procedures.getById", { id: own })).status).toBe(200);
    expect((await request(user, "pod.session.get", { procedureId: own })).status).toBe(200);
    await denied(user, "procedures.getById", { id: other });
    await denied(user, "procedures.timerAction", { id: other, action: "pause" }, true);
    await denied(user, "procedures.delete", { id: foreign }, true);
    await denied(user, "pod.session.get", { procedureId: other });
    await denied(user, "pod.session.startPause", { procedureId: other }, true);
  });

  it.each([11, 111])("artist %i: session lists, reports and finance lists exclude others", async user => {
    expect((await request(user, "procedures.listByClient", { clientId: 101 })).data.map((p: any) => p.id)).toEqual([1001]);
    expect((await request(user, "procedures.listByClient", { clientId: 102 })).data).toEqual([]);
    const report = await request(user, "procedures.consumableReport", {});
    expect(report.status).toBe(200);
    expect(report.data.totalSessions).toBe(1);
    expect((await request(user, "transactions.list")).data.map((r: any) => r.id)).toEqual([8001]);
    await denied(user, "notes.getByClientId", { clientId: 102 });
  });

  it.each([11, 111])("artist %i cannot alter another session's dependents", async user => {
    await denied(user, "procedures.addConsumable", { procedureId: 1002, category: "ink", name: "Fiction", unit: "ml", quantity: 1 }, true);
    await denied(user, "procedures.updateConsumable", { procedureId: 1001, id: 7003, quantity: 2 }, true);
    await denied(user, "procedures.removeConsumable", { procedureId: 1001, id: 7002 }, true);
    await denied(user, "procedures.uploadImage", { procedureId: 1002, imageBase64: "AA==", mimeType: "image/png" }, true);
    await denied(user, "quickConsume", { procedureId: 1002, inventoryItemId: 9001, category: "ink", name: "Fiction", quantity: 1, estimatedUnitCost: 1 }, true);
    await denied(user, "pod.session.revertConsumption", { consumptionId: 7101, reason: "Fiction" }, true);
    await denied(user, "pod.session.revertInkRecipe", { recipeId: 7201, reason: "Fiction" }, true);
    await denied(user, "pod.session.revertConsumption", { consumptionId: 7102, reason: "Fiction" }, true);
    await denied(user, "pod.session.revertInkRecipe", { recipeId: 7202, reason: "Fiction" }, true);
    expect((await request(user, "pod.session.recipeLibrary", {})).data).toEqual([]);
  });

  it.each([1, 11, 111])("actor %i cannot introduce inconsistent session/client/appointment/artist links", async user => {
    await denied(user, "procedures.create", { clientId: 201, artistId: 11, title: "Fiction" }, true);
    await denied(user, "procedures.create", { clientId: 101, artistId: 11, appointmentId: 1002, title: "Fiction" }, true);
    await denied(user, "procedures.update", { id: 1001, artistId: 21 }, true);
    await denied(user, "procedures.getById", { id: 1005 });
    await denied(user, "procedures.getById", { id: 1006 });
    await denied(user, "procedures.getById", { id: 1007 });
    await denied(user, "transactions.create", { clientId: 101, appointmentId: 2001, type: "entrada", category: "Fiction", amount: 100, paymentMethod: "pix", date: "2030-01-01" }, true);
    await denied(user, "gallery.create", { clientId: 101, appointmentId: 1002, imageUrl: "/fiction", imageKey: "fiction" }, true);
  });

  it.each([11, 111])("artist %i cannot forge access using fields the endpoint does not accept", async user => {
    await database.query("INSERT INTO appointments(id,studioId,clientId,artistId,artist,date,duration,service) VALUES(1008,1,102,11,'Fiction','2030-01-01',60,'Fiction')");
    await denied(user, "notes.getByClientId", { clientId: 102, appointmentId: 1008 });
    await denied(user, "notes.create", { clientId: 102, appointmentId: 1008, content: "Fiction" }, true);
    await denied(user, "gallery.getByClientId", { clientId: 102, appointmentId: 1008 });
    await denied(user, "transactions.getByClientId", { clientId: 102, appointmentId: 1008 });
    await denied(user, "procedures.update", { id: 1001, artistId: null }, true);
    await denied(user, "procedures.create", { clientId: 101, artistId: 11, title: "Fiction", referenceFromProcedureId: 1004 }, true);
    await denied(user, "transactions.createWithMaterials", { clientId: 101, type: "entrada", category: "Fiction", amount: 100, paymentMethod: "pix", date: "2030-01-01", materials: [{ materialId: 9001, quantity: 1 }] }, true);
  });

  it.each([11, 111])("artist %i does not gain another artist's appointment artifacts by owning the client", async user => {
    await database.query("INSERT INTO appointments(id,studioId,clientId,artistId,artist,date,duration,service) VALUES(1008,1,101,12,'Fiction','2030-01-01',60,'Fiction')");
    await database.query("INSERT INTO galleryImages(id,clientId,appointmentId,imageUrl,imageKey) VALUES(6003,101,1008,'/fiction','fiction')");
    await database.query("INSERT INTO transactions(id,studioId,clientId,appointmentId,type,category,amount,paymentMethod,date) VALUES(8004,1,101,1008,'entrada','Fiction',100,'pix','2030-01-01')");
    expect((await request(user, "gallery.getByClientId", { clientId: 101 })).data.map((r: any) => r.id)).toEqual([6001]);
    expect((await request(user, "transactions.getByClientId", { clientId: 101 })).data.map((r: any) => r.id)).toEqual([8001]);
    await denied(user, "gallery.delete", { id: 6003 }, true);
    await denied(user, "transactions.delete", { id: 8004 }, true);
    await denied(user, "procedures.addConsumable", { procedureId: 1001, inventoryItemId: 9002, category: "ink", name: "Fiction", unit: "ml", quantity: 1 }, true);
  });

  it.each([11, 111])("artist %i cannot inherit an unassigned session from its appointment", async user => {
    await denied(user, "procedures.getById", { id: 1003 });
    await denied(user, "pod.session.get", { procedureId: 1003 });
    await denied(user, "pod.session.create", { clientId: 101, appointmentId: 1001 }, true);
  });

  it("admin sees the review flag and reading never assigns an artist", async () => {
    const before = await snapshot();
    const result = await request(1, "procedures.getById", { id: 1003 });
    expect(result.status).toBe(200);
    expect(result.data.procedure.artistId).toBeNull();
    expect(result.data.procedure.requiresArtistReview).toBe(true);
    expect(await snapshot()).toBe(before);
  });

  it("admin creation keeps the artist absent even when the appointment has one", async () => {
    const legacy = await request(1, "procedures.create", { clientId: 101, appointmentId: 1001, title: "Fiction unassigned" }, true);
    const modern = await request(1, "pod.session.create", { clientId: 101, appointmentId: 1001, title: "Fiction unassigned" }, true);
    expect(legacy.status).toBe(200);
    expect(modern.status).toBe(200);
    const [rows] = await database.query<RowDataPacket[]>("SELECT artistId FROM technical_procedures WHERE id IN (?,?)", [legacy.data.id, modern.data.id]);
    expect(rows).toHaveLength(2);
    expect(rows.every(row => row.artistId === null)).toBe(true);
  });

  it.each([11, 111])("artist %i cannot replay another artist's prepared session", async user => {
    const requestId = "d530b978-5940-4efe-95ca-7a05bb613276";
    await database.query("INSERT INTO procedure_events(procedureId,eventType,payload) VALUES(1004,?, '{}')", [`prepared:${requestId}`]);
    await denied(user, "procedures.create", { clientId: 101, artistId: 11, title: "Fiction", requestId }, true);
  });

  it.each([12, 112])("artist %i can access an explicitly owned session without gaining client-sharing rights", async user => {
    expect((await request(user, "procedures.getById", { id: 1004 })).status).toBe(200);
    expect((await request(user, "procedures.listByClient", { clientId: 101 })).data.map((p: any) => p.id)).toEqual([1004]);
    await denied(user, "notes.getByClientId", { clientId: 101 });
  });

  it("only existing superadmin-only operations retain global access", async () => {
    expect((await request(10, "saas.studios")).data.map((s: any) => s.id).sort()).toEqual([1, 2]);
    await denied(1, "saas.studios");
    await denied(9, "procedures.getById", { id: 2001 });
  });

  it.each([11, 111])("artist %i requires finance and client module permissions", async user => {
    await database.query("UPDATE user_module_permissions SET canRead=0,canWrite=0 WHERE userId=? AND module IN ('finance','clients')", [user]);
    await denied(user, "transactions.list");
    await denied(user, "transactions.create", { clientId: 101, type: "entrada", category: "Fiction", amount: 100, paymentMethod: "pix", date: "2030-01-01" }, true);
    await denied(user, "notes.getByClientId", { clientId: 101 });
    await denied(user, "gallery.getByClientId", { clientId: 101 });
  });

  it("unauthenticated API calls stay unauthorized without writes", async () => {
    const before = await snapshot();
    expect((await request(0, "procedures.getById", { id: 1001 })).status).toBe(401);
    expect((await request(0, "notes.create", { clientId: 101, content: "Fiction" }, true)).status).toBe(401);
    expect(await snapshot()).toBe(before);
  });

  it.each([11, 111])("artist %i needs existing module read/write grants", async user => {
    await database.query("UPDATE user_module_permissions SET canWrite=0 WHERE userId=? AND module='pod'", [user]);
    expect((await request(user, "procedures.getById", { id: 1001 })).status).toBe(200);
    await denied(user, "procedures.timerAction", { id: 1001, action: "pause" }, true);
    await database.query("UPDATE user_module_permissions SET canRead=0 WHERE userId=? AND module='pod'", [user]);
    await denied(user, "procedures.getById", { id: 1001 });
  });

  it.each([10, 13, 14])("identity %i has no implicit tenant/artist fallback", async user => {
    await denied(user, "procedures.getById", { id: 1001 });
    await denied(user, "transactions.list");
  });

  it("admin can mutate own records; artist can mutate own session dependents", async () => {
    expect((await request(1, "notes.create", { clientId: 101, content: "New fiction" }, true)).status).toBe(200);
    expect((await request(1, "transactions.update", { id: 8001, data: { amount: 200 } }, true)).status).toBe(200);
    expect((await request(11,"procedures.timerAction",{id:1001,action:"start"},true)).status).toBe(200);
    for (const user of [11, 111]) {
      expect((await request(user, "procedures.addConsumable", { procedureId: 1001, category: "ink", name: "Fiction", unit: "ml", quantity: 1 }, true)).status).toBe(200);
      expect((await request(user, "procedures.timerAction", { id: 1001, action: "pause" }, true)).status).toBe(200);
    }
    expect((await request(2, "notes.create", { clientId: 201, content: "Other tenant fiction" }, true)).status).toBe(200);
  });
  it("timer requests serialize, repeat safely and retain the original start and pauses", async()=>{
    const start=await request(11,"procedures.timerAction",{id:1001,action:"start"},true);
    expect(start.status).toBe(200);
    const again=await request(11,"procedures.timerAction",{id:1001,action:"start"},true);
    expect(again.data.startedAt).toBe(start.data.startedAt);
    const results=await Promise.all([request(11,"pod.session.startPause",{procedureId:1001},true),request(111,"pod.session.startPause",{procedureId:1001},true)]);
    expect(results.map(r=>r.status)).toEqual([200,200]);expect(results[0].data.id).toBe(results[1].data.id);
    const [open]=await database.query<RowDataPacket[]>("SELECT * FROM procedure_pauses WHERE procedureId=1001 AND endedAt IS NULL");expect(open).toHaveLength(1);
    const resumed=await Promise.all([request(11,"pod.session.resumePause",{procedureId:1001},true),request(111,"pod.session.resumePause",{procedureId:1001},true)]);
    expect(resumed.map(r=>r.status)).toEqual([200,200]);
    const finished=await request(11,"procedures.timerAction",{id:1001,action:"finish"},true);expect(finished.status).toBe(200);
    const before=await snapshot();expect((await request(11,"procedures.timerAction",{id:1001,action:"finish"},true)).data).toEqual(finished.data);expect(await snapshot()).toBe(before);
    expect((await request(11,"procedures.timerAction",{id:1001,action:"start"},true)).status).toBe(409);expect(await snapshot()).toBe(before);
    expect((await request(11,"procedures.update",{id:1001,status:"em_andamento"},true)).status).toBe(409);expect(await snapshot()).toBe(before);
  });
  it("timer refuses pause before start without writes and subtracts recorded pauses",async()=>{
    const before=await snapshot();expect((await request(11,"pod.session.startPause",{procedureId:1001},true)).status).toBe(409);expect(await snapshot()).toBe(before);
    await database.query("UPDATE technical_procedures SET startedAt=DATE_SUB(UTC_TIMESTAMP(),INTERVAL 60 MINUTE) WHERE id=1001");
    await database.query("INSERT INTO procedure_pauses(studioId,procedureId,artistId,startedAt,endedAt) VALUES(1,1001,11,DATE_SUB(UTC_TIMESTAMP(),INTERVAL 50 MINUTE),DATE_SUB(UTC_TIMESTAMP(),INTERVAL 30 MINUTE))");
    const result=await request(11,"procedures.timerAction",{id:1001,action:"finish"},true);expect(result.status).toBe(200);expect(result.data.totalDurationMinutes).toBe(40);
  });

  it("concurrent HTTP reservations reject overlap, permit contiguity and other artists",async()=>{
    const input={clientId:101,artistId:11,artist:"Fiction Artist 11",date:"2030-01-02 10:00:00",duration:60,service:"Fiction",attendanceEnabled:0};
    const pair=await Promise.all([request(1,"appointments.create",input,true),request(1,"appointments.create",input,true)]);
    expect(pair.map(r=>r.status).sort(),JSON.stringify(pair)).toEqual([200,409]);
    expect((await request(1,"appointments.create",{...input,date:"2030-01-02 11:00:00"},true)).status).toBe(200);
    expect((await request(1,"appointments.create",{...input,artistId:12,artist:"Fiction Artist 12",clientId:102},true)).status).toBe(200);
    const [rows]=await database.query<RowDataPacket[]>("SELECT * FROM appointments WHERE studioId=1 AND date >= '2030-01-02'");expect(rows).toHaveLength(3);
    const [client]=await database.query<RowDataPacket[]>("SELECT appointmentCount FROM clients WHERE id=101");expect(client[0].appointmentCount).toBe(2);
  });
  it("concurrent reschedules use the same lock as creation",async()=>{
    const pair=await Promise.all([request(1,"appointments.update",{id:1001,data:{date:"2030-01-03 10:00:00"}},true),request(1,"appointments.create",{clientId:101,artistId:11,artist:"Fiction Artist 11",date:"2030-01-03 10:00:00",duration:60,service:"Fiction",attendanceEnabled:0},true)]);
    expect(pair.map(r=>r.status).sort(),JSON.stringify(pair)).toEqual([200,409]);
  });

  it("financial edits, ownership changes, repeat updates and deletes maintain existing loyalty formula",async()=>{
    expect((await request(1,"transactions.update",{id:8001,data:{amount:60000}},true)).status).toBe(200);
    const client=async(id:number)=>(await database.query<RowDataPacket[]>("SELECT totalSpent,loyaltyLevel FROM clients WHERE id=?",[id]))[0][0];
    expect(await client(101)).toMatchObject({totalSpent:60000,loyaltyLevel:"Prata"});
    expect((await request(1,"transactions.update",{id:8001,data:{amount:60000}},true)).status).toBe(200);
    expect((await client(101)).totalSpent).toBe(60000);
    expect((await request(1,"transactions.update",{id:8001,data:{clientId:102,appointmentId:1002}},true)).status).toBe(200);
    expect(await client(101)).toMatchObject({totalSpent:0,loyaltyLevel:"Bronze"});
    expect((await client(102)).totalSpent).toBe(60100);
    expect((await request(1,"transactions.delete",{id:8001},true)).status).toBe(200);
    expect((await client(102)).totalSpent).toBe(100);
  });
  it("financial material failure rolls back every row and concurrent consumers cannot overspend",async()=>{
    await database.query("INSERT INTO materials(id,studioId,name,currentStock) VALUES(901,1,'Fiction',5),(902,1,'Fiction empty',0)");
    const input={clientId:101,appointmentId:1001,type:"entrada",category:"Fiction",amount:100,paymentMethod:"pix",date:"2030-01-01",materials:[{materialId:901,quantity:3},{materialId:902,quantity:1}]};
    const before=await snapshot();expect((await request(1,"transactions.createWithMaterials",input,true)).status).toBe(409);expect(await snapshot()).toBe(before);
    const pair=await Promise.all([request(1,"transactions.createWithMaterials",{...input,materials:[{materialId:901,quantity:3}]},true),request(1,"transactions.createWithMaterials",{...input,materials:[{materialId:901,quantity:3}]},true)]);
    expect(pair.map(r=>r.status).sort(),JSON.stringify(pair)).toEqual([200,409]);
    const [mat]=await database.query<RowDataPacket[]>("SELECT currentStock FROM materials WHERE id=901");expect(Number(mat[0].currentStock)).toBe(2);
    const [mov]=await database.query<RowDataPacket[]>("SELECT * FROM stock_movements WHERE materialId=901");expect(mov).toHaveLength(1);
    const transaction=pair.find(r=>r.status===200)!.data.transaction;
    expect((await request(1,"transactions.delete",{id:transaction.id},true)).status).toBe(200);
    expect((await database.query<RowDataPacket[]>("SELECT currentStock FROM materials WHERE id=901"))[0][0].currentStock).toBe(mat[0].currentStock);
  });
  it("repeated simultaneous deposit confirmation records exactly one receipt",async()=>{
    const input={id:1001,data:{depositPaid:true,depositAmount:500}};
    const pair=await Promise.all([request(1,"appointments.update",input,true),request(1,"appointments.update",input,true)]);
    expect(pair.map(r=>r.status),JSON.stringify(pair)).toEqual([200,200]);
    const [rows]=await database.query<RowDataPacket[]>("SELECT * FROM transactions WHERE appointmentId=1001 AND category='Sinal de Agendamento'");expect(rows).toHaveLength(1);
    expect((await database.query<RowDataPacket[]>("SELECT totalSpent FROM clients WHERE id=101"))[0][0].totalSpent).toBe(600);
  });

  it("allocated receipts and inconsistent historical totals are refused without reconciliation",async()=>{
    await database.query("INSERT INTO procedure_events(procedureId,eventType,payload) VALUES(1001,'finalization',?)",[JSON.stringify({version:1,allocatedReceiptIds:[8001]})]);
    const before=await snapshot();expect((await request(1,"transactions.update",{id:8001,data:{amount:200}},true)).status).toBe(412);expect(await snapshot()).toBe(before);
    expect((await request(1,"transactions.delete",{id:8001},true)).status).toBe(412);expect(await snapshot()).toBe(before);
    await database.query("UPDATE clients SET totalSpent=0 WHERE id=102");
    const inconsistent=await snapshot();expect((await request(1,"transactions.delete",{id:8003},true)).status).toBe(409);expect(await snapshot()).toBe(inconsistent);
  });
  it("legacy stock API serializes consumers and keeps decimal quantities exact",async()=>{
    await database.query("INSERT INTO materials(id,studioId,name,currentStock) VALUES(901,1,'Fiction',0.30)");
    expect((await request(1,"stock.addMovement",{materialId:901,type:"saida",quantity:0.1},true)).status).toBe(200);
    const pair=await Promise.all([request(1,"stock.addMovement",{materialId:901,type:"saida",quantity:0.2},true),request(1,"stock.addMovement",{materialId:901,type:"saida",quantity:0.2},true)]);
    expect(pair.map(r=>r.status).sort(),JSON.stringify(pair)).toEqual([200,409]);
    expect(Number((await database.query<RowDataPacket[]>("SELECT currentStock FROM materials WHERE id=901"))[0][0].currentStock)).toBe(0);
  });

  it("audit persistence failure rolls back transaction create, edit and delete with loyalty",async()=>{
    const db=await import('./db');const actor={userId:1,userName:'F'.repeat(1000)};
    const before=await snapshot();
    await expect(db.createTransaction({studioId:1,clientId:101,type:'entrada',category:'Fiction',amount:100,paymentMethod:'pix',date:'2030-01-01'},actor)).rejects.toThrow();expect(await snapshot()).toBe(before);
    await expect(db.updateTransaction(8001,{amount:60000},actor)).rejects.toThrow();expect(await snapshot()).toBe(before);
    await expect(db.deleteTransaction(8001,actor)).rejects.toThrow();expect(await snapshot()).toBe(before);
  });


});
