import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import bcrypt from "bcryptjs";
import express from "express";
import type { Server } from "node:http";
import type { Request } from "express";
import type { RowDataPacket } from "mysql2/promise";
const fixture = vi.hoisted(() => ({ user: undefined as any }));
vi.mock("../_core/env", async original => {
  const actual = await original<typeof import("../_core/env")>();
  return {
    ENV: {
      ...actual.ENV,
      authMode: "local",
      authSecurityKey: "test-only-key-".repeat(5),
      isProduction: false,
    },
  };
});
vi.mock("../db", () => ({
  getUserById: async (id: number) =>
    id === fixture.user?.id ? fixture.user : null,
  getUserByOpenId: async (id: string) =>
    id === fixture.user?.openId ? fixture.user : null,
  getUserByEmail: async (email: string) =>
    email === fixture.user?.email ? fixture.user : null,
  updateUser: async () => {},
  upsertUser: async () => {},
  createAuditLog: async () => {},
}));
import { ensureSecuritySchema, getSecurity, securityPool } from "./database";
import {
  activateFactor,
  createChallenge,
  registerSession,
  revokeSession,
  validSession,
  verifyLoginChallenge,
  disableFactor,
} from "./service";
import { credentialVersion, digest, totp } from "./crypto";
import { enforceRateLimit } from "./rateLimit";
import { resetPassword, resetTokenValid } from "./passwordReset";
import { registerLocalAuthRoutes } from "../_core/localAuth";
import { securityHeaders } from "./http";
import { sdk } from "../_core/sdk";
import { COOKIE_NAME } from "../../shared/const";
const databaseUrl = process.env.SECURITY_TEST_DATABASE_URL;
// Opt-in and hard guard: this suite can never use a deployed/customer database.
const enabled =
  !!databaseUrl &&
  /^mysql:\/\/[^@]*@127\.0\.0\.1:33079\/tatuei_security_test$/.test(
    databaseUrl
  );
const nowCode = (secret: string) =>
  totp(secret, Math.floor(Date.now() / 30000));
let http: Server;
let origin: string;
let passwordHash: string;
describe.skipIf(!enabled)(
  "Security with disposable local MariaDB and actual HTTP login",
  () => {
    beforeAll(async () => {
      process.env.DATABASE_URL = databaseUrl!;
      await ensureSecuritySchema();
      await securityPool().query(
        "CREATE TABLE IF NOT EXISTS users(id INT PRIMARY KEY,passwordHash VARCHAR(255)) ENGINE=InnoDB"
      );
      await securityPool().query(
        "CREATE TABLE IF NOT EXISTS passwordResetTokens(id INT AUTO_INCREMENT PRIMARY KEY,userId INT,token VARCHAR(255),expiresAt DATETIME,usedAt DATETIME NULL) ENGINE=InnoDB"
      );
      passwordHash = await bcrypt.hash("Uma senha de teste segura!", 10);
      const app = express();
      app.set("trust proxy", 1);
      app.use(securityHeaders);
      app.use(express.json({ limit: "16kb" }));
      registerLocalAuthRoutes(app);
      http = app.listen(0, "127.0.0.1");
      await new Promise<void>(resolve => http.once("listening", resolve));
      origin = `http://127.0.0.1:${(http.address() as any).port}`;
    });
    beforeEach(async () => {
      fixture.user = {
        id: 101,
        openId: "fictional-local",
        name: "Conta fictícia",
        email: "fixture@example.test",
        role: "admin",
        isActive: 1,
        passwordHash,
        studioId: 2,
        accessStatus: "active",
      };
      for (const table of [
        "auth_security",
        "auth_challenges",
        "auth_recovery_codes",
        "auth_sessions",
        "auth_rate_limits",
        "passwordResetTokens",
        "users",
      ])
        await securityPool().query(`DELETE FROM ${table}`);
      await securityPool().query(
        "INSERT INTO users(id,passwordHash) VALUES(?,?)",
        [fixture.user.id, passwordHash]
      );
      vi.unstubAllGlobals();
      delete process.env.AUTH_EMAIL_API_KEY;
      delete process.env.AUTH_EMAIL_FROM;
    });
    afterAll(async () => {
      if (http) await new Promise<void>(resolve => http.close(() => resolve()));
      await securityPool().end();
    });
    const post = (
      path: string,
      body: unknown,
      headers: Record<string, string> = {}
    ) =>
      fetch(origin + path, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify(body),
      });
    async function enroll() {
      const challenge = await createChallenge(fixture.user, "enroll", "totp");
      const codes = await activateFactor(
        fixture.user,
        challenge.challenge,
        nowCode(challenge.secret!)
      );
      // Simulate the next 30-second period without delaying the test.
      await securityPool().query(
        "UPDATE auth_security SET lastCounter=-1 WHERE userId=?",
        [fixture.user.id]
      );
      return { secret: challenge.secret!, codes: codes! };
    }
    it("creates schema idempotently and keeps existing account credentials", async () => {
      await ensureSecuritySchema();
      const [rows] = await securityPool().query<RowDataPacket[]>(
        "SELECT passwordHash FROM users WHERE id=?",
        [fixture.user.id]
      );
      expect(rows[0].passwordHash).toBe(passwordHash);
    });
    it("enrollment stays inactive until confirmation and stores only encrypted secret", async () => {
      const challenge = await createChallenge(fixture.user, "enroll", "totp");
      expect((await getSecurity(fixture.user.id)).method).toBe("off");
      expect(
        await activateFactor(fixture.user, challenge.challenge, "not-a-code")
      ).toBeNull();
      expect((await getSecurity(fixture.user.id)).method).toBe("off");
      const codes = await activateFactor(
        fixture.user,
        challenge.challenge,
        nowCode(challenge.secret!)
      );
      expect(codes).toHaveLength(10);
      expect((await getSecurity(fixture.user.id)).secret).not.toBe(
        challenge.secret
      );
      expect(
        await activateFactor(
          fixture.user,
          challenge.challenge,
          nowCode(challenge.secret!)
        )
      ).toBeNull();
    });
    it("consumes a login challenge exactly once under concurrent verification", async () => {
      const { secret } = await enroll();
      const challenge = await createChallenge(fixture.user, "login", "totp");
      const results = await Promise.all([
        verifyLoginChallenge(
          fixture.user,
          challenge.challenge,
          nowCode(secret)
        ),
        verifyLoginChallenge(
          fixture.user,
          challenge.challenge,
          nowCode(secret)
        ),
      ]);
      expect(results.filter(Boolean)).toHaveLength(1);
    });
    it("rejects reuse of the same TOTP across distinct challenges", async () => {
      const { secret } = await enroll();
      const first = await createChallenge(fixture.user, "login", "totp");
      const second = await createChallenge(fixture.user, "login", "totp");
      expect(
        await verifyLoginChallenge(
          fixture.user,
          first.challenge,
          nowCode(secret)
        )
      ).toBeTruthy();
      expect(
        await verifyLoginChallenge(
          fixture.user,
          second.challenge,
          nowCode(secret)
        )
      ).toBeNull();
    });
    it("persists five failed attempts and rejects the correct code afterwards", async () => {
      const { secret } = await enroll();
      const challenge = await createChallenge(fixture.user, "login", "totp");
      for (let n = 0; n < 5; n++)
        expect(
          await verifyLoginChallenge(fixture.user, challenge.challenge, "wrong")
        ).toBeNull();
      expect(
        await verifyLoginChallenge(
          fixture.user,
          challenge.challenge,
          nowCode(secret)
        )
      ).toBeNull();
      const [rows] = await securityPool().query<RowDataPacket[]>(
        "SELECT attempts FROM auth_challenges WHERE tokenHash=?",
        [digest(challenge.challenge)]
      );
      expect(rows[0].attempts).toBe(5);
    });
    it("binds challenges to one user, their current password and expiry", async () => {
      const { secret } = await enroll();
      const challenge = await createChallenge(fixture.user, "login", "totp");
      expect(
        await verifyLoginChallenge(
          { ...fixture.user, id: 102 },
          challenge.challenge,
          nowCode(secret)
        )
      ).toBeNull();
      expect(
        await verifyLoginChallenge(
          { ...fixture.user, passwordHash: "changed" },
          challenge.challenge,
          nowCode(secret)
        )
      ).toBeNull();
      await securityPool().query(
        "UPDATE auth_challenges SET expiresAt=0 WHERE tokenHash=?",
        [digest(challenge.challenge)]
      );
      expect(
        await verifyLoginChallenge(
          fixture.user,
          challenge.challenge,
          nowCode(secret)
        )
      ).toBeNull();
    });
    it("recovery codes work once even with concurrent distinct challenges", async () => {
      const { codes } = await enroll();
      const first = await createChallenge(fixture.user, "login", "totp");
      const second = await createChallenge(fixture.user, "login", "totp");
      const results = await Promise.all([
        verifyLoginChallenge(fixture.user, first.challenge, codes[0]),
        verifyLoginChallenge(fixture.user, second.challenge, codes[0]),
      ]);
      expect(results.filter(Boolean)).toHaveLength(1);
      const [rows] = await securityPool().query<RowDataPacket[]>(
        "SELECT COUNT(*) AS total FROM auth_recovery_codes WHERE userId=?",
        [fixture.user.id]
      );
      expect(Number(rows[0].total)).toBe(9);
    });
    it("email codes expire and are consumed once; superadmin email enrollment is forbidden", async () => {
      process.env.AUTH_EMAIL_API_KEY = "fictional-key";
      process.env.AUTH_EMAIL_FROM = "Tatuei <fixture@example.test>";
      const emails: any[] = [];
      vi.stubGlobal("fetch", async (_url: string, options: any) => {
        emails.push(JSON.parse(options.body));
        return { ok: true };
      });
      const setup = await createChallenge(fixture.user, "enroll", "email");
      expect(
        await activateFactor(
          fixture.user,
          setup.challenge,
          emails[0].text.match(/\d{6}/)[0]
        )
      ).toHaveLength(10);
      const login = await createChallenge(fixture.user, "login", "email");
      const code = emails[1].text.match(/\d{6}/)[0];
      expect(
        await verifyLoginChallenge(fixture.user, login.challenge, code)
      ).toBeTruthy();
      expect(
        await verifyLoginChallenge(fixture.user, login.challenge, code)
      ).toBeNull();
      await expect(
        createChallenge(
          { ...fixture.user, role: "superadmin" },
          "enroll",
          "email"
        )
      ).rejects.toThrow();
      delete process.env.AUTH_EMAIL_API_KEY;
      const recovery = await createChallenge(
        fixture.user,
        "login",
        "email",
        true
      );
      expect(recovery.challenge).toBeTruthy();
    });
    it("requires current factor to disable and never lets superadmin disable it", async () => {
      const { codes } = await enroll();
      expect(await disableFactor(fixture.user, "wrong")).toBe(false);
      expect((await getSecurity(fixture.user.id)).method).toBe("totp");
      await expect(
        disableFactor({ ...fixture.user, role: "superadmin" }, codes[0])
      ).rejects.toThrow();
      expect(await disableFactor(fixture.user, codes[0])).toBe(true);
      expect((await getSecurity(fixture.user.id)).method).toBe("off");
    });
    it("revokes sessions, respects idle limits and blocks access across users", async () => {
      const version = credentialVersion(fixture.user, 0);
      const token = await registerSession(fixture.user, version);
      expect(await validSession(fixture.user, token, version)).toBe(true);
      expect(
        await validSession({ ...fixture.user, id: 102 }, token, version)
      ).toBe(false);
      await securityPool().query(
        "UPDATE auth_sessions SET lastSeen=? WHERE tokenHash=?",
        [Date.now() - 31 * 60000, digest(token)]
      );
      expect(await validSession(fixture.user, token, version)).toBe(false);
      await revokeSession(fixture.user.id);
      expect(await validSession(fixture.user, token, version)).toBe(false);
    });
    it("rate limits persist and shared counters block repeated requests", async () => {
      const req = { ip: "127.0.0.1", socket: {} } as Request;
      await enforceRateLimit(req, "fixture", "account", 2);
      await enforceRateLimit(req, "fixture", "account", 2);
      await expect(
        enforceRateLimit(req, "fixture", "account", 2)
      ).rejects.toThrow("Muitas tentativas");
    });
    it("password reset is transactional and cannot consume the same token twice", async () => {
      const token = "1".repeat(64);
      await securityPool().query(
        "INSERT INTO passwordResetTokens(userId,token,expiresAt) VALUES(?,?,DATE_ADD(UTC_TIMESTAMP(),INTERVAL 1 HOUR))",
        [fixture.user.id, digest(`reset:${token}`)]
      );
      await enroll();
      const before = await getSecurity(fixture.user.id);
      const results = await Promise.allSettled([
        resetPassword(token, "Nova senha de teste segura!"),
        resetPassword(token, "Outra senha de teste segura!"),
      ]);
      expect(
        results.filter(result => result.status === "fulfilled")
      ).toHaveLength(1);
      expect(await resetTokenValid(token)).toBe(false);
      expect((await getSecurity(fixture.user.id)).method).toBe(before.method);
      const [rows] = await securityPool().query<RowDataPacket[]>(
        "SELECT passwordHash FROM users WHERE id=?",
        [fixture.user.id]
      );
      expect(rows[0].passwordHash).not.toBe(passwordHash);
    });
    it("HTTP login issues no session before MFA and old tokens fail after password change", async () => {
      const initial = await post("/api/auth/local/login", {
        email: fixture.user.email,
        password: "Uma senha de teste segura!",
      });
      expect(initial.status).toBe(200);
      const cookie = initial.headers.get("set-cookie")!.split(";")[0];
      expect(cookie).toContain(COOKIE_NAME);
      const req = { headers: { cookie } } as Request;
      expect((await sdk.authenticateRequest(req)).id).toBe(fixture.user.id);
      fixture.user.passwordHash = await bcrypt.hash(
        "Senha alterada segura!",
        10
      );
      await expect(sdk.authenticateRequest(req)).rejects.toThrow();
      fixture.user.passwordHash = passwordHash;
      const { secret } = await enroll();
      const first = await post("/api/auth/local/login", {
        email: fixture.user.email,
        password: "Uma senha de teste segura!",
      });
      expect(first.headers.get("set-cookie")).toBeNull();
      const challenge = await first.json();
      expect(challenge.mfaRequired).toBe(true);
      const wrong = await post("/api/auth/local/mfa", {
        challenge: challenge.challenge,
        code: "wrong",
      });
      expect(wrong.status).toBe(401);
      expect(wrong.headers.get("set-cookie")).toBeNull();
      const verified = await post("/api/auth/local/mfa", {
        challenge: challenge.challenge,
        code: nowCode(secret),
      });
      expect(verified.status).toBe(200);
      expect(verified.headers.get("set-cookie")).toBeTruthy();
    });
    it("HTTP rejects foreign origins and expired/inactive account access", async () => {
      const crossSite = await post(
        "/api/auth/local/login",
        { email: fixture.user.email, password: "Uma senha de teste segura!" },
        { Origin: "https://untrusted.example.test" }
      );
      expect(crossSite.status).toBe(403);
      fixture.user.isActive = 0;
      const inactive = await post("/api/auth/local/login", {
        email: fixture.user.email,
        password: "Uma senha de teste segura!",
      });
      expect(inactive.status).toBe(401);
      fixture.user.isActive = 1;
      fixture.user.accessStatus = "expired";
      const expired = await post("/api/auth/local/login", {
        email: fixture.user.email,
        password: "Uma senha de teste segura!",
      });
      expect(expired.status).toBe(401);
    });
  }
);
