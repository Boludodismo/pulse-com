CREATE TABLE `anamnese_requests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clientId` int NOT NULL,
	`appointmentId` int,
	`token` varchar(64) NOT NULL,
	`sentVia` enum('email','whatsapp') NOT NULL,
	`sentTo` varchar(320) NOT NULL,
	`expiresAt` timestamp NOT NULL,
	`completedAt` timestamp,
	`statusRequest` enum('pendente','preenchida','expirada','cancelada') NOT NULL DEFAULT 'pendente',
	`createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP'
);
--> statement-breakpoint
CREATE TABLE `anamnese_submissions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`requestId` int NOT NULL,
	`clientId` int NOT NULL,
	`appointmentId` int,
	`payloadJson` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP'
);
--> statement-breakpoint
CREATE TABLE `anamnesisRecords` (
	`id` int AUTO_INCREMENT NOT NULL,
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
	`createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP',
	`riskLevel` enum('low','medium','high','critical') NOT NULL DEFAULT 'low',
	`riskFactors` text
);
--> statement-breakpoint
CREATE TABLE `appointment_action_alerts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`studio_id` int NOT NULL,
	`appointment_id` int NOT NULL,
	`action_link_id` int NOT NULL,
	`action` enum('confirmed','early','late','reschedule_requested') NOT NULL,
	`status` enum('new','viewed') NOT NULL DEFAULT 'new',
	`created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`viewed_at` timestamp,
	CONSTRAINT `appointment_action_alerts_link_unique` UNIQUE(`action_link_id`)
);
--> statement-breakpoint
CREATE TABLE `appointment_action_links` (
	`id` int AUTO_INCREMENT NOT NULL,
	`studio_id` int NOT NULL,
	`appointment_id` int NOT NULL,
	`action` enum('confirmed','early','late','reschedule_requested') NOT NULL,
	`token_hash` varchar(128) NOT NULL,
	`expires_at` datetime NOT NULL,
	`used_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `appointment_action_links_token_unique` UNIQUE(`token_hash`)
);
--> statement-breakpoint
CREATE TABLE `appointment_kit_operations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`studioId` int NOT NULL,
	`appointmentId` int NOT NULL,
	`operationKey` varchar(36) NOT NULL,
	`payloadHash` varchar(64) NOT NULL,
	`kind` varchar(32) NOT NULL,
	`createdByUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `appointment_kit_operations_id` PRIMARY KEY(`id`),
	CONSTRAINT `appointment_kit_operation_unique` UNIQUE(`studioId`,`operationKey`)
);
--> statement-breakpoint
CREATE TABLE `appointment_material_kits` (
	`id` int AUTO_INCREMENT NOT NULL,
	`studioId` int NOT NULL,
	`appointmentId` int NOT NULL,
	`name` varchar(160) NOT NULL,
	`createdByUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `appointment_material_kits_id` PRIMARY KEY(`id`),
	CONSTRAINT `appointment_material_kit_unique` UNIQUE(`studioId`,`appointmentId`)
);
--> statement-breakpoint
CREATE TABLE `appointment_planned_materials` (
	`id` int AUTO_INCREMENT NOT NULL,
	`studioId` int NOT NULL,
	`appointmentId` int NOT NULL,
	`tenantMaterialId` int,
	`catalogItemId` int,
	`nameSnapshot` varchar(255) NOT NULL,
	`unitSnapshot` varchar(50) NOT NULL,
	`quantityPlanned` decimal(12,3) NOT NULL,
	`status` enum('planejado','consumido','nao_utilizado') NOT NULL DEFAULT 'planejado',
	`createdByUserId` int,
	`createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE `appointmentReminders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`appointmentId` int NOT NULL,
	`scheduledAt` datetime NOT NULL,
	`message` text NOT NULL,
	`status` enum('pending','sent','failed') NOT NULL DEFAULT 'pending',
	`sentAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP',
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE `appointments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clientId` int NOT NULL,
	`quote_id` int,
	`calendarId` int,
	`date` datetime NOT NULL,
	`duration` int NOT NULL,
	`service` varchar(255) NOT NULL,
	`bodyRegion` varchar(100),
	`bodySide` enum('direito','esquerdo','ambos'),
	`artist` varchar(255) NOT NULL,
	`artistId` int,
	`includeArtistCard` tinyint NOT NULL DEFAULT 0,
	`attendanceEnabled` tinyint NOT NULL DEFAULT 1,
	`attendanceRecipient` varchar(10) NOT NULL DEFAULT 'artist',
	`continuationOfAppointmentId` int,
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
	`createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP',
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`studioId` int NOT NULL DEFAULT 1
);
--> statement-breakpoint
CREATE TABLE `artist_notification_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`studio_id` int NOT NULL,
	`artist_id` int NOT NULL,
	`whatsapp_operational_enabled` tinyint NOT NULL DEFAULT 0,
	`manual_client_reminder_enabled` tinyint NOT NULL DEFAULT 0,
	`notify_client_actions_enabled` tinyint NOT NULL DEFAULT 1,
	`created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `artist_notification_settings_studio_artist_unique` UNIQUE(`studio_id`,`artist_id`)
);
--> statement-breakpoint
CREATE TABLE `artist_quote_branding` (
	`id` int AUTO_INCREMENT NOT NULL,
	`studio_id` int NOT NULL,
	`artist_id` int NOT NULL,
	`personal_logo_url` varchar(3000),
	`personal_logo_key` varchar(500),
	`default_logo_source` varchar(16) NOT NULL DEFAULT 'studio',
	`watermark_opacity` int NOT NULL DEFAULT 70,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `artist_quote_branding_id` PRIMARY KEY(`id`),
	CONSTRAINT `artist_quote_branding_artist_unique` UNIQUE(`studio_id`,`artist_id`)
);
--> statement-breakpoint
CREATE TABLE `artists` (
	`id` int AUTO_INCREMENT NOT NULL,
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
	`createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP',
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`studioId` int NOT NULL DEFAULT 1
);
--> statement-breakpoint
CREATE TABLE `auditLogs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`userName` varchar(255),
	`action` enum('create','update','delete','activate','deactivate') NOT NULL,
	`entity` enum('user','client','appointment','transaction','artist','settings') NOT NULL,
	`entityId` int,
	`entityName` varchar(255),
	`details` text,
	`ipAddress` varchar(45),
	`userAgent` varchar(500),
	`createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP',
	`studioId` int
);
--> statement-breakpoint
CREATE TABLE `calendars` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(100) NOT NULL,
	`description` text,
	`color` varchar(7) NOT NULL DEFAULT '#8b5cf6',
	`isVisible` tinyint NOT NULL DEFAULT 1,
	`isDefault` tinyint NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP',
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE `care_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`studio_id` int NOT NULL,
	`rule_id` int NOT NULL,
	`client_id` int NOT NULL,
	`appointment_id` int,
	`artist_id` int,
	`due_date` varchar(10) NOT NULL,
	`occurrence_key` varchar(128) NOT NULL,
	`token` varchar(64) NOT NULL,
	`message` text NOT NULL,
	`queue_id` int,
	`status` varchar(20) NOT NULL DEFAULT 'pending',
	`feedback` text,
	`feedback_at` timestamp,
	`read_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `care_events_id` PRIMARY KEY(`id`),
	CONSTRAINT `care_events_occurrence_key_unique` UNIQUE(`occurrence_key`),
	CONSTRAINT `care_events_token_unique` UNIQUE(`token`)
);
--> statement-breakpoint
CREATE TABLE `care_rules` (
	`id` int AUTO_INCREMENT NOT NULL,
	`studio_id` int NOT NULL,
	`name` varchar(120) NOT NULL,
	`kind` varchar(20) NOT NULL,
	`amount` int NOT NULL DEFAULT 0,
	`unit` varchar(10) NOT NULL DEFAULT 'days',
	`send_time` varchar(5) NOT NULL DEFAULT '09:00',
	`body` text NOT NULL,
	`enabled` tinyint NOT NULL DEFAULT 0,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `care_rules_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `care_sessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`studio_id` int NOT NULL,
	`client_id` int NOT NULL,
	`artist_id` int,
	`appointment_id` int,
	`source_key` varchar(80) NOT NULL,
	`completed_at` varchar(19) NOT NULL,
	CONSTRAINT `care_sessions_id` PRIMARY KEY(`id`),
	CONSTRAINT `care_sessions_source_key_unique` UNIQUE(`source_key`)
);
--> statement-breakpoint
CREATE TABLE `care_tags` (
	`id` int AUTO_INCREMENT NOT NULL,
	`studio_id` int NOT NULL,
	`client_id` int NOT NULL,
	`label` varchar(60) NOT NULL,
	CONSTRAINT `care_tags_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `clientNotes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clientId` int NOT NULL,
	`authorId` int NOT NULL,
	`content` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP',
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE `clients` (
	`isArchived` tinyint NOT NULL DEFAULT 0,
	`artistId` int,
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`email` varchar(320),
	`phone` varchar(20),
	`birthDate` datetime,
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
	`createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP',
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`studioId` int NOT NULL DEFAULT 1
);
--> statement-breakpoint
CREATE TABLE `collaboratorRates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`artistId` int NOT NULL,
	`percentage` int NOT NULL DEFAULT 50,
	`studioId` int NOT NULL DEFAULT 1,
	`notes` varchar(500),
	`createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE `galleryImages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clientId` int NOT NULL,
	`appointmentId` int,
	`imageUrl` varchar(500) NOT NULL,
	`imageKey` varchar(500) NOT NULL,
	`description` text,
	`tags` text,
	`createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP'
);
--> statement-breakpoint
CREATE TABLE `integration_contacts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`studio_id` int NOT NULL,
	`integration_id` int NOT NULL,
	`client_id` int NOT NULL,
	`normalized_phone` varchar(32) NOT NULL,
	`provider_subscriber_id` varchar(255),
	`has_whatsapp_opt_in` tinyint NOT NULL DEFAULT 0,
	`opt_in_at` timestamp,
	`opt_in_source` varchar(100),
	`opted_out_at` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `integration_contacts_studio_client_unique` UNIQUE(`studio_id`,`client_id`)
);
--> statement-breakpoint
CREATE TABLE `integration_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`studio_id` int NOT NULL,
	`integration_id` int NOT NULL,
	`direction` enum('inbound','outbound') NOT NULL,
	`type` varchar(100) NOT NULL,
	`idempotency_key` varchar(128) NOT NULL,
	`provider_event_id` varchar(255),
	`payload_hash` varchar(64) NOT NULL,
	`status` enum('received','queued','processed','failed','ignored') NOT NULL DEFAULT 'received',
	`error_message` text,
	`received_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`processed_at` timestamp,
	CONSTRAINT `integration_events_idempotency_unique` UNIQUE(`idempotency_key`)
);
--> statement-breakpoint
CREATE TABLE `integration_jobs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`studio_id` int NOT NULL,
	`integration_id` int NOT NULL,
	`type` enum('sync_contact','send_template','dispatch_flow','process_inbound') NOT NULL,
	`payload` text NOT NULL,
	`idempotency_key` varchar(128) NOT NULL,
	`status` enum('pending','processing','completed','retry','failed','cancelled') NOT NULL DEFAULT 'pending',
	`attempt_count` int NOT NULL DEFAULT 0,
	`max_attempts` int NOT NULL DEFAULT 5,
	`next_attempt_at` timestamp,
	`locked_at` timestamp,
	`completed_at` timestamp,
	`last_error` text,
	`createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `integration_jobs_idempotency_unique` UNIQUE(`idempotency_key`)
);
--> statement-breakpoint
CREATE TABLE `integration_schedules` (
	`id` int AUTO_INCREMENT NOT NULL,
	`code` varchar(100) NOT NULL,
	`schedule_cron_task_uid` varchar(65),
	`is_enabled` tinyint NOT NULL DEFAULT 0,
	`last_run_at` timestamp,
	`last_error` text,
	`createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `integration_schedules_code_unique` UNIQUE(`code`),
	CONSTRAINT `integration_schedules_task_uid_unique` UNIQUE(`schedule_cron_task_uid`)
);
--> statement-breakpoint
CREATE TABLE `inventory_alert_preferences` (
	`id` int AUTO_INCREMENT NOT NULL,
	`studioId` int NOT NULL,
	`recipientKey` varchar(40) NOT NULL,
	`leadHours` int NOT NULL DEFAULT 48,
	`whatsappEnabled` int NOT NULL DEFAULT 0,
	`whatsappOptedInAt` datetime,
	`updatedByUserId` int NOT NULL,
	CONSTRAINT `inventory_alert_preferences_id` PRIMARY KEY(`id`),
	CONSTRAINT `inventory_alert_preference_unique` UNIQUE(`studioId`,`recipientKey`)
);
--> statement-breakpoint
CREATE TABLE `inventory_batches` (
	`id` int AUTO_INCREMENT NOT NULL,
	`studioId` int NOT NULL,
	`tenantMaterialId` int NOT NULL,
	`nameSnapshot` varchar(255) NOT NULL,
	`unitSnapshot` varchar(50) NOT NULL,
	`technicalSnapshot` text NOT NULL,
	`receiptKey` varchar(36) NOT NULL,
	`lot` varchar(120) NOT NULL,
	`supplierId` int NOT NULL,
	`supplierName` varchar(255) NOT NULL,
	`expiresAt` datetime,
	`receivedQuantity` decimal(12,3) NOT NULL,
	`remainingQuantity` decimal(12,3) NOT NULL,
	`unitCost` decimal(12,4) NOT NULL,
	`receivedAt` datetime NOT NULL,
	`createdByUserId` int NOT NULL,
	CONSTRAINT `inventory_batches_id` PRIMARY KEY(`id`),
	CONSTRAINT `inventory_batch_receipt_unique` UNIQUE(`studioId`,`receiptKey`)
);
--> statement-breakpoint
CREATE TABLE `inventory_kit_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`studioId` int NOT NULL,
	`kitId` int NOT NULL,
	`tenantMaterialId` int NOT NULL,
	`quantity` decimal(12,3) NOT NULL,
	CONSTRAINT `inventory_kit_items_material_unique` UNIQUE(`studioId`,`kitId`,`tenantMaterialId`)
);
--> statement-breakpoint
CREATE TABLE `inventory_kits` (
	`id` int AUTO_INCREMENT NOT NULL,
	`studioId` int NOT NULL,
	`name` varchar(160) NOT NULL,
	`description` varchar(500),
	`isActive` tinyint NOT NULL DEFAULT 1,
	`createdByUserId` int,
	`createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE `inventory_loan_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`studioId` int NOT NULL,
	`loanId` int NOT NULL,
	`operationKey` varchar(36) NOT NULL,
	`kind` varchar(32) NOT NULL,
	`quantity` decimal(12,3),
	`sourceMaterialId` int,
	`sourceBatchId` int,
	`targetBatchId` int,
	`notes` text,
	`createdByUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `inventory_loan_events_id` PRIMARY KEY(`id`),
	CONSTRAINT `inventory_loan_event_unique` UNIQUE(`studioId`,`operationKey`)
);
--> statement-breakpoint
CREATE TABLE `inventory_loans` (
	`id` int AUTO_INCREMENT NOT NULL,
	`studioId` int NOT NULL,
	`requestKey` varchar(36) NOT NULL,
	`lenderArtistId` int,
	`borrowerArtistId` int NOT NULL,
	`appointmentId` int,
	`sourceMaterialId` int NOT NULL,
	`sourceBatchId` int,
	`receivedMaterialId` int,
	`receivedBatchId` int,
	`materialName` varchar(255) NOT NULL,
	`unit` varchar(50) NOT NULL,
	`specification` text NOT NULL,
	`quantityRequested` decimal(12,3) NOT NULL,
	`quantityApproved` decimal(12,3),
	`quantitySettled` decimal(12,3) NOT NULL DEFAULT '0',
	`status` varchar(24) NOT NULL DEFAULT 'requested',
	`dueAt` datetime,
	`reminderHours` int NOT NULL DEFAULT 24,
	`notes` text,
	`decisionNotes` text,
	`createdByUserId` int NOT NULL,
	`approvedByUserId` int,
	`deliveredByUserId` int,
	`approvedAt` datetime,
	`deliveredAt` datetime,
	`settledAt` datetime,
	`createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `inventory_loans_id` PRIMARY KEY(`id`),
	CONSTRAINT `inventory_loan_request_unique` UNIQUE(`studioId`,`requestKey`),
	CONSTRAINT `inventory_loan_received_unique` UNIQUE(`studioId`,`receivedMaterialId`)
);
--> statement-breakpoint
CREATE TABLE `inventory_material_registrations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`studioId` int NOT NULL,
	`registrationKey` varchar(36) NOT NULL,
	`payloadHash` varchar(64) NOT NULL,
	`tenantMaterialId` int NOT NULL,
	`createdByUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `inventory_material_registrations_id` PRIMARY KEY(`id`),
	CONSTRAINT `inventory_material_registration_unique` UNIQUE(`studioId`,`registrationKey`)
);
--> statement-breakpoint
CREATE TABLE `inventory_notices` (
	`id` int AUTO_INCREMENT NOT NULL,
	`studioId` int NOT NULL,
	`recipientArtistId` int,
	`recipientKey` varchar(40) NOT NULL,
	`eventKey` varchar(180) NOT NULL,
	`kind` varchar(32) NOT NULL,
	`severity` varchar(12) NOT NULL,
	`appointmentId` int,
	`materialId` int,
	`loanId` int,
	`title` varchar(255) NOT NULL,
	`message` text NOT NULL,
	`readAt` datetime,
	`resolvedAt` datetime,
	`deliveryStatus` varchar(24) NOT NULL DEFAULT 'pending',
	`attempts` int NOT NULL DEFAULT 0,
	`lastError` varchar(500),
	`nextAttemptAt` datetime,
	`createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `inventory_notices_id` PRIMARY KEY(`id`),
	CONSTRAINT `inventory_notice_event_unique` UNIQUE(`studioId`,`recipientKey`,`eventKey`)
);
--> statement-breakpoint
CREATE TABLE `material_catalog_categories` (
	`id` int AUTO_INCREMENT NOT NULL,
	`code` varchar(80) NOT NULL,
	`name` varchar(120) NOT NULL,
	`icon` varchar(80),
	`description` text,
	`isActive` tinyint NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `material_catalog_categories_code_unique` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `material_catalog_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`categoryId` int NOT NULL,
	`code` varchar(120) NOT NULL,
	`name` varchar(255) NOT NULL,
	`subcategory` varchar(120),
	`configuration` varchar(120),
	`diameter` varchar(40),
	`defaultUnit` varchar(50) NOT NULL DEFAULT 'unidade',
	`technicalSpecification` text,
	`icon` varchar(80),
	`isActive` tinyint NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `material_catalog_items_code_unique` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `materials` (
	`studioId` int,
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`category` varchar(100),
	`unit` varchar(50),
	`currentStock` decimal(10,2) NOT NULL DEFAULT '0',
	`minStock` decimal(10,2) NOT NULL DEFAULT '0',
	`avgPrice` decimal(10,2) NOT NULL DEFAULT '0',
	`supplierId` int,
	`notes` text,
	`isActive` tinyint NOT NULL DEFAULT 1,
	`createdAt` bigint NOT NULL DEFAULT 0,
	`updatedAt` bigint NOT NULL DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE `message_automation_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`studio_id` int NOT NULL,
	`appointment_reminders_enabled` tinyint NOT NULL DEFAULT 0,
	`appointment_days_before` int NOT NULL DEFAULT 1,
	`appointment_send_time` varchar(5) NOT NULL DEFAULT '10:00',
	`one_hour_reminders_enabled` tinyint NOT NULL DEFAULT 0,
	`birthday_messages_enabled` tinyint NOT NULL DEFAULT 0,
	`birthday_send_time` varchar(5) NOT NULL DEFAULT '10:00',
	`birthday_message_template` text,
	`timezone` varchar(64) NOT NULL DEFAULT 'America/Sao_Paulo',
	`last_appointment_cycle_at` timestamp,
	`last_birthday_cycle_at` timestamp,
	`last_error` text,
	`created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `message_automation_settings_studio_unique` UNIQUE(`studio_id`)
);
--> statement-breakpoint
CREATE TABLE `message_queue` (
	`id` int AUTO_INCREMENT NOT NULL,
	`studio_id` int,
	`integrationId` int NOT NULL,
	`appointmentId` int,
	`clientId` int,
	`retry_of_queue_id` int,
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
);
--> statement-breakpoint
CREATE TABLE `message_templates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`studio_id` int,
	`name` varchar(255) NOT NULL,
	`trigger` enum('appointment_created','appointment_confirmed','appointment_reminder_24h','appointment_reminder_2h','appointment_reminder_1h','appointment_cancelled','appointment_rescheduled','care_guide','custom') NOT NULL,
	`recipientType` enum('client','artist') NOT NULL,
	`message` text NOT NULL,
	`isActive` tinyint NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE `notificationLogs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`type` enum('appointment_reminder','birthday_reminder','whatsapp_primary','whatsapp_resend') NOT NULL,
	`appointmentId` int,
	`clientId` int,
	`title` varchar(255) NOT NULL,
	`message` text NOT NULL,
	`status` enum('sent','failed') NOT NULL,
	`sentAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP'
);
--> statement-breakpoint
CREATE TABLE `passwordResetTokens` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`token` varchar(128) NOT NULL,
	`expiresAt` timestamp NOT NULL,
	`usedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `idx_password_reset_token` UNIQUE(`token`)
);
--> statement-breakpoint
CREATE TABLE `procedure_consumables` (
	`id` int AUTO_INCREMENT NOT NULL,
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
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE `procedure_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`procedureId` int NOT NULL,
	`eventType` varchar(50) NOT NULL,
	`payload` text,
	`createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE `procedure_images` (
	`id` int AUTO_INCREMENT NOT NULL,
	`procedureId` int NOT NULL,
	`imageUrl` varchar(500) NOT NULL,
	`imageKey` varchar(500) NOT NULL,
	`imageType` enum('reference','stencil','progress','final','healed','other') NOT NULL DEFAULT 'other',
	`description` text,
	`createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE `procedure_inventory_consumptions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`procedureId` int NOT NULL,
	`studioId` int NOT NULL,
	`appointmentId` int,
	`clientId` int NOT NULL,
	`artistId` int,
	`tenantMaterialId` int NOT NULL,
	`plannedMaterialId` int,
	`batchId` int,
	`supplierNameSnapshot` varchar(255),
	`technicalSnapshot` text,
	`nameSnapshot` varchar(255) NOT NULL,
	`unitSnapshot` varchar(50) NOT NULL,
	`quantity` decimal(12,3) NOT NULL,
	`unitCostSnapshot` decimal(12,4) NOT NULL,
	`totalCostSnapshot` decimal(12,4) NOT NULL,
	`lotSnapshot` varchar(120),
	`expiresAtSnapshot` datetime,
	`status` enum('consumido','revertido') NOT NULL DEFAULT 'consumido',
	`consumedAt` datetime NOT NULL,
	`reversedAt` datetime,
	`reversalReason` varchar(255),
	`createdByUserId` int,
	`reversedByUserId` int,
	`createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE `procedure_pauses` (
	`id` int AUTO_INCREMENT NOT NULL,
	`procedureId` int NOT NULL,
	`studioId` int NOT NULL,
	`artistId` int,
	`startedAt` datetime NOT NULL,
	`endedAt` datetime,
	`reason` varchar(120),
	`createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE `purchase_order_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orderId` int NOT NULL,
	`materialId` int,
	`materialName` varchar(255),
	`materialUnit` varchar(50),
	`quantity` decimal(10,2) NOT NULL,
	`unitPrice` decimal(10,2) NOT NULL DEFAULT '0',
	`notes` text
);
--> statement-breakpoint
CREATE TABLE `purchase_orders` (
	`studioId` int,
	`id` int AUTO_INCREMENT NOT NULL,
	`supplierId` int,
	`status` enum('rascunho','enviado','confirmado','recebido','cancelado') NOT NULL DEFAULT 'rascunho',
	`notes` text,
	`totalAmount` decimal(10,2),
	`sentAt` bigint,
	`createdBy` int,
	`createdAt` bigint NOT NULL DEFAULT 0,
	`updatedAt` bigint NOT NULL DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE `quote_presets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`studio_id` int NOT NULL,
	`artist_id` int,
	`category` varchar(32) NOT NULL,
	`name` varchar(120) NOT NULL,
	`content` text NOT NULL,
	`is_active` tinyint NOT NULL DEFAULT 1,
	`created_by_user_id` int NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `quote_presets_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `quote_proposals` (
	`id` int AUTO_INCREMENT NOT NULL,
	`studio_id` int NOT NULL,
	`client_id` int NOT NULL,
	`artist_id` int NOT NULL,
	`quote_number` varchar(48) NOT NULL,
	`version` int NOT NULL DEFAULT 1,
	`status` varchar(24) NOT NULL DEFAULT 'draft',
	`created_date` datetime NOT NULL,
	`valid_until` datetime NOT NULL,
	`total_amount` int NOT NULL DEFAULT 0,
	`payload` mediumtext NOT NULL,
	`public_token` varchar(64),
	`viewed_at` datetime,
	`accepted_at` datetime,
	`sent_at` datetime,
	`sent_by_user_id` int,
	`sent_source` varchar(24),
	`responded_at` datetime,
	`response_source` varchar(24),
	`response_text` text,
	`response_by_user_id` int,
	`question_at` datetime,
	`question_text` text,
	`created_by_user_id` int NOT NULL,
	`finalized_at` datetime,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `quote_proposals_id` PRIMARY KEY(`id`),
	CONSTRAINT `quote_proposals_number_version_unique` UNIQUE(`studio_id`,`quote_number`,`version`),
	CONSTRAINT `quote_proposals_public_token_unique` UNIQUE(`public_token`)
);
--> statement-breakpoint
CREATE TABLE `reportTemplates` (
	`id` int AUTO_INCREMENT NOT NULL,
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
	`createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP',
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE `stock_movements` (
	`id` int AUTO_INCREMENT NOT NULL,
	`materialId` int NOT NULL,
	`type` enum('entrada','saida','ajuste') NOT NULL,
	`quantity` decimal(10,2) NOT NULL,
	`previousStock` decimal(10,2) NOT NULL,
	`newStock` decimal(10,2) NOT NULL,
	`reason` varchar(255),
	`notes` text,
	`createdBy` int,
	`createdAt` bigint NOT NULL DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE `studio_invitations` (
	`artistId` int,
	`permissionSnapshot` json,
	`id` int AUTO_INCREMENT NOT NULL,
	`studioId` int NOT NULL,
	`email` varchar(320) NOT NULL,
	`role` enum('admin','collaborator') NOT NULL,
	`tokenHash` varchar(128) NOT NULL,
	`status` enum('pending','accepted','revoked','expired') NOT NULL DEFAULT 'pending',
	`expiresAt` timestamp NOT NULL,
	`invitedByUserId` int NOT NULL,
	`acceptedUserId` int,
	`acceptedAt` timestamp,
	`revokedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP',
	CONSTRAINT `studio_invitations_tokenHash_unique` UNIQUE(`tokenHash`)
);
--> statement-breakpoint
CREATE TABLE `studio_material_artists` (
	`id` int AUTO_INCREMENT NOT NULL,
	`studioId` int NOT NULL,
	`tenantMaterialId` int NOT NULL,
	`artistId` int NOT NULL,
	CONSTRAINT `studio_material_artists_id` PRIMARY KEY(`id`),
	CONSTRAINT `studio_material_artist_unique` UNIQUE(`studioId`,`tenantMaterialId`,`artistId`)
);
--> statement-breakpoint
CREATE TABLE `studioSettings` (
	`studioId` int,
	`id` int AUTO_INCREMENT NOT NULL,
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
	`createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP',
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `studioSettings_studioId_unique` UNIQUE(`studioId`)
);
--> statement-breakpoint
CREATE TABLE `studios` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`email` varchar(320),
	`phone` varchar(20),
	`address` text,
	`city` varchar(100),
	`state` varchar(50),
	`zipCode` varchar(20),
	`masterKey` varchar(64) NOT NULL,
	`isActive` tinyint NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP',
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE `suppliers` (
	`studioId` int,
	`id` int AUTO_INCREMENT NOT NULL,
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
);
--> statement-breakpoint
CREATE TABLE `technical_procedures` (
	`id` int AUTO_INCREMENT NOT NULL,
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
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE `tenant_inventory_movements` (
	`id` int AUTO_INCREMENT NOT NULL,
	`studioId` int NOT NULL,
	`tenantMaterialId` int NOT NULL,
	`type` enum('entrada','consumo','reversao','ajuste') NOT NULL,
	`quantity` decimal(12,3) NOT NULL,
	`previousQuantity` decimal(12,3) NOT NULL,
	`newQuantity` decimal(12,3) NOT NULL,
	`sourceType` varchar(80),
	`sourceId` int,
	`reason` varchar(255),
	`notes` text,
	`createdByUserId` int,
	`createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE `tenant_materials` (
	`id` int AUTO_INCREMENT NOT NULL,
	`studioId` int NOT NULL,
	`ownerArtistId` int,
	`catalogItemId` int,
	`legacyMaterialId` int,
	`name` varchar(255) NOT NULL,
	`category` varchar(120),
	`unit` varchar(50) NOT NULL DEFAULT 'unidade',
	`brand` varchar(120),
	`line` varchar(120),
	`model` varchar(120),
	`configuration` varchar(120),
	`diameter` varchar(40),
	`needleCount` int,
	`gauge` varchar(20),
	`taper` varchar(80),
	`packageQuantity` int,
	`purchaseUnit` varchar(50),
	`currentQuantity` decimal(12,3) NOT NULL DEFAULT '0',
	`minimumQuantity` decimal(12,3) NOT NULL DEFAULT '0',
	`unitCost` decimal(12,4) NOT NULL DEFAULT '0',
	`supplierId` int,
	`lot` varchar(120),
	`expiresAt` datetime,
	`notes` text,
	`isActive` tinyint NOT NULL DEFAULT 1,
	`createdByUserId` int,
	`createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `tenant_materials_legacy_source_unique` UNIQUE(`studioId`,`legacyMaterialId`)
);
--> statement-breakpoint
CREATE TABLE `transactions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clientId` int,
	`appointmentId` int,
	`type` enum('entrada','saida') NOT NULL,
	`category` varchar(100) NOT NULL,
	`description` text,
	`amount` int NOT NULL,
	`paymentMethod` enum('dinheiro','pix','credito','debito','transferencia') NOT NULL,
	`date` datetime NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP',
	`studioId` int NOT NULL DEFAULT 1
);
--> statement-breakpoint
CREATE TABLE `user_module_permissions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`studioId` int NOT NULL,
	`module` enum('clients','appointments','stock','finance','anamnesis','pod','reports','quotes','intelligent_inbox','inbox_conversations','inbox_summaries','inbox_priorities','inbox_opportunities','inbox_settings','inbox_suggestions') NOT NULL,
	`canRead` tinyint NOT NULL DEFAULT 0,
	`canWrite` tinyint NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP',
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `user_module_permissions_user_studio_module_unique` UNIQUE(`userId`,`studioId`,`module`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`openId` varchar(64) NOT NULL,
	`name` text,
	`email` varchar(320),
	`loginMethod` varchar(64),
	`role` enum('superadmin','admin','collaborator') NOT NULL DEFAULT 'collaborator',
	`createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP',
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`lastSignedIn` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP',
	`artistId` int,
	`isActive` tinyint NOT NULL DEFAULT 1,
	`studioId` int,
	`passwordHash` varchar(255),
	`accessStatus` enum('active','suspended','expired') NOT NULL DEFAULT 'active',
	`accessExpiresAt` timestamp,
	CONSTRAINT `idx_users_openId` UNIQUE(`openId`)
);
--> statement-breakpoint
CREATE TABLE `whatsapp_integrations` (
	`encrypted_provider_config` text,
	`connection_state` varchar(24) NOT NULL DEFAULT 'unconfigured',
	`webhook_ready` tinyint NOT NULL DEFAULT 0,
	`id` int AUTO_INCREMENT NOT NULL,
	`studio_id` int,
	`name` varchar(255) NOT NULL DEFAULT 'WhatsApp Principal',
	`provider` enum('botconversa','zapi','meta') NOT NULL,
	`phoneNumber` varchar(30) NOT NULL,
	`apiToken` varchar(1000) NOT NULL,
	`encrypted_api_token` text,
	`encrypted_webhook_secret` text,
	`connection_key` varchar(96),
	`sandbox_mode` tinyint NOT NULL DEFAULT 1,
	`sandbox_test_phone` varchar(32),
	`production_activated_at` timestamp,
	`production_activated_by_user_id` int,
	`is_enabled` tinyint NOT NULL DEFAULT 0,
	`last_success_at` timestamp,
	`failure_count` int NOT NULL DEFAULT 0,
	`instanceId` varchar(255),
	`webhookUrl` varchar(500),
	`status` enum('ativo','inativo','erro','aguardando') NOT NULL DEFAULT 'aguardando',
	`lastTestedAt` timestamp,
	`lastErrorMessage` text,
	`createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `whatsapp_integrations_connection_key_unique` UNIQUE(`connection_key`)
);
--> statement-breakpoint
CREATE TABLE `artist_cards` (
	`id` int AUTO_INCREMENT NOT NULL,
	`studio_id` int NOT NULL,
	`artist_id` int NOT NULL,
	`token` varchar(64) NOT NULL,
	`published` tinyint NOT NULL DEFAULT 0,
	`headline` varchar(160) NOT NULL,
	`description` text NOT NULL,
	`links` text NOT NULL,
	`images` text NOT NULL,
	`presentation` text,
	CONSTRAINT `artist_cards_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `procurement_alerts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`studio_id` int NOT NULL,
	`material_id` int NOT NULL,
	`episode` varchar(64) NOT NULL,
	`status` varchar(24) NOT NULL DEFAULT 'open',
	`recipient_artist_id` int,
	`notify_enabled` tinyint NOT NULL DEFAULT 0,
	`notified_at` datetime,
	`last_error` text,
	CONSTRAINT `procurement_alerts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `procurement_contacts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`studio_id` int NOT NULL,
	`supplier_id` int NOT NULL,
	`confirmed_by` int NOT NULL,
	CONSTRAINT `procurement_contacts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `procurement_quotes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`studio_id` int NOT NULL,
	`material_id` int NOT NULL,
	`supplier_id` int NOT NULL,
	`quantity` decimal(12,3) NOT NULL,
	`recipient_phone` varchar(32) NOT NULL,
	`message` text NOT NULL,
	`status` varchar(24) NOT NULL DEFAULT 'draft',
	`approved_by` int,
	`approved_at` datetime,
	`sent_at` datetime,
	`provider_message_id` varchar(255),
	`last_error` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `procurement_quotes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `procurement_templates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`studio_id` int NOT NULL,
	`name` varchar(120) NOT NULL,
	`body` text NOT NULL,
	CONSTRAINT `procurement_templates_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `inbox_conversations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`studio_id` int NOT NULL,
	`sync_state_id` int NOT NULL,
	`client_id` int,
	`integration_contact_id` int,
	`external_contact_id` varchar(255),
	`external_conversation_id` varchar(191) NOT NULL,
	`client_name` varchar(255),
	`phone` varchar(32),
	`source` varchar(80),
	`channel` varchar(80),
	`artist_id` int,
	`attendant_user_id` int,
	`last_interaction_at` datetime,
	`status` varchar(40) NOT NULL DEFAULT 'open',
	`priority` varchar(20) NOT NULL DEFAULT 'NORMAL',
	`classification` varchar(80) NOT NULL DEFAULT 'other',
	`waiting_since` datetime,
	`waiting_seconds` int NOT NULL DEFAULT 0,
	`summary` text,
	`purchase_intent` varchar(40) NOT NULL DEFAULT 'UNKNOWN',
	`pending_actions` text,
	`next_recommended_action` text,
	`suggested_reply` text,
	`analyzed_message_count` int NOT NULL DEFAULT 0,
	`last_summary_at` datetime,
	`last_processed_at` datetime,
	`processing_status` varchar(40) NOT NULL DEFAULT 'disabled',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `inbox_conversations_id` PRIMARY KEY(`id`),
	CONSTRAINT `inbox_conversation_studio_id` UNIQUE(`studio_id`,`id`),
	CONSTRAINT `inbox_conversation_external` UNIQUE(`studio_id`,`sync_state_id`,`external_conversation_id`)
);
--> statement-breakpoint
CREATE TABLE `inbox_messages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`studio_id` int NOT NULL,
	`conversation_id` int NOT NULL,
	`external_message_id` varchar(191) NOT NULL,
	`message_type` varchar(40) NOT NULL DEFAULT 'text',
	`direction` varchar(20) NOT NULL DEFAULT 'inbound',
	`actor` varchar(40) NOT NULL DEFAULT 'customer',
	`text_content` text,
	`media_reference` text,
	`metadata` text,
	`message_at` datetime,
	`processed_at` datetime,
	`processing_status` varchar(40) NOT NULL DEFAULT 'disabled',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `inbox_messages_id` PRIMARY KEY(`id`),
	CONSTRAINT `inbox_message_external` UNIQUE(`studio_id`,`conversation_id`,`external_message_id`)
);
--> statement-breakpoint
CREATE TABLE `inbox_summaries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`studio_id` int NOT NULL,
	`conversation_id` int,
	`scope_key` varchar(100) NOT NULL,
	`window_start` datetime NOT NULL,
	`window_end` datetime NOT NULL,
	`summary` text,
	`metrics` text,
	`analysis` text,
	`analyzed_message_count` int NOT NULL DEFAULT 0,
	`last_message_id` int,
	`processing_status` varchar(40) NOT NULL DEFAULT 'disabled',
	`analysis_version` varchar(80),
	`last_error` text,
	`processed_at` datetime,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `inbox_summaries_id` PRIMARY KEY(`id`),
	CONSTRAINT `inbox_summary_window` UNIQUE(`studio_id`,`scope_key`,`window_start`,`window_end`)
);
--> statement-breakpoint
CREATE TABLE `inbox_sync_state` (
	`id` int AUTO_INCREMENT NOT NULL,
	`studio_id` int NOT NULL,
	`integration_id` int,
	`name` varchar(255),
	`provider` varchar(40) NOT NULL DEFAULT 'botconversa',
	`external_id` varchar(255),
	`status` varchar(40) NOT NULL DEFAULT 'not_configured',
	`connected_at` datetime,
	`webhook_configured` int NOT NULL DEFAULT 0,
	`sync_enabled` int NOT NULL DEFAULT 0,
	`summary_enabled` int NOT NULL DEFAULT 0,
	`summary_interval_minutes` int NOT NULL DEFAULT 60,
	`last_sync_at` datetime,
	`last_processed_at` datetime,
	`last_message_at` datetime,
	`last_summary_at` datetime,
	`sync_status` varchar(40) NOT NULL DEFAULT 'disabled',
	`sync_cursor` text,
	`external_cursor` text,
	`error_count` int NOT NULL DEFAULT 0,
	`last_error` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `inbox_sync_state_id` PRIMARY KEY(`id`),
	CONSTRAINT `inbox_sync_studio_id` UNIQUE(`studio_id`,`id`)
);
--> statement-breakpoint
CREATE TABLE `artist_session_appearance` (
	`id` int AUTO_INCREMENT NOT NULL,
	`studioId` int NOT NULL,
	`artistId` int NOT NULL,
	`preferences` text NOT NULL,
	`revision` int NOT NULL DEFAULT 1,
	`updatedByUserId` int NOT NULL,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `artist_session_appearance_id` PRIMARY KEY(`id`),
	CONSTRAINT `artist_session_appearance_scope_unique` UNIQUE(`studioId`,`artistId`)
);
--> statement-breakpoint
CREATE TABLE `procedure_color_samples` (
	`id` int AUTO_INCREMENT NOT NULL,
	`studioId` int NOT NULL,
	`procedureId` int NOT NULL,
	`clientId` int NOT NULL,
	`artistId` int,
	`code` varchar(16) NOT NULL,
	`hex` varchar(9) NOT NULL,
	`red` int NOT NULL,
	`green` int NOT NULL,
	`blue` int NOT NULL,
	`cyan` int NOT NULL,
	`magenta` int NOT NULL,
	`yellow` int NOT NULL,
	`black` int NOT NULL,
	`labL` decimal(7,3),
	`labA` decimal(7,3),
	`labB` decimal(7,3),
	`xPct` decimal(7,4) NOT NULL,
	`yPct` decimal(7,4) NOT NULL,
	`sampleSize` int NOT NULL DEFAULT 5,
	`createdByUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `procedure_color_samples_id` PRIMARY KEY(`id`),
	CONSTRAINT `procedure_color_sample_code_unique` UNIQUE(`studioId`,`procedureId`,`code`)
);
--> statement-breakpoint
CREATE TABLE `procedure_ink_recipe_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`studioId` int NOT NULL,
	`recipeId` int NOT NULL,
	`tenantMaterialId` int NOT NULL,
	`consumptionId` int NOT NULL,
	`batchId` int,
	`nameSnapshot` varchar(255) NOT NULL,
	`brandSnapshot` varchar(120),
	`lotSnapshot` varchar(120),
	`expiresAtSnapshot` datetime,
	`drops` int NOT NULL,
	`estimatedMl` decimal(8,3) NOT NULL,
	`percentage` decimal(7,3) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `procedure_ink_recipe_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `procedure_ink_recipe_results` (
	`id` int AUTO_INCREMENT NOT NULL,
	`studioId` int NOT NULL,
	`recipeId` int NOT NULL,
	`procedureId` int NOT NULL,
	`clientId` int NOT NULL,
	`artistId` int,
	`hex` varchar(9) NOT NULL,
	`red` int NOT NULL,
	`green` int NOT NULL,
	`blue` int NOT NULL,
	`cyan` int NOT NULL,
	`magenta` int NOT NULL,
	`yellow` int NOT NULL,
	`black` int NOT NULL,
	`labL` decimal(7,3) NOT NULL,
	`labA` decimal(7,3) NOT NULL,
	`labB` decimal(7,3) NOT NULL,
	`note` varchar(500),
	`createdByUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `procedure_ink_recipe_results_id` PRIMARY KEY(`id`),
	CONSTRAINT `procedure_ink_recipe_result_unique` UNIQUE(`studioId`,`recipeId`)
);
--> statement-breakpoint
CREATE TABLE `procedure_ink_recipes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`studioId` int NOT NULL,
	`procedureId` int NOT NULL,
	`clientId` int NOT NULL,
	`artistId` int,
	`sampleId` int,
	`code` varchar(16) NOT NULL,
	`cupSize` varchar(8),
	`cupCapacityMl` decimal(8,3),
	`dropsPerMl` decimal(8,3) NOT NULL,
	`totalDrops` int NOT NULL,
	`estimatedMl` decimal(8,3) NOT NULL,
	`cupTenantMaterialId` int,
	`cupConsumptionId` int,
	`status` varchar(16) NOT NULL DEFAULT 'active',
	`createdByUserId` int NOT NULL,
	`revertedAt` datetime,
	`createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `procedure_ink_recipes_id` PRIMARY KEY(`id`),
	CONSTRAINT `procedure_ink_recipe_code_unique` UNIQUE(`studioId`,`procedureId`,`code`)
);
--> statement-breakpoint
CREATE TABLE `procedure_visual_layers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`studioId` int NOT NULL,
	`procedureId` int NOT NULL,
	`clientId` int NOT NULL,
	`artistId` int,
	`layerKey` varchar(80) NOT NULL,
	`name` varchar(160) NOT NULL,
	`layerType` varchar(32) NOT NULL,
	`imageUrl` varchar(3000),
	`imageKey` varchar(500),
	`opacity` int NOT NULL DEFAULT 100,
	`isVisible` int NOT NULL DEFAULT 1,
	`sortOrder` int NOT NULL DEFAULT 0,
	`createdByUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `procedure_visual_layers_id` PRIMARY KEY(`id`),
	CONSTRAINT `procedure_visual_layer_key_unique` UNIQUE(`studioId`,`procedureId`,`layerKey`)
);
--> statement-breakpoint
CREATE TABLE `tenant_material_color_samples` (
	`id` int AUTO_INCREMENT NOT NULL,
	`studioId` int NOT NULL,
	`tenantMaterialId` int NOT NULL,
	`artistId` int,
	`source` varchar(24) NOT NULL DEFAULT 'photo',
	`hex` varchar(9) NOT NULL,
	`red` int NOT NULL,
	`green` int NOT NULL,
	`blue` int NOT NULL,
	`cyan` int NOT NULL,
	`magenta` int NOT NULL,
	`yellow` int NOT NULL,
	`black` int NOT NULL,
	`labL` decimal(7,3) NOT NULL,
	`labA` decimal(7,3) NOT NULL,
	`labB` decimal(7,3) NOT NULL,
	`createdByUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `tenant_material_color_samples_id` PRIMARY KEY(`id`),
	CONSTRAINT `tenant_material_color_sample_unique` UNIQUE(`studioId`,`tenantMaterialId`)
);
--> statement-breakpoint
ALTER TABLE `inbox_conversations` ADD CONSTRAINT `inbox_conversation_sync_fk` FOREIGN KEY (`studio_id`,`sync_state_id`) REFERENCES `inbox_sync_state`(`studio_id`,`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `inbox_messages` ADD CONSTRAINT `inbox_messages_conversation_fk` FOREIGN KEY (`studio_id`,`conversation_id`) REFERENCES `inbox_conversations`(`studio_id`,`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `inbox_summaries` ADD CONSTRAINT `inbox_summaries_conversation_fk` FOREIGN KEY (`studio_id`,`conversation_id`) REFERENCES `inbox_conversations`(`studio_id`,`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `anamnese_requests_token_unique` ON `anamnese_requests` (`token`);--> statement-breakpoint
CREATE INDEX `appointment_action_alerts_studio_status_idx` ON `appointment_action_alerts` (`studio_id`,`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `appointment_action_alerts_appointment_idx` ON `appointment_action_alerts` (`appointment_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `appointment_action_links_appointment_idx` ON `appointment_action_links` (`appointment_id`,`action`);--> statement-breakpoint
CREATE INDEX `appointment_action_links_studio_idx` ON `appointment_action_links` (`studio_id`,`expires_at`);--> statement-breakpoint
CREATE INDEX `appointment_planned_materials_appointment_idx` ON `appointment_planned_materials` (`studioId`,`appointmentId`,`status`);--> statement-breakpoint
CREATE INDEX `appointment_planned_materials_material_idx` ON `appointment_planned_materials` (`studioId`,`tenantMaterialId`);--> statement-breakpoint
CREATE INDEX `artist_notification_settings_enabled_idx` ON `artist_notification_settings` (`studio_id`,`whatsapp_operational_enabled`,`manual_client_reminder_enabled`);--> statement-breakpoint
CREATE INDEX `integration_contacts_studio_phone_lookup` ON `integration_contacts` (`studio_id`,`normalized_phone`);--> statement-breakpoint
CREATE INDEX `integration_contacts_integration_idx` ON `integration_contacts` (`integration_id`);--> statement-breakpoint
CREATE INDEX `integration_events_connection_idx` ON `integration_events` (`integration_id`,`received_at`);--> statement-breakpoint
CREATE INDEX `integration_events_studio_idx` ON `integration_events` (`studio_id`,`received_at`);--> statement-breakpoint
CREATE INDEX `integration_jobs_ready_idx` ON `integration_jobs` (`status`,`next_attempt_at`);--> statement-breakpoint
CREATE INDEX `integration_jobs_studio_idx` ON `integration_jobs` (`studio_id`,`createdAt`);--> statement-breakpoint
CREATE INDEX `inventory_batch_material_idx` ON `inventory_batches` (`studioId`,`tenantMaterialId`);--> statement-breakpoint
CREATE INDEX `inventory_kit_items_kit_idx` ON `inventory_kit_items` (`studioId`,`kitId`);--> statement-breakpoint
CREATE INDEX `inventory_kits_studio_active_idx` ON `inventory_kits` (`studioId`,`isActive`,`name`);--> statement-breakpoint
CREATE INDEX `inventory_loan_event_idx` ON `inventory_loan_events` (`studioId`,`loanId`,`id`);--> statement-breakpoint
CREATE INDEX `inventory_loan_due_idx` ON `inventory_loans` (`status`,`dueAt`);--> statement-breakpoint
CREATE INDEX `inventory_loan_parties_idx` ON `inventory_loans` (`studioId`,`borrowerArtistId`,`lenderArtistId`);--> statement-breakpoint
CREATE INDEX `inventory_notice_recipient_idx` ON `inventory_notices` (`studioId`,`recipientKey`,`id`);--> statement-breakpoint
CREATE INDEX `inventory_notice_delivery_idx` ON `inventory_notices` (`deliveryStatus`,`nextAttemptAt`);--> statement-breakpoint
CREATE INDEX `material_catalog_categories_active_idx` ON `material_catalog_categories` (`isActive`,`name`);--> statement-breakpoint
CREATE INDEX `material_catalog_items_category_idx` ON `material_catalog_items` (`categoryId`,`isActive`);--> statement-breakpoint
CREATE INDEX `material_catalog_items_lookup_idx` ON `material_catalog_items` (`name`,`subcategory`,`configuration`);--> statement-breakpoint
CREATE INDEX `message_queue_retry_of_idx` ON `message_queue` (`retry_of_queue_id`);--> statement-breakpoint
CREATE INDEX `procedure_inventory_consumptions_procedure_idx` ON `procedure_inventory_consumptions` (`procedureId`,`status`,`consumedAt`);--> statement-breakpoint
CREATE INDEX `procedure_inventory_consumptions_studio_client_idx` ON `procedure_inventory_consumptions` (`studioId`,`clientId`,`consumedAt`);--> statement-breakpoint
CREATE INDEX `procedure_inventory_consumptions_material_idx` ON `procedure_inventory_consumptions` (`studioId`,`tenantMaterialId`,`status`);--> statement-breakpoint
CREATE INDEX `procedure_pauses_procedure_idx` ON `procedure_pauses` (`procedureId`,`startedAt`);--> statement-breakpoint
CREATE INDEX `procedure_pauses_studio_open_idx` ON `procedure_pauses` (`studioId`,`endedAt`);--> statement-breakpoint
CREATE INDEX `quote_presets_studio_category_idx` ON `quote_presets` (`studio_id`,`category`,`is_active`);--> statement-breakpoint
CREATE INDEX `quote_presets_artist_idx` ON `quote_presets` (`studio_id`,`artist_id`,`category`);--> statement-breakpoint
CREATE INDEX `quote_proposals_studio_updated_idx` ON `quote_proposals` (`studio_id`,`updated_at`);--> statement-breakpoint
CREATE INDEX `quote_proposals_client_idx` ON `quote_proposals` (`studio_id`,`client_id`,`id`);--> statement-breakpoint
CREATE INDEX `quote_proposals_artist_idx` ON `quote_proposals` (`studio_id`,`artist_id`,`id`);--> statement-breakpoint
CREATE INDEX `studio_invitations_studio_idx` ON `studio_invitations` (`studioId`);--> statement-breakpoint
CREATE INDEX `studio_invitations_email_idx` ON `studio_invitations` (`email`);--> statement-breakpoint
CREATE INDEX `studios_masterKey_unique` ON `studios` (`masterKey`);--> statement-breakpoint
CREATE INDEX `tenant_inventory_movements_studio_material_idx` ON `tenant_inventory_movements` (`studioId`,`tenantMaterialId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `tenant_inventory_movements_source_idx` ON `tenant_inventory_movements` (`sourceType`,`sourceId`);--> statement-breakpoint
CREATE INDEX `tenant_materials_studio_active_idx` ON `tenant_materials` (`studioId`,`isActive`,`name`);--> statement-breakpoint
CREATE INDEX `tenant_materials_catalog_idx` ON `tenant_materials` (`studioId`,`catalogItemId`);--> statement-breakpoint
CREATE INDEX `tenant_materials_supplier_idx` ON `tenant_materials` (`studioId`,`supplierId`);--> statement-breakpoint
CREATE INDEX `user_module_permissions_studio_idx` ON `user_module_permissions` (`studioId`);--> statement-breakpoint
CREATE INDEX `whatsapp_integrations_studio_status_idx` ON `whatsapp_integrations` (`studio_id`,`status`);--> statement-breakpoint
CREATE INDEX `inbox_conversation_activity` ON `inbox_conversations` (`studio_id`,`last_interaction_at`,`id`);--> statement-breakpoint
CREATE INDEX `inbox_conversation_priority` ON `inbox_conversations` (`studio_id`,`status`,`priority`,`id`);--> statement-breakpoint
CREATE INDEX `inbox_conversation_classification` ON `inbox_conversations` (`studio_id`,`classification`,`id`);--> statement-breakpoint
CREATE INDEX `inbox_conversation_client` ON `inbox_conversations` (`studio_id`,`client_id`,`id`);--> statement-breakpoint
CREATE INDEX `inbox_conversation_artist` ON `inbox_conversations` (`studio_id`,`artist_id`,`id`);--> statement-breakpoint
CREATE INDEX `inbox_conversation_attendant` ON `inbox_conversations` (`studio_id`,`attendant_user_id`,`id`);--> statement-breakpoint
CREATE INDEX `inbox_conversation_phone` ON `inbox_conversations` (`studio_id`,`phone`);--> statement-breakpoint
CREATE INDEX `inbox_message_page` ON `inbox_messages` (`studio_id`,`conversation_id`,`message_at`,`id`);--> statement-breakpoint
CREATE INDEX `inbox_message_pending` ON `inbox_messages` (`studio_id`,`processing_status`,`id`);--> statement-breakpoint
CREATE INDEX `inbox_summary_history` ON `inbox_summaries` (`studio_id`,`window_end`,`id`);--> statement-breakpoint
CREATE INDEX `inbox_summary_conversation` ON `inbox_summaries` (`studio_id`,`conversation_id`,`id`);--> statement-breakpoint
CREATE INDEX `inbox_sync_connection` ON `inbox_sync_state` (`studio_id`,`integration_id`);--> statement-breakpoint
CREATE INDEX `procedure_color_samples_procedure_idx` ON `procedure_color_samples` (`studioId`,`procedureId`,`id`);--> statement-breakpoint
CREATE INDEX `procedure_ink_recipe_items_recipe_idx` ON `procedure_ink_recipe_items` (`studioId`,`recipeId`,`id`);--> statement-breakpoint
CREATE INDEX `procedure_ink_recipe_items_consumption_idx` ON `procedure_ink_recipe_items` (`studioId`,`consumptionId`);--> statement-breakpoint
CREATE INDEX `procedure_ink_recipe_results_artist_idx` ON `procedure_ink_recipe_results` (`studioId`,`artistId`,`id`);--> statement-breakpoint
CREATE INDEX `procedure_ink_recipe_results_procedure_idx` ON `procedure_ink_recipe_results` (`studioId`,`procedureId`,`id`);--> statement-breakpoint
CREATE INDEX `procedure_ink_recipes_procedure_idx` ON `procedure_ink_recipes` (`studioId`,`procedureId`,`id`);--> statement-breakpoint
CREATE INDEX `procedure_ink_recipes_sample_idx` ON `procedure_ink_recipes` (`studioId`,`sampleId`);--> statement-breakpoint
CREATE INDEX `procedure_visual_layers_order_idx` ON `procedure_visual_layers` (`studioId`,`procedureId`,`sortOrder`,`id`);--> statement-breakpoint
CREATE INDEX `tenant_material_color_samples_artist_idx` ON `tenant_material_color_samples` (`studioId`,`artistId`);