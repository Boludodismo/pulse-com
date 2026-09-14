CREATE TABLE `procedure_consumables` (
	`id` int AUTO_INCREMENT NOT NULL,
	`procedureId` int NOT NULL,
	`inventoryItemId` int,
	`category` enum('ink','cartridge','disposable','liquid','protection','stencil','aftercare','other') NOT NULL,
	`name` varchar(255) NOT NULL,
	`unit` enum('drop','ml','unit','pair','gram','portion','roll_fraction') NOT NULL DEFAULT 'unit',
	`quantity` decimal(10,2) NOT NULL DEFAULT '0',
	`estimatedUnitCost` decimal(10,2) DEFAULT '0',
	`estimatedTotalCost` decimal(10,2) DEFAULT '0',
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE `procedure_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`procedureId` int NOT NULL,
	`eventType` varchar(50) NOT NULL,
	`payload` text,
	`createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE `procedure_images` (
	`id` int AUTO_INCREMENT NOT NULL,
	`procedureId` int NOT NULL,
	`imageUrl` varchar(500) NOT NULL,
	`imageKey` varchar(500) NOT NULL,
	`imageType` enum('reference','stencil','progress','final','healed','other') NOT NULL DEFAULT 'other',
	`description` text,
	`createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE `technical_procedures` (
	`id` int AUTO_INCREMENT NOT NULL,
	`studioId` int NOT NULL DEFAULT 1,
	`clientId` int NOT NULL,
	`artistId` int,
	`artistName` varchar(255),
	`title` varchar(255) NOT NULL,
	`description` text,
	`bodyLocation` varchar(100),
	`tattooStyle` varchar(100),
	`chargedAmount` int DEFAULT 0,
	`status` enum('em_andamento','pausado','finalizado','retorno','retoque') NOT NULL DEFAULT 'em_andamento',
	`startedAt` datetime,
	`pausedAt` datetime,
	`finishedAt` datetime,
	`totalDurationMinutes` int DEFAULT 0,
	`referenceImageUrl` varchar(500),
	`referenceImageKey` varchar(500),
	`stencilImageUrl` varchar(500),
	`stencilImageKey` varchar(500),
	`finalImageUrl` varchar(500),
	`finalImageKey` varchar(500),
	`healedImageUrl` varchar(500),
	`healedImageKey` varchar(500),
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP
);
