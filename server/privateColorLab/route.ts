import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import express, { type Express } from "express";
import { parse } from "cookie";
import { sdk } from "../_core/sdk";
import { isPrivateInboxOwner } from "../intelligentInbox/access";
import { COLOR_LAB_HTML } from "./asset";

export const COLOR_LAB_PATH = "/laboratorio/cores";
const COOKIE = "tatuei_color_lab";

function validKey(value: unknown): value is string {
  const expected = process.env.COLOR_LAB_ACCESS_KEY_SHA256 ?? "";
  if (!/^[a-f0-9]{64}$/.test(expected) || typeof value !== "string" || !/^[a-f0-9]{64}$/.test(value)) return false;
  return timingSafeEqual(createHash("sha256").update(value).digest(), Buffer.from(expected, "hex"));
}

export function colorLabHtml(userId: number, nonce: string) {
  if (!Number.isSafeInteger(userId) || userId < 1) throw new Error("Invalid laboratory owner");
  return COLOR_LAB_HTML
    .replace("<title>Paleta • CCM Tattoo</title>", "<title>Laboratório privado de cores · Tatuei</title>")
    .replace("const stateKey='ccm-tattoo-palette-v2'", `const stateKey='tatuei-private-color-lab-v2:user:${userId}'`)
    .replace("<script>", `<script nonce="${nonce}">`)
    .replace("<main>", '<main><div class="notice noprint" style="margin-bottom:20px"><strong>Laboratório privado · versão de testes</strong><br>As misturas são previsões aproximadas do modelo. Imagens e projetos ficam neste navegador; use “Salvar projeto JSON” para guardar uma cópia.</div>');
}

function accessPage(nonce: string) {
  return `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Acesso ao laboratório · Tatuei</title><body style="font-family:system-ui;padding:24px;max-width:650px;margin:auto"><h1>Laboratório privado de cores</h1><p id="status">Abra o link exclusivo recebido para acessar somente esta ferramenta. Também é possível entrar no CRM com sua conta proprietária e voltar a este endereço.</p><a href="/">Entrar no CRM</a><script nonce="${nonce}">
const key = new URLSearchParams(location.hash.slice(1)).get('chave');
if (key) {
  history.replaceState(null, '', location.pathname);
  document.getElementById('status').textContent = 'Validando acesso exclusivo…';
  fetch('${COLOR_LAB_PATH}/access', { method:'POST', credentials:'same-origin', headers:{'Content-Type':'application/json'}, body:JSON.stringify({key}) })
    .then(response => { if (!response.ok) throw new Error(); location.replace('${COLOR_LAB_PATH}'); })
    .catch(() => { document.getElementById('status').textContent = 'O link exclusivo é inválido ou foi revogado. Abra o link mais recente.'; });
}
</script></body></html>`;
}

export function registerPrivateColorLab(app: Express) {
  // Capability cookie belongs only to this namespace; it never creates a CRM session.
  app.use(COLOR_LAB_PATH, express.json({ limit: "1kb" }), async (req, res) => {
    res.setHeader("Cache-Control", "private, no-store, max-age=0");
    res.setHeader("X-Robots-Tag", "noindex, nofollow, noarchive");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("Vary", "Cookie");
    if (req.path === "/access") {
      if (req.method !== "POST") return res.status(405).set("Allow", "POST").end();
      if (!validKey(req.body?.key)) return res.status(403).json({ error: "Link inválido ou revogado." });
      res.cookie(COOKIE, req.body.key, {
        httpOnly: true, secure: true, sameSite: "strict", path: COLOR_LAB_PATH, maxAge: 86400000,
      });
      return res.status(204).end();
    }
    if (req.method !== "GET" && req.method !== "HEAD") return res.status(405).set("Allow", "GET, HEAD").end();
    if (!["/", "/index.html"].includes(req.path)) return res.status(404).end();
    const nonce = randomBytes(24).toString("base64");
    const exclusive = validKey(parse(req.headers.cookie ?? "")[COOKIE]);
    let user;
    if (!exclusive) {
      try { user = await sdk.authenticateRequest(req); }
      catch {
        res.setHeader("Content-Security-Policy", `default-src 'none'; script-src 'nonce-${nonce}'; style-src 'unsafe-inline'; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`);
        // A valid fragment key is exchanged by this page; fragment never enters HTTP logs.
        return res.status(200).type("html").send(accessPage(nonce));
      }
      if (!isPrivateInboxOwner(user) || user.isCron) return res.status(403).type("text").send("Laboratório disponível somente para a conta proprietária ou por link exclusivo.");
    }
    res.setHeader("Content-Security-Policy", `default-src 'none'; script-src 'nonce-${nonce}'; style-src 'unsafe-inline'; img-src data: blob:; connect-src 'none'; font-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`);
    // Separate browser storage from the logged-in owner's projects.
    return res.type("html").send(colorLabHtml(exclusive ? 9007199254740991 : user!.id, nonce));
  });
}
