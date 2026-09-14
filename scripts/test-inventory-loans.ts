import { inventoryNoticeDeliveryError } from "../server/inventoryNoticeDelivery";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import mysql, { type RowDataPacket } from "mysql2/promise";
import { upgradeInventoryWorkflow } from "../server/_core/inventoryWorkflowSchema";
import { podSaasRouter } from "../server/routers/podSaas";
import { router } from "../server/_core/trpc";
import { getDb } from "../server/db";
import { createLoanDeadlineNotices } from "../server/inventoryNotices";
import { queueCriticalForecastAlerts } from "../server/inventoryForecast";
import { studioNow } from "../server/inventoryWorkflowRules";

async function main() {
  const url = new URL(process.env.DATABASE_URL!);
  assert.equal(process.env.CI, "true");
  assert.ok(["127.0.0.1", "localhost"].includes(url.hostname));
  assert.equal(url.pathname, "/supplier_test");
  const c = await mysql.createConnection({
    uri: url.toString(),
    dateStrings: true,
  });
  await upgradeInventoryWorkflow(c);
  await upgradeInventoryWorkflow(c);
  await c.query(
    "INSERT INTO artists(id,studioId,name,active) VALUES(3101,101,'Emprestador',1),(3102,101,'Recebedor',1),(3103,101,'Terceiro artista',1),(3201,202,'Outro estúdio',1)"
  );
  await c.query(
    "INSERT INTO clients(id,studioId,name) VALUES(3101,101,'Cliente empréstimo')"
  );
  await c.query(
    "INSERT INTO suppliers(id,studioId,name) VALUES(3101,101,'Fornecedor empréstimo')"
  );
  await c.query(
    "INSERT INTO technical_procedures(id,studioId,clientId,artistId,title,status) VALUES(3101,101,3101,3102,'Sessão material emprestado','em_andamento')"
  );
  for (const userId of [3101, 3102, 3103])
    for (const module of ["stock", "pod", "clients", "appointments"])
      await c.query(
        "INSERT INTO user_module_permissions(userId,studioId,module,canRead,canWrite) VALUES(?,101,?,1,1)",
        [userId, module]
      );
  const root = router({ pod: podSaasRouter });
  const caller = (studioId: number, artistId?: number) =>
    root.createCaller({
      user: {
        id: artistId ?? studioId,
        openId: artistId ? `artist-invite:test-${artistId}` : "test",
        role: artistId ? "collaborator" : "admin",
        artistId: artistId ?? null,
        studioId,
        isActive: 1,
        accessStatus: "active",
      },
      req: { headers: {} },
      res: {},
    } as any).pod;
  const admin = caller(101),
    lender = caller(101, 3101),
    borrower = caller(101, 3102),
    third = caller(101, 3103),
    foreign = caller(202);
  const db = (await getDb())!;
  const scalar = async (sql: string, values: unknown[] = []) =>
    Number((await c.query<RowDataPacket[]>(sql, values))[0][0].n);
  const balance = (id: number) =>
    scalar("SELECT currentQuantity n FROM tenant_materials WHERE id=?", [id]);
  const moneyBefore = await scalar("SELECT COUNT(*) n FROM transactions");
  const spec = {
    name: "Cartucho empréstimo",
    unit: "un",
    brand: "Marca teste",
    configuration: "RL",
    needleCount: 3,
    diameter: "0.25",
    unitCost: "2.5",
    currentQuantity: "0",
  };
  const source = await lender.inventory.create({
    ...spec,
    ownerArtistId: 3101,
  });
  const sourceReceipt = {
    tenantMaterialId: source.id,
    receiptKey: randomUUID(),
    supplierId: 3101,
    lot: "ORIGINAL",
    expiresAt: "2099-12-31",
    quantity: "5",
    unitCost: "2.5",
  };
  const original = await lender.inventory.receive(sourceReceipt);
  const requestInput = {
    requestKey: randomUUID(),
    borrowerArtistId: 3102,
    sourceMaterialId: source.id,
    quantity: "3",
  };
  await assert.rejects(
    third.inventory.loans.request(requestInput),
    /somente os dados/
  );
  await assert.rejects(foreign.inventory.loans.request(requestInput));
  const catalog = await borrower.inventory.loans.catalog({
    borrowerArtistId: 3102,
  });
  assert.ok(catalog.some(m => m.id === source.id));
  assert.ok(
    catalog.every(m => !("currentQuantity" in m) && !("unitCost" in m))
  );
  const loan = await borrower.inventory.loans.request(requestInput);
  assert.equal(
    (await borrower.inventory.loans.request(requestInput)).id,
    loan.id
  );
  await assert.rejects(
    borrower.inventory.loans.request({ ...requestInput, quantity: "4" })
  );
  assert.equal(await balance(source.id), 5, "request must not deduct stock");
  assert.equal((await third.inventory.loans.list()).length, 0);
  await assert.rejects(third.inventory.loans.detail({ loanId: loan.id }));
  await assert.rejects(foreign.inventory.loans.detail({ loanId: loan.id }));
  const dueAt = studioNow(new Date(Date.now() + 7 * 86400000));
  const approval = { loanId: loan.id, quantity: "3", dueAt, reminderHours: 24 };
  await assert.rejects(borrower.inventory.loans.approve(approval));
  await assert.rejects(
    lender.inventory.loans.approve({ ...approval, quantity: "4" })
  );
  await lender.inventory.loans.approve(approval);
  await lender.inventory.loans.approve(approval);
  assert.equal(await balance(source.id), 5, "approval must not deduct stock");
  await assert.rejects(
    lender.inventory.archive({ tenantMaterialId: source.id })
  );
  await assert.rejects(
    borrower.inventory.loans.deliver({ loanId: loan.id, batchId: original.id })
  );
  await assert.rejects(
    lender.inventory.loans.deliver({ loanId: loan.id }),
    /lote/
  );
  const delivery = await lender.inventory.loans.deliver({
    loanId: loan.id,
    batchId: original.id,
  });
  await lender.inventory.loans.deliver({
    loanId: loan.id,
    batchId: original.id,
  });
  assert.ok(delivery.materialId);
  const receivedId = delivery.materialId!;
  assert.equal(await balance(source.id), 2);
  assert.equal(await balance(receivedId), 3);
  const receivedBatch = (
    await borrower.inventory.batches({ tenantMaterialId: receivedId })
  )[0];
  assert.equal(receivedBatch.lot, "ORIGINAL");
  assert.equal(receivedBatch.supplierName, "Fornecedor empréstimo");
  await assert.rejects(
    borrower.inventory.adjustBalance({
      tenantMaterialId: receivedId,
      newQuantity: "99",
      reason: "Teste",
    })
  );
  await assert.rejects(
    borrower.inventory.receive({
      ...sourceReceipt,
      tenantMaterialId: receivedId,
      receiptKey: randomUUID(),
    })
  );
  await assert.rejects(
    borrower.inventory.archive({ tenantMaterialId: receivedId })
  );
  await assert.rejects(
    third.inventory.loans.request({
      ...requestInput,
      requestKey: randomUUID(),
      borrowerArtistId: 3103,
      sourceMaterialId: receivedId,
    })
  );
  const consumption = await borrower.session.consume({
    procedureId: 3101,
    tenantMaterialId: receivedId,
    batchId: receivedBatch.id,
    quantity: "1",
  });
  assert.equal(
    await balance(source.id),
    2,
    "POD must never debit the lender again"
  );
  assert.equal(await balance(receivedId), 2);
  await borrower.session.revertConsumption({
    consumptionId: consumption.id,
    reason: "Correção de registro",
  });
  await borrower.session.revertConsumption({
    consumptionId: consumption.id,
    reason: "Repetição",
  });
  assert.equal(await balance(receivedId), 3);
  assert.equal(await balance(source.id), 2);
  await borrower.session.consume({
    procedureId: 3101,
    tenantMaterialId: receivedId,
    batchId: receivedBatch.id,
    quantity: "1",
  });
  const partial = {
    loanId: loan.id,
    operationKey: randomUUID(),
    sourceMaterialId: receivedId,
    batchId: receivedBatch.id,
    quantity: "1",
  };
  await assert.rejects(borrower.inventory.loans.settle(partial));
  await lender.inventory.loans.settle(partial);
  await lender.inventory.loans.settle(partial);
  await assert.rejects(
    lender.inventory.loans.settle({ ...partial, quantity: "2" })
  );
  assert.equal(await balance(source.id), 3);
  assert.equal(await balance(receivedId), 1);
  assert.equal(
    (await lender.inventory.loans.detail({ loanId: loan.id })).loan
      .quantitySettled,
    "1.000"
  );
  const replacement = await borrower.inventory.create({
    ...spec,
    ownerArtistId: 3102,
  });
  const replacementBatch = await borrower.inventory.receive({
    ...sourceReceipt,
    tenantMaterialId: replacement.id,
    receiptKey: randomUUID(),
    lot: "REPOSICAO",
    quantity: "4",
    expiresAt: "2098-12-31",
    unitCost: "4.75",
  });
  const settlement = {
    loanId: loan.id,
    operationKey: randomUUID(),
    sourceMaterialId: replacement.id,
    batchId: replacementBatch.id,
    quantity: "2",
  };
  await lender.inventory.loans.settle(settlement);
  await lender.inventory.loans.settle(settlement);
  assert.equal(await balance(source.id), 5);
  assert.equal(await balance(replacement.id), 2);
  const final = await lender.inventory.loans.detail({ loanId: loan.id });
  assert.equal(final.loan.status, "settled");
  assert.equal(final.loan.quantitySettled, "3.000");
  const newLot = (
    await lender.inventory.batches({ tenantMaterialId: source.id })
  ).find(b => b.lot === "REPOSICAO")!;
  assert.equal(newLot.remainingQuantity, "2.000");
  assert.equal(newLot.expiresAt, "2098-12-31 23:59:59");
  assert.equal(newLot.unitCost, "4.7500");
  assert.equal(
    await scalar(
      "SELECT COUNT(*) n FROM tenant_inventory_movements WHERE sourceType='inventory_loan' AND sourceId=?",
      [loan.id]
    ),
    6,
    "three transfers each have exactly two movements"
  );
  assert.equal(
    await scalar("SELECT COUNT(*) n FROM transactions"),
    moneyBefore,
    "loans do not create financial payments"
  );
  assert.equal(
    (await balance(source.id)) +
      (await balance(receivedId)) +
      (await balance(replacement.id)),
    8,
    "nine units received minus one consumed"
  );
  const notices = await borrower.inventory.notices.list();
  assert.ok(notices.length >= 4);
  assert.ok(notices.every(n => n.recipientArtistId === 3102));
  await third.inventory.notices.read({ id: notices[0].id });
  assert.equal(
    (await borrower.inventory.notices.list()).find(n => n.id === notices[0].id)
      ?.readAt,
    null
  );

  // Two independent loans compete for the same final unit.
  const scarce = await lender.inventory.create({
    ...spec,
    name: "Material escasso",
    ownerArtistId: 3101,
    currentQuantity: "1",
  });
  const concurrentLoans = await Promise.all(
    [borrower, third].map((a, i) =>
      a.inventory.loans.request({
        requestKey: randomUUID(),
        sourceMaterialId: scarce.id,
        borrowerArtistId: 3102 + i,
        quantity: "1",
      })
    )
  );
  for (const l of concurrentLoans)
    await lender.inventory.loans.approve({
      ...approval,
      loanId: l.id,
      quantity: "1",
    });
  const attempts = await Promise.allSettled(
    concurrentLoans.map(l => lender.inventory.loans.deliver({ loanId: l.id }))
  );
  assert.equal(attempts.filter(a => a.status === "fulfilled").length, 1);
  assert.equal(await balance(scarce.id), 0);
  const deliveredId =
    concurrentLoans[attempts.findIndex(a => a.status === "fulfilled")].id;
  const soon = studioNow(new Date(Date.now() + 3600000));
  await lender.inventory.loans.extend({
    loanId: deliveredId,
    dueAt: soon,
    reminderHours: 24,
    notes: "Prazo combinado",
  });
  await createLoanDeadlineNotices(db);
  await createLoanDeadlineNotices(db);
  assert.equal(
    await scalar(
      "SELECT COUNT(*) n FROM inventory_notices WHERE loanId=? AND eventKey LIKE '%:deadline:%:soon'",
      [deliveredId]
    ),
    2
  );
  await createLoanDeadlineNotices(db, new Date(Date.now() + 7200000));
  await createLoanDeadlineNotices(db, new Date(Date.now() + 7200000));
  assert.equal(
    await scalar(
      "SELECT COUNT(*) n FROM inventory_notices WHERE loanId=? AND eventKey LIKE '%:deadline:%:overdue'",
      [deliveredId]
    ),
    2
  );

  // Shared studio stock warns each artist, includes all earlier demand, and never reserves stock.
  const studioMaterial = await admin.inventory.create({
    ...spec,
    name: "Insumo compartilhado",
    ownerArtistId: null,
    currentQuantity: "2",
    minimumQuantity: "0",
  });
  const future = studioNow(new Date(Date.now() + 5 * 86400000));
  const later = studioNow(new Date(Date.now() + 6 * 86400000));
  await c.query(
    "INSERT INTO appointments(id,studioId,clientId,artistId,artist,service,duration,date,status) VALUES(3101,101,3101,3102,'Recebedor','Sessão',60,?,'agendado'),(3102,101,3101,3103,'Terceiro artista','Sessão',60,?,'confirmado')",
    [future, later]
  );
  await assert.rejects(
    borrower.planning.add({
      appointmentId: 3101,
      tenantMaterialId: studioMaterial.id,
      quantityPlanned: "3",
    })
  );
  await admin.inventory.setSuppliedArtists({
    tenantMaterialId: studioMaterial.id,
    artistIds: [3102, 3103],
  });
  const planned = await borrower.planning.add({
    appointmentId: 3101,
    tenantMaterialId: studioMaterial.id,
    quantityPlanned: "3",
  });
  await third.planning.add({
    appointmentId: 3102,
    tenantMaterialId: studioMaterial.id,
    quantityPlanned: "1",
  });
  assert.equal(await balance(studioMaterial.id), 2);
  const forecasts = await third.planning.forecast({ appointmentId: 3102 });
  assert.equal(forecasts[0]?.projectedQuantity, -2);
  assert.equal(forecasts[0]?.level, "shortage");
  await assert.rejects(lender.planning.forecast({ appointmentId: 3101 }));
  await assert.rejects(
    lender.planning.listByAppointment({ appointmentId: 3101 })
  );
  await assert.rejects(
    lender.planning.markUnused({ plannedMaterialId: planned.id! })
  );
  await assert.rejects(
    lender.planning.updateQuantity({
      plannedMaterialId: planned.id!,
      expectedQuantity: "3",
      quantity: "1",
    })
  );
  await assert.rejects(
    borrower.planning.updateQuantity({
      plannedMaterialId: planned.id!,
      expectedQuantity: "9",
      quantity: "1",
    })
  );
  const preview = await third.planning.preview({
    artistId: 3103,
    date: later,
    items: [{ tenantMaterialId: studioMaterial.id, quantity: "2" }],
  });
  assert.equal(preview[0]?.projectedQuantity, -4);
  await queueCriticalForecastAlerts(db, 101, 3101, studioMaterial.id);
  await queueCriticalForecastAlerts(db, 101, 3102, studioMaterial.id);
  const initialCount = await scalar(
    "SELECT COUNT(*) n FROM inventory_notices WHERE materialId=? AND kind='forecast'",
    [studioMaterial.id]
  );
  assert.equal(initialCount, 4);
  await borrower.inventory.notices.savePreferences({ leadHours: 200 });
  await third.inventory.notices.savePreferences({ leadHours: 200 });
  await queueCriticalForecastAlerts(db, 101, 3101, studioMaterial.id);
  await queueCriticalForecastAlerts(db, 101, 3102, studioMaterial.id);
  assert.equal(
    await scalar(
      "SELECT COUNT(*) n FROM inventory_notices WHERE materialId=? AND kind='forecast'",
      [studioMaterial.id]
    ),
    8,
    "advance checks notify both affected artists once"
  );
  await admin.inventory.adjustBalance({
    tenantMaterialId: studioMaterial.id,
    newQuantity: "20",
    reason: "Reposição",
  });
  await queueCriticalForecastAlerts(db, 101, 3101, studioMaterial.id);
  await queueCriticalForecastAlerts(db, 101, 3102, studioMaterial.id);
  assert.equal(
    await scalar(
      "SELECT COUNT(*) n FROM inventory_notices WHERE materialId=? AND kind='forecast' AND resolvedAt IS NULL",
      [studioMaterial.id]
    ),
    0
  );
  await admin.inventory.adjustBalance({
    tenantMaterialId: studioMaterial.id,
    newQuantity: "2",
    reason: "Conferência",
  });
  await queueCriticalForecastAlerts(db, 101, 3101, studioMaterial.id);
  assert.equal(
    await scalar(
      "SELECT COUNT(*) n FROM inventory_notices WHERE materialId=? AND kind='forecast' AND resolvedAt IS NULL",
      [studioMaterial.id]
    ),
    2,
    "a recurring shortage creates a fresh warning"
  );
  await borrower.planning.updateQuantity({
    plannedMaterialId: planned.id!,
    expectedQuantity: "3",
    quantity: "1",
  });
  assert.equal(
    (await borrower.planning.forecast({ appointmentId: 3101 }))[0]?.level,
    "available"
  );
  const deadlineNotice = (await lender.inventory.notices.list()).find(n => n.loanId === deliveredId && n.eventKey.endsWith(":soon"))!;
  const noticeMessage = `${deadlineNotice.title}\n${deadlineNotice.message}`;
  await c.query("UPDATE artists SET phone='31999991111' WHERE id=3101");
  assert.match((await inventoryNoticeDeliveryError(db, 101, deadlineNotice.id, "31999991111", noticeMessage))!, /não ativou/);
  await lender.inventory.notices.savePreferences({ leadHours: 48, whatsappEnabled: true });
  assert.equal(await inventoryNoticeDeliveryError(db, 101, deadlineNotice.id, "31999991111", noticeMessage), null);
  assert.ok(await inventoryNoticeDeliveryError(db, 202, deadlineNotice.id, "31999991111", noticeMessage));
  assert.ok(await inventoryNoticeDeliveryError(db, 101, deadlineNotice.id, "31999992222", noticeMessage));
  assert.ok(await inventoryNoticeDeliveryError(db, 101, deadlineNotice.id, "31999991111", "Outra mensagem"));
  await lender.inventory.notices.savePreferences({ leadHours: 48, whatsappEnabled: false });
  assert.ok(await inventoryNoticeDeliveryError(db, 101, deadlineNotice.id, "31999991111", noticeMessage));
  await c.end();
  console.log(
    "PASS: tenant and party permissions, stock transfers, lot trace, concurrent delivery, idempotency, POD consumption/reversal, partial settlement, replacement lot, no financial duplication, deadlines and forecast alerts per artist"
  );
}
main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
