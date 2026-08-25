CREATE TABLE IF NOT EXISTS `sales_leads` (
  `id` int AUTO_INCREMENT NOT NULL,
  `studioId` int NOT NULL DEFAULT 1,
  `clientId` int,
  `appointmentId` int,
  `artistId` int,
  `name` varchar(255) NOT NULL,
  `phone` varchar(30),
  `email` varchar(320),
  `service` varchar(255),
  `description` text,
  `estimatedValue` int,
  `stage` enum('new','awaiting_info','preparing_quote','quote_sent','awaiting_reply','awaiting_deposit','scheduled','lost','archived') NOT NULL DEFAULT 'new',
  `nextFollowupAt` datetime,
  `lostReason` varchar(255),
  `notes` text,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `sales_leads_id` PRIMARY KEY(`id`),
  INDEX `sales_leads_studio_stage_idx` (`studioId`,`stage`),
  INDEX `sales_leads_followup_idx` (`nextFollowupAt`)
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS `waitlist_entries` (
  `id` int AUTO_INCREMENT NOT NULL,
  `studioId` int NOT NULL DEFAULT 1,
  `clientId` int NOT NULL,
  `artistId` int,
  `service` varchar(255),
  `preferredDays` text,
  `preferredPeriods` text,
  `minDuration` int NOT NULL DEFAULT 60,
  `maxDuration` int NOT NULL DEFAULT 480,
  `priority` int NOT NULL DEFAULT 0,
  `status` enum('active','contacted','booked','paused','cancelled') NOT NULL DEFAULT 'active',
  `notes` text,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `waitlist_entries_id` PRIMARY KEY(`id`),
  INDEX `waitlist_entries_studio_status_idx` (`studioId`,`status`),
  INDEX `waitlist_entries_artist_idx` (`artistId`)
);
