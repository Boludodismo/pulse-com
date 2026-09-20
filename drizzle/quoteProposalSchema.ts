import {
  mysqlTable,
  int,
  varchar,
  text,
  datetime,
  timestamp,
  tinyint,
  index,
  uniqueIndex,
} from "drizzle-orm/mysql-core";

export const quoteProposals = mysqlTable("quote_proposals", {
  id: int().autoincrement().primaryKey(),
  studioId: int("studio_id").notNull(),
  clientId: int("client_id").notNull(),
  artistId: int("artist_id").notNull(),
  quoteNumber: varchar("quote_number", { length: 48 }).notNull(),
  version: int().notNull().default(1),
  status: varchar({ length: 24 }).notNull().default("draft"),
  createdDate: datetime("created_date", { mode: "string" }).notNull(),
  validUntil: datetime("valid_until", { mode: "string" }).notNull(),
  totalAmount: int("total_amount").notNull().default(0),
  payload: text().notNull(),
  publicToken: varchar("public_token", { length: 64 }),
  viewedAt: datetime("viewed_at", { mode: "string" }),
  acceptedAt: datetime("accepted_at", { mode: "string" }),
  createdByUserId: int("created_by_user_id").notNull(),
  finalizedAt: datetime("finalized_at", { mode: "string" }),
  createdAt: timestamp("created_at", { mode: "string" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "string" }).defaultNow().onUpdateNow().notNull(),
}, (table) => [
  uniqueIndex("quote_proposals_number_version_unique").on(table.studioId, table.quoteNumber, table.version),
  uniqueIndex("quote_proposals_public_token_unique").on(table.publicToken),
  index("quote_proposals_studio_updated_idx").on(table.studioId, table.updatedAt),
  index("quote_proposals_client_idx").on(table.studioId, table.clientId, table.id),
  index("quote_proposals_artist_idx").on(table.studioId, table.artistId, table.id),
]);

export const quotePresets = mysqlTable("quote_presets", {
  id: int().autoincrement().primaryKey(),
  studioId: int("studio_id").notNull(),
  artistId: int("artist_id"),
  category: varchar({ length: 32 }).notNull(),
  name: varchar({ length: 120 }).notNull(),
  content: text().notNull(),
  isActive: tinyint("is_active").notNull().default(1),
  createdByUserId: int("created_by_user_id").notNull(),
  createdAt: timestamp("created_at", { mode: "string" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "string" }).defaultNow().onUpdateNow().notNull(),
}, (table) => [
  index("quote_presets_studio_category_idx").on(table.studioId, table.category, table.isActive),
  index("quote_presets_artist_idx").on(table.studioId, table.artistId, table.category),
]);

export const artistQuoteBranding = mysqlTable("artist_quote_branding", {
  id: int().autoincrement().primaryKey(),
  studioId: int("studio_id").notNull(),
  artistId: int("artist_id").notNull(),
  personalLogoUrl: varchar("personal_logo_url", { length: 3000 }),
  personalLogoKey: varchar("personal_logo_key", { length: 500 }),
  defaultLogoSource: varchar("default_logo_source", { length: 16 }).notNull().default("studio"),
  watermarkOpacity: int("watermark_opacity").notNull().default(70),
  createdAt: timestamp("created_at", { mode: "string" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "string" }).defaultNow().onUpdateNow().notNull(),
}, (table) => [
  uniqueIndex("artist_quote_branding_artist_unique").on(table.studioId, table.artistId),
]);
