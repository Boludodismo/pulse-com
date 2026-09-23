/** Explicit, isolated staging check. Never executed by production startup. */
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { nativeBotRouter } from "../routers/nativeBot";
import {
  ensureNativeBotSchema,
  assertBotSchema,
  botPool,
  rows,
  exec,
  utcSql,
} from "../nativeBot/database";
import { getProfile, settings } from "../nativeBot/access";
import {
  processBotInbound,
  queueBotMessage,
  validateBotDelivery,
  deliverBotMessage,
} from "../nativeBot/service";
import { receiveNativeBotWebhook } from "../nativeBot/webhook";
import { DEFAULT_BOT_PERMISSIONS } from "../../shared/nativeBot";

if (
  process.env.BOT_RUN_INTEGRATION_CHECK !== "true" ||
  process.env.RAILWAY_ENVIRONMENT_ID !==
    "92e8281a-668a-43ed-b2ba-cac84082a91c" ||
  process.env.OUTBOUND_MESSAGING_DISABLED !== "true"
)
  throw new Error(
    "This check requires the isolated staging environment with outbound messaging blocked."
  );
globalThis.fetch = async () => {
  throw new Error("Network calls are forbidden in this database check.");
};
const studios: number[] = [];
let checks = 0;
const label = "native-bot-check-" + randomUUID();
function passed(name: string) {
  checks++;
  console.log("[Bot integration] PASS " + name);
}
function caller(studioId: number, artistId: number | null = null) {
  return nativeBotRouter.createCaller({
    user: {
      id: 1,
      studioId,
      artistId,
      role: artistId ? "collaborator" : "admin",
      openId: artistId ? "artist-invite:bot-test" : "bot-test-admin",
      isActive: 1,
      accessStatus: "active",
    } as any,
    req: {} as any,
    res: {} as any,
  });
}
async function forbidden(fn: () => Promise<unknown>) {
  await assert.rejects(fn, (e: any) => e.code === "FORBIDDEN");
}
async function callback(key: string, body: unknown) {
  let status = 200,
    content: any;
  const res: any = {
    status: (s: number) => {
      status = s;
      return res;
    },
    sendStatus: (s: number) => {
      status = s;
      return res;
    },
    json: (v: unknown) => {
      content = v;
      return res;
    },
  };
  await receiveNativeBotWebhook({ params: { key }, body } as any, res);
  return { status, content };
}
let exitCode = 0;
try {
  await ensureNativeBotSchema();
  assertBotSchema();
  await ensureNativeBotSchema();
  passed("additive schema is restartable");
  for (let i = 0; i < 2; i++)
    studios.push(
      (
        await exec("INSERT INTO studios(name,masterKey) VALUES(?,?)", [
          label + "-" + i,
          randomBytes(24).toString("hex"),
        ])
      ).insertId
    );
  const a = (
    await exec("INSERT INTO artists(name,studioId) VALUES(?,?)", [
      "Artista teste A",
      studios[0],
    ])
  ).insertId;
  const b = (
    await exec("INSERT INTO artists(name,studioId) VALUES(?,?)", [
      "Artista teste B",
      studios[0],
    ])
  ).insertId;
  const c = (
    await exec("INSERT INTO artists(name,studioId) VALUES(?,?)", [
      "Artista teste C",
      studios[1],
    ])
  ).insertId;
  const admin = caller(studios[0]),
    artistA = caller(studios[0], a),
    artistB = caller(studios[0], b),
    other = caller(studios[1]);
  assert.equal((await admin.snapshot({})).enabled, false);
  await forbidden(() => artistA.snapshot({}));
  await admin.setEnabled({ enabled: true });
  await admin.setArtistAccess({
    artistId: a,
    enabled: true,
    permissions: DEFAULT_BOT_PERMISSIONS,
  });
  await admin.setArtistAccess({
    artistId: b,
    enabled: true,
    permissions: DEFAULT_BOT_PERMISSIONS,
  });
  await forbidden(() => artistA.snapshot({ artistId: b }));
  await forbidden(() => artistA.snapshot({ artistId: 0 }));
  await forbidden(() => admin.snapshot({ artistId: c }));
  await forbidden(() => artistA.setEnabled({ enabled: false }));
  passed("studio and artist permissions enforced in real tRPC procedures");
  const cl = await artistA.saveClient({
    name: "Cliente de teste",
    phone: "(11) 99999-8888",
    artistId: a,
  });
  assert.equal((await artistA.clients({})).length, 1);
  assert.equal((await artistB.clients({})).length, 0);
  assert.equal((await other.clients({})).length, 0);
  await forbidden(() =>
    artistB.saveClient({
      id: cl.id,
      name: "Nome indevido",
      phone: "11999998888",
      artistId: b,
    })
  );
  await forbidden(() => other.setConsent({ clientId: cl.id, enabled: true }));
  await artistA.setConsent({ clientId: cl.id, enabled: true });
  assert.equal((await artistA.clients({}))[0].optIn, 1);
  passed("real client records and consent isolated by owner");
  let snap = await artistA.snapshot({});
  const config = { ...snap.profile.config, address: "Rua de teste, 10" };
  await artistA.saveConfig({
    section: "assistant",
    config,
    version: snap.profile.version,
  });
  assert.equal(
    (await artistA.snapshot({})).profile.config.address,
    "Rua de teste, 10"
  );
  await assert.rejects(
    () =>
      artistA.saveConfig({
        section: "assistant",
        config,
        version: snap.profile.version,
      }),
    (e: any) => e.code === "CONFLICT"
  );
  await admin.setArtistAccess({
    artistId: a,
    enabled: true,
    permissions: { ...DEFAULT_BOT_PERMISSIONS, messages: false },
  });
  snap = await artistA.snapshot({});
  await forbidden(() =>
    artistA.saveConfig({
      section: "messages",
      config: snap.profile.config,
      version: snap.profile.version,
    })
  );
  passed("configuration persists, permissions and concurrent edits enforced");
  const preview = await artistA.preview({ text: "oi", outside: false });
  assert.match(preview.text || "", /Artista teste A/);
  assert.equal(
    (
      await rows("SELECT id FROM tatuei_bot_messages WHERE studio_id=?", [
        studios[0],
      ])
    ).length,
    0
  );
  passed("simulator uses own profile without creating outbound messages");
  await admin.saveAi({
    key: "test-key-not-real-123456789",
    model: "gpt-4.1-mini",
    dailyLimit: 5,
  });
  const secured = await admin.snapshot({});
  assert.equal(secured.connection?.aiConfigured, true);
  assert(!JSON.stringify(secured).includes("test-key-not-real"));
  assert(!JSON.stringify(secured).includes("ai_secret"));
  assert.equal((await artistA.snapshot({})).connection, null);
  passed("credentials never returned to client or artists");
  await admin.saveWhatsapp({
    instanceId: "instance-test-native",
    token: "token-test-native",
    clientToken: "client-test-native",
  });
  const s = await settings(studios[0]);
  assert(s.webhook_key);
  await exec(
    "UPDATE tatuei_bot_settings SET webhook_ready=1,wa_status='connected' WHERE studio_id=?",
    [studios[0]]
  );
  const ev = {
    instanceId: s.wa_instance,
    messageId: "inbound-" + randomUUID(),
    phone: "5511999998888",
    fromMe: false,
    type: "ReceivedCallback",
    text: { message: "oi" },
  };
  assert.equal(
    (await callback(s.webhook_key, { ...ev, instanceId: "wrong-instance" }))
      .status,
    403
  );
  assert.equal(
    (await callback(s.webhook_key, { ...ev, isGroup: true })).content.ignored,
    true
  );
  assert.equal((await callback(s.webhook_key, ev)).status, 200);
  assert.equal((await callback(s.webhook_key, ev)).status, 200);
  assert.equal(
    (
      await rows(
        "SELECT id FROM tatuei_bot_messages WHERE studio_id=? AND external_id=?",
        [studios[0], ev.messageId]
      )
    ).length,
    1
  );
  const thread = (await admin.conversations({}))[0];
  assert.equal(thread.artist_id, a);
  await forbidden(() => artistB.thread({ id: thread.id }));
  await forbidden(() => other.thread({ id: thread.id }));
  passed("webhook scopes instance, ignores groups and deduplicates callbacks");
  const initial = (await artistA.thread({ id: thread.id })).conversation;
  const profile = await getProfile(studios[0], a);
  await queueBotMessage(initial, "Resposta atrasada", {
    eventKey: "check-delay",
    delayMinutes: 10,
    profileVersion: profile.version,
  });
  await artistA.setMode({ id: thread.id, mode: "human" });
  assert.equal(
    (
      await rows(
        "SELECT status FROM tatuei_bot_messages WHERE studio_id=? AND event_key=?",
        [studios[0], "check-delay"]
      )
    )[0].status,
    "canceled"
  );
  passed("human takeover cancels delayed bot messages");
  const requestId = randomUUID();
  await artistA.send({ id: thread.id, body: "Mensagem um", requestId });
  await artistA.send({ id: thread.id, body: "Mensagem um", requestId });
  await artistA.send({
    id: thread.id,
    body: "Mensagem dois",
    requestId: randomUUID(),
  });
  const queued = await rows(
    "SELECT * FROM tatuei_bot_messages WHERE studio_id=? AND role='staff' AND status='queued' ORDER BY id",
    [studios[0]]
  );
  assert.equal(queued.length, 2);
  const cv = (await artistA.thread({ id: thread.id })).conversation;
  for (const m of queued)
    assert.equal(
      await validateBotDelivery(m, cv, await settings(studios[0]), botPool()),
      null
    );
  passed(
    "manual sends are idempotent and consecutive messages remain deliverable"
  );
  await deliverBotMessage(queued[0], botPool());
  assert.equal(
    (
      await rows("SELECT status FROM tatuei_bot_messages WHERE id=?", [
        queued[0].id,
      ])
    )[0].status,
    "failed"
  );
  passed("staging cannot send to real WhatsApp");
  await processBotInbound(
    { id: 0, conversation_id: thread.id, studio_id: studios[0], body: "parar" },
    botPool()
  );
  assert.equal(
    (await artistA.thread({ id: thread.id })).conversation.opted_out,
    1
  );
  assert.equal((await artistA.clients({}))[0].optIn, 0);
  await assert.rejects(() => artistA.setMode({ id: thread.id, mode: "bot" }));
  await processBotInbound(
    {
      id: 0,
      conversation_id: thread.id,
      studio_id: studios[0],
      body: "retomar atendimento",
    },
    botPool()
  );
  assert.equal(
    (await artistA.thread({ id: thread.id })).conversation.opted_out,
    0
  );
  assert.equal((await artistA.clients({}))[0].optIn, 0);
  passed(
    "customer opt-out blocks sends; explicit resumption does not restore marketing consent"
  );
  await exec("UPDATE clients SET artistId=? WHERE id=? AND studioId=?", [
    b,
    cl.id,
    studios[0],
  ]);
  await forbidden(() => artistA.thread({ id: thread.id }));
  assert.equal((await artistA.conversations({})).length, 0);
  passed("client reassignment revokes previous artist conversation access");
  await admin.setEnabled({ enabled: false });
  assert.equal(
    (
      await rows(
        "SELECT id FROM tatuei_bot_messages WHERE studio_id=? AND status='queued'",
        [studios[0]]
      )
    ).length,
    0
  );
  passed("pausing the module cancels pending work");
  console.log("[Bot integration] ALL " + checks + " CHECKS PASSED");
} catch (e) {
  exitCode = 1;
  console.error(
    "[Bot integration] FAILED after " +
      checks +
      " checks: " +
      (e instanceof Error ? e.message : "unknown error")
  );
} finally {
  for (const id of studios) {
    for (const table of [
      "tatuei_bot_messages",
      "tatuei_bot_conversations",
      "tatuei_bot_consents",
      "tatuei_bot_history",
      "tatuei_bot_profiles",
      "tatuei_bot_settings",
    ])
      await exec(`DELETE FROM ${table} WHERE studio_id=?`, [id]);
    for (const table of ["clients", "artists"])
      await exec(`DELETE FROM ${table} WHERE studioId=?`, [id]);
    await exec("DELETE FROM studios WHERE id=? AND name LIKE ?", [
      id,
      label + "%",
    ]);
  }
  console.log("[Bot integration] Isolated fixtures removed.");
  await botPool().end();
}
process.exit(exitCode);
