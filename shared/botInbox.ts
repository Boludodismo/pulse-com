import { z } from "zod";

export const pauseMinutesSchema = z.number().int().min(1).max(10080).nullable();
export const assistantSchema = z.object({
  id: z.number().int().positive().optional(),
  version: z.number().int().nonnegative().default(0),
  name: z.string().trim().min(2).max(100),
  instructions: z.string().trim().max(12000),
  knowledge: z.string().trim().max(30000),
  enabled: z.boolean(),
});
export function sqlTimestamp(value: string | null | undefined) {
  if (!value) return NaN;
  return Date.parse(
    /(?:Z|[+-]\d{2}:\d{2})$/.test(value) ? value : value.replace(" ", "T") + "Z"
  );
}
export function pauseExpired(
  cv: {
    mode?: string;
    pause_until?: string | null;
    closed_at?: string | null;
    opted_out?: number;
  },
  now = Date.now()
) {
  return (
    cv.mode === "human" &&
    !cv.closed_at &&
    !cv.opted_out &&
    sqlTimestamp(cv.pause_until) <= now
  );
}
export function automationBlocked(cv: {
  mode?: string;
  closed_at?: string | null;
  opted_out?: number;
}) {
  return cv.mode !== "bot" || !!cv.closed_at || !!cv.opted_out;
}
export const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;
export const attachmentSchema = z.object({
  name: z.string().trim().min(1).max(180),
  mime: z.enum([
    "image/jpeg",
    "image/png",
    "image/webp",
    "application/pdf",
    "audio/ogg",
    "audio/mpeg",
    "audio/mp4",
    "video/mp4",
  ]),
  base64: z
    .string()
    .min(4)
    .max(Math.ceil(MAX_ATTACHMENT_BYTES / 3) * 4)
    .regex(/^[A-Za-z0-9+/]+={0,2}$/),
});
