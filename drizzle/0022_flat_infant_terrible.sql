CREATE TABLE `materials` (
	`id` int AUTO_INCREMENT NOT NULL PRIMARY KEY,
	`name` varchar(255) NOT NULL,
	`category` varchar(100) NOT NULL,
	`unit` varchar(30) NOT NULL,
	`currentStock` decimal(10,2) NOT NULL DEFAULT '0',
	`minStock` decimal(10,2) NOT NULL DEFAULT '0',
	`averagePrice` decimal(10,2) NOT NULL DEFAULT '0',
	`supplierId` int,
	`notes` text,
	`isActive` tinyint NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE `purchase_order_items` (
	`id` int AUTO_INCREMENT NOT NULL PRIMARY KEY,
	`orderId` int NOT NULL,
	`materialId` int NOT NULL,
	`quantity` decimal(10,2) NOT NULL,
	`unitPrice` decimal(10,2) NOT NULL DEFAULT '0',
	`notes` varchar(255)
);
--> statement-breakpoint
CREATE TABLE `purchase_orders` (
	`id` int AUTO_INCREMENT NOT NULL PRIMARY KEY,
	`supplierId` int NOT NULL,
	`status` enum('rascunho','enviado','confirmado','recebido','cancelado') NOT NULL DEFAULT 'rascunho',
	`notes` text,
	`sentAt` timestamp,
	`createdBy` int,
	`createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE `stock_movements` (
	`id` int AUTO_INCREMENT NOT NULL PRIMARY KEY,
	`materialId` int NOT NULL,
	`type` enum('entrada','saida','ajuste') NOT NULL,
	`quantity` decimal(10,2) NOT NULL,
	`previousStock` decimal(10,2) NOT NULL,
	`newStock` decimal(10,2) NOT NULL,
	`reason` varchar(255),
	`reference` varchar(100),
	`createdBy` int,
	`createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE `suppliers` (
	`id` int AUTO_INCREMENT NOT NULL PRIMARY KEY,
	`name` varchar(255) NOT NULL,
	`cnpj` varchar(18),
	`contactName` varchar(255),
	`phone` varchar(20),
	`whatsapp` varchar(20),
	`email` varchar(320),
	`address` text,
	`notes` text,
	`isActive` tinyint NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP
);
