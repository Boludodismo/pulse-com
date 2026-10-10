import { TRPCError } from "@trpc/server";
import type { Request } from "express";
import type { RowDataPacket } from "mysql2/promise";
import { securityPool } from "./database";
import { digest } from "./crypto";
// Railway forwards one trusted proxy hop; never trust caller-supplied X-Forwarded-For directly.
export async function enforceRateLimit(
  req: Request,
  action: string,
  account = "",
  maximum = 10,
  windowMs = 15 * 60000
) {
  const database = securityPool();
  for (const identity of [
    `ip:${req.ip || req.socket?.remoteAddress || "unknown"}`,
    ...(account ? [`account:${account.toLowerCase()}`] : []),
  ]) {
    const key = digest(`${action}:${identity}`);
    const now = Date.now();
    await database.query(
      `INSERT INTO auth_rate_limits(keyHash,hits,expiresAt) VALUES(?,1,?)
      ON DUPLICATE KEY UPDATE hits=IF(expiresAt<=?,1,hits+1), expiresAt=IF(expiresAt<=?,VALUES(expiresAt),expiresAt)`,
      [key, now + windowMs, now, now]
    );
    const [rows] = await database.query<RowDataPacket[]>(
      "SELECT hits FROM auth_rate_limits WHERE keyHash=?",
      [key]
    );
    if (Number(rows[0]?.hits) > maximum)
      throw new TRPCError({
        code: "TOO_MANY_REQUESTS",
        message: "Muitas tentativas. Aguarde alguns minutos e tente novamente.",
      });
  }
}
