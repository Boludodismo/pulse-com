import { TRPCError } from "@trpc/server";
import type { User } from "../drizzle/schema";
import { isUserAccessActive, parseAccessExpiry } from "./saas";

type BtboludismoIdentity = Pick<User, "id" | "openId" | "role" | "isActive" | "accessStatus" | "accessExpiresAt"> & {
  isCron?: boolean;
  taskUid?: string;
};

/** A private pilot: configuration must identify a specific human account. */
export async function canAccessBtboludismo(user?: BtboludismoIdentity | null): Promise<boolean> {
  if (process.env.BTBOLUDISMO_PILOT_ENABLED !== "true") return false;
  const configuredId = process.env.BTBOLUDISMO_OWNER_USER_ID ?? "";
  if (!/^[1-9]\d*$/.test(configuredId)) return false;
  const ownerId = Number(configuredId);
  if (!Number.isSafeInteger(ownerId)) return false;
  if (!user || !Number.isSafeInteger(user.id) || user.id < 1 || user.id !== ownerId) return false;
  if (user.role !== "superadmin" || user.isCron || user.taskUid != null) return false;
  if (!user.openId || user.openId.startsWith("cron_")) return false;
  if (user.isActive !== 1 || user.accessStatus !== "active") return false;

  // Unlike the global superadmin policy, this pilot also honors expiry.
  if (user.accessExpiresAt != null) {
    const expiresAt = parseAccessExpiry(user.accessExpiresAt);
    if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) return false;
  }
  try {
    return await isUserAccessActive(user);
  } catch {
    return false;
  }
}

export async function assertBtboludismoAccess(user?: BtboludismoIdentity | null): Promise<void> {
  if (!(await canAccessBtboludismo(user))) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Btboludismo não está disponível para esta conta." });
  }
}
