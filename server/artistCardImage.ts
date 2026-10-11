import sharp from "sharp";
import { TRPCError } from "@trpc/server";
import { randomUUID } from "node:crypto";
import { storagePut, storageReadBuffer } from "./storage";
import { pixelCrop, type CardImageEdit } from "../shared/artistCardImage";

export async function renderCardImage(buffer: Buffer, edit: CardImageEdit) {
  try {
    const oriented = await sharp(buffer, {
      limitInputPixels: 40_000_000,
      failOn: "error",
    })
      .autoOrient()
      .timeout({ seconds: 10 })
      .toBuffer({ resolveWithObject: true });
    let image = sharp(oriented.data, { limitInputPixels: 40_000_000 })
      .extract(pixelCrop(edit.crop, oriented.info.width, oriented.info.height))
      .resize({
        width: 2048,
        height: 2048,
        fit: "inside",
        withoutEnlargement: true,
      });
    if (edit.appearance === "bw") image = image.grayscale();
    return await image
      .jpeg({ quality: 90 })
      .timeout({ seconds: 10 })
      .toBuffer();
  } catch {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message:
        "Não foi possível processar a foto. Envie uma imagem válida de até 40 megapixels.",
    });
  }
}
export async function saveCardImageEdit(
  prefix: string,
  original: { key: string; url: string },
  edit: CardImageEdit | null,
  buffer?: Buffer
) {
  if (!original.key.startsWith(prefix) || original.key.includes(".."))
    throw new TRPCError({ code: "FORBIDDEN" });
  if (!edit)
    return {
      ...original,
      appearance: "color" as const,
      edit: undefined,
      original,
    };
  const output = await renderCardImage(
    buffer ?? (await storageReadBuffer(original.key, 5 * 1024 * 1024)),
    edit
  );
  const key = `${prefix}edited/${randomUUID()}.jpg`;
  const saved = await storagePut(key, output, "image/jpeg");
  if (!saved.url)
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message:
        "O armazenamento está indisponível. A foto anterior foi preservada.",
    });
  return { key, url: saved.url, appearance: edit.appearance, edit, original };
}
