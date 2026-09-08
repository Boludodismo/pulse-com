import {intelligentInboxRouter} from './routers/intelligentInbox';
import {studioRelationsRouter} from './routers/studioRelations';
import { customerCareRouter } from "./routers/customerCare";
import { avatarSchema, saveArtistAvatar } from "./artistAvatar";
import { assertOwnArtist, isInventoryManager } from "./inventoryAccess";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { COOKIE_NAME, normalizeWhatsAppNumber } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import {
  syncClientToSheets,
  syncAppointmentToSheets,
  syncAnamnesisSubmissionToSheets,
  syncMaterialToSheets,
  syncStockMovementToSheets,
} from "./googleSheetsSync";
import { publicProcedure, protectedProcedure, artistProcedure, router, superAdminProcedure, adminProcedure, tenantProcedure } from "./_core/trpc";
import { SAAS_MODULES, createStudioInvitation, listStudioInvitations, revokeStudioInvitation, claimStudioInvitation, listUserPermissions, replaceUserPermissions, summarizeSaasMetrics, hasModulePermission } from "./saas";
import * as db from "./db";
import { calendars, integrationContacts, whatsappIntegrations, tenantMaterials } from "../drizzle/schema";
import { and, eq, isNull } from "drizzle-orm";
import { whatsAppSchedulerStatus } from "./scheduler";
import { contactsRouter } from "./routers/contacts";
import { proceduresRouter } from "./routers/procedures";
import { podSaasRouter } from "./routers/podSaas";
import { messagingRouter } from "./routers/messaging";
import { consumeAppointmentActionLink, issueAppointmentActionLinks, listAppointmentActionAlerts, markAppointmentActionAlertViewed } from "./appointmentActions";
import { normalizeBrazilianPhone } from "./messaging/phone";
import { buildAutomaticAppointmentReminderMessage, scheduleAutomaticAppointmentReminder } from "./messaging/appointmentReminderSchedule";
import { firstName, formatStudioAddress } from "./messaging/messagePresentation";
import { buildLegacyAnamneseReviewPayload } from "./anamneseReview";

async function recordAppointmentWhatsappConsent(input: { studioId: number; clientId: number }) {
  const connection = await db.getDb();
  if (!connection) return false;

  const client = await db.getClientById(input.clientId);
  if (!client?.phone || client.studioId !== input.studioId) return false;

  const integration = (await connection.select({ id: whatsappIntegrations.id }).from(whatsappIntegrations)
    .where(and(
      eq(whatsappIntegrations.studioId, input.studioId),
      eq(whatsappIntegrations.status, "ativo"),
      eq(whatsappIntegrations.isEnabled, 1),
    )).limit(1))[0];
  if (!integration) return false;

  const timestamp = new Date().toISOString().slice(0, 19).replace("T", " ");
  await connection.insert(integrationContacts).values({
    studioId: input.studioId,
    integrationId: integration.id,
    clientId: client.id,
    normalizedPhone: normalizeBrazilianPhone(client.phone),
    hasWhatsappOptIn: 1,
    optInAt: timestamp,
    optInSource: "agendamento_confirmado",
    optedOutAt: null,
  }).onDuplicateKeyUpdate({ set: {
    normalizedPhone: normalizeBrazilianPhone(client.phone),
    hasWhatsappOptIn: 1,
    optInAt: timestamp,
    optInSource: "agendamento_confirmado",
    optedOutAt: null,
  }});
  return true;
}

export const appRouter = router({
  intelligentInbox: intelligentInboxRouter,
  customerCare: customerCareRouter,
  studioRelations: studioRelationsRouter,
  system: systemRouter,
  
  // Quick consume endpoint para registrar insumos rapidamente
  quickConsume: tenantProcedure
    .input(z.object({
      inventoryItemId: z.number(),
      procedureId: z.number(),
      category: z.enum(['ink','cartridge','disposable','liquid','protection','stencil','aftercare','other']),
      name: z.string(),
      quantity: z.string().or(z.number()),
      estimatedUnitCost: z.string().or(z.number()),
    }))
    .mutation(async ({ input, ctx }) => {
      try {
        const dbConn = await db.getDb();
        if (!dbConn) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível." });
        const { procedureConsumables, technicalProcedures } = await import("../drizzle/schema");
        const procedure = (await dbConn.select({ id: technicalProcedures.id }).from(technicalProcedures).where(and(
          eq(technicalProcedures.id, input.procedureId),
          eq(technicalProcedures.studioId, ctx.studioId),
        )).limit(1))[0];
        if (!procedure) throw new TRPCError({ code: "NOT_FOUND", message: "Sessão POD não encontrada nesta empresa." });
        const totalCost = (typeof input.quantity === 'string' ? parseFloat(input.quantity) : input.quantity) * 
                         (typeof input.estimatedUnitCost === 'string' ? parseFloat(input.estimatedUnitCost) : input.estimatedUnitCost);
        const quantityDecimal = typeof input.quantity === 'string' ? input.quantity : String(input.quantity);
        const unitCostDecimal = typeof input.estimatedUnitCost === 'string' ? input.estimatedUnitCost : String(input.estimatedUnitCost);
        const totalCostDecimal = String(totalCost);
        
        await dbConn.insert(procedureConsumables).values({
          procedureId: input.procedureId,
          inventoryItemId: input.inventoryItemId,
          category: input.category,
          name: input.name,
          unit: 'unit',
          quantity: quantityDecimal,
          estimatedUnitCost: unitCostDecimal,
          estimatedTotalCost: totalCostDecimal,
        });
        return { success: true, totalCost };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Erro ao registrar consumo' });
      }
    }),
  
  saas: router({
    studios: superAdminProcedure.query(async () => db.listStudios()),

    metrics: superAdminProcedure.query(async () => {
      const [studios, users, invitations] = await Promise.all([
        db.listStudios(),
        db.listAllUsers(),
        listStudioInvitations(),
      ]);
      return summarizeSaasMetrics({ studios, users, invitations });
    }),

    listInvitations: superAdminProcedure.query(async () => listStudioInvitations()),

    listStudioInvitations: tenantProcedure.query(async ({ ctx }) => {
      if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED" });
      if (ctx.user.role === "superadmin") return listStudioInvitations();
      return listStudioInvitations(ctx.user.studioId!);
    }),

    createInvitation: protectedProcedure
      .input(z.object({ studioId: z.number().int().positive().optional(), email: z.string().email(), role: z.enum(["admin", "collaborator"]) }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== "superadmin" && ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
        if (ctx.user.role === "admin" && input.role !== "collaborator") throw new TRPCError({ code: "FORBIDDEN", message: "Administradores podem convidar apenas colaboradores." });
        const studioId = ctx.user.role === "superadmin" ? input.studioId : ctx.user.studioId;
        if (!studioId) throw new TRPCError({ code: "BAD_REQUEST", message: "Empresa obrigatória." });
        return createStudioInvitation({ studioId, email: input.email, role: input.role, invitedByUserId: ctx.user.id });
      }),

    revokeInvitation: protectedProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== "superadmin" && ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
        return revokeStudioInvitation(input.id, ctx.user.role === "admin" ? ctx.user.studioId ?? undefined : undefined);
      }),

    claimInvitation: protectedProcedure
      .input(z.object({ token: z.string().length(64) }))
      .mutation(async ({ ctx, input }) => {
        const result = await claimStudioInvitation(input.token, ctx.user.id);
        if (!result.ok) throw new TRPCError({ code: result.reason === "email_mismatch" ? "FORBIDDEN" : "BAD_REQUEST", message: "Convite inválido, expirado, revogado ou não compatível com o e-mail autenticado." });
        return result;
      }),

    permissions: protectedProcedure
      .input(z.object({ userId: z.number().int().positive() }))
      .query(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin" && ctx.user.role !== "superadmin") throw new TRPCError({ code: "FORBIDDEN" });
        const target = await db.getUserById(input.userId);
        if (!target || (ctx.user.role !== "superadmin" && target.studioId !== ctx.user.studioId)) throw new TRPCError({ code: "FORBIDDEN" });
        return listUserPermissions(input.userId, target.studioId!);
      }),

    teamAccess: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user.role !== "admin" && ctx.user.role !== "superadmin") throw new TRPCError({ code: "FORBIDDEN" });
      const allUsers = await db.listAllUsers();
      const team = ctx.user.role === "superadmin" ? allUsers : allUsers.filter((member) => member.studioId === ctx.user.studioId);
      return Promise.all(team.filter((member) => member.role !== "superadmin").map(async (member) => ({
        id: member.id,
        name: member.name,
        email: member.email,
        role: member.role,
        studioId: member.studioId,
        accessStatus: member.accessStatus,
        accessExpiresAt: member.accessExpiresAt,
        permissions: member.studioId ? await listUserPermissions(member.id, member.studioId) : [],
      })));
    }),

    setPermissions: protectedProcedure
      .input(z.object({ userId: z.number().int().positive(), permissions: z.array(z.object({ module: z.enum(SAAS_MODULES), canRead: z.boolean(), canWrite: z.boolean() })) }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin" && ctx.user.role !== "superadmin") throw new TRPCError({ code: "FORBIDDEN" });
        const target = await db.getUserById(input.userId);
        if (!target || !target.studioId || (ctx.user.role !== "superadmin" && target.studioId !== ctx.user.studioId)) throw new TRPCError({ code: "FORBIDDEN" });
        await replaceUserPermissions({ userId: input.userId, studioId: target.studioId, permissions: input.permissions });
        return { success: true };
      }),
  }),

  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    setActiveStudio: protectedProcedure
      .input(z.object({ studioId: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED" });
        if (ctx.user.role !== "superadmin") {
          if (ctx.user.studioId !== input.studioId) {
            throw new TRPCError({ code: "FORBIDDEN", message: "Usuários SaaS só podem usar a empresa vinculada ao próprio login." });
          }
          return { studioId: ctx.user.studioId };
        }

        const studio = await db.getStudioById(input.studioId);
        if (!studio || studio.isActive !== 1) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Empresa selecionada não está disponível." });
        }
        await db.updateUser(ctx.user.id, { studioId: studio.id });
        return { studioId: studio.id };
      }),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),

    // Solicitar recuperação de senha por e-mail
    requestPasswordReset: publicProcedure
      .input(z.object({ email: z.string().email("E-mail inválido") }))
      .mutation(async ({ input }) => {
        const user = await db.getUserByEmail(input.email);
        // Sempre retornar sucesso para não revelar se e-mail existe
        if (!user || !user.passwordHash) {
          return { success: true };
        }
        // Gerar token seguro
        const crypto = await import("crypto");
        const token = crypto.randomBytes(32).toString("hex");
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hora
        const expiresAtStr = expiresAt.toISOString().slice(0, 19).replace("T", " ");
        // Salvar token no banco
        const dbConn = await db.getDb();
        const { passwordResetTokens } = await import("../drizzle/schema");
        await dbConn!.insert(passwordResetTokens).values({
          userId: user.id,
          token,
          expiresAt: expiresAtStr,
        });
        // Enviar notificação ao owner com o link
        const resetLink = `${process.env.APP_BASE_URL || "https://tatuei.com"}/reset-password?token=${token}`;
        const { notifyOwner } = await import("./_core/notification");
        await notifyOwner({
          title: `Recuperação de senha solicitada`,
          content: `O usuário **${user.name || user.email}** (${user.email}) solicitou recuperação de senha.\n\nLink de redefinição (válido por 1 hora):\n${resetLink}\n\nSe não foi você, ignore esta mensagem.`,
        });
        return { success: true };
      }),

    // Redefinir senha via token
    resetPassword: publicProcedure
      .input(z.object({
        token: z.string().min(1),
        newPassword: z.string().min(6, "Senha deve ter no mínimo 6 caracteres"),
      }))
      .mutation(async ({ input }) => {
        const dbConn = await db.getDb();
        const { passwordResetTokens } = await import("../drizzle/schema");
        const { eq, and, isNull } = await import("drizzle-orm");
        // Buscar token válido e não usado
        const [resetToken] = await dbConn!.select()
          .from(passwordResetTokens)
          .where(and(
            eq(passwordResetTokens.token, input.token),
            isNull(passwordResetTokens.usedAt)
          ))
          .limit(1);
        if (!resetToken) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Token inválido ou já utilizado" });
        }
        if (new Date(resetToken.expiresAt) < new Date()) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Token expirado. Solicite um novo link." });
        }
        // Hash da nova senha
        const { hashPassword } = await import("./_core/localAuth");
        const passwordHash = await hashPassword(input.newPassword);
        // Atualizar senha do usuário
        await db.updateUser(resetToken.userId, { passwordHash });
        // Marcar token como usado
        const usedAtStr = new Date().toISOString().slice(0, 19).replace("T", " ");
        await dbConn!.update(passwordResetTokens)
          .set({ usedAt: usedAtStr })
          .where(eq(passwordResetTokens.id, resetToken.id));
        return { success: true };
      }),

    // Verificar se token de reset é válido
    verifyResetToken: publicProcedure
      .input(z.object({ token: z.string() }))
      .query(async ({ input }) => {
        const dbConn = await db.getDb();
        const { passwordResetTokens } = await import("../drizzle/schema");
        const { eq, and, isNull } = await import("drizzle-orm");
        const [resetToken] = await dbConn!.select()
          .from(passwordResetTokens)
          .where(and(
            eq(passwordResetTokens.token, input.token),
            isNull(passwordResetTokens.usedAt)
          ))
          .limit(1);
        if (!resetToken || new Date(resetToken.expiresAt) < new Date()) {
          return { valid: false };
        }
        return { valid: true };
      }),
  }),

  // ============ CLIENTS ROUTER ============
  clients: router({
    list: artistProcedure
      .input(z.object({ studioId: z.number().int().positive().optional() }).optional())
      .query(async ({ ctx, input }) => {
        const studioId = ctx.user.role === "superadmin"
          ? input?.studioId ?? ctx.user.studioId
          : ctx.user.studioId;
        if (!studioId) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Selecione a empresa para consultar os clientes." });
        }
        return await db.listClients(studioId, ctx.artistId);
      }),

    search: artistProcedure
      .input(z.object({ term: z.string(), studioId: z.number().int().positive().optional() }))
      .query(async ({ ctx, input }) => {
        const studioId = ctx.user.role === "superadmin"
          ? input.studioId ?? ctx.user.studioId
          : ctx.user.studioId;
        if (!studioId) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Selecione a empresa para pesquisar clientes." });
        }
        return await db.searchClients(input.term, undefined, undefined, studioId);
      }),

    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return await db.getClientById(input.id);
      }),

    create: protectedProcedure
      .input(z.object({
        name: z.string().min(1),
        email: z.string().email().optional().or(z.literal("")),
        phone: z.string().optional(),
        birthDate: z.string().optional(),
        instagram: z.string().optional(),
        gender: z.enum(["Homem", "Mulher", "Outros"]).optional(),
        docType: z.enum(["cpf", "passport"]).optional(),
        docNumber: z.string().optional(),
        cep: z.string().optional(),
        street: z.string().optional(),
        number: z.string().optional(),
        complement: z.string().optional(),
        reference: z.string().optional(),
        neighborhood: z.string().optional(),
        city: z.string().optional(),
        state: z.string().optional(),
        country: z.string().optional(),
        studioId: z.number().int().positive().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        try {
          const studioId = ctx.user.role === "superadmin"
            ? input.studioId ?? ctx.user.studioId
            : ctx.user.studioId;
          
          if (!studioId) {
            throw new TRPCError({ code: "FORBIDDEN", message: "Selecione a empresa antes de cadastrar o cliente." });
          }
          
          const clientData = {
            studioId: studioId,
            artistId: ctx.user.artistId || null, // Vincular ao artista se for colaborador
            name: input.name,
            email: input.email || null,
            phone: input.phone || null,
            birthDate: input.birthDate || null,
            instagram: input.instagram || null,
            gender: input.gender || null,
            docType: input.docType || "cpf",
            docNumber: input.docNumber || null,
            cep: input.cep || null,
            street: input.street || null,
            number: input.number || null,
            complement: input.complement || null,
            reference: input.reference || null,
            neighborhood: input.neighborhood || null,
            city: input.city || null,
            state: input.state || null,
            country: input.country || "Brasil",
          };
          console.log('[clients.create] Creating client with data:', clientData);
          const result = await db.createClient(clientData);
          console.log('[clients.create] Client created successfully:', result);
          
          // Registrar auditoria
          try {
            await db.createAuditLog({
              userId: ctx.user.id,
              userName: ctx.user.name || "Usuário sem nome",
              action: "create",
              entity: "client",
              entityName: input.name,
              details: clientData,
              ipAddress: ctx.req.ip || ctx.req.socket?.remoteAddress,
              userAgent: ctx.req.headers?.["user-agent"],
            });
          } catch (auditError) {
            console.error('[clients.create] Audit log failed (non-critical):', auditError);
          }
          
          // Sincronizar com Google Sheets
          syncClientToSheets({
            id: result.id,
            name: result.name,
            phone: result.phone,
            email: result.email,
            birthDate: result.birthDate,
            instagram: result.instagram,
            city: result.city,
            state: result.state,
            country: result.country,
          });

          return result;
        } catch (error) {
          console.error('[clients.create] Error creating client:', error);
          throw error;
        }
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        data: z.object({
          name: z.string().min(1).optional(),
          email: z.string().email().optional().or(z.literal("")),
          phone: z.string().optional(),
          birthDate: z.string().optional(),
          instagram: z.string().optional(),
          cep: z.string().optional(),
          street: z.string().optional(),
          neighborhood: z.string().optional(),
          city: z.string().optional(),
          state: z.string().optional(),
          country: z.string().optional(),
          docType: z.enum(["cpf", "passport"]).optional(),
          docNumber: z.string().optional(),
        })
      }))
      .mutation(async ({ ctx, input }) => {
        // Buscar dados antes da atualização
        const clientBefore = await db.getClientById(input.id);
        
        const result = await db.updateClient(input.id, input.data);
        
        // Buscar dados depois da atualização
        const clientAfter = await db.getClientById(input.id);

        // Sincronizar com Google Sheets
        if (clientAfter) {
          syncClientToSheets({
            id: clientAfter.id,
            name: clientAfter.name,
            phone: clientAfter.phone,
            email: clientAfter.email,
            birthDate: clientAfter.birthDate,
            instagram: clientAfter.instagram,
            city: clientAfter.city,
            state: clientAfter.state,
            country: clientAfter.country,
          });
        }
        
        // Registrar auditoria
        await db.createAuditLog({
          userId: ctx.user.id,
          userName: ctx.user.name || "Usuário sem nome",
          action: "update",
          entity: "client",
          entityId: input.id,
          entityName: clientAfter?.name || clientBefore?.name || "Cliente",
          details: {
            before: clientBefore,
            after: clientAfter,
            changes: input.data,
          },
          ipAddress: ctx.req.ip || ctx.req.socket?.remoteAddress,
          userAgent: ctx.req.headers?.["user-agent"],
        });
        
        return result;
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        // Buscar dados antes da exclusão
        const clientBefore = await db.getClientById(input.id);
        
        const result = await db.deleteClient(input.id);
        
        // Registrar auditoria
        await db.createAuditLog({
          userId: ctx.user.id,
          userName: ctx.user.name || "Usuário sem nome",
          action: "delete",
          entity: "client",
          entityId: input.id,
          entityName: clientBefore?.name || "Cliente",
          details: {
            deletedClient: clientBefore,
          },
          ipAddress: ctx.req.ip || ctx.req.socket?.remoteAddress,
          userAgent: ctx.req.headers?.["user-agent"],
        });
        
        return result;
      }),
  }),

  // ============ APPOINTMENTS ROUTER ============
  appointments: router({
    list: tenantProcedure.query(async ({ ctx }) => {
      return await db.listAppointments(ctx.studioId, ctx.artistId);
    }),

    getByClientId: tenantProcedure
      .input(z.object({ clientId: z.number() }))
      .query(async ({ ctx, input }) => {
        return await db.getAppointmentsByClientId(input.clientId, ctx.studioId, ctx.artistId);
      }),

    getById: tenantProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ ctx, input }) => {
        if (!input.id || input.id <= 0) return null;
        const appointment = await db.getAppointmentById(input.id);
        if (!appointment) return null;
        if (ctx.studioId != null && appointment.studioId !== ctx.studioId) return null;
        if (ctx.artistId != null && appointment.artistId !== ctx.artistId) return null;
        return appointment;
      }),

    create: protectedProcedure
      .input(z.object({
        clientId: z.number(),
        studioId: z.number().int().positive().optional(),
        calendarId: z.number().optional(),
        date: z.string(),  // YYYY-MM-DD HH:mm:ss (local, sem conversão)
        duration: z.number().min(1),
        service: z.string().min(1),
        artist: z.string().min(1),
        artistId: z.number().optional(), // FK opcional para artists.id
        status: z.enum(["agendado", "confirmado", "concluido", "cancelado", "reagendado"]).optional(),
        notes: z.string().optional(),
        referenceImageUrl: z.string().optional(),
        referenceImageKey: z.string().optional(),
        depositPaid: z.boolean().optional(),
        depositAmount: z.number().min(0).optional(),
        totalAmount: z.number().min(0).optional(),
        depositPaymentMethod: z.enum(["pix", "dinheiro", "credito", "debito", "transferencia"]).optional(),
        signalStatus: z.enum(["aguardando_sinal", "sinal_confirmado"]).optional(),
        paymentStatus: z.enum(["pendente", "pago"]).optional(),
        paymentMethod: z.enum(["dinheiro", "pix", "cartao_credito", "cartao_debito", "transferencia", "outro"]).optional(),
        procedureType: z.enum(["tatuagem", "piercing", "micropigmentacao", "laser", "consulta", "retoque", "outro"]).optional(),
        procedureTypeOther: z.string().optional(),
        autoReminder: z.object({
          timing: z.enum(["same_day", "day_before"]),
          sendTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Horário de lembrete inválido."),
        }).optional(),
        recordWhatsAppConsent: z.boolean().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const studioId = ctx.user.role === "superadmin"
          ? input.studioId ?? ctx.user.studioId
          : ctx.user.studioId;
        if (!studioId) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Selecione a empresa antes de criar o agendamento." });
        }

        const client = await db.getClientById(input.clientId);
        if (!client || client.studioId !== studioId) {
          throw new TRPCError({ code: "FORBIDDEN", message: "O cliente selecionado não pertence à empresa escolhida." });
        }
        if (input.artistId) {
          const selectedArtist = await db.getArtistById(input.artistId, studioId);
          if (!selectedArtist) {
            throw new TRPCError({ code: "FORBIDDEN", message: "O artista selecionado não pertence à empresa escolhida." });
          }
        }
        
        // Validar horário comercial
        const settings = await db.getStudioSettings();
        if (settings?.businessHours) {
          try {
            const businessHours = JSON.parse(settings.businessHours) as Record<string, { open: string; close: string; closed: boolean }>;
            const appointmentDate = new Date(input.date);
            const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
            const dayName = dayNames[appointmentDate.getDay()];
            const dayConfig = businessHours[dayName];
            if (dayConfig?.closed) {
              throw new TRPCError({ code: "BAD_REQUEST", message: `O estúdio está fechado neste dia (${dayName}).` });
            }
            if (dayConfig?.open && dayConfig?.close) {
              const [openH, openM] = dayConfig.open.split(':').map(Number);
              const [closeH, closeM] = dayConfig.close.split(':').map(Number);
              const aptHour = appointmentDate.getHours();
              const aptMin = appointmentDate.getMinutes();
              const aptMinutes = aptHour * 60 + aptMin;
              const openMinutes = openH * 60 + openM;
              const closeMinutes = closeH * 60 + closeM;
              const endMinutes = aptMinutes + input.duration;
              if (aptMinutes < openMinutes || endMinutes > closeMinutes) {
                throw new TRPCError({ code: "BAD_REQUEST", message: `Agendamento fora do horário comercial (${dayConfig.open} - ${dayConfig.close}).` });
              }
            }
          } catch (e) {
            if (e instanceof TRPCError) throw e;
            // JSON inválido - ignorar validação de horário
          }
        }

        // Verificar conflitos antes de criar (operação atômica)
        const conflictCheck = await db.checkAppointmentConflicts(input.artist, input.date, input.duration, undefined, studioId);
        if (conflictCheck.hasConflict) {
          throw new TRPCError({
            code: "CONFLICT",
            message: `Conflito de horário: o artista ${input.artist} já possui ${conflictCheck.conflicts.length} agendamento(s) neste horário.`,
          });
        }

        // Resolver artistId: se não fornecido, buscar pelo nome do artista
        let resolvedArtistId = input.artistId ?? null;
        if (!resolvedArtistId && input.artist) {
          try {
            const d = await db.getDb();
            if (d) {
              const { artists: artistsTable } = await import("../drizzle/schema.js");
              const { eq, and } = await import("drizzle-orm");
              const found = await d.select({ id: artistsTable.id })
                .from(artistsTable)
                .where(and(eq(artistsTable.name, input.artist), eq(artistsTable.studioId, studioId)))
                .limit(1);
              if (found[0]) resolvedArtistId = found[0].id;
            }
          } catch { /* silencioso — artistId é opcional */ }
        }

        const { autoReminder, recordWhatsAppConsent, ...appointmentInput } = input;
        const appointmentData = {
          ...appointmentInput,
          artistId: resolvedArtistId,
          studioId: studioId,
          status: input.status || "agendado" as const,
          notes: input.notes || null,
          depositPaid: input.depositPaid ? 1 : 0,
          depositAmount: input.depositAmount ?? null,
          totalAmount: input.totalAmount ?? null,
          signalStatus: input.signalStatus || "aguardando_sinal" as const,
          paymentStatus: input.paymentStatus || "pendente" as const,
          paymentMethod: input.paymentMethod ?? null,
        };
        const result = await db.createAppointment(appointmentData);

        const automaticReminder: { scheduled: boolean; scheduledAt: string | null; reason: string | null } = {
          scheduled: false,
          scheduledAt: null,
          reason: null,
        };

        const warnings: string[] = [];
        // The appointment is already committed. An optional messaging failure
        // must not report a failed save or encourage a duplicate submission.
        try {
          if (recordWhatsAppConsent) {
            const recorded = await recordAppointmentWhatsappConsent({ studioId, clientId: client.id });
            if (!recorded) throw new Error("whatsapp_unavailable");
          }

          if (autoReminder) {
            if (!client?.phone) {
              automaticReminder.reason = "client_without_phone";
            } else {
              const scheduledAt = scheduleAutomaticAppointmentReminder(input.date, autoReminder.timing, autoReminder.sendTime);
              await db.createAppointmentReminder({
                appointmentId: result.id,
                scheduledAt,
                message: buildAutomaticAppointmentReminderMessage({
                  clientName: client.name ?? "cliente",
                  appointmentDate: input.date,
                  service: input.service,
                  artist: input.artist,
                }),
              });
              automaticReminder.scheduled = true;
              automaticReminder.scheduledAt = scheduledAt;
            }
          }
        } catch {
          automaticReminder.reason = "whatsapp_unavailable";
          warnings.push("Agendamento salvo. A autorização ou o lembrete do WhatsApp não pôde ser registrado; confira a integração antes de programar mensagens.");
          console.warn("[Appointments] Saved appointment; WhatsApp follow-up unavailable.");
        }

        // Bug 3: Se sinal já está pago ao criar, gerar transação no caixa
        if (input.depositPaid && input.depositAmount && input.depositAmount > 0) {
          await db.createTransaction({
            studioId,
            clientId: input.clientId,
            appointmentId: result.id,
            type: "entrada",
            category: "Sinal de Agendamento",
            description: `Sinal pago - ${input.service} com ${input.artist}`,
            amount: input.depositAmount,
            paymentMethod: input.depositPaymentMethod || "pix",
            date: new Date().toISOString().slice(0, 10),
          });
        }
        
        // Registrar auditoria
        await db.createAuditLog({
          userId: ctx.user.id,
          userName: ctx.user.name || "Usuário sem nome",
          action: "create",
          entity: "appointment",
          entityName: `${client?.name || "Cliente"} - ${input.service}`,
          details: appointmentData,
          ipAddress: ctx.req.ip || ctx.req.socket?.remoteAddress,
          userAgent: ctx.req.headers?.["user-agent"],
        });

        // Para agendamentos sem lembrete programado, preserva a confirmação imediata já existente.
        try {
          const { dispatchTemplateMessage } = await import("./messaging/service");
          if (!autoReminder && client?.phone) {
            await dispatchTemplateMessage({
              studioId,
              trigger: "appointment_created",
              recipientType: "client",
              recipientPhone: client.phone,
              recipientName: client.name,
              appointmentId: result.id,
              clientId: input.clientId,
              vars: {
                nome_cliente: firstName(client.name),
                data: input.date,
                hora: input.date?.split(" ")[1] ?? "",
                nome_tatuador: input.artist,
                servico: input.service,
                nome_estudio: (await db.getStudioById(studioId))?.name ?? "nosso estúdio",
                endereco: "",
              },
            });
          }
        } catch (_msgErr) { /* não bloquear fluxo se mensagem falhar */ }

        // Sincronizar com Google Sheets
        syncAppointmentToSheets({
          id: result.id,
          clientId: input.clientId,
          clientName: client?.name,
          clientPhone: client?.phone,
          artistName: input.artist,
          startTime: input.date ? new Date(input.date) : null,
          service: input.service,
          status: input.status || "agendado",
          depositPaid: input.depositPaid,
          depositAmount: input.depositAmount,
          totalPrice: input.totalAmount,
          depositPaymentMethod: input.depositPaymentMethod,
          notes: input.notes,
        });
        
        return { ...result, automaticReminder, warnings };
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        data: z.object({
          calendarId: z.number().nullable().optional(),
          clientId: z.number().int().positive().optional(),
          date: z.string().optional(),  // YYYY-MM-DD HH:mm:ss (local, sem conversão)
          duration: z.number().min(1).optional(),
          service: z.string().min(1).optional(),
          artist: z.string().min(1).optional(),
          artistId: z.number().optional(), // FK opcional para artists.id
          status: z.enum(["agendado", "confirmado", "concluido", "cancelado", "reagendado"]).optional(),
          confirmationStatus: z.enum(["pendente", "confirmado", "nao_confirmado", "atraso", "chegada_antecipada"]).optional(),
          notes: z.string().optional(),
          referenceImageUrl: z.string().optional(),
          referenceImageKey: z.string().optional(),
          depositPaid: z.boolean().optional(),
          depositAmount: z.number().min(0).optional(),
          totalAmount: z.number().min(0).optional(),
          depositPaymentMethod: z.enum(["pix", "dinheiro", "credito", "debito", "transferencia"]).optional(),
          signalStatus: z.enum(["aguardando_sinal", "sinal_confirmado"]).optional(),
          paymentStatus: z.enum(["pendente", "pago"]).optional(),
          paymentMethod: z.enum(["dinheiro", "pix", "cartao_credito", "cartao_debito", "transferencia", "outro"]).optional(),
          procedureType: z.enum(["tatuagem", "piercing", "micropigmentacao", "laser", "consulta", "retoque", "outro"]).optional(),
          procedureTypeOther: z.string().optional(),
          recordWhatsAppConsent: z.boolean().optional(),
        })
      }))
      .mutation(async ({ ctx, input }) => {
        // Buscar dados antes da atualização
        const appointmentBefore = await db.getAppointmentById(input.id);
        const activeStudioId = ctx.user.studioId;
        if (!appointmentBefore) throw new TRPCError({ code: "NOT_FOUND", message: "Agendamento não encontrado." });
        if (!activeStudioId || appointmentBefore.studioId !== activeStudioId) {
          throw new TRPCError({ code: "FORBIDDEN", message: "O agendamento não pertence à empresa ativa." });
        }
        
        if (input.data.clientId) {
          const client = await db.getClientById(input.data.clientId);
          if (!client || client.studioId !== activeStudioId) throw new TRPCError({ code: "FORBIDDEN", message: "Cliente não pertence ao estúdio." });
        }
        if (input.data.artistId && !await db.getArtistById(input.data.artistId, activeStudioId)) throw new TRPCError({ code: "FORBIDDEN", message: "Artista não pertence ao estúdio." });
        if ((input.data.date || input.data.duration || input.data.artist || input.data.artistId) && (input.data.status ?? appointmentBefore.status) !== "cancelado") {
          const availability = await db.checkAppointmentConflicts(input.data.artist ?? appointmentBefore.artist, input.data.date ?? appointmentBefore.date, input.data.duration ?? appointmentBefore.duration, input.id, activeStudioId);
          if (availability.hasConflict) throw new TRPCError({ code: "CONFLICT", message: "Este artista já possui um agendamento neste horário." });
        }
        const { depositPaid, recordWhatsAppConsent, ...restData } = input.data;
        let resolvedArtistId = restData.artistId;
        if (!resolvedArtistId && restData.artist && appointmentBefore?.studioId) {
          const resolvedArtist = (await db.listArtists(appointmentBefore.studioId)).find((candidate) => candidate.name === restData.artist);
          resolvedArtistId = resolvedArtist?.id;
        }
        const updateData: Parameters<typeof db.updateAppointment>[1] = {
          ...restData,
          ...(resolvedArtistId ? { artistId: resolvedArtistId } : {}),
          ...(depositPaid !== undefined ? { depositPaid: depositPaid ? 1 : 0 } : {}),
        };
        const result = await db.updateAppointment(input.id, updateData);

        // Bug 3: Gerar transação no caixa quando sinal muda de não-pago para pago
        const wasNotPaid = !appointmentBefore?.depositPaid || appointmentBefore.depositPaid === 0;
        const isNowPaid = input.data.depositPaid === true;
        const depositValue = input.data.depositAmount ?? appointmentBefore?.depositAmount ?? 0;
        if (wasNotPaid && isNowPaid && depositValue > 0) {
          await db.createTransaction({
            studioId: appointmentBefore.studioId,
            clientId: appointmentBefore?.clientId ?? null,
            appointmentId: input.id,
            type: "entrada",
            category: "Sinal de Agendamento",
            description: `Sinal pago - ${appointmentBefore?.service || "Serviço"} com ${appointmentBefore?.artist || "Artista"}`,
            amount: depositValue,
            paymentMethod: input.data.depositPaymentMethod || "pix",
            date: new Date().toISOString().slice(0, 10),
          });
        }

        // Buscar dados depois da atualização
        const appointmentAfter = await db.getAppointmentById(input.id);
        
        // Buscar nome do cliente
        const client = appointmentAfter?.clientId 
          ? await db.getClientById(appointmentAfter.clientId)
          : null;
        const warnings: string[] = [];
        if (recordWhatsAppConsent && appointmentAfter?.clientId) {
          try {
            const recorded = await recordAppointmentWhatsappConsent({ studioId: appointmentBefore.studioId, clientId: appointmentAfter.clientId });
            if (!recorded) throw new Error("whatsapp_unavailable");
          } catch {
            warnings.push("Agendamento atualizado. A autorização do WhatsApp não pôde ser registrada; confira a integração antes de programar mensagens.");
            console.warn("[Appointments] Updated appointment; WhatsApp consent unavailable.");
          }
        }
        
        // Registrar auditoria
        await db.createAuditLog({
          userId: ctx.user.id,
          userName: ctx.user.name || "Usuário sem nome",
          action: "update",
          entity: "appointment",
          entityId: input.id,
          entityName: `${client?.name || "Cliente"} - ${appointmentAfter?.service || appointmentBefore?.service || "Agendamento"}`,
          details: {
            before: appointmentBefore,
            after: appointmentAfter,
            changes: input.data,
          },
          ipAddress: ctx.req.ip || ctx.req.socket?.remoteAddress,
          userAgent: ctx.req.headers?.["user-agent"],
        });

        // Sincronizar com Google Sheets
        if (appointmentAfter) {
          syncAppointmentToSheets({
            id: appointmentAfter.id,
            clientId: appointmentAfter.clientId,
            clientName: client?.name,
            clientPhone: client?.phone,
            artistName: appointmentAfter.artist,
            startTime: appointmentAfter.date ? new Date(appointmentAfter.date) : null,
            service: appointmentAfter.service,
            status: appointmentAfter.status,
            depositPaid: appointmentAfter.depositPaid === 1,
            depositAmount: appointmentAfter.depositAmount ? Number(appointmentAfter.depositAmount) : undefined,
            totalPrice: appointmentAfter.totalAmount ? Number(appointmentAfter.totalAmount) : undefined,
            notes: appointmentAfter.notes,
          });
        }
        
        return { ...result, warnings };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await db.deleteAppointment(input.id);
        
        // Registrar auditoria
        await db.createAuditLog({
          userId: ctx.user.id,
          userName: ctx.user.name || 'Unknown',
          action: 'delete',
          entity: 'appointment',
          entityId: input.id,
        });
        
        return { success: true };
      }),

    checkConflicts: protectedProcedure
      .input(z.object({
        artist: z.string(),
        date: z.string(),
        duration: z.number(),
        excludeId: z.number().optional(), // Para excluir o próprio agendamento ao editar
      }))
      .query(async ({ ctx, input }) => {
        if (!ctx.user.studioId) throw new TRPCError({ code: "FORBIDDEN", message: "Selecione o estúdio." });
        return await db.checkAppointmentConflicts(input.artist, input.date, input.duration, input.excludeId, ctx.user.studioId);
      }),

    uploadImage: protectedProcedure
      .input(z.object({
        fileName: z.string(),
        fileData: z.string(), // base64
        contentType: z.string(),
      }))
      .mutation(async ({ input, ctx }) => {
        // Converter base64 para Buffer
        const base64Data = input.fileData.split(',')[1] || input.fileData;
        const buffer = Buffer.from(base64Data, 'base64');
        
        // Gerar chave única para o arquivo
        const timestamp = Date.now();
        const randomSuffix = Math.random().toString(36).substring(7);
        const fileExtension = input.fileName.split('.').pop();
        const fileKey = `appointments/${ctx.user.id}/${timestamp}-${randomSuffix}.${fileExtension}`;
        
        // Upload para S3
        const { storagePut } = await import("./storage");
        const { url } = await storagePut(fileKey, buffer, input.contentType);
        
        return { url, key: fileKey };
      }),

    // Gera o link WhatsApp com token assinado pelo backend
    generateWhatsAppLink: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const { createHash } = await import("crypto");
        const appointment = await db.getAppointmentById(input.id);
        if (!appointment) throw new TRPCError({ code: "NOT_FOUND", message: "Agendamento não encontrado" });
        const secret = process.env.JWT_SECRET || "secret";
        const token = createHash("sha256")
          .update(`${input.id}:${appointment.date}:${secret}`)
          .digest("hex")
          .slice(0, 16);
        return { token, date: appointment.date };
      }),

    // Rota pública para confirmação do cliente via link WhatsApp
    confirm: publicProcedure
      .input(z.object({
        id: z.number(),
        token: z.string(),
        status: z.enum(["confirmado", "nao_confirmado", "atraso", "chegada_antecipada"]),
      }))
      .mutation(async ({ input }) => {
        const { createHash } = await import("crypto");
        const appointment = await db.getAppointmentById(input.id);
        if (!appointment) throw new TRPCError({ code: "NOT_FOUND", message: "Agendamento não encontrado" });
        const secret = process.env.JWT_SECRET || "secret";
        const expected = createHash("sha256")
          .update(`${input.id}:${appointment.date}:${secret}`)
          .digest("hex")
          .slice(0, 16);
        if (input.token !== expected) throw new TRPCError({ code: "UNAUTHORIZED", message: "Link inválido" });
        await db.updateAppointment(input.id, { confirmationStatus: input.status });
        return { success: true, status: input.status };
      }),

    /** Consome um link aleatório, expirável e de uso único enviado ao cliente. */
    consumeActionLink: publicProcedure
      .input(z.object({ token: z.string().min(32).max(128) }))
      .mutation(async ({ input }) => {
        try {
          const result = await consumeAppointmentActionLink(input.token);
          return { success: true, action: result.action, appointmentId: result.appointmentId };
        } catch (error) {
          throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "Não foi possível registrar esta ação." });
        }
      }),

    /** Alertas de ação do cliente, sempre limitados ao estúdio da sessão. */
    listActionAlerts: tenantProcedure
      .input(z.object({ limit: z.number().int().min(1).max(20).optional() }).optional())
      .query(async ({ ctx, input }) => {
        if (ctx.studioId == null) throw new TRPCError({ code: "FORBIDDEN", message: "Empresa não selecionada." });
        return listAppointmentActionAlerts(ctx.studioId, input?.limit ?? 8);
      }),

    markActionAlertViewed: tenantProcedure
      .input(z.object({ alertId: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.studioId == null) throw new TRPCError({ code: "FORBIDDEN", message: "Empresa não selecionada." });
        await markAppointmentActionAlertViewed(ctx.studioId, input.alertId);
        return { success: true };
      }),

    // ── Lembretes individuais por agendamento ──────────────────────────────────
    reminders: router({
      list: protectedProcedure
        .input(z.object({ appointmentId: z.number() }))
        .query(async ({ input }) => {
          return await db.listRemindersByAppointment(input.appointmentId);
        }),

      create: protectedProcedure
        .input(z.object({
          appointmentId: z.number(),
          scheduledAt: z.string(), // "YYYY-MM-DD HH:MM:SS"
          message: z.string().min(1),
        }))
        .mutation(async ({ input }) => {
          return await db.createAppointmentReminder({
            appointmentId: input.appointmentId,
            scheduledAt: input.scheduledAt,
            message: input.message,
          });
        }),

      update: protectedProcedure
        .input(z.object({
          id: z.number(),
          scheduledAt: z.string().optional(),
          message: z.string().optional(),
          status: z.enum(["pending", "sent", "failed"]).optional(),
        }))
        .mutation(async ({ input }) => {
          const { id, ...data } = input;
          return await db.updateAppointmentReminder(id, data);
        }),

      delete: protectedProcedure
        .input(z.object({ id: z.number() }))
        .mutation(async ({ input }) => {
          await db.deleteAppointmentReminder(input.id);
          return { success: true };
        }),
    }),

    // ── Links de exportação para calendários e WhatsApp ──────────────────────
    getCalendarLinks: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const appointment = await db.getAppointmentById(input.id);
        if (!appointment) throw new TRPCError({ code: "NOT_FOUND", message: "Agendamento não encontrado" });

        const client = await db.getClientById(appointment.clientId);
        if (!client) throw new TRPCError({ code: "NOT_FOUND", message: "Cliente não encontrado" });

        const studioSettings = await db.getStudioSettings();
        const anamnesisRecords = await db.getAnamnesisByClientId(appointment.clientId);
        const latestAnamnesis = anamnesisRecords.length > 0 ? anamnesisRecords[0] : null;

        const baseUrl = process.env.APP_BASE_URL ||
          (process.env.NODE_ENV === "production"
            ? `https://${process.env.VITE_APP_ID ? "tatuei.com" : "tatuei.manus.space"}`
            : "http://localhost:3000");

        // Token de confirmação
        const { createHash } = await import("crypto");
        const secret = process.env.JWT_SECRET || "secret";
        const token = createHash("sha256")
          .update(`${appointment.id}:${appointment.date}:${secret}`)
          .digest("hex")
          .slice(0, 16);
        const confirmationLink = `${baseUrl}/confirmar?id=${appointment.id}&token=${token}&status=confirmado`;

        // Link de anamnese
        const anamnesisLink = latestAnamnesis
          ? `${baseUrl}/anamnese/view/${latestAnamnesis.id}`
          : null;

        // Link do Google Calendar
        const { generateGoogleCalendarUrl } = await import("./icsGenerator");
        const googleCalendarUrl = generateGoogleCalendarUrl({
          appointment,
          client,
          studio: studioSettings ? {
            name: studioSettings.studioName,
            address: studioSettings.address,
            phone: studioSettings.phone,
          } : null,
          anamnesis: latestAnamnesis,
          anamnesisLink,
          confirmationLink,
          baseUrl,
        });

        // Link de WhatsApp com mensagem de confirmação
        const dateFormatted = new Date(appointment.date.replace(" ", "T") + "-03:00").toLocaleString("pt-BR", {
          weekday: "long",
          day: "2-digit",
          month: "long",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          timeZone: "America/Sao_Paulo",
        });
        const studioName = studioSettings?.studioName || "Estúdio";
        const whatsappMessage = encodeURIComponent(
          `Olá ${client.name}! 🎨\n\n` +
          `Seu agendamento está confirmado:\n` +
          `• Serviço: ${appointment.service}\n` +
          `• Artista: ${appointment.artist}\n` +
          `• Data: ${dateFormatted}\n` +
          `• Duração: ${appointment.duration} minutos\n` +
          (studioSettings?.address ? `• Local: ${studioSettings.address}\n` : "") +
          `\nConfirme sua presença clicando no link:\n${confirmationLink}\n\n` +
          `Qualquer dúvida, estamos à disposição! 🙏\n${studioName}`
        );
        const whatsappPhone = client.phone?.replace(/\D/g, "") || "";
        const whatsappLink = whatsappPhone
          ? `https://wa.me/55${whatsappPhone}?text=${whatsappMessage}`
          : `https://wa.me/?text=${whatsappMessage}`;

        return {
          icsUrl: `/api/appointments/${appointment.id}/ics`,
          googleCalendarUrl,
          confirmationLink,
          anamnesisLink,
          whatsappLink,
          hasAnamnesis: !!latestAnamnesis,
          clientPhone: client.phone,
        };
      }),
  }),

  // ============ ANAMNESIS ROUTER ============
  anamnesis: router({
    getAll: protectedProcedure
      .query(async () => {
        return await db.getAllAnamnesis();
      }),

    getByClientId: protectedProcedure
      .input(z.object({ clientId: z.number() }))
      .query(async ({ input }) => {
        return await db.getAnamnesisByClientId(input.clientId);
      }),

    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return await db.getAnamnesisById(input.id);
      }),

    exportPdf: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const anamnese = await db.getAnamnesisById(input.id);
        if (!anamnese) {
          throw new Error("Anamnese não encontrada");
        }
        
        // Retornar dados para geração de PDF no frontend
        return anamnese;
      }),

    create: protectedProcedure
      .input(z.object({
        clientId: z.number(),
        appointmentId: z.number().optional(),
        hasAllergies: z.boolean(),
        allergiesDetails: z.string().optional(),
        hasDiseases: z.boolean(),
        diseasesDetails: z.string().optional(),
        usesMedication: z.boolean(),
        medicationDetails: z.string().optional(),
        isPregnant: z.boolean(),
        hasKeloid: z.boolean(),
        acceptedTerms: z.boolean(),
        signatureUrl: z.string().optional(),
        pdfUrl: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        // Calcular nível de risco automaticamente
        const { calculateRiskLevel } = await import("./riskAssessment");
        const riskAssessment = calculateRiskLevel({
          hasAllergies: input.hasAllergies,
          allergiesDetails: input.allergiesDetails,
          hasDiseases: input.hasDiseases,
          diseasesDetails: input.diseasesDetails,
          usesMedication: input.usesMedication,
          medicationDetails: input.medicationDetails,
          isPregnant: input.isPregnant,
          hasKeloid: input.hasKeloid,
        });

        const anamnesisData = {
          ...input,
          appointmentId: input.appointmentId || null,
          hasAllergies: input.hasAllergies ? 1 : 0,
          hasDiseases: input.hasDiseases ? 1 : 0,
          usesMedication: input.usesMedication ? 1 : 0,
          isPregnant: input.isPregnant ? 1 : 0,
          hasKeloid: input.hasKeloid ? 1 : 0,
          acceptedTerms: input.acceptedTerms ? 1 : 0,
          allergiesDetails: input.allergiesDetails || null,
          diseasesDetails: input.diseasesDetails || null,
          medicationDetails: input.medicationDetails || null,
          signatureUrl: input.signatureUrl || null,
          pdfUrl: input.pdfUrl || null,
          riskLevel: riskAssessment.riskLevel,
          riskFactors: JSON.stringify(riskAssessment.riskFactors),
        };
        return await db.createAnamnesis(anamnesisData);
      }),
  }),

  // ============ TRANSACTIONS ROUTER ============
  transactions: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      // Bug 8: filtrar por studioId do usuário
      return await db.listTransactions(ctx.user.studioId ?? null);
    }),

    getByClientId: protectedProcedure
      .input(z.object({ clientId: z.number() }))
      .query(async ({ input }) => {
        return await db.getTransactionsByClientId(input.clientId);
      }),

    getByDateRange: tenantProcedure
      .input(z.object({
        startDate: z.string(),
        endDate: z.string(),
      }))
      .query(async ({ ctx, input }) => {
        if (ctx.user!.role === "collaborator" && (!ctx.studioId || !(await hasModulePermission({ userId: ctx.user!.id, studioId: ctx.studioId, module: "finance" })))) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Sem permissão para consultar dados financeiros." });
        }
        return await db.getTransactionsByDateRange(input.startDate, input.endDate, ctx.studioId);
      }),

    create: protectedProcedure
      .input(z.object({
        clientId: z.number().optional(),
        appointmentId: z.number().optional(),
        type: z.enum(["entrada", "saida"]),
        category: z.string().min(1),
        description: z.string().optional(),
        amount: z.number().min(1),
        paymentMethod: z.enum(["dinheiro", "pix", "credito", "debito", "transferencia"]),
        date: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        // Determinar studioId
        let studioId = ctx.user.studioId;
        if (!studioId) {
          if (ctx.user.role === 'superadmin') {
            const firstStudio = await db.getFirstStudio();
            if (!firstStudio) {
              throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Nenhum estúdio cadastrado no sistema." });
            }
            studioId = firstStudio.id;
          } else {
            throw new TRPCError({ code: "FORBIDDEN", message: "Usuário não vinculado a um estúdio." });
          }
        }
        
        const transactionData = {
          ...input,
          studioId: studioId,
          clientId: input.clientId || null,
          appointmentId: input.appointmentId || null,
          description: input.description || null,
        };
        const result = await db.createTransaction(transactionData);
        
        // Buscar nome do cliente se houver
        const client = input.clientId 
          ? await db.getClientById(input.clientId)
          : null;
        
        // Registrar auditoria
        await db.createAuditLog({
          userId: ctx.user.id,
          userName: ctx.user.name || "Usuário sem nome",
          action: "create",
          entity: "transaction",
          entityName: `${input.type === "entrada" ? "Entrada" : "Saída"} - ${input.category} - R$ ${input.amount.toFixed(2)}`,
          details: {
            ...transactionData,
            clientName: client?.name,
          },
          ipAddress: ctx.req.ip || ctx.req.socket?.remoteAddress,
          userAgent: ctx.req.headers?.["user-agent"],
        });
        
        return result;
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        data: z.object({
          clientId: z.number().optional().nullable(),
          appointmentId: z.number().optional().nullable(),
          type: z.enum(["entrada", "saida"]).optional(),
          category: z.string().min(1).optional(),
          description: z.string().optional(),
          amount: z.number().min(1).optional(),
          paymentMethod: z.enum(["dinheiro", "pix", "credito", "debito", "transferencia"]).optional(),
          date: z.string().optional(),
        })
      }))
      .mutation(async ({ ctx, input }) => {
        // Buscar dados antes da atualização
        const transactionBefore = await db.getTransactionById(input.id);
        
        const result = await db.updateTransaction(input.id, input.data);
        
        // Buscar dados depois da atualização
        const transactionAfter = await db.getTransactionById(input.id);
        
        // Buscar nome do cliente se houver
        const client = transactionAfter?.clientId 
          ? await db.getClientById(transactionAfter.clientId)
          : null;
        
        // Registrar auditoria
        await db.createAuditLog({
          userId: ctx.user.id,
          userName: ctx.user.name || "Usuário sem nome",
          action: "update",
          entity: "transaction",
          entityId: input.id,
          entityName: `${transactionAfter?.type === "entrada" ? "Entrada" : "Saída"} - ${transactionAfter?.category || transactionBefore?.category || "Transação"}`,
          details: {
            before: transactionBefore,
            after: transactionAfter,
            changes: input.data,
            clientName: client?.name,
          },
          ipAddress: ctx.req.ip || ctx.req.socket?.remoteAddress,
          userAgent: ctx.req.headers?.["user-agent"],
        });
        
        return result;
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        // Buscar dados antes da exclusão
        const transactionBefore = await db.getTransactionById(input.id);
        
        const result = await db.deleteTransaction(input.id);
        
        // Buscar nome do cliente se houver
        const client = transactionBefore?.clientId 
          ? await db.getClientById(transactionBefore.clientId)
          : null;
        
        // Registrar auditoria
        await db.createAuditLog({
          userId: ctx.user.id,
          userName: ctx.user.name || "Usuário sem nome",
          action: "delete",
          entity: "transaction",
          entityId: input.id,
          entityName: `${transactionBefore?.type === "entrada" ? "Entrada" : "Saída"} - ${transactionBefore?.category || "Transação"}`,
          details: {
            deletedTransaction: transactionBefore,
            clientName: client?.name,
          },
          ipAddress: ctx.req.ip || ctx.req.socket?.remoteAddress,
          userAgent: ctx.req.headers?.["user-agent"],
        });
        
        return result;
      }),

    // Criar transação com baixa automática de materiais do estoque
    createWithMaterials: protectedProcedure
      .input(z.object({
        clientId: z.number().optional(),
        appointmentId: z.number().optional(),
        type: z.enum(["entrada", "saida"]),
        category: z.string().min(1),
        description: z.string().optional(),
        amount: z.number().min(1),
        paymentMethod: z.enum(["dinheiro", "pix", "credito", "debito", "transferencia"]),
        date: z.string(),
        materials: z.array(z.object({
          materialId: z.number(),
          quantity: z.number().positive(),
          reason: z.string().optional(),
        })).optional().default([]),
      }))
      .mutation(async ({ ctx, input }) => {
        // Determinar studioId
        let studioId = ctx.user.studioId;
        if (!studioId) {
          if (ctx.user.role === 'superadmin') {
            const firstStudio = await db.getFirstStudio();
            if (!firstStudio) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Nenhum estúdio cadastrado." });
            studioId = firstStudio.id;
          } else {
            throw new TRPCError({ code: "FORBIDDEN", message: "Usuário não vinculado a um estúdio." });
          }
        }

        const { materials: materialItems, ...transactionInput } = input;

        // Criar a transação financeira
        const transactionData = {
          ...transactionInput,
          studioId,
          clientId: transactionInput.clientId || null,
          appointmentId: transactionInput.appointmentId || null,
          description: transactionInput.description || null,
        };
        const transaction = await db.createTransaction(transactionData);

        // Dar baixa nos materiais selecionados
        const stockResults: Array<{ materialId: number; materialName: string; previousStock: number; newStock: number }> = [];
        for (const item of materialItems) {
          const mat = await db.getMaterialById(item.materialId);
          if (!mat) continue;
          const result = await db.addStockMovement({
            materialId: item.materialId,
            type: 'saida',
            quantity: item.quantity,
            reason: item.reason || `Baixa via transação financeira - ${transactionInput.category}`,
            createdBy: ctx.user.id,
          });
          stockResults.push({
            materialId: item.materialId,
            materialName: mat.name,
            previousStock: result.previousStock,
            newStock: result.newStock,
          });
        }

        // Registrar auditoria
        await db.createAuditLog({
          userId: ctx.user.id,
          userName: ctx.user.name || "Usuário sem nome",
          action: "create",
          entity: "transaction",
          entityName: `${input.type === "entrada" ? "Entrada" : "Saída"} - ${input.category} - R$ ${(input.amount / 100).toFixed(2)}`,
          details: { ...transactionData, stockMovements: stockResults },
          ipAddress: ctx.req.ip || ctx.req.socket?.remoteAddress,
          userAgent: ctx.req.headers?.["user-agent"],
        });

        return { transaction, stockMovements: stockResults };
      }),
  }),

  // ============ REPORTS ROUTER ============
  reports: router({
    monthlyRevenue: tenantProcedure
      .input(z.object({
        startDate: z.string(),
        endDate: z.string(),
      }))
      .query(async ({ ctx, input }) => {
        if (ctx.user!.role === "collaborator" && (!ctx.studioId || !(await hasModulePermission({ userId: ctx.user!.id, studioId: ctx.studioId, module: "reports" })))) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Sem permissão para consultar relatórios." });
        }
        return await db.getMonthlyRevenue(input.startDate, input.endDate, ctx.studioId);
      }),

    categoryBreakdown: tenantProcedure
      .input(z.object({
        startDate: z.string(),
        endDate: z.string(),
      }))
      .query(async ({ ctx, input }) => {
        if (ctx.user!.role === "collaborator" && (!ctx.studioId || !(await hasModulePermission({ userId: ctx.user!.id, studioId: ctx.studioId, module: "reports" })))) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Sem permissão para consultar relatórios." });
        }
        return await db.getCategoryBreakdown(input.startDate, input.endDate, ctx.studioId);
      }),

    paymentMethodBreakdown: tenantProcedure
      .input(z.object({
        startDate: z.string(),
        endDate: z.string(),
      }))
      .query(async ({ ctx, input }) => {
        if (ctx.user!.role === "collaborator" && (!ctx.studioId || !(await hasModulePermission({ userId: ctx.user!.id, studioId: ctx.studioId, module: "reports" })))) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Sem permissão para consultar relatórios." });
        }
        return await db.getPaymentMethodBreakdown(input.startDate, input.endDate, ctx.studioId);
      }),

    summary: tenantProcedure
      .input(z.object({
        startDate: z.string(),
        endDate: z.string(),
      }))
      .query(async ({ ctx, input }) => {
        if (ctx.user!.role === "collaborator" && (!ctx.studioId || !(await hasModulePermission({ userId: ctx.user!.id, studioId: ctx.studioId, module: "reports" })))) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Sem permissão para consultar relatórios." });
        }
        return await db.getFinancialSummary(input.startDate, input.endDate, ctx.studioId);
      }),
    artistRevenue: protectedProcedure
      .input(z.object({
        startDate: z.string(),
        endDate: z.string(),
        groupBy: z.enum(['week', 'month', 'bimonth', 'year']).default('month'),
      }))
      .query(async ({ ctx, input }) => {
        // CORREÇÃO 3: passar studioId para filtrar corretamente (antes era hardcoded = 1)
        return await db.getArtistRevenue(input.startDate, input.endDate, input.groupBy, ctx.user.studioId ?? null);
      }),
  }),

  // ============ NOTES ROUTER ============
  notes: router({
    getByClientId: protectedProcedure
      .input(z.object({ clientId: z.number() }))
      .query(async ({ input }) => {
        return await db.getNotesByClientId(input.clientId);
      }),

    create: protectedProcedure
      .input(z.object({
        clientId: z.number(),
        content: z.string().min(1),
      }))
      .mutation(async ({ input, ctx }) => {
        const noteData = {
          clientId: input.clientId,
          authorId: ctx.user.id,
          content: input.content,
        };
        return await db.createNote(noteData);
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        return await db.deleteNote(input.id);
      }),
  }),

  // ============ GALLERY ROUTER ============
  gallery: router({
    getByClientId: protectedProcedure
      .input(z.object({ clientId: z.number() }))
      .query(async ({ input }) => {
        return await db.getGalleryByClientId(input.clientId);
      }),

    uploadImage: protectedProcedure
      .input(z.object({
        clientId: z.number(),
        appointmentId: z.number().optional(),
        imageBase64: z.string(),
        fileName: z.string(),
        mimeType: z.string(),
        description: z.string().optional(),
        tags: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        // Converter base64 para buffer
        const base64Data = input.imageBase64.replace(/^data:image\/\w+;base64,/, "");
        const buffer = Buffer.from(base64Data, 'base64');
        
        // Gerar nome único para o arquivo
        const timestamp = Date.now();
        const randomSuffix = Math.random().toString(36).substring(2, 8);
        const extension = input.fileName.split('.').pop() || 'jpg';
        const fileKey = `client-${input.clientId}/gallery/${timestamp}-${randomSuffix}.${extension}`;
        
        // Upload para S3
        const { storagePut } = await import("./storage");
        const { url } = await storagePut(fileKey, buffer, input.mimeType);
        
        // Salvar no banco de dados
        const galleryData = {
          clientId: input.clientId,
          appointmentId: input.appointmentId || null,
          imageUrl: url,
          imageKey: fileKey,
          description: input.description || null,
          tags: input.tags || null,
        };
        
        return await db.createGalleryImage(galleryData);
      }),

    create: protectedProcedure
      .input(z.object({
        clientId: z.number(),
        appointmentId: z.number().optional(),
        imageUrl: z.string(),
        imageKey: z.string(),
        description: z.string().optional(),
        tags: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const galleryData = {
          ...input,
          appointmentId: input.appointmentId || null,
          description: input.description || null,
          tags: input.tags || null,
        };
        return await db.createGalleryImage(galleryData);
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        return await db.deleteGalleryImage(input.id);
      }),
  }),

  // ============ DASHBOARD ROUTER ============
  dashboard: router({
    topClients: protectedProcedure
      .input(z.object({ limit: z.number().optional() }))
      .query(async ({ input }) => {
        return await db.getTopClients(input.limit || 5);
      }),

    upcomingBirthdays: protectedProcedure
      .input(z.object({ daysAhead: z.number().optional() }))
      .query(async ({ input }) => {
        return await db.getUpcomingBirthdays(input.daysAhead || 30);
      }),

    metrics: protectedProcedure.query(async () => {
      return await db.getDashboardMetrics();
    }),

    weeklyAppointments: protectedProcedure.query(async () => {
      return await db.getWeeklyAppointments();
    }),
  }),

  // ============ SEARCH ROUTER ============
  search: router({
    global: protectedProcedure
      .input(z.object({ 
        term: z.string().min(1),
        startDate: z.date().optional(),
        endDate: z.date().optional(),
      }))
      .query(async ({ input }) => {
        const [clients, appointments, transactions] = await Promise.all([
          db.searchClients(input.term, input.startDate, input.endDate),
          db.searchAppointments(input.term, input.startDate, input.endDate),
          db.searchTransactions(input.term, input.startDate, input.endDate),
        ]);

        return {
          clients,
          appointments,
          transactions,
        };
      }),
  }),

  // ============ NOTIFICATIONS ROUTER ============
  notifications: router({    
    getUpcomingAppointments: tenantProcedure.query(async ({ ctx }) => {
      return await db.getUpcomingAppointments(ctx.studioId, ctx.artistId);
    }),

    sendReminders: protectedProcedure.mutation(async () => {
      return await db.sendAppointmentReminders();
    }),

    sendSelectedReminders: tenantProcedure
      .input(z.object({
        appointmentIds: z.array(z.number().int().positive()).min(1).max(50),
      }))
      .mutation(async ({ ctx, input }) => {
        const studioId = ctx.studioId;
        if (!studioId) throw new TRPCError({ code: "FORBIDDEN", message: "Selecione uma empresa antes de enviar lembretes." });
        const selectable = await db.getUpcomingAppointments(studioId, ctx.artistId);
        const requestedIds = new Set(input.appointmentIds);
        const selected = selectable.filter((appointment) => requestedIds.has(appointment.id));
        if (selected.length !== requestedIds.size) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Um ou mais agendamentos não estão disponíveis para envio." });
        }

        const { dispatchTemplateMessage } = await import("./messaging/service");
        const studio = await db.getStudioById(studioId);
        if (!studio) throw new TRPCError({ code: "NOT_FOUND", message: "Estúdio selecionado não encontrado." });
        const studioName = studio.name?.trim() || "nosso estúdio";
        const studioAddress = formatStudioAddress(studio);
        const connection = await db.getDb();
        const activeIntegration = connection ? (await connection.select({ id: whatsappIntegrations.id })
          .from(whatsappIntegrations)
          .where(and(
            eq(whatsappIntegrations.studioId, studioId),
            eq(whatsappIntegrations.status, "ativo"),
            eq(whatsappIntegrations.isEnabled, 1),
          )).limit(1))[0] : null;
        if (!connection || !activeIntegration) {
          throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Não há integração BotConversa ativa para o estúdio selecionado." });
        }
        let sent = 0;
        let failed = 0;
        const details: Array<{ appointmentId: number; success: boolean; error?: string }> = [];

        for (const appointment of selected) {
          if (!appointment.clientPhone) {
            failed += 1;
            details.push({ appointmentId: appointment.id, success: false, error: "Cliente sem telefone cadastrado" });
            continue;
          }
          const consent = (await connection.select({ id: integrationContacts.id })
            .from(integrationContacts)
            .where(and(
              eq(integrationContacts.studioId, studioId),
              eq(integrationContacts.integrationId, activeIntegration.id),
              eq(integrationContacts.clientId, appointment.clientId),
              eq(integrationContacts.hasWhatsappOptIn, 1),
              isNull(integrationContacts.optedOutAt),
            )).limit(1))[0];
          if (!consent) {
            failed += 1;
            details.push({ appointmentId: appointment.id, success: false, error: "Cliente sem opt-in ativo para WhatsApp" });
            continue;
          }
          const date = new Date(`${String(appointment.date).replace(" ", "T")}-03:00`);
          const actionLinks = await issueAppointmentActionLinks({ studioId, appointmentId: appointment.id });
          const result = await dispatchTemplateMessage({
            studioId,
            trigger: "appointment_reminder_24h",
            recipientType: "client",
            recipientPhone: appointment.clientPhone,
            recipientName: firstName(appointment.clientName),
            appointmentId: appointment.id,
            clientId: appointment.clientId,
            vars: {
              nome_cliente: firstName(appointment.clientName),
              nome_estudio: studioName,
              nome_artista: appointment.artist ?? "artista",
              nome_tatuador: appointment.artist ?? "artista",
              data: date.toLocaleDateString("pt-BR"),
              hora: date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
              servico: appointment.service ?? "sessão",
              endereco: studioAddress,
              link_anamnese: "",
              link_ebook: "",
              link_confirmacao: actionLinks.confirmed,
              link_adiantamento: actionLinks.early,
              link_atraso: actionLinks.late,
              link_remarcar: actionLinks.reschedule_requested,
              __appointment_action_links: actionLinks as unknown as string,
            },
            idempotencyKey: `manual-appointment-reminder:${studioId}:${appointment.id}:${String(appointment.date)}`,
          });
          if (result.success) sent += 1;
          else failed += 1;
          details.push({ appointmentId: appointment.id, success: result.success, error: result.success ? undefined : result.error });
        }

        return { success: failed === 0, sent, failed, details };
      }),

    getNotificationLogs: protectedProcedure
      .input(z.object({ limit: z.number().optional() }))
      .query(async ({ input }) => {
        return await db.getNotificationLogs(input.limit || 50);
      }),

    getWhatsAppSchedulerStatus: protectedProcedure.query(() => {
      return whatsAppSchedulerStatus;
    }),

    getWhatsAppLogs: protectedProcedure
      .input(z.object({ limit: z.number().optional() }))
      .query(async ({ input }) => {
        return await db.getNotificationLogs(input.limit || 50);
      }),

    // Listar todos os lembretes individuais pendentes (para exibir na tela de Notificações)
    getPendingReminders: tenantProcedure.query(async ({ ctx }) => {
      const studioId = ctx.studioId;
      if (!studioId) throw new TRPCError({ code: "FORBIDDEN", message: "Selecione uma empresa antes de consultar lembretes." });
      return await db.getAllPendingReminders(studioId);
    }),

    // Mantém o envio no processador de fila: o clique não abre WhatsApp local
    // nem realiza chamada externa diretamente na requisição do navegador.
    sendPendingReminderNow: tenantProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        const studioId = ctx.studioId;
        if (!studioId) throw new TRPCError({ code: "FORBIDDEN", message: "Selecione uma empresa antes de enviar o lembrete." });
        const released = await db.releasePendingReminderNow(input.id, studioId);
        if (!released) throw new TRPCError({ code: "NOT_FOUND", message: "Lembrete pendente não encontrado para o estúdio selecionado." });
        return { success: true, queued: true };
      }),

    // Atualizar data/hora de um lembrete individual
    updateReminder: protectedProcedure
      .input(z.object({
        id: z.number(),
        scheduledAt: z.string(),
        message: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        return await db.updateAppointmentReminder(id, data);
      }),

    // Deletar um lembrete individual
    deleteReminder: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteAppointmentReminder(input.id);
        return { success: true };
      }),
  }),

  // ============ SETTINGS ROUTER ============
  settings: router({
    get: protectedProcedure.query(async () => {
      return await db.getStudioSettings();
    }),

    update: protectedProcedure
      .input(z.object({
        studioName: z.string().optional(),
        address: z.string().optional(),
        city: z.string().optional(),
        state: z.string().optional(),
        zipCode: z.string().optional(),
        phone: z.string().optional(),
        email: z.string().email().optional().or(z.literal("")),
        website: z.string().optional(),
        instagram: z.string().optional(),
        logoUrl: z.string().optional(),
        logoKey: z.string().optional(),
        primaryColor: z.string().optional(),
        secondaryColor: z.string().optional(),
        businessHours: z.string().optional(),
        enableBirthdayReminders: z.number().optional(),
        enableAppointmentReminders: z.number().optional(),
        // Configurações WhatsApp
        reminderDaysBefore: z.number().optional(),
        reminderSendTime: z.string().optional(),
        reminderResend: z.number().optional(),
        reminderResendTime: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        return await db.updateStudioSettings(input);
      }),
  }),

  // ============ ARTISTS ROUTER ============
  artists: router({
    list: tenantProcedure.query(async ({ ctx }) => {
      assertOwnArtist(ctx, ctx.artistId);
      return await db.listArtists(ctx.studioId, ctx.artistId);
    }),

    getById: tenantProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ ctx, input }) => {
        assertOwnArtist(ctx, input.id);
        return await db.getArtistById(input.id, ctx.studioId);
      }),

    uploadAvatar: tenantProcedure
      .input(z.object({
        artistId: z.number().int().positive(),
        fileName: z.string().min(1).max(160),
        imageBase64: z.string().min(1).max(7_000_000),
        mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]),
      }))
      .mutation(async ({ ctx, input }) => {
        assertOwnArtist(ctx, input.artistId);
        const artist = await db.getArtistById(input.artistId, ctx.studioId);
        if (!artist || (ctx.artistId != null && artist.id !== ctx.artistId)) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Artista não disponível para este usuário." });
        }
        const photo = await saveArtistAvatar(ctx.studioId, input);
        await db.updateArtist(artist.id, photo);
        return photo;
      }),

    create: tenantProcedure
      .input(z.object({
        name: z.string().min(1),
        email: z.string().email().optional().or(z.literal("")),
        phone: z.string().optional(),
        instagram: z.string().optional(),
        specialty: z.string().optional(),
        bio: z.string().optional(),
        photoUrl: z.string().optional(),
        photoKey: z.string().optional(),
        avatar: avatarSchema.optional(),
        color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional().nullable(),
        active: z.number().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        if (!isInventoryManager(ctx)) throw new TRPCError({ code: "FORBIDDEN", message: "Somente o administrador pode cadastrar artistas." });
        const { avatar, ...fields } = input;
        const photo = avatar ? await saveArtistAvatar(ctx.studioId, avatar) : {};
        return await db.createArtist({ ...fields, ...photo, studioId: ctx.studioId });
      }),

    update: tenantProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().min(1).optional(),
        email: z.string().email().optional().or(z.literal("")),
        phone: z.string().optional(),
        instagram: z.string().optional(),
        specialty: z.string().optional(),
        bio: z.string().optional(),
        photoUrl: z.string().optional(),
        photoKey: z.string().optional(),
        avatar: avatarSchema.optional(),
        color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional().nullable(),
        active: z.number().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        assertOwnArtist(ctx, input.id);
        const artist = await db.getArtistById(input.id, ctx.studioId);
        if (!artist) throw new TRPCError({ code: "NOT_FOUND", message: "Artista não encontrado neste estúdio." });
        const { id, avatar, ...data } = input;
        if (!isInventoryManager(ctx) && data.active !== undefined && data.active !== artist.active) throw new TRPCError({ code: "FORBIDDEN", message: "Somente o administrador pode alterar o status." });
        const photo = avatar ? await saveArtistAvatar(ctx.studioId, avatar) : {};
        return await db.updateArtist(id, { ...data, ...photo });
      }),

    delete: tenantProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        if (!isInventoryManager(ctx)) throw new TRPCError({ code: "FORBIDDEN", message: "Somente o administrador pode remover artistas." });
        if (!await db.getArtistById(input.id, ctx.studioId)) throw new TRPCError({ code: "NOT_FOUND", message: "Artista não encontrado neste estúdio." });
        const database = await db.getDb();
        if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco indisponível." });
        const owned = await database.select({ id: tenantMaterials.id }).from(tenantMaterials).where(and(eq(tenantMaterials.studioId, ctx.studioId), eq(tenantMaterials.ownerArtistId, input.id))).limit(1);
        if (owned.length) throw new TRPCError({ code: "CONFLICT", message: "Este artista possui histórico de estoque. Desative o cadastro para preservar os registros." });
        return await db.deleteArtist(input.id);
      }),
   }),

  // ============ USERS ROUTER (Admin only) ============
  users: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      // Apenas admins podem listar usuários
      if (ctx.user.role !== "admin" && ctx.user.role !== "superadmin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Acesso negado" });
      }
      return await db.listAllUsers();
    }),

    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin" && ctx.user.role !== "superadmin") {
          throw new TRPCError({ code: "FORBIDDEN", message: "Acesso negado" });
        }
        return await db.getUserById(input.id);
      }),

    create: protectedProcedure
      .input(z.object({
        openId: z.string().min(1),
        name: z.string().optional(),
        email: z.string().email().optional().or(z.literal("")),
        role: z.enum(["superadmin", "admin", "collaborator"]).optional(),
        studioId: z.number().optional().nullable(),
        artistId: z.number().optional().nullable(),
      }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin" && ctx.user.role !== "superadmin") {
          throw new TRPCError({ code: "FORBIDDEN", message: "Acesso negado" });
        }
        const result = await db.createUser(input);
        
        // Registrar auditoria
        await db.createAuditLog({
          userId: ctx.user.id,
          userName: ctx.user.name || "Usuário sem nome",
          action: "create",
          entity: "user",
          entityName: input.name || input.openId,
          details: {
            openId: input.openId,
            name: input.name,
            email: input.email,
            role: input.role || "user",
            artistId: input.artistId,
          },
          ipAddress: ctx.req.ip || ctx.req.socket?.remoteAddress,
          userAgent: ctx.req.headers?.["user-agent"],
        });
        
        return result;
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().optional(),
        email: z.string().email().optional().or(z.literal("")),
        role: z.enum(["superadmin", "admin", "collaborator"]).optional(),
        studioId: z.number().optional().nullable(),
        artistId: z.number().optional().nullable(),
        isActive: z.number().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin" && ctx.user.role !== "superadmin") {
          throw new TRPCError({ code: "FORBIDDEN", message: "Acesso negado" });
        }
        
        // Buscar dados antes da atualização
        const userBefore = await db.getUserById(input.id);
        
        const { id, ...data } = input;
        const result = await db.updateUser(id, data);
        
        // Buscar dados depois da atualização
        const userAfter = await db.getUserById(input.id);
        
        // Determinar ação (update, activate ou deactivate)
        let action: "update" | "activate" | "deactivate" = "update";
        if (input.isActive !== undefined && userBefore) {
          if (input.isActive === 1 && userBefore.isActive === 0) {
            action = "activate";
          } else if (input.isActive === 0 && userBefore.isActive === 1) {
            action = "deactivate";
          }
        }
        
        // Registrar auditoria
        await db.createAuditLog({
          userId: ctx.user.id,
          userName: ctx.user.name || "Usuário sem nome",
          action,
          entity: "user",
          entityId: input.id,
          entityName: userAfter?.name || userBefore?.name || "Usuário",
          details: {
            before: userBefore,
            after: userAfter,
            changes: data,
          },
          ipAddress: ctx.req.ip || ctx.req.socket?.remoteAddress,
          userAgent: ctx.req.headers?.["user-agent"],
        });
        
        return result;
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin" && ctx.user.role !== "superadmin") {
          throw new TRPCError({ code: "FORBIDDEN", message: "Acesso negado" });
        }
        
        // Buscar dados antes da exclusão
        const userBefore = await db.getUserById(input.id);
        
        const result = await db.deleteUser(input.id);
        
        // Registrar auditoria
        await db.createAuditLog({
          userId: ctx.user.id,
          userName: ctx.user.name || "Usuário sem nome",
          action: "delete",
          entity: "user",
          entityId: input.id,
          entityName: userBefore?.name || "Usuário",
          details: {
            deletedUser: userBefore,
          },
          ipAddress: ctx.req.ip || ctx.req.socket?.remoteAddress,
          userAgent: ctx.req.headers?.["user-agent"],
        });
        
        return result;
      }),

    // Criar usuário local com e-mail + senha (AUTH_MODE=local)
    createLocal: protectedProcedure
      .input(z.object({
        name: z.string().min(1, "Nome obrigatório"),
        email: z.string().email("E-mail inválido"),
        password: z.string().min(6, "Senha mínima de 6 caracteres"),
        role: z.enum(["superadmin", "admin", "collaborator"]).default("collaborator"),
        studioId: z.number().optional().nullable(),
        artistId: z.number().optional().nullable(),
      }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin" && ctx.user.role !== "superadmin") {
          throw new TRPCError({ code: "FORBIDDEN", message: "Acesso negado" });
        }
        // Verificar se e-mail já existe
        const existing = await db.getUserByEmail(input.email);
        if (existing) {
          throw new TRPCError({ code: "CONFLICT", message: "E-mail já cadastrado" });
        }
        const { hashPassword } = await import("./_core/localAuth");
        const passwordHash = await hashPassword(input.password);
        const openId = `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const result = await db.createUser({
          openId,
          name: input.name,
          email: input.email.trim().toLowerCase(),
          role: input.role,
          studioId: input.studioId ?? null,
          artistId: input.artistId ?? null,
          passwordHash,
        });
        await db.createAuditLog({
          userId: ctx.user.id,
          userName: ctx.user.name || "Admin",
          action: "create",
          entity: "user",
          entityName: input.name,
          details: { email: input.email, role: input.role, loginMethod: "local" },
          ipAddress: ctx.req.ip || ctx.req.socket?.remoteAddress,
          userAgent: ctx.req.headers?.["user-agent"],
        });
        return result;
      }),

    // Trocar a própria senha (usuário logado)
    changePassword: protectedProcedure
      .input(z.object({
        currentPassword: z.string().min(1, "Senha atual obrigatória"),
        newPassword: z.string().min(6, "Nova senha deve ter no mínimo 6 caracteres"),
      }))
      .mutation(async ({ ctx, input }) => {
        const user = await db.getUserById(ctx.user.id);
        if (!user?.passwordHash) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Sua conta não possui senha local configurada" });
        }
        const { verifyPassword, hashPassword } = await import("./_core/localAuth");
        const valid = await verifyPassword(input.currentPassword, user.passwordHash);
        if (!valid) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "Senha atual incorreta" });
        }
        const passwordHash = await hashPassword(input.newPassword);
        await db.updateUser(ctx.user.id, { passwordHash });
        await db.createAuditLog({
          userId: ctx.user.id,
          userName: ctx.user.name || "Usuário",
          action: "update",
          entity: "user",
          entityId: ctx.user.id,
          entityName: ctx.user.name || "Usuário",
          details: { action: "password_changed" },
          ipAddress: ctx.req.ip || ctx.req.socket?.remoteAddress,
          userAgent: ctx.req.headers?.["user-agent"],
        });
        return { success: true };
      }),

    // Redefinir senha de um usuário local (admin only)
    setPassword: protectedProcedure
      .input(z.object({
        id: z.number(),
        password: z.string().min(6, "Senha mínima de 6 caracteres"),
      }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin" && ctx.user.role !== "superadmin") {
          throw new TRPCError({ code: "FORBIDDEN", message: "Acesso negado" });
        }
        const { hashPassword } = await import("./_core/localAuth");
        const passwordHash = await hashPassword(input.password);
        await db.updateUser(input.id, { passwordHash });
        return { success: true };
      }),
  }),

  // ============ AUDIT ROUTER (Admin only) ============
  audit: router({
    list: protectedProcedure
      .input(z.object({
        action: z.string().optional(),
        entity: z.string().optional(),
        startDate: z.date().optional(),
        endDate: z.date().optional(),
        userId: z.number().optional(),
        limit: z.number().optional(),
      }).optional())
      .query(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin" && ctx.user.role !== "superadmin") {
          throw new TRPCError({ code: "FORBIDDEN", message: "Acesso negado" });
        }
        return await db.listAuditLogs(input);
      }),

    search: protectedProcedure
      .input(z.object({ term: z.string() }))
      .query(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin" && ctx.user.role !== "superadmin") {
          throw new TRPCError({ code: "FORBIDDEN", message: "Acesso negado" });
        }
        return await db.searchAuditLogs(input.term);
      }),

    statistics: protectedProcedure
      .input(z.object({
        startDate: z.date().optional(),
        endDate: z.date().optional(),
      }).optional())
      .query(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin" && ctx.user.role !== "superadmin") {
          throw new TRPCError({ code: "FORBIDDEN", message: "Acesso negado" });
        }
        return await db.getAuditStatistics(input?.startDate, input?.endDate);
      }),

    actionsByDay: protectedProcedure
      .input(z.object({
        startDate: z.date(),
        endDate: z.date(),
      }))
      .query(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin" && ctx.user.role !== "superadmin") {
          throw new TRPCError({ code: "FORBIDDEN", message: "Acesso negado" });
        }
        return await db.getAuditActionsByDay(input.startDate, input.endDate);
      }),

    actionsByType: protectedProcedure
      .input(z.object({
        startDate: z.date().optional(),
        endDate: z.date().optional(),
      }).optional())
      .query(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin" && ctx.user.role !== "superadmin") {
          throw new TRPCError({ code: "FORBIDDEN", message: "Acesso negado" });
        }
        return await db.getAuditActionsByType(input?.startDate, input?.endDate);
      }),

    actionsByEntity: protectedProcedure
      .input(z.object({
        startDate: z.date().optional(),
        endDate: z.date().optional(),
      }).optional())
      .query(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin" && ctx.user.role !== "superadmin") {
          throw new TRPCError({ code: "FORBIDDEN", message: "Acesso negado" });
        }
        return await db.getAuditActionsByEntity(input?.startDate, input?.endDate);
      }),

    topActiveUsers: protectedProcedure
      .input(z.object({
        limit: z.number().optional(),
        startDate: z.date().optional(),
        endDate: z.date().optional(),
      }).optional())
      .query(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin" && ctx.user.role !== "superadmin") {
          throw new TRPCError({ code: "FORBIDDEN", message: "Acesso negado" });
        }
        return await db.getTopActiveUsers(input?.limit, input?.startDate, input?.endDate);
      }),

    heatmap: protectedProcedure
      .input(z.object({
        startDate: z.date().optional(),
        endDate: z.date().optional(),
      }).optional())
      .query(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin" && ctx.user.role !== "superadmin") {
          throw new TRPCError({ code: "FORBIDDEN", message: "Acesso negado" });
        }
        return await db.getAuditHeatmap(input?.startDate, input?.endDate);
      }),

    exportPDF: protectedProcedure
      .input(z.object({
        startDate: z.date(),
        endDate: z.date(),
        logsLimit: z.number().optional(),
        usersLimit: z.number().optional(),
        template: z.object({
          includeSections: z.array(z.string()).optional(),
          reportTitle: z.string().optional(),
          reportSubtitle: z.string().optional(),
          primaryColor: z.string().optional(),
          footerText: z.string().optional(),
        }).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin" && ctx.user.role !== "superadmin") {
          throw new TRPCError({ code: "FORBIDDEN", message: "Acesso negado" });
        }

        const { generateAuditPDF } = await import("./auditPdfGenerator");

        const logsLimit = input.logsLimit || 20;
        const usersLimit = input.usersLimit || 5;

        // Buscar todos os dados necessários
        const [statistics, actionsByDay, actionsByType, actionsByEntity, topUsers, recentLogs] = await Promise.all([
          db.getAuditStatistics(input.startDate, input.endDate),
          db.getAuditActionsByDay(input.startDate, input.endDate),
          db.getAuditActionsByType(input.startDate, input.endDate),
          db.getAuditActionsByEntity(input.startDate, input.endDate),
          db.getTopActiveUsers(usersLimit, input.startDate, input.endDate),
          db.listAuditLogs({ startDate: input.startDate, endDate: input.endDate, limit: logsLimit }),
        ]);

        // Gerar PDF
        const pdfBuffer = await generateAuditPDF({
          startDate: input.startDate,
          endDate: input.endDate,
          statistics,
          actionsByDay,
          actionsByType,
          actionsByEntity,
          topUsers,
          recentLogs,
          template: input.template,
        });

        // Retornar PDF como base64
        return {
          pdf: pdfBuffer.toString("base64"),
          filename: `relatorio-auditoria-${input.startDate.toISOString().split("T")[0]}-${input.endDate.toISOString().split("T")[0]}.pdf`,
        };
      }),
  }),

  reportTemplates: router({
    create: protectedProcedure
      .input(z.object({
        name: z.string(),
        description: z.string().optional(),
        includeSections: z.array(z.string()),
        sectionOrder: z.array(z.string()),
        logsLimit: z.number(),
        usersLimit: z.number(),
        reportTitle: z.string().optional(),
        reportSubtitle: z.string().optional(),
        primaryColor: z.string().optional(),
        logoUrl: z.string().optional(),
        logoKey: z.string().optional(),
        footerText: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin" && ctx.user.role !== "superadmin") {
          throw new TRPCError({ code: "FORBIDDEN", message: "Acesso negado" });
        }
        const templateId = await db.createReportTemplate({
          userId: ctx.user.id,
          ...input,
        });
        return { id: templateId };
      }),

    list: protectedProcedure
      .query(async ({ ctx }) => {
        if (ctx.user.role !== "admin" && ctx.user.role !== "superadmin") {
          throw new TRPCError({ code: "FORBIDDEN", message: "Acesso negado" });
        }
        return await db.listReportTemplates(ctx.user.id);
      }),

    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin" && ctx.user.role !== "superadmin") {
          throw new TRPCError({ code: "FORBIDDEN", message: "Acesso negado" });
        }
        return await db.getReportTemplate(input.id, ctx.user.id);
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().optional(),
        description: z.string().optional(),
        includeSections: z.array(z.string()).optional(),
        sectionOrder: z.array(z.string()).optional(),
        logsLimit: z.number().optional(),
        usersLimit: z.number().optional(),
        reportTitle: z.string().optional(),
        reportSubtitle: z.string().optional(),
        primaryColor: z.string().optional(),
        logoUrl: z.string().optional(),
        logoKey: z.string().optional(),
        footerText: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin" && ctx.user.role !== "superadmin") {
          throw new TRPCError({ code: "FORBIDDEN", message: "Acesso negado" });
        }
        const { id, ...data } = input;
        await db.updateReportTemplate(id, ctx.user.id, data);
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin" && ctx.user.role !== "superadmin") {
          throw new TRPCError({ code: "FORBIDDEN", message: "Acesso negado" });
        }
        await db.deleteReportTemplate(input.id, ctx.user.id);
        return { success: true };
      }),
  }),

  // Calendários personalizados
  calendars: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return await db.listCalendars(ctx.user.id);
    }),
    create: protectedProcedure
      .input(z.object({
        name: z.string(),
        description: z.string().optional(),
        color: z.string().optional(),
        isVisible: z.number().optional(),
        isDefault: z.number().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const calendarData = { ...input, userId: ctx.user.id };
        const [result] = await (await db.getDb())!.insert(calendars).values(calendarData);
        const calendar = await db.getCalendarById(result.insertId, ctx.user.id);
        return calendar;
      }),
    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().optional(),
        description: z.string().optional(),
        color: z.string().optional(),
        isVisible: z.number().optional(),
        isDefault: z.number().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const { id, ...data } = input;
        await db.updateCalendar(id, ctx.user.id, data);
        const calendar = await db.getCalendarById(id, ctx.user.id);
        return calendar;
      }),
    toggleVisibility: protectedProcedure
      .input(z.object({ id: z.number(), isVisible: z.number() }))
      .mutation(async ({ input, ctx }) => {
        await db.toggleCalendarVisibility(input.id, ctx.user.id, input.isVisible);
        const calendar = await db.getCalendarById(input.id, ctx.user.id);
        return calendar;
      }),
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        await db.deleteCalendar(input.id, ctx.user.id);
        return { success: true };
      }),
  }),

  // ============ ANAMNESE ROUTER ============
  anamnese: router({
    // Criar solicitação e gerar link
    createRequest: protectedProcedure
      .input(z.object({
        clientId: z.number(),
        appointmentId: z.number().optional(),
        sentVia: z.enum(["email", "whatsapp"]),
        sentTo: z.string(),
      }))
      .mutation(async ({ input }) => {
        // Gerar token único
        const token = Math.random().toString(36).substring(2) + Date.now().toString(36);
        // Expirar em 7 dias
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
        
        const requestId = await db.createAnamneseRequest({
          clientId: input.clientId,
          appointmentId: input.appointmentId,
          token,
          sentVia: input.sentVia,
          sentTo: input.sentTo,
          expiresAt,
          statusRequest: 'pendente',
        });
        
        // Retornar link — usa domínio dinâmico do ambiente
        const baseUrl = process.env.APP_BASE_URL ||
          (process.env.NODE_ENV === "production"
            ? `https://${process.env.VITE_APP_ID ? "tatuei.com" : "tatuei.manus.space"}`
            : "http://localhost:3000");
        const link = `${baseUrl}/anamnese/${token}`;
        
        return { requestId, token, link, expiresAt };
      }),

    // Obter solicitação por token (público)
    getRequestByToken: publicProcedure
      .input(z.object({ token: z.string() }))
      .query(async ({ input }) => {
        const request = await db.getAnamneseRequestByToken(input.token);
        if (!request) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Link inválido ou expirado" });
        }
        if (new Date(request.expiresAt) < new Date() && !request.completedAt) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Link expirado" });
        }
        // Buscar dados do cliente
        const client = await db.getClientById(request.clientId);
        // Uma solicitação de revisão mantém a submissão anterior intacta e a usa
        // somente para pré-preencher o novo formulário.
        let existingPayload: Record<string, any> | null = null;
        let existingSubmissionId: number | null = null;
        if (request.completedAt) {
          const submission = await db.getAnamneseSubmissionByRequestId(request.id);
          if (submission) {
            try { existingPayload = JSON.parse(submission.payloadJson); } catch {}
            existingSubmissionId = submission.id;
          }
        } else {
          const latestSubmission = (await db.getAnamneseSubmissionsByClientId(request.clientId))[0];
          if (latestSubmission) {
            try { existingPayload = JSON.parse(latestSubmission.payloadJson); } catch {}
          } else {
            const legacyRecord = (await db.getAnamnesisByClientId(request.clientId))[0];
            if (legacyRecord && client) {
              existingPayload = buildLegacyAnamneseReviewPayload(client, legacyRecord);
            }
          }
        }
        return {
          request,
          client,
          existingPayload,
          existingSubmissionId,
          isEditing: !!request.completedAt,
          isReview: !request.completedAt && !!existingPayload,
        };
      }),

    // Submeter anamnese preenchida (público) — também suporta reedição
    submitAnamnese: publicProcedure
      .input(z.object({
        token: z.string(),
        payload: z.record(z.string(), z.any()),
        submissionId: z.number().optional(), // presente quando está editando
      }))
      .mutation(async ({ input }) => {
        const request = await db.getAnamneseRequestByToken(input.token);
        if (!request) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Link inválido" });
        }
        
        const payloadJson = JSON.stringify(input.payload);
        
        if (request.completedAt) {
          // Modo edição: atualizar submissão existente
          // Usa o submissionId enviado pelo frontend ou busca pelo requestId como fallback
          let targetId = input.submissionId;
          if (!targetId) {
            const existing = await db.getAnamneseSubmissionByRequestId(request.id);
            targetId = existing?.id;
          }
          if (!targetId) {
            throw new TRPCError({ code: "NOT_FOUND", message: "Submissão original não encontrada" });
          }
          await db.updateAnamneseSubmission(targetId, payloadJson);
          return { success: true, submissionId: targetId };
        }
        
        // Primeira submissão
        if (new Date(request.expiresAt) < new Date()) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Link expirado" });
        }
        const submissionId = await db.createAnamneseSubmission({
          requestId: request.id,
          clientId: request.clientId,
          appointmentId: request.appointmentId,
          payloadJson,
        });
        await db.markAnamneseRequestCompleted(request.id);

        // Sincronizar com Google Sheets
        syncAnamnesisSubmissionToSheets({
          id: submissionId,
          clientId: request.clientId,
          appointmentId: request.appointmentId,
          submittedAt: new Date(),
        });

        return { success: true, submissionId };
      }),

    // Listar submissões de um cliente
    getByClientId: protectedProcedure
      .input(z.object({ clientId: z.number() }))
      .query(async ({ input }) => {
        const submissions = await db.getAnamneseSubmissionsByClientId(input.clientId);
        return submissions.map(s => ({
          ...s,
          payload: JSON.parse(s.payloadJson),
        }));
      }),

    // Listar solicitações de um cliente
     getRequestsByClientId: protectedProcedure
      .input(z.object({ clientId: z.number() }))
      .query(async ({ input }) => {
        return await db.getAnamneseRequestsByClientId(input.clientId);
      }),
    // Editar submissão via link (painel interno)
    updateSubmission: protectedProcedure
      .input(z.object({
        id: z.number(),
        payload: z.record(z.string(), z.any()),
      }))
      .mutation(async ({ input }) => {
        await db.updateAnamneseSubmission(input.id, JSON.stringify(input.payload));

        // Sincronizar com Google Sheets
        syncAnamnesisSubmissionToSheets({
          id: input.id,
          submittedAt: new Date(),
        });

        return { success: true };
      }),
    // Excluir submissão via link (painel interno)
    deleteSubmission: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteAnamneseSubmission(input.id);
        return { success: true };
      }),
    // Editar ficha manual (painel interno)
    updateRecord: protectedProcedure
      .input(z.object({
        id: z.number(),
        hasAllergies: z.boolean().optional(),
        allergiesDetails: z.string().optional(),
        hasDiseases: z.boolean().optional(),
        diseasesDetails: z.string().optional(),
        usesMedication: z.boolean().optional(),
        medicationDetails: z.string().optional(),
        isPregnant: z.boolean().optional(),
        hasKeloid: z.boolean().optional(),
        acceptedTerms: z.boolean().optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await db.updateAnamnesisRecord(id, {
          ...data,
          hasAllergies: data.hasAllergies !== undefined ? (data.hasAllergies ? 1 : 0) : undefined,
          hasDiseases: data.hasDiseases !== undefined ? (data.hasDiseases ? 1 : 0) : undefined,
          usesMedication: data.usesMedication !== undefined ? (data.usesMedication ? 1 : 0) : undefined,
          isPregnant: data.isPregnant !== undefined ? (data.isPregnant ? 1 : 0) : undefined,
          hasKeloid: data.hasKeloid !== undefined ? (data.hasKeloid ? 1 : 0) : undefined,
          acceptedTerms: data.acceptedTerms !== undefined ? (data.acceptedTerms ? 1 : 0) : undefined,
        });
        return { success: true };
      }),
    // Excluir ficha manual (painel interno)
    deleteRecord: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteAnamnesisRecord(input.id);
        return { success: true };
      }),
    // Obter submissão por requestId para pré-preencher formulário público
    getSubmissionByRequestId: publicProcedure
      .input(z.object({ requestId: z.number() }))
      .query(async ({ input }) => {
        const submission = await db.getAnamneseSubmissionByRequestId(input.requestId);
        if (!submission) return null;
        return { ...submission, payload: JSON.parse(submission.payloadJson) };
      }),
    // Atualizar submissão via formulário público (cliente edita ficha já preenchida)
    updateSubmissionPublic: publicProcedure
      .input(z.object({
        token: z.string(),
        payload: z.record(z.string(), z.any()),
      }))
      .mutation(async ({ input }) => {
        const request = await db.getAnamneseRequestByToken(input.token);
        if (!request) throw new TRPCError({ code: 'NOT_FOUND', message: 'Link inválido' });
        const submission = await db.getAnamneseSubmissionByRequestId(request.id);
        if (!submission) throw new TRPCError({ code: 'NOT_FOUND', message: 'Ficha não encontrada' });
        await db.updateAnamneseSubmission(submission.id, JSON.stringify(input.payload));
        return { success: true };
      }),
  }),
  // ============ SUPPLIERS ROUTER ============
  suppliers: router({
    list: protectedProcedure
      .input(z.object({ activeOnly: z.boolean().optional().default(true) }))
      .query(async ({ input }) => {
        return await db.listSuppliers(input.activeOnly);
      }),

    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const supplier = await db.getSupplierById(input.id);
        if (!supplier) throw new TRPCError({ code: 'NOT_FOUND', message: 'Fornecedor não encontrado' });
        return supplier;
      }),

    create: protectedProcedure
      .input(z.object({
        name: z.string().min(1),
        cnpj: z.string().optional(),
        contactName: z.string().optional(),
        phone: z.string().optional(),
        whatsapp: z.string().optional(),
        email: z.string().email().optional().or(z.literal('')),
        address: z.string().optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const id = await db.createSupplier(input);
        return { id };
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().min(1).optional(),
        cnpj: z.string().optional(),
        contactName: z.string().optional(),
        phone: z.string().optional(),
        whatsapp: z.string().optional(),
        email: z.string().email().optional().or(z.literal('')),
        address: z.string().optional(),
        notes: z.string().optional(),
        isActive: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await db.updateSupplier(id, data);
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteSupplier(input.id);
        return { success: true };
      }),
  }),

  // ============ STOCK ROUTER ============
  stock: router({
    listMaterials: protectedProcedure
      .input(z.object({ activeOnly: z.boolean().optional().default(true) }))
      .query(async ({ input }) => {
        return await db.listMaterials(input.activeOnly);
      }),

    getLowStock: protectedProcedure.query(async () => {
      return await db.getLowStockMaterials();
    }),

    getMaterial: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const mat = await db.getMaterialById(input.id);
        if (!mat) throw new TRPCError({ code: 'NOT_FOUND', message: 'Material não encontrado' });
        return mat;
      }),

    createMaterial: protectedProcedure
      .input(z.object({
        name: z.string().min(1),
        category: z.string().min(1),
        unit: z.string().min(1),
        currentStock: z.number().min(0).default(0),
        minStock: z.number().min(0).default(0),
        avgPrice: z.number().min(0).default(0),
        supplierId: z.number().optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const id = await db.createMaterial({
          ...input,
          currentStock: String(input.currentStock),
          minStock: String(input.minStock),
          avgPrice: String(input.avgPrice),
        });

        // Sincronizar com Google Sheets
        syncMaterialToSheets({
          id,
          category: input.category,
          model: input.name,
          currentStock: input.currentStock,
          unit: input.unit,
          minStock: input.minStock,
          notes: input.notes,
        });

        return { id };
      }),

    updateMaterial: protectedProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().min(1).optional(),
        category: z.string().optional(),
        unit: z.string().optional(),
        minStock: z.number().min(0).optional(),
        avgPrice: z.number().min(0).optional(),
        supplierId: z.number().optional().nullable(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, minStock, avgPrice, ...rest } = input;
        await db.updateMaterial(id, {
          ...rest,
          ...(minStock !== undefined ? { minStock: String(minStock) } : {}),
          ...(avgPrice !== undefined ? { avgPrice: String(avgPrice) } : {}),
        });

        // Sincronizar com Google Sheets
        const matAfter = await db.getMaterialById(id);
        if (matAfter) {
          syncMaterialToSheets({
            id: matAfter.id,
            category: matAfter.category,
            model: matAfter.name,
            currentStock: matAfter.currentStock ? Number(matAfter.currentStock) : 0,
            unit: matAfter.unit,
            minStock: matAfter.minStock ? Number(matAfter.minStock) : 0,
            notes: matAfter.notes,
          });
        }

        return { success: true };
      }),

    deleteMaterial: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteMaterial(input.id);
        return { success: true };
      }),

    listMovements: protectedProcedure
      .input(z.object({ materialId: z.number().optional(), limit: z.number().optional().default(50) }))
      .query(async ({ input }) => {
        return await db.listStockMovements(input.materialId, input.limit);
      }),

    addMovement: protectedProcedure
      .input(z.object({
        materialId: z.number(),
        type: z.enum(['entrada', 'saida', 'ajuste']),
        quantity: z.number().positive(),
        reason: z.string().optional(),
        reference: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const movResult = await db.addStockMovement({ ...input, createdBy: ctx.user.id });

        // Sincronizar com Google Sheets
        syncStockMovementToSheets({
          id: typeof movResult === 'object' && movResult !== null && 'id' in movResult
            ? (movResult as { id: number }).id
            : 0,
          materialId: input.materialId,
          movementType: input.type,
          quantity: input.quantity,
          reason: input.reason,
          responsible: ctx.user.name || ctx.user.email || 'Sistema',
          createdAt: new Date(),
        });

        return movResult;
      }),

    // ── Pedidos de Orçamento ──
    listOrders: protectedProcedure.query(async () => {
      return await db.listPurchaseOrders();
    }),

    getOrder: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const order = await db.getPurchaseOrderById(input.id);
        if (!order) throw new TRPCError({ code: 'NOT_FOUND', message: 'Pedido não encontrado' });
        return order;
      }),

    createOrder: protectedProcedure
      .input(z.object({
        supplierId: z.number(),
        notes: z.string().optional(),
        items: z.array(z.object({
          materialId: z.number(),
          quantity: z.number().positive(),
          unitPrice: z.number().min(0).optional(),
          notes: z.string().optional(),
        })).min(1),
      }))
      .mutation(async ({ ctx, input }) => {
        const id = await db.createPurchaseOrder({ ...input, createdBy: ctx.user.id });
        return { id };
      }),

    updateOrderStatus: protectedProcedure
      .input(z.object({
        id: z.number(),
        status: z.enum(['rascunho', 'enviado', 'confirmado', 'recebido', 'cancelado']),
      }))
      .mutation(async ({ input }) => {
        await db.updatePurchaseOrderStatus(input.id, input.status);
        return { success: true };
      }),

     deleteOrder: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deletePurchaseOrder(input.id);
        return { success: true };
      }),
    getWhatsAppLink: protectedProcedure
      .input(z.object({ orderId: z.number() }))
      .query(async ({ input }) => {
        const order = await db.getPurchaseOrderById(input.orderId);
        if (!order) throw new TRPCError({ code: 'NOT_FOUND', message: 'Pedido não encontrado' });
        const message = db.buildWhatsAppOrderMessage(order as any);
        const rawPhone = (order.supplierWhatsapp || '').trim();
        const encodedMsg = encodeURIComponent(message);
        const link = rawPhone
          ? `https://wa.me/${normalizeWhatsAppNumber(rawPhone)}?text=${encodedMsg}`
          : `https://wa.me/?text=${encodedMsg}`;
        return { link, message };
      }),
  }),

  // ===== PERCENTUAIS DOS COLABORADORES =====
  collaboratorRates: router({
    // Listar todos os percentuais
    list: protectedProcedure.query(async ({ ctx }) => {
      let studioId = ctx.user.studioId;
      if (!studioId) {
        const firstStudio = await db.getFirstStudio();
        studioId = firstStudio?.id || 1;
      }
      return db.listCollaboratorRates(studioId);
    }),

    // Definir/atualizar percentual de um artista
    upsert: protectedProcedure
      .input(z.object({
        artistId: z.number(),
        percentage: z.number().min(0).max(100),
        notes: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== 'admin' && ctx.user.role !== 'superadmin') {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Apenas administradores podem editar percentuais' });
        }
        let studioId = ctx.user.studioId;
        if (!studioId) {
          const firstStudio = await db.getFirstStudio();
          studioId = firstStudio?.id || 1;
        }
        return db.upsertCollaboratorRate({ studioId, ...input });
      }),
  }),

  // ===== RELATÓRIOS FINANCEIROS POR COLABORADOR =====
  collaboratorReports: router({
    // Relatório de um colaborador por período
    byPeriod: artistProcedure
      .input(z.object({
        artistName: z.string(),
        period: z.enum(['daily', 'weekly', 'monthly', 'annual']),
        referenceDate: z.string().optional(), // YYYY-MM-DD
      }))
      .query(async ({ ctx, input }) => {
        let studioId = ctx.studioId;
        if (!studioId) {
          const firstStudio = await db.getFirstStudio();
          studioId = firstStudio?.id || 1;
        }
        if (ctx.artistId != null) {
          const artist = await db.getArtistById(ctx.artistId, studioId);
          if (!artist) throw new TRPCError({ code: "FORBIDDEN", message: "Artista não disponível para este usuário." });
          return db.getCollaboratorReport(studioId, artist.name, input.period, input.referenceDate);
        }
        return db.getCollaboratorReport(studioId, input.artistName, input.period, input.referenceDate);
      }),

    // Relatório geral de todos os colaboradores
    summary: artistProcedure
      .input(z.object({
        period: z.enum(['daily', 'weekly', 'monthly', 'annual']),
        referenceDate: z.string().optional(),
      }))
      .query(async ({ ctx, input }) => {
        let studioId = ctx.studioId;
        if (!studioId) {
          const firstStudio = await db.getFirstStudio();
          studioId = firstStudio?.id || 1;
        }
        return db.getCollaboratorsSummary(studioId, input.period, input.referenceDate, ctx.artistId);
      }),
  }),

   // ============ CONTACTS IMPORT/EXPORT ROUTER ============
  contacts: contactsRouter,
  // ============ POD SESSION — EXECUÇÃO TÉCNICA ============
  procedures: proceduresRouter,
  // ============ POD SESSION SaaS — CATÁLOGO, ESTOQUE E AUDITORIA ============
  pod: podSaasRouter,
  // ============ CENTRAL DE MENSAGENS / WHATSAPP ============
  messaging: messagingRouter,
});
export type AppRouter = typeof appRouter;
