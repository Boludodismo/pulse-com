import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import type { Server } from "node:http";
import { createHash } from "node:crypto";
import { Script, createContext, runInContext } from "node:vm";
const mocks = vi.hoisted(() => ({ authenticate: vi.fn() }));
vi.mock("../_core/sdk", () => ({ sdk: { authenticateRequest: mocks.authenticate } }));
import { registerPrivateColorLab, COLOR_LAB_PATH, colorLabHtml } from "./route";
import { COLOR_LAB_HTML } from "./asset";
import { ENV } from "../_core/env";
let server: Server;
let base: string;
const owner = { id: 1, email: "owner@example.test", role: "superadmin", openId: "owner" };
beforeEach(async () => {
  vi.resetAllMocks(); ENV.authMode = "local"; vi.stubEnv("LOCAL_ADMIN_EMAIL", owner.email);
  mocks.authenticate.mockResolvedValue(owner);
  const app = express(); registerPrivateColorLab(app); app.use((_req, res) => res.send("SPA fallback"));
  await new Promise<void>(resolve => { server = app.listen(0, "127.0.0.1", resolve); });
  base = `http://127.0.0.1:${(server.address() as any).port}${COLOR_LAB_PATH}`;
});
afterEach(async () => { vi.unstubAllEnvs(); server.closeAllConnections(); await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); });
describe("private color calculator route", () => {
  it("serves the real v2 calculator only for the verified owner, with a user-specific local session", async () => {
    const response = await fetch(base); expect(response.status).toBe(200);
    const html = await response.text(); expect(html).toContain("Laboratório privado"); expect(html).toContain("tatuei-private-color-lab-v2:user:1");
    expect(html).toContain("Média 5×5"); expect(html).toContain("Guache"); expect(html).toContain("Aquarela");
    expect(response.headers.get("cache-control")).toContain("no-store"); expect(response.headers.get("x-robots-tag")).toContain("noindex");
    const nonce = /<script nonce="([^"]+)"/.exec(html)![1]; expect(response.headers.get("content-security-policy")).toContain(`'nonce-${nonce}'`);
    expect(response.headers.get("content-security-policy")).toContain("connect-src 'none'");
    expect(() => new Script(/<script[^>]*>([\s\S]*?)<\/script>/.exec(html)![1])).not.toThrow();
  });
  it.each(["admin", "collaborator", "superadmin"])("denies a different %s even if they know the URL", async role => {
    mocks.authenticate.mockResolvedValue({ ...owner, role, id: 2, email: "another@example.test" });
    const response = await fetch(base); expect(response.status).toBe(403); expect(await response.text()).not.toContain("const BASE");
  });
  it("denies anonymous requests and assets, with no SPA fallback or calculator source", async () => {
    mocks.authenticate.mockRejectedValue(new Error("Invalid session"));
    for (const path of ["", "/index.html", "/app.js"]) {
      const response = await fetch(base + path); expect(response.status).toBe(path === "/app.js" ? 404 : 200); const body = await response.text();
      expect(body).not.toContain("const BASE"); expect(body).not.toContain("SPA fallback"); expect(body).not.toContain('href="/login"');
    }
  });
  it("denies scheduled identities and unknown assets; local project data has no write endpoint", async () => {
    mocks.authenticate.mockResolvedValue({ ...owner, isCron: true }); expect((await fetch(base)).status).toBe(403);
    mocks.authenticate.mockResolvedValue(owner); expect((await fetch(base + "/save")).status).toBe(404);
    expect((await fetch(base, { method: "POST" })).status).toBe(405);
    expect(() => colorLabHtml(-1, "nonce")).toThrow();
  });
  it("exchanges a fragment capability for a scoped cookie without authenticating the CRM", async () => {
    const key = "a".repeat(64);
    vi.stubEnv("COLOR_LAB_ACCESS_KEY_SHA256", createHash("sha256").update(key).digest("hex"));
    mocks.authenticate.mockRejectedValue(new Error("No CRM session"));
    expect((await fetch(base + "/access", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key: "wrong" }) })).status).toBe(403);
    const response = await fetch(base + "/access", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key }) });
    expect(response.status).toBe(204);
    const cookie = response.headers.get("set-cookie")!;
    expect(cookie).toContain("Path=/laboratorio/cores"); expect(cookie).toContain("HttpOnly"); expect(cookie).toContain("Secure"); expect(cookie).toContain("SameSite=Strict");
    expect(cookie).not.toContain("app_session");
    const html = await (await fetch(base, { headers: { Cookie: cookie.split(";")[0] } })).text();
    expect(html).toContain("Média 5×5"); expect(html).not.toContain('href="/"');
    expect(mocks.authenticate).not.toHaveBeenCalled();
  });
  it("revokes capability cookies when the configured key is removed", async () => {
    mocks.authenticate.mockRejectedValue(new Error("No CRM session"));
    vi.stubEnv("COLOR_LAB_ACCESS_KEY_SHA256", "");
    const response = await fetch(base, { headers: { Cookie: "tatuei_color_lab=" + "a".repeat(64) } });
    expect(await response.text()).not.toContain("const BASE");
  });
  it("preserves integral drop totals in all cup sizes and the standard CIEDE2000 reference", () => {
    const js = /<script>([\s\S]*?)<\/script>/.exec(COLOR_LAB_HTML)![1];
    const context = createContext({}); runInContext(js.slice(0, js.indexOf("const $")), context);
    for (const size of [12, 24, 48]) {
      const drops = runInContext(`roundDrops([0.13,0.22,0.31,0.34],${size})`, context) as number[];
      expect(drops.reduce((a,b) => a+b, 0)).toBe(size); expect(drops.every(n => Number.isInteger(n) && n >= 0)).toBe(true);
    }
    expect(runInContext("deltaE([50,2.6772,-79.7751],[50,0,-82.7485])", context)).toBeCloseTo(2.0425, 4);
  });
});
