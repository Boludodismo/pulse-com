import { randomUUID } from "node:crypto";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { storagePut } from "./storage";

export const avatarSchema = z.object({
  imageBase64: z.string().min(1).max(7_000_000),
  mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]),
});
export function decodeAvatar(input: z.infer<typeof avatarSchema>) {
  const buffer = Buffer.from(
    input.imageBase64.replace(/^data:image\/(jpeg|png|webp);base64,/, ""),
    "base64"
  );
  const matches =
    input.mimeType === "image/png"
      ? buffer
          .subarray(0, 8)
          .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
      : input.mimeType === "image/jpeg"
        ? buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255
        : buffer.subarray(0, 4).toString() === "RIFF" &&
          buffer.subarray(8, 12).toString() === "WEBP";
  if (!matches || buffer.length > 5 * 1024 * 1024)
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Envie uma foto JPG, PNG ou WebP válida de até 5 MB.",
    });
  return buffer;
}
export async function saveArtistAvatar(
  studioId: number,
  input: z.infer<typeof avatarSchema>
) {
  const buffer = decodeAvatar(input);
  const extension =
    input.mimeType === "image/jpeg" ? "jpg" : input.mimeType.split("/")[1];
  const photoKey = `artists/${studioId}/avatars/${randomUUID()}.${extension}`;
  const { url: photoUrl } = await storagePut(photoKey, buffer, input.mimeType);
  return { photoKey, photoUrl };
}
