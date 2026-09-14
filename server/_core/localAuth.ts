import type { Express, Request, Response } from "express";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { studios } from "../../drizzle/schema";
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
  studioName: string;
}): Promise<void> {
  try {
    const normalizedEmail = env.email.trim().toLowerCase();
    const existing = await db.getUserByEmail(normalizedEmail);
    const passwordHash = await bcrypt.hash(env.password, SALT_ROUNDS);

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
