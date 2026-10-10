import type { RequestHandler } from "express";
import { ENV } from "../_core/env";
export const securityHeaders: RequestHandler = (req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  if (req.path.startsWith("/api/auth") || req.path.startsWith("/api/trpc"))
    res.setHeader("Cache-Control", "no-store");
  if (
    ENV.authMode === "local" &&
    req.method === "POST" &&
    (req.path.startsWith("/api/auth") || req.path.startsWith("/api/trpc"))
  ) {
    const origin = req.get("origin");
    const allowed = new Set([
      ENV.appBaseUrl,
      `https://${req.get("host")}`,
      ...(ENV.isProduction ? [] : [`http://${req.get("host")}`]),
    ]);
    if (
      (origin && !allowed.has(origin)) ||
      req.get("sec-fetch-site") === "cross-site"
    ) {
      res.status(403).json({ error: "Origem da solicitação não autorizada." });
      return;
    }
  }
  next();
};
