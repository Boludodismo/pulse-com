import {
  database,
  ensureCommitmentsSchema,
  seriesSelect,
  occurrenceSelect,
} from "./db";
import { addDays, occurrences, type Holiday } from "../../shared/commitments";
import {
  getActiveIntegration,
  getProviderForIntegration,
} from "../messaging/service";
import { isOutboundMessagingBlocked } from "../messaging/outboundSafety";
import { firstName } from "../messaging/messagePresentation";
export function localClock(timezone: string, now = new Date()) {
  const p = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const v = (type: string) => p.find(x => x.type === type)!.value;
  return `${v("year")}-${v("month")}-${v("day")} ${v("hour")}:${v("minute")}:${v("second")}`;
}
export async function materialize(
  studioId: number,
  userId: number,
  from: string,
  to: string
) {
  await ensureCommitmentsSchema();
  const db = database();
  const [rows]: any = await db.query(
    `SELECT ${seriesSelect} FROM commitment_series s WHERE studio_id=? AND active=1 AND (owner_id=? OR assignee_id=?)`,
    [studioId, userId, userId]
  );
  for (const s of rows) {
    const [prefs]: any = await db.query(
      "SELECT holidays_json FROM commitment_preferences WHERE studio_id=? AND user_id=?",
      [studioId, s.assigneeId]
    );
    const holidays: Holiday[] = prefs[0]
      ? JSON.parse(prefs[0].holidays_json)
      : [];
    for (const date of occurrences(
      s.startDate,
      s.repeatKind,
      s.repeatInterval,
      s.endDate,
      from,
      to,
      !!s.shiftBusiness,
      holidays
    ))
      await db.query(
        `INSERT INTO commitment_occurrences(series_id,studio_id,original_date,effective_date) VALUES(?,?,?,?) ON DUPLICATE KEY UPDATE revision=IF(status='pending' AND snooze_until IS NULL AND manual_date=0 AND effective_date<>VALUES(effective_date),revision+1,revision),effective_date=IF(status='pending' AND snooze_until IS NULL AND manual_date=0,VALUES(effective_date),effective_date)`,
        [s.id, studioId, date.originalDate, date.effectiveDate]
      );
  }
}
let running = false;
/** Claim before sending; uncertain provider outcomes are never retried automatically. */
export async function runCommitmentCycle() {
  if (running || isOutboundMessagingBlocked() || !process.env.DATABASE_URL)
    return;
  running = true;
  try {
    await ensureCommitmentsSchema();
    const db = database();
    const [users]: any = await db.query(
      `SELECT p.*,u.name FROM commitment_preferences p JOIN users u ON u.id=p.user_id AND u.studioId=p.studio_id WHERE p.consent=1 AND u.isActive=1 AND u.accessStatus='active' AND u.role<>'superadmin' AND (u.accessExpiresAt IS NULL OR u.accessExpiresAt>UTC_TIMESTAMP())`
    );
    for (const user of users) {
      const now = localClock(user.timezone),
        today = now.slice(0, 10);
      await materialize(
        user.studio_id,
        user.user_id,
        addDays(today, -1),
        addDays(today, 90)
      );
      const integration = await getActiveIntegration(user.studio_id);
      if (
        !integration ||
        integration.sandboxMode ||
        !integration.isEnabled ||
        integration.status !== "ativo"
      )
        continue;
      const [rows]: any = await db.query(
        `SELECT ${occurrenceSelect},s.reminder_times AS reminderTimes FROM commitment_occurrences o JOIN commitment_series s ON s.id=o.series_id AND s.studio_id=o.studio_id WHERE o.studio_id=? AND s.assignee_id=? AND s.active=1 AND o.status='pending' AND ((o.snooze_until IS NULL AND o.effective_date BETWEEN ? AND ?) OR o.snooze_until BETWEEN ? AND ?) ORDER BY o.effective_date,o.id LIMIT 200`,
        [
          user.studio_id,
          user.user_id,
          today,
          addDays(today, 1),
          new Date(Date.parse(now.replace(" ", "T") + "Z") - 3600000)
            .toISOString()
            .slice(0, 19)
            .replace("T", " "),
          now,
        ]
      );
      for (const o of rows) {
        const times = o.reminderTimes ? JSON.parse(o.reminderTimes) : {};
        const slots = o.snoozeUntil
          ? [["snooze", o.snoozeUntil]]
          : [
              [
                "before",
                `${addDays(o.effectiveDate, -1)} ${times.beforeTime || user.before_time}:00`,
              ],
              [
                "first",
                `${o.effectiveDate} ${times.firstTime || user.first_time}:00`,
              ],
              [
                "second",
                `${o.effectiveDate} ${times.secondTime || user.second_time}:00`,
              ],
            ];
        for (const [slot, time] of slots) {
          const lag =
            Date.parse(now.replace(" ", "T") + "Z") -
            Date.parse(time.replace(" ", "T") + "Z");
          if (lag < 0 || lag >= 3600000) continue;
          const connection = await db.getConnection();
          let claim = false;
          try {
            await connection.beginTransaction();
            const [check]: any = await connection.query(
              "SELECT o.status,o.revision,s.active FROM commitment_occurrences o JOIN commitment_series s ON s.id=o.series_id WHERE o.id=? AND o.studio_id=? FOR UPDATE",
              [o.id, user.studio_id]
            );
            if (
              check[0]?.status === "pending" &&
              check[0].revision === o.revision &&
              check[0].active
            ) {
              const [result]: any = await connection.query(
                "INSERT IGNORE INTO commitment_deliveries(occurrence_id,revision,slot) VALUES(?,?,?)",
                [o.id, o.revision, slot]
              );
              claim = result.affectedRows === 1;
            }
            await connection.commit();
          } catch (e) {
            await connection.rollback();
            throw e;
          } finally {
            connection.release();
          }
          if (!claim) continue;
          // Check again immediately before outbound IO, after an action may have cancelled this revision.
          const [check]: any = await db.query(
            "SELECT o.status,o.revision FROM commitment_occurrences o JOIN commitment_series s ON s.id=o.series_id AND s.studio_id=o.studio_id JOIN commitment_preferences p ON p.studio_id=s.studio_id AND p.user_id=s.assignee_id JOIN users u ON u.id=p.user_id AND u.studioId=p.studio_id WHERE o.id=? AND o.studio_id=? AND s.active=1 AND p.consent=1 AND p.phone=? AND u.isActive=1 AND u.accessStatus='active' AND u.role<>'superadmin' AND (u.accessExpiresAt IS NULL OR u.accessExpiresAt>UTC_TIMESTAMP())",
            [o.id, user.studio_id, user.phone]
          );
          if (
            check[0]?.status !== "pending" ||
            check[0].revision !== o.revision
          ) {
            await db.query(
              "UPDATE commitment_deliveries SET state='cancelled' WHERE occurrence_id=? AND revision=? AND slot=?",
              [o.id, o.revision, slot]
            );
            continue;
          }
          const base = (
            process.env.APP_BASE_URL || "https://crm.tatuei.com"
          ).replace(/\/$/, "");
          const link = `${base}/commitments?occurrence=${o.id}`;
          const message = `Olá, ${firstName(user.name)}!\n\nLembrete: ${o.title}\nData: ${o.effectiveDate.split("-").reverse().join("/")}\n${o.amount != null ? `Valor: ${(o.amount / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}\n` : ""}\n${o.category === "reminder" ? "Marcar como concluído" : "Marcar como pago"}: ${link}&action=paid\nLembrar mais tarde: ${link}&action=snooze\nReagendar: ${link}&action=reschedule\n\nEntre com sua conta para confirmar a opção.`;
          try {
            const provider = await getProviderForIntegration(integration);
            const result = await provider.sendMessage(user.phone, message);
            if (!result.success)
              throw new Error(result.error || "Provedor não confirmou o envio");
            await db.query(
              "UPDATE commitment_deliveries SET state='sent' WHERE occurrence_id=? AND revision=? AND slot=?",
              [o.id, o.revision, slot]
            );
          } catch {
            await db.query(
              "UPDATE commitment_deliveries SET state='uncertain',error_text='Envio não confirmado; confira a conexão antes de tentar novamente.' WHERE occurrence_id=? AND revision=? AND slot=?",
              [o.id, o.revision, slot]
            );
          }
        }
      }
    }
  } finally {
    running = false;
  }
}
