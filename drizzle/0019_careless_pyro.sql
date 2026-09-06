ALTER TABLE `anamnese_requests` DROP INDEX `anamnese_requests_token_unique`;--> statement-breakpoint
ALTER TABLE `studios` DROP INDEX `studios_masterKey_unique`;--> statement-breakpoint
ALTER TABLE `users` DROP INDEX `users_openId_unique`;--> statement-breakpoint
ALTER TABLE `anamnese_requests` MODIFY COLUMN `createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP';--> statement-breakpoint
ALTER TABLE `anamnese_submissions` MODIFY COLUMN `createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP';--> statement-breakpoint
ALTER TABLE `anamnesisRecords` MODIFY COLUMN `hasAllergies` tinyint NOT NULL;--> statement-breakpoint
ALTER TABLE `anamnesisRecords` MODIFY COLUMN `hasAllergies` tinyint NOT NULL DEFAULT 0;--> statement-breakpoint
ALTER TABLE `anamnesisRecords` MODIFY COLUMN `hasDiseases` tinyint NOT NULL;--> statement-breakpoint
ALTER TABLE `anamnesisRecords` MODIFY COLUMN `hasDiseases` tinyint NOT NULL DEFAULT 0;--> statement-breakpoint
ALTER TABLE `anamnesisRecords` MODIFY COLUMN `usesMedication` tinyint NOT NULL;--> statement-breakpoint
ALTER TABLE `anamnesisRecords` MODIFY COLUMN `usesMedication` tinyint NOT NULL DEFAULT 0;--> statement-breakpoint
ALTER TABLE `anamnesisRecords` MODIFY COLUMN `isPregnant` tinyint NOT NULL;--> statement-breakpoint
ALTER TABLE `anamnesisRecords` MODIFY COLUMN `isPregnant` tinyint NOT NULL DEFAULT 0;--> statement-breakpoint
ALTER TABLE `anamnesisRecords` MODIFY COLUMN `hasKeloid` tinyint NOT NULL;--> statement-breakpoint
ALTER TABLE `anamnesisRecords` MODIFY COLUMN `hasKeloid` tinyint NOT NULL DEFAULT 0;--> statement-breakpoint
ALTER TABLE `anamnesisRecords` MODIFY COLUMN `acceptedTerms` tinyint NOT NULL;--> statement-breakpoint
ALTER TABLE `anamnesisRecords` MODIFY COLUMN `acceptedTerms` tinyint NOT NULL DEFAULT 0;--> statement-breakpoint
ALTER TABLE `anamnesisRecords` MODIFY COLUMN `createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP';--> statement-breakpoint
ALTER TABLE `appointments` MODIFY COLUMN `studioId` int NOT NULL DEFAULT 1;--> statement-breakpoint
ALTER TABLE `appointments` MODIFY COLUMN `createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP';--> statement-breakpoint
ALTER TABLE `artists` MODIFY COLUMN `studioId` int NOT NULL DEFAULT 1;--> statement-breakpoint
ALTER TABLE `artists` MODIFY COLUMN `createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP';--> statement-breakpoint
ALTER TABLE `auditLogs` MODIFY COLUMN `createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP';--> statement-breakpoint
ALTER TABLE `calendars` MODIFY COLUMN `createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP';--> statement-breakpoint
ALTER TABLE `clientNotes` MODIFY COLUMN `createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP';--> statement-breakpoint
ALTER TABLE `clients` MODIFY COLUMN `studioId` int NOT NULL DEFAULT 1;--> statement-breakpoint
ALTER TABLE `clients` MODIFY COLUMN `createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP';--> statement-breakpoint
ALTER TABLE `galleryImages` MODIFY COLUMN `createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP';--> statement-breakpoint
ALTER TABLE `notificationLogs` MODIFY COLUMN `sentAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP';--> statement-breakpoint
ALTER TABLE `reportTemplates` MODIFY COLUMN `createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP';--> statement-breakpoint
ALTER TABLE `studioSettings` MODIFY COLUMN `createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP';--> statement-breakpoint
ALTER TABLE `studios` MODIFY COLUMN `createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP';--> statement-breakpoint
ALTER TABLE `transactions` MODIFY COLUMN `studioId` int NOT NULL DEFAULT 1;--> statement-breakpoint
ALTER TABLE `transactions` MODIFY COLUMN `createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP';--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP';--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `lastSignedIn` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP';--> statement-breakpoint
CREATE INDEX `anamnese_requests_token_unique` ON `anamnese_requests` (`token`);--> statement-breakpoint
CREATE INDEX `studios_masterKey_unique` ON `studios` (`masterKey`);
