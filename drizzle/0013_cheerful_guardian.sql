DROP TABLE `anamnese_requests`;--> statement-breakpoint
DROP TABLE `anamnese_submissions`;--> statement-breakpoint
DROP TABLE `anamnesisRecords`;--> statement-breakpoint
DROP TABLE `appointments`;--> statement-breakpoint
DROP TABLE `artists`;--> statement-breakpoint
DROP TABLE `auditLogs`;--> statement-breakpoint
DROP TABLE `calendars`;--> statement-breakpoint
DROP TABLE `clientNotes`;--> statement-breakpoint
DROP TABLE `clients`;--> statement-breakpoint
DROP TABLE `galleryImages`;--> statement-breakpoint
DROP TABLE `notificationLogs`;--> statement-breakpoint
DROP TABLE `reportTemplates`;--> statement-breakpoint
DROP TABLE `studioSettings`;--> statement-breakpoint
DROP TABLE `transactions`;--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `role` enum('user','admin') NOT NULL DEFAULT 'user';--> statement-breakpoint
ALTER TABLE `users` DROP COLUMN `artistId`;--> statement-breakpoint
ALTER TABLE `users` DROP COLUMN `isActive`;