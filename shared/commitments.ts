export type Repeat = "none" | "daily" | "weekly" | "monthly" | "yearly";
export type Holiday = { date: string; name: string; annual: boolean };
export const isoDay = (d: Date) => d.toISOString().slice(0, 10);
export const addDays = (date: string, n: number) =>
  isoDay(new Date(Date.parse(date + "T12:00:00Z") + n * 86400000));
export function nationalHolidays(year: number): Holiday[] {
  const fixed: Record<string, string> = {
    "01-01": "Confraternização Universal",
    "04-21": "Tiradentes",
    "05-01": "Dia do Trabalho",
    "09-07": "Independência do Brasil",
    "10-12": "Nossa Senhora Aparecida",
    "11-02": "Finados",
    "11-15": "Proclamação da República",
    "11-20": "Consciência Negra",
    "12-25": "Natal",
  };
  // Gregorian computus; Good Friday follows the federal annual calendar.
  const a = year % 19,
    b = Math.floor(year / 100),
    c = year % 100,
    d = Math.floor(b / 4),
    e = b % 4,
    f = Math.floor((b + 8) / 25),
    g = Math.floor((b - f + 1) / 3),
    h = (19 * a + b - d - g + 15) % 30,
    i = Math.floor(c / 4),
    k = c % 4,
    l = (32 + 2 * e + 2 * i - h - k) % 7,
    m = Math.floor((a + 11 * h + 22 * l) / 451),
    month = Math.floor((h + l - 7 * m + 114) / 31),
    day = ((h + l - 7 * m + 114) % 31) + 1;
  const easter = isoDay(new Date(Date.UTC(year, month - 1, day, 12)));
  return [
    ...Object.entries(fixed).map(([date, name]) => ({
      date: `${year}-${date}`,
      name,
      annual: true,
    })),
    { date: addDays(easter, -2), name: "Paixão de Cristo", annual: false },
  ];
}
export function businessDay(date: string, extra: Holiday[] = []) {
  let result = date;
  for (let n = 0; n < 370; n++) {
    const weekend = [0, 6].includes(
      new Date(result + "T12:00:00Z").getUTCDay()
    );
    const holiday = [
      ...nationalHolidays(Number(result.slice(0, 4))),
      ...extra,
    ].some(h =>
      h.annual ? h.date.slice(5) === result.slice(5) : h.date === result
    );
    if (!weekend && !holiday) return result;
    result = addDays(result, 1);
  }
  throw new Error("Calendário sem dia útil disponível.");
}
export function recurrenceDate(
  start: string,
  repeat: Repeat,
  index: number,
  interval = 1
) {
  if (index === 0) return start;
  if (repeat === "none") return null;
  if (repeat === "daily" || repeat === "weekly")
    return addDays(start, index * interval * (repeat === "weekly" ? 7 : 1));
  const [y, m, d] = start.split("-").map(Number);
  const months =
    repeat === "monthly" ? index * interval : index * interval * 12;
  const base = new Date(Date.UTC(y, m - 1 + months, 1, 12));
  const last = new Date(
    Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + 1, 0, 12)
  ).getUTCDate();
  base.setUTCDate(Math.min(d, last));
  return isoDay(base);
}
export function occurrences(
  start: string,
  repeat: Repeat,
  interval: number,
  end: string | null,
  from: string,
  to: string,
  shift: boolean,
  holidays: Holiday[] = []
) {
  const result: { originalDate: string; effectiveDate: string }[] = [];
  for (let index = 0; index < 40000; index++) {
    const date = recurrenceDate(start, repeat, index, interval);
    if (!date || date > to || (end && date > end)) break;
    const effectiveDate = shift ? businessDay(date, holidays) : date;
    if (effectiveDate >= from && effectiveDate <= to)
      result.push({ originalDate: date, effectiveDate });
  }
  return result;
}
export function canReadCommitment(
  row: { studioId: number; ownerId: number; assigneeId: number },
  actor: { studioId: number; userId: number; role: string }
) {
  return (
    actor.role !== "superadmin" &&
    row.studioId === actor.studioId &&
    (row.ownerId === actor.userId || row.assigneeId === actor.userId)
  );
}
