CREATE TABLE IF NOT EXISTS `inventory_kits` (
  `id` int NOT NULL AUTO_INCREMENT,
  `studioId` int NOT NULL,
  `name` varchar(160) NOT NULL,
  `description` varchar(500) DEFAULT NULL,
  `isActive` tinyint NOT NULL DEFAULT 1,
  `createdByUserId` int DEFAULT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `inventory_kits_studio_active_idx` (`studioId`,`isActive`,`name`)
);

CREATE TABLE IF NOT EXISTS `inventory_kit_items` (
  `id` int NOT NULL AUTO_INCREMENT,
  `studioId` int NOT NULL,
  `kitId` int NOT NULL,
  `tenantMaterialId` int NOT NULL,
  `quantity` decimal(12,3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `inventory_kit_items_material_unique` (`studioId`,`kitId`,`tenantMaterialId`),
  KEY `inventory_kit_items_kit_idx` (`studioId`,`kitId`)
);
