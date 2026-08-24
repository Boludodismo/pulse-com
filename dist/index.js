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
  appointmentReminders: () => appointmentReminders,
  appointments: () => appointments,
  artists: () => artists,
  auditLogs: () => auditLogs,
  calendars: () => calendars,
  catalogBrands: () => catalogBrands,
  catalogProductLines: () => catalogProductLines,
  catalogVariants: () => catalogVariants,
  clientNotes: () => clientNotes,
  clients: () => clients,
  collaboratorRates: () => collaboratorRates,
  galleryImages: () => galleryImages,
  materials: () => materials,
  messageQueue: () => messageQueue,
  messageTemplates: () => messageTemplates,
  notificationLogs: () => notificationLogs,
  passwordResetTokens: () => passwordResetTokens,
  procedureConsumables: () => procedureConsumables,
  procedureEvents: () => procedureEvents,
  procedureImages: () => procedureImages,
  procedureKitItems: () => procedureKitItems,
  procedureKits: () => procedureKits,
  purchaseOrderItems: () => purchaseOrderItems,
  purchaseOrders: () => purchaseOrders,
  reportTemplates: () => reportTemplates,
  stockMovements: () => stockMovements,
  studioSettings: () => studioSettings,
  studios: () => studios,
  supplierCatalogOfferings: () => supplierCatalogOfferings,
  suppliers: () => suppliers,
  technicalProcedures: () => technicalProcedures,
  transactions: () => transactions,
  users: () => users,
  whatsappIntegrations: () => whatsappIntegrations
});
import { mysqlTable, index, uniqueIndex, int, bigint, varchar, mysqlEnum, timestamp, datetime, text, tinyint, decimal } from "drizzle-orm/mysql-core";
import { sql } from "drizzle-orm";
var anamneseRequests, anamneseSubmissions, anamnesisRecords, appointments, artists, auditLogs, calendars, clientNotes, clients, galleryImages, notificationLogs, reportTemplates, studioSettings, studios, transactions, users, suppliers, catalogBrands, catalogProductLines, catalogVariants, supplierCatalogOfferings, materials, stockMovements, purchaseOrders, purchaseOrderItems, appointmentReminders, collaboratorRates, passwordResetTokens, technicalProcedures, procedureConsumables, procedureImages, procedureEvents, whatsappIntegrations, messageTemplates, messageQueue, procedureKits, procedureKitItems;
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
      passwordHash: varchar({ length: 255 })
    }, (table) => [uniqueIndex("idx_users_openId").on(table.openId)]);
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
    catalogBrands = mysqlTable("catalog_brands", {
      id: int().autoincrement().notNull(),
      name: varchar({ length: 255 }).notNull(),
      slug: varchar({ length: 255 }).notNull(),
      origin: varchar({ length: 100 }),
      website: varchar({ length: 500 }),
      isActive: tinyint().default(1).notNull(),
      createdAt: bigint({ mode: "number" }).default(0).notNull(),
      updatedAt: bigint({ mode: "number" }).default(0).notNull()
    }, (table) => [
      uniqueIndex("catalog_brands_slug_unique").on(table.slug),
      index("catalog_brands_name_idx").on(table.name)
    ]);
    catalogProductLines = mysqlTable("catalog_product_lines", {
      id: int().autoincrement().notNull(),
      brandId: int().notNull(),
      name: varchar({ length: 255 }).notNull(),
      category: varchar({ length: 100 }).notNull(),
      description: text(),
      isActive: tinyint().default(1).notNull(),
      createdAt: bigint({ mode: "number" }).default(0).notNull(),
      updatedAt: bigint({ mode: "number" }).default(0).notNull()
    }, (table) => [
      uniqueIndex("catalog_product_lines_brand_name_unique").on(table.brandId, table.name),
      index("catalog_product_lines_category_idx").on(table.category)
    ]);
    catalogVariants = mysqlTable("catalog_variants", {
      id: int().autoincrement().notNull(),
      lineId: int().notNull(),
      name: varchar({ length: 255 }).notNull(),
      sku: varchar({ length: 255 }),
      category: varchar({ length: 100 }).notNull(),
      format: varchar({ length: 100 }),
      needleCount: int(),
      needleDiameter: decimal({ precision: 5, scale: 2 }),
      taper: varchar({ length: 100 }),
      packageQuantity: int(),
      packageUnit: varchar({ length: 500 }),
      application: text(),
      evidenceStatus: mysqlEnum(["fabricante", "fornecedor", "pendente", "bloqueado"]).default("pendente").notNull(),
      sourceUrl: varchar({ length: 1e3 }),
      notes: text(),
      sortOrder: int().default(0).notNull(),
      isActive: tinyint().default(1).notNull(),
      createdAt: bigint({ mode: "number" }).default(0).notNull(),
      updatedAt: bigint({ mode: "number" }).default(0).notNull()
    }, (table) => [
      index("catalog_variants_line_idx").on(table.lineId),
      index("catalog_variants_category_idx").on(table.category),
      index("catalog_variants_sku_idx").on(table.sku),
      index("catalog_variants_format_idx").on(table.format)
    ]);
    supplierCatalogOfferings = mysqlTable("supplier_catalog_offerings", {
      id: int().autoincrement().notNull(),
      supplierId: int().notNull(),
      brandId: int().notNull(),
      lineId: int(),
      variantId: int(),
      sourceUrl: varchar({ length: 1e3 }),
      evidenceStatus: mysqlEnum(["item", "marca", "pendente"]).default("pendente").notNull(),
      lastVerifiedAt: bigint({ mode: "number" }),
      notes: text(),
      isActive: tinyint().default(1).notNull(),
      createdAt: bigint({ mode: "number" }).default(0).notNull(),
      updatedAt: bigint({ mode: "number" }).default(0).notNull()
    }, (table) => [
      index("supplier_catalog_offerings_supplier_idx").on(table.supplierId),
      index("supplier_catalog_offerings_brand_idx").on(table.brandId),
      index("supplier_catalog_offerings_line_idx").on(table.lineId),
      index("supplier_catalog_offerings_variant_idx").on(table.variantId)
    ]);
    materials = mysqlTable("materials", {
      id: int().autoincrement().notNull(),
      name: varchar({ length: 255 }).notNull(),
      category: varchar({ length: 100 }),
      unit: varchar({ length: 50 }),
      currentStock: decimal({ precision: 10, scale: 2 }).default("0").notNull(),
      minStock: decimal({ precision: 10, scale: 2 }).default("0").notNull(),
      avgPrice: decimal({ precision: 10, scale: 2 }).default("0").notNull(),
      supplierId: int(),
      catalogVariantId: int(),
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
      name: varchar({ length: 255 }).notNull().default("WhatsApp Principal"),
      provider: mysqlEnum(["botconversa", "zapi", "meta"]).notNull(),
      phoneNumber: varchar({ length: 30 }).notNull(),
      apiToken: varchar({ length: 1e3 }).notNull(),
      instanceId: varchar({ length: 255 }),
      // Z-API instance ID
      webhookUrl: varchar({ length: 500 }),
      // URL do webhook de retorno
      status: mysqlEnum(["ativo", "inativo", "erro", "aguardando"]).default("aguardando").notNull(),
      lastTestedAt: timestamp({ mode: "string" }),
      lastErrorMessage: text(),
      createdAt: timestamp({ mode: "string" }).default(sql`CURRENT_TIMESTAMP`).notNull(),
      updatedAt: timestamp({ mode: "string" }).default(sql`CURRENT_TIMESTAMP`).notNull()
    });
    messageTemplates = mysqlTable("message_templates", {
      id: int().autoincrement().notNull(),
      name: varchar({ length: 255 }).notNull(),
      trigger: mysqlEnum(["appointment_created", "appointment_confirmed", "appointment_reminder_24h", "appointment_reminder_2h", "appointment_cancelled", "appointment_rescheduled", "custom"]).notNull(),
      recipientType: mysqlEnum(["client", "artist"]).notNull(),
      message: text().notNull(),
      isActive: tinyint().default(1).notNull(),
      createdAt: timestamp({ mode: "string" }).default(sql`CURRENT_TIMESTAMP`).notNull(),
      updatedAt: timestamp({ mode: "string" }).default(sql`CURRENT_TIMESTAMP`).notNull()
    });
    messageQueue = mysqlTable("message_queue", {
      id: int().autoincrement().notNull(),
      integrationId: int().notNull(),
      appointmentId: int(),
      clientId: int(),
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
    });
    procedureKits = mysqlTable("procedure_kits", {
      id: int().autoincrement().notNull(),
      studioId: int().default(1).notNull(),
      name: varchar({ length: 255 }).notNull(),
      description: text(),
      category: varchar({ length: 100 }).default("Geral").notNull(),
      isActive: tinyint().default(1).notNull(),
      createdAt: bigint({ mode: "number" }).default(0).notNull(),
      updatedAt: bigint({ mode: "number" }).default(0).notNull()
    });
    procedureKitItems = mysqlTable("procedure_kit_items", {
      id: int().autoincrement().notNull(),
      kitId: int().notNull(),
      materialId: int().notNull(),
      quantity: decimal({ precision: 10, scale: 2 }).notNull(),
      unit: varchar({ length: 50 }).default("un").notNull()
    });
  }
});

// server/_core/env.ts
var ENV;
var init_env = __esm({
  "server/_core/env.ts"() {
    "use strict";
    ENV = {
      appId: process.env.VITE_APP_ID ?? "",
      cookieSecret: process.env.JWT_SECRET ?? "",
      databaseUrl: process.env.DATABASE_URL ?? "",
      oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
      ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
      isProduction: process.env.NODE_ENV === "production",
      forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
      forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
      // Auth mode: "oauth" (Manus) or "local" (standalone)
      authMode: process.env.AUTH_MODE ?? "oauth",
      // Local auth admin credentials (only used when AUTH_MODE=local)
      localAdminEmail: process.env.LOCAL_ADMIN_EMAIL ?? "admin@podcrm.local",
      localAdminPassword: process.env.LOCAL_ADMIN_PASSWORD ?? "admin123",
      localAdminName: process.env.LOCAL_ADMIN_NAME ?? "Admin",
      // Storage provider: "s3" or "disabled"
      storageProvider: process.env.STORAGE_PROVIDER ?? "s3"
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
import { eq, desc, and, gte, lte, or, like, sql as sql2, ne, inArray } from "drizzle-orm";
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
async function searchClients(term, startDate, endDate) {
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
async function listAppointments(studioId) {
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
  if (studioId != null) {
    return await baseQuery.where(eq(appointments.studioId, studioId)).orderBy(desc(appointments.date));
  }
  return await baseQuery.orderBy(desc(appointments.date));
}
async function getAppointmentsByClientId(clientId) {
  const db = await getDb();
  if (!db) return [];
  const result = await db.select().from(appointments).where(eq(appointments.clientId, clientId)).orderBy(desc(appointments.date));
  return result;
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
async function getTransactionsByDateRange(startDate, endDate) {
  const db = await getDb();
  if (!db) return [];
  const startStr = startDate;
  const endStr = endDate;
  const result = await db.select().from(transactions).where(and(gte(transactions.date, startStr), lte(transactions.date, endStr))).orderBy(desc(transactions.date));
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
async function getMonthlyRevenue(startDate, endDate) {
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
      lte(transactions.date, endStr)
    )
  ).groupBy(sql2`DATE_FORMAT(${transactions.date}, '%Y-%m')`).orderBy(sql2`DATE_FORMAT(${transactions.date}, '%Y-%m')`);
  return result.map((r) => ({
    month: r.month,
    revenue: Number(r.revenue),
    expenses: Number(r.expenses),
    profit: Number(r.revenue) - Number(r.expenses)
  }));
}
async function getCategoryBreakdown(startDate, endDate) {
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
      lte(transactions.date, endStr)
    )
  ).groupBy(transactions.category).orderBy(desc(sql2`COALESCE(SUM(${transactions.amount}), 0)`));
  return result.map((r) => ({
    category: r.category,
    total: Number(r.total),
    count: Number(r.count)
  }));
}
async function getPaymentMethodBreakdown(startDate, endDate) {
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
      lte(transactions.date, toDateStr(endDate))
    )
  ).groupBy(transactions.paymentMethod).orderBy(desc(sql2`COALESCE(SUM(${transactions.amount}), 0)`));
  return result.map((r) => ({
    paymentMethod: r.paymentMethod,
    total: Number(r.total),
    count: Number(r.count)
  }));
}
async function getFinancialSummary(startDate, endDate) {
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
      lte(transactions.date, toDateStr(endDate))
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
async function getUpcomingAppointments() {
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
    status: appointments.status
  }).from(appointments).leftJoin(clients, eq(appointments.clientId, clients.id)).where(
    and(
      gte(appointments.date, toLocalDateStr(tomorrowStart)),
      lte(appointments.date, toLocalDateStr(tomorrowEnd)),
      or(
        eq(appointments.status, "agendado"),
        eq(appointments.status, "confirmado")
      )
    )
  ).orderBy(appointments.date);
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
async function getAppointmentsForWhatsAppReminder(daysBefore, logType) {
  const db = await getDb();
  if (!db) return [];
  const now = /* @__PURE__ */ new Date();
  const targetStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() + daysBefore, 0, 0, 0);
  const targetEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + daysBefore, 23, 59, 59);
  const alreadySentRows = await db.select({ appointmentId: notificationLogs.appointmentId }).from(notificationLogs).where(
    and(
      eq(notificationLogs.type, logType),
      eq(notificationLogs.status, "sent")
    )
  );
  const alreadySentIds = new Set(
    alreadySentRows.map((r) => r.appointmentId).filter((id) => id !== null)
  );
  const result = await db.select({
    id: appointments.id,
    clientId: appointments.clientId,
    clientName: clients.name,
    clientPhone: clients.phone,
    date: appointments.date,
    service: appointments.service,
    artist: appointments.artist,
    status: appointments.status
  }).from(appointments).leftJoin(clients, eq(appointments.clientId, clients.id)).where(
    and(
      gte(appointments.date, toLocalDateStr(targetStart)),
      lte(appointments.date, toLocalDateStr(targetEnd)),
      or(
        eq(appointments.status, "agendado"),
        eq(appointments.status, "confirmado")
      )
    )
  ).orderBy(appointments.date);
  return result.filter((apt) => !alreadySentIds.has(apt.id));
}
async function logWhatsAppReminder({
  appointmentId,
  clientId,
  logType,
  message,
  status
}) {
  const db = await getDb();
  if (!db) return;
  await db.insert(notificationLogs).values({
    type: logType,
    appointmentId,
    clientId,
    title: `WhatsApp autom\xE1tico \u2014 ${logType}`,
    message,
    status
  });
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
async function listArtists() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(artists).orderBy(artists.name);
}
async function getArtistById(id) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(artists).where(eq(artists.id, id)).limit(1);
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
async function listCatalogBrands() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(catalogBrands).where(eq(catalogBrands.isActive, 1)).orderBy(catalogBrands.name);
}
async function listCatalogProductLines(brandId, category) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [eq(catalogProductLines.isActive, 1)];
  if (brandId) conditions.push(eq(catalogProductLines.brandId, brandId));
  if (category) conditions.push(eq(catalogProductLines.category, category));
  return db.select({
    id: catalogProductLines.id,
    brandId: catalogProductLines.brandId,
    name: catalogProductLines.name,
    category: catalogProductLines.category,
    description: catalogProductLines.description,
    brandName: catalogBrands.name
  }).from(catalogProductLines).innerJoin(catalogBrands, eq(catalogBrands.id, catalogProductLines.brandId)).where(and(...conditions)).orderBy(catalogBrands.name, catalogProductLines.name);
}
async function searchCatalogVariants(input = {}) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [
    eq(catalogVariants.isActive, 1),
    eq(catalogProductLines.isActive, 1),
    eq(catalogBrands.isActive, 1)
  ];
  if (input.category) conditions.push(eq(catalogVariants.category, input.category));
  if (input.brandId) conditions.push(eq(catalogBrands.id, input.brandId));
  if (input.lineId) conditions.push(eq(catalogProductLines.id, input.lineId));
  if (input.formats?.length) conditions.push(inArray(catalogVariants.format, input.formats));
  if (input.needleCount !== void 0) conditions.push(eq(catalogVariants.needleCount, input.needleCount));
  if (input.needleDiameter !== void 0) conditions.push(eq(catalogVariants.needleDiameter, String(input.needleDiameter)));
  if (input.taper) conditions.push(eq(catalogVariants.taper, input.taper));
  const tokens = (input.query ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").replace(/[,]/g, ".").split(/\s+/).filter(Boolean).slice(0, 8);
  for (const token of tokens) {
    conditions.push(sql2`LOWER(CONCAT_WS(' ',
      ${catalogBrands.name}, ${catalogProductLines.name}, ${catalogVariants.name},
      ${catalogVariants.sku}, ${catalogVariants.format}, ${catalogVariants.needleCount},
      ${catalogVariants.needleDiameter}, ${catalogVariants.taper}, ${catalogVariants.packageQuantity},
      ${catalogVariants.packageUnit}, ${catalogVariants.application}
    )) LIKE ${`%${token}%`}`);
  }
  const variants = await db.select({
    id: catalogVariants.id,
    lineId: catalogVariants.lineId,
    name: catalogVariants.name,
    sku: catalogVariants.sku,
    category: catalogVariants.category,
    format: catalogVariants.format,
    needleCount: catalogVariants.needleCount,
    needleDiameter: catalogVariants.needleDiameter,
    taper: catalogVariants.taper,
    packageQuantity: catalogVariants.packageQuantity,
    packageUnit: catalogVariants.packageUnit,
    application: catalogVariants.application,
    evidenceStatus: catalogVariants.evidenceStatus,
    sourceUrl: catalogVariants.sourceUrl,
    notes: catalogVariants.notes,
    sortOrder: catalogVariants.sortOrder,
    lineName: catalogProductLines.name,
    brandId: catalogBrands.id,
    brandName: catalogBrands.name
  }).from(catalogVariants).innerJoin(catalogProductLines, eq(catalogProductLines.id, catalogVariants.lineId)).innerJoin(catalogBrands, eq(catalogBrands.id, catalogProductLines.brandId)).where(and(...conditions)).orderBy(catalogBrands.name, catalogProductLines.name, catalogVariants.format, catalogVariants.needleCount, catalogVariants.needleDiameter, catalogVariants.sortOrder).limit(Math.min(input.limit ?? 100, 200));
  const offeringRows = await db.select({
    id: supplierCatalogOfferings.id,
    supplierId: supplierCatalogOfferings.supplierId,
    supplierName: suppliers.name,
    supplierPhone: suppliers.phone,
    supplierWhatsapp: suppliers.whatsapp,
    brandId: supplierCatalogOfferings.brandId,
    lineId: supplierCatalogOfferings.lineId,
    variantId: supplierCatalogOfferings.variantId,
    sourceUrl: supplierCatalogOfferings.sourceUrl,
    evidenceStatus: supplierCatalogOfferings.evidenceStatus,
    lastVerifiedAt: supplierCatalogOfferings.lastVerifiedAt,
    notes: supplierCatalogOfferings.notes
  }).from(supplierCatalogOfferings).innerJoin(suppliers, eq(suppliers.id, supplierCatalogOfferings.supplierId)).where(and(eq(supplierCatalogOfferings.isActive, 1), eq(suppliers.isActive, 1)));
  const supplierFilteredVariants = input.supplierId ? variants.filter((variant) => offeringRows.some((offering) => offering.supplierId === input.supplierId && (offering.variantId === variant.id || !offering.variantId && offering.lineId === variant.lineId || !offering.variantId && !offering.lineId && offering.brandId === variant.brandId))) : variants;
  return supplierFilteredVariants.map((variant) => {
    const offers = offeringRows.filter((offering) => offering.variantId === variant.id || !offering.variantId && offering.lineId === variant.lineId || !offering.variantId && !offering.lineId && offering.brandId === variant.brandId).map((offering) => ({
      ...offering,
      matchLevel: offering.variantId === variant.id ? "item" : offering.lineId === variant.lineId ? "linha" : "marca"
    }));
    return { ...variant, suppliers: offers };
  });
}
async function getCatalogVariantById(id) {
  const db = await getDb();
  if (!db) return void 0;
  const rows = await db.select({
    id: catalogVariants.id,
    lineId: catalogVariants.lineId,
    name: catalogVariants.name,
    sku: catalogVariants.sku,
    category: catalogVariants.category,
    format: catalogVariants.format,
    needleCount: catalogVariants.needleCount,
    needleDiameter: catalogVariants.needleDiameter,
    taper: catalogVariants.taper,
    packageQuantity: catalogVariants.packageQuantity,
    packageUnit: catalogVariants.packageUnit,
    application: catalogVariants.application,
    evidenceStatus: catalogVariants.evidenceStatus,
    sourceUrl: catalogVariants.sourceUrl,
    notes: catalogVariants.notes,
    lineName: catalogProductLines.name,
    brandId: catalogBrands.id,
    brandName: catalogBrands.name
  }).from(catalogVariants).innerJoin(catalogProductLines, eq(catalogProductLines.id, catalogVariants.lineId)).innerJoin(catalogBrands, eq(catalogBrands.id, catalogProductLines.brandId)).where(and(eq(catalogVariants.id, id), eq(catalogVariants.isActive, 1))).limit(1);
  return rows[0];
}
async function listSupplierCatalogOfferings(supplierId) {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    id: supplierCatalogOfferings.id,
    supplierId: supplierCatalogOfferings.supplierId,
    brandId: supplierCatalogOfferings.brandId,
    brandName: catalogBrands.name,
    lineId: supplierCatalogOfferings.lineId,
    lineName: catalogProductLines.name,
    variantId: supplierCatalogOfferings.variantId,
    variantName: catalogVariants.name,
    variantSku: catalogVariants.sku,
    sourceUrl: supplierCatalogOfferings.sourceUrl,
    evidenceStatus: supplierCatalogOfferings.evidenceStatus,
    lastVerifiedAt: supplierCatalogOfferings.lastVerifiedAt,
    notes: supplierCatalogOfferings.notes
  }).from(supplierCatalogOfferings).innerJoin(catalogBrands, eq(catalogBrands.id, supplierCatalogOfferings.brandId)).leftJoin(catalogProductLines, eq(catalogProductLines.id, supplierCatalogOfferings.lineId)).leftJoin(catalogVariants, eq(catalogVariants.id, supplierCatalogOfferings.variantId)).where(and(eq(supplierCatalogOfferings.supplierId, supplierId), eq(supplierCatalogOfferings.isActive, 1))).orderBy(catalogBrands.name, catalogProductLines.name, catalogVariants.name);
}
async function createSupplierCatalogOffering(data) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const now = Date.now();
  const result = await db.insert(supplierCatalogOfferings).values({
    ...data,
    createdAt: now,
    updatedAt: now
  });
  return result[0].insertId;
}
async function deactivateSupplierCatalogOffering(id) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(supplierCatalogOfferings).set({ isActive: 0, updatedAt: Date.now() }).where(eq(supplierCatalogOfferings.id, id));
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
    catalogVariantId: materials.catalogVariantId,
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
async function listProcedureKits(studioId = 1) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(procedureKits).where(and(eq(procedureKits.studioId, studioId), eq(procedureKits.isActive, 1))).orderBy(procedureKits.category, procedureKits.name);
}
async function getProcedureKitById(id, studioId = 1) {
  const db = await getDb();
  if (!db) return void 0;
  const [kit] = await db.select().from(procedureKits).where(and(eq(procedureKits.id, id), eq(procedureKits.studioId, studioId), eq(procedureKits.isActive, 1))).limit(1);
  if (!kit) return void 0;
  const items = await db.select({
    id: procedureKitItems.id,
    materialId: procedureKitItems.materialId,
    materialName: materials.name,
    materialCategory: materials.category,
    materialUnit: materials.unit,
    currentStock: materials.currentStock,
    avgPrice: materials.avgPrice,
    quantity: procedureKitItems.quantity,
    unit: procedureKitItems.unit
  }).from(procedureKitItems).innerJoin(materials, eq(materials.id, procedureKitItems.materialId)).where(eq(procedureKitItems.kitId, id)).orderBy(materials.name);
  return { ...kit, items };
}
async function createProcedureKit(data) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const now = Date.now();
  return db.transaction(async (tx) => {
    const [result] = await tx.insert(procedureKits).values({
      studioId: data.studioId,
      name: data.name,
      description: data.description,
      category: data.category,
      isActive: 1,
      createdAt: now,
      updatedAt: now
    });
    const kitId = Number(result.insertId);
    await tx.insert(procedureKitItems).values(data.items.map((item) => ({
      kitId,
      materialId: item.materialId,
      quantity: item.quantity,
      unit: item.unit
    })));
    return kitId;
  });
}
async function updateProcedureKit(id, studioId, data) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.transaction(async (tx) => {
    const [kit] = await tx.select().from(procedureKits).where(and(eq(procedureKits.id, id), eq(procedureKits.studioId, studioId), eq(procedureKits.isActive, 1))).limit(1);
    if (!kit) throw new Error("Kit n\xE3o encontrado");
    await tx.update(procedureKits).set({
      name: data.name,
      description: data.description,
      category: data.category,
      updatedAt: Date.now()
    }).where(eq(procedureKits.id, id));
    await tx.delete(procedureKitItems).where(eq(procedureKitItems.kitId, id));
    await tx.insert(procedureKitItems).values(data.items.map((item) => ({
      kitId: id,
      materialId: item.materialId,
      quantity: item.quantity,
      unit: item.unit
    })));
    return { success: true };
  });
}
async function deleteProcedureKit(id, studioId) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(procedureKits).set({ isActive: 0, updatedAt: Date.now() }).where(and(eq(procedureKits.id, id), eq(procedureKits.studioId, studioId)));
  return { success: true };
}
function kitConsumableCategory(category) {
  const normalized = (category || "").toLowerCase();
  if (normalized.includes("tinta")) return "ink";
  if (normalized.includes("agulha") || normalized.includes("cartucho")) return "cartridge";
  if (normalized.includes("higiene") || normalized.includes("descart")) return "disposable";
  if (normalized.includes("prote\xE7\xE3o") || normalized.includes("protecao")) return "protection";
  if (normalized.includes("l\xEDquido") || normalized.includes("liquido")) return "liquid";
  if (normalized.includes("cuidado") || normalized.includes("after")) return "aftercare";
  if (normalized.includes("papel") || normalized.includes("stencil")) return "stencil";
  return "other";
}
function kitConsumableUnit(unit) {
  const normalized = (unit || "").toLowerCase();
  if (normalized === "ml" || normalized === "l") return "ml";
  if (normalized === "g" || normalized === "kg") return "gram";
  if (normalized === "par") return "pair";
  if (normalized === "rolo" || normalized === "m") return "roll_fraction";
  return "unit";
}
async function applyProcedureKitToProcedure(data) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.transaction(async (tx) => {
    const [kit] = await tx.select().from(procedureKits).where(and(eq(procedureKits.id, data.kitId), eq(procedureKits.studioId, data.studioId), eq(procedureKits.isActive, 1))).limit(1);
    if (!kit) throw new Error("Kit n\xE3o encontrado");
    const [procedure] = await tx.select().from(technicalProcedures).where(and(eq(technicalProcedures.id, data.procedureId), eq(technicalProcedures.studioId, data.studioId))).limit(1);
    if (!procedure) throw new Error("Procedimento n\xE3o encontrado");
    const items = await tx.select({
      materialId: procedureKitItems.materialId,
      quantity: procedureKitItems.quantity,
      kitUnit: procedureKitItems.unit,
      materialName: materials.name,
      materialCategory: materials.category,
      materialUnit: materials.unit,
      currentStock: materials.currentStock,
      avgPrice: materials.avgPrice
    }).from(procedureKitItems).innerJoin(materials, eq(materials.id, procedureKitItems.materialId)).where(eq(procedureKitItems.kitId, data.kitId));
    if (!items.length) throw new Error("O kit n\xE3o possui insumos");
    const parsedItems = items.map((item) => {
      const quantity = Number(item.quantity);
      const currentStock = Number(item.currentStock || 0);
      if (!Number.isFinite(quantity) || quantity <= 0) throw new Error(`Quantidade inv\xE1lida para ${item.materialName}`);
      if (currentStock < quantity) throw new Error(`Estoque insuficiente para ${item.materialName}`);
      return { ...item, quantity, currentStock, avgPrice: Number(item.avgPrice || 0) };
    });
    for (const item of parsedItems) {
      const newStock = item.currentStock - item.quantity;
      await tx.insert(stockMovements).values({
        materialId: item.materialId,
        type: "saida",
        quantity: String(item.quantity),
        previousStock: String(item.currentStock),
        newStock: String(newStock),
        reason: `Kit de procedimento: ${kit.name}`,
        createdBy: data.createdBy,
        createdAt: Date.now()
      });
      await tx.update(materials).set({ currentStock: String(newStock), updatedAt: Date.now() }).where(eq(materials.id, item.materialId));
      const unit = kitConsumableUnit(item.materialUnit || item.kitUnit);
      await tx.insert(procedureConsumables).values({
        procedureId: data.procedureId,
        inventoryItemId: item.materialId,
        category: kitConsumableCategory(item.materialCategory),
        name: item.materialName,
        unit,
        quantity: String(item.quantity),
        estimatedUnitCost: String(item.avgPrice),
        estimatedTotalCost: String(item.avgPrice * item.quantity),
        notes: `Aplicado pelo kit ${kit.name}`
      });
    }
    await tx.insert(procedureEvents).values({
      procedureId: data.procedureId,
      eventType: "consumable_added",
      payload: JSON.stringify({ kitId: kit.id, kitName: kit.name, itemCount: parsedItems.length }),
      createdAt: (/* @__PURE__ */ new Date()).toISOString().slice(0, 19).replace("T", " ")
    });
    return { success: true, kitId: kit.id, kitName: kit.name, itemCount: parsedItems.length };
  });
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
async function getPendingRemindersToSend() {
  const db = await getDb();
  if (!db) return [];
  const now = toLocalDateStr(/* @__PURE__ */ new Date());
  const rows = await db.select({
    id: appointmentReminders.id,
    appointmentId: appointmentReminders.appointmentId,
    scheduledAt: appointmentReminders.scheduledAt,
    message: appointmentReminders.message,
    status: appointmentReminders.status,
    sentAt: appointmentReminders.sentAt,
    createdAt: appointmentReminders.createdAt,
    updatedAt: appointmentReminders.updatedAt,
    clientName: clients.name,
    clientPhone: clients.phone,
    appointmentDate: appointments.date,
    service: appointments.service,
    artist: appointments.artist
  }).from(appointmentReminders).leftJoin(appointments, eq(appointments.id, appointmentReminders.appointmentId)).leftJoin(clients, eq(clients.id, appointments.clientId)).where(
    and(
      eq(appointmentReminders.status, "pending"),
      lte(appointmentReminders.scheduledAt, now)
    )
  ).orderBy(appointmentReminders.scheduledAt);
  return rows;
}
async function markReminderSent(id) {
  const db = await getDb();
  if (!db) return;
  await db.update(appointmentReminders).set({
    status: "sent",
    sentAt: toDateStr(/* @__PURE__ */ new Date())
  }).where(eq(appointmentReminders.id, id));
}
async function markReminderFailed(id) {
  const db = await getDb();
  if (!db) return;
  await db.update(appointmentReminders).set({
    status: "failed"
  }).where(eq(appointmentReminders.id, id));
}
async function getAllPendingReminders() {
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
  }).from(appointmentReminders).leftJoin(appointments, eq(appointments.id, appointmentReminders.appointmentId)).leftJoin(clients, eq(clients.id, appointments.clientId)).where(eq(appointmentReminders.status, "pending")).orderBy(appointmentReminders.scheduledAt);
  return rows;
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
async function getCollaboratorsSummary(studioId, period, referenceDate) {
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
  return artistsList.map((artist) => {
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
  return {
    httpOnly: true,
    path: "/",
    sameSite: "none",
    secure: isSecureRequest(req)
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
var isNonEmptyString2, EXCHANGE_TOKEN_PATH, GET_USER_INFO_PATH, GET_USER_INFO_WITH_JWT_PATH, OAuthService, createOAuthHttpClient, SDKServer, sdk;
var init_sdk = __esm({
  "server/_core/sdk.ts"() {
    "use strict";
    init_const();
    init_errors();
    init_db();
    init_env();
    isNonEmptyString2 = (value) => typeof value === "string" && value.length > 0;
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
            appId: ENV.appId,
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

// server/storage.ts
var storage_exports = {};
__export(storage_exports, {
  storageGet: () => storageGet,
  storagePut: () => storagePut
});
function getStorageConfig() {
  if (ENV.storageProvider === "disabled") {
    throw new Error("Storage is disabled (STORAGE_PROVIDER=disabled)");
  }
  const baseUrl = ENV.forgeApiUrl;
  const apiKey = ENV.forgeApiKey;
  if (!baseUrl || !apiKey) {
    throw new Error(
      "Storage proxy credentials missing: set BUILT_IN_FORGE_API_URL and BUILT_IN_FORGE_API_KEY"
    );
  }
  return { baseUrl: baseUrl.replace(/\/+$/, ""), apiKey };
}
function buildUploadUrl(baseUrl, relKey) {
  const url = new URL("v1/storage/upload", ensureTrailingSlash(baseUrl));
  url.searchParams.set("path", normalizeKey(relKey));
  return url;
}
async function buildDownloadUrl(baseUrl, relKey, apiKey) {
  const downloadApiUrl = new URL(
    "v1/storage/downloadUrl",
    ensureTrailingSlash(baseUrl)
  );
  downloadApiUrl.searchParams.set("path", normalizeKey(relKey));
  const response = await fetch(downloadApiUrl, {
    method: "GET",
    headers: buildAuthHeaders(apiKey)
  });
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
  if (ENV.storageProvider === "disabled") {
    console.warn("[Storage] Upload skipped - storage is disabled");
    return { key: relKey, url: "" };
  }
  const { baseUrl, apiKey } = getStorageConfig();
  const key = normalizeKey(relKey);
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
  if (ENV.storageProvider === "disabled") {
    console.warn("[Storage] Download skipped - storage is disabled");
    return { key: relKey, url: "" };
  }
  const { baseUrl, apiKey } = getStorageConfig();
  const key = normalizeKey(relKey);
  return {
    key,
    url: await buildDownloadUrl(baseUrl, key, apiKey)
  };
}
var init_storage = __esm({
  "server/storage.ts"() {
    "use strict";
    init_env();
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

// server/messaging/providers/botconversa.ts
var BotConversaProvider;
var init_botconversa = __esm({
  "server/messaging/providers/botconversa.ts"() {
    "use strict";
    BotConversaProvider = class {
      apiToken;
      baseUrl = "https://backend.botconversa.com.br/api/v1";
      constructor(config) {
        this.apiToken = config.apiToken;
      }
      async sendMessage(to, message) {
        try {
          const phone = to.replace(/[\s\-\+\(\)]/g, "");
          const res = await fetch(`${this.baseUrl}/webhook/send-text/`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "api-token": this.apiToken
            },
            body: JSON.stringify({ phone, message })
          });
          if (!res.ok) {
            const body = await res.text();
            return { success: false, error: `HTTP ${res.status}: ${body}` };
          }
          const data = await res.json();
          return {
            success: true,
            messageId: data?.id?.toString() ?? data?.message_id?.toString()
          };
        } catch (err) {
          return { success: false, error: err?.message ?? "Erro desconhecido" };
        }
      }
      async testConnection() {
        try {
          const res = await fetch(`${this.baseUrl}/webhook/subscriber/`, {
            method: "GET",
            headers: { "api-token": this.apiToken }
          });
          if (res.ok) {
            return { success: true, details: "Conex\xE3o com BotConversa estabelecida com sucesso." };
          }
          const body = await res.text();
          return { success: false, error: `HTTP ${res.status}: ${body}` };
        } catch (err) {
          return { success: false, error: err?.message ?? "Falha ao conectar com BotConversa" };
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

// server/messaging/service.ts
var service_exports = {};
__export(service_exports, {
  dispatchTemplateMessage: () => dispatchTemplateMessage,
  getActiveIntegration: () => getActiveIntegration,
  getProvider: () => getProvider,
  getTemplate: () => getTemplate,
  seedDefaultTemplates: () => seedDefaultTemplates,
  sendAndLog: () => sendAndLog
});
import { eq as eq3 } from "drizzle-orm";
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
async function getActiveIntegration() {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(whatsappIntegrations).where(eq3(whatsappIntegrations.status, "ativo")).limit(1);
  return rows[0] ?? null;
}
async function sendAndLog(params) {
  const integration = await getActiveIntegration();
  if (!integration) {
    console.warn("[Messaging] Nenhuma integra\xE7\xE3o ativa encontrada.");
    return { success: false, error: "Nenhuma integra\xE7\xE3o ativa" };
  }
  const db = await getDb();
  if (!db) return { success: false, error: "Banco de dados indispon\xEDvel" };
  const [queued] = await db.insert(messageQueue).values({
    integrationId: integration.id,
    appointmentId: params.appointmentId,
    clientId: params.clientId,
    recipientPhone: params.recipientPhone,
    recipientName: params.recipientName,
    recipientType: params.recipientType,
    message: params.message,
    trigger: params.trigger,
    status: "pendente",
    scheduledAt: (/* @__PURE__ */ new Date()).toISOString().slice(0, 19).replace("T", " ")
  });
  const provider = getProvider({
    provider: integration.provider,
    apiToken: integration.apiToken,
    phoneNumber: integration.phoneNumber,
    instanceId: integration.instanceId ?? void 0
  });
  const result = await provider.sendMessage(params.recipientPhone, params.message);
  const queueId = queued.insertId;
  if (queueId) {
    await db.update(messageQueue).set({
      status: result.success ? "enviada" : "erro",
      sentAt: result.success ? (/* @__PURE__ */ new Date()).toISOString().slice(0, 19).replace("T", " ") : void 0,
      errorMessage: result.error,
      providerMessageId: result.messageId
    }).where(eq3(messageQueue.id, queueId));
  }
  return result;
}
async function getTemplate(trigger, recipientType) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(messageTemplates).where(eq3(messageTemplates.trigger, trigger)).limit(10);
  const template = rows.find(
    (r) => r.recipientType === recipientType && r.isActive
  );
  return template?.message ?? null;
}
async function dispatchTemplateMessage(params) {
  const template = await getTemplate(params.trigger, params.recipientType);
  if (!template) return { success: false, error: "Template n\xE3o encontrado" };
  const message = interpolateTemplate(template, params.vars);
  return sendAndLog({
    recipientPhone: params.recipientPhone,
    recipientName: params.recipientName,
    recipientType: params.recipientType,
    message,
    trigger: params.trigger,
    appointmentId: params.appointmentId,
    clientId: params.clientId
  });
}
async function seedDefaultTemplates() {
  const db = await getDb();
  if (!db) return;
  const existing = await db.select().from(messageTemplates).limit(1);
  if (existing.length > 0) return;
  await db.insert(messageTemplates).values([
    {
      name: "Confirma\xE7\xE3o de Agendamento (Cliente)",
      trigger: "appointment_created",
      recipientType: "client",
      message: "Ol\xE1, {nome_cliente}! \u{1F3A8} Sua sess\xE3o no {nome_estudio} est\xE1 marcada para {data} \xE0s {hora}, com {nome_tatuador}.\n\nResponda *1* para confirmar ou *2* para solicitar remarca\xE7\xE3o.",
      isActive: 1
    },
    {
      name: "Notifica\xE7\xE3o de Agendamento (Tatuador)",
      trigger: "appointment_created",
      recipientType: "artist",
      message: "{nome_tatuador}, voc\xEA tem um novo agendamento!\n\nCliente: {nome_cliente}\nData: {data} \xE0s {hora}\nServi\xE7o: {servico}\n\nO cliente foi notificado e aguarda confirma\xE7\xE3o.",
      isActive: 1
    },
    {
      name: "Lembrete 24h (Cliente)",
      trigger: "appointment_reminder_24h",
      recipientType: "client",
      message: "Ol\xE1, {nome_cliente}! \u{1F550} Lembrando que sua sess\xE3o no {nome_estudio} \xE9 amanh\xE3, {data} \xE0s {hora}, com {nome_tatuador}.\n\nEndere\xE7o: {endereco}\n\nResponda *1* para confirmar presen\xE7a.",
      isActive: 1
    },
    {
      name: "Lembrete 24h (Tatuador)",
      trigger: "appointment_reminder_24h",
      recipientType: "artist",
      message: "{nome_tatuador}, lembrete: amanh\xE3 voc\xEA tem sess\xE3o com {nome_cliente} \xE0s {hora}.\n\nServi\xE7o: {servico}",
      isActive: 1
    },
    {
      name: "Confirma\xE7\xE3o pelo Cliente",
      trigger: "appointment_confirmed",
      recipientType: "artist",
      message: "{nome_tatuador}, o cliente {nome_cliente} *confirmou* o agendamento de {data} \xE0s {hora}. \u2705",
      isActive: 1
    },
    {
      name: "Solicita\xE7\xE3o de Remarca\xE7\xE3o",
      trigger: "appointment_rescheduled",
      recipientType: "artist",
      message: "{nome_tatuador}, o cliente {nome_cliente} *solicitou remarca\xE7\xE3o* do agendamento de {data} \xE0s {hora}. Por favor, entre em contato.",
      isActive: 1
    }
  ]);
}
var init_service = __esm({
  "server/messaging/service.ts"() {
    "use strict";
    init_db();
    init_schema();
    init_provider();
    init_botconversa();
    init_zapi();
    init_meta();
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
  const dtStart = toIcsDateTime(appointment.date);
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
  const dtEnd = `${endDate.getUTCFullYear()}${pad(endDate.getUTCMonth() + 1)}${pad(endDate.getUTCDate())}T${pad(endDate.getUTCHours())}${pad(endDate.getUTCMinutes())}${pad(endDate.getUTCSeconds())}Z`;
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
    "BEGIN:VEVENT",
    foldLine(`UID:${uid}`),
    foldLine(`DTSTAMP:${dtstamp}`),
    foldLine(`DTSTART:${dtStart}`),
    foldLine(`DTEND:${dtEnd}`),
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
import { eq as eq5, desc as desc4 } from "drizzle-orm";
async function handleWebhookReply(phone, message) {
  const db = await getDb();
  if (!db) return;
  const normalizedPhone = phone.replace(/[\s\-\+\(\)]/g, "");
  const reply = message.trim();
  const recentMessages = await db.select().from(messageQueue).where(eq5(messageQueue.recipientPhone, normalizedPhone)).orderBy(desc4(messageQueue.createdAt)).limit(5);
  const lastMsg = recentMessages.find((m) => m.appointmentId && m.recipientType === "client");
  if (!lastMsg?.appointmentId) {
    console.log(`[Webhook] Nenhum agendamento encontrado para ${normalizedPhone}`);
    return;
  }
  const appointmentId = lastMsg.appointmentId;
  const clientId = lastMsg.clientId;
  const aptRows = await db.select().from(appointments).where(eq5(appointments.id, appointmentId)).limit(1);
  const apt = aptRows[0];
  if (!apt) return;
  const aptDate = new Date(apt.date.replace(" ", "T"));
  const dataFormatada = aptDate.toLocaleDateString("pt-BR");
  const horaFormatada = aptDate.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  if (reply === "1") {
    await db.update(appointments).set({ confirmationStatus: "confirmado" }).where(eq5(appointments.id, appointmentId));
    await db.update(messageQueue).set({ status: "respondida" }).where(eq5(messageQueue.id, lastMsg.id));
    console.log(`[Webhook] Cliente ${normalizedPhone} CONFIRMOU agendamento #${appointmentId}`);
    await notifyArtistAboutReply(apt, "appointment_confirmed", {
      nome_tatuador: apt.artist,
      nome_cliente: apt.clientName ?? "Cliente",
      data: dataFormatada,
      hora: horaFormatada
    });
  } else if (reply === "2") {
    await db.update(appointments).set({ status: "reagendado", confirmationStatus: "nao_confirmado" }).where(eq5(appointments.id, appointmentId));
    await db.update(messageQueue).set({ status: "respondida" }).where(eq5(messageQueue.id, lastMsg.id));
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
    const artistRows = await db.select().from(artists2).where(eq5(artists2.id, apt.artistId)).limit(1);
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
import { TRPCError as TRPCError6 } from "@trpc/server";

// server/_core/systemRouter.ts
init_notification();
import { z } from "zod";

// server/_core/trpc.ts
init_const();
import { initTRPC, TRPCError as TRPCError2 } from "@trpc/server";
import superjson from "superjson";
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
  return next({
    ctx: {
      ...ctx,
      user: ctx.user
    }
  });
});
var protectedProcedure = t.procedure.use(requireUser);
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
        artistId: ctx.user.role === "admin" ? null : ctx.user.artistId
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

// server/scheduler.ts
init_db();
init_notification();
init_const();
import { createHash } from "crypto";
var lastRun = {};
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
function todayStr() {
  return (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
}
function currentTimeStr() {
  const now = /* @__PURE__ */ new Date();
  const h = String(now.getHours()).padStart(2, "0");
  const m = String(now.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}
function generateConfirmToken(id, date) {
  const secret = process.env.JWT_SECRET || "secret";
  return createHash("sha256").update(`${id}:${date}:${secret}`).digest("hex").slice(0, 16);
}
function buildWhatsAppMessage(apt, baseUrl) {
  const token = generateConfirmToken(apt.id, apt.date);
  const confirmUrl = `${baseUrl}/confirmar?id=${apt.id}&token=${token}`;
  const date = new Date(apt.date);
  const dateStr = date.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "2-digit" });
  const timeStr = date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return `Ol\xE1 ${apt.clientName || "cliente"}! \u{1F44B}

Lembramos que voc\xEA tem um agendamento:
\u{1F4C5} ${dateStr} \xE0s ${timeStr}
\u270F\uFE0F ${apt.service} com ${apt.artist}

Por favor, confirme sua presen\xE7a:
\u2705 Confirmado: ${confirmUrl}&status=confirmado
\u274C N\xE3o confirmado: ${confirmUrl}&status=nao_confirmado
\u23F0 Atraso: ${confirmUrl}&status=atraso
\u{1F3C3} Chegada antecipada: ${confirmUrl}&status=chegada_antecipada`;
}
function getBaseUrl() {
  return process.env.PUBLIC_URL || "https://tatuei.com";
}
async function runWhatsAppReminders(logType) {
  const key = `${logType}_${todayStr()}`;
  if (lastRun[key]) return;
  try {
    const settings = await getStudioSettings();
    if (!settings?.enableAppointmentReminders) return;
    const daysBefore = settings.reminderDaysBefore ?? 1;
    const appointments2 = await getAppointmentsForWhatsAppReminder(daysBefore, logType);
    if (appointments2.length === 0) {
      console.log(`[Scheduler] WhatsApp (${logType}): nenhum agendamento pendente.`);
      lastRun[key] = todayStr();
      return;
    }
    const baseUrl = getBaseUrl();
    let sent = 0;
    let failed = 0;
    for (const apt of appointments2) {
      if (!apt.clientPhone) {
        await logWhatsAppReminder({
          appointmentId: apt.id,
          clientId: apt.clientId,
          logType,
          message: "Cliente sem telefone cadastrado",
          status: "failed"
        });
        failed++;
        continue;
      }
      try {
        const message = buildWhatsAppMessage(apt, baseUrl);
        await logWhatsAppReminder({
          appointmentId: apt.id,
          clientId: apt.clientId,
          logType,
          message,
          status: "sent"
        });
        sent++;
      } catch (err) {
        await logWhatsAppReminder({
          appointmentId: apt.id,
          clientId: apt.clientId,
          logType,
          message: `Erro: ${err}`,
          status: "failed"
        });
        failed++;
      }
    }
    const aptsWithPhone = appointments2.filter((a) => a.clientPhone);
    if (aptsWithPhone.length > 0) {
      const baseUrl2 = getBaseUrl();
      const lines = aptsWithPhone.map((apt) => {
        const token = generateConfirmToken(apt.id, apt.date);
        const timeStr = new Date(apt.date).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
        const withCountry = normalizeWhatsAppNumber(apt.clientPhone);
        const confirmUrl = `${baseUrl2}/confirmar?id=${apt.id}&token=${token}`;
        const msg = buildWhatsAppMessage(apt, baseUrl2);
        const waLink = `https://wa.me/${withCountry}?text=${encodeURIComponent(msg)}`;
        return `\u2022 ${timeStr} \u2014 ${apt.clientName} | ${apt.service}
  \u{1F4F1} ${waLink}`;
      });
      const title = `\u{1F4F1} ${aptsWithPhone.length} lembrete(s) WhatsApp para enviar`;
      const content = `Clique nos links abaixo para enviar os lembretes:

${lines.join("\n\n")}`;
      await notifyOwner({ title, content });
    }
    console.log(`[Scheduler] WhatsApp (${logType}): enviados=${sent}, falhas=${failed}`);
    lastRun[key] = todayStr();
    if (logType === "whatsapp_primary") {
      whatsAppSchedulerStatus.lastRunPrimary = (/* @__PURE__ */ new Date()).toISOString();
    } else {
      whatsAppSchedulerStatus.lastRunResend = (/* @__PURE__ */ new Date()).toISOString();
    }
  } catch (err) {
    console.error(`[Scheduler] Erro no WhatsApp (${logType}):`, err);
  }
}
async function checkWhatsAppSchedule() {
  try {
    const settings = await getStudioSettings();
    if (!settings?.enableAppointmentReminders) return;
    const now = currentTimeStr();
    const sendTime = settings.reminderSendTime || "09:00";
    const resendTime = settings.reminderResendTime || "18:00";
    const resendEnabled = settings.reminderResend === 1;
    whatsAppSchedulerStatus.enabled = true;
    whatsAppSchedulerStatus.daysBefore = settings.reminderDaysBefore ?? 1;
    whatsAppSchedulerStatus.sendTime = sendTime;
    whatsAppSchedulerStatus.resendEnabled = resendEnabled;
    whatsAppSchedulerStatus.resendTime = resendTime;
    const todayDate = todayStr();
    whatsAppSchedulerStatus.nextRunPrimary = `${todayDate} ${sendTime}`;
    if (resendEnabled) {
      whatsAppSchedulerStatus.nextRunResend = `${todayDate} ${resendTime}`;
    }
    if (now >= sendTime && now <= addMinutes(sendTime, 5)) {
      await runWhatsAppReminders("whatsapp_primary");
    }
    if (resendEnabled && now >= resendTime && now <= addMinutes(resendTime, 5)) {
      await runWhatsAppReminders("whatsapp_resend");
    }
  } catch (err) {
    console.error("[Scheduler] Erro ao verificar hor\xE1rio WhatsApp:", err);
  }
}
function addMinutes(time, minutes) {
  const [h, m] = time.split(":").map(Number);
  const total = h * 60 + m + minutes;
  const newH = Math.floor(total / 60) % 24;
  const newM = total % 60;
  return `${String(newH).padStart(2, "0")}:${String(newM).padStart(2, "0")}`;
}
async function runAppointmentReminders() {
  const key = "appointment";
  const today = todayStr();
  if (lastRun[key] === today) return;
  try {
    const settings = await getStudioSettings();
    if (!settings?.enableAppointmentReminders) return;
    const result = await sendAppointmentReminders();
    console.log(`[Scheduler] Lembretes de agendamento: enviados=${result.sent}, falhas=${result.failed}`);
    lastRun[key] = today;
  } catch (err) {
    console.error("[Scheduler] Erro ao enviar lembretes de agendamento:", err);
  }
}
async function runBirthdayReminders() {
  const key = "birthday";
  const today = todayStr();
  if (lastRun[key] === today) return;
  try {
    const settings = await getStudioSettings();
    if (!settings?.enableBirthdayReminders) return;
    const upcoming = await getUpcomingBirthdays(0);
    if (upcoming.length === 0) {
      lastRun[key] = today;
      return;
    }
    const names = upcoming.map((c) => c.name).join(", ");
    const title = `\u{1F382} Aniversariante(s) hoje: ${upcoming.length}`;
    const content = `Parab\xE9ns para: ${names}

Acesse o CRM para enviar uma mensagem especial!`;
    const success = await notifyOwner({ title, content });
    console.log(`[Scheduler] Lembrete de anivers\xE1rio: ${success ? "enviado" : "falhou"} (${names})`);
    lastRun[key] = today;
  } catch (err) {
    console.error("[Scheduler] Erro ao enviar lembretes de anivers\xE1rio:", err);
  }
}
async function runIndividualReminders() {
  try {
    const pending = await getPendingRemindersToSend();
    if (pending.length === 0) return;
    console.log(`[Scheduler] Lembretes individuais: ${pending.length} para disparar.`);
    const baseUrl = getBaseUrl();
    for (const reminder of pending) {
      try {
        if (!reminder.clientPhone) {
          await markReminderFailed(reminder.id);
          console.warn(`[Scheduler] Lembrete #${reminder.id}: cliente sem telefone.`);
          continue;
        }
        const token = generateConfirmToken(reminder.appointmentId, reminder.appointmentDate);
        const confirmUrl = `${baseUrl}/confirmar?id=${reminder.appointmentId}&token=${token}`;
        const dateObj = new Date(reminder.appointmentDate);
        const dateStr = dateObj.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "2-digit" });
        const timeStr = dateObj.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
        const message = reminder.message.replace(/\{nome\}/g, reminder.clientName || "cliente").replace(/\{data\}/g, dateStr).replace(/\{horário\}/g, timeStr).replace(/\{serviço\}/g, reminder.service).replace(/\{artista\}/g, reminder.artist) + `

\u2705 Confirmado: ${confirmUrl}&status=confirmado
\u274C N\xE3o confirmado: ${confirmUrl}&status=nao_confirmado
\u23F0 Atraso: ${confirmUrl}&status=atraso
\u{1F3C3} Chegada antecipada: ${confirmUrl}&status=chegada_antecipada`;
        const withCountry = normalizeWhatsAppNumber(reminder.clientPhone);
        const waLink = `https://wa.me/${withCountry}?text=${encodeURIComponent(message)}`;
        await markReminderSent(reminder.id);
        await notifyOwner({
          title: `\u{1F4F1} Lembrete para ${reminder.clientName || "cliente"} \u2014 ${timeStr}`,
          content: `Clique para enviar o lembrete WhatsApp:

${waLink}

Mensagem:
${message}`
        });
        console.log(`[Scheduler] Lembrete #${reminder.id} disparado para ${reminder.clientName}.`);
      } catch (err) {
        await markReminderFailed(reminder.id);
        console.error(`[Scheduler] Erro no lembrete #${reminder.id}:`, err);
      }
    }
  } catch (err) {
    console.error("[Scheduler] Erro ao processar lembretes individuais:", err);
  }
}
function startScheduler() {
  console.log("[Scheduler] Iniciando cron jobs de notifica\xE7\xF5es...");
  setTimeout(() => {
    runAppointmentReminders();
    runBirthdayReminders();
    checkWhatsAppSchedule();
    runIndividualReminders();
  }, 1e4);
  setInterval(checkWhatsAppSchedule, 5 * 60 * 1e3);
  setInterval(runIndividualReminders, 60 * 1e3);
  setInterval(runAppointmentReminders, 60 * 60 * 1e3);
  setInterval(runBirthdayReminders, 60 * 60 * 1e3);
  console.log("[Scheduler] Cron jobs registrados: WhatsApp (5min), lembretes individuais (1min), lembretes (1h), anivers\xE1rios (1h)");
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
import { eq as eq2, and as and2, desc as desc2, isNotNull, gte as gte2, lte as lte2 } from "drizzle-orm";
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
  if (studioId && procedure.studioId !== studioId) {
    throw new TRPCError4({ code: "FORBIDDEN", message: "Acesso negado a este procedimento." });
  }
}
var proceduresRouter = router({
  // ── Listar procedimentos de um cliente ──────────────────────────────────
  listByClient: protectedProcedure.input(z3.object({ clientId: z3.number().int().positive() })).query(async ({ ctx, input }) => {
    const studioId = ctx.user.studioId ?? 1;
    const db = await requireDb();
    const rows = await db.select().from(technicalProcedures).where(
      and2(
        eq2(technicalProcedures.clientId, input.clientId),
        eq2(technicalProcedures.studioId, studioId)
      )
    ).orderBy(desc2(technicalProcedures.createdAt));
    return rows;
  }),
  // ── Buscar procedimento por ID ───────────────────────────────────────────
  getById: protectedProcedure.input(z3.object({ id: z3.number().int().positive() })).query(async ({ ctx, input }) => {
    const studioId = ctx.user.studioId ?? 1;
    const db = await requireDb();
    const [procedure] = await db.select().from(technicalProcedures).where(eq2(technicalProcedures.id, input.id)).limit(1);
    assertProcedureOwner(procedure, studioId, input.id);
    const consumables = await db.select().from(procedureConsumables).where(eq2(procedureConsumables.procedureId, input.id)).orderBy(procedureConsumables.category, procedureConsumables.name);
    const images = await db.select().from(procedureImages).where(eq2(procedureImages.procedureId, input.id)).orderBy(procedureImages.createdAt);
    return { procedure, consumables, images };
  }),
  // ── Criar novo procedimento ──────────────────────────────────────────────
  create: protectedProcedure.input(z3.object({
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
    const studioId = ctx.user.studioId ?? 1;
    const db = await requireDb();
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
    const [created] = await db.select().from(technicalProcedures).where(eq2(technicalProcedures.id, insertId)).limit(1);
    return created;
  }),
  // ── Atualizar dados gerais do procedimento ───────────────────────────────
  update: protectedProcedure.input(z3.object({
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
    const studioId = ctx.user.studioId ?? 1;
    const db = await requireDb();
    const [existing] = await db.select({ studioId: technicalProcedures.studioId }).from(technicalProcedures).where(eq2(technicalProcedures.id, input.id)).limit(1);
    assertProcedureOwner(existing, studioId, input.id);
    const { id, ...fields } = input;
    await db.update(technicalProcedures).set(fields).where(eq2(technicalProcedures.id, id));
    const [updated] = await db.select().from(technicalProcedures).where(eq2(technicalProcedures.id, id)).limit(1);
    return updated;
  }),
  // ── Controle de timer (iniciar / pausar / retomar / finalizar) ───────────
  timerAction: protectedProcedure.input(z3.object({
    id: z3.number().int().positive(),
    action: z3.enum(["start", "pause", "resume", "finish"])
  })).mutation(async ({ ctx, input }) => {
    const studioId = ctx.user.studioId ?? 1;
    const db = await requireDb();
    const [existing] = await db.select().from(technicalProcedures).where(eq2(technicalProcedures.id, input.id)).limit(1);
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
    await db.update(technicalProcedures).set(updates).where(eq2(technicalProcedures.id, input.id));
    await db.insert(procedureEvents).values({
      procedureId: input.id,
      eventType: input.action,
      payload: JSON.stringify({ at: now })
    });
    const [updated] = await db.select().from(technicalProcedures).where(eq2(technicalProcedures.id, input.id)).limit(1);
    return updated;
  }),
  // ── Adicionar insumo ─────────────────────────────────────────────────────
  addConsumable: protectedProcedure.input(z3.object({
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
    const studioId = ctx.user.studioId ?? 1;
    const db = await requireDb();
    const [proc] = await db.select({ studioId: technicalProcedures.studioId }).from(technicalProcedures).where(eq2(technicalProcedures.id, input.procedureId)).limit(1);
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
    const [created] = await db.select().from(procedureConsumables).where(eq2(procedureConsumables.id, insertId)).limit(1);
    return created;
  }),
  // ── Atualizar quantidade de insumo ───────────────────────────────────────
  updateConsumable: protectedProcedure.input(z3.object({
    id: z3.number().int().positive(),
    procedureId: z3.number().int().positive(),
    quantity: z3.number().min(0),
    estimatedUnitCost: z3.number().min(0).optional(),
    notes: z3.string().optional()
  })).mutation(async ({ ctx, input }) => {
    const studioId = ctx.user.studioId ?? 1;
    const db = await requireDb();
    const [proc] = await db.select({ studioId: technicalProcedures.studioId }).from(technicalProcedures).where(eq2(technicalProcedures.id, input.procedureId)).limit(1);
    assertProcedureOwner(proc, studioId, input.procedureId);
    const [existing] = await db.select().from(procedureConsumables).where(eq2(procedureConsumables.id, input.id)).limit(1);
    if (!existing) throw new TRPCError4({ code: "NOT_FOUND", message: "Insumo n\xE3o encontrado." });
    const unitCost = input.estimatedUnitCost ?? Number(existing.estimatedUnitCost ?? 0);
    const totalCost = unitCost * input.quantity;
    await db.update(procedureConsumables).set({
      quantity: String(input.quantity),
      estimatedUnitCost: String(unitCost),
      estimatedTotalCost: String(totalCost),
      notes: input.notes ?? existing.notes
    }).where(eq2(procedureConsumables.id, input.id));
    const [updated] = await db.select().from(procedureConsumables).where(eq2(procedureConsumables.id, input.id)).limit(1);
    return updated;
  }),
  // ── Remover insumo ───────────────────────────────────────────────────────
  removeConsumable: protectedProcedure.input(z3.object({
    id: z3.number().int().positive(),
    procedureId: z3.number().int().positive()
  })).mutation(async ({ ctx, input }) => {
    const studioId = ctx.user.studioId ?? 1;
    const db = await requireDb();
    const [proc] = await db.select({ studioId: technicalProcedures.studioId }).from(technicalProcedures).where(eq2(technicalProcedures.id, input.procedureId)).limit(1);
    assertProcedureOwner(proc, studioId, input.procedureId);
    await db.delete(procedureConsumables).where(eq2(procedureConsumables.id, input.id));
    return { success: true };
  }),
  // ── Upload de imagem do procedimento ────────────────────────────────────
  uploadImage: protectedProcedure.input(z3.object({
    procedureId: z3.number().int().positive(),
    imageBase64: z3.string(),
    mimeType: z3.string(),
    imageType: z3.enum(["reference", "stencil", "progress", "final", "healed", "other"]).default("other"),
    description: z3.string().optional()
  })).mutation(async ({ ctx, input }) => {
    const studioId = ctx.user.studioId ?? 1;
    const db = await requireDb();
    const [proc] = await db.select({ studioId: technicalProcedures.studioId }).from(technicalProcedures).where(eq2(technicalProcedures.id, input.procedureId)).limit(1);
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
      await db.update(technicalProcedures).set({ referenceImageUrl: url, referenceImageKey: key }).where(eq2(technicalProcedures.id, input.procedureId));
    } else if (input.imageType === "final") {
      await db.update(technicalProcedures).set({ finalImageUrl: url, finalImageKey: key }).where(eq2(technicalProcedures.id, input.procedureId));
    } else if (input.imageType === "healed") {
      await db.update(technicalProcedures).set({ healedImageUrl: url, healedImageKey: key }).where(eq2(technicalProcedures.id, input.procedureId));
    } else if (input.imageType === "stencil") {
      await db.update(technicalProcedures).set({ stencilImageUrl: url, stencilImageKey: key }).where(eq2(technicalProcedures.id, input.procedureId));
    }
    const [created] = await db.select().from(procedureImages).where(eq2(procedureImages.id, insertId)).limit(1);
    return created;
  }),
  // ── Deletar procedimento ─────────────────────────────────────────────────
  delete: protectedProcedure.input(z3.object({ id: z3.number().int().positive() })).mutation(async ({ ctx, input }) => {
    const studioId = ctx.user.studioId ?? 1;
    const db = await requireDb();
    const [existing] = await db.select({ studioId: technicalProcedures.studioId }).from(technicalProcedures).where(eq2(technicalProcedures.id, input.id)).limit(1);
    assertProcedureOwner(existing, studioId, input.id);
    await db.delete(procedureConsumables).where(eq2(procedureConsumables.procedureId, input.id));
    await db.delete(procedureImages).where(eq2(procedureImages.procedureId, input.id));
    await db.delete(procedureEvents).where(eq2(procedureEvents.procedureId, input.id));
    await db.delete(technicalProcedures).where(eq2(technicalProcedures.id, input.id));
    return { success: true };
  }),
  // ── Buscar procedimento por appointmentId ───────────────────────────────────────
  getByAppointment: protectedProcedure.input(z3.object({ appointmentId: z3.number().int().positive() })).query(async ({ ctx, input }) => {
    const studioId = ctx.user.studioId ?? 1;
    const db = await requireDb();
    const rows = await db.select().from(technicalProcedures).where(
      and2(
        eq2(technicalProcedures.appointmentId, input.appointmentId),
        eq2(technicalProcedures.studioId, studioId)
      )
    ).orderBy(desc2(technicalProcedures.createdAt));
    return rows;
  }),
  // Resumo financeiro do procedimento
  getSummary: protectedProcedure.input(z3.object({ id: z3.number().int().positive() })).query(async ({ ctx, input }) => {
    const studioId = ctx.user.studioId ?? 1;
    const db = await requireDb();
    const [procedure] = await db.select().from(technicalProcedures).where(eq2(technicalProcedures.id, input.id)).limit(1);
    assertProcedureOwner(procedure, studioId, input.id);
    const consumables = await db.select().from(procedureConsumables).where(eq2(procedureConsumables.procedureId, input.id));
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
  finalize: protectedProcedure.input(z3.object({
    procedureId: z3.number(),
    chargedAmount: z3.number().min(0),
    paymentMethod: z3.enum(["dinheiro", "pix", "credito", "debito", "transferencia"]),
    notes: z3.string().optional()
  })).mutation(async ({ ctx, input }) => {
    const studioId = ctx.user.studioId ?? 1;
    const db = await requireDb();
    const [proc] = await db.select().from(technicalProcedures).where(and2(eq2(technicalProcedures.id, input.procedureId), eq2(technicalProcedures.studioId, studioId))).limit(1);
    if (!proc) throw new TRPCError4({ code: "NOT_FOUND", message: "Procedimento n\xE3o encontrado." });
    if (proc.status === "finalizado") throw new TRPCError4({ code: "BAD_REQUEST", message: "Procedimento j\xE1 finalizado." });
    const now = (/* @__PURE__ */ new Date()).toISOString().slice(0, 19).replace("T", " ");
    await db.update(technicalProcedures).set({
      status: "finalizado",
      finishedAt: now,
      chargedAmount: input.chargedAmount,
      notes: input.notes ?? proc.notes,
      updatedAt: now
    }).where(eq2(technicalProcedures.id, input.procedureId));
    if (proc.appointmentId) {
      await db.update(appointments).set({ status: "concluido", updatedAt: now }).where(and2(eq2(appointments.id, proc.appointmentId), eq2(appointments.studioId, studioId)));
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
  consumableReport: protectedProcedure.input(z3.object({
    startDate: z3.string().optional(),
    // 'YYYY-MM-DD'
    endDate: z3.string().optional()
  })).query(async ({ ctx, input }) => {
    const studioId = ctx.user.studioId ?? 1;
    const db = await requireDb();
    const procWhere = [eq2(technicalProcedures.studioId, studioId)];
    if (input.startDate) procWhere.push(gte2(technicalProcedures.createdAt, `${input.startDate} 00:00:00`));
    if (input.endDate) procWhere.push(lte2(technicalProcedures.createdAt, `${input.endDate} 23:59:59`));
    const procs = await db.select({
      id: technicalProcedures.id,
      artistName: technicalProcedures.artistName,
      title: technicalProcedures.title,
      chargedAmount: technicalProcedures.chargedAmount,
      createdAt: technicalProcedures.createdAt
    }).from(technicalProcedures).where(and2(...procWhere)).orderBy(desc2(technicalProcedures.createdAt));
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
  consumableSummary: protectedProcedure.query(async ({ ctx }) => {
    const studioId = ctx.user.studioId ?? 1;
    const db = await requireDb();
    const now = /* @__PURE__ */ new Date();
    const startOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01 00:00:00`;
    const endOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()).padStart(2, "0")} 23:59:59`;
    const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const startOfPrevMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, "0")}-01 00:00:00`;
    const endOfPrevMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, "0")}-${String(new Date(prevDate.getFullYear(), prevDate.getMonth() + 1, 0).getDate()).padStart(2, "0")} 23:59:59`;
    const getMonthData = async (start, end) => {
      const procs = await db.select({ id: technicalProcedures.id, chargedAmount: technicalProcedures.chargedAmount }).from(technicalProcedures).where(and2(
        eq2(technicalProcedures.studioId, studioId),
        gte2(technicalProcedures.createdAt, start),
        lte2(technicalProcedures.createdAt, end)
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
  listLinkedAppointmentIds: protectedProcedure.query(async ({ ctx }) => {
    const studioId = ctx.user.studioId ?? 1;
    const db = await requireDb();
    const rows = await db.select({ appointmentId: technicalProcedures.appointmentId, id: technicalProcedures.id }).from(technicalProcedures).where(
      and2(
        eq2(technicalProcedures.studioId, studioId),
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

// server/routers/messaging.ts
import { z as z4 } from "zod";
import { TRPCError as TRPCError5 } from "@trpc/server";
init_db();
init_schema();
init_provider();
init_service();
init_service();
import { eq as eq4, desc as desc3 } from "drizzle-orm";
var messagingRouter = router({
  // ── Integração (configuração do provedor) ──────────────────────────────────
  /** Lista todas as integrações cadastradas */
  listIntegrations: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(whatsappIntegrations).orderBy(desc3(whatsappIntegrations.createdAt));
  }),
  /** Salva ou atualiza uma integração */
  saveIntegration: protectedProcedure.input(
    z4.object({
      id: z4.number().optional(),
      name: z4.string().min(1),
      provider: z4.enum(["botconversa", "zapi", "meta"]),
      phoneNumber: z4.string().min(8),
      apiToken: z4.string().min(1),
      instanceId: z4.string().optional()
    })
  ).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError5({ code: "INTERNAL_SERVER_ERROR" });
    if (input.id) {
      await db.update(whatsappIntegrations).set({
        name: input.name,
        provider: input.provider,
        phoneNumber: input.phoneNumber,
        apiToken: input.apiToken,
        instanceId: input.instanceId,
        updatedAt: (/* @__PURE__ */ new Date()).toISOString().slice(0, 19).replace("T", " ")
      }).where(eq4(whatsappIntegrations.id, input.id));
      return { ok: true };
    }
    await db.insert(whatsappIntegrations).values({
      name: input.name,
      provider: input.provider,
      phoneNumber: input.phoneNumber,
      apiToken: input.apiToken,
      instanceId: input.instanceId,
      status: "aguardando"
    });
    return { ok: true };
  }),
  /** Ativa uma integração e desativa as demais */
  activateIntegration: protectedProcedure.input(z4.object({ id: z4.number() })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError5({ code: "INTERNAL_SERVER_ERROR" });
    await db.update(whatsappIntegrations).set({ status: "inativo" });
    await db.update(whatsappIntegrations).set({ status: "ativo" }).where(eq4(whatsappIntegrations.id, input.id));
    return { ok: true };
  }),
  /** Remove uma integração */
  deleteIntegration: protectedProcedure.input(z4.object({ id: z4.number() })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError5({ code: "INTERNAL_SERVER_ERROR" });
    await db.delete(whatsappIntegrations).where(eq4(whatsappIntegrations.id, input.id));
    return { ok: true };
  }),
  /** Testa a conexão com o provedor */
  testConnection: protectedProcedure.input(z4.object({ id: z4.number() })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError5({ code: "INTERNAL_SERVER_ERROR" });
    const rows = await db.select().from(whatsappIntegrations).where(eq4(whatsappIntegrations.id, input.id)).limit(1);
    const integration = rows[0];
    if (!integration) throw new TRPCError5({ code: "NOT_FOUND" });
    const provider = getProvider({
      provider: integration.provider,
      apiToken: integration.apiToken,
      phoneNumber: integration.phoneNumber,
      instanceId: integration.instanceId ?? void 0
    });
    const result = await provider.testConnection();
    await db.update(whatsappIntegrations).set({
      status: result.success ? "ativo" : "erro",
      lastTestedAt: (/* @__PURE__ */ new Date()).toISOString().slice(0, 19).replace("T", " "),
      lastErrorMessage: result.error ?? null,
      updatedAt: (/* @__PURE__ */ new Date()).toISOString().slice(0, 19).replace("T", " ")
    }).where(eq4(whatsappIntegrations.id, input.id));
    return result;
  }),
  // ── Templates de mensagem ──────────────────────────────────────────────────
  /** Lista todos os templates */
  listTemplates: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    await seedDefaultTemplates();
    return db.select().from(messageTemplates).orderBy(messageTemplates.trigger);
  }),
  /** Salva ou atualiza um template */
  saveTemplate: protectedProcedure.input(
    z4.object({
      id: z4.number().optional(),
      name: z4.string().min(1),
      trigger: z4.enum([
        "appointment_created",
        "appointment_confirmed",
        "appointment_reminder_24h",
        "appointment_reminder_2h",
        "appointment_cancelled",
        "appointment_rescheduled",
        "custom"
      ]),
      recipientType: z4.enum(["client", "artist"]),
      message: z4.string().min(1),
      isActive: z4.boolean().default(true)
    })
  ).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError5({ code: "INTERNAL_SERVER_ERROR" });
    if (input.id) {
      await db.update(messageTemplates).set({
        name: input.name,
        trigger: input.trigger,
        recipientType: input.recipientType,
        message: input.message,
        isActive: input.isActive ? 1 : 0,
        updatedAt: (/* @__PURE__ */ new Date()).toISOString().slice(0, 19).replace("T", " ")
      }).where(eq4(messageTemplates.id, input.id));
    } else {
      await db.insert(messageTemplates).values({
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
  deleteTemplate: protectedProcedure.input(z4.object({ id: z4.number() })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError5({ code: "INTERNAL_SERVER_ERROR" });
    await db.delete(messageTemplates).where(eq4(messageTemplates.id, input.id));
    return { ok: true };
  }),
  // ── Fila / Histórico de mensagens ──────────────────────────────────────────
  /** Lista o histórico de mensagens enviadas */
  listQueue: protectedProcedure.input(
    z4.object({
      limit: z4.number().default(50),
      status: z4.enum(["pendente", "enviada", "erro", "cancelada", "respondida"]).optional()
    })
  ).query(async ({ input }) => {
    const db = await getDb();
    if (!db) return [];
    const query = db.select().from(messageQueue).orderBy(desc3(messageQueue.createdAt)).limit(input.limit);
    return query;
  }),
  /** Envia uma mensagem manual */
  sendManual: protectedProcedure.input(
    z4.object({
      recipientPhone: z4.string().min(8),
      recipientName: z4.string().optional(),
      message: z4.string().min(1),
      clientId: z4.number().optional(),
      appointmentId: z4.number().optional()
    })
  ).mutation(async ({ input }) => {
    const result = await sendAndLog({
      recipientPhone: input.recipientPhone,
      recipientName: input.recipientName,
      recipientType: "client",
      message: input.message,
      trigger: "custom",
      clientId: input.clientId,
      appointmentId: input.appointmentId
    });
    if (!result.success) {
      throw new TRPCError5({
        code: "INTERNAL_SERVER_ERROR",
        message: result.error ?? "Falha ao enviar mensagem"
      });
    }
    return result;
  }),
  /** Preview de um template com variáveis de exemplo */
  previewTemplate: protectedProcedure.input(
    z4.object({
      message: z4.string(),
      vars: z4.record(z4.string(), z4.string()).optional()
    })
  ).query(({ input }) => {
    const defaultVars = {
      nome_cliente: "Jo\xE3o Silva",
      nome_tatuador: "Artista",
      nome_estudio: "POD Est\xFAdio",
      data: "15/06/2026",
      hora: "14:00",
      servico: "Tatuagem",
      endereco: "Rua Exemplo, 123",
      valor_sinal: "R$ 150,00",
      status_sinal: "Confirmado",
      ...input.vars
    };
    return { preview: interpolateTemplate(input.message, defaultVars) };
  })
});

// server/procedureKitValidation.ts
import { z as z5 } from "zod";
var procedureKitItemSchema = z5.object({
  materialId: z5.number().int().positive(),
  quantity: z5.number().positive(),
  unit: z5.string().trim().min(1).max(50)
});
var procedureKitItemsSchema = z5.array(procedureKitItemSchema).min(1).max(50);
var procedureKitFormSchema = z5.object({
  name: z5.string().trim().min(1).max(255),
  description: z5.string().max(2e3).optional(),
  category: z5.string().trim().min(1).max(100).default("Geral"),
  items: procedureKitItemsSchema
});
function normalizeProcedureKitItems(items) {
  return items.map((item) => ({
    materialId: item.materialId,
    quantity: String(item.quantity),
    unit: item.unit.trim()
  }));
}

// server/routers.ts
var appRouter = router({
  system: systemRouter,
  // Quick consume endpoint para registrar insumos rapidamente
  quickConsume: protectedProcedure.input(z6.object({
    inventoryItemId: z6.number(),
    procedureId: z6.number(),
    category: z6.enum(["ink", "cartridge", "disposable", "liquid", "protection", "stencil", "aftercare", "other"]),
    name: z6.string(),
    quantity: z6.string().or(z6.number()),
    estimatedUnitCost: z6.string().or(z6.number())
  })).mutation(async ({ input, ctx }) => {
    try {
      const dbConn = await getDb();
      const { procedureConsumables: procedureConsumables2 } = await Promise.resolve().then(() => (init_schema(), schema_exports));
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
      throw new TRPCError6({ code: "INTERNAL_SERVER_ERROR", message: "Erro ao registrar consumo" });
    }
  }),
  // Kits de procedimento: camada adicional, sem alterar quickConsume individual
  kits: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return listProcedureKits(ctx.user.studioId ?? 1);
    }),
    get: protectedProcedure.input(z6.object({ id: z6.number().int().positive() })).query(async ({ ctx, input }) => {
      const kit = await getProcedureKitById(input.id, ctx.user.studioId ?? 1);
      if (!kit) throw new TRPCError6({ code: "NOT_FOUND", message: "Kit n\xE3o encontrado" });
      return kit;
    }),
    create: protectedProcedure.input(procedureKitFormSchema).mutation(async ({ ctx, input }) => {
      const id = await createProcedureKit({
        studioId: ctx.user.studioId ?? 1,
        name: input.name,
        description: input.description,
        category: input.category,
        items: normalizeProcedureKitItems(input.items)
      });
      return { id };
    }),
    update: protectedProcedure.input(z6.object({
      id: z6.number().int().positive(),
      name: z6.string().trim().min(1).max(255),
      description: z6.string().max(2e3).optional(),
      category: z6.string().trim().min(1).max(100).default("Geral"),
      items: procedureKitItemsSchema
    })).mutation(async ({ ctx, input }) => {
      await updateProcedureKit(input.id, ctx.user.studioId ?? 1, {
        name: input.name,
        description: input.description,
        category: input.category,
        items: normalizeProcedureKitItems(input.items)
      });
      return { success: true };
    }),
    delete: protectedProcedure.input(z6.object({ id: z6.number().int().positive() })).mutation(async ({ ctx, input }) => {
      await deleteProcedureKit(input.id, ctx.user.studioId ?? 1);
      return { success: true };
    }),
    applyToProcedure: protectedProcedure.input(z6.object({ kitId: z6.number().int().positive(), procedureId: z6.number().int().positive() })).mutation(async ({ ctx, input }) => {
      try {
        return await applyProcedureKitToProcedure({
          kitId: input.kitId,
          procedureId: input.procedureId,
          studioId: ctx.user.studioId ?? 1,
          createdBy: ctx.user.id
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "N\xE3o foi poss\xEDvel aplicar o kit";
        throw new TRPCError6({ code: "BAD_REQUEST", message });
      }
    })
  }),
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
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
      const crypto = await import("crypto");
      const token = crypto.randomBytes(32).toString("hex");
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
      const { eq: eq6, and: and4, isNull } = await import("drizzle-orm");
      const [resetToken] = await dbConn.select().from(passwordResetTokens2).where(and4(
        eq6(passwordResetTokens2.token, input.token),
        isNull(passwordResetTokens2.usedAt)
      )).limit(1);
      if (!resetToken) {
        throw new TRPCError6({ code: "BAD_REQUEST", message: "Token inv\xE1lido ou j\xE1 utilizado" });
      }
      if (new Date(resetToken.expiresAt) < /* @__PURE__ */ new Date()) {
        throw new TRPCError6({ code: "BAD_REQUEST", message: "Token expirado. Solicite um novo link." });
      }
      const { hashPassword: hashPassword2 } = await Promise.resolve().then(() => (init_localAuth(), localAuth_exports));
      const passwordHash = await hashPassword2(input.newPassword);
      await updateUser(resetToken.userId, { passwordHash });
      const usedAtStr = (/* @__PURE__ */ new Date()).toISOString().slice(0, 19).replace("T", " ");
      await dbConn.update(passwordResetTokens2).set({ usedAt: usedAtStr }).where(eq6(passwordResetTokens2.id, resetToken.id));
      return { success: true };
    }),
    // Verificar se token de reset é válido
    verifyResetToken: publicProcedure.input(z6.object({ token: z6.string() })).query(async ({ input }) => {
      const dbConn = await getDb();
      const { passwordResetTokens: passwordResetTokens2 } = await Promise.resolve().then(() => (init_schema(), schema_exports));
      const { eq: eq6, and: and4, isNull } = await import("drizzle-orm");
      const [resetToken] = await dbConn.select().from(passwordResetTokens2).where(and4(
        eq6(passwordResetTokens2.token, input.token),
        isNull(passwordResetTokens2.usedAt)
      )).limit(1);
      if (!resetToken || new Date(resetToken.expiresAt) < /* @__PURE__ */ new Date()) {
        return { valid: false };
      }
      return { valid: true };
    })
  }),
  // ============ CLIENTS ROUTER ============
  clients: router({
    list: artistProcedure.query(async ({ ctx }) => {
      return await listClients(ctx.studioId, ctx.artistId);
    }),
    search: protectedProcedure.input(z6.object({ term: z6.string() })).query(async ({ input }) => {
      return await searchClients(input.term);
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
      country: z6.string().optional()
    })).mutation(async ({ ctx, input }) => {
      try {
        let studioId = ctx.user.studioId;
        if (!studioId) {
          if (ctx.user.role === "superadmin") {
            const firstStudio = await getFirstStudio();
            if (!firstStudio) {
              throw new TRPCError6({ code: "PRECONDITION_FAILED", message: "Nenhum est\xFAdio cadastrado no sistema. Crie um est\xFAdio primeiro." });
            }
            studioId = firstStudio.id;
          } else {
            throw new TRPCError6({ code: "FORBIDDEN", message: "Usu\xE1rio n\xE3o vinculado a um est\xFAdio. Acesse Configura\xE7\xF5es para selecionar seu est\xFAdio." });
          }
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
    list: protectedProcedure.query(async ({ ctx }) => {
      return await listAppointments(ctx.user.studioId ?? null);
    }),
    getByClientId: protectedProcedure.input(z6.object({ clientId: z6.number() })).query(async ({ input }) => {
      return await getAppointmentsByClientId(input.clientId);
    }),
    getById: protectedProcedure.input(z6.object({ id: z6.number() })).query(async ({ ctx, input }) => {
      if (!input.id || input.id <= 0) return null;
      const d = await getDb();
      if (!d) return null;
      const { appointments: appointments2 } = await Promise.resolve().then(() => (init_schema(), schema_exports));
      const { eq: eq6, and: and4 } = await import("drizzle-orm");
      const studioId = ctx.user.studioId ?? 0;
      const rows = await d.select().from(appointments2).where(and4(eq6(appointments2.id, input.id), eq6(appointments2.studioId, studioId))).limit(1);
      return rows[0] ?? null;
    }),
    create: protectedProcedure.input(z6.object({
      clientId: z6.number(),
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
      procedureTypeOther: z6.string().optional()
    })).mutation(async ({ ctx, input }) => {
      let studioId = ctx.user.studioId;
      if (!studioId) {
        if (ctx.user.role === "superadmin") {
          const firstStudio = await getFirstStudio();
          if (!firstStudio) {
            throw new TRPCError6({ code: "PRECONDITION_FAILED", message: "Nenhum est\xFAdio cadastrado no sistema." });
          }
          studioId = firstStudio.id;
        } else {
          throw new TRPCError6({ code: "FORBIDDEN", message: "Usu\xE1rio n\xE3o vinculado a um est\xFAdio." });
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
            throw new TRPCError6({ code: "BAD_REQUEST", message: `O est\xFAdio est\xE1 fechado neste dia (${dayName}).` });
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
              throw new TRPCError6({ code: "BAD_REQUEST", message: `Agendamento fora do hor\xE1rio comercial (${dayConfig.open} - ${dayConfig.close}).` });
            }
          }
        } catch (e) {
          if (e instanceof TRPCError6) throw e;
        }
      }
      const conflictCheck = await checkAppointmentConflicts(input.artist, input.date, input.duration);
      if (conflictCheck.hasConflict) {
        throw new TRPCError6({
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
            const { eq: eq6, and: and4 } = await import("drizzle-orm");
            const found = await d.select({ id: artistsTable.id }).from(artistsTable).where(and4(eq6(artistsTable.name, input.artist), eq6(artistsTable.studioId, studioId))).limit(1);
            if (found[0]) resolvedArtistId = found[0].id;
          }
        } catch {
        }
      }
      const appointmentData = {
        ...input,
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
      if (input.depositPaid && input.depositAmount && input.depositAmount > 0) {
        const client2 = await getClientById(input.clientId);
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
      const client = await getClientById(input.clientId);
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
        if (client?.phone) {
          await dispatchTemplateMessage2({
            trigger: "appointment_created",
            recipientType: "client",
            recipientPhone: client.phone,
            recipientName: client.name,
            appointmentId: result.id,
            clientId: input.clientId,
            vars: {
              nome_cliente: client.name,
              data: input.date,
              hora: input.date?.split(" ")[1] ?? "",
              nome_tatuador: input.artist,
              servico: input.service,
              nome_estudio: "",
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
      return result;
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
        procedureTypeOther: z6.string().optional()
      })
    })).mutation(async ({ ctx, input }) => {
      const appointmentBefore = await getAppointmentById(input.id);
      const { depositPaid, ...restData } = input.data;
      const updateData = {
        ...restData,
        ...depositPaid !== void 0 ? { depositPaid: depositPaid ? 1 : 0 } : {}
      };
      const result = await updateAppointment(input.id, updateData);
      const wasNotPaid = !appointmentBefore?.depositPaid || appointmentBefore.depositPaid === 0;
      const isNowPaid = input.data.depositPaid === true;
      const depositValue = input.data.depositAmount ?? appointmentBefore?.depositAmount ?? 0;
      if (wasNotPaid && isNowPaid && depositValue > 0) {
        let studioId = ctx.user.studioId;
        if (!studioId) {
          const firstStudio = await getFirstStudio();
          studioId = firstStudio?.id || 1;
        }
        await createTransaction({
          studioId,
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
      const { createHash: createHash2 } = await import("crypto");
      const appointment = await getAppointmentById(input.id);
      if (!appointment) throw new TRPCError6({ code: "NOT_FOUND", message: "Agendamento n\xE3o encontrado" });
      const secret = process.env.JWT_SECRET || "secret";
      const token = createHash2("sha256").update(`${input.id}:${appointment.date}:${secret}`).digest("hex").slice(0, 16);
      return { token, date: appointment.date };
    }),
    // Rota pública para confirmação do cliente via link WhatsApp
    confirm: publicProcedure.input(z6.object({
      id: z6.number(),
      token: z6.string(),
      status: z6.enum(["confirmado", "nao_confirmado", "atraso", "chegada_antecipada"])
    })).mutation(async ({ input }) => {
      const { createHash: createHash2 } = await import("crypto");
      const appointment = await getAppointmentById(input.id);
      if (!appointment) throw new TRPCError6({ code: "NOT_FOUND", message: "Agendamento n\xE3o encontrado" });
      const secret = process.env.JWT_SECRET || "secret";
      const expected = createHash2("sha256").update(`${input.id}:${appointment.date}:${secret}`).digest("hex").slice(0, 16);
      if (input.token !== expected) throw new TRPCError6({ code: "UNAUTHORIZED", message: "Link inv\xE1lido" });
      await updateAppointment(input.id, { confirmationStatus: input.status });
      return { success: true, status: input.status };
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
      if (!appointment) throw new TRPCError6({ code: "NOT_FOUND", message: "Agendamento n\xE3o encontrado" });
      const client = await getClientById(appointment.clientId);
      if (!client) throw new TRPCError6({ code: "NOT_FOUND", message: "Cliente n\xE3o encontrado" });
      const studioSettings2 = await getStudioSettings();
      const anamnesisRecords2 = await getAnamnesisByClientId(appointment.clientId);
      const latestAnamnesis = anamnesisRecords2.length > 0 ? anamnesisRecords2[0] : null;
      const baseUrl = process.env.APP_BASE_URL || (process.env.NODE_ENV === "production" ? `https://${process.env.VITE_APP_ID ? "tatuei.com" : "tatuei.manus.space"}` : "http://localhost:3000");
      const { createHash: createHash2 } = await import("crypto");
      const secret = process.env.JWT_SECRET || "secret";
      const token = createHash2("sha256").update(`${appointment.id}:${appointment.date}:${secret}`).digest("hex").slice(0, 16);
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
    getByDateRange: protectedProcedure.input(z6.object({
      startDate: z6.string(),
      endDate: z6.string()
    })).query(async ({ input }) => {
      return await getTransactionsByDateRange(input.startDate, input.endDate);
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
            throw new TRPCError6({ code: "PRECONDITION_FAILED", message: "Nenhum est\xFAdio cadastrado no sistema." });
          }
          studioId = firstStudio.id;
        } else {
          throw new TRPCError6({ code: "FORBIDDEN", message: "Usu\xE1rio n\xE3o vinculado a um est\xFAdio." });
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
          if (!firstStudio) throw new TRPCError6({ code: "PRECONDITION_FAILED", message: "Nenhum est\xFAdio cadastrado." });
          studioId = firstStudio.id;
        } else {
          throw new TRPCError6({ code: "FORBIDDEN", message: "Usu\xE1rio n\xE3o vinculado a um est\xFAdio." });
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
    monthlyRevenue: protectedProcedure.input(z6.object({
      startDate: z6.string(),
      endDate: z6.string()
    })).query(async ({ input }) => {
      return await getMonthlyRevenue(input.startDate, input.endDate);
    }),
    categoryBreakdown: protectedProcedure.input(z6.object({
      startDate: z6.string(),
      endDate: z6.string()
    })).query(async ({ input }) => {
      return await getCategoryBreakdown(input.startDate, input.endDate);
    }),
    paymentMethodBreakdown: protectedProcedure.input(z6.object({
      startDate: z6.string(),
      endDate: z6.string()
    })).query(async ({ input }) => {
      return await getPaymentMethodBreakdown(input.startDate, input.endDate);
    }),
    summary: protectedProcedure.input(z6.object({
      startDate: z6.string(),
      endDate: z6.string()
    })).query(async ({ input }) => {
      return await getFinancialSummary(input.startDate, input.endDate);
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
    getUpcomingAppointments: protectedProcedure.query(async () => {
      return await getUpcomingAppointments();
    }),
    sendReminders: protectedProcedure.mutation(async () => {
      return await sendAppointmentReminders();
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
    getPendingReminders: protectedProcedure.query(async () => {
      return await getAllPendingReminders();
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
    list: protectedProcedure.query(async () => {
      return await listArtists();
    }),
    getById: protectedProcedure.input(z6.object({ id: z6.number() })).query(async ({ input }) => {
      return await getArtistById(input.id);
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
            throw new TRPCError6({ code: "PRECONDITION_FAILED", message: "Nenhum est\xFAdio cadastrado no sistema." });
          }
          studioId = firstStudio.id;
        } else {
          throw new TRPCError6({ code: "FORBIDDEN", message: "Usu\xE1rio n\xE3o vinculado a um est\xFAdio." });
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
        throw new TRPCError6({ code: "FORBIDDEN", message: "Acesso negado" });
      }
      return await listAllUsers();
    }),
    getById: protectedProcedure.input(z6.object({ id: z6.number() })).query(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin" && ctx.user.role !== "superadmin") {
        throw new TRPCError6({ code: "FORBIDDEN", message: "Acesso negado" });
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
        throw new TRPCError6({ code: "FORBIDDEN", message: "Acesso negado" });
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
        throw new TRPCError6({ code: "FORBIDDEN", message: "Acesso negado" });
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
        throw new TRPCError6({ code: "FORBIDDEN", message: "Acesso negado" });
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
        throw new TRPCError6({ code: "FORBIDDEN", message: "Acesso negado" });
      }
      const existing = await getUserByEmail(input.email);
      if (existing) {
        throw new TRPCError6({ code: "CONFLICT", message: "E-mail j\xE1 cadastrado" });
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
        throw new TRPCError6({ code: "BAD_REQUEST", message: "Sua conta n\xE3o possui senha local configurada" });
      }
      const { verifyPassword: verifyPassword2, hashPassword: hashPassword2 } = await Promise.resolve().then(() => (init_localAuth(), localAuth_exports));
      const valid = await verifyPassword2(input.currentPassword, user.passwordHash);
      if (!valid) {
        throw new TRPCError6({ code: "UNAUTHORIZED", message: "Senha atual incorreta" });
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
        throw new TRPCError6({ code: "FORBIDDEN", message: "Acesso negado" });
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
        throw new TRPCError6({ code: "FORBIDDEN", message: "Acesso negado" });
      }
      return await listAuditLogs(input);
    }),
    search: protectedProcedure.input(z6.object({ term: z6.string() })).query(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin" && ctx.user.role !== "superadmin") {
        throw new TRPCError6({ code: "FORBIDDEN", message: "Acesso negado" });
      }
      return await searchAuditLogs(input.term);
    }),
    statistics: protectedProcedure.input(z6.object({
      startDate: z6.date().optional(),
      endDate: z6.date().optional()
    }).optional()).query(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin" && ctx.user.role !== "superadmin") {
        throw new TRPCError6({ code: "FORBIDDEN", message: "Acesso negado" });
      }
      return await getAuditStatistics(input?.startDate, input?.endDate);
    }),
    actionsByDay: protectedProcedure.input(z6.object({
      startDate: z6.date(),
      endDate: z6.date()
    })).query(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin" && ctx.user.role !== "superadmin") {
        throw new TRPCError6({ code: "FORBIDDEN", message: "Acesso negado" });
      }
      return await getAuditActionsByDay(input.startDate, input.endDate);
    }),
    actionsByType: protectedProcedure.input(z6.object({
      startDate: z6.date().optional(),
      endDate: z6.date().optional()
    }).optional()).query(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin" && ctx.user.role !== "superadmin") {
        throw new TRPCError6({ code: "FORBIDDEN", message: "Acesso negado" });
      }
      return await getAuditActionsByType(input?.startDate, input?.endDate);
    }),
    actionsByEntity: protectedProcedure.input(z6.object({
      startDate: z6.date().optional(),
      endDate: z6.date().optional()
    }).optional()).query(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin" && ctx.user.role !== "superadmin") {
        throw new TRPCError6({ code: "FORBIDDEN", message: "Acesso negado" });
      }
      return await getAuditActionsByEntity(input?.startDate, input?.endDate);
    }),
    topActiveUsers: protectedProcedure.input(z6.object({
      limit: z6.number().optional(),
      startDate: z6.date().optional(),
      endDate: z6.date().optional()
    }).optional()).query(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin" && ctx.user.role !== "superadmin") {
        throw new TRPCError6({ code: "FORBIDDEN", message: "Acesso negado" });
      }
      return await getTopActiveUsers(input?.limit, input?.startDate, input?.endDate);
    }),
    heatmap: protectedProcedure.input(z6.object({
      startDate: z6.date().optional(),
      endDate: z6.date().optional()
    }).optional()).query(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin" && ctx.user.role !== "superadmin") {
        throw new TRPCError6({ code: "FORBIDDEN", message: "Acesso negado" });
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
        throw new TRPCError6({ code: "FORBIDDEN", message: "Acesso negado" });
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
        throw new TRPCError6({ code: "FORBIDDEN", message: "Acesso negado" });
      }
      const templateId = await createReportTemplate({
        userId: ctx.user.id,
        ...input
      });
      return { id: templateId };
    }),
    list: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user.role !== "admin" && ctx.user.role !== "superadmin") {
        throw new TRPCError6({ code: "FORBIDDEN", message: "Acesso negado" });
      }
      return await listReportTemplates(ctx.user.id);
    }),
    get: protectedProcedure.input(z6.object({ id: z6.number() })).query(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin" && ctx.user.role !== "superadmin") {
        throw new TRPCError6({ code: "FORBIDDEN", message: "Acesso negado" });
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
        throw new TRPCError6({ code: "FORBIDDEN", message: "Acesso negado" });
      }
      const { id, ...data } = input;
      await updateReportTemplate(id, ctx.user.id, data);
      return { success: true };
    }),
    delete: protectedProcedure.input(z6.object({ id: z6.number() })).mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin" && ctx.user.role !== "superadmin") {
        throw new TRPCError6({ code: "FORBIDDEN", message: "Acesso negado" });
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
        throw new TRPCError6({ code: "NOT_FOUND", message: "Link inv\xE1lido ou expirado" });
      }
      if (new Date(request.expiresAt) < /* @__PURE__ */ new Date() && !request.completedAt) {
        throw new TRPCError6({ code: "BAD_REQUEST", message: "Link expirado" });
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
      }
      return { request, client, existingPayload, existingSubmissionId, isEditing: !!request.completedAt };
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
        throw new TRPCError6({ code: "NOT_FOUND", message: "Link inv\xE1lido" });
      }
      const payloadJson = JSON.stringify(input.payload);
      if (request.completedAt) {
        let targetId = input.submissionId;
        if (!targetId) {
          const existing = await getAnamneseSubmissionByRequestId(request.id);
          targetId = existing?.id;
        }
        if (!targetId) {
          throw new TRPCError6({ code: "NOT_FOUND", message: "Submiss\xE3o original n\xE3o encontrada" });
        }
        await updateAnamneseSubmission(targetId, payloadJson);
        return { success: true, submissionId: targetId };
      }
      if (new Date(request.expiresAt) < /* @__PURE__ */ new Date()) {
        throw new TRPCError6({ code: "BAD_REQUEST", message: "Link expirado" });
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
      if (!request) throw new TRPCError6({ code: "NOT_FOUND", message: "Link inv\xE1lido" });
      const submission = await getAnamneseSubmissionByRequestId(request.id);
      if (!submission) throw new TRPCError6({ code: "NOT_FOUND", message: "Ficha n\xE3o encontrada" });
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
      if (!supplier) throw new TRPCError6({ code: "NOT_FOUND", message: "Fornecedor n\xE3o encontrado" });
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
  // ============ CATÁLOGO TÉCNICO ============
  catalog: router({
    brands: protectedProcedure.query(async () => {
      return await listCatalogBrands();
    }),
    productLines: protectedProcedure.input(z6.object({
      brandId: z6.number().int().positive().optional(),
      category: z6.string().trim().min(1).optional()
    })).query(async ({ input }) => {
      return await listCatalogProductLines(input.brandId, input.category);
    }),
    search: protectedProcedure.input(z6.object({
      query: z6.string().max(255).optional(),
      category: z6.string().trim().min(1).optional(),
      brandId: z6.number().int().positive().optional(),
      lineId: z6.number().int().positive().optional(),
      formats: z6.array(z6.string().trim().min(1).max(100)).max(12).optional(),
      needleCount: z6.number().int().positive().optional(),
      needleDiameter: z6.number().positive().max(1).optional(),
      taper: z6.string().trim().min(1).max(100).optional(),
      supplierId: z6.number().int().positive().optional(),
      limit: z6.number().int().min(1).max(200).optional()
    })).query(async ({ input }) => {
      return await searchCatalogVariants(input);
    }),
    supplierOfferings: protectedProcedure.input(z6.object({ supplierId: z6.number().int().positive() })).query(async ({ input }) => {
      return await listSupplierCatalogOfferings(input.supplierId);
    }),
    createSupplierOffering: protectedProcedure.input(z6.object({
      supplierId: z6.number().int().positive(),
      brandId: z6.number().int().positive(),
      lineId: z6.number().int().positive().optional(),
      variantId: z6.number().int().positive().optional(),
      sourceUrl: z6.string().url().optional().or(z6.literal("")),
      evidenceStatus: z6.enum(["item", "marca", "pendente"]),
      lastVerifiedAt: z6.number().int().positive().optional(),
      notes: z6.string().max(2e3).optional()
    })).mutation(async ({ input }) => {
      const id = await createSupplierCatalogOffering({
        ...input,
        sourceUrl: input.sourceUrl || void 0
      });
      return { id };
    }),
    deactivateSupplierOffering: protectedProcedure.input(z6.object({ id: z6.number().int().positive() })).mutation(async ({ input }) => {
      await deactivateSupplierCatalogOffering(input.id);
      return { success: true };
    }),
    addToStock: protectedProcedure.input(z6.object({
      variantId: z6.number().int().positive(),
      supplierId: z6.number().int().positive().optional(),
      unit: z6.string().trim().min(1).max(50).default("cx"),
      currentStock: z6.number().min(0).default(0),
      minStock: z6.number().min(0).default(0),
      avgPrice: z6.number().min(0).default(0),
      notes: z6.string().max(2e3).optional()
    })).mutation(async ({ input }) => {
      const variant = await getCatalogVariantById(input.variantId);
      if (!variant) throw new TRPCError6({ code: "NOT_FOUND", message: "Varia\xE7\xE3o t\xE9cnica n\xE3o encontrada." });
      const label = [variant.brandName, variant.lineName, variant.name, variant.sku].filter(Boolean).join(" \xB7 ");
      const id = await createMaterial({
        name: label,
        category: variant.category,
        unit: input.unit,
        currentStock: String(input.currentStock),
        minStock: String(input.minStock),
        avgPrice: String(input.avgPrice),
        supplierId: input.supplierId,
        catalogVariantId: input.variantId,
        notes: input.notes
      });
      return { id };
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
      if (!mat) throw new TRPCError6({ code: "NOT_FOUND", message: "Material n\xE3o encontrado" });
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
      catalogVariantId: z6.number().int().positive().optional(),
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
      catalogVariantId: z6.number().int().positive().optional().nullable(),
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
      if (!order) throw new TRPCError6({ code: "NOT_FOUND", message: "Pedido n\xE3o encontrado" });
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
      if (!order) throw new TRPCError6({ code: "NOT_FOUND", message: "Pedido n\xE3o encontrado" });
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
        throw new TRPCError6({ code: "FORBIDDEN", message: "Apenas administradores podem editar percentuais" });
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
    byPeriod: protectedProcedure.input(z6.object({
      artistName: z6.string(),
      period: z6.enum(["daily", "weekly", "monthly", "annual"]),
      referenceDate: z6.string().optional()
      // YYYY-MM-DD
    })).query(async ({ ctx, input }) => {
      let studioId = ctx.user.studioId;
      if (!studioId) {
        const firstStudio = await getFirstStudio();
        studioId = firstStudio?.id || 1;
      }
      return getCollaboratorReport(studioId, input.artistName, input.period, input.referenceDate);
    }),
    // Relatório geral de todos os colaboradores
    summary: protectedProcedure.input(z6.object({
      period: z6.enum(["daily", "weekly", "monthly", "annual"]),
      referenceDate: z6.string().optional()
    })).query(async ({ ctx, input }) => {
      let studioId = ctx.user.studioId;
      if (!studioId) {
        const firstStudio = await getFirstStudio();
        studioId = firstStudio?.id || 1;
      }
      return getCollaboratorsSummary(studioId, input.period, input.referenceDate);
    })
  }),
  // ============ CONTACTS IMPORT/EXPORT ROUTER ============
  contacts: contactsRouter,
  // ============ POD SESSION — EXECUÇÃO TÉCNICA ============
  procedures: proceduresRouter,
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
      }
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
async function startServer() {
  const app = express2();
  const server = createServer(app);
  app.use(express2.json({ limit: "50mb" }));
  app.use(express2.urlencoded({ limit: "50mb", extended: true }));
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
      const { createHash: createHash2 } = await import("crypto");
      const secret = process.env.JWT_SECRET || "secret";
      const token = createHash2("sha256").update(`${appointment.id}:${appointment.date}:${secret}`).digest("hex").slice(0, 16);
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
      res.setHeader("Content-Type", "text/calendar; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.send(icsContent);
    } catch (error) {
      console.error("[ICS] Erro ao gerar arquivo:", error);
      res.status(500).json({ error: "Erro interno ao gerar arquivo" });
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
    console.log(`Server running on http://0.0.0.0:${port}/`);
    startScheduler();
  });
}
startServer().catch(console.error);
