ALTER TABLE `clients`
  MODIFY COLUMN `docType` enum('cpf','rg','passport','other') DEFAULT 'cpf';
--> statement-breakpoint
ALTER TABLE `anamnese_requests`
  ADD COLUMN `source` enum('public_link','legacy_csv') NOT NULL DEFAULT 'public_link',
  ADD COLUMN `importBatchId` int NULL,
  ADD COLUMN `originalArtistName` varchar(255) NULL,
  ADD COLUMN `procedureDate` datetime NULL,
  ADD COLUMN `procedureDateStatus` enum('inferred','confirmed') NOT NULL DEFAULT 'inferred';
--> statement-breakpoint
ALTER TABLE `anamnesis_risk_history`
  MODIFY COLUMN `source` enum('public_link','manual','legacy_csv') NOT NULL;
--> statement-breakpoint
ALTER TABLE `post_sale_followups`
  MODIFY COLUMN `appointmentId` int NULL,
  ADD COLUMN `anamnesisSubmissionId` int NULL,
  ADD COLUMN `source` enum('appointment','legacy_anamnesis') NOT NULL DEFAULT 'appointment',
  ADD COLUMN `referenceDate` datetime NULL,
  ADD COLUMN `serviceSnapshot` text NULL,
  ADD COLUMN `artistNameSnapshot` varchar(255) NULL,
  ADD COLUMN `anniversaryYears` int NOT NULL DEFAULT 1,
  ADD UNIQUE INDEX `post_sale_followups_submission_stage_unique` (`anamnesisSubmissionId`, `stage`);
--> statement-breakpoint
CREATE TABLE `legacy_import_batches` (
  `id` int AUTO_INCREMENT NOT NULL,
  `studioId` int NOT NULL,
  `targetArtistId` int NOT NULL,
  `createdByUserId` int NOT NULL,
  `fileName` varchar(255) NOT NULL,
  `fileHash` varchar(64) NOT NULL,
  `selectedArtistsJson` text NOT NULL,
  `status` enum('processing','completed','failed') NOT NULL DEFAULT 'processing',
  `totalRows` int NOT NULL DEFAULT 0,
  `importedRows` int NOT NULL DEFAULT 0,
  `skippedRows` int NOT NULL DEFAULT 0,
  `errorRows` int NOT NULL DEFAULT 0,
  `createdClients` int NOT NULL DEFAULT 0,
  `updatedClients` int NOT NULL DEFAULT 0,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `completedAt` timestamp NULL,
  CONSTRAINT `legacy_import_batches_id` PRIMARY KEY(`id`),
  CONSTRAINT `legacy_import_batch_file_unique` UNIQUE(`studioId`,`targetArtistId`,`fileHash`),
  INDEX `legacy_import_batch_studio_idx` (`studioId`,`createdAt`)
);
--> statement-breakpoint
CREATE TABLE `legacy_import_rows` (
  `id` int AUTO_INCREMENT NOT NULL,
  `batchId` int NOT NULL,
  `studioId` int NOT NULL,
  `sourceRowNumber` int NOT NULL,
  `fingerprint` varchar(64) NOT NULL,
  `clientId` int NULL,
  `requestId` int NULL,
  `submissionId` int NULL,
  `followupId` int NULL,
  `status` enum('imported','skipped','error') NOT NULL,
  `issuesJson` text NULL,
  `rawPayloadJson` text NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `legacy_import_rows_id` PRIMARY KEY(`id`),
  CONSTRAINT `legacy_import_row_fingerprint_unique` UNIQUE(`studioId`,`fingerprint`),
  INDEX `legacy_import_row_batch_idx` (`batchId`,`sourceRowNumber`)
);
