import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import mysql, { type RowDataPacket } from "mysql2/promise";
import { upgradeAppointmentKits } from "../server/_core/appointmentKitSchema";
import { podSaasRouter } from "../server/routers/podSaas";
import { router } from "../server/_core/trpc";
import { getDb } from "../server/db";
import { studioNow } from "../server/inventoryWorkflowRules";
import { syncMaterialRegistrationNotices } from "../server/materialRegistrationNotices";
import { inventoryNoticeDeliveryError } from "../server/inventoryNoticeDelivery";

async function main() {
  const url = new URL(process.env.DATABASE_URL!);
  assert.equal(process.env.CI, "true");
  assert.ok(["127.0.0.1", "localhost"].includes(url.hostname));
  assert.equal(url.pathname, "/supplier_test");
  const c = await mysql.createConnection({
    uri: url.toString(),
    dateStrings: true,
  });
  // Match the existing production template schema in this isolated fixture database.
  const templates = await readFile(
    "drizzle/0053_session_inventory_kits.sql",
    "utf8"
  );
  for (const statement of templates
    .split(";")
    .map(s => s.trim())
    .filter(Boolean))
    await c.query(statement);
  await upgradeAppointmentKits(c);
  await upgradeAppointmentKits(c);
  await c.query(
    "INSERT INTO artists(id,studioId,name,active,phone) VALUES(4101,101,'Artista do kit',1,'31999994444'),(4102,101,'Outro artista',1,NULL),(4201,202,'Artista externo',1,NULL)"
  );
  await c.query(
    "INSERT INTO clients(id,studioId,name) VALUES(4101,101,'João Cliente'),(4201,202,'Cliente externo')"
  );
  const future = studioNow(new Date(Date.now() + 5 * 86400000));
  await c.query(
    "INSERT INTO appointments(id,studioId,clientId,artistId,artist,service,duration,date,status) VALUES(4101,101,4101,4101,'Artista do kit','Sessão',60,?,'agendado'),(4102,101,4101,4102,'Outro artista','Sessão',60,?,'confirmado'),(4201,202,4201,4201,'Artista externo','Sessão',60,?,'agendado')",
    [future, future, future]
  );
  await c.query(
    "INSERT INTO technical_procedures(id,studioId,clientId,artistId,appointmentId,title,status) VALUES(4101,101,4101,4101,4101,'Sessão do kit','em_andamento')"
  );
  for (const id of [4101, 4102])
    for (const module of ["stock", "appointments", "pod"])
      await c.query(
        "INSERT INTO user_module_permissions(userId,studioId,module,canRead,canWrite) VALUES(?,101,?,1,1)",
        [id, module]
      );
  const root = router({ pod: podSaasRouter });
  const caller = (studioId: number, artistId?: number) =>
    root.createCaller({
      user: {
        id: artistId ?? studioId,
        openId: artistId ? `artist-invite:kit-${artistId}` : "test",
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
    artist = caller(101, 4101),
    other = caller(101, 4102),
    foreign = caller(202);
  const db = (await getDb())!;
  const scalar = async (query: string, values: unknown[] = []) =>
    Number((await c.query<RowDataPacket[]>(query, values))[0][0].n);
  const kitApi = artist.planning.clientKit;
  const createEmpty = {
    appointmentId: 4101,
    operationKey: randomUUID(),
    name: "Reforma oriental de João",
    items: [],
  };
  await kitApi.save(createEmpty);
  assert.equal(
    (await kitApi.get({ appointmentId: 4101 }))?.name,
    createEmpty.name,
    "an empty inventory must not block creating a client kit"
  );
  assert.equal(
    (await artist.planning.listByAppointment({ appointmentId: 4101 })).length,
    0
  );
  await assert.rejects(other.planning.clientKit.get({ appointmentId: 4101 }));
  await assert.rejects(foreign.planning.clientKit.get({ appointmentId: 4101 }));
  await assert.rejects(
    other.planning.clientKit.save({
      ...createEmpty,
      operationKey: randomUUID(),
    })
  );
  await assert.rejects(
    kitApi.save({
      ...createEmpty,
      appointmentId: 4201,
      operationKey: randomUUID(),
    })
  );

  const stock = await artist.inventory.create({
    ownerArtistId: 4101,
    name: "Cartucho cadastrado",
    unit: "unidade",
    currentQuantity: "10",
    minimumQuantity: "2",
    unitCost: "1",
  });
  const materialCount = await scalar("SELECT COUNT(*) n FROM tenant_materials");
  const movementCount = await scalar(
    "SELECT COUNT(*) n FROM tenant_inventory_movements"
  );
  const save = {
    appointmentId: 4101,
    operationKey: randomUUID(),
    name: createEmpty.name,
    items: [
      { tenantMaterialId: stock.id, quantity: "2" },
      { name: "Cartucho especial 3RL 0,25 mm", unit: "un", quantity: "3" },
    ],
  };
  await Promise.all([kitApi.save(save), kitApi.save(save)]);
  await kitApi.save(save);
  await assert.rejects(
    kitApi.save({ ...save, name: "Outro nome com mesma chave" })
  );
  const rows = await artist.planning.listByAppointment({ appointmentId: 4101 });
  assert.equal(rows.length, 2);
  const missing = rows.find(r => !r.tenantMaterialId)!;
  assert.equal(missing.nameSnapshot, "Cartucho especial 3RL 0,25 mm");
  assert.equal(missing.quantityPlanned, "3.000");
  assert.equal(
    await scalar("SELECT COUNT(*) n FROM tenant_materials"),
    materialCount
  );
  assert.equal(
    await scalar("SELECT COUNT(*) n FROM tenant_inventory_movements"),
    movementCount
  );
  assert.equal(
    await scalar("SELECT currentQuantity n FROM tenant_materials WHERE id=?", [
      stock.id,
    ]),
    10
  );
  await syncMaterialRegistrationNotices(db, 101, 4101);
  await syncMaterialRegistrationNotices(db, 101, 4101);
  let notices = (await artist.inventory.notices.list()).filter(
    n => n.kind === "material_registration" && n.appointmentId === 4101
  );
  assert.equal(notices.length, 1);
  assert.equal(notices[0].recipientArtistId, 4101);
  assert.ok(notices[0].message.includes("João · Artista do kit"));
  assert.ok(notices[0].message.includes("3.000 un"));
  assert.equal(
    (await other.inventory.notices.list()).filter(n => n.appointmentId === 4101)
      .length,
    0
  );

  // Adding a kit is atomic even when one requested stock item is invalid.
  await assert.rejects(
    kitApi.save({
      appointmentId: 4101,
      operationKey: randomUUID(),
      name: "Não deve sobrescrever",
      items: [
        { name: "Item que deve reverter", unit: "un", quantity: "1" },
        { tenantMaterialId: 99999999, quantity: "1" },
      ],
    })
  );
  assert.equal(
    (await kitApi.get({ appointmentId: 4101 }))?.name,
    createEmpty.name
  );
  assert.equal(
    (await artist.planning.listByAppointment({ appointmentId: 4101 })).length,
    2
  );
  await assert.rejects(
    kitApi.save({
      appointmentId: 4101,
      operationKey: randomUUID(),
      items: [{ name: "Quantidade inválida", unit: "un", quantity: "0" }],
    })
  );

  await artist.inventory.notices.savePreferences({
    leadHours: 48,
    whatsappEnabled: true,
  });
  assert.equal(
    await inventoryNoticeDeliveryError(
      db,
      101,
      notices[0].id,
      "31999994444",
      `${notices[0].title}\n${notices[0].message}`
    ),
    null
  );
  await assert.rejects(
    artist.session.consume({
      procedureId: 4101,
      plannedMaterialId: missing.id,
      tenantMaterialId: stock.id,
      quantity: "1",
    }),
    /Vincule/
  );
  const wrongUnit = await artist.inventory.create({
    ownerArtistId: 4101,
    name: "Outra unidade",
    unit: "ml",
    currentQuantity: "0",
    unitCost: "1",
  });
  await assert.rejects(
    kitApi.linkMaterial({
      appointmentId: 4101,
      plannedMaterialId: missing.id,
      tenantMaterialId: wrongUnit.id,
    }),
    /unidades/
  );
  const otherStock = await other.inventory.create({
    ownerArtistId: 4102,
    name: "Cartucho de outro artista",
    unit: "un",
    currentQuantity: "10",
    unitCost: "1",
  });
  await assert.rejects(
    kitApi.linkMaterial({
      appointmentId: 4101,
      plannedMaterialId: missing.id,
      tenantMaterialId: otherStock.id,
    })
  );
  await assert.rejects(
    other.planning.clientKit.linkMaterial({
      appointmentId: 4101,
      plannedMaterialId: missing.id,
      tenantMaterialId: otherStock.id,
    })
  );
  const registered = await artist.inventory.create({
    ownerArtistId: 4101,
    name: missing.nameSnapshot,
    unit: "unidade",
    currentQuantity: "0",
    unitCost: "2",
  });
  const link = {
    appointmentId: 4101,
    plannedMaterialId: missing.id,
    tenantMaterialId: registered.id,
  };
  await kitApi.linkMaterial(link);
  await kitApi.linkMaterial(link);
  assert.equal(
    await scalar("SELECT currentQuantity n FROM tenant_materials WHERE id=?", [
      registered.id,
    ]),
    0,
    "linking does not invent a stock receipt"
  );
  assert.equal(
    (await artist.planning.listByAppointment({ appointmentId: 4101 })).find(
      r => r.id === missing.id
    )?.tenantMaterialId,
    registered.id
  );
  await assert.rejects(
    kitApi.linkMaterial({ ...link, tenantMaterialId: stock.id })
  );
  notices = (await artist.inventory.notices.list()).filter(
    n => n.kind === "material_registration" && n.appointmentId === 4101
  );
  assert.ok(notices.every(n => n.resolvedAt));
  assert.ok(
    await inventoryNoticeDeliveryError(
      db,
      101,
      notices[0].id,
      "31999994444",
      `${notices[0].title}\n${notices[0].message}`
    )
  );
  assert.equal(
    (await artist.planning.forecast({ appointmentId: 4101 })).find(
      f => f?.material.id === registered.id
    )?.level,
    "shortage",
    "registration completion still checks the real stock balance"
  );

  // A reusable template is copied; the second appointment keeps independent quantities.
  const template = await artist.planning.kits.create({
    name: "Modelo básico",
    items: [{ tenantMaterialId: stock.id, quantity: "2" }],
  });
  const model = (await artist.planning.kits.list()).find(
    k => k.id === template.id
  )!;
  await admin.planning.clientKit.save({
    appointmentId: 4102,
    name: "Kit do outro atendimento",
    operationKey: randomUUID(),
    items: [
      {
        name: model.items[0].materialName,
        unit: model.items[0].unit,
        quantity: "4",
      },
    ],
  });
  assert.equal(
    (await kitApi.get({ appointmentId: 4101 }))?.name,
    createEmpty.name
  );
  assert.equal(
    (await other.planning.clientKit.get({ appointmentId: 4102 }))?.name,
    "Kit do outro atendimento"
  );
  assert.equal(
    (await artist.planning.kits.list()).find(k => k.id === template.id)
      ?.items[0].quantity,
    "2.000"
  );

  await kitApi.save({
    appointmentId: 4101,
    operationKey: randomUUID(),
    items: [{ name: "Proteção adicional", unit: "unidade", quantity: "1" }],
  });
  const stillMissing = (
    await artist.planning.listByAppointment({ appointmentId: 4101 })
  ).find(r => !r.tenantMaterialId)!;
  await artist.inventory.notices.savePreferences({ leadHours: 200 });
  await syncMaterialRegistrationNotices(db, 101, 4101);
  await syncMaterialRegistrationNotices(db, 101, 4101);
  assert.equal(
    await scalar(
      "SELECT COUNT(*) n FROM inventory_notices WHERE kind='material_registration' AND appointmentId=4101 AND resolvedAt IS NULL"
    ),
    1
  );
  assert.equal(
    await scalar(
      "SELECT COUNT(*) n FROM inventory_notices WHERE kind='material_registration' AND appointmentId=4101 AND eventKey LIKE ?",
      [`material-registration:${stillMissing.id}:%`]
    ),
    2,
    "one initial notice and one advance reminder"
  );
  await c.query(
    "UPDATE appointments SET artistId=4102,artist='Outro artista' WHERE id=4101"
  );
  await syncMaterialRegistrationNotices(db, 101, 4101);
  assert.equal(
    (await artist.inventory.notices.list()).filter(
      n =>
        n.kind === "material_registration" &&
        n.appointmentId === 4101 &&
        !n.resolvedAt
    ).length,
    0
  );
  assert.equal(
    (await other.inventory.notices.list()).filter(
      n =>
        n.kind === "material_registration" &&
        n.appointmentId === 4101 &&
        !n.resolvedAt
    ).length,
    1
  );
  await other.planning.markUnused({ plannedMaterialId: stillMissing.id });
  assert.equal(
    (await other.inventory.notices.list()).filter(
      n =>
        n.kind === "material_registration" &&
        n.appointmentId === 4101 &&
        !n.resolvedAt
    ).length,
    0
  );
  await c.query("UPDATE appointments SET status='cancelado' WHERE id=4102");
  await syncMaterialRegistrationNotices(db, 101, 4102);
  assert.equal(
    (await other.inventory.notices.list()).filter(
      n =>
        n.kind === "material_registration" &&
        n.appointmentId === 4102 &&
        !n.resolvedAt
    ).length,
    0
  );
  await c.end();
  console.log(
    "PASS: empty client kit, atomic/idempotent saves, tenant/artist scope, free materials without stock movement, registration reminders, unit-safe linking, real forecast, independent templates, advance reminder, reassignment and cancellation"
  );
}
main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
