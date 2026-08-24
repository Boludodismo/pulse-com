import type { Express, Request, Response } from "express";
import bcrypt from "bcryptjs";
import * as db from "../db";
import { getSessionCookieOptions } from "./cookies";
import { sdk } from "./sdk";
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

const SALT_ROUNDS = 10;

/**
 * Local authentication mode — multi-user with bcrypt password hashing.
 * Activated when AUTH_MODE=local.
 */
export function registerLocalAuthRoutes(app: Express) {
  // ── Login ──────────────────────────────────────────────────────────────────
  app.post("/api/auth/local/login", async (req: Request, res: Response) => {
    const { email, password } = req.body as { email?: string; password?: string };

    if (!email || !password) {
      res.status(400).json({ error: "E-mail e senha são obrigatórios." });
      return;
    }

    try {
      const user = await db.getUserByEmail(email.trim().toLowerCase());

      if (!user || !user.passwordHash) {
        res.status(401).json({ error: "Credenciais inválidas." });
        return;
      }

      if (!user.isActive) {
        res.status(403).json({ error: "Usuário inativo. Contate o administrador." });
        return;
      }

      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) {
        res.status(401).json({ error: "Credenciais inválidas." });
        return;
      }

      // Update lastSignedIn only — do NOT overwrite name/email/role
      await db.updateUser(user.id, { lastSignedIn: new Date().toISOString() });

      const sessionToken = await sdk.createSessionToken(user.openId, {
        name: user.name ?? "",
        expiresInMs: ONE_YEAR_MS,
      });

      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
      res.json({ success: true, user: { email: user.email, name: user.name, role: user.role } });
    } catch (error) {
      console.error("[LocalAuth] Login failed", error);
      res.status(500).json({ error: "Erro interno ao fazer login." });
    }
  });

  // ── Logout ─────────────────────────────────────────────────────────────────
  app.post("/api/auth/local/logout", (req: Request, res: Response) => {
    res.clearCookie(COOKIE_NAME, { path: "/" });
    res.json({ success: true });
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
}): Promise<void> {
  try {
    const existing = await db.getUserByEmail(env.email.trim().toLowerCase());
    const passwordHash = await bcrypt.hash(env.password, SALT_ROUNDS);

    if (!existing) {
      // Create fresh admin
      await db.createUser({
        openId: env.ownerOpenId || `local-admin-${Date.now()}`,
        name: env.name,
        email: env.email.trim().toLowerCase(),
        role: "superadmin",
        passwordHash,
      });
      console.log(`[LocalAuth] Admin user created: ${env.email}`);
    } else if (!existing.passwordHash) {
      // Existing user without password — set it (preserve existing role)
      await db.updateUser(existing.id, { passwordHash });
      console.log(`[LocalAuth] Password set for existing admin: ${env.email}`);
    } else {
      // Admin already exists with password — do NOT overwrite
      console.log(`[LocalAuth] Admin already configured: ${env.email}`);
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
