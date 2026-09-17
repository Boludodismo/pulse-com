import { and, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { whatsappIntegrations } from "../../drizzle/schema";
import { ENV } from "../_core/env";
import { getDb, getUserByEmail, getUserByOpenId } from "../db";
import { isPrivateInboxOwner } from "../intelligentInbox/access";

/** Until personal integrations are released, the owner's connection is never shared. */
export async function assertPrivateConnectionAccess(user: {
  id: number; role: string; email?: string | null; openId: string;
}, studioId: number) {
  if (isPrivateInboxOwner(user)) return;
  const owner = ENV.authMode === "local"
    ? (process.env.LOCAL_ADMIN_EMAIL ? await getUserByEmail(process.env.LOCAL_ADMIN_EMAIL) : null)
    : (ENV.ownerOpenId ? await getUserByOpenId(ENV.ownerOpenId) : null);
  // Unknown ownership must not expose the existing connection.
  if (!owner) throw new TRPCError({ code: "FORBIDDEN", message: "Não foi possível verificar o proprietário da conexão." });
  const deny = () => { throw new TRPCError({ code: "FORBIDDEN", message: "Esta conexão é privada. Utilize uma integração própria quando o acesso individual estiver disponível." }); };
  // Protect legacy integrations too, including ones not yet activated.
  if (owner.studioId === studioId) return deny();
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "SERVICE_UNAVAILABLE" });
  const protectedConnection = await db.select({ id: whatsappIntegrations.id }).from(whatsappIntegrations)
    .where(and(eq(whatsappIntegrations.studioId, studioId), eq(whatsappIntegrations.productionActivatedByUserId, owner.id))).limit(1);
  if (protectedConnection.length) deny();
}
