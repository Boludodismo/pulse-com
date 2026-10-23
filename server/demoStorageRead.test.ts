import { describe, it, expect, vi, afterEach } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
let directory = "";
afterEach(async () => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.resetModules(); if (directory) await rm(directory, { recursive: true, force: true }); });
describe("authenticated demo storage internal reads", () => {
  it("reads relative storage objects without HTTP and preserves token and size checks", async () => {
    directory = await mkdtemp("/tmp/tatuei-demo-read-");
    vi.stubEnv("DEMO_MODE", "true"); vi.stubEnv("DEMO_UPLOAD_DIR", directory);
    vi.stubEnv("STORAGE_PROVIDER", "demo"); vi.stubEnv("JWT_SECRET", "fiction-only-signing-key");
    const storage = await import("./storage");
    const bytes = Buffer.from("fiction image bytes");
    const file = await storage.storagePut("procedures/1/1/fiction.png", bytes, "image/png");
    const url = new URL(file.url, "http://127.0.0.1");
    expect(storage.verifyStorageAccessToken(file.key, url.searchParams.get("token")!)).toBe(true);
    expect(storage.verifyStorageAccessToken(file.key, "invalid")).toBe(false);
    const network = vi.fn(() => { throw new Error("No network allowed"); });
    vi.stubGlobal("fetch", network);
    expect(await storage.storageReadObject(file.key, 1024)).toEqual({ bytes, mime: "image/png" });
    await expect(storage.storageReadObject(file.key, 1)).rejects.toThrow();
    expect(network).not.toHaveBeenCalled();
  });
});
