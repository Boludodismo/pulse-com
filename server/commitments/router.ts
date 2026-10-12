import { getActiveIntegration } from "../messaging/service";
import { commitmentIcs } from "./export";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, tenantProcedure } from "../_core/trpc";
import {
  database,
  ensureCommitmentsSchema,
  seriesSelect,
  occurrenceSelect,
} from "./db";
import { materialize, localClock } from "./service";
import {
  canReadCommitment,
  addDays,
  nationalHolidays,
} from "../../shared/commitments";
import { normalizeBrazilianPhone } from "../messaging/phone";
const date = z
  .string()
  .regex(/^20\d{2}-\d{2}-\d{2}$/)
  .refine(v => {
    const d = new Date(v + "T12:00:00Z");
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
  }, "Data inválida");
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const procedure = tenantProcedure.use(async ({ ctx, next }) => {
  if (ctx.user.role === "superadmin")
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Compromissos não estão disponíveis no painel global.",
    });
  await ensureCommitmentsSchema();
  return next({ ctx });
});
const scope = (ctx: any) => ({
  studioId: ctx.studioId,
  userId: ctx.user.id,
  role: ctx.user.role,
});
async function accessible(ctx: any, id: number) {
  const [rows]: any = await database().query(
    `SELECT ${occurrenceSelect} FROM commitment_occurrences o JOIN commitment_series s ON s.id=o.series_id AND s.studio_id=o.studio_id WHERE o.id=? AND o.studio_id=?`,
    [id, ctx.studioId]
  );
  if (!rows[0] || !canReadCommitment(rows[0], scope(ctx)))
    throw new TRPCError({ code: "NOT_FOUND" });
  return rows[0];
}
export const commitmentsRouter = router({
  preferences: procedure.query(async ({ ctx }) => {
    const [rows]: any = await database().query(
      "SELECT phone,consent,timezone,before_time AS beforeTime,first_time AS firstTime,second_time AS secondTime,holidays_json AS holidaysJson FROM commitment_preferences WHERE studio_id=? AND user_id=?",
      [ctx.studioId, ctx.user.id]
    );
    const integration = await getActiveIntegration(ctx.studioId);
    const whatsappReady = !!integration && !integration.sandboxMode;
    return rows[0]
      ? {
          ...rows[0],
          whatsappReady,
          holidays: JSON.parse(rows[0].holidaysJson),
        }
      : {
          whatsappReady,
          phone: "",
          consent: 0,
          timezone: "America/Sao_Paulo",
          beforeTime: "09:00",
          firstTime: "09:00",
          secondTime: "16:00",
          holidays: [],
        };
  }),
  savePreferences: procedure
    .input(
      z
        .object({
          phone: z.string().max(24),
          consent: z.boolean(),
          timezone: z
            .string()
            .max(64)
            .refine(v => {
              try {
                new Intl.DateTimeFormat("pt-BR", { timeZone: v });
                return true;
              } catch {
                return false;
              }
            }),
          beforeTime: time,
          firstTime: time,
          secondTime: time,
          holidays: z
            .array(
              z.object({
                date,
                name: z.string().min(1).max(100),
                annual: z.boolean(),
              })
            )
            .max(100),
        })
        .refine(
          v => v.firstTime < v.secondTime,
          "O segundo aviso deve ser posterior ao primeiro."
        )
    )
    .mutation(async ({ ctx, input }) => {
      let phone = "";
      try {
        if (input.phone.trim()) phone = normalizeBrazilianPhone(input.phone);
      } catch {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Informe um WhatsApp brasileiro válido com DDD.",
        });
      }
      if (input.consent && !phone)
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Informe um WhatsApp para ativar os avisos.",
        });
      await database().query(
        `INSERT INTO commitment_preferences(studio_id,user_id,phone,consent,timezone,before_time,first_time,second_time,holidays_json) VALUES(?,?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE phone=VALUES(phone),consent=VALUES(consent),timezone=VALUES(timezone),before_time=VALUES(before_time),first_time=VALUES(first_time),second_time=VALUES(second_time),holidays_json=VALUES(holidays_json)`,
        [
          ctx.studioId,
          ctx.user.id,
          phone,
          input.consent ? 1 : 0,
          input.timezone,
          input.beforeTime,
          input.firstTime,
          input.secondTime,
          JSON.stringify(input.holidays),
        ]
      );
      return { success: true };
    }),
  assignees: procedure.query(async ({ ctx }) => {
    const [rows]: any = await database().query(
      "SELECT id,name FROM users WHERE studioId=? AND isActive=1 AND accessStatus='active' AND role<>'superadmin' AND (?='admin' OR id=?)",
      [ctx.studioId, ctx.user.role, ctx.user.id]
    );
    return rows as { id: number; name: string }[];
  }),
  nationalHolidays: procedure
    .input(z.object({ year: z.number().int().min(2000).max(2099) }))
    .query(({ input }) => nationalHolidays(input.year)),
  create: procedure
    .input(
      z
        .object({
          title: z.string().trim().min(1).max(200),
          category: z.enum(["fixed", "variable", "payroll", "reminder"]),
          calendarName: z.string().trim().min(1).max(100),
          color: z.string().regex(/^#[0-9a-f]{6}$/i),
          amount: z.number().int().nonnegative().max(2147483647).nullable(),
          startDate: date,
          endDate: date.nullable(),
          repeatKind: z.enum(["none", "daily", "weekly", "monthly", "yearly"]),
          repeatInterval: z.number().int().min(1).max(100),
          shiftBusiness: z.boolean(),
          notes: z.string().max(4000),
          assigneeId: z.number().int().positive(),
        })
        .refine(
          v => !v.endDate || v.endDate >= v.startDate,
          "Término anterior ao início."
        )
    )
    .mutation(async ({ ctx, input }) => {
      if (input.assigneeId !== ctx.user.id && ctx.user.role !== "admin")
        throw new TRPCError({ code: "FORBIDDEN" });
      const [users]: any = await database().query(
        "SELECT id FROM users WHERE id=? AND studioId=? AND isActive=1 AND role<>'superadmin'",
        [input.assigneeId, ctx.studioId]
      );
      if (!users[0])
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Responsável inválido.",
        });
      const [r]: any = await database().query(
        "INSERT INTO commitment_series(studio_id,owner_id,assignee_id,title,category,calendar_name,color,amount,start_date,end_date,repeat_kind,repeat_interval,shift_business,notes) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
        [
          ctx.studioId,
          ctx.user.id,
          input.assigneeId,
          input.title,
          input.category,
          input.calendarName,
          input.color,
          input.amount,
          input.startDate,
          input.endDate,
          input.repeatKind,
          input.repeatInterval,
          input.shiftBusiness ? 1 : 0,
          input.notes,
        ]
      );
      return { id: Number(r.insertId) };
    }),
  list: procedure
    .input(
      z
        .object({ from: date, to: date })
        .refine(
          v =>
            v.to >= v.from &&
            Date.parse(v.to) - Date.parse(v.from) <= 366 * 86400000,
          "Consulte até um ano."
        )
    )
    .query(async ({ ctx, input }) => {
      await materialize(ctx.studioId, ctx.user.id, input.from, input.to);
      const [rows]: any = await database().query(
        `SELECT ${occurrenceSelect} FROM commitment_occurrences o JOIN commitment_series s ON s.id=o.series_id AND s.studio_id=o.studio_id WHERE o.studio_id=? AND (s.owner_id=? OR s.assignee_id=?) AND s.active=1 AND o.effective_date BETWEEN ? AND ? ORDER BY o.effective_date,o.id LIMIT 2000`,
        [ctx.studioId, ctx.user.id, ctx.user.id, input.from, input.to]
      );
      return rows as any[];
    }),
  detail: procedure
    .input(z.object({ id: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const o = await accessible(ctx, input.id);
      const [attachments]: any = await database().query(
        "SELECT id,name,mime FROM commitment_attachments WHERE series_id=? AND studio_id=?",
        [o.seriesId, ctx.studioId]
      );
      const [deliveries]: any = await database().query(
        "SELECT slot,state,error_text AS error,created_at AS createdAt FROM commitment_deliveries WHERE occurrence_id=? ORDER BY id DESC LIMIT 20",
        [o.id]
      );
      return { ...o, attachments, deliveries };
    }),
  action: procedure
    .input(
      z.object({
        id: z.number().int().positive(),
        revision: z.number().int(),
        action: z.enum(["paid", "snooze", "reschedule"]),
        date: date.optional(),
        time: time.optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = database(),
        c = await db.getConnection();
      try {
        await c.beginTransaction();
        const [rows]: any = await c.query(
          `SELECT ${occurrenceSelect} FROM commitment_occurrences o JOIN commitment_series s ON s.id=o.series_id AND s.studio_id=o.studio_id WHERE o.id=? AND o.studio_id=? AND s.active=1 FOR UPDATE`,
          [input.id, ctx.studioId]
        );
        const o = rows[0];
        if (!o || !canReadCommitment(o, scope(ctx)))
          throw new TRPCError({ code: "NOT_FOUND" });
        if (o.status !== "pending" || o.revision !== input.revision)
          throw new TRPCError({
            code: "CONFLICT",
            message: "Este compromisso mudou. Atualize antes de continuar.",
          });
        let effective = o.effectiveDate,
          snooze = null;
        if (input.action !== "paid") {
          if (!input.date || !input.time)
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "Informe dia e horário.",
            });
          const [prefs]: any = await c.query(
            "SELECT timezone FROM commitment_preferences WHERE studio_id=? AND user_id=?",
            [ctx.studioId, o.assigneeId]
          );
          const target = `${input.date} ${input.time}:00`;
          if (target <= localClock(prefs[0]?.timezone || "America/Sao_Paulo"))
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "Escolha uma data futura.",
            });
          if (input.action === "reschedule") effective = input.date;
          snooze = target;
        }
        await c.query(
          "UPDATE commitment_occurrences SET status=?,effective_date=?,snooze_until=?,revision=revision+1 WHERE id=? AND studio_id=?",
          [
            input.action === "paid" ? "paid" : "pending",
            effective,
            snooze,
            input.id,
            ctx.studioId,
          ]
        );
        await c.query(
          "INSERT INTO commitment_actions(occurrence_id,studio_id,user_id,action,details) VALUES(?,?,?,?,?)",
          [
            o.id,
            ctx.studioId,
            ctx.user.id,
            input.action,
            JSON.stringify({ date: input.date, time: input.time }),
          ]
        );
        await c.commit();
        return { success: true };
      } catch (e) {
        await c.rollback();
        throw e;
      } finally {
        c.release();
      }
    }),
  stop: procedure
    .input(z.object({ seriesId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const [r]: any = await database().query(
        "UPDATE commitment_series SET active=0 WHERE id=? AND studio_id=? AND owner_id=?",
        [input.seriesId, ctx.studioId, ctx.user.id]
      );
      if (!r.affectedRows) throw new TRPCError({ code: "NOT_FOUND" });
      return { success: true };
    }),
  attach: procedure
    .input(
      z.object({
        seriesId: z.number().int().positive(),
        name: z.string().min(1).max(150),
        mime: z.enum(["image/png", "image/jpeg", "application/pdf"]),
        data: z.string().max(2800000),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [s]: any = await database().query(
        "SELECT id FROM commitment_series WHERE id=? AND studio_id=? AND owner_id=?",
        [input.seriesId, ctx.studioId, ctx.user.id]
      );
      if (!s[0]) throw new TRPCError({ code: "NOT_FOUND" });
      const bytes = Buffer.from(input.data, "base64");
      const valid =
        input.mime === "image/png"
          ? bytes
              .subarray(0, 8)
              .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
          : input.mime === "image/jpeg"
            ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
            : bytes.subarray(0, 5).toString() === "%PDF-";
      if (!valid || bytes.length > 2 * 1024 * 1024)
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Arquivo inválido ou maior que 2 MB.",
        });
      const [count]: any = await database().query(
        "SELECT COUNT(*) AS total FROM commitment_attachments WHERE series_id=?",
        [input.seriesId]
      );
      if (count[0].total >= 5)
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Limite de cinco anexos por série.",
        });
      await database().query(
        "INSERT INTO commitment_attachments(series_id,studio_id,name,mime,data) VALUES(?,?,?,?,?)",
        [input.seriesId, ctx.studioId, input.name, input.mime, input.data]
      );
      return { success: true };
    }),
  attachment: procedure
    .input(z.object({ id: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const [rows]: any = await database().query(
        `SELECT a.*,s.owner_id AS ownerId,s.assignee_id AS assigneeId,s.studio_id AS studioId FROM commitment_attachments a JOIN commitment_series s ON s.id=a.series_id AND s.studio_id=a.studio_id WHERE a.id=? AND a.studio_id=?`,
        [input.id, ctx.studioId]
      );
      if (!rows[0] || !canReadCommitment(rows[0], scope(ctx)))
        throw new TRPCError({ code: "NOT_FOUND" });
      return { name: rows[0].name, mime: rows[0].mime, data: rows[0].data };
    }),
  export: procedure
    .input(
      z
        .object({ from: date, to: date })
        .refine(
          v =>
            v.to >= v.from &&
            Date.parse(v.to) - Date.parse(v.from) <= 366 * 86400000
        )
    )
    .query(async ({ ctx, input }) => {
      await materialize(ctx.studioId, ctx.user.id, input.from, input.to);
      const [rows]: any = await database().query(
        `SELECT ${occurrenceSelect} FROM commitment_occurrences o JOIN commitment_series s ON s.id=o.series_id AND s.studio_id=o.studio_id WHERE o.studio_id=? AND (s.owner_id=? OR s.assignee_id=?) AND s.active=1 AND o.effective_date BETWEEN ? AND ?`,
        [ctx.studioId, ctx.user.id, ctx.user.id, input.from, input.to]
      );
      return { ics: commitmentIcs(rows, ctx.studioId), count: rows.length };
    }),
});
