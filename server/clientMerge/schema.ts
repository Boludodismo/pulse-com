import type { Connection } from "mysql2/promise";
export async function ensureClientMergeSchema(c: Connection) {
  // Additive schema only; never run DDL inside the merge transaction.
  await c.query(`CREATE TABLE IF NOT EXISTS client_merge_audits (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    studio_id INT NOT NULL, actor_id INT NOT NULL, target_id INT NOT NULL, source_id INT NOT NULL,
    preview_hash CHAR(64) NOT NULL, before_json LONGTEXT NOT NULL, result_json LONGTEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY merged_source (source_id), UNIQUE KEY studio_preview (studio_id,preview_hash),
    KEY studio_target (studio_id,target_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  await c.query(`CREATE TABLE IF NOT EXISTS client_merge_batches (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY, studio_id INT NOT NULL, actor_id INT NOT NULL,
    preview_hash CHAR(64) NOT NULL, plan_json LONGTEXT NOT NULL, result_json LONGTEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY studio_preview(studio_id,preview_hash)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
}
