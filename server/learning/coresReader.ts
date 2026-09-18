/** Public, read-only book route. No CRM data or authentication changes. */
import express, { type Express } from "express";
import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { inflateRawSync } from "node:zlib";
import { storageGet, storagePut } from "../storage";

const PREFIX = "/estudos/cores";
const SHA = "01fca88802f3a428c0c869031a80ae9c28888f6e1080df6219c96e3476465a59";
const SIZE = 40380868;
const KEY = `learning/cores-na-pele/${SHA}.zip`;
export const READER_FILES = new Set([
  "index.html", "app.js", "app.css", "manifest.webmanifest", "sw.js", "cache-list.json",
  "icon-192.png", "icon-512.png", "assets/narracao.mp3", "assets/apostila_original.pdf",
  "assets/figures/p06_1.png", "assets/figures/p07_1.png",
  ...Array.from({ length: 27 }, (_, i) => `assets/pages/${String(i + 1).padStart(2, "0")}.webp`),
]);

/** Only the exact, audited uploaded bundle is accepted. No arbitrary archives. */
export function unpackReader(bundle: Buffer): Map<string, Buffer> {
  if (bundle.length !== SIZE || createHash("sha256").update(bundle).digest("hex") !== SHA)
    throw new Error("Reader bundle checksum mismatch");
  let eocd = -1;
  for (let p = bundle.length - 22; p >= Math.max(0, bundle.length - 65557); p--) {
    if (bundle.readUInt32LE(p) === 0x06054b50) { eocd = p; break; }
  }
  if (eocd < 0) throw new Error("Reader ZIP directory missing");
  const count = bundle.readUInt16LE(eocd + 10);
  let pos = bundle.readUInt32LE(eocd + 16);
  const out = new Map<string, Buffer>();
  if (count > 100) throw new Error("Reader ZIP entry limit");
  for (let i = 0; i < count; i++) {
    if (pos + 46 > bundle.length || bundle.readUInt32LE(pos) !== 0x02014b50)
      throw new Error("Reader ZIP directory invalid");
    const flags = bundle.readUInt16LE(pos + 8), method = bundle.readUInt16LE(pos + 10);
    const compressed = bundle.readUInt32LE(pos + 20), expected = bundle.readUInt32LE(pos + 24);
    const nl = bundle.readUInt16LE(pos + 28), el = bundle.readUInt16LE(pos + 30), cl = bundle.readUInt16LE(pos + 32);
    const offset = bundle.readUInt32LE(pos + 42);
    const name = bundle.subarray(pos + 46, pos + 46 + nl).toString("utf8");
    pos += 46 + nl + el + cl;
    if (!name.startsWith("cores_mobile/")) throw new Error("Reader ZIP root invalid");
    const rel = name.slice("cores_mobile/".length);
    if (!READER_FILES.has(rel)) continue;
    if (out.has(rel) || (flags & 1) || expected > SIZE || offset + 30 > bundle.length || bundle.readUInt32LE(offset) !== 0x04034b50)
      throw new Error("Reader ZIP entry invalid");
    const start = offset + 30 + bundle.readUInt16LE(offset + 26) + bundle.readUInt16LE(offset + 28);
    if (start + compressed > bundle.length) throw new Error("Reader ZIP entry truncated");
    const packed = bundle.subarray(start, start + compressed);
    const data = method === 0 ? Buffer.from(packed) : method === 8 ? inflateRawSync(packed, { maxOutputLength: SIZE }) : null;
    if (!data || data.length !== expected) throw new Error("Reader ZIP compression invalid");
    out.set(rel, data);
  }
  if (out.size !== READER_FILES.size) throw new Error("Reader ZIP assets incomplete");
  return out;
}

async function downloadBundle(url: string): Promise<Buffer> {
  const response = await fetch(url, { signal: AbortSignal.timeout(90000), redirect: "error" });
  if (!response.ok || !response.body) throw new Error(`Reader source HTTP ${response.status}`);
  const declared = Number(response.headers.get("content-length") || SIZE);
  if (declared !== SIZE) throw new Error("Reader source size invalid");
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  for await (const chunk of response.body as any) {
    bytes += chunk.length;
    if (bytes > SIZE) throw new Error("Reader source too large");
    chunks.push(chunk);
  }
  const body = Buffer.concat(chunks);
  if (body.length !== SIZE || createHash("sha256").update(body).digest("hex") !== SHA)
    throw new Error("Reader source checksum mismatch");
  return body;
}

async function obtainBundle(): Promise<Buffer> {
  // Future restarts use durable S3 storage, never the temporary transfer URL.
  try {
    const stored = await storageGet(KEY);
    if (stored.url) return await downloadBundle(stored.url);
  } catch { /* The first installation has no stored bundle yet. */ }
  const source = process.env.CORES_READER_BUNDLE_URL;
  if (!source) throw new Error("Reader bundle not installed");
  const url = new URL(source);
  if (url.protocol !== "https:" || !url.hostname.endsWith(".oaiusercontent.com"))
    throw new Error("Reader transfer host not allowed");
  const bundle = await downloadBundle(url.toString());
  const saved = await storagePut(KEY, bundle, "application/zip");
  if (!saved.url) throw new Error("Reader durable storage unavailable");
  console.log("[CoresReader] Verified bundle saved to durable storage");
  return bundle;
}

export function adaptHostedReader(files: Map<string, Buffer>): void {
  const update = (file: string, edit: (s: string) => string) => files.set(file, Buffer.from(edit(files.get(file)!.toString("utf8"))));
  update("index.html", s => s.replace("</head>", '<meta name="robots" content="noindex,nofollow,noarchive"><meta name="apple-mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-title" content="Cores na Pele"></head>')
    .replace("Leitor de estudo 1.0", "Leitor de estudo 1.1 · versão web")
    .replace("Abra este arquivo em um navegador que execute HTML e áudio, não apenas no visualizador de anexos. A versão em arquivo contém os recursos para uso offline. A abertura local e a persistência do progresso variam", "Abra este endereço no Safari e toque em reproduzir para iniciar a narração. Para uso offline, salve o pacote abaixo antes de desconectar. A persistência do progresso varia"));
  update("app.js", s => s.replace("Pacote para hospedagem. Nenhum serviço de publicação foi configurado pelo leitor.", "Disponível por link no Tatuei. No iPhone, abra no Safari e toque em reproduzir. Não é necessário instalar outro aplicativo.")
    .replace("O navegador não iniciou o áudio. Toque novamente em reproduzir ou ative os controles do navegador em Ajustes. Se o arquivo estiver só na pré-visualização, abra-o em um navegador.", "Toque novamente em reproduzir. Se estiver no navegador interno de outro aplicativo, abra este mesmo link no Safari. Você também pode ativar os controles de áudio do navegador em Ajustes.")
    .replace("Não foi possível carregar o áudio. Abra em um navegador ou selecione o MP3 em Ajustes. O restante da apostila continua disponível.", "Não foi possível carregar o áudio. Confira sua conexão e abra este link no Safari. O restante da apostila continua disponível."));
  update("sw.js", s => s.replace("cores-na-pele-mobile-v1", "cores-na-pele-web-v1-1")
    .replace("new URL(req.url).origin!==self.location.origin", "new URL(req.url).origin!==self.location.origin||!new URL(req.url).pathname.startsWith(new URL(self.registration.scope).pathname)"));
}

let readyDirectory: string | null = null;
let pending: Promise<string> | null = null;
let retryAfter = 0;
async function ensureReader(): Promise<string> {
  if (readyDirectory) return readyDirectory;
  if (pending) return pending;
  if (Date.now() < retryAfter) throw new Error("Reader installation retry pending");
  pending = (async () => {
    let dir: string | undefined;
    try {
      const files = unpackReader(await obtainBundle());
      adaptHostedReader(files);
      dir = await fs.mkdtemp(path.join(tmpdir(), "tatuei-cores-"));
      for (const [rel, bytes] of files) {
        const dest = path.join(dir, rel);
        await fs.mkdir(path.dirname(dest), { recursive: true });
        await fs.writeFile(dest, bytes);
      }
      readyDirectory = dir;
      console.log(`[CoresReader] Ready: ${files.size} read-only assets at ${PREFIX}/`);
      return dir;
    } catch (error) {
      if (dir) await fs.rm(dir, { recursive: true, force: true }).catch(() => undefined);
      retryAfter = Date.now() + 15000;
      console.warn("[CoresReader] Book unavailable; CRM remains unaffected");
      throw error;
    }
  })();
  try { return await pending; } finally { pending = null; }
}

export function registerCoresReader(app: Express): void {
  let serve: ReturnType<typeof express.static> | null = null;
  app.use(PREFIX, (req, res, next) => {
    res.set({ "X-Robots-Tag": "noindex, nofollow, noarchive", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer" });
    if (!["GET", "HEAD"].includes(req.method)) { res.set("Allow", "GET, HEAD").status(405).end(); return; }
    if (req.originalUrl.split("?")[0] === PREFIX) { res.redirect(302, `${PREFIX}/`); return; }
    let asset: string;
    try { asset = decodeURIComponent(req.path).replace(/^\//, "") || "index.html"; }
    catch { res.status(400).end(); return; }
    if (!READER_FILES.has(asset)) { res.status(404).type("text").send("Arquivo não encontrado."); return; }
    res.set("Content-Security-Policy", "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' blob:; connect-src 'self'; worker-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'");
    ensureReader().then(dir => {
      serve ??= express.static(dir, {
        acceptRanges: true, dotfiles: "deny", index: "index.html", redirect: false, etag: true, maxAge: "1h",
        setHeaders: (response, file) => {
          if (/\.(?:html|js|json|webmanifest)$/.test(file)) response.setHeader("Cache-Control", "no-cache");
          if (file.endsWith(".mp3")) response.setHeader("Content-Type", "audio/mpeg");
        },
      });
      serve(req, res, err => { if (err) next(err); else if (!res.headersSent) res.status(404).end(); });
    }).catch(() => {
      res.set({ "Cache-Control": "no-store", "Retry-After": "15" }).status(503).type("html").send('<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Cores na Pele</title><main><h1>Cores na Pele</h1><p>A apostila está sendo preparada. Atualize esta página em alguns instantes.</p></main></html>');
    });
  });
  // Do not block healthchecks, CRM startup, authentication or database operations.
  void ensureReader().catch(() => undefined);
}
