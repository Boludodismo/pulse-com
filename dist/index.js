var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// shared/const.ts
function normalizeWhatsAppNumber(phone) {
  let digits = phone.replace(/\D/g, "");
  if (digits.startsWith("55") && digits.length >= 12 && digits.length <= 13) {
    return digits;
  }
  if (digits.startsWith("55") && digits.length < 12) {
    digits = digits.slice(2);
  }
  if (digits.length === 10) {
    const ddd = digits.slice(0, 2);
    const num = digits.slice(2);
    if (["6", "7", "8", "9"].includes(num[0])) {
      return `55${ddd}9${num}`;
    }
    return `55${digits}`;
  }
  if (digits.length === 11) {
    return `55${digits}`;
  }
  return `55${digits}`;
}
var COOKIE_NAME, ONE_YEAR_MS, AXIOS_TIMEOUT_MS, UNAUTHED_ERR_MSG, NOT_ADMIN_ERR_MSG;
var init_const = __esm({
  "shared/const.ts"() {
    "use strict";
    COOKIE_NAME = "app_session_id";
    ONE_YEAR_MS = 1e3 * 60 * 60 * 24 * 365;
    AXIOS_TIMEOUT_MS = 3e4;
    UNAUTHED_ERR_MSG = "Please login (10001)";
    NOT_ADMIN_ERR_MSG = "You do not have required permission (10002)";
  }
});

// drizzle/schema.ts
var schema_exports = {};
__export(schema_exports, {
  anamneseRequests: () => anamneseRequests,
  anamneseSubmissions: () => anamneseSubmissions,
  anamnesisRecords: () => anamnesisRecords,
  appointmentActionAlerts: () => appointmentActionAlerts,
  appointmentActionLinks: () => appointmentActionLinks,
  appointmentPlannedMaterials: () => appointmentPlannedMaterials,
  appointmentReminders: () => appointmentReminders,
  appointments: () => appointments,
  artists: () => artists,
  auditLogs: () => auditLogs,
  calendars: () => calendars,
  clientNotes: () => clientNotes,
  clients: () => clients,
  collaboratorRates: () => collaboratorRates,
  galleryImages: () => galleryImages,
  integrationContacts: () => integrationContacts,
  integrationEvents: () => integrationEvents,
  integrationJobs: () => integrationJobs,
  integrationSchedules: () => integrationSchedules,
  materialCatalogCategories: () => materialCatalogCategories,
  materialCatalogItems: () => materialCatalogItems,
  materials: () => materials,
  messageAutomationSettings: () => messageAutomationSettings,
  messageQueue: () => messageQueue,
  messageTemplates: () => messageTemplates,
  notificationLogs: () => notificationLogs,
  passwordResetTokens: () => passwordResetTokens,
  procedureConsumables: () => procedureConsumables,
  procedureEvents: () => procedureEvents,
  procedureImages: () => procedureImages,
  procedureInventoryConsumptions: () => procedureInventoryConsumptions,
  procedurePauses: () => procedurePauses,
  purchaseOrderItems: () => purchaseOrderItems,
  purchaseOrders: () => purchaseOrders,
  reportTemplates: () => reportTemplates,
  stockMovements: () => stockMovements,
  studioInvitations: () => studioInvitations,
  studioSettings: () => studioSettings,
  studios: () => studios,
  suppliers: () => suppliers,
  technicalProcedures: () => technicalProcedures,
  tenantInventoryMovements: () => tenantInventoryMovements,
  tenantMaterials: () => tenantMaterials,
  transactions: () => transactions,
  userModulePermissions: () => userModulePermissions,
  users: () => users,
  whatsappIntegrations: () => whatsappIntegrations
});
import { mysqlTable, index, uniqueIndex, int, bigint, varchar, mysqlEnum, timestamp, datetime, text, tinyint, decimal } from "drizzle-orm/mysql-core";
import { sql } from "drizzle-orm";
var anamneseRequests, anamneseSubmissions, anamnesisRecords, appointments, artists, auditLogs, calendars, clientNotes, clients, galleryImages, notificationLogs, reportTemplates, studioSettings, studios, transactions, users, studioInvitations, userModulePermissions, suppliers, materials, stockMovements, materialCatalogCategories, materialCatalogItems, tenantMaterials, tenantInventoryMovements, appointmentPlannedMaterials, procedurePauses, procedureInventoryConsumptions, purchaseOrders, purchaseOrderItems, appointmentReminders, appointmentActionLinks, appointmentActionAlerts, collaboratorRates, passwordResetTokens, technicalProcedures, procedureConsumables, procedureImages, procedureEvents, whatsappIntegrations, messageTemplates, messageAutomationSettings, messageQueue, integrationContacts, integrationJobs, integrationEvents, integrationSchedules;
var init_schema = __esm({
  "drizzle/schema.ts"() {
    "use strict";
    anamneseRequests = mysqlTable(
      "anamnese_requests",
      {
        id: int().autoincrement().notNull(),
        clientId: int().notNull(),
        appointmentId: int(),
        token: varchar({ length: 64 }).notNull(),
        sentVia: mysqlEnum(["email", "whatsapp"]).notNull(),
        sentTo: varchar({ length: 320 }).notNull(),
        expiresAt: timestamp({ mode: "string" }).notNull(),
        completedAt: timestamp({ mode: "string" }),
        statusRequest: mysqlEnum(["pendente", "preenchida", "expirada", "cancelada"]).default("pendente").notNull(),
        createdAt: timestamp({ mode: "string" }).default("CURRENT_TIMESTAMP").notNull()
      },
      (table) => [
        index("anamnese_requests_token_unique").on(table.token)
      ]
    );
    anamneseSubmissions = mysqlTable("anamnese_submissions", {
      id: int().autoincrement().notNull(),
      requestId: int().notNull(),
      clientId: int().notNull(),
      appointmentId: int(),
      payloadJson: text().notNull(),
      createdAt: timestamp({ mode: "string" }).default("CURRENT_TIMESTAMP").notNull()
    });
    anamnesisRecords = mysqlTable("anamnesisRecords", {
      id: int().autoincrement().notNull(),
      clientId: int().notNull(),
      appointmentId: int(),
      hasAllergies: tinyint().default(0).notNull(),
      allergiesDetails: text(),
      hasDiseases: tinyint().default(0).notNull(),
      diseasesDetails: text(),
      usesMedication: tinyint().default(0).notNull(),
      medicationDetails: text(),
      isPregnant: tinyint().default(0).notNull(),
      hasKeloid: tinyint().default(0).notNull(),
      acceptedTerms: tinyint().default(0).notNull(),
      signatureUrl: varchar({ length: 500 }),
      pdfUrl: varchar({ length: 500 }),
      createdAt: timestamp({ mode: "string" }).default("CURRENT_TIMESTAMP").notNull(),
      riskLevel: mysqlEnum(["low", "medium", "high", "critical"]).default("low").notNull(),
      riskFactors: text()
    });
    appointments = mysqlTable("appointments", {
      id: int().autoincrement().notNull(),
      clientId: int().notNull(),
      calendarId: int(),
      date: datetime({ mode: "string" }).notNull(),
      duration: int().notNull(),
      service: varchar({ length: 255 }).notNull(),
      artist: varchar({ length: 255 }).notNull(),
      artistId: int(),
      // FK opcional para artists.id — permite joins confiáveis por artista
      status: mysqlEnum(["agendado", "confirmado", "concluido", "cancelado", "reagendado"]).default("agendado").notNull(),
      confirmationStatus: mysqlEnum(["pendente", "confirmado", "nao_confirmado", "atraso", "chegada_antecipada"]).default("pendente"),
      notes: text(),
      referenceImageUrl: varchar({ length: 500 }),
      referenceImageKey: varchar({ length: 500 }),
      depositPaid: tinyint().default(0).notNull(),
      depositAmount: int(),
      totalAmount: int(),
      // Status de sinal (entrada)
      signalStatus: mysqlEnum(["aguardando_sinal", "sinal_confirmado"]).default("aguardando_sinal"),
      // Status de pagamento da tattoo
      paymentStatus: mysqlEnum(["pendente", "pago"]).default("pendente"),
      paymentMethod: mysqlEnum(["dinheiro", "pix", "cartao_credito", "cartao_debito", "transferencia", "outro"]),
      // Tipo de procedimento para anamnese
      procedureType: mysqlEnum(["tatuagem", "piercing", "micropigmentacao", "laser", "consulta", "retoque", "outro"]),
      procedureTypeOther: varchar({ length: 255 }),
      createdAt: timestamp({ mode: "string" }).default("CURRENT_TIMESTAMP").notNull(),
      updatedAt: timestamp({ mode: "string" }).defaultNow().onUpdateNow().notNull(),
      studioId: int().default(1).notNull()
    });
    artists = mysqlTable("artists", {
      id: int().autoincrement().notNull(),
      name: varchar({ length: 255 }).notNull(),
      email: varchar({ length: 320 }),
      phone: varchar({ length: 20 }),
      instagram: varchar({ length: 100 }),
      specialty: varchar({ length: 255 }),
      bio: text(),
      photoUrl: varchar({ length: 500 }),
      photoKey: varchar({ length: 500 }),
      color: varchar({ length: 7 }),
      // Cor personalizada em hex, ex: #FF5733
      active: int().default(1).notNull(),
      createdAt: timestamp({ mode: "string" }).default("CURRENT_TIMESTAMP").notNull(),
      updatedAt: timestamp({ mode: "string" }).defaultNow().onUpdateNow().notNull(),
      studioId: int().default(1).notNull()
    });
    auditLogs = mysqlTable("auditLogs", {
      id: int().autoincrement().notNull(),
      userId: int().notNull(),
      userName: varchar({ length: 255 }),
      action: mysqlEnum(["create", "update", "delete", "activate", "deactivate"]).notNull(),
      entity: mysqlEnum(["user", "client", "appointment", "transaction", "artist", "settings"]).notNull(),
      entityId: int(),
      entityName: varchar({ length: 255 }),
      details: text(),
      ipAddress: varchar({ length: 45 }),
      userAgent: varchar({ length: 500 }),
      createdAt: timestamp({ mode: "string" }).default("CURRENT_TIMESTAMP").notNull(),
      studioId: int()
    });
    calendars = mysqlTable("calendars", {
      id: int().autoincrement().notNull(),
      userId: int().notNull(),
      name: varchar({ length: 100 }).notNull(),
      description: text(),
      color: varchar({ length: 7 }).default("#8b5cf6").notNull(),
      isVisible: tinyint().default(1).notNull(),
      isDefault: tinyint().default(0).notNull(),
      createdAt: timestamp({ mode: "string" }).default("CURRENT_TIMESTAMP").notNull(),
      updatedAt: timestamp({ mode: "string" }).defaultNow().onUpdateNow().notNull()
    });
    clientNotes = mysqlTable("clientNotes", {
      id: int().autoincrement().notNull(),
      clientId: int().notNull(),
      authorId: int().notNull(),
      content: text().notNull(),
      createdAt: timestamp({ mode: "string" }).default("CURRENT_TIMESTAMP").notNull(),
      updatedAt: timestamp({ mode: "string" }).defaultNow().onUpdateNow().notNull()
    });
    clients = mysqlTable("clients", {
      artistId: int(),
      id: int().autoincrement().notNull(),
      name: varchar({ length: 255 }).notNull(),
      email: varchar({ length: 320 }),
      phone: varchar({ length: 20 }),
      birthDate: timestamp({ mode: "string" }),
      instagram: varchar({ length: 100 }),
      cep: varchar({ length: 10 }),
      street: varchar({ length: 255 }),
      number: varchar({ length: 20 }),
      complement: varchar({ length: 100 }),
      reference: varchar({ length: 255 }),
      neighborhood: varchar({ length: 100 }),
      city: varchar({ length: 100 }),
      state: varchar({ length: 50 }),
      country: varchar({ length: 50 }).default("Brasil"),
      gender: mysqlEnum(["Homem", "Mulher", "Outros"]),
      docType: mysqlEnum(["cpf", "passport"]).default("cpf"),
      docNumber: varchar({ length: 50 }),
      totalSpent: int().default(0).notNull(),
      appointmentCount: int().default(0).notNull(),
      loyaltyLevel: mysqlEnum(["Bronze", "Prata", "Ouro"]).default("Bronze").notNull(),
      createdAt: timestamp({ mode: "string" }).default("CURRENT_TIMESTAMP").notNull(),
      updatedAt: timestamp({ mode: "string" }).defaultNow().onUpdateNow().notNull(),
      studioId: int().default(1).notNull()
    });
    galleryImages = mysqlTable("galleryImages", {
      id: int().autoincrement().notNull(),
      clientId: int().notNull(),
      appointmentId: int(),
      imageUrl: varchar({ length: 500 }).notNull(),
      imageKey: varchar({ length: 500 }).notNull(),
      description: text(),
      tags: text(),
      createdAt: timestamp({ mode: "string" }).default("CURRENT_TIMESTAMP").notNull()
    });
    notificationLogs = mysqlTable("notificationLogs", {
      id: int().autoincrement().notNull(),
      type: mysqlEnum(["appointment_reminder", "birthday_reminder", "whatsapp_primary", "whatsapp_resend"]).notNull(),
      appointmentId: int(),
      clientId: int(),
      title: varchar({ length: 255 }).notNull(),
      message: text().notNull(),
      status: mysqlEnum(["sent", "failed"]).notNull(),
      sentAt: timestamp({ mode: "string" }).default("CURRENT_TIMESTAMP").notNull()
    });
    reportTemplates = mysqlTable("reportTemplates", {
      id: int().autoincrement().notNull(),
      userId: int().notNull(),
      name: varchar({ length: 255 }).notNull(),
      description: text(),
      includeSections: text().notNull(),
      sectionOrder: text().notNull(),
      logsLimit: int().default(20).notNull(),
      usersLimit: int().default(5).notNull(),
      reportTitle: varchar({ length: 255 }),
      reportSubtitle: text(),
      primaryColor: varchar({ length: 7 }).default("#8b5cf6"),
      logoUrl: varchar({ length: 500 }),
      logoKey: varchar({ length: 500 }),
      footerText: text(),
      createdAt: timestamp({ mode: "string" }).default("CURRENT_TIMESTAMP").notNull(),
      updatedAt: timestamp({ mode: "string" }).defaultNow().onUpdateNow().notNull()
    });
    studioSettings = mysqlTable("studioSettings", {
      id: int().autoincrement().notNull(),
      studioName: varchar({ length: 255 }),
      address: varchar({ length: 500 }),
      city: varchar({ length: 100 }),
      state: varchar({ length: 50 }),
      zipCode: varchar({ length: 20 }),
      phone: varchar({ length: 20 }),
      email: varchar({ length: 320 }),
      website: varchar({ length: 255 }),
      instagram: varchar({ length: 100 }),
      logoUrl: varchar({ length: 500 }),
      logoKey: varchar({ length: 500 }),
      primaryColor: varchar({ length: 7 }).default("#8b5cf6"),
      secondaryColor: varchar({ length: 7 }).default("#a78bfa"),
      businessHours: text(),
      enableBirthdayReminders: int().default(1).notNull(),
      enableAppointmentReminders: int().default(1).notNull(),
      // Configurações de lembrete WhatsApp
      reminderDaysBefore: int().default(1).notNull(),
      reminderSendTime: varchar({ length: 5 }).default("09:00"),
      reminderResend: int().default(0).notNull(),
      reminderResendTime: varchar({ length: 5 }).default("18:00"),
      createdAt: timestamp({ mode: "string" }).default("CURRENT_TIMESTAMP").notNull(),
      updatedAt: timestamp({ mode: "string" }).defaultNow().onUpdateNow().notNull()
    });
    studios = mysqlTable(
      "studios",
      {
        id: int().autoincrement().notNull(),
        name: varchar({ length: 255 }).notNull(),
        email: varchar({ length: 320 }),
        phone: varchar({ length: 20 }),
        address: text(),
        city: varchar({ length: 100 }),
        state: varchar({ length: 50 }),
        zipCode: varchar({ length: 20 }),
        masterKey: varchar({ length: 64 }).notNull(),
        isActive: tinyint().default(1).notNull(),
        createdAt: timestamp({ mode: "string" }).default("CURRENT_TIMESTAMP").notNull(),
        updatedAt: timestamp({ mode: "string" }).defaultNow().onUpdateNow().notNull()
      },
      (table) => [
        index("studios_masterKey_unique").on(table.masterKey)
      ]
    );
    transactions = mysqlTable("transactions", {
      id: int().autoincrement().notNull(),
      clientId: int(),
      appointmentId: int(),
      type: mysqlEnum(["entrada", "saida"]).notNull(),
      category: varchar({ length: 100 }).notNull(),
      description: text(),
      amount: int().notNull(),
      paymentMethod: mysqlEnum(["dinheiro", "pix", "credito", "debito", "transferencia"]).notNull(),
      date: datetime({ mode: "string" }).notNull(),
      createdAt: timestamp({ mode: "string" }).default("CURRENT_TIMESTAMP").notNull(),
      studioId: int().default(1).notNull()
    });
    users = mysqlTable("users", {
      id: int().autoincrement().notNull(),
      openId: varchar({ length: 64 }).notNull(),
      name: text(),
      email: varchar({ length: 320 }),
      loginMethod: varchar({ length: 64 }),
      role: mysqlEnum(["superadmin", "admin", "collaborator"]).default("collaborator").notNull(),
      createdAt: timestamp({ mode: "string" }).default("CURRENT_TIMESTAMP").notNull(),
      updatedAt: timestamp({ mode: "string" }).defaultNow().onUpdateNow().notNull(),
      lastSignedIn: timestamp({ mode: "string" }).default("CURRENT_TIMESTAMP").notNull(),
      artistId: int(),
      isActive: tinyint().default(1).notNull(),
      studioId: int(),
      passwordHash: varchar({ length: 255 }),
      accessStatus: mysqlEnum(["active", "suspended", "expired"]).default("active").notNull(),
      accessExpiresAt: timestamp({ mode: "string" })
    }, (table) => [uniqueIndex("idx_users_openId").on(table.openId)]);
    studioInvitations = mysqlTable("studio_invitations", {
      id: int().autoincrement().notNull(),
      studioId: int().notNull(),
      email: varchar({ length: 320 }).notNull(),
      role: mysqlEnum(["admin", "collaborator"]).notNull(),
      tokenHash: varchar({ length: 128 }).notNull(),
      status: mysqlEnum(["pending", "accepted", "revoked", "expired"]).default("pending").notNull(),
      expiresAt: timestamp({ mode: "string" }).notNull(),
      invitedByUserId: int().notNull(),
      acceptedUserId: int(),
      acceptedAt: timestamp({ mode: "string" }),
      revokedAt: timestamp({ mode: "string" }),
      createdAt: timestamp({ mode: "string" }).default("CURRENT_TIMESTAMP").notNull()
    }, (table) => [
      uniqueIndex("studio_invitations_tokenHash_unique").on(table.tokenHash),
      index("studio_invitations_studio_idx").on(table.studioId),
      index("studio_invitations_email_idx").on(table.email)
    ]);
    userModulePermissions = mysqlTable("user_module_permissions", {
      id: int().autoincrement().notNull(),
      userId: int().notNull(),
      studioId: int().notNull(),
      module: mysqlEnum(["clients", "appointments", "stock", "finance", "anamnesis", "pod", "reports"]).notNull(),
      canRead: tinyint().default(0).notNull(),
      canWrite: tinyint().default(0).notNull(),
      createdAt: timestamp({ mode: "string" }).default("CURRENT_TIMESTAMP").notNull(),
      updatedAt: timestamp({ mode: "string" }).defaultNow().onUpdateNow().notNull()
    }, (table) => [
      uniqueIndex("user_module_permissions_user_studio_module_unique").on(table.userId, table.studioId, table.module),
      index("user_module_permissions_studio_idx").on(table.studioId)
    ]);
    suppliers = mysqlTable("suppliers", {
      id: int().autoincrement().notNull(),
      name: varchar({ length: 255 }).notNull(),
      cnpj: varchar({ length: 20 }),
      contactName: varchar({ length: 255 }),
      phone: varchar({ length: 20 }),
      whatsapp: varchar({ length: 20 }),
      email: varchar({ length: 255 }),
      address: text(),
      notes: text(),
      isActive: tinyint().default(1).notNull(),
      createdAt: bigint({ mode: "number" }).default(0).notNull(),
      updatedAt: bigint({ mode: "number" }).default(0).notNull()
    });
    materials = mysqlTable("materials", {
      id: int().autoincrement().notNull(),
      name: varchar({ length: 255 }).notNull(),
      category: varchar({ length: 100 }),
      unit: varchar({ length: 50 }),
      currentStock: decimal({ precision: 10, scale: 2 }).default("0").notNull(),
      minStock: decimal({ precision: 10, scale: 2 }).default("0").notNull(),
      avgPrice: decimal({ precision: 10, scale: 2 }).default("0").notNull(),
      supplierId: int(),
      notes: text(),
      isActive: tinyint().default(1).notNull(),
      createdAt: bigint({ mode: "number" }).default(0).notNull(),
      updatedAt: bigint({ mode: "number" }).default(0).notNull()
    });
    stockMovements = mysqlTable("stock_movements", {
      id: int().autoincrement().notNull(),
      materialId: int().notNull(),
      type: mysqlEnum(["entrada", "saida", "ajuste"]).notNull(),
      quantity: decimal({ precision: 10, scale: 2 }).notNull(),
      previousStock: decimal({ precision: 10, scale: 2 }).notNull(),
      newStock: decimal({ precision: 10, scale: 2 }).notNull(),
      reason: varchar({ length: 255 }),
      notes: text(),
      createdBy: int(),
      createdAt: bigint({ mode: "number" }).default(0).notNull()
    });
    materialCatalogCategories = mysqlTable("material_catalog_categories", {
      id: int().autoincrement().notNull(),
      code: varchar({ length: 80 }).notNull(),
      name: varchar({ length: 120 }).notNull(),
      icon: varchar({ length: 80 }),
      description: text(),
      isActive: tinyint().default(1).notNull(),
      createdAt: timestamp({ mode: "string" }).default(sql`CURRENT_TIMESTAMP`).notNull(),
      updatedAt: timestamp({ mode: "string" }).defaultNow().onUpdateNow().notNull()
    }, (table) => [
      uniqueIndex("material_catalog_categories_code_unique").on(table.code),
      index("material_catalog_categories_active_idx").on(table.isActive, table.name)
    ]);
    materialCatalogItems = mysqlTable("material_catalog_items", {
      id: int().autoincrement().notNull(),
      categoryId: int().notNull(),
      code: varchar({ length: 120 }).notNull(),
      name: varchar({ length: 255 }).notNull(),
      subcategory: varchar({ length: 120 }),
      configuration: varchar({ length: 120 }),
      diameter: varchar({ length: 40 }),
      defaultUnit: varchar({ length: 50 }).default("unidade").notNull(),
      technicalSpecification: text(),
      icon: varchar({ length: 80 }),
      isActive: tinyint().default(1).notNull(),
      createdAt: timestamp({ mode: "string" }).default(sql`CURRENT_TIMESTAMP`).notNull(),
      updatedAt: timestamp({ mode: "string" }).defaultNow().onUpdateNow().notNull()
    }, (table) => [
      uniqueIndex("material_catalog_items_code_unique").on(table.code),
      index("material_catalog_items_category_idx").on(table.categoryId, table.isActive),
      index("material_catalog_items_lookup_idx").on(table.name, table.subcategory, table.configuration)
    ]);
    tenantMaterials = mysqlTable("tenant_materials", {
      id: int().autoincrement().notNull(),
      studioId: int().notNull(),
      catalogItemId: int(),
      legacyMaterialId: int(),
      name: varchar({ length: 255 }).notNull(),
      category: varchar({ length: 120 }),
      unit: varchar({ length: 50 }).default("unidade").notNull(),
      brand: varchar({ length: 120 }),
      line: varchar({ length: 120 }),
      model: varchar({ length: 120 }),
      configuration: varchar({ length: 120 }),
      diameter: varchar({ length: 40 }),
      currentQuantity: decimal({ precision: 12, scale: 3 }).default("0").notNull(),
      minimumQuantity: decimal({ precision: 12, scale: 3 }).default("0").notNull(),
      unitCost: decimal({ precision: 12, scale: 4 }).default("0").notNull(),
      supplierId: int(),
      lot: varchar({ length: 120 }),
      expiresAt: datetime({ mode: "string" }),
      notes: text(),
      isActive: tinyint().default(1).notNull(),
      createdByUserId: int(),
      createdAt: timestamp({ mode: "string" }).default(sql`CURRENT_TIMESTAMP`).notNull(),
      updatedAt: timestamp({ mode: "string" }).defaultNow().onUpdateNow().notNull()
    }, (table) => [
      index("tenant_materials_studio_active_idx").on(table.studioId, table.isActive, table.name),
      index("tenant_materials_catalog_idx").on(table.studioId, table.catalogItemId),
      index("tenant_materials_supplier_idx").on(table.studioId, table.supplierId),
      uniqueIndex("tenant_materials_legacy_source_unique").on(table.studioId, table.legacyMaterialId)
    ]);
    tenantInventoryMovements = mysqlTable("tenant_inventory_movements", {
      id: int().autoincrement().notNull(),
      studioId: int().notNull(),
      tenantMaterialId: int().notNull(),
      type: mysqlEnum(["entrada", "consumo", "reversao", "ajuste"]).notNull(),
      quantity: decimal({ precision: 12, scale: 3 }).notNull(),
      previousQuantity: decimal({ precision: 12, scale: 3 }).notNull(),
      newQuantity: decimal({ precision: 12, scale: 3 }).notNull(),
      sourceType: varchar({ length: 80 }),
      sourceId: int(),
      reason: varchar({ length: 255 }),
      notes: text(),
      createdByUserId: int(),
      createdAt: timestamp({ mode: "string" }).default(sql`CURRENT_TIMESTAMP`).notNull()
    }, (table) => [
      index("tenant_inventory_movements_studio_material_idx").on(table.studioId, table.tenantMaterialId, table.createdAt),
      index("tenant_inventory_movements_source_idx").on(table.sourceType, table.sourceId)
    ]);
    appointmentPlannedMaterials = mysqlTable("appointment_planned_materials", {
      id: int().autoincrement().notNull(),
      studioId: int().notNull(),
      appointmentId: int().notNull(),
      tenantMaterialId: int(),
      catalogItemId: int(),
      nameSnapshot: varchar({ length: 255 }).notNull(),
      unitSnapshot: varchar({ length: 50 }).notNull(),
      quantityPlanned: decimal({ precision: 12, scale: 3 }).notNull(),
      status: mysqlEnum(["planejado", "consumido", "nao_utilizado"]).default("planejado").notNull(),
      createdByUserId: int(),
      createdAt: timestamp({ mode: "string" }).default(sql`CURRENT_TIMESTAMP`).notNull(),
      updatedAt: timestamp({ mode: "string" }).defaultNow().onUpdateNow().notNull()
    }, (table) => [
      index("appointment_planned_materials_appointment_idx").on(table.studioId, table.appointmentId, table.status),
      index("appointment_planned_materials_material_idx").on(table.studioId, table.tenantMaterialId)
    ]);
    procedurePauses = mysqlTable("procedure_pauses", {
      id: int().autoincrement().notNull(),
      procedureId: int().notNull(),
      studioId: int().notNull(),
      artistId: int(),
      startedAt: datetime({ mode: "string" }).notNull(),
      endedAt: datetime({ mode: "string" }),
      reason: varchar({ length: 120 }),
      createdAt: timestamp({ mode: "string" }).default(sql`CURRENT_TIMESTAMP`).notNull(),
      updatedAt: timestamp({ mode: "string" }).defaultNow().onUpdateNow().notNull()
    }, (table) => [
      index("procedure_pauses_procedure_idx").on(table.procedureId, table.startedAt),
      index("procedure_pauses_studio_open_idx").on(table.studioId, table.endedAt)
    ]);
    procedureInventoryConsumptions = mysqlTable("procedure_inventory_consumptions", {
      id: int().autoincrement().notNull(),
      procedureId: int().notNull(),
      studioId: int().notNull(),
      appointmentId: int(),
      clientId: int().notNull(),
      artistId: int(),
      tenantMaterialId: int().notNull(),
      plannedMaterialId: int(),
      nameSnapshot: varchar({ length: 255 }).notNull(),
      unitSnapshot: varchar({ length: 50 }).notNull(),
      quantity: decimal({ precision: 12, scale: 3 }).notNull(),
      unitCostSnapshot: decimal({ precision: 12, scale: 4 }).notNull(),
      totalCostSnapshot: decimal({ precision: 12, scale: 4 }).notNull(),
      lotSnapshot: varchar({ length: 120 }),
      expiresAtSnapshot: datetime({ mode: "string" }),
      status: mysqlEnum(["consumido", "revertido"]).default("consumido").notNull(),
      consumedAt: datetime({ mode: "string" }).notNull(),
      reversedAt: datetime({ mode: "string" }),
      reversalReason: varchar({ length: 255 }),
      createdByUserId: int(),
      reversedByUserId: int(),
      createdAt: timestamp({ mode: "string" }).default(sql`CURRENT_TIMESTAMP`).notNull(),
      updatedAt: timestamp({ mode: "string" }).defaultNow().onUpdateNow().notNull()
    }, (table) => [
      index("procedure_inventory_consumptions_procedure_idx").on(table.procedureId, table.status, table.consumedAt),
      index("procedure_inventory_consumptions_studio_client_idx").on(table.studioId, table.clientId, table.consumedAt),
      index("procedure_inventory_consumptions_material_idx").on(table.studioId, table.tenantMaterialId, table.status)
    ]);
    purchaseOrders = mysqlTable("purchase_orders", {
      id: int().autoincrement().notNull(),
      supplierId: int(),
      status: mysqlEnum(["rascunho", "enviado", "confirmado", "recebido", "cancelado"]).default("rascunho").notNull(),
      notes: text(),
      totalAmount: decimal({ precision: 10, scale: 2 }),
      sentAt: bigint({ mode: "number" }),
      createdBy: int(),
      createdAt: bigint({ mode: "number" }).default(0).notNull(),
      updatedAt: bigint({ mode: "number" }).default(0).notNull()
    });
    purchaseOrderItems = mysqlTable("purchase_order_items", {
      id: int().autoincrement().notNull(),
      orderId: int().notNull(),
      materialId: int(),
      materialName: varchar({ length: 255 }),
      materialUnit: varchar({ length: 50 }),
      quantity: decimal({ precision: 10, scale: 2 }).notNull(),
      unitPrice: decimal({ precision: 10, scale: 2 }).default("0").notNull(),
      notes: text()
    });
    appointmentReminders = mysqlTable("appointmentReminders", {
      id: int().autoincrement().notNull(),
      appointmentId: int().notNull(),
      scheduledAt: datetime({ mode: "string" }).notNull(),
      // data e hora exata do envio
      message: text().notNull(),
      // mensagem personalizada
      status: mysqlEnum(["pending", "sent", "failed"]).default("pending").notNull(),
      sentAt: timestamp({ mode: "string" }),
      // quando foi enviado de fato
      createdAt: timestamp({ mode: "string" }).default("CURRENT_TIMESTAMP").notNull(),
      updatedAt: timestamp({ mode: "string" }).defaultNow().onUpdateNow().notNull()
    });
    appointmentActionLinks = mysqlTable("appointment_action_links", {
      id: int().autoincrement().notNull(),
      studioId: int("studio_id").notNull(),
      appointmentId: int("appointment_id").notNull(),
      action: mysqlEnum(["confirmed", "early", "late", "reschedule_requested"]).notNull(),
      tokenHash: varchar("token_hash", { length: 128 }).notNull(),
      expiresAt: datetime("expires_at", { mode: "string" }).notNull(),
      usedAt: timestamp("used_at", { mode: "string" }),
      createdAt: timestamp("created_at", { mode: "string" }).default(sql`CURRENT_TIMESTAMP`).notNull()
    }, (table) => [
      uniqueIndex("appointment_action_links_token_unique").on(table.tokenHash),
      index("appointment_action_links_appointment_idx").on(table.appointmentId, table.action),
      index("appointment_action_links_studio_idx").on(table.studioId, table.expiresAt)
    ]);
    appointmentActionAlerts = mysqlTable("appointment_action_alerts", {
      id: int().autoincrement().notNull(),
      studioId: int("studio_id").notNull(),
      appointmentId: int("appointment_id").notNull(),
      actionLinkId: int("action_link_id").notNull(),
      action: mysqlEnum(["confirmed", "early", "late", "reschedule_requested"]).notNull(),
      status: mysqlEnum(["new", "viewed"]).default("new").notNull(),
      createdAt: timestamp("created_at", { mode: "string" }).default(sql`CURRENT_TIMESTAMP`).notNull(),
      viewedAt: timestamp("viewed_at", { mode: "string" })
    }, (table) => [
      uniqueIndex("appointment_action_alerts_link_unique").on(table.actionLinkId),
      index("appointment_action_alerts_studio_status_idx").on(table.studioId, table.status, table.createdAt),
      index("appointment_action_alerts_appointment_idx").on(table.appointmentId, table.createdAt)
    ]);
    collaboratorRates = mysqlTable("collaboratorRates", {
      id: int().autoincrement().notNull(),
      artistId: int().notNull(),
      // FK para artists.id
      percentage: int().notNull().default(50),
      // 0-100 inteiro
      studioId: int().default(1).notNull(),
      notes: varchar({ length: 500 }),
      createdAt: timestamp({ mode: "string" }).default(sql`CURRENT_TIMESTAMP`).notNull(),
      updatedAt: timestamp({ mode: "string" }).defaultNow().onUpdateNow().notNull()
    });
    passwordResetTokens = mysqlTable("passwordResetTokens", {
      id: int().autoincrement().notNull(),
      userId: int().notNull(),
      token: varchar({ length: 128 }).notNull(),
      expiresAt: timestamp({ mode: "string" }).notNull(),
      usedAt: timestamp({ mode: "string" }),
      createdAt: timestamp({ mode: "string" }).default(sql`CURRENT_TIMESTAMP`).notNull()
    }, (table) => [
      uniqueIndex("idx_password_reset_token").on(table.token)
    ]);
    technicalProcedures = mysqlTable("technical_procedures", {
      id: int().autoincrement().notNull(),
      studioId: int().default(1).notNull(),
      clientId: int().notNull(),
      appointmentId: int(),
      // opcional: vínculo com appointments.id
      artistId: int(),
      artistName: varchar({ length: 255 }),
      title: varchar({ length: 255 }).notNull(),
      description: text(),
      bodyLocation: varchar({ length: 100 }),
      tattooStyle: varchar({ length: 100 }),
      chargedAmount: int().default(0),
      // em centavos
      status: mysqlEnum(["em_andamento", "pausado", "finalizado", "retorno", "retoque"]).default("em_andamento").notNull(),
      startedAt: datetime({ mode: "string" }),
      pausedAt: datetime({ mode: "string" }),
      finishedAt: datetime({ mode: "string" }),
      totalDurationMinutes: int().default(0),
      referenceImageUrl: varchar({ length: 500 }),
      referenceImageKey: varchar({ length: 500 }),
      stencilImageUrl: varchar({ length: 500 }),
      stencilImageKey: varchar({ length: 500 }),
      finalImageUrl: varchar({ length: 500 }),
      finalImageKey: varchar({ length: 500 }),
      healedImageUrl: varchar({ length: 500 }),
      healedImageKey: varchar({ length: 500 }),
      notes: text(),
      createdAt: timestamp({ mode: "string" }).default(sql`CURRENT_TIMESTAMP`).notNull(),
      updatedAt: timestamp({ mode: "string" }).defaultNow().onUpdateNow().notNull()
    });
    procedureConsumables = mysqlTable("procedure_consumables", {
      id: int().autoincrement().notNull(),
      procedureId: int().notNull(),
      inventoryItemId: int(),
      // opcional: vínculo com materials.id
      category: mysqlEnum(["ink", "cartridge", "disposable", "liquid", "protection", "stencil", "aftercare", "other"]).notNull(),
      name: varchar({ length: 255 }).notNull(),
      unit: mysqlEnum(["drop", "ml", "unit", "pair", "gram", "portion", "roll_fraction"]).default("unit").notNull(),
      quantity: decimal({ precision: 10, scale: 2 }).default("0").notNull(),
      estimatedUnitCost: decimal({ precision: 10, scale: 2 }).default("0"),
      // em reais
      estimatedTotalCost: decimal({ precision: 10, scale: 2 }).default("0"),
      // em reais
      notes: text(),
      createdAt: timestamp({ mode: "string" }).default(sql`CURRENT_TIMESTAMP`).notNull(),
      updatedAt: timestamp({ mode: "string" }).defaultNow().onUpdateNow().notNull()
    });
    procedureImages = mysqlTable("procedure_images", {
      id: int().autoincrement().notNull(),
      procedureId: int().notNull(),
      imageUrl: varchar({ length: 500 }).notNull(),
      imageKey: varchar({ length: 500 }).notNull(),
      imageType: mysqlEnum(["reference", "stencil", "progress", "final", "healed", "other"]).default("other").notNull(),
      description: text(),
      createdAt: timestamp({ mode: "string" }).default(sql`CURRENT_TIMESTAMP`).notNull()
    });
    procedureEvents = mysqlTable("procedure_events", {
      id: int().autoincrement().notNull(),
      procedureId: int().notNull(),
      eventType: varchar({ length: 50 }).notNull(),
      // 'start','pause','resume','finish','consumable_added','consumable_removed','note_added'
      payload: text(),
      // JSON string com dados do evento
      createdAt: timestamp({ mode: "string" }).default(sql`CURRENT_TIMESTAMP`).notNull()
    });
    whatsappIntegrations = mysqlTable("whatsapp_integrations", {
      id: int().autoincrement().notNull(),
      studioId: int("studio_id"),
      name: varchar({ length: 255 }).notNull().default("WhatsApp Principal"),
      provider: mysqlEnum(["botconversa", "zapi", "meta"]).notNull(),
      phoneNumber: varchar({ length: 30 }).notNull(),
      apiToken: varchar({ length: 1e3 }).notNull(),
      encryptedApiToken: text("encrypted_api_token"),
      encryptedWebhookSecret: text("encrypted_webhook_secret"),
      connectionKey: varchar("connection_key", { length: 96 }),
      sandboxMode: tinyint("sandbox_mode").default(1).notNull(),
      sandboxTestPhone: varchar("sandbox_test_phone", { length: 32 }),
      productionActivatedAt: timestamp("production_activated_at", { mode: "string" }),
      productionActivatedByUserId: int("production_activated_by_user_id"),
      isEnabled: tinyint("is_enabled").default(0).notNull(),
      lastSuccessAt: timestamp("last_success_at", { mode: "string" }),
      failureCount: int("failure_count").default(0).notNull(),
      instanceId: varchar({ length: 255 }),
      // Z-API instance ID
      webhookUrl: varchar({ length: 500 }),
      // URL do webhook de retorno
      status: mysqlEnum(["ativo", "inativo", "erro", "aguardando"]).default("aguardando").notNull(),
      lastTestedAt: timestamp({ mode: "string" }),
      lastErrorMessage: text(),
      createdAt: timestamp({ mode: "string" }).default(sql`CURRENT_TIMESTAMP`).notNull(),
      updatedAt: timestamp({ mode: "string" }).default(sql`CURRENT_TIMESTAMP`).notNull()
    }, (table) => [
      uniqueIndex("whatsapp_integrations_connection_key_unique").on(table.connectionKey),
      index("whatsapp_integrations_studio_status_idx").on(table.studioId, table.status)
    ]);
    messageTemplates = mysqlTable("message_templates", {
      id: int().autoincrement().notNull(),
      studioId: int("studio_id"),
      name: varchar({ length: 255 }).notNull(),
      trigger: mysqlEnum(["appointment_created", "appointment_confirmed", "appointment_reminder_24h", "appointment_reminder_2h", "appointment_reminder_1h", "appointment_cancelled", "appointment_rescheduled", "care_guide", "custom"]).notNull(),
      recipientType: mysqlEnum(["client", "artist"]).notNull(),
      message: text().notNull(),
      isActive: tinyint().default(1).notNull(),
      createdAt: timestamp({ mode: "string" }).default(sql`CURRENT_TIMESTAMP`).notNull(),
      updatedAt: timestamp({ mode: "string" }).default(sql`CURRENT_TIMESTAMP`).notNull()
    });
    messageAutomationSettings = mysqlTable("message_automation_settings", {
      id: int().autoincrement().notNull(),
      studioId: int("studio_id").notNull(),
      appointmentRemindersEnabled: tinyint("appointment_reminders_enabled").default(0).notNull(),
      appointmentDaysBefore: int("appointment_days_before").default(1).notNull(),
      appointmentSendTime: varchar("appointment_send_time", { length: 5 }).default("10:00").notNull(),
      oneHourRemindersEnabled: tinyint("one_hour_reminders_enabled").default(0).notNull(),
      birthdayMessagesEnabled: tinyint("birthday_messages_enabled").default(0).notNull(),
      birthdaySendTime: varchar("birthday_send_time", { length: 5 }).default("10:00").notNull(),
      birthdayMessageTemplate: text("birthday_message_template"),
      timezone: varchar({ length: 64 }).default("America/Sao_Paulo").notNull(),
      lastAppointmentCycleAt: timestamp("last_appointment_cycle_at", { mode: "string" }),
      lastBirthdayCycleAt: timestamp("last_birthday_cycle_at", { mode: "string" }),
      lastError: text("last_error"),
      createdAt: timestamp("created_at", { mode: "string" }).default(sql`CURRENT_TIMESTAMP`).notNull(),
      updatedAt: timestamp("updated_at", { mode: "string" }).default(sql`CURRENT_TIMESTAMP`).notNull()
    }, (table) => [
      uniqueIndex("message_automation_settings_studio_unique").on(table.studioId)
    ]);
    messageQueue = mysqlTable("message_queue", {
      id: int().autoincrement().notNull(),
      studioId: int("studio_id"),
      integrationId: int().notNull(),
      appointmentId: int(),
      clientId: int(),
      retryOfQueueId: int("retry_of_queue_id"),
      recipientPhone: varchar({ length: 30 }).notNull(),
      recipientName: varchar({ length: 255 }),
      recipientType: mysqlEnum(["client", "artist"]).notNull(),
      message: text().notNull(),
      trigger: varchar({ length: 100 }),
      status: mysqlEnum(["pendente", "enviada", "erro", "cancelada", "respondida"]).default("pendente").notNull(),
      scheduledAt: timestamp({ mode: "string" }),
      sentAt: timestamp({ mode: "string" }),
      errorMessage: text(),
      providerMessageId: varchar({ length: 255 }),
      // ID retornado pelo provedor
      createdAt: timestamp({ mode: "string" }).default(sql`CURRENT_TIMESTAMP`).notNull()
    }, (table) => [
      index("message_queue_retry_of_idx").on(table.retryOfQueueId)
    ]);
    integrationContacts = mysqlTable("integration_contacts", {
      id: int().autoincrement().notNull(),
      studioId: int("studio_id").notNull(),
      integrationId: int("integration_id").notNull(),
      clientId: int("client_id").notNull(),
      normalizedPhone: varchar("normalized_phone", { length: 32 }).notNull(),
      providerSubscriberId: varchar("provider_subscriber_id", { length: 255 }),
      hasWhatsappOptIn: tinyint("has_whatsapp_opt_in").default(0).notNull(),
      optInAt: timestamp("opt_in_at", { mode: "string" }),
      optInSource: varchar("opt_in_source", { length: 100 }),
      optedOutAt: timestamp("opted_out_at", { mode: "string" }),
      createdAt: timestamp({ mode: "string" }).default(sql`CURRENT_TIMESTAMP`).notNull(),
      updatedAt: timestamp({ mode: "string" }).default(sql`CURRENT_TIMESTAMP`).notNull()
    }, (table) => [
      uniqueIndex("integration_contacts_studio_client_unique").on(table.studioId, table.clientId),
      uniqueIndex("integration_contacts_studio_phone_unique").on(table.studioId, table.normalizedPhone),
      index("integration_contacts_integration_idx").on(table.integrationId)
    ]);
    integrationJobs = mysqlTable("integration_jobs", {
      id: int().autoincrement().notNull(),
      studioId: int("studio_id").notNull(),
      integrationId: int("integration_id").notNull(),
      type: mysqlEnum(["sync_contact", "send_template", "dispatch_flow", "process_inbound"]).notNull(),
      payload: text().notNull(),
      idempotencyKey: varchar("idempotency_key", { length: 128 }).notNull(),
      status: mysqlEnum(["pending", "processing", "completed", "retry", "failed", "cancelled"]).default("pending").notNull(),
      attemptCount: int("attempt_count").default(0).notNull(),
      maxAttempts: int("max_attempts").default(5).notNull(),
      nextAttemptAt: timestamp("next_attempt_at", { mode: "string" }),
      lockedAt: timestamp("locked_at", { mode: "string" }),
      completedAt: timestamp("completed_at", { mode: "string" }),
      lastError: text("last_error"),
      createdAt: timestamp({ mode: "string" }).default(sql`CURRENT_TIMESTAMP`).notNull(),
      updatedAt: timestamp({ mode: "string" }).default(sql`CURRENT_TIMESTAMP`).notNull()
    }, (table) => [
      uniqueIndex("integration_jobs_idempotency_unique").on(table.idempotencyKey),
      index("integration_jobs_ready_idx").on(table.status, table.nextAttemptAt),
      index("integration_jobs_studio_idx").on(table.studioId, table.createdAt)
    ]);
    integrationEvents = mysqlTable("integration_events", {
      id: int().autoincrement().notNull(),
      studioId: int("studio_id").notNull(),
      integrationId: int("integration_id").notNull(),
      direction: mysqlEnum(["inbound", "outbound"]).notNull(),
      type: varchar({ length: 100 }).notNull(),
      idempotencyKey: varchar("idempotency_key", { length: 128 }).notNull(),
      providerEventId: varchar("provider_event_id", { length: 255 }),
      payloadHash: varchar("payload_hash", { length: 64 }).notNull(),
      status: mysqlEnum(["received", "queued", "processed", "failed", "ignored"]).default("received").notNull(),
      errorMessage: text("error_message"),
      receivedAt: timestamp("received_at", { mode: "string" }).default(sql`CURRENT_TIMESTAMP`).notNull(),
      processedAt: timestamp("processed_at", { mode: "string" })
    }, (table) => [
      uniqueIndex("integration_events_idempotency_unique").on(table.idempotencyKey),
      index("integration_events_connection_idx").on(table.integrationId, table.receivedAt),
      index("integration_events_studio_idx").on(table.studioId, table.receivedAt)
    ]);
    integrationSchedules = mysqlTable("integration_schedules", {
      id: int().autoincrement().notNull(),
      code: varchar({ length: 100 }).notNull(),
      scheduleCronTaskUid: varchar("schedule_cron_task_uid", { length: 65 }),
      isEnabled: tinyint("is_enabled").default(0).notNull(),
      lastRunAt: timestamp("last_run_at", { mode: "string" }),
      lastError: text("last_error"),
      createdAt: timestamp({ mode: "string" }).default(sql`CURRENT_TIMESTAMP`).notNull(),
      updatedAt: timestamp({ mode: "string" }).default(sql`CURRENT_TIMESTAMP`).notNull()
    }, (table) => [
      uniqueIndex("integration_schedules_code_unique").on(table.code),
      uniqueIndex("integration_schedules_task_uid_unique").on(table.scheduleCronTaskUid)
    ]);
  }
});

// server/_core/env.ts
var railwayPublicDomain, detectedAppBaseUrl, detectedStorageProvider, ENV;
var init_env = __esm({
  "server/_core/env.ts"() {
    "use strict";
    railwayPublicDomain = process.env.RAILWAY_PUBLIC_DOMAIN?.trim();
    detectedAppBaseUrl = process.env.APP_BASE_URL?.trim() || process.env.PUBLIC_URL?.trim() || (railwayPublicDomain ? `https://${railwayPublicDomain}` : "");
    detectedStorageProvider = process.env.STORAGE_PROVIDER?.trim() || (process.env.BUILT_IN_FORGE_API_KEY ? "manus" : "disabled");
    ENV = {
      appId: process.env.VITE_APP_ID ?? "",
      cookieSecret: process.env.JWT_SECRET ?? "",
      databaseUrl: process.env.DATABASE_URL ?? "",
      oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
      ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
      isProduction: process.env.NODE_ENV === "production",
      forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
      forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
      appBaseUrl: detectedAppBaseUrl.replace(/\/+$/, ""),
      // Auth mode: "oauth" (Manus) or "local" (standalone)
      authMode: process.env.AUTH_MODE ?? "oauth",
      // Local auth admin credentials (only used when AUTH_MODE=local)
      localAdminEmail: process.env.LOCAL_ADMIN_EMAIL ?? "admin@podcrm.local",
      localAdminPassword: process.env.LOCAL_ADMIN_PASSWORD ?? "admin123",
      localAdminName: process.env.LOCAL_ADMIN_NAME ?? "Admin",
      // Storage provider: "manus", "s3" or "disabled"
      storageProvider: detectedStorageProvider,
      // S3-compatible storage (Railway Buckets, R2, AWS S3, etc.)
      s3Endpoint: process.env.AWS_ENDPOINT_URL ?? process.env.ENDPOINT ?? "",
      s3AccessKeyId: process.env.AWS_ACCESS_KEY_ID ?? process.env.ACCESS_KEY_ID ?? "",
      s3SecretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? process.env.SECRET_ACCESS_KEY ?? "",
      s3Bucket: process.env.AWS_S3_BUCKET_NAME ?? process.env.BUCKET ?? "",
      s3Region: process.env.AWS_DEFAULT_REGION ?? process.env.AWS_REGION ?? process.env.REGION ?? "auto",
      s3UrlStyle: (process.env.AWS_S3_URL_STYLE ?? "virtual").toLowerCase()
    };
  }
});

// server/_core/notification.ts
var notification_exports = {};
__export(notification_exports, {
  notifyOwner: () => notifyOwner
});
import { TRPCError } from "@trpc/server";
async function notifyOwner(payload) {
  const { title, content } = validatePayload(payload);
  if (!ENV.forgeApiUrl) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Notification service URL is not configured."
    });
  }
  if (!ENV.forgeApiKey) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Notification service API key is not configured."
    });
  }
  const endpoint = buildEndpointUrl(ENV.forgeApiUrl);
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        accept: "application/json",
        authorization: `Bearer ${ENV.forgeApiKey}`,
        "content-type": "application/json",
        "connect-protocol-version": "1"
      },
      body: JSON.stringify({ title, content })
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.warn(
        `[Notification] Failed to notify owner (${response.status} ${response.statusText})${detail ? `: ${detail}` : ""}`
      );
      return false;
    }
    return true;
  } catch (error) {
    console.warn("[Notification] Error calling notification service:", error);
    return false;
  }
}
var TITLE_MAX_LENGTH, CONTENT_MAX_LENGTH, trimValue, isNonEmptyString, buildEndpointUrl, validatePayload;
var init_notification = __esm({
  "server/_core/notification.ts"() {
    "use strict";
    init_env();
    TITLE_MAX_LENGTH = 1200;
    CONTENT_MAX_LENGTH = 2e4;
    trimValue = (value) => value.trim();
    isNonEmptyString = (value) => typeof value === "string" && value.trim().length > 0;
    buildEndpointUrl = (baseUrl) => {
      const normalizedBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
      return new URL(
        "webdevtoken.v1.WebDevService/SendNotification",
        normalizedBase
      ).toString();
    };
    validatePayload = (input) => {
      if (!isNonEmptyString(input.title)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Notification title is required."
        });
      }
      if (!isNonEmptyString(input.content)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Notification content is required."
        });
      }
      const title = trimValue(input.title);
      const content = trimValue(input.content);
      if (title.length > TITLE_MAX_LENGTH) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Notification title must be at most ${TITLE_MAX_LENGTH} characters.`
        });
      }
      if (content.length > CONTENT_MAX_LENGTH) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Notification content must be at most ${CONTENT_MAX_LENGTH} characters.`
        });
      }
      return { title, content };
    };
  }
});

// server/db.ts
import { eq, desc, and, gte, lte, or, like, sql as sql2, ne } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
function toDateStr(d) {
  if (!d) return (/* @__PURE__ */ new Date()).toISOString().slice(0, 19).replace("T", " ");
  if (typeof d === "string") return d;
  return d.toISOString().slice(0, 19).replace("T", " ");
}
function toLocalDateStr(d) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}
async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}
async function getIntegrationScheduleByTaskUid(taskUid) {
  const database = await getDb();
  if (!database) return null;
  return (await database.select().from(integrationSchedules).where(eq(integrationSchedules.scheduleCronTaskUid, taskUid)).limit(1))[0] ?? null;
}
async function recordIntegrationScheduleRun(id, result) {
  const database = await getDb();
  if (!database) return;
  await database.update(integrationSchedules).set({
    lastRunAt: toDateStr(/* @__PURE__ */ new Date()),
    lastError: result.error ?? null,
    updatedAt: toDateStr(/* @__PURE__ */ new Date())
  }).where(eq(integrationSchedules.id, id));
}
async function upsertUser(user) {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }
  try {
    const values = {
      openId: user.openId
    };
    const updateSet = {};
    const textFields = ["name", "email", "loginMethod"];
    const assignNullable = (field) => {
      const value = user[field];
      if (value === void 0) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };
    textFields.forEach(assignNullable);
    if (user.lastSignedIn !== void 0) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== void 0) {
      values.role = user.role;
      updateSet.role = user.role;
    }
    if (!values.lastSignedIn) {
      values.lastSignedIn = toDateStr(/* @__PURE__ */ new Date());
    }
    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = toDateStr(/* @__PURE__ */ new Date());
    }
    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}
async function getUserByEmail(email) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return void 0;
  }
  const result = await db.select().from(users).where(eq(users.email, email.trim().toLowerCase())).limit(1);
  return result.length > 0 ? result[0] : void 0;
}
async function getUserByOpenId(openId) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return void 0;
  }
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : void 0;
}
async function listAllUsers() {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot list users: database not available");
    return [];
  }
  const result = await db.select().from(users).orderBy(desc(users.createdAt));
  return result;
}
async function getUserById(id) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return void 0;
  }
  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result.length > 0 ? result[0] : void 0;
}
async function createUser(data) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot create user: database not available");
    return void 0;
  }
  const result = await db.insert(users).values({
    openId: data.openId,
    name: data.name ?? null,
    email: data.email ?? null,
    role: data.role ?? "collaborator",
    studioId: data.studioId ?? null,
    artistId: data.artistId ?? null,
    isActive: 1,
    passwordHash: data.passwordHash ?? null
  });
  return result;
}
async function updateUser(id, data) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot update user: database not available");
    return void 0;
  }
  const updateData = {};
  if (data.name !== void 0) updateData.name = data.name;
  if (data.email !== void 0) updateData.email = data.email;
  if (data.role !== void 0) updateData.role = data.role;
  if (data.studioId !== void 0) updateData.studioId = data.studioId;
  if (data.artistId !== void 0) updateData.artistId = data.artistId;
  if (data.isActive !== void 0) updateData.isActive = data.isActive;
  if (data.passwordHash !== void 0) updateData.passwordHash = data.passwordHash;
  if (data.lastSignedIn !== void 0) updateData.lastSignedIn = data.lastSignedIn;
  const result = await db.update(users).set(updateData).where(eq(users.id, id));
  ;
  return result;
}
async function deleteUser(id) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot delete user: database not available");
    return void 0;
  }
  const result = await db.delete(users).where(eq(users.id, id));
  return result;
}
async function listClients(studioId, artistId) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [];
  if (studioId !== null && studioId !== void 0) {
    conditions.push(eq(clients.studioId, studioId));
  }
  if (artistId !== null && artistId !== void 0) {
    conditions.push(eq(clients.artistId, artistId));
  }
  const result = conditions.length > 0 ? await db.select().from(clients).where(and(...conditions)).orderBy(desc(clients.createdAt)) : await db.select().from(clients).orderBy(desc(clients.createdAt));
  return result;
}
async function searchClients(term, startDate, endDate, studioId) {
  const db = await getDb();
  if (!db) return [];
  const searchTerm = `%${term}%`;
  const conditions = [
    or(
      like(clients.name, searchTerm),
      like(clients.email, searchTerm),
      like(clients.phone, searchTerm)
    )
  ];
  if (studioId !== null && studioId !== void 0) {
    conditions.push(eq(clients.studioId, studioId));
  }
  if (startDate) {
    conditions.push(gte(clients.createdAt, toDateStr(startDate)));
  }
  if (endDate) {
    conditions.push(lte(clients.createdAt, toDateStr(endDate)));
  }
  const result = await db.select().from(clients).where(and(...conditions)).orderBy(desc(clients.createdAt)).limit(10);
  return result;
}
async function getClientById(id) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(clients).where(eq(clients.id, id)).limit(1);
  return result.length > 0 ? result[0] : null;
}
async function createClient(data) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(clients).values(data);
  const insertId = Number(result[0].insertId);
  const client = await getClientById(insertId);
  if (!client) throw new Error("Failed to retrieve created client");
  return client;
}
async function updateClient(id, data) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(clients).set(data).where(eq(clients.id, id));
  return { success: true };
}
async function deleteClient(id) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(clients).where(eq(clients.id, id));
  return { success: true };
}
async function updateClientLoyaltyLevel(id) {
  const db = await getDb();
  if (!db) return;
  const client = await getClientById(id);
  if (!client) return;
  let newLevel = "Bronze";
  if (client.totalSpent >= 1e5 || client.appointmentCount >= 5) {
    newLevel = "Ouro";
  } else if (client.totalSpent >= 5e4 || client.appointmentCount >= 3) {
    newLevel = "Prata";
  }
  if (newLevel !== client.loyaltyLevel) {
    await db.update(clients).set({ loyaltyLevel: newLevel }).where(eq(clients.id, id));
  }
}
async function listAppointments(studioId, artistId) {
  const db = await getDb();
  if (!db) return [];
  const baseQuery = db.select({
    id: appointments.id,
    clientId: appointments.clientId,
    calendarId: appointments.calendarId,
    date: appointments.date,
    duration: appointments.duration,
    service: appointments.service,
    artist: appointments.artist,
    artistId: appointments.artistId,
    status: appointments.status,
    confirmationStatus: appointments.confirmationStatus,
    notes: appointments.notes,
    referenceImageUrl: appointments.referenceImageUrl,
    referenceImageKey: appointments.referenceImageKey,
    depositPaid: appointments.depositPaid,
    depositAmount: appointments.depositAmount,
    totalAmount: appointments.totalAmount,
    signalStatus: appointments.signalStatus,
    paymentStatus: appointments.paymentStatus,
    paymentMethod: appointments.paymentMethod,
    createdAt: appointments.createdAt,
    updatedAt: appointments.updatedAt,
    studioId: appointments.studioId,
    clientName: clients.name
  }).from(appointments).leftJoin(clients, eq(appointments.clientId, clients.id));
  if (studioId != null && artistId != null) {
    return await baseQuery.where(and(eq(appointments.studioId, studioId), eq(appointments.artistId, artistId))).orderBy(desc(appointments.date));
  }
  if (studioId != null) {
    return await baseQuery.where(eq(appointments.studioId, studioId)).orderBy(desc(appointments.date));
  }
  return await baseQuery.orderBy(desc(appointments.date));
}
async function getAppointmentsByClientId(clientId, studioId, artistId) {
  const db = await getDb();
  if (!db) return [];
  const query = db.select().from(appointments).where(
    studioId != null && artistId != null ? and(eq(appointments.clientId, clientId), eq(appointments.studioId, studioId), eq(appointments.artistId, artistId)) : studioId != null ? and(eq(appointments.clientId, clientId), eq(appointments.studioId, studioId)) : eq(appointments.clientId, clientId)
  );
  return await query.orderBy(desc(appointments.date));
}
async function getAppointmentById(id) {
  const db = await getDb();
  if (!db) return void 0;
  const result = await db.select().from(appointments).where(eq(appointments.id, id)).limit(1);
  return result[0];
}
async function createAppointment(data) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(appointments).values(data);
  const insertId = Number(result[0].insertId);
  await db.update(clients).set({ appointmentCount: sql2`${clients.appointmentCount} + 1` }).where(eq(clients.id, data.clientId));
  await updateClientLoyaltyLevel(data.clientId);
  const appointment = await db.select().from(appointments).where(eq(appointments.id, insertId)).limit(1);
  return appointment[0];
}
async function updateAppointment(id, data) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(appointments).set(data).where(eq(appointments.id, id));
  return { success: true };
}
async function deleteAppointment(id) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(appointments).where(eq(appointments.id, id));
  return { success: true };
}
async function checkAppointmentConflicts(artist, date, duration, excludeId) {
  const db = await getDb();
  if (!db) return { hasConflict: false, conflicts: [] };
  const startTime = new Date(typeof date === "string" ? date : date);
  const endTime = new Date(startTime.getTime() + duration * 6e4);
  const dayStart = new Date(startTime);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(startTime);
  dayEnd.setHours(23, 59, 59, 999);
  let query = db.select({
    id: appointments.id,
    clientId: appointments.clientId,
    date: appointments.date,
    duration: appointments.duration,
    service: appointments.service,
    artist: appointments.artist,
    status: appointments.status
  }).from(appointments).where(
    and(
      eq(appointments.artist, artist),
      gte(appointments.date, toDateStr(dayStart)),
      lte(appointments.date, toDateStr(dayEnd)),
      ne(appointments.status, "cancelado")
      // Ignorar agendamentos cancelados
    )
  );
  const existingAppointments = await query;
  const conflicts = existingAppointments.filter((apt) => {
    if (excludeId && apt.id === excludeId) return false;
    const aptStart = new Date(apt.date);
    const aptEnd = new Date(aptStart.getTime() + apt.duration * 6e4);
    return startTime < aptEnd && endTime > aptStart;
  });
  return {
    hasConflict: conflicts.length > 0,
    conflicts: conflicts.map((c) => ({
      id: c.id,
      clientId: c.clientId,
      date: c.date,
      duration: c.duration,
      service: c.service,
      status: c.status
    }))
  };
}
async function getAllAnamnesis() {
  const db = await getDb();
  if (!db) return [];
  const result = await db.select().from(anamnesisRecords).orderBy(desc(anamnesisRecords.createdAt));
  return result;
}
async function getAnamnesisByClientId(clientId) {
  const db = await getDb();
  if (!db) return [];
  const result = await db.select().from(anamnesisRecords).where(eq(anamnesisRecords.clientId, clientId)).orderBy(desc(anamnesisRecords.id));
  return result;
}
async function getAnamnesisById(id) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(anamnesisRecords).where(eq(anamnesisRecords.id, id)).limit(1);
  return result[0] || null;
}
async function createAnamnesis(data) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(anamnesisRecords).values(data);
  const insertId = Number(result[0].insertId);
  const anamnesis = await db.select().from(anamnesisRecords).where(eq(anamnesisRecords.id, insertId)).limit(1);
  return anamnesis[0];
}
async function listTransactions(studioId) {
  const db = await getDb();
  if (!db) return [];
  if (studioId != null) {
    const result2 = await db.select().from(transactions).where(eq(transactions.studioId, studioId)).orderBy(desc(transactions.date));
    return result2;
  }
  const result = await db.select().from(transactions).orderBy(desc(transactions.date));
  return result;
}
async function getTransactionsByClientId(clientId) {
  const db = await getDb();
  if (!db) return [];
  const result = await db.select().from(transactions).where(eq(transactions.clientId, clientId)).orderBy(desc(transactions.date));
  return result;
}
async function getTransactionsByDateRange(startDate, endDate, studioId) {
  const db = await getDb();
  if (!db) return [];
  const startStr = startDate;
  const endStr = endDate;
  const result = await db.select().from(transactions).where(and(
    gte(transactions.date, startStr),
    lte(transactions.date, endStr),
    ...studioId ? [eq(transactions.studioId, studioId)] : []
  )).orderBy(desc(transactions.date));
  return result;
}
async function createTransaction(data) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(transactions).values(data);
  const insertId = Number(result[0].insertId);
  if (data.type === "entrada" && data.clientId) {
    await db.update(clients).set({ totalSpent: sql2`${clients.totalSpent} + ${data.amount}` }).where(eq(clients.id, data.clientId));
    await updateClientLoyaltyLevel(data.clientId);
  }
  const transaction = await db.select().from(transactions).where(eq(transactions.id, insertId)).limit(1);
  return transaction[0];
}
async function getTransactionById(id) {
  const db = await getDb();
  if (!db) return void 0;
  const result = await db.select().from(transactions).where(eq(transactions.id, id)).limit(1);
  return result[0];
}
async function updateTransaction(id, data) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(transactions).set(data).where(eq(transactions.id, id));
  return { success: true };
}
async function deleteTransaction(id) {
  const db = await getDb();
  if (!db) return false;
  await db.delete(transactions).where(eq(transactions.id, id));
  return true;
}
async function getNotesByClientId(clientId) {
  const db = await getDb();
  if (!db) return [];
  const result = await db.select().from(clientNotes).where(eq(clientNotes.clientId, clientId)).orderBy(desc(clientNotes.createdAt));
  return result;
}
async function createNote(data) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(clientNotes).values(data);
  const insertId = Number(result[0].insertId);
  const note = await db.select().from(clientNotes).where(eq(clientNotes.id, insertId)).limit(1);
  return note[0];
}
async function deleteNote(id) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(clientNotes).where(eq(clientNotes.id, id));
  return { success: true };
}
async function getGalleryByClientId(clientId) {
  const db = await getDb();
  if (!db) return [];
  const result = await db.select().from(galleryImages).where(eq(galleryImages.clientId, clientId)).orderBy(desc(galleryImages.createdAt));
  return result;
}
async function createGalleryImage(data) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(galleryImages).values(data);
  const insertId = Number(result[0].insertId);
  const image = await db.select().from(galleryImages).where(eq(galleryImages.id, insertId)).limit(1);
  return image[0];
}
async function deleteGalleryImage(id) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(galleryImages).where(eq(galleryImages.id, id));
  return { success: true };
}
async function getTopClients(limit = 5) {
  const db = await getDb();
  if (!db) return [];
  const result = await db.select().from(clients).orderBy(desc(clients.totalSpent)).limit(limit);
  return result;
}
async function getUpcomingBirthdays(daysAhead = 30) {
  const db = await getDb();
  if (!db) return [];
  const today = /* @__PURE__ */ new Date();
  const futureDate = /* @__PURE__ */ new Date();
  futureDate.setDate(today.getDate() + daysAhead);
  const allClients = await db.select().from(clients).where(sql2`${clients.birthDate} IS NOT NULL`);
  const upcomingBirthdays = allClients.filter((client) => {
    if (!client.birthDate) return false;
    const birthDate = new Date(client.birthDate);
    const thisYearBirthday = new Date(today.getFullYear(), birthDate.getMonth(), birthDate.getDate());
    if (thisYearBirthday < today) {
      thisYearBirthday.setFullYear(today.getFullYear() + 1);
    }
    return thisYearBirthday >= today && thisYearBirthday <= futureDate;
  });
  upcomingBirthdays.sort((a, b) => {
    const aDate = new Date(a.birthDate);
    const bDate = new Date(b.birthDate);
    const aThisYear = new Date(today.getFullYear(), aDate.getMonth(), aDate.getDate());
    const bThisYear = new Date(today.getFullYear(), bDate.getMonth(), bDate.getDate());
    if (aThisYear < today) aThisYear.setFullYear(today.getFullYear() + 1);
    if (bThisYear < today) bThisYear.setFullYear(today.getFullYear() + 1);
    return aThisYear.getTime() - bThisYear.getTime();
  });
  return upcomingBirthdays;
}
async function getDashboardMetrics() {
  const db = await getDb();
  if (!db) return {
    totalClients: 0,
    totalAppointments: 0,
    totalRevenue: 0,
    upcomingBirthdaysCount: 0
  };
  const clientsCount = await db.select({ count: sql2`count(*)` }).from(clients);
  const totalClients = clientsCount[0]?.count || 0;
  const appointmentsCount = await db.select({ count: sql2`count(*)` }).from(appointments);
  const totalAppointments = appointmentsCount[0]?.count || 0;
  const revenueSum = await db.select({ sum: sql2`COALESCE(SUM(${transactions.amount}), 0)` }).from(transactions).where(eq(transactions.type, "entrada"));
  const totalRevenue = revenueSum[0]?.sum || 0;
  const birthdays = await getUpcomingBirthdays(30);
  const upcomingBirthdaysCount = birthdays.length;
  return {
    totalClients,
    totalAppointments,
    totalRevenue,
    upcomingBirthdaysCount
  };
}
async function getMonthlyRevenue(startDate, endDate, studioId) {
  const db = await getDb();
  if (!db) return [];
  const startStr = startDate;
  const endStr = endDate;
  const result = await db.select({
    month: sql2`DATE_FORMAT(${transactions.date}, '%Y-%m')`,
    revenue: sql2`COALESCE(SUM(CASE WHEN ${transactions.type} = 'entrada' THEN ${transactions.amount} ELSE 0 END), 0)`,
    expenses: sql2`COALESCE(SUM(CASE WHEN ${transactions.type} = 'saida' THEN ${transactions.amount} ELSE 0 END), 0)`
  }).from(transactions).where(
    and(
      gte(transactions.date, startStr),
      lte(transactions.date, endStr),
      ...studioId ? [eq(transactions.studioId, studioId)] : []
    )
  ).groupBy(sql2`DATE_FORMAT(${transactions.date}, '%Y-%m')`).orderBy(sql2`DATE_FORMAT(${transactions.date}, '%Y-%m')`);
  return result.map((r) => ({
    month: r.month,
    revenue: Number(r.revenue),
    expenses: Number(r.expenses),
    profit: Number(r.revenue) - Number(r.expenses)
  }));
}
async function getCategoryBreakdown(startDate, endDate, studioId) {
  const db = await getDb();
  if (!db) return [];
  const startStr = startDate;
  const endStr = endDate;
  const result = await db.select({
    category: transactions.category,
    total: sql2`COALESCE(SUM(${transactions.amount}), 0)`,
    count: sql2`COUNT(*)`
  }).from(transactions).where(
    and(
      eq(transactions.type, "entrada"),
      gte(transactions.date, startStr),
      lte(transactions.date, endStr),
      ...studioId ? [eq(transactions.studioId, studioId)] : []
    )
  ).groupBy(transactions.category).orderBy(desc(sql2`COALESCE(SUM(${transactions.amount}), 0)`));
  return result.map((r) => ({
    category: r.category,
    total: Number(r.total),
    count: Number(r.count)
  }));
}
async function getPaymentMethodBreakdown(startDate, endDate, studioId) {
  const db = await getDb();
  if (!db) return [];
  const result = await db.select({
    paymentMethod: transactions.paymentMethod,
    total: sql2`COALESCE(SUM(${transactions.amount}), 0)`,
    count: sql2`COUNT(*)`
  }).from(transactions).where(
    and(
      eq(transactions.type, "entrada"),
      gte(transactions.date, toDateStr(startDate)),
      lte(transactions.date, toDateStr(endDate)),
      ...studioId ? [eq(transactions.studioId, studioId)] : []
    )
  ).groupBy(transactions.paymentMethod).orderBy(desc(sql2`COALESCE(SUM(${transactions.amount}), 0)`));
  return result.map((r) => ({
    paymentMethod: r.paymentMethod,
    total: Number(r.total),
    count: Number(r.count)
  }));
}
async function getFinancialSummary(startDate, endDate, studioId) {
  const db = await getDb();
  if (!db) return {
    totalRevenue: 0,
    totalExpenses: 0,
    balance: 0,
    transactionCount: 0
  };
  const result = await db.select({
    revenue: sql2`COALESCE(SUM(CASE WHEN ${transactions.type} = 'entrada' THEN ${transactions.amount} ELSE 0 END), 0)`,
    expenses: sql2`COALESCE(SUM(CASE WHEN ${transactions.type} = 'saida' THEN ${transactions.amount} ELSE 0 END), 0)`,
    count: sql2`COUNT(*)`
  }).from(transactions).where(
    and(
      gte(transactions.date, toDateStr(startDate)),
      lte(transactions.date, toDateStr(endDate)),
      ...studioId ? [eq(transactions.studioId, studioId)] : []
    )
  );
  const data = result[0];
  const totalRevenue = Number(data?.revenue || 0);
  const totalExpenses = Number(data?.expenses || 0);
  return {
    totalRevenue,
    totalExpenses,
    balance: totalRevenue - totalExpenses,
    transactionCount: Number(data?.count || 0)
  };
}
async function searchAppointments(term, startDate, endDate) {
  const db = await getDb();
  if (!db) return [];
  const searchTerm = `%${term}%`;
  const conditions = [
    or(
      like(appointments.service, searchTerm),
      like(appointments.artist, searchTerm),
      like(clients.name, searchTerm)
    )
  ];
  if (startDate) {
    conditions.push(gte(appointments.date, toDateStr(startDate)));
  }
  if (endDate) {
    conditions.push(lte(appointments.date, toDateStr(endDate)));
  }
  const result = await db.select({
    id: appointments.id,
    clientId: appointments.clientId,
    clientName: clients.name,
    date: appointments.date,
    duration: appointments.duration,
    service: appointments.service,
    artist: appointments.artist,
    status: appointments.status
  }).from(appointments).leftJoin(clients, eq(appointments.clientId, clients.id)).where(and(...conditions)).orderBy(desc(appointments.date)).limit(10);
  return result;
}
async function searchTransactions(term, startDate, endDate) {
  const db = await getDb();
  if (!db) return [];
  const searchTerm = `%${term}%`;
  const conditions = [
    or(
      like(transactions.category, searchTerm),
      like(transactions.description, searchTerm),
      like(clients.name, searchTerm)
    )
  ];
  if (startDate) {
    conditions.push(gte(transactions.date, toDateStr(startDate)));
  }
  if (endDate) {
    conditions.push(lte(transactions.date, toDateStr(endDate)));
  }
  const result = await db.select({
    id: transactions.id,
    clientId: transactions.clientId,
    clientName: clients.name,
    type: transactions.type,
    category: transactions.category,
    description: transactions.description,
    amount: transactions.amount,
    paymentMethod: transactions.paymentMethod,
    date: transactions.date
  }).from(transactions).leftJoin(clients, eq(transactions.clientId, clients.id)).where(and(...conditions)).orderBy(desc(transactions.date)).limit(10);
  return result;
}
async function getUpcomingAppointments(studioId, artistId) {
  const db = await getDb();
  if (!db) return [];
  const now = /* @__PURE__ */ new Date();
  const tomorrowStart = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 1,
    0,
    0,
    0
  );
  const tomorrowEnd = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 1,
    23,
    59,
    59
  );
  const alreadySentRows = await db.select({ appointmentId: notificationLogs.appointmentId }).from(notificationLogs).where(
    and(
      eq(notificationLogs.type, "appointment_reminder"),
      eq(notificationLogs.status, "sent")
    )
  );
  const alreadySentIds = new Set(
    alreadySentRows.map((r) => r.appointmentId).filter((id) => id !== null)
  );
  const baseCondition = and(
    gte(appointments.date, toLocalDateStr(tomorrowStart)),
    lte(appointments.date, toLocalDateStr(tomorrowEnd)),
    or(
      eq(appointments.status, "agendado"),
      eq(appointments.status, "confirmado")
    )
  );
  const scopedCondition = studioId != null && artistId != null ? and(baseCondition, eq(appointments.studioId, studioId), eq(appointments.artistId, artistId)) : studioId != null ? and(baseCondition, eq(appointments.studioId, studioId)) : baseCondition;
  const result = await db.select({
    id: appointments.id,
    clientId: appointments.clientId,
    clientName: clients.name,
    clientPhone: clients.phone,
    clientEmail: clients.email,
    date: appointments.date,
    duration: appointments.duration,
    service: appointments.service,
    artist: appointments.artist,
    artistId: appointments.artistId,
    studioId: appointments.studioId,
    status: appointments.status
  }).from(appointments).leftJoin(clients, eq(appointments.clientId, clients.id)).where(scopedCondition).orderBy(appointments.date);
  return result.filter((apt) => !alreadySentIds.has(apt.id));
}
async function sendAppointmentReminders() {
  const db = await getDb();
  if (!db) return { success: false, sent: 0, failed: 0 };
  const upcomingAppointments = await getUpcomingAppointments();
  if (upcomingAppointments.length === 0) {
    return { success: true, sent: 0, failed: 0, total: 0 };
  }
  const { notifyOwner: notifyOwner2 } = await Promise.resolve().then(() => (init_notification(), notification_exports));
  const firstDate = new Date(upcomingAppointments[0].date);
  const tomorrowFormatted = firstDate.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  });
  const title = `\u{1F4C5} ${upcomingAppointments.length} agendamento(s) amanh\xE3 \u2014 ${tomorrowFormatted}`;
  const lines = upcomingAppointments.map((apt) => {
    const time = new Date(apt.date).toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit"
    });
    return `\u2022 ${time} \u2014 ${apt.clientName ?? "Cliente"} | ${apt.service} | ${apt.artist}`;
  });
  const message = `Resumo dos agendamentos de amanh\xE3:

${lines.join("\n")}`;
  let sent = 0;
  let failed = 0;
  try {
    const success = await notifyOwner2({ title, content: message });
    const status = success ? "sent" : "failed";
    for (const appointment of upcomingAppointments) {
      await db.insert(notificationLogs).values({
        type: "appointment_reminder",
        appointmentId: appointment.id,
        clientId: appointment.clientId,
        title,
        message,
        status
      });
    }
    if (success) {
      sent = upcomingAppointments.length;
    } else {
      failed = upcomingAppointments.length;
    }
  } catch (error) {
    console.error("[Scheduler] Erro ao enviar resumo de lembretes:", error);
    failed = upcomingAppointments.length;
    for (const appointment of upcomingAppointments) {
      try {
        await db.insert(notificationLogs).values({
          type: "appointment_reminder",
          appointmentId: appointment.id,
          clientId: appointment.clientId,
          title: "Erro ao enviar resumo de lembretes",
          message: `Erro: ${error}`,
          status: "failed"
        });
      } catch (_) {
      }
    }
  }
  return { success: true, sent, failed, total: upcomingAppointments.length };
}
async function getNotificationLogs(limit = 50) {
  const db = await getDb();
  if (!db) return [];
  const result = await db.select({
    id: notificationLogs.id,
    type: notificationLogs.type,
    appointmentId: notificationLogs.appointmentId,
    clientId: notificationLogs.clientId,
    clientName: clients.name,
    title: notificationLogs.title,
    message: notificationLogs.message,
    status: notificationLogs.status,
    sentAt: notificationLogs.sentAt
  }).from(notificationLogs).leftJoin(clients, eq(notificationLogs.clientId, clients.id)).orderBy(desc(notificationLogs.sentAt)).limit(limit);
  return result;
}
async function getStudioSettings() {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(studioSettings).limit(1);
  return result.length > 0 ? result[0] : null;
}
async function updateStudioSettings(settings) {
  const db = await getDb();
  if (!db) return null;
  const existing = await getStudioSettings();
  if (existing) {
    await db.update(studioSettings).set({ ...settings, updatedAt: toDateStr(/* @__PURE__ */ new Date()) }).where(eq(studioSettings.id, existing.id));
    const updated = await getStudioSettings();
    return updated;
  } else {
    const [inserted] = await db.insert(studioSettings).values(settings);
    const newSettings = await getStudioSettings();
    return newSettings;
  }
}
async function listArtists(studioId, artistId) {
  const db = await getDb();
  if (!db) return [];
  if (studioId != null && artistId != null) {
    return await db.select().from(artists).where(and(eq(artists.studioId, studioId), eq(artists.id, artistId))).orderBy(artists.name);
  }
  if (studioId != null) {
    return await db.select().from(artists).where(eq(artists.studioId, studioId)).orderBy(artists.name);
  }
  return await db.select().from(artists).orderBy(artists.name);
}
async function getArtistById(id, studioId) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(artists).where(studioId != null ? and(eq(artists.id, id), eq(artists.studioId, studioId)) : eq(artists.id, id)).limit(1);
  return result.length > 0 ? result[0] : null;
}
async function createArtist(artist) {
  const db = await getDb();
  if (!db) {
    console.error("[createArtist] Database not available");
    throw new Error("Database not available");
  }
  try {
    console.log("[createArtist] Creating artist with data:", artist);
    const [inserted] = await db.insert(artists).values(artist);
    console.log("[createArtist] Artist created with ID:", inserted.insertId);
    return await getArtistById(inserted.insertId);
  } catch (error) {
    console.error("[createArtist] Error creating artist:", error);
    throw error;
  }
}
async function updateArtist(id, artist) {
  const db = await getDb();
  if (!db) return null;
  await db.update(artists).set({ ...artist, updatedAt: toDateStr(/* @__PURE__ */ new Date()) }).where(eq(artists.id, id));
  return await getArtistById(id);
}
async function deleteArtist(id) {
  const db = await getDb();
  if (!db) return false;
  await db.delete(artists).where(eq(artists.id, id));
  return true;
}
async function createAuditLog(data) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot create audit log: database not available");
    return void 0;
  }
  const result = await db.insert(auditLogs).values({
    userId: data.userId,
    userName: data.userName,
    action: data.action,
    entity: data.entity,
    entityId: data.entityId ?? null,
    entityName: data.entityName ?? null,
    details: data.details ? JSON.stringify(data.details) : null,
    ipAddress: data.ipAddress ?? null,
    userAgent: data.userAgent ?? null
  });
  return result;
}
async function listAuditLogs(filters) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot list audit logs: database not available");
    return [];
  }
  let query = db.select().from(auditLogs);
  const conditions = [];
  if (filters?.action && filters.action !== "all") {
    conditions.push(eq(auditLogs.action, filters.action));
  }
  if (filters?.entity && filters.entity !== "all") {
    conditions.push(eq(auditLogs.entity, filters.entity));
  }
  if (filters?.startDate) {
    const year = filters.startDate.getFullYear();
    const month = String(filters.startDate.getMonth() + 1).padStart(2, "0");
    const day = String(filters.startDate.getDate()).padStart(2, "0");
    const hours = String(filters.startDate.getHours()).padStart(2, "0");
    const minutes = String(filters.startDate.getMinutes()).padStart(2, "0");
    const seconds = String(filters.startDate.getSeconds()).padStart(2, "0");
    const startStr = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
    conditions.push(gte(auditLogs.createdAt, startStr));
  }
  if (filters?.endDate) {
    const year = filters.endDate.getFullYear();
    const month = String(filters.endDate.getMonth() + 1).padStart(2, "0");
    const day = String(filters.endDate.getDate()).padStart(2, "0");
    const hours = String(filters.endDate.getHours()).padStart(2, "0");
    const minutes = String(filters.endDate.getMinutes()).padStart(2, "0");
    const seconds = String(filters.endDate.getSeconds()).padStart(2, "0");
    const endStr = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
    conditions.push(lte(auditLogs.createdAt, endStr));
  }
  if (filters?.userId) {
    conditions.push(eq(auditLogs.userId, filters.userId));
  }
  if (conditions.length > 0) {
    query = query.where(and(...conditions));
  }
  query = query.orderBy(desc(auditLogs.createdAt));
  if (filters?.limit) {
    query = query.limit(filters.limit);
  }
  const result = await query;
  return result;
}
async function searchAuditLogs(term) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot search audit logs: database not available");
    return [];
  }
  const result = await db.select().from(auditLogs).where(
    or(
      like(auditLogs.userName, `%${term}%`),
      like(auditLogs.entityName, `%${term}%`),
      like(auditLogs.details, `%${term}%`)
    )
  ).orderBy(desc(auditLogs.createdAt)).limit(100);
  return result;
}
async function getAuditStatistics(startDate, endDate) {
  const db = await getDb();
  if (!db) return {
    totalActions: 0,
    actionsLast24h: 0,
    mostActiveUser: null,
    mostModifiedEntity: null
  };
  const now = /* @__PURE__ */ new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1e3);
  const totalResult = await db.select({ count: sql2`COUNT(*)` }).from(auditLogs).where(
    startDate && endDate ? and(
      gte(auditLogs.createdAt, toDateStr(startDate)),
      lte(auditLogs.createdAt, toDateStr(endDate))
    ) : void 0
  );
  const totalActions = Number(totalResult[0]?.count || 0);
  const last24hResult = await db.select({ count: sql2`COUNT(*)` }).from(auditLogs).where(gte(auditLogs.createdAt, toDateStr(yesterday)));
  const actionsLast24h = Number(last24hResult[0]?.count || 0);
  const mostActiveUserResult = await db.select({
    userName: auditLogs.userName,
    count: sql2`COUNT(*)`
  }).from(auditLogs).where(
    startDate && endDate ? and(
      gte(auditLogs.createdAt, toDateStr(startDate)),
      lte(auditLogs.createdAt, toDateStr(endDate))
    ) : void 0
  ).groupBy(auditLogs.userName).orderBy(desc(sql2`COUNT(*)`));
  const mostActiveUserstActiveUser = mostActiveUserResult[0] ? { name: mostActiveUserResult[0].userName, count: Number(mostActiveUserResult[0].count) } : null;
  const mostModifiedEntityResult = await db.select({
    entity: auditLogs.entity,
    count: sql2`COUNT(*)`
  }).from(auditLogs).where(
    startDate && endDate ? and(
      gte(auditLogs.createdAt, toDateStr(startDate)),
      lte(auditLogs.createdAt, toDateStr(endDate))
    ) : void 0
  ).groupBy(auditLogs.entity).orderBy(desc(sql2`COUNT(*)`));
  const mostActiveUser = mostActiveUserResult[0] ? { name: mostActiveUserResult[0].userName, count: Number(mostActiveUserResult[0].count) } : null;
  const mostModifiedEntity = mostModifiedEntityResult[0] ? { entity: mostModifiedEntityResult[0].entity, count: Number(mostModifiedEntityResult[0].count) } : null;
  return {
    totalActions,
    actionsLast24h,
    mostActiveUser,
    mostModifiedEntity
  };
}
async function getAuditActionsByDay(startDate, endDate) {
  const db = await getDb();
  if (!db) return [];
  const result = await db.select({
    date: sql2`DATE(${auditLogs.createdAt})`.as("date"),
    count: sql2`COUNT(*)`.as("count")
  }).from(auditLogs).where(
    and(
      gte(auditLogs.createdAt, toDateStr(startDate)),
      lte(auditLogs.createdAt, toDateStr(endDate))
    )
  ).groupBy(sql2`date`).orderBy(sql2`date`);
  return result.map((r) => ({
    date: r.date,
    count: Number(r.count)
  }));
}
async function getAuditActionsByType(startDate, endDate) {
  const db = await getDb();
  if (!db) return [];
  const result = await db.select({
    action: auditLogs.action,
    count: sql2`COUNT(*)`
  }).from(auditLogs).where(
    startDate && endDate ? and(
      gte(auditLogs.createdAt, toDateStr(startDate)),
      lte(auditLogs.createdAt, toDateStr(endDate))
    ) : void 0
  ).groupBy(auditLogs.action).orderBy(desc(sql2`COUNT(*)`));
  return result.map((r) => ({
    action: r.action,
    count: Number(r.count)
  }));
}
async function getAuditActionsByEntity(startDate, endDate) {
  const db = await getDb();
  if (!db) return [];
  const result = await db.select({
    entity: auditLogs.entity,
    count: sql2`COUNT(*)`
  }).from(auditLogs).where(
    startDate && endDate ? and(
      gte(auditLogs.createdAt, toDateStr(startDate)),
      lte(auditLogs.createdAt, toDateStr(endDate))
    ) : void 0
  ).groupBy(auditLogs.entity).orderBy(desc(sql2`COUNT(*)`));
  return result.map((r) => ({
    entity: r.entity,
    count: Number(r.count)
  }));
}
async function getTopActiveUsers(limit = 5, startDate, endDate) {
  const db = await getDb();
  if (!db) return [];
  const result = await db.select({
    userName: auditLogs.userName,
    count: sql2`COUNT(*)`
  }).from(auditLogs).where(
    startDate && endDate ? and(
      gte(auditLogs.createdAt, toDateStr(startDate)),
      lte(auditLogs.createdAt, toDateStr(endDate))
    ) : void 0
  ).groupBy(auditLogs.userName).orderBy(desc(sql2`COUNT(*)`));
  return result.map((r) => ({
    userName: r.userName,
    count: Number(r.count)
  }));
}
async function getAuditHeatmap(startDate, endDate) {
  const db = await getDb();
  if (!db) return [];
  const result = await db.select({
    hour: sql2`HOUR(${auditLogs.createdAt})`.as("hour"),
    dayOfWeek: sql2`DAYOFWEEK(${auditLogs.createdAt})`.as("dayOfWeek"),
    count: sql2`COUNT(*)`.as("count")
  }).from(auditLogs).where(
    startDate && endDate ? and(
      gte(auditLogs.createdAt, toDateStr(startDate)),
      lte(auditLogs.createdAt, toDateStr(endDate))
    ) : void 0
  ).groupBy(sql2`hour`, sql2`dayOfWeek`).orderBy(sql2`dayOfWeek`, sql2`hour`);
  return result.map((r) => ({
    hour: Number(r.hour),
    dayOfWeek: Number(r.dayOfWeek),
    count: Number(r.count)
  }));
}
async function createReportTemplate(data) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }
  const [result] = await db.insert(reportTemplates).values({
    userId: data.userId,
    name: data.name,
    description: data.description,
    includeSections: JSON.stringify(data.includeSections),
    sectionOrder: JSON.stringify(data.sectionOrder),
    logsLimit: data.logsLimit,
    usersLimit: data.usersLimit,
    reportTitle: data.reportTitle,
    reportSubtitle: data.reportSubtitle,
    primaryColor: data.primaryColor || "#8b5cf6",
    logoUrl: data.logoUrl,
    logoKey: data.logoKey,
    footerText: data.footerText
  });
  return Number(result.insertId);
}
async function listReportTemplates(userId) {
  const db = await getDb();
  if (!db) return [];
  const templates = await db.select().from(reportTemplates).where(eq(reportTemplates.userId, userId)).orderBy(desc(reportTemplates.createdAt));
  return templates.map((t2) => ({
    ...t2,
    includeSections: JSON.parse(t2.includeSections),
    sectionOrder: JSON.parse(t2.sectionOrder)
  }));
}
async function getReportTemplate(id, userId) {
  const db = await getDb();
  if (!db) return null;
  const template = await db.select().from(reportTemplates).where(and(eq(reportTemplates.id, id), eq(reportTemplates.userId, userId))).limit(1);
  if (template.length === 0) return null;
  return {
    ...template[0],
    includeSections: JSON.parse(template[0].includeSections),
    sectionOrder: JSON.parse(template[0].sectionOrder)
  };
}
async function updateReportTemplate(id, userId, data) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }
  const updateData = {};
  if (data.name !== void 0) updateData.name = data.name;
  if (data.description !== void 0) updateData.description = data.description;
  if (data.includeSections !== void 0) updateData.includeSections = JSON.stringify(data.includeSections);
  if (data.sectionOrder !== void 0) updateData.sectionOrder = JSON.stringify(data.sectionOrder);
  if (data.logsLimit !== void 0) updateData.logsLimit = data.logsLimit;
  if (data.usersLimit !== void 0) updateData.usersLimit = data.usersLimit;
  if (data.reportTitle !== void 0) updateData.reportTitle = data.reportTitle;
  if (data.reportSubtitle !== void 0) updateData.reportSubtitle = data.reportSubtitle;
  if (data.primaryColor !== void 0) updateData.primaryColor = data.primaryColor;
  if (data.logoUrl !== void 0) updateData.logoUrl = data.logoUrl;
  if (data.logoKey !== void 0) updateData.logoKey = data.logoKey;
  if (data.footerText !== void 0) updateData.footerText = data.footerText;
  await db.update(reportTemplates).set(updateData).where(and(eq(reportTemplates.id, id), eq(reportTemplates.userId, userId)));
  return true;
}
async function deleteReportTemplate(id, userId) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }
  await db.delete(reportTemplates).where(and(eq(reportTemplates.id, id), eq(reportTemplates.userId, userId)));
  return true;
}
async function listCalendars(userId) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }
  return await db.select().from(calendars).where(eq(calendars.userId, userId)).orderBy(calendars.name);
}
async function getCalendarById(id, userId) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }
  const results = await db.select().from(calendars).where(
    and(eq(calendars.id, id), eq(calendars.userId, userId))
  );
  return results[0];
}
async function updateCalendar(id, userId, updateData) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }
  await db.update(calendars).set(updateData).where(
    and(eq(calendars.id, id), eq(calendars.userId, userId))
  );
  return true;
}
async function deleteCalendar(id, userId) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }
  await db.delete(calendars).where(
    and(eq(calendars.id, id), eq(calendars.userId, userId))
  );
  return true;
}
async function toggleCalendarVisibility(id, userId, isVisible) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }
  await db.update(calendars).set({ isVisible }).where(
    and(eq(calendars.id, id), eq(calendars.userId, userId))
  );
  return true;
}
async function createAnamneseRequest(data) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }
  const result = await db.insert(anamneseRequests).values(data);
  return result[0].insertId;
}
async function getAnamneseRequestByToken(token) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }
  const result = await db.select().from(anamneseRequests).where(eq(anamneseRequests.token, token));
  return result[0] || null;
}
async function markAnamneseRequestCompleted(requestId) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }
  await db.update(anamneseRequests).set({ completedAt: toDateStr(/* @__PURE__ */ new Date()) }).where(eq(anamneseRequests.id, requestId));
}
async function createAnamneseSubmission(data) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }
  const result = await db.insert(anamneseSubmissions).values(data);
  return result[0].insertId;
}
async function getAnamneseSubmissionsByClientId(clientId) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }
  const result = await db.select().from(anamneseSubmissions).where(eq(anamneseSubmissions.clientId, clientId)).orderBy(desc(anamneseSubmissions.createdAt));
  return result;
}
async function getAnamneseRequestsByClientId(clientId) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }
  const result = await db.select({
    id: anamneseRequests.id,
    clientId: anamneseRequests.clientId,
    appointmentId: anamneseRequests.appointmentId,
    token: anamneseRequests.token,
    sentVia: anamneseRequests.sentVia,
    sentTo: anamneseRequests.sentTo,
    expiresAt: anamneseRequests.expiresAt,
    completedAt: anamneseRequests.completedAt,
    createdAt: anamneseRequests.createdAt,
    payloadJson: anamneseSubmissions.payloadJson,
    submissionId: anamneseSubmissions.id
  }).from(anamneseRequests).leftJoin(anamneseSubmissions, eq(anamneseSubmissions.requestId, anamneseRequests.id)).where(eq(anamneseRequests.clientId, clientId)).orderBy(desc(anamneseRequests.createdAt));
  return result;
}
async function listStudios() {
  const db = await getDb();
  if (!db) return [];
  const result = await db.select().from(studios).where(eq(studios.isActive, 1));
  return result;
}
async function getStudioById(id) {
  const db = await getDb();
  if (!db) return void 0;
  const result = await db.select().from(studios).where(eq(studios.id, id));
  return result.length > 0 ? result[0] : void 0;
}
async function getFirstStudio() {
  const db = await getDb();
  if (!db) return void 0;
  const result = await db.select().from(studios).where(eq(studios.isActive, 1)).limit(1);
  return result.length > 0 ? result[0] : void 0;
}
async function getArtistRevenue(startDate, endDate, groupBy = "month", studioId = null) {
  const db = await getDb();
  if (!db) return [];
  let dateFormat;
  switch (groupBy) {
    case "week":
      dateFormat = "%Y-%u";
      break;
    case "bimonth":
      dateFormat = "%Y-%m";
      break;
    case "year":
      dateFormat = "%Y";
      break;
    case "month":
    default:
      dateFormat = "%Y-%m";
  }
  const result = await db.execute(sql2`
    SELECT 
      artist_name,
      period,
      SUM(appointment_count) as appointment_count,
      SUM(completed_count) as completed_count,
      SUM(revenue) as revenue,
      CASE WHEN SUM(appointment_count) > 0 THEN SUM(revenue) / SUM(appointment_count) ELSE 0 END as avg_ticket
    FROM (
      -- Via appointments com transações vinculadas
      SELECT 
        a.artist as artist_name,
        DATE_FORMAT(a.date, ${dateFormat}) as period,
        COUNT(DISTINCT a.id) as appointment_count,
        SUM(CASE WHEN a.status = 'concluido' THEN 1 ELSE 0 END) as completed_count,
        COALESCE(SUM(t.amount), 0) / 100.0 as revenue
      FROM appointments a
      INNER JOIN transactions t ON t.appointmentId = a.id AND t.type = 'entrada'
      WHERE a.date >= ${startDate}
        AND a.date <= ${endDate}
        AND (${studioId != null ? sql2`a.studioId = ${studioId}` : sql2`1=1`})
        AND a.artist IS NOT NULL
        AND a.artist != ''
      GROUP BY a.artist, DATE_FORMAT(a.date, ${dateFormat})
      
      UNION ALL
      
      -- Via transações sem appointmentId (extraindo artista da descrição)
      SELECT 
        SUBSTRING_INDEX(t.description, ' com ', -1) as artist_name,
        DATE_FORMAT(t.date, ${dateFormat}) as period,
        COUNT(t.id) as appointment_count,
        0 as completed_count,
        SUM(t.amount) / 100.0 as revenue
      FROM transactions t
      WHERE t.date >= ${startDate}
        AND t.date <= ${endDate}
        AND (${studioId != null ? sql2`t.studioId = ${studioId}` : sql2`1=1`})
        AND t.type = 'entrada'
        AND t.appointmentId IS NULL
        AND t.description LIKE '% com %'
      GROUP BY SUBSTRING_INDEX(t.description, ' com ', -1), DATE_FORMAT(t.date, ${dateFormat})
    ) combined
    GROUP BY artist_name, period
    ORDER BY period ASC, revenue DESC
  `);
  const rows = result[0];
  if (groupBy === "bimonth") {
    const bimonthMap = /* @__PURE__ */ new Map();
    for (const row of rows) {
      const [year, month] = row.period.split("-");
      const monthNum = parseInt(month);
      const bimonth = Math.ceil(monthNum / 2);
      const bimonthKey = `${year}-B${bimonth}`;
      if (!bimonthMap.has(row.artist_name)) {
        bimonthMap.set(row.artist_name, /* @__PURE__ */ new Map());
      }
      const artistMap = bimonthMap.get(row.artist_name);
      if (!artistMap.has(bimonthKey)) {
        artistMap.set(bimonthKey, { revenue: 0, appointments: 0, completed: 0, avgTicket: 0 });
      }
      const entry = artistMap.get(bimonthKey);
      entry.revenue += Number(row.revenue);
      entry.appointments += Number(row.appointment_count);
      entry.completed += Number(row.completed_count);
    }
    const bimonthRows = [];
    for (const [artist, periods] of Array.from(bimonthMap.entries())) {
      for (const [period, data] of Array.from(periods.entries())) {
        bimonthRows.push({
          artist_name: artist,
          period,
          appointment_count: data.appointments,
          completed_count: data.completed,
          revenue: data.revenue,
          avg_ticket: data.appointments > 0 ? data.revenue / data.appointments : 0
        });
      }
    }
    bimonthRows.sort((a, b) => a.period.localeCompare(b.period) || b.revenue - a.revenue);
    return formatArtistRevenueResult(bimonthRows, groupBy);
  }
  return formatArtistRevenueResult(rows, groupBy);
}
function formatArtistRevenueResult(rows, groupBy) {
  const artistTotals = /* @__PURE__ */ new Map();
  for (const row of rows) {
    if (!artistTotals.has(row.artist_name)) {
      artistTotals.set(row.artist_name, { totalRevenue: 0, totalAppointments: 0, periods: [] });
    }
    const artist = artistTotals.get(row.artist_name);
    artist.totalRevenue += Number(row.revenue);
    artist.totalAppointments += Number(row.appointment_count);
    artist.periods.push(row);
  }
  let grandTotal = 0;
  for (const entry of Array.from(artistTotals.entries())) {
    grandTotal += entry[1].totalRevenue;
  }
  const artistsList = Array.from(artistTotals.entries()).map(([name, data]) => ({
    name,
    totalRevenue: Math.round(data.totalRevenue * 100) / 100,
    totalAppointments: data.totalAppointments,
    percentage: grandTotal > 0 ? Math.round(data.totalRevenue / grandTotal * 1e4) / 100 : 0,
    avgTicket: data.totalAppointments > 0 ? Math.round(data.totalRevenue / data.totalAppointments * 100) / 100 : 0,
    periods: data.periods.map((p) => ({
      period: p.period,
      revenue: Math.round(Number(p.revenue) * 100) / 100,
      appointments: Number(p.appointment_count),
      completed: Number(p.completed_count),
      avgTicket: Math.round(Number(p.avg_ticket) * 100) / 100
    }))
  })).sort((a, b) => b.totalRevenue - a.totalRevenue);
  const allPeriods = Array.from(new Set(rows.map((r) => r.period))).sort();
  return {
    artists: artistsList,
    periods: allPeriods,
    grandTotal: Math.round(grandTotal * 100) / 100,
    groupBy
  };
}
async function listSuppliers(activeOnly = true) {
  const db = await getDb();
  if (!db) return [];
  const conditions = activeOnly ? [eq(suppliers.isActive, 1)] : [];
  return db.select().from(suppliers).where(conditions.length ? and(...conditions) : void 0).orderBy(suppliers.name);
}
async function getSupplierById(id) {
  const db = await getDb();
  if (!db) return void 0;
  const rows = await db.select().from(suppliers).where(eq(suppliers.id, id));
  return rows[0];
}
async function createSupplier(data) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const now = Date.now();
  const result = await db.insert(suppliers).values({ ...data, createdAt: now, updatedAt: now });
  return result[0].insertId;
}
async function updateSupplier(id, data) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(suppliers).set({ ...data, updatedAt: Date.now() }).where(eq(suppliers.id, id));
}
async function deleteSupplier(id) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(suppliers).set({ isActive: 0 }).where(eq(suppliers.id, id));
}
async function listMaterials(activeOnly = true) {
  const db = await getDb();
  if (!db) return [];
  const conditions = activeOnly ? [eq(materials.isActive, 1)] : [];
  const rows = await db.select({
    id: materials.id,
    name: materials.name,
    category: materials.category,
    unit: materials.unit,
    currentStock: materials.currentStock,
    minStock: materials.minStock,
    avgPrice: materials.avgPrice,
    supplierId: materials.supplierId,
    supplierName: suppliers.name,
    notes: materials.notes,
    isActive: materials.isActive,
    createdAt: materials.createdAt,
    updatedAt: materials.updatedAt
  }).from(materials).leftJoin(suppliers, eq(suppliers.id, materials.supplierId)).where(conditions.length ? and(...conditions) : void 0).orderBy(materials.category, materials.name);
  return rows;
}
async function getMaterialById(id) {
  const db = await getDb();
  if (!db) return void 0;
  const rows = await db.select().from(materials).where(eq(materials.id, id));
  return rows[0];
}
async function createMaterial(data) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const now = Date.now();
  const result = await db.insert(materials).values({ ...data, createdAt: now, updatedAt: now });
  return result[0].insertId;
}
async function updateMaterial(id, data) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(materials).set({ ...data, updatedAt: Date.now() }).where(eq(materials.id, id));
}
async function deleteMaterial(id) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(materials).set({ isActive: 0 }).where(eq(materials.id, id));
}
async function getLowStockMaterials() {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select({
    id: materials.id,
    name: materials.name,
    category: materials.category,
    unit: materials.unit,
    currentStock: materials.currentStock,
    minStock: materials.minStock,
    supplierName: suppliers.name,
    supplierWhatsapp: suppliers.whatsapp
  }).from(materials).leftJoin(suppliers, eq(suppliers.id, materials.supplierId)).where(and(
    eq(materials.isActive, 1),
    sql2`CAST(${materials.currentStock} AS DECIMAL(10,2)) <= CAST(${materials.minStock} AS DECIMAL(10,2))`,
    sql2`CAST(${materials.minStock} AS DECIMAL(10,2)) > 0`
  )).orderBy(materials.category, materials.name);
  return rows;
}
async function listStockMovements(materialId, limit = 50) {
  const db = await getDb();
  if (!db) return [];
  const conditions = materialId ? [eq(stockMovements.materialId, materialId)] : [];
  return db.select().from(stockMovements).where(conditions.length ? and(...conditions) : void 0).orderBy(desc(stockMovements.createdAt)).limit(limit);
}
async function addStockMovement(data) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const mat = await getMaterialById(data.materialId);
  if (!mat) throw new Error("Material n\xE3o encontrado");
  const previousStock = parseFloat(String(mat.currentStock)) || 0;
  let newStock;
  if (data.type === "entrada") {
    newStock = previousStock + data.quantity;
  } else if (data.type === "saida") {
    newStock = Math.max(0, previousStock - data.quantity);
  } else {
    newStock = data.quantity;
  }
  await db.insert(stockMovements).values({
    materialId: data.materialId,
    type: data.type,
    quantity: String(data.quantity),
    previousStock: String(previousStock),
    newStock: String(newStock),
    reason: data.reason,
    notes: data.notes,
    createdBy: data.createdBy,
    createdAt: Date.now()
  });
  await db.update(materials).set({ currentStock: String(newStock) }).where(eq(materials.id, data.materialId));
  return { previousStock, newStock };
}
async function listPurchaseOrders() {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select({
    id: purchaseOrders.id,
    supplierId: purchaseOrders.supplierId,
    supplierName: suppliers.name,
    supplierWhatsapp: suppliers.whatsapp,
    status: purchaseOrders.status,
    notes: purchaseOrders.notes,
    sentAt: purchaseOrders.sentAt,
    createdAt: purchaseOrders.createdAt
  }).from(purchaseOrders).leftJoin(suppliers, eq(suppliers.id, purchaseOrders.supplierId)).orderBy(desc(purchaseOrders.createdAt));
  return rows;
}
async function getPurchaseOrderById(id) {
  const db = await getDb();
  if (!db) return void 0;
  const order = await db.select({
    id: purchaseOrders.id,
    supplierId: purchaseOrders.supplierId,
    supplierName: suppliers.name,
    supplierWhatsapp: suppliers.whatsapp,
    supplierPhone: suppliers.phone,
    status: purchaseOrders.status,
    notes: purchaseOrders.notes,
    sentAt: purchaseOrders.sentAt,
    createdAt: purchaseOrders.createdAt
  }).from(purchaseOrders).leftJoin(suppliers, eq(suppliers.id, purchaseOrders.supplierId)).where(eq(purchaseOrders.id, id));
  if (!order[0]) return void 0;
  const items = await db.select({
    id: purchaseOrderItems.id,
    materialId: purchaseOrderItems.materialId,
    materialName: materials.name,
    materialUnit: materials.unit,
    quantity: purchaseOrderItems.quantity,
    unitPrice: purchaseOrderItems.unitPrice,
    notes: purchaseOrderItems.notes
  }).from(purchaseOrderItems).leftJoin(materials, eq(materials.id, purchaseOrderItems.materialId)).where(eq(purchaseOrderItems.orderId, id));
  return { ...order[0], items };
}
async function createPurchaseOrder(data) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(purchaseOrders).values({
    supplierId: data.supplierId,
    notes: data.notes,
    createdBy: data.createdBy,
    status: "rascunho"
  });
  const orderId = result[0].insertId;
  if (data.items.length > 0) {
    await db.insert(purchaseOrderItems).values(
      data.items.map((item) => ({
        orderId,
        materialId: item.materialId,
        quantity: String(item.quantity),
        unitPrice: String(item.unitPrice ?? 0),
        notes: item.notes
      }))
    );
  }
  return orderId;
}
async function updatePurchaseOrderStatus(id, status) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const sentAt = status === "enviado" ? Date.now() : void 0;
  await db.update(purchaseOrders).set({
    status,
    updatedAt: Date.now(),
    ...sentAt ? { sentAt } : {}
  }).where(eq(purchaseOrders.id, id));
}
async function deletePurchaseOrder(id) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(purchaseOrderItems).where(eq(purchaseOrderItems.orderId, id));
  await db.delete(purchaseOrders).where(eq(purchaseOrders.id, id));
}
function buildWhatsAppOrderMessage(order) {
  const lines = [];
  lines.push("\u{1F6D2} *PEDIDO DE OR\xC7AMENTO*");
  lines.push(`\u{1F4CB} Fornecedor: ${order.supplierName ?? "N/A"}`);
  lines.push("");
  lines.push("*Itens solicitados:*");
  order.items.forEach((item, i) => {
    const qty = parseFloat(item.quantity);
    const price = parseFloat(item.unitPrice);
    const line = `${i + 1}. ${item.materialName ?? "Item"} \u2014 ${qty} ${item.materialUnit ?? "un"}`;
    lines.push(line + (price > 0 ? ` (R$ ${price.toFixed(2)}/un)` : ""));
    if (item.notes) lines.push(`   _${item.notes}_`);
  });
  if (order.notes) {
    lines.push("");
    lines.push(`\u{1F4DD} Observa\xE7\xF5es: ${order.notes}`);
  }
  lines.push("");
  lines.push("Por favor, envie o or\xE7amento com prazo de entrega. Obrigado! \u{1F64F}");
  return lines.join("\n");
}
async function updateAnamneseSubmission(id, payloadJson) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(anamneseSubmissions).set({ payloadJson }).where(eq(anamneseSubmissions.id, id));
}
async function deleteAnamneseSubmission(id) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [submission] = await db.select({ requestId: anamneseSubmissions.requestId }).from(anamneseSubmissions).where(eq(anamneseSubmissions.id, id)).limit(1);
  await db.delete(anamneseSubmissions).where(eq(anamneseSubmissions.id, id));
  if (submission?.requestId) {
    await db.update(anamneseRequests).set({ completedAt: null }).where(eq(anamneseRequests.id, submission.requestId));
  }
}
async function updateAnamnesisRecord(id, data) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(anamnesisRecords).set(data).where(eq(anamnesisRecords.id, id));
}
async function deleteAnamnesisRecord(id) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(anamnesisRecords).where(eq(anamnesisRecords.id, id));
}
async function getAnamneseSubmissionByRequestId(requestId) {
  const db = await getDb();
  if (!db) return null;
  const [result] = await db.select().from(anamneseSubmissions).where(eq(anamneseSubmissions.requestId, requestId)).orderBy(desc(anamneseSubmissions.createdAt)).limit(1);
  return result ?? null;
}
async function listRemindersByAppointment(appointmentId) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(appointmentReminders).where(eq(appointmentReminders.appointmentId, appointmentId)).orderBy(appointmentReminders.scheduledAt);
}
async function createAppointmentReminder(data) {
  const db = await getDb();
  if (!db) return null;
  const [result] = await db.insert(appointmentReminders).values(data);
  const id = result.insertId;
  const [created] = await db.select().from(appointmentReminders).where(eq(appointmentReminders.id, id));
  return created ?? null;
}
async function updateAppointmentReminder(id, data) {
  const db = await getDb();
  if (!db) return null;
  await db.update(appointmentReminders).set(data).where(eq(appointmentReminders.id, id));
  const [updated] = await db.select().from(appointmentReminders).where(eq(appointmentReminders.id, id));
  return updated ?? null;
}
async function deleteAppointmentReminder(id) {
  const db = await getDb();
  if (!db) return;
  await db.delete(appointmentReminders).where(eq(appointmentReminders.id, id));
}
async function getAllPendingReminders(studioId) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select({
    id: appointmentReminders.id,
    appointmentId: appointmentReminders.appointmentId,
    scheduledAt: appointmentReminders.scheduledAt,
    message: appointmentReminders.message,
    status: appointmentReminders.status,
    sentAt: appointmentReminders.sentAt,
    createdAt: appointmentReminders.createdAt,
    clientName: clients.name,
    clientPhone: clients.phone,
    appointmentDate: appointments.date,
    service: appointments.service,
    artist: appointments.artist
  }).from(appointmentReminders).leftJoin(appointments, eq(appointments.id, appointmentReminders.appointmentId)).leftJoin(clients, eq(clients.id, appointments.clientId)).where(and(
    eq(appointmentReminders.status, "pending"),
    eq(appointments.studioId, studioId)
  )).orderBy(appointmentReminders.scheduledAt);
  return rows;
}
async function releasePendingReminderNow(id, studioId) {
  const db = await getDb();
  if (!db) return false;
  const reminder = (await db.select({ id: appointmentReminders.id }).from(appointmentReminders).innerJoin(appointments, eq(appointments.id, appointmentReminders.appointmentId)).where(and(
    eq(appointmentReminders.id, id),
    eq(appointmentReminders.status, "pending"),
    eq(appointments.studioId, studioId)
  )).limit(1))[0];
  if (!reminder) return false;
  const now = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23"
  }).format(/* @__PURE__ */ new Date()).replace(",", "");
  await db.update(appointmentReminders).set({ scheduledAt: now, status: "pending" }).where(eq(appointmentReminders.id, id));
  return true;
}
async function getWeeklyAppointments() {
  const db = await getDb();
  if (!db) return [];
  const now = new Date((/* @__PURE__ */ new Date()).toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  const dayOfWeek = now.getDay();
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diffToMonday);
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  const fmt = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} 00:00:00`;
  const fmtEnd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} 23:59:59`;
  const rows = await db.select({
    id: appointments.id,
    clientId: appointments.clientId,
    clientName: clients.name,
    clientPhone: clients.phone,
    date: appointments.date,
    duration: appointments.duration,
    service: appointments.service,
    artist: appointments.artist,
    status: appointments.status,
    totalAmount: appointments.totalAmount
  }).from(appointments).leftJoin(clients, eq(clients.id, appointments.clientId)).where(
    and(
      gte(appointments.date, fmt(monday)),
      lte(appointments.date, fmtEnd(sunday))
    )
  ).orderBy(appointments.date);
  return rows;
}
async function listCollaboratorRates(studioId) {
  const db = await getDb();
  if (!db) return [];
  const artistsList = await db.select().from(artists).where(and(eq(artists.studioId, studioId), eq(artists.active, 1)));
  const rates = await db.select().from(collaboratorRates).where(eq(collaboratorRates.studioId, studioId));
  return artistsList.map((artist) => {
    const rate = rates.find((r) => r.artistId === artist.id);
    return {
      artistId: artist.id,
      artistName: artist.name,
      specialty: artist.specialty,
      percentage: rate?.percentage ?? 50,
      // padrão 50%
      notes: rate?.notes ?? null,
      rateId: rate?.id ?? null
    };
  });
}
async function upsertCollaboratorRate(data) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const existing = await db.select().from(collaboratorRates).where(
    and(
      eq(collaboratorRates.studioId, data.studioId),
      eq(collaboratorRates.artistId, data.artistId)
    )
  ).limit(1);
  if (existing.length > 0) {
    await db.update(collaboratorRates).set({ percentage: data.percentage, notes: data.notes ?? null }).where(eq(collaboratorRates.id, existing[0].id));
    return { id: existing[0].id, updated: true };
  } else {
    const result = await db.insert(collaboratorRates).values({
      studioId: data.studioId,
      artistId: data.artistId,
      percentage: data.percentage,
      notes: data.notes ?? null
    });
    return { id: result[0]?.insertId ?? 0, updated: false };
  }
}
function getPeriodRange(period, referenceDate) {
  const ref = referenceDate ? /* @__PURE__ */ new Date(referenceDate + "T12:00:00") : /* @__PURE__ */ new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const fmt = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  if (period === "daily") {
    const day = fmt(ref);
    return { start: `${day} 00:00:00`, end: `${day} 23:59:59` };
  }
  if (period === "weekly") {
    const day = ref.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    const monday = new Date(ref);
    monday.setDate(ref.getDate() + diff);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    return { start: `${fmt(monday)} 00:00:00`, end: `${fmt(sunday)} 23:59:59` };
  }
  if (period === "monthly") {
    const start = `${ref.getFullYear()}-${pad(ref.getMonth() + 1)}-01`;
    const lastDay = new Date(ref.getFullYear(), ref.getMonth() + 1, 0).getDate();
    const end = `${ref.getFullYear()}-${pad(ref.getMonth() + 1)}-${pad(lastDay)}`;
    return { start: `${start} 00:00:00`, end: `${end} 23:59:59` };
  }
  return {
    start: `${ref.getFullYear()}-01-01 00:00:00`,
    end: `${ref.getFullYear()}-12-31 23:59:59`
  };
}
async function getCollaboratorReport(studioId, artistName, period, referenceDate) {
  const db = await getDb();
  if (!db) return null;
  const { start, end } = getPeriodRange(period, referenceDate);
  const apts = await db.select({
    id: appointments.id,
    date: appointments.date,
    service: appointments.service,
    clientId: appointments.clientId,
    totalAmount: appointments.totalAmount,
    depositAmount: appointments.depositAmount,
    depositPaid: appointments.depositPaid,
    paymentStatus: appointments.paymentStatus,
    paymentMethod: appointments.paymentMethod,
    signalStatus: appointments.signalStatus,
    status: appointments.status,
    clientName: clients.name
  }).from(appointments).leftJoin(clients, eq(clients.id, appointments.clientId)).where(
    and(
      eq(appointments.studioId, studioId),
      eq(appointments.artist, artistName),
      gte(appointments.date, start),
      lte(appointments.date, end)
    )
  ).orderBy(appointments.date);
  const artistRecord = await db.select().from(artists).where(and(eq(artists.studioId, studioId), eq(artists.name, artistName))).limit(1);
  let percentage = 50;
  if (artistRecord.length > 0) {
    const rate = await db.select().from(collaboratorRates).where(
      and(
        eq(collaboratorRates.studioId, studioId),
        eq(collaboratorRates.artistId, artistRecord[0].id)
      )
    ).limit(1);
    if (rate.length > 0) percentage = rate[0].percentage;
  }
  const totalRevenue = apts.reduce((sum, a) => sum + (a.totalAmount ?? 0), 0);
  const paidRevenue = apts.filter((a) => a.paymentStatus === "pago").reduce((sum, a) => sum + (a.totalAmount ?? 0), 0);
  const collaboratorEarnings = Math.round(totalRevenue * percentage / 100);
  const studioEarnings = totalRevenue - collaboratorEarnings;
  return {
    artistName,
    percentage,
    period,
    start: start.slice(0, 10),
    end: end.slice(0, 10),
    totalAppointments: apts.length,
    totalRevenue,
    // em centavos
    paidRevenue,
    // em centavos
    collaboratorEarnings,
    // em centavos
    studioEarnings,
    // em centavos
    appointments: apts.map((a) => ({
      ...a,
      totalAmountBRL: a.totalAmount ? (a.totalAmount / 100).toFixed(2) : "0.00",
      collaboratorAmountBRL: a.totalAmount ? (a.totalAmount * percentage / 100 / 100).toFixed(2) : "0.00"
    }))
  };
}
async function getCollaboratorsSummary(studioId, period, referenceDate, artistId) {
  const db = await getDb();
  if (!db) return [];
  const { start, end } = getPeriodRange(period, referenceDate);
  const artistsList = await db.select().from(artists).where(and(eq(artists.studioId, studioId), eq(artists.active, 1)));
  const rates = await db.select().from(collaboratorRates).where(eq(collaboratorRates.studioId, studioId));
  const apts = await db.select({
    artist: appointments.artist,
    totalAmount: appointments.totalAmount,
    paymentStatus: appointments.paymentStatus,
    status: appointments.status
  }).from(appointments).where(
    and(
      eq(appointments.studioId, studioId),
      gte(appointments.date, start),
      lte(appointments.date, end)
    )
  );
  const visibleArtists = artistId != null ? artistsList.filter((artist) => artist.id === artistId) : artistsList;
  return visibleArtists.map((artist) => {
    const rate = rates.find((r) => r.artistId === artist.id);
    const percentage = rate?.percentage ?? 50;
    const artistApts = apts.filter((a) => a.artist === artist.name);
    const totalRevenue = artistApts.reduce((sum, a) => sum + (a.totalAmount ?? 0), 0);
    const paidRevenue = artistApts.filter((a) => a.paymentStatus === "pago").reduce((sum, a) => sum + (a.totalAmount ?? 0), 0);
    const collaboratorEarnings = Math.round(totalRevenue * percentage / 100);
    const studioEarnings = totalRevenue - collaboratorEarnings;
    return {
      artistId: artist.id,
      artistName: artist.name,
      specialty: artist.specialty,
      percentage,
      totalAppointments: artistApts.length,
      totalRevenue,
      paidRevenue,
      collaboratorEarnings,
      studioEarnings,
      totalRevenueBRL: (totalRevenue / 100).toFixed(2),
      paidRevenueBRL: (paidRevenue / 100).toFixed(2),
      collaboratorEarningsBRL: (collaboratorEarnings / 100).toFixed(2),
      studioEarningsBRL: (studioEarnings / 100).toFixed(2)
    };
  });
}
var _db;
var init_db = __esm({
  "server/db.ts"() {
    "use strict";
    init_schema();
    _db = null;
  }
});

// server/_core/cookies.ts
function isSecureRequest(req) {
  if (req.protocol === "https") return true;
  const forwardedProto = req.headers["x-forwarded-proto"];
  if (!forwardedProto) return false;
  const protoList = Array.isArray(forwardedProto) ? forwardedProto : forwardedProto.split(",");
  return protoList.some((proto) => proto.trim().toLowerCase() === "https");
}
function getSessionCookieOptions(req) {
  const secure = isSecureRequest(req);
  return {
    httpOnly: true,
    path: "/",
    // SameSite=None requires Secure in modern browsers. Use Lax on local HTTP.
    sameSite: secure ? "none" : "lax",
    secure
  };
}
var init_cookies = __esm({
  "server/_core/cookies.ts"() {
    "use strict";
  }
});

// shared/_core/errors.ts
var HttpError, ForbiddenError;
var init_errors = __esm({
  "shared/_core/errors.ts"() {
    "use strict";
    HttpError = class extends Error {
      constructor(statusCode, message) {
        super(message);
        this.statusCode = statusCode;
        this.name = "HttpError";
      }
    };
    ForbiddenError = (msg) => new HttpError(403, msg);
  }
});

// server/_core/sdk.ts
import axios from "axios";
import { parse as parseCookieHeader } from "cookie";
import { SignJWT, jwtVerify } from "jose";
function buildCronUser(userInfo) {
  const now = (/* @__PURE__ */ new Date()).toISOString().slice(0, 19).replace("T", " ");
  return {
    id: -1,
    openId: userInfo.openId,
    name: userInfo.name || "Tarefa agendada",
    email: null,
    loginMethod: null,
    role: "superadmin",
    studioId: null,
    artistId: null,
    isActive: 1,
    passwordHash: null,
    accessStatus: "active",
    accessExpiresAt: null,
    createdAt: now,
    updatedAt: now,
    lastSignedIn: now,
    taskUid: userInfo.taskUid ?? void 0,
    isCron: true
  };
}
var isNonEmptyString2, CRON_OPEN_ID_PREFIX, EXCHANGE_TOKEN_PATH, GET_USER_INFO_PATH, GET_USER_INFO_WITH_JWT_PATH, OAuthService, createOAuthHttpClient, SDKServer, sdk;
var init_sdk = __esm({
  "server/_core/sdk.ts"() {
    "use strict";
    init_const();
    init_errors();
    init_db();
    init_env();
    isNonEmptyString2 = (value) => typeof value === "string" && value.length > 0;
    CRON_OPEN_ID_PREFIX = "cron_";
    EXCHANGE_TOKEN_PATH = `/webdev.v1.WebDevAuthPublicService/ExchangeToken`;
    GET_USER_INFO_PATH = `/webdev.v1.WebDevAuthPublicService/GetUserInfo`;
    GET_USER_INFO_WITH_JWT_PATH = `/webdev.v1.WebDevAuthPublicService/GetUserInfoWithJwt`;
    OAuthService = class {
      constructor(client) {
        this.client = client;
        console.log("[OAuth] Initialized with baseURL:", ENV.oAuthServerUrl);
        if (!ENV.oAuthServerUrl) {
          console.error(
            "[OAuth] ERROR: OAUTH_SERVER_URL is not configured! Set OAUTH_SERVER_URL environment variable."
          );
        }
      }
      decodeState(state) {
        const redirectUri = atob(state);
        return redirectUri;
      }
      async getTokenByCode(code, state) {
        const payload = {
          clientId: ENV.appId,
          grantType: "authorization_code",
          code,
          redirectUri: this.decodeState(state)
        };
        const { data } = await this.client.post(
          EXCHANGE_TOKEN_PATH,
          payload
        );
        return data;
      }
      async getUserInfoByToken(token) {
        const { data } = await this.client.post(
          GET_USER_INFO_PATH,
          {
            accessToken: token.accessToken
          }
        );
        return data;
      }
    };
    createOAuthHttpClient = () => axios.create({
      baseURL: ENV.oAuthServerUrl,
      timeout: AXIOS_TIMEOUT_MS
    });
    SDKServer = class {
      client;
      oauthService;
      constructor(client = createOAuthHttpClient()) {
        this.client = client;
        this.oauthService = new OAuthService(this.client);
      }
      deriveLoginMethod(platforms, fallback) {
        if (fallback && fallback.length > 0) return fallback;
        if (!Array.isArray(platforms) || platforms.length === 0) return null;
        const set = new Set(
          platforms.filter((p) => typeof p === "string")
        );
        if (set.has("REGISTERED_PLATFORM_EMAIL")) return "email";
        if (set.has("REGISTERED_PLATFORM_GOOGLE")) return "google";
        if (set.has("REGISTERED_PLATFORM_APPLE")) return "apple";
        if (set.has("REGISTERED_PLATFORM_MICROSOFT") || set.has("REGISTERED_PLATFORM_AZURE"))
          return "microsoft";
        if (set.has("REGISTERED_PLATFORM_GITHUB")) return "github";
        const first = Array.from(set)[0];
        return first ? first.toLowerCase() : null;
      }
      /**
       * Exchange OAuth authorization code for access token
       * @example
       * const tokenResponse = await sdk.exchangeCodeForToken(code, state);
       */
      async exchangeCodeForToken(code, state) {
        return this.oauthService.getTokenByCode(code, state);
      }
      /**
       * Get user information using access token
       * @example
       * const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);
       */
      async getUserInfo(accessToken) {
        const data = await this.oauthService.getUserInfoByToken({
          accessToken
        });
        const loginMethod = this.deriveLoginMethod(
          data?.platforms,
          data?.platform ?? data.platform ?? null
        );
        return {
          ...data,
          platform: loginMethod,
          loginMethod
        };
      }
      parseCookies(cookieHeader) {
        if (!cookieHeader) {
          return /* @__PURE__ */ new Map();
        }
        const parsed = parseCookieHeader(cookieHeader);
        return new Map(Object.entries(parsed));
      }
      getSessionSecret() {
        const secret = ENV.cookieSecret;
        return new TextEncoder().encode(secret);
      }
      /**
       * Create a session token for a Manus user openId
       * @example
       * const sessionToken = await sdk.createSessionToken(userInfo.openId);
       */
      async createSessionToken(openId, options = {}) {
        return this.signSession(
          {
            openId,
            // Local standalone auth does not require a Manus application id.
            // Keep a non-empty value so the existing session validation remains strict.
            appId: ENV.appId || (ENV.authMode === "local" ? "local" : ""),
            name: options.name || ""
          },
          options
        );
      }
      async signSession(payload, options = {}) {
        const issuedAt = Date.now();
        const expiresInMs = options.expiresInMs ?? ONE_YEAR_MS;
        const expirationSeconds = Math.floor((issuedAt + expiresInMs) / 1e3);
        const secretKey = this.getSessionSecret();
        return new SignJWT({
          openId: payload.openId,
          appId: payload.appId,
          name: payload.name
        }).setProtectedHeader({ alg: "HS256", typ: "JWT" }).setExpirationTime(expirationSeconds).sign(secretKey);
      }
      async verifySession(cookieValue) {
        if (!cookieValue) {
          console.warn("[Auth] Missing session cookie");
          return null;
        }
        try {
          const secretKey = this.getSessionSecret();
          const { payload } = await jwtVerify(cookieValue, secretKey, {
            algorithms: ["HS256"]
          });
          const { openId, appId, name } = payload;
          if (!isNonEmptyString2(openId) || !isNonEmptyString2(appId) || !isNonEmptyString2(name)) {
            console.warn("[Auth] Session payload missing required fields");
            return null;
          }
          return {
            openId,
            appId,
            name
          };
        } catch (error) {
          console.warn("[Auth] Session verification failed", String(error));
          return null;
        }
      }
      async getUserInfoWithJwt(jwtToken) {
        const payload = {
          jwtToken,
          projectId: ENV.appId
        };
        const { data } = await this.client.post(
          GET_USER_INFO_WITH_JWT_PATH,
          payload
        );
        const loginMethod = this.deriveLoginMethod(
          data?.platforms,
          data?.platform ?? data.platform ?? null
        );
        return {
          ...data,
          platform: loginMethod,
          loginMethod
        };
      }
      async authenticateRequest(req) {
        const cookies = this.parseCookies(req.headers.cookie);
        const sessionCookie = cookies.get(COOKIE_NAME);
        const session = await this.verifySession(sessionCookie);
        if (!session) {
          throw ForbiddenError("Invalid session cookie");
        }
        if (session.openId.startsWith(CRON_OPEN_ID_PREFIX)) {
          const userInfo = await this.getUserInfoWithJwt(sessionCookie ?? "");
          if (!userInfo.taskUid) throw ForbiddenError("Cron session missing task_uid");
          return buildCronUser(userInfo);
        }
        const sessionUserId = session.openId;
        const signedInAt = (/* @__PURE__ */ new Date()).toISOString();
        let user = await getUserByOpenId(sessionUserId);
        if (!user) {
          try {
            const userInfo = await this.getUserInfoWithJwt(sessionCookie ?? "");
            await upsertUser({
              openId: userInfo.openId,
              name: userInfo.name || null,
              email: userInfo.email ?? null,
              loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
              lastSignedIn: signedInAt
            });
            user = await getUserByOpenId(userInfo.openId);
          } catch (error) {
            console.error("[Auth] Failed to sync user from OAuth:", error);
            throw ForbiddenError("Failed to sync user info");
          }
        }
        if (!user) {
          throw ForbiddenError("User not found");
        }
        await upsertUser({
          openId: user.openId,
          lastSignedIn: signedInAt
        });
        return user;
      }
    };
    sdk = new SDKServer();
  }
});

// server/_core/localAuth.ts
var localAuth_exports = {};
__export(localAuth_exports, {
  ensureLocalAdmin: () => ensureLocalAdmin,
  hashPassword: () => hashPassword,
  registerLocalAuthRoutes: () => registerLocalAuthRoutes,
  verifyPassword: () => verifyPassword
});
import bcrypt from "bcryptjs";
function registerLocalAuthRoutes(app) {
  app.post("/api/auth/local/login", async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).json({ error: "E-mail e senha s\xE3o obrigat\xF3rios." });
      return;
    }
    try {
      const user = await getUserByEmail(email.trim().toLowerCase());
      if (!user || !user.passwordHash) {
        res.status(401).json({ error: "Credenciais inv\xE1lidas." });
        return;
      }
      if (!user.isActive) {
        res.status(403).json({ error: "Usu\xE1rio inativo. Contate o administrador." });
        return;
      }
      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) {
        res.status(401).json({ error: "Credenciais inv\xE1lidas." });
        return;
      }
      await updateUser(user.id, { lastSignedIn: (/* @__PURE__ */ new Date()).toISOString() });
      const sessionToken = await sdk.createSessionToken(user.openId, {
        name: user.name ?? "",
        expiresInMs: ONE_YEAR_MS
      });
      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
      res.json({ success: true, user: { email: user.email, name: user.name, role: user.role } });
    } catch (error) {
      console.error("[LocalAuth] Login failed", error);
      res.status(500).json({ error: "Erro interno ao fazer login." });
    }
  });
  app.post("/api/auth/local/logout", (req, res) => {
    res.clearCookie(COOKIE_NAME, { path: "/" });
    res.json({ success: true });
  });
}
async function ensureLocalAdmin(env) {
  try {
    const existing = await getUserByEmail(env.email.trim().toLowerCase());
    const passwordHash = await bcrypt.hash(env.password, SALT_ROUNDS);
    if (!existing) {
      await createUser({
        openId: env.ownerOpenId || `local-admin-${Date.now()}`,
        name: env.name,
        email: env.email.trim().toLowerCase(),
        role: "superadmin",
        passwordHash
      });
      console.log(`[LocalAuth] Admin user created: ${env.email}`);
    } else if (!existing.passwordHash) {
      await updateUser(existing.id, { passwordHash });
      console.log(`[LocalAuth] Password set for existing admin: ${env.email}`);
    } else {
      console.log(`[LocalAuth] Admin already configured: ${env.email}`);
    }
  } catch (err) {
    console.error("[LocalAuth] Failed to ensure admin user:", err);
  }
}
async function hashPassword(plain) {
  return bcrypt.hash(plain, SALT_ROUNDS);
}
async function verifyPassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}
var SALT_ROUNDS;
var init_localAuth = __esm({
  "server/_core/localAuth.ts"() {
    "use strict";
    init_db();
    init_cookies();
    init_sdk();
    init_const();
    SALT_ROUNDS = 10;
  }
});

// server/messaging/crypto.ts
import { createCipheriv, createDecipheriv, createHash as createHash2, randomBytes as randomBytes2, timingSafeEqual } from "node:crypto";
function getEncryptionKey() {
  const value = process.env.BOTCONVERSA_ENCRYPTION_KEY;
  if (!value) throw new Error("A chave de criptografia BotConversa n\xE3o est\xE1 configurada.");
  const key = Buffer.from(value, "base64");
  if (key.length !== 32) throw new Error("A chave de criptografia BotConversa deve possuir 32 bytes.");
  return key;
}
function encryptIntegrationSecret(value) {
  if (!value) throw new Error("N\xE3o \xE9 poss\xEDvel criptografar um valor vazio.");
  const iv = randomBytes2(IV_LENGTH);
  const cipher = createCipheriv("aes-256-gcm", getEncryptionKey(), iv, { authTagLength: AUTH_TAG_LENGTH });
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [ENCRYPTION_VERSION, iv.toString("base64url"), tag.toString("base64url"), encrypted.toString("base64url")].join(".");
}
function decryptIntegrationSecret(ciphertext) {
  const [version, rawIv, rawTag, rawEncrypted, ...extra] = ciphertext.split(".");
  if (version !== ENCRYPTION_VERSION || !rawIv || !rawTag || !rawEncrypted || extra.length) {
    throw new Error("Formato de credencial criptografada inv\xE1lido.");
  }
  const iv = Buffer.from(rawIv, "base64url");
  const tag = Buffer.from(rawTag, "base64url");
  const encrypted = Buffer.from(rawEncrypted, "base64url");
  if (iv.length !== IV_LENGTH || tag.length !== AUTH_TAG_LENGTH) throw new Error("Metadados de credencial inv\xE1lidos.");
  const decipher = createDecipheriv("aes-256-gcm", getEncryptionKey(), iv, { authTagLength: AUTH_TAG_LENGTH });
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}
function createConnectionKey() {
  return randomBytes2(32).toString("base64url");
}
function hashIntegrationPayload(payload) {
  return createHash2("sha256").update(payload).digest("hex");
}
function createWebhookSignature(payload, secret) {
  return createHash2("sha256").update(`${secret}:${payload}`).digest("hex");
}
function isWebhookSignatureValid(payload, secret, signature) {
  if (!signature) return false;
  if (/^[a-f0-9]{64}$/i.test(signature)) {
    const expected2 = Buffer.from(createWebhookSignature(payload, secret), "hex");
    const received2 = Buffer.from(signature, "hex");
    return expected2.length === received2.length && timingSafeEqual(expected2, received2);
  }
  const expected = Buffer.from(secret, "utf8");
  const received = Buffer.from(signature, "utf8");
  return expected.length === received.length && timingSafeEqual(expected, received);
}
function maskSecret(value) {
  return value ? "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022" : null;
}
var ENCRYPTION_VERSION, IV_LENGTH, AUTH_TAG_LENGTH;
var init_crypto = __esm({
  "server/messaging/crypto.ts"() {
    "use strict";
    ENCRYPTION_VERSION = "v1";
    IV_LENGTH = 12;
    AUTH_TAG_LENGTH = 16;
  }
});

// server/messaging/provider.ts
function interpolateTemplate(template, vars) {
  return template.replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? `{${key}}`);
}
var init_provider = __esm({
  "server/messaging/provider.ts"() {
    "use strict";
  }
});

// server/messaging/phone.ts
import { parsePhoneNumberFromString } from "libphonenumber-js";
function normalizeBrazilianPhone(value) {
  const phone = parsePhoneNumberFromString(value, "BR");
  if (!phone?.isValid() || phone.country !== "BR") {
    throw new Error("Informe um telefone brasileiro v\xE1lido com DDD.");
  }
  return phone.number;
}
var init_phone = __esm({
  "server/messaging/phone.ts"() {
    "use strict";
  }
});

// server/messaging/providers/botconversa.ts
var BotConversaProvider;
var init_botconversa = __esm({
  "server/messaging/providers/botconversa.ts"() {
    "use strict";
    init_phone();
    BotConversaProvider = class {
      apiToken;
      baseUrl = "https://backend.botconversa.com.br/api/v1";
      timeoutMs = 1e4;
      constructor(config) {
        this.apiToken = config.apiToken;
      }
      async request(path2, init) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
        try {
          return await fetch(`${this.baseUrl}${path2}`, {
            ...init,
            signal: controller.signal,
            headers: {
              "Content-Type": "application/json",
              "API-KEY": this.apiToken,
              ...init.headers ?? {}
            }
          });
        } finally {
          clearTimeout(timeout);
        }
      }
      toSafeError(status) {
        if (status === 401 || status === 403) return "N\xE3o foi poss\xEDvel autenticar a integra\xE7\xE3o BotConversa.";
        if (status === 429) return "O limite tempor\xE1rio do BotConversa foi atingido; a opera\xE7\xE3o ser\xE1 tentada novamente.";
        if (status >= 500) return "O BotConversa est\xE1 temporariamente indispon\xEDvel.";
        return `A opera\xE7\xE3o foi recusada pelo BotConversa (HTTP ${status}).`;
      }
      async sendMessage(to, message) {
        try {
          const normalizedDigits = normalizeBrazilianPhone(to).replace(/\D/g, "");
          const phone = `+${normalizedDigits}`;
          const lookupPhones = [phone, normalizedDigits];
          let subscriberResponse;
          for (const lookupPhone of lookupPhones) {
            const response = await this.request(`/webhook/subscriber/get_by_phone/${encodeURIComponent(lookupPhone)}/`, {
              method: "GET"
            });
            subscriberResponse = response;
            if (response.ok || response.status !== 404) break;
          }
          if (!subscriberResponse) return { success: false, error: "N\xE3o foi poss\xEDvel consultar o assinante no BotConversa." };
          if (subscriberResponse.status === 404) {
            let createResponse = await this.request("/webhook/subscriber/", {
              method: "POST",
              body: JSON.stringify({ phone, first_name: "Contato", last_name: "CRM", has_opt_in_whatsapp: true })
            });
            if (createResponse.status === 400) {
              createResponse = await this.request("/webhook/subscriber/", {
                method: "POST",
                body: JSON.stringify({ phone: normalizedDigits, first_name: "Contato", last_name: "CRM", has_opt_in_whatsapp: true })
              });
            }
            if (!createResponse.ok && createResponse.status !== 401) {
              return {
                success: false,
                error: `O BotConversa recusou o cadastro do assinante (${this.toSafeError(createResponse.status)}).`
              };
            }
            for (const lookupPhone of lookupPhones) {
              const response = await this.request(`/webhook/subscriber/get_by_phone/${encodeURIComponent(lookupPhone)}/`, { method: "GET" });
              subscriberResponse = response;
              if (response.ok || response.status !== 404) break;
            }
          }
          if (!subscriberResponse.ok) {
            return {
              success: false,
              error: subscriberResponse.status === 404 ? "O contato n\xE3o est\xE1 dispon\xEDvel como assinante no BotConversa." : `O BotConversa recusou a consulta do assinante (${this.toSafeError(subscriberResponse.status)}).`
            };
          }
          const subscriber = await subscriberResponse.json();
          if (!subscriber?.id) {
            return { success: false, error: "O BotConversa n\xE3o retornou um assinante v\xE1lido para o telefone informado." };
          }
          const res = await this.request(`/webhook/subscriber/${encodeURIComponent(String(subscriber.id))}/send_message/`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({ type: "text", value: message })
          });
          if (!res.ok) {
            return {
              success: false,
              error: `O BotConversa recusou o envio ao assinante (${this.toSafeError(res.status)}).`
            };
          }
          const data = await res.json();
          return {
            success: true,
            messageId: data?.id?.toString() ?? data?.message_id?.toString()
          };
        } catch (err) {
          const timedOut = err?.name === "AbortError";
          return { success: false, error: timedOut ? "Tempo limite excedido ao comunicar com o BotConversa." : "Falha ao comunicar com o BotConversa." };
        }
      }
      async testConnection() {
        try {
          const res = await this.request(`/webhook/subscribers/`, {
            method: "GET"
          });
          if (res.ok) {
            return { success: true, details: "Conex\xE3o com BotConversa estabelecida com sucesso." };
          }
          return { success: false, error: this.toSafeError(res.status) };
        } catch (err) {
          const timedOut = err?.name === "AbortError";
          return { success: false, error: timedOut ? "Tempo limite excedido ao testar a conex\xE3o." : "Falha ao conectar com o BotConversa." };
        }
      }
    };
  }
});

// server/messaging/providers/zapi.ts
var ZApiProvider;
var init_zapi = __esm({
  "server/messaging/providers/zapi.ts"() {
    "use strict";
    ZApiProvider = class {
      apiToken;
      instanceId;
      baseUrl;
      constructor(config) {
        this.apiToken = config.apiToken;
        this.instanceId = config.instanceId ?? "";
        this.baseUrl = `https://api.z-api.io/instances/${this.instanceId}/token/${this.apiToken}`;
      }
      async sendMessage(to, message) {
        try {
          const phone = to.replace(/[\s\-\+\(\)]/g, "");
          const res = await fetch(`${this.baseUrl}/send-text`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ phone, message })
          });
          if (!res.ok) {
            const body = await res.text();
            return { success: false, error: `HTTP ${res.status}: ${body}` };
          }
          const data = await res.json();
          return {
            success: true,
            messageId: data?.zaapId ?? data?.messageId
          };
        } catch (err) {
          return { success: false, error: err?.message ?? "Erro desconhecido" };
        }
      }
      async testConnection() {
        try {
          const res = await fetch(`${this.baseUrl}/status`, {
            method: "GET",
            headers: { "Content-Type": "application/json" }
          });
          if (!res.ok) {
            const body = await res.text();
            return { success: false, error: `HTTP ${res.status}: ${body}` };
          }
          const data = await res.json();
          const connected = data?.connected === true || data?.status === "connected";
          if (connected) {
            return { success: true, details: `Z-API conectado. N\xFAmero: ${data?.phone ?? "N/A"}` };
          }
          return { success: false, error: `Inst\xE2ncia n\xE3o conectada. Status: ${data?.status ?? "desconhecido"}` };
        } catch (err) {
          return { success: false, error: err?.message ?? "Falha ao conectar com Z-API" };
        }
      }
    };
  }
});

// server/messaging/providers/meta.ts
var MetaProvider;
var init_meta = __esm({
  "server/messaging/providers/meta.ts"() {
    "use strict";
    MetaProvider = class {
      accessToken;
      phoneNumberId;
      baseUrl = "https://graph.facebook.com/v19.0";
      constructor(config) {
        this.accessToken = config.apiToken;
        this.phoneNumberId = config.instanceId ?? "";
      }
      async sendMessage(to, message) {
        try {
          const phone = to.replace(/[\s\-\+\(\)]/g, "");
          const res = await fetch(
            `${this.baseUrl}/${this.phoneNumberId}/messages`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${this.accessToken}`
              },
              body: JSON.stringify({
                messaging_product: "whatsapp",
                to: phone,
                type: "text",
                text: { body: message }
              })
            }
          );
          if (!res.ok) {
            const body = await res.text();
            return { success: false, error: `HTTP ${res.status}: ${body}` };
          }
          const data = await res.json();
          return {
            success: true,
            messageId: data?.messages?.[0]?.id
          };
        } catch (err) {
          return { success: false, error: err?.message ?? "Erro desconhecido" };
        }
      }
      async testConnection() {
        try {
          const res = await fetch(
            `${this.baseUrl}/${this.phoneNumberId}?fields=display_phone_number,verified_name`,
            {
              headers: { Authorization: `Bearer ${this.accessToken}` }
            }
          );
          if (!res.ok) {
            const body = await res.text();
            return { success: false, error: `HTTP ${res.status}: ${body}` };
          }
          const data = await res.json();
          return {
            success: true,
            details: `Meta API conectada. N\xFAmero: ${data?.display_phone_number ?? "N/A"} (${data?.verified_name ?? ""})`
          };
        } catch (err) {
          return { success: false, error: err?.message ?? "Falha ao conectar com Meta API" };
        }
      }
    };
  }
});

// server/messaging/messagePresentation.ts
function firstName(fullName) {
  return fullName?.trim().split(/\s+/)[0] || "cliente";
}
function removeLegacyNumericReplyInstruction(message) {
  return message.split(/\r?\n/).filter((line) => !/^\s*responda\s+\*?(?:1|2)\*?\b/i.test(line)).join("\n").replace(/\n{3,}/g, "\n\n").trim();
}
function useFirstNameInGreeting(message, fullName) {
  const name = firstName(fullName);
  return message.replace(/^(Olá,?\s+)([^!\n]+)(!)/i, `$1${name}$3`);
}
function formatStudioAddress(studio) {
  if (!studio) return "";
  const locality = [studio.city, studio.state].filter(Boolean).join(" - ");
  return [studio.address, locality, studio.zipCode].filter(Boolean).join(", ");
}
var init_messagePresentation = __esm({
  "server/messaging/messagePresentation.ts"() {
    "use strict";
  }
});

// server/appointmentActions.ts
import crypto from "node:crypto";
import { and as and3, desc as desc3, eq as eq3, gt as gt2, isNull, sql as sql3 } from "drizzle-orm";
function publicBaseUrl() {
  if (process.env.APP_BASE_URL) return process.env.APP_BASE_URL.replace(/\/$/, "");
  return process.env.NODE_ENV === "production" ? "https://tatuei.com" : "http://localhost:3000";
}
function tokenHash(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}
function sqlDate(date = /* @__PURE__ */ new Date()) {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23"
  }).format(date).replace(",", "");
}
function saoPauloDateTime(value) {
  if (value instanceof Date) return value;
  if (/T.*(?:Z|[+-]\d{2}:?\d{2})$/.test(value)) return new Date(value);
  const normalized = value.replace(" ", "T").replace(/Z$/, "");
  return /* @__PURE__ */ new Date(`${normalized}-03:00`);
}
async function issueAppointmentActionLinks(input) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indispon\xEDvel");
  const appointment = (await db.select({ id: appointments.id, studioId: appointments.studioId, date: appointments.date }).from(appointments).where(and3(eq3(appointments.id, input.appointmentId), eq3(appointments.studioId, input.studioId))).limit(1))[0];
  if (!appointment) throw new Error("Agendamento n\xE3o encontrado para o est\xFAdio");
  const expiresAt = input.expiresAt ?? String(appointment.date);
  const result = {};
  for (const action of APPOINTMENT_ACTIONS) {
    const rawToken = crypto.randomBytes(32).toString("base64url");
    await db.insert(appointmentActionLinks).values({
      studioId: input.studioId,
      appointmentId: input.appointmentId,
      action,
      tokenHash: tokenHash(rawToken),
      expiresAt
    });
    result[action] = `${publicBaseUrl()}/confirmar?token=${encodeURIComponent(rawToken)}&action=${encodeURIComponent(action)}`;
  }
  return result;
}
function formatAppointmentActionLinks(links, actions = APPOINTMENT_ACTIONS) {
  return actions.map((action) => `${actionLabels[action]}: ${links[action]}`).join("\n");
}
function isActionLinkUsable(input, now = /* @__PURE__ */ new Date()) {
  return !input.usedAt && saoPauloDateTime(input.expiresAt).getTime() > now.getTime();
}
function shouldQueueAnamneseAfterAction(action) {
  return action === "confirmed" || action === "early" || action === "late";
}
async function queueAnamneseAfterCustomerAction(input) {
  if (!shouldQueueAnamneseAfterAction(input.action)) return { queued: false, reason: "not-applicable" };
  const db = await getDb();
  if (!db) return { queued: false, reason: "database-unavailable" };
  const appointment = (await db.select({ id: appointments.id, clientId: appointments.clientId }).from(appointments).where(and3(eq3(appointments.id, input.appointmentId), eq3(appointments.studioId, input.studioId))).limit(1))[0];
  if (!appointment) return { queued: false, reason: "appointment-not-found" };
  const client = (await db.select({ id: clients.id, name: clients.name, phone: clients.phone }).from(clients).where(eq3(clients.id, appointment.clientId)).limit(1))[0];
  if (!client?.phone) return { queued: false, reason: "client-without-phone" };
  const existingRequest = (await db.select({ id: anamneseRequests.id, token: anamneseRequests.token }).from(anamneseRequests).where(and3(
    eq3(anamneseRequests.clientId, client.id),
    eq3(anamneseRequests.appointmentId, appointment.id),
    eq3(anamneseRequests.sentVia, "whatsapp"),
    eq3(anamneseRequests.statusRequest, "pendente")
  )).limit(1))[0];
  const previousSubmission = (await db.select({ id: anamneseSubmissions.id }).from(anamneseSubmissions).where(eq3(anamneseSubmissions.clientId, client.id)).orderBy(desc3(anamneseSubmissions.createdAt)).limit(1))[0];
  const previousLegacyRecord = previousSubmission ? void 0 : (await db.select({ id: anamnesisRecords.id }).from(anamnesisRecords).where(eq3(anamnesisRecords.clientId, client.id)).orderBy(desc3(anamnesisRecords.createdAt)).limit(1))[0];
  const token = existingRequest?.token ?? crypto.randomBytes(24).toString("base64url");
  const requestId = existingRequest?.id ?? Number((await db.insert(anamneseRequests).values({
    clientId: client.id,
    appointmentId: appointment.id,
    token,
    sentVia: "whatsapp",
    sentTo: client.phone,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1e3).toISOString(),
    statusRequest: "pendente"
  }))[0].insertId);
  const { sendAndLog: sendAndLog2 } = await Promise.resolve().then(() => (init_service(), service_exports));
  const delivery = await sendAndLog2({
    studioId: input.studioId,
    clientId: client.id,
    appointmentId: appointment.id,
    recipientPhone: client.phone,
    recipientName: firstName(client.name),
    recipientType: "client",
    trigger: "appointment_anamnese_after_response",
    message: previousSubmission || previousLegacyRecord ? `Ol\xE1, ${firstName(client.name)}! Recebemos sua resposta sobre o agendamento. J\xE1 temos sua ficha de anamnese cadastrada. Confira seus dados e atualize somente se houve alguma mudan\xE7a: ${publicBaseUrl()}/anamnese/${token}` : `Ol\xE1, ${firstName(client.name)}! Recebemos sua resposta sobre o agendamento. Para prosseguir, preencha sua ficha de anamnese: ${publicBaseUrl()}/anamnese/${token}`,
    idempotencyKey: `appointment-anamnese:${requestId}`
  });
  return { queued: delivery.success && (delivery.queued || delivery.duplicate), reason: delivery.success ? "queued" : "delivery-rejected" };
}
async function queueArtistActionNotification(input) {
  const db = await getDb();
  if (!db) return false;
  const appointment = (await db.select({
    id: appointments.id,
    clientId: appointments.clientId,
    artistId: appointments.artistId,
    date: appointments.date,
    service: appointments.service
  }).from(appointments).where(and3(
    eq3(appointments.id, input.appointmentId),
    eq3(appointments.studioId, input.studioId)
  )).limit(1))[0];
  if (!appointment?.artistId) return false;
  const client = (await db.select({ name: clients.name }).from(clients).where(eq3(clients.id, appointment.clientId)).limit(1))[0];
  const artist = (await db.select({ name: artists.name, phone: artists.phone }).from(artists).where(and3(
    eq3(artists.id, appointment.artistId),
    eq3(artists.studioId, input.studioId)
  )).limit(1))[0];
  if (!client || !artist?.phone) return false;
  const actionText = {
    confirmed: "confirmou presen\xE7a",
    early: "informou que chegar\xE1 adiantado",
    late: "informou que ter\xE1 atraso",
    reschedule_requested: "solicitou remarca\xE7\xE3o"
  };
  const when = saoPauloDateTime(String(appointment.date)).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    dateStyle: "short",
    timeStyle: "short"
  });
  const { sendAndLog: sendAndLog2 } = await Promise.resolve().then(() => (init_service(), service_exports));
  const delivery = await sendAndLog2({
    studioId: input.studioId,
    recipientPhone: artist.phone,
    recipientName: firstName(artist.name),
    recipientType: "artist",
    clientId: appointment.clientId,
    appointmentId: appointment.id,
    trigger: `appointment_action_${input.action}`,
    message: `Ol\xE1, ${firstName(artist.name)}! ${firstName(client.name)} ${actionText[input.action]} no agendamento de ${when}. Servi\xE7o: ${appointment.service}.`,
    idempotencyKey: `appointment-action-artist:${input.actionLinkId}`
  });
  return delivery.success && (delivery.queued || delivery.duplicate);
}
async function consumeAppointmentActionLink(rawToken) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indispon\xEDvel");
  const now = sqlDate();
  const link = (await db.select().from(appointmentActionLinks).where(and3(
    eq3(appointmentActionLinks.tokenHash, tokenHash(rawToken)),
    isNull(appointmentActionLinks.usedAt),
    gt2(appointmentActionLinks.expiresAt, now)
  )).limit(1))[0];
  if (!link || !isActionLinkUsable(link)) throw new Error("Este link \xE9 inv\xE1lido, j\xE1 foi usado ou expirou.");
  const reserved = await db.update(appointmentActionLinks).set({ usedAt: now }).where(and3(eq3(appointmentActionLinks.id, link.id), isNull(appointmentActionLinks.usedAt)));
  const header = Array.isArray(reserved) ? reserved[0] : reserved;
  if (!header || header.affectedRows !== 1) {
    throw new Error("Esta a\xE7\xE3o j\xE1 foi registrada.");
  }
  const action = link.action;
  const appointmentUpdate = action === "confirmed" ? { confirmationStatus: "confirmado" } : action === "early" ? { confirmationStatus: "chegada_antecipada" } : action === "late" ? { confirmationStatus: "atraso" } : { status: "reagendado", confirmationStatus: "nao_confirmado" };
  await db.update(appointments).set(appointmentUpdate).where(and3(
    eq3(appointments.id, link.appointmentId),
    eq3(appointments.studioId, link.studioId)
  ));
  await db.insert(appointmentActionAlerts).values({
    studioId: link.studioId,
    appointmentId: link.appointmentId,
    actionLinkId: link.id,
    action
  });
  let anamneseQueued = false;
  let artistQueued = false;
  try {
    anamneseQueued = (await queueAnamneseAfterCustomerAction({
      studioId: link.studioId,
      appointmentId: link.appointmentId,
      action
    })).queued;
  } catch (error) {
    console.error("[AppointmentActions] N\xE3o foi poss\xEDvel enfileirar anamnese", error);
  }
  try {
    artistQueued = await queueArtistActionNotification({
      studioId: link.studioId,
      appointmentId: link.appointmentId,
      actionLinkId: link.id,
      action
    });
  } catch (error) {
    console.error("[AppointmentActions] N\xE3o foi poss\xEDvel enfileirar aviso ao artista", error);
  }
  return { action, appointmentId: link.appointmentId, anamneseQueued, artistQueued };
}
async function listAppointmentActionAlerts(studioId, limit = 8) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(appointmentActionAlerts).where(and3(
    eq3(appointmentActionAlerts.studioId, studioId),
    eq3(appointmentActionAlerts.status, "new")
  )).orderBy(sql3`${appointmentActionAlerts.createdAt} DESC`).limit(limit);
}
async function markAppointmentActionAlertViewed(studioId, alertId) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indispon\xEDvel");
  await db.update(appointmentActionAlerts).set({ status: "viewed", viewedAt: sqlDate() }).where(and3(
    eq3(appointmentActionAlerts.id, alertId),
    eq3(appointmentActionAlerts.studioId, studioId)
  ));
}
var APPOINTMENT_ACTIONS, actionLabels;
var init_appointmentActions = __esm({
  "server/appointmentActions.ts"() {
    "use strict";
    init_schema();
    init_db();
    init_messagePresentation();
    APPOINTMENT_ACTIONS = ["confirmed", "early", "late", "reschedule_requested"];
    actionLabels = {
      confirmed: "Confirmar presen\xE7a",
      early: "Avisar adiantamento",
      late: "Avisar atraso",
      reschedule_requested: "Solicitar remarca\xE7\xE3o"
    };
  }
});

// server/messaging/service.ts
var service_exports = {};
__export(service_exports, {
  dispatchTemplateMessage: () => dispatchTemplateMessage,
  getActiveIntegration: () => getActiveIntegration,
  getAffectedRows: () => getAffectedRows,
  getIntegrationApiToken: () => getIntegrationApiToken,
  getOutboundEventIdempotencyKey: () => getOutboundEventIdempotencyKey,
  getProvider: () => getProvider,
  getProviderForIntegration: () => getProviderForIntegration,
  getTemplate: () => getTemplate,
  processPendingIntegrationJobs: () => processPendingIntegrationJobs,
  seedDefaultTemplates: () => seedDefaultTemplates,
  sendAndLog: () => sendAndLog
});
import { and as and4, eq as eq4, inArray, lte as lte2, or as or2, sql as sql4 } from "drizzle-orm";
function getProvider(config) {
  switch (config.provider) {
    case "botconversa":
      return new BotConversaProvider(config);
    case "zapi":
      return new ZApiProvider(config);
    case "meta":
      return new MetaProvider(config);
    default:
      throw new Error(`Provedor desconhecido: ${config.provider}`);
  }
}
async function getActiveIntegration(studioId, integrationId) {
  const db = await getDb();
  if (!db) return null;
  const conditions = [eq4(whatsappIntegrations.status, "ativo")];
  if (studioId != null) conditions.push(eq4(whatsappIntegrations.studioId, studioId));
  if (integrationId != null) conditions.push(eq4(whatsappIntegrations.id, integrationId));
  const rows = await db.select().from(whatsappIntegrations).where(and4(...conditions)).limit(1);
  return rows[0] ?? null;
}
async function getIntegrationApiToken(integration) {
  if (integration.encryptedApiToken) return decryptIntegrationSecret(integration.encryptedApiToken);
  if (!integration.apiToken || integration.apiToken === "__encrypted_v1__") {
    throw new Error("A integra\xE7\xE3o n\xE3o possui uma credencial v\xE1lida configurada.");
  }
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indispon\xEDvel");
  const plaintext = integration.apiToken;
  await db.update(whatsappIntegrations).set({
    encryptedApiToken: encryptIntegrationSecret(plaintext),
    apiToken: "__encrypted_v1__",
    updatedAt: (/* @__PURE__ */ new Date()).toISOString().slice(0, 19).replace("T", " ")
  }).where(eq4(whatsappIntegrations.id, integration.id));
  return plaintext;
}
async function getProviderForIntegration(integration) {
  return getProvider({
    provider: integration.provider,
    apiToken: await getIntegrationApiToken(integration),
    phoneNumber: integration.phoneNumber,
    instanceId: integration.instanceId ?? void 0
  });
}
function getAffectedRows(result) {
  const header = Array.isArray(result) ? result[0] : result;
  if (!header || typeof header !== "object") return 0;
  const affectedRows = header.affectedRows;
  return typeof affectedRows === "number" && Number.isFinite(affectedRows) ? affectedRows : 0;
}
function getOutboundEventIdempotencyKey(jobIdempotencyKey) {
  return hashIntegrationPayload(`event:${jobIdempotencyKey}`);
}
async function sendAndLog(params) {
  const integration = await getActiveIntegration(params.studioId, params.integrationId);
  if (!integration) {
    console.warn("[Messaging] Nenhuma integra\xE7\xE3o ativa encontrada.");
    return { success: false, error: "Nenhuma integra\xE7\xE3o ativa" };
  }
  const db = await getDb();
  if (!db) return { success: false, error: "Banco de dados indispon\xEDvel" };
  const studioId = params.studioId ?? integration.studioId;
  try {
    return await db.transaction(async (tx) => {
      if (params.idempotencyKey) {
        const existing = (await tx.select({ id: integrationJobs.id }).from(integrationJobs).where(eq4(integrationJobs.idempotencyKey, params.idempotencyKey)).limit(1))[0];
        if (existing) return { success: true, messageId: void 0, queued: false, duplicate: true };
      }
      const [queued] = await tx.insert(messageQueue).values({
        studioId,
        integrationId: integration.id,
        appointmentId: params.appointmentId,
        clientId: params.clientId,
        retryOfQueueId: params.retryOfQueueId,
        recipientPhone: params.recipientPhone,
        recipientName: params.recipientName,
        recipientType: params.recipientType,
        message: params.message,
        trigger: params.trigger,
        status: "pendente",
        scheduledAt: sqlDate2()
      });
      const queueId = queued.insertId;
      const payload = {
        messageQueueId: queueId,
        clientId: params.clientId,
        appointmentReminderId: params.appointmentReminderId,
        recipientPhone: params.recipientPhone,
        recipientName: params.recipientName,
        message: params.message
      };
      const payloadJson = JSON.stringify(payload);
      const idempotencyKey = params.idempotencyKey ?? hashIntegrationPayload(`message:${integration.id}:${queueId}:${payloadJson}`);
      await tx.insert(integrationJobs).values({
        studioId,
        integrationId: integration.id,
        type: "send_template",
        payload: payloadJson,
        idempotencyKey,
        status: "pending",
        nextAttemptAt: sqlDate2()
      });
      await tx.insert(integrationEvents).values({
        studioId,
        integrationId: integration.id,
        direction: "outbound",
        type: params.trigger ?? "custom",
        idempotencyKey: getOutboundEventIdempotencyKey(idempotencyKey),
        payloadHash: hashIntegrationPayload(payloadJson),
        status: "queued"
      });
      return { success: true, messageId: queueId ? String(queueId) : void 0, queued: true, duplicate: false };
    });
  } catch (error) {
    if (params.idempotencyKey && String(error).includes("Duplicate entry")) {
      return { success: true, messageId: void 0, queued: false, duplicate: true };
    }
    throw error;
  }
}
function retryDelayMinutes(attempt) {
  return [1, 5, 15, 60, 180][Math.min(attempt - 1, 4)] ?? 180;
}
async function processPendingIntegrationJobs(limit = 10) {
  const db = await getDb();
  if (!db) return { processed: 0, completed: 0, retried: 0, failed: 0 };
  const now = sqlDate2();
  const readyJobs = await db.select().from(integrationJobs).where(and4(
    inArray(integrationJobs.status, ["pending", "retry"]),
    or2(lte2(integrationJobs.nextAttemptAt, now), sql4`${integrationJobs.nextAttemptAt} IS NULL`)
  )).limit(limit);
  const result = { processed: 0, completed: 0, retried: 0, failed: 0 };
  for (const job of readyJobs) {
    const claimed = await db.update(integrationJobs).set({ status: "processing", lockedAt: now, updatedAt: now }).where(and4(eq4(integrationJobs.id, job.id), inArray(integrationJobs.status, ["pending", "retry"])));
    if (!getAffectedRows(claimed)) continue;
    result.processed += 1;
    let payload = null;
    try {
      const integration = (await db.select().from(whatsappIntegrations).where(and4(
        eq4(whatsappIntegrations.id, job.integrationId),
        eq4(whatsappIntegrations.studioId, job.studioId)
      )).limit(1))[0];
      if (!integration || !integration.isEnabled || integration.status !== "ativo") {
        throw new Error("Integra\xE7\xE3o inativa ou indispon\xEDvel para este est\xFAdio.");
      }
      payload = JSON.parse(job.payload);
      if (integration.sandboxMode) {
        if (!integration.sandboxTestPhone) throw new Error("Defina o telefone de teste antes de ativar a homologa\xE7\xE3o.");
        if (normalizeBrazilianPhone(payload.recipientPhone) !== integration.sandboxTestPhone) {
          throw new Error("Modo de teste: o destinat\xE1rio n\xE3o corresponde ao telefone de homologa\xE7\xE3o.");
        }
      } else {
        if (!payload.clientId) throw new Error("Envios em produ\xE7\xE3o exigem um cliente identificado e com consentimento de WhatsApp.");
        const consent = (await db.select().from(integrationContacts).where(and4(
          eq4(integrationContacts.studioId, job.studioId),
          eq4(integrationContacts.clientId, payload.clientId),
          eq4(integrationContacts.integrationId, integration.id)
        )).limit(1))[0];
        if (!consent?.hasWhatsappOptIn || consent.optedOutAt) {
          throw new Error("O cliente n\xE3o possui consentimento ativo para receber WhatsApp.");
        }
      }
      const provider = await getProviderForIntegration(integration);
      const sent = await provider.sendMessage(payload.recipientPhone, payload.message);
      if (!sent.success) throw new Error(sent.error ?? "Falha desconhecida do provedor.");
      await db.update(integrationJobs).set({ status: "completed", completedAt: sqlDate2(), lastError: null, updatedAt: sqlDate2() }).where(eq4(integrationJobs.id, job.id));
      if (payload.messageQueueId) await db.update(messageQueue).set({ status: "enviada", sentAt: sqlDate2(), providerMessageId: sent.messageId, errorMessage: null }).where(eq4(messageQueue.id, payload.messageQueueId));
      if (payload.appointmentReminderId) await db.update(appointmentReminders).set({ status: "sent", sentAt: sqlDate2() }).where(eq4(appointmentReminders.id, payload.appointmentReminderId));
      await db.update(integrationEvents).set({ status: "processed", processedAt: sqlDate2(), errorMessage: null }).where(and4(
        eq4(integrationEvents.studioId, job.studioId),
        eq4(integrationEvents.integrationId, integration.id),
        eq4(integrationEvents.idempotencyKey, getOutboundEventIdempotencyKey(job.idempotencyKey))
      ));
      await db.update(whatsappIntegrations).set({ lastSuccessAt: sqlDate2(), failureCount: 0, lastErrorMessage: null }).where(eq4(whatsappIntegrations.id, integration.id));
      result.completed += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro n\xE3o identificado no processamento.";
      const nextAttempt = job.attemptCount + 1;
      const terminal = nextAttempt >= job.maxAttempts;
      const nextAttemptAt = new Date(Date.now() + retryDelayMinutes(nextAttempt) * 6e4).toISOString().slice(0, 19).replace("T", " ");
      await db.update(integrationJobs).set({
        status: terminal ? "failed" : "retry",
        attemptCount: nextAttempt,
        nextAttemptAt: terminal ? null : nextAttemptAt,
        lastError: message,
        updatedAt: sqlDate2()
      }).where(eq4(integrationJobs.id, job.id));
      if (terminal) {
        if (payload?.messageQueueId) {
          await db.update(messageQueue).set({ status: "erro", errorMessage: message }).where(eq4(messageQueue.id, payload.messageQueueId));
        }
        if (payload?.appointmentReminderId) {
          await db.update(appointmentReminders).set({ status: "failed" }).where(eq4(appointmentReminders.id, payload.appointmentReminderId));
        }
        await db.update(integrationEvents).set({ status: "failed", errorMessage: message }).where(and4(
          eq4(integrationEvents.studioId, job.studioId),
          eq4(integrationEvents.integrationId, job.integrationId),
          eq4(integrationEvents.idempotencyKey, getOutboundEventIdempotencyKey(job.idempotencyKey))
        ));
        result.failed += 1;
      } else result.retried += 1;
    }
  }
  return result;
}
async function getTemplate(trigger, recipientType, studioId) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(messageTemplates).where(
    studioId != null ? and4(eq4(messageTemplates.trigger, trigger), eq4(messageTemplates.studioId, studioId)) : eq4(messageTemplates.trigger, trigger)
  ).limit(10);
  const template = rows.find(
    (r) => r.recipientType === recipientType && r.isActive
  );
  return template?.message ?? null;
}
async function dispatchTemplateMessage(params) {
  const template = await getTemplate(params.trigger, params.recipientType, params.studioId);
  if (!template) return { success: false, error: "Template n\xE3o encontrado" };
  const cleanedTemplate = removeLegacyNumericReplyInstruction(template);
  const interpolated = interpolateTemplate(cleanedTemplate, params.vars);
  const links = params.vars.__appointment_action_links;
  const actionPlaceholders = [
    ["confirmed", "{link_confirmacao}"],
    ["early", "{link_adiantamento}"],
    ["late", "{link_atraso}"],
    ["reschedule_requested", "{link_remarcar}"]
  ];
  const missingActions = links ? actionPlaceholders.filter(([, placeholder]) => !cleanedTemplate.includes(placeholder)).map(([action]) => action) : [];
  const message = links && missingActions.length ? `${interpolated}

${formatAppointmentActionLinks(links, missingActions)}` : interpolated;
  return sendAndLog({
    studioId: params.studioId,
    recipientPhone: params.recipientPhone,
    recipientName: params.recipientName,
    recipientType: params.recipientType,
    message,
    trigger: params.trigger,
    appointmentId: params.appointmentId,
    clientId: params.clientId,
    idempotencyKey: params.idempotencyKey
  });
}
async function seedDefaultTemplates(studioId = 1) {
  const db = await getDb();
  if (!db) return;
  const existing = await db.select({ trigger: messageTemplates.trigger, recipientType: messageTemplates.recipientType }).from(messageTemplates).where(eq4(messageTemplates.studioId, studioId));
  const defaults = [
    {
      studioId,
      name: "Confirma\xE7\xE3o de Agendamento (Cliente)",
      trigger: "appointment_created",
      recipientType: "client",
      message: "Ol\xE1, {nome_cliente}! Sua sess\xE3o no {nome_estudio} est\xE1 marcada para {data} \xE0s {hora}, com {nome_artista}.\n\nUse os links abaixo para confirmar presen\xE7a, avisar atraso ou solicitar remarca\xE7\xE3o.",
      isActive: 1
    },
    {
      studioId,
      name: "Notifica\xE7\xE3o de Agendamento (Tatuador)",
      trigger: "appointment_created",
      recipientType: "artist",
      message: "{nome_tatuador}, voc\xEA tem um novo agendamento!\n\nCliente: {nome_cliente}\nData: {data} \xE0s {hora}\nServi\xE7o: {servico}\n\nO cliente foi notificado e aguarda confirma\xE7\xE3o.",
      isActive: 1
    },
    {
      studioId,
      name: "Lembrete 24h (Cliente)",
      trigger: "appointment_reminder_24h",
      recipientType: "client",
      message: "Ol\xE1, {nome_cliente}! \u{1F550} Lembrando que sua sess\xE3o no {nome_estudio} \xE9 amanh\xE3, {data} \xE0s {hora}, com {nome_tatuador}.\n\nEndere\xE7o: {endereco}\n\nUse os links abaixo para confirmar presen\xE7a, avisar atraso ou solicitar remarca\xE7\xE3o.",
      isActive: 1
    },
    {
      studioId,
      name: "Lembrete 24h (Tatuador)",
      trigger: "appointment_reminder_24h",
      recipientType: "artist",
      message: "{nome_tatuador}, lembrete: amanh\xE3 voc\xEA tem sess\xE3o com {nome_cliente} \xE0s {hora}.\n\nServi\xE7o: {servico}",
      isActive: 1
    },
    {
      studioId,
      name: "Confirma\xE7\xE3o pelo Cliente",
      trigger: "appointment_confirmed",
      recipientType: "artist",
      message: "{nome_tatuador}, o cliente {nome_cliente} *confirmou* o agendamento de {data} \xE0s {hora}. \u2705",
      isActive: 1
    },
    {
      studioId,
      name: "Solicita\xE7\xE3o de Remarca\xE7\xE3o",
      trigger: "appointment_rescheduled",
      recipientType: "artist",
      message: "{nome_tatuador}, o cliente {nome_cliente} *solicitou remarca\xE7\xE3o* do agendamento de {data} \xE0s {hora}. Por favor, entre em contato.",
      isActive: 1
    },
    {
      studioId,
      name: "Lembrete 1h (Cliente)",
      trigger: "appointment_reminder_1h",
      recipientType: "client",
      message: "Ol\xE1, {nome_cliente}! Sua sess\xE3o de {servico} come\xE7a em aproximadamente 1 hora, \xE0s {hora}, com {nome_artista}.\n\nConfira seu preparo e fale conosco se precisar de ajuda.",
      isActive: 1
    },
    {
      studioId,
      name: "Lembrete 1h (Artista)",
      trigger: "appointment_reminder_1h",
      recipientType: "artist",
      message: "{nome_artista}, sua sess\xE3o com {nome_cliente} come\xE7a em aproximadamente 1 hora, \xE0s {hora}.\n\nServi\xE7o: {servico}.",
      isActive: 1
    },
    {
      studioId,
      name: "Orienta\xE7\xF5es de Cuidados",
      trigger: "care_guide",
      recipientType: "client",
      message: "Ol\xE1, {nome_cliente}! Aqui est\xE3o suas orienta\xE7\xF5es de pr\xE9 e p\xF3s-procedimento.\n\nAnamnese: {link_anamnese}\nGuia de cuidados: {link_ebook}",
      isActive: 1
    }
  ];
  const missing = defaults.filter((template) => !existing.some((row) => row.trigger === template.trigger && row.recipientType === template.recipientType));
  if (missing.length > 0) await db.insert(messageTemplates).values(missing);
}
var sqlDate2;
var init_service = __esm({
  "server/messaging/service.ts"() {
    "use strict";
    init_db();
    init_schema();
    init_provider();
    init_botconversa();
    init_zapi();
    init_meta();
    init_crypto();
    init_phone();
    init_appointmentActions();
    init_messagePresentation();
    sqlDate2 = () => (/* @__PURE__ */ new Date()).toISOString().slice(0, 19).replace("T", " ");
  }
});

// server/storage.ts
var storage_exports = {};
__export(storage_exports, {
  storageGet: () => storageGet,
  storagePut: () => storagePut,
  verifyStorageAccessToken: () => verifyStorageAccessToken
});
import { createHmac, timingSafeEqual as timingSafeEqual2 } from "crypto";
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
function ensureSecretConfigured() {
  if (!ENV.cookieSecret) {
    throw new Error("JWT_SECRET is required for secure storage links");
  }
}
function storageToken(key) {
  ensureSecretConfigured();
  return createHmac("sha256", ENV.cookieSecret).update(normalizeKey(key)).digest("hex");
}
function verifyStorageAccessToken(key, token) {
  if (!ENV.cookieSecret || !key || !token) return false;
  const expected = Buffer.from(storageToken(key), "utf8");
  const received = Buffer.from(token, "utf8");
  return expected.length === received.length && timingSafeEqual2(expected, received);
}
function buildStableProxyUrl(key) {
  const normalized = normalizeKey(key);
  const query = `key=${encodeURIComponent(normalized)}&token=${encodeURIComponent(storageToken(normalized))}`;
  return `${ENV.appBaseUrl || ""}/api/storage?${query}`;
}
function getManusStorageConfig() {
  const baseUrl = ENV.forgeApiUrl;
  const apiKey = ENV.forgeApiKey;
  if (!baseUrl || !apiKey) {
    throw new Error(
      "Storage proxy credentials missing: set BUILT_IN_FORGE_API_URL and BUILT_IN_FORGE_API_KEY"
    );
  }
  return { baseUrl: baseUrl.replace(/\/+$/, ""), apiKey };
}
function getS3Config() {
  if (!ENV.s3Endpoint || !ENV.s3AccessKeyId || !ENV.s3SecretAccessKey || !ENV.s3Bucket) {
    throw new Error(
      "S3 storage credentials missing: set AWS_ENDPOINT_URL, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY and AWS_S3_BUCKET_NAME"
    );
  }
  if (!s3Client) {
    s3Client = new S3Client({
      region: ENV.s3Region || "auto",
      endpoint: ENV.s3Endpoint,
      forcePathStyle: ENV.s3UrlStyle === "path",
      credentials: {
        accessKeyId: ENV.s3AccessKeyId,
        secretAccessKey: ENV.s3SecretAccessKey
      }
    });
  }
  return { client: s3Client, bucket: ENV.s3Bucket };
}
function buildUploadUrl(baseUrl, relKey) {
  const url = new URL("v1/storage/upload", ensureTrailingSlash(baseUrl));
  url.searchParams.set("path", normalizeKey(relKey));
  return url;
}
async function buildManusDownloadUrl(baseUrl, relKey, apiKey) {
  const downloadApiUrl = new URL(
    "v1/storage/downloadUrl",
    ensureTrailingSlash(baseUrl)
  );
  downloadApiUrl.searchParams.set("path", normalizeKey(relKey));
  const response = await fetch(downloadApiUrl, {
    method: "GET",
    headers: buildAuthHeaders(apiKey)
  });
  if (!response.ok) {
    const message = await response.text().catch(() => response.statusText);
    throw new Error(`Storage download URL failed (${response.status}): ${message}`);
  }
  return (await response.json()).url;
}
function ensureTrailingSlash(value) {
  return value.endsWith("/") ? value : `${value}/`;
}
function normalizeKey(relKey) {
  return relKey.replace(/^\/+/, "");
}
function toFormData(data, contentType, fileName) {
  const blob = typeof data === "string" ? new Blob([data], { type: contentType }) : new Blob([data], { type: contentType });
  const form = new FormData();
  form.append("file", blob, fileName || "file");
  return form;
}
function buildAuthHeaders(apiKey) {
  return { Authorization: `Bearer ${apiKey}` };
}
async function storagePut(relKey, data, contentType = "application/octet-stream") {
  const key = normalizeKey(relKey);
  if (ENV.storageProvider === "disabled") {
    console.warn("[Storage] Upload skipped - storage is disabled");
    return { key, url: "" };
  }
  if (ENV.storageProvider === "s3") {
    const { client, bucket } = getS3Config();
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: data,
        ContentType: contentType
      })
    );
    return { key, url: buildStableProxyUrl(key) };
  }
  if (ENV.storageProvider !== "manus") {
    throw new Error(`Unsupported STORAGE_PROVIDER: ${ENV.storageProvider}`);
  }
  const { baseUrl, apiKey } = getManusStorageConfig();
  const uploadUrl = buildUploadUrl(baseUrl, key);
  const formData = toFormData(data, contentType, key.split("/").pop() ?? key);
  const response = await fetch(uploadUrl, {
    method: "POST",
    headers: buildAuthHeaders(apiKey),
    body: formData
  });
  if (!response.ok) {
    const message = await response.text().catch(() => response.statusText);
    throw new Error(
      `Storage upload failed (${response.status} ${response.statusText}): ${message}`
    );
  }
  const url = (await response.json()).url;
  return { key, url };
}
async function storageGet(relKey) {
  const key = normalizeKey(relKey);
  if (ENV.storageProvider === "disabled") {
    console.warn("[Storage] Download skipped - storage is disabled");
    return { key, url: "" };
  }
  if (ENV.storageProvider === "s3") {
    const { client, bucket } = getS3Config();
    const url = await getSignedUrl(
      client,
      new GetObjectCommand({ Bucket: bucket, Key: key }),
      { expiresIn: 300 }
    );
    return { key, url };
  }
  if (ENV.storageProvider !== "manus") {
    throw new Error(`Unsupported STORAGE_PROVIDER: ${ENV.storageProvider}`);
  }
  const { baseUrl, apiKey } = getManusStorageConfig();
  return {
    key,
    url: await buildManusDownloadUrl(baseUrl, key, apiKey)
  };
}
var s3Client;
var init_storage = __esm({
  "server/storage.ts"() {
    "use strict";
    init_env();
    s3Client = null;
  }
});

// server/icsGenerator.ts
var icsGenerator_exports = {};
__export(icsGenerator_exports, {
  generateGoogleCalendarUrl: () => generateGoogleCalendarUrl,
  generateIcs: () => generateIcs
});
function icsEscape(text2) {
  return text2.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n").replace(/\r/g, "");
}
function foldLine(line) {
  if (line.length <= 75) return line;
  const chunks = [];
  chunks.push(line.slice(0, 75));
  let i = 75;
  while (i < line.length) {
    chunks.push(" " + line.slice(i, i + 74));
    i += 74;
  }
  return chunks.join("\r\n");
}
function toIcsDateTime(dateStr) {
  const [datePart, timePart] = dateStr.split(" ");
  const [year, month, day] = datePart.split("-");
  const [hour, minute, second] = (timePart || "00:00:00").split(":");
  const localDate = new Date(
    parseInt(year),
    parseInt(month) - 1,
    parseInt(day),
    parseInt(hour),
    parseInt(minute),
    parseInt(second || "0")
  );
  const utcDate = new Date(localDate.getTime() + 3 * 60 * 60 * 1e3);
  const pad = (n) => String(n).padStart(2, "0");
  return `${utcDate.getUTCFullYear()}${pad(utcDate.getUTCMonth() + 1)}${pad(utcDate.getUTCDate())}T${pad(utcDate.getUTCHours())}${pad(utcDate.getUTCMinutes())}${pad(utcDate.getUTCSeconds())}Z`;
}
function toIcsLocalDateTime(dateStr) {
  const [datePart, timePart = "00:00:00"] = dateStr.split(" ");
  return `${datePart.replace(/-/g, "")}T${timePart.replace(/:/g, "")}`;
}
function addMinutesToIcsLocalDateTime(dateStr, minutesToAdd) {
  const [datePart, timePart = "00:00:00"] = dateStr.split(" ");
  const [year, month, day] = datePart.split("-").map(Number);
  const [hour, minute, second = "0"] = timePart.split(":");
  const end = new Date(Date.UTC(year, month - 1, day, Number(hour), Number(minute), Number(second)) + minutesToAdd * 6e4);
  const pad = (value) => String(value).padStart(2, "0");
  return `${end.getUTCFullYear()}${pad(end.getUTCMonth() + 1)}${pad(end.getUTCDate())}T${pad(end.getUTCHours())}${pad(end.getUTCMinutes())}${pad(end.getUTCSeconds())}`;
}
function formatCurrency(value) {
  if (!value) return "N\xE3o informado";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL"
  }).format(value / 100);
}
function buildDescription(opts) {
  const { appointment, client, studio, anamnesis, anamnesisLink, confirmationLink } = opts;
  const lines = [];
  lines.push("\u{1F4CB} DADOS DO AGENDAMENTO");
  lines.push("\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500");
  lines.push(`Cliente: ${client.name}`);
  if (client.phone) lines.push(`Telefone: ${client.phone}`);
  if (client.email) lines.push(`E-mail: ${client.email}`);
  lines.push(`Servi\xE7o: ${appointment.service}`);
  lines.push(`Artista: ${appointment.artist}`);
  lines.push(`Dura\xE7\xE3o: ${appointment.duration} minutos`);
  const statusMap = {
    agendado: "Agendado",
    confirmado: "Confirmado",
    concluido: "Conclu\xEDdo",
    cancelado: "Cancelado",
    reagendado: "Reagendado"
  };
  lines.push(`Status: ${statusMap[appointment.status] || appointment.status}`);
  if (appointment.signalStatus) {
    const signalMap = {
      aguardando_sinal: "\u23F3 Aguardando Sinal",
      sinal_confirmado: "\u2705 Sinal Confirmado"
    };
    lines.push(`Sinal: ${signalMap[appointment.signalStatus] || appointment.signalStatus}`);
  }
  if (appointment.totalAmount) {
    lines.push(`Valor Total: ${formatCurrency(appointment.totalAmount)}`);
  }
  if (appointment.depositAmount) {
    lines.push(`Entrada/Sinal: ${formatCurrency(appointment.depositAmount)}`);
  }
  if (appointment.paymentStatus) {
    const payMap = {
      pendente: "\u{1F4B0} Pagamento Pendente",
      pago: "\u2705 Pago"
    };
    lines.push(`Pagamento: ${payMap[appointment.paymentStatus] || appointment.paymentStatus}`);
  }
  if (appointment.notes) {
    lines.push("");
    lines.push("\u{1F4DD} OBSERVA\xC7\xD5ES DO AGENDAMENTO");
    lines.push("\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500");
    lines.push(appointment.notes);
  }
  if (studio) {
    lines.push("");
    lines.push("\u{1F3E0} EST\xDADIO");
    lines.push("\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500");
    if (studio.name) lines.push(`Nome: ${studio.name}`);
    if (studio.address) lines.push(`Endere\xE7o: ${studio.address}`);
    if (studio.phone) lines.push(`Telefone: ${studio.phone}`);
  }
  if (anamnesis) {
    lines.push("");
    lines.push("\u{1FA7A} FICHA DE ANAMNESE");
    lines.push("\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500");
    const hasRisk = anamnesis.hasAllergies || anamnesis.hasDiseases || anamnesis.usesMedication || anamnesis.isPregnant || anamnesis.hasKeloid;
    if (hasRisk) {
      lines.push("\u26A0\uFE0F ATEN\xC7\xC3O: Cliente possui informa\xE7\xF5es de sa\xFAde relevantes!");
      lines.push("");
    }
    if (anamnesis.hasAllergies) {
      lines.push("\u26A0\uFE0F ALERGIAS: SIM");
      if (anamnesis.allergiesDetails) {
        lines.push(`   Detalhes: ${anamnesis.allergiesDetails}`);
      }
    }
    if (anamnesis.hasDiseases) {
      lines.push("\u26A0\uFE0F DOEN\xC7AS/CONDI\xC7\xD5ES: SIM");
      if (anamnesis.diseasesDetails) {
        lines.push(`   Detalhes: ${anamnesis.diseasesDetails}`);
      }
    }
    if (anamnesis.usesMedication) {
      lines.push("\u26A0\uFE0F USO DE MEDICAMENTOS: SIM");
      if (anamnesis.medicationDetails) {
        lines.push(`   Detalhes: ${anamnesis.medicationDetails}`);
      }
    }
    if (anamnesis.isPregnant) {
      lines.push("\u26A0\uFE0F GESTANTE: SIM");
    }
    if (anamnesis.hasKeloid) {
      lines.push("\u26A0\uFE0F TEND\xCANCIA A QUEL\xD3IDE: SIM");
    }
    if (!hasRisk) {
      lines.push("\u2705 Sem contraindica\xE7\xF5es registradas");
    }
    if (anamnesis.riskLevel) {
      const riskMap = {
        low: "\u{1F7E2} Baixo",
        medium: "\u{1F7E1} M\xE9dio",
        high: "\u{1F534} Alto"
      };
      lines.push(`N\xEDvel de Risco: ${riskMap[anamnesis.riskLevel] || anamnesis.riskLevel}`);
    }
    if (anamnesis.observations) {
      lines.push("");
      lines.push("\u{1F4CC} OBSERVA\xC7\xD5ES DA ANAMNESE (DESTAQUE):");
      lines.push(`>>> ${anamnesis.observations} <<<`);
    }
  }
  lines.push("");
  lines.push("\u{1F517} LINKS");
  lines.push("\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500");
  if (anamnesisLink) {
    lines.push(`Ficha de Anamnese: ${anamnesisLink}`);
  } else {
    lines.push(`Ficha de Anamnese: N\xE3o preenchida`);
  }
  if (confirmationLink) {
    lines.push(`Link de Confirma\xE7\xE3o (enviar ao cliente): ${confirmationLink}`);
  }
  lines.push(`Ver Agendamento no Sistema: ${opts.baseUrl}/clients/${opts.client.id}`);
  return lines.join("\\n");
}
function generateIcs(opts) {
  const { appointment, client } = opts;
  const dtStart = toIcsLocalDateTime(appointment.date);
  const dtEnd = addMinutesToIcsLocalDateTime(appointment.date, appointment.duration);
  const pad = (n) => String(n).padStart(2, "0");
  const uid = `appointment-${appointment.id}@tatuei.com`;
  const now = /* @__PURE__ */ new Date();
  const dtstamp = `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}Z`;
  const summary = icsEscape(`${appointment.service} \u2014 ${client.name} (${appointment.artist})`);
  const description = buildDescription(opts);
  const location = opts.studio?.address ? icsEscape(opts.studio.address) : opts.studio?.name ? icsEscape(opts.studio.name) : "";
  const alarm24h = [
    "BEGIN:VALARM",
    "TRIGGER:-PT24H",
    "ACTION:DISPLAY",
    `DESCRIPTION:Lembrete: ${icsEscape(appointment.service)} com ${icsEscape(client.name)} amanh\xE3`,
    "END:VALARM"
  ].join("\r\n");
  const alarm2h = [
    "BEGIN:VALARM",
    "TRIGGER:-PT2H",
    "ACTION:DISPLAY",
    `DESCRIPTION:Em 2 horas: ${icsEscape(appointment.service)} com ${icsEscape(client.name)}`,
    "END:VALARM"
  ].join("\r\n");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//POD CRM Tatuagem//PT",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:POD CRM - Agendamentos",
    "X-WR-TIMEZONE:America/Sao_Paulo",
    "BEGIN:VTIMEZONE",
    "TZID:America/Sao_Paulo",
    "X-LIC-LOCATION:America/Sao_Paulo",
    "BEGIN:STANDARD",
    "TZOFFSETFROM:-0300",
    "TZOFFSETTO:-0300",
    "TZNAME:BRT",
    "DTSTART:19700101T000000",
    "END:STANDARD",
    "END:VTIMEZONE",
    "BEGIN:VEVENT",
    foldLine(`UID:${uid}`),
    foldLine(`DTSTAMP:${dtstamp}`),
    foldLine(`DTSTART;TZID=America/Sao_Paulo:${dtStart}`),
    foldLine(`DTEND;TZID=America/Sao_Paulo:${dtEnd}`),
    foldLine(`SUMMARY:${summary}`),
    foldLine(`DESCRIPTION:${description}`),
    ...location ? [foldLine(`LOCATION:${location}`)] : [],
    foldLine(`URL:${opts.baseUrl}/clients/${client.id}`),
    "STATUS:CONFIRMED",
    "TRANSP:OPAQUE",
    alarm24h,
    alarm2h,
    "END:VEVENT",
    "END:VCALENDAR"
  ];
  return lines.join("\r\n");
}
function generateGoogleCalendarUrl(opts) {
  const { appointment, client } = opts;
  const dtStart = toIcsDateTime(appointment.date).replace("Z", "");
  const startDate = new Date(
    parseInt(appointment.date.slice(0, 4)),
    parseInt(appointment.date.slice(5, 7)) - 1,
    parseInt(appointment.date.slice(8, 10)),
    parseInt(appointment.date.slice(11, 13)),
    parseInt(appointment.date.slice(14, 16)),
    0
  );
  const endDate = new Date(startDate.getTime() + appointment.duration * 60 * 1e3 + 3 * 60 * 60 * 1e3);
  const pad = (n) => String(n).padStart(2, "0");
  const dtEnd = `${endDate.getUTCFullYear()}${pad(endDate.getUTCMonth() + 1)}${pad(endDate.getUTCDate())}T${pad(endDate.getUTCHours())}${pad(endDate.getUTCMinutes())}${pad(endDate.getUTCSeconds())}`;
  const title = encodeURIComponent(`${appointment.service} \u2014 ${client.name}`);
  const details = encodeURIComponent(
    `Artista: ${appointment.artist}
Cliente: ${client.name}${client.phone ? `
Telefone: ${client.phone}` : ""}${appointment.notes ? `
Observa\xE7\xF5es: ${appointment.notes}` : ""}${opts.confirmationLink ? `
Link de confirma\xE7\xE3o: ${opts.confirmationLink}` : ""}`
  );
  const location = encodeURIComponent(opts.studio?.address || opts.studio?.name || "");
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${dtStart}/${dtEnd}&details=${details}&location=${location}`;
}
var init_icsGenerator = __esm({
  "server/icsGenerator.ts"() {
    "use strict";
  }
});

// server/riskAssessment.ts
var riskAssessment_exports = {};
__export(riskAssessment_exports, {
  calculateRiskLevel: () => calculateRiskLevel
});
function calculateRiskLevel(data) {
  const riskFactors = [];
  let maxSeverity = "low";
  if (data.isPregnant) {
    riskFactors.push({
      category: "Gravidez",
      description: "Cliente est\xE1 gr\xE1vida - requer avalia\xE7\xE3o m\xE9dica",
      severity: "critical"
    });
    maxSeverity = "critical";
  }
  if (data.hasAllergies && data.allergiesDetails) {
    const allergiesLower = data.allergiesDetails.toLowerCase();
    if (allergiesLower.includes("anest\xE9sico") || allergiesLower.includes("lidoca\xEDna") || allergiesLower.includes("anestesia") || allergiesLower.includes("benzoca\xEDna")) {
      riskFactors.push({
        category: "Alergia",
        description: "Alergia a anest\xE9sicos - CR\xCDTICO",
        severity: "critical"
      });
      maxSeverity = "critical";
    } else if (allergiesLower.includes("l\xE1tex") || allergiesLower.includes("luva")) {
      riskFactors.push({
        category: "Alergia",
        description: "Alergia a l\xE1tex - usar luvas nitr\xEDlicas",
        severity: "high"
      });
      if (maxSeverity !== "critical") maxSeverity = "high";
    } else if (allergiesLower.includes("tinta") || allergiesLower.includes("pigmento") || allergiesLower.includes("corante")) {
      riskFactors.push({
        category: "Alergia",
        description: "Poss\xEDvel alergia a pigmentos - teste de sensibilidade recomendado",
        severity: "high"
      });
      if (maxSeverity !== "critical") maxSeverity = "high";
    } else {
      riskFactors.push({
        category: "Alergia",
        description: data.allergiesDetails,
        severity: "medium"
      });
      if (maxSeverity === "low") maxSeverity = "medium";
    }
  }
  if (data.hasDiseases && data.diseasesDetails) {
    const diseasesLower = data.diseasesDetails.toLowerCase();
    for (const condition of CRITICAL_CONDITIONS) {
      if (diseasesLower.includes(condition)) {
        riskFactors.push({
          category: "Doen\xE7a",
          description: `Condi\xE7\xE3o cr\xEDtica detectada: ${condition.toUpperCase()} - REQUER AUTORIZA\xC7\xC3O M\xC9DICA`,
          severity: "critical"
        });
        maxSeverity = "critical";
        break;
      }
    }
    if (maxSeverity !== "critical") {
      for (const condition of HIGH_RISK_CONDITIONS) {
        if (diseasesLower.includes(condition)) {
          riskFactors.push({
            category: "Doen\xE7a",
            description: `Condi\xE7\xE3o de alto risco: ${condition} - avalia\xE7\xE3o cuidadosa necess\xE1ria`,
            severity: "high"
          });
          maxSeverity = "high";
          break;
        }
      }
    }
    if (maxSeverity === "low") {
      for (const condition of MEDIUM_RISK_CONDITIONS) {
        if (diseasesLower.includes(condition)) {
          riskFactors.push({
            category: "Doen\xE7a",
            description: `Condi\xE7\xE3o de m\xE9dio risco: ${condition}`,
            severity: "medium"
          });
          maxSeverity = "medium";
          break;
        }
      }
    }
    if (riskFactors.filter((f) => f.category === "Doen\xE7a").length === 0) {
      riskFactors.push({
        category: "Doen\xE7a",
        description: data.diseasesDetails,
        severity: "medium"
      });
      if (maxSeverity === "low") maxSeverity = "medium";
    }
  }
  if (data.usesMedication && data.medicationDetails) {
    const medicationLower = data.medicationDetails.toLowerCase();
    if (CRITICAL_CONDITIONS.some((cond) => medicationLower.includes(cond))) {
      riskFactors.push({
        category: "Medicamento",
        description: "Medicamento de alto risco detectado - REQUER AUTORIZA\xC7\xC3O M\xC9DICA",
        severity: "critical"
      });
      maxSeverity = "critical";
    } else if (medicationLower.includes("anticoagulante") || medicationLower.includes("aspirina") || medicationLower.includes("\xE1cido acetilsalic\xEDlico") || medicationLower.includes("aas")) {
      riskFactors.push({
        category: "Medicamento",
        description: "Uso de anticoagulantes - risco aumentado de sangramento",
        severity: "high"
      });
      if (maxSeverity !== "critical") maxSeverity = "high";
    } else {
      riskFactors.push({
        category: "Medicamento",
        description: data.medicationDetails,
        severity: "low"
      });
    }
  }
  if (data.hasKeloid) {
    riskFactors.push({
      category: "Quel\xF3ide",
      description: "Tend\xEAncia a quel\xF3ide - cicatriza\xE7\xE3o anormal poss\xEDvel",
      severity: "medium"
    });
    if (maxSeverity === "low") maxSeverity = "medium";
  }
  if (riskFactors.length === 0) {
    riskFactors.push({
      category: "Geral",
      description: "Nenhum fator de risco identificado",
      severity: "low"
    });
  }
  return {
    riskLevel: maxSeverity,
    riskFactors
  };
}
var CRITICAL_CONDITIONS, HIGH_RISK_CONDITIONS, MEDIUM_RISK_CONDITIONS;
var init_riskAssessment = __esm({
  "server/riskAssessment.ts"() {
    "use strict";
    CRITICAL_CONDITIONS = [
      "hiv",
      "aids",
      "hepatite",
      "diabetes descompensado",
      "hemofilia",
      "c\xE2ncer ativo",
      "quimioterapia",
      "radioterapia",
      "imunossupressor",
      "transplante recente",
      "insufici\xEAncia renal",
      "di\xE1lise",
      "marca-passo",
      "anticoagulante",
      "varfarina",
      "heparina"
    ];
    HIGH_RISK_CONDITIONS = [
      "diabetes",
      "hipertens\xE3o descontrolada",
      "epilepsia",
      "asma grave",
      "doen\xE7a card\xEDaca",
      "problema card\xEDaco",
      "press\xE3o alta descontrolada",
      "convuls\xE3o",
      "alergia grave",
      "anafilaxia",
      "corticoide",
      "imunossupress\xE3o",
      "l\xFApus",
      "artrite reumatoide"
    ];
    MEDIUM_RISK_CONDITIONS = [
      "hipertens\xE3o controlada",
      "press\xE3o alta controlada",
      "asma",
      "bronquite",
      "rinite",
      "sinusite",
      "gastrite",
      "refluxo",
      "ansiedade",
      "depress\xE3o",
      "enxaqueca",
      "anemia"
    ];
  }
});

// server/auditPdfGenerator.ts
var auditPdfGenerator_exports = {};
__export(auditPdfGenerator_exports, {
  generateAuditPDF: () => generateAuditPDF
});
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? [
    parseInt(result[1], 16),
    parseInt(result[2], 16),
    parseInt(result[3], 16)
  ] : [139, 92, 246];
}
async function generateAuditPDF(data) {
  const doc = new jsPDF();
  let yPosition = 20;
  const template = data.template || {};
  const includeSections = template.includeSections || [
    "metrics",
    "actionsByType",
    "actionsByEntity",
    "topUsers",
    "actionsByDay",
    "recentLogs"
  ];
  const primaryColor = template.primaryColor || "#8b5cf6";
  const primaryRgb = hexToRgb(primaryColor);
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text(
    template.reportTitle || "Relat\xF3rio de Auditoria",
    105,
    yPosition,
    { align: "center" }
  );
  yPosition += 10;
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  if (template.reportSubtitle) {
    doc.text(template.reportSubtitle, 105, yPosition, { align: "center" });
    yPosition += 5;
  }
  doc.text(
    `Per\xEDodo: ${format(data.startDate, "dd/MM/yyyy", { locale: ptBR })} a ${format(data.endDate, "dd/MM/yyyy", { locale: ptBR })}`,
    105,
    yPosition,
    { align: "center" }
  );
  yPosition += 5;
  doc.text(
    `Gerado em: ${format(/* @__PURE__ */ new Date(), "dd/MM/yyyy '\xE0s' HH:mm", { locale: ptBR })}`,
    105,
    yPosition,
    { align: "center" }
  );
  yPosition += 15;
  if (includeSections.includes("metrics")) {
    if (yPosition > 250) {
      doc.addPage();
      yPosition = 20;
    }
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("M\xE9tricas Principais", 14, yPosition);
    yPosition += 8;
    const metricsData = [
      ["Total de A\xE7\xF5es", data.statistics.totalActions.toString()],
      ["A\xE7\xF5es nas \xDAltimas 24h", data.statistics.actionsLast24h.toString()],
      [
        "Usu\xE1rio Mais Ativo",
        data.statistics.mostActiveUser ? `${data.statistics.mostActiveUser.name || "N/A"} (${data.statistics.mostActiveUser.count} a\xE7\xF5es)` : "N/A"
      ],
      [
        "Entidade Mais Modificada",
        data.statistics.mostModifiedEntity ? `${ENTITY_LABELS[data.statistics.mostModifiedEntity.entity] || data.statistics.mostModifiedEntity.entity} (${data.statistics.mostModifiedEntity.count} modifica\xE7\xF5es)` : "N/A"
      ]
    ];
    autoTable(doc, {
      startY: yPosition,
      head: [["M\xE9trica", "Valor"]],
      body: metricsData,
      theme: "grid",
      headStyles: { fillColor: primaryRgb },
      styles: { fontSize: 9 }
    });
    yPosition = doc.lastAutoTable.finalY + 15;
  }
  if (includeSections.includes("actionsByType")) {
    if (yPosition > 250) {
      doc.addPage();
      yPosition = 20;
    }
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Distribui\xE7\xE3o por Tipo de A\xE7\xE3o", 14, yPosition);
    yPosition += 8;
    const actionTypeData = data.actionsByType.map((item) => [
      ACTION_LABELS[item.action] || item.action,
      item.count.toString(),
      `${(item.count / data.statistics.totalActions * 100).toFixed(1)}%`
    ]);
    autoTable(doc, {
      startY: yPosition,
      head: [["Tipo de A\xE7\xE3o", "Quantidade", "Percentual"]],
      body: actionTypeData,
      theme: "grid",
      headStyles: { fillColor: primaryRgb },
      styles: { fontSize: 9 }
    });
    yPosition = doc.lastAutoTable.finalY + 15;
  }
  if (includeSections.includes("actionsByEntity")) {
    if (yPosition > 250) {
      doc.addPage();
      yPosition = 20;
    }
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Distribui\xE7\xE3o por Entidade", 14, yPosition);
    yPosition += 8;
    const entityData = data.actionsByEntity.map((item) => [
      ENTITY_LABELS[item.entity] || item.entity,
      item.count.toString(),
      `${(item.count / data.statistics.totalActions * 100).toFixed(1)}%`
    ]);
    autoTable(doc, {
      startY: yPosition,
      head: [["Entidade", "Quantidade", "Percentual"]],
      body: entityData,
      theme: "grid",
      headStyles: { fillColor: primaryRgb },
      styles: { fontSize: 9 }
    });
    yPosition = doc.lastAutoTable.finalY + 15;
  }
  if (includeSections.includes("topUsers")) {
    if (yPosition > 250) {
      doc.addPage();
      yPosition = 20;
    }
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Top Usu\xE1rios Mais Ativos", 14, yPosition);
    yPosition += 8;
    const topUsersData = data.topUsers.map((user, index2) => [
      (index2 + 1).toString(),
      user.userName || "N/A",
      user.count.toString()
    ]);
    autoTable(doc, {
      startY: yPosition,
      head: [["#", "Usu\xE1rio", "A\xE7\xF5es"]],
      body: topUsersData,
      theme: "grid",
      headStyles: { fillColor: primaryRgb },
      styles: { fontSize: 9 }
    });
    yPosition = doc.lastAutoTable.finalY + 15;
  }
  if (includeSections.includes("actionsByDay")) {
    if (yPosition > 250) {
      doc.addPage();
      yPosition = 20;
    }
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Atividade ao Longo do Tempo", 14, yPosition);
    yPosition += 8;
    const activityData = data.actionsByDay.map((item) => [
      format(new Date(item.date), "dd/MM/yyyy", { locale: ptBR }),
      item.count.toString()
    ]);
    autoTable(doc, {
      startY: yPosition,
      head: [["Data", "A\xE7\xF5es"]],
      body: activityData,
      theme: "grid",
      headStyles: { fillColor: primaryRgb },
      styles: { fontSize: 9 }
    });
    yPosition = doc.lastAutoTable.finalY + 15;
  }
  if (includeSections.includes("recentLogs")) {
    if (yPosition > 250) {
      doc.addPage();
      yPosition = 20;
    }
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Logs de Auditoria Recentes", 14, yPosition);
    yPosition += 8;
    const logsData = data.recentLogs.map((log) => [
      format(new Date(log.createdAt), "dd/MM HH:mm", { locale: ptBR }),
      log.userName || "N/A",
      ACTION_LABELS[log.action] || log.action,
      ENTITY_LABELS[log.entity] || log.entity,
      log.entityName || "-"
    ]);
    autoTable(doc, {
      startY: yPosition,
      head: [["Data/Hora", "Usu\xE1rio", "A\xE7\xE3o", "Entidade", "Nome"]],
      body: logsData,
      theme: "grid",
      headStyles: { fillColor: primaryRgb },
      styles: { fontSize: 8 },
      columnStyles: {
        0: { cellWidth: 25 },
        1: { cellWidth: 40 },
        2: { cellWidth: 25 },
        3: { cellWidth: 35 },
        4: { cellWidth: 45 }
      }
    });
  }
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    const footerY = doc.internal.pageSize.height - 10;
    if (template.footerText) {
      doc.text(template.footerText, 14, footerY);
    }
    doc.text(
      `P\xE1gina ${i} de ${pageCount}`,
      105,
      footerY,
      { align: "center" }
    );
  }
  const pdfBuffer = Buffer.from(doc.output("arraybuffer"));
  return pdfBuffer;
}
var ACTION_LABELS, ENTITY_LABELS;
var init_auditPdfGenerator = __esm({
  "server/auditPdfGenerator.ts"() {
    "use strict";
    ACTION_LABELS = {
      create: "Cria\xE7\xE3o",
      update: "Edi\xE7\xE3o",
      delete: "Exclus\xE3o",
      activate: "Ativa\xE7\xE3o",
      deactivate: "Desativa\xE7\xE3o"
    };
    ENTITY_LABELS = {
      user: "Usu\xE1rios",
      client: "Clientes",
      appointment: "Agendamentos",
      transaction: "Transa\xE7\xF5es"
    };
  }
});

// server/messaging/webhook.ts
var webhook_exports = {};
__export(webhook_exports, {
  handleWebhookReply: () => handleWebhookReply
});
import { and as and10, eq as eq10, desc as desc7 } from "drizzle-orm";
async function handleWebhookReply(phone, message, studioId) {
  const db = await getDb();
  if (!db) return;
  const normalizedPhone = phone.replace(/[\s\-\+\(\)]/g, "");
  const reply = message.trim();
  const recentMessages = await db.select().from(messageQueue).where(studioId != null ? and10(eq10(messageQueue.recipientPhone, normalizedPhone), eq10(messageQueue.studioId, studioId)) : eq10(messageQueue.recipientPhone, normalizedPhone)).orderBy(desc7(messageQueue.createdAt)).limit(5);
  const lastMsg = recentMessages.find((m) => m.appointmentId && m.recipientType === "client");
  if (!lastMsg?.appointmentId) {
    console.log(`[Webhook] Nenhum agendamento encontrado para ${normalizedPhone}`);
    return;
  }
  const appointmentId = lastMsg.appointmentId;
  const clientId = lastMsg.clientId;
  const aptRows = await db.select().from(appointments).where(eq10(appointments.id, appointmentId)).limit(1);
  const apt = aptRows[0];
  if (!apt) return;
  const aptDate = new Date(apt.date.replace(" ", "T"));
  const dataFormatada = aptDate.toLocaleDateString("pt-BR");
  const horaFormatada = aptDate.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  if (reply === "1") {
    await db.update(appointments).set({ confirmationStatus: "confirmado" }).where(eq10(appointments.id, appointmentId));
    await db.update(messageQueue).set({ status: "respondida" }).where(eq10(messageQueue.id, lastMsg.id));
    console.log(`[Webhook] Cliente ${normalizedPhone} CONFIRMOU agendamento #${appointmentId}`);
    await notifyArtistAboutReply(apt, "appointment_confirmed", {
      nome_tatuador: apt.artist,
      nome_cliente: apt.clientName ?? "Cliente",
      data: dataFormatada,
      hora: horaFormatada
    });
  } else if (reply === "2") {
    await db.update(appointments).set({ status: "reagendado", confirmationStatus: "nao_confirmado" }).where(eq10(appointments.id, appointmentId));
    await db.update(messageQueue).set({ status: "respondida" }).where(eq10(messageQueue.id, lastMsg.id));
    console.log(`[Webhook] Cliente ${normalizedPhone} SOLICITOU REMARCA\xC7\xC3O do agendamento #${appointmentId}`);
    await notifyArtistAboutReply(apt, "appointment_rescheduled", {
      nome_tatuador: apt.artist,
      nome_cliente: apt.clientName ?? "Cliente",
      data: dataFormatada,
      hora: horaFormatada
    });
  }
}
async function notifyArtistAboutReply(apt, trigger, vars) {
  try {
    const db = await getDb();
    if (!db || !apt.artistId) return;
    const { artists: artists2 } = await Promise.resolve().then(() => (init_schema(), schema_exports));
    const artistRows = await db.select().from(artists2).where(eq10(artists2.id, apt.artistId)).limit(1);
    const artist = artistRows[0];
    if (!artist?.phone) return;
    await dispatchTemplateMessage({
      trigger,
      recipientType: "artist",
      recipientPhone: artist.phone,
      recipientName: artist.name,
      appointmentId: apt.id,
      vars
    });
  } catch (err) {
    console.error("[Webhook] Erro ao notificar artista:", err);
  }
}
var init_webhook = __esm({
  "server/messaging/webhook.ts"() {
    "use strict";
    init_db();
    init_schema();
    init_service();
  }
});

// server/_core/index.ts
import "dotenv/config";
import express2 from "express";
import { createServer } from "http";
import { createExpressMiddleware } from "@trpc/server/adapters/express";

// server/_core/oauth.ts
init_const();
init_db();
init_cookies();
init_sdk();
function getQueryParam(req, key) {
  const value = req.query[key];
  return typeof value === "string" ? value : void 0;
}
function registerOAuthRoutes(app) {
  app.get("/api/oauth/callback", async (req, res) => {
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");
    if (!code || !state) {
      res.status(400).json({ error: "code and state are required" });
      return;
    }
    try {
      const tokenResponse = await sdk.exchangeCodeForToken(code, state);
      const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);
      if (!userInfo.openId) {
        res.status(400).json({ error: "openId missing from user info" });
        return;
      }
      await upsertUser({
        openId: userInfo.openId,
        name: userInfo.name || null,
        email: userInfo.email ?? null,
        loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
        lastSignedIn: (/* @__PURE__ */ new Date()).toISOString()
      });
      const sessionToken = await sdk.createSessionToken(userInfo.openId, {
        name: userInfo.name || "",
        expiresInMs: ONE_YEAR_MS
      });
      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
      res.redirect(302, "/");
    } catch (error) {
      console.error("[OAuth] Callback failed", error);
      res.status(500).json({ error: "OAuth callback failed" });
    }
  });
}

// server/_core/index.ts
init_localAuth();
init_env();

// server/routers.ts
init_const();
init_cookies();
import { z as z6 } from "zod";
import { TRPCError as TRPCError7 } from "@trpc/server";

// server/_core/systemRouter.ts
init_notification();
import { z } from "zod";

// server/_core/trpc.ts
init_const();
import { initTRPC, TRPCError as TRPCError2 } from "@trpc/server";
import superjson from "superjson";

// server/saas.ts
init_db();
init_schema();
import { createHash, randomBytes } from "node:crypto";
import { and as and2, desc as desc2, eq as eq2, gt } from "drizzle-orm";
var SAAS_MODULES = ["clients", "appointments", "stock", "finance", "anamnesis", "pod", "reports"];
var hashToken = (token) => createHash("sha256").update(token).digest("hex");
var nowSql = () => (/* @__PURE__ */ new Date()).toISOString().slice(0, 19).replace("T", " ");
function invitationExpiresAt(days = 7) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1e3).toISOString().slice(0, 19).replace("T", " ");
}
async function createStudioInvitation(input) {
  const database = await getDb();
  if (!database) throw new Error("Banco de dados indispon\xEDvel");
  const token = randomBytes(32).toString("hex");
  const expiresAt = invitationExpiresAt(7);
  await database.insert(studioInvitations).values({
    studioId: input.studioId,
    email: input.email.trim().toLowerCase(),
    role: input.role,
    tokenHash: hashToken(token),
    status: "pending",
    expiresAt,
    invitedByUserId: input.invitedByUserId
  });
  return { token, expiresAt };
}
async function listStudioInvitations(studioId) {
  const database = await getDb();
  if (!database) return [];
  const rows = studioId ? await database.select().from(studioInvitations).where(eq2(studioInvitations.studioId, studioId)).orderBy(desc2(studioInvitations.createdAt)) : await database.select().from(studioInvitations).orderBy(desc2(studioInvitations.createdAt));
  return rows;
}
async function revokeStudioInvitation(id, studioId) {
  const database = await getDb();
  if (!database) throw new Error("Banco de dados indispon\xEDvel");
  const condition = studioId ? and2(eq2(studioInvitations.id, id), eq2(studioInvitations.studioId, studioId)) : eq2(studioInvitations.id, id);
  return database.update(studioInvitations).set({ status: "revoked", revokedAt: nowSql() }).where(condition);
}
async function claimStudioInvitation(token, userId) {
  const database = await getDb();
  if (!database) throw new Error("Banco de dados indispon\xEDvel");
  const invitation = (await database.select().from(studioInvitations).where(eq2(studioInvitations.tokenHash, hashToken(token))).limit(1))[0];
  if (!invitation) return { ok: false, reason: "not_found" };
  if (invitation.status !== "pending") return { ok: false, reason: invitation.status };
  if (new Date(invitation.expiresAt).getTime() <= Date.now()) {
    await database.update(studioInvitations).set({ status: "expired" }).where(eq2(studioInvitations.id, invitation.id));
    return { ok: false, reason: "expired" };
  }
  const currentUser = (await database.select().from(users).where(eq2(users.id, userId)).limit(1))[0];
  if (!currentUser || (currentUser.email ?? "").trim().toLowerCase() !== invitation.email) return { ok: false, reason: "email_mismatch" };
  await database.update(users).set({
    studioId: invitation.studioId,
    role: invitation.role,
    isActive: 1,
    accessStatus: "active",
    accessExpiresAt: invitation.expiresAt
  }).where(eq2(users.id, userId));
  await database.update(studioInvitations).set({ status: "accepted", acceptedUserId: userId, acceptedAt: nowSql() }).where(eq2(studioInvitations.id, invitation.id));
  return { ok: true, studioId: invitation.studioId, role: invitation.role, expiresAt: invitation.expiresAt };
}
async function isUserAccessActive(user) {
  if (user.isActive === 0 || user.accessStatus === "suspended") return false;
  if (user.role === "superadmin") return true;
  if (user.accessExpiresAt && new Date(user.accessExpiresAt).getTime() <= Date.now()) return false;
  return user.accessStatus !== "expired";
}
async function listUserPermissions(userId, studioId) {
  const database = await getDb();
  if (!database) return [];
  return database.select().from(userModulePermissions).where(and2(eq2(userModulePermissions.userId, userId), eq2(userModulePermissions.studioId, studioId)));
}
async function replaceUserPermissions(input) {
  const database = await getDb();
  if (!database) throw new Error("Banco de dados indispon\xEDvel");
  await database.delete(userModulePermissions).where(and2(eq2(userModulePermissions.userId, input.userId), eq2(userModulePermissions.studioId, input.studioId)));
  if (input.permissions.length === 0) return;
  await database.insert(userModulePermissions).values(input.permissions.map((permission) => ({
    userId: input.userId,
    studioId: input.studioId,
    module: permission.module,
    canRead: permission.canRead ? 1 : 0,
    canWrite: permission.canWrite ? 1 : 0
  })));
}
function hasValidTrialAccess(accessExpiresAt) {
  return !accessExpiresAt || new Date(accessExpiresAt).getTime() > Date.now();
}
function summarizeSaasMetrics(input) {
  const members = input.users.filter((user) => user.role !== "superadmin");
  const activeMembers = members.filter((user) => user.isActive !== 0 && user.accessStatus !== "suspended" && user.accessStatus !== "expired" && hasValidTrialAccess(user.accessExpiresAt));
  const now = Date.now();
  const sevenDaysFromNow = now + 7 * 24 * 60 * 60 * 1e3;
  return {
    totalStudios: input.studios.length,
    activeStudios: input.studios.filter((studio) => studio.isActive !== 0).length,
    activeUsers: activeMembers.length,
    administrators: activeMembers.filter((user) => user.role === "admin").length,
    collaborators: activeMembers.filter((user) => user.role === "collaborator").length,
    activeTrialAccesses: activeMembers.filter((user) => Boolean(user.accessExpiresAt)).length,
    accessExpiringSoon: activeMembers.filter((user) => {
      if (!user.accessExpiresAt) return false;
      const expiresAt = new Date(user.accessExpiresAt).getTime();
      return expiresAt > now && expiresAt <= sevenDaysFromNow;
    }).length,
    invitations: {
      pending: input.invitations.filter((invitation) => invitation.status === "pending" && new Date(invitation.expiresAt).getTime() > now).length,
      accepted: input.invitations.filter((invitation) => invitation.status === "accepted").length,
      revoked: input.invitations.filter((invitation) => invitation.status === "revoked").length,
      expired: input.invitations.filter((invitation) => invitation.status === "expired" || invitation.status === "pending" && new Date(invitation.expiresAt).getTime() <= now).length
    },
    billingEnabled: false
  };
}
async function hasModulePermission(input) {
  const database = await getDb();
  if (!database) return false;
  const rows = await database.select().from(userModulePermissions).where(and2(
    eq2(userModulePermissions.userId, input.userId),
    eq2(userModulePermissions.studioId, input.studioId),
    eq2(userModulePermissions.module, input.module),
    input.write ? gt(userModulePermissions.canWrite, 0) : gt(userModulePermissions.canRead, 0)
  )).limit(1);
  return rows.length > 0;
}

// server/_core/trpc.ts
var t = initTRPC.context().create({
  transformer: superjson
});
var router = t.router;
var publicProcedure = t.procedure;
var requireUser = t.middleware(async (opts) => {
  const { ctx, next } = opts;
  if (!ctx.user) {
    throw new TRPCError2({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }
  if (!await isUserAccessActive(ctx.user)) {
    throw new TRPCError2({ code: "FORBIDDEN", message: "Acesso suspenso ou expirado." });
  }
  return next({
    ctx: {
      ...ctx,
      user: ctx.user
    }
  });
});
var protectedProcedure = t.procedure.use(requireUser);
var tenantProcedure = protectedProcedure.use(
  t.middleware(async ({ ctx, next }) => {
    if (!ctx.user) {
      throw new TRPCError2({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
    }
    if (!ctx.user.studioId) {
      throw new TRPCError2({ code: "FORBIDDEN", message: "Usu\xE1rio sem empresa ativa vinculada." });
    }
    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
        studioId: ctx.user.studioId,
        artistId: ctx.user.role === "collaborator" ? ctx.user.artistId : null
      }
    });
  })
);
var superAdminProcedure = t.procedure.use(
  t.middleware(async (opts) => {
    const { ctx, next } = opts;
    if (!ctx.user || ctx.user.role !== "superadmin") {
      throw new TRPCError2({ code: "FORBIDDEN", message: "Acesso negado. Apenas super administradores." });
    }
    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
        studioId: null,
        // Super admin não tem restrição de estúdio
        artistId: null
      }
    });
  })
);
var adminProcedure = t.procedure.use(
  t.middleware(async (opts) => {
    const { ctx, next } = opts;
    if (!ctx.user) {
      throw new TRPCError2({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
    }
    if (ctx.user.role !== "admin") {
      throw new TRPCError2({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }
    if (!ctx.user.studioId) {
      throw new TRPCError2({ code: "FORBIDDEN", message: "Administrador n\xE3o vinculado a um est\xFAdio." });
    }
    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
        studioId: ctx.user.studioId,
        artistId: null
        // Admin vê todos os artistas do estúdio
      }
    });
  })
);
var collaboratorProcedure = t.procedure.use(
  t.middleware(async (opts) => {
    const { ctx, next } = opts;
    if (!ctx.user) {
      throw new TRPCError2({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
    }
    if (ctx.user.role !== "collaborator") {
      throw new TRPCError2({ code: "FORBIDDEN", message: "Acesso negado. Apenas colaboradores." });
    }
    if (!ctx.user.studioId) {
      throw new TRPCError2({ code: "FORBIDDEN", message: "Colaborador n\xE3o vinculado a um est\xFAdio." });
    }
    if (!ctx.user.artistId) {
      throw new TRPCError2({ code: "FORBIDDEN", message: "Colaborador n\xE3o vinculado a um artista." });
    }
    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
        studioId: ctx.user.studioId,
        artistId: ctx.user.artistId
      }
    });
  })
);
var artistProcedure = t.procedure.use(
  t.middleware(async (opts) => {
    const { ctx, next } = opts;
    if (!ctx.user) {
      throw new TRPCError2({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
    }
    if (ctx.user.role !== "admin" && ctx.user.role !== "collaborator" && ctx.user.role !== "superadmin") {
      throw new TRPCError2({ code: "FORBIDDEN", message: "Acesso negado. Apenas administradores e colaboradores." });
    }
    if (!ctx.user.studioId && ctx.user.role !== "superadmin") {
      throw new TRPCError2({ code: "FORBIDDEN", message: "Usu\xE1rio n\xE3o vinculado a um est\xFAdio." });
    }
    if (ctx.user.role === "collaborator" && !ctx.user.artistId) {
      throw new TRPCError2({ code: "FORBIDDEN", message: "Colaborador n\xE3o vinculado a um artista." });
    }
    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
        studioId: ctx.user.studioId || null,
        // Passa o artistId para contexto (null para admins = acesso total ao estúdio)
        artistId: ctx.user.role === "collaborator" ? ctx.user.artistId : null
      }
    });
  })
);

// server/_core/systemRouter.ts
var systemRouter = router({
  health: publicProcedure.input(
    z.object({
      timestamp: z.number().min(0, "timestamp cannot be negative")
    })
  ).query(() => ({
    ok: true
  })),
  notifyOwner: adminProcedure.input(
    z.object({
      title: z.string().min(1, "title is required"),
      content: z.string().min(1, "content is required")
    })
  ).mutation(async ({ input }) => {
    const delivered = await notifyOwner(input);
    return {
      success: delivered
    };
  }),
  /**
   * Testa a conexão com o Google Sheets enviando um ping e retornando o resultado.
   * Usado pelo frontend para exibir notificações visuais de status de sync.
   */
  syncTest: protectedProcedure.mutation(async () => {
    const webhookUrl = process.env.GOOGLE_SHEETS_WEBHOOK_URL ?? "";
    const syncSecret = process.env.GOOGLE_SHEETS_SYNC_SECRET ?? "";
    if (!webhookUrl || !syncSecret) {
      return { ok: false, error: "Integra\xE7\xE3o com Google Sheets n\xE3o configurada" };
    }
    try {
      const res = await fetch(webhookUrl, {
        method: "GET",
        signal: AbortSignal.timeout(1e4)
      });
      const data = await res.json();
      if (data?.sucesso === true || data?.mensagem) {
        return { ok: true };
      }
      return { ok: false, error: "Resposta inesperada do Google Sheets" };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { ok: false, error: message };
    }
  })
});

// server/googleSheetsSync.ts
function isConfigured() {
  return Boolean(process.env.GOOGLE_SHEETS_WEBHOOK_URL && process.env.GOOGLE_SHEETS_SYNC_SECRET);
}
function fireAndForget(payload, label) {
  const webhookUrl = process.env.GOOGLE_SHEETS_WEBHOOK_URL ?? "";
  const syncSecret = process.env.GOOGLE_SHEETS_SYNC_SECRET ?? "";
  if (!isConfigured()) {
    if (process.env.NODE_ENV !== "production") {
      console.debug(`[Google Sheets Sync] Integra\xE7\xE3o n\xE3o configurada \u2014 pulando sync de ${label}`);
    }
    return;
  }
  const body = JSON.stringify({ ...payload, secret: syncSecret });
  const url = `${webhookUrl}?dados=${encodeURIComponent(body)}`;
  fetch(url, { method: "GET" }).then((res) => res.json()).then((data) => console.log(`[Google Sheets Sync] ${label} sincronizado:`, data)).catch((err) => console.error(`[Google Sheets Sync] Erro ao sincronizar ${label}:`, err));
}
function syncClientToSheets(client) {
  const phone = String(client.phone ?? "").replace(/\D/g, "");
  const birthDate = client.birthDate ?? "";
  const [day, month] = birthDate.split("/");
  fireAndForget(
    {
      tipo: "cliente",
      cliente_id: String(client.id),
      nome_completo: client.name ?? "",
      nome_preferido: client.nickname ?? "",
      telefone_whatsapp: phone,
      ddi: client.ddi ?? "55",
      email: client.email ?? "",
      instagram: client.instagram ?? "",
      cpf_rg: client.cpf ?? "",
      data_nascimento: birthDate,
      dia_aniversario: day ?? "",
      mes_aniversario: month ?? "",
      endereco: client.address ?? "",
      numero: client.addressNumber ?? "",
      complemento: client.addressComplement ?? "",
      bairro: client.neighborhood ?? "",
      cidade: client.city ?? "",
      uf: client.state ?? "",
      pais: client.country ?? "Brasil",
      status_cliente: client.status ?? "ativo",
      aceita_whatsapp: client.acceptsWhatsapp ? "sim" : "nao",
      aceita_promocoes: client.acceptsPromotions ? "sim" : "nao",
      observacoes: client.notes ?? ""
    },
    `cliente #${client.id}`
  );
}
function syncAppointmentToSheets(appt) {
  const startDate = appt.startTime ? new Date(appt.startTime) : null;
  const dataAgendamento = startDate ? startDate.toLocaleDateString("pt-BR") : "";
  const horaAgendamento = startDate ? startDate.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "";
  const dataHoraIso = startDate ? startDate.toISOString() : "";
  fireAndForget(
    {
      tipo: "agendamento",
      agendamento_id: String(appt.id),
      cliente_id: appt.clientId ? String(appt.clientId) : "",
      nome_cliente: appt.clientName ?? "",
      telefone_whatsapp: String(appt.clientPhone ?? "").replace(/\D/g, ""),
      profissional: appt.artistName ?? "",
      data_agendamento: dataAgendamento,
      hora_agendamento: horaAgendamento,
      data_hora_iso: dataHoraIso,
      servico: appt.service ?? "",
      local_corpo: appt.bodyLocation ?? "",
      status_agendamento: appt.status ?? "agendado",
      sinal_pago: appt.depositPaid ? "sim" : "nao",
      valor_sinal: String(appt.depositAmount ?? 0),
      valor_total: String(appt.totalPrice ?? 0),
      forma_pagamento_sinal: appt.depositPaymentMethod ?? "",
      observacoes: appt.notes ?? ""
    },
    `agendamento #${appt.id}`
  );
}
function syncAnamnesisSubmissionToSheets(sub) {
  const submittedAt = sub.submittedAt ? new Date(sub.submittedAt) : /* @__PURE__ */ new Date();
  fireAndForget(
    {
      tipo: "anamnese",
      anamnese_id: `SUB-${sub.id}`,
      cliente_id: sub.clientId ? String(sub.clientId) : "",
      agendamento_id: sub.appointmentId ? String(sub.appointmentId) : "",
      nome_cliente: sub.clientName ?? "",
      profissional: sub.artistName ?? "",
      data_preenchimento: submittedAt.toLocaleDateString("pt-BR"),
      valor_tatuagem: String(sub.tattooValue ?? 0),
      descricao_arte: sub.tattooDescription ?? "",
      local_corpo: sub.bodyLocation ?? "",
      autorizacao_procedimento: sub.authorizationSigned ? "sim" : "nao",
      risk_level: sub.riskLevel ?? "baixo",
      tem_observacao_importante: sub.hasImportantNote ? "sim" : "nao",
      observacoes_resumidas: sub.notesSummary ?? "",
      dados_sensiveis_exportados: "nao"
    },
    `submiss\xE3o de anamnese #${sub.id}`
  );
}
function calcStockStatus(current, critical, min) {
  if (current <= critical) return "critico";
  if (current <= min) return "baixo";
  return "normal";
}
function syncMaterialToSheets(mat) {
  const current = mat.currentStock ?? 0;
  const critical = mat.criticalStock ?? 0;
  const min = mat.minStock ?? 0;
  fireAndForget(
    {
      tipo: "estoque",
      item_id: String(mat.id),
      categoria: mat.category ?? "",
      marca: mat.brand ?? "",
      modelo: mat.model ?? "",
      cor: mat.color ?? "",
      descricao: mat.description ?? "",
      quantidade_atual: String(current),
      unidade: mat.unit ?? "un",
      quantidade_minima: String(min),
      quantidade_critica: String(critical),
      status_estoque: calcStockStatus(current, critical, min),
      fornecedor_preferencial: mat.preferredSupplier ?? "",
      observacoes: mat.notes ?? ""
    },
    `material #${mat.id}`
  );
}
function syncStockMovementToSheets(mov) {
  const createdAt = mov.createdAt ? new Date(mov.createdAt) : /* @__PURE__ */ new Date();
  fireAndForget(
    {
      tipo: "movimentacao_estoque",
      movimento_id: String(mov.id),
      item_id: mov.materialId ? String(mov.materialId) : "",
      agendamento_id: mov.appointmentId ? String(mov.appointmentId) : "",
      tipo_movimento: mov.movementType ?? "ajuste",
      quantidade: String(mov.quantity ?? 0),
      unidade: mov.unit ?? "un",
      motivo: mov.reason ?? "",
      responsavel: mov.responsible ?? "",
      data_movimento: createdAt.toLocaleDateString("pt-BR")
    },
    `movimenta\xE7\xE3o #${mov.id}`
  );
}

// server/routers.ts
init_db();
init_schema();
import { and as and9, eq as eq9, isNull as isNull3 } from "drizzle-orm";

// server/scheduler.ts
init_db();
init_notification();
init_const();

// server/messaging/automaticReminders.ts
init_db();
init_schema();
init_crypto();
init_service();
init_provider();
init_appointmentActions();
init_messagePresentation();
import { and as and5, eq as eq5, gte as gte2, inArray as inArray2, lte as lte3, sql as sql5 } from "drizzle-orm";
var FALLBACK_BIRTHDAY_TEMPLATE = "Ol\xE1, {nome_cliente}! Hoje \xE9 um dia especial. O time {nome_estudio} deseja um feliz anivers\xE1rio, com muita sa\xFAde e realiza\xE7\xF5es!";
function automaticReminderIdempotencyKey(kind, integrationId, sourceId, occurrence) {
  return hashIntegrationPayload(`automatic:${kind}:${integrationId}:${sourceId}:${occurrence}`);
}
function oneHourReminderWindow(date, time) {
  const addMinutes = (minutes) => {
    const [year, month, day] = date.split("-").map(Number);
    const [hour, minute] = time.split(":").map(Number);
    const local = new Date(Date.UTC(year, month - 1, day, hour, minute + minutes));
    const yyyy = String(local.getUTCFullYear());
    const mm = String(local.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(local.getUTCDate()).padStart(2, "0");
    const hh = String(local.getUTCHours()).padStart(2, "0");
    const min = String(local.getUTCMinutes()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd} ${hh}:${min}:00`;
  };
  return { startsAt: addMinutes(59), endsAt: addMinutes(61) };
}
function zonedNow(timezone) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  }).formatToParts(/* @__PURE__ */ new Date());
  const get = (type) => parts.find((part) => part.type === type)?.value ?? "00";
  return { date: `${get("year")}-${get("month")}-${get("day")}`, time: `${get("hour")}:${get("minute")}` };
}
function zonedSqlDateTime(date, timezone) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23"
  }).formatToParts(date);
  const get = (type) => parts.find((part) => part.type === type)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")}:${get("second")}`;
}
function addDays(date, days) {
  const [year, month, day] = date.split("-").map(Number);
  const result = new Date(Date.UTC(year, month - 1, day + days));
  return result.toISOString().slice(0, 10);
}
function dateAndTime(value) {
  const parsed = new Date(value);
  return {
    date: parsed.toLocaleDateString("pt-BR"),
    time: parsed.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
  };
}
async function hasActiveConsent(studioId, integrationId, clientId) {
  const db = await getDb();
  if (!db) return false;
  const consent = (await db.select({ id: integrationContacts.id }).from(integrationContacts).where(and5(
    eq5(integrationContacts.studioId, studioId),
    eq5(integrationContacts.integrationId, integrationId),
    eq5(integrationContacts.clientId, clientId),
    eq5(integrationContacts.hasWhatsappOptIn, 1),
    sql5`${integrationContacts.optedOutAt} IS NULL`
  )).limit(1))[0];
  return Boolean(consent);
}
async function alreadyQueued(integrationId, idempotencyKey) {
  const db = await getDb();
  if (!db) return false;
  const existing = (await db.select({ id: integrationJobs.id }).from(integrationJobs).where(and5(
    eq5(integrationJobs.integrationId, integrationId),
    eq5(integrationJobs.idempotencyKey, idempotencyKey)
  )).limit(1))[0];
  return Boolean(existing);
}
async function runAutomaticMessageCycle() {
  const db = await getDb();
  if (!db) return { appointmentsQueued: 0, birthdaysQueued: 0, customQueued: 0, oneHourClientQueued: 0, oneHourArtistQueued: 0, skipped: 0 };
  const active = await db.select({
    id: whatsappIntegrations.id,
    studioId: whatsappIntegrations.studioId
  }).from(whatsappIntegrations).where(and5(
    eq5(whatsappIntegrations.status, "ativo"),
    eq5(whatsappIntegrations.isEnabled, 1)
  ));
  const result = { appointmentsQueued: 0, birthdaysQueued: 0, customQueued: 0, oneHourClientQueued: 0, oneHourArtistQueued: 0, skipped: 0 };
  for (const integration of active) {
    if (!integration.studioId) continue;
    const settings = (await db.select().from(messageAutomationSettings).where(eq5(messageAutomationSettings.studioId, integration.studioId)).limit(1))[0];
    if (!settings) continue;
    const now = zonedNow(settings.timezone || "America/Sao_Paulo");
    const studio = (await db.select({ name: studios.name, address: studios.address, city: studios.city, state: studios.state, zipCode: studios.zipCode }).from(studios).where(eq5(studios.id, integration.studioId)).limit(1))[0];
    const studioName = studio?.name?.trim() || "nosso est\xFAdio";
    if (settings.appointmentRemindersEnabled && now.time >= settings.appointmentSendTime) {
      const target = addDays(now.date, Math.max(1, settings.appointmentDaysBefore));
      const due = await db.select({
        id: appointments.id,
        clientId: appointments.clientId,
        date: appointments.date,
        service: appointments.service,
        artist: appointments.artist,
        clientName: clients.name,
        clientPhone: clients.phone
      }).from(appointments).leftJoin(clients, eq5(clients.id, appointments.clientId)).where(and5(
        eq5(appointments.studioId, integration.studioId),
        gte2(appointments.date, `${target} 00:00:00`),
        lte3(appointments.date, `${target} 23:59:59`),
        inArray2(appointments.status, ["agendado", "confirmado"])
      ));
      for (const appointment of due) {
        if (!appointment.clientPhone || !await hasActiveConsent(integration.studioId, integration.id, appointment.clientId)) {
          result.skipped += 1;
          continue;
        }
        const idempotencyKey = automaticReminderIdempotencyKey("appointment", integration.id, appointment.id, target);
        if (await alreadyQueued(integration.id, idempotencyKey)) continue;
        const when = dateAndTime(appointment.date);
        const actionLinks = await issueAppointmentActionLinks({ studioId: integration.studioId, appointmentId: appointment.id });
        const dispatch = await dispatchTemplateMessage({
          studioId: integration.studioId,
          trigger: "appointment_reminder_24h",
          recipientType: "client",
          recipientPhone: appointment.clientPhone,
          recipientName: firstName(appointment.clientName),
          appointmentId: appointment.id,
          clientId: appointment.clientId,
          vars: { nome_cliente: firstName(appointment.clientName), nome_estudio: studioName, nome_artista: appointment.artist, nome_tatuador: appointment.artist, data: when.date, hora: when.time, servico: appointment.service, endereco: formatStudioAddress(studio), link_anamnese: "", link_ebook: "", link_confirmacao: actionLinks.confirmed, link_adiantamento: actionLinks.early, link_atraso: actionLinks.late, link_remarcar: actionLinks.reschedule_requested, __appointment_action_links: actionLinks },
          idempotencyKey
        });
        if (dispatch.success && dispatch.queued) result.appointmentsQueued += 1;
      }
      await db.update(messageAutomationSettings).set({ lastAppointmentCycleAt: (/* @__PURE__ */ new Date()).toISOString().slice(0, 19).replace("T", " "), lastError: null }).where(eq5(messageAutomationSettings.id, settings.id));
    }
    if (settings.oneHourRemindersEnabled) {
      const window = oneHourReminderWindow(now.date, now.time);
      const dueInOneHour = await db.select({
        id: appointments.id,
        clientId: appointments.clientId,
        date: appointments.date,
        service: appointments.service,
        artist: appointments.artist,
        artistId: appointments.artistId,
        clientName: clients.name,
        clientPhone: clients.phone,
        artistName: artists.name,
        artistPhone: artists.phone
      }).from(appointments).leftJoin(clients, eq5(clients.id, appointments.clientId)).leftJoin(artists, and5(eq5(artists.id, appointments.artistId), eq5(artists.studioId, integration.studioId), eq5(artists.active, 1))).where(and5(
        eq5(appointments.studioId, integration.studioId),
        gte2(appointments.date, window.startsAt),
        lte3(appointments.date, window.endsAt),
        inArray2(appointments.status, ["agendado", "confirmado"])
      ));
      for (const appointment of dueInOneHour) {
        if (!appointment.clientPhone || !await hasActiveConsent(integration.studioId, integration.id, appointment.clientId)) {
          result.skipped += 1;
          continue;
        }
        const when = dateAndTime(appointment.date);
        const occurrence = String(appointment.date);
        const clientKey = automaticReminderIdempotencyKey("one_hour_client", integration.id, appointment.id, occurrence);
        if (!await alreadyQueued(integration.id, clientKey)) {
          const clientDispatch = await sendAndLog({
            studioId: integration.studioId,
            integrationId: integration.id,
            recipientType: "client",
            recipientPhone: appointment.clientPhone,
            recipientName: appointment.clientName ?? void 0,
            clientId: appointment.clientId,
            appointmentId: appointment.id,
            trigger: "appointment_reminder_1h_client",
            message: `Ol\xE1, ${appointment.clientName ?? "cliente"}! \u23F0 Seu hor\xE1rio com ${appointment.artist} come\xE7a em aproximadamente 1 hora, \xE0s ${when.time}. Te esperamos!`,
            idempotencyKey: clientKey
          });
          if (clientDispatch.success && clientDispatch.queued) result.oneHourClientQueued += 1;
        }
        if (!appointment.artistPhone || !appointment.artistId) {
          result.skipped += 1;
          continue;
        }
        const artistKey = automaticReminderIdempotencyKey("one_hour_artist", integration.id, appointment.id, occurrence);
        if (await alreadyQueued(integration.id, artistKey)) continue;
        const artistDispatch = await sendAndLog({
          studioId: integration.studioId,
          integrationId: integration.id,
          recipientType: "artist",
          recipientPhone: appointment.artistPhone,
          recipientName: appointment.artistName ?? appointment.artist,
          clientId: appointment.clientId,
          appointmentId: appointment.id,
          trigger: "appointment_reminder_1h_artist",
          message: `\u23F0 Lembrete para profissional: ${appointment.clientName ?? "Cliente"} tem ${appointment.service} \xE0s ${when.time}, daqui a aproximadamente 1 hora.`,
          idempotencyKey: artistKey
        });
        if (artistDispatch.success && artistDispatch.queued) result.oneHourArtistQueued += 1;
      }
    }
    if (settings.birthdayMessagesEnabled && now.time >= settings.birthdaySendTime) {
      const allClients = await db.select({ id: clients.id, name: clients.name, phone: clients.phone, birthDate: clients.birthDate }).from(clients).where(and5(eq5(clients.studioId, integration.studioId), sql5`${clients.birthDate} IS NOT NULL`));
      const birthdays = allClients.filter((client) => String(client.birthDate).slice(5, 10) === now.date.slice(5, 10));
      for (const client of birthdays) {
        if (!client.phone || !await hasActiveConsent(integration.studioId, integration.id, client.id)) {
          result.skipped += 1;
          continue;
        }
        const message = interpolateTemplate(settings.birthdayMessageTemplate || FALLBACK_BIRTHDAY_TEMPLATE, { nome_cliente: client.name, nome_estudio: studioName });
        const dispatch = await sendAndLog({
          studioId: integration.studioId,
          integrationId: integration.id,
          recipientType: "client",
          recipientPhone: client.phone,
          recipientName: client.name ?? void 0,
          clientId: client.id,
          message,
          trigger: "birthday_reminder",
          idempotencyKey: automaticReminderIdempotencyKey("birthday", integration.id, client.id, now.date)
        });
        if (dispatch.success && dispatch.queued) result.birthdaysQueued += 1;
      }
      await db.update(messageAutomationSettings).set({ lastBirthdayCycleAt: (/* @__PURE__ */ new Date()).toISOString().slice(0, 19).replace("T", " "), lastError: null }).where(eq5(messageAutomationSettings.id, settings.id));
    }
  }
  return result;
}
async function enqueueDueIndividualReminders() {
  const db = await getDb();
  if (!db) return { queued: 0, skipped: 0 };
  const now = zonedSqlDateTime(/* @__PURE__ */ new Date(), "America/Sao_Paulo");
  const recentCutoff = zonedSqlDateTime(new Date(Date.now() - 24 * 60 * 60 * 1e3), "America/Sao_Paulo");
  const due = await db.select({
    id: appointmentReminders.id,
    appointmentId: appointmentReminders.appointmentId,
    message: appointmentReminders.message,
    clientId: appointments.clientId,
    studioId: appointments.studioId,
    clientName: clients.name,
    clientPhone: clients.phone
  }).from(appointmentReminders).leftJoin(appointments, eq5(appointments.id, appointmentReminders.appointmentId)).leftJoin(clients, eq5(clients.id, appointments.clientId)).where(and5(
    eq5(appointmentReminders.status, "pending"),
    lte3(appointmentReminders.scheduledAt, now),
    gte2(appointmentReminders.scheduledAt, recentCutoff)
  ));
  let queued = 0;
  let skipped = 0;
  for (const reminder of due) {
    if (!reminder.studioId || !reminder.clientId || !reminder.clientPhone) {
      skipped += 1;
      continue;
    }
    const integration = (await db.select({ id: whatsappIntegrations.id }).from(whatsappIntegrations).where(and5(
      eq5(whatsappIntegrations.studioId, reminder.studioId),
      eq5(whatsappIntegrations.status, "ativo"),
      eq5(whatsappIntegrations.isEnabled, 1)
    )).limit(1))[0];
    if (!integration || !await hasActiveConsent(reminder.studioId, integration.id, reminder.clientId)) {
      skipped += 1;
      continue;
    }
    const idempotencyKey = automaticReminderIdempotencyKey("individual", integration.id, reminder.id, "once");
    if (await alreadyQueued(integration.id, idempotencyKey)) continue;
    const actionLinks = await issueAppointmentActionLinks({ studioId: reminder.studioId, appointmentId: reminder.appointmentId });
    const dispatch = await sendAndLog({
      studioId: reminder.studioId,
      integrationId: integration.id,
      recipientType: "client",
      recipientPhone: reminder.clientPhone,
      recipientName: firstName(reminder.clientName),
      clientId: reminder.clientId,
      appointmentId: reminder.appointmentId,
      appointmentReminderId: reminder.id,
      message: `${useFirstNameInGreeting(reminder.message, reminder.clientName)}

${formatAppointmentActionLinks(actionLinks)}`,
      trigger: "scheduled_reminder",
      idempotencyKey
    });
    if (dispatch.success && dispatch.queued) queued += 1;
  }
  return { queued, skipped };
}

// server/scheduler.ts
var whatsAppSchedulerStatus = {
  enabled: false,
  daysBefore: 1,
  sendTime: "09:00",
  resendEnabled: false,
  resendTime: "18:00",
  lastRunPrimary: null,
  lastRunResend: null,
  nextRunPrimary: null,
  nextRunResend: null
};
async function runLegacyNotificationCycle() {
  const automatic = await runAutomaticMessageCycle();
  const individual = await enqueueDueIndividualReminders();
  console.log("[Scheduler] Ciclo autom\xE1tico BotConversa", { ...automatic, individualQueued: individual.queued, individualSkipped: individual.skipped });
  return { ...automatic, individualQueued: individual.queued, individualSkipped: individual.skipped };
}

// server/routers/contacts.ts
import { z as z2 } from "zod";
import { TRPCError as TRPCError3 } from "@trpc/server";
init_db();
var CONTACT_HEADERS = [
  "nome",
  "email",
  "telefone",
  "instagram",
  "data_nascimento",
  "genero",
  "tipo_documento",
  "numero_documento",
  "cep",
  "rua",
  "numero",
  "complemento",
  "referencia",
  "bairro",
  "cidade",
  "estado",
  "pais"
];
var COLUMN_ALIASES = {
  // nome
  nome: "nome",
  name: "nome",
  "nome completo": "nome",
  "full name": "nome",
  // email
  email: "email",
  "e-mail": "email",
  "e mail": "email",
  // telefone
  telefone: "telefone",
  phone: "telefone",
  celular: "telefone",
  whatsapp: "telefone",
  "telefone/whatsapp": "telefone",
  "celular/whatsapp": "telefone",
  // instagram
  instagram: "instagram",
  "@instagram": "instagram",
  "instagram/tiktok": "instagram",
  // data_nascimento
  data_nascimento: "data_nascimento",
  nascimento: "data_nascimento",
  "data de nascimento": "data_nascimento",
  birthday: "data_nascimento",
  birthdate: "data_nascimento",
  "data nasc": "data_nascimento",
  // genero
  genero: "genero",
  "g\xEAnero": "genero",
  gender: "genero",
  sexo: "genero",
  // tipo_documento
  tipo_documento: "tipo_documento",
  "tipo documento": "tipo_documento",
  "tipo de documento": "tipo_documento",
  doctype: "tipo_documento",
  // numero_documento
  numero_documento: "numero_documento",
  cpf: "numero_documento",
  passaporte: "numero_documento",
  passport: "numero_documento",
  "n\xFAmero documento": "numero_documento",
  "numero documento": "numero_documento",
  // endereço
  cep: "cep",
  "c\xF3digo postal": "cep",
  "codigo postal": "cep",
  rua: "rua",
  logradouro: "rua",
  street: "rua",
  endere\u00E7o: "rua",
  endereco: "rua",
  numero: "numero",
  "n\xFAmero": "numero",
  "n\xBA": "numero",
  complemento: "complemento",
  complement: "complemento",
  referencia: "referencia",
  "refer\xEAncia": "referencia",
  reference: "referencia",
  bairro: "bairro",
  neighborhood: "bairro",
  cidade: "cidade",
  city: "cidade",
  estado: "estado",
  state: "estado",
  uf: "estado",
  pais: "pais",
  "pa\xEDs": "pais",
  country: "pais"
};
function normalizeHeader(h) {
  const clean = h.toLowerCase().trim().replace(/[_\-\s]+/g, " ");
  return COLUMN_ALIASES[clean] ?? COLUMN_ALIASES[h.toLowerCase().trim()] ?? "";
}
function normalizeGender(v) {
  const l = v.toLowerCase().trim();
  if (["homem", "masculino", "m", "male", "man"].includes(l)) return "Homem";
  if (["mulher", "feminino", "f", "female", "woman"].includes(l)) return "Mulher";
  if (["outros", "outro", "other", "nb", "n\xE3o-bin\xE1rio", "nao-binario"].includes(l)) return "Outros";
  return void 0;
}
function normalizeDocType(v) {
  const l = v.toLowerCase().trim();
  if (["passport", "passaporte"].includes(l)) return "passport";
  return "cpf";
}
function normalizeBirthDate(v) {
  if (!v) return null;
  const clean = v.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(clean)) return clean.slice(0, 10);
  const ddmmyyyy = clean.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (ddmmyyyy) return `${ddmmyyyy[3]}-${ddmmyyyy[2]}-${ddmmyyyy[1]}`;
  const ddmmyyyy2 = clean.match(/^(\d{2})-(\d{2})-(\d{4})/);
  if (ddmmyyyy2) return `${ddmmyyyy2[3]}-${ddmmyyyy2[2]}-${ddmmyyyy2[1]}`;
  return null;
}
function toCSV(rows, headers) {
  const escape = (v) => `"${(v ?? "").replace(/"/g, '""')}"`;
  const headerRow = headers.map(escape).join(",");
  const dataRows = rows.map((row) => headers.map((h) => escape(row[h] ?? "")).join(","));
  return [headerRow, ...dataRows].join("\r\n");
}
async function toXLSX(rows, headers) {
  const XLSX = await import("xlsx");
  const ws = XLSX.utils.json_to_sheet(rows, { header: headers });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Contatos");
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  return Buffer.from(buf).toString("base64");
}
function parseCSV(content) {
  const lines = content.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  if (lines.length < 2) return [];
  const rawHeaders = lines[0].split(",").map(
    (h) => h.trim().replace(/^"|"$/g, "").replace(/""/g, '"')
  );
  const normalizedHeaders = rawHeaders.map(normalizeHeader);
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const values = line.split(",").map((v) => v.trim().replace(/^"|"$/g, "").replace(/""/g, '"'));
    const row = {};
    normalizedHeaders.forEach((h, idx) => {
      if (h) row[h] = values[idx] ?? "";
    });
    rows.push(row);
  }
  return rows;
}
async function parseXLSX(base64) {
  const XLSX = await import("xlsx");
  const buf = Buffer.from(base64, "base64");
  const wb = XLSX.read(buf, { type: "buffer" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const raw = XLSX.utils.sheet_to_json(ws, { defval: "" });
  return raw.map((row) => {
    const normalized = {};
    for (const [k, v] of Object.entries(row)) {
      const canon = normalizeHeader(k);
      if (canon) normalized[canon] = String(v ?? "");
    }
    return normalized;
  });
}
var contactsRouter = router({
  /** Exportar todos os contatos como CSV (retorna string) */
  exportCSV: protectedProcedure.query(async ({ ctx }) => {
    const allClients = await listClients(ctx.user.studioId ?? null);
    const rows = allClients.map((c) => ({
      nome: c.name ?? "",
      email: c.email ?? "",
      telefone: c.phone ?? "",
      instagram: c.instagram ?? "",
      data_nascimento: c.birthDate ? c.birthDate.slice(0, 10) : "",
      genero: c.gender ?? "",
      tipo_documento: c.docType ?? "cpf",
      numero_documento: c.docNumber ?? "",
      cep: c.cep ?? "",
      rua: c.street ?? "",
      numero: c.number ?? "",
      complemento: c.complement ?? "",
      referencia: c.reference ?? "",
      bairro: c.neighborhood ?? "",
      cidade: c.city ?? "",
      estado: c.state ?? "",
      pais: c.country ?? "Brasil"
    }));
    return { csv: toCSV(rows, CONTACT_HEADERS), count: rows.length };
  }),
  /** Exportar todos os contatos como Excel (retorna base64) */
  exportXLSX: protectedProcedure.query(async ({ ctx }) => {
    const allClients = await listClients(ctx.user.studioId ?? null);
    const rows = allClients.map((c) => ({
      nome: c.name ?? "",
      email: c.email ?? "",
      telefone: c.phone ?? "",
      instagram: c.instagram ?? "",
      data_nascimento: c.birthDate ? c.birthDate.slice(0, 10) : "",
      genero: c.gender ?? "",
      tipo_documento: c.docType ?? "cpf",
      numero_documento: c.docNumber ?? "",
      cep: c.cep ?? "",
      rua: c.street ?? "",
      numero: c.number ?? "",
      complemento: c.complement ?? "",
      referencia: c.reference ?? "",
      bairro: c.neighborhood ?? "",
      cidade: c.city ?? "",
      estado: c.state ?? "",
      pais: c.country ?? "Brasil"
    }));
    const xlsx = await toXLSX(rows, CONTACT_HEADERS);
    return { xlsx, count: rows.length };
  }),
  /** Baixar template CSV vazio */
  downloadTemplate: protectedProcedure.input(z2.object({ format: z2.enum(["csv", "xlsx"]) })).query(async ({ input }) => {
    const example = [{
      nome: "Jo\xE3o Silva",
      email: "joao@email.com",
      telefone: "11999990000",
      instagram: "@joaosilva",
      data_nascimento: "1990-05-15",
      genero: "Homem",
      tipo_documento: "cpf",
      numero_documento: "000.000.000-00",
      cep: "01310-100",
      rua: "Av. Paulista",
      numero: "1000",
      complemento: "Apto 10",
      referencia: "Pr\xF3ximo ao metr\xF4",
      bairro: "Bela Vista",
      cidade: "S\xE3o Paulo",
      estado: "SP",
      pais: "Brasil"
    }];
    if (input.format === "xlsx") {
      const xlsx = await toXLSX(example, CONTACT_HEADERS);
      return { format: "xlsx", data: xlsx };
    }
    return { format: "csv", data: toCSV(example, CONTACT_HEADERS) };
  }),
  /** Preview de importação: parseia o arquivo e retorna os dados sem salvar */
  previewImport: protectedProcedure.input(z2.object({
    format: z2.enum(["csv", "xlsx"]),
    content: z2.string()
    // CSV string ou base64 XLSX
  })).mutation(async ({ input }) => {
    let rows;
    if (input.format === "xlsx") {
      rows = await parseXLSX(input.content);
    } else {
      rows = parseCSV(input.content);
    }
    const detectedColumns = rows.length > 0 ? Object.keys(rows[0]) : [];
    const preview = rows.slice(0, 5).map((row, i) => ({
      row: i + 1,
      nome: row.nome || "",
      email: row.email || "",
      telefone: row.telefone || "",
      instagram: row.instagram || "",
      valid: !!row.nome,
      issues: !row.nome ? ["Nome obrigat\xF3rio"] : []
    }));
    const validCount = rows.filter((r) => !!r.nome).length;
    const invalidCount = rows.length - validCount;
    return {
      totalRows: rows.length,
      validCount,
      invalidCount,
      detectedColumns,
      preview
    };
  }),
  /** Importar contatos: parseia e salva no banco */
  importContacts: protectedProcedure.input(z2.object({
    format: z2.enum(["csv", "xlsx"]),
    content: z2.string(),
    skipDuplicates: z2.boolean().default(true)
  })).mutation(async ({ ctx, input }) => {
    let rows;
    if (input.format === "xlsx") {
      rows = await parseXLSX(input.content);
    } else {
      rows = parseCSV(input.content);
    }
    let studioId = ctx.user.studioId;
    if (!studioId) {
      if (ctx.user.role === "superadmin") {
        const firstStudio = await getFirstStudio();
        if (!firstStudio) throw new TRPCError3({ code: "PRECONDITION_FAILED", message: "Nenhum est\xFAdio cadastrado." });
        studioId = firstStudio.id;
      } else {
        throw new TRPCError3({ code: "FORBIDDEN", message: "Usu\xE1rio n\xE3o vinculado a um est\xFAdio." });
      }
    }
    const existingClients = input.skipDuplicates ? await listClients(studioId) : [];
    const existingPhones = new Set(existingClients.map((c) => c.phone?.replace(/\D/g, "") ?? "").filter(Boolean));
    const existingEmails = new Set(existingClients.map((c) => c.email?.toLowerCase() ?? "").filter(Boolean));
    const results = { imported: 0, skipped: 0, errors: 0, errorDetails: [] };
    for (const row of rows) {
      if (!row.nome?.trim()) {
        results.errors++;
        continue;
      }
      if (input.skipDuplicates) {
        const phone = row.telefone?.replace(/\D/g, "") ?? "";
        const email = row.email?.toLowerCase().trim() ?? "";
        if (phone && existingPhones.has(phone) || email && existingEmails.has(email)) {
          results.skipped++;
          continue;
        }
      }
      try {
        const birthDate = normalizeBirthDate(row.data_nascimento ?? "");
        await createClient({
          studioId,
          artistId: ctx.user.artistId ?? null,
          name: row.nome.trim(),
          email: row.email?.trim() || null,
          phone: row.telefone?.trim() || null,
          instagram: row.instagram?.trim() || null,
          birthDate: birthDate ?? null,
          gender: normalizeGender(row.genero ?? ""),
          docType: normalizeDocType(row.tipo_documento ?? "cpf"),
          docNumber: row.numero_documento?.trim() || null,
          cep: row.cep?.trim() || null,
          street: row.rua?.trim() || null,
          number: row.numero?.trim() || null,
          complement: row.complemento?.trim() || null,
          reference: row.referencia?.trim() || null,
          neighborhood: row.bairro?.trim() || null,
          city: row.cidade?.trim() || null,
          state: row.estado?.trim() || null,
          country: row.pais?.trim() || "Brasil"
        });
        results.imported++;
        if (input.skipDuplicates) {
          const phone = row.telefone?.replace(/\D/g, "") ?? "";
          const email = row.email?.toLowerCase().trim() ?? "";
          if (phone) existingPhones.add(phone);
          if (email) existingEmails.add(email);
        }
      } catch (e) {
        results.errors++;
        results.errorDetails.push(`Linha "${row.nome}": ${e.message}`);
      }
    }
    return results;
  }),
  /** Limpar contatos de teste (sem telefone E sem email E sem agendamentos) */
  clearTestContacts: protectedProcedure.input(z2.object({ confirm: z2.literal(true) })).mutation(async ({ ctx }) => {
    if (ctx.user.role !== "admin" && ctx.user.role !== "superadmin") {
      throw new TRPCError3({ code: "FORBIDDEN", message: "Apenas administradores podem limpar dados de teste." });
    }
    const studioId = ctx.user.studioId;
    const allClients = await listClients(studioId ?? null);
    let deleted = 0;
    for (const c of allClients) {
      const hasContact = c.phone || c.email;
      if (!hasContact && c.appointmentCount === 0) {
        await deleteClient(c.id);
        deleted++;
      }
    }
    return { deleted };
  })
});

// server/routers/procedures.ts
import { z as z3 } from "zod";
import { TRPCError as TRPCError4 } from "@trpc/server";
init_db();
init_schema();
init_storage();
import { eq as eq6, and as and6, desc as desc4, isNotNull, gte as gte3, lte as lte4 } from "drizzle-orm";
async function requireDb() {
  const db = await getDb();
  if (!db) throw new TRPCError4({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indispon\xEDvel." });
  return db;
}
function randomSuffix() {
  return Math.random().toString(36).substring(2, 10);
}
function assertProcedureOwner(procedure, studioId, procedureId) {
  if (!procedure) {
    throw new TRPCError4({ code: "NOT_FOUND", message: "Procedimento n\xE3o encontrado." });
  }
  if (procedure.studioId !== studioId) {
    throw new TRPCError4({ code: "FORBIDDEN", message: "Acesso negado a este procedimento." });
  }
}
async function assertProcedureLinks(db, input) {
  const [client] = await db.select({ id: clients.id }).from(clients).where(and6(
    eq6(clients.id, input.clientId),
    eq6(clients.studioId, input.studioId)
  )).limit(1);
  if (!client) throw new TRPCError4({ code: "NOT_FOUND", message: "Cliente n\xE3o encontrado nesta empresa." });
  if (input.appointmentId) {
    const [appointment] = await db.select({ clientId: appointments.clientId, artistId: appointments.artistId }).from(appointments).where(and6(
      eq6(appointments.id, input.appointmentId),
      eq6(appointments.studioId, input.studioId)
    )).limit(1);
    if (!appointment) throw new TRPCError4({ code: "NOT_FOUND", message: "Agendamento n\xE3o encontrado nesta empresa." });
    if (appointment.clientId !== input.clientId) throw new TRPCError4({ code: "BAD_REQUEST", message: "O agendamento selecionado pertence a outro cliente." });
    if (input.artistId && appointment.artistId && input.artistId !== appointment.artistId) {
      throw new TRPCError4({ code: "BAD_REQUEST", message: "O artista informado n\xE3o corresponde ao agendamento." });
    }
  }
  if (input.artistId) {
    const [artist] = await db.select({ id: artists.id }).from(artists).where(and6(
      eq6(artists.id, input.artistId),
      eq6(artists.studioId, input.studioId)
    )).limit(1);
    if (!artist) throw new TRPCError4({ code: "NOT_FOUND", message: "Artista n\xE3o encontrado nesta empresa." });
  }
}
var proceduresRouter = router({
  // ── Listar procedimentos de um cliente ──────────────────────────────────
  listByClient: tenantProcedure.input(z3.object({ clientId: z3.number().int().positive() })).query(async ({ ctx, input }) => {
    const studioId = ctx.studioId;
    const db = await requireDb();
    const rows = await db.select().from(technicalProcedures).where(
      and6(
        eq6(technicalProcedures.clientId, input.clientId),
        eq6(technicalProcedures.studioId, studioId)
      )
    ).orderBy(desc4(technicalProcedures.createdAt));
    return rows;
  }),
  // ── Buscar procedimento por ID ───────────────────────────────────────────
  getById: tenantProcedure.input(z3.object({ id: z3.number().int().positive() })).query(async ({ ctx, input }) => {
    const studioId = ctx.studioId;
    const db = await requireDb();
    const [procedure] = await db.select().from(technicalProcedures).where(eq6(technicalProcedures.id, input.id)).limit(1);
    assertProcedureOwner(procedure, studioId, input.id);
    const consumables = await db.select().from(procedureConsumables).where(eq6(procedureConsumables.procedureId, input.id)).orderBy(procedureConsumables.category, procedureConsumables.name);
    const images = await db.select().from(procedureImages).where(eq6(procedureImages.procedureId, input.id)).orderBy(procedureImages.createdAt);
    return { procedure, consumables, images };
  }),
  // ── Criar novo procedimento ──────────────────────────────────────────────
  create: tenantProcedure.input(z3.object({
    clientId: z3.number().int().positive(),
    appointmentId: z3.number().int().positive().optional().nullable(),
    artistId: z3.number().int().positive().optional().nullable(),
    artistName: z3.string().max(255).optional(),
    title: z3.string().min(1).max(255),
    description: z3.string().optional(),
    bodyLocation: z3.string().max(100).optional(),
    tattooStyle: z3.string().max(100).optional(),
    chargedAmount: z3.number().int().min(0).optional(),
    // centavos
    notes: z3.string().optional(),
    // Imagem de referência em base64 (opcional na criação)
    referenceImageBase64: z3.string().optional(),
    referenceImageMime: z3.string().optional()
  })).mutation(async ({ ctx, input }) => {
    const studioId = ctx.studioId;
    const db = await requireDb();
    await assertProcedureLinks(db, { studioId, clientId: input.clientId, appointmentId: input.appointmentId, artistId: input.artistId });
    let referenceImageUrl;
    let referenceImageKey;
    if (input.referenceImageBase64 && input.referenceImageMime) {
      const buffer = Buffer.from(input.referenceImageBase64, "base64");
      const ext = input.referenceImageMime.split("/")[1] || "jpg";
      const key = `procedures/${studioId}/ref-${randomSuffix()}.${ext}`;
      const { url } = await storagePut(key, buffer, input.referenceImageMime);
      referenceImageUrl = url;
      referenceImageKey = key;
    }
    const [result] = await db.insert(technicalProcedures).values({
      studioId,
      clientId: input.clientId,
      appointmentId: input.appointmentId ?? null,
      artistId: input.artistId ?? null,
      artistName: input.artistName ?? null,
      title: input.title,
      description: input.description ?? null,
      bodyLocation: input.bodyLocation ?? null,
      tattooStyle: input.tattooStyle ?? null,
      chargedAmount: input.chargedAmount ?? 0,
      notes: input.notes ?? null,
      referenceImageUrl: referenceImageUrl ?? null,
      referenceImageKey: referenceImageKey ?? null,
      status: "em_andamento"
    });
    const insertId = result.insertId;
    await db.insert(procedureEvents).values({
      procedureId: insertId,
      eventType: "created",
      payload: JSON.stringify({ createdBy: ctx.user.id, artistName: input.artistName })
    });
    const [created] = await db.select().from(technicalProcedures).where(eq6(technicalProcedures.id, insertId)).limit(1);
    return created;
  }),
  // ── Atualizar dados gerais do procedimento ───────────────────────────────
  update: tenantProcedure.input(z3.object({
    id: z3.number().int().positive(),
    appointmentId: z3.number().int().positive().optional().nullable(),
    title: z3.string().min(1).max(255).optional(),
    description: z3.string().optional(),
    bodyLocation: z3.string().max(100).optional(),
    tattooStyle: z3.string().max(100).optional(),
    chargedAmount: z3.number().int().min(0).optional(),
    notes: z3.string().optional(),
    artistId: z3.number().int().positive().optional().nullable(),
    artistName: z3.string().max(255).optional().nullable(),
    status: z3.enum(["em_andamento", "pausado", "finalizado", "retorno", "retoque"]).optional()
  })).mutation(async ({ ctx, input }) => {
    const studioId = ctx.studioId;
    const db = await requireDb();
    const [existing] = await db.select({
      studioId: technicalProcedures.studioId,
      clientId: technicalProcedures.clientId,
      appointmentId: technicalProcedures.appointmentId,
      artistId: technicalProcedures.artistId
    }).from(technicalProcedures).where(eq6(technicalProcedures.id, input.id)).limit(1);
    assertProcedureOwner(existing, studioId, input.id);
    await assertProcedureLinks(db, {
      studioId,
      clientId: existing.clientId,
      appointmentId: input.appointmentId !== void 0 ? input.appointmentId : existing.appointmentId,
      artistId: input.artistId !== void 0 ? input.artistId : existing.artistId
    });
    const { id, ...fields } = input;
    await db.update(technicalProcedures).set(fields).where(eq6(technicalProcedures.id, id));
    const [updated] = await db.select().from(technicalProcedures).where(eq6(technicalProcedures.id, id)).limit(1);
    return updated;
  }),
  // ── Controle de timer (iniciar / pausar / retomar / finalizar) ───────────
  timerAction: tenantProcedure.input(z3.object({
    id: z3.number().int().positive(),
    action: z3.enum(["start", "pause", "resume", "finish"])
  })).mutation(async ({ ctx, input }) => {
    const studioId = ctx.studioId;
    const db = await requireDb();
    const [existing] = await db.select().from(technicalProcedures).where(eq6(technicalProcedures.id, input.id)).limit(1);
    assertProcedureOwner(existing, studioId, input.id);
    const now = (/* @__PURE__ */ new Date()).toISOString().slice(0, 19).replace("T", " ");
    const updates = {};
    if (input.action === "start") {
      updates.startedAt = now;
      updates.status = "em_andamento";
    } else if (input.action === "pause") {
      updates.pausedAt = now;
      updates.status = "pausado";
    } else if (input.action === "resume") {
      updates.pausedAt = null;
      updates.status = "em_andamento";
    } else if (input.action === "finish") {
      updates.finishedAt = now;
      updates.status = "finalizado";
      if (existing.startedAt) {
        const start = new Date(existing.startedAt).getTime();
        const end = new Date(now).getTime();
        updates.totalDurationMinutes = Math.round((end - start) / 6e4);
      }
    }
    await db.update(technicalProcedures).set(updates).where(eq6(technicalProcedures.id, input.id));
    await db.insert(procedureEvents).values({
      procedureId: input.id,
      eventType: input.action,
      payload: JSON.stringify({ at: now })
    });
    const [updated] = await db.select().from(technicalProcedures).where(eq6(technicalProcedures.id, input.id)).limit(1);
    return updated;
  }),
  // ── Adicionar insumo ─────────────────────────────────────────────────────
  addConsumable: tenantProcedure.input(z3.object({
    procedureId: z3.number().int().positive(),
    category: z3.enum(["ink", "cartridge", "disposable", "liquid", "protection", "stencil", "aftercare", "other"]),
    name: z3.string().min(1).max(255),
    unit: z3.enum(["drop", "ml", "unit", "pair", "gram", "portion", "roll_fraction"]).default("unit"),
    quantity: z3.number().min(0),
    estimatedUnitCost: z3.number().min(0).optional(),
    // em reais
    notes: z3.string().optional(),
    inventoryItemId: z3.number().int().positive().optional()
  })).mutation(async ({ ctx, input }) => {
    const studioId = ctx.studioId;
    const db = await requireDb();
    const [proc] = await db.select({ studioId: technicalProcedures.studioId }).from(technicalProcedures).where(eq6(technicalProcedures.id, input.procedureId)).limit(1);
    assertProcedureOwner(proc, studioId, input.procedureId);
    const unitCost = input.estimatedUnitCost ?? 0;
    const totalCost = unitCost * input.quantity;
    const [result] = await db.insert(procedureConsumables).values({
      procedureId: input.procedureId,
      inventoryItemId: input.inventoryItemId ?? null,
      category: input.category,
      name: input.name,
      unit: input.unit,
      quantity: String(input.quantity),
      estimatedUnitCost: String(unitCost),
      estimatedTotalCost: String(totalCost),
      notes: input.notes ?? null
    });
    const insertId = result.insertId;
    await db.insert(procedureEvents).values({
      procedureId: input.procedureId,
      eventType: "consumable_added",
      payload: JSON.stringify({ name: input.name, quantity: input.quantity, unit: input.unit })
    });
    const [created] = await db.select().from(procedureConsumables).where(eq6(procedureConsumables.id, insertId)).limit(1);
    return created;
  }),
  // ── Atualizar quantidade de insumo ───────────────────────────────────────
  updateConsumable: tenantProcedure.input(z3.object({
    id: z3.number().int().positive(),
    procedureId: z3.number().int().positive(),
    quantity: z3.number().min(0),
    estimatedUnitCost: z3.number().min(0).optional(),
    notes: z3.string().optional()
  })).mutation(async ({ ctx, input }) => {
    const studioId = ctx.studioId;
    const db = await requireDb();
    const [proc] = await db.select({ studioId: technicalProcedures.studioId }).from(technicalProcedures).where(eq6(technicalProcedures.id, input.procedureId)).limit(1);
    assertProcedureOwner(proc, studioId, input.procedureId);
    const [existing] = await db.select().from(procedureConsumables).where(and6(
      eq6(procedureConsumables.id, input.id),
      eq6(procedureConsumables.procedureId, input.procedureId)
    )).limit(1);
    if (!existing) throw new TRPCError4({ code: "NOT_FOUND", message: "Insumo n\xE3o encontrado." });
    const unitCost = input.estimatedUnitCost ?? Number(existing.estimatedUnitCost ?? 0);
    const totalCost = unitCost * input.quantity;
    await db.update(procedureConsumables).set({
      quantity: String(input.quantity),
      estimatedUnitCost: String(unitCost),
      estimatedTotalCost: String(totalCost),
      notes: input.notes ?? existing.notes
    }).where(and6(
      eq6(procedureConsumables.id, input.id),
      eq6(procedureConsumables.procedureId, input.procedureId)
    ));
    const [updated] = await db.select().from(procedureConsumables).where(eq6(procedureConsumables.id, input.id)).limit(1);
    return updated;
  }),
  // ── Remover insumo ───────────────────────────────────────────────────────
  removeConsumable: tenantProcedure.input(z3.object({
    id: z3.number().int().positive(),
    procedureId: z3.number().int().positive()
  })).mutation(async ({ ctx, input }) => {
    const studioId = ctx.studioId;
    const db = await requireDb();
    const [proc] = await db.select({ studioId: technicalProcedures.studioId }).from(technicalProcedures).where(eq6(technicalProcedures.id, input.procedureId)).limit(1);
    assertProcedureOwner(proc, studioId, input.procedureId);
    await db.delete(procedureConsumables).where(and6(
      eq6(procedureConsumables.id, input.id),
      eq6(procedureConsumables.procedureId, input.procedureId)
    ));
    return { success: true };
  }),
  // ── Upload de imagem do procedimento ────────────────────────────────────
  uploadImage: tenantProcedure.input(z3.object({
    procedureId: z3.number().int().positive(),
    imageBase64: z3.string(),
    mimeType: z3.string(),
    imageType: z3.enum(["reference", "stencil", "progress", "final", "healed", "other"]).default("other"),
    description: z3.string().optional()
  })).mutation(async ({ ctx, input }) => {
    const studioId = ctx.studioId;
    const db = await requireDb();
    const [proc] = await db.select({ studioId: technicalProcedures.studioId }).from(technicalProcedures).where(eq6(technicalProcedures.id, input.procedureId)).limit(1);
    assertProcedureOwner(proc, studioId, input.procedureId);
    const buffer = Buffer.from(input.imageBase64, "base64");
    const ext = input.mimeType.split("/")[1] || "jpg";
    const key = `procedures/${studioId}/${input.procedureId}/${input.imageType}-${randomSuffix()}.${ext}`;
    const { url } = await storagePut(key, buffer, input.mimeType);
    const [result] = await db.insert(procedureImages).values({
      procedureId: input.procedureId,
      imageUrl: url,
      imageKey: key,
      imageType: input.imageType,
      description: input.description ?? null
    });
    const insertId = result.insertId;
    if (input.imageType === "reference") {
      await db.update(technicalProcedures).set({ referenceImageUrl: url, referenceImageKey: key }).where(eq6(technicalProcedures.id, input.procedureId));
    } else if (input.imageType === "final") {
      await db.update(technicalProcedures).set({ finalImageUrl: url, finalImageKey: key }).where(eq6(technicalProcedures.id, input.procedureId));
    } else if (input.imageType === "healed") {
      await db.update(technicalProcedures).set({ healedImageUrl: url, healedImageKey: key }).where(eq6(technicalProcedures.id, input.procedureId));
    } else if (input.imageType === "stencil") {
      await db.update(technicalProcedures).set({ stencilImageUrl: url, stencilImageKey: key }).where(eq6(technicalProcedures.id, input.procedureId));
    }
    const [created] = await db.select().from(procedureImages).where(eq6(procedureImages.id, insertId)).limit(1);
    return created;
  }),
  // ── Deletar procedimento ─────────────────────────────────────────────────
  delete: tenantProcedure.input(z3.object({ id: z3.number().int().positive() })).mutation(async ({ ctx, input }) => {
    const studioId = ctx.studioId;
    const db = await requireDb();
    const [existing] = await db.select({ studioId: technicalProcedures.studioId }).from(technicalProcedures).where(eq6(technicalProcedures.id, input.id)).limit(1);
    assertProcedureOwner(existing, studioId, input.id);
    await db.delete(procedureConsumables).where(eq6(procedureConsumables.procedureId, input.id));
    await db.delete(procedureImages).where(eq6(procedureImages.procedureId, input.id));
    await db.delete(procedureEvents).where(eq6(procedureEvents.procedureId, input.id));
    await db.delete(technicalProcedures).where(eq6(technicalProcedures.id, input.id));
    return { success: true };
  }),
  // ── Buscar procedimento por appointmentId ───────────────────────────────────────
  getByAppointment: tenantProcedure.input(z3.object({ appointmentId: z3.number().int().positive() })).query(async ({ ctx, input }) => {
    const studioId = ctx.studioId;
    const db = await requireDb();
    const rows = await db.select().from(technicalProcedures).where(
      and6(
        eq6(technicalProcedures.appointmentId, input.appointmentId),
        eq6(technicalProcedures.studioId, studioId)
      )
    ).orderBy(desc4(technicalProcedures.createdAt));
    return rows;
  }),
  // Resumo financeiro do procedimento
  getSummary: tenantProcedure.input(z3.object({ id: z3.number().int().positive() })).query(async ({ ctx, input }) => {
    const studioId = ctx.studioId;
    const db = await requireDb();
    const [procedure] = await db.select().from(technicalProcedures).where(eq6(technicalProcedures.id, input.id)).limit(1);
    assertProcedureOwner(procedure, studioId, input.id);
    const consumables = await db.select().from(procedureConsumables).where(eq6(procedureConsumables.procedureId, input.id));
    const byCategory = {};
    let totalMaterialCost = 0;
    for (const c of consumables) {
      const cat = c.category;
      if (!byCategory[cat]) byCategory[cat] = { totalCost: 0, items: [] };
      const cost = Number(c.estimatedTotalCost ?? 0);
      byCategory[cat].totalCost += cost;
      byCategory[cat].items.push(c);
      totalMaterialCost += cost;
    }
    const chargedAmount = (procedure.chargedAmount ?? 0) / 100;
    const grossMargin = chargedAmount - totalMaterialCost;
    return {
      procedure,
      consumables,
      byCategory,
      totalMaterialCost,
      chargedAmount,
      grossMargin,
      isEstimated: consumables.some((c) => c.unit === "drop" || c.unit === "portion" || c.unit === "roll_fraction")
    };
  }),
  // ── Finalizar sessão POD: fechar procedimento + concluir agendamento + registrar transação ──────────────────
  finalize: tenantProcedure.input(z3.object({
    procedureId: z3.number(),
    chargedAmount: z3.number().min(0),
    paymentMethod: z3.enum(["dinheiro", "pix", "credito", "debito", "transferencia"]),
    notes: z3.string().optional()
  })).mutation(async ({ ctx, input }) => {
    const studioId = ctx.studioId;
    const db = await requireDb();
    const [proc] = await db.select().from(technicalProcedures).where(and6(eq6(technicalProcedures.id, input.procedureId), eq6(technicalProcedures.studioId, studioId))).limit(1);
    if (!proc) throw new TRPCError4({ code: "NOT_FOUND", message: "Procedimento n\xE3o encontrado." });
    if (proc.status === "finalizado") throw new TRPCError4({ code: "BAD_REQUEST", message: "Procedimento j\xE1 finalizado." });
    const now = (/* @__PURE__ */ new Date()).toISOString().slice(0, 19).replace("T", " ");
    await db.update(technicalProcedures).set({
      status: "finalizado",
      finishedAt: now,
      chargedAmount: input.chargedAmount,
      notes: input.notes ?? proc.notes,
      updatedAt: now
    }).where(eq6(technicalProcedures.id, input.procedureId));
    if (proc.appointmentId) {
      await db.update(appointments).set({ status: "concluido", updatedAt: now }).where(and6(eq6(appointments.id, proc.appointmentId), eq6(appointments.studioId, studioId)));
    }
    const amountCents = Math.round(input.chargedAmount * 100);
    if (amountCents > 0) {
      await db.insert(transactions).values({
        studioId,
        clientId: proc.clientId ?? null,
        appointmentId: proc.appointmentId ?? null,
        type: "entrada",
        category: "servico",
        description: `Sess\xE3o POD: ${proc.title}`,
        amount: amountCents,
        paymentMethod: input.paymentMethod,
        date: now
      });
    }
    try {
      const duracaoMin = proc.startedAt && proc.finishedAt ? Math.round((new Date(proc.finishedAt.replace(" ", "T")).getTime() - new Date(proc.startedAt.replace(" ", "T")).getTime()) / 6e4) : null;
      const valorFmt = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(input.chargedAmount);
      const duracaoFmt = duracaoMin != null ? `${duracaoMin} min` : "n/d";
      const { notifyOwner: notifyOwner2 } = await Promise.resolve().then(() => (init_notification(), notification_exports));
      await notifyOwner2({
        title: `\u2705 Sess\xE3o POD Finalizada: ${proc.title}`,
        content: [
          `**Procedimento:** ${proc.title}`,
          `**Artista:** ${proc.artistName || "N/A"}`,
          `**Dura\xE7\xE3o:** ${duracaoFmt}`,
          `**Valor cobrado:** ${valorFmt}`,
          `**M\xE9todo:** ${input.paymentMethod}`,
          proc.appointmentId ? `**Agendamento #${proc.appointmentId}:** marcado como conclu\xEDdo` : "",
          amountCents > 0 ? `**Transa\xE7\xE3o registrada:** ${valorFmt}` : "",
          input.notes ? `**Obs:** ${input.notes}` : ""
        ].filter(Boolean).join("\n")
      });
    } catch (_e) {
    }
    return {
      success: true,
      appointmentUpdated: !!proc.appointmentId,
      transactionCreated: amountCents > 0
    };
  }),
  // ── Listar todos os appointmentIds que têm sessão POD vinculada ────────────────────────────────────────────────
  // ── Relatório de insumos por artista/período ─────────────────────────────────────────────────────────────────
  consumableReport: tenantProcedure.input(z3.object({
    startDate: z3.string().optional(),
    // 'YYYY-MM-DD'
    endDate: z3.string().optional()
  })).query(async ({ ctx, input }) => {
    const studioId = ctx.studioId;
    const db = await requireDb();
    const procWhere = [eq6(technicalProcedures.studioId, studioId)];
    if (input.startDate) procWhere.push(gte3(technicalProcedures.createdAt, `${input.startDate} 00:00:00`));
    if (input.endDate) procWhere.push(lte4(technicalProcedures.createdAt, `${input.endDate} 23:59:59`));
    const procs = await db.select({
      id: technicalProcedures.id,
      artistName: technicalProcedures.artistName,
      title: technicalProcedures.title,
      chargedAmount: technicalProcedures.chargedAmount,
      createdAt: technicalProcedures.createdAt
    }).from(technicalProcedures).where(and6(...procWhere)).orderBy(desc4(technicalProcedures.createdAt));
    if (procs.length === 0) return { byArtist: [], totalCost: 0, totalSessions: 0 };
    const procIds = procs.map((p) => p.id);
    const consumablesAll = await db.select().from(procedureConsumables);
    const filteredConsumables = consumablesAll.filter((c) => procIds.includes(c.procedureId));
    const artistMap = {};
    for (const proc of procs) {
      const artist = proc.artistName || "Sem artista";
      if (!artistMap[artist]) {
        artistMap[artist] = { artistName: artist, sessions: 0, totalCost: 0, totalRevenue: 0, consumablesByCategory: {} };
      }
      artistMap[artist].sessions++;
      artistMap[artist].totalRevenue += (proc.chargedAmount ?? 0) / 100;
      const procConsumables = filteredConsumables.filter((c) => c.procedureId === proc.id);
      for (const c of procConsumables) {
        const unitCost = parseFloat(c.estimatedUnitCost ?? "0");
        const qty = parseFloat(c.quantity ?? "0");
        const cost = unitCost * qty;
        artistMap[artist].totalCost += cost;
        const cat = c.category || "outros";
        if (!artistMap[artist].consumablesByCategory[cat]) {
          artistMap[artist].consumablesByCategory[cat] = { qty: 0, cost: 0 };
        }
        artistMap[artist].consumablesByCategory[cat].qty += qty;
        artistMap[artist].consumablesByCategory[cat].cost += cost;
      }
    }
    const byArtist = Object.values(artistMap).sort((a, b) => b.totalCost - a.totalCost);
    const totalCost = byArtist.reduce((s, a) => s + a.totalCost, 0);
    const totalSessions = byArtist.reduce((s, a) => s + a.sessions, 0);
    return { byArtist, totalCost, totalSessions };
  }),
  // ── Resumo mensal de insumos para o widget do Dashboard ─────────────────────────────────────────────────────
  consumableSummary: tenantProcedure.query(async ({ ctx }) => {
    const studioId = ctx.studioId;
    const db = await requireDb();
    const now = /* @__PURE__ */ new Date();
    const startOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01 00:00:00`;
    const endOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()).padStart(2, "0")} 23:59:59`;
    const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const startOfPrevMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, "0")}-01 00:00:00`;
    const endOfPrevMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, "0")}-${String(new Date(prevDate.getFullYear(), prevDate.getMonth() + 1, 0).getDate()).padStart(2, "0")} 23:59:59`;
    const getMonthData = async (start, end) => {
      const procs = await db.select({ id: technicalProcedures.id, chargedAmount: technicalProcedures.chargedAmount }).from(technicalProcedures).where(and6(
        eq6(technicalProcedures.studioId, studioId),
        gte3(technicalProcedures.createdAt, start),
        lte4(technicalProcedures.createdAt, end)
      ));
      if (procs.length === 0) return { totalCost: 0, totalRevenue: 0, sessions: 0, avgGrossMargin: 0 };
      const procIds = procs.map((p) => p.id);
      const allConsumables = await db.select().from(procedureConsumables);
      const filtered = allConsumables.filter((c) => procIds.includes(c.procedureId));
      let totalCost = 0;
      for (const c of filtered) {
        totalCost += parseFloat(c.estimatedUnitCost ?? "0") * parseFloat(c.quantity ?? "0");
      }
      const totalRevenue = procs.reduce((s, p) => s + (p.chargedAmount ?? 0), 0) / 100;
      const sessions = procs.length;
      const avgGrossMargin = sessions > 0 ? (totalRevenue - totalCost) / sessions : 0;
      return { totalCost, totalRevenue, sessions, avgGrossMargin };
    };
    const [current, previous] = await Promise.all([
      getMonthData(startOfMonth, endOfMonth),
      getMonthData(startOfPrevMonth, endOfPrevMonth)
    ]);
    const costVariation = previous.totalCost > 0 ? (current.totalCost - previous.totalCost) / previous.totalCost * 100 : null;
    const marginVariation = previous.avgGrossMargin > 0 ? (current.avgGrossMargin - previous.avgGrossMargin) / previous.avgGrossMargin * 100 : null;
    return {
      current: {
        ...current,
        label: now.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })
      },
      previous: {
        ...previous,
        label: prevDate.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })
      },
      costVariation,
      marginVariation
    };
  }),
  listLinkedAppointmentIds: tenantProcedure.query(async ({ ctx }) => {
    const studioId = ctx.studioId;
    const db = await requireDb();
    const rows = await db.select({ appointmentId: technicalProcedures.appointmentId, id: technicalProcedures.id }).from(technicalProcedures).where(
      and6(
        eq6(technicalProcedures.studioId, studioId),
        isNotNull(technicalProcedures.appointmentId)
      )
    );
    const map = {};
    for (const r of rows) {
      if (r.appointmentId != null) map[r.appointmentId] = r.id;
    }
    return map;
  })
});

// server/routers/podSaas.ts
init_schema();
init_db();
import { TRPCError as TRPCError5 } from "@trpc/server";
import { and as and7, asc, desc as desc5, eq as eq7, isNull as isNull2 } from "drizzle-orm";
import { z as z4 } from "zod";
var quantitySchema = z4.string().regex(/^\d{1,9}(?:\.\d{1,3})?$/, "Informe uma quantidade positiva com at\xE9 tr\xEAs casas decimais.");
var costSchema = z4.string().regex(/^\d{1,9}(?:\.\d{1,4})?$/, "Informe um custo n\xE3o negativo com at\xE9 quatro casas decimais.");
var dateTimeSchema = z4.string().datetime({ offset: true }).optional();
function nowSql2() {
  return (/* @__PURE__ */ new Date()).toISOString().slice(0, 19).replace("T", " ");
}
function decimalToScaled(value, decimals) {
  const [whole, fraction = ""] = value.trim().split(".");
  return Number(whole) * 10 ** decimals + Number((fraction + "0".repeat(decimals)).slice(0, decimals));
}
function scaledToDecimal(value, decimals) {
  const divisor = 10 ** decimals;
  const sign = value < 0 ? "-" : "";
  const absolute = Math.abs(value);
  return `${sign}${Math.floor(absolute / divisor)}.${String(absolute % divisor).padStart(decimals, "0")}`;
}
function incrementFixedDecimal(value, decimals) {
  const digits = value.replace(".", "").split("");
  let carry = 1;
  for (let index2 = digits.length - 1; index2 >= 0 && carry; index2 -= 1) {
    const next = Number(digits[index2]) + carry;
    digits[index2] = String(next % 10);
    carry = next >= 10 ? 1 : 0;
  }
  if (carry) digits.unshift("1");
  const separator = digits.length - decimals;
  return `${digits.slice(0, separator).join("") || "0"}.${digits.slice(separator).join("").padStart(decimals, "0")}`;
}
function multiplyQuantityByCost(quantity, unitCost) {
  const left = String(decimalToScaled(quantity, 3));
  const right = String(decimalToScaled(unitCost, 4));
  const accumulator = Array(left.length + right.length).fill(0);
  for (let i = left.length - 1; i >= 0; i -= 1) {
    for (let j = right.length - 1; j >= 0; j -= 1) {
      accumulator[i + j + 1] += Number(left[i]) * Number(right[j]);
    }
  }
  for (let i = accumulator.length - 1; i > 0; i -= 1) {
    accumulator[i - 1] += Math.floor(accumulator[i] / 10);
    accumulator[i] %= 10;
  }
  const digits = accumulator.join("").replace(/^0+(?=\d)/, "");
  const padded = digits.padStart(8, "0");
  const integer = padded.slice(0, -7) || "0";
  const fraction = padded.slice(-7);
  const truncated = `${integer}.${fraction.slice(0, 4)}`;
  return Number(fraction[4]) >= 5 ? incrementFixedDecimal(truncated, 4) : truncated;
}
function isAffected(result) {
  const raw = result;
  if (Array.isArray(raw)) return (raw[0]?.affectedRows ?? 0) === 1;
  return (raw.affectedRows ?? raw.rowsAffected ?? 0) === 1;
}
async function requireDatabase() {
  const database = await getDb();
  if (!database) throw new TRPCError5({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indispon\xEDvel." });
  return database;
}
async function requireModule(ctx, module, write = false) {
  if (ctx.user.role === "superadmin" || ctx.user.role === "admin") return;
  const allowed = await hasModulePermission({ userId: ctx.user.id, studioId: ctx.studioId, module, write });
  if (!allowed) throw new TRPCError5({ code: "FORBIDDEN", message: `Voc\xEA n\xE3o possui permiss\xE3o para ${write ? "alterar" : "consultar"} este m\xF3dulo.` });
}
async function requireProcedure(database, procedureId, studioId) {
  const procedure = (await database.select().from(technicalProcedures).where(and7(
    eq7(technicalProcedures.id, procedureId),
    eq7(technicalProcedures.studioId, studioId)
  )).limit(1))[0];
  if (!procedure) throw new TRPCError5({ code: "NOT_FOUND", message: "Sess\xE3o POD n\xE3o encontrada nesta empresa." });
  return procedure;
}
function calculateTiming(startedAt, finishedAt, pauses) {
  const start = startedAt ? new Date(startedAt).getTime() : Date.now();
  const end = finishedAt ? new Date(finishedAt).getTime() : Date.now();
  const pausedMilliseconds = pauses.reduce((total, pause) => {
    const pauseStart = new Date(pause.startedAt).getTime();
    const pauseEnd = pause.endedAt ? new Date(pause.endedAt).getTime() : Date.now();
    return total + Math.max(0, pauseEnd - pauseStart);
  }, 0);
  const totalMinutes = Math.max(0, Math.floor((end - start) / 6e4));
  return {
    totalMinutes,
    pausedMinutes: Math.floor(pausedMilliseconds / 6e4),
    effectiveMinutes: Math.max(0, Math.floor((end - start - pausedMilliseconds) / 6e4))
  };
}
var podSaasRouter = router({
  catalog: router({
    list: tenantProcedure.query(async ({ ctx }) => {
      await requireModule(ctx, "stock");
      const database = await requireDatabase();
      const categories = await database.select().from(materialCatalogCategories).where(eq7(materialCatalogCategories.isActive, 1)).orderBy(asc(materialCatalogCategories.name));
      const items = await database.select().from(materialCatalogItems).where(eq7(materialCatalogItems.isActive, 1)).orderBy(asc(materialCatalogItems.name));
      return { categories, items };
    }),
    createCategory: superAdminProcedure.input(z4.object({
      code: z4.string().trim().toLowerCase().regex(/^[a-z0-9_\-]{2,80}$/),
      name: z4.string().trim().min(2).max(120),
      icon: z4.string().trim().max(80).optional(),
      description: z4.string().trim().max(2e3).optional()
    })).mutation(async ({ input }) => {
      const database = await requireDatabase();
      const existing = (await database.select({ id: materialCatalogCategories.id }).from(materialCatalogCategories).where(eq7(materialCatalogCategories.code, input.code)).limit(1))[0];
      if (existing) throw new TRPCError5({ code: "CONFLICT", message: "J\xE1 existe uma categoria com este c\xF3digo." });
      const inserted = await database.insert(materialCatalogCategories).values({
        code: input.code,
        name: input.name,
        icon: input.icon ?? null,
        description: input.description ?? null,
        isActive: 1
      });
      return { id: inserted.insertId };
    }),
    createItem: superAdminProcedure.input(z4.object({
      categoryId: z4.number().int().positive(),
      code: z4.string().trim().toLowerCase().regex(/^[a-z0-9_\-]{2,120}$/),
      name: z4.string().trim().min(2).max(255),
      subcategory: z4.string().trim().max(120).optional(),
      configuration: z4.string().trim().max(120).optional(),
      diameter: z4.string().trim().max(40).optional(),
      defaultUnit: z4.string().trim().min(1).max(50),
      technicalSpecification: z4.string().trim().max(4e3).optional(),
      icon: z4.string().trim().max(80).optional()
    })).mutation(async ({ input }) => {
      const database = await requireDatabase();
      const category = (await database.select({ id: materialCatalogCategories.id }).from(materialCatalogCategories).where(and7(eq7(materialCatalogCategories.id, input.categoryId), eq7(materialCatalogCategories.isActive, 1))).limit(1))[0];
      if (!category) throw new TRPCError5({ code: "NOT_FOUND", message: "Categoria global n\xE3o encontrada ou inativa." });
      const existing = (await database.select({ id: materialCatalogItems.id }).from(materialCatalogItems).where(eq7(materialCatalogItems.code, input.code)).limit(1))[0];
      if (existing) throw new TRPCError5({ code: "CONFLICT", message: "J\xE1 existe um item de cat\xE1logo com este c\xF3digo." });
      const inserted = await database.insert(materialCatalogItems).values({
        ...input,
        subcategory: input.subcategory ?? null,
        configuration: input.configuration ?? null,
        diameter: input.diameter ?? null,
        technicalSpecification: input.technicalSpecification ?? null,
        icon: input.icon ?? null,
        isActive: 1
      });
      return { id: inserted.insertId };
    }),
    setItemActive: superAdminProcedure.input(z4.object({ id: z4.number().int().positive(), isActive: z4.boolean() })).mutation(async ({ input }) => {
      const database = await requireDatabase();
      const result = await database.update(materialCatalogItems).set({ isActive: input.isActive ? 1 : 0 }).where(eq7(materialCatalogItems.id, input.id));
      if (!isAffected(result)) throw new TRPCError5({ code: "NOT_FOUND", message: "Item de cat\xE1logo n\xE3o encontrado." });
      return { id: input.id, isActive: input.isActive };
    })
  }),
  inventory: router({
    list: tenantProcedure.query(async ({ ctx }) => {
      await requireModule(ctx, "stock");
      const database = await requireDatabase();
      return database.select().from(tenantMaterials).where(and7(
        eq7(tenantMaterials.studioId, ctx.studioId),
        eq7(tenantMaterials.isActive, 1)
      )).orderBy(asc(tenantMaterials.name));
    }),
    create: tenantProcedure.input(z4.object({
      catalogItemId: z4.number().int().positive().optional(),
      name: z4.string().trim().min(2).max(255).optional(),
      category: z4.string().trim().max(120).optional(),
      unit: z4.string().trim().min(1).max(50).optional(),
      brand: z4.string().trim().max(120).optional(),
      line: z4.string().trim().max(120).optional(),
      model: z4.string().trim().max(120).optional(),
      configuration: z4.string().trim().max(120).optional(),
      diameter: z4.string().trim().max(40).optional(),
      currentQuantity: quantitySchema,
      minimumQuantity: quantitySchema.default("0"),
      unitCost: costSchema,
      lot: z4.string().trim().max(120).optional(),
      expiresAt: dateTimeSchema,
      notes: z4.string().trim().max(4e3).optional()
    }).superRefine((input, refinement) => {
      if (!input.catalogItemId && !input.name) refinement.addIssue({ code: "custom", message: "Selecione um item do cat\xE1logo ou informe o nome do material.", path: ["name"] });
    })).mutation(async ({ ctx, input }) => {
      await requireModule(ctx, "stock", true);
      const database = await requireDatabase();
      const catalogItem = input.catalogItemId ? (await database.select().from(materialCatalogItems).where(and7(
        eq7(materialCatalogItems.id, input.catalogItemId),
        eq7(materialCatalogItems.isActive, 1)
      )).limit(1))[0] : null;
      if (input.catalogItemId && !catalogItem) throw new TRPCError5({ code: "NOT_FOUND", message: "Item de cat\xE1logo n\xE3o encontrado." });
      const inserted = await database.insert(tenantMaterials).values({
        studioId: ctx.studioId,
        catalogItemId: catalogItem?.id ?? null,
        name: catalogItem?.name ?? input.name,
        category: input.category ?? catalogItem?.subcategory ?? null,
        unit: input.unit ?? catalogItem?.defaultUnit ?? "unidade",
        brand: input.brand ?? null,
        line: input.line ?? null,
        model: input.model ?? null,
        configuration: input.configuration ?? catalogItem?.configuration ?? null,
        diameter: input.diameter ?? catalogItem?.diameter ?? null,
        currentQuantity: scaledToDecimal(decimalToScaled(input.currentQuantity, 3), 3),
        minimumQuantity: scaledToDecimal(decimalToScaled(input.minimumQuantity, 3), 3),
        unitCost: scaledToDecimal(decimalToScaled(input.unitCost, 4), 4),
        supplierId: null,
        lot: input.lot ?? null,
        expiresAt: input.expiresAt ? input.expiresAt.slice(0, 19).replace("T", " ") : null,
        notes: input.notes ?? null,
        createdByUserId: ctx.user.id
      });
      const materialId = inserted.insertId;
      if (!materialId) throw new TRPCError5({ code: "INTERNAL_SERVER_ERROR", message: "N\xE3o foi poss\xEDvel criar o material do estoque." });
      await database.insert(tenantInventoryMovements).values({
        studioId: ctx.studioId,
        tenantMaterialId: materialId,
        type: "entrada",
        quantity: scaledToDecimal(decimalToScaled(input.currentQuantity, 3), 3),
        previousQuantity: "0.000",
        newQuantity: scaledToDecimal(decimalToScaled(input.currentQuantity, 3), 3),
        sourceType: "tenant_material",
        sourceId: materialId,
        reason: "Saldo inicial",
        createdByUserId: ctx.user.id
      });
      return { id: materialId };
    }),
    adjustBalance: tenantProcedure.input(z4.object({
      tenantMaterialId: z4.number().int().positive(),
      newQuantity: quantitySchema,
      reason: z4.string().trim().min(2).max(255),
      notes: z4.string().trim().max(4e3).optional()
    })).mutation(async ({ ctx, input }) => {
      await requireModule(ctx, "stock", true);
      const database = await requireDatabase();
      return database.transaction(async (tx) => {
        const material = (await tx.select().from(tenantMaterials).where(and7(
          eq7(tenantMaterials.id, input.tenantMaterialId),
          eq7(tenantMaterials.studioId, ctx.studioId),
          eq7(tenantMaterials.isActive, 1)
        )).limit(1))[0];
        if (!material) throw new TRPCError5({ code: "NOT_FOUND", message: "Material do estoque n\xE3o encontrado nesta empresa." });
        const previousQuantity = decimalToScaled(material.currentQuantity, 3);
        const newQuantity = decimalToScaled(input.newQuantity, 3);
        const persistedPreviousQuantity = scaledToDecimal(previousQuantity, 3);
        const persistedNewQuantity = scaledToDecimal(newQuantity, 3);
        const update = await tx.update(tenantMaterials).set({ currentQuantity: persistedNewQuantity }).where(and7(
          eq7(tenantMaterials.id, material.id),
          eq7(tenantMaterials.studioId, ctx.studioId),
          eq7(tenantMaterials.currentQuantity, persistedPreviousQuantity)
        ));
        if (!isAffected(update)) throw new TRPCError5({ code: "CONFLICT", message: "O estoque foi atualizado por outra opera\xE7\xE3o. Atualize a tela e tente novamente." });
        await tx.insert(tenantInventoryMovements).values({
          studioId: ctx.studioId,
          tenantMaterialId: material.id,
          type: "ajuste",
          quantity: scaledToDecimal(Math.abs(newQuantity - previousQuantity), 3),
          previousQuantity: persistedPreviousQuantity,
          newQuantity: persistedNewQuantity,
          sourceType: "inventory_adjustment",
          sourceId: material.id,
          reason: input.reason,
          notes: input.notes ?? null,
          createdByUserId: ctx.user.id
        });
        return { id: material.id, previousQuantity: persistedPreviousQuantity, newQuantity: persistedNewQuantity };
      });
    }),
    updateDetails: tenantProcedure.input(z4.object({
      tenantMaterialId: z4.number().int().positive(),
      name: z4.string().trim().min(2).max(255),
      category: z4.string().trim().max(120).optional(),
      unit: z4.string().trim().min(1).max(50),
      brand: z4.string().trim().max(120).optional(),
      line: z4.string().trim().max(120).optional(),
      model: z4.string().trim().max(120).optional(),
      configuration: z4.string().trim().max(120).optional(),
      diameter: z4.string().trim().max(40).optional(),
      minimumQuantity: quantitySchema,
      unitCost: costSchema,
      lot: z4.string().trim().max(120).optional(),
      expiresAt: dateTimeSchema,
      notes: z4.string().trim().max(4e3).optional()
    })).mutation(async ({ ctx, input }) => {
      await requireModule(ctx, "stock", true);
      const database = await requireDatabase();
      const { tenantMaterialId, expiresAt, ...fields } = input;
      const result = await database.update(tenantMaterials).set({
        ...fields,
        category: fields.category ?? null,
        brand: fields.brand ?? null,
        line: fields.line ?? null,
        model: fields.model ?? null,
        configuration: fields.configuration ?? null,
        diameter: fields.diameter ?? null,
        lot: fields.lot ?? null,
        expiresAt: expiresAt ? expiresAt.slice(0, 19).replace("T", " ") : null,
        notes: fields.notes ?? null
      }).where(and7(eq7(tenantMaterials.id, tenantMaterialId), eq7(tenantMaterials.studioId, ctx.studioId), eq7(tenantMaterials.isActive, 1)));
      if (!isAffected(result)) throw new TRPCError5({ code: "NOT_FOUND", message: "Material do estoque n\xE3o encontrado nesta empresa." });
      return { id: tenantMaterialId };
    }),
    archive: tenantProcedure.input(z4.object({ tenantMaterialId: z4.number().int().positive() })).mutation(async ({ ctx, input }) => {
      await requireModule(ctx, "stock", true);
      const database = await requireDatabase();
      const result = await database.update(tenantMaterials).set({ isActive: 0 }).where(and7(
        eq7(tenantMaterials.id, input.tenantMaterialId),
        eq7(tenantMaterials.studioId, ctx.studioId),
        eq7(tenantMaterials.isActive, 1)
      ));
      if (!isAffected(result)) throw new TRPCError5({ code: "NOT_FOUND", message: "Material do estoque n\xE3o encontrado ou j\xE1 arquivado." });
      return { id: input.tenantMaterialId, isActive: false };
    })
  }),
  planning: router({
    listByAppointment: tenantProcedure.input(z4.object({ appointmentId: z4.number().int().positive() })).query(async ({ ctx, input }) => {
      await requireModule(ctx, "appointments");
      const database = await requireDatabase();
      const appointment = (await database.select({ id: appointments.id }).from(appointments).where(and7(
        eq7(appointments.id, input.appointmentId),
        eq7(appointments.studioId, ctx.studioId)
      )).limit(1))[0];
      if (!appointment) throw new TRPCError5({ code: "NOT_FOUND", message: "Agendamento n\xE3o encontrado nesta empresa." });
      return database.select().from(appointmentPlannedMaterials).where(and7(
        eq7(appointmentPlannedMaterials.studioId, ctx.studioId),
        eq7(appointmentPlannedMaterials.appointmentId, input.appointmentId)
      )).orderBy(desc5(appointmentPlannedMaterials.createdAt));
    }),
    add: tenantProcedure.input(z4.object({
      appointmentId: z4.number().int().positive(),
      tenantMaterialId: z4.number().int().positive().optional(),
      catalogItemId: z4.number().int().positive().optional(),
      quantityPlanned: quantitySchema
    }).superRefine((input, refinement) => {
      if (!input.tenantMaterialId && !input.catalogItemId) refinement.addIssue({ code: "custom", message: "Selecione um material do estoque ou do cat\xE1logo.", path: ["tenantMaterialId"] });
    })).mutation(async ({ ctx, input }) => {
      await requireModule(ctx, "appointments", true);
      const database = await requireDatabase();
      const appointment = (await database.select({ id: appointments.id }).from(appointments).where(and7(
        eq7(appointments.id, input.appointmentId),
        eq7(appointments.studioId, ctx.studioId)
      )).limit(1))[0];
      if (!appointment) throw new TRPCError5({ code: "NOT_FOUND", message: "Agendamento n\xE3o encontrado nesta empresa." });
      const material = input.tenantMaterialId ? (await database.select().from(tenantMaterials).where(and7(
        eq7(tenantMaterials.id, input.tenantMaterialId),
        eq7(tenantMaterials.studioId, ctx.studioId)
      )).limit(1))[0] : null;
      if (input.tenantMaterialId && !material) throw new TRPCError5({ code: "NOT_FOUND", message: "Material do estoque n\xE3o encontrado nesta empresa." });
      const catalogItem = input.catalogItemId ? (await database.select().from(materialCatalogItems).where(and7(
        eq7(materialCatalogItems.id, input.catalogItemId),
        eq7(materialCatalogItems.isActive, 1)
      )).limit(1))[0] : null;
      if (input.catalogItemId && !catalogItem) throw new TRPCError5({ code: "NOT_FOUND", message: "Item de cat\xE1logo n\xE3o encontrado." });
      const inserted = await database.insert(appointmentPlannedMaterials).values({
        studioId: ctx.studioId,
        appointmentId: input.appointmentId,
        tenantMaterialId: material?.id ?? null,
        catalogItemId: catalogItem?.id ?? material?.catalogItemId ?? null,
        nameSnapshot: material?.name ?? catalogItem.name,
        unitSnapshot: material?.unit ?? catalogItem.defaultUnit,
        quantityPlanned: scaledToDecimal(decimalToScaled(input.quantityPlanned, 3), 3),
        createdByUserId: ctx.user.id
      });
      return { id: inserted.insertId };
    }),
    markUnused: tenantProcedure.input(z4.object({ plannedMaterialId: z4.number().int().positive() })).mutation(async ({ ctx, input }) => {
      await requireModule(ctx, "appointments", true);
      const database = await requireDatabase();
      const result = await database.update(appointmentPlannedMaterials).set({ status: "nao_utilizado" }).where(and7(
        eq7(appointmentPlannedMaterials.id, input.plannedMaterialId),
        eq7(appointmentPlannedMaterials.studioId, ctx.studioId),
        eq7(appointmentPlannedMaterials.status, "planejado")
      ));
      if (!isAffected(result)) throw new TRPCError5({ code: "NOT_FOUND", message: "Material previsto n\xE3o encontrado ou j\xE1 tratado." });
      return { id: input.plannedMaterialId, status: "nao_utilizado" };
    })
  }),
  session: router({
    create: tenantProcedure.input(z4.object({
      clientId: z4.number().int().positive(),
      appointmentId: z4.number().int().positive().optional(),
      artistId: z4.number().int().positive().optional(),
      title: z4.string().trim().min(2).max(255).optional(),
      description: z4.string().trim().max(4e3).optional(),
      bodyLocation: z4.string().trim().max(100).optional(),
      tattooStyle: z4.string().trim().max(100).optional(),
      chargedAmount: z4.number().int().min(0).optional(),
      referenceImageUrl: z4.string().url().max(500).optional(),
      referenceImageKey: z4.string().trim().max(500).optional()
    })).mutation(async ({ ctx, input }) => {
      await requireModule(ctx, "pod", true);
      const database = await requireDatabase();
      const client = (await database.select({ id: clients.id }).from(clients).where(and7(
        eq7(clients.id, input.clientId),
        eq7(clients.studioId, ctx.studioId)
      )).limit(1))[0];
      if (!client) throw new TRPCError5({ code: "NOT_FOUND", message: "Cliente n\xE3o encontrado nesta empresa." });
      const appointment = input.appointmentId ? (await database.select().from(appointments).where(and7(
        eq7(appointments.id, input.appointmentId),
        eq7(appointments.studioId, ctx.studioId)
      )).limit(1))[0] : null;
      if (input.appointmentId && !appointment) throw new TRPCError5({ code: "NOT_FOUND", message: "Agendamento n\xE3o encontrado nesta empresa." });
      if (appointment && appointment.clientId !== input.clientId) throw new TRPCError5({ code: "BAD_REQUEST", message: "O agendamento selecionado pertence a outro cliente." });
      if (appointment?.artistId && input.artistId && appointment.artistId !== input.artistId) throw new TRPCError5({ code: "BAD_REQUEST", message: "O artista informado n\xE3o corresponde ao agendamento." });
      const resolvedArtistId = input.artistId ?? appointment?.artistId ?? null;
      const artist = resolvedArtistId ? (await database.select().from(artists).where(and7(
        eq7(artists.id, resolvedArtistId),
        eq7(artists.studioId, ctx.studioId)
      )).limit(1))[0] : null;
      if (resolvedArtistId && !artist) throw new TRPCError5({ code: "NOT_FOUND", message: "Artista n\xE3o encontrado nesta empresa." });
      const inserted = await database.insert(technicalProcedures).values({
        studioId: ctx.studioId,
        clientId: input.clientId,
        appointmentId: appointment?.id ?? null,
        artistId: artist?.id ?? null,
        artistName: artist?.name ?? appointment?.artist ?? null,
        title: input.title ?? appointment?.service ?? "Sess\xE3o POD",
        description: input.description ?? null,
        bodyLocation: input.bodyLocation ?? null,
        tattooStyle: input.tattooStyle ?? null,
        chargedAmount: input.chargedAmount ?? appointment?.totalAmount ?? 0,
        status: "em_andamento",
        startedAt: nowSql2(),
        referenceImageUrl: appointment?.referenceImageUrl ?? input.referenceImageUrl ?? null,
        referenceImageKey: appointment?.referenceImageKey ?? input.referenceImageKey ?? null
      });
      return { id: inserted.insertId };
    }),
    get: tenantProcedure.input(z4.object({ procedureId: z4.number().int().positive() })).query(async ({ ctx, input }) => {
      await requireModule(ctx, "pod");
      const database = await requireDatabase();
      const procedure = await requireProcedure(database, input.procedureId, ctx.studioId);
      const pauses = await database.select().from(procedurePauses).where(and7(
        eq7(procedurePauses.procedureId, procedure.id),
        eq7(procedurePauses.studioId, ctx.studioId)
      )).orderBy(asc(procedurePauses.startedAt));
      const consumptions = await database.select().from(procedureInventoryConsumptions).where(and7(
        eq7(procedureInventoryConsumptions.procedureId, procedure.id),
        eq7(procedureInventoryConsumptions.studioId, ctx.studioId)
      )).orderBy(desc5(procedureInventoryConsumptions.consumedAt));
      const plannedMaterials = procedure.appointmentId ? await database.select().from(appointmentPlannedMaterials).where(and7(
        eq7(appointmentPlannedMaterials.studioId, ctx.studioId),
        eq7(appointmentPlannedMaterials.appointmentId, procedure.appointmentId)
      )) : [];
      return { procedure, pauses, consumptions, plannedMaterials, timing: calculateTiming(procedure.startedAt, procedure.finishedAt, pauses) };
    }),
    startPause: tenantProcedure.input(z4.object({ procedureId: z4.number().int().positive(), reason: z4.string().trim().max(120).optional() })).mutation(async ({ ctx, input }) => {
      await requireModule(ctx, "pod", true);
      const database = await requireDatabase();
      const procedure = await requireProcedure(database, input.procedureId, ctx.studioId);
      if (procedure.status === "finalizado") throw new TRPCError5({ code: "BAD_REQUEST", message: "N\xE3o \xE9 poss\xEDvel pausar uma sess\xE3o finalizada." });
      const openPause = (await database.select({ id: procedurePauses.id }).from(procedurePauses).where(and7(
        eq7(procedurePauses.procedureId, procedure.id),
        eq7(procedurePauses.studioId, ctx.studioId),
        isNull2(procedurePauses.endedAt)
      )).limit(1))[0];
      if (openPause) throw new TRPCError5({ code: "CONFLICT", message: "J\xE1 existe uma pausa aberta nesta sess\xE3o." });
      const startedAt = nowSql2();
      const inserted = await database.insert(procedurePauses).values({ studioId: ctx.studioId, procedureId: procedure.id, artistId: procedure.artistId, startedAt, reason: input.reason ?? null });
      await database.update(technicalProcedures).set({ status: "pausado", pausedAt: startedAt }).where(and7(eq7(technicalProcedures.id, procedure.id), eq7(technicalProcedures.studioId, ctx.studioId)));
      return { id: inserted.insertId, startedAt };
    }),
    resumePause: tenantProcedure.input(z4.object({ procedureId: z4.number().int().positive() })).mutation(async ({ ctx, input }) => {
      await requireModule(ctx, "pod", true);
      const database = await requireDatabase();
      const procedure = await requireProcedure(database, input.procedureId, ctx.studioId);
      const openPause = (await database.select().from(procedurePauses).where(and7(
        eq7(procedurePauses.procedureId, procedure.id),
        eq7(procedurePauses.studioId, ctx.studioId),
        isNull2(procedurePauses.endedAt)
      )).limit(1))[0];
      if (!openPause) throw new TRPCError5({ code: "NOT_FOUND", message: "N\xE3o h\xE1 pausa aberta nesta sess\xE3o." });
      const endedAt = nowSql2();
      await database.update(procedurePauses).set({ endedAt }).where(and7(eq7(procedurePauses.id, openPause.id), eq7(procedurePauses.studioId, ctx.studioId), isNull2(procedurePauses.endedAt)));
      await database.update(technicalProcedures).set({ status: "em_andamento", pausedAt: null }).where(and7(eq7(technicalProcedures.id, procedure.id), eq7(technicalProcedures.studioId, ctx.studioId)));
      return { id: openPause.id, endedAt };
    }),
    consume: tenantProcedure.input(z4.object({
      procedureId: z4.number().int().positive(),
      tenantMaterialId: z4.number().int().positive(),
      plannedMaterialId: z4.number().int().positive().optional(),
      quantity: quantitySchema.refine((value) => decimalToScaled(value, 3) > 0, "A quantidade deve ser maior que zero.")
    })).mutation(async ({ ctx, input }) => {
      await requireModule(ctx, "pod", true);
      await requireModule(ctx, "stock", true);
      const database = await requireDatabase();
      return database.transaction(async (tx) => {
        const procedure = await requireProcedure(tx, input.procedureId, ctx.studioId);
        if (procedure.status === "finalizado") throw new TRPCError5({ code: "BAD_REQUEST", message: "N\xE3o \xE9 poss\xEDvel consumir materiais em uma sess\xE3o finalizada." });
        const material = (await tx.select().from(tenantMaterials).where(and7(
          eq7(tenantMaterials.id, input.tenantMaterialId),
          eq7(tenantMaterials.studioId, ctx.studioId),
          eq7(tenantMaterials.isActive, 1)
        )).limit(1))[0];
        if (!material) throw new TRPCError5({ code: "NOT_FOUND", message: "Material do estoque n\xE3o encontrado nesta empresa." });
        const quantity = decimalToScaled(input.quantity, 3);
        const previousQuantity = decimalToScaled(material.currentQuantity, 3);
        if (previousQuantity < quantity) throw new TRPCError5({ code: "BAD_REQUEST", message: "Saldo insuficiente para confirmar este consumo." });
        const newQuantity = previousQuantity - quantity;
        let plannedMaterial;
        if (input.plannedMaterialId) {
          plannedMaterial = (await tx.select().from(appointmentPlannedMaterials).where(and7(
            eq7(appointmentPlannedMaterials.id, input.plannedMaterialId),
            eq7(appointmentPlannedMaterials.studioId, ctx.studioId),
            eq7(appointmentPlannedMaterials.status, "planejado")
          )).limit(1))[0];
          if (!plannedMaterial || !procedure.appointmentId || plannedMaterial.appointmentId !== procedure.appointmentId) throw new TRPCError5({ code: "BAD_REQUEST", message: "O material previsto n\xE3o pertence ao agendamento desta sess\xE3o." });
          if (plannedMaterial.tenantMaterialId && plannedMaterial.tenantMaterialId !== material.id) throw new TRPCError5({ code: "BAD_REQUEST", message: "O material consumido n\xE3o corresponde ao material previsto." });
        }
        const unitCost = decimalToScaled(material.unitCost, 4);
        const totalCost = multiplyQuantityByCost(input.quantity, material.unitCost);
        const persistedPreviousQuantity = scaledToDecimal(previousQuantity, 3);
        const persistedNewQuantity = scaledToDecimal(newQuantity, 3);
        const stockUpdate = await tx.update(tenantMaterials).set({ currentQuantity: persistedNewQuantity }).where(and7(
          eq7(tenantMaterials.id, material.id),
          eq7(tenantMaterials.studioId, ctx.studioId),
          eq7(tenantMaterials.currentQuantity, persistedPreviousQuantity)
        ));
        if (!isAffected(stockUpdate)) throw new TRPCError5({ code: "CONFLICT", message: "O estoque foi atualizado por outra opera\xE7\xE3o. Atualize a sess\xE3o e tente novamente." });
        const consumption = await tx.insert(procedureInventoryConsumptions).values({
          procedureId: procedure.id,
          studioId: ctx.studioId,
          appointmentId: procedure.appointmentId,
          clientId: procedure.clientId,
          artistId: procedure.artistId,
          tenantMaterialId: material.id,
          plannedMaterialId: plannedMaterial?.id ?? null,
          nameSnapshot: material.name,
          unitSnapshot: material.unit,
          quantity: scaledToDecimal(quantity, 3),
          unitCostSnapshot: scaledToDecimal(unitCost, 4),
          totalCostSnapshot: totalCost,
          lotSnapshot: material.lot,
          expiresAtSnapshot: material.expiresAt,
          consumedAt: nowSql2(),
          createdByUserId: ctx.user.id
        });
        const consumptionId = consumption.insertId;
        if (!consumptionId) throw new TRPCError5({ code: "INTERNAL_SERVER_ERROR", message: "N\xE3o foi poss\xEDvel registrar o consumo." });
        await tx.insert(tenantInventoryMovements).values({
          studioId: ctx.studioId,
          tenantMaterialId: material.id,
          type: "consumo",
          quantity: scaledToDecimal(quantity, 3),
          previousQuantity: persistedPreviousQuantity,
          newQuantity: persistedNewQuantity,
          sourceType: "procedure_consumption",
          sourceId: consumptionId,
          reason: `Consumo na sess\xE3o POD #${procedure.id}`,
          createdByUserId: ctx.user.id
        });
        if (plannedMaterial) await tx.update(appointmentPlannedMaterials).set({ status: "consumido" }).where(and7(eq7(appointmentPlannedMaterials.id, plannedMaterial.id), eq7(appointmentPlannedMaterials.studioId, ctx.studioId), eq7(appointmentPlannedMaterials.status, "planejado")));
        return { id: consumptionId, remainingQuantity: persistedNewQuantity };
      });
    }),
    revertConsumption: tenantProcedure.input(z4.object({ consumptionId: z4.number().int().positive(), reason: z4.string().trim().min(2).max(255) })).mutation(async ({ ctx, input }) => {
      await requireModule(ctx, "pod", true);
      await requireModule(ctx, "stock", true);
      const database = await requireDatabase();
      return database.transaction(async (tx) => {
        const consumption = (await tx.select().from(procedureInventoryConsumptions).where(and7(
          eq7(procedureInventoryConsumptions.id, input.consumptionId),
          eq7(procedureInventoryConsumptions.studioId, ctx.studioId)
        )).limit(1))[0];
        if (!consumption) throw new TRPCError5({ code: "NOT_FOUND", message: "Consumo n\xE3o encontrado nesta empresa." });
        if (consumption.status === "revertido") return { id: consumption.id, status: "revertido", alreadyReverted: true };
        const material = (await tx.select().from(tenantMaterials).where(and7(
          eq7(tenantMaterials.id, consumption.tenantMaterialId),
          eq7(tenantMaterials.studioId, ctx.studioId)
        )).limit(1))[0];
        if (!material) throw new TRPCError5({ code: "NOT_FOUND", message: "O material original n\xE3o existe mais nesta empresa." });
        const previousQuantity = decimalToScaled(material.currentQuantity, 3);
        const restoredQuantity = previousQuantity + decimalToScaled(consumption.quantity, 3);
        const persistedPreviousQuantity = scaledToDecimal(previousQuantity, 3);
        const persistedRestoredQuantity = scaledToDecimal(restoredQuantity, 3);
        const stockUpdate = await tx.update(tenantMaterials).set({ currentQuantity: persistedRestoredQuantity }).where(and7(
          eq7(tenantMaterials.id, material.id),
          eq7(tenantMaterials.studioId, ctx.studioId),
          eq7(tenantMaterials.currentQuantity, persistedPreviousQuantity)
        ));
        if (!isAffected(stockUpdate)) throw new TRPCError5({ code: "CONFLICT", message: "O estoque foi atualizado por outra opera\xE7\xE3o. Atualize a sess\xE3o e tente novamente." });
        const reversalUpdate = await tx.update(procedureInventoryConsumptions).set({ status: "revertido", reversedAt: nowSql2(), reversalReason: input.reason, reversedByUserId: ctx.user.id }).where(and7(
          eq7(procedureInventoryConsumptions.id, consumption.id),
          eq7(procedureInventoryConsumptions.studioId, ctx.studioId),
          eq7(procedureInventoryConsumptions.status, "consumido")
        ));
        if (!isAffected(reversalUpdate)) throw new TRPCError5({ code: "CONFLICT", message: "Este consumo j\xE1 foi revertido por outra opera\xE7\xE3o." });
        await tx.insert(tenantInventoryMovements).values({
          studioId: ctx.studioId,
          tenantMaterialId: material.id,
          type: "reversao",
          quantity: scaledToDecimal(decimalToScaled(consumption.quantity, 3), 3),
          previousQuantity: persistedPreviousQuantity,
          newQuantity: persistedRestoredQuantity,
          sourceType: "procedure_consumption_reversal",
          sourceId: consumption.id,
          reason: input.reason,
          createdByUserId: ctx.user.id
        });
        return { id: consumption.id, status: "revertido", alreadyReverted: false };
      });
    })
  })
});

// server/routers/messaging.ts
import { z as z5 } from "zod";
import { TRPCError as TRPCError6 } from "@trpc/server";
init_db();
init_schema();
init_provider();
init_service();
init_crypto();
init_phone();
import { eq as eq8, desc as desc6, and as and8, inArray as inArray3 } from "drizzle-orm";
function requireIntegrationManager(ctx) {
  if (ctx.user?.role !== "admin" && ctx.user?.role !== "superadmin") {
    throw new TRPCError6({ code: "FORBIDDEN", message: "Voc\xEA n\xE3o tem permiss\xE3o para gerenciar integra\xE7\xF5es." });
  }
}
function getManagedStudioId(ctx, requestedStudioId) {
  if (ctx.user?.role === "superadmin" && requestedStudioId) return requestedStudioId;
  const studioId = ctx.studioId ?? ctx.user?.studioId;
  if (!studioId) throw new TRPCError6({ code: "BAD_REQUEST", message: "Selecione uma empresa antes de configurar uma integra\xE7\xE3o." });
  if (requestedStudioId && requestedStudioId !== studioId) {
    throw new TRPCError6({ code: "FORBIDDEN", message: "N\xE3o \xE9 permitido configurar uma integra\xE7\xE3o para outra empresa." });
  }
  return studioId;
}
async function findScopedIntegration(db, id, studioId) {
  const condition = studioId == null ? eq8(whatsappIntegrations.id, id) : and8(eq8(whatsappIntegrations.id, id), eq8(whatsappIntegrations.studioId, studioId));
  const integration = (await db.select().from(whatsappIntegrations).where(condition).limit(1))[0];
  if (!integration) throw new TRPCError6({ code: "NOT_FOUND", message: "Integra\xE7\xE3o n\xE3o encontrada nesta empresa." });
  return integration;
}
function assertProductionReleaseReadiness(integration) {
  if (!integration.encryptedApiToken) {
    throw new TRPCError6({ code: "BAD_REQUEST", message: "A integra\xE7\xE3o n\xE3o possui uma credencial protegida configurada." });
  }
  if (!integration.isEnabled || integration.status !== "ativo") {
    throw new TRPCError6({ code: "BAD_REQUEST", message: "Ative a integra\xE7\xE3o antes de liberar o modo de produ\xE7\xE3o." });
  }
  if (!integration.lastTestedAt || !integration.lastSuccessAt) {
    throw new TRPCError6({ code: "BAD_REQUEST", message: "Conclua os testes de conex\xE3o e homologa\xE7\xE3o antes de liberar a produ\xE7\xE3o." });
  }
}
function assertRetryableMessage(source) {
  if (!source || source.studioId == null) {
    throw new TRPCError6({ code: "NOT_FOUND", message: "Mensagem n\xE3o encontrada nesta empresa." });
  }
  if (source.status !== "erro") {
    throw new TRPCError6({ code: "BAD_REQUEST", message: "Somente mensagens com falha terminal podem ser reenviadas." });
  }
  if (!source.clientId) {
    throw new TRPCError6({ code: "BAD_REQUEST", message: "O reenvio em produ\xE7\xE3o exige uma mensagem vinculada a um cliente com consentimento." });
  }
}
var messagingRouter = router({
  /** Lista clientes do estúdio e seu opt-in na integração selecionada. */
  listWhatsappConsents: tenantProcedure.input(z5.object({ integrationId: z5.number().int().positive() })).query(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError6({ code: "INTERNAL_SERVER_ERROR" });
    const integration = await findScopedIntegration(db, input.integrationId, ctx.studioId);
    if (!integration.studioId) throw new TRPCError6({ code: "BAD_REQUEST", message: "A integra\xE7\xE3o n\xE3o est\xE1 vinculada a uma empresa." });
    return await db.select({
      clientId: clients.id,
      clientName: clients.name,
      phone: clients.phone,
      hasWhatsappOptIn: integrationContacts.hasWhatsappOptIn,
      optInAt: integrationContacts.optInAt,
      optInSource: integrationContacts.optInSource,
      optedOutAt: integrationContacts.optedOutAt
    }).from(clients).leftJoin(integrationContacts, and8(
      eq8(integrationContacts.clientId, clients.id),
      eq8(integrationContacts.studioId, integration.studioId),
      eq8(integrationContacts.integrationId, integration.id)
    )).where(eq8(clients.studioId, integration.studioId)).limit(200);
  }),
  /** Registra revogação ou opt-in informado pelo gestor; não envia mensagens. */
  setWhatsappConsent: tenantProcedure.input(z5.object({
    integrationId: z5.number().int().positive(),
    clientId: z5.number().int().positive(),
    hasWhatsappOptIn: z5.boolean(),
    source: z5.string().min(3).max(100).default("painel_do_estudio")
  })).mutation(async ({ ctx, input }) => {
    requireIntegrationManager(ctx);
    const db = await getDb();
    if (!db) throw new TRPCError6({ code: "INTERNAL_SERVER_ERROR" });
    const integration = await findScopedIntegration(db, input.integrationId, ctx.studioId);
    if (!integration.studioId) throw new TRPCError6({ code: "BAD_REQUEST", message: "A integra\xE7\xE3o n\xE3o est\xE1 vinculada a uma empresa." });
    const client = (await db.select({ id: clients.id, phone: clients.phone }).from(clients).where(and8(
      eq8(clients.id, input.clientId),
      eq8(clients.studioId, integration.studioId)
    )).limit(1))[0];
    if (!client?.phone) throw new TRPCError6({ code: "BAD_REQUEST", message: "O cliente precisa ter telefone cadastrado antes do consentimento." });
    const timestamp2 = (/* @__PURE__ */ new Date()).toISOString().slice(0, 19).replace("T", " ");
    await db.insert(integrationContacts).values({
      studioId: integration.studioId,
      integrationId: integration.id,
      clientId: client.id,
      normalizedPhone: normalizeBrazilianPhone(client.phone),
      hasWhatsappOptIn: input.hasWhatsappOptIn ? 1 : 0,
      optInAt: input.hasWhatsappOptIn ? timestamp2 : null,
      optInSource: input.hasWhatsappOptIn ? input.source : null,
      optedOutAt: input.hasWhatsappOptIn ? null : timestamp2
    }).onDuplicateKeyUpdate({ set: {
      integrationId: integration.id,
      normalizedPhone: normalizeBrazilianPhone(client.phone),
      hasWhatsappOptIn: input.hasWhatsappOptIn ? 1 : 0,
      optInAt: input.hasWhatsappOptIn ? timestamp2 : null,
      optInSource: input.hasWhatsappOptIn ? input.source : null,
      optedOutAt: input.hasWhatsappOptIn ? null : timestamp2
    } });
    return { ok: true };
  }),
  /** Preferências de disparos automáticos, limitadas ao estúdio da sessão. */
  getAutomationSettings: tenantProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError6({ code: "INTERNAL_SERVER_ERROR" });
    const studioId = getManagedStudioId(ctx);
    return (await db.select().from(messageAutomationSettings).where(eq8(messageAutomationSettings.studioId, studioId)).limit(1))[0] ?? {
      studioId,
      appointmentRemindersEnabled: 0,
      appointmentDaysBefore: 1,
      appointmentSendTime: "10:00",
      oneHourRemindersEnabled: 0,
      birthdayMessagesEnabled: 0,
      birthdaySendTime: "10:00",
      birthdayMessageTemplate: null,
      timezone: "America/Sao_Paulo",
      lastAppointmentCycleAt: null,
      lastBirthdayCycleAt: null,
      lastError: null
    };
  }),
  updateAutomationSettings: tenantProcedure.input(z5.object({
    appointmentRemindersEnabled: z5.boolean(),
    appointmentDaysBefore: z5.number().int().min(1).max(7),
    appointmentSendTime: z5.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    oneHourRemindersEnabled: z5.boolean(),
    birthdayMessagesEnabled: z5.boolean(),
    birthdaySendTime: z5.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    birthdayMessageTemplate: z5.string().min(1).max(1500).optional()
  })).mutation(async ({ ctx, input }) => {
    requireIntegrationManager(ctx);
    const db = await getDb();
    if (!db) throw new TRPCError6({ code: "INTERNAL_SERVER_ERROR" });
    const studioId = getManagedStudioId(ctx);
    await db.insert(messageAutomationSettings).values({
      studioId,
      appointmentRemindersEnabled: input.appointmentRemindersEnabled ? 1 : 0,
      appointmentDaysBefore: input.appointmentDaysBefore,
      appointmentSendTime: input.appointmentSendTime,
      oneHourRemindersEnabled: input.oneHourRemindersEnabled ? 1 : 0,
      birthdayMessagesEnabled: input.birthdayMessagesEnabled ? 1 : 0,
      birthdaySendTime: input.birthdaySendTime,
      birthdayMessageTemplate: input.birthdayMessageTemplate
    }).onDuplicateKeyUpdate({ set: {
      appointmentRemindersEnabled: input.appointmentRemindersEnabled ? 1 : 0,
      appointmentDaysBefore: input.appointmentDaysBefore,
      appointmentSendTime: input.appointmentSendTime,
      oneHourRemindersEnabled: input.oneHourRemindersEnabled ? 1 : 0,
      birthdayMessagesEnabled: input.birthdayMessagesEnabled ? 1 : 0,
      birthdaySendTime: input.birthdaySendTime,
      birthdayMessageTemplate: input.birthdayMessageTemplate
    } });
    return { ok: true };
  }),
  // ── Integração (configuração do provedor) ──────────────────────────────────
  /** Lista todas as integrações cadastradas */
  listIntegrations: tenantProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return [];
    const query = db.select({
      id: whatsappIntegrations.id,
      studioId: whatsappIntegrations.studioId,
      name: whatsappIntegrations.name,
      provider: whatsappIntegrations.provider,
      phoneNumber: whatsappIntegrations.phoneNumber,
      instanceId: whatsappIntegrations.instanceId,
      status: whatsappIntegrations.status,
      sandboxMode: whatsappIntegrations.sandboxMode,
      sandboxTestPhone: whatsappIntegrations.sandboxTestPhone,
      isEnabled: whatsappIntegrations.isEnabled,
      connectionKey: whatsappIntegrations.connectionKey,
      webhookUrl: whatsappIntegrations.webhookUrl,
      lastTestedAt: whatsappIntegrations.lastTestedAt,
      lastSuccessAt: whatsappIntegrations.lastSuccessAt,
      lastErrorMessage: whatsappIntegrations.lastErrorMessage,
      failureCount: whatsappIntegrations.failureCount,
      encryptedApiToken: whatsappIntegrations.encryptedApiToken,
      createdAt: whatsappIntegrations.createdAt,
      updatedAt: whatsappIntegrations.updatedAt
    }).from(whatsappIntegrations);
    if (ctx.studioId != null) query.where(eq8(whatsappIntegrations.studioId, ctx.studioId));
    const rows = await query.orderBy(desc6(whatsappIntegrations.createdAt));
    return rows.map(({ encryptedApiToken, ...integration }) => ({ ...integration, tokenMasked: maskSecret(encryptedApiToken) }));
  }),
  /** Salva ou atualiza uma integração */
  saveIntegration: tenantProcedure.input(
    z5.object({
      id: z5.number().optional(),
      name: z5.string().min(1),
      provider: z5.enum(["botconversa", "zapi", "meta"]),
      phoneNumber: z5.string().min(8),
      apiToken: z5.string().min(1).optional(),
      instanceId: z5.string().optional(),
      studioId: z5.number().optional(),
      sandboxMode: z5.boolean().default(true),
      sandboxTestPhone: z5.string().optional(),
      webhookSecret: z5.string().min(24).max(256).optional()
    })
  ).mutation(async ({ input, ctx }) => {
    requireIntegrationManager(ctx);
    const db = await getDb();
    if (!db) throw new TRPCError6({ code: "INTERNAL_SERVER_ERROR" });
    const studioId = getManagedStudioId(ctx, input.studioId);
    const targetStudio = (await db.select({ id: studios.id }).from(studios).where(eq8(studios.id, studioId)).limit(1))[0];
    if (!targetStudio) {
      throw new TRPCError6({ code: "BAD_REQUEST", message: "A empresa selecionada n\xE3o existe ou n\xE3o est\xE1 dispon\xEDvel." });
    }
    const sandboxTestPhone = input.sandboxTestPhone ? normalizeBrazilianPhone(input.sandboxTestPhone) : null;
    if (input.id) {
      const existing = await findScopedIntegration(db, input.id, ctx.studioId);
      if (existing.studioId !== studioId) {
        throw new TRPCError6({ code: "FORBIDDEN", message: "A integra\xE7\xE3o n\xE3o pode ser movida entre empresas." });
      }
      await db.update(whatsappIntegrations).set({
        name: input.name,
        provider: input.provider,
        phoneNumber: input.phoneNumber,
        ...input.apiToken ? { encryptedApiToken: encryptIntegrationSecret(input.apiToken), apiToken: "__encrypted_v1__" } : {},
        ...input.webhookSecret ? { encryptedWebhookSecret: encryptIntegrationSecret(input.webhookSecret) } : {},
        instanceId: input.instanceId,
        sandboxMode: input.sandboxMode ? 1 : 0,
        sandboxTestPhone,
        studioId: existing.studioId ?? studioId,
        updatedAt: (/* @__PURE__ */ new Date()).toISOString().slice(0, 19).replace("T", " ")
      }).where(eq8(whatsappIntegrations.id, existing.id));
      return { ok: true };
    }
    if (!input.apiToken) throw new TRPCError6({ code: "BAD_REQUEST", message: "Informe o token para criar a integra\xE7\xE3o." });
    await db.insert(whatsappIntegrations).values({
      studioId,
      name: input.name,
      provider: input.provider,
      phoneNumber: input.phoneNumber,
      apiToken: "__encrypted_v1__",
      encryptedApiToken: encryptIntegrationSecret(input.apiToken),
      encryptedWebhookSecret: encryptIntegrationSecret(input.webhookSecret ?? createConnectionKey()),
      connectionKey: createConnectionKey(),
      sandboxMode: input.sandboxMode ? 1 : 0,
      sandboxTestPhone,
      isEnabled: 0,
      instanceId: input.instanceId,
      status: "aguardando"
    });
    return { ok: true };
  }),
  /** Ativa uma integração e desativa as demais */
  activateIntegration: tenantProcedure.input(z5.object({ id: z5.number() })).mutation(async ({ input, ctx }) => {
    requireIntegrationManager(ctx);
    const db = await getDb();
    if (!db) throw new TRPCError6({ code: "INTERNAL_SERVER_ERROR" });
    const integration = await findScopedIntegration(db, input.id, ctx.studioId);
    const studioId = integration.studioId ?? getManagedStudioId(ctx);
    if (!integration.encryptedApiToken) {
      throw new TRPCError6({ code: "BAD_REQUEST", message: "Defina e teste o token da integra\xE7\xE3o antes de ativ\xE1-la." });
    }
    if (integration.sandboxMode && !integration.sandboxTestPhone) {
      throw new TRPCError6({ code: "BAD_REQUEST", message: "Defina o telefone de homologa\xE7\xE3o antes de ativar o modo seguro." });
    }
    await db.update(whatsappIntegrations).set({ status: "inativo", isEnabled: 0 }).where(eq8(whatsappIntegrations.studioId, studioId));
    await db.update(whatsappIntegrations).set({ status: "ativo", isEnabled: 1 }).where(eq8(whatsappIntegrations.id, integration.id));
    return { ok: true };
  }),
  /** Remove uma integração */
  deleteIntegration: tenantProcedure.input(z5.object({ id: z5.number() })).mutation(async ({ input, ctx }) => {
    requireIntegrationManager(ctx);
    const db = await getDb();
    if (!db) throw new TRPCError6({ code: "INTERNAL_SERVER_ERROR" });
    const integration = await findScopedIntegration(db, input.id, ctx.studioId);
    await db.delete(whatsappIntegrations).where(eq8(whatsappIntegrations.id, integration.id));
    return { ok: true };
  }),
  /** Testa a conexão com o provedor */
  testConnection: tenantProcedure.input(z5.object({ id: z5.number() })).mutation(async ({ input, ctx }) => {
    requireIntegrationManager(ctx);
    const db = await getDb();
    if (!db) throw new TRPCError6({ code: "INTERNAL_SERVER_ERROR" });
    const integration = await findScopedIntegration(db, input.id, ctx.studioId);
    const provider = await getProviderForIntegration(integration);
    const result = await provider.testConnection();
    await db.update(whatsappIntegrations).set({
      status: result.success ? integration.isEnabled ? "ativo" : "inativo" : "erro",
      lastTestedAt: (/* @__PURE__ */ new Date()).toISOString().slice(0, 19).replace("T", " "),
      lastSuccessAt: result.success ? (/* @__PURE__ */ new Date()).toISOString().slice(0, 19).replace("T", " ") : integration.lastSuccessAt,
      failureCount: result.success ? 0 : integration.failureCount + 1,
      lastErrorMessage: result.error ?? null,
      updatedAt: (/* @__PURE__ */ new Date()).toISOString().slice(0, 19).replace("T", " ")
    }).where(eq8(whatsappIntegrations.id, input.id));
    return result;
  }),
  /** Remove somente a limitação de sandbox depois de validações operacionais. */
  releaseProduction: tenantProcedure.input(z5.object({ id: z5.number(), confirmation: z5.literal("LIBERAR PRODUCAO") })).mutation(async ({ input, ctx }) => {
    requireIntegrationManager(ctx);
    const db = await getDb();
    if (!db) throw new TRPCError6({ code: "INTERNAL_SERVER_ERROR" });
    const integration = await findScopedIntegration(db, input.id, ctx.studioId);
    const studioId = integration.studioId ?? getManagedStudioId(ctx);
    if (!integration.sandboxMode) return { ok: true, alreadyProduction: true };
    assertProductionReleaseReadiness(integration);
    const pendingJob = (await db.select({ id: integrationJobs.id }).from(integrationJobs).where(and8(
      eq8(integrationJobs.studioId, studioId),
      eq8(integrationJobs.integrationId, integration.id),
      inArray3(integrationJobs.status, ["pending", "processing", "retry"])
    )).limit(1))[0];
    if (pendingJob) {
      throw new TRPCError6({ code: "CONFLICT", message: "Aguarde a conclus\xE3o da fila de mensagens antes de liberar a produ\xE7\xE3o." });
    }
    const now = (/* @__PURE__ */ new Date()).toISOString().slice(0, 19).replace("T", " ");
    await db.update(whatsappIntegrations).set({
      sandboxMode: 0,
      sandboxTestPhone: null,
      productionActivatedAt: now,
      productionActivatedByUserId: ctx.user.id,
      updatedAt: now
    }).where(eq8(whatsappIntegrations.id, integration.id));
    return { ok: true, alreadyProduction: false, activatedAt: now };
  }),
  // ── Templates de mensagem ──────────────────────────────────────────────────
  /** Lista todos os templates */
  listTemplates: tenantProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return [];
    if (ctx.studioId != null) await seedDefaultTemplates(ctx.studioId);
    const query = db.select().from(messageTemplates);
    if (ctx.studioId != null) query.where(eq8(messageTemplates.studioId, ctx.studioId));
    return query.orderBy(messageTemplates.trigger);
  }),
  /** Salva ou atualiza um template */
  saveTemplate: tenantProcedure.input(
    z5.object({
      id: z5.number().optional(),
      name: z5.string().min(1),
      trigger: z5.enum([
        "appointment_created",
        "appointment_confirmed",
        "appointment_reminder_24h",
        "appointment_reminder_2h",
        "appointment_reminder_1h",
        "appointment_cancelled",
        "appointment_rescheduled",
        "care_guide",
        "custom"
      ]),
      recipientType: z5.enum(["client", "artist"]),
      message: z5.string().min(1),
      isActive: z5.boolean().default(true)
    })
  ).mutation(async ({ input, ctx }) => {
    requireIntegrationManager(ctx);
    const db = await getDb();
    if (!db) throw new TRPCError6({ code: "INTERNAL_SERVER_ERROR" });
    const studioId = getManagedStudioId(ctx);
    if (input.id) {
      const condition = ctx.studioId == null ? eq8(messageTemplates.id, input.id) : and8(eq8(messageTemplates.id, input.id), eq8(messageTemplates.studioId, studioId));
      await db.update(messageTemplates).set({
        name: input.name,
        trigger: input.trigger,
        recipientType: input.recipientType,
        message: input.message,
        isActive: input.isActive ? 1 : 0,
        updatedAt: (/* @__PURE__ */ new Date()).toISOString().slice(0, 19).replace("T", " ")
      }).where(condition);
    } else {
      await db.insert(messageTemplates).values({
        studioId,
        name: input.name,
        trigger: input.trigger,
        recipientType: input.recipientType,
        message: input.message,
        isActive: input.isActive ? 1 : 0
      });
    }
    return { ok: true };
  }),
  /** Remove um template */
  deleteTemplate: tenantProcedure.input(z5.object({ id: z5.number() })).mutation(async ({ input, ctx }) => {
    requireIntegrationManager(ctx);
    const db = await getDb();
    if (!db) throw new TRPCError6({ code: "INTERNAL_SERVER_ERROR" });
    const studioId = getManagedStudioId(ctx);
    const condition = ctx.studioId == null ? eq8(messageTemplates.id, input.id) : and8(eq8(messageTemplates.id, input.id), eq8(messageTemplates.studioId, studioId));
    await db.delete(messageTemplates).where(condition);
    return { ok: true };
  }),
  // ── Fila / Histórico de mensagens ──────────────────────────────────────────
  /** Lista o histórico de mensagens enviadas */
  listQueue: tenantProcedure.input(
    z5.object({
      limit: z5.number().default(50),
      status: z5.enum(["pendente", "enviada", "erro", "cancelada", "respondida"]).optional()
    })
  ).query(async ({ input, ctx }) => {
    const db = await getDb();
    if (!db) return [];
    const filters = [];
    if (ctx.studioId != null) filters.push(eq8(messageQueue.studioId, ctx.studioId));
    if (input.status) filters.push(eq8(messageQueue.status, input.status));
    return db.select().from(messageQueue).where(filters.length ? and8(...filters) : void 0).orderBy(desc6(messageQueue.createdAt)).limit(Math.min(input.limit, 100));
  }),
  /** Indicadores compactos de lembretes já entregues, sempre isolados por estúdio. */
  getReminderIndicators: tenantProcedure.input(z5.object({ appointmentIds: z5.array(z5.number().int().positive()).max(500) })).query(async ({ input, ctx }) => {
    if (input.appointmentIds.length === 0) return {};
    const db = await getDb();
    if (!db) return {};
    const filters = [
      inArray3(messageQueue.appointmentId, input.appointmentIds),
      eq8(messageQueue.status, "enviada"),
      inArray3(messageQueue.trigger, ["appointment_reminder", "appointment_reminder_1h_client"])
    ];
    if (ctx.studioId != null) filters.push(eq8(messageQueue.studioId, ctx.studioId));
    const rows = await db.select({
      appointmentId: messageQueue.appointmentId,
      trigger: messageQueue.trigger,
      sentAt: messageQueue.sentAt
    }).from(messageQueue).where(and8(...filters)).orderBy(desc6(messageQueue.sentAt));
    const indicators = {};
    for (const row of rows) {
      if (!row.appointmentId) continue;
      const current = indicators[row.appointmentId] ?? { sentAt: row.sentAt, types: [] };
      if (row.trigger && !current.types.includes(row.trigger)) current.types.push(row.trigger);
      indicators[row.appointmentId] = current;
    }
    return indicators;
  }),
  /** Histórico operacional para monitorar fila, tentativas, retorno e auditoria por empresa. */
  listMessageHistory: tenantProcedure.input(z5.object({
    limit: z5.number().min(1).max(100).default(50),
    integrationId: z5.number().optional(),
    status: z5.enum(["pendente", "enviada", "erro", "cancelada", "respondida"]).optional()
  })).query(async ({ input, ctx }) => {
    const db = await getDb();
    if (!db) return [];
    const queueFilters = [];
    const jobFilters = [];
    const eventFilters = [];
    if (ctx.studioId != null) {
      queueFilters.push(eq8(messageQueue.studioId, ctx.studioId));
      jobFilters.push(eq8(integrationJobs.studioId, ctx.studioId));
      eventFilters.push(eq8(integrationEvents.studioId, ctx.studioId));
    }
    if (input.integrationId != null) {
      queueFilters.push(eq8(messageQueue.integrationId, input.integrationId));
      jobFilters.push(eq8(integrationJobs.integrationId, input.integrationId));
      eventFilters.push(eq8(integrationEvents.integrationId, input.integrationId));
    }
    if (input.status) queueFilters.push(eq8(messageQueue.status, input.status));
    const messages = await db.select().from(messageQueue).where(queueFilters.length ? and8(...queueFilters) : void 0).orderBy(desc6(messageQueue.createdAt)).limit(input.limit);
    const jobs = await db.select().from(integrationJobs).where(jobFilters.length ? and8(...jobFilters) : void 0).orderBy(desc6(integrationJobs.createdAt)).limit(300);
    const events = await db.select().from(integrationEvents).where(eventFilters.length ? and8(...eventFilters) : void 0).orderBy(desc6(integrationEvents.receivedAt)).limit(300);
    const jobByQueueId = /* @__PURE__ */ new Map();
    for (const job of jobs) {
      try {
        const payload = JSON.parse(job.payload);
        if (payload.messageQueueId != null && !jobByQueueId.has(payload.messageQueueId)) jobByQueueId.set(payload.messageQueueId, job);
      } catch {
      }
    }
    const eventsByKey = new Map(events.map((event) => [event.idempotencyKey, event]));
    return messages.map((message) => {
      const job = jobByQueueId.get(message.id);
      const event = job ? eventsByKey.get(getOutboundEventIdempotencyKey(job.idempotencyKey)) : void 0;
      return {
        ...message,
        deliveryStatus: job?.status ?? message.status,
        attemptCount: job?.attemptCount ?? 0,
        maxAttempts: job?.maxAttempts ?? 0,
        nextAttemptAt: job?.nextAttemptAt ?? null,
        jobError: job?.lastError ?? null,
        eventStatus: event?.status ?? null,
        eventProcessedAt: event?.processedAt ?? null
      };
    });
  }),
  /** Envia uma mensagem manual */
  sendManual: tenantProcedure.input(
    z5.object({
      recipientPhone: z5.string().min(8),
      recipientName: z5.string().optional(),
      message: z5.string().min(1),
      clientId: z5.number().optional(),
      appointmentId: z5.number().optional()
    })
  ).mutation(async ({ input, ctx }) => {
    requireIntegrationManager(ctx);
    const studioId = getManagedStudioId(ctx);
    const result = await sendAndLog({
      studioId,
      recipientPhone: input.recipientPhone,
      recipientName: input.recipientName,
      recipientType: "client",
      message: input.message,
      trigger: "custom",
      clientId: input.clientId,
      appointmentId: input.appointmentId
    });
    if (!result.success) {
      throw new TRPCError6({
        code: "INTERNAL_SERVER_ERROR",
        message: result.error ?? "Falha ao enviar mensagem"
      });
    }
    return result;
  }),
  /** Cria uma nova tentativa para uma falha terminal sem reenviar automaticamente. */
  retryFailedMessage: tenantProcedure.input(z5.object({ messageId: z5.number(), confirmation: z5.literal("REENVIAR MENSAGEM") })).mutation(async ({ input, ctx }) => {
    requireIntegrationManager(ctx);
    const db = await getDb();
    if (!db) throw new TRPCError6({ code: "INTERNAL_SERVER_ERROR" });
    const sourceCondition = ctx.studioId == null ? eq8(messageQueue.id, input.messageId) : and8(eq8(messageQueue.id, input.messageId), eq8(messageQueue.studioId, ctx.studioId));
    const source = (await db.select().from(messageQueue).where(sourceCondition).limit(1))[0];
    assertRetryableMessage(source);
    const integration = await findScopedIntegration(db, source.integrationId, ctx.studioId);
    if (integration.studioId !== source.studioId || !integration.isEnabled || integration.status !== "ativo") {
      throw new TRPCError6({ code: "FORBIDDEN", message: "A integra\xE7\xE3o original n\xE3o est\xE1 dispon\xEDvel para reenvio nesta empresa." });
    }
    const activeRetry = (await db.select({ id: messageQueue.id }).from(messageQueue).where(and8(
      eq8(messageQueue.studioId, source.studioId),
      eq8(messageQueue.retryOfQueueId, source.id),
      eq8(messageQueue.status, "pendente")
    )).limit(1))[0];
    if (activeRetry) {
      throw new TRPCError6({ code: "CONFLICT", message: "J\xE1 existe uma nova tentativa pendente para esta mensagem." });
    }
    const result = await sendAndLog({
      studioId: source.studioId,
      integrationId: source.integrationId,
      retryOfQueueId: source.id,
      recipientPhone: source.recipientPhone,
      recipientName: source.recipientName ?? void 0,
      recipientType: source.recipientType,
      message: source.message,
      trigger: "retry",
      clientId: source.clientId,
      appointmentId: source.appointmentId ?? void 0
    });
    if (!result.success) throw new TRPCError6({ code: "INTERNAL_SERVER_ERROR", message: result.error ?? "N\xE3o foi poss\xEDvel criar a nova tentativa." });
    return { ...result, sourceMessageId: source.id };
  }),
  /** Preview de um template com variáveis de exemplo */
  previewTemplate: protectedProcedure.input(
    z5.object({
      message: z5.string(),
      vars: z5.record(z5.string(), z5.string()).optional()
    })
  ).query(({ input }) => {
    const defaultVars = {
      nome_cliente: "Jo\xE3o Silva",
      nome_tatuador: "Artista",
      nome_artista: "Artista",
      nome_estudio: "POD Est\xFAdio",
      data: "15/06/2026",
      hora: "14:00",
      servico: "Tatuagem",
      endereco: "Rua Exemplo, 123",
      valor_sinal: "R$ 150,00",
      status_sinal: "Confirmado",
      link_anamnese: "https://exemplo.com/anamnese",
      link_ebook: "https://exemplo.com/cuidados",
      ...input.vars
    };
    return { preview: interpolateTemplate(input.message, defaultVars) };
  })
});

// server/routers.ts
init_appointmentActions();
init_phone();

// server/messaging/appointmentReminderSchedule.ts
init_messagePresentation();
function formatLocalDate(date) {
  const year = String(date.getUTCFullYear());
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
function formatBrazilianAppointmentDate(appointmentDate) {
  const datePart = appointmentDate.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(datePart)) return datePart;
  const [year, month, day] = datePart.split("-");
  return `${day}/${month}/${year}`;
}
function scheduleAutomaticAppointmentReminder(appointmentDate, timing, sendTime) {
  const datePart = appointmentDate.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
    throw new Error("Data do agendamento inv\xE1lida para o lembrete autom\xE1tico.");
  }
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(sendTime)) {
    throw new Error("Hor\xE1rio do lembrete autom\xE1tico inv\xE1lido.");
  }
  const [year, month, day] = datePart.split("-").map(Number);
  const occurrence = new Date(Date.UTC(year, month - 1, day));
  if (timing === "day_before") occurrence.setUTCDate(occurrence.getUTCDate() - 1);
  return `${formatLocalDate(occurrence)} ${sendTime}:00`;
}
function buildAutomaticAppointmentReminderMessage(params) {
  const [, time = ""] = params.appointmentDate.split(" ");
  return [
    `Ol\xE1, ${firstName(params.clientName)}! \u{1F44B}`,
    "",
    `Lembramos que voc\xEA tem um agendamento em ${formatBrazilianAppointmentDate(params.appointmentDate)} \xE0s ${time.slice(0, 5)}.`,
    `Servi\xE7o: ${params.service} com ${params.artist}.`,
    "",
    "Por favor, confirme sua presen\xE7a ou nos avise se precisar remarcar."
  ].join("\n");
}

// server/routers.ts
init_messagePresentation();

// server/anamneseReview.ts
function yesNo(value) {
  return value ? "sim" : "nao";
}
function buildLegacyAnamneseReviewPayload(client, record) {
  const healthNotes = [
    record.hasAllergies ? `Alergias: ${record.allergiesDetails || "informadas anteriormente"}` : "",
    record.usesMedication ? `Medicamentos: ${record.medicationDetails || "informados anteriormente"}` : ""
  ].filter(Boolean).join("\n");
  return {
    client_name: client.name || "",
    client_dob: client.birthDate ? String(client.birthDate) : "",
    client_cpf_rg: client.docNumber || "",
    client_email: client.email || "",
    client_cep: client.cep || "",
    client_street: client.street || "",
    client_number: client.number || "",
    client_neighborhood: client.neighborhood || "",
    client_complement: client.complement || "",
    client_city: client.city || "",
    client_state: client.state || "",
    client_country: client.country || "Brasil",
    client_phone: client.phone || "",
    client_instagram: client.instagram || "",
    health_medical_treatment: yesNo(record.hasDiseases),
    health_medical_treatment_detail: record.diseasesDetails || "",
    health_pregnant: yesNo(record.isPregnant),
    health_keloid: yesNo(record.hasKeloid),
    health_additional_info: healthNotes,
    consent_terms: Boolean(record.acceptedTerms),
    consent_date: record.createdAt ? String(record.createdAt) : ""
  };
}

// server/routers.ts
async function recordAppointmentWhatsappConsent(input) {
  const connection = await getDb();
  if (!connection) return false;
  const client = await getClientById(input.clientId);
  if (!client?.phone || client.studioId !== input.studioId) return false;
  const integration = (await connection.select({ id: whatsappIntegrations.id }).from(whatsappIntegrations).where(and9(
    eq9(whatsappIntegrations.studioId, input.studioId),
    eq9(whatsappIntegrations.status, "ativo"),
    eq9(whatsappIntegrations.isEnabled, 1)
  )).limit(1))[0];
  if (!integration) return false;
  const timestamp2 = (/* @__PURE__ */ new Date()).toISOString().slice(0, 19).replace("T", " ");
  await connection.insert(integrationContacts).values({
    studioId: input.studioId,
    integrationId: integration.id,
    clientId: client.id,
    normalizedPhone: normalizeBrazilianPhone(client.phone),
    hasWhatsappOptIn: 1,
    optInAt: timestamp2,
    optInSource: "agendamento_confirmado",
    optedOutAt: null
  }).onDuplicateKeyUpdate({ set: {
    normalizedPhone: normalizeBrazilianPhone(client.phone),
    hasWhatsappOptIn: 1,
    optInAt: timestamp2,
    optInSource: "agendamento_confirmado",
    optedOutAt: null
  } });
  return true;
}
var appRouter = router({
  system: systemRouter,
  // Quick consume endpoint para registrar insumos rapidamente
  quickConsume: tenantProcedure.input(z6.object({
    inventoryItemId: z6.number(),
    procedureId: z6.number(),
    category: z6.enum(["ink", "cartridge", "disposable", "liquid", "protection", "stencil", "aftercare", "other"]),
    name: z6.string(),
    quantity: z6.string().or(z6.number()),
    estimatedUnitCost: z6.string().or(z6.number())
  })).mutation(async ({ input, ctx }) => {
    try {
      const dbConn = await getDb();
      if (!dbConn) throw new TRPCError7({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indispon\xEDvel." });
      const { procedureConsumables: procedureConsumables2, technicalProcedures: technicalProcedures2 } = await Promise.resolve().then(() => (init_schema(), schema_exports));
      const procedure = (await dbConn.select({ id: technicalProcedures2.id }).from(technicalProcedures2).where(and9(
        eq9(technicalProcedures2.id, input.procedureId),
        eq9(technicalProcedures2.studioId, ctx.studioId)
      )).limit(1))[0];
      if (!procedure) throw new TRPCError7({ code: "NOT_FOUND", message: "Sess\xE3o POD n\xE3o encontrada nesta empresa." });
      const totalCost = (typeof input.quantity === "string" ? parseFloat(input.quantity) : input.quantity) * (typeof input.estimatedUnitCost === "string" ? parseFloat(input.estimatedUnitCost) : input.estimatedUnitCost);
      const quantityDecimal = typeof input.quantity === "string" ? input.quantity : String(input.quantity);
      const unitCostDecimal = typeof input.estimatedUnitCost === "string" ? input.estimatedUnitCost : String(input.estimatedUnitCost);
      const totalCostDecimal = String(totalCost);
      await dbConn.insert(procedureConsumables2).values({
        procedureId: input.procedureId,
        inventoryItemId: input.inventoryItemId,
        category: input.category,
        name: input.name,
        unit: "unit",
        quantity: quantityDecimal,
        estimatedUnitCost: unitCostDecimal,
        estimatedTotalCost: totalCostDecimal
      });
      return { success: true, totalCost };
    } catch (error) {
      if (error instanceof TRPCError7) throw error;
      throw new TRPCError7({ code: "INTERNAL_SERVER_ERROR", message: "Erro ao registrar consumo" });
    }
  }),
  saas: router({
    studios: superAdminProcedure.query(async () => listStudios()),
    metrics: superAdminProcedure.query(async () => {
      const [studios2, users2, invitations] = await Promise.all([
        listStudios(),
        listAllUsers(),
        listStudioInvitations()
      ]);
      return summarizeSaasMetrics({ studios: studios2, users: users2, invitations });
    }),
    listInvitations: superAdminProcedure.query(async () => listStudioInvitations()),
    listStudioInvitations: tenantProcedure.query(async ({ ctx }) => {
      if (!ctx.user) throw new TRPCError7({ code: "UNAUTHORIZED" });
      if (ctx.user.role === "superadmin") return listStudioInvitations();
      return listStudioInvitations(ctx.user.studioId);
    }),
    createInvitation: protectedProcedure.input(z6.object({ studioId: z6.number().int().positive().optional(), email: z6.string().email(), role: z6.enum(["admin", "collaborator"]) })).mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "superadmin" && ctx.user.role !== "admin") throw new TRPCError7({ code: "FORBIDDEN" });
      if (ctx.user.role === "admin" && input.role !== "collaborator") throw new TRPCError7({ code: "FORBIDDEN", message: "Administradores podem convidar apenas colaboradores." });
      const studioId = ctx.user.role === "superadmin" ? input.studioId : ctx.user.studioId;
      if (!studioId) throw new TRPCError7({ code: "BAD_REQUEST", message: "Empresa obrigat\xF3ria." });
      return createStudioInvitation({ studioId, email: input.email, role: input.role, invitedByUserId: ctx.user.id });
    }),
    revokeInvitation: protectedProcedure.input(z6.object({ id: z6.number().int().positive() })).mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "superadmin" && ctx.user.role !== "admin") throw new TRPCError7({ code: "FORBIDDEN" });
      return revokeStudioInvitation(input.id, ctx.user.role === "admin" ? ctx.user.studioId ?? void 0 : void 0);
    }),
    claimInvitation: protectedProcedure.input(z6.object({ token: z6.string().length(64) })).mutation(async ({ ctx, input }) => {
      const result = await claimStudioInvitation(input.token, ctx.user.id);
      if (!result.ok) throw new TRPCError7({ code: result.reason === "email_mismatch" ? "FORBIDDEN" : "BAD_REQUEST", message: "Convite inv\xE1lido, expirado, revogado ou n\xE3o compat\xEDvel com o e-mail autenticado." });
      return result;
    }),
    permissions: protectedProcedure.input(z6.object({ userId: z6.number().int().positive() })).query(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin" && ctx.user.role !== "superadmin") throw new TRPCError7({ code: "FORBIDDEN" });
      const target = await getUserById(input.userId);
      if (!target || ctx.user.role !== "superadmin" && target.studioId !== ctx.user.studioId) throw new TRPCError7({ code: "FORBIDDEN" });
      return listUserPermissions(input.userId, target.studioId);
    }),
    teamAccess: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user.role !== "admin" && ctx.user.role !== "superadmin") throw new TRPCError7({ code: "FORBIDDEN" });
      const allUsers = await listAllUsers();
      const team = ctx.user.role === "superadmin" ? allUsers : allUsers.filter((member) => member.studioId === ctx.user.studioId);
      return Promise.all(team.filter((member) => member.role !== "superadmin").map(async (member) => ({
        id: member.id,
        name: member.name,
        email: member.email,
        role: member.role,
        studioId: member.studioId,
        accessStatus: member.accessStatus,
        accessExpiresAt: member.accessExpiresAt,
        permissions: member.studioId ? await listUserPermissions(member.id, member.studioId) : []
      })));
    }),
    setPermissions: protectedProcedure.input(z6.object({ userId: z6.number().int().positive(), permissions: z6.array(z6.object({ module: z6.enum(SAAS_MODULES), canRead: z6.boolean(), canWrite: z6.boolean() })) })).mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin" && ctx.user.role !== "superadmin") throw new TRPCError7({ code: "FORBIDDEN" });
      const target = await getUserById(input.userId);
      if (!target || !target.studioId || ctx.user.role !== "superadmin" && target.studioId !== ctx.user.studioId) throw new TRPCError7({ code: "FORBIDDEN" });
      await replaceUserPermissions({ userId: input.userId, studioId: target.studioId, permissions: input.permissions });
      return { success: true };
    })
  }),
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    setActiveStudio: protectedProcedure.input(z6.object({ studioId: z6.number().int().positive() })).mutation(async ({ ctx, input }) => {
      if (!ctx.user) throw new TRPCError7({ code: "UNAUTHORIZED" });
      if (ctx.user.role !== "superadmin") {
        if (ctx.user.studioId !== input.studioId) {
          throw new TRPCError7({ code: "FORBIDDEN", message: "Usu\xE1rios SaaS s\xF3 podem usar a empresa vinculada ao pr\xF3prio login." });
        }
        return { studioId: ctx.user.studioId };
      }
      const studio = await getStudioById(input.studioId);
      if (!studio || studio.isActive !== 1) {
        throw new TRPCError7({ code: "NOT_FOUND", message: "Empresa selecionada n\xE3o est\xE1 dispon\xEDvel." });
      }
      await updateUser(ctx.user.id, { studioId: studio.id });
      return { studioId: studio.id };
    }),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true };
    }),
    // Solicitar recuperação de senha por e-mail
    requestPasswordReset: publicProcedure.input(z6.object({ email: z6.string().email("E-mail inv\xE1lido") })).mutation(async ({ input }) => {
      const user = await getUserByEmail(input.email);
      if (!user || !user.passwordHash) {
        return { success: true };
      }
      const crypto2 = await import("crypto");
      const token = crypto2.randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 60 * 60 * 1e3);
      const expiresAtStr = expiresAt.toISOString().slice(0, 19).replace("T", " ");
      const dbConn = await getDb();
      const { passwordResetTokens: passwordResetTokens2 } = await Promise.resolve().then(() => (init_schema(), schema_exports));
      await dbConn.insert(passwordResetTokens2).values({
        userId: user.id,
        token,
        expiresAt: expiresAtStr
      });
      const resetLink = `${process.env.APP_BASE_URL || "https://tatuei.com"}/reset-password?token=${token}`;
      const { notifyOwner: notifyOwner2 } = await Promise.resolve().then(() => (init_notification(), notification_exports));
      await notifyOwner2({
        title: `Recupera\xE7\xE3o de senha solicitada`,
        content: `O usu\xE1rio **${user.name || user.email}** (${user.email}) solicitou recupera\xE7\xE3o de senha.

Link de redefini\xE7\xE3o (v\xE1lido por 1 hora):
${resetLink}

Se n\xE3o foi voc\xEA, ignore esta mensagem.`
      });
      return { success: true };
    }),
    // Redefinir senha via token
    resetPassword: publicProcedure.input(z6.object({
      token: z6.string().min(1),
      newPassword: z6.string().min(6, "Senha deve ter no m\xEDnimo 6 caracteres")
    })).mutation(async ({ input }) => {
      const dbConn = await getDb();
      const { passwordResetTokens: passwordResetTokens2 } = await Promise.resolve().then(() => (init_schema(), schema_exports));
      const { eq: eq12, and: and12, isNull: isNull4 } = await import("drizzle-orm");
      const [resetToken] = await dbConn.select().from(passwordResetTokens2).where(and12(
        eq12(passwordResetTokens2.token, input.token),
        isNull4(passwordResetTokens2.usedAt)
      )).limit(1);
      if (!resetToken) {
        throw new TRPCError7({ code: "BAD_REQUEST", message: "Token inv\xE1lido ou j\xE1 utilizado" });
      }
      if (new Date(resetToken.expiresAt) < /* @__PURE__ */ new Date()) {
        throw new TRPCError7({ code: "BAD_REQUEST", message: "Token expirado. Solicite um novo link." });
      }
      const { hashPassword: hashPassword2 } = await Promise.resolve().then(() => (init_localAuth(), localAuth_exports));
      const passwordHash = await hashPassword2(input.newPassword);
      await updateUser(resetToken.userId, { passwordHash });
      const usedAtStr = (/* @__PURE__ */ new Date()).toISOString().slice(0, 19).replace("T", " ");
      await dbConn.update(passwordResetTokens2).set({ usedAt: usedAtStr }).where(eq12(passwordResetTokens2.id, resetToken.id));
      return { success: true };
    }),
    // Verificar se token de reset é válido
    verifyResetToken: publicProcedure.input(z6.object({ token: z6.string() })).query(async ({ input }) => {
      const dbConn = await getDb();
      const { passwordResetTokens: passwordResetTokens2 } = await Promise.resolve().then(() => (init_schema(), schema_exports));
      const { eq: eq12, and: and12, isNull: isNull4 } = await import("drizzle-orm");
      const [resetToken] = await dbConn.select().from(passwordResetTokens2).where(and12(
        eq12(passwordResetTokens2.token, input.token),
        isNull4(passwordResetTokens2.usedAt)
      )).limit(1);
      if (!resetToken || new Date(resetToken.expiresAt) < /* @__PURE__ */ new Date()) {
        return { valid: false };
      }
      return { valid: true };
    })
  }),
  // ============ CLIENTS ROUTER ============
  clients: router({
    list: artistProcedure.input(z6.object({ studioId: z6.number().int().positive().optional() }).optional()).query(async ({ ctx, input }) => {
      const studioId = ctx.user.role === "superadmin" ? input?.studioId ?? ctx.user.studioId : ctx.user.studioId;
      if (!studioId) {
        throw new TRPCError7({ code: "FORBIDDEN", message: "Selecione a empresa para consultar os clientes." });
      }
      return await listClients(studioId, ctx.artistId);
    }),
    search: artistProcedure.input(z6.object({ term: z6.string(), studioId: z6.number().int().positive().optional() })).query(async ({ ctx, input }) => {
      const studioId = ctx.user.role === "superadmin" ? input.studioId ?? ctx.user.studioId : ctx.user.studioId;
      if (!studioId) {
        throw new TRPCError7({ code: "FORBIDDEN", message: "Selecione a empresa para pesquisar clientes." });
      }
      return await searchClients(input.term, void 0, void 0, studioId);
    }),
    getById: protectedProcedure.input(z6.object({ id: z6.number() })).query(async ({ input }) => {
      return await getClientById(input.id);
    }),
    create: protectedProcedure.input(z6.object({
      name: z6.string().min(1),
      email: z6.string().email().optional().or(z6.literal("")),
      phone: z6.string().optional(),
      birthDate: z6.string().optional(),
      instagram: z6.string().optional(),
      gender: z6.enum(["Homem", "Mulher", "Outros"]).optional(),
      docType: z6.enum(["cpf", "passport"]).optional(),
      docNumber: z6.string().optional(),
      cep: z6.string().optional(),
      street: z6.string().optional(),
      number: z6.string().optional(),
      complement: z6.string().optional(),
      reference: z6.string().optional(),
      neighborhood: z6.string().optional(),
      city: z6.string().optional(),
      state: z6.string().optional(),
      country: z6.string().optional(),
      studioId: z6.number().int().positive().optional()
    })).mutation(async ({ ctx, input }) => {
      try {
        const studioId = ctx.user.role === "superadmin" ? input.studioId ?? ctx.user.studioId : ctx.user.studioId;
        if (!studioId) {
          throw new TRPCError7({ code: "FORBIDDEN", message: "Selecione a empresa antes de cadastrar o cliente." });
        }
        const clientData = {
          studioId,
          artistId: ctx.user.artistId || null,
          // Vincular ao artista se for colaborador
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
          country: input.country || "Brasil"
        };
        console.log("[clients.create] Creating client with data:", clientData);
        const result = await createClient(clientData);
        console.log("[clients.create] Client created successfully:", result);
        try {
          await createAuditLog({
            userId: ctx.user.id,
            userName: ctx.user.name || "Usu\xE1rio sem nome",
            action: "create",
            entity: "client",
            entityName: input.name,
            details: clientData,
            ipAddress: ctx.req.ip || ctx.req.socket?.remoteAddress,
            userAgent: ctx.req.headers?.["user-agent"]
          });
        } catch (auditError) {
          console.error("[clients.create] Audit log failed (non-critical):", auditError);
        }
        syncClientToSheets({
          id: result.id,
          name: result.name,
          phone: result.phone,
          email: result.email,
          birthDate: result.birthDate,
          instagram: result.instagram,
          city: result.city,
          state: result.state,
          country: result.country
        });
        return result;
      } catch (error) {
        console.error("[clients.create] Error creating client:", error);
        throw error;
      }
    }),
    update: protectedProcedure.input(z6.object({
      id: z6.number(),
      data: z6.object({
        name: z6.string().min(1).optional(),
        email: z6.string().email().optional().or(z6.literal("")),
        phone: z6.string().optional(),
        birthDate: z6.string().optional(),
        instagram: z6.string().optional(),
        cep: z6.string().optional(),
        street: z6.string().optional(),
        neighborhood: z6.string().optional(),
        city: z6.string().optional(),
        state: z6.string().optional(),
        country: z6.string().optional(),
        docType: z6.enum(["cpf", "passport"]).optional(),
        docNumber: z6.string().optional()
      })
    })).mutation(async ({ ctx, input }) => {
      const clientBefore = await getClientById(input.id);
      const result = await updateClient(input.id, input.data);
      const clientAfter = await getClientById(input.id);
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
          country: clientAfter.country
        });
      }
      await createAuditLog({
        userId: ctx.user.id,
        userName: ctx.user.name || "Usu\xE1rio sem nome",
        action: "update",
        entity: "client",
        entityId: input.id,
        entityName: clientAfter?.name || clientBefore?.name || "Cliente",
        details: {
          before: clientBefore,
          after: clientAfter,
          changes: input.data
        },
        ipAddress: ctx.req.ip || ctx.req.socket?.remoteAddress,
        userAgent: ctx.req.headers?.["user-agent"]
      });
      return result;
    }),
    delete: protectedProcedure.input(z6.object({ id: z6.number() })).mutation(async ({ ctx, input }) => {
      const clientBefore = await getClientById(input.id);
      const result = await deleteClient(input.id);
      await createAuditLog({
        userId: ctx.user.id,
        userName: ctx.user.name || "Usu\xE1rio sem nome",
        action: "delete",
        entity: "client",
        entityId: input.id,
        entityName: clientBefore?.name || "Cliente",
        details: {
          deletedClient: clientBefore
        },
        ipAddress: ctx.req.ip || ctx.req.socket?.remoteAddress,
        userAgent: ctx.req.headers?.["user-agent"]
      });
      return result;
    })
  }),
  // ============ APPOINTMENTS ROUTER ============
  appointments: router({
    list: tenantProcedure.query(async ({ ctx }) => {
      return await listAppointments(ctx.studioId, ctx.artistId);
    }),
    getByClientId: tenantProcedure.input(z6.object({ clientId: z6.number() })).query(async ({ ctx, input }) => {
      return await getAppointmentsByClientId(input.clientId, ctx.studioId, ctx.artistId);
    }),
    getById: tenantProcedure.input(z6.object({ id: z6.number() })).query(async ({ ctx, input }) => {
      if (!input.id || input.id <= 0) return null;
      const appointment = await getAppointmentById(input.id);
      if (!appointment) return null;
      if (ctx.studioId != null && appointment.studioId !== ctx.studioId) return null;
      if (ctx.artistId != null && appointment.artistId !== ctx.artistId) return null;
      return appointment;
    }),
    create: protectedProcedure.input(z6.object({
      clientId: z6.number(),
      studioId: z6.number().int().positive().optional(),
      calendarId: z6.number().optional(),
      date: z6.string(),
      // YYYY-MM-DD HH:mm:ss (local, sem conversão)
      duration: z6.number().min(1),
      service: z6.string().min(1),
      artist: z6.string().min(1),
      artistId: z6.number().optional(),
      // FK opcional para artists.id
      status: z6.enum(["agendado", "confirmado", "concluido", "cancelado", "reagendado"]).optional(),
      notes: z6.string().optional(),
      referenceImageUrl: z6.string().optional(),
      referenceImageKey: z6.string().optional(),
      depositPaid: z6.boolean().optional(),
      depositAmount: z6.number().min(0).optional(),
      totalAmount: z6.number().min(0).optional(),
      depositPaymentMethod: z6.enum(["pix", "dinheiro", "credito", "debito", "transferencia"]).optional(),
      signalStatus: z6.enum(["aguardando_sinal", "sinal_confirmado"]).optional(),
      paymentStatus: z6.enum(["pendente", "pago"]).optional(),
      paymentMethod: z6.enum(["dinheiro", "pix", "cartao_credito", "cartao_debito", "transferencia", "outro"]).optional(),
      procedureType: z6.enum(["tatuagem", "piercing", "micropigmentacao", "laser", "consulta", "retoque", "outro"]).optional(),
      procedureTypeOther: z6.string().optional(),
      autoReminder: z6.object({
        timing: z6.enum(["same_day", "day_before"]),
        sendTime: z6.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Hor\xE1rio de lembrete inv\xE1lido.")
      }).optional(),
      recordWhatsAppConsent: z6.boolean().optional()
    })).mutation(async ({ ctx, input }) => {
      const studioId = ctx.user.role === "superadmin" ? input.studioId ?? ctx.user.studioId : ctx.user.studioId;
      if (!studioId) {
        throw new TRPCError7({ code: "FORBIDDEN", message: "Selecione a empresa antes de criar o agendamento." });
      }
      const client = await getClientById(input.clientId);
      if (!client || client.studioId !== studioId) {
        throw new TRPCError7({ code: "FORBIDDEN", message: "O cliente selecionado n\xE3o pertence \xE0 empresa escolhida." });
      }
      if (input.artistId) {
        const selectedArtist = await getArtistById(input.artistId, studioId);
        if (!selectedArtist) {
          throw new TRPCError7({ code: "FORBIDDEN", message: "O artista selecionado n\xE3o pertence \xE0 empresa escolhida." });
        }
      }
      const settings = await getStudioSettings();
      if (settings?.businessHours) {
        try {
          const businessHours = JSON.parse(settings.businessHours);
          const appointmentDate = new Date(input.date);
          const dayNames = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
          const dayName = dayNames[appointmentDate.getDay()];
          const dayConfig = businessHours[dayName];
          if (dayConfig?.closed) {
            throw new TRPCError7({ code: "BAD_REQUEST", message: `O est\xFAdio est\xE1 fechado neste dia (${dayName}).` });
          }
          if (dayConfig?.open && dayConfig?.close) {
            const [openH, openM] = dayConfig.open.split(":").map(Number);
            const [closeH, closeM] = dayConfig.close.split(":").map(Number);
            const aptHour = appointmentDate.getHours();
            const aptMin = appointmentDate.getMinutes();
            const aptMinutes = aptHour * 60 + aptMin;
            const openMinutes = openH * 60 + openM;
            const closeMinutes = closeH * 60 + closeM;
            const endMinutes = aptMinutes + input.duration;
            if (aptMinutes < openMinutes || endMinutes > closeMinutes) {
              throw new TRPCError7({ code: "BAD_REQUEST", message: `Agendamento fora do hor\xE1rio comercial (${dayConfig.open} - ${dayConfig.close}).` });
            }
          }
        } catch (e) {
          if (e instanceof TRPCError7) throw e;
        }
      }
      const conflictCheck = await checkAppointmentConflicts(input.artist, input.date, input.duration);
      if (conflictCheck.hasConflict) {
        throw new TRPCError7({
          code: "CONFLICT",
          message: `Conflito de hor\xE1rio: o artista ${input.artist} j\xE1 possui ${conflictCheck.conflicts.length} agendamento(s) neste hor\xE1rio.`
        });
      }
      let resolvedArtistId = input.artistId ?? null;
      if (!resolvedArtistId && input.artist) {
        try {
          const d = await getDb();
          if (d) {
            const { artists: artistsTable } = await Promise.resolve().then(() => (init_schema(), schema_exports));
            const { eq: eq12, and: and12 } = await import("drizzle-orm");
            const found = await d.select({ id: artistsTable.id }).from(artistsTable).where(and12(eq12(artistsTable.name, input.artist), eq12(artistsTable.studioId, studioId))).limit(1);
            if (found[0]) resolvedArtistId = found[0].id;
          }
        } catch {
        }
      }
      const { autoReminder, recordWhatsAppConsent, ...appointmentInput } = input;
      const appointmentData = {
        ...appointmentInput,
        artistId: resolvedArtistId,
        studioId,
        status: input.status || "agendado",
        notes: input.notes || null,
        depositPaid: input.depositPaid ? 1 : 0,
        depositAmount: input.depositAmount ?? null,
        totalAmount: input.totalAmount ?? null,
        signalStatus: input.signalStatus || "aguardando_sinal",
        paymentStatus: input.paymentStatus || "pendente",
        paymentMethod: input.paymentMethod ?? null
      };
      const result = await createAppointment(appointmentData);
      const automaticReminder = {
        scheduled: false,
        scheduledAt: null,
        reason: null
      };
      if (recordWhatsAppConsent) {
        await recordAppointmentWhatsappConsent({ studioId, clientId: client.id });
      }
      if (autoReminder) {
        if (!client?.phone) {
          automaticReminder.reason = "client_without_phone";
        } else {
          const scheduledAt = scheduleAutomaticAppointmentReminder(input.date, autoReminder.timing, autoReminder.sendTime);
          await createAppointmentReminder({
            appointmentId: result.id,
            scheduledAt,
            message: buildAutomaticAppointmentReminderMessage({
              clientName: client.name ?? "cliente",
              appointmentDate: input.date,
              service: input.service,
              artist: input.artist
            })
          });
          automaticReminder.scheduled = true;
          automaticReminder.scheduledAt = scheduledAt;
        }
      }
      if (input.depositPaid && input.depositAmount && input.depositAmount > 0) {
        await createTransaction({
          studioId,
          clientId: input.clientId,
          appointmentId: result.id,
          type: "entrada",
          category: "Sinal de Agendamento",
          description: `Sinal pago - ${input.service} com ${input.artist}`,
          amount: input.depositAmount,
          paymentMethod: input.depositPaymentMethod || "pix",
          date: (/* @__PURE__ */ new Date()).toISOString().slice(0, 10)
        });
      }
      await createAuditLog({
        userId: ctx.user.id,
        userName: ctx.user.name || "Usu\xE1rio sem nome",
        action: "create",
        entity: "appointment",
        entityName: `${client?.name || "Cliente"} - ${input.service}`,
        details: appointmentData,
        ipAddress: ctx.req.ip || ctx.req.socket?.remoteAddress,
        userAgent: ctx.req.headers?.["user-agent"]
      });
      try {
        const { dispatchTemplateMessage: dispatchTemplateMessage2 } = await Promise.resolve().then(() => (init_service(), service_exports));
        if (!autoReminder && client?.phone) {
          await dispatchTemplateMessage2({
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
              nome_estudio: (await getStudioById(studioId))?.name ?? "nosso est\xFAdio",
              endereco: ""
            }
          });
        }
      } catch (_msgErr) {
      }
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
        notes: input.notes
      });
      return { ...result, automaticReminder };
    }),
    update: protectedProcedure.input(z6.object({
      id: z6.number(),
      data: z6.object({
        calendarId: z6.number().optional(),
        date: z6.string().optional(),
        // YYYY-MM-DD HH:mm:ss (local, sem conversão)
        duration: z6.number().min(1).optional(),
        service: z6.string().min(1).optional(),
        artist: z6.string().min(1).optional(),
        artistId: z6.number().optional(),
        // FK opcional para artists.id
        status: z6.enum(["agendado", "confirmado", "concluido", "cancelado", "reagendado"]).optional(),
        confirmationStatus: z6.enum(["pendente", "confirmado", "nao_confirmado", "atraso", "chegada_antecipada"]).optional(),
        notes: z6.string().optional(),
        referenceImageUrl: z6.string().optional(),
        referenceImageKey: z6.string().optional(),
        depositPaid: z6.boolean().optional(),
        depositAmount: z6.number().min(0).optional(),
        totalAmount: z6.number().min(0).optional(),
        depositPaymentMethod: z6.enum(["pix", "dinheiro", "credito", "debito", "transferencia"]).optional(),
        signalStatus: z6.enum(["aguardando_sinal", "sinal_confirmado"]).optional(),
        paymentStatus: z6.enum(["pendente", "pago"]).optional(),
        paymentMethod: z6.enum(["dinheiro", "pix", "cartao_credito", "cartao_debito", "transferencia", "outro"]).optional(),
        procedureType: z6.enum(["tatuagem", "piercing", "micropigmentacao", "laser", "consulta", "retoque", "outro"]).optional(),
        procedureTypeOther: z6.string().optional(),
        recordWhatsAppConsent: z6.boolean().optional()
      })
    })).mutation(async ({ ctx, input }) => {
      const appointmentBefore = await getAppointmentById(input.id);
      const activeStudioId = ctx.user.studioId;
      if (!appointmentBefore) throw new TRPCError7({ code: "NOT_FOUND", message: "Agendamento n\xE3o encontrado." });
      if (!activeStudioId || appointmentBefore.studioId !== activeStudioId) {
        throw new TRPCError7({ code: "FORBIDDEN", message: "O agendamento n\xE3o pertence \xE0 empresa ativa." });
      }
      const { depositPaid, recordWhatsAppConsent, ...restData } = input.data;
      let resolvedArtistId = restData.artistId;
      if (!resolvedArtistId && restData.artist && appointmentBefore?.studioId) {
        const resolvedArtist = (await listArtists(appointmentBefore.studioId)).find((candidate) => candidate.name === restData.artist);
        resolvedArtistId = resolvedArtist?.id;
      }
      const updateData = {
        ...restData,
        ...resolvedArtistId ? { artistId: resolvedArtistId } : {},
        ...depositPaid !== void 0 ? { depositPaid: depositPaid ? 1 : 0 } : {}
      };
      const result = await updateAppointment(input.id, updateData);
      const wasNotPaid = !appointmentBefore?.depositPaid || appointmentBefore.depositPaid === 0;
      const isNowPaid = input.data.depositPaid === true;
      const depositValue = input.data.depositAmount ?? appointmentBefore?.depositAmount ?? 0;
      if (wasNotPaid && isNowPaid && depositValue > 0) {
        await createTransaction({
          studioId: appointmentBefore.studioId,
          clientId: appointmentBefore?.clientId ?? null,
          appointmentId: input.id,
          type: "entrada",
          category: "Sinal de Agendamento",
          description: `Sinal pago - ${appointmentBefore?.service || "Servi\xE7o"} com ${appointmentBefore?.artist || "Artista"}`,
          amount: depositValue,
          paymentMethod: input.data.depositPaymentMethod || "pix",
          date: (/* @__PURE__ */ new Date()).toISOString().slice(0, 10)
        });
      }
      const appointmentAfter = await getAppointmentById(input.id);
      const client = appointmentAfter?.clientId ? await getClientById(appointmentAfter.clientId) : null;
      if (recordWhatsAppConsent && appointmentAfter?.clientId) {
        await recordAppointmentWhatsappConsent({ studioId: appointmentBefore.studioId, clientId: appointmentAfter.clientId });
      }
      await createAuditLog({
        userId: ctx.user.id,
        userName: ctx.user.name || "Usu\xE1rio sem nome",
        action: "update",
        entity: "appointment",
        entityId: input.id,
        entityName: `${client?.name || "Cliente"} - ${appointmentAfter?.service || appointmentBefore?.service || "Agendamento"}`,
        details: {
          before: appointmentBefore,
          after: appointmentAfter,
          changes: input.data
        },
        ipAddress: ctx.req.ip || ctx.req.socket?.remoteAddress,
        userAgent: ctx.req.headers?.["user-agent"]
      });
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
          depositAmount: appointmentAfter.depositAmount ? Number(appointmentAfter.depositAmount) : void 0,
          totalPrice: appointmentAfter.totalAmount ? Number(appointmentAfter.totalAmount) : void 0,
          notes: appointmentAfter.notes
        });
      }
      return result;
    }),
    delete: protectedProcedure.input(z6.object({ id: z6.number() })).mutation(async ({ ctx, input }) => {
      await deleteAppointment(input.id);
      await createAuditLog({
        userId: ctx.user.id,
        userName: ctx.user.name || "Unknown",
        action: "delete",
        entity: "appointment",
        entityId: input.id
      });
      return { success: true };
    }),
    checkConflicts: protectedProcedure.input(z6.object({
      artist: z6.string(),
      date: z6.string(),
      duration: z6.number(),
      excludeId: z6.number().optional()
      // Para excluir o próprio agendamento ao editar
    })).query(async ({ input }) => {
      return await checkAppointmentConflicts(input.artist, input.date, input.duration, input.excludeId);
    }),
    uploadImage: protectedProcedure.input(z6.object({
      fileName: z6.string(),
      fileData: z6.string(),
      // base64
      contentType: z6.string()
    })).mutation(async ({ input, ctx }) => {
      const base64Data = input.fileData.split(",")[1] || input.fileData;
      const buffer = Buffer.from(base64Data, "base64");
      const timestamp2 = Date.now();
      const randomSuffix2 = Math.random().toString(36).substring(7);
      const fileExtension = input.fileName.split(".").pop();
      const fileKey = `appointments/${ctx.user.id}/${timestamp2}-${randomSuffix2}.${fileExtension}`;
      const { storagePut: storagePut2 } = await Promise.resolve().then(() => (init_storage(), storage_exports));
      const { url } = await storagePut2(fileKey, buffer, input.contentType);
      return { url, key: fileKey };
    }),
    // Gera o link WhatsApp com token assinado pelo backend
    generateWhatsAppLink: protectedProcedure.input(z6.object({ id: z6.number() })).query(async ({ input }) => {
      const { createHash: createHash3 } = await import("crypto");
      const appointment = await getAppointmentById(input.id);
      if (!appointment) throw new TRPCError7({ code: "NOT_FOUND", message: "Agendamento n\xE3o encontrado" });
      const secret = process.env.JWT_SECRET || "secret";
      const token = createHash3("sha256").update(`${input.id}:${appointment.date}:${secret}`).digest("hex").slice(0, 16);
      return { token, date: appointment.date };
    }),
    // Rota pública para confirmação do cliente via link WhatsApp
    confirm: publicProcedure.input(z6.object({
      id: z6.number(),
      token: z6.string(),
      status: z6.enum(["confirmado", "nao_confirmado", "atraso", "chegada_antecipada"])
    })).mutation(async ({ input }) => {
      const { createHash: createHash3 } = await import("crypto");
      const appointment = await getAppointmentById(input.id);
      if (!appointment) throw new TRPCError7({ code: "NOT_FOUND", message: "Agendamento n\xE3o encontrado" });
      const secret = process.env.JWT_SECRET || "secret";
      const expected = createHash3("sha256").update(`${input.id}:${appointment.date}:${secret}`).digest("hex").slice(0, 16);
      if (input.token !== expected) throw new TRPCError7({ code: "UNAUTHORIZED", message: "Link inv\xE1lido" });
      await updateAppointment(input.id, { confirmationStatus: input.status });
      return { success: true, status: input.status };
    }),
    /** Consome um link aleatório, expirável e de uso único enviado ao cliente. */
    consumeActionLink: publicProcedure.input(z6.object({ token: z6.string().min(32).max(128) })).mutation(async ({ input }) => {
      try {
        const result = await consumeAppointmentActionLink(input.token);
        return { success: true, action: result.action, appointmentId: result.appointmentId };
      } catch (error) {
        throw new TRPCError7({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "N\xE3o foi poss\xEDvel registrar esta a\xE7\xE3o." });
      }
    }),
    /** Alertas de ação do cliente, sempre limitados ao estúdio da sessão. */
    listActionAlerts: tenantProcedure.input(z6.object({ limit: z6.number().int().min(1).max(20).optional() }).optional()).query(async ({ ctx, input }) => {
      if (ctx.studioId == null) throw new TRPCError7({ code: "FORBIDDEN", message: "Empresa n\xE3o selecionada." });
      return listAppointmentActionAlerts(ctx.studioId, input?.limit ?? 8);
    }),
    markActionAlertViewed: tenantProcedure.input(z6.object({ alertId: z6.number().int().positive() })).mutation(async ({ ctx, input }) => {
      if (ctx.studioId == null) throw new TRPCError7({ code: "FORBIDDEN", message: "Empresa n\xE3o selecionada." });
      await markAppointmentActionAlertViewed(ctx.studioId, input.alertId);
      return { success: true };
    }),
    // ── Lembretes individuais por agendamento ──────────────────────────────────
    reminders: router({
      list: protectedProcedure.input(z6.object({ appointmentId: z6.number() })).query(async ({ input }) => {
        return await listRemindersByAppointment(input.appointmentId);
      }),
      create: protectedProcedure.input(z6.object({
        appointmentId: z6.number(),
        scheduledAt: z6.string(),
        // "YYYY-MM-DD HH:MM:SS"
        message: z6.string().min(1)
      })).mutation(async ({ input }) => {
        return await createAppointmentReminder({
          appointmentId: input.appointmentId,
          scheduledAt: input.scheduledAt,
          message: input.message
        });
      }),
      update: protectedProcedure.input(z6.object({
        id: z6.number(),
        scheduledAt: z6.string().optional(),
        message: z6.string().optional(),
        status: z6.enum(["pending", "sent", "failed"]).optional()
      })).mutation(async ({ input }) => {
        const { id, ...data } = input;
        return await updateAppointmentReminder(id, data);
      }),
      delete: protectedProcedure.input(z6.object({ id: z6.number() })).mutation(async ({ input }) => {
        await deleteAppointmentReminder(input.id);
        return { success: true };
      })
    }),
    // ── Links de exportação para calendários e WhatsApp ──────────────────────
    getCalendarLinks: protectedProcedure.input(z6.object({ id: z6.number() })).query(async ({ input }) => {
      const appointment = await getAppointmentById(input.id);
      if (!appointment) throw new TRPCError7({ code: "NOT_FOUND", message: "Agendamento n\xE3o encontrado" });
      const client = await getClientById(appointment.clientId);
      if (!client) throw new TRPCError7({ code: "NOT_FOUND", message: "Cliente n\xE3o encontrado" });
      const studioSettings2 = await getStudioSettings();
      const anamnesisRecords2 = await getAnamnesisByClientId(appointment.clientId);
      const latestAnamnesis = anamnesisRecords2.length > 0 ? anamnesisRecords2[0] : null;
      const baseUrl = process.env.APP_BASE_URL || (process.env.NODE_ENV === "production" ? `https://${process.env.VITE_APP_ID ? "tatuei.com" : "tatuei.manus.space"}` : "http://localhost:3000");
      const { createHash: createHash3 } = await import("crypto");
      const secret = process.env.JWT_SECRET || "secret";
      const token = createHash3("sha256").update(`${appointment.id}:${appointment.date}:${secret}`).digest("hex").slice(0, 16);
      const confirmationLink = `${baseUrl}/confirmar?id=${appointment.id}&token=${token}&status=confirmado`;
      const anamnesisLink = latestAnamnesis ? `${baseUrl}/anamnese/view/${latestAnamnesis.id}` : null;
      const { generateGoogleCalendarUrl: generateGoogleCalendarUrl2 } = await Promise.resolve().then(() => (init_icsGenerator(), icsGenerator_exports));
      const googleCalendarUrl = generateGoogleCalendarUrl2({
        appointment,
        client,
        studio: studioSettings2 ? {
          name: studioSettings2.studioName,
          address: studioSettings2.address,
          phone: studioSettings2.phone
        } : null,
        anamnesis: latestAnamnesis,
        anamnesisLink,
        confirmationLink,
        baseUrl
      });
      const dateFormatted = (/* @__PURE__ */ new Date(appointment.date.replace(" ", "T") + "-03:00")).toLocaleString("pt-BR", {
        weekday: "long",
        day: "2-digit",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "America/Sao_Paulo"
      });
      const studioName = studioSettings2?.studioName || "Est\xFAdio";
      const whatsappMessage = encodeURIComponent(
        `Ol\xE1 ${client.name}! \u{1F3A8}

Seu agendamento est\xE1 confirmado:
\u2022 Servi\xE7o: ${appointment.service}
\u2022 Artista: ${appointment.artist}
\u2022 Data: ${dateFormatted}
\u2022 Dura\xE7\xE3o: ${appointment.duration} minutos
` + (studioSettings2?.address ? `\u2022 Local: ${studioSettings2.address}
` : "") + `
Confirme sua presen\xE7a clicando no link:
${confirmationLink}

Qualquer d\xFAvida, estamos \xE0 disposi\xE7\xE3o! \u{1F64F}
${studioName}`
      );
      const whatsappPhone = client.phone?.replace(/\D/g, "") || "";
      const whatsappLink = whatsappPhone ? `https://wa.me/55${whatsappPhone}?text=${whatsappMessage}` : `https://wa.me/?text=${whatsappMessage}`;
      return {
        icsUrl: `/api/appointments/${appointment.id}/ics`,
        googleCalendarUrl,
        confirmationLink,
        anamnesisLink,
        whatsappLink,
        hasAnamnesis: !!latestAnamnesis,
        clientPhone: client.phone
      };
    })
  }),
  // ============ ANAMNESIS ROUTER ============
  anamnesis: router({
    getAll: protectedProcedure.query(async () => {
      return await getAllAnamnesis();
    }),
    getByClientId: protectedProcedure.input(z6.object({ clientId: z6.number() })).query(async ({ input }) => {
      return await getAnamnesisByClientId(input.clientId);
    }),
    getById: protectedProcedure.input(z6.object({ id: z6.number() })).query(async ({ input }) => {
      return await getAnamnesisById(input.id);
    }),
    exportPdf: protectedProcedure.input(z6.object({ id: z6.number() })).mutation(async ({ input }) => {
      const anamnese = await getAnamnesisById(input.id);
      if (!anamnese) {
        throw new Error("Anamnese n\xE3o encontrada");
      }
      return anamnese;
    }),
    create: protectedProcedure.input(z6.object({
      clientId: z6.number(),
      appointmentId: z6.number().optional(),
      hasAllergies: z6.boolean(),
      allergiesDetails: z6.string().optional(),
      hasDiseases: z6.boolean(),
      diseasesDetails: z6.string().optional(),
      usesMedication: z6.boolean(),
      medicationDetails: z6.string().optional(),
      isPregnant: z6.boolean(),
      hasKeloid: z6.boolean(),
      acceptedTerms: z6.boolean(),
      signatureUrl: z6.string().optional(),
      pdfUrl: z6.string().optional()
    })).mutation(async ({ input }) => {
      const { calculateRiskLevel: calculateRiskLevel2 } = await Promise.resolve().then(() => (init_riskAssessment(), riskAssessment_exports));
      const riskAssessment = calculateRiskLevel2({
        hasAllergies: input.hasAllergies,
        allergiesDetails: input.allergiesDetails,
        hasDiseases: input.hasDiseases,
        diseasesDetails: input.diseasesDetails,
        usesMedication: input.usesMedication,
        medicationDetails: input.medicationDetails,
        isPregnant: input.isPregnant,
        hasKeloid: input.hasKeloid
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
        riskFactors: JSON.stringify(riskAssessment.riskFactors)
      };
      return await createAnamnesis(anamnesisData);
    })
  }),
  // ============ TRANSACTIONS ROUTER ============
  transactions: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return await listTransactions(ctx.user.studioId ?? null);
    }),
    getByClientId: protectedProcedure.input(z6.object({ clientId: z6.number() })).query(async ({ input }) => {
      return await getTransactionsByClientId(input.clientId);
    }),
    getByDateRange: tenantProcedure.input(z6.object({
      startDate: z6.string(),
      endDate: z6.string()
    })).query(async ({ ctx, input }) => {
      if (ctx.user.role === "collaborator" && (!ctx.studioId || !await hasModulePermission({ userId: ctx.user.id, studioId: ctx.studioId, module: "finance" }))) {
        throw new TRPCError7({ code: "FORBIDDEN", message: "Sem permiss\xE3o para consultar dados financeiros." });
      }
      return await getTransactionsByDateRange(input.startDate, input.endDate, ctx.studioId);
    }),
    create: protectedProcedure.input(z6.object({
      clientId: z6.number().optional(),
      appointmentId: z6.number().optional(),
      type: z6.enum(["entrada", "saida"]),
      category: z6.string().min(1),
      description: z6.string().optional(),
      amount: z6.number().min(1),
      paymentMethod: z6.enum(["dinheiro", "pix", "credito", "debito", "transferencia"]),
      date: z6.string()
    })).mutation(async ({ ctx, input }) => {
      let studioId = ctx.user.studioId;
      if (!studioId) {
        if (ctx.user.role === "superadmin") {
          const firstStudio = await getFirstStudio();
          if (!firstStudio) {
            throw new TRPCError7({ code: "PRECONDITION_FAILED", message: "Nenhum est\xFAdio cadastrado no sistema." });
          }
          studioId = firstStudio.id;
        } else {
          throw new TRPCError7({ code: "FORBIDDEN", message: "Usu\xE1rio n\xE3o vinculado a um est\xFAdio." });
        }
      }
      const transactionData = {
        ...input,
        studioId,
        clientId: input.clientId || null,
        appointmentId: input.appointmentId || null,
        description: input.description || null
      };
      const result = await createTransaction(transactionData);
      const client = input.clientId ? await getClientById(input.clientId) : null;
      await createAuditLog({
        userId: ctx.user.id,
        userName: ctx.user.name || "Usu\xE1rio sem nome",
        action: "create",
        entity: "transaction",
        entityName: `${input.type === "entrada" ? "Entrada" : "Sa\xEDda"} - ${input.category} - R$ ${input.amount.toFixed(2)}`,
        details: {
          ...transactionData,
          clientName: client?.name
        },
        ipAddress: ctx.req.ip || ctx.req.socket?.remoteAddress,
        userAgent: ctx.req.headers?.["user-agent"]
      });
      return result;
    }),
    update: protectedProcedure.input(z6.object({
      id: z6.number(),
      data: z6.object({
        clientId: z6.number().optional().nullable(),
        appointmentId: z6.number().optional().nullable(),
        type: z6.enum(["entrada", "saida"]).optional(),
        category: z6.string().min(1).optional(),
        description: z6.string().optional(),
        amount: z6.number().min(1).optional(),
        paymentMethod: z6.enum(["dinheiro", "pix", "credito", "debito", "transferencia"]).optional(),
        date: z6.string().optional()
      })
    })).mutation(async ({ ctx, input }) => {
      const transactionBefore = await getTransactionById(input.id);
      const result = await updateTransaction(input.id, input.data);
      const transactionAfter = await getTransactionById(input.id);
      const client = transactionAfter?.clientId ? await getClientById(transactionAfter.clientId) : null;
      await createAuditLog({
        userId: ctx.user.id,
        userName: ctx.user.name || "Usu\xE1rio sem nome",
        action: "update",
        entity: "transaction",
        entityId: input.id,
        entityName: `${transactionAfter?.type === "entrada" ? "Entrada" : "Sa\xEDda"} - ${transactionAfter?.category || transactionBefore?.category || "Transa\xE7\xE3o"}`,
        details: {
          before: transactionBefore,
          after: transactionAfter,
          changes: input.data,
          clientName: client?.name
        },
        ipAddress: ctx.req.ip || ctx.req.socket?.remoteAddress,
        userAgent: ctx.req.headers?.["user-agent"]
      });
      return result;
    }),
    delete: protectedProcedure.input(z6.object({ id: z6.number() })).mutation(async ({ ctx, input }) => {
      const transactionBefore = await getTransactionById(input.id);
      const result = await deleteTransaction(input.id);
      const client = transactionBefore?.clientId ? await getClientById(transactionBefore.clientId) : null;
      await createAuditLog({
        userId: ctx.user.id,
        userName: ctx.user.name || "Usu\xE1rio sem nome",
        action: "delete",
        entity: "transaction",
        entityId: input.id,
        entityName: `${transactionBefore?.type === "entrada" ? "Entrada" : "Sa\xEDda"} - ${transactionBefore?.category || "Transa\xE7\xE3o"}`,
        details: {
          deletedTransaction: transactionBefore,
          clientName: client?.name
        },
        ipAddress: ctx.req.ip || ctx.req.socket?.remoteAddress,
        userAgent: ctx.req.headers?.["user-agent"]
      });
      return result;
    }),
    // Criar transação com baixa automática de materiais do estoque
    createWithMaterials: protectedProcedure.input(z6.object({
      clientId: z6.number().optional(),
      appointmentId: z6.number().optional(),
      type: z6.enum(["entrada", "saida"]),
      category: z6.string().min(1),
      description: z6.string().optional(),
      amount: z6.number().min(1),
      paymentMethod: z6.enum(["dinheiro", "pix", "credito", "debito", "transferencia"]),
      date: z6.string(),
      materials: z6.array(z6.object({
        materialId: z6.number(),
        quantity: z6.number().positive(),
        reason: z6.string().optional()
      })).optional().default([])
    })).mutation(async ({ ctx, input }) => {
      let studioId = ctx.user.studioId;
      if (!studioId) {
        if (ctx.user.role === "superadmin") {
          const firstStudio = await getFirstStudio();
          if (!firstStudio) throw new TRPCError7({ code: "PRECONDITION_FAILED", message: "Nenhum est\xFAdio cadastrado." });
          studioId = firstStudio.id;
        } else {
          throw new TRPCError7({ code: "FORBIDDEN", message: "Usu\xE1rio n\xE3o vinculado a um est\xFAdio." });
        }
      }
      const { materials: materialItems, ...transactionInput } = input;
      const transactionData = {
        ...transactionInput,
        studioId,
        clientId: transactionInput.clientId || null,
        appointmentId: transactionInput.appointmentId || null,
        description: transactionInput.description || null
      };
      const transaction = await createTransaction(transactionData);
      const stockResults = [];
      for (const item of materialItems) {
        const mat = await getMaterialById(item.materialId);
        if (!mat) continue;
        const result = await addStockMovement({
          materialId: item.materialId,
          type: "saida",
          quantity: item.quantity,
          reason: item.reason || `Baixa via transa\xE7\xE3o financeira - ${transactionInput.category}`,
          createdBy: ctx.user.id
        });
        stockResults.push({
          materialId: item.materialId,
          materialName: mat.name,
          previousStock: result.previousStock,
          newStock: result.newStock
        });
      }
      await createAuditLog({
        userId: ctx.user.id,
        userName: ctx.user.name || "Usu\xE1rio sem nome",
        action: "create",
        entity: "transaction",
        entityName: `${input.type === "entrada" ? "Entrada" : "Sa\xEDda"} - ${input.category} - R$ ${(input.amount / 100).toFixed(2)}`,
        details: { ...transactionData, stockMovements: stockResults },
        ipAddress: ctx.req.ip || ctx.req.socket?.remoteAddress,
        userAgent: ctx.req.headers?.["user-agent"]
      });
      return { transaction, stockMovements: stockResults };
    })
  }),
  // ============ REPORTS ROUTER ============
  reports: router({
    monthlyRevenue: tenantProcedure.input(z6.object({
      startDate: z6.string(),
      endDate: z6.string()
    })).query(async ({ ctx, input }) => {
      if (ctx.user.role === "collaborator" && (!ctx.studioId || !await hasModulePermission({ userId: ctx.user.id, studioId: ctx.studioId, module: "reports" }))) {
        throw new TRPCError7({ code: "FORBIDDEN", message: "Sem permiss\xE3o para consultar relat\xF3rios." });
      }
      return await getMonthlyRevenue(input.startDate, input.endDate, ctx.studioId);
    }),
    categoryBreakdown: tenantProcedure.input(z6.object({
      startDate: z6.string(),
      endDate: z6.string()
    })).query(async ({ ctx, input }) => {
      if (ctx.user.role === "collaborator" && (!ctx.studioId || !await hasModulePermission({ userId: ctx.user.id, studioId: ctx.studioId, module: "reports" }))) {
        throw new TRPCError7({ code: "FORBIDDEN", message: "Sem permiss\xE3o para consultar relat\xF3rios." });
      }
      return await getCategoryBreakdown(input.startDate, input.endDate, ctx.studioId);
    }),
    paymentMethodBreakdown: tenantProcedure.input(z6.object({
      startDate: z6.string(),
      endDate: z6.string()
    })).query(async ({ ctx, input }) => {
      if (ctx.user.role === "collaborator" && (!ctx.studioId || !await hasModulePermission({ userId: ctx.user.id, studioId: ctx.studioId, module: "reports" }))) {
        throw new TRPCError7({ code: "FORBIDDEN", message: "Sem permiss\xE3o para consultar relat\xF3rios." });
      }
      return await getPaymentMethodBreakdown(input.startDate, input.endDate, ctx.studioId);
    }),
    summary: tenantProcedure.input(z6.object({
      startDate: z6.string(),
      endDate: z6.string()
    })).query(async ({ ctx, input }) => {
      if (ctx.user.role === "collaborator" && (!ctx.studioId || !await hasModulePermission({ userId: ctx.user.id, studioId: ctx.studioId, module: "reports" }))) {
        throw new TRPCError7({ code: "FORBIDDEN", message: "Sem permiss\xE3o para consultar relat\xF3rios." });
      }
      return await getFinancialSummary(input.startDate, input.endDate, ctx.studioId);
    }),
    artistRevenue: protectedProcedure.input(z6.object({
      startDate: z6.string(),
      endDate: z6.string(),
      groupBy: z6.enum(["week", "month", "bimonth", "year"]).default("month")
    })).query(async ({ ctx, input }) => {
      return await getArtistRevenue(input.startDate, input.endDate, input.groupBy, ctx.user.studioId ?? null);
    })
  }),
  // ============ NOTES ROUTER ============
  notes: router({
    getByClientId: protectedProcedure.input(z6.object({ clientId: z6.number() })).query(async ({ input }) => {
      return await getNotesByClientId(input.clientId);
    }),
    create: protectedProcedure.input(z6.object({
      clientId: z6.number(),
      content: z6.string().min(1)
    })).mutation(async ({ input, ctx }) => {
      const noteData = {
        clientId: input.clientId,
        authorId: ctx.user.id,
        content: input.content
      };
      return await createNote(noteData);
    }),
    delete: protectedProcedure.input(z6.object({ id: z6.number() })).mutation(async ({ input }) => {
      return await deleteNote(input.id);
    })
  }),
  // ============ GALLERY ROUTER ============
  gallery: router({
    getByClientId: protectedProcedure.input(z6.object({ clientId: z6.number() })).query(async ({ input }) => {
      return await getGalleryByClientId(input.clientId);
    }),
    uploadImage: protectedProcedure.input(z6.object({
      clientId: z6.number(),
      appointmentId: z6.number().optional(),
      imageBase64: z6.string(),
      fileName: z6.string(),
      mimeType: z6.string(),
      description: z6.string().optional(),
      tags: z6.string().optional()
    })).mutation(async ({ input }) => {
      const base64Data = input.imageBase64.replace(/^data:image\/\w+;base64,/, "");
      const buffer = Buffer.from(base64Data, "base64");
      const timestamp2 = Date.now();
      const randomSuffix2 = Math.random().toString(36).substring(2, 8);
      const extension = input.fileName.split(".").pop() || "jpg";
      const fileKey = `client-${input.clientId}/gallery/${timestamp2}-${randomSuffix2}.${extension}`;
      const { storagePut: storagePut2 } = await Promise.resolve().then(() => (init_storage(), storage_exports));
      const { url } = await storagePut2(fileKey, buffer, input.mimeType);
      const galleryData = {
        clientId: input.clientId,
        appointmentId: input.appointmentId || null,
        imageUrl: url,
        imageKey: fileKey,
        description: input.description || null,
        tags: input.tags || null
      };
      return await createGalleryImage(galleryData);
    }),
    create: protectedProcedure.input(z6.object({
      clientId: z6.number(),
      appointmentId: z6.number().optional(),
      imageUrl: z6.string(),
      imageKey: z6.string(),
      description: z6.string().optional(),
      tags: z6.string().optional()
    })).mutation(async ({ input }) => {
      const galleryData = {
        ...input,
        appointmentId: input.appointmentId || null,
        description: input.description || null,
        tags: input.tags || null
      };
      return await createGalleryImage(galleryData);
    }),
    delete: protectedProcedure.input(z6.object({ id: z6.number() })).mutation(async ({ input }) => {
      return await deleteGalleryImage(input.id);
    })
  }),
  // ============ DASHBOARD ROUTER ============
  dashboard: router({
    topClients: protectedProcedure.input(z6.object({ limit: z6.number().optional() })).query(async ({ input }) => {
      return await getTopClients(input.limit || 5);
    }),
    upcomingBirthdays: protectedProcedure.input(z6.object({ daysAhead: z6.number().optional() })).query(async ({ input }) => {
      return await getUpcomingBirthdays(input.daysAhead || 30);
    }),
    metrics: protectedProcedure.query(async () => {
      return await getDashboardMetrics();
    }),
    weeklyAppointments: protectedProcedure.query(async () => {
      return await getWeeklyAppointments();
    })
  }),
  // ============ SEARCH ROUTER ============
  search: router({
    global: protectedProcedure.input(z6.object({
      term: z6.string().min(1),
      startDate: z6.date().optional(),
      endDate: z6.date().optional()
    })).query(async ({ input }) => {
      const [clients2, appointments2, transactions2] = await Promise.all([
        searchClients(input.term, input.startDate, input.endDate),
        searchAppointments(input.term, input.startDate, input.endDate),
        searchTransactions(input.term, input.startDate, input.endDate)
      ]);
      return {
        clients: clients2,
        appointments: appointments2,
        transactions: transactions2
      };
    })
  }),
  // ============ NOTIFICATIONS ROUTER ============
  notifications: router({
    getUpcomingAppointments: tenantProcedure.query(async ({ ctx }) => {
      return await getUpcomingAppointments(ctx.studioId, ctx.artistId);
    }),
    sendReminders: protectedProcedure.mutation(async () => {
      return await sendAppointmentReminders();
    }),
    sendSelectedReminders: tenantProcedure.input(z6.object({
      appointmentIds: z6.array(z6.number().int().positive()).min(1).max(50)
    })).mutation(async ({ ctx, input }) => {
      const studioId = ctx.studioId;
      if (!studioId) throw new TRPCError7({ code: "FORBIDDEN", message: "Selecione uma empresa antes de enviar lembretes." });
      const selectable = await getUpcomingAppointments(studioId, ctx.artistId);
      const requestedIds = new Set(input.appointmentIds);
      const selected = selectable.filter((appointment) => requestedIds.has(appointment.id));
      if (selected.length !== requestedIds.size) {
        throw new TRPCError7({ code: "FORBIDDEN", message: "Um ou mais agendamentos n\xE3o est\xE3o dispon\xEDveis para envio." });
      }
      const { dispatchTemplateMessage: dispatchTemplateMessage2 } = await Promise.resolve().then(() => (init_service(), service_exports));
      const studio = await getStudioById(studioId);
      if (!studio) throw new TRPCError7({ code: "NOT_FOUND", message: "Est\xFAdio selecionado n\xE3o encontrado." });
      const studioName = studio.name?.trim() || "nosso est\xFAdio";
      const studioAddress = formatStudioAddress(studio);
      const connection = await getDb();
      const activeIntegration = connection ? (await connection.select({ id: whatsappIntegrations.id }).from(whatsappIntegrations).where(and9(
        eq9(whatsappIntegrations.studioId, studioId),
        eq9(whatsappIntegrations.status, "ativo"),
        eq9(whatsappIntegrations.isEnabled, 1)
      )).limit(1))[0] : null;
      if (!connection || !activeIntegration) {
        throw new TRPCError7({ code: "PRECONDITION_FAILED", message: "N\xE3o h\xE1 integra\xE7\xE3o BotConversa ativa para o est\xFAdio selecionado." });
      }
      let sent = 0;
      let failed = 0;
      const details = [];
      for (const appointment of selected) {
        if (!appointment.clientPhone) {
          failed += 1;
          details.push({ appointmentId: appointment.id, success: false, error: "Cliente sem telefone cadastrado" });
          continue;
        }
        const consent = (await connection.select({ id: integrationContacts.id }).from(integrationContacts).where(and9(
          eq9(integrationContacts.studioId, studioId),
          eq9(integrationContacts.integrationId, activeIntegration.id),
          eq9(integrationContacts.clientId, appointment.clientId),
          eq9(integrationContacts.hasWhatsappOptIn, 1),
          isNull3(integrationContacts.optedOutAt)
        )).limit(1))[0];
        if (!consent) {
          failed += 1;
          details.push({ appointmentId: appointment.id, success: false, error: "Cliente sem opt-in ativo para WhatsApp" });
          continue;
        }
        const date = /* @__PURE__ */ new Date(`${String(appointment.date).replace(" ", "T")}-03:00`);
        const actionLinks = await issueAppointmentActionLinks({ studioId, appointmentId: appointment.id });
        const result = await dispatchTemplateMessage2({
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
            servico: appointment.service ?? "sess\xE3o",
            endereco: studioAddress,
            link_anamnese: "",
            link_ebook: "",
            link_confirmacao: actionLinks.confirmed,
            link_adiantamento: actionLinks.early,
            link_atraso: actionLinks.late,
            link_remarcar: actionLinks.reschedule_requested,
            __appointment_action_links: actionLinks
          },
          idempotencyKey: `manual-appointment-reminder:${studioId}:${appointment.id}:${String(appointment.date)}`
        });
        if (result.success) sent += 1;
        else failed += 1;
        details.push({ appointmentId: appointment.id, success: result.success, error: result.success ? void 0 : result.error });
      }
      return { success: failed === 0, sent, failed, details };
    }),
    getNotificationLogs: protectedProcedure.input(z6.object({ limit: z6.number().optional() })).query(async ({ input }) => {
      return await getNotificationLogs(input.limit || 50);
    }),
    getWhatsAppSchedulerStatus: protectedProcedure.query(() => {
      return whatsAppSchedulerStatus;
    }),
    getWhatsAppLogs: protectedProcedure.input(z6.object({ limit: z6.number().optional() })).query(async ({ input }) => {
      return await getNotificationLogs(input.limit || 50);
    }),
    // Listar todos os lembretes individuais pendentes (para exibir na tela de Notificações)
    getPendingReminders: tenantProcedure.query(async ({ ctx }) => {
      const studioId = ctx.studioId;
      if (!studioId) throw new TRPCError7({ code: "FORBIDDEN", message: "Selecione uma empresa antes de consultar lembretes." });
      return await getAllPendingReminders(studioId);
    }),
    // Mantém o envio no processador de fila: o clique não abre WhatsApp local
    // nem realiza chamada externa diretamente na requisição do navegador.
    sendPendingReminderNow: tenantProcedure.input(z6.object({ id: z6.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const studioId = ctx.studioId;
      if (!studioId) throw new TRPCError7({ code: "FORBIDDEN", message: "Selecione uma empresa antes de enviar o lembrete." });
      const released = await releasePendingReminderNow(input.id, studioId);
      if (!released) throw new TRPCError7({ code: "NOT_FOUND", message: "Lembrete pendente n\xE3o encontrado para o est\xFAdio selecionado." });
      return { success: true, queued: true };
    }),
    // Atualizar data/hora de um lembrete individual
    updateReminder: protectedProcedure.input(z6.object({
      id: z6.number(),
      scheduledAt: z6.string(),
      message: z6.string().optional()
    })).mutation(async ({ input }) => {
      const { id, ...data } = input;
      return await updateAppointmentReminder(id, data);
    }),
    // Deletar um lembrete individual
    deleteReminder: protectedProcedure.input(z6.object({ id: z6.number() })).mutation(async ({ input }) => {
      await deleteAppointmentReminder(input.id);
      return { success: true };
    })
  }),
  // ============ SETTINGS ROUTER ============
  settings: router({
    get: protectedProcedure.query(async () => {
      return await getStudioSettings();
    }),
    update: protectedProcedure.input(z6.object({
      studioName: z6.string().optional(),
      address: z6.string().optional(),
      city: z6.string().optional(),
      state: z6.string().optional(),
      zipCode: z6.string().optional(),
      phone: z6.string().optional(),
      email: z6.string().email().optional().or(z6.literal("")),
      website: z6.string().optional(),
      instagram: z6.string().optional(),
      logoUrl: z6.string().optional(),
      logoKey: z6.string().optional(),
      primaryColor: z6.string().optional(),
      secondaryColor: z6.string().optional(),
      businessHours: z6.string().optional(),
      enableBirthdayReminders: z6.number().optional(),
      enableAppointmentReminders: z6.number().optional(),
      // Configurações WhatsApp
      reminderDaysBefore: z6.number().optional(),
      reminderSendTime: z6.string().optional(),
      reminderResend: z6.number().optional(),
      reminderResendTime: z6.string().optional()
    })).mutation(async ({ input }) => {
      return await updateStudioSettings(input);
    })
  }),
  // ============ ARTISTS ROUTER ============
  artists: router({
    list: tenantProcedure.query(async ({ ctx }) => {
      return await listArtists(ctx.studioId, ctx.artistId);
    }),
    getById: tenantProcedure.input(z6.object({ id: z6.number() })).query(async ({ ctx, input }) => {
      return await getArtistById(input.id, ctx.studioId);
    }),
    uploadAvatar: tenantProcedure.input(z6.object({
      artistId: z6.number().int().positive(),
      fileName: z6.string().min(1).max(160),
      imageBase64: z6.string().min(1).max(7e6),
      mimeType: z6.enum(["image/jpeg", "image/png", "image/webp"])
    })).mutation(async ({ ctx, input }) => {
      const artist = await getArtistById(input.artistId, ctx.studioId);
      if (!artist || ctx.artistId != null && artist.id !== ctx.artistId) {
        throw new TRPCError7({ code: "FORBIDDEN", message: "Artista n\xE3o dispon\xEDvel para este usu\xE1rio." });
      }
      const base64 = input.imageBase64.replace(/^data:image\/(jpeg|png|webp);base64,/, "");
      const buffer = Buffer.from(base64, "base64");
      if (!buffer.length || buffer.length > 5 * 1024 * 1024) {
        throw new TRPCError7({ code: "BAD_REQUEST", message: "A imagem deve ter at\xE9 5 MB." });
      }
      const extension = input.mimeType === "image/jpeg" ? "jpg" : input.mimeType.split("/")[1];
      const fileKey = `artists/${artist.studioId}/${artist.id}/avatar-${Date.now()}.${extension}`;
      const { storagePut: storagePut2 } = await Promise.resolve().then(() => (init_storage(), storage_exports));
      const { url } = await storagePut2(fileKey, buffer, input.mimeType);
      await updateArtist(artist.id, { photoUrl: url, photoKey: fileKey });
      return { photoUrl: url, photoKey: fileKey };
    }),
    create: protectedProcedure.input(z6.object({
      name: z6.string().min(1),
      email: z6.string().email().optional().or(z6.literal("")),
      phone: z6.string().optional(),
      instagram: z6.string().optional(),
      specialty: z6.string().optional(),
      bio: z6.string().optional(),
      photoUrl: z6.string().optional(),
      photoKey: z6.string().optional(),
      color: z6.string().regex(/^#[0-9A-Fa-f]{6}$/).optional().nullable(),
      active: z6.number().optional()
    })).mutation(async ({ ctx, input }) => {
      let studioId = ctx.user.studioId;
      if (!studioId) {
        if (ctx.user.role === "superadmin") {
          const firstStudio = await getFirstStudio();
          if (!firstStudio) {
            throw new TRPCError7({ code: "PRECONDITION_FAILED", message: "Nenhum est\xFAdio cadastrado no sistema." });
          }
          studioId = firstStudio.id;
        } else {
          throw new TRPCError7({ code: "FORBIDDEN", message: "Usu\xE1rio n\xE3o vinculado a um est\xFAdio." });
        }
      }
      const artistData = {
        ...input,
        studioId
      };
      return await createArtist(artistData);
    }),
    update: protectedProcedure.input(z6.object({
      id: z6.number(),
      name: z6.string().min(1).optional(),
      email: z6.string().email().optional().or(z6.literal("")),
      phone: z6.string().optional(),
      instagram: z6.string().optional(),
      specialty: z6.string().optional(),
      bio: z6.string().optional(),
      photoUrl: z6.string().optional(),
      photoKey: z6.string().optional(),
      color: z6.string().regex(/^#[0-9A-Fa-f]{6}$/).optional().nullable(),
      active: z6.number().optional()
    })).mutation(async ({ input }) => {
      const { id, ...data } = input;
      return await updateArtist(id, data);
    }),
    delete: protectedProcedure.input(z6.object({ id: z6.number() })).mutation(async ({ input }) => {
      return await deleteArtist(input.id);
    })
  }),
  // ============ USERS ROUTER (Admin only) ============
  users: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user.role !== "admin" && ctx.user.role !== "superadmin") {
        throw new TRPCError7({ code: "FORBIDDEN", message: "Acesso negado" });
      }
      return await listAllUsers();
    }),
    getById: protectedProcedure.input(z6.object({ id: z6.number() })).query(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin" && ctx.user.role !== "superadmin") {
        throw new TRPCError7({ code: "FORBIDDEN", message: "Acesso negado" });
      }
      return await getUserById(input.id);
    }),
    create: protectedProcedure.input(z6.object({
      openId: z6.string().min(1),
      name: z6.string().optional(),
      email: z6.string().email().optional().or(z6.literal("")),
      role: z6.enum(["superadmin", "admin", "collaborator"]).optional(),
      studioId: z6.number().optional().nullable(),
      artistId: z6.number().optional().nullable()
    })).mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin" && ctx.user.role !== "superadmin") {
        throw new TRPCError7({ code: "FORBIDDEN", message: "Acesso negado" });
      }
      const result = await createUser(input);
      await createAuditLog({
        userId: ctx.user.id,
        userName: ctx.user.name || "Usu\xE1rio sem nome",
        action: "create",
        entity: "user",
        entityName: input.name || input.openId,
        details: {
          openId: input.openId,
          name: input.name,
          email: input.email,
          role: input.role || "user",
          artistId: input.artistId
        },
        ipAddress: ctx.req.ip || ctx.req.socket?.remoteAddress,
        userAgent: ctx.req.headers?.["user-agent"]
      });
      return result;
    }),
    update: protectedProcedure.input(z6.object({
      id: z6.number(),
      name: z6.string().optional(),
      email: z6.string().email().optional().or(z6.literal("")),
      role: z6.enum(["superadmin", "admin", "collaborator"]).optional(),
      studioId: z6.number().optional().nullable(),
      artistId: z6.number().optional().nullable(),
      isActive: z6.number().optional()
    })).mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin" && ctx.user.role !== "superadmin") {
        throw new TRPCError7({ code: "FORBIDDEN", message: "Acesso negado" });
      }
      const userBefore = await getUserById(input.id);
      const { id, ...data } = input;
      const result = await updateUser(id, data);
      const userAfter = await getUserById(input.id);
      let action = "update";
      if (input.isActive !== void 0 && userBefore) {
        if (input.isActive === 1 && userBefore.isActive === 0) {
          action = "activate";
        } else if (input.isActive === 0 && userBefore.isActive === 1) {
          action = "deactivate";
        }
      }
      await createAuditLog({
        userId: ctx.user.id,
        userName: ctx.user.name || "Usu\xE1rio sem nome",
        action,
        entity: "user",
        entityId: input.id,
        entityName: userAfter?.name || userBefore?.name || "Usu\xE1rio",
        details: {
          before: userBefore,
          after: userAfter,
          changes: data
        },
        ipAddress: ctx.req.ip || ctx.req.socket?.remoteAddress,
        userAgent: ctx.req.headers?.["user-agent"]
      });
      return result;
    }),
    delete: protectedProcedure.input(z6.object({ id: z6.number() })).mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin" && ctx.user.role !== "superadmin") {
        throw new TRPCError7({ code: "FORBIDDEN", message: "Acesso negado" });
      }
      const userBefore = await getUserById(input.id);
      const result = await deleteUser(input.id);
      await createAuditLog({
        userId: ctx.user.id,
        userName: ctx.user.name || "Usu\xE1rio sem nome",
        action: "delete",
        entity: "user",
        entityId: input.id,
        entityName: userBefore?.name || "Usu\xE1rio",
        details: {
          deletedUser: userBefore
        },
        ipAddress: ctx.req.ip || ctx.req.socket?.remoteAddress,
        userAgent: ctx.req.headers?.["user-agent"]
      });
      return result;
    }),
    // Criar usuário local com e-mail + senha (AUTH_MODE=local)
    createLocal: protectedProcedure.input(z6.object({
      name: z6.string().min(1, "Nome obrigat\xF3rio"),
      email: z6.string().email("E-mail inv\xE1lido"),
      password: z6.string().min(6, "Senha m\xEDnima de 6 caracteres"),
      role: z6.enum(["superadmin", "admin", "collaborator"]).default("collaborator"),
      studioId: z6.number().optional().nullable(),
      artistId: z6.number().optional().nullable()
    })).mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin" && ctx.user.role !== "superadmin") {
        throw new TRPCError7({ code: "FORBIDDEN", message: "Acesso negado" });
      }
      const existing = await getUserByEmail(input.email);
      if (existing) {
        throw new TRPCError7({ code: "CONFLICT", message: "E-mail j\xE1 cadastrado" });
      }
      const { hashPassword: hashPassword2 } = await Promise.resolve().then(() => (init_localAuth(), localAuth_exports));
      const passwordHash = await hashPassword2(input.password);
      const openId = `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const result = await createUser({
        openId,
        name: input.name,
        email: input.email.trim().toLowerCase(),
        role: input.role,
        studioId: input.studioId ?? null,
        artistId: input.artistId ?? null,
        passwordHash
      });
      await createAuditLog({
        userId: ctx.user.id,
        userName: ctx.user.name || "Admin",
        action: "create",
        entity: "user",
        entityName: input.name,
        details: { email: input.email, role: input.role, loginMethod: "local" },
        ipAddress: ctx.req.ip || ctx.req.socket?.remoteAddress,
        userAgent: ctx.req.headers?.["user-agent"]
      });
      return result;
    }),
    // Trocar a própria senha (usuário logado)
    changePassword: protectedProcedure.input(z6.object({
      currentPassword: z6.string().min(1, "Senha atual obrigat\xF3ria"),
      newPassword: z6.string().min(6, "Nova senha deve ter no m\xEDnimo 6 caracteres")
    })).mutation(async ({ ctx, input }) => {
      const user = await getUserById(ctx.user.id);
      if (!user?.passwordHash) {
        throw new TRPCError7({ code: "BAD_REQUEST", message: "Sua conta n\xE3o possui senha local configurada" });
      }
      const { verifyPassword: verifyPassword2, hashPassword: hashPassword2 } = await Promise.resolve().then(() => (init_localAuth(), localAuth_exports));
      const valid = await verifyPassword2(input.currentPassword, user.passwordHash);
      if (!valid) {
        throw new TRPCError7({ code: "UNAUTHORIZED", message: "Senha atual incorreta" });
      }
      const passwordHash = await hashPassword2(input.newPassword);
      await updateUser(ctx.user.id, { passwordHash });
      await createAuditLog({
        userId: ctx.user.id,
        userName: ctx.user.name || "Usu\xE1rio",
        action: "update",
        entity: "user",
        entityId: ctx.user.id,
        entityName: ctx.user.name || "Usu\xE1rio",
        details: { action: "password_changed" },
        ipAddress: ctx.req.ip || ctx.req.socket?.remoteAddress,
        userAgent: ctx.req.headers?.["user-agent"]
      });
      return { success: true };
    }),
    // Redefinir senha de um usuário local (admin only)
    setPassword: protectedProcedure.input(z6.object({
      id: z6.number(),
      password: z6.string().min(6, "Senha m\xEDnima de 6 caracteres")
    })).mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin" && ctx.user.role !== "superadmin") {
        throw new TRPCError7({ code: "FORBIDDEN", message: "Acesso negado" });
      }
      const { hashPassword: hashPassword2 } = await Promise.resolve().then(() => (init_localAuth(), localAuth_exports));
      const passwordHash = await hashPassword2(input.password);
      await updateUser(input.id, { passwordHash });
      return { success: true };
    })
  }),
  // ============ AUDIT ROUTER (Admin only) ============
  audit: router({
    list: protectedProcedure.input(z6.object({
      action: z6.string().optional(),
      entity: z6.string().optional(),
      startDate: z6.date().optional(),
      endDate: z6.date().optional(),
      userId: z6.number().optional(),
      limit: z6.number().optional()
    }).optional()).query(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin" && ctx.user.role !== "superadmin") {
        throw new TRPCError7({ code: "FORBIDDEN", message: "Acesso negado" });
      }
      return await listAuditLogs(input);
    }),
    search: protectedProcedure.input(z6.object({ term: z6.string() })).query(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin" && ctx.user.role !== "superadmin") {
        throw new TRPCError7({ code: "FORBIDDEN", message: "Acesso negado" });
      }
      return await searchAuditLogs(input.term);
    }),
    statistics: protectedProcedure.input(z6.object({
      startDate: z6.date().optional(),
      endDate: z6.date().optional()
    }).optional()).query(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin" && ctx.user.role !== "superadmin") {
        throw new TRPCError7({ code: "FORBIDDEN", message: "Acesso negado" });
      }
      return await getAuditStatistics(input?.startDate, input?.endDate);
    }),
    actionsByDay: protectedProcedure.input(z6.object({
      startDate: z6.date(),
      endDate: z6.date()
    })).query(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin" && ctx.user.role !== "superadmin") {
        throw new TRPCError7({ code: "FORBIDDEN", message: "Acesso negado" });
      }
      return await getAuditActionsByDay(input.startDate, input.endDate);
    }),
    actionsByType: protectedProcedure.input(z6.object({
      startDate: z6.date().optional(),
      endDate: z6.date().optional()
    }).optional()).query(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin" && ctx.user.role !== "superadmin") {
        throw new TRPCError7({ code: "FORBIDDEN", message: "Acesso negado" });
      }
      return await getAuditActionsByType(input?.startDate, input?.endDate);
    }),
    actionsByEntity: protectedProcedure.input(z6.object({
      startDate: z6.date().optional(),
      endDate: z6.date().optional()
    }).optional()).query(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin" && ctx.user.role !== "superadmin") {
        throw new TRPCError7({ code: "FORBIDDEN", message: "Acesso negado" });
      }
      return await getAuditActionsByEntity(input?.startDate, input?.endDate);
    }),
    topActiveUsers: protectedProcedure.input(z6.object({
      limit: z6.number().optional(),
      startDate: z6.date().optional(),
      endDate: z6.date().optional()
    }).optional()).query(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin" && ctx.user.role !== "superadmin") {
        throw new TRPCError7({ code: "FORBIDDEN", message: "Acesso negado" });
      }
      return await getTopActiveUsers(input?.limit, input?.startDate, input?.endDate);
    }),
    heatmap: protectedProcedure.input(z6.object({
      startDate: z6.date().optional(),
      endDate: z6.date().optional()
    }).optional()).query(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin" && ctx.user.role !== "superadmin") {
        throw new TRPCError7({ code: "FORBIDDEN", message: "Acesso negado" });
      }
      return await getAuditHeatmap(input?.startDate, input?.endDate);
    }),
    exportPDF: protectedProcedure.input(z6.object({
      startDate: z6.date(),
      endDate: z6.date(),
      logsLimit: z6.number().optional(),
      usersLimit: z6.number().optional(),
      template: z6.object({
        includeSections: z6.array(z6.string()).optional(),
        reportTitle: z6.string().optional(),
        reportSubtitle: z6.string().optional(),
        primaryColor: z6.string().optional(),
        footerText: z6.string().optional()
      }).optional()
    })).mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin" && ctx.user.role !== "superadmin") {
        throw new TRPCError7({ code: "FORBIDDEN", message: "Acesso negado" });
      }
      const { generateAuditPDF: generateAuditPDF2 } = await Promise.resolve().then(() => (init_auditPdfGenerator(), auditPdfGenerator_exports));
      const logsLimit = input.logsLimit || 20;
      const usersLimit = input.usersLimit || 5;
      const [statistics, actionsByDay, actionsByType, actionsByEntity, topUsers, recentLogs] = await Promise.all([
        getAuditStatistics(input.startDate, input.endDate),
        getAuditActionsByDay(input.startDate, input.endDate),
        getAuditActionsByType(input.startDate, input.endDate),
        getAuditActionsByEntity(input.startDate, input.endDate),
        getTopActiveUsers(usersLimit, input.startDate, input.endDate),
        listAuditLogs({ startDate: input.startDate, endDate: input.endDate, limit: logsLimit })
      ]);
      const pdfBuffer = await generateAuditPDF2({
        startDate: input.startDate,
        endDate: input.endDate,
        statistics,
        actionsByDay,
        actionsByType,
        actionsByEntity,
        topUsers,
        recentLogs,
        template: input.template
      });
      return {
        pdf: pdfBuffer.toString("base64"),
        filename: `relatorio-auditoria-${input.startDate.toISOString().split("T")[0]}-${input.endDate.toISOString().split("T")[0]}.pdf`
      };
    })
  }),
  reportTemplates: router({
    create: protectedProcedure.input(z6.object({
      name: z6.string(),
      description: z6.string().optional(),
      includeSections: z6.array(z6.string()),
      sectionOrder: z6.array(z6.string()),
      logsLimit: z6.number(),
      usersLimit: z6.number(),
      reportTitle: z6.string().optional(),
      reportSubtitle: z6.string().optional(),
      primaryColor: z6.string().optional(),
      logoUrl: z6.string().optional(),
      logoKey: z6.string().optional(),
      footerText: z6.string().optional()
    })).mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin" && ctx.user.role !== "superadmin") {
        throw new TRPCError7({ code: "FORBIDDEN", message: "Acesso negado" });
      }
      const templateId = await createReportTemplate({
        userId: ctx.user.id,
        ...input
      });
      return { id: templateId };
    }),
    list: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user.role !== "admin" && ctx.user.role !== "superadmin") {
        throw new TRPCError7({ code: "FORBIDDEN", message: "Acesso negado" });
      }
      return await listReportTemplates(ctx.user.id);
    }),
    get: protectedProcedure.input(z6.object({ id: z6.number() })).query(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin" && ctx.user.role !== "superadmin") {
        throw new TRPCError7({ code: "FORBIDDEN", message: "Acesso negado" });
      }
      return await getReportTemplate(input.id, ctx.user.id);
    }),
    update: protectedProcedure.input(z6.object({
      id: z6.number(),
      name: z6.string().optional(),
      description: z6.string().optional(),
      includeSections: z6.array(z6.string()).optional(),
      sectionOrder: z6.array(z6.string()).optional(),
      logsLimit: z6.number().optional(),
      usersLimit: z6.number().optional(),
      reportTitle: z6.string().optional(),
      reportSubtitle: z6.string().optional(),
      primaryColor: z6.string().optional(),
      logoUrl: z6.string().optional(),
      logoKey: z6.string().optional(),
      footerText: z6.string().optional()
    })).mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin" && ctx.user.role !== "superadmin") {
        throw new TRPCError7({ code: "FORBIDDEN", message: "Acesso negado" });
      }
      const { id, ...data } = input;
      await updateReportTemplate(id, ctx.user.id, data);
      return { success: true };
    }),
    delete: protectedProcedure.input(z6.object({ id: z6.number() })).mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin" && ctx.user.role !== "superadmin") {
        throw new TRPCError7({ code: "FORBIDDEN", message: "Acesso negado" });
      }
      await deleteReportTemplate(input.id, ctx.user.id);
      return { success: true };
    })
  }),
  // Calendários personalizados
  calendars: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return await listCalendars(ctx.user.id);
    }),
    create: protectedProcedure.input(z6.object({
      name: z6.string(),
      description: z6.string().optional(),
      color: z6.string().optional(),
      isVisible: z6.number().optional(),
      isDefault: z6.number().optional()
    })).mutation(async ({ input, ctx }) => {
      const calendarData = { ...input, userId: ctx.user.id };
      const [result] = await (await getDb()).insert(calendars).values(calendarData);
      const calendar = await getCalendarById(result.insertId, ctx.user.id);
      return calendar;
    }),
    update: protectedProcedure.input(z6.object({
      id: z6.number(),
      name: z6.string().optional(),
      description: z6.string().optional(),
      color: z6.string().optional(),
      isVisible: z6.number().optional(),
      isDefault: z6.number().optional()
    })).mutation(async ({ input, ctx }) => {
      const { id, ...data } = input;
      await updateCalendar(id, ctx.user.id, data);
      const calendar = await getCalendarById(id, ctx.user.id);
      return calendar;
    }),
    toggleVisibility: protectedProcedure.input(z6.object({ id: z6.number(), isVisible: z6.number() })).mutation(async ({ input, ctx }) => {
      await toggleCalendarVisibility(input.id, ctx.user.id, input.isVisible);
      const calendar = await getCalendarById(input.id, ctx.user.id);
      return calendar;
    }),
    delete: protectedProcedure.input(z6.object({ id: z6.number() })).mutation(async ({ input, ctx }) => {
      await deleteCalendar(input.id, ctx.user.id);
      return { success: true };
    })
  }),
  // ============ ANAMNESE ROUTER ============
  anamnese: router({
    // Criar solicitação e gerar link
    createRequest: protectedProcedure.input(z6.object({
      clientId: z6.number(),
      appointmentId: z6.number().optional(),
      sentVia: z6.enum(["email", "whatsapp"]),
      sentTo: z6.string()
    })).mutation(async ({ input }) => {
      const token = Math.random().toString(36).substring(2) + Date.now().toString(36);
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1e3).toISOString();
      const requestId = await createAnamneseRequest({
        clientId: input.clientId,
        appointmentId: input.appointmentId,
        token,
        sentVia: input.sentVia,
        sentTo: input.sentTo,
        expiresAt,
        statusRequest: "pendente"
      });
      const baseUrl = process.env.APP_BASE_URL || (process.env.NODE_ENV === "production" ? `https://${process.env.VITE_APP_ID ? "tatuei.com" : "tatuei.manus.space"}` : "http://localhost:3000");
      const link = `${baseUrl}/anamnese/${token}`;
      return { requestId, token, link, expiresAt };
    }),
    // Obter solicitação por token (público)
    getRequestByToken: publicProcedure.input(z6.object({ token: z6.string() })).query(async ({ input }) => {
      const request = await getAnamneseRequestByToken(input.token);
      if (!request) {
        throw new TRPCError7({ code: "NOT_FOUND", message: "Link inv\xE1lido ou expirado" });
      }
      if (new Date(request.expiresAt) < /* @__PURE__ */ new Date() && !request.completedAt) {
        throw new TRPCError7({ code: "BAD_REQUEST", message: "Link expirado" });
      }
      const client = await getClientById(request.clientId);
      let existingPayload = null;
      let existingSubmissionId = null;
      if (request.completedAt) {
        const submission = await getAnamneseSubmissionByRequestId(request.id);
        if (submission) {
          try {
            existingPayload = JSON.parse(submission.payloadJson);
          } catch {
          }
          existingSubmissionId = submission.id;
        }
      } else {
        const latestSubmission = (await getAnamneseSubmissionsByClientId(request.clientId))[0];
        if (latestSubmission) {
          try {
            existingPayload = JSON.parse(latestSubmission.payloadJson);
          } catch {
          }
        } else {
          const legacyRecord = (await getAnamnesisByClientId(request.clientId))[0];
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
        isReview: !request.completedAt && !!existingPayload
      };
    }),
    // Submeter anamnese preenchida (público) — também suporta reedição
    submitAnamnese: publicProcedure.input(z6.object({
      token: z6.string(),
      payload: z6.record(z6.string(), z6.any()),
      submissionId: z6.number().optional()
      // presente quando está editando
    })).mutation(async ({ input }) => {
      const request = await getAnamneseRequestByToken(input.token);
      if (!request) {
        throw new TRPCError7({ code: "NOT_FOUND", message: "Link inv\xE1lido" });
      }
      const payloadJson = JSON.stringify(input.payload);
      if (request.completedAt) {
        let targetId = input.submissionId;
        if (!targetId) {
          const existing = await getAnamneseSubmissionByRequestId(request.id);
          targetId = existing?.id;
        }
        if (!targetId) {
          throw new TRPCError7({ code: "NOT_FOUND", message: "Submiss\xE3o original n\xE3o encontrada" });
        }
        await updateAnamneseSubmission(targetId, payloadJson);
        return { success: true, submissionId: targetId };
      }
      if (new Date(request.expiresAt) < /* @__PURE__ */ new Date()) {
        throw new TRPCError7({ code: "BAD_REQUEST", message: "Link expirado" });
      }
      const submissionId = await createAnamneseSubmission({
        requestId: request.id,
        clientId: request.clientId,
        appointmentId: request.appointmentId,
        payloadJson
      });
      await markAnamneseRequestCompleted(request.id);
      syncAnamnesisSubmissionToSheets({
        id: submissionId,
        clientId: request.clientId,
        appointmentId: request.appointmentId,
        submittedAt: /* @__PURE__ */ new Date()
      });
      return { success: true, submissionId };
    }),
    // Listar submissões de um cliente
    getByClientId: protectedProcedure.input(z6.object({ clientId: z6.number() })).query(async ({ input }) => {
      const submissions = await getAnamneseSubmissionsByClientId(input.clientId);
      return submissions.map((s) => ({
        ...s,
        payload: JSON.parse(s.payloadJson)
      }));
    }),
    // Listar solicitações de um cliente
    getRequestsByClientId: protectedProcedure.input(z6.object({ clientId: z6.number() })).query(async ({ input }) => {
      return await getAnamneseRequestsByClientId(input.clientId);
    }),
    // Editar submissão via link (painel interno)
    updateSubmission: protectedProcedure.input(z6.object({
      id: z6.number(),
      payload: z6.record(z6.string(), z6.any())
    })).mutation(async ({ input }) => {
      await updateAnamneseSubmission(input.id, JSON.stringify(input.payload));
      syncAnamnesisSubmissionToSheets({
        id: input.id,
        submittedAt: /* @__PURE__ */ new Date()
      });
      return { success: true };
    }),
    // Excluir submissão via link (painel interno)
    deleteSubmission: protectedProcedure.input(z6.object({ id: z6.number() })).mutation(async ({ input }) => {
      await deleteAnamneseSubmission(input.id);
      return { success: true };
    }),
    // Editar ficha manual (painel interno)
    updateRecord: protectedProcedure.input(z6.object({
      id: z6.number(),
      hasAllergies: z6.boolean().optional(),
      allergiesDetails: z6.string().optional(),
      hasDiseases: z6.boolean().optional(),
      diseasesDetails: z6.string().optional(),
      usesMedication: z6.boolean().optional(),
      medicationDetails: z6.string().optional(),
      isPregnant: z6.boolean().optional(),
      hasKeloid: z6.boolean().optional(),
      acceptedTerms: z6.boolean().optional(),
      notes: z6.string().optional()
    })).mutation(async ({ input }) => {
      const { id, ...data } = input;
      await updateAnamnesisRecord(id, {
        ...data,
        hasAllergies: data.hasAllergies !== void 0 ? data.hasAllergies ? 1 : 0 : void 0,
        hasDiseases: data.hasDiseases !== void 0 ? data.hasDiseases ? 1 : 0 : void 0,
        usesMedication: data.usesMedication !== void 0 ? data.usesMedication ? 1 : 0 : void 0,
        isPregnant: data.isPregnant !== void 0 ? data.isPregnant ? 1 : 0 : void 0,
        hasKeloid: data.hasKeloid !== void 0 ? data.hasKeloid ? 1 : 0 : void 0,
        acceptedTerms: data.acceptedTerms !== void 0 ? data.acceptedTerms ? 1 : 0 : void 0
      });
      return { success: true };
    }),
    // Excluir ficha manual (painel interno)
    deleteRecord: protectedProcedure.input(z6.object({ id: z6.number() })).mutation(async ({ input }) => {
      await deleteAnamnesisRecord(input.id);
      return { success: true };
    }),
    // Obter submissão por requestId para pré-preencher formulário público
    getSubmissionByRequestId: publicProcedure.input(z6.object({ requestId: z6.number() })).query(async ({ input }) => {
      const submission = await getAnamneseSubmissionByRequestId(input.requestId);
      if (!submission) return null;
      return { ...submission, payload: JSON.parse(submission.payloadJson) };
    }),
    // Atualizar submissão via formulário público (cliente edita ficha já preenchida)
    updateSubmissionPublic: publicProcedure.input(z6.object({
      token: z6.string(),
      payload: z6.record(z6.string(), z6.any())
    })).mutation(async ({ input }) => {
      const request = await getAnamneseRequestByToken(input.token);
      if (!request) throw new TRPCError7({ code: "NOT_FOUND", message: "Link inv\xE1lido" });
      const submission = await getAnamneseSubmissionByRequestId(request.id);
      if (!submission) throw new TRPCError7({ code: "NOT_FOUND", message: "Ficha n\xE3o encontrada" });
      await updateAnamneseSubmission(submission.id, JSON.stringify(input.payload));
      return { success: true };
    })
  }),
  // ============ SUPPLIERS ROUTER ============
  suppliers: router({
    list: protectedProcedure.input(z6.object({ activeOnly: z6.boolean().optional().default(true) })).query(async ({ input }) => {
      return await listSuppliers(input.activeOnly);
    }),
    getById: protectedProcedure.input(z6.object({ id: z6.number() })).query(async ({ input }) => {
      const supplier = await getSupplierById(input.id);
      if (!supplier) throw new TRPCError7({ code: "NOT_FOUND", message: "Fornecedor n\xE3o encontrado" });
      return supplier;
    }),
    create: protectedProcedure.input(z6.object({
      name: z6.string().min(1),
      cnpj: z6.string().optional(),
      contactName: z6.string().optional(),
      phone: z6.string().optional(),
      whatsapp: z6.string().optional(),
      email: z6.string().email().optional().or(z6.literal("")),
      address: z6.string().optional(),
      notes: z6.string().optional()
    })).mutation(async ({ input }) => {
      const id = await createSupplier(input);
      return { id };
    }),
    update: protectedProcedure.input(z6.object({
      id: z6.number(),
      name: z6.string().min(1).optional(),
      cnpj: z6.string().optional(),
      contactName: z6.string().optional(),
      phone: z6.string().optional(),
      whatsapp: z6.string().optional(),
      email: z6.string().email().optional().or(z6.literal("")),
      address: z6.string().optional(),
      notes: z6.string().optional(),
      isActive: z6.number().optional()
    })).mutation(async ({ input }) => {
      const { id, ...data } = input;
      await updateSupplier(id, data);
      return { success: true };
    }),
    delete: protectedProcedure.input(z6.object({ id: z6.number() })).mutation(async ({ input }) => {
      await deleteSupplier(input.id);
      return { success: true };
    })
  }),
  // ============ STOCK ROUTER ============
  stock: router({
    listMaterials: protectedProcedure.input(z6.object({ activeOnly: z6.boolean().optional().default(true) })).query(async ({ input }) => {
      return await listMaterials(input.activeOnly);
    }),
    getLowStock: protectedProcedure.query(async () => {
      return await getLowStockMaterials();
    }),
    getMaterial: protectedProcedure.input(z6.object({ id: z6.number() })).query(async ({ input }) => {
      const mat = await getMaterialById(input.id);
      if (!mat) throw new TRPCError7({ code: "NOT_FOUND", message: "Material n\xE3o encontrado" });
      return mat;
    }),
    createMaterial: protectedProcedure.input(z6.object({
      name: z6.string().min(1),
      category: z6.string().min(1),
      unit: z6.string().min(1),
      currentStock: z6.number().min(0).default(0),
      minStock: z6.number().min(0).default(0),
      avgPrice: z6.number().min(0).default(0),
      supplierId: z6.number().optional(),
      notes: z6.string().optional()
    })).mutation(async ({ input }) => {
      const id = await createMaterial({
        ...input,
        currentStock: String(input.currentStock),
        minStock: String(input.minStock),
        avgPrice: String(input.avgPrice)
      });
      syncMaterialToSheets({
        id,
        category: input.category,
        model: input.name,
        currentStock: input.currentStock,
        unit: input.unit,
        minStock: input.minStock,
        notes: input.notes
      });
      return { id };
    }),
    updateMaterial: protectedProcedure.input(z6.object({
      id: z6.number(),
      name: z6.string().min(1).optional(),
      category: z6.string().optional(),
      unit: z6.string().optional(),
      minStock: z6.number().min(0).optional(),
      avgPrice: z6.number().min(0).optional(),
      supplierId: z6.number().optional().nullable(),
      notes: z6.string().optional()
    })).mutation(async ({ input }) => {
      const { id, minStock, avgPrice, ...rest } = input;
      await updateMaterial(id, {
        ...rest,
        ...minStock !== void 0 ? { minStock: String(minStock) } : {},
        ...avgPrice !== void 0 ? { avgPrice: String(avgPrice) } : {}
      });
      const matAfter = await getMaterialById(id);
      if (matAfter) {
        syncMaterialToSheets({
          id: matAfter.id,
          category: matAfter.category,
          model: matAfter.name,
          currentStock: matAfter.currentStock ? Number(matAfter.currentStock) : 0,
          unit: matAfter.unit,
          minStock: matAfter.minStock ? Number(matAfter.minStock) : 0,
          notes: matAfter.notes
        });
      }
      return { success: true };
    }),
    deleteMaterial: protectedProcedure.input(z6.object({ id: z6.number() })).mutation(async ({ input }) => {
      await deleteMaterial(input.id);
      return { success: true };
    }),
    listMovements: protectedProcedure.input(z6.object({ materialId: z6.number().optional(), limit: z6.number().optional().default(50) })).query(async ({ input }) => {
      return await listStockMovements(input.materialId, input.limit);
    }),
    addMovement: protectedProcedure.input(z6.object({
      materialId: z6.number(),
      type: z6.enum(["entrada", "saida", "ajuste"]),
      quantity: z6.number().positive(),
      reason: z6.string().optional(),
      reference: z6.string().optional()
    })).mutation(async ({ ctx, input }) => {
      const movResult = await addStockMovement({ ...input, createdBy: ctx.user.id });
      syncStockMovementToSheets({
        id: typeof movResult === "object" && movResult !== null && "id" in movResult ? movResult.id : 0,
        materialId: input.materialId,
        movementType: input.type,
        quantity: input.quantity,
        reason: input.reason,
        responsible: ctx.user.name || ctx.user.email || "Sistema",
        createdAt: /* @__PURE__ */ new Date()
      });
      return movResult;
    }),
    // ── Pedidos de Orçamento ──
    listOrders: protectedProcedure.query(async () => {
      return await listPurchaseOrders();
    }),
    getOrder: protectedProcedure.input(z6.object({ id: z6.number() })).query(async ({ input }) => {
      const order = await getPurchaseOrderById(input.id);
      if (!order) throw new TRPCError7({ code: "NOT_FOUND", message: "Pedido n\xE3o encontrado" });
      return order;
    }),
    createOrder: protectedProcedure.input(z6.object({
      supplierId: z6.number(),
      notes: z6.string().optional(),
      items: z6.array(z6.object({
        materialId: z6.number(),
        quantity: z6.number().positive(),
        unitPrice: z6.number().min(0).optional(),
        notes: z6.string().optional()
      })).min(1)
    })).mutation(async ({ ctx, input }) => {
      const id = await createPurchaseOrder({ ...input, createdBy: ctx.user.id });
      return { id };
    }),
    updateOrderStatus: protectedProcedure.input(z6.object({
      id: z6.number(),
      status: z6.enum(["rascunho", "enviado", "confirmado", "recebido", "cancelado"])
    })).mutation(async ({ input }) => {
      await updatePurchaseOrderStatus(input.id, input.status);
      return { success: true };
    }),
    deleteOrder: protectedProcedure.input(z6.object({ id: z6.number() })).mutation(async ({ input }) => {
      await deletePurchaseOrder(input.id);
      return { success: true };
    }),
    getWhatsAppLink: protectedProcedure.input(z6.object({ orderId: z6.number() })).query(async ({ input }) => {
      const order = await getPurchaseOrderById(input.orderId);
      if (!order) throw new TRPCError7({ code: "NOT_FOUND", message: "Pedido n\xE3o encontrado" });
      const message = buildWhatsAppOrderMessage(order);
      const rawPhone = (order.supplierWhatsapp || "").trim();
      const encodedMsg = encodeURIComponent(message);
      const link = rawPhone ? `https://wa.me/${normalizeWhatsAppNumber(rawPhone)}?text=${encodedMsg}` : `https://wa.me/?text=${encodedMsg}`;
      return { link, message };
    })
  }),
  // ===== PERCENTUAIS DOS COLABORADORES =====
  collaboratorRates: router({
    // Listar todos os percentuais
    list: protectedProcedure.query(async ({ ctx }) => {
      let studioId = ctx.user.studioId;
      if (!studioId) {
        const firstStudio = await getFirstStudio();
        studioId = firstStudio?.id || 1;
      }
      return listCollaboratorRates(studioId);
    }),
    // Definir/atualizar percentual de um artista
    upsert: protectedProcedure.input(z6.object({
      artistId: z6.number(),
      percentage: z6.number().min(0).max(100),
      notes: z6.string().optional()
    })).mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin" && ctx.user.role !== "superadmin") {
        throw new TRPCError7({ code: "FORBIDDEN", message: "Apenas administradores podem editar percentuais" });
      }
      let studioId = ctx.user.studioId;
      if (!studioId) {
        const firstStudio = await getFirstStudio();
        studioId = firstStudio?.id || 1;
      }
      return upsertCollaboratorRate({ studioId, ...input });
    })
  }),
  // ===== RELATÓRIOS FINANCEIROS POR COLABORADOR =====
  collaboratorReports: router({
    // Relatório de um colaborador por período
    byPeriod: artistProcedure.input(z6.object({
      artistName: z6.string(),
      period: z6.enum(["daily", "weekly", "monthly", "annual"]),
      referenceDate: z6.string().optional()
      // YYYY-MM-DD
    })).query(async ({ ctx, input }) => {
      let studioId = ctx.studioId;
      if (!studioId) {
        const firstStudio = await getFirstStudio();
        studioId = firstStudio?.id || 1;
      }
      if (ctx.artistId != null) {
        const artist = await getArtistById(ctx.artistId, studioId);
        if (!artist) throw new TRPCError7({ code: "FORBIDDEN", message: "Artista n\xE3o dispon\xEDvel para este usu\xE1rio." });
        return getCollaboratorReport(studioId, artist.name, input.period, input.referenceDate);
      }
      return getCollaboratorReport(studioId, input.artistName, input.period, input.referenceDate);
    }),
    // Relatório geral de todos os colaboradores
    summary: artistProcedure.input(z6.object({
      period: z6.enum(["daily", "weekly", "monthly", "annual"]),
      referenceDate: z6.string().optional()
    })).query(async ({ ctx, input }) => {
      let studioId = ctx.studioId;
      if (!studioId) {
        const firstStudio = await getFirstStudio();
        studioId = firstStudio?.id || 1;
      }
      return getCollaboratorsSummary(studioId, input.period, input.referenceDate, ctx.artistId);
    })
  }),
  // ============ CONTACTS IMPORT/EXPORT ROUTER ============
  contacts: contactsRouter,
  // ============ POD SESSION — EXECUÇÃO TÉCNICA ============
  procedures: proceduresRouter,
  // ============ POD SESSION SaaS — CATÁLOGO, ESTOQUE E AUDITORIA ============
  pod: podSaasRouter,
  // ============ CENTRAL DE MENSAGENS / WHATSAPP ============
  messaging: messagingRouter
});

// server/_core/context.ts
init_sdk();
async function createContext(opts) {
  let user = null;
  try {
    user = await sdk.authenticateRequest(opts.req);
  } catch (error) {
    user = null;
  }
  return {
    req: opts.req,
    res: opts.res,
    user
  };
}

// server/_core/vite.ts
import express from "express";
import fs from "fs";
import { nanoid } from "nanoid";
import path from "path";
import { fileURLToPath } from "url";
var createViteServer = null;
var viteConfig = null;
var viteLoaded = false;
async function ensureViteLoaded() {
  if (!viteLoaded && process.env.NODE_ENV === "development") {
    const viteModule = await import("vite");
    const tailwindModule = await import("@tailwindcss/vite");
    createViteServer = viteModule.createServer;
    viteConfig = {
      root: path.resolve(__dirname, "../..", "client"),
      publicDir: path.resolve(__dirname, "../..", "client", "public"),
      envDir: path.resolve(__dirname, "../.."),
      resolve: {
        alias: {
          "@": path.resolve(__dirname, "../..", "client", "src"),
          "@shared": path.resolve(__dirname, "../..", "shared"),
          "@assets": path.resolve(__dirname, "../..", "attached_assets")
        }
      },
      esbuild: {
        jsx: "automatic"
      },
      plugins: [tailwindModule.default()]
    };
    viteLoaded = true;
  }
}
var __filename = fileURLToPath(import.meta.url);
var __dirname = path.dirname(__filename);
async function setupVite(app, server) {
  await ensureViteLoaded();
  if (!createViteServer || !viteConfig) {
    throw new Error("Vite modules failed to load");
  }
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true
  };
  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    server: serverOptions,
    appType: "custom"
  });
  app.use(vite.middlewares);
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;
    try {
      const clientTemplate = path.resolve(
        __dirname,
        "../..",
        "client",
        "index.html"
      );
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e);
      next(e);
    }
  });
}
function serveStatic(app) {
  const distPath = process.env.NODE_ENV === "development" ? path.resolve(__dirname, "../..", "dist", "public") : path.resolve(__dirname, "public");
  if (!fs.existsSync(distPath)) {
    console.error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }
  app.use(express.static(distPath));
  app.use("*", (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}

// server/_core/index.ts
init_sdk();
init_db();
init_service();

// server/messaging/secureWebhook.ts
init_schema();
init_db();
init_crypto();
init_webhook();
import { and as and11, eq as eq11 } from "drizzle-orm";
function extractInboundMessage(payload) {
  const body = payload;
  if (body?.subscriber?.phone && body?.last_message?.text) {
    return { phone: String(body.subscriber.phone), text: String(body.last_message.text).trim(), eventId: body.id ? String(body.id) : void 0 };
  }
  if (body?.phone && body?.text?.message) {
    return { phone: String(body.phone), text: String(body.text.message).trim(), eventId: body.messageId ? String(body.messageId) : void 0 };
  }
  return { eventId: body?.id ? String(body.id) : void 0 };
}
async function receiveBotConversaWebhook(input) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indispon\xEDvel");
  const integration = (await db.select().from(whatsappIntegrations).where(and11(eq11(whatsappIntegrations.connectionKey, input.connectionKey), eq11(whatsappIntegrations.provider, "botconversa"))).limit(1))[0];
  if (!integration?.studioId || !integration.encryptedWebhookSecret) {
    throw new Error("Conex\xE3o de webhook n\xE3o encontrada.");
  }
  const secret = decryptIntegrationSecret(integration.encryptedWebhookSecret);
  if (!isWebhookSignatureValid(input.rawBody, secret, input.signature)) {
    throw new Error("Assinatura do webhook inv\xE1lida.");
  }
  let payload;
  try {
    payload = JSON.parse(input.rawBody);
  } catch {
    throw new Error("Payload JSON inv\xE1lido.");
  }
  const inbound = extractInboundMessage(payload);
  const payloadHash = hashIntegrationPayload(input.rawBody);
  const idempotencyKey = hashIntegrationPayload(`inbound:${integration.id}:${inbound.eventId ?? payloadHash}`);
  const known = await db.select({ id: integrationEvents.id }).from(integrationEvents).where(eq11(integrationEvents.idempotencyKey, idempotencyKey)).limit(1);
  if (known[0]) return { accepted: true, duplicate: true };
  await db.insert(integrationEvents).values({
    studioId: integration.studioId,
    integrationId: integration.id,
    direction: "inbound",
    type: "webhook_message",
    idempotencyKey,
    providerEventId: inbound.eventId,
    payloadHash,
    status: "received"
  });
  if (!inbound.phone || !inbound.text) {
    await db.update(integrationEvents).set({ status: "ignored", processedAt: (/* @__PURE__ */ new Date()).toISOString().slice(0, 19).replace("T", " ") }).where(eq11(integrationEvents.idempotencyKey, idempotencyKey));
    return { accepted: true, ignored: true };
  }
  try {
    await handleWebhookReply(inbound.phone, inbound.text, integration.studioId);
    await db.update(integrationEvents).set({ status: "processed", processedAt: (/* @__PURE__ */ new Date()).toISOString().slice(0, 19).replace("T", " ") }).where(eq11(integrationEvents.idempotencyKey, idempotencyKey));
    return { accepted: true, duplicate: false };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao processar mensagem recebida.";
    await db.update(integrationEvents).set({ status: "failed", errorMessage: message, processedAt: (/* @__PURE__ */ new Date()).toISOString().slice(0, 19).replace("T", " ") }).where(eq11(integrationEvents.idempotencyKey, idempotencyKey));
    throw error;
  }
}

// server/_core/migrations.ts
init_db();
import { migrate } from "drizzle-orm/mysql2/migrator";
async function runStartupMigrations() {
  if (process.env.RUN_DB_MIGRATIONS !== "true") return;
  const database = await getDb();
  if (!database) {
    throw new Error("RUN_DB_MIGRATIONS=true but DATABASE_URL is not configured or the database is unavailable.");
  }
  console.log("[Database] Applying committed Drizzle migrations...");
  await migrate(database, { migrationsFolder: "./drizzle" });
  console.log("[Database] Migrations are up to date.");
}

// server/_core/index.ts
init_storage();
async function startServer() {
  await runStartupMigrations();
  const app = express2();
  const server = createServer(app);
  app.use(express2.json({
    limit: "50mb",
    verify: (req, _res, buffer) => {
      req.rawBody = buffer.toString("utf8");
    }
  }));
  app.use(express2.urlencoded({ limit: "50mb", extended: true }));
  app.get("/api/health", (_req, res) => {
    res.status(200).json({ ok: true, service: "pod-crm", timestamp: (/* @__PURE__ */ new Date()).toISOString() });
  });
  app.get("/api/storage", async (req, res) => {
    try {
      const key = typeof req.query.key === "string" ? req.query.key : "";
      const token = typeof req.query.token === "string" ? req.query.token : "";
      if (!key || !token || !verifyStorageAccessToken(key, token)) {
        return res.status(403).json({ error: "Acesso ao arquivo n\xE3o autorizado." });
      }
      const { url } = await storageGet(key);
      if (!url) return res.status(404).json({ error: "Arquivo indispon\xEDvel." });
      return res.redirect(302, url);
    } catch (error) {
      console.error("[Storage] Failed to serve object", error);
      return res.status(404).json({ error: "Arquivo n\xE3o encontrado." });
    }
  });
  if (ENV.authMode === "local") {
    console.log("[Auth] Using local authentication mode");
    registerLocalAuthRoutes(app);
    await ensureLocalAdmin({
      email: ENV.localAdminEmail,
      password: ENV.localAdminPassword,
      name: ENV.localAdminName,
      ownerOpenId: ENV.ownerOpenId
    });
  } else {
    console.log("[Auth] Using OAuth authentication mode");
    registerOAuthRoutes(app);
  }
  app.get("/api/appointments/:id/ics", async (req, res) => {
    try {
      let user = null;
      try {
        user = await sdk.authenticateRequest(req);
      } catch {
        res.status(401).json({ error: "N\xE3o autorizado" });
        return;
      }
      if (!user) {
        res.status(401).json({ error: "N\xE3o autorizado" });
        return;
      }
      const appointmentId = parseInt(req.params.id);
      if (isNaN(appointmentId)) {
        res.status(400).json({ error: "ID inv\xE1lido" });
        return;
      }
      const appointment = await getAppointmentById(appointmentId);
      if (!appointment) {
        res.status(404).json({ error: "Agendamento n\xE3o encontrado" });
        return;
      }
      const client = await getClientById(appointment.clientId);
      if (!client) {
        res.status(404).json({ error: "Cliente n\xE3o encontrado" });
        return;
      }
      const studioSettings2 = await getStudioSettings();
      const anamnesisRecords2 = await getAnamnesisByClientId(appointment.clientId);
      const latestAnamnesis = anamnesisRecords2.length > 0 ? anamnesisRecords2[0] : null;
      const baseUrl = process.env.APP_BASE_URL || (process.env.NODE_ENV === "production" ? `https://${process.env.VITE_APP_ID ? "tatuei.com" : "tatuei.manus.space"}` : "http://localhost:3000");
      const { createHash: createHash3 } = await import("crypto");
      const secret = process.env.JWT_SECRET || "secret";
      const token = createHash3("sha256").update(`${appointment.id}:${appointment.date}:${secret}`).digest("hex").slice(0, 16);
      const confirmationLink = `${baseUrl}/confirmar?id=${appointment.id}&token=${token}&status=confirmado`;
      let anamnesisLink = null;
      if (latestAnamnesis) {
        anamnesisLink = `${baseUrl}/anamnese/view/${latestAnamnesis.id}`;
      }
      const { generateIcs: generateIcs2 } = await Promise.resolve().then(() => (init_icsGenerator(), icsGenerator_exports));
      const icsContent = generateIcs2({
        appointment,
        client,
        studio: studioSettings2 ? {
          name: studioSettings2.studioName,
          address: studioSettings2.address,
          phone: studioSettings2.phone
        } : null,
        anamnesis: latestAnamnesis,
        anamnesisLink,
        confirmationLink,
        baseUrl
      });
      const filename = `agendamento-${client.name.replace(/[^a-zA-Z0-9]/g, "-")}-${appointment.date.slice(0, 10)}.ics`;
      res.setHeader("Content-Type", "text/calendar; charset=utf-8; method=PUBLISH");
      res.setHeader("Content-Disposition", `inline; filename="${filename}"`);
      res.send(icsContent);
    } catch (error) {
      console.error("[ICS] Erro ao gerar arquivo:", error);
      res.status(500).json({ error: "Erro interno ao gerar arquivo" });
    }
  });
  app.post("/api/webhook/botconversa/:connectionKey", async (req, res) => {
    try {
      const rawBody = req.rawBody ?? JSON.stringify(req.body ?? {});
      const signature = req.header("x-botconversa-signature") ?? req.header("x-webhook-signature") ?? void 0;
      const result = await receiveBotConversaWebhook({
        connectionKey: req.params.connectionKey,
        rawBody,
        signature
      });
      return res.status(200).json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao processar webhook.";
      const status = message.includes("Assinatura") || message.includes("n\xE3o encontrada") ? 401 : 400;
      console.warn("[Webhook BotConversa] Evento recusado:", message);
      return res.status(status).json({ ok: false, error: status === 401 ? "Webhook n\xE3o autorizado." : "Payload inv\xE1lido." });
    }
  });
  app.post("/api/webhook/whatsapp", async (req, res) => {
    try {
      const body = req.body;
      let phone;
      let message;
      if (body?.subscriber?.phone && body?.last_message?.text) {
        phone = body.subscriber.phone;
        message = body.last_message.text?.trim();
      } else if (body?.phone && body?.text?.message) {
        phone = body.phone;
        message = body.text.message?.trim();
      } else if (body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0]) {
        const msg = body.entry[0].changes[0].value.messages[0];
        phone = msg.from;
        message = msg.text?.body?.trim();
      }
      if (phone && message) {
        const { handleWebhookReply: handleWebhookReply2 } = await Promise.resolve().then(() => (init_webhook(), webhook_exports));
        await handleWebhookReply2(phone, message);
      }
      res.status(200).json({ ok: true });
    } catch (err) {
      console.error("[Webhook] Erro:", err);
      res.status(200).json({ ok: true });
    }
  });
  app.get("/api/webhook/whatsapp", (req, res) => {
    const verify_token = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN ?? "podcrm_verify";
    if (req.query["hub.verify_token"] === verify_token) {
      res.status(200).send(req.query["hub.challenge"]);
    } else {
      res.status(403).send("Forbidden");
    }
  });
  app.post("/api/scheduled/botconversa-jobs", async (req, res) => {
    let scheduleId;
    try {
      const user = await sdk.authenticateRequest(req);
      if (!user.isCron || !user.taskUid) return res.status(403).json({ error: "cron-only" });
      const schedule = await getIntegrationScheduleByTaskUid(user.taskUid);
      if (!schedule || !schedule.isEnabled) return res.json({ ok: true, skipped: "orphan_or_disabled" });
      scheduleId = schedule.id;
      const automatic = await runLegacyNotificationCycle();
      const queue = await processPendingIntegrationJobs(10);
      await recordIntegrationScheduleRun(schedule.id, {});
      return res.json({ ok: true, automatic, queue });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (scheduleId) await recordIntegrationScheduleRun(scheduleId, { error: message }).catch(() => void 0);
      console.error("[Heartbeat] Falha ao processar integra\xE7\xE3o:", error);
      return res.status(500).json({
        error: message,
        context: { url: req.originalUrl },
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      });
    }
  });
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext
    })
  );
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }
  const port = Number(process.env.PORT || 8080);
  server.listen(port, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${port}`);
    console.log("[Scheduler] Processamento peri\xF3dico dispon\xEDvel via Heartbeat.");
  });
}
startServer().catch(console.error);
