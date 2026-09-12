ALTER TABLE `users` MODIFY COLUMN `role` enum('user','admin','artist') NOT NULL DEFAULT 'user';--> statement-breakpoint
ALTER TABLE `clients` ADD `artistId` int;--> statement-breakpoint
ALTER TABLE `users` ADD `artistId` int;