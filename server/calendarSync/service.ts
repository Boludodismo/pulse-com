import { isOutboundMessagingBlocked } from "../messaging/outboundSafety";
import { randomUUID } from "node:crypto";
import { database } from "../commitments/db";
import { materialize } from "../commitments/service";
import { ensureCalendarSyncSchema } from "./db";
import { provider } from "./providers";
import { decideSync, eventHash, type SyncEvent } from "./core";
import { moveAppointment } from "../agendaMoves";
import { isUserAccessActive } from "../saas";
export async function localEvents(connection: any) {
  const db = database();
  const [users]: any = await db.query(
    "SELECT * FROM users WHERE id=? AND studioId=?",
    [connection.user_id, connection.studio_id]
  );
  const user = users[0];
  const [owned]: any = await db.query(
    "SELECT id FROM calendars WHERE id=? AND userId=?",
    [connection.calendar_id, connection.user_id]
  );
  if (!owned[0]) throw new Error("Calendário local indisponível.");
  if (!user || user.role === "superadmin" || !(await isUserAccessActive(user)))
    throw new Error("Acesso indisponível.");
  const today = new Date().toISOString().slice(0, 10),
    end = new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10);
  await materialize(connection.studio_id, connection.user_id, today, end);
  const [appointments]: any = await db.query(
    "SELECT a.id,a.date,a.duration,a.service,c.name AS clientName,a.status FROM appointments a JOIN clients c ON c.id=a.clientId AND c.studioId=a.studioId WHERE a.studioId=? AND a.calendarId=? AND (?='admin' OR a.artistId=?) ORDER BY a.id",
    [connection.studio_id, connection.calendar_id, user.role, user.artistId]
  );
  const [commitments]: any = await db.query(
    "SELECT o.id,o.effective_date AS date,o.revision,o.status,s.title,s.id AS seriesId FROM commitment_occurrences o JOIN commitment_series s ON s.id=o.series_id AND s.studio_id=o.studio_id WHERE o.studio_id=? AND s.calendar_id=? AND s.owner_id=? AND s.active=1 ORDER BY o.id",
    [connection.studio_id, connection.calendar_id, connection.user_id]
  );
  return {
    user,
    items: [
      ...appointments.map((a: any) => ({
        kind: "appointment",
        id: a.id,
        status: a.status,
        event: {
          date: a.date,
          duration: a.duration,
          allDay: false,
          title: `${a.clientName} — ${a.service}`,
          uid: `appointment-${a.id}@tatuei.com`,
        } as SyncEvent,
      })),
      ...commitments.map((o: any) => ({
        kind: "commitment",
        id: o.id,
        status: o.status,
        revision: o.revision,
        event: {
          date: o.date,
          duration: 1,
          allDay: true,
          title: (o.status === "paid" ? "✓ " : "") + o.title,
          uid: `commitment-${connection.studio_id}-${o.id}@tatuei.com`,
          legacyUid: `commitment-series-${connection.studio_id}-${o.seriesId}@tatuei.com`,
        } as SyncEvent,
      })),
    ],
  };
}
export async function syncConnection(
  id: number,
  resolution?: { linkId: number; choice: "local" | "remote"; version: string }
) {
  if (isOutboundMessagingBlocked())
    throw new Error("Sincronização bloqueada neste ambiente.");
  await ensureCalendarSyncSchema();
  const db = database();
  const [claims]: any = await db.query(
    "UPDATE calendar_sync_connections SET lease_until=DATE_ADD(UTC_TIMESTAMP(),INTERVAL 20 MINUTE) WHERE id=? AND status IN ('connected','error') AND (lease_until IS NULL OR lease_until<UTC_TIMESTAMP())",
    [id]
  );
  if (!claims.affectedRows) throw new Error("Sincronização em andamento.");
  try {
    const [connections]: any = await db.query(
      "SELECT * FROM calendar_sync_connections WHERE id=?",
      [id]
    );
    const connection = connections[0];
    const { user, items } = await localEvents(connection);
    const adapter = await provider(connection);
    // Persisted cursor bounds provider traffic without forgetting older linked events.
    const [cursorRows]: any = await db.query(
      "SELECT COUNT(*) AS count FROM calendar_sync_links WHERE connection_id=?",
      [id]
    );
    const cursor = connection.scan_cursor || 0;
    let batch = items.slice(cursor, cursor + 30);
    if (resolution) {
      const [r]: any = await db.query(
        "SELECT kind,local_id FROM calendar_sync_links WHERE id=? AND connection_id=?",
        [resolution.linkId, id]
      );
      batch = items.filter(
        o => r[0] && o.kind === r[0].kind && o.id === r[0].local_id
      );
      if (!batch.length)
        throw new Error("Evento não está mais disponível nesta conta.");
    }
    for (const item of batch) {
      await db.query(
        "INSERT IGNORE INTO calendar_sync_links(connection_id,kind,local_id) VALUES(?,?,?)",
        [id, item.kind, item.id]
      );
      const [links]: any = await db.query(
        "SELECT * FROM calendar_sync_links WHERE connection_id=? AND kind=? AND local_id=?",
        [id, item.kind, item.id]
      );
      const link = links[0];
      let remote: SyncEvent | null;
      try {
        remote = await adapter.read(item.event, link.remote_id || undefined);
      } catch {
        await db.query(
          "UPDATE calendar_sync_links SET conflict_json=? WHERE id=?",
          [
            JSON.stringify({
              title: item.event.title,
              reason:
                "Não foi possível ler este evento; confira conexão, duplicidade ou recorrência externa.",
              local: item.event.date,
              version: "unreadable",
            }),
            link.id,
          ]
        );
        continue;
      }
      const lh = eventHash(item.event),
        rh = remote ? eventHash(remote) : null;
      let action = decideSync(link.local_hash, link.remote_hash, lh, rh);
      const version = lh + ":" + (rh || "missing");
      if (resolution) {
        if (version !== resolution.version)
          throw new Error(
            "O evento mudou novamente. Atualize antes de escolher."
          );
        action =
          resolution.choice === "local" ? (remote ? "push" : "create") : "pull";
      }
      if (action === "conflict") {
        await db.query(
          "UPDATE calendar_sync_links SET conflict_json=? WHERE id=?",
          [
            JSON.stringify({
              title: item.event.title,
              reason: remote
                ? "Alterações diferentes no CRM e no calendário externo."
                : "Evento removido no calendário externo.",
              local: item.event.date,
              remote: remote?.date,
              version,
            }),
            link.id,
          ]
        );
        continue;
      }
      if (action === "none") continue;
      if (action === "pull") {
        if (!remote || remote.allDay !== item.event.allDay)
          throw new Error("Tipo de evento externo não compatível.");
        try {
          if (item.kind === "appointment")
            await moveAppointment(
              { user },
              {
                id: item.id,
                expectedDate: item.event.date,
                date: remote.date,
                notify: false,
                requestId: randomUUID(),
                duration: remote.duration,
              }
            );
          else {
            const [r]: any = await db.query(
              "UPDATE commitment_occurrences o JOIN commitment_series s ON s.id=o.series_id AND s.studio_id=o.studio_id SET o.effective_date=?,o.manual_date=1,o.snooze_until=NULL,o.revision=o.revision+1 WHERE o.id=? AND o.studio_id=? AND s.owner_id=? AND s.calendar_id=? AND o.revision=? AND o.status='pending'",
              [
                remote.date,
                item.id,
                connection.studio_id,
                connection.user_id,
                connection.calendar_id,
                item.revision,
              ]
            );
            if (!r.affectedRows)
              throw new Error("Ocorrência atualizada ou encerrada.");
            await db.query(
              "INSERT INTO commitment_actions(occurrence_id,studio_id,user_id,action,details) VALUES(?,?,?,?,?)",
              [
                item.id,
                connection.studio_id,
                connection.user_id,
                "external_move",
                JSON.stringify({ date: remote.date }),
              ]
            );
          }
        } catch {
          await db.query(
            "UPDATE calendar_sync_links SET conflict_json=? WHERE id=?",
            [
              JSON.stringify({
                title: item.event.title,
                reason:
                  "A alteração externa conflita com a agenda ou o evento está encerrado.",
                local: item.event.date,
                remote: remote.date,
                version,
              }),
              link.id,
            ]
          );
          continue;
        }
        item.event = {
          ...item.event,
          date: remote.date,
          duration: remote.duration,
        };
      } else if (action === "push" || action === "create") {
        try {
          remote = await adapter.write(
            item.event,
            remote,
            link.remote_id || undefined
          );
        } catch {
          await db.query(
            "UPDATE calendar_sync_links SET conflict_json=? WHERE id=?",
            [
              JSON.stringify({
                title: item.event.title,
                reason:
                  "Atualização externa não confirmada. Confira o calendário antes de repetir.",
                local: item.event.date,
                remote: remote?.date,
                version,
              }),
              link.id,
            ]
          );
          continue;
        }
      }
      await db.query(
        "UPDATE calendar_sync_links SET remote_id=?,etag=?,local_hash=?,remote_hash=?,conflict_json=NULL WHERE id=?",
        [
          remote?.remoteId || link.remote_id,
          remote?.etag || null,
          eventHash(item.event),
          remote ? eventHash(remote) : null,
          link.id,
        ]
      );
    }
    await db.query(
      "UPDATE calendar_sync_connections SET status='connected',last_sync=UTC_TIMESTAMP(),last_error=NULL,scan_cursor=? WHERE id=?",
      [resolution ? cursor : cursor + 30 >= items.length ? 0 : cursor + 30, id]
    );
  } catch (e) {
    await db.query(
      "UPDATE calendar_sync_connections SET status='error',last_error='Não foi possível sincronizar; confira autorização e conexão.' WHERE id=?",
      [id]
    );
    throw e;
  } finally {
    await db.query(
      "UPDATE calendar_sync_connections SET lease_until=NULL WHERE id=?",
      [id]
    );
  }
}
let running = false;
export async function runCalendarSyncCycle() {
  if (running || isOutboundMessagingBlocked() || !process.env.DATABASE_URL)
    return;
  running = true;
  try {
    await ensureCalendarSyncSchema();
    const [rows]: any = await database().query(
      "SELECT id FROM calendar_sync_connections WHERE status='connected' AND (last_sync IS NULL OR last_sync<DATE_SUB(UTC_TIMESTAMP(),INTERVAL 1 MINUTE)) ORDER BY last_sync LIMIT 10"
    );
    for (const row of rows) {
      try {
        await syncConnection(row.id);
      } catch {
        /* state and sanitized error are persisted */
      }
    }
  } finally {
    running = false;
  }
}
