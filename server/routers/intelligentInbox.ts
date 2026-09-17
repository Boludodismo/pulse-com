import { z } from "zod";
import { router, tenantProcedure } from "../_core/trpc";
import { assertPrivateInboxOwner } from "../intelligentInbox/access";
import { INBOX_MODULES } from "../../shared/intelligentInbox";
import {
  inboxStatus,
  readonlyInboxStatus,
  inboxDashboard,
  listInboxConversations,
  listInboxMessages,
  inboxSettings,
  disabledInboxOperation,
} from "../intelligentInbox/service";
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
const privateInboxProcedure = tenantProcedure.use(({ ctx, next }) => {
  assertPrivateInboxOwner(ctx.user);
  return next({ ctx });
});
export const intelligentInboxRouter = router({
  access: privateInboxProcedure.query(async ({ ctx }) => {
    return {
      studioId: ctx.studioId,
      permissions: INBOX_MODULES.map(module => ({
        module,
        canRead: true,
        canWrite: false,
      })),
    };
  }),
  status: privateInboxProcedure.query(({ ctx }) => readonlyInboxStatus(ctx.studioId, ctx.user.id)),
  dashboard: privateInboxProcedure.query(({ ctx }) => inboxDashboard(ctx.studioId, ctx.user.id)),
  conversations: privateInboxProcedure
    .input(page)
    .query(({ ctx, input }) => listInboxConversations(ctx.studioId, ctx.user.id, input)),
  messages: privateInboxProcedure
    .input(
      z.strictObject({
        conversationId: z.number().int().positive(),
        limit: z.number().int().min(1).max(100).default(25),
        cursor: z.number().int().positive().optional(),
      })
    )
    .query(({ ctx, input }) => listInboxMessages(ctx.studioId, ctx.user.id, input.conversationId, input.limit, input.cursor)),
  summaries: privateInboxProcedure
    .input(page)
    .query(() => emptyPage()),
  priorities: privateInboxProcedure
    .input(page)
    .query(() => emptyPage()),
  opportunities: privateInboxProcedure
    .input(page)
    .query(() => emptyPage()),
  clientContext: privateInboxProcedure
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
  settings: privateInboxProcedure.query(({ ctx }) => inboxSettings(ctx.studioId, ctx.user.id)),
  configure: privateInboxProcedure.mutation(async ({ ctx }) => {
    return disabledInboxOperation();
  }),
  suggestedReply: privateInboxProcedure
    .input(z.strictObject({ conversationId: z.number().int().positive() }))
    .query(() => ({ reply: null, status: inboxStatus() })),
  generateSuggestedReply: privateInboxProcedure
    .input(z.strictObject({ conversationId: z.number().int().positive() }))
    .mutation(async ({ ctx }) => {
      return disabledInboxOperation();
    }),
});
