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
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `studios_id` PRIMARY KEY(`id`),
	CONSTRAINT `studios_masterKey_unique` UNIQUE(`masterKey`)
);
--> statement-breakpoint
ALTER TABLE `appointments` ADD `studioId` int NOT NULL;
--> statement-breakpoint
ALTER TABLE `artists` ADD `studioId` int NOT NULL;
--> statement-breakpoint
ALTER TABLE `auditLogs` ADD `studioId` int;
--> statement-breakpoint
ALTER TABLE `clients` ADD `studioId` int NOT NULL;
--> statement-breakpoint
ALTER TABLE `transactions` ADD `studioId` int NOT NULL;
--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `role` enum('superadmin','admin','collaborator') NOT NULL DEFAULT 'collaborator';
--> statement-breakpoint
ALTER TABLE `users` ADD `studioId` int;
