import { TRPCError } from "@trpc/server";
import { ENV } from "../_core/env";

type Identity = { id?: number; role?: string; email?: string | null; openId?: string; studioId?: number | null };

/** This pilot belongs to the configured account, never to the superadmin role alone. */
export function isPrivateInboxOwner(user?: Identity | null): boolean {
  if (!user || user.role !== "superadmin" || !user.id || user.id < 1) return false;
  if (ENV.authMode === "local") {
    const email = process.env.LOCAL_ADMIN_EMAIL?.trim().toLowerCase();
    return !!email && user.email?.trim().toLowerCase() === email;
  }
  return !!ENV.ownerOpenId && user.openId === ENV.ownerOpenId;
}

export function assertPrivateInboxOwner(user?: Identity | null) {
  if (!isPrivateInboxOwner(user)) throw new TRPCError({
    code: "FORBIDDEN",
    message: "A Central está disponível somente para a conta proprietária, em modo de leitura.",
  });
}
