/** Runs only against an empty, disposable CI MySQL database. */
import assert from "node:assert/strict";
import mysql from "mysql2/promise";
import { runStartupMigrations } from "../server/_core/migrations";
import { ensureLegacyStockScope } from "../server/_core/legacyStockScope";
import { appRouter } from "../server/routers";

async function main() {
  const url = new URL(process.env.DATABASE_URL!);
  assert.equal(process.env.CI, "true");
  assert.ok(["127.0.0.1", "localhost"].includes(url.hostname), "Only a local disposable CI database is allowed");
  const db = await mysql.createConnection(process.env.DATABASE_URL!);
  const [existing]: any = await db.query("SHOW TABLES");
  assert.equal(existing.length, 0, "Refuse to use an existing database");
  await runStartupMigrations();
  await db.query("INSERT INTO studios(id,name,masterKey) VALUES (101,'Estúdio original','test-101'),(202,'Estúdio assinante','test-202')");
  await db.query("CREATE TABLE crm_studio_identity_backup(studioId INT PRIMARY KEY, previousIdentity JSON NOT NULL)");
  await db.query("INSERT INTO crm_studio_identity_backup VALUES(101,JSON_OBJECT('name','Estúdio original'))");
  await db.query("INSERT INTO suppliers(id,name,whatsapp) VALUES(11,'Fornecedor original','5500000000000')");
  await db.query("INSERT INTO materials(id,name,supplierId) VALUES(21,'Material original',11)");
  await db.query("INSERT INTO purchase_orders(id,supplierId) VALUES(31,11)");
  await ensureLegacyStockScope();
  await ensureLegacyStockScope();
  const caller = (studioId: number, role = "admin") => appRouter.createCaller({ user: {
    id: studioId, openId: `pilot:test-${studioId}`, role, studioId, isActive: 1, accessStatus: "active", name: "Pessoa",
  }, req: { headers: {} }, res: {} } as any);
  const owner = caller(101), subscriber = caller(202);
  assert.equal((await owner.suppliers.list({})).length, 1);
  assert.deepEqual(await subscriber.suppliers.list({ activeOnly: false }), []);
  assert.deepEqual(await subscriber.stock.listOrders(), []);
  assert.deepEqual(await subscriber.stock.listMaterials({}), []);
  assert.equal((await owner.stock.listOrders()).length, 1);
  await assert.rejects(subscriber.suppliers.getById({ id: 11 }), { code: "NOT_FOUND" });
  await assert.rejects(subscriber.suppliers.update({ id: 11, name: "Invasão" }), { code: "NOT_FOUND" });
  await assert.rejects(subscriber.suppliers.delete({ id: 11 }), { code: "NOT_FOUND" });
  await assert.rejects(subscriber.stock.deleteOrder({ id: 31 }), { code: "NOT_FOUND" });
  await assert.rejects(subscriber.stock.getWhatsAppLink({ orderId: 31 }), { code: "NOT_FOUND" });
  const ownSupplier = await subscriber.suppliers.create({ name: "Fornecedor assinante" });
  const ownMaterial = await subscriber.stock.createMaterial({ name: "Material assinante", category: "Teste", unit: "un", supplierId: ownSupplier.id });
  const ownOrder = await subscriber.stock.createOrder({ supplierId: ownSupplier.id, items: [{ materialId: ownMaterial.id, quantity: 2 }] });
  assert.equal((await subscriber.stock.getOrder({ id: ownOrder.id })).items.length, 1);
  await assert.rejects(owner.stock.getOrder({ id: ownOrder.id }), { code: "NOT_FOUND" });
  await assert.rejects(subscriber.stock.createOrder({ supplierId: 11, items: [{ materialId: ownMaterial.id, quantity: 1 }] }), { code: "NOT_FOUND" });
  await subscriber.stock.deleteOrder({ id: ownOrder.id });
  assert.equal((await subscriber.auth.me())?.studioName, "Estúdio assinante");
  await assert.rejects(subscriber.saas.teamAccess(), { code: "FORBIDDEN" });
  assert.equal((await caller(101, "superadmin").saas.studios()).length, 2);
  await ensureLegacyStockScope();
  assert.equal((await subscriber.suppliers.list({})).length, 1);
  assert.equal((await owner.suppliers.list({}))[0].name, "Fornecedor original");
  await db.end();
  console.log("PASS: MySQL migration twice, legacy preservation, cross-tenant CRUD, own orders and SaaS authorization");
}
main().then(() => process.exit(0)).catch(error => { console.error(error); process.exit(1); });
