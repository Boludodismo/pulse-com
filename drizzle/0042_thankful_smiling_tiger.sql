CREATE TABLE `appointment_reminders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`appointmentId` int NOT NULL,
	`clientId` int NOT NULL,
	`scheduledAt` timestamp NOT NULL,
	`sentAt` timestamp,
	`status` enum('pending','sent','failed') NOT NULL DEFAULT 'pending',
	`method` enum('whatsapp','email') NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP'
);
--> statement-breakpoint
CREATE TABLE `collaborator_rates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`collaboratorId` int NOT NULL,
	`serviceType` varchar(255) NOT NULL,
	`rate` decimal(10,2) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP',
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE `password_reset_tokens` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`token` varchar(255) NOT NULL,
	`expiresAt` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP'
);
--> statement-breakpoint
DROP TABLE `appointmentReminders`;--> statement-breakpoint
DROP TABLE `collaboratorRates`;--> statement-breakpoint
DROP TABLE `passwordResetTokens`;--> statement-breakpoint
ALTER TABLE `users` DROP INDEX `idx_users_openId`;--> statement-breakpoint
ALTER TABLE `materials` MODIFY COLUMN `category` enum('ink','cartridge','disposable','liquid','protection','stencil','aftercare','other') NOT NULL;--> statement-breakpoint
ALTER TABLE `materials` MODIFY COLUMN `unit` enum('drop','ml','unit','pair','gram','portion','roll_fraction') NOT NULL DEFAULT 'unit';--> statement-breakpoint
ALTER TABLE `materials` MODIFY COLUMN `createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP';--> statement-breakpoint
ALTER TABLE `materials` MODIFY COLUMN `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP;--> statement-breakpoint
ALTER TABLE `purchase_order_items` MODIFY COLUMN `materialId` int NOT NULL;--> statement-breakpoint
ALTER TABLE `purchase_orders` MODIFY COLUMN `supplierId` int NOT NULL;--> statement-breakpoint
ALTER TABLE `purchase_orders` MODIFY COLUMN `status` enum('pendente','enviado','recebido','cancelado') NOT NULL DEFAULT 'pendente';--> statement-breakpoint
ALTER TABLE `purchase_orders` MODIFY COLUMN `totalAmount` decimal(10,2) NOT NULL DEFAULT '0';--> statement-breakpoint
ALTER TABLE `purchase_orders` MODIFY COLUMN `createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP';--> statement-breakpoint
ALTER TABLE `purchase_orders` MODIFY COLUMN `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP;--> statement-breakpoint
ALTER TABLE `stock_movements` MODIFY COLUMN `type` enum('entrada','saida','ajuste','transferencia') NOT NULL;--> statement-breakpoint
ALTER TABLE `stock_movements` MODIFY COLUMN `createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP';--> statement-breakpoint
ALTER TABLE `suppliers` MODIFY COLUMN `email` varchar(320);--> statement-breakpoint
ALTER TABLE `suppliers` MODIFY COLUMN `createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP';--> statement-breakpoint
ALTER TABLE `suppliers` MODIFY COLUMN `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP;--> statement-breakpoint
ALTER TABLE `technical_procedures` MODIFY COLUMN `createdAt` timestamp NOT NULL DEFAULT 'CURRENT_TIMESTAMP';--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `name` varchar(255) NOT NULL;--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `email` varchar(320) NOT NULL;--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `role` enum('admin','artist','collaborator','client') NOT NULL DEFAULT 'client';--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `studioId` int NOT NULL DEFAULT 1;--> statement-breakpoint
ALTER TABLE `materials` ADD `studioId` int DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `materials` ADD `costPerUnit` decimal(10,2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE `materials` ADD `active` tinyint DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `procedure_consumables` ADD `borrowedFromArtistId` int;--> statement-breakpoint
ALTER TABLE `purchase_order_items` ADD `purchaseOrderId` int NOT NULL;--> statement-breakpoint
ALTER TABLE `purchase_order_items` ADD `unitCost` decimal(10,2) NOT NULL;--> statement-breakpoint
ALTER TABLE `purchase_order_items` ADD `createdAt` timestamp DEFAULT 'CURRENT_TIMESTAMP' NOT NULL;--> statement-breakpoint
ALTER TABLE `purchase_orders` ADD `studioId` int DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `purchase_orders` ADD `orderDate` timestamp DEFAULT 'CURRENT_TIMESTAMP' NOT NULL;--> statement-breakpoint
ALTER TABLE `stock_movements` ADD `studioId` int DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `stock_movements` ADD `userId` int;--> statement-breakpoint
ALTER TABLE `stock_movements` ADD `appointmentId` int;--> statement-breakpoint
ALTER TABLE `stock_movements` ADD `procedureId` int;--> statement-breakpoint
ALTER TABLE `suppliers` ADD `studioId` int DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `technical_procedures` ADD `estimatedTotalCost` decimal(10,2) DEFAULT '0';--> statement-breakpoint
ALTER TABLE `transactions` ADD `status` enum('pendente','aprovado','rejeitado','cancelado') DEFAULT 'pendente' NOT NULL;--> statement-breakpoint
ALTER TABLE `transactions` ADD `transactionDate` timestamp DEFAULT 'CURRENT_TIMESTAMP' NOT NULL;--> statement-breakpoint
ALTER TABLE `transactions` ADD `updatedAt` timestamp DEFAULT (now()) NOT NULL ON UPDATE CURRENT_TIMESTAMP;--> statement-breakpoint
ALTER TABLE `users` ADD `password` varchar(255);--> statement-breakpoint
ALTER TABLE `users` ADD `phone` varchar(20);--> statement-breakpoint
ALTER TABLE `users` ADD `profileImageUrl` varchar(500);--> statement-breakpoint
ALTER TABLE `users` ADD `profileImageKey` varchar(500);--> statement-breakpoint
ALTER TABLE `users` ADD `active` tinyint DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD CONSTRAINT `users_email_unique` UNIQUE(`email`);--> statement-breakpoint
ALTER TABLE `appointments` DROP COLUMN `borrowedFromArtistId`;--> statement-breakpoint
ALTER TABLE `materials` DROP COLUMN `avgPrice`;--> statement-breakpoint
ALTER TABLE `materials` DROP COLUMN `isActive`;--> statement-breakpoint
ALTER TABLE `purchase_order_items` DROP COLUMN `orderId`;--> statement-breakpoint
ALTER TABLE `purchase_order_items` DROP COLUMN `materialName`;--> statement-breakpoint
ALTER TABLE `purchase_order_items` DROP COLUMN `materialUnit`;--> statement-breakpoint
ALTER TABLE `purchase_order_items` DROP COLUMN `unitPrice`;--> statement-breakpoint
ALTER TABLE `purchase_order_items` DROP COLUMN `notes`;--> statement-breakpoint
ALTER TABLE `purchase_orders` DROP COLUMN `sentAt`;--> statement-breakpoint
ALTER TABLE `purchase_orders` DROP COLUMN `createdBy`;--> statement-breakpoint
ALTER TABLE `stock_movements` DROP COLUMN `previousStock`;--> statement-breakpoint
ALTER TABLE `stock_movements` DROP COLUMN `newStock`;--> statement-breakpoint
ALTER TABLE `stock_movements` DROP COLUMN `reason`;--> statement-breakpoint
ALTER TABLE `stock_movements` DROP COLUMN `createdBy`;--> statement-breakpoint
ALTER TABLE `suppliers` DROP COLUMN `cnpj`;--> statement-breakpoint
ALTER TABLE `suppliers` DROP COLUMN `whatsapp`;--> statement-breakpoint
ALTER TABLE `suppliers` DROP COLUMN `isActive`;--> statement-breakpoint
ALTER TABLE `technical_procedures` DROP COLUMN `healedImageKey`;--> statement-breakpoint
ALTER TABLE `transactions` DROP COLUMN `date`;--> statement-breakpoint
ALTER TABLE `transactions` DROP COLUMN `studioId`;--> statement-breakpoint
ALTER TABLE `users` DROP COLUMN `openId`;--> statement-breakpoint
ALTER TABLE `users` DROP COLUMN `loginMethod`;--> statement-breakpoint
ALTER TABLE `users` DROP COLUMN `lastSignedIn`;--> statement-breakpoint
ALTER TABLE `users` DROP COLUMN `artistId`;--> statement-breakpoint
ALTER TABLE `users` DROP COLUMN `isActive`;--> statement-breakpoint
ALTER TABLE `users` DROP COLUMN `passwordHash`;