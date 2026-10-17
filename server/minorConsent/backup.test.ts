import { beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
const fixture = vi.hoisted(() => ({
  record: {} as any,
  files: [] as any[],
  storage: new Map<string, Buffer>(),
  queries: [] as any[],
  failWrite: false,
}));
const secret = "test-backup-key-only-".repeat(3);
vi.mock("../_core/env", () => ({
  ENV: { authSecurityKey: "test-backup-key-only-".repeat(3) },
}));
vi.mock("../storage", () => ({
  storagePut: async (key: string, bytes: Buffer) => {
    if (fixture.failWrite) throw new Error("storage unavailable");
    fixture.storage.set(key, Buffer.from(bytes));
    return { key, url: "unused-private-url" };
  },
  storageReadBuffer: async (key: string) => {
    const bytes = fixture.storage.get(key);
    if (!bytes) throw new Error("missing");
    return bytes;
  },
}));
vi.mock("./database", () => {
  const query = async (sql: string, values: any[]) => {
    fixture.queries.push([sql, values]);
    if (sql.includes("SET backup_key=")) {
      fixture.record.backup_key = values[0];
      fixture.record.backup_revision = values[1];
    }
    return [{ affectedRows: 1 }];
  };
  const connection = { query, release: vi.fn() };
  return {
    rows: async (sql: string) => {
      if (sql.includes("GET_LOCK")) return [{ ok: 1 }];
      if (sql.includes("FROM minor_consent_requests")) return [fixture.record];
      if (sql.includes("FROM minor_consent_files")) return fixture.files;
      if (sql.includes("FROM minor_consent_events"))
        return [{ action: "submitted" }];
      if (sql.includes("FROM minor_consent_notices"))
        return [{ recipient: "studio", status: "queued" }];
      return [];
    },
    pool: () => ({ query, getConnection: async () => connection }),
    audit: vi.fn(),
  };
});
import { backupConsent, openConsentBackup, sha } from "./backup";
beforeEach(() => {
  fixture.storage.clear();
  fixture.queries = [];
  fixture.failWrite = false;
  fixture.record = {
    id: 11,
    studio_id: 1,
    revision: 3,
    backup_revision: -1,
    submission_hash: "test-hash",
    submitted_at: "2026-10-17",
  };
  const bytes = Buffer.from("%PDF-1.7\noriginal attachment bytes");
  fixture.files = [
    {
      id: "test-file",
      request_id: 11,
      kind: "signed_pdf",
      storage_key: "private-document",
      sha256: sha(bytes),
      mime: "application/pdf",
    },
  ];
  fixture.storage.set("private-document", bytes);
});
describe("consent backup archive and recovery", () => {
  it("roundtrips a full record with attachments, audit and notices through the offline recovery command", async () => {
    await backupConsent(11);
    expect(fixture.record.backup_revision).toBe(3);
    const archive = fixture.storage.get(fixture.record.backup_key)!;
    const snapshot = openConsentBackup(archive, secret);
    expect(snapshot.events[0].action).toBe("submitted");
    expect(snapshot.notices[0].recipient).toBe("studio");
    expect(Buffer.from(snapshot.attachments[0].data, "base64")).toEqual(
      fixture.storage.get("private-document")
    );
    const directory = await mkdtemp(path.join(tmpdir(), "tatuei-backup-test-"));
    try {
      const input = path.join(directory, "archive.enc"),
        output = path.join(directory, "restored");
      await writeFile(input, archive);
      const result = execFileSync(
        process.execPath,
        [
          "scripts/restore-consent-backup.mjs",
          "--input",
          input,
          "--output",
          output,
        ],
        {
          cwd: process.cwd(),
          env: { ...process.env, AUTH_SECURITY_KEY: secret },
          encoding: "utf8",
        }
      );
      expect(JSON.parse(result)).toMatchObject({
        verified: true,
        recordId: 11,
        revision: 3,
        files: 1,
        extracted: true,
      });
      expect(
        await readFile(path.join(output, "signed_pdf-test-file.pdf"))
      ).toEqual(fixture.storage.get("private-document"));
      expect(
        JSON.parse(await readFile(path.join(output, "registro.json"), "utf8"))
          .record.id
      ).toBe(11);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
  it("keeps the original and reports a pending backup when storage fails", async () => {
    fixture.failWrite = true;
    await backupConsent(11);
    expect(fixture.record.backup_revision).toBe(-1);
    expect(fixture.storage.has("private-document")).toBe(true);
    expect(
      fixture.queries.some(([sql]) => sql.includes("SET backup_error="))
    ).toBe(true);
  });
  it("refuses an attachment whose bytes no longer match its stored hash", async () => {
    fixture.storage.set("private-document", Buffer.from("changed"));
    await backupConsent(11);
    expect(fixture.record.backup_revision).toBe(-1);
    expect(fixture.record.backup_key).toBeUndefined();
  });
});
