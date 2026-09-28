import { TRPCError } from "@trpc/server";
import { randomBytes } from "node:crypto";
import {
  rows,
  exec,
  botPool,
  withBotLock,
  type BotConnection,
} from "../nativeBot/database";
import type { BotSettings } from "../nativeBot/access";
import { openBotSecret, sealBotSecret } from "../nativeBot/crypto";
import { decryptIntegrationSecret, encryptIntegrationSecret } from "./crypto";
import { metaCredentialsSchema, verifyMetaBot } from "../nativeBot/meta";
import {
  waCredentialsSchema,
  zapi,
  safeBotError,
} from "../nativeBot/providers";

export type Channel = {
  id: number;
  studio_id: number;
  provider: "meta" | "zapi" | "botconversa";
  name: string;
  phoneNumber: string;
  instanceId: string | null;
  encrypted_api_token: string | null;
  apiToken: string;
  encrypted_provider_config: string | null;
  connection_key: string | null;
  connection_state: string;
  webhook_ready: number;
  sandbox_mode: number;
  sandbox_test_phone: string | null;
  is_enabled: number;
  status: string;
  lastErrorMessage: string | null;
};
const fail = (message: string) => new TRPCError({ code: "CONFLICT", message });
export async function channelById(
  studioId: number,
  id: number,
  c: BotConnection = botPool()
) {
  const [row] = await rows<Channel>(
    "SELECT * FROM whatsapp_integrations WHERE studio_id=? AND id=?",
    [studioId, id],
    c
  );
  if (!row)
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Canal não encontrado neste estúdio.",
    });
  return row;
}
export function channelExtras(row: Channel): {
  appSecret?: string;
  clientToken?: string;
} {
  return row.encrypted_provider_config
    ? JSON.parse(decryptIntegrationSecret(row.encrypted_provider_config))
    : {};
}
export function channelToken(row: Channel) {
  return row.encrypted_api_token
    ? decryptIntegrationSecret(row.encrypted_api_token)
    : row.apiToken;
}
export function channelBotSettings(s: BotSettings, row: Channel): BotSettings {
  if (row.studio_id !== s.studio_id)
    throw fail("O canal pertence a outro estúdio.");
  const extra = channelExtras(row),
    token = channelToken(row);
  const credentials =
    row.provider === "meta"
      ? {
          phoneNumberId: row.instanceId,
          accessToken: token,
          appSecret: extra.appSecret,
        }
      : { instanceId: row.instanceId, token, clientToken: extra.clientToken };
  const valid = (
    row.provider === "meta" ? metaCredentialsSchema : waCredentialsSchema
  ).safeParse(credentials);
  return {
    ...s,
    wa_integration_id: row.id,
    wa_secret: valid.success
      ? sealBotSecret(JSON.stringify(valid.data), s.studio_id)
      : null,
    wa_instance:
      row.provider === "meta" ? `meta:${row.instanceId}` : row.instanceId,
    wa_status: row.connection_state,
    wa_phone: row.phoneNumber,
    webhook_key: row.connection_key,
    webhook_ready: row.webhook_ready,
    last_error: valid.success
      ? row.lastErrorMessage
      : "Complete as credenciais deste canal para utilizá-lo no Bot Tatuei.",
    channelSandbox: !!row.sandbox_mode,
    channelTestPhone: row.sandbox_test_phone,
  };
}
export async function resolveBotChannel(
  s: BotSettings,
  c: BotConnection = botPool()
): Promise<BotSettings> {
  if (!s.wa_integration_id) return s;
  const [row] = await rows<Channel>(
    "SELECT * FROM whatsapp_integrations WHERE id=? AND studio_id=?",
    [s.wa_integration_id, s.studio_id],
    c
  );
  if (!row || row.provider === "botconversa")
    return {
      ...s,
      wa_secret: null,
      wa_status: "unconfigured",
      webhook_ready: 0,
      last_error: "Selecione um canal disponível.",
    };
  return channelBotSettings(s, row);
}
export async function channelForWebhook(key: string) {
  const [row] = await rows<Channel>(
    "SELECT * FROM whatsapp_integrations WHERE connection_key=? AND provider IN ('meta','zapi')",
    [key]
  );
  if (!row) return null;
  const [s] = await rows<BotSettings>(
    "SELECT * FROM tatuei_bot_settings WHERE studio_id=?",
    [row.studio_id]
  );
  if (!s) return null;
  return {
    row,
    settings: channelBotSettings(
      { ...s, enabled: s.wa_integration_id === row.id ? s.enabled : 0 },
      row
    ),
    linked: s.wa_integration_id === row.id,
  };
}
export async function markChannelVerified(
  row: Channel,
  connected: boolean,
  phone?: string,
  error?: string
) {
  await exec(
    "UPDATE whatsapp_integrations SET connection_state=?,lastTestedAt=UTC_TIMESTAMP(),last_success_at=IF(?,UTC_TIMESTAMP(),last_success_at),lastErrorMessage=?,phoneNumber=COALESCE(?,phoneNumber),updatedAt=UTC_TIMESTAMP() WHERE id=? AND studio_id=? AND encrypted_api_token <=> ? AND encrypted_provider_config <=> ?",
    [
      connected ? "connected" : "disconnected",
      connected,
      error || null,
      phone || null,
      row.id,
      row.studio_id,
      row.encrypted_api_token,
      row.encrypted_provider_config,
    ]
  );
}
export async function verifyChannel(
  studioId: number,
  id: number,
  configureWebhook = false
) {
  const row = await channelById(studioId, id);
  const [raw] = await rows<BotSettings>(
    "SELECT * FROM tatuei_bot_settings WHERE studio_id=?",
    [studioId]
  );
  if (!raw) throw fail("O módulo de conexões ainda não está pronto.");
  const s = channelBotSettings(raw, row);
  try {
    let phone: string | undefined;
    if (row.provider === "meta") phone = (await verifyMetaBot(s)).phone;
    else if (row.provider === "zapi") {
      const result = await zapi(s, "status");
      if (result.connected !== true) {
        await markChannelVerified(row, false);
        return { success: false, error: "Instância não conectada." };
      }
      phone = typeof result.phone === "string" ? result.phone : undefined;
      if (configureWebhook) {
        const base = process.env.APP_BASE_URL?.replace(/\/$/, "");
        if (!base?.startsWith("https://"))
          throw fail("Endereço HTTPS do CRM não configurado.");
        const configured = await zapi(s, "update-webhook-received", "PUT", {
          value: `${base}/api/native-bot/webhook/${row.connection_key}`,
        });
        if (configured?.value !== true)
          throw fail("O provedor não confirmou o webhook.");
        await exec(
          "UPDATE whatsapp_integrations SET webhook_ready=1 WHERE id=? AND studio_id=? AND connection_key=?",
          [id, studioId, row.connection_key]
        );
      }
    } else throw fail("Use o teste de conexão do BotConversa.");
    await markChannelVerified(row, true, phone);
    return {
      success: true,
      details: "Credenciais validadas.",
      webhookReady:
        !!row.webhook_ready || (row.provider === "zapi" && configureWebhook),
    };
  } catch (e) {
    const error = safeBotError(e);
    await markChannelVerified(row, false, undefined, error);
    return { success: false, error };
  }
}
export type SaveChannelInput = {
  id?: number;
  provider: "meta" | "zapi";
  name: string;
  phoneNumber: string;
  instanceId?: string;
  apiToken?: string;
  providerSecret?: string;
  sandboxMode: boolean;
  sandboxTestPhone?: string;
};
export async function saveChannel(studioId: number, input: SaveChannelInput) {
  const result = await withBotLock("tatuei_channel_identity", async c => {
    await c.beginTransaction();
    try {
      const existing = input.id
        ? await channelById(studioId, input.id, c)
        : null;
      if (existing && existing.provider !== input.provider)
        throw fail("Crie outro canal para mudar de provedor.");
      const instanceId = input.instanceId?.trim();
      if (!instanceId)
        throw fail("Informe o identificador do número ou da instância.");
      if (existing && existing.instanceId !== instanceId)
        throw fail("Para outro número ou instância, crie um canal separado.");
      const duplicate = await rows<Channel>(
        "SELECT * FROM whatsapp_integrations WHERE provider=? AND instanceId=? AND id<>?",
        [input.provider, instanceId, input.id || 0],
        c
      );
      if (duplicate.length)
        throw fail(
          duplicate.some(r => r.studio_id === studioId)
            ? "Este canal já está cadastrado. Edite ou selecione o canal existente."
            : "Este canal já está vinculado a outro estúdio."
        );
      const token = input.apiToken || (existing ? channelToken(existing) : "");
      const oldExtra = existing ? channelExtras(existing) : {};
      const extra =
        input.provider === "meta"
          ? { appSecret: input.providerSecret || oldExtra.appSecret }
          : { clientToken: input.providerSecret || oldExtra.clientToken };
      const validated =
        input.provider === "meta"
          ? metaCredentialsSchema.safeParse({
              phoneNumberId: instanceId,
              accessToken: token,
              appSecret: extra.appSecret,
            })
          : waCredentialsSchema.safeParse({
              instanceId,
              token,
              clientToken: extra.clientToken,
            });
      if (!validated.success)
        throw fail(
          "Confira o token, o identificador e a chave complementar do provedor."
        );
      const changed =
        !existing ||
        token !== channelToken(existing) ||
        JSON.stringify(extra) !== JSON.stringify(oldExtra);
      const key =
        existing?.connection_key || randomBytes(32).toString("base64url");
      if (existing) {
        await exec(
          "UPDATE whatsapp_integrations SET name=?,phoneNumber=?,encrypted_api_token=?,apiToken='__encrypted_v1__',encrypted_provider_config=?,connection_key=?,sandbox_mode=?,sandbox_test_phone=?,connection_state=IF(?,'disconnected',connection_state),webhook_ready=IF(?,0,webhook_ready),lastErrorMessage=IF(?,NULL,lastErrorMessage),updatedAt=UTC_TIMESTAMP() WHERE id=? AND studio_id=?",
          [
            input.name,
            input.phoneNumber,
            encryptIntegrationSecret(token),
            encryptIntegrationSecret(JSON.stringify(extra)),
            key,
            input.sandboxMode ? 1 : 0,
            input.sandboxTestPhone || null,
            changed,
            changed,
            changed,
            existing.id,
            studioId,
          ],
          c
        );
      } else {
        const r = await exec(
          "INSERT INTO whatsapp_integrations(studio_id,name,provider,phoneNumber,apiToken,encrypted_api_token,encrypted_provider_config,instanceId,connection_key,sandbox_mode,sandbox_test_phone,is_enabled,status,connection_state) VALUES(?,?,?,?,'__encrypted_v1__',?,?,?,?,?,?,0,'aguardando','disconnected')",
          [
            studioId,
            input.name,
            input.provider,
            input.phoneNumber,
            encryptIntegrationSecret(token),
            encryptIntegrationSecret(JSON.stringify(extra)),
            instanceId,
            key,
            input.sandboxMode ? 1 : 0,
            input.sandboxTestPhone || null,
          ],
          c
        );
        input = { ...input, id: r.insertId };
      }
      if (changed)
        await exec(
          "UPDATE tatuei_bot_messages m JOIN tatuei_bot_settings s ON s.studio_id=m.studio_id SET m.status='canceled',m.error='Credenciais do canal atualizadas.' WHERE s.wa_integration_id=? AND m.status='queued'",
          [input.id],
          c
        );
      await c.commit();
      return { ok: true, id: input.id! };
    } catch (e) {
      await c.rollback();
      throw e;
    }
  });
  if (!result) throw fail("Canal em atualização. Tente novamente.");
  return result;
}
export async function bindBotChannel(studioId: number, id: number | null) {
  const result = await withBotLock("tatuei_channel_identity", async c => {
    const [s] = await rows<BotSettings>(
      "SELECT * FROM tatuei_bot_settings WHERE studio_id=?",
      [studioId],
      c
    );
    if (!s) throw fail("O módulo de conexões ainda não está pronto.");
    if (s.wa_integration_id === id) return { ok: true };
    if (id) {
      const row = await channelById(studioId, id, c);
      if (row.provider === "botconversa")
        throw fail(
          "O BotConversa mantém seu atendimento externo. Selecione Meta ou Z-API para o Bot Tatuei."
        );
      if (!channelBotSettings(s, row).wa_secret)
        throw fail("Complete as credenciais do canal antes de vinculá-lo.");
    }
    await c.beginTransaction();
    try {
      await exec(
        "UPDATE tatuei_bot_settings SET wa_integration_id=?,wa_secret=NULL,wa_instance=NULL,wa_status='unconfigured',wa_phone=NULL,webhook_key=NULL,webhook_ready=0,last_error=NULL WHERE studio_id=?",
        [id, studioId],
        c
      );
      await exec(
        "UPDATE tatuei_bot_messages SET status='canceled',error='Canal do bot alterado.' WHERE studio_id=? AND status='queued'",
        [studioId],
        c
      );
      await exec(
        "UPDATE tatuei_bot_conversations SET last_inbound_at=NULL,revision=revision+1 WHERE studio_id=?",
        [studioId],
        c
      );
      await c.commit();
      return { ok: true };
    } catch (e) {
      await c.rollback();
      throw e;
    }
  });
  if (!result) throw fail("Canal em atualização. Tente novamente.");
  return result;
}
export async function migrateLegacyBotChannels(c: BotConnection) {
  const legacy = await rows<BotSettings>(
    "SELECT * FROM tatuei_bot_settings WHERE wa_integration_id IS NULL AND wa_secret IS NOT NULL",
    [],
    c
  );
  for (const s of legacy) {
    let credentials: any;
    try {
      credentials = JSON.parse(openBotSecret(s.wa_secret!, s.studio_id));
    } catch {
      await exec(
        "UPDATE tatuei_bot_settings SET last_error='Confira as credenciais legadas antes de unificar o canal.' WHERE studio_id=?",
        [s.studio_id],
        c
      );
      continue;
    }
    const meta = s.wa_instance?.startsWith("meta:");
    const validated = (
      meta ? metaCredentialsSchema : waCredentialsSchema
    ).safeParse(credentials);
    if (!validated.success) {
      await exec(
        "UPDATE tatuei_bot_settings SET last_error='Complete as credenciais legadas antes de unificar o canal.' WHERE studio_id=?",
        [s.studio_id],
        c
      );
      continue;
    }
    const provider = meta ? "meta" : "zapi",
      instance = meta ? credentials.phoneNumberId : credentials.instanceId;
    const token = meta ? credentials.accessToken : credentials.token;
    const extra = meta
      ? { appSecret: credentials.appSecret }
      : { clientToken: credentials.clientToken };
    const same = await rows<Channel>(
      "SELECT * FROM whatsapp_integrations WHERE provider=? AND instanceId=?",
      [provider, instance],
      c
    );
    if (same.length) {
      await exec(
        "UPDATE tatuei_bot_settings SET last_error='Canal já cadastrado na Central. Selecione o canal existente para unificar.' WHERE studio_id=?",
        [s.studio_id],
        c
      );
      continue;
    }
    const result = await exec(
      "INSERT INTO whatsapp_integrations(studio_id,name,provider,phoneNumber,apiToken,encrypted_api_token,encrypted_provider_config,instanceId,connection_key,connection_state,webhook_ready,is_enabled,status,sandbox_mode) VALUES(?,?,?,?,'__encrypted_v1__',?,?,?,?,?,?,0,'inativo',?)",
      [
        s.studio_id,
        "WhatsApp do estúdio",
        provider,
        s.wa_phone || "",
        encryptIntegrationSecret(token),
        encryptIntegrationSecret(JSON.stringify(extra)),
        instance,
        s.webhook_key || randomBytes(32).toString("base64url"),
        s.wa_status,
        s.webhook_ready,
        s.enabled && s.wa_status === "connected" ? 0 : 1,
      ],
      c
    );
    await exec(
      "UPDATE tatuei_bot_settings SET wa_integration_id=?,wa_secret=NULL,wa_instance=NULL,webhook_key=NULL WHERE studio_id=?",
      [result.insertId, s.studio_id],
      c
    );
  }
}

export async function deleteUnusedChannel(studioId: number, id: number) {
  const result = await withBotLock("tatuei_channel_identity", async c => {
    await channelById(studioId, id, c);
    const linked = await rows(
      "SELECT studio_id FROM tatuei_bot_settings WHERE wa_integration_id=?",
      [id],
      c
    );
    if (linked.length)
      throw fail("Desvincule este canal do Bot Tatuei antes de removê-lo.");
    await exec(
      "DELETE FROM whatsapp_integrations WHERE id=? AND studio_id=?",
      [id, studioId],
      c
    );
    return { ok: true };
  });
  if (!result) throw fail("Canal em atualização. Tente novamente.");
  return result;
}
