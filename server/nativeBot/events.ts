import { EventEmitter } from "node:events";
import type { Request, Response } from "express";
import { sdk } from "../_core/sdk";
import { isUserAccessActive } from "../saas";
import { accessBot } from "./access";
import { exec, rows } from "./database";

const events = new EventEmitter();
events.setMaxListeners(1000);
const watchers = new Map<number, { count: number; version: number }>();
const pending = new Set<number>();
export function inboxChanged(studioId: number) {
  events.emit(String(studioId));
  if (pending.has(studioId)) return;
  pending.add(studioId);
  const timer = setTimeout(() => {
    pending.delete(studioId);
    void exec(
      "INSERT INTO tatuei_bot_realtime(studio_id,version) VALUES(?,1) ON DUPLICATE KEY UPDATE version=version+1",
      [studioId]
    ).catch(() => {});
  }, 100);
  timer.unref();
}
// One batched poll per process for all studios with viewers, independent of tab count.
let polling = false;
const poll = setInterval(async () => {
  if (polling || !watchers.size) return;
  polling = true;
  try {
    const ids = [...watchers.keys()];
    const changes = await rows<{ studio_id: number; version: number }>(
      `SELECT studio_id,version FROM tatuei_bot_realtime WHERE studio_id IN (${ids.map(() => "?").join(",")})`,
      ids
    );
    for (const change of changes) {
      const watch = watchers.get(change.studio_id);
      if (watch && watch.version !== change.version) {
        watch.version = change.version;
        events.emit(String(change.studio_id));
      }
    }
  } catch {
    /* Clients retain their periodic reconciliation after a transient DB failure. */
  } finally {
    polling = false;
  }
}, 1000);
poll.unref();
/** Only invalidations travel over SSE; every data read rechecks tenant and artist access. */
export async function botEventStream(req: Request, res: Response) {
  try {
    const user = await sdk.authenticateRequest(req);
    if (!user || !(await isUserAccessActive(user))) return res.sendStatus(401);
    const scope = await accessBot(user);
    res.set({
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-store",
      "X-Accel-Buffering": "no",
      Connection: "keep-alive",
    });
    res.flushHeaders();
    let dirty = true;
    const changed = () => {
      dirty = true;
    };
    const name = String(scope.studioId);
    const watcher = watchers.get(scope.studioId) || { count: 0, version: -1 };
    watcher.count++;
    watchers.set(scope.studioId, watcher);
    events.on(name, changed);
    // Coalesce bursts and periodically reconcile events originating on other replicas.
    let ticks = 0;
    const timer = setInterval(async () => {
      if (res.writableEnded) return;
      if (++ticks % 15 === 0) {
        try {
          if (!(await isUserAccessActive(user))) throw new Error();
          await accessBot(user);
        } catch {
          cleanup();
          res.end();
          return;
        }
        dirty = true;
      }
      if (dirty) {
        res.write("event: changed\ndata: {}\n\n");
        dirty = false;
      } else res.write(": heartbeat\n\n");
    }, 1000);
    let cleaned = false;
    const cleanup = () => {
      if (cleaned) return;
      cleaned = true;
      clearInterval(timer);
      events.off(name, changed);
      const watch = watchers.get(scope.studioId);
      if (watch && --watch.count === 0) watchers.delete(scope.studioId);
    };
    req.on("close", cleanup);
  } catch {
    if (!res.headersSent) res.sendStatus(403);
    else res.end();
  }
}
