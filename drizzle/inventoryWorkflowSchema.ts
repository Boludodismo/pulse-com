import {
  mysqlTable,
  int,
  varchar,
  text,
  decimal,
  datetime,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/mysql-core";
import { sql } from "drizzle-orm";

export const inventoryLoans = mysqlTable(
  "inventory_loans",
  {
    id: int().autoincrement().primaryKey(),
    studioId: int().notNull(),
    requestKey: varchar({ length: 36 }).notNull(),
    lenderArtistId: int(),
    borrowerArtistId: int().notNull(),
    appointmentId: int(),
    sourceMaterialId: int().notNull(),
    sourceBatchId: int(),
    receivedMaterialId: int(),
    receivedBatchId: int(),
    materialName: varchar({ length: 255 }).notNull(),
    unit: varchar({ length: 50 }).notNull(),
    specification: text().notNull(),
    quantityRequested: decimal({ precision: 12, scale: 3 }).notNull(),
    quantityApproved: decimal({ precision: 12, scale: 3 }),
    quantitySettled: decimal({ precision: 12, scale: 3 })
      .default("0")
      .notNull(),
    status: varchar({ length: 24 }).default("requested").notNull(),
    dueAt: datetime({ mode: "string" }),
    reminderHours: int().default(24).notNull(),
    notes: text(),
    decisionNotes: text(),
    createdByUserId: int().notNull(),
    approvedByUserId: int(),
    deliveredByUserId: int(),
    approvedAt: datetime({ mode: "string" }),
    deliveredAt: datetime({ mode: "string" }),
    settledAt: datetime({ mode: "string" }),
    createdAt: timestamp({ mode: "string" })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  t => [
    uniqueIndex("inventory_loan_request_unique").on(t.studioId, t.requestKey),
    uniqueIndex("inventory_loan_received_unique").on(
      t.studioId,
      t.receivedMaterialId
    ),
    index("inventory_loan_due_idx").on(t.status, t.dueAt),
    index("inventory_loan_parties_idx").on(
      t.studioId,
      t.borrowerArtistId,
      t.lenderArtistId
    ),
  ]
);

export const inventoryLoanEvents = mysqlTable(
  "inventory_loan_events",
  {
    id: int().autoincrement().primaryKey(),
    studioId: int().notNull(),
    loanId: int().notNull(),
    operationKey: varchar({ length: 36 }).notNull(),
    kind: varchar({ length: 32 }).notNull(),
    quantity: decimal({ precision: 12, scale: 3 }),
    sourceMaterialId: int(),
    sourceBatchId: int(),
    targetBatchId: int(),
    notes: text(),
    createdByUserId: int().notNull(),
    createdAt: timestamp({ mode: "string" })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  t => [
    uniqueIndex("inventory_loan_event_unique").on(t.studioId, t.operationKey),
    index("inventory_loan_event_idx").on(t.studioId, t.loanId, t.id),
  ]
);

export const inventoryNotices = mysqlTable(
  "inventory_notices",
  {
    id: int().autoincrement().primaryKey(),
    studioId: int().notNull(),
    recipientArtistId: int(),
    recipientKey: varchar({ length: 40 }).notNull(),
    eventKey: varchar({ length: 180 }).notNull(),
    kind: varchar({ length: 32 }).notNull(),
    severity: varchar({ length: 12 }).notNull(),
    appointmentId: int(),
    materialId: int(),
    loanId: int(),
    title: varchar({ length: 255 }).notNull(),
    message: text().notNull(),
    readAt: datetime({ mode: "string" }),
    resolvedAt: datetime({ mode: "string" }),
    deliveryStatus: varchar({ length: 24 }).default("pending").notNull(),
    attempts: int().default(0).notNull(),
    lastError: varchar({ length: 500 }),
    nextAttemptAt: datetime({ mode: "string" }),
    createdAt: timestamp({ mode: "string" })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  t => [
    uniqueIndex("inventory_notice_event_unique").on(
      t.studioId,
      t.recipientKey,
      t.eventKey
    ),
    index("inventory_notice_recipient_idx").on(
      t.studioId,
      t.recipientKey,
      t.id
    ),
    index("inventory_notice_delivery_idx").on(
      t.deliveryStatus,
      t.nextAttemptAt
    ),
  ]
);

export const inventoryAlertPreferences = mysqlTable(
  "inventory_alert_preferences",
  {
    id: int().autoincrement().primaryKey(),
    studioId: int().notNull(),
    recipientKey: varchar({ length: 40 }).notNull(),
    leadHours: int().default(48).notNull(),
    whatsappEnabled: int().default(0).notNull(),
    whatsappOptedInAt: datetime({ mode: "string" }),
    updatedByUserId: int().notNull(),
  },
  t => [
    uniqueIndex("inventory_alert_preference_unique").on(
      t.studioId,
      t.recipientKey
    ),
  ]
);
