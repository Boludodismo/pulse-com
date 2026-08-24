CREATE TABLE IF NOT EXISTS `anamnese_requests` (
  `id` int AUTO_INCREMENT NOT NULL PRIMARY KEY,
  `clientId` int NOT NULL,
  `appointmentId` int,
  `token` varchar(64) NOT NULL,
  `sentVia` enum('email','whatsapp') NOT NULL,
  `sentTo` varchar(320) NOT NULL,
  `expiresAt` timestamp NOT NULL,
  `completedAt` timestamp,
  `statusRequest` enum('pendente','preenchida','expirada','cancelada') NOT NULL DEFAULT 'pendente',
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY `anamnese_requests_token_unique` (`token`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `anamnese_submissions` (
  `id` int AUTO_INCREMENT NOT NULL PRIMARY KEY,
  `requestId` int NOT NULL,
  `clientId` int NOT NULL,
  `appointmentId` int,
  `payloadJson` text NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `anamnesisRecords` (
  `id` int AUTO_INCREMENT NOT NULL PRIMARY KEY,
  `clientId` int NOT NULL,
  `appointmentId` int,
  `hasAllergies` tinyint NOT NULL DEFAULT 0,
  `allergiesDetails` text,
  `hasDiseases` tinyint NOT NULL DEFAULT 0,
  `diseasesDetails` text,
  `usesMedication` tinyint NOT NULL DEFAULT 0,
  `medicationDetails` text,
  `isPregnant` tinyint NOT NULL DEFAULT 0,
  `hasKeloid` tinyint NOT NULL DEFAULT 0,
  `acceptedTerms` tinyint NOT NULL DEFAULT 0,
  `signatureUrl` varchar(500),
  `pdfUrl` varchar(500),
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `riskLevel` enum('low','medium','high','critical') NOT NULL DEFAULT 'low',
  `riskFactors` text
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `appointments` (
  `id` int AUTO_INCREMENT NOT NULL PRIMARY KEY,
  `clientId` int NOT NULL,
  `calendarId` int,
  `date` datetime NOT NULL,
  `duration` int NOT NULL,
  `service` varchar(255) NOT NULL,
  `artist` varchar(255) NOT NULL,
  `artistId` int,
  `status` enum('agendado','confirmado','concluido','cancelado','reagendado') NOT NULL DEFAULT 'agendado',
  `confirmationStatus` enum('pendente','confirmado','nao_confirmado','atraso','chegada_antecipada') DEFAULT 'pendente',
  `notes` text,
  `referenceImageUrl` varchar(500),
  `referenceImageKey` varchar(500),
  `depositPaid` tinyint NOT NULL DEFAULT 0,
  `depositAmount` int,
  `totalAmount` int,
  `signalStatus` enum('aguardando_sinal','sinal_confirmado') DEFAULT 'aguardando_sinal',
  `paymentStatus` enum('pendente','pago') DEFAULT 'pendente',
  `paymentMethod` enum('dinheiro','pix','cartao_credito','cartao_debito','transferencia','outro'),
  `procedureType` enum('tatuagem','piercing','micropigmentacao','laser','consulta','retoque','outro'),
  `procedureTypeOther` varchar(255),
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `studioId` int NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `artists` (
  `id` int AUTO_INCREMENT NOT NULL PRIMARY KEY,
  `name` varchar(255) NOT NULL,
  `email` varchar(320),
  `phone` varchar(20),
  `instagram` varchar(100),
  `specialty` varchar(255),
  `bio` text,
  `photoUrl` varchar(500),
  `photoKey` varchar(500),
  `color` varchar(7),
  `active` int NOT NULL DEFAULT 1,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `studioId` int NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `auditLogs` (
  `id` int AUTO_INCREMENT NOT NULL PRIMARY KEY,
  `userId` int NOT NULL,
  `userName` varchar(255),
  `action` enum('create','update','delete','activate','deactivate') NOT NULL,
  `entity` enum('user','client','appointment','transaction','artist','settings') NOT NULL,
  `entityId` int,
  `entityName` varchar(255),
  `details` text,
  `ipAddress` varchar(45),
  `userAgent` varchar(500),
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `studioId` int
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `calendars` (
  `id` int AUTO_INCREMENT NOT NULL PRIMARY KEY,
  `userId` int NOT NULL,
  `name` varchar(100) NOT NULL,
  `description` text,
  `color` varchar(7) NOT NULL DEFAULT '#8b5cf6',
  `isVisible` tinyint NOT NULL DEFAULT 1,
  `isDefault` tinyint NOT NULL DEFAULT 0,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `clientNotes` (
  `id` int AUTO_INCREMENT NOT NULL PRIMARY KEY,
  `clientId` int NOT NULL,
  `authorId` int NOT NULL,
  `content` text NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `clients` (
  `artistId` int,
  `id` int AUTO_INCREMENT NOT NULL PRIMARY KEY,
  `name` varchar(255) NOT NULL,
  `email` varchar(320),
  `phone` varchar(20),
  `birthDate` timestamp,
  `instagram` varchar(100),
  `cep` varchar(10),
  `street` varchar(255),
  `number` varchar(20),
  `complement` varchar(100),
  `reference` varchar(255),
  `neighborhood` varchar(100),
  `city` varchar(100),
  `state` varchar(50),
  `country` varchar(50) DEFAULT 'Brasil',
  `gender` enum('Homem','Mulher','Outros'),
  `docType` enum('cpf','passport') DEFAULT 'cpf',
  `docNumber` varchar(50),
  `totalSpent` int NOT NULL DEFAULT 0,
  `appointmentCount` int NOT NULL DEFAULT 0,
  `loyaltyLevel` enum('Bronze','Prata','Ouro') NOT NULL DEFAULT 'Bronze',
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `studioId` int NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `galleryImages` (
  `id` int AUTO_INCREMENT NOT NULL PRIMARY KEY,
  `clientId` int NOT NULL,
  `appointmentId` int,
  `imageUrl` varchar(500) NOT NULL,
  `imageKey` varchar(500) NOT NULL,
  `description` text,
  `tags` text,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `notificationLogs` (
  `id` int AUTO_INCREMENT NOT NULL PRIMARY KEY,
  `type` enum('appointment_reminder','birthday_reminder','whatsapp_primary','whatsapp_resend') NOT NULL,
  `appointmentId` int,
  `clientId` int,
  `title` varchar(255) NOT NULL,
  `message` text NOT NULL,
  `status` enum('sent','failed') NOT NULL,
  `sentAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `reportTemplates` (
  `id` int AUTO_INCREMENT NOT NULL PRIMARY KEY,
  `userId` int NOT NULL,
  `name` varchar(255) NOT NULL,
  `description` text,
  `includeSections` text NOT NULL,
  `sectionOrder` text NOT NULL,
  `logsLimit` int NOT NULL DEFAULT 20,
  `usersLimit` int NOT NULL DEFAULT 5,
  `reportTitle` varchar(255),
  `reportSubtitle` text,
  `primaryColor` varchar(7) DEFAULT '#8b5cf6',
  `logoUrl` varchar(500),
  `logoKey` varchar(500),
  `footerText` text,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `studioSettings` (
  `id` int AUTO_INCREMENT NOT NULL PRIMARY KEY,
  `studioName` varchar(255),
  `address` varchar(500),
  `city` varchar(100),
  `state` varchar(50),
  `zipCode` varchar(20),
  `phone` varchar(20),
  `email` varchar(320),
  `website` varchar(255),
  `instagram` varchar(100),
  `logoUrl` varchar(500),
  `logoKey` varchar(500),
  `primaryColor` varchar(7) DEFAULT '#8b5cf6',
  `secondaryColor` varchar(7) DEFAULT '#a78bfa',
  `businessHours` text,
  `enableBirthdayReminders` int NOT NULL DEFAULT 1,
  `enableAppointmentReminders` int NOT NULL DEFAULT 1,
  `reminderDaysBefore` int NOT NULL DEFAULT 1,
  `reminderSendTime` varchar(5) DEFAULT '09:00',
  `reminderResend` int NOT NULL DEFAULT 0,
  `reminderResendTime` varchar(5) DEFAULT '18:00',
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `studios` (
  `id` int AUTO_INCREMENT NOT NULL PRIMARY KEY,
  `name` varchar(255) NOT NULL,
  `email` varchar(320),
  `phone` varchar(20),
  `address` text,
  `city` varchar(100),
  `state` varchar(50),
  `zipCode` varchar(20),
  `masterKey` varchar(64) NOT NULL,
  `isActive` tinyint NOT NULL DEFAULT 1,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY `studios_masterKey_unique` (`masterKey`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `transactions` (
  `id` int AUTO_INCREMENT NOT NULL PRIMARY KEY,
  `clientId` int,
  `appointmentId` int,
  `type` enum('entrada','saida') NOT NULL,
  `category` varchar(100) NOT NULL,
  `description` text,
  `amount` int NOT NULL,
  `paymentMethod` enum('dinheiro','pix','credito','debito','transferencia') NOT NULL,
  `date` datetime NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `studioId` int NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `users` (
  `id` int AUTO_INCREMENT NOT NULL PRIMARY KEY,
  `openId` varchar(64) NOT NULL,
  `name` text,
  `email` varchar(320),
  `loginMethod` varchar(64),
  `role` enum('superadmin','admin','collaborator') NOT NULL DEFAULT 'collaborator',
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `lastSignedIn` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `artistId` int,
  `isActive` tinyint NOT NULL DEFAULT 1,
  `studioId` int,
  `passwordHash` varchar(255),
  UNIQUE KEY `idx_users_openId` (`openId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `suppliers` (
  `id` int AUTO_INCREMENT NOT NULL PRIMARY KEY,
  `name` varchar(255) NOT NULL,
  `cnpj` varchar(20),
  `contactName` varchar(255),
  `phone` varchar(20),
  `whatsapp` varchar(20),
  `email` varchar(255),
  `address` text,
  `notes` text,
  `isActive` tinyint NOT NULL DEFAULT 1,
  `createdAt` bigint NOT NULL DEFAULT 0,
  `updatedAt` bigint NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `catalog_brands` (
  `id` int AUTO_INCREMENT NOT NULL PRIMARY KEY,
  `name` varchar(255) NOT NULL,
  `slug` varchar(255) NOT NULL,
  `origin` varchar(100),
  `website` varchar(500),
  `isActive` tinyint NOT NULL DEFAULT 1,
  `createdAt` bigint NOT NULL DEFAULT 0,
  `updatedAt` bigint NOT NULL DEFAULT 0,
  UNIQUE KEY `catalog_brands_slug_unique` (`slug`),
  KEY `catalog_brands_name_idx` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `catalog_product_lines` (
  `id` int AUTO_INCREMENT NOT NULL PRIMARY KEY,
  `brandId` int NOT NULL,
  `name` varchar(255) NOT NULL,
  `category` varchar(100) NOT NULL,
  `description` text,
  `isActive` tinyint NOT NULL DEFAULT 1,
  `createdAt` bigint NOT NULL DEFAULT 0,
  `updatedAt` bigint NOT NULL DEFAULT 0,
  UNIQUE KEY `catalog_product_lines_brand_name_unique` (`brandId`, `name`),
  KEY `catalog_product_lines_category_idx` (`category`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `catalog_variants` (
  `id` int AUTO_INCREMENT NOT NULL PRIMARY KEY,
  `lineId` int NOT NULL,
  `name` varchar(255) NOT NULL,
  `sku` varchar(255),
  `category` varchar(100) NOT NULL,
  `format` varchar(100),
  `needleCount` int,
  `needleDiameter` decimal(5,2),
  `taper` varchar(100),
  `packageQuantity` int,
  `packageUnit` varchar(500),
  `application` text,
  `evidenceStatus` enum('fabricante','fornecedor','pendente','bloqueado') NOT NULL DEFAULT 'pendente',
  `sourceUrl` varchar(1000),
  `notes` text,
  `sortOrder` int NOT NULL DEFAULT 0,
  `isActive` tinyint NOT NULL DEFAULT 1,
  `createdAt` bigint NOT NULL DEFAULT 0,
  `updatedAt` bigint NOT NULL DEFAULT 0,
  KEY `catalog_variants_line_idx` (`lineId`),
  KEY `catalog_variants_category_idx` (`category`),
  KEY `catalog_variants_sku_idx` (`sku`),
  KEY `catalog_variants_format_idx` (`format`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `supplier_catalog_offerings` (
  `id` int AUTO_INCREMENT NOT NULL PRIMARY KEY,
  `supplierId` int NOT NULL,
  `brandId` int NOT NULL,
  `lineId` int,
  `variantId` int,
  `sourceUrl` varchar(1000),
  `evidenceStatus` enum('item','marca','pendente') NOT NULL DEFAULT 'pendente',
  `lastVerifiedAt` bigint,
  `notes` text,
  `isActive` tinyint NOT NULL DEFAULT 1,
  `createdAt` bigint NOT NULL DEFAULT 0,
  `updatedAt` bigint NOT NULL DEFAULT 0,
  KEY `supplier_catalog_offerings_supplier_idx` (`supplierId`),
  KEY `supplier_catalog_offerings_brand_idx` (`brandId`),
  KEY `supplier_catalog_offerings_line_idx` (`lineId`),
  KEY `supplier_catalog_offerings_variant_idx` (`variantId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `materials` (
  `id` int AUTO_INCREMENT NOT NULL PRIMARY KEY,
  `name` varchar(255) NOT NULL,
  `category` varchar(100),
  `unit` varchar(50),
  `currentStock` decimal(10,2) NOT NULL DEFAULT '0',
  `minStock` decimal(10,2) NOT NULL DEFAULT '0',
  `avgPrice` decimal(10,2) NOT NULL DEFAULT '0',
  `supplierId` int,
  `catalogVariantId` int,
  `notes` text,
  `isActive` tinyint NOT NULL DEFAULT 1,
  `createdAt` bigint NOT NULL DEFAULT 0,
  `updatedAt` bigint NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `stock_movements` (
  `id` int AUTO_INCREMENT NOT NULL PRIMARY KEY,
  `materialId` int NOT NULL,
  `type` enum('entrada','saida','ajuste') NOT NULL,
  `quantity` decimal(10,2) NOT NULL,
  `previousStock` decimal(10,2) NOT NULL,
  `newStock` decimal(10,2) NOT NULL,
  `reason` varchar(255),
  `notes` text,
  `createdBy` int,
  `createdAt` bigint NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `purchase_orders` (
  `id` int AUTO_INCREMENT NOT NULL PRIMARY KEY,
  `supplierId` int,
  `status` enum('rascunho','enviado','confirmado','recebido','cancelado') NOT NULL DEFAULT 'rascunho',
  `notes` text,
  `totalAmount` decimal(10,2),
  `sentAt` bigint,
  `createdBy` int,
  `createdAt` bigint NOT NULL DEFAULT 0,
  `updatedAt` bigint NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `purchase_order_items` (
  `id` int AUTO_INCREMENT NOT NULL PRIMARY KEY,
  `orderId` int NOT NULL,
  `materialId` int,
  `materialName` varchar(255),
  `materialUnit` varchar(50),
  `quantity` decimal(10,2) NOT NULL,
  `unitPrice` decimal(10,2) NOT NULL DEFAULT '0',
  `notes` text
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `appointmentReminders` (
  `id` int AUTO_INCREMENT NOT NULL PRIMARY KEY,
  `appointmentId` int NOT NULL,
  `scheduledAt` datetime NOT NULL,
  `message` text NOT NULL,
  `status` enum('pending','sent','failed') NOT NULL DEFAULT 'pending',
  `sentAt` timestamp,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `collaboratorRates` (
  `id` int AUTO_INCREMENT NOT NULL PRIMARY KEY,
  `artistId` int NOT NULL,
  `percentage` int NOT NULL DEFAULT 50,
  `studioId` int NOT NULL DEFAULT 1,
  `notes` varchar(500),
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `passwordResetTokens` (
  `id` int AUTO_INCREMENT NOT NULL PRIMARY KEY,
  `userId` int NOT NULL,
  `token` varchar(128) NOT NULL,
  `expiresAt` timestamp NOT NULL,
  `usedAt` timestamp,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY `idx_password_reset_token` (`token`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `technical_procedures` (
  `id` int AUTO_INCREMENT NOT NULL PRIMARY KEY,
  `studioId` int NOT NULL DEFAULT 1,
  `clientId` int NOT NULL,
  `appointmentId` int,
  `artistId` int,
  `artistName` varchar(255),
  `title` varchar(255) NOT NULL,
  `description` text,
  `bodyLocation` varchar(100),
  `tattooStyle` varchar(100),
  `chargedAmount` int DEFAULT 0,
  `status` enum('em_andamento','pausado','finalizado','retorno','retoque') NOT NULL DEFAULT 'em_andamento',
  `startedAt` datetime,
  `pausedAt` datetime,
  `finishedAt` datetime,
  `totalDurationMinutes` int DEFAULT 0,
  `referenceImageUrl` varchar(500),
  `referenceImageKey` varchar(500),
  `stencilImageUrl` varchar(500),
  `stencilImageKey` varchar(500),
  `finalImageUrl` varchar(500),
  `finalImageKey` varchar(500),
  `healedImageUrl` varchar(500),
  `healedImageKey` varchar(500),
  `notes` text,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `procedure_consumables` (
  `id` int AUTO_INCREMENT NOT NULL PRIMARY KEY,
  `procedureId` int NOT NULL,
  `inventoryItemId` int,
  `category` enum('ink','cartridge','disposable','liquid','protection','stencil','aftercare','other') NOT NULL,
  `name` varchar(255) NOT NULL,
  `unit` enum('drop','ml','unit','pair','gram','portion','roll_fraction') NOT NULL DEFAULT 'unit',
  `quantity` decimal(10,2) NOT NULL DEFAULT '0',
  `estimatedUnitCost` decimal(10,2) DEFAULT '0',
  `estimatedTotalCost` decimal(10,2) DEFAULT '0',
  `notes` text,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `procedure_images` (
  `id` int AUTO_INCREMENT NOT NULL PRIMARY KEY,
  `procedureId` int NOT NULL,
  `imageUrl` varchar(500) NOT NULL,
  `imageKey` varchar(500) NOT NULL,
  `imageType` enum('reference','stencil','progress','final','healed','other') NOT NULL DEFAULT 'other',
  `description` text,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `procedure_events` (
  `id` int AUTO_INCREMENT NOT NULL PRIMARY KEY,
  `procedureId` int NOT NULL,
  `eventType` varchar(50) NOT NULL,
  `payload` text,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `whatsapp_integrations` (
  `id` int AUTO_INCREMENT NOT NULL PRIMARY KEY,
  `name` varchar(255) NOT NULL DEFAULT 'WhatsApp Principal',
  `provider` enum('botconversa','zapi','meta') NOT NULL,
  `phoneNumber` varchar(30) NOT NULL,
  `apiToken` varchar(1000) NOT NULL,
  `instanceId` varchar(255),
  `webhookUrl` varchar(500),
  `status` enum('ativo','inativo','erro','aguardando') NOT NULL DEFAULT 'aguardando',
  `lastTestedAt` timestamp,
  `lastErrorMessage` text,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `message_templates` (
  `id` int AUTO_INCREMENT NOT NULL PRIMARY KEY,
  `name` varchar(255) NOT NULL,
  `trigger` enum('appointment_created','appointment_confirmed','appointment_reminder_24h','appointment_reminder_2h','appointment_cancelled','appointment_rescheduled','custom') NOT NULL,
  `recipientType` enum('client','artist') NOT NULL,
  `message` text NOT NULL,
  `isActive` tinyint NOT NULL DEFAULT 1,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `message_queue` (
  `id` int AUTO_INCREMENT NOT NULL PRIMARY KEY,
  `integrationId` int NOT NULL,
  `appointmentId` int,
  `clientId` int,
  `recipientPhone` varchar(30) NOT NULL,
  `recipientName` varchar(255),
  `recipientType` enum('client','artist') NOT NULL,
  `message` text NOT NULL,
  `trigger` varchar(100),
  `status` enum('pendente','enviada','erro','cancelada','respondida') NOT NULL DEFAULT 'pendente',
  `scheduledAt` timestamp,
  `sentAt` timestamp,
  `errorMessage` text,
  `providerMessageId` varchar(255),
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `procedure_kits` (
  `id` int AUTO_INCREMENT NOT NULL PRIMARY KEY,
  `studioId` int NOT NULL DEFAULT 1,
  `name` varchar(255) NOT NULL,
  `description` text,
  `category` varchar(100) NOT NULL DEFAULT 'Geral',
  `isActive` tinyint NOT NULL DEFAULT 1,
  `createdAt` bigint NOT NULL DEFAULT 0,
  `updatedAt` bigint NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `procedure_kit_items` (
  `id` int AUTO_INCREMENT NOT NULL PRIMARY KEY,
  `kitId` int NOT NULL,
  `materialId` int NOT NULL,
  `quantity` decimal(10,2) NOT NULL,
  `unit` varchar(50) NOT NULL DEFAULT 'un'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
