import { describe, expect, it } from "vitest";
import { parseAccessExpiry, invitationExpiresAt, isUserAccessActive, SAAS_MODULES } from "./saas";

describe("SaaS access controls", () => {
  it("creates invitation expiry exactly seven days ahead by default", () => {
    const before = Date.now() + 7 * 24 * 60 * 60 * 1000;
    const expiry = parseAccessExpiry(invitationExpiresAt());
    const after = Date.now() + 7 * 24 * 60 * 60 * 1000;
    expect(expiry).toBeGreaterThanOrEqual(before - 1000);
    expect(expiry).toBeLessThanOrEqual(after + 1000);
  });

  it("keeps superadmin active without a tenant expiry", async () => {
    await expect(isUserAccessActive({ role: "superadmin", isActive: 1 })).resolves.toBe(true);
  });

  it("blocks suspended, inactive and expired tenant users", async () => {
    await expect(isUserAccessActive({ role: "admin", isActive: 0 })).resolves.toBe(false);
    await expect(isUserAccessActive({ role: "admin", isActive: 1, accessStatus: "suspended" })).resolves.toBe(false);
    await expect(isUserAccessActive({ role: "admin", isActive: 1, accessExpiresAt: "2000-01-01 00:00:00" })).resolves.toBe(false);
  });

  it("preserves existing modules and adds isolated inbox permissions", () => {
    expect(SAAS_MODULES).toEqual(["clients", "appointments", "stock", "finance", "anamnesis", "pod", "reports", "intelligent_inbox", "inbox_conversations", "inbox_summaries", "inbox_priorities", "inbox_opportunities", "inbox_settings", "inbox_suggestions"]);
  });
});
