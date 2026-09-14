// Run with Node 24+: node --test scripts/anamnese-time.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { anamneseExpiryForDatabase, parseAnamneseExpiry } from "../server/anamneseTime.ts";

test("request ISO expiration is valid MySQL TIMESTAMP text", () => {
  assert.equal(anamneseExpiryForDatabase("2026-09-17T01:43:32.306Z"), "2026-09-17 01:43:32");
});
test("existing SQL timestamps stay unchanged", () => {
  assert.equal(anamneseExpiryForDatabase("2026-09-17 01:43:32"), "2026-09-17 01:43:32");
});
test("SQL expiration reads as UTC regardless of server timezone", () => {
  assert.equal(parseAnamneseExpiry("2026-09-17 01:43:32").toISOString(), "2026-09-17T01:43:32.000Z");
});
test("explicit timezone offsets preserve the instant", () => {
  assert.equal(anamneseExpiryForDatabase("2026-09-16T22:43:32-03:00"), "2026-09-17 01:43:32");
});
test("seven day validity survives storage to second precision", () => {
  const now = new Date("2026-09-10T01:43:32Z");
  const expires = new Date(now.getTime() + 7 * 86400000);
  assert.equal(parseAnamneseExpiry(anamneseExpiryForDatabase(expires)).getTime() - now.getTime(), 7 * 86400000);
});
test("invalid expiration is rejected before insertion", () => {
  assert.throws(() => anamneseExpiryForDatabase("invalid"), /inválida/);
});
