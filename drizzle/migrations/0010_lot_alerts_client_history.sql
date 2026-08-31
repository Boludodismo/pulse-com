ALTER TABLE `stock_movements`
  ADD COLUMN IF NOT EXISTS `alertAt` datetime NULL AFTER `expiresAt`;
--> statement-breakpoint

ALTER TABLE `material_lots`
  ADD COLUMN IF NOT EXISTS `alertAt` datetime NULL AFTER `expiresAt`;
--> statement-breakpoint

ALTER TABLE `procedure_consumables`
  ADD COLUMN IF NOT EXISTS `materialLotId` int NULL AFTER `inventoryItemId`,
  ADD COLUMN IF NOT EXISTS `lotNumber` varchar(100) NULL AFTER `materialLotId`,
  ADD COLUMN IF NOT EXISTS `expiresAt` datetime NULL AFTER `lotNumber`;
