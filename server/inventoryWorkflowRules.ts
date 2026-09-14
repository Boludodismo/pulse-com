import { TRPCError } from "@trpc/server";
import { appointmentInstant } from "../shared/appointmentTime";
import {
  DEFAULT_STUDIO_TIMEZONE,
  zonedSqlDateTime,
} from "../shared/studioClock";

export const utcNow = () =>
  new Date().toISOString().slice(0, 19).replace("T", " ");
export function isStudioDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)) return false;
  const date = new Date(value.replace(" ", "T") + "Z");
  return (
    Number.isFinite(date.getTime()) &&
    date.toISOString().slice(0, 19).replace("T", " ") === value
  );
}
export const studioNow = (date = new Date()) =>
  zonedSqlDateTime(date, DEFAULT_STUDIO_TIMEZONE);
export function units(value: string): number {
  if (!/^\d{1,9}(?:\.\d{1,3})?$/.test(value))
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Quantidade inválida. Use até três casas decimais.",
    });
  const [whole, fraction = ""] = value.split(".");
  return Number(whole) * 1000 + Number(fraction.padEnd(3, "0"));
}
export function quantity(value: number): string {
  if (!Number.isSafeInteger(value) || value < 0 || value > 999999999999)
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Saldo fora do limite permitido.",
    });
  return `${Math.floor(value / 1000)}.${String(value % 1000).padStart(3, "0")}`;
}
export function stockProjection(
  current: string | number,
  demand: Array<string | number>,
  minimum: string | number
) {
  const plannedDemand = demand.reduce<number>(
    (sum, q) => sum + units(String(q)),
    0
  );
  const projected = units(String(current)) - plannedDemand;
  const min = units(String(minimum));
  const level =
    projected < 0
      ? "shortage"
      : min > 0 && projected <= min
        ? "attention"
        : "available";
  return {
    plannedDemand: plannedDemand / 1000,
    projectedQuantity: projected / 1000,
    critical: level !== "available",
    level,
    shortageQuantity: Math.max(0, -projected) / 1000,
    replenishmentQuantity: Math.max(0, min - projected) / 1000,
  };
}
export function formatInventoryDate(value: string) {
  const date = appointmentInstant(value);
  return `${date.toLocaleDateString("pt-BR", { timeZone: "UTC" })} às ${date.toLocaleTimeString("pt-BR", { timeZone: "UTC", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })}`;
}
export function hoursUntil(value: string, now = new Date()) {
  return (
    (appointmentInstant(value).getTime() -
      appointmentInstant(studioNow(now)).getTime()) /
    3600000
  );
}
const specificationFields = [
  "name",
  "unit",
  "brand",
  "line",
  "model",
  "configuration",
  "diameter",
  "needleCount",
  "gauge",
  "taper",
] as const;
export function specificationOf(value: Record<string, unknown>) {
  return JSON.stringify(
    Object.fromEntries(
      specificationFields.map(key => [
        key,
        String(value[key] ?? "")
          .trim()
          .toLocaleLowerCase("pt-BR"),
      ])
    )
  );
}
