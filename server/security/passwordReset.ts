import { randomBytes } from "node:crypto";
import { TRPCError } from "@trpc/server";
import type { RowDataPacket } from "mysql2/promise";
import * as db from "../db";
import { digest } from "./crypto";
import { securityPool, securityTransaction } from "./database";
import { emailAvailable, sendSecurityEmail } from "./email";
import { ENV } from "../_core/env";
import bcrypt from "bcryptjs";
export async function requestReset(email: string) {
  if (!emailAvailable())
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message:
        "Recuperação por e-mail ainda não configurada. Contate o administrador do estúdio.",
    });
  const user = await db.getUserByEmail(email.trim().toLowerCase());
  if (!user?.passwordHash || !user.isActive || !user.email) return;
  const token = randomBytes(32).toString("hex");
  const tokenHash = digest(`reset:${token}`);
  await securityPool().query(
    "INSERT INTO passwordResetTokens(userId,token,expiresAt) VALUES(?,?,DATE_ADD(UTC_TIMESTAMP(),INTERVAL 1 HOUR))",
    [user.id, tokenHash]
  );
  try {
    await sendSecurityEmail(
      user.email,
      "Tatuei — redefinir senha",
      `Redefina sua senha pelo link abaixo, válido por uma hora:\n${ENV.appBaseUrl || "https://crm.tatuei.com"}/reset-password?token=${token}\nSe não solicitou, ignore este e-mail. Sua autenticação em dois fatores será mantida.`
    );
  } catch {
    await securityPool().query(
      "DELETE FROM passwordResetTokens WHERE token=?",
      [tokenHash]
    ); /* Uniform response prevents account enumeration on provider failure. */
  }
}
export async function resetTokenValid(token: string) {
  const [rows] = await securityPool().query<RowDataPacket[]>(
    "SELECT id FROM passwordResetTokens WHERE token=? AND usedAt IS NULL AND expiresAt>UTC_TIMESTAMP() LIMIT 1",
    [digest(`reset:${token}`)]
  );
  return Boolean(rows[0]);
}
export async function resetPassword(token: string, password: string) {
  const tokenHash = digest(`reset:${token}`);
  const [rows] = await securityPool().query<RowDataPacket[]>(
    "SELECT userId FROM passwordResetTokens WHERE token=? AND usedAt IS NULL AND expiresAt>UTC_TIMESTAMP() LIMIT 1",
    [tokenHash]
  );
  if (!rows[0])
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Link inválido ou expirado. Solicite outro.",
    });
  const passwordHash = await bcrypt.hash(password, 12);
  const valid = await securityTransaction(
    Number(rows[0].userId),
    async connection => {
      const [tokens] = await connection.query<RowDataPacket[]>(
        "SELECT id,userId FROM passwordResetTokens WHERE token=? AND usedAt IS NULL AND expiresAt>UTC_TIMESTAMP() FOR UPDATE",
        [tokenHash]
      );
      if (!tokens[0]) return false;
      await connection.query("UPDATE users SET passwordHash=? WHERE id=?", [
        passwordHash,
        tokens[0].userId,
      ]);
      await connection.query(
        "UPDATE passwordResetTokens SET usedAt=UTC_TIMESTAMP() WHERE userId=? AND usedAt IS NULL",
        [tokens[0].userId]
      );
      await connection.query("DELETE FROM auth_sessions WHERE userId=?", [
        tokens[0].userId,
      ]);
      await connection.query("DELETE FROM auth_challenges WHERE userId=?", [
        tokens[0].userId,
      ]);
      return true;
    }
  );
  if (!valid)
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Link inválido ou já utilizado.",
    });
}
