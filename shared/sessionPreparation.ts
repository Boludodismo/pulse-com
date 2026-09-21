import { z } from "zod";
import {
  SESSION_CUP_ML,
  isSessionCup,
  isSessionInk,
} from "./sessionInkQuantity";

export const preparationQuantity = z
  .string()
  .regex(/^\d{1,9}(?:\.\d{1,3})?$/)
  .refine(v => Number(v) > 0, "Informe uma quantidade maior que zero.");
export const preparationMaterial = z.object({
  tenantMaterialId: z.number().int().positive(),
  name: z.string().max(255),
  unit: z.string().max(40),
  quantity: preparationQuantity,
});
export const preparationColor = z
  .object({
    name: z.string().trim().min(1).max(80),
    hex: z.string().regex(/^#[0-9a-f]{6}$/i),
    cupSize: z.enum(["P", "M", "G", "GG"]),
    dropsPerMl: z.number().min(5).max(60),
    ingredients: z
      .array(
        z.object({
          tenantMaterialId: z.number().int().positive(),
          name: z.string().max(255),
          drops: z.number().int().min(1).max(500),
        })
      )
      .max(10),
  })
  .refine(
    c =>
      c.ingredients.reduce((n, i) => n + i.drops, 0) / c.dropsPerMl <=
      SESSION_CUP_ML[c.cupSize],
    "A mistura ultrapassa a capacidade do batoque."
  )
  .refine(
    c =>
      new Set(c.ingredients.map(i => i.tenantMaterialId)).size ===
      c.ingredients.length,
    "Há tintas repetidas na mistura."
  );
export const preparationSchema = z
  .object({
    version: z.literal(1),
    materials: z.array(preparationMaterial).max(40),
    colors: z.array(preparationColor).max(20),
  })
  .refine(
    p =>
      new Set(p.materials.map(i => i.tenantMaterialId)).size ===
      p.materials.length,
    "Há materiais repetidos no planejamento."
  );
export type SessionPreparation = z.infer<typeof preparationSchema>;
export type PreparationColor = z.infer<typeof preparationColor>;
export const emptyPreparation = (): SessionPreparation => ({
  version: 1,
  materials: [],
  colors: [],
});
export function readPreparation(
  payload?: string | null
): SessionPreparation | null {
  try {
    const r = preparationSchema.safeParse(JSON.parse(payload || "null"));
    return r.success ? r.data : null;
  } catch {
    return null;
  }
}
export function validatePreparationMaterial(
  item: { quantity: string; unit: string },
  material: { name: string; unit: string; category?: string | null }
) {
  if (item.unit !== material.unit)
    throw new Error(
      `A unidade de ${material.name} mudou. Selecione o material novamente.`
    );
  if (
    (isSessionCup(material) ||
      /^(un|unidade|unit|unidades)$/.test(material.unit)) &&
    !Number.isInteger(Number(item.quantity))
  )
    throw new Error(`${material.name} deve ser contado em unidades inteiras.`);
}
export function validateRecipeMaterial(material: {
  name: string;
  unit: string;
  category?: string | null;
}) {
  if (
    !isSessionInk(material) ||
    !/^(ml|gota|gotas|drop|drops|gt)$/.test(material.unit.toLowerCase())
  )
    throw new Error(
      `Configure ${material.name} como tinta ou diluente em ml ou gotas.`
    );
}
export function preparationRgb(hex: string) {
  const [red, green, blue] = [1, 3, 5].map(i =>
    parseInt(hex.slice(i, i + 2), 16)
  );
  const k = 1 - Math.max(red, green, blue) / 255;
  const component = (v: number) =>
    k === 1 ? 0 : Math.round(((1 - v / 255 - k) / (1 - k)) * 100);
  return {
    red,
    green,
    blue,
    cyan: component(red),
    magenta: component(green),
    yellow: component(blue),
    black: Math.round(k * 100),
  };
}
