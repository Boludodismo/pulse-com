import {
  createCipheriv,
  createDecipheriv,
  createHash,
  hkdfSync,
  randomBytes,
} from "node:crypto";
import { gzipSync, gunzipSync } from "node:zlib";
import { ENV } from "../_core/env";
import { storagePut, storageReadBuffer } from "../storage";
import { audit, rows, pool } from "./database";
export const sha = (value: Buffer | string) =>
  createHash("sha256").update(value).digest("hex");
function key(secret: string) {
  if (Buffer.byteLength(secret) < 32)
    throw new Error("Chave de backup indisponível");
  return Buffer.from(
    hkdfSync("sha256", secret, "tatuei-consent-backup-v1", "documents", 32)
  );
}
export function sealConsentBackup(
  snapshot: object,
  secret = ENV.authSecurityKey
) {
  const nonce = randomBytes(12),
    cipher = createCipheriv("aes-256-gcm", key(secret), nonce);
  const compressed = gzipSync(Buffer.from(JSON.stringify(snapshot)));
  const encrypted = Buffer.concat([cipher.update(compressed), cipher.final()]);
  return Buffer.concat([
    Buffer.from("TATUEIC1"),
    nonce,
    cipher.getAuthTag(),
    encrypted,
  ]);
}
export function openConsentBackup(data: Buffer, secret = ENV.authSecurityKey) {
  if (data.subarray(0, 8).toString() !== "TATUEIC1")
    throw new Error("Formato de backup inválido");
  const cipher = createDecipheriv(
    "aes-256-gcm",
    key(secret),
    data.subarray(8, 20)
  );
  cipher.setAuthTag(data.subarray(20, 36));
  return JSON.parse(
    gunzipSync(
      Buffer.concat([cipher.update(data.subarray(36)), cipher.final()]),
      { maxOutputLength: 60 * 1024 * 1024 }
    ).toString()
  );
}
export async function backupConsent(id: number) {
  const connection = await pool().getConnection();
  try {
    const [lock] = await rows(
      "SELECT GET_LOCK(?,0) AS ok",
      [`tatuei-consent-backup:${id}`],
      connection
    );
    if (Number(lock?.ok) !== 1) return;
    try {
      const [record] = await rows(
        "SELECT * FROM minor_consent_requests WHERE id=? AND submitted_at IS NOT NULL",
        [id],
        connection
      );
      if (!record || record.backup_revision >= record.revision) return;
      const files = await rows(
        "SELECT * FROM minor_consent_files WHERE request_id=? ORDER BY id",
        [id],
        connection
      );
      const events = await rows(
        "SELECT * FROM minor_consent_events WHERE request_id=? ORDER BY id",
        [id],
        connection
      );
      const notices = await rows(
        "SELECT * FROM minor_consent_notices WHERE request_id=?",
        [id],
        connection
      );
      const attachments = [];
      for (const f of files) {
        const bytes = await storageReadBuffer(f.storage_key, 6 * 1024 * 1024);
        if (sha(bytes) !== f.sha256)
          throw new Error("Integridade do anexo divergente");
        attachments.push({ ...f, data: bytes.toString("base64") });
      }
      const snapshot = {
        format: "tatuei-consent-v1",
        revision: record.revision,
        record,
        events,
        notices,
        attachments,
      };
      const data = sealConsentBackup(snapshot);
      const backupKey = `_backups/minor-consents/${record.studio_id}/${id}/revision-${record.revision}-${sha(data).slice(0, 16)}.enc`;
      const saved = await storagePut(
        backupKey,
        data,
        "application/octet-stream"
      );
      if (!saved.url) throw new Error("Armazenamento não disponível");
      const roundtrip = await storageReadBuffer(backupKey, 55 * 1024 * 1024);
      if (
        !roundtrip.equals(data) ||
        openConsentBackup(roundtrip).record.submission_hash !==
          record.submission_hash
      )
        throw new Error("Verificação do backup falhou");
      await connection.query(
        "UPDATE minor_consent_requests SET backup_key=?,backup_revision=?,backup_error=NULL WHERE id=? AND revision=?",
        [backupKey, record.revision, id, record.revision]
      );
      await audit(
        id,
        record.studio_id,
        null,
        "backup_verified",
        { revision: record.revision, sha256: sha(data) },
        connection
      );
    } finally {
      await connection.query("SELECT RELEASE_LOCK(?)", [
        `tatuei-consent-backup:${id}`,
      ]);
    }
  } catch {
    await pool().query(
      "UPDATE minor_consent_requests SET backup_error=? WHERE id=?",
      [
        "Backup pendente de nova tentativa; os originais permanecem armazenados.",
        id,
      ]
    );
  } finally {
    connection.release();
  }
}
