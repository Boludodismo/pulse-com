import { randomBytes } from "node:crypto";
import type { Express } from "express";
import { sdk } from "../_core/sdk";
import { isPrivateInboxOwner } from "../intelligentInbox/access";
import { COLOR_LAB_HTML } from "./asset";

export const COLOR_LAB_PATH = "/laboratorio/cores";

export function colorLabHtml(userId: number, nonce: string) {
  if (!Number.isSafeInteger(userId) || userId < 1) throw new Error("Invalid laboratory owner");
  return COLOR_LAB_HTML
    .replace("<title>Paleta • CCM Tattoo</title>", "<title>Laboratório privado de cores · Tatuei</title>")
    .replace("const stateKey='ccm-tattoo-palette-v2'", `const stateKey='tatuei-private-color-lab-v2:user:${userId}'`)
    .replace("<script>", `<script nonce="${nonce}">`)
    .replace("<main>", '<main><div class="notice noprint" style="margin-bottom:20px"><strong>Laboratório privado · versão de testes</strong><br>As misturas são previsões aproximadas do modelo. Imagens e projetos ficam neste navegador; use “Salvar projeto JSON” para guardar uma cópia. <a href="/">Voltar ao CRM</a></div>');
}

export function registerPrivateColorLab(app: Express) {
  // Handles the whole namespace before the SPA fallback, including direct asset guesses.
  app.use(COLOR_LAB_PATH, async (req, res) => {
    res.setHeader("Cache-Control", "private, no-store, max-age=0");
    res.setHeader("X-Robots-Tag", "noindex, nofollow, noarchive");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("Vary", "Cookie");
    let user;
    try { user = await sdk.authenticateRequest(req); }
    catch {
      return res.status(401).type("html").send('<!doctype html><html lang="pt-BR"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Acesso ao laboratório</title><body style="font-family:system-ui;padding:24px"><h1>Entre na sua conta</h1><p>O laboratório é privado. Entre no CRM com sua conta proprietária e abra este link novamente.</p><a href="/login">Entrar no CRM</a></body></html>');
    }
    if (!isPrivateInboxOwner(user) || user.isCron) return res.status(403).type("text").send("Laboratório disponível somente para a conta proprietária.");
    if (req.method !== "GET" && req.method !== "HEAD") return res.status(405).set("Allow", "GET, HEAD").end();
    if (!["/", "/index.html"].includes(req.path)) return res.status(404).end();
    const nonce = randomBytes(24).toString("base64");
    res.setHeader("Content-Security-Policy", `default-src 'none'; script-src 'nonce-${nonce}'; style-src 'unsafe-inline'; img-src data: blob:; connect-src 'none'; font-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`);
    return res.type("html").send(colorLabHtml(user.id, nonce));
  });
}
