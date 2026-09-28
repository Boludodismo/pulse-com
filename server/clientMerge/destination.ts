import mysql from "mysql2/promise";
import { rows } from "./service";
export async function findMergeDestination(
  clientId: number,
  studioId: number
): Promise<number | null> {
  const c = await mysql.createConnection(process.env.DATABASE_URL!);
  try {
    if (
      !(
        await rows(
          c,
          "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='client_merge_audits'"
        )
      ).length
    )
      return null;
    let current = clientId;
    const seen = new Set<number>();
    while (!seen.has(current)) {
      seen.add(current);
      const next = await rows(
        c,
        "SELECT target_id FROM client_merge_audits WHERE source_id=? AND studio_id=?",
        [current, studioId]
      );
      if (!next.length) return current === clientId ? null : current;
      current = Number(next[0].target_id);
    }
    return null;
  } finally {
    await c.end();
  }
}
