CREATE TABLE `material_quick_shortcuts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`studioId` int NOT NULL DEFAULT 1,
	`materialId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`quantity` decimal(10,2) NOT NULL,
	`unit` enum('drop','ml','unit','pair','gram','portion','roll_fraction') NOT NULL DEFAULT 'unit',
	`category` enum('ink','cartridge','disposable','liquid','protection','stencil','aftercare','other') NOT NULL,
	`isActive` tinyint NOT NULL DEFAULT 1,
	`createdBy` int,
	`createdAt` bigint NOT NULL DEFAULT 0,
	`updatedAt` bigint NOT NULL DEFAULT 0
);
