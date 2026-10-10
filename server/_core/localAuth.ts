import { TRPCError } from '@trpc/server';
import { credentialVersion, digest } from '../security/crypto';
import { getSecurity } from '../security/database';
import { SESSION_MS, challengeUser, createChallenge, verifyLoginChallenge, revokeSession } from '../security/service';
import { enforceRateLimit } from '../security/rateLimit';
import { isUserAccessActive } from '../saas';
import type { Express, Request, Response } from "express";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { studios } from "../../drizzle/schema";
import * as db from "../db";
import { getSessionCookieOptions } from "./cookies";
import { sdk } from "./sdk";
import { COOKIE_NAME } from "@shared/const";

const SALT_ROUNDS = 12;

/**
 * Local authentication mode — multi-user with bcrypt password hashing.
 * Activated when AUTH_MODE=local.
 */
export function registerLocalAuthRoutes(app: Express) {
  async function completeLogin(req: Request, res: Response, user: NonNullable<Awaited<ReturnType<typeof db.getUserById>>>, version: string) {
    const sessionToken = await sdk.createSessionToken(user.openId, { name: user.name || user.email || 'Usuário', authVersion: version, device: req.headers['user-agent'] });
    await db.updateUser(user.id, { lastSignedIn: new Date().toISOString() });
    res.cookie(COOKIE_NAME, sessionToken, { ...getSessionCookieOptions(req), maxAge: SESSION_MS });
    res.json({ success: true, user: { email: user.email, name: user.name, role: user.role } });
  }
  function failure(res: Response, error: unknown) {
    if (error instanceof TRPCError) { res.status(error.code === 'TOO_MANY_REQUESTS' ? 429 : 400).json({ error: error.message }); return; }
    console.error('[LocalAuth] Authentication unavailable');
    res.status(503).json({ error: 'Não foi possível autenticar agora. Tente novamente.' });
  }
  app.post('/api/auth/local/login', async (req, res) => {
    const { email, password, recoveryOnly } = req.body ?? {};
    if (typeof email !== 'string' || email.length > 320 || typeof password !== 'string' || !password || password.length > 256) { res.status(400).json({ error: 'E-mail e senha são obrigatórios.' }); return; }
    try {
      const normalized = email.trim().toLowerCase();
      await enforceRateLimit(req, 'login', normalized, 20);
      const user = await db.getUserByEmail(normalized);
      // Dummy comparison keeps unknown accounts on the password verification path.
      const valid = await bcrypt.compare(password, user?.passwordHash || '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy');
      if (!user?.passwordHash || !valid || !user.isActive || !(await isUserAccessActive(user))) { res.status(401).json({ error: 'Credenciais inválidas ou acesso indisponível.' }); return; }
      const state = await getSecurity(user.id);
      if (state.method !== 'off') {
        const challenge = await createChallenge(user, 'login', state.method, recoveryOnly === true);
        res.json({ mfaRequired: true, challenge: challenge.challenge, method: state.method }); return;
      }
      await completeLogin(req, res, user, credentialVersion(user, state.version));
    } catch (error) { failure(res, error); }
  });
  app.post('/api/auth/local/mfa', async (req, res) => {
    const { challenge, code } = req.body ?? {};
    if (typeof challenge !== 'string' || !/^[a-f0-9]{64}$/.test(challenge) || typeof code !== 'string' || code.length > 64) { res.status(400).json({ error: 'Código inválido.' }); return; }
    try {
      await enforceRateLimit(req, 'mfa-ip', '', 30);
      const userId = await challengeUser(challenge);
      const user = userId ? await db.getUserById(userId) : null;
      if (!user?.passwordHash || !user.isActive || !(await isUserAccessActive(user))) { res.status(401).json({ error: 'Código inválido ou expirado. Entre novamente.' }); return; }
      await enforceRateLimit(req, 'mfa-account', String(user.id), 10);
      const version = await verifyLoginChallenge(user, challenge, code);
      if (!version) { res.status(401).json({ error: 'Código inválido ou expirado. Entre novamente após cinco tentativas.' }); return; }
      await completeLogin(req, res, user, version);
    } catch (error) { failure(res, error); }
  });
  app.post('/api/auth/local/logout', async (req, res) => {
    try {
      const user = await sdk.authenticateRequest(req);
      const cookie = req.headers.cookie?.split(';').map(v => v.trim()).find(v => v.startsWith(`${COOKIE_NAME}=`))?.slice(COOKIE_NAME.length + 1);
      const session = await sdk.verifySession(cookie);
      if (session?.sid) await revokeSession(user.id, digest(session.sid));
    } catch { /* expired sessions can still clear their browser cookie */ }
    res.clearCookie(COOKIE_NAME, getSessionCookieOptions(req)); res.json({ success: true });
  });

  // ── Create user (admin only via tRPC — this is a helper endpoint) ──────────
  // The actual create/update user endpoints are in routers.ts (users.createLocal)
}

/**
 * Ensure the local admin user exists in the database.
 * Called at server startup when AUTH_MODE=local.
 */
export async function ensureLocalAdmin(env: {
  email: string;
  password: string;
  name: string;
  ownerOpenId: string;
  studioName: string;
}): Promise<void> {
  try {
    const normalizedEmail = env.email.trim().toLowerCase();
    const existing = await db.getUserByEmail(normalizedEmail);
    if ((!existing || !existing.passwordHash) && !env.password) throw new Error("Configure LOCAL_ADMIN_PASSWORD antes de criar o administrador.");
    const passwordHash = (!existing || !existing.passwordHash) ? await bcrypt.hash(env.password, SALT_ROUNDS) : existing.passwordHash;

    const studio = await db.getFirstStudio();
    let studioId = existing?.studioId ?? studio?.id ?? null;
    if (!studioId) {
      const database = await db.getDb();
      if (!database) throw new Error("Banco de dados indisponível ao criar o estúdio inicial.");
      const result = await database.insert(studios).values({
        name: env.studioName.trim() || "Meu Estúdio",
        email: normalizedEmail,
        masterKey: randomBytes(32).toString("hex"),
        isActive: 1,
      });
      studioId = Number(result[0].insertId);
      console.log(`[LocalAuth] Bootstrap studio created: ${env.studioName} (#${studioId})`);
    }

    if (!existing) {
      await db.createUser({
        openId: env.ownerOpenId || `local-admin-${Date.now()}`,
        name: env.name,
        email: normalizedEmail,
        role: "superadmin",
        studioId,
        passwordHash,
      });
      console.log(`[LocalAuth] Admin user created: ${env.email}`);
    } else {
      const updates: { passwordHash?: string; studioId?: number } = {};
      if (!existing.passwordHash) updates.passwordHash = passwordHash;
      if (!existing.studioId) updates.studioId = studioId;
      if (Object.keys(updates).length > 0) {
        await db.updateUser(existing.id, updates);
        console.log(`[LocalAuth] Existing admin bootstrap completed: ${env.email}`);
      } else {
        console.log(`[LocalAuth] Admin already configured: ${env.email}`);
      }
    }
  } catch (err) {
    console.error("[LocalAuth] Failed to ensure admin user:", err);
  }
}

/**
 * Hash a plain-text password.
 */
export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

/**
 * Verify a plain-text password against a stored hash.
 */
export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
