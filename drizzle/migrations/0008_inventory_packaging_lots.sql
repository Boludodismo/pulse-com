ALTER TABLE `catalog_variants`
  ADD COLUMN `baseUnit` varchar(50) NOT NULL DEFAULT 'un',
  ADD COLUMN `purchaseUnit` varchar(50) NOT NULL DEFAULT 'cx',
  ADD COLUMN `unitsPerPackage` decimal(12,3) NOT NULL DEFAULT '1',
  ADD COLUMN `volumeMl` decimal(10,2) NULL,
  ADD COLUMN `colorName` varchar(255) NULL,
  ADD COLUMN `anvisaRegistration` varchar(100) NULL,
  ADD COLUMN `anvisaStatus` enum('nao_aplicavel','regularizado','pendente','bloqueado') NOT NULL DEFAULT 'nao_aplicavel',
  ADD COLUMN `requiresLotControl` tinyint NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE `materials`
  ADD COLUMN `baseUnit` varchar(50) NOT NULL DEFAULT 'un',
  ADD COLUMN `purchaseUnit` varchar(50) NOT NULL DEFAULT 'un',
  ADD COLUMN `unitsPerPackage` decimal(12,3) NOT NULL DEFAULT '1',
  ADD COLUMN `targetStock` decimal(10,2) NOT NULL DEFAULT '0',
  ADD COLUMN `requiresLotControl` tinyint NOT NULL DEFAULT 0,
  ADD COLUMN `anvisaStatus` enum('nao_aplicavel','regularizado','pendente','bloqueado') NOT NULL DEFAULT 'nao_aplicavel';
--> statement-breakpoint
UPDATE `materials`
SET `baseUnit` = COALESCE(NULLIF(`unit`, ''), 'un'),
    `purchaseUnit` = COALESCE(NULLIF(`unit`, ''), 'un'),
    `unitsPerPackage` = 1,
    `targetStock` = `minStock`
WHERE `baseUnit` = 'un' AND `purchaseUnit` = 'un' AND `unitsPerPackage` = 1;
--> statement-breakpoint
ALTER TABLE `stock_movements`
  ADD COLUMN `inputQuantity` decimal(12,3) NULL,
  ADD COLUMN `inputUnit` varchar(50) NULL,
  ADD COLUMN `conversionFactor` decimal(12,3) NOT NULL DEFAULT '1',
  ADD COLUMN `lotNumber` varchar(100) NULL,
  ADD COLUMN `expiresAt` datetime NULL,
  ADD COLUMN `source` enum('manual','procedimento','compra','ajuste') NOT NULL DEFAULT 'manual';
--> statement-breakpoint
UPDATE `stock_movements`
SET `inputQuantity` = `quantity`, `inputUnit` = 'un', `conversionFactor` = 1
WHERE `inputQuantity` IS NULL;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `material_lots` (
  `id` int AUTO_INCREMENT NOT NULL PRIMARY KEY,
  `materialId` int NOT NULL,
  `lotNumber` varchar(100) NOT NULL,
  `expiresAt` datetime NULL,
  `currentQuantity` decimal(12,3) NOT NULL DEFAULT '0',
  `supplierId` int NULL,
  `purchasePrice` decimal(10,2) NULL,
  `receivedAt` bigint NOT NULL DEFAULT 0,
  `isActive` tinyint NOT NULL DEFAULT 1,
  `createdAt` bigint NOT NULL DEFAULT 0,
  `updatedAt` bigint NOT NULL DEFAULT 0,
  UNIQUE KEY `material_lots_material_lot_unique` (`materialId`, `lotNumber`),
  KEY `material_lots_expiry_idx` (`expiresAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
