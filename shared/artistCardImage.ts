import { z } from "zod";

export const cardImageEditSchema = z
  .object({
    crop: z
      .object({
        x: z.number().min(0).max(1),
        y: z.number().min(0).max(1),
        width: z.number().min(0.001).max(1),
        height: z.number().min(0.001).max(1),
      })
      .strict()
      .refine(
        c => c.x + c.width <= 1.000001 && c.y + c.height <= 1.000001,
        "O recorte deve ficar dentro da imagem."
      ),
    appearance: z.enum(["color", "bw"]),
  })
  .strict();
export type CardImageEdit = z.infer<typeof cardImageEditSchema>;
export const originalCardImageEdit: CardImageEdit = {
  crop: { x: 0, y: 0, width: 1, height: 1 },
  appearance: "color",
};

export function pixelCrop(
  crop: CardImageEdit["crop"],
  width: number,
  height: number
) {
  cardImageEditSchema.parse({ crop, appearance: "color" });
  const left = Math.min(width - 1, Math.max(0, Math.round(crop.x * width)));
  const top = Math.min(height - 1, Math.max(0, Math.round(crop.y * height)));
  return {
    left,
    top,
    width: Math.min(width - left, Math.max(1, Math.round(crop.width * width))),
    height: Math.min(
      height - top,
      Math.max(1, Math.round(crop.height * height))
    ),
  };
}
