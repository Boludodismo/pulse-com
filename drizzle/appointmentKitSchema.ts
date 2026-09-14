import {
  int,
  mysqlTable,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";
import { sql } from "drizzle-orm";

export const appointmentMaterialKits = mysqlTable(
  "appointment_material_kits",
  {
    id: int().autoincrement().primaryKey(),
    studioId: int().notNull(),
    appointmentId: int().notNull(),
    name: varchar({ length: 160 }).notNull(),
    createdByUserId: int().notNull(),
    createdAt: timestamp({ mode: "string" })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: timestamp({ mode: "string" })
      .defaultNow()
      .onUpdateNow()
      .notNull(),
  },
  t => [
    uniqueIndex("appointment_material_kit_unique").on(
      t.studioId,
      t.appointmentId
    ),
  ]
);

export const appointmentKitOperations = mysqlTable(
  "appointment_kit_operations",
  {
    id: int().autoincrement().primaryKey(),
    studioId: int().notNull(),
    appointmentId: int().notNull(),
    operationKey: varchar({ length: 36 }).notNull(),
    payloadHash: varchar({ length: 64 }).notNull(),
    kind: varchar({ length: 32 }).notNull(),
    createdByUserId: int().notNull(),
    createdAt: timestamp({ mode: "string" })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  t => [
    uniqueIndex("appointment_kit_operation_unique").on(
      t.studioId,
      t.operationKey
    ),
  ]
);

export const inventoryMaterialRegistrations = mysqlTable(
  "inventory_material_registrations",
  {
    id: int().autoincrement().primaryKey(),
    studioId: int().notNull(),
    registrationKey: varchar({ length: 36 }).notNull(),
    payloadHash: varchar({ length: 64 }).notNull(),
    tenantMaterialId: int().notNull(),
    createdByUserId: int().notNull(),
    createdAt: timestamp({ mode: "string" })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  t => [
    uniqueIndex("inventory_material_registration_unique").on(
      t.studioId,
      t.registrationKey
    ),
  ]
);
