import type { InboxModule } from "../../shared/intelligentInbox";
/** Tenant is supplied by authenticated server context, never a webhook or client payload. */
export interface InboxScope {
  studioId: number;
  userId: number;
  artistId?: number | null;
}
export interface InboxPage {
  limit: number;
  cursor?: number;
}
export interface ConversationFilters extends InboxPage {
  search?: string;
  classification?: string;
  priority?: string;
  artistId?: number;
  attendantUserId?: number;
  after?: string;
  before?: string;
  clientId?: number;
}
export interface NormalizedExternalMessage {
  externalContactId: string;
  externalConversationId: string;
  externalMessageId: string;
  messageType: string;
  direction: string;
  actor: string;
  textContent?: string;
  mediaReference?: string;
  messageAt: string;
}
export interface BotConversaAdapter {
  readIncremental(
    scope: InboxScope,
    cursor: string | null
  ): Promise<{
    messages: NormalizedExternalMessage[];
    nextCursor: string | null;
  }>;
  validateWebhook(
    scope: InboxScope,
    rawBody: Uint8Array,
    signature: string
  ): Promise<boolean>;
}
export interface AnalysisService {
  analyze(
    scope: InboxScope,
    conversationId: number,
    afterMessageId: number
  ): Promise<void>;
}
export interface SummaryService {
  summarizeWindow(scope: InboxScope, start: string, end: string): Promise<void>;
}
export interface SuggestedReplyService {
  suggest(scope: InboxScope, conversationId: number): Promise<string>;
}
export interface ChatGptSummaryExport {
  exportAuthorizedSummary(scope: InboxScope, summaryId: number): Promise<void>;
}
export interface InboxRepository {
  listConversations(
    scope: InboxScope,
    filters: ConversationFilters
  ): Promise<{ items: unknown[]; nextCursor: number | null }>;
  listMessages(
    scope: InboxScope,
    conversationId: number,
    page: InboxPage
  ): Promise<{ items: NormalizedExternalMessage[]; nextCursor: number | null }>;
  /** Implementation MUST validate clients, artists, users and integration IDs against scope.studioId. */
  ingestIdempotently(
    scope: InboxScope,
    syncStateId: number,
    messages: NormalizedExternalMessage[]
  ): Promise<void>;
}
export type InboxPermission = {
  module: InboxModule;
  canRead: boolean;
  canWrite: boolean;
};
// Interfaces only: no concrete adapters, timers, workers or external SDKs are imported.
