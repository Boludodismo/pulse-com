import { createDAVClient } from "tsdav";
import { createHash } from "node:crypto";
import {
  encryptIntegrationSecret,
  decryptIntegrationSecret,
} from "../messaging/crypto";
import { database } from "../commitments/db";
import { localClock } from "../commitments/service";
import { readIcs, writeIcs, wallToUtc, type SyncEvent } from "./core";
export function appleUrl(url: string) {
  const parsed = new URL(url);
  if (
    parsed.protocol !== "https:" ||
    !parsed.hostname.endsWith(".icloud.com") ||
    parsed.username ||
    parsed.password
  )
    throw new Error("Destino Apple inválido.");
  return url;
}
const boundedFetch: typeof fetch = (input, init) =>
  fetch(input, { ...init, signal: AbortSignal.timeout(20000) });
const appleFetch: typeof fetch = async (input, init) => {
  let url = appleUrl(
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.href
        : input.url
  );
  for (let i = 0; i < 5; i++) {
    const response = await boundedFetch(url, { ...init, redirect: "manual" });
    if (![301, 302, 307, 308].includes(response.status)) return response;
    url = appleUrl(new URL(response.headers.get("location") || "", url).href);
  }
  throw new Error("Redirecionamento Apple inválido.");
};
export async function appleClient(credentials: string) {
  const secret = JSON.parse(decryptIntegrationSecret(credentials));
  return createDAVClient({
    serverUrl: "https://caldav.icloud.com",
    credentials: { username: secret.username, password: secret.password },
    authMethod: "Basic",
    defaultAccountType: "caldav",
    fetch: appleFetch,
  });
}
export async function googleFetch(
  connection: any,
  path: string,
  init: RequestInit = {}
) {
  const secret = JSON.parse(decryptIntegrationSecret(connection.credentials));
  if (!secret.expires || secret.expires < Date.now() + 60000) {
    const r = await boundedFetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: secret.refreshToken,
        client_id: process.env.GOOGLE_CALENDAR_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CALENDAR_CLIENT_SECRET!,
      }),
    });
    if (!r.ok) throw new Error("Autorização Google expirada.");
    const tokens = await r.json();
    secret.accessToken = tokens.access_token;
    secret.expires = Date.now() + tokens.expires_in * 1000;
    connection.credentials = encryptIntegrationSecret(JSON.stringify(secret));
    await database().query(
      "UPDATE calendar_sync_connections SET credentials=? WHERE id=? AND studio_id=? AND user_id=?",
      [
        connection.credentials,
        connection.id,
        connection.studio_id,
        connection.user_id,
      ]
    );
  }
  return boundedFetch("https://www.googleapis.com/calendar/v3/" + path, {
    ...init,
    headers: {
      Authorization: `Bearer ${secret.accessToken}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
  });
}
function googleEvent(event: any, timezone: string): SyncEvent {
  if (
    event.status === "cancelled" ||
    event.recurrence ||
    event.recurringEventId
  )
    throw new Error("Evento removido ou recorrente externo requer revisão.");
  const allDay = !!event.start?.date;
  const date = allDay
    ? event.start.date
    : localClock(timezone, new Date(event.start.dateTime));
  if (!allDay && !date.endsWith(":00"))
    throw new Error("Precisão externa em segundos não suportada.");
  const duration = allDay
    ? (Date.parse(event.end.date) - Date.parse(event.start.date)) / 86400000
    : (Date.parse(event.end.dateTime) - Date.parse(event.start.dateTime)) /
      60000;
  if (
    duration < 1 ||
    duration > (allDay ? 1 : 1440) ||
    !Number.isInteger(duration)
  )
    throw new Error("Horário externo não suportado.");
  return {
    date,
    duration,
    allDay,
    title: event.summary || "",
    uid: event.iCalUID,
    remoteId: event.id,
    etag: event.etag,
    raw: event,
  };
}
export async function provider(connection: any) {
  if (connection.provider === "google") {
    const path = `calendars/${encodeURIComponent(connection.remote_calendar)}/events`;
    return {
      read: async (local: SyncEvent, remoteId?: string) => {
        if (!remoteId) {
          const deterministic =
            "t" + createHash("sha256").update(local.uid).digest("hex");
          const found = await googleFetch(
            connection,
            path + "/" + deterministic
          );
          if (found.ok)
            return googleEvent(await found.json(), connection.timezone);
          if (found.status !== 404 && found.status !== 410)
            throw new Error("Falha Google.");
        }
        if (remoteId) {
          const r = await googleFetch(
            connection,
            path + "/" + encodeURIComponent(remoteId)
          );
          if (r.status === 404 || r.status === 410) return null;
          if (!r.ok) throw new Error("Falha Google.");
          return googleEvent(await r.json(), connection.timezone);
        }
        for (const uid of [local.uid, local.legacyUid].filter(Boolean)) {
          const r = await googleFetch(
            connection,
            path + "?iCalUID=" + encodeURIComponent(uid!) + "&showDeleted=false"
          );
          if (!r.ok) throw new Error("Falha Google.");
          const data = await r.json();
          if (data.items?.length > 1)
            throw new Error(
              "Mais de um evento externo com o mesmo identificador."
            );
          if (data.items?.[0]) {
            if (uid !== local.uid)
              throw new Error("Série importada anteriormente requer revisão.");
            return googleEvent(data.items[0], connection.timezone);
          }
        }
        return null;
      },
      write: async (
        local: SyncEvent,
        remote: SyncEvent | null,
        remoteId?: string
      ) => {
        const start = local.allDay
          ? { date: local.date }
          : {
              dateTime: wallToUtc(
                local.date,
                connection.timezone
              ).toISOString(),
              timeZone: connection.timezone,
            };
        const end = local.allDay
          ? {
              date: new Date(
                Date.parse(local.date + "T12:00:00Z") +
                  local.duration * 86400000
              )
                .toISOString()
                .slice(0, 10),
            }
          : {
              dateTime: new Date(
                wallToUtc(local.date, connection.timezone).getTime() +
                  local.duration * 60000
              ).toISOString(),
              timeZone: connection.timezone,
            };
        const id =
          remote?.remoteId ||
          "t" +
            createHash("sha256")
              .update(local.uid + (remoteId ? Date.now() : ""))
              .digest("hex");
        const r = await googleFetch(
          connection,
          path + (remote ? "/" + encodeURIComponent(id) : ""),
          {
            method: remote ? "PATCH" : "POST",
            headers: remote?.etag ? { "If-Match": remote.etag } : {},
            body: JSON.stringify(
              remote
                ? { start, end }
                : {
                    id,
                    summary: local.title,
                    start,
                    end,
                    extendedProperties: { private: { tatueiUID: local.uid } },
                  }
            ),
          }
        );
        if (r.status === 412 || r.status === 409)
          throw new Error("Evento externo mudou durante a atualização.");
        if (!r.ok) throw new Error("Falha Google.");
        const written = await r.json();
        return googleEvent(written, connection.timezone);
      },
    };
  }
  const client = await appleClient(connection.credentials);
  const calendar = { url: appleUrl(connection.remote_calendar) } as any;
  return {
    read: async (local: SyncEvent, remoteId?: string) => {
      const objects = await client.fetchCalendarObjects({
        calendar,
        ...(remoteId
          ? { objectUrls: [appleUrl(remoteId)] }
          : {
              timeRange: {
                start: new Date(
                  Date.parse(local.date.slice(0, 10) + "T12:00:00Z") -
                    367 * 86400000
                ).toISOString(),
                end: new Date(
                  Date.parse(local.date.slice(0, 10) + "T12:00:00Z") +
                    367 * 86400000
                ).toISOString(),
              },
            }),
      });
      const matching = remoteId
        ? objects
        : objects.filter(o => {
            try {
              const raw = String(o.data || "");
              return (
                raw.includes("UID:" + local.uid) ||
                (!!local.legacyUid && raw.includes("UID:" + local.legacyUid))
              );
            } catch {
              return false;
            }
          });
      if (matching.length > 1)
        throw new Error("Mais de um evento externo com o mesmo identificador.");
      if (!matching[0]) return null;
      const raw = String(matching[0].data);
      const event = readIcs(raw, connection.timezone);
      if (event.uid !== local.uid)
        throw new Error("Série importada anteriormente requer revisão.");
      return {
        ...event,
        raw,
        remoteId: appleUrl(matching[0].url),
        etag: matching[0].etag,
      };
    },
    write: async (
      local: SyncEvent,
      remote: SyncEvent | null,
      remoteId?: string
    ) => {
      const data = writeIcs(local, connection.timezone, remote?.raw);
      const filename =
        createHash("sha256").update(local.uid).digest("hex") + ".ics";
      const r = remote
        ? await client.updateCalendarObject({
            calendarObject: {
              url: appleUrl(remote.remoteId!),
              etag: remote.etag,
              data,
            },
            headers: remote.etag ? { "If-Match": remote.etag } : {},
          })
        : await client.createCalendarObject({
            calendar,
            iCalString: data,
            filename,
            headers: { "If-None-Match": "*" },
          });
      if (!r.ok)
        throw new Error("Evento externo mudou ou a atualização foi recusada.");
      const url =
        remote?.remoteId ||
        new URL(
          filename,
          connection.remote_calendar.endsWith("/")
            ? connection.remote_calendar
            : connection.remote_calendar + "/"
        ).href;
      return {
        ...local,
        remoteId: url,
        etag: r.headers.get("etag") || undefined,
        raw: data,
      };
    },
  };
}
