import { z } from "zod";

export const commitmentAttachment = z
  .object({
    name: z.string().min(1).max(150),
    mime: z.enum(["image/png", "image/jpeg", "application/pdf"]),
    data: z.string().max(2800000),
  })
  .superRefine((file, ctx) => {
    const bytes = Buffer.from(file.data, "base64");
    const valid =
      file.mime === "image/png"
        ? bytes
            .subarray(0, 8)
            .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
        : file.mime === "image/jpeg"
          ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
          : bytes.subarray(0, 5).toString() === "%PDF-";
    if (!valid || bytes.length > 2 * 1024 * 1024)
      ctx.addIssue({
        code: "custom",
        message: "Arquivo inválido ou maior que 2 MB.",
      });
  });

export const commitmentAttachments = z
  .array(commitmentAttachment)
  .max(5, "Limite de cinco anexos por série.");
