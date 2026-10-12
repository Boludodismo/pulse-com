import { addDays } from "../../shared/commitments";
const escape = (v: string) =>
  v
    .replace(/\\/g, "\\\\")
    .replace(/\r?\n/g, "\\n")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,");
export function foldIcsLine(line: string) {
  let result = "",
    bytes = 0;
  for (const c of line) {
    const size = Buffer.byteLength(c);
    if (bytes + size > 74) {
      result += "\r\n ";
      bytes = 1;
    }
    result += c;
    bytes += size;
  }
  return result;
}
/** RDATE preserves exact financial recurrence, including business-day exceptions.
 * Export is a bounded snapshot, never an infinite rule with guessed future holidays.
 */
export function commitmentIcs(
  rows: any[],
  studioId: number,
  stamp = new Date()
) {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Tatuei//Compromissos//PT",
    "CALSCALE:GREGORIAN",
  ];
  const groups = new Map<number, any[]>();
  for (const row of rows) {
    const group = groups.get(row.seriesId) || [];
    group.push(row);
    groups.set(row.seriesId, group);
  }
  const dtstamp = stamp
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
  for (const [seriesId, group] of groups) {
    group.sort((a, b) => a.originalDate.localeCompare(b.originalDate));
    const first = group[0];
    const uid = `commitment-series-${studioId}-${seriesId}@tatuei.com`;
    lines.push(
      "BEGIN:VEVENT",
      `UID:${uid}`,
      `DTSTAMP:${dtstamp}`,
      `DTSTART;VALUE=DATE:${first.originalDate.replace(/-/g, "")}`,
      `DTEND;VALUE=DATE:${addDays(first.originalDate, 1).replace(/-/g, "")}`,
      `SUMMARY:${escape(first.title)}`
    );
    if (group.length > 1)
      lines.push(
        `RDATE;VALUE=DATE:${group
          .slice(1)
          .map(o => o.originalDate.replace(/-/g, ""))
          .join(",")}`
      );
    lines.push("END:VEVENT");
    for (const o of group)
      lines.push(
        "BEGIN:VEVENT",
        `UID:${uid}`,
        `DTSTAMP:${dtstamp}`,
        `RECURRENCE-ID;VALUE=DATE:${o.originalDate.replace(/-/g, "")}`,
        `DTSTART;VALUE=DATE:${o.effectiveDate.replace(/-/g, "")}`,
        `DTEND;VALUE=DATE:${addDays(o.effectiveDate, 1).replace(/-/g, "")}`,
        `SEQUENCE:${o.revision}`,
        `SUMMARY:${escape((o.status === "paid" ? "✓ " : "") + o.title)}`,
        `DESCRIPTION:${escape(`${o.notes || ""}\nSituação: ${o.status}\nVencimento original: ${o.originalDate}`)}`,
        "END:VEVENT"
      );
  }
  lines.push("END:VCALENDAR");
  return lines.map(foldIcsLine).join("\r\n") + "\r\n";
}
