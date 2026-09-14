ALTER TABLE `materials` MODIFY COLUMN `category` varchar(100);--> statement-breakpoint
ALTER TABLE `materials` MODIFY COLUMN `unit` varchar(50);--> statement-breakpoint
ALTER TABLE `materials` MODIFY COLUMN `createdAt` bigint NOT NULL;--> statement-breakpoint
ALTER TABLE `materials` MODIFY COLUMN `createdAt` bigint NOT NULL DEFAULT 0;--> statement-breakpoint
ALTER TABLE `materials` MODIFY COLUMN `updatedAt` bigint NOT NULL;--> statement-breakpoint
ALTER TABLE `materials` MODIFY COLUMN `updatedAt` bigint NOT NULL DEFAULT 0;--> statement-breakpoint
ALTER TABLE `purchase_order_items` MODIFY COLUMN `materialId` int;--> statement-breakpoint
ALTER TABLE `purchase_order_items` MODIFY COLUMN `notes` text;--> statement-breakpoint
ALTER TABLE `purchase_orders` MODIFY COLUMN `supplierId` int;--> statement-breakpoint
ALTER TABLE `purchase_orders` MODIFY COLUMN `sentAt` bigint;--> statement-breakpoint
ALTER TABLE `purchase_orders` MODIFY COLUMN `createdAt` bigint NOT NULL;--> statement-breakpoint
ALTER TABLE `purchase_orders` MODIFY COLUMN `createdAt` bigint NOT NULL DEFAULT 0;--> statement-breakpoint
ALTER TABLE `purchase_orders` MODIFY COLUMN `updatedAt` bigint NOT NULL;--> statement-breakpoint
ALTER TABLE `purchase_orders` MODIFY COLUMN `updatedAt` bigint NOT NULL DEFAULT 0;--> statement-breakpoint
ALTER TABLE `stock_movements` MODIFY COLUMN `createdAt` bigint NOT NULL;--> statement-breakpoint
ALTER TABLE `stock_movements` MODIFY COLUMN `createdAt` bigint NOT NULL DEFAULT 0;--> statement-breakpoint
ALTER TABLE `suppliers` MODIFY COLUMN `cnpj` varchar(20);--> statement-breakpoint
ALTER TABLE `suppliers` MODIFY COLUMN `email` varchar(255);--> statement-breakpoint
ALTER TABLE `suppliers` MODIFY COLUMN `createdAt` bigint NOT NULL;--> statement-breakpoint
ALTER TABLE `suppliers` MODIFY COLUMN `createdAt` bigint NOT NULL DEFAULT 0;--> statement-breakpoint
ALTER TABLE `suppliers` MODIFY COLUMN `updatedAt` bigint NOT NULL;--> statement-breakpoint
ALTER TABLE `suppliers` MODIFY COLUMN `updatedAt` bigint NOT NULL DEFAULT 0;--> statement-breakpoint
ALTER TABLE `studioSettings` ADD `reminderDaysBefore` int DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `studioSettings` ADD `reminderSendTime` varchar(5) DEFAULT '09:00';--> statement-breakpoint
ALTER TABLE `studioSettings` ADD `reminderResend` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `studioSettings` ADD `reminderResendTime` varchar(5) DEFAULT '18:00';--> statement-breakpoint
