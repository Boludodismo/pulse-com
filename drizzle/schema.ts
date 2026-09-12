import {INBOX_MODULES} from '../shared/intelligentInbox';
export { careRules, careEvents, careSessions, careTags } from "./customerCareSchema";
import { mysqlTable, mysqlSchema, AnyMySqlColumn, index, uniqueIndex, json, int, bigint, varchar, mysqlEnum, timestamp, datetime, text, tinyint, decimal } from "drizzle-orm/mysql-core"
import { sql } from "drizzle-orm"

export const anamneseRequests = mysqlTable("anamnese_requests", {
	id: int().autoincrement().notNull(),
	clientId: int().notNull(),
	appointmentId: int(),
	token: varchar({ length: 64 }).notNull(),
	sentVia: mysqlEnum(['email','whatsapp']).notNull(),
	sentTo: varchar({ length: 320 }).notNull(),
	expiresAt: timestamp({ mode: 'string' }).notNull(),
	completedAt: timestamp({ mode: 'string' }),
	statusRequest: mysqlEnum(['pendente','preenchida','expirada','cancelada']).default('pendente').notNull(),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
},
(table) => [
	index("anamnese_requests_token_unique").on(table.token),
]);

export const anamneseSubmissions = mysqlTable("anamnese_submissions", {
	id: int().autoincrement().notNull(),
	requestId: int().notNull(),
	clientId: int().notNull(),
	appointmentId: int(),
	payloadJson: text().notNull(),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
});

export const anamnesisRecords = mysqlTable("anamnesisRecords", {
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
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	riskLevel: mysqlEnum(['low','medium','high','critical']).default('low').notNull(),
	riskFactors: text(),
});

export const appointments = mysqlTable("appointments", {
	id: int().autoincrement().notNull(),
	clientId: int().notNull(),
	calendarId: int(),
	date: datetime({ mode: 'string' }).notNull(),
	duration: int().notNull(),
	service: varchar({ length: 255 }).notNull(),
	artist: varchar({ length: 255 }).notNull(),
	artistId: int(), // FK opcional para artists.id — permite joins confiáveis por artista
	includeArtistCard: tinyint().default(0).notNull(),
	status: mysqlEnum(['agendado','confirmado','concluido','cancelado','reagendado']).default('agendado').notNull(),
	confirmationStatus: mysqlEnum(['pendente','confirmado','nao_confirmado','atraso','chegada_antecipada']).default('pendente'),
	notes: text(),
	referenceImageUrl: varchar({ length: 500 }),
	referenceImageKey: varchar({ length: 500 }),
	depositPaid: tinyint().default(0).notNull(),
	depositAmount: int(),
	totalAmount: int(),
	// Status de sinal (entrada)
	signalStatus: mysqlEnum(['aguardando_sinal','sinal_confirmado']).default('aguardando_sinal'),
	// Status de pagamento da tattoo
	paymentStatus: mysqlEnum(['pendente','pago']).default('pendente'),
	paymentMethod: mysqlEnum(['dinheiro','pix','cartao_credito','cartao_debito','transferencia','outro']),
	// Tipo de procedimento para anamnese
	procedureType: mysqlEnum(['tatuagem','piercing','micropigmentacao','laser','consulta','retoque','outro']),
	procedureTypeOther: varchar({ length: 255 }),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
	studioId: int().default(1).notNull(),
});
export const artists = mysqlTable("artists", {
	id: int().autoincrement().notNull(),
	name: varchar({ length: 255 }).notNull(),
	email: varchar({ length: 320 }),
	phone: varchar({ length: 20 }),
	instagram: varchar({ length: 100 }),
	specialty: varchar({ length: 255 }),
	bio: text(),
	photoUrl: varchar({ length: 500 }),
	photoKey: varchar({ length: 500 }),
	color: varchar({ length: 7 }), // Cor personalizada em hex, ex: #FF5733
	active: int().default(1).notNull(),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
	studioId: int().default(1).notNull(),
});

export const auditLogs = mysqlTable("auditLogs", {
	id: int().autoincrement().notNull(),
	userId: int().notNull(),
	userName: varchar({ length: 255 }),
	action: mysqlEnum(['create','update','delete','activate','deactivate']).notNull(),
	entity: mysqlEnum(['user','client','appointment','transaction','artist','settings']).notNull(),
	entityId: int(),
	entityName: varchar({ length: 255 }),
	details: text(),
	ipAddress: varchar({ length: 45 }),
	userAgent: varchar({ length: 500 }),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	studioId: int(),
});

export const calendars = mysqlTable("calendars", {
	id: int().autoincrement().notNull(),
	userId: int().notNull(),
	name: varchar({ length: 100 }).notNull(),
	description: text(),
	color: varchar({ length: 7 }).default('#8b5cf6').notNull(),
	isVisible: tinyint().default(1).notNull(),
	isDefault: tinyint().default(0).notNull(),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
});

export const clientNotes = mysqlTable("clientNotes", {
	id: int().autoincrement().notNull(),
	clientId: int().notNull(),
	authorId: int().notNull(),
	content: text().notNull(),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
});

export const clients = mysqlTable("clients", {
	isArchived: tinyint().default(0).notNull(),
	artistId: int(),
	id: int().autoincrement().notNull(),
	name: varchar({ length: 255 }).notNull(),
	email: varchar({ length: 320 }),
	phone: varchar({ length: 20 }),
	birthDate: datetime({ mode: 'string' }),
	instagram: varchar({ length: 100 }),
	cep: varchar({ length: 10 }),
	street: varchar({ length: 255 }),
	number: varchar({ length: 20 }),
	complement: varchar({ length: 100 }),
	reference: varchar({ length: 255 }),
	neighborhood: varchar({ length: 100 }),
	city: varchar({ length: 100 }),
	state: varchar({ length: 50 }),
	country: varchar({ length: 50 }).default('Brasil'),
	gender: mysqlEnum(['Homem','Mulher','Outros']),
	docType: mysqlEnum(['cpf','passport']).default('cpf'),
	docNumber: varchar({ length: 50 }),
	totalSpent: int().default(0).notNull(),
	appointmentCount: int().default(0).notNull(),
	loyaltyLevel: mysqlEnum(['Bronze','Prata','Ouro']).default('Bronze').notNull(),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
	studioId: int().default(1).notNull(),
});

export const galleryImages = mysqlTable("galleryImages", {
	id: int().autoincrement().notNull(),
	clientId: int().notNull(),
	appointmentId: int(),
	imageUrl: varchar({ length: 500 }).notNull(),
	imageKey: varchar({ length: 500 }).notNull(),
	description: text(),
	tags: text(),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
});

export const notificationLogs = mysqlTable("notificationLogs", {
	id: int().autoincrement().notNull(),
	type: mysqlEnum(['appointment_reminder','birthday_reminder','whatsapp_primary','whatsapp_resend']).notNull(),
	appointmentId: int(),
	clientId: int(),
	title: varchar({ length: 255 }).notNull(),
	message: text().notNull(),
	status: mysqlEnum(['sent','failed']).notNull(),
	sentAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
});

export const reportTemplates = mysqlTable("reportTemplates", {
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
	primaryColor: varchar({ length: 7 }).default('#8b5cf6'),
	logoUrl: varchar({ length: 500 }),
	logoKey: varchar({ length: 500 }),
	footerText: text(),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
});

export const studioSettings = mysqlTable("studioSettings", {
	studioId: int().unique(),
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
	primaryColor: varchar({ length: 7 }).default('#8b5cf6'),
	secondaryColor: varchar({ length: 7 }).default('#a78bfa'),
	businessHours: text(),
	enableBirthdayReminders: int().default(1).notNull(),
	enableAppointmentReminders: int().default(1).notNull(),
	// Configurações de lembrete WhatsApp
	reminderDaysBefore: int().default(1).notNull(),
	reminderSendTime: varchar({ length: 5 }).default('09:00'),
	reminderResend: int().default(0).notNull(),
	reminderResendTime: varchar({ length: 5 }).default('18:00'),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
});

export const studios = mysqlTable("studios", {
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
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
},
(table) => [
	index("studios_masterKey_unique").on(table.masterKey),
]);

export const transactions = mysqlTable("transactions", {
	id: int().autoincrement().notNull(),
	clientId: int(),
	appointmentId: int(),
	type: mysqlEnum(['entrada','saida']).notNull(),
	category: varchar({ length: 100 }).notNull(),
	description: text(),
	amount: int().notNull(),
	paymentMethod: mysqlEnum(['dinheiro','pix','credito','debito','transferencia']).notNull(),
	date: datetime({ mode: 'string' }).notNull(),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	studioId: int().default(1).notNull(),
});

export const users = mysqlTable("users", {
	id: int().autoincrement().notNull(),
	openId: varchar({ length: 64 }).notNull(),
	name: text(),
	email: varchar({ length: 320 }),
	loginMethod: varchar({ length: 64 }),
	role: mysqlEnum(['superadmin','admin','collaborator']).default('collaborator').notNull(),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
	lastSignedIn: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	artistId: int(),
	isActive: tinyint().default(1).notNull(),
	studioId: int(),
	passwordHash: varchar({ length: 255 }),
	accessStatus: mysqlEnum(['active','suspended','expired']).default('active').notNull(),
	accessExpiresAt: timestamp({ mode: 'string' }),
}, (table) => [uniqueIndex("idx_users_openId").on(table.openId)]);

// ============ SAAS: CONVITES E PERMISSÕES ============

export const studioInvitations = mysqlTable("studio_invitations", {
	artistId: int(),
	permissionSnapshot: json().$type<import("../shared/artistInvitations").ArtistPermission[]>(),
	id: int().autoincrement().notNull(),
	studioId: int().notNull(),
	email: varchar({ length: 320 }).notNull(),
	role: mysqlEnum(['admin','collaborator']).notNull(),
	tokenHash: varchar({ length: 128 }).notNull(),
	status: mysqlEnum(['pending','accepted','revoked','expired']).default('pending').notNull(),
	expiresAt: timestamp({ mode: 'string' }).notNull(),
	invitedByUserId: int().notNull(),
	acceptedUserId: int(),
	acceptedAt: timestamp({ mode: 'string' }),
	revokedAt: timestamp({ mode: 'string' }),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
}, (table) => [
	uniqueIndex("studio_invitations_tokenHash_unique").on(table.tokenHash),
	index("studio_invitations_studio_idx").on(table.studioId),
	index("studio_invitations_email_idx").on(table.email),
]);

export const userModulePermissions = mysqlTable("user_module_permissions", {
	id: int().autoincrement().notNull(),
	userId: int().notNull(),
	studioId: int().notNull(),
	module: mysqlEnum(['clients','appointments','stock','finance','anamnesis','pod','reports',...INBOX_MODULES]).notNull(),
	canRead: tinyint().default(0).notNull(),
	canWrite: tinyint().default(0).notNull(),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
}, (table) => [
	uniqueIndex("user_module_permissions_user_studio_module_unique").on(table.userId, table.studioId, table.module),
	index("user_module_permissions_studio_idx").on(table.studioId),
]);

// ============ ESTOQUE E FORNECEDORES ============

export const suppliers = mysqlTable("suppliers", {
	studioId: int(), // Legacy rows remain unassigned until ownership is verified.
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
	createdAt: bigint({ mode: 'number' }).default(0).notNull(),
	updatedAt: bigint({ mode: 'number' }).default(0).notNull(),
});

export const materials = mysqlTable("materials", {
	studioId: int(), // Legacy rows remain unassigned until ownership is verified.
	id: int().autoincrement().notNull(),
	name: varchar({ length: 255 }).notNull(),
	category: varchar({ length: 100 }),
	unit: varchar({ length: 50 }),
	currentStock: decimal({ precision: 10, scale: 2 }).default('0').notNull(),
	minStock: decimal({ precision: 10, scale: 2 }).default('0').notNull(),
	avgPrice: decimal({ precision: 10, scale: 2 }).default('0').notNull(),
	supplierId: int(),
	notes: text(),
	isActive: tinyint().default(1).notNull(),
	createdAt: bigint({ mode: 'number' }).default(0).notNull(),
	updatedAt: bigint({ mode: 'number' }).default(0).notNull(),
});

export const stockMovements = mysqlTable("stock_movements", {
	id: int().autoincrement().notNull(),
	materialId: int().notNull(),
	type: mysqlEnum(['entrada','saida','ajuste']).notNull(),
	quantity: decimal({ precision: 10, scale: 2 }).notNull(),
	previousStock: decimal({ precision: 10, scale: 2 }).notNull(),
	newStock: decimal({ precision: 10, scale: 2 }).notNull(),
	reason: varchar({ length: 255 }),
	notes: text(),
	createdBy: int(),
	createdAt: bigint({ mode: 'number' }).default(0).notNull(),
});

// ============================================================
// Catálogo técnico global e estoque isolado por estúdio
// Estruturas novas: os materiais e movimentos legados permanecem
// somente para consulta até que haja uma associação auditável.
// ============================================================

export const materialCatalogCategories = mysqlTable("material_catalog_categories", {
	id: int().autoincrement().notNull(),
	code: varchar({ length: 80 }).notNull(),
	name: varchar({ length: 120 }).notNull(),
	icon: varchar({ length: 80 }),
	description: text(),
	isActive: tinyint().default(1).notNull(),
	createdAt: timestamp({ mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
}, (table) => [
	uniqueIndex("material_catalog_categories_code_unique").on(table.code),
	index("material_catalog_categories_active_idx").on(table.isActive, table.name),
]);

export const materialCatalogItems = mysqlTable("material_catalog_items", {
	id: int().autoincrement().notNull(),
	categoryId: int().notNull(),
	code: varchar({ length: 120 }).notNull(),
	name: varchar({ length: 255 }).notNull(),
	subcategory: varchar({ length: 120 }),
	configuration: varchar({ length: 120 }),
	diameter: varchar({ length: 40 }),
	defaultUnit: varchar({ length: 50 }).default('unidade').notNull(),
	technicalSpecification: text(),
	icon: varchar({ length: 80 }),
	isActive: tinyint().default(1).notNull(),
	createdAt: timestamp({ mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
}, (table) => [
	uniqueIndex("material_catalog_items_code_unique").on(table.code),
	index("material_catalog_items_category_idx").on(table.categoryId, table.isActive),
	index("material_catalog_items_lookup_idx").on(table.name, table.subcategory, table.configuration),
]);

export const tenantMaterials = mysqlTable("tenant_materials", {
	id: int().autoincrement().notNull(),
	studioId: int().notNull(),
	ownerArtistId: int(),
	catalogItemId: int(),
	legacyMaterialId: int(),
	name: varchar({ length: 255 }).notNull(),
	category: varchar({ length: 120 }),
	unit: varchar({ length: 50 }).default('unidade').notNull(),
	brand: varchar({ length: 120 }),
	line: varchar({ length: 120 }),
	model: varchar({ length: 120 }),
	configuration: varchar({ length: 120 }),
	diameter: varchar({ length: 40 }),
	currentQuantity: decimal({ precision: 12, scale: 3 }).default('0').notNull(),
	minimumQuantity: decimal({ precision: 12, scale: 3 }).default('0').notNull(),
	unitCost: decimal({ precision: 12, scale: 4 }).default('0').notNull(),
	supplierId: int(),
	lot: varchar({ length: 120 }),
	expiresAt: datetime({ mode: 'string' }),
	notes: text(),
	isActive: tinyint().default(1).notNull(),
	createdByUserId: int(),
	createdAt: timestamp({ mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
}, (table) => [
	index("tenant_materials_studio_active_idx").on(table.studioId, table.isActive, table.name),
	index("tenant_materials_catalog_idx").on(table.studioId, table.catalogItemId),
	index("tenant_materials_supplier_idx").on(table.studioId, table.supplierId),
	uniqueIndex("tenant_materials_legacy_source_unique").on(table.studioId, table.legacyMaterialId),
]);

export const studioMaterialArtists = mysqlTable("studio_material_artists", {
  id: int().autoincrement().primaryKey(),
  studioId: int().notNull(),
  tenantMaterialId: int().notNull(),
  artistId: int().notNull(),
}, (table) => [
  uniqueIndex("studio_material_artist_unique").on(table.studioId, table.tenantMaterialId, table.artistId),
]);

export const tenantInventoryMovements = mysqlTable("tenant_inventory_movements", {
	id: int().autoincrement().notNull(),
	studioId: int().notNull(),
	tenantMaterialId: int().notNull(),
	type: mysqlEnum(['entrada','consumo','reversao','ajuste']).notNull(),
	quantity: decimal({ precision: 12, scale: 3 }).notNull(),
	previousQuantity: decimal({ precision: 12, scale: 3 }).notNull(),
	newQuantity: decimal({ precision: 12, scale: 3 }).notNull(),
	sourceType: varchar({ length: 80 }),
	sourceId: int(),
	reason: varchar({ length: 255 }),
	notes: text(),
	createdByUserId: int(),
	createdAt: timestamp({ mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
	index("tenant_inventory_movements_studio_material_idx").on(table.studioId, table.tenantMaterialId, table.createdAt),
	index("tenant_inventory_movements_source_idx").on(table.sourceType, table.sourceId),
]);

export const appointmentPlannedMaterials = mysqlTable("appointment_planned_materials", {
	id: int().autoincrement().notNull(),
	studioId: int().notNull(),
	appointmentId: int().notNull(),
	tenantMaterialId: int(),
	catalogItemId: int(),
	nameSnapshot: varchar({ length: 255 }).notNull(),
	unitSnapshot: varchar({ length: 50 }).notNull(),
	quantityPlanned: decimal({ precision: 12, scale: 3 }).notNull(),
	status: mysqlEnum(['planejado','consumido','nao_utilizado']).default('planejado').notNull(),
	createdByUserId: int(),
	createdAt: timestamp({ mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
}, (table) => [
	index("appointment_planned_materials_appointment_idx").on(table.studioId, table.appointmentId, table.status),
	index("appointment_planned_materials_material_idx").on(table.studioId, table.tenantMaterialId),
]);

export const procedurePauses = mysqlTable("procedure_pauses", {
	id: int().autoincrement().notNull(),
	procedureId: int().notNull(),
	studioId: int().notNull(),
	artistId: int(),
	startedAt: datetime({ mode: 'string' }).notNull(),
	endedAt: datetime({ mode: 'string' }),
	reason: varchar({ length: 120 }),
	createdAt: timestamp({ mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
}, (table) => [
	index("procedure_pauses_procedure_idx").on(table.procedureId, table.startedAt),
	index("procedure_pauses_studio_open_idx").on(table.studioId, table.endedAt),
]);

export const procedureInventoryConsumptions = mysqlTable("procedure_inventory_consumptions", {
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
	expiresAtSnapshot: datetime({ mode: 'string' }),
	status: mysqlEnum(['consumido','revertido']).default('consumido').notNull(),
	consumedAt: datetime({ mode: 'string' }).notNull(),
	reversedAt: datetime({ mode: 'string' }),
	reversalReason: varchar({ length: 255 }),
	createdByUserId: int(),
	reversedByUserId: int(),
	createdAt: timestamp({ mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
}, (table) => [
	index("procedure_inventory_consumptions_procedure_idx").on(table.procedureId, table.status, table.consumedAt),
	index("procedure_inventory_consumptions_studio_client_idx").on(table.studioId, table.clientId, table.consumedAt),
	index("procedure_inventory_consumptions_material_idx").on(table.studioId, table.tenantMaterialId, table.status),
]);

export const purchaseOrders = mysqlTable("purchase_orders", {
	studioId: int(), // Legacy rows remain unassigned until ownership is verified.
	id: int().autoincrement().notNull(),
	supplierId: int(),
	status: mysqlEnum(['rascunho','enviado','confirmado','recebido','cancelado']).default('rascunho').notNull(),
	notes: text(),
	totalAmount: decimal({ precision: 10, scale: 2 }),
	sentAt: bigint({ mode: 'number' }),
	createdBy: int(),
	createdAt: bigint({ mode: 'number' }).default(0).notNull(),
	updatedAt: bigint({ mode: 'number' }).default(0).notNull(),
});

export const inventoryKits = mysqlTable("inventory_kits", {
	id: int().autoincrement().notNull(), studioId: int().notNull(), name: varchar({ length: 160 }).notNull(),
	description: varchar({ length: 500 }), isActive: tinyint().default(1).notNull(), createdByUserId: int(),
	createdAt: timestamp({ mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(), updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
}, (table) => [index("inventory_kits_studio_active_idx").on(table.studioId, table.isActive, table.name)]);

export const inventoryKitItems = mysqlTable("inventory_kit_items", {
	id: int().autoincrement().notNull(), studioId: int().notNull(), kitId: int().notNull(), tenantMaterialId: int().notNull(),
	quantity: decimal({ precision: 12, scale: 3 }).notNull(),
}, (table) => [
	uniqueIndex("inventory_kit_items_material_unique").on(table.studioId, table.kitId, table.tenantMaterialId),
	index("inventory_kit_items_kit_idx").on(table.studioId, table.kitId),
]);

export const purchaseOrderItems = mysqlTable("purchase_order_items", {
	id: int().autoincrement().notNull(),
	orderId: int().notNull(),
	materialId: int(),
	materialName: varchar({ length: 255 }),
	materialUnit: varchar({ length: 50 }),
	quantity: decimal({ precision: 10, scale: 2 }).notNull(),
	unitPrice: decimal({ precision: 10, scale: 2 }).default('0').notNull(),
	notes: text(),
});

export const appointmentReminders = mysqlTable("appointmentReminders", {
	id: int().autoincrement().notNull(),
	appointmentId: int().notNull(),
	scheduledAt: datetime({ mode: 'string' }).notNull(), // data e hora exata do envio
	message: text().notNull(),                           // mensagem personalizada
	status: mysqlEnum(['pending','sent','failed']).default('pending').notNull(),
	sentAt: timestamp({ mode: 'string' }),               // quando foi enviado de fato
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
});

/** Links públicos de ação, emitidos por agendamento e consumidos uma única vez. */
export const appointmentActionLinks = mysqlTable("appointment_action_links", {
  id: int().autoincrement().notNull(),
  studioId: int("studio_id").notNull(),
  appointmentId: int("appointment_id").notNull(),
  action: mysqlEnum(["confirmed", "early", "late", "reschedule_requested"]).notNull(),
  tokenHash: varchar("token_hash", { length: 128 }).notNull(),
  expiresAt: datetime("expires_at", { mode: "string" }).notNull(),
  usedAt: timestamp("used_at", { mode: "string" }),
  createdAt: timestamp("created_at", { mode: "string" }).default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
  uniqueIndex("appointment_action_links_token_unique").on(table.tokenHash),
  index("appointment_action_links_appointment_idx").on(table.appointmentId, table.action),
  index("appointment_action_links_studio_idx").on(table.studioId, table.expiresAt),
]);

/** Alertas internos gerados a partir de uma ação do cliente no link público. */
export const appointmentActionAlerts = mysqlTable("appointment_action_alerts", {
  id: int().autoincrement().notNull(),
  studioId: int("studio_id").notNull(),
  appointmentId: int("appointment_id").notNull(),
  actionLinkId: int("action_link_id").notNull(),
  action: mysqlEnum(["confirmed", "early", "late", "reschedule_requested"]).notNull(),
  status: mysqlEnum(["new", "viewed"]).default("new").notNull(),
  createdAt: timestamp("created_at", { mode: "string" }).default(sql`CURRENT_TIMESTAMP`).notNull(),
  viewedAt: timestamp("viewed_at", { mode: "string" }),
}, (table) => [
  uniqueIndex("appointment_action_alerts_link_unique").on(table.actionLinkId),
  index("appointment_action_alerts_studio_status_idx").on(table.studioId, table.status, table.createdAt),
  index("appointment_action_alerts_appointment_idx").on(table.appointmentId, table.createdAt),
]);

// ============ PERCENTUAL DE COLABORADORES ============

export const collaboratorRates = mysqlTable("collaboratorRates", {
	id: int().autoincrement().notNull(),
	artistId: int().notNull(),         // FK para artists.id
	percentage: int().notNull().default(50), // 0-100 inteiro
	studioId: int().default(1).notNull(),
	notes: varchar({ length: 500 }),
	createdAt: timestamp({ mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
});

// ============ RECUPERAÇÃO DE SENHA ============

export const passwordResetTokens = mysqlTable("passwordResetTokens", {
	id: int().autoincrement().notNull(),
	userId: int().notNull(),
	token: varchar({ length: 128 }).notNull(),
	expiresAt: timestamp({ mode: 'string' }).notNull(),
	usedAt: timestamp({ mode: 'string' }),
	createdAt: timestamp({ mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
	uniqueIndex("idx_password_reset_token").on(table.token),
]);

// ============================================================
// Módulo POD Session — Execução Técnica da Tatuagem
// ============================================================

export const technicalProcedures = mysqlTable("technical_procedures", {
	id: int().autoincrement().notNull(),
	studioId: int().default(1).notNull(),
	clientId: int().notNull(),
	appointmentId: int(), // opcional: vínculo com appointments.id
	artistId: int(),
	artistName: varchar({ length: 255 }),
	title: varchar({ length: 255 }).notNull(),
	description: text(),
	bodyLocation: varchar({ length: 100 }),
	tattooStyle: varchar({ length: 100 }),
	chargedAmount: int().default(0), // em centavos
	status: mysqlEnum(['em_andamento','pausado','finalizado','retorno','retoque']).default('em_andamento').notNull(),
	startedAt: datetime({ mode: 'string' }),
	pausedAt: datetime({ mode: 'string' }),
	finishedAt: datetime({ mode: 'string' }),
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
	createdAt: timestamp({ mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
});

export const procedureConsumables = mysqlTable("procedure_consumables", {
	id: int().autoincrement().notNull(),
	procedureId: int().notNull(),
	inventoryItemId: int(), // opcional: vínculo com materials.id
	category: mysqlEnum(['ink','cartridge','disposable','liquid','protection','stencil','aftercare','other']).notNull(),
	name: varchar({ length: 255 }).notNull(),
	unit: mysqlEnum(['drop','ml','unit','pair','gram','portion','roll_fraction']).default('unit').notNull(),
	quantity: decimal({ precision: 10, scale: 2 }).default('0').notNull(),
	estimatedUnitCost: decimal({ precision: 10, scale: 2 }).default('0'), // em reais
	estimatedTotalCost: decimal({ precision: 10, scale: 2 }).default('0'), // em reais
	notes: text(),
	createdAt: timestamp({ mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
});

export const procedureImages = mysqlTable("procedure_images", {
	id: int().autoincrement().notNull(),
	procedureId: int().notNull(),
	imageUrl: varchar({ length: 500 }).notNull(),
	imageKey: varchar({ length: 500 }).notNull(),
	imageType: mysqlEnum(['reference','stencil','progress','final','healed','other']).default('other').notNull(),
	description: text(),
	createdAt: timestamp({ mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const procedureEvents = mysqlTable("procedure_events", {
	id: int().autoincrement().notNull(),
	procedureId: int().notNull(),
	eventType: varchar({ length: 50 }).notNull(), // 'start','pause','resume','finish','consumable_added','consumable_removed','note_added'
	payload: text(), // JSON string com dados do evento
	createdAt: timestamp({ mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Export types for insert operations
export type InsertUser = typeof users.$inferInsert;
export type InsertClient = typeof clients.$inferInsert;
export type InsertAppointment = typeof appointments.$inferInsert;
export type InsertAnamnesisRecord = typeof anamnesisRecords.$inferInsert;
export type InsertTransaction = typeof transactions.$inferInsert;
export type InsertClientNote = typeof clientNotes.$inferInsert;
export type InsertGalleryImage = typeof galleryImages.$inferInsert;
export type InsertNotificationLog = typeof notificationLogs.$inferInsert;
export type InsertStudioSettings = typeof studioSettings.$inferInsert;
export type InsertArtist = typeof artists.$inferInsert;
export type InsertAuditLog = typeof auditLogs.$inferInsert;
export type InsertCalendar = typeof calendars.$inferInsert;
export type InsertAnamneseRequest = typeof anamneseRequests.$inferInsert;
export type InsertAnamneseSubmission = typeof anamneseSubmissions.$inferInsert;

// Export types for select operations
export type User = typeof users.$inferSelect;
export type Client = typeof clients.$inferSelect;
export type Appointment = typeof appointments.$inferSelect;
export type AnamnesisRecord = typeof anamnesisRecords.$inferSelect;
export type Transaction = typeof transactions.$inferSelect;
export type ClientNote = typeof clientNotes.$inferSelect;
export type GalleryImage = typeof galleryImages.$inferSelect;
export type NotificationLog = typeof notificationLogs.$inferSelect;
export type StudioSettings = typeof studioSettings.$inferSelect;
export type Artist = typeof artists.$inferSelect;
export type AuditLog = typeof auditLogs.$inferSelect;
export type Calendar = typeof calendars.$inferSelect;
export type AnamneseRequest = typeof anamneseRequests.$inferSelect;
export type AnamneseSubmission = typeof anamneseSubmissions.$inferSelect;
export type Studio = typeof studios.$inferSelect;
export type Supplier = typeof suppliers.$inferSelect;
export type Material = typeof materials.$inferSelect;
export type StockMovement = typeof stockMovements.$inferSelect;
export type PurchaseOrder = typeof purchaseOrders.$inferSelect;
export type PurchaseOrderItem = typeof purchaseOrderItems.$inferSelect;
export type InsertSupplier = typeof suppliers.$inferInsert;
export type InsertMaterial = typeof materials.$inferInsert;
export type InsertStockMovement = typeof stockMovements.$inferInsert;
export type InsertPurchaseOrder = typeof purchaseOrders.$inferInsert;
export type InsertPurchaseOrderItem = typeof purchaseOrderItems.$inferInsert;
export type InsertAppointmentReminder = typeof appointmentReminders.$inferInsert;
export type AppointmentReminder = typeof appointmentReminders.$inferSelect;
export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;
export type CollaboratorRate = typeof collaboratorRates.$inferSelect;
export type InsertCollaboratorRate = typeof collaboratorRates.$inferInsert;
export type InsertPasswordResetToken = typeof passwordResetTokens.$inferInsert;

// ── Central de Mensagens / WhatsApp Automático ─────────────────────────────

export const whatsappIntegrations = mysqlTable("whatsapp_integrations", {
  id: int().autoincrement().notNull(),
  studioId: int("studio_id"),
  name: varchar({ length: 255 }).notNull().default('WhatsApp Principal'),
  provider: mysqlEnum(['botconversa', 'zapi', 'meta']).notNull(),
  phoneNumber: varchar({ length: 30 }).notNull(),
  apiToken: varchar({ length: 1000 }).notNull(),
  encryptedApiToken: text("encrypted_api_token"),
  encryptedWebhookSecret: text("encrypted_webhook_secret"),
  connectionKey: varchar("connection_key", { length: 96 }),
  sandboxMode: tinyint("sandbox_mode").default(1).notNull(),
  sandboxTestPhone: varchar("sandbox_test_phone", { length: 32 }),
  productionActivatedAt: timestamp("production_activated_at", { mode: 'string' }),
  productionActivatedByUserId: int("production_activated_by_user_id"),
  isEnabled: tinyint("is_enabled").default(0).notNull(),
  lastSuccessAt: timestamp("last_success_at", { mode: 'string' }),
  failureCount: int("failure_count").default(0).notNull(),
  instanceId: varchar({ length: 255 }), // Z-API instance ID
  webhookUrl: varchar({ length: 500 }), // URL do webhook de retorno
  status: mysqlEnum(['ativo', 'inativo', 'erro', 'aguardando']).default('aguardando').notNull(),
  lastTestedAt: timestamp({ mode: 'string' }),
  lastErrorMessage: text(),
  createdAt: timestamp({ mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp({ mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
  uniqueIndex("whatsapp_integrations_connection_key_unique").on(table.connectionKey),
  index("whatsapp_integrations_studio_status_idx").on(table.studioId, table.status),
]);

export const messageTemplates = mysqlTable("message_templates", {
  id: int().autoincrement().notNull(),
  studioId: int("studio_id"),
  name: varchar({ length: 255 }).notNull(),
  trigger: mysqlEnum(['appointment_created', 'appointment_confirmed', 'appointment_reminder_24h', 'appointment_reminder_2h', 'appointment_reminder_1h', 'appointment_cancelled', 'appointment_rescheduled', 'care_guide', 'custom']).notNull(),
  recipientType: mysqlEnum(['client', 'artist']).notNull(),
  message: text().notNull(),
  isActive: tinyint().default(1).notNull(),
  createdAt: timestamp({ mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp({ mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
});

/** Preferências de mensagens automáticas, sempre isoladas por estúdio. */
export const messageAutomationSettings = mysqlTable("message_automation_settings", {
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
  updatedAt: timestamp("updated_at", { mode: "string" }).default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
  uniqueIndex("message_automation_settings_studio_unique").on(table.studioId),
]);

export const messageQueue = mysqlTable("message_queue", {
  id: int().autoincrement().notNull(),
  studioId: int("studio_id"),
  integrationId: int().notNull(),
  appointmentId: int(),
  clientId: int(),
  retryOfQueueId: int("retry_of_queue_id"),
  recipientPhone: varchar({ length: 30 }).notNull(),
  recipientName: varchar({ length: 255 }),
  recipientType: mysqlEnum(['client', 'artist']).notNull(),
  message: text().notNull(),
  trigger: varchar({ length: 100 }),
  status: mysqlEnum(['pendente', 'enviada', 'erro', 'cancelada', 'respondida']).default('pendente').notNull(),
  scheduledAt: timestamp({ mode: 'string' }),
  sentAt: timestamp({ mode: 'string' }),
  errorMessage: text(),
  providerMessageId: varchar({ length: 255 }), // ID retornado pelo provedor
  createdAt: timestamp({ mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
  index("message_queue_retry_of_idx").on(table.retryOfQueueId),
]);

/** Vínculo seguro entre cliente local e assinante externo, incluindo consentimento. */
export const integrationContacts = mysqlTable("integration_contacts", {
  id: int().autoincrement().notNull(),
  studioId: int("studio_id").notNull(),
  integrationId: int("integration_id").notNull(),
  clientId: int("client_id").notNull(),
  normalizedPhone: varchar("normalized_phone", { length: 32 }).notNull(),
  providerSubscriberId: varchar("provider_subscriber_id", { length: 255 }),
  hasWhatsappOptIn: tinyint("has_whatsapp_opt_in").default(0).notNull(),
  optInAt: timestamp("opt_in_at", { mode: 'string' }),
  optInSource: varchar("opt_in_source", { length: 100 }),
  optedOutAt: timestamp("opted_out_at", { mode: 'string' }),
  createdAt: timestamp({ mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp({ mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
  uniqueIndex("integration_contacts_studio_client_unique").on(table.studioId, table.clientId),
  index("integration_contacts_studio_phone_lookup").on(table.studioId, table.normalizedPhone),
  index("integration_contacts_integration_idx").on(table.integrationId),
]);

/** Fila transacional para chamadas externas: não bloqueia nenhuma operação do CRM. */
export const integrationJobs = mysqlTable("integration_jobs", {
  id: int().autoincrement().notNull(),
  studioId: int("studio_id").notNull(),
  integrationId: int("integration_id").notNull(),
  type: mysqlEnum(['sync_contact', 'send_template', 'dispatch_flow', 'process_inbound']).notNull(),
  payload: text().notNull(),
  idempotencyKey: varchar("idempotency_key", { length: 128 }).notNull(),
  status: mysqlEnum(['pending', 'processing', 'completed', 'retry', 'failed', 'cancelled']).default('pending').notNull(),
  attemptCount: int("attempt_count").default(0).notNull(),
  maxAttempts: int("max_attempts").default(5).notNull(),
  nextAttemptAt: timestamp("next_attempt_at", { mode: 'string' }),
  lockedAt: timestamp("locked_at", { mode: 'string' }),
  completedAt: timestamp("completed_at", { mode: 'string' }),
  lastError: text("last_error"),
  createdAt: timestamp({ mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp({ mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
  uniqueIndex("integration_jobs_idempotency_unique").on(table.idempotencyKey),
  index("integration_jobs_ready_idx").on(table.status, table.nextAttemptAt),
  index("integration_jobs_studio_idx").on(table.studioId, table.createdAt),
]);

/** Auditoria sanitizada e idempotente de eventos recebidos e enviados. */
export const integrationEvents = mysqlTable("integration_events", {
  id: int().autoincrement().notNull(),
  studioId: int("studio_id").notNull(),
  integrationId: int("integration_id").notNull(),
  direction: mysqlEnum(['inbound', 'outbound']).notNull(),
  type: varchar({ length: 100 }).notNull(),
  idempotencyKey: varchar("idempotency_key", { length: 128 }).notNull(),
  providerEventId: varchar("provider_event_id", { length: 255 }),
  payloadHash: varchar("payload_hash", { length: 64 }).notNull(),
  status: mysqlEnum(['received', 'queued', 'processed', 'failed', 'ignored']).default('received').notNull(),
  errorMessage: text("error_message"),
  receivedAt: timestamp("received_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
  processedAt: timestamp("processed_at", { mode: 'string' }),
}, (table) => [
  uniqueIndex("integration_events_idempotency_unique").on(table.idempotencyKey),
  index("integration_events_connection_idx").on(table.integrationId, table.receivedAt),
  index("integration_events_studio_idx").on(table.studioId, table.receivedAt),
]);

/** Identificador persistido da rotina Heartbeat encarregada da fila durável. */
export const integrationSchedules = mysqlTable("integration_schedules", {
  id: int().autoincrement().notNull(),
  code: varchar({ length: 100 }).notNull(),
  scheduleCronTaskUid: varchar("schedule_cron_task_uid", { length: 65 }),
  isEnabled: tinyint("is_enabled").default(0).notNull(),
  lastRunAt: timestamp("last_run_at", { mode: 'string' }),
  lastError: text("last_error"),
  createdAt: timestamp({ mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp({ mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
  uniqueIndex("integration_schedules_code_unique").on(table.code),
  uniqueIndex("integration_schedules_task_uid_unique").on(table.scheduleCronTaskUid),
]);

// Types
export type WhatsappIntegration = typeof whatsappIntegrations.$inferSelect;
export type InsertWhatsappIntegration = typeof whatsappIntegrations.$inferInsert;
export type MessageTemplate = typeof messageTemplates.$inferSelect;
export type InsertMessageTemplate = typeof messageTemplates.$inferInsert;
export type MessageAutomationSettings = typeof messageAutomationSettings.$inferSelect;
export type InsertMessageAutomationSettings = typeof messageAutomationSettings.$inferInsert;
export type MessageQueueItem = typeof messageQueue.$inferSelect;
export type InsertMessageQueueItem = typeof messageQueue.$inferInsert;
export type IntegrationContact = typeof integrationContacts.$inferSelect;
export type InsertIntegrationContact = typeof integrationContacts.$inferInsert;
export type IntegrationJob = typeof integrationJobs.$inferSelect;
export type InsertIntegrationJob = typeof integrationJobs.$inferInsert;
export type IntegrationEvent = typeof integrationEvents.$inferSelect;
export type InsertIntegrationEvent = typeof integrationEvents.$inferInsert;
export type IntegrationSchedule = typeof integrationSchedules.$inferSelect;
export type InsertIntegrationSchedule = typeof integrationSchedules.$inferInsert;

export * from './studioRelationsSchema';

export * from './intelligentInboxSchema';
