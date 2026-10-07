import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getDb: vi.fn(), getStudioById: vi.fn() }));
vi.mock("./db", async importOriginal => ({
  ...await importOriginal<typeof import("./db")>(),
  getDb: mocks.getDb,
  getStudioById: mocks.getStudioById,
}));

import { canAccessBtboludismo } from "./btboludismoAccess";
import { btboludismoRouter } from "./routers/btboludismo";
import { appRouter } from "./routers";
import * as saas from "./saas";

const owner = {
  id: 42, openId: "synthetic-owner", email: "owner@example.test", name: "Test Owner",
  role: "superadmin", studioId: null, artistId: null, isActive: 1,
  accessStatus: "active", accessExpiresAt: null, passwordHash: "not-for-clients",
} as const;
const context = (user: unknown) => ({
  user,
  req: { protocol: "https", headers: { "x-user-id": "42", "x-studio-id": "999" } },
  res: {},
}) as any;

beforeEach(() => {
  vi.restoreAllMocks();
  vi.stubEnv("BTBOLUDISMO_PILOT_ENABLED", "true");
  vi.stubEnv("BTBOLUDISMO_OWNER_USER_ID", "42");
  // Unrelated owner settings deliberately cannot authorize this pilot.
  vi.stubEnv("LOCAL_ADMIN_EMAIL", owner.email);
  vi.stubEnv("OWNER_OPEN_ID", owner.openId);
  mocks.getDb.mockReset().mockImplementation(() => { throw new Error("Unexpected CRM database access"); });
  mocks.getStudioById.mockReset().mockResolvedValue({ name: "Synthetic Studio" });
  vi.spyOn(globalThis, "fetch").mockImplementation(async () => { throw new Error("Unexpected provider request"); });
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("Btboludismo private pilot", () => {
  it("serves only the fixed URL to the configured active human owner without CRM or provider access", async () => {
    const result = await appRouter.createCaller(context(owner)).btboludismo.access();
    expect(result).toEqual({ url: "https://btboludismo.williancunha.chatgpt.site" });
    expect(mocks.getDb).not.toHaveBeenCalled();
    expect(mocks.getStudioById).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("publishes the same authorization decision in auth.me and preserves safe user metadata", async () => {
    const result = await appRouter.createCaller(context({ ...owner, studioId: 10 })).auth.me();
    expect(result).toMatchObject({ id: owner.id, studioName: "Synthetic Studio", canAccessBtboludismo: true });
    expect(result).not.toHaveProperty("passwordHash");
    expect(mocks.getStudioById).toHaveBeenCalledWith(10);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("requires a session on the direct API and returns null from auth.me without a session", async () => {
    await expect(btboludismoRouter.createCaller(context(null)).access()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(appRouter.createCaller(context(null)).auth.me()).resolves.toBeNull();
  });

  const forbiddenIdentities = [
    ["another superadmin with the same email/name", { ...owner, id: 43 }],
    ["admin with the configured ID", { ...owner, role: "admin" }],
    ["collaborator with the configured ID", { ...owner, role: "collaborator" }],
    ["inactive owner", { ...owner, isActive: 0 }],
    ["suspended owner", { ...owner, accessStatus: "suspended" }],
    ["expired owner", { ...owner, accessStatus: "expired" }],
    ["owner with a past expiry", { ...owner, accessExpiresAt: "2000-01-01 00:00:00" }],
    ["owner with an invalid expiry", { ...owner, accessExpiresAt: "invalid" }],
    ["owner without an explicit active status", { ...owner, accessStatus: undefined }],
    ["owner with a nonpositive ID", { ...owner, id: -1 }],
    ["synthetic cron superadmin", { ...owner, id: -1, isCron: true, taskUid: "synthetic-task" }],
    ["positive-ID task identity", { ...owner, isCron: true }],
    ["identity carrying taskUid", { ...owner, taskUid: "synthetic-task" }],
    ["cron-prefixed identity", { ...owner, openId: "cron_synthetic" }],
  ] as const;
  it.each(forbiddenIdentities)("denies %s through the API and auth.me capability", async (_label, user) => {
    await expect(btboludismoRouter.createCaller(context(user)).access()).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(await appRouter.createCaller(context(user)).auth.me()).toMatchObject({ canAccessBtboludismo: false });
    expect(mocks.getDb).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each([undefined, "", "false", "1", "TRUE", " true "])("fails closed for feature configuration %s", async flag => {
    vi.stubEnv("BTBOLUDISMO_PILOT_ENABLED", flag);
    expect(await canAccessBtboludismo(owner)).toBe(false);
    await expect(btboludismoRouter.createCaller(context(owner)).access()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it.each([undefined, "", "0", "-42", "42.0", "42suffix", "042", " 42 ", "Infinity", "9007199254740993"])("fails closed for owner ID configuration %s without email fallback", async configuredId => {
    vi.stubEnv("BTBOLUDISMO_OWNER_USER_ID", configuredId);
    expect(await canAccessBtboludismo(owner)).toBe(false);
    await expect(btboludismoRouter.createCaller(context(owner)).access()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("rechecks configuration for every API and capability request", async () => {
    const caller = appRouter.createCaller(context(owner));
    await expect(caller.btboludismo.access()).resolves.toHaveProperty("url");
    vi.stubEnv("BTBOLUDISMO_OWNER_USER_ID", "43");
    await expect(caller.btboludismo.access()).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(await caller.auth.me()).toMatchObject({ canAccessBtboludismo: false });
    vi.stubEnv("BTBOLUDISMO_OWNER_USER_ID", "42");
    vi.stubEnv("BTBOLUDISMO_PILOT_ENABLED", "false");
    await expect(caller.btboludismo.access()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("ignores attempted owner selection through client payload and custom headers", async () => {
    const caller = btboludismoRouter.createCaller(context({ ...owner, id: 43 }));
    await expect((caller.access as any)({ ownerUserId: 42, role: "superadmin", enabled: true, url: "https://example.test" }))
      .rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("awaits a negative active-access decision instead of exposing an unresolved Promise", async () => {
    let finish!: (active: boolean) => void;
    vi.spyOn(saas, "isUserAccessActive").mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    let settled = false;
    const pending = appRouter.createCaller(context(owner)).auth.me().then(result => { settled = true; return result; });
    await Promise.resolve();
    await Promise.resolve();
    expect(settled).toBe(false);
    // Wait for the query's middleware to reach the async authorization check.
    await vi.waitFor(() => expect(finish).toBeTypeOf("function"));
    finish(false);
    expect(await pending).toMatchObject({ canAccessBtboludismo: false });
  });

  it("fails closed if active-access validation rejects", async () => {
    vi.spyOn(saas, "isUserAccessActive").mockRejectedValue(new Error("Synthetic access-check failure"));
    expect(await canAccessBtboludismo(owner)).toBe(false);
    expect(await appRouter.createCaller(context(owner)).auth.me()).toMatchObject({ canAccessBtboludismo: false });
    await expect(btboludismoRouter.createCaller(context(owner)).access()).rejects.toBeDefined();
    expect(fetch).not.toHaveBeenCalled();
  });
});
