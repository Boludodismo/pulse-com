import {
  mysqlTable,
  int,
  varchar,
  decimal,
  datetime,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/mysql-core";
import { sql } from "drizzle-orm";

export const procedureColorSamples = mysqlTable(
  "procedure_color_samples",
  {
    id: int().autoincrement().primaryKey(),
    studioId: int().notNull(),
    procedureId: int().notNull(),
    clientId: int().notNull(),
    artistId: int(),
    code: varchar({ length: 16 }).notNull(),
    hex: varchar({ length: 9 }).notNull(),
    red: int().notNull(),
    green: int().notNull(),
    blue: int().notNull(),
    cyan: int().notNull(),
    magenta: int().notNull(),
    yellow: int().notNull(),
    black: int().notNull(),
    xPct: decimal({ precision: 7, scale: 4 }).notNull(),
    yPct: decimal({ precision: 7, scale: 4 }).notNull(),
    sampleSize: int().default(5).notNull(),
    createdByUserId: int().notNull(),
    createdAt: timestamp({ mode: "string" })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  t => [
    uniqueIndex("procedure_color_sample_code_unique").on(
      t.studioId,
      t.procedureId,
      t.code
    ),
    index("procedure_color_samples_procedure_idx").on(
      t.studioId,
      t.procedureId,
      t.id
    ),
  ]
);

export const procedureInkRecipes = mysqlTable(
  "procedure_ink_recipes",
  {
    id: int().autoincrement().primaryKey(),
    studioId: int().notNull(),
    procedureId: int().notNull(),
    clientId: int().notNull(),
    artistId: int(),
    sampleId: int(),
    code: varchar({ length: 16 }).notNull(),
    cupSize: varchar({ length: 8 }).notNull(),
    cupCapacityMl: decimal({ precision: 8, scale: 3 }).notNull(),
    dropsPerMl: decimal({ precision: 8, scale: 3 }).notNull(),
    totalDrops: int().notNull(),
    estimatedMl: decimal({ precision: 8, scale: 3 }).notNull(),
    cupTenantMaterialId: int(),
    cupConsumptionId: int(),
    status: varchar({ length: 16 }).default("active").notNull(),
    createdByUserId: int().notNull(),
    revertedAt: datetime({ mode: "string" }),
    createdAt: timestamp({ mode: "string" })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  t => [
    uniqueIndex("procedure_ink_recipe_code_unique").on(
      t.studioId,
      t.procedureId,
      t.code
    ),
    index("procedure_ink_recipes_procedure_idx").on(
      t.studioId,
      t.procedureId,
      t.id
    ),
    index("procedure_ink_recipes_sample_idx").on(
      t.studioId,
      t.sampleId
    ),
  ]
);

export const procedureInkRecipeItems = mysqlTable(
  "procedure_ink_recipe_items",
  {
    id: int().autoincrement().primaryKey(),
    studioId: int().notNull(),
    recipeId: int().notNull(),
    tenantMaterialId: int().notNull(),
    consumptionId: int().notNull(),
    batchId: int(),
    nameSnapshot: varchar({ length: 255 }).notNull(),
    brandSnapshot: varchar({ length: 120 }),
    lotSnapshot: varchar({ length: 120 }),
    expiresAtSnapshot: datetime({ mode: "string" }),
    drops: int().notNull(),
    estimatedMl: decimal({ precision: 8, scale: 3 }).notNull(),
    percentage: decimal({ precision: 7, scale: 3 }).notNull(),
    createdAt: timestamp({ mode: "string" })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  t => [
    index("procedure_ink_recipe_items_recipe_idx").on(
      t.studioId,
      t.recipeId,
      t.id
    ),
    index("procedure_ink_recipe_items_consumption_idx").on(
      t.studioId,
      t.consumptionId
    ),
  ]
);
