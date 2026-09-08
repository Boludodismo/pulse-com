import {INBOX_MODULES} from '../shared/intelligentInbox';
import { createHash, randomBytes } from "node:crypto";
import { and, desc, eq, gt } from "drizzle-orm";
import { getDb } from "./db";
import { studioInvitations, userModulePermissions, users } from "../drizzle/schema";

export const SAAS_MODULES = ["clients", "appointments", "stock", "finance", "anamnesis", "pod", "reports", ...INBOX_MODULES] as const;
export type SaasModule = (typeof SAAS_MODULES)[number];
export type InvitationRole = "admin" | "collaborator";

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");
const nowSql = () => new Date().toISOString().slice(0, 19).replace("T", " ");

export function invitationExpiresAt(days = 7) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().slice(0, 19).replace("T", " ");
}

export async function createStudioInvitation(input: {
  studioId: number;
  email: string;
  role: InvitationRole;
  invitedByUserId: number;
}) {
  const database = await getDb();
  if (!database) throw new Error("Banco de dados indisponível");
  const token = randomBytes(32).toString("hex");
  const expiresAt = invitationExpiresAt(7);
  await database.insert(studioInvitations).values({
    studioId: input.studioId,
    email: input.email.trim().toLowerCase(),
    role: input.role,
    tokenHash: hashToken(token),
    status: "pending",
    expiresAt,
    invitedByUserId: input.invitedByUserId,
  });
  return { token, expiresAt };
}

export async function listStudioInvitations(studioId?: number) {
  const database = await getDb();
  if (!database) return [];
  const rows = studioId
    ? await database.select().from(studioInvitations).where(eq(studioInvitations.studioId, studioId)).orderBy(desc(studioInvitations.createdAt))
    : await database.select().from(studioInvitations).orderBy(desc(studioInvitations.createdAt));
  return rows;
}

export async function revokeStudioInvitation(id: number, studioId?: number) {
  const database = await getDb();
  if (!database) throw new Error("Banco de dados indisponível");
  const condition = studioId ? and(eq(studioInvitations.id, id), eq(studioInvitations.studioId, studioId)) : eq(studioInvitations.id, id);
  return database.update(studioInvitations).set({ status: "revoked", revokedAt: nowSql() }).where(condition);
}

export async function claimStudioInvitation(token: string, userId: number) {
  const database = await getDb();
  if (!database) throw new Error("Banco de dados indisponível");
  const invitation = (await database.select().from(studioInvitations).where(eq(studioInvitations.tokenHash, hashToken(token))).limit(1))[0];
  if (!invitation || invitation.artistId) return { ok: false as const, reason: "not_found" as const };
  if (invitation.status !== "pending") return { ok: false as const, reason: invitation.status as "accepted" | "revoked" | "expired" };
  if (new Date(invitation.expiresAt).getTime() <= Date.now()) {
    await database.update(studioInvitations).set({ status: "expired" }).where(eq(studioInvitations.id, invitation.id));
    return { ok: false as const, reason: "expired" as const };
  }
  const currentUser = (await database.select().from(users).where(eq(users.id, userId)).limit(1))[0];
  if (!currentUser || (currentUser.email ?? "").trim().toLowerCase() !== invitation.email) return { ok: false as const, reason: "email_mismatch" as const };
  await database.update(users).set({
    studioId: invitation.studioId,
    role: invitation.role,
    isActive: 1,
    accessStatus: "active",
    accessExpiresAt: invitation.expiresAt,
  }).where(eq(users.id, userId));
  await database.update(studioInvitations).set({ status: "accepted", acceptedUserId: userId, acceptedAt: nowSql() }).where(eq(studioInvitations.id, invitation.id));
  return { ok: true as const, studioId: invitation.studioId, role: invitation.role, expiresAt: invitation.expiresAt };
}

export async function isUserAccessActive(user: { role: string; isActive: number; accessStatus?: string | null; accessExpiresAt?: string | null }) {
  if (user.isActive === 0 || user.accessStatus === "suspended") return false;
  if (user.role === "superadmin") return true;
  if (user.accessExpiresAt && new Date(user.accessExpiresAt).getTime() <= Date.now()) return false;
  return user.accessStatus !== "expired";
}

export async function listUserPermissions(userId: number, studioId: number) {
  const database = await getDb();
  if (!database) return [];
  return database.select().from(userModulePermissions).where(and(eq(userModulePermissions.userId, userId), eq(userModulePermissions.studioId, studioId)));
}

export async function replaceUserPermissions(input: { userId: number; studioId: number; permissions: Array<{ module: SaasModule; canRead: boolean; canWrite: boolean }> }) {
  const database = await getDb();
  if (!database) throw new Error("Banco de dados indisponível");
  await database.delete(userModulePermissions).where(and(eq(userModulePermissions.userId, input.userId), eq(userModulePermissions.studioId, input.studioId)));
  if (input.permissions.length === 0) return;
  await database.insert(userModulePermissions).values(input.permissions.map(permission => ({
    userId: input.userId,
    studioId: input.studioId,
    module: permission.module,
    canRead: permission.canRead ? 1 : 0,
    canWrite: permission.canWrite ? 1 : 0,
  })));
}

export type SaasMetricsInput = {
  studios: Array<{ id: number; isActive: number }>;
  users: Array<{
    role: string;
    isActive: number;
    studioId?: number | null;
    accessStatus?: string | null;
    accessExpiresAt?: string | Date | null;
  }>;
  invitations: Array<{ status: string; expiresAt: string | Date }>;
};

function hasValidTrialAccess(accessExpiresAt?: string | Date | null) {
  return !accessExpiresAt || new Date(accessExpiresAt).getTime() > Date.now();
}

/**
 * Produz indicadores de operação SaaS a partir de dados existentes.
 * O produto ainda não possui cobrança, portanto o painel informa acessos
 * de teste ativos em vez de inventar métricas de assinaturas pagas.
 */
export function summarizeSaasMetrics(input: SaasMetricsInput) {
  const members = input.users.filter((user) => user.role !== "superadmin");
  const activeMembers = members.filter((user) => (
    user.isActive !== 0
    && user.accessStatus !== "suspended"
    && user.accessStatus !== "expired"
    && hasValidTrialAccess(user.accessExpiresAt)
  ));
  const now = Date.now();
  const sevenDaysFromNow = now + (7 * 24 * 60 * 60 * 1000);

  return {
    totalStudios: input.studios.length,
    activeStudios: input.studios.filter((studio) => studio.isActive !== 0).length,
    activeUsers: activeMembers.length,
    administrators: activeMembers.filter((user) => user.role === "admin").length,
    collaborators: activeMembers.filter((user) => user.role === "collaborator").length,
    activeTrialAccesses: activeMembers.filter((user) => Boolean(user.accessExpiresAt)).length,
    accessExpiringSoon: activeMembers.filter((user) => {
      if (!user.accessExpiresAt) return false;
      const expiresAt = new Date(user.accessExpiresAt).getTime();
      return expiresAt > now && expiresAt <= sevenDaysFromNow;
    }).length,
    invitations: {
      pending: input.invitations.filter((invitation) => invitation.status === "pending" && new Date(invitation.expiresAt).getTime() > now).length,
      accepted: input.invitations.filter((invitation) => invitation.status === "accepted").length,
      revoked: input.invitations.filter((invitation) => invitation.status === "revoked").length,
      expired: input.invitations.filter((invitation) => invitation.status === "expired" || (invitation.status === "pending" && new Date(invitation.expiresAt).getTime() <= now)).length,
    },
    billingEnabled: false,
  };
}

export async function hasModulePermission(input: { userId: number; studioId: number; module: SaasModule; write?: boolean }) {
  const database = await getDb();
  if (!database) return false;
  const rows = await database.select().from(userModulePermissions).where(and(
    eq(userModulePermissions.userId, input.userId),
    eq(userModulePermissions.studioId, input.studioId),
    eq(userModulePermissions.module, input.module),
    input.write ? gt(userModulePermissions.canWrite, 0) : gt(userModulePermissions.canRead, 0),
  )).limit(1);
  return rows.length > 0;
}
