-- Fase 1 BotConversa: migration estritamente aditiva.
-- Nenhuma tabela, coluna ou dado existente é removido ou sobrescrito.

ALTER TABLE `whatsapp_integrations`
  ADD COLUMN `encrypted_api_token` TEXT NULL,
  ADD COLUMN `encrypted_webhook_secret` TEXT NULL,
  ADD COLUMN `connection_key` VARCHAR(96) NULL,
  ADD COLUMN `sandbox_mode` TINYINT NOT NULL DEFAULT 1,
  ADD COLUMN `sandbox_test_phone` VARCHAR(32) NULL,
  ADD COLUMN `is_enabled` TINYINT NOT NULL DEFAULT 0,
  ADD COLUMN `last_success_at` TIMESTAMP NULL,
  ADD COLUMN `failure_count` INT NOT NULL DEFAULT 0,
  ADD UNIQUE INDEX `whatsapp_integrations_connection_key_unique` (`connection_key`),
  ADD INDEX `whatsapp_integrations_studio_status_idx` (`studio_id`, `status`);

CREATE TABLE `integration_contacts` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `studio_id` INT NOT NULL,
  `integration_id` INT NOT NULL,
  `client_id` INT NOT NULL,
  `normalized_phone` VARCHAR(32) NOT NULL,
  `provider_subscriber_id` VARCHAR(255) NULL,
  `has_whatsapp_opt_in` TINYINT NOT NULL DEFAULT 0,
  `opt_in_at` TIMESTAMP NULL,
  `opt_in_source` VARCHAR(100) NULL,
  `opted_out_at` TIMESTAMP NULL,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `integration_contacts_studio_client_unique` (`studio_id`, `client_id`),
  UNIQUE KEY `integration_contacts_studio_phone_unique` (`studio_id`, `normalized_phone`),
  KEY `integration_contacts_integration_idx` (`integration_id`)
);

CREATE TABLE `integration_jobs` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `studio_id` INT NOT NULL,
  `integration_id` INT NOT NULL,
  `type` ENUM('sync_contact', 'send_template', 'dispatch_flow', 'process_inbound') NOT NULL,
  `payload` TEXT NOT NULL,
  `idempotency_key` VARCHAR(128) NOT NULL,
  `status` ENUM('pending', 'processing', 'completed', 'retry', 'failed', 'cancelled') NOT NULL DEFAULT 'pending',
  `attempt_count` INT NOT NULL DEFAULT 0,
  `max_attempts` INT NOT NULL DEFAULT 5,
  `next_attempt_at` TIMESTAMP NULL,
  `locked_at` TIMESTAMP NULL,
  `completed_at` TIMESTAMP NULL,
  `last_error` TEXT NULL,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `integration_jobs_idempotency_unique` (`idempotency_key`),
  KEY `integration_jobs_ready_idx` (`status`, `next_attempt_at`),
  KEY `integration_jobs_studio_idx` (`studio_id`, `createdAt`)
);

CREATE TABLE `integration_events` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `studio_id` INT NOT NULL,
  `integration_id` INT NOT NULL,
  `direction` ENUM('inbound', 'outbound') NOT NULL,
  `type` VARCHAR(100) NOT NULL,
  `idempotency_key` VARCHAR(128) NOT NULL,
  `provider_event_id` VARCHAR(255) NULL,
  `payload_hash` VARCHAR(64) NOT NULL,
  `status` ENUM('received', 'queued', 'processed', 'failed', 'ignored') NOT NULL DEFAULT 'received',
  `error_message` TEXT NULL,
  `received_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `processed_at` TIMESTAMP NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `integration_events_idempotency_unique` (`idempotency_key`),
  KEY `integration_events_connection_idx` (`integration_id`, `received_at`),
  KEY `integration_events_studio_idx` (`studio_id`, `received_at`)
);

CREATE TABLE `integration_schedules` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `code` VARCHAR(100) NOT NULL,
  `schedule_cron_task_uid` VARCHAR(65) NULL,
  `is_enabled` TINYINT NOT NULL DEFAULT 0,
  `last_run_at` TIMESTAMP NULL,
  `last_error` TEXT NULL,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `integration_schedules_code_unique` (`code`),
  UNIQUE KEY `integration_schedules_task_uid_unique` (`schedule_cron_task_uid`)
);
