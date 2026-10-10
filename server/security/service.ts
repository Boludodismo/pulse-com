import { randomBytes, randomInt } from "node:crypto";
import type { PoolConnection, RowDataPacket } from "mysql2/promise";
import { TRPCError } from "@trpc/server";
import type { User } from "../../drizzle/schema";
import {
  base32,
  credentialVersion,
  decryptSecret,
  digest,
  encryptSecret,
  equal,
  verifyTotp,
} from "./crypto";
import {
  getSecurity,
  securityPool,
  securityTransaction,
  type SecurityState,
} from "./database";
import { emailAvailable, sendSecurityEmail } from "./email";

export const SESSION_MS = 12 * 60 * 60000;
export const SESSION_IDLE_MS = 30 * 60000;
export type Challenge = RowDataPacket & {
  userId: number;
  purpose: string;
  method: string;
  secret: string | null;
  codeHash: string | null;
  expiresAt: number;
  attempts: number;
  credentialVersion: string;
};
export async function createChallenge(
  user: User,
  purpose: "login" | "enroll" | "manage",
  method: "totp" | "email",
  recoveryOnly = false
) {
  if (
    method === "email" &&
    !recoveryOnly &&
    (user.role === "superadmin" || !user.email || !emailAvailable())
  )
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message:
        "Use o aplicativo autenticador. E-mail indisponível para esta conta.",
    });
  const state = await getSecurity(user.id);
  const token = randomBytes(32).toString("hex");
  const code =
    method === "email" && !recoveryOnly
      ? randomInt(1000000).toString().padStart(6, "0")
      : null;
  const secret =
    purpose === "enroll" && method === "totp" ? base32(randomBytes(20)) : null;
  await securityPool().query(
    `INSERT INTO auth_challenges(tokenHash,userId,purpose,method,credentialVersion,secret,codeHash,expiresAt) VALUES(?,?,?,?,?,?,?,?)`,
    [
      digest(token),
      user.id,
      purpose,
      method,
      credentialVersion(user, state.version),
      secret ? encryptSecret(secret, user.id) : null,
      code ? digest(`otp:${token}:${code}`) : null,
      Date.now() + 5 * 60000,
    ]
  );
  if (code) {
    try {
      await sendSecurityEmail(
        user.email!,
        "Tatuei — código de segurança",
        `Seu código é ${code}. Ele expira em 5 minutos. Não compartilhe este código. Se não solicitou, ignore este e-mail.`
      );
    } catch (error) {
      await securityPool().query(
        "DELETE FROM auth_challenges WHERE tokenHash=?",
        [digest(token)]
      );
      throw error;
    }
  }
  return { challenge: token, method, secret, expiresInSeconds: 300 };
}
async function verifyFactor(
  connection: PoolConnection,
  state: SecurityState,
  user: User,
  code: string,
  challenge?: string
) {
  if (state.method === "off") return true;
  if (state.method === "totp" && state.secret) {
    const counter = verifyTotp(
      decryptSecret(state.secret, user.id),
      code,
      Number(state.lastCounter)
    );
    if (counter !== null) {
      await connection.query(
        "UPDATE auth_security SET lastCounter=? WHERE userId=?",
        [counter, user.id]
      );
      return true;
    }
  }
  const recovery = code.replace(/[-\s]/g, "").toUpperCase();
  if (/^[A-F0-9]{24}$/.test(recovery)) {
    const [result] = await connection.query<mysqlResult>(
      "DELETE FROM auth_recovery_codes WHERE userId=? AND codeHash=?",
      [user.id, digest(`recovery:${user.id}:${recovery}`)]
    );
    return result.affectedRows === 1;
  }
  if (state.method === "email" && challenge)
    return Boolean(
      await consumeChallenge(connection, state, user, challenge, code, "manage")
    );
  return false;
}
type mysqlResult = import("mysql2/promise").ResultSetHeader;
async function consumeChallenge(
  connection: PoolConnection,
  state: SecurityState,
  user: User,
  token: string,
  code: string,
  purpose: string
) {
  const [rows] = await connection.query<Challenge[]>(
    "SELECT * FROM auth_challenges WHERE tokenHash=? AND userId=? AND purpose=? FOR UPDATE",
    [digest(token), user.id, purpose]
  );
  const challenge = rows[0];
  if (
    !challenge ||
    Number(challenge.expiresAt) <= Date.now() ||
    challenge.attempts >= 5 ||
    !equal(challenge.credentialVersion, credentialVersion(user, state.version))
  )
    return null;
  // Persist failures by returning a result instead of throwing inside the transaction.
  await connection.query(
    "UPDATE auth_challenges SET attempts=attempts+1 WHERE tokenHash=?",
    [digest(token)]
  );
  let valid = false;
  if (challenge.method === "email") {
    valid =
      /^\d{6}$/.test(code) &&
      Boolean(
        challenge.codeHash &&
        equal(challenge.codeHash, digest(`otp:${token}:${code}`))
      );
    if (!valid && purpose === "login" && state.method === "email")
      valid = await verifyFactor(connection, state, user, code);
  } else if (purpose === "enroll" && challenge.secret) {
    valid = verifyTotp(decryptSecret(challenge.secret, user.id), code) !== null;
  } else if (purpose === "login" && state.method === challenge.method) {
    valid = await verifyFactor(connection, state, user, code);
  }
  if (!valid) return null;
  await connection.query("DELETE FROM auth_challenges WHERE tokenHash=?", [
    digest(token),
  ]);
  return challenge;
}
export async function verifyLoginChallenge(
  user: User,
  token: string,
  code: string
) {
  return securityTransaction(user.id, async (connection, state) => {
    const result = await consumeChallenge(
      connection,
      state,
      user,
      token,
      code,
      "login"
    );
    return result ? credentialVersion(user, state.version) : null;
  });
}
export async function challengeUser(token: string) {
  const [rows] = await securityPool().query<RowDataPacket[]>(
    "SELECT userId FROM auth_challenges WHERE tokenHash=? AND purpose='login' AND expiresAt>? AND attempts<5",
    [digest(token), Date.now()]
  );
  return rows[0]?.userId as number | undefined;
}
async function recoveryCodes(connection: PoolConnection, userId: number) {
  await connection.query("DELETE FROM auth_recovery_codes WHERE userId=?", [
    userId,
  ]);
  const codes: string[] = [];
  for (let i = 0; i < 10; i++) {
    const code = randomBytes(12).toString("hex").toUpperCase();
    await connection.query(
      "INSERT INTO auth_recovery_codes(userId,codeHash) VALUES(?,?)",
      [userId, digest(`recovery:${userId}:${code}`)]
    );
    codes.push(code.match(/.{1,6}/g)!.join("-"));
  }
  return codes;
}
export async function activateFactor(user: User, token: string, code: string) {
  return securityTransaction(user.id, async (connection, state) => {
    const challenge = await consumeChallenge(
      connection,
      state,
      user,
      token,
      code,
      "enroll"
    );
    if (
      !challenge ||
      (user.role === "superadmin" && challenge.method !== "totp")
    )
      return null;
    const counter =
      challenge.method === "totp" && challenge.secret
        ? verifyTotp(decryptSecret(challenge.secret, user.id), code)
        : -1;
    await connection.query(
      "UPDATE auth_security SET method=?,secret=?,version=version+1,lastCounter=? WHERE userId=?",
      [challenge.method, challenge.secret, counter ?? -1, user.id]
    );
    await connection.query("DELETE FROM auth_challenges WHERE userId=?", [
      user.id,
    ]);
    await connection.query("DELETE FROM auth_sessions WHERE userId=?", [
      user.id,
    ]);
    return recoveryCodes(connection, user.id);
  });
}
export async function proveCurrentFactor(
  user: User,
  code: string,
  challenge?: string
) {
  return securityTransaction(user.id, (connection, state) =>
    verifyFactor(connection, state, user, code, challenge)
  );
}
export async function disableFactor(
  user: User,
  code: string,
  challenge?: string
) {
  if (user.role === "superadmin")
    throw new TRPCError({
      code: "FORBIDDEN",
      message:
        "Superadministradores devem manter o autenticador ativo. Cadastre um novo autenticador para substituí-lo.",
    });
  return securityTransaction(user.id, async (connection, state) => {
    if (!(await verifyFactor(connection, state, user, code, challenge)))
      return false;
    await connection.query(
      "UPDATE auth_security SET method='off',secret=NULL,version=version+1,lastCounter=-1 WHERE userId=?",
      [user.id]
    );
    for (const table of [
      "auth_sessions",
      "auth_challenges",
      "auth_recovery_codes",
    ])
      await connection.query(`DELETE FROM ${table} WHERE userId=?`, [user.id]);
    return true;
  });
}
export async function registerSession(
  user: User,
  version: string,
  device = ""
) {
  const token = randomBytes(32).toString("hex");
  const now = Date.now();
  await securityPool().query(
    "INSERT INTO auth_sessions(tokenHash,userId,credentialVersion,lastSeen,expiresAt,device) VALUES(?,?,?,?,?,?)",
    [
      digest(token),
      user.id,
      version,
      now,
      now + SESSION_MS,
      device.slice(0, 300),
    ]
  );
  return token;
}
export async function validSession(user: User, token: string, version: string) {
  const now = Date.now();
  const [result] = await securityPool().query<mysqlResult>(
    "UPDATE auth_sessions SET lastSeen=? WHERE tokenHash=? AND userId=? AND credentialVersion=? AND expiresAt>? AND lastSeen>?",
    [now, digest(token), user.id, version, now, now - SESSION_IDLE_MS]
  );
  // CLIENT_FOUND_ROWS is enabled by mysql2: simultaneous requests in one millisecond still match.
  return result.affectedRows === 1;
}
export async function revokeSession(userId: number, tokenHash?: string) {
  await securityPool().query(
    `DELETE FROM auth_sessions WHERE userId=?${tokenHash ? " AND tokenHash=?" : ""}`,
    tokenHash ? [userId, tokenHash] : [userId]
  );
}

export async function revokeCredentialArtifacts(userId: number) {
  await revokeSession(userId);
  await securityPool().query("DELETE FROM auth_challenges WHERE userId=?", [
    userId,
  ]);
  await securityPool().query(
    "UPDATE passwordResetTokens SET usedAt=UTC_TIMESTAMP() WHERE userId=? AND usedAt IS NULL",
    [userId]
  );
}
