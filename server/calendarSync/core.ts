import { createHash } from "node:crypto";
import ICAL from "ical.js";
import { localClock } from "../commitments/service";
export type SyncEvent = {
  date: string;
  duration: number;
  allDay: boolean;
  title: string;
  uid: string;
  legacyUid?: string;
  remoteId?: string;
  etag?: string;
  raw?: any;
};
export const eventHash = (e: SyncEvent) =>
  createHash("sha256")
    .update(JSON.stringify([e.date, e.duration, e.allDay]))
    .digest("hex");
export function decideSync(
  baseLocal: string | null,
  baseRemote: string | null,
  local: string,
  remote: string | null
) {
  if (!baseLocal)
    return !remote ? "create" : local === remote ? "link" : "conflict";
  if (!remote) return "conflict";
  const l = local !== baseLocal,
    r = remote !== baseRemote;
  if (l && r) return local === remote ? "link" : "conflict";
  return l ? "push" : r ? "pull" : "none";
}
export function wallToUtc(date: string, timezone: string) {
  const expected = Date.parse(date.replace(" ", "T") + "Z");
  let value = expected;
  for (let i = 0; i < 4; i++) {
    const observed = Date.parse(
      localClock(timezone, new Date(value)).replace(" ", "T") + "Z"
    );
    value += expected - observed;
  }
  if (localClock(timezone, new Date(value)) !== date)
    throw new Error("Horário inexistente no fuso.");
  return new Date(value);
}
export function readIcs(data: string, timezone: string): SyncEvent {
  const root = new ICAL.Component(ICAL.parse(data));
  const items = root.getAllSubcomponents("vevent");
  if (items.length !== 1)
    throw new Error("Evento recorrente externo requer revisão.");
  const component = items[0];
  if (component.hasProperty("rrule") || component.hasProperty("rdate"))
    throw new Error("Evento recorrente externo requer revisão.");
  const event = new ICAL.Event(component);
  if (component.getFirstPropertyValue("status") === "CANCELLED")
    throw new Error("Evento externo removido.");
  const start = event.startDate,
    end = event.endDate;
  if (!start || !end) throw new Error("Evento externo sem horário completo.");
  const tzid = component.getFirstProperty("dtstart")?.getParameter("tzid");
  if (tzid && start.zone.tzid === "floating")
    throw new Error("Fuso externo desconhecido.");
  const date = start.isDate
    ? start.toString()
    : start.zone.tzid === "floating"
      ? start.toString().replace("T", " ")
      : localClock(timezone, start.toJSDate());
  if (!start.isDate && !date.endsWith(":00"))
    throw new Error("Precisão externa em segundos não suportada.");
  const duration = start.isDate
    ? Math.round(
        (end.toJSDate().getTime() - start.toJSDate().getTime()) / 86400000
      )
    : Math.round(
        (end.toJSDate().getTime() - start.toJSDate().getTime()) / 60000
      );
  if (duration < 1 || duration > (start.isDate ? 1 : 1440))
    throw new Error("Duração externa não suportada.");
  return {
    date,
    duration,
    allDay: start.isDate,
    title: event.summary || "",
    uid: event.uid,
    raw: component,
  };
}
export function writeIcs(
  event: SyncEvent,
  timezone: string,
  previous?: string
) {
  const root = previous
    ? new ICAL.Component(ICAL.parse(previous))
    : new ICAL.Component("vcalendar");
  let component = root.getFirstSubcomponent("vevent");
  if (!component) {
    component = new ICAL.Component("vevent");
    root.addSubcomponent(component);
    component.updatePropertyWithValue("uid", event.uid);
    component.updatePropertyWithValue("summary", event.title);
    root.updatePropertyWithValue("version", "2.0");
    root.updatePropertyWithValue("prodid", "-//Tatuei//Sync//PT");
  }
  const start = event.allDay
    ? ICAL.Time.fromDateString(event.date)
    : ICAL.Time.fromJSDate(wallToUtc(event.date, timezone), true);
  const end = start.clone();
  end.addDuration(
    ICAL.Duration.fromSeconds(event.duration * (event.allDay ? 86400 : 60))
  );
  component.getFirstProperty("dtstart")?.removeParameter("tzid");
  component.getFirstProperty("dtend")?.removeParameter("tzid");
  component.updatePropertyWithValue("dtstart", start);
  component.updatePropertyWithValue("dtend", end);
  component.updatePropertyWithValue(
    "dtstamp",
    ICAL.Time.fromJSDate(new Date(), true)
  );
  return root.toString();
}
