import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import {
  whatsappIntegrations,
  messageQueue,
  messageTemplates,
} from "../../drizzle/schema";
import { eq, desc, and } from "drizzle-orm";
import { interpolateTemplate } from "../messaging/provider";
import { getProvider } from "../messaging/service";
import { sendAndLog, seedDefaultTemplates } from "../messaging/service";

export const messagingRouter = router({
  // ── Integração (configuração do provedor) ──────────────────────────────────

  /** Lista todas as integrações cadastradas */
  listIntegrations: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(whatsappIntegrations).orderBy(desc(whatsappIntegrations.createdAt));
  }),

  /** Salva ou atualiza uma integração */
  saveIntegration: protectedProcedure
    .input(
      z.object({
        id: z.number().optional(),
        name: z.string().min(1),
        provider: z.enum(["botconversa", "zapi", "meta"]),
        phoneNumber: z.string().min(8),
        apiToken: z.string().min(1),
        instanceId: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      if (input.id) {
        await db
          .update(whatsappIntegrations)
          .set({
            name: input.name,
            provider: input.provider,
            phoneNumber: input.phoneNumber,
            apiToken: input.apiToken,
            instanceId: input.instanceId,
            updatedAt: new Date().toISOString().slice(0, 19).replace("T", " "),
          })
          .where(eq(whatsappIntegrations.id, input.id));
        return { ok: true };
      }

      await db.insert(whatsappIntegrations).values({
        name: input.name,
        provider: input.provider,
        phoneNumber: input.phoneNumber,
        apiToken: input.apiToken,
        instanceId: input.instanceId,
        status: "aguardando",
      });
      return { ok: true };
    }),

  /** Ativa uma integração e desativa as demais */
  activateIntegration: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // Desativa todas
      await db.update(whatsappIntegrations).set({ status: "inativo" });
      // Ativa a selecionada
      await db
        .update(whatsappIntegrations)
        .set({ status: "ativo" })
        .where(eq(whatsappIntegrations.id, input.id));
      return { ok: true };
    }),

  /** Remove uma integração */
  deleteIntegration: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db
        .delete(whatsappIntegrations)
        .where(eq(whatsappIntegrations.id, input.id));
      return { ok: true };
    }),

  /** Testa a conexão com o provedor */
  testConnection: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const rows = await db
        .select()
        .from(whatsappIntegrations)
        .where(eq(whatsappIntegrations.id, input.id))
        .limit(1);

      const integration = rows[0];
      if (!integration) throw new TRPCError({ code: "NOT_FOUND" });

      const provider = getProvider({
        provider: integration.provider,
        apiToken: integration.apiToken,
        phoneNumber: integration.phoneNumber,
        instanceId: integration.instanceId ?? undefined,
      });

      const result = await provider.testConnection();

      // Atualiza status e última data de teste
      await db
        .update(whatsappIntegrations)
        .set({
          status: result.success ? "ativo" : "erro",
          lastTestedAt: new Date().toISOString().slice(0, 19).replace("T", " "),
          lastErrorMessage: result.error ?? null,
          updatedAt: new Date().toISOString().slice(0, 19).replace("T", " "),
        })
        .where(eq(whatsappIntegrations.id, input.id));

      return result;
    }),

  // ── Templates de mensagem ──────────────────────────────────────────────────

  /** Lista todos os templates */
  listTemplates: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    await seedDefaultTemplates();
      return db.select().from(messageTemplates).orderBy(messageTemplates.trigger as any);
  }),

  /** Salva ou atualiza um template */
  saveTemplate: protectedProcedure
    .input(
      z.object({
        id: z.number().optional(),
        name: z.string().min(1),
        trigger: z.enum([
          "appointment_created",
          "appointment_confirmed",
          "appointment_reminder_24h",
          "appointment_reminder_2h",
          "appointment_cancelled",
          "appointment_rescheduled",
          "custom",
        ]),
        recipientType: z.enum(["client", "artist"]),
        message: z.string().min(1),
        isActive: z.boolean().default(true),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      if (input.id) {
        await db
          .update(messageTemplates)
          .set({
            name: input.name,
            trigger: input.trigger,
            recipientType: input.recipientType,
            message: input.message,
            isActive: input.isActive ? 1 : 0,
            updatedAt: new Date().toISOString().slice(0, 19).replace("T", " "),
          })
          .where(eq(messageTemplates.id, input.id));
      } else {
        await db.insert(messageTemplates).values({
          name: input.name,
          trigger: input.trigger,
          recipientType: input.recipientType,
          message: input.message,
          isActive: input.isActive ? 1 : 0,
        });
      }
      return { ok: true };
    }),

  /** Remove um template */
  deleteTemplate: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.delete(messageTemplates).where(eq(messageTemplates.id, input.id));
      return { ok: true };
    }),

  // ── Fila / Histórico de mensagens ──────────────────────────────────────────

  /** Lista o histórico de mensagens enviadas */
  listQueue: protectedProcedure
    .input(
      z.object({
        limit: z.number().default(50),
        status: z
          .enum(["pendente", "enviada", "erro", "cancelada", "respondida"])
          .optional(),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];

      const query = db
        .select()
        .from(messageQueue)
        .orderBy(desc(messageQueue.createdAt))
        .limit(input.limit);

      return query;
    }),

  /** Envia uma mensagem manual */
  sendManual: protectedProcedure
    .input(
      z.object({
        recipientPhone: z.string().min(8),
        recipientName: z.string().optional(),
        message: z.string().min(1),
        clientId: z.number().optional(),
        appointmentId: z.number().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const result = await sendAndLog({
        recipientPhone: input.recipientPhone,
        recipientName: input.recipientName,
        recipientType: "client",
        message: input.message,
        trigger: "custom",
        clientId: input.clientId,
        appointmentId: input.appointmentId,
      });

      if (!result.success) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: result.error ?? "Falha ao enviar mensagem",
        });
      }

      return result;
    }),

  /** Preview de um template com variáveis de exemplo */
  previewTemplate: protectedProcedure
    .input(
      z.object({
        message: z.string(),
        vars: z.record(z.string(), z.string()).optional(),
      })
    )
    .query(({ input }) => {
      const defaultVars: Record<string, string> = {
        nome_cliente: "João Silva",
        nome_tatuador: "Artista",
        nome_estudio: "POD Estúdio",
        data: "15/06/2026",
        hora: "14:00",
        servico: "Tatuagem",
        endereco: "Rua Exemplo, 123",
        valor_sinal: "R$ 150,00",
        status_sinal: "Confirmado",
        ...input.vars,
      };
      return { preview: interpolateTemplate(input.message, defaultVars) };
    }),
});
