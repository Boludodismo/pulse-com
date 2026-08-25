ALTER TABLE `anamnese_submissions`
  ADD COLUMN `riskLevel` enum('low','medium','high','critical') NOT NULL DEFAULT 'low',
  ADD COLUMN `riskFactors` text NULL,
  ADD COLUMN `riskVersion` varchar(20) NOT NULL DEFAULT '2026.1';

CREATE TABLE `anamnesis_risk_history` (
  `id` int AUTO_INCREMENT NOT NULL,
  `studioId` int NOT NULL,
  `clientId` int NOT NULL,
  `appointmentId` int NULL,
  `submissionId` int NULL,
  `anamnesisRecordId` int NULL,
  `source` enum('public_link','manual') NOT NULL,
  `eventType` enum('created','updated') NOT NULL DEFAULT 'created',
  `riskLevel` enum('low','medium','high','critical') NOT NULL,
  `riskFactors` text NOT NULL,
  `riskVersion` varchar(20) NOT NULL DEFAULT '2026.1',
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `anamnesis_risk_history_id` PRIMARY KEY(`id`),
  INDEX `risk_history_studio_created_idx` (`studioId`, `createdAt`),
  INDEX `risk_history_client_created_idx` (`clientId`, `createdAt`)
);
