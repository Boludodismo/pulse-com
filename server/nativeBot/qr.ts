import makeWASocket, {
  BufferJSON,
  DisconnectReason,
  initAuthCreds,
  normalizeMessageContent,
  downloadContentFromMessage,
  proto,
  type AuthenticationState,
  type WASocket,
} from "@whiskeysockets/baileys";
import mysql, { type Connection } from "mysql2/promise";
import pino from "pino";
import QRCode from "qrcode";
import { randomBytes } from "node:crypto";
import {
  rows,
  exec,
  utcSql,
  botAudit,
  withBotLock,
  isNativeBotReady,
} from "./database";
import { sealBotSecret, openBotSecret } from "./crypto";
import { settings, type BotSettings } from "./access";
import { isOutboundMessagingBlocked } from "../messaging/outboundSafety";
import { BotProviderError } from "./providers";
import { persistBotInbound } from "./webhook";
import { inboxChanged } from "./events";
import { saveAttachment, type BotAttachment } from "./attachments";
import { attachmentSchema, MAX_ATTACHMENT_BYTES } from "../../shared/botInbox";
import { applyDeliveryStatus } from "./receipts";

export const isQrBot = (s: Pick<BotSettings, "wa_instance">) =>
  !!s.wa_instance?.startsWith("qr:");
const sessions = new Map<
  number,
  {
    socket?: WASocket;
    lock: Connection;
    instance: string;
    stopped: boolean;
    heartbeat?: ReturnType<typeof setInterval>;
    ownIds: Set<string>;
  }
>();
const starting = new Map<number, Promise<void>>();
const retryAfter = new Map<number, number>();
const failures = new Map<number, number>();
// Never log auth keys, QR codes, phone numbers, message bodies or provider payloads.
const logger = pino({ level: "silent" });
function assertQrEnabled() {
  if (process.env.NATIVE_BOT_QR_ENABLED !== "true")
    throw new BotProviderError(
      "A conexão própria por QR Code precisa ser habilitada no servidor de teste."
    );
  if (isOutboundMessagingBlocked())
    throw new BotProviderError(
      "Conexão externa bloqueada neste ambiente de teste."
    );
}
async function closeLocal(studioId: number, expected?: { instance: string }) {
  const session = sessions.get(studioId);
  if (!session || (expected && session !== expected)) return;
  session.stopped = true;
  sessions.delete(studioId);
  clearInterval(session.heartbeat);
  session.socket?.end(new Error("Sessão encerrada pelo CRM."));
  await session.lock.end().catch(() => {});
}
export async function disconnectQr(studioId: number) {
  // Disabling the slot first makes remote owners stop at their next heartbeat.
  await exec(
    "UPDATE tatuei_bot_settings SET wa_status='disconnected',wa_secret=NULL,wa_instance=NULL,wa_phone=NULL,webhook_ready=0 WHERE studio_id=? AND wa_instance LIKE 'qr:%'",
    [studioId]
  );
  const session = sessions.get(studioId);
  if (session?.socket) await session.socket.logout().catch(() => {});
  await closeLocal(studioId);
  await exec("DELETE FROM tatuei_bot_qr_auth WHERE studio_id=?", [studioId]);
  inboxChanged(studioId);
}
export async function selectQr(studioId: number, actorId: number) {
  assertQrEnabled();
  const result = await withBotLock("tatuei_channel_identity", async c => {
    const current = await settings(studioId, c);
    if (isQrBot(current)) return true;
    await c.beginTransaction();
    try {
      await exec(
        "UPDATE tatuei_bot_settings SET wa_integration_id=NULL,wa_instance=?,wa_secret=?,wa_status='connecting',wa_phone=NULL,webhook_ready=0,last_error=NULL WHERE studio_id=?",
        [
          `qr:${studioId}:${randomBytes(8).toString("hex")}`,
          sealBotSecret("qr-session", studioId),
          studioId,
        ],
        c
      );
      await exec(
        "UPDATE tatuei_bot_messages SET status='canceled',error='Canal de atendimento alterado.' WHERE studio_id=? AND status='queued'",
        [studioId],
        c
      );
      await exec(
        "UPDATE tatuei_bot_conversations SET revision=revision+1,last_inbound_at=NULL WHERE studio_id=?",
        [studioId],
        c
      );
      await botAudit(
        studioId,
        0,
        "Conexão própria por QR selecionada",
        "",
        actorId,
        c
      );
      await c.commit();
    } catch (e) {
      await c.rollback();
      throw e;
    }
    return true;
  });
  if (!result)
    throw new BotProviderError("Conexão em atualização. Tente novamente.");
  await startQr(studioId);
}
export async function qrSnapshot(studioId: number) {
  const s = await settings(studioId);
  const [a] = await rows(
    "SELECT qr_image,qr_expires FROM tatuei_bot_qr_auth WHERE studio_id=?",
    [studioId]
  );
  const expires = a?.qr_expires
    ? Date.parse(a.qr_expires.replace(" ", "T") + "Z")
    : 0;
  return {
    available: process.env.NATIVE_BOT_QR_ENABLED === "true",
    selected: isQrBot(s),
    status: s.wa_status,
    phone: s.wa_phone,
    image:
      isQrBot(s) && expires > Date.now() && a?.qr_image
        ? openBotSecret(a.qr_image, studioId)
        : null,
    expiresAt: expires || null,
    error: s.last_error,
  };
}
export async function startQr(studioId: number) {
  assertQrEnabled();
  if (sessions.has(studioId)) return;
  if (starting.has(studioId)) return starting.get(studioId);
  const job = openQr(studioId).finally(() => starting.delete(studioId));
  starting.set(studioId, job);
  return job;
}
async function openQr(studioId: number) {
  const initial = await settings(studioId);
  if (!isQrBot(initial)) return;
  // A dedicated DB connection owns this session for its entire lifetime, across replicas.
  const lock = await mysql.createConnection(process.env.DATABASE_URL!);
  const [acquired] = await rows<{ acquired: number }>(
    "SELECT GET_LOCK(?,0) acquired",
    [`tatuei_qr_${studioId}`],
    lock as any
  );
  if (acquired?.acquired !== 1) {
    await lock.end();
    return;
  }
  const session = {
    lock,
    instance: initial.wa_instance!,
    stopped: false,
    ownIds: new Set<string>(),
  } as NonNullable<ReturnType<typeof sessions.get>>;
  sessions.set(studioId, session);
  lock.on("error", () => {
    void closeLocal(studioId, session);
  });
  try {
    const [saved] = await rows(
      "SELECT state FROM tatuei_bot_qr_auth WHERE studio_id=?",
      [studioId]
    );
    const stored = saved
      ? JSON.parse(openBotSecret(saved.state, studioId), BufferJSON.reviver)
      : { creds: initAuthCreds(), keys: {} };
    stored.lids ||= {};
    let writes = Promise.resolve();
    const persist = () => {
      writes = writes.then(async () => {
        if (session.stopped) return;
        const state = sealBotSecret(
          JSON.stringify(stored, BufferJSON.replacer),
          studioId
        );
        await exec(
          "INSERT INTO tatuei_bot_qr_auth(studio_id,state) SELECT ?,? WHERE EXISTS(SELECT 1 FROM tatuei_bot_settings WHERE studio_id=? AND wa_instance=?) ON DUPLICATE KEY UPDATE state=VALUES(state)",
          [studioId, state, studioId, initial.wa_instance]
        );
      });
      return writes;
    };
    await persist();
    const auth: AuthenticationState = {
      creds: stored.creds,
      keys: {
        get: async (type, ids) => {
          const result: any = {};
          for (const id of ids) {
            let value = stored.keys[`${type}:${id}`];
            if (type === "app-state-sync-key" && value)
              value = proto.Message.AppStateSyncKeyData.fromObject(value);
            if (value) result[id] = value;
          }
          return result;
        },
        set: async data => {
          for (const [type, keys] of Object.entries(data))
            for (const [id, value] of Object.entries(keys || {})) {
              if (value == null) delete stored.keys[`${type}:${id}`];
              else stored.keys[`${type}:${id}`] = value;
            }
          await persist();
        },
      },
    };
    const socket = makeWASocket({
      auth,
      logger,
      printQRInTerminal: false,
      markOnlineOnConnect: false,
      syncFullHistory: false,
      shouldSyncHistoryMessage: () => false,
      connectTimeoutMs: 20000,
    });
    session.socket = socket;
    const fail = async () => {
      if (session.stopped) return;
      await exec(
        "UPDATE tatuei_bot_settings SET wa_status='disconnected',webhook_ready=0,last_error='Conexão interrompida. Aguardando reconexão.' WHERE studio_id=? AND wa_instance=?",
        [studioId, initial.wa_instance!]
      ).catch(() => {});
      inboxChanged(studioId);
      const attempts = (failures.get(studioId) || 0) + 1;
      failures.set(studioId, attempts);
      retryAfter.set(
        studioId,
        Date.now() + Math.min(300000, 5000 * 2 ** Math.min(attempts, 6))
      );
      await closeLocal(studioId, session);
    };
    socket.ev.on("creds.update", update => {
      Object.assign(stored.creds, update);
      void persist().catch(fail);
    });
    // Serialize provider events so disconnects cannot race a completed pairing.
    let updates = Promise.resolve();
    socket.ev.on("connection.update", update => {
      updates = updates
        .then(async () => {
          if (session.stopped) return;
          if (update.qr) {
            const image = await QRCode.toDataURL(update.qr, {
              width: 300,
              margin: 2,
            });
            await exec(
              "UPDATE tatuei_bot_qr_auth SET qr_image=?,qr_expires=? WHERE studio_id=?",
              [
                sealBotSecret(image, studioId),
                utcSql(new Date(Date.now() + 30000)),
                studioId,
              ]
            );
            await exec(
              "UPDATE tatuei_bot_settings SET wa_status='awaiting_qr',webhook_ready=0,last_error=NULL WHERE studio_id=? AND wa_instance=?",
              [studioId, initial.wa_instance!]
            );
            inboxChanged(studioId);
          }
          if (update.connection === "open") {
            const phone = socket.user?.id.split(":")[0].split("@")[0];
            if (!phone || !/^\d{10,15}$/.test(phone))
              throw new Error("Número inválido.");
            const unique = await withBotLock(
              "tatuei_channel_identity",
              async c => {
                const duplicate = await rows(
                  "SELECT studio_id FROM tatuei_bot_settings WHERE wa_phone=? AND studio_id<>? UNION ALL SELECT i.studio_id FROM whatsapp_integrations i LEFT JOIN tatuei_bot_settings b ON b.wa_integration_id=i.id WHERE REPLACE(REPLACE(i.phoneNumber,'+',''),' ','')=? AND (i.studio_id<>? OR i.is_enabled=1 OR b.studio_id IS NOT NULL)",
                  [phone, studioId, phone, studioId],
                  c
                );
                if (duplicate.length) return false;
                const result = await exec(
                  "UPDATE tatuei_bot_settings SET wa_status='connected',wa_phone=?,webhook_ready=1,last_error=NULL WHERE studio_id=? AND wa_instance=?",
                  [phone, studioId, initial.wa_instance!],
                  c
                );
                return result.affectedRows === 1;
              }
            );
            if (!unique) {
              await socket.logout().catch(() => {});
              await exec(
                "UPDATE tatuei_bot_settings SET wa_status='logged_out',webhook_ready=0,last_error='Esse número já está vinculado a outro canal. Desvincule-o antes de conectar.' WHERE studio_id=? AND wa_instance=?",
                [studioId, initial.wa_instance!]
              );
              await exec("DELETE FROM tatuei_bot_qr_auth WHERE studio_id=?", [
                studioId,
              ]);
              await closeLocal(studioId, session);
              return;
            }
            failures.delete(studioId);
            retryAfter.delete(studioId);
            await exec(
              "UPDATE tatuei_bot_qr_auth SET qr_image=NULL,qr_expires=NULL WHERE studio_id=?",
              [studioId]
            );
            inboxChanged(studioId);
          }
          if (update.connection === "close") {
            const code = (update.lastDisconnect?.error as any)?.output
              ?.statusCode;
            if (code === DisconnectReason.loggedOut) {
              await exec("DELETE FROM tatuei_bot_qr_auth WHERE studio_id=?", [
                studioId,
              ]);
              await exec(
                "UPDATE tatuei_bot_settings SET wa_status='logged_out',webhook_ready=0,last_error='Sessão encerrada no WhatsApp. Conecte novamente.' WHERE studio_id=? AND wa_instance=?",
                [studioId, initial.wa_instance!]
              );
              await closeLocal(studioId, session);
              inboxChanged(studioId);
            } else await fail();
          }
        })
        .catch(fail);
    });
    socket.ev.on("chats.phoneNumberShare", ({ lid, jid }) => {
      if (lid.endsWith("@lid") && jid.endsWith("@s.whatsapp.net")) {
        stored.lids[lid] = jid;
        void persist().catch(fail);
      }
    });
    const saveContacts = (
      contacts: { id?: string; lid?: string; jid?: string }[]
    ) => {
      for (const contact of contacts) {
        const lid =
          contact.lid ||
          (contact.id?.endsWith("@lid") ? contact.id : undefined);
        const jid =
          contact.jid ||
          (contact.id?.endsWith("@s.whatsapp.net") ? contact.id : undefined);
        if (lid && jid) stored.lids[lid] = jid;
      }
      void persist().catch(fail);
    };
    socket.ev.on("contacts.upsert", saveContacts);
    socket.ev.on("contacts.update", saveContacts);
    socket.ev.on("messages.upsert", ({ messages, type }) => {
      if (type !== "notify") return; // Never trigger flows from history synchronization.
      for (const message of messages)
        void (async () => {
          if (session.stopped || !message.key.id || !message.message) return;
          if (session.ownIds.has(message.key.id)) return;
          const jid = message.key.remoteJid || "";
          const alternative = ((message.key as any).senderPn ||
            (message.key as any).remoteJidAlt ||
            stored.lids[jid]) as string | undefined;
          const address = jid.endsWith("@s.whatsapp.net")
            ? jid
            : alternative?.endsWith("@s.whatsapp.net")
              ? alternative
              : null;
          if (!address) return; // Groups, broadcasts, status and unresolved LIDs are not customer threads.
          const phone = address.split("@")[0];
          if (!/^\d{10,15}$/.test(phone)) return;
          const s = await settings(studioId);
          if (
            s.wa_instance !== initial.wa_instance ||
            s.wa_status !== "connected"
          )
            return;
          const content = normalizeMessageContent(message.message);
          const text =
            content?.conversation || content?.extendedTextMessage?.text;
          const kind = content?.imageMessage
            ? "image"
            : content?.audioMessage
              ? "audio"
              : content?.videoMessage
                ? "video"
                : content?.documentMessage
                  ? "document"
                  : null;
          if (!text && !kind) return;
          await persistBotInbound(
            s,
            {
              instanceId: s.wa_instance!,
              messageId: message.key.id,
              phone,
              fromMe: !!message.key.fromMe,
              senderName: message.pushName || undefined,
              ...(text
                ? { text: { message: text } }
                : {
                    [kind!]: true,
                    caption: (content as any)?.[
                      `${kind}Message`
                    ]?.caption?.slice(0, 12000),
                  }),
            },
            phone,
            utcSql(
              new Date(
                Math.min(
                  Date.now(),
                  Number(message.messageTimestamp || Date.now() / 1000) * 1000
                )
              )
            )
          );
          if (kind) {
            const media = (content as any)[`${kind}Message`];
            const length = Number(media.fileLength || 0);
            const mime = attachmentSchema.shape.mime.safeParse(media.mimetype);
            if (mime.success && length <= MAX_ATTACHMENT_BYTES) {
              try {
                const stream = await downloadContentFromMessage(media, kind);
                const chunks: Buffer[] = [];
                let size = 0;
                for await (const chunk of stream) {
                  size += chunk.length;
                  if (size > MAX_ATTACHMENT_BYTES) {
                    stream.destroy();
                    throw new Error("Mídia excede 5 MB.");
                  }
                  chunks.push(chunk);
                }
                const [record] = await rows(
                  "SELECT id,conversation_id FROM tatuei_bot_messages WHERE studio_id=? AND external_id=?",
                  [studioId, message.key.id]
                );
                if (record)
                  await saveAttachment(
                    record.id,
                    studioId,
                    record.conversation_id,
                    {
                      name: String(
                        media.fileName || `${kind}-${message.key.id}`
                      ).slice(0, 180),
                      mime: mime.data,
                      base64: Buffer.concat(chunks).toString("base64"),
                    }
                  );
              } catch {
                /* Text placeholder remains visible when media is unavailable. */
              }
            }
          }
          inboxChanged(studioId);
        })().catch(() => {
          console.warn(
            "[Bot Tatuei] Evento QR não processado; revisar conexão."
          );
        });
    });
    socket.ev.on("messages.update", updates => {
      for (const { key, update } of updates) {
        const status =
          update.status === 4 || update.status === 5
            ? "read"
            : update.status === 3
              ? "delivered"
              : update.status === 2
                ? "sent"
                : null;
        if (key.fromMe && key.id && status)
          void applyDeliveryStatus(studioId, key.id, status).catch(() => {});
      }
    });
    session.heartbeat = setInterval(() => {
      void (async () => {
        await lock.query("SELECT 1");
        const current = await settings(studioId);
        if (
          current.wa_instance !== initial.wa_instance ||
          process.env.NATIVE_BOT_QR_ENABLED !== "true" ||
          isOutboundMessagingBlocked()
        )
          await closeLocal(studioId, session);
      })().catch(fail);
    }, 10000);
    session.heartbeat.unref();
  } catch (e) {
    await closeLocal(studioId, session);
    throw e;
  }
}
export const ownsQrSession = (studioId: number) =>
  !!sessions.get(studioId)?.socket && !sessions.get(studioId)?.stopped;
export async function sendQr(
  s: BotSettings,
  phone: string,
  body: string,
  attachment?: BotAttachment | null
) {
  assertQrEnabled();
  const session = sessions.get(s.studio_id);
  if (!session?.socket || session.stopped || s.wa_status !== "connected")
    throw new BotProviderError(
      "Sessão QR indisponível neste processo. Aguarde a reconexão."
    );
  const id = randomBytes(16).toString("hex").toUpperCase();
  session.ownIds.add(id);
  if (session.ownIds.size > 5000)
    session.ownIds.delete(session.ownIds.values().next().value!);
  const bytes = attachment ? Buffer.from(attachment.base64, "base64") : null;
  const content = !attachment
    ? { text: body }
    : attachment.mime.startsWith("image/")
      ? { image: bytes!, caption: body, mimetype: attachment.mime }
      : attachment.mime.startsWith("audio/")
        ? { audio: bytes!, mimetype: attachment.mime }
        : attachment.mime.startsWith("video/")
          ? { video: bytes!, caption: body, mimetype: attachment.mime }
          : {
              document: bytes!,
              mimetype: attachment.mime,
              fileName: attachment.name,
              caption: body,
            };
  try {
    const result = await session.socket.sendMessage(
      `${phone}@s.whatsapp.net`,
      content,
      { messageId: id }
    );
    if (!result?.key.id) throw new Error();
    return { messageId: result.key.id };
  } catch {
    throw new BotProviderError(
      "O WhatsApp não confirmou o envio. Confira a conversa antes de reenviar.",
      true
    );
  }
}
export function startQrSupervisor() {
  if (process.env.NATIVE_BOT_QR_ENABLED !== "true") return;
  let running = false;
  const cycle = async () => {
    if (running || !isNativeBotReady() || isOutboundMessagingBlocked()) return;
    running = true;
    try {
      const studios = await rows(
        "SELECT studio_id FROM tatuei_bot_settings WHERE wa_instance LIKE 'qr:%' AND wa_status<>'logged_out'"
      );
      for (const s of studios)
        if ((retryAfter.get(s.studio_id) || 0) <= Date.now())
          await startQr(s.studio_id).catch(() => {
            retryAfter.set(s.studio_id, Date.now() + 60000);
          });
    } finally {
      running = false;
    }
  };
  void cycle().catch(() => {});
  const timer = setInterval(() => {
    void cycle().catch(() => {});
  }, 15000);
  timer.unref();
  return () => {
    clearInterval(timer);
    for (const id of sessions.keys()) void closeLocal(id);
  };
}
