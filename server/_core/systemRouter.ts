import { z } from "zod";
import { notifyOwner } from "./notification";
import { adminProcedure, publicProcedure, protectedProcedure, router } from "./trpc";

export const systemRouter = router({
  health: publicProcedure
    .input(
      z.object({
        timestamp: z.number().min(0, "timestamp cannot be negative"),
      })
    )
    .query(() => ({
      ok: true,
    })),

  notifyOwner: adminProcedure
    .input(
      z.object({
        title: z.string().min(1, "title is required"),
        content: z.string().min(1, "content is required"),
      })
    )
    .mutation(async ({ input }) => {
      const delivered = await notifyOwner(input);
      return {
        success: delivered,
      } as const;
    }),

  /**
   * Testa a conexão com o Google Sheets enviando um ping e retornando o resultado.
   * Usado pelo frontend para exibir notificações visuais de status de sync.
   */
  syncTest: protectedProcedure.mutation(async () => {
    const webhookUrl = process.env.GOOGLE_SHEETS_WEBHOOK_URL ?? "";
    const syncSecret = process.env.GOOGLE_SHEETS_SYNC_SECRET ?? "";

    if (!webhookUrl || !syncSecret) {
      return { ok: false, error: "Integração com Google Sheets não configurada" };
    }

    try {
      const res = await fetch(webhookUrl, {
        method: "GET",
        signal: AbortSignal.timeout(10_000),
      });
      const data = await res.json() as { sucesso?: boolean; mensagem?: string };
      if (data?.sucesso === true || data?.mensagem) {
        return { ok: true };
      }
      return { ok: false, error: "Resposta inesperada do Google Sheets" };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { ok: false, error: message };
    }
  }),
});
