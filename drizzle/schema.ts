import { mysqlTable, mysqlSchema, AnyMySqlColumn, index, uniqueIndex, int, bigint, varchar, mysqlEnum, timestamp, datetime, text, tinyint, decimal } from "drizzle-orm/mysql-core"
import { sql } from "drizzle-orm"

export const anamneseRequests = mysqlTable("anamnese_requests", {
	id: int().autoincrement().primaryKey().notNull(),
	clientId: int().notNull(),
	appointmentId: int(),
	token: varchar({ length: 64 }).notNull(),
	sentVia: mysqlEnum(['email','whatsapp']).notNull(),
	sentTo: varchar({ length: 320 }).notNull(),
	expiresAt: timestamp({ mode: 'string' }).notNull(),
	completedAt: timestamp({ mode: 'string' }),
	statusRequest: mysqlEnum(['pendente','preenchida','expirada','cancelada']).default('pendente').notNull(),
	source: mysqlEnum(['public_link','legacy_csv']).default('public_link').notNull(),
	importBatchId: int(),
	originalArtistName: varchar({ length: 255 }),
	procedureDate: datetime({ mode: 'string' }),
	procedureDateStatus: mysqlEnum(['inferred','confirmed']).default('inferred').notNull(),
	createdAt: timestamp({ mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
},
(table) => [
	index("anamnese_requests_token_unique").on(table.token),
]);

export const anamneseSubmissions = mysqlTable("anamnese_submissions", {
	id: int().autoincrement().primaryKey().notNull(),
	requestId: int().notNull(),
	clientId: int().notNull(),
	appointmentId: int(),
	payloadJson: text().notNull(),
	riskLevel: mysqlEnum(['low','medium','high','critical']).default('low').notNull(),
	riskFactors: text(),
	riskVersion: varchar({ length: 20 }).default('2026.1').notNull(),
	createdAt: timestamp({ mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const anamnesisRiskHistory = mysqlTable("anamnesis_risk_history", {
	id: int().autoincrement().primaryKey().notNull(),
	studioId: int().notNull(),
	clientId: int().notNull(),
	appointmentId: int(),
	submissionId: int(),
	anamnesisRecordId: int(),
	source: mysqlEnum(['public_link','manual','legacy_csv']).notNull(),
	eventType: mysqlEnum(['created','updated']).default('created').notNull(),
	riskLevel: mysqlEnum(['low','medium','high','critical']).notNull(),
	riskFactors: text().notNull(),
	riskVersion: varchar({ length: 20 }).default('2026.1').notNull(),
	createdAt: timestamp({ mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
	index("risk_history_studio_created_idx").on(table.studioId, table.createdAt),
	index("risk_history_client_created_idx").on(table.clientId, table.createdAt),
]);

export const anamnesisRecords = mysqlTable("anamnesisRecords", {
	id: int().autoincrement().primaryKey().notNull(),
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
	createdAt: timestamp({ mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	riskLevel: mysqlEnum(['low','medium','high','critical']).default('low').notNull(),
	riskFactors: text(),
});

export const appointments = mysqlTable("appointments", {
	id: int().autoincrement().primaryKey().notNull(),
	clientId: int().notNull(),
	calendarId: int(),
	date: datetime({ mode: 'string' }).notNull(),
	duration: int().notNull(),
	service: varchar({ length: 255 }).notNull(),
	artist: varchar({ length: 255 }).notNull(),
	artistId: int(), // FK opcional para artists.id — permite joins confiáveis por artista
	status: mysqlEnum(['agendado','confirmado','concluido','cancelado','reagendado']).default('agendado').notNull(),
	confirmationStatus: mysqlEnum(['pendente','confirmado','nao_confirmado','atraso','chegada_antecipada','reagendar']).default('pendente'),
	confirmationDelayMinutes: int(),
	confirmationAttention: mysqlEnum(['none','pending','accepted','resolved','reschedule']).default('none').notNull(),
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
	createdAt: timestamp({ mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
	studioId: int().default(1).notNull(),
});
export const artists = mysqlTable("artists", {
	id: int().autoincrement().primaryKey().notNull(),
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
	createdAt: timestamp({ mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
	studioId: int().default(1).notNull(),
});

export const auditLogs = mysqlTable("auditLogs", {
	id: int().autoincrement().primaryKey().notNull(),
	userId: int().notNull(),
	userName: varchar({ length: 255 }),
	action: mysqlEnum(['create','update','delete','activate','deactivate']).notNull(),
	entity: mysqlEnum(['user','client','appointment','transaction','artist','settings']).notNull(),
	entityId: int(),
	entityName: varchar({ length: 255 }),
	details: text(),
	ipAddress: varchar({ length: 45 }),
	userAgent: varchar({ length: 500 }),
	createdAt: timestamp({ mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	studioId: int(),
});

export const calendars = mysqlTable("calendars", {
	id: int().autoincrement().primaryKey().notNull(),
	userId: int().notNull(),
	name: varchar({ length: 100 }).notNull(),
	description: text(),
	color: varchar({ length: 7 }).default('#8b5cf6').notNull(),
	isVisible: tinyint().default(1).notNull(),
	isDefault: tinyint().default(0).notNull(),
	createdAt: timestamp({ mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
});

export const clientNotes = mysqlTable("clientNotes", {
	id: int().autoincrement().primaryKey().notNull(),
	clientId: int().notNull(),
	authorId: int().notNull(),
	content: text().notNull(),
	createdAt: timestamp({ mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
});

export const clients = mysqlTable("clients", {
	artistId: int(),
	id: int().autoincrement().primaryKey().notNull(),
	name: varchar({ length: 255 }).notNull(),
	email: varchar({ length: 320 }),
	phone: varchar({ length: 20 }),
	birthDate: timestamp({ mode: 'string' }),
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
	docType: mysqlEnum(['cpf','rg','passport','other']).default('cpf'),
	docNumber: varchar({ length: 50 }),
	totalSpent: int().default(0).notNull(),
	appointmentCount: int().default(0).notNull(),
	loyaltyLevel: mysqlEnum(['Bronze','Prata','Ouro']).default('Bronze').notNull(),
	createdAt: timestamp({ mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
	studioId: int().default(1).notNull(),
});

export const galleryImages = mysqlTable("galleryImages", {
	id: int().autoincrement().primaryKey().notNull(),
	clientId: int().notNull(),
	appointmentId: int(),
	imageUrl: varchar({ length: 500 }).notNull(),
	imageKey: varchar({ length: 500 }).notNull(),
	description: text(),
	tags: text(),
	createdAt: timestamp({ mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const notificationLogs = mysqlTable("notificationLogs", {
	id: int().autoincrement().primaryKey().notNull(),
	type: mysqlEnum(['appointment_reminder','birthday_reminder','whatsapp_primary','whatsapp_resend','appointment_response']).notNull(),
	appointmentId: int(),
	clientId: int(),
	title: varchar({ length: 255 }).notNull(),
	message: text().notNull(),
	status: mysqlEnum(['sent','failed']).notNull(),
	sentAt: timestamp({ mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const reportTemplates = mysqlTable("reportTemplates", {
	id: int().autoincrement().primaryKey().notNull(),
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
	createdAt: timestamp({ mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
});

export const studioSettings = mysqlTable("studioSettings", {
	id: int().autoincrement().primaryKey().notNull(),
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
	createdAt: timestamp({ mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
});

export const studios = mysqlTable("studios", {
	id: int().autoincrement().primaryKey().notNull(),
	name: varchar({ length: 255 }).notNull(),
	email: varchar({ length: 320 }),
	phone: varchar({ length: 20 }),
	address: text(),
	city: varchar({ length: 100 }),
	state: varchar({ length: 50 }),
	zipCode: varchar({ length: 20 }),
	masterKey: varchar({ length: 64 }).notNull(),
	isActive: tinyint().default(1).notNull(),
	createdAt: timestamp({ mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
},
(table) => [
	index("studios_masterKey_unique").on(table.masterKey),
]);

export const transactions = mysqlTable("transactions", {
	id: int().autoincrement().primaryKey().notNull(),
	clientId: int(),
	appointmentId: int(),
	type: mysqlEnum(['entrada','saida']).notNull(),
	category: varchar({ length: 100 }).notNull(),
	description: text(),
	amount: int().notNull(),
	paymentMethod: mysqlEnum(['dinheiro','pix','credito','debito','transferencia']).notNull(),
	date: datetime({ mode: 'string' }).notNull(),
	createdAt: timestamp({ mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	studioId: int().default(1).notNull(),
});

export const users = mysqlTable("users", {
	id: int().autoincrement().primaryKey().notNull(),
	openId: varchar({ length: 64 }).notNull(),
	name: text(),
	email: varchar({ length: 320 }),
	loginMethod: varchar({ length: 64 }),
	role: mysqlEnum(['superadmin','admin','collaborator']).default('collaborator').notNull(),
	createdAt: timestamp({ mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
	lastSignedIn: timestamp({ mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	artistId: int(),
	isActive: tinyint().default(1).notNull(),
	studioId: int(),
	passwordHash: varchar({ length: 255 }),
	profilePhotoUrl: varchar({ length: 500 }),
	profilePhotoKey: varchar({ length: 500 }),
}, (table) => [uniqueIndex("idx_users_openId").on(table.openId)]);

// ============ ESTOQUE E FORNECEDORES ============

export const suppliers = mysqlTable("suppliers", {
	id: int().autoincrement().primaryKey().notNull(),
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

// ============ CATÁLOGO TÉCNICO DE MATERIAIS ============

export const catalogBrands = mysqlTable("catalog_brands", {
	id: int().autoincrement().primaryKey().notNull(),
	name: varchar({ length: 255 }).notNull(),
	slug: varchar({ length: 255 }).notNull(),
	origin: varchar({ length: 100 }),
	website: varchar({ length: 500 }),
	isActive: tinyint().default(1).notNull(),
	createdAt: bigint({ mode: 'number' }).default(0).notNull(),
	updatedAt: bigint({ mode: 'number' }).default(0).notNull(),
}, (table) => [
	uniqueIndex("catalog_brands_slug_unique").on(table.slug),
	index("catalog_brands_name_idx").on(table.name),
]);

export const catalogProductLines = mysqlTable("catalog_product_lines", {
	id: int().autoincrement().primaryKey().notNull(),
	brandId: int().notNull(),
	name: varchar({ length: 255 }).notNull(),
	category: varchar({ length: 100 }).notNull(),
	description: text(),
	isActive: tinyint().default(1).notNull(),
	createdAt: bigint({ mode: 'number' }).default(0).notNull(),
	updatedAt: bigint({ mode: 'number' }).default(0).notNull(),
}, (table) => [
	uniqueIndex("catalog_product_lines_brand_name_unique").on(table.brandId, table.name),
	index("catalog_product_lines_category_idx").on(table.category),
]);

export const catalogVariants = mysqlTable("catalog_variants", {
	id: int().autoincrement().primaryKey().notNull(),
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
	baseUnit: varchar({ length: 50 }).default('un').notNull(),
	purchaseUnit: varchar({ length: 50 }).default('cx').notNull(),
	unitsPerPackage: decimal({ precision: 12, scale: 3 }).default('1').notNull(),
	volumeMl: decimal({ precision: 10, scale: 2 }),
	colorName: varchar({ length: 255 }),
	anvisaRegistration: varchar({ length: 100 }),
	anvisaStatus: mysqlEnum(['nao_aplicavel','regularizado','pendente','bloqueado']).default('nao_aplicavel').notNull(),
	requiresLotControl: tinyint().default(0).notNull(),
	application: text(),
	evidenceStatus: mysqlEnum(['fabricante','fornecedor','pendente','bloqueado']).default('pendente').notNull(),
	sourceUrl: varchar({ length: 1000 }),
	notes: text(),
	sortOrder: int().default(0).notNull(),
	isActive: tinyint().default(1).notNull(),
	createdAt: bigint({ mode: 'number' }).default(0).notNull(),
	updatedAt: bigint({ mode: 'number' }).default(0).notNull(),
}, (table) => [
	index("catalog_variants_line_idx").on(table.lineId),
	index("catalog_variants_category_idx").on(table.category),
	index("catalog_variants_sku_idx").on(table.sku),
	index("catalog_variants_format_idx").on(table.format),
]);

export const supplierCatalogOfferings = mysqlTable("supplier_catalog_offerings", {
	id: int().autoincrement().primaryKey().notNull(),
	supplierId: int().notNull(),
	brandId: int().notNull(),
	lineId: int(),
	variantId: int(),
	sourceUrl: varchar({ length: 1000 }),
	evidenceStatus: mysqlEnum(['item','marca','pendente']).default('pendente').notNull(),
	lastVerifiedAt: bigint({ mode: 'number' }),
	notes: text(),
	isActive: tinyint().default(1).notNull(),
	createdAt: bigint({ mode: 'number' }).default(0).notNull(),
	updatedAt: bigint({ mode: 'number' }).default(0).notNull(),
}, (table) => [
	index("supplier_catalog_offerings_supplier_idx").on(table.supplierId),
	index("supplier_catalog_offerings_brand_idx").on(table.brandId),
	index("supplier_catalog_offerings_line_idx").on(table.lineId),
	index("supplier_catalog_offerings_variant_idx").on(table.variantId),
]);

export const materials = mysqlTable("materials", {
	id: int().autoincrement().primaryKey().notNull(),
	name: varchar({ length: 255 }).notNull(),
	category: varchar({ length: 100 }),
	unit: varchar({ length: 50 }),
	baseUnit: varchar({ length: 50 }).default('un').notNull(),
	purchaseUnit: varchar({ length: 50 }).default('un').notNull(),
	unitsPerPackage: decimal({ precision: 12, scale: 3 }).default('1').notNull(),
	currentStock: decimal({ precision: 10, scale: 2 }).default('0').notNull(),
	minStock: decimal({ precision: 10, scale: 2 }).default('0').notNull(),
	targetStock: decimal({ precision: 10, scale: 2 }).default('0').notNull(),
	avgPrice: decimal({ precision: 10, scale: 2 }).default('0').notNull(),
	supplierId: int(),
	catalogVariantId: int(),
	requiresLotControl: tinyint().default(0).notNull(),
	anvisaStatus: mysqlEnum(['nao_aplicavel','regularizado','pendente','bloqueado']).default('nao_aplicavel').notNull(),
	notes: text(),
	isActive: tinyint().default(1).notNull(),
	createdAt: bigint({ mode: 'number' }).default(0).notNull(),
	updatedAt: bigint({ mode: 'number' }).default(0).notNull(),
});

export const stockMovements = mysqlTable("stock_movements", {
	id: int().autoincrement().primaryKey().notNull(),
	materialId: int().notNull(),
	type: mysqlEnum(['entrada','saida','ajuste']).notNull(),
	quantity: decimal({ precision: 10, scale: 2 }).notNull(),
	inputQuantity: decimal({ precision: 12, scale: 3 }),
	inputUnit: varchar({ length: 50 }),
	conversionFactor: decimal({ precision: 12, scale: 3 }).default('1').notNull(),
	previousStock: decimal({ precision: 10, scale: 2 }).notNull(),
	newStock: decimal({ precision: 10, scale: 2 }).notNull(),
	reason: varchar({ length: 255 }),
	lotNumber: varchar({ length: 100 }),
	expiresAt: datetime({ mode: 'string' }),
	source: mysqlEnum(['manual','procedimento','compra','ajuste']).default('manual').notNull(),
	notes: text(),
	createdBy: int(),
	createdAt: bigint({ mode: 'number' }).default(0).notNull(),
});

export const materialLots = mysqlTable("material_lots", {
	id: int().autoincrement().primaryKey().notNull(),
	materialId: int().notNull(),
	lotNumber: varchar({ length: 100 }).notNull(),
	expiresAt: datetime({ mode: 'string' }),
	currentQuantity: decimal({ precision: 12, scale: 3 }).default('0').notNull(),
	supplierId: int(),
	purchasePrice: decimal({ precision: 10, scale: 2 }),
	receivedAt: bigint({ mode: 'number' }).default(0).notNull(),
	isActive: tinyint().default(1).notNull(),
	createdAt: bigint({ mode: 'number' }).default(0).notNull(),
	updatedAt: bigint({ mode: 'number' }).default(0).notNull(),
}, (table) => [
	uniqueIndex("material_lots_material_lot_unique").on(table.materialId, table.lotNumber),
	index("material_lots_expiry_idx").on(table.expiresAt),
]);

export const purchaseOrders = mysqlTable("purchase_orders", {
	id: int().autoincrement().primaryKey().notNull(),
	supplierId: int(),
	status: mysqlEnum(['rascunho','enviado','confirmado','recebido','cancelado']).default('rascunho').notNull(),
	notes: text(),
	totalAmount: decimal({ precision: 10, scale: 2 }),
	sentAt: bigint({ mode: 'number' }),
	createdBy: int(),
	createdAt: bigint({ mode: 'number' }).default(0).notNull(),
	updatedAt: bigint({ mode: 'number' }).default(0).notNull(),
});

export const purchaseOrderItems = mysqlTable("purchase_order_items", {
	id: int().autoincrement().primaryKey().notNull(),
	orderId: int().notNull(),
	materialId: int(),
	materialName: varchar({ length: 255 }),
	materialUnit: varchar({ length: 50 }),
	quantity: decimal({ precision: 10, scale: 2 }).notNull(),
	unitPrice: decimal({ precision: 10, scale: 2 }).default('0').notNull(),
	notes: text(),
});

export const appointmentReminders = mysqlTable("appointmentReminders", {
	id: int().autoincrement().primaryKey().notNull(),
	appointmentId: int().notNull(),
	scheduledAt: datetime({ mode: 'string' }).notNull(), // data e hora exata do envio
	message: text().notNull(),                           // mensagem personalizada
	status: mysqlEnum(['pending','sent','failed']).default('pending').notNull(),
	sentAt: timestamp({ mode: 'string' }),               // quando foi enviado de fato
	createdAt: timestamp({ mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
});

// ============ PÓS-VENDA AUTOMÁTICO ============
export const postSaleFollowups = mysqlTable("post_sale_followups", {
	id: int().autoincrement().primaryKey().notNull(),
	appointmentId: int(),
	anamnesisSubmissionId: int(),
	clientId: int().notNull(),
	artistId: int(),
	studioId: int().default(1).notNull(),
	stage: mysqlEnum(['healing_7d','healed_60d','feedback_180d','anniversary_365d']).notNull(),
	scheduledAt: datetime({ mode: 'string' }).notNull(),
	status: mysqlEnum(['scheduled','due','sent','completed','postponed','cancelled','failed']).default('scheduled').notNull(),
	deliveryMode: mysqlEnum(['manual','automatic']).default('manual').notNull(),
	message: text(),
	source: mysqlEnum(['appointment','legacy_anamnesis']).default('appointment').notNull(),
	referenceDate: datetime({ mode: 'string' }),
	serviceSnapshot: text(),
	artistNameSnapshot: varchar({ length: 255 }),
	anniversaryYears: int().default(1).notNull(),
	sentAt: timestamp({ mode: 'string' }),
	completedAt: timestamp({ mode: 'string' }),
	lastError: text(),
	createdAt: timestamp({ mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
}, (table) => [
	uniqueIndex("post_sale_followups_appointment_stage_unique").on(table.appointmentId, table.stage),
	uniqueIndex("post_sale_followups_submission_stage_unique").on(table.anamnesisSubmissionId, table.stage),
	index("post_sale_followups_studio_date_idx").on(table.studioId, table.scheduledAt),
	index("post_sale_followups_status_idx").on(table.status),
]);

// ============ IMPORTAÇÃO HISTÓRICA DE ANAMNESE ============
export const legacyImportBatches = mysqlTable("legacy_import_batches", {
	id: int().autoincrement().primaryKey().notNull(),
	studioId: int().notNull(),
	targetArtistId: int().notNull(),
	createdByUserId: int().notNull(),
	fileName: varchar({ length: 255 }).notNull(),
	fileHash: varchar({ length: 64 }).notNull(),
	selectedArtistsJson: text().notNull(),
	status: mysqlEnum(['processing','completed','failed']).default('processing').notNull(),
	totalRows: int().default(0).notNull(),
	importedRows: int().default(0).notNull(),
	skippedRows: int().default(0).notNull(),
	errorRows: int().default(0).notNull(),
	createdClients: int().default(0).notNull(),
	updatedClients: int().default(0).notNull(),
	createdAt: timestamp({ mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	completedAt: timestamp({ mode: 'string' }),
}, (table) => [
	uniqueIndex("legacy_import_batch_file_unique").on(table.studioId, table.targetArtistId, table.fileHash),
	index("legacy_import_batch_studio_idx").on(table.studioId, table.createdAt),
]);

export const legacyImportRows = mysqlTable("legacy_import_rows", {
	id: int().autoincrement().primaryKey().notNull(),
	batchId: int().notNull(),
	studioId: int().notNull(),
	sourceRowNumber: int().notNull(),
	fingerprint: varchar({ length: 64 }).notNull(),
	clientId: int(),
	requestId: int(),
	submissionId: int(),
	followupId: int(),
	status: mysqlEnum(['imported','skipped','error']).notNull(),
	issuesJson: text(),
	rawPayloadJson: text(),
	createdAt: timestamp({ mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
	uniqueIndex("legacy_import_row_fingerprint_unique").on(table.studioId, table.fingerprint),
	index("legacy_import_row_batch_idx").on(table.batchId, table.sourceRowNumber),
]);

// ============ OPERAÇÃO COMERCIAL ============
export const salesLeads = mysqlTable("sales_leads", {
	id: int().autoincrement().primaryKey().notNull(),
	studioId: int().default(1).notNull(),
	clientId: int(),
	appointmentId: int(),
	artistId: int(),
	name: varchar({ length: 255 }).notNull(),
	phone: varchar({ length: 30 }),
	email: varchar({ length: 320 }),
	service: varchar({ length: 255 }),
	description: text(),
	estimatedValue: int(),
	stage: mysqlEnum(['new','awaiting_info','preparing_quote','quote_sent','awaiting_reply','awaiting_deposit','scheduled','lost','archived']).default('new').notNull(),
	nextFollowupAt: datetime({ mode: 'string' }),
	lostReason: varchar({ length: 255 }),
	notes: text(),
	createdAt: timestamp({ mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
}, (table) => [
	index("sales_leads_studio_stage_idx").on(table.studioId, table.stage),
	index("sales_leads_followup_idx").on(table.nextFollowupAt),
]);

export const waitlistEntries = mysqlTable("waitlist_entries", {
	id: int().autoincrement().primaryKey().notNull(),
	studioId: int().default(1).notNull(),
	clientId: int().notNull(),
	artistId: int(),
	service: varchar({ length: 255 }),
	preferredDays: text(),
	preferredPeriods: text(),
	minDuration: int().default(60).notNull(),
	maxDuration: int().default(480).notNull(),
	priority: int().default(0).notNull(),
	status: mysqlEnum(['active','contacted','booked','paused','cancelled']).default('active').notNull(),
	notes: text(),
	createdAt: timestamp({ mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
}, (table) => [
	index("waitlist_entries_studio_status_idx").on(table.studioId, table.status),
	index("waitlist_entries_artist_idx").on(table.artistId),
]);

// ============ PERCENTUAL DE COLABORADORES ============

export const collaboratorRates = mysqlTable("collaboratorRates", {
	id: int().autoincrement().primaryKey().notNull(),
	artistId: int().notNull(),         // FK para artists.id
	percentage: int().notNull().default(50), // 0-100 inteiro
	studioId: int().default(1).notNull(),
	notes: varchar({ length: 500 }),
	createdAt: timestamp({ mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
});

// ============ RECUPERAÇÃO DE SENHA ============

export const passwordResetTokens = mysqlTable("passwordResetTokens", {
	id: int().autoincrement().primaryKey().notNull(),
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
	id: int().autoincrement().primaryKey().notNull(),
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
	id: int().autoincrement().primaryKey().notNull(),
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
	id: int().autoincrement().primaryKey().notNull(),
	procedureId: int().notNull(),
	imageUrl: varchar({ length: 500 }).notNull(),
	imageKey: varchar({ length: 500 }).notNull(),
	imageType: mysqlEnum(['reference','stencil','progress','final','healed','other']).default('other').notNull(),
	description: text(),
	createdAt: timestamp({ mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const procedureEvents = mysqlTable("procedure_events", {
	id: int().autoincrement().primaryKey().notNull(),
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
export type InsertAnamnesisRiskHistory = typeof anamnesisRiskHistory.$inferInsert;

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
export type AnamnesisRiskHistory = typeof anamnesisRiskHistory.$inferSelect;
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
export type PostSaleFollowup = typeof postSaleFollowups.$inferSelect;
export type InsertPostSaleFollowup = typeof postSaleFollowups.$inferInsert;
export type LegacyImportBatch = typeof legacyImportBatches.$inferSelect;
export type InsertLegacyImportBatch = typeof legacyImportBatches.$inferInsert;
export type LegacyImportRow = typeof legacyImportRows.$inferSelect;
export type InsertLegacyImportRow = typeof legacyImportRows.$inferInsert;
export type SalesLead = typeof salesLeads.$inferSelect;
export type InsertSalesLead = typeof salesLeads.$inferInsert;
export type WaitlistEntry = typeof waitlistEntries.$inferSelect;
export type InsertWaitlistEntry = typeof waitlistEntries.$inferInsert;
export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;
export type CollaboratorRate = typeof collaboratorRates.$inferSelect;
export type InsertCollaboratorRate = typeof collaboratorRates.$inferInsert;
export type InsertPasswordResetToken = typeof passwordResetTokens.$inferInsert;

// ── Central de Mensagens / WhatsApp Automático ─────────────────────────────

export const whatsappIntegrations = mysqlTable("whatsapp_integrations", {
  id: int().autoincrement().primaryKey().notNull(),
  name: varchar({ length: 255 }).notNull().default('WhatsApp Principal'),
  provider: mysqlEnum(['botconversa', 'zapi', 'meta']).notNull(),
  phoneNumber: varchar({ length: 30 }).notNull(),
  apiToken: varchar({ length: 1000 }).notNull(),
  instanceId: varchar({ length: 255 }), // Z-API instance ID
  webhookUrl: varchar({ length: 500 }), // URL do webhook de retorno
  status: mysqlEnum(['ativo', 'inativo', 'erro', 'aguardando']).default('aguardando').notNull(),
  lastTestedAt: timestamp({ mode: 'string' }),
  lastErrorMessage: text(),
  createdAt: timestamp({ mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp({ mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const messageTemplates = mysqlTable("message_templates", {
  id: int().autoincrement().primaryKey().notNull(),
  name: varchar({ length: 255 }).notNull(),
  trigger: mysqlEnum(['appointment_created', 'appointment_confirmed', 'appointment_reminder_24h', 'appointment_reminder_2h', 'appointment_cancelled', 'appointment_rescheduled', 'custom']).notNull(),
  recipientType: mysqlEnum(['client', 'artist']).notNull(),
  message: text().notNull(),
  isActive: tinyint().default(1).notNull(),
  createdAt: timestamp({ mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp({ mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const messageQueue = mysqlTable("message_queue", {
  id: int().autoincrement().primaryKey().notNull(),
  integrationId: int().notNull(),
  appointmentId: int(),
  clientId: int(),
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
});

// Types
export type WhatsappIntegration = typeof whatsappIntegrations.$inferSelect;
export type InsertWhatsappIntegration = typeof whatsappIntegrations.$inferInsert;
export type MessageTemplate = typeof messageTemplates.$inferSelect;
export type InsertMessageTemplate = typeof messageTemplates.$inferInsert;
export type MessageQueueItem = typeof messageQueue.$inferSelect;
export type InsertMessageQueueItem = typeof messageQueue.$inferInsert;


// ============================================================
// Kits de Procedimento (Procedural Kits)
// ============================================================

export const procedureKits = mysqlTable("procedure_kits", {
	id: int().autoincrement().primaryKey().notNull(),
	studioId: int().default(1).notNull(),
	name: varchar({ length: 255 }).notNull(),
	description: text(),
	category: varchar({ length: 100 }).default('Geral').notNull(),
	isActive: tinyint().default(1).notNull(),
	createdAt: bigint({ mode: 'number' }).default(0).notNull(),
	updatedAt: bigint({ mode: 'number' }).default(0).notNull(),
});

export const procedureKitItems = mysqlTable("procedure_kit_items", {
	id: int().autoincrement().primaryKey().notNull(),
	kitId: int().notNull(),
	materialId: int().notNull(),
	quantity: decimal({ precision: 10, scale: 2 }).notNull(),
	unit: varchar({ length: 50 }).default('un').notNull(),
});
