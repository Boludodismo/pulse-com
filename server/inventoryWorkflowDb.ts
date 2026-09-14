import { TRPCError } from "@trpc/server";
import { and, eq, inArray } from "drizzle-orm";
import { inventoryLoans } from "../drizzle/inventoryWorkflowSchema";
import { getDb } from "./db";
import { hasModulePermission } from "./saas";
import {
  type InventoryContext,
  type InventoryDatabase,
} from "./inventoryAccess";

export type WorkflowContext = InventoryContext & {
  user: { id: number; role: string };
};
export type WorkflowDb = Pick<
  InventoryDatabase,
  "select" | "insert" | "update" | "delete"
>;
export async function workflowDb() {
  const db = await getDb();
  if (!db)
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Banco de dados indisponível.",
    });
  return db;
}
export async function stockAccess(ctx: WorkflowContext, write = false) {
  if (["admin", "superadmin"].includes(ctx.user.role)) return;
  if (
    !ctx.artistId ||
    !(await hasModulePermission({
      userId: ctx.user.id,
      studioId: ctx.studioId,
      module: "stock",
      write,
    }))
  ) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Você não possui permissão para acessar este estoque.",
    });
  }
}
export async function assertNotLoanStock(
  db: WorkflowDb,
  studioId: number,
  materialId: number
) {
  const [loan] = await db
    .select({ id: inventoryLoans.id })
    .from(inventoryLoans)
    .where(
      and(
        eq(inventoryLoans.studioId, studioId),
        eq(inventoryLoans.receivedMaterialId, materialId)
      )
    )
    .limit(1);
  if (loan)
    throw new TRPCError({
      code: "BAD_REQUEST",
      message:
        "Este saldo tem origem em empréstimo. Use a sessão POD para consumir ou a aba Empréstimos para devolver. Cadastre compras em um material próprio.",
    });
}
export async function assertNoPendingLoan(
  db: WorkflowDb,
  studioId: number,
  materialId: number
) {
  await assertNotLoanStock(db, studioId, materialId);
  const [loan] = await db
    .select({ id: inventoryLoans.id })
    .from(inventoryLoans)
    .where(
      and(
        eq(inventoryLoans.studioId, studioId),
        eq(inventoryLoans.sourceMaterialId, materialId),
        inArray(inventoryLoans.status, ["approved", "delivered"])
      )
    )
    .limit(1);
  if (loan)
    throw new TRPCError({
      code: "BAD_REQUEST",
      message:
        "Há um empréstimo aberto deste material. Conclua-o antes de arquivar ou alterar sua especificação.",
    });
}
