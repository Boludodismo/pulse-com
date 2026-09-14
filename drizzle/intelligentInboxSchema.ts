import {
  mysqlTable,
  int,
  varchar,
  text,
  datetime,
  timestamp,
  index,
  uniqueIndex,
  foreignKey,
} from "drizzle-orm/mysql-core";

export const inboxSyncState = mysqlTable(
  "inbox_sync_state",
  {
    id: int().autoincrement().primaryKey(),
    studioId: int("studio_id").notNull(),
    integrationId: int("integration_id"),
    name: varchar("name", { length: 255 }),
    provider: varchar("provider", { length: 40 })
      .notNull()
      .default("botconversa"),
    externalId: varchar("external_id", { length: 255 }),
    status: varchar("status", { length: 40 })
      .notNull()
      .default("not_configured"),
    connectedAt: datetime("connected_at", { mode: "string" }),
    webhookConfigured: int("webhook_configured").notNull().default(0),
    syncEnabled: int("sync_enabled").notNull().default(0),
    summaryEnabled: int("summary_enabled").notNull().default(0),
    summaryIntervalMinutes: int("summary_interval_minutes")
      .notNull()
      .default(60),
    lastSyncAt: datetime("last_sync_at", { mode: "string" }),
    lastProcessedAt: datetime("last_processed_at", { mode: "string" }),
    lastMessageAt: datetime("last_message_at", { mode: "string" }),
    lastSummaryAt: datetime("last_summary_at", { mode: "string" }),
    syncStatus: varchar("sync_status", { length: 40 })
      .notNull()
      .default("disabled"),
    syncCursor: text("sync_cursor"),
    externalCursor: text("external_cursor"),
    errorCount: int("error_count").notNull().default(0),
    lastError: text("last_error"),
    createdAt: timestamp("created_at", { mode: "string" })
      .defaultNow()
      .notNull(),
  },
  t => [
    uniqueIndex("inbox_sync_studio_id").on(t.studioId, t.id),
    index("inbox_sync_connection").on(t.studioId, t.integrationId),
  ]
);
export const inboxConversations = mysqlTable(
  "inbox_conversations",
  {
    id: int().autoincrement().primaryKey(),
    studioId: int("studio_id").notNull(),
    syncStateId: int("sync_state_id").notNull(),
    clientId: int("client_id"),
    integrationContactId: int("integration_contact_id"),
    externalContactId: varchar("external_contact_id", { length: 255 }),
    externalConversationId: varchar("external_conversation_id", {
      length: 191,
    }).notNull(),
    clientName: varchar("client_name", { length: 255 }),
    phone: varchar("phone", { length: 32 }),
    source: varchar("source", { length: 80 }),
    channel: varchar("channel", { length: 80 }),
    artistId: int("artist_id"),
    attendantUserId: int("attendant_user_id"),
    lastInteractionAt: datetime("last_interaction_at", { mode: "string" }),
    status: varchar("status", { length: 40 }).notNull().default("open"),
    priority: varchar("priority", { length: 20 }).notNull().default("NORMAL"),
    classification: varchar("classification", { length: 80 })
      .notNull()
      .default("other"),
    waitingSince: datetime("waiting_since", { mode: "string" }),
    waitingSeconds: int("waiting_seconds").notNull().default(0),
    summary: text("summary"),
    purchaseIntent: varchar("purchase_intent", { length: 40 })
      .notNull()
      .default("UNKNOWN"),
    pendingActions: text("pending_actions"),
    nextRecommendedAction: text("next_recommended_action"),
    suggestedReply: text("suggested_reply"),
    analyzedMessageCount: int("analyzed_message_count").notNull().default(0),
    lastSummaryAt: datetime("last_summary_at", { mode: "string" }),
    lastProcessedAt: datetime("last_processed_at", { mode: "string" }),
    processingStatus: varchar("processing_status", { length: 40 })
      .notNull()
      .default("disabled"),
    createdAt: timestamp("created_at", { mode: "string" })
      .defaultNow()
      .notNull(),
  },
  t => [
    uniqueIndex("inbox_conversation_studio_id").on(t.studioId, t.id),
    uniqueIndex("inbox_conversation_external").on(
      t.studioId,
      t.syncStateId,
      t.externalConversationId
    ),
    index("inbox_conversation_activity").on(
      t.studioId,
      t.lastInteractionAt,
      t.id
    ),
    index("inbox_conversation_priority").on(
      t.studioId,
      t.status,
      t.priority,
      t.id
    ),
    index("inbox_conversation_classification").on(
      t.studioId,
      t.classification,
      t.id
    ),
    index("inbox_conversation_client").on(t.studioId, t.clientId, t.id),
    index("inbox_conversation_artist").on(t.studioId, t.artistId, t.id),
    index("inbox_conversation_attendant").on(
      t.studioId,
      t.attendantUserId,
      t.id
    ),
    index("inbox_conversation_phone").on(t.studioId, t.phone),
    foreignKey({
      name: "inbox_conversation_sync_fk",
      columns: [t.studioId, t.syncStateId],
      foreignColumns: [inboxSyncState.studioId, inboxSyncState.id],
    }),
  ]
);
export const inboxMessages = mysqlTable(
  "inbox_messages",
  {
    id: int().autoincrement().primaryKey(),
    studioId: int("studio_id").notNull(),
    conversationId: int("conversation_id").notNull(),
    externalMessageId: varchar("external_message_id", {
      length: 191,
    }).notNull(),
    messageType: varchar("message_type", { length: 40 })
      .notNull()
      .default("text"),
    direction: varchar("direction", { length: 20 })
      .notNull()
      .default("inbound"),
    actor: varchar("actor", { length: 40 }).notNull().default("customer"),
    textContent: text("text_content"),
    mediaReference: text("media_reference"),
    metadata: text("metadata"),
    messageAt: datetime("message_at", { mode: "string" }),
    processedAt: datetime("processed_at", { mode: "string" }),
    processingStatus: varchar("processing_status", { length: 40 })
      .notNull()
      .default("disabled"),
    createdAt: timestamp("created_at", { mode: "string" })
      .defaultNow()
      .notNull(),
  },
  t => [
    uniqueIndex("inbox_message_external").on(
      t.studioId,
      t.conversationId,
      t.externalMessageId
    ),
    index("inbox_message_page").on(
      t.studioId,
      t.conversationId,
      t.messageAt,
      t.id
    ),
    index("inbox_message_pending").on(t.studioId, t.processingStatus, t.id),
    foreignKey({
      name: "inbox_messages_conversation_fk",
      columns: [t.studioId, t.conversationId],
      foreignColumns: [inboxConversations.studioId, inboxConversations.id],
    }),
  ]
);
export const inboxSummaries = mysqlTable(
  "inbox_summaries",
  {
    id: int().autoincrement().primaryKey(),
    studioId: int("studio_id").notNull(),
    conversationId: int("conversation_id"),
    scopeKey: varchar("scope_key", { length: 100 }).notNull(),
    windowStart: datetime("window_start", { mode: "string" }).notNull(),
    windowEnd: datetime("window_end", { mode: "string" }).notNull(),
    summary: text("summary"),
    metrics: text("metrics"),
    analysis: text("analysis"),
    analyzedMessageCount: int("analyzed_message_count").notNull().default(0),
    lastMessageId: int("last_message_id"),
    processingStatus: varchar("processing_status", { length: 40 })
      .notNull()
      .default("disabled"),
    analysisVersion: varchar("analysis_version", { length: 80 }),
    lastError: text("last_error"),
    processedAt: datetime("processed_at", { mode: "string" }),
    createdAt: timestamp("created_at", { mode: "string" })
      .defaultNow()
      .notNull(),
  },
  t => [
    uniqueIndex("inbox_summary_window").on(
      t.studioId,
      t.scopeKey,
      t.windowStart,
      t.windowEnd
    ),
    index("inbox_summary_history").on(t.studioId, t.windowEnd, t.id),
    index("inbox_summary_conversation").on(t.studioId, t.conversationId, t.id),
    foreignKey({
      name: "inbox_summaries_conversation_fk",
      columns: [t.studioId, t.conversationId],
      foreignColumns: [inboxConversations.studioId, inboxConversations.id],
    }),
  ]
);
