ALTER TABLE `appointments` ADD `depositPaid` tinyint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `appointments` ADD `depositAmount` int;--> statement-breakpoint
ALTER TABLE `appointments` ADD `totalAmount` int;