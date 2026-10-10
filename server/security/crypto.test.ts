import { describe, expect, it, vi } from "vitest";
vi.mock("../_core/env", () => ({ ENV: { authSecurityKey: "a".repeat(64) } }));
import {
  base32,
  credentialVersion,
  decryptSecret,
  encryptSecret,
  totp,
  verifyTotp,
} from "./crypto";
import { passwordPolicy } from "../../shared/passwordPolicy";
const secret = base32(Buffer.from("12345678901234567890"));
describe("RFC 6238 SHA-1 test vectors", () => {
  it.each([
    [59, "94287082"],
    [1111111109, "07081804"],
    [1111111111, "14050471"],
    [1234567890, "89005924"],
    [2000000000, "69279037"],
    [20000000000, "65353130"],
  ])("matches vector at %s seconds", (time, expected) =>
    expect(totp(secret, Math.floor(Number(time) / 30), 8)).toBe(expected)
  );
  it("rejects replay, stale codes and malformed values", () => {
    const now = 1234567890000;
    const counter = Math.floor(now / 30000);
    const code = totp(secret, counter);
    expect(verifyTotp(secret, code, -1, now)).toBe(counter);
    expect(verifyTotp(secret, code, counter, now)).toBeNull();
    expect(verifyTotp(secret, code, -1, now + 90000)).toBeNull();
    expect(verifyTotp(secret, "abc123", -1, now)).toBeNull();
  });
});
describe("MFA cryptographic boundaries", () => {
  it("binds encrypted secrets to the owner and detects tampering", () => {
    const encrypted = encryptSecret(secret, 12);
    expect(encrypted).not.toContain(secret);
    expect(decryptSecret(encrypted, 12)).toBe(secret);
    expect(() => decryptSecret(encrypted, 13)).toThrow();
    const altered = Buffer.from(encrypted, "base64");
    altered[30] ^= 1;
    expect(() => decryptSecret(altered.toString("base64"), 12)).toThrow();
  });
  it("invalidates credential versions after password or MFA changes", () => {
    const user = { id: 1, passwordHash: "old-hash" };
    const version = credentialVersion(user, 0);
    expect(
      credentialVersion({ ...user, passwordHash: "new-hash" }, 0)
    ).not.toBe(version);
    expect(credentialVersion(user, 1)).not.toBe(version);
    expect(credentialVersion({ ...user, id: 2 }, 0)).not.toBe(version);
  });
  it("rejects short passwords and bcrypt truncation, accepts long phrases", () => {
    expect(passwordPolicy.safeParse("123456").success).toBe(false);
    expect(passwordPolicy.safeParse("Uma frase segura com 2026!").success).toBe(
      true
    );
    expect(passwordPolicy.safeParse("á".repeat(37)).success).toBe(false);
    expect(passwordPolicy.safeParse("a".repeat(73)).success).toBe(false);
  });
});
