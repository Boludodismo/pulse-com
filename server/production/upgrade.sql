CREATE TABLE IF NOT EXISTS `appointment_planned_materials` (
  `id` int NOT NULL AUTO_INCREMENT,
  `studioId` int NOT NULL,
  `appointmentId` int NOT NULL,
  `tenantMaterialId` int DEFAULT NULL,
  `catalogItemId` int DEFAULT NULL,
  `nameSnapshot` varchar(255) NOT NULL,
  `unitSnapshot` varchar(50) NOT NULL,
  `quantityPlanned` decimal(12,3) NOT NULL,
  `status` enum('planejado','consumido','nao_utilizado') NOT NULL DEFAULT 'planejado',
  `createdByUserId` int DEFAULT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `appointment_planned_materials_appointment_idx` (`studioId`,`appointmentId`,`status`),
  KEY `appointment_planned_materials_material_idx` (`studioId`,`tenantMaterialId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `artist_cards` (
  `id` int NOT NULL AUTO_INCREMENT,
  `studio_id` int NOT NULL,
  `artist_id` int NOT NULL,
  `token` varchar(64) NOT NULL,
  `published` tinyint NOT NULL DEFAULT '0',
  `headline` varchar(160) NOT NULL DEFAULT '',
  `description` text NOT NULL,
  `links` text NOT NULL,
  `images` text NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `card_artist` (`studio_id`,`artist_id`),
  UNIQUE KEY `card_token` (`token`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `care_events` (
  `id` int NOT NULL AUTO_INCREMENT,
  `studio_id` int NOT NULL,
  `rule_id` int NOT NULL,
  `client_id` int NOT NULL,
  `appointment_id` int DEFAULT NULL,
  `artist_id` int DEFAULT NULL,
  `due_date` varchar(10) NOT NULL,
  `occurrence_key` varchar(128) NOT NULL,
  `token` varchar(64) NOT NULL,
  `message` text NOT NULL,
  `queue_id` int DEFAULT NULL,
  `status` varchar(20) NOT NULL DEFAULT 'pending',
  `feedback` text,
  `feedback_at` timestamp NULL DEFAULT NULL,
  `read_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `occurrence_key` (`occurrence_key`),
  UNIQUE KEY `token` (`token`),
  KEY `care_events_studio_client` (`studio_id`,`client_id`),
  KEY `care_events_due` (`status`,`due_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `care_rules` (
  `id` int NOT NULL AUTO_INCREMENT,
  `studio_id` int NOT NULL,
  `name` varchar(120) NOT NULL,
  `kind` varchar(20) NOT NULL,
  `amount` int NOT NULL DEFAULT '0',
  `unit` varchar(10) NOT NULL DEFAULT 'days',
  `send_time` varchar(5) NOT NULL DEFAULT '09:00',
  `body` text NOT NULL,
  `enabled` tinyint NOT NULL DEFAULT '0',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `care_rules_studio_name` (`studio_id`,`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `care_sessions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `studio_id` int NOT NULL,
  `client_id` int NOT NULL,
  `artist_id` int DEFAULT NULL,
  `appointment_id` int DEFAULT NULL,
  `source_key` varchar(80) NOT NULL,
  `completed_at` varchar(19) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `source_key` (`source_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `care_tags` (
  `id` int NOT NULL AUTO_INCREMENT,
  `studio_id` int NOT NULL,
  `client_id` int NOT NULL,
  `label` varchar(60) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `care_tags_client_label` (`studio_id`,`client_id`,`label`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `inbox_sync_state` (
  `id` int NOT NULL AUTO_INCREMENT,
  `studio_id` int NOT NULL,
  `integration_id` int DEFAULT NULL,
  `name` varchar(255) DEFAULT NULL,
  `provider` varchar(40) NOT NULL DEFAULT 'botconversa',
  `external_id` varchar(255) DEFAULT NULL,
  `status` varchar(40) NOT NULL DEFAULT 'not_configured',
  `connected_at` datetime DEFAULT NULL,
  `webhook_configured` int NOT NULL DEFAULT '0',
  `sync_enabled` int NOT NULL DEFAULT '0',
  `summary_enabled` int NOT NULL DEFAULT '0',
  `summary_interval_minutes` int NOT NULL DEFAULT '60',
  `last_sync_at` datetime DEFAULT NULL,
  `last_processed_at` datetime DEFAULT NULL,
  `last_message_at` datetime DEFAULT NULL,
  `last_summary_at` datetime DEFAULT NULL,
  `sync_status` varchar(40) NOT NULL DEFAULT 'disabled',
  `sync_cursor` text,
  `external_cursor` text,
  `error_count` int NOT NULL DEFAULT '0',
  `last_error` text,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `inbox_sync_studio_id` (`studio_id`,`id`),
  KEY `inbox_sync_connection` (`studio_id`,`integration_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `integration_contacts` (
  `id` int NOT NULL AUTO_INCREMENT,
  `studio_id` int NOT NULL,
  `integration_id` int NOT NULL,
  `client_id` int NOT NULL,
  `normalized_phone` varchar(32) NOT NULL,
  `provider_subscriber_id` varchar(255) DEFAULT NULL,
  `has_whatsapp_opt_in` tinyint NOT NULL DEFAULT '0',
  `opt_in_at` timestamp NULL DEFAULT NULL,
  `opt_in_source` varchar(100) DEFAULT NULL,
  `opted_out_at` timestamp NULL DEFAULT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `integration_contacts_studio_client_unique` (`studio_id`,`client_id`),
  UNIQUE KEY `integration_contacts_studio_phone_unique` (`studio_id`,`normalized_phone`),
  KEY `integration_contacts_integration_idx` (`integration_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `integration_events` (
  `id` int NOT NULL AUTO_INCREMENT,
  `studio_id` int NOT NULL,
  `integration_id` int NOT NULL,
  `direction` enum('inbound','outbound') NOT NULL,
  `type` varchar(100) NOT NULL,
  `idempotency_key` varchar(128) NOT NULL,
  `provider_event_id` varchar(255) DEFAULT NULL,
  `payload_hash` varchar(64) NOT NULL,
  `status` enum('received','queued','processed','failed','ignored') NOT NULL DEFAULT 'received',
  `error_message` text,
  `received_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `processed_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `integration_events_idempotency_unique` (`idempotency_key`),
  KEY `integration_events_connection_idx` (`integration_id`,`received_at`),
  KEY `integration_events_studio_idx` (`studio_id`,`received_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `integration_jobs` (
  `id` int NOT NULL AUTO_INCREMENT,
  `studio_id` int NOT NULL,
  `integration_id` int NOT NULL,
  `type` enum('sync_contact','send_template','dispatch_flow','process_inbound') NOT NULL,
  `payload` text NOT NULL,
  `idempotency_key` varchar(128) NOT NULL,
  `status` enum('pending','processing','completed','retry','failed','cancelled') NOT NULL DEFAULT 'pending',
  `attempt_count` int NOT NULL DEFAULT '0',
  `max_attempts` int NOT NULL DEFAULT '5',
  `next_attempt_at` timestamp NULL DEFAULT NULL,
  `locked_at` timestamp NULL DEFAULT NULL,
  `completed_at` timestamp NULL DEFAULT NULL,
  `last_error` text,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `integration_jobs_idempotency_unique` (`idempotency_key`),
  KEY `integration_jobs_ready_idx` (`status`,`next_attempt_at`),
  KEY `integration_jobs_studio_idx` (`studio_id`,`createdAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `integration_schedules` (
  `id` int NOT NULL AUTO_INCREMENT,
  `code` varchar(100) NOT NULL,
  `schedule_cron_task_uid` varchar(65) DEFAULT NULL,
  `is_enabled` tinyint NOT NULL DEFAULT '0',
  `last_run_at` timestamp NULL DEFAULT NULL,
  `last_error` text,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `integration_schedules_code_unique` (`code`),
  UNIQUE KEY `integration_schedules_task_uid_unique` (`schedule_cron_task_uid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `material_catalog_categories` (
  `id` int NOT NULL AUTO_INCREMENT,
  `code` varchar(80) NOT NULL,
  `name` varchar(120) NOT NULL,
  `icon` varchar(80) DEFAULT NULL,
  `description` text,
  `isActive` tinyint NOT NULL DEFAULT '1',
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `material_catalog_categories_code_unique` (`code`),
  KEY `material_catalog_categories_active_idx` (`isActive`,`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `material_catalog_items` (
  `id` int NOT NULL AUTO_INCREMENT,
  `categoryId` int NOT NULL,
  `code` varchar(120) NOT NULL,
  `name` varchar(255) NOT NULL,
  `subcategory` varchar(120) DEFAULT NULL,
  `configuration` varchar(120) DEFAULT NULL,
  `diameter` varchar(40) DEFAULT NULL,
  `defaultUnit` varchar(50) NOT NULL DEFAULT 'unidade',
  `technicalSpecification` text,
  `icon` varchar(80) DEFAULT NULL,
  `isActive` tinyint NOT NULL DEFAULT '1',
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `material_catalog_items_code_unique` (`code`),
  KEY `material_catalog_items_category_idx` (`categoryId`,`isActive`),
  KEY `material_catalog_items_lookup_idx` (`name`,`subcategory`,`configuration`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `message_automation_settings` (
  `id` int NOT NULL AUTO_INCREMENT,
  `studio_id` int NOT NULL,
  `appointment_reminders_enabled` tinyint NOT NULL DEFAULT '0',
  `appointment_days_before` int NOT NULL DEFAULT '1',
  `appointment_send_time` varchar(5) NOT NULL DEFAULT '10:00',
  `birthday_messages_enabled` tinyint NOT NULL DEFAULT '0',
  `birthday_send_time` varchar(5) NOT NULL DEFAULT '10:00',
  `birthday_message_template` text,
  `timezone` varchar(64) NOT NULL DEFAULT 'America/Sao_Paulo',
  `last_appointment_cycle_at` timestamp NULL DEFAULT NULL,
  `last_birthday_cycle_at` timestamp NULL DEFAULT NULL,
  `last_error` text,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `one_hour_reminders_enabled` tinyint NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`),
  UNIQUE KEY `message_automation_settings_studio_unique` (`studio_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `procedure_inventory_consumptions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `procedureId` int NOT NULL,
  `studioId` int NOT NULL,
  `appointmentId` int DEFAULT NULL,
  `clientId` int NOT NULL,
  `artistId` int DEFAULT NULL,
  `tenantMaterialId` int NOT NULL,
  `plannedMaterialId` int DEFAULT NULL,
  `nameSnapshot` varchar(255) NOT NULL,
  `unitSnapshot` varchar(50) NOT NULL,
  `quantity` decimal(12,3) NOT NULL,
  `unitCostSnapshot` decimal(12,4) NOT NULL,
  `totalCostSnapshot` decimal(12,4) NOT NULL,
  `lotSnapshot` varchar(120) DEFAULT NULL,
  `expiresAtSnapshot` datetime DEFAULT NULL,
  `status` enum('consumido','revertido') NOT NULL DEFAULT 'consumido',
  `consumedAt` datetime NOT NULL,
  `reversedAt` datetime DEFAULT NULL,
  `reversalReason` varchar(255) DEFAULT NULL,
  `createdByUserId` int DEFAULT NULL,
  `reversedByUserId` int DEFAULT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `procedure_inventory_consumptions_procedure_idx` (`procedureId`,`status`,`consumedAt`),
  KEY `procedure_inventory_consumptions_studio_client_idx` (`studioId`,`clientId`,`consumedAt`),
  KEY `procedure_inventory_consumptions_material_idx` (`studioId`,`tenantMaterialId`,`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `procedure_pauses` (
  `id` int NOT NULL AUTO_INCREMENT,
  `procedureId` int NOT NULL,
  `studioId` int NOT NULL,
  `artistId` int DEFAULT NULL,
  `startedAt` datetime NOT NULL,
  `endedAt` datetime DEFAULT NULL,
  `reason` varchar(120) DEFAULT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `procedure_pauses_procedure_idx` (`procedureId`,`startedAt`),
  KEY `procedure_pauses_studio_open_idx` (`studioId`,`endedAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `procurement_alerts` (
  `id` int NOT NULL AUTO_INCREMENT,
  `studio_id` int NOT NULL,
  `material_id` int NOT NULL,
  `episode` varchar(64) NOT NULL,
  `status` varchar(24) NOT NULL DEFAULT 'open',
  `recipient_artist_id` int DEFAULT NULL,
  `notify_enabled` tinyint NOT NULL DEFAULT '0',
  `notified_at` datetime DEFAULT NULL,
  `last_error` text,
  PRIMARY KEY (`id`),
  UNIQUE KEY `procurement_material` (`studio_id`,`material_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `procurement_contacts` (
  `id` int NOT NULL AUTO_INCREMENT,
  `studio_id` int NOT NULL,
  `supplier_id` int NOT NULL,
  `confirmed_by` int NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `contact_studio` (`studio_id`,`supplier_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `procurement_quotes` (
  `id` int NOT NULL AUTO_INCREMENT,
  `studio_id` int NOT NULL,
  `material_id` int NOT NULL,
  `supplier_id` int NOT NULL,
  `quantity` decimal(12,3) NOT NULL,
  `recipient_phone` varchar(32) NOT NULL,
  `message` text NOT NULL,
  `status` varchar(24) NOT NULL DEFAULT 'draft',
  `approved_by` int DEFAULT NULL,
  `approved_at` datetime DEFAULT NULL,
  `sent_at` datetime DEFAULT NULL,
  `provider_message_id` varchar(255) DEFAULT NULL,
  `last_error` text,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `procurement_templates` (
  `id` int NOT NULL AUTO_INCREMENT,
  `studio_id` int NOT NULL,
  `name` varchar(120) NOT NULL,
  `body` text NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `procurement_template` (`studio_id`,`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `studio_invitations` (
  `id` int NOT NULL AUTO_INCREMENT,
  `studioId` int NOT NULL,
  `email` varchar(320) NOT NULL,
  `role` enum('admin','collaborator') NOT NULL,
  `tokenHash` varchar(128) NOT NULL,
  `status` enum('pending','accepted','revoked','expired') NOT NULL DEFAULT 'pending',
  `expiresAt` timestamp NOT NULL,
  `invitedByUserId` int NOT NULL,
  `acceptedUserId` int DEFAULT NULL,
  `acceptedAt` timestamp NULL DEFAULT NULL,
  `revokedAt` timestamp NULL DEFAULT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `artistId` int DEFAULT NULL,
  `permissionSnapshot` json DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `studio_invitations_tokenHash_unique` (`tokenHash`),
  KEY `studio_invitations_studio_idx` (`studioId`),
  KEY `studio_invitations_email_idx` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `studio_material_artists` (
  `id` int NOT NULL AUTO_INCREMENT,
  `studioId` int NOT NULL,
  `tenantMaterialId` int NOT NULL,
  `artistId` int NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `studio_material_artist_unique` (`studioId`,`tenantMaterialId`,`artistId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `tenant_inventory_movements` (
  `id` int NOT NULL AUTO_INCREMENT,
  `studioId` int NOT NULL,
  `tenantMaterialId` int NOT NULL,
  `type` enum('entrada','consumo','reversao','ajuste') NOT NULL,
  `quantity` decimal(12,3) NOT NULL,
  `previousQuantity` decimal(12,3) NOT NULL,
  `newQuantity` decimal(12,3) NOT NULL,
  `sourceType` varchar(80) DEFAULT NULL,
  `sourceId` int DEFAULT NULL,
  `reason` varchar(255) DEFAULT NULL,
  `notes` text,
  `createdByUserId` int DEFAULT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `tenant_inventory_movements_studio_material_idx` (`studioId`,`tenantMaterialId`,`createdAt`),
  KEY `tenant_inventory_movements_source_idx` (`sourceType`,`sourceId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `tenant_materials` (
  `id` int NOT NULL AUTO_INCREMENT,
  `studioId` int NOT NULL,
  `catalogItemId` int DEFAULT NULL,
  `legacyMaterialId` int DEFAULT NULL,
  `name` varchar(255) NOT NULL,
  `category` varchar(120) DEFAULT NULL,
  `unit` varchar(50) NOT NULL DEFAULT 'unidade',
  `brand` varchar(120) DEFAULT NULL,
  `line` varchar(120) DEFAULT NULL,
  `model` varchar(120) DEFAULT NULL,
  `configuration` varchar(120) DEFAULT NULL,
  `diameter` varchar(40) DEFAULT NULL,
  `currentQuantity` decimal(12,3) NOT NULL DEFAULT '0.000',
  `minimumQuantity` decimal(12,3) NOT NULL DEFAULT '0.000',
  `unitCost` decimal(12,4) NOT NULL DEFAULT '0.0000',
  `supplierId` int DEFAULT NULL,
  `lot` varchar(120) DEFAULT NULL,
  `expiresAt` datetime DEFAULT NULL,
  `notes` text,
  `isActive` tinyint NOT NULL DEFAULT '1',
  `createdByUserId` int DEFAULT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `ownerArtistId` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `tenant_materials_legacy_source_unique` (`studioId`,`legacyMaterialId`),
  KEY `tenant_materials_studio_active_idx` (`studioId`,`isActive`,`name`),
  KEY `tenant_materials_catalog_idx` (`studioId`,`catalogItemId`),
  KEY `tenant_materials_supplier_idx` (`studioId`,`supplierId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `user_module_permissions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `userId` int NOT NULL,
  `studioId` int NOT NULL,
  `module` enum('clients','appointments','stock','finance','anamnesis','pod','reports','intelligent_inbox','inbox_conversations','inbox_summaries','inbox_priorities','inbox_opportunities','inbox_settings','inbox_suggestions') NOT NULL,
  `canRead` tinyint NOT NULL DEFAULT '0',
  `canWrite` tinyint NOT NULL DEFAULT '0',
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `user_module_permissions_user_studio_module_unique` (`userId`,`studioId`,`module`),
  KEY `user_module_permissions_studio_idx` (`studioId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `inbox_conversations` (
  `id` int NOT NULL AUTO_INCREMENT,
  `studio_id` int NOT NULL,
  `sync_state_id` int NOT NULL,
  `client_id` int DEFAULT NULL,
  `integration_contact_id` int DEFAULT NULL,
  `external_contact_id` varchar(255) DEFAULT NULL,
  `external_conversation_id` varchar(191) NOT NULL,
  `client_name` varchar(255) DEFAULT NULL,
  `phone` varchar(32) DEFAULT NULL,
  `source` varchar(80) DEFAULT NULL,
  `channel` varchar(80) DEFAULT NULL,
  `artist_id` int DEFAULT NULL,
  `attendant_user_id` int DEFAULT NULL,
  `last_interaction_at` datetime DEFAULT NULL,
  `status` varchar(40) NOT NULL DEFAULT 'open',
  `priority` varchar(20) NOT NULL DEFAULT 'NORMAL',
  `classification` varchar(80) NOT NULL DEFAULT 'other',
  `waiting_since` datetime DEFAULT NULL,
  `waiting_seconds` int NOT NULL DEFAULT '0',
  `summary` text,
  `purchase_intent` varchar(40) NOT NULL DEFAULT 'UNKNOWN',
  `pending_actions` text,
  `next_recommended_action` text,
  `suggested_reply` text,
  `analyzed_message_count` int NOT NULL DEFAULT '0',
  `last_summary_at` datetime DEFAULT NULL,
  `last_processed_at` datetime DEFAULT NULL,
  `processing_status` varchar(40) NOT NULL DEFAULT 'disabled',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `inbox_conversation_studio_id` (`studio_id`,`id`),
  UNIQUE KEY `inbox_conversation_external` (`studio_id`,`sync_state_id`,`external_conversation_id`),
  KEY `inbox_conversation_activity` (`studio_id`,`last_interaction_at`,`id`),
  KEY `inbox_conversation_priority` (`studio_id`,`status`,`priority`,`id`),
  KEY `inbox_conversation_classification` (`studio_id`,`classification`,`id`),
  KEY `inbox_conversation_client` (`studio_id`,`client_id`,`id`),
  KEY `inbox_conversation_artist` (`studio_id`,`artist_id`,`id`),
  KEY `inbox_conversation_attendant` (`studio_id`,`attendant_user_id`,`id`),
  KEY `inbox_conversation_phone` (`studio_id`,`phone`),
  CONSTRAINT `inbox_conversation_sync_fk` FOREIGN KEY (`studio_id`, `sync_state_id`) REFERENCES `inbox_sync_state` (`studio_id`, `id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `inbox_messages` (
  `id` int NOT NULL AUTO_INCREMENT,
  `studio_id` int NOT NULL,
  `conversation_id` int NOT NULL,
  `external_message_id` varchar(191) NOT NULL,
  `message_type` varchar(40) NOT NULL DEFAULT 'text',
  `direction` varchar(20) NOT NULL DEFAULT 'inbound',
  `actor` varchar(40) NOT NULL DEFAULT 'customer',
  `text_content` text,
  `media_reference` text,
  `metadata` text,
  `message_at` datetime DEFAULT NULL,
  `processed_at` datetime DEFAULT NULL,
  `processing_status` varchar(40) NOT NULL DEFAULT 'disabled',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `inbox_message_external` (`studio_id`,`conversation_id`,`external_message_id`),
  KEY `inbox_message_page` (`studio_id`,`conversation_id`,`message_at`,`id`),
  KEY `inbox_message_pending` (`studio_id`,`processing_status`,`id`),
  CONSTRAINT `inbox_messages_conversation_fk` FOREIGN KEY (`studio_id`, `conversation_id`) REFERENCES `inbox_conversations` (`studio_id`, `id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `inbox_summaries` (
  `id` int NOT NULL AUTO_INCREMENT,
  `studio_id` int NOT NULL,
  `conversation_id` int DEFAULT NULL,
  `scope_key` varchar(100) NOT NULL,
  `window_start` datetime NOT NULL,
  `window_end` datetime NOT NULL,
  `summary` text,
  `metrics` text,
  `analysis` text,
  `analyzed_message_count` int NOT NULL DEFAULT '0',
  `last_message_id` int DEFAULT NULL,
  `processing_status` varchar(40) NOT NULL DEFAULT 'disabled',
  `analysis_version` varchar(80) DEFAULT NULL,
  `last_error` text,
  `processed_at` datetime DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `inbox_summary_window` (`studio_id`,`scope_key`,`window_start`,`window_end`),
  KEY `inbox_summary_history` (`studio_id`,`window_end`,`id`),
  KEY `inbox_summary_conversation` (`studio_id`,`conversation_id`,`id`),
  CONSTRAINT `inbox_summaries_conversation_fk` FOREIGN KEY (`studio_id`, `conversation_id`) REFERENCES `inbox_conversations` (`studio_id`, `id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS appointment_action_links (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  studio_id INT NOT NULL,
  appointment_id INT NOT NULL,
  action ENUM('confirmed', 'early', 'late', 'reschedule_requested') NOT NULL,
  token_hash VARCHAR(128) NOT NULL,
  expires_at DATETIME NOT NULL,
  used_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY appointment_action_links_token_unique (token_hash),
  KEY appointment_action_links_appointment_idx (appointment_id, action),
  KEY appointment_action_links_studio_idx (studio_id, expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS appointment_action_alerts (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  studio_id INT NOT NULL,
  appointment_id INT NOT NULL,
  action_link_id INT NOT NULL,
  action ENUM('confirmed', 'early', 'late', 'reschedule_requested') NOT NULL,
  status ENUM('new', 'viewed') NOT NULL DEFAULT 'new',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  viewed_at TIMESTAMP NULL,
  UNIQUE KEY appointment_action_alerts_link_unique (action_link_id),
  KEY appointment_action_alerts_studio_status_idx (studio_id, status, created_at),
  KEY appointment_action_alerts_appointment_idx (appointment_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET @crm_ddl = IF((SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='message_queue' AND column_name='studio_id')=0, 'ALTER TABLE `message_queue` ADD COLUMN `studio_id` int DEFAULT NULL', 'DO 0');
PREPARE crm_stmt FROM @crm_ddl;
EXECUTE crm_stmt;
DEALLOCATE PREPARE crm_stmt;

SET @crm_ddl = IF((SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='message_queue' AND column_name='retry_of_queue_id')=0, 'ALTER TABLE `message_queue` ADD COLUMN `retry_of_queue_id` int DEFAULT NULL', 'DO 0');
PREPARE crm_stmt FROM @crm_ddl;
EXECUTE crm_stmt;
DEALLOCATE PREPARE crm_stmt;

SET @crm_ddl = IF((SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='message_templates' AND column_name='studio_id')=0, 'ALTER TABLE `message_templates` ADD COLUMN `studio_id` int DEFAULT NULL', 'DO 0');
PREPARE crm_stmt FROM @crm_ddl;
EXECUTE crm_stmt;
DEALLOCATE PREPARE crm_stmt;

SET @crm_ddl = IF((SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='users' AND column_name='accessStatus')=0, 'ALTER TABLE `users` ADD COLUMN `accessStatus` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT ''active''', 'DO 0');
PREPARE crm_stmt FROM @crm_ddl;
EXECUTE crm_stmt;
DEALLOCATE PREPARE crm_stmt;

SET @crm_ddl = IF((SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='users' AND column_name='accessExpiresAt')=0, 'ALTER TABLE `users` ADD COLUMN `accessExpiresAt` timestamp NULL DEFAULT NULL', 'DO 0');
PREPARE crm_stmt FROM @crm_ddl;
EXECUTE crm_stmt;
DEALLOCATE PREPARE crm_stmt;

SET @crm_ddl = IF((SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='whatsapp_integrations' AND column_name='studio_id')=0, 'ALTER TABLE `whatsapp_integrations` ADD COLUMN `studio_id` int DEFAULT NULL', 'DO 0');
PREPARE crm_stmt FROM @crm_ddl;
EXECUTE crm_stmt;
DEALLOCATE PREPARE crm_stmt;

SET @crm_ddl = IF((SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='whatsapp_integrations' AND column_name='encrypted_api_token')=0, 'ALTER TABLE `whatsapp_integrations` ADD COLUMN `encrypted_api_token` text COLLATE utf8mb4_unicode_ci', 'DO 0');
PREPARE crm_stmt FROM @crm_ddl;
EXECUTE crm_stmt;
DEALLOCATE PREPARE crm_stmt;

SET @crm_ddl = IF((SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='whatsapp_integrations' AND column_name='encrypted_webhook_secret')=0, 'ALTER TABLE `whatsapp_integrations` ADD COLUMN `encrypted_webhook_secret` text COLLATE utf8mb4_unicode_ci', 'DO 0');
PREPARE crm_stmt FROM @crm_ddl;
EXECUTE crm_stmt;
DEALLOCATE PREPARE crm_stmt;

SET @crm_ddl = IF((SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='whatsapp_integrations' AND column_name='connection_key')=0, 'ALTER TABLE `whatsapp_integrations` ADD COLUMN `connection_key` varchar(96) COLLATE utf8mb4_unicode_ci DEFAULT NULL', 'DO 0');
PREPARE crm_stmt FROM @crm_ddl;
EXECUTE crm_stmt;
DEALLOCATE PREPARE crm_stmt;

SET @crm_ddl = IF((SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='whatsapp_integrations' AND column_name='sandbox_mode')=0, 'ALTER TABLE `whatsapp_integrations` ADD COLUMN `sandbox_mode` tinyint NOT NULL DEFAULT ''1''', 'DO 0');
PREPARE crm_stmt FROM @crm_ddl;
EXECUTE crm_stmt;
DEALLOCATE PREPARE crm_stmt;

SET @crm_ddl = IF((SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='whatsapp_integrations' AND column_name='sandbox_test_phone')=0, 'ALTER TABLE `whatsapp_integrations` ADD COLUMN `sandbox_test_phone` varchar(32) COLLATE utf8mb4_unicode_ci DEFAULT NULL', 'DO 0');
PREPARE crm_stmt FROM @crm_ddl;
EXECUTE crm_stmt;
DEALLOCATE PREPARE crm_stmt;

SET @crm_ddl = IF((SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='whatsapp_integrations' AND column_name='is_enabled')=0, 'ALTER TABLE `whatsapp_integrations` ADD COLUMN `is_enabled` tinyint NOT NULL DEFAULT ''0''', 'DO 0');
PREPARE crm_stmt FROM @crm_ddl;
EXECUTE crm_stmt;
DEALLOCATE PREPARE crm_stmt;

SET @crm_ddl = IF((SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='whatsapp_integrations' AND column_name='last_success_at')=0, 'ALTER TABLE `whatsapp_integrations` ADD COLUMN `last_success_at` timestamp NULL DEFAULT NULL', 'DO 0');
PREPARE crm_stmt FROM @crm_ddl;
EXECUTE crm_stmt;
DEALLOCATE PREPARE crm_stmt;

SET @crm_ddl = IF((SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='whatsapp_integrations' AND column_name='failure_count')=0, 'ALTER TABLE `whatsapp_integrations` ADD COLUMN `failure_count` int NOT NULL DEFAULT ''0''', 'DO 0');
PREPARE crm_stmt FROM @crm_ddl;
EXECUTE crm_stmt;
DEALLOCATE PREPARE crm_stmt;

SET @crm_ddl = IF((SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='whatsapp_integrations' AND column_name='production_activated_at')=0, 'ALTER TABLE `whatsapp_integrations` ADD COLUMN `production_activated_at` timestamp NULL DEFAULT NULL', 'DO 0');
PREPARE crm_stmt FROM @crm_ddl;
EXECUTE crm_stmt;
DEALLOCATE PREPARE crm_stmt;

SET @crm_ddl = IF((SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='whatsapp_integrations' AND column_name='production_activated_by_user_id')=0, 'ALTER TABLE `whatsapp_integrations` ADD COLUMN `production_activated_by_user_id` int DEFAULT NULL', 'DO 0');
PREPARE crm_stmt FROM @crm_ddl;
EXECUTE crm_stmt;
DEALLOCATE PREPARE crm_stmt;

ALTER TABLE `message_templates` MODIFY COLUMN `trigger` enum('appointment_created','appointment_confirmed','appointment_reminder_24h','appointment_reminder_2h','appointment_cancelled','appointment_rescheduled','custom','appointment_reminder_1h','care_guide') COLLATE utf8mb4_unicode_ci NOT NULL;
CREATE TABLE IF NOT EXISTS `inventory_kits` (
  `id` int NOT NULL AUTO_INCREMENT,
  `studioId` int NOT NULL,
  `name` varchar(160) NOT NULL,
  `description` varchar(500) DEFAULT NULL,
  `isActive` tinyint NOT NULL DEFAULT 1,
  `createdByUserId` int DEFAULT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `inventory_kits_studio_active_idx` (`studioId`,`isActive`,`name`)
);

CREATE TABLE IF NOT EXISTS `inventory_kit_items` (
  `id` int NOT NULL AUTO_INCREMENT,
  `studioId` int NOT NULL,
  `kitId` int NOT NULL,
  `tenantMaterialId` int NOT NULL,
  `quantity` decimal(12,3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `inventory_kit_items_material_unique` (`studioId`,`kitId`,`tenantMaterialId`),
  KEY `inventory_kit_items_kit_idx` (`studioId`,`kitId`)
);
