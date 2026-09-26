import { TRPCError } from "@trpc/server";
import {
  botRoleIsManager,
  botConfigSchema,
  defaultBotConfig,
  DEFAULT_BOT_PERMISSIONS,
  type BotConfig,
  type BotPermissions,
} from "../../shared/nativeBot";
import {
  assertBotSchema,
  rows,
  exec,
  jsonValue,
  type BotConnection,
  botPool,
} from "./database";
export type BotActor = {
  id: number;
  role: string;
  studioId: number | null;
  artistId: number | null;
};
export type BotSettings = {
  studio_id: number;
  enabled: number;
  ai_secret: string | null;
  ai_model: string;
  ai_daily_limit: number;
  ai_day: string | null;
  ai_used: number;
  wa_secret: string | null;
  wa_instance: string | null;
  wa_status: string;
  wa_phone: string | null;
  webhook_key: string | null;
  webhook_ready: number;
  last_error: string | null;
};
export type BotProfile = {
  artistId: number;
  enabled: boolean;
  permissions: BotPermissions;
  config: BotConfig;
  version: number;
};
export const forbidden = () =>
  new TRPCError({
    code: "FORBIDDEN",
    message: "O estúdio não liberou este recurso para seu perfil.",
  });
export async function settings(
  studioId: number,
  c: BotConnection = botPool()
): Promise<BotSettings> {
  await exec(
    "INSERT IGNORE INTO tatuei_bot_settings(studio_id) VALUES(?)",
    [studioId],
    c
  );
  return (
    await rows<BotSettings>(
      "SELECT * FROM tatuei_bot_settings WHERE studio_id=?",
      [studioId],
      c
    )
  )[0];
}
export async function getProfile(
  studioId: number,
  artistId: number,
  c: BotConnection = botPool()
): Promise<BotProfile> {
  const [r] = await rows(
    "SELECT * FROM tatuei_bot_profiles WHERE studio_id=? AND artist_id=?",
    [studioId, artistId],
    c
  );
  const parsed = botConfigSchema.safeParse(jsonValue(r?.config, null));
  return {
    artistId,
    enabled: artistId === 0 || !!r?.enabled,
    permissions: jsonValue(r?.permissions, DEFAULT_BOT_PERMISSIONS),
    config: parsed.success ? parsed.data : defaultBotConfig(),
    version: Number(r?.version || 0),
  };
}
export function assertBotScope(actor: BotActor, requested?: number) {
  if (!actor.studioId) throw forbidden();
  if (!botRoleIsManager(actor.role)) {
    if (
      actor.role !== "collaborator" ||
      !actor.artistId ||
      (requested !== undefined && requested !== actor.artistId)
    )
      throw forbidden();
    return actor.artistId;
  }
  return requested ?? 0;
}
export async function accessBot(
  actor: BotActor,
  requested?: number,
  area?: keyof BotPermissions,
  c: BotConnection = botPool()
) {
  assertBotSchema();
  const artistId = assertBotScope(actor, requested),
    studioId = actor.studioId!;
  const [studio] = await rows(
    "SELECT id,name,address FROM studios WHERE id=? AND isActive=1",
    [studioId],
    c
  );
  if (!studio) throw forbidden();
  let artistName = "nossa equipe";
  if (artistId) {
    const [a] = await rows(
      "SELECT name FROM artists WHERE id=? AND studioId=? AND active=1",
      [artistId, studioId],
      c
    );
    if (!a) throw forbidden();
    artistName = a.name;
  }
  const s = await settings(studioId, c),
    p = await getProfile(studioId, artistId, c),
    manager = botRoleIsManager(actor.role);
  if (!manager && (!s.enabled || !p.enabled || (area && !p.permissions[area])))
    throw forbidden();
  return {
    studioId,
    artistId,
    studioName: String(studio.name),
    artistName,
    settings: s,
    profile: p,
    manager,
  };
}
export function assertBotManager(actor: BotActor) {
  if (!botRoleIsManager(actor.role) || !actor.studioId) throw forbidden();
}
export async function scopedBotClient(
  actor: BotActor,
  clientId: number,
  c: BotConnection = botPool()
) {
  const [client] = await rows(
    "SELECT id,name,phone,artistId,birthDate FROM clients WHERE id=? AND studioId=? AND isArchived=0",
    [clientId, actor.studioId],
    c
  );
  if (
    !client ||
    (!botRoleIsManager(actor.role) && client.artistId !== actor.artistId)
  )
    throw forbidden();
  return client;
}
export async function scopedBotConversation(
  actor: BotActor,
  id: number,
  c: BotConnection = botPool()
) {
  await accessBot(actor, undefined, undefined, c);
  const [cv] = await rows(
    "SELECT * FROM tatuei_bot_conversations WHERE id=? AND studio_id=?",
    [id, actor.studioId],
    c
  );
  if (!cv || (!botRoleIsManager(actor.role) && cv.artist_id !== actor.artistId))
    throw forbidden();
  if (cv.client_id) await scopedBotClient(actor, cv.client_id, c);
  return cv;
}
