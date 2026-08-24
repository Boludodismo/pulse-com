import { z } from "zod";

export const procedureKitItemSchema = z.object({
  materialId: z.number().int().positive(),
  quantity: z.number().positive(),
  unit: z.string().trim().min(1).max(50),
});

export const procedureKitItemsSchema = z.array(procedureKitItemSchema).min(1).max(50);

export const procedureKitFormSchema = z.object({
  name: z.string().trim().min(1).max(255),
  description: z.string().max(2000).optional(),
  category: z.string().trim().min(1).max(100).default("Geral"),
  items: procedureKitItemsSchema,
});

export function normalizeProcedureKitItems(items: Array<z.infer<typeof procedureKitItemSchema>>) {
  return items.map((item) => ({
    materialId: item.materialId,
    quantity: String(item.quantity),
    unit: item.unit.trim(),
  }));
}

export function calculateKitEstimatedCost(items: Array<{ quantity: number; avgPrice: number }>) {
  return items.reduce((total, item) => total + item.quantity * item.avgPrice, 0);
}

export type ProcedureKitItemInput = z.infer<typeof procedureKitItemSchema>;
export type ProcedureKitFormInput = z.infer<typeof procedureKitFormSchema>;

export default procedureKitFormSchema;
