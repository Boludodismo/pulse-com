import { exec } from "./database";
import { inboxChanged } from "./events";
/** Out-of-order provider receipts must never downgrade a read/delivered message. */
export async function applyDeliveryStatus(
  studioId: number,
  externalId: string,
  status: "sent" | "delivered" | "read" | "failed"
) {
  const rank =
    status === "read"
      ? 3
      : status === "delivered"
        ? 2
        : status === "sent"
          ? 1
          : 0;
  await exec(
    "INSERT INTO tatuei_bot_receipts(studio_id,external_id,delivery_rank) VALUES(?,?,?) ON DUPLICATE KEY UPDATE delivery_rank=GREATEST(delivery_rank,VALUES(delivery_rank))",
    [studioId, externalId, rank]
  );
  const previous =
    status === "read"
      ? ["sending", "sent", "delivered", "uncertain"]
      : status === "delivered"
        ? ["sending", "sent", "uncertain"]
        : status === "sent"
          ? ["sending", "uncertain"]
          : ["sending", "sent", "uncertain"];
  await exec(
    `UPDATE tatuei_bot_messages SET status=? WHERE studio_id=? AND external_id=? AND role IN ('bot','staff') AND status IN (${previous.map(() => "?").join(",")})`,
    [status, studioId, externalId, ...previous]
  );
  inboxChanged(studioId);
}

export async function reconcileDeliveryStatus(
  studioId: number,
  messageId: number,
  externalId: string
) {
  await exec(
    "UPDATE tatuei_bot_messages m JOIN tatuei_bot_receipts r ON r.studio_id=m.studio_id AND r.external_id=m.external_id SET m.status=CASE WHEN r.delivery_rank=3 THEN 'read' WHEN r.delivery_rank=2 THEN 'delivered' WHEN r.delivery_rank=0 THEN 'failed' ELSE m.status END WHERE m.id=? AND m.studio_id=? AND m.external_id=? AND m.status IN ('sent','delivered')",
    [messageId, studioId, externalId]
  );
}
