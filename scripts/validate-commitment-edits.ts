import assert from "node:assert/strict";
import mysql from "mysql2/promise";
import { database, ensureCommitmentsSchema } from "../server/commitments/db";
import { commitmentsRouter } from "../server/commitments/router";
import { commitmentAppearance } from "../shared/commitmentPresentation";
const url = new URL(process.env.DATABASE_URL || "");
assert.equal(process.env.CI, "true");
assert.equal(url.hostname, "127.0.0.1");
assert.equal(url.pathname, "/commitment_validation");
const c = await mysql.createConnection(process.env.DATABASE_URL!);
try {
  await c.query(
    "CREATE TABLE users(id INT PRIMARY KEY,studioId INT NULL,role VARCHAR(24),isActive TINYINT)"
  );
  await c.query("INSERT INTO users VALUES(10,NULL,'superadmin',1)");
  await c.query(
    "CREATE TABLE calendars(id INT PRIMARY KEY,userId INT,name VARCHAR(100),color VARCHAR(7),isVisible TINYINT,isDefault TINYINT)"
  );
  await c.query(
    "INSERT INTO calendars VALUES(1,10,'Meu calendário','#FF9500',1,1)"
  );
  await ensureCommitmentsSchema();
  await ensureCommitmentsSchema();
  const caller = commitmentsRouter.createCaller({
    user: {
      id: 10,
      openId: "ci-test",
      studioId: null,
      artistId: null,
      role: "superadmin",
      isActive: 1,
    },
    req: {},
    res: {},
  } as any);
  const file = {
    name: "boleto.pdf",
    mime: "application/pdf" as const,
    data: Buffer.from("%PDF-1.4\n%%EOF").toString("base64"),
  };
  const created = await caller.create({
    title: "Conta",
    category: "fixed",
    calendarId: 1,
    calendarName: "Meu calendário",
    color: "#FF9500",
    customColor: "#123456",
    attachments: [file],
    amount: 5000,
    startDate: "2026-10-12",
    endDate: null,
    repeatKind: "monthly",
    repeatInterval: 1,
    shiftBusiness: false,
    notes: "Original",
    assigneeId: 10,
  });
  let list = await caller.list({ from: "2026-10-12", to: "2026-11-12" });
  assert.equal(list.length, 2);
  assert.equal(list[0].color, "#123456");
  await caller.action({
    id: list[0].id,
    revision: list[0].revision,
    action: "paid",
  });
  list = await caller.list({ from: "2026-10-12", to: "2026-11-12" });
  assert.equal(list[0].status, "paid");
  assert.equal(list[1].status, "pending");
  assert.equal(commitmentAppearance(list[0], "2026-11-13").color, "#22c55e");
  assert.equal(commitmentAppearance(list[1], "2026-11-13").label, "Atrasado");
  const detail = await caller.detail({ id: list[0].id });
  const edit = {
    id: detail.id,
    revision: detail.revision,
    title: "Editada",
    amount: 6000,
    notes: "Nova",
    customColor: "#abcdef",
    attachments: [file],
    removeAttachmentIds: [detail.attachments[0].id],
    expectedAttachmentIds: [detail.attachments[0].id],
    expected: {
      title: detail.title,
      amount: detail.amount,
      notes: detail.notes,
      customColor: detail.customColor,
    },
  };
  await caller.save(edit);
  const saved = await caller.detail({ id: detail.id });
  assert.equal(saved.title, "Editada");
  assert.equal(saved.color, "#abcdef");
  assert.equal(saved.attachments.length, 1);
  assert.equal(saved.status, "paid");
  const sibling = (
    await caller.list({ from: "2026-10-12", to: "2026-11-12" })
  )[1];
  assert.equal(sibling.status, "pending");
  assert.equal(sibling.color, "#abcdef");
  assert.equal(sibling.effectiveDate, "2026-11-12");
  await assert.rejects(caller.save(edit), (e: any) => e.code === "CONFLICT");
  await c.query(
    "CREATE TRIGGER reject_attachment BEFORE INSERT ON commitment_attachments FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='CI injected failure'"
  );
  await assert.rejects(
    caller.save({
      ...edit,
      title: "Must roll back",
      expected: {
        title: saved.title,
        amount: saved.amount,
        notes: saved.notes,
        customColor: saved.customColor,
      },
      expectedAttachmentIds: [saved.attachments[0].id],
      removeAttachmentIds: [saved.attachments[0].id],
    })
  );
  const rolledBack = await caller.detail({ id: detail.id });
  assert.equal(rolledBack.title, "Editada");
  assert.equal(rolledBack.attachments[0].id, saved.attachments[0].id);
  await c.query("DROP TRIGGER reject_attachment");
  await caller.save({
    ...edit,
    title: saved.title,
    amount: saved.amount,
    notes: saved.notes,
    customColor: null,
    attachments: [],
    removeAttachmentIds: [],
    expectedAttachmentIds: [saved.attachments[0].id],
    expected: {
      title: saved.title,
      amount: saved.amount,
      notes: saved.notes,
      customColor: saved.customColor,
    },
  });
  assert.equal((await caller.detail({ id: detail.id })).color, "#FF9500");
  console.log(
    "Commitment MySQL validation passed: custom/calendar colors, atomic files, rollback, concurrent edit rejection, recurrence and independent payments."
  );
} finally {
  await c.end();
  await database().end();
}
