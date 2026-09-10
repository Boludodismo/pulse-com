import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, tenantProcedure } from "../_core/trpc";
import { hasModulePermission, listUserPermissions } from "../saas";
import { INBOX_MODULES, type InboxModule } from "../../shared/intelligentInbox";
import {
  inboxStatus,
  readonlyInboxStatus,
  inboxDashboard,
  listInboxConversations,
  listInboxMessages,
  inboxSettings,
  disabledInboxOperation,
} from "../intelligentInbox/service";
async function permit(ctx: any, module: InboxModule, write = false) {
  if (ctx.user.role === "admin" || ctx.user.role === "superadmin") return;
  if (
    ctx.user.role !== "collaborator" ||
    !(await hasModulePermission({
      userId: ctx.user.id,
      studioId: ctx.studioId,
      module,
      write,
    }))
  )
    throw new TRPCError({
      code: "FORBIDDEN",
      message:
        "Você não tem permissão para acessar esta área da Central Inteligente.",
    });
}
const page = z.strictObject({
  limit: z.number().int().min(1).max(100).default(25),
  cursor: z.number().int().positive().optional(),
  search: z.string().trim().max(150).optional(),
  classification: z.string().max(80).optional(),
  priority: z.string().max(20).optional(),
  artistId: z.number().int().positive().optional(),
  attendantUserId: z.number().int().positive().optional(),
  clientId: z.number().int().positive().optional(),
  after: z.iso.datetime().optional(),
  before: z.iso.datetime().optional(),
});
const emptyPage = () => ({
  items: [],
  nextCursor: null,
  status: inboxStatus(),
});
const read = (module: InboxModule) =>
  tenantProcedure.use(async ({ ctx, next }) => {
    await permit(ctx, "intelligent_inbox");
    if (module !== "intelligent_inbox") await permit(ctx, module);
    return next({ ctx });
  });
export const intelligentInboxRouter = router({
  access: tenantProcedure.query(async ({ ctx }) => {
    const manager = ["admin", "superadmin"].includes(ctx.user.role);
    const permissions = manager
      ? []
      : await listUserPermissions(ctx.user.id, ctx.studioId);
    return {
      studioId: ctx.studioId,
      permissions: INBOX_MODULES.map(module => ({
        module,
        canRead:
          manager || permissions.some(p => p.module === module && !!p.canRead),
        canWrite:
          manager || permissions.some(p => p.module === module && !!p.canWrite),
      })),
    };
  }),
  status: read("intelligent_inbox").query(({ ctx }) => readonlyInboxStatus(ctx.studioId)),
  dashboard: read("intelligent_inbox").query(({ ctx }) => inboxDashboard(ctx.studioId)),
  conversations: read("inbox_conversations")
    .input(page)
    .query(({ ctx, input }) => listInboxConversations(ctx.studioId, input)),
  messages: read("inbox_conversations")
    .input(
      z.strictObject({
        conversationId: z.number().int().positive(),
        limit: z.number().int().min(1).max(100).default(25),
        cursor: z.number().int().positive().optional(),
      })
    )
    .query(({ ctx, input }) => listInboxMessages(ctx.studioId, input.conversationId, input.limit, input.cursor)),
  summaries: read("inbox_summaries")
    .input(page)
    .query(() => emptyPage()),
  priorities: read("inbox_priorities")
    .input(page)
    .query(() => emptyPage()),
  opportunities: read("inbox_opportunities")
    .input(page)
    .query(() => emptyPage()),
  clientContext: read("inbox_conversations")
    .input(z.strictObject({ clientId: z.number().int().positive() }))
    .query(() => ({
      ...emptyPage(),
      currentSummary: null,
      lastInteractionAt: null,
      waitingSince: null,
      classification: null,
      priority: null,
      purchaseIntent: null,
      pendingActions: [],
      nextRecommendedAction: null,
    })),
  settings: read("inbox_settings").query(({ ctx }) => inboxSettings(ctx.studioId)),
  configure: read("inbox_settings").mutation(async ({ ctx }) => {
    await permit(ctx, "inbox_settings", true);
    return disabledInboxOperation();
  }),
  suggestedReply: read("inbox_suggestions")
    .input(z.strictObject({ conversationId: z.number().int().positive() }))
    .query(() => ({ reply: null, status: inboxStatus() })),
  generateSuggestedReply: read("inbox_suggestions")
    .input(z.strictObject({ conversationId: z.number().int().positive() }))
    .mutation(async ({ ctx }) => {
      await permit(ctx, "inbox_suggestions", true);
      return disabledInboxOperation();
    }),
});
